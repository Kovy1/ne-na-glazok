/* ---------- Фудкост: хранение по учётной записи и обмен с общей базой (скрипт версии 30 и выше) ----------
   На устройстве данные лежат в отдельной базе браузера на каждую учётную запись и адрес общей базы. Что отправлено, а что ждёт отправки,
   считается по сравнению с тем, что подтвердил сервер (S.fc.sy.docs, pl.sync): запись считается «синхронизированной» только после ответа сервера
   с номером версии документа. Несохранённое при потере связи остаётся на устройстве и уходит при следующей синхронизации. Более свежие
   изменения на сервере не затираются: документ принимается только по актуальному номеру (rev), а при расхождении данные объединяются. */
var FC_SRV_MIN=30,FC_FIELDS=['asg','due','st','result','real'];
function fcReg(){return String(curRegion()||'main').split(':')[0];}
function fcSyncOn(){return S.mode==='local'&&syLinked()&&!!S.sy.cfg.url;}
function fcMyId(){var u=String(S.sy.cfg.uid||'');return u.indexOf('u:')===0?u.slice(2):'';}
function fcScopeKey(){
  if(!syLinked())return'';
  var c=S.sy.cfg;
  return fcH(String(c.url))+'-'+String(c.uid||('s:'+c.role)).replace(/[^a-zA-Z0-9:_-]/g,'_');
}
function fcDbName(){return S.fc.scope?'kbzhu-fc:'+S.fc.scope:'kbzhu-fc';}
function fcSaveMsg(e,open){
  var n=String(e&&(e.name||e.message)||'');
  if(/quota/i.test(n))return'Память браузера заполнена: изменения не записаны на устройство. Освободите место (удалите ненужные загрузки отчётов) или сохраните резервную копию.';
  if(open)return'Хранилище браузера недоступно (приватное окно или запрет в настройках): данные сохранятся только до закрытия страницы.';
  return'Не удалось записать на устройство'+(n?' ('+n+')':'')+'. Изменения есть только в открытой странице: сохраните резервную копию.';
}
function fcSaveFail(e,key){S.fc.errK[key||'x']=fcSaveMsg(e);fcStat();}
function fcEq(a,b){return JSON.stringify(a===undefined?null:a)===JSON.stringify(b===undefined?null:b);}
function fcKey(){return'k'+Date.now().toString(36)+Math.random().toString(36).slice(2,8);}
/* ---------- идентификаторы документов ---------- */
function fcBatchDoc(b){return'b_'+(b.reg||fcReg())+'_'+b.id;}
function fcPlanDoc(pl){return pl.docId||('p_'+(pl.reg||fcReg())+'_'+pl.id.replace(/^p_/,''));}
function fcSnapDoc(pl,n){return's_'+(pl.reg||fcReg())+'_'+pl.id.replace(/^p_/,'')+'_'+n;}
function fcMapHash(){return fcH(JSON.stringify(fcCanon({map:S.fc.map,cfg:S.fc.cfg})));}
function fcMapEmpty(){return!Object.keys(S.fc.map||{}).length&&!Object.keys(S.fc.cfg||{}).length;}
/* ---------- что ждёт отправки ---------- */
function fcEnsureKeys(pl){
  Object.keys(pl.state||{}).forEach(function(mid){
    ['cm','hist'].forEach(function(f){var a=pl.state[mid][f]=pl.state[mid][f]||[];a.forEach(function(x){if(!x.k)x.k=fcKey();});});
  });
}
function fcStDiff(loc,base){
  var set={},b=base||{},any=false;
  FC_FIELDS.forEach(function(f){if(!fcEq(loc[f],b[f])){set[f]=loc[f]===undefined?null:loc[f];any=true;}});
  var have={};((b.cm||[]).concat([])).forEach(function(x){have[x.k]=1;});
  var cm=(loc.cm||[]).filter(function(x){return x.k&&!have[x.k];});
  var hv={};(b.hist||[]).forEach(function(x){hv[x.k]=1;});
  var hist=(loc.hist||[]).filter(function(x){return x.k&&!hv[x.k];});
  return{set:set,cm:cm,hist:hist,any:any||cm.length>0||hist.length>0,fields:any};
}
function fcMidsDirty(pl){
  var out=[];
  if(!pl.sync||!(pl.sync.rev>0)||pl.noAccess)return out;
  fcEnsureKeys(pl);
  Object.keys(pl.state).forEach(function(mid){
    var base=pl.sync.srv&&pl.sync.srv[mid];
    if(!base)return;                                   // новое мероприятие уйдёт вместе с версией плана
    if(pl.limited&&!(pl.state[mid].asg&&pl.state[mid].asg.id===fcMyId()))return;
    if(fcStDiff(pl.state[mid],base).any)out.push(mid);
  });
  return out;
}
function fcPlanDirty(pl){return!pl.limited&&!pl.noAccess&&(!(pl.sync&&pl.sync.rev>0)||pl.versions.length>(pl.sync.nv||0));}
function fcLocalBatches(){return Object.keys(S.fc.batches).map(function(k){return S.fc.batches[k];});}
function fcPending(){
  var n=0,sy=S.fc.sy.docs,have={};
  fcLocalBatches().forEach(function(b){var id=fcBatchDoc(b);have[id]=1;if(!(sy[id]&&sy[id].rev>0))n++;});
  Object.keys(sy).forEach(function(id){if(id.charAt(0)==='b'&&!have[id]&&!sy[id].del&&sy[id].rev>0)n++;});
  if(!fcMapEmpty()&&(!sy.m_main||sy.m_main.h!==fcMapHash()))n++;
  Object.keys(S.fc.plans).forEach(function(k){
    var pl=S.fc.plans[k];
    if(fcPlanDirty(pl))n++;
    n+=fcMidsDirty(pl).length;
    if(!pl.limited)pl.versions.forEach(function(v){if(v.snapInfo&&!(sy[fcSnapDoc(pl,v.n)]&&sy[fcSnapDoc(pl,v.n)].rev>0))n++;});
  });
  return n;
}
/* ---------- статус для экрана: «сохранено на устройстве» / «синхронизировано» / «ошибка сохранения» ---------- */
function fcStat(){
  var el=typeof document!=='undefined'&&document.getElementById('fcSyncLine');
  if(el)el.innerHTML=fcSyncHtml();
}
function fcState(){
  var ss=S.fc.ss||(S.fc.ss={st:'idle'}),errs=Object.keys(S.fc.errK||{}).filter(function(k){return S.fc.errK[k];}),n=fcPending();
  var st,txt;
  if(errs.length){st='save-error';txt='Ошибка сохранения: '+S.fc.errK[errs[0]];}
  else if(!fcSyncOn()){st='device';txt='Сохранено на устройстве. Общая база не подключена: данные видны только в этом браузере и другим сотрудникам не передаются.';}
  else if(ss.st==='syncing'){st='syncing';txt='Отправка в общую базу…';}
  else if(ss.st==='error'){st='sync-error';txt='Ошибка синхронизации: '+ss.msg+(n?' Сохранено на устройстве, ждёт отправки: '+n+'.':' ');}
  else if(n>0){st='pending';txt='Сохранено на устройстве, ещё не отправлено в общую базу: '+n+'.';}
  else if(ss.at){st='synced';txt='Синхронизировано с общей базой в '+new Date(ss.at).toTimeString().slice(0,5)+'.';}
  else{st='pending';txt='Сохранено на устройстве. Синхронизация с общей базой ещё не выполнялась.';}
  return{st:st,txt:txt,n:n};
}
function fcSyncHtml(){
  var x=fcState(),cls=(x.st==='save-error'||x.st==='sync-error')?'w-warn':'hint',btn=(fcSyncOn()&&x.st!=='syncing')?' <button class="btn mini" data-act="fcSyncNow">Синхронизировать</button>':'';
  return'<p class="'+cls+'" role="status" data-fcst="'+x.st+'">'+esc(x.txt)+btn+'</p>';
}
function fcSyncSoon(ms){
  if(!fcSyncOn()||!S.fc.ld)return;
  clearTimeout(S.fc.syT);
  S.fc.syT=setTimeout(function(){fcSync();},ms===undefined?1500:ms);
}
/* ---------- ошибки ---------- */
function fcSyncErr(e){
  if(e&&e.code==='gas'){
    if(e.err==='a'||e.err==='op')return'в таблице скрипт старее версии '+FC_SRV_MIN+': обновите его по инструкции в разделе «Личный кабинет» (без него отчёты и планы остаются только на этом устройстве)';
    if(e.err==='size')return String(e.msg||'документ слишком большой для общей базы');
    return String(e.msg||'сервер вернул ошибку');
  }
  return String(syErrText(e)).replace(/\.$/,'');
}
/* ---------- запись в общую базу и чтение ---------- */
function fcPost(op,extra){return syPost(op,extra,syCode(),45000);}
function fcPoolRun(tasks,n){return syPool(tasks,n||3);}
/* ---------- принятие документов с сервера ---------- */
function fcRemoveBatchLocal(id){
  var b=S.fc.batches[id];
  if(!b)return;
  Object.keys(S.fc.ops).forEach(function(t){var o=S.fc.ops[t];Object.keys(o).forEach(function(k){if(o[k].b===id)delete o[k];});});
  delete S.fc.batches[id];
}
function fcInstallBatch(doc){
  var b=doc.data.batch,ops=doc.data.ops||{};
  if(!b||!b.id)return;
  b.reg=doc.reg;
  Object.keys(ops).forEach(function(t){var h=S.fc.ops[t]||(S.fc.ops[t]={});(ops[t]||[]).forEach(function(o){if(!h[o.id]){o.b=b.id;h[o.id]=o;}});});
  S.fc.batches[b.id]=b;
  S.fc.sy.docs[doc.id]={rev:doc.rev};
}
function fcMergeMap(doc){
  var rm=doc.data.map||{},rc=doc.data.cfg||{},dirty=S.fc.sy.docs.m_main&&S.fc.sy.docs.m_main.h!==fcMapHash(),conf=S.fc.sy.conf=S.fc.sy.conf||[];
  if(!S.fc.sy.docs.m_main&&!fcMapEmpty())dirty=true;
  if(!dirty){S.fc.map=fcClone(rm);S.fc.cfg=fcClone(rc);}
  else{
    Object.keys(rm).forEach(function(k){
      if(!(k in S.fc.map))S.fc.map[k]=rm[k];
      else if(S.fc.map[k]!==rm[k]){conf.push('Сопоставление «'+k.replace(/^[ir]:(c|n):/,'')+'»: на сервере уже выбрано другое, оставлено серверное значение.');S.fc.map[k]=rm[k];}
    });
    Object.keys(rc).forEach(function(k){
      if(k==='thr'){S.fc.cfg.thr=S.fc.cfg.thr||{};Object.keys(rc.thr||{}).forEach(function(t){if(S.fc.cfg.thr[t]!==undefined&&S.fc.cfg.thr[t]!==rc.thr[t])conf.push('Порог «'+t+'»: на сервере другое значение, оставлено серверное.');S.fc.cfg.thr[t]=rc.thr[t];});}
      else{if(S.fc.cfg[k]!==undefined&&!fcEq(S.fc.cfg[k],rc[k]))conf.push('Настройка «'+k+'»: на сервере другое значение, оставлено серверное.');S.fc.cfg[k]=rc[k];}
    });
  }
  S.fc.sy.docs.m_main={rev:doc.rev,h:fcH(JSON.stringify(fcCanon({map:rm,cfg:rc})))};
}
function fcUnion(a,b){
  var seen={},out=[];
  (a||[]).concat(b||[]).forEach(function(x){if(x&&x.k&&!seen[x.k]){seen[x.k]=1;out.push(x);}});
  return out.sort(function(p,q){return(p.at||'')<(q.at||'')?-1:((p.at||'')>(q.at||'')?1:(p.k<q.k?-1:1));});
}
/* локальное состояние мероприятия + серверное: свои несохранённые поля остаются, если на сервере их не меняли; иначе остаётся серверное, а расхождение запоминается */
function fcRebase(ls,rs,base){
  var out=fcClone(rs),conf=(ls.conf||[]).slice(),b=base||{};
  [ls.cm,ls.hist].forEach(function(a){(a||[]).forEach(function(x){if(!x.k)x.k=fcKey();});});
  FC_FIELDS.forEach(function(f){
    if(fcEq(ls[f],b[f]))return;
    if(fcEq(rs[f],b[f])){out[f]=ls[f];return;}
    if(!fcEq(ls[f],rs[f]))conf.push({f:f,mine:ls[f]===undefined?null:ls[f],theirs:rs[f]===undefined?null:rs[f],at:fcToday()});
  });
  out.cm=fcUnion(rs.cm,ls.cm);out.hist=fcUnion(rs.hist,ls.hist);
  out.rev=rs.rev;if(conf.length)out.conf=conf;else delete out.conf;
  if(ls.dueSug&&!out.dueSug)out.dueSug=ls.dueSug;
  return out;
}
function fcMergePlan(doc){
  var rp=doc.data.plan,lid=rp.lid||('p_'+doc.id.replace(/^p_[a-z0-9-]+_p_/,'')),pl=S.fc.plans[lid],rv=rp.versions||[],srv={},local=!!pl,onlyLocal=[];
  if(!pl)pl=S.fc.plans[lid]={id:lid,obj:rp.obj,objName:rp.objName,from:rp.from,to:rp.to,createdAt:rp.createdAt,reg:doc.reg,versions:[],state:{}};
  pl.docId=doc.id;pl.reg=doc.reg;pl.limited=!!doc.limited;pl.noAccess=false;
  if(doc.limited){pl.versions=fcClone(rv);}
  else{
    onlyLocal=pl.versions.filter(function(v){return!rv.some(function(r){return r.n===v.n&&r.fp===v.fp;});});
    var next=rv.length?rv[rv.length-1].n+1:1,merged=fcClone(rv),renum=[];
    onlyLocal.forEach(function(v){
      /* версия построена здесь, пока на сервере появилась другая с тем же номером: остаётся после серверных, снимок переносится под новый номер */
      var c=fcClone(v),old=c.n;
      if(merged.some(function(r){return r.fp===c.fp;}))return;
      c.n=next++;renum.push([old,c.n]);merged.push(c);
    });
    renum.forEach(function(p){fcSnapGet(pl.id,p[0]).then(function(sn){if(sn)fcSnapSave(pl.id,p[1],sn);});});
    pl.versions=merged;
  }
  Object.keys(rp.state||{}).forEach(function(mid){
    var rs=rp.state[mid],ls=pl.state[mid],base=pl.sync&&pl.sync.srv&&pl.sync.srv[mid];
    srv[mid]=fcClone(rs);
    if(!ls||!local){pl.state[mid]=fcClone(rs);return;}
    if(!base&&local){pl.state[mid]=fcRebase(ls,rs,{asg:null,due:'',st:'new',result:'',real:null,cm:[],hist:[]});return;}
    pl.state[mid]=fcStDiff(ls,base).any?fcRebase(ls,rs,base):fcClone(rs);
  });
  pl.sync={rev:doc.rev,srv:srv,nv:doc.limited?0:rv.length};
  S.fc.sy.docs[doc.id]={rev:doc.rev};
}
/* ---------- чтение: что на сервере ---------- */
function fcPull(d){
  var sy=S.fc.sy.docs,srv={},tasks=[],changed=false,localPl={};
  (d.items||[]).forEach(function(it){srv[it.id]=it;});
  Object.keys(S.fc.plans).forEach(function(k){localPl[fcPlanDoc(S.fc.plans[k])]=S.fc.plans[k];});
  (d.items||[]).forEach(function(it){
    var know=sy[it.id];
    if(it.t==='b'){
      var lb=fcLocalBatches().filter(function(b){return fcBatchDoc(b)===it.id;})[0];
      if(it.del){if(lb){fcRemoveBatchLocal(lb.id);changed=true;}sy[it.id]={rev:it.rev,del:1};return;}
      if(lb){if(!(know&&know.rev>0))sy[it.id]={rev:it.rev};return;}
      if(know&&(know.del||know.rev>0))return;           // удалена здесь: удаление уйдёт на сервер до чтения
      tasks.push(function(){return syGet({a:'fcget',id:it.id},60000).then(function(r){if(r&&r.doc){fcInstallBatch(r.doc);changed=true;}});});
    }else if(it.t==='m'){
      if(!know||it.rev>know.rev)tasks.push(function(){return syGet({a:'fcget',id:it.id},60000).then(function(r){if(r&&r.doc){fcMergeMap(r.doc);changed=true;}});});
    }else if(it.t==='p'){
      var pl=localPl[it.id];
      if(!pl||it.rev>((pl.sync&&pl.sync.rev)||0))tasks.push(function(){return syGet({a:'fcget',id:it.id},60000).then(function(r){if(r&&r.doc){fcMergePlan(r.doc);changed=true;}});});
    }else if(it.t==='s'){
      if(!(know&&know.rev>0))sy[it.id]={rev:it.rev};
    }
  });
  /* документы, которые были синхронизированы, но больше не отдаются (доступ закрыт или удалены): без несохранённых правок убираются с устройства */
  Object.keys(S.fc.plans).forEach(function(k){
    var pl=S.fc.plans[k],id=fcPlanDoc(pl);
    if(!(pl.sync&&pl.sync.rev>0)||srv[id])return;
    if(fcPlanDirty(pl)||fcMidsDirty(pl).length){pl.noAccess=true;changed=true;}
    else{delete S.fc.plans[k];delete sy[id];changed=true;}
  });
  fcLocalBatches().forEach(function(b){
    var id=fcBatchDoc(b);
    if(sy[id]&&sy[id].rev>0&&!srv[id]){fcRemoveBatchLocal(b.id);delete sy[id];changed=true;}
  });
  return fcPoolRun(tasks,3).then(function(){return changed;});
}
/* ---------- запись: удаления, документы, мероприятия ---------- */
function fcDelPush(){
  var sy=S.fc.sy.docs,have={},tasks=[];
  fcLocalBatches().forEach(function(b){have[fcBatchDoc(b)]=1;});
  Object.keys(sy).forEach(function(id){
    if(id.charAt(0)!=='b'||have[id]||sy[id].del||!(sy[id].rev>0))return;
    tasks.push(function(){return fcPost('fcdel',{id:id}).then(function(r){sy[id]={rev:r.rev||sy[id].rev,del:1};});});
  });
  return fcPoolRun(tasks,3);
}
function fcPlanPayload(pl){
  fcEnsureKeys(pl);
  return{plan:{lid:pl.id,obj:pl.obj,objName:pl.objName,from:pl.from,to:pl.to,createdAt:pl.createdAt,
    versions:pl.versions.map(function(v){return v;}),state:pl.state}};
}
function fcPushDocs(errs){
  var sy=S.fc.sy.docs,chain=Promise.resolve(),reg=fcReg();
  function fail(id,e){
    if(e&&e.code==='gas'&&(e.err==='size'||e.err==='region'||e.err==='asg'||e.err==='doc'||e.err==='viewer'||e.err==='reg')){errs.push(fcSyncErr(e));return true;}
    return false;
  }
  /* сопоставления и настройки */
  if(!fcMapEmpty()&&(!sy.m_main||sy.m_main.h!==fcMapHash())){
    chain=chain.then(function(){
      var tries=0;
      function go(){
        var h=fcMapHash();
        return fcPost('fcput',{id:'m_main',base:(sy.m_main&&sy.m_main.rev)||0,data:{map:S.fc.map,cfg:S.fc.cfg}}).then(function(r){sy.m_main={rev:r.rev,h:h};},function(e){
          if(e&&e.code==='gas'&&e.err==='newer'&&e.res&&e.res.doc&&tries++<3){fcMergeMap(e.res.doc);return go();}
          if(!fail('m',e))throw e;
        });
      }
      return go();
    });
  }
  /* загрузки отчётов */
  fcLocalBatches().forEach(function(b){
    var id=fcBatchDoc(b);
    if(!b.reg){b.reg=reg;id=fcBatchDoc(b);}
    if(sy[id]&&sy[id].rev>0)return;
    chain=chain.then(function(){
      var ops={};
      Object.keys(S.fc.ops).forEach(function(t){var a=[];Object.keys(S.fc.ops[t]).forEach(function(k){if(S.fc.ops[t][k].b===b.id)a.push(S.fc.ops[t][k]);});if(a.length)ops[t]=a;});
      return fcPost('fcput',{id:id,reg:b.reg,obj:b.obj,objName:b.objName,data:{batch:b,ops:ops}}).then(function(r){sy[id]=r.deleted?{rev:r.rev,del:1}:{rev:r.rev};if(r.deleted)fcRemoveBatchLocal(b.id);},function(e){if(!fail(id,e))throw e;});
    });
  });
  /* планы: версии добавляются, прежние не переписываются */
  Object.keys(S.fc.plans).forEach(function(k){
    var pl=S.fc.plans[k];
    if(!fcPlanDirty(pl))return;
    chain=chain.then(function(){
      var tries=0,id=fcPlanDoc(pl);pl.docId=id;
      function go(){
        return fcPost('fcput',{id:id,reg:pl.reg||reg,base:(pl.sync&&pl.sync.rev)||0,data:fcPlanPayload(pl)}).then(function(r){
          var old=(pl.sync&&pl.sync.srv)||{},srvSt={};
          Object.keys(pl.state).forEach(function(m){if(old[m])srvSt[m]=old[m];else{srvSt[m]=fcClone(pl.state[m]);srvSt[m].rev=0;pl.state[m].rev=0;}});
          pl.sync={rev:r.rev,srv:srvSt,nv:pl.versions.length};sy[id]={rev:r.rev};
        },function(e){
          if(e&&e.code==='gas'&&e.err==='newer'&&e.res&&e.res.doc&&tries++<3){fcMergePlan(e.res.doc);return go();}
          if(!fail(id,e))throw e;
        });
      }
      return go();
    });
  });
  /* снимки исходных данных версий */
  Object.keys(S.fc.plans).forEach(function(k){
    var pl=S.fc.plans[k];
    if(pl.limited||pl.noAccess)return;
    pl.versions.forEach(function(v){
      var sid=fcSnapDoc(pl,v.n);
      if(!v.snapInfo||(sy[sid]&&sy[sid].rev>0))return;
      chain=chain.then(function(){
        if(!(pl.sync&&pl.sync.rev>0))return;
        return fcSnapGet(pl.id,v.n).then(function(sn){
          if(!sn)return;
          return fcPost('fcput',{id:sid,reg:pl.reg||reg,obj:pl.obj,objName:pl.objName,data:{snap:sn}}).then(function(r){sy[sid]={rev:r.rev};},function(e){if(!fail(sid,e))throw e;});
        });
      });
    });
  });
  return chain;
}
/* мероприятие отправляется отдельно от документа плана: у каждого свой номер (rev), одновременная правка одного мероприятия не затирает чужую */
function fcActPush(pl,mid,errs){
  var tries=0,id=fcPlanDoc(pl);
  function go(){
    var loc=pl.state[mid],base=pl.sync.srv[mid]||{},d=fcStDiff(loc,base),set={};
    if(!d.any)return Promise.resolve();
    Object.keys(d.set).forEach(function(f){if(!pl.limited||f==='st'||f==='result')set[f]=d.set[f];});
    return fcPost('fcact',{id:id,mid:mid,base:Number(base.rev)||0,set:set,cm:d.cm,hist:d.hist}).then(function(r){
      var m=r.m,cur=pl.state[mid];
      pl.sync.srv[mid]=fcClone(m);
      cur.rev=m.rev;
      cur.cm=fcUnion(m.cm,cur.cm);cur.hist=fcUnion(m.hist,cur.hist);
      pl.sync.srv[mid].cm=fcUnion(m.cm,[]);pl.sync.srv[mid].hist=fcUnion(m.hist,[]);
    },function(e){
      if(e&&e.code==='gas'&&e.err==='newer'&&e.res&&e.res.m&&tries++<3){
        pl.state[mid]=fcRebase(pl.state[mid],e.res.m,base);
        pl.sync.srv[mid]=fcClone(e.res.m);
        return go();
      }
      if(e&&e.code==='gas'&&(e.err==='denied'||e.err==='viewer'||e.err==='nofile'||e.err==='asg'||e.err==='st')){errs.push(fcSyncErr(e));return;}
      throw e;
    });
  }
  return go();
}
function fcActsPush(errs){
  var tasks=[];
  Object.keys(S.fc.plans).forEach(function(k){
    var pl=S.fc.plans[k];
    fcMidsDirty(pl).forEach(function(mid){tasks.push(function(){return fcActPush(pl,mid,errs);});});
  });
  return fcPoolRun(tasks,2);
}
/* ---------- полный цикл ---------- */
function fcSyncRun(){
  var errs=[],keep;
  return fcDelPush().then(function(){return syGet({a:'fcidx'},45000);}).then(function(d){
    S.fc.srvWrite=!!d.write;
    return(d.write?syGet({a:'fcusers'},30000).then(function(u){S.fc.users=(u&&u.users)||[];},function(){}):Promise.resolve()).then(function(){return fcPull(d);});
  }).then(function(){return fcPushDocs(errs);}).then(function(){return fcActsPush(errs);}).then(function(){
    S.fc.quiet=true;
    return Promise.all(['sy','plans','batches','ops','map','cfg'].map(fcPut));
  }).then(function(){return fcSavedAll();}).then(function(ok){
    S.fc.quiet=false;
    if(!ok)errs.push('данные не записались на устройство');
    return{ok:!errs.length,errs:errs};
  });
}
function fcSync(){
  var ss=S.fc.ss=S.fc.ss||{st:'idle'};
  if(!fcSyncOn()||!S.fc.ld){fcStat();return Promise.resolve({ok:false,off:true});}
  if(S.fc.syncP){S.fc.again=true;return S.fc.syncP;}
  ss.st='syncing';ss.msg='';fcStat();
  var k=S.fc.scopeLoaded;
  S.fc.syncP=fcSyncRun().then(function(r){
    if(r.ok){ss.st='ok';ss.at=Date.now();ss.msg='';}else{ss.st='error';ss.msg=r.errs.join('; ');}
    return r;
  },function(e){S.fc.quiet=false;ss.st='error';ss.msg=fcSyncErr(e);return{ok:false,errs:[ss.msg],err:e};}).then(function(r){
    S.fc.syncP=null;
    var again=S.fc.again;S.fc.again=false;
    fcStat();
    if(S.tab==='fc'&&fcCanRedraw())renderAll();
    if(again&&ss.st!=='error')return fcSync();
    return r;
  });
  return S.fc.syncP;
}
function fcCanRedraw(){
  var a=typeof document!=='undefined'&&document.activeElement;
  return!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
}
/* ---------- кому можно менять мероприятие ---------- */
function fcCanAct(pl,mid){
  if(fcCanEdit())return!pl||!pl.limited;
  var s=pl&&pl.state[mid],me=fcMyId();
  return!!(S.mode==='local'&&syLinked()&&me&&s&&s.asg&&s.asg.t==='user'&&s.asg.id===me);
}
/* ---------- резервная копия аналитики вместе с планами ---------- */
var FC_BK_APP='kbzhu-fc-backup';
function fcBackupPack(){
  var snaps={},ps=Object.keys(S.fc.plans).map(function(k){return S.fc.plans[k];}).filter(function(p){return!p.limited;}),tasks=[];
  ps.forEach(function(pl){pl.versions.forEach(function(v){tasks.push(fcSnapGet(pl.id,v.n).then(function(sn){if(sn)snaps[fcSnapKey(pl.id,v.n)]=sn;}));});});
  return Promise.all(tasks).then(function(){
    var plans={};
    ps.forEach(function(pl){var c=fcClone(pl);delete c.sync;delete c.docId;delete c.noAccess;plans[pl.id]=c;});
    var b={app:FC_BK_APP,v:1,at:new Date().toISOString(),by:String(S.sy.cfg&&S.sy.cfg.name||''),ops:S.fc.ops,batches:S.fc.batches,map:S.fc.map,cfg:S.fc.cfg,plans:plans,snaps:snaps};
    var txt=JSON.stringify(b);
    b.check=fcH(txt);
    return JSON.stringify(b);
  });
}
/* восстановление только добавляет: ничего не удаляет и не переписывает более свежее — уже существующие версии и состояние мероприятий остаются */
function fcRestore(txt){
  var b,rep={batches:0,ops:0,plans:0,versions:0,measures:0,map:0,snaps:0,skip:[]};
  try{b=JSON.parse(txt);}catch(e){return Promise.resolve({ok:false,msg:'Файл не читается: это не копия аналитики.'});}
  if(!b||b.app!==FC_BK_APP||!b.batches||!b.plans||!b.ops)return Promise.resolve({ok:false,msg:'Это не копия аналитики «Фудкост»: в файле нет нужных разделов.'});
  var chk=b.check;delete b.check;
  if(chk&&fcH(JSON.stringify(b))!==chk)return Promise.resolve({ok:false,msg:'Файл повреждён: контрольная сумма не совпала. Копия не применена.'});
  if(!fcCanEdit())return Promise.resolve({ok:false,msg:'Восстановление доступно технологу, редактору и тер. управляющему.'});
  var before=JSON.stringify([S.fc.ops,S.fc.batches,S.fc.map,S.fc.cfg,S.fc.plans]);
  try{
    Object.keys(b.batches).forEach(function(id){
      var bt=b.batches[id];
      if(S.fc.batches[id])return;
      S.fc.batches[id]=bt;rep.batches++;
    });
    Object.keys(b.ops).forEach(function(t){
      var h=S.fc.ops[t]||(S.fc.ops[t]={});
      Object.keys(b.ops[t]).forEach(function(k){if(!h[k]&&S.fc.batches[b.ops[t][k].b]){h[k]=b.ops[t][k];rep.ops++;}});
    });
    Object.keys(b.map||{}).forEach(function(k){if(!(k in S.fc.map)){S.fc.map[k]=b.map[k];rep.map++;}});
    Object.keys(b.cfg||{}).forEach(function(k){if(S.fc.cfg[k]===undefined)S.fc.cfg[k]=b.cfg[k];});
    Object.keys(b.plans).forEach(function(id){
      var rp=b.plans[id],pl=S.fc.plans[id];
      if(!pl){S.fc.plans[id]=rp;rep.plans++;rep.versions+=rp.versions.length;rep.measures+=Object.keys(rp.state||{}).length;return;}
      var next=pl.versions.length?pl.versions[pl.versions.length-1].n+1:1;
      rp.versions.forEach(function(v){
        if(pl.versions.some(function(x){return x.fp===v.fp;}))return;
        var c=fcClone(v),old=c.n;c.n=next++;pl.versions.push(c);rep.versions++;
        if(b.snaps&&b.snaps[fcSnapKey(id,old)])b.snaps[fcSnapKey(id,c.n)]=b.snaps[fcSnapKey(id,old)];
      });
      Object.keys(rp.state||{}).forEach(function(m){if(!pl.state[m]){pl.state[m]=rp.state[m];rep.measures++;}});
    });
  }catch(e){return Promise.resolve({ok:false,msg:'Не удалось применить копию: '+(e&&e.message||'ошибка')+'.'});}
  var tasks=[];
  Object.keys(b.snaps||{}).forEach(function(key){var m=/^snap:(.+):(\d+)$/.exec(key);if(m&&S.fc.plans[m[1]]){tasks.push(fcSnapSave(m[1],Number(m[2]),b.snaps[key]));rep.snaps++;}});
  S.fc.restored={at:Date.now(),rep:rep};
  return Promise.all(tasks.concat(['plans','batches','ops','map','cfg'].map(fcPut))).then(function(){return fcSavedAll();}).then(function(ok){
    if(!ok){return{ok:false,msg:'Копия применена в открытой странице, но не записана на устройство: '+(Object.keys(S.fc.errK).map(function(k){return S.fc.errK[k];})[0]||'ошибка хранилища')};}
    fcSyncSoon(200);
    return{ok:true,rep:rep};
  });
}
function fcRestoreFile(f){
  if(!fcCanEdit()){roFlash();return;}
  var rd=new FileReader();
  rd.onload=function(){fcRestore(String(rd.result||'')).then(function(r){
    if(!r.ok){flash(r.msg);return;}
    flash('Восстановлено: загрузок '+r.rep.batches+', планов '+r.rep.plans+', версий '+r.rep.versions+', мероприятий '+r.rep.measures+'. Существующие данные не менялись.');
    renderAll();
  });};
  rd.onerror=function(){flash('Файл не прочитан');};
  rd.readAsText(f);
}
/* принять в учётную запись локальные данные, созданные без входа (прежняя локальная база браузера) */
function fcAdoptLocal(){
  if(!S.fc.scope)return Promise.resolve({ok:false,msg:'Сейчас открыты данные без учётной записи.'});
  var old;
  return new Promise(function(res){
    var rq;try{rq=indexedDB.open('kbzhu-fc',1);}catch(e){res(null);return;}
    rq.onupgradeneeded=function(){try{rq.transaction.abort();}catch(e){}res(null);};
    rq.onsuccess=function(){var db=rq.result,tx,g;try{tx=db.transaction('kv','readonly');g=tx.objectStore('kv').getAll();g.onsuccess=function(){db.close();res(g.result||[]);};g.onerror=function(){db.close();res(null);};}catch(e){db.close();res(null);}};
    rq.onerror=function(){res(null);};
  }).then(function(rows){
    if(!rows||!rows.length)return{ok:false,msg:'Локальных данных без учётной записи на этом устройстве нет.'};
    var o={app:FC_BK_APP,v:1,ops:{},batches:{},map:{},cfg:{},plans:{},snaps:{}};
    rows.forEach(function(r){if(r&&r.id&&o[r.id]!==undefined&&r.id!=='snaps')o[r.id]=r.rec||o[r.id];else if(r&&/^snap:/.test(r.id))o.snaps[r.id]=r.rec;});
    return fcRestore(JSON.stringify(o));
  });
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{sync:fcSync,state:fcState,pending:fcPending,scopeKey:fcScopeKey,dbName:fcDbName,load:fcLoad,reset:fcReset,backup:fcBackupPack,restore:fcRestore,adoptLocal:fcAdoptLocal,canAct:fcCanAct,myId:fcMyId,planDoc:fcPlanDoc,mids:fcMidsDirty,put:fcPut});}catch(e){}

/* раз в минуту, пока открыт раздел: подтянуть изменения других сотрудников и отправить отложенное */
try{setInterval(function(){if(S.tab==='fc'&&fcSyncOn()&&S.fc.ld&&!S.fc.syncP&&(typeof document==='undefined'||document.visibilityState!=='hidden'))fcSync();},60000);}catch(e){}
