/* ---------- проверка ТТК технологом и доработка редактором ----------
   Технолог открывает присланную ТТК прямо из «На проверке»: у него появляется её копия, которую можно править,
   а сверху плашка с решением: опубликовать (уйдёт его версия), вернуть на доработку (комментарий обязателен) или отклонить.
   Редактор получает уведомление о доработке, открывает карту (в любом браузере), исправляет и отправляет на проверку снова. */
var rvBarLast='';
function rvBatchById(id){
  var ls=[S.sy.pend,S.sy.rework,S.sy.inbox,S.sy.inboxR],i,j;
  for(i=0;i<ls.length;i++)if(ls[i])for(j=0;j<ls[i].length;j++)if(ls[i][j].batch===id)return ls[i][j];
  return null;
}
function rvRecIn(b,sid){var r=null;((b&&b.items)||[]).forEach(function(x){if(x.kind==='rec'&&x.sid===sid)r=x;});return r;}
/* локальная позиция, связанная с общей (по sid) */
function rvLocalOf(kind,sid){
  var m=syMap(syCtx(),kind),src=kind==='rec'?S.recipes:S.ings,k,id='';
  for(k in m)if(m[k].sid===sid&&src[k])id=k;
  return id;
}
function rvTmpIds(rv){return Object.keys(rv.recs).map(function(s){return rv.recs[s];}).filter(function(i){return!!S.recipes[i];});}
/* временные копии проверки не считаются «моими изменениями» */
function rvIsTmp(kind,id){
  var rv=S.sy.rv,sid,fr=S.sy.fr;
  if(fr&&((kind==='rec'&&fr.recId===id)||(kind==='ing'&&fr.ings.indexOf(id)>-1)))return true;
  if(!rv)return false;
  if(kind==='rec'){for(sid in rv.recs)if(rv.recs[sid]===id)return true;return false;}
  return rv.ings.indexOf(id)>-1;
}
function rvValidate(){
  var rv=S.sy.rv,fr=S.sy.fr;
  if(rv&&(!syAdmin()||!rvTmpIds(rv).length))S.sy.rv=null;
  if(fr&&(!syAdmin()||!S.recipes[fr.recId]))S.sy.fr=null;
}
/* сырьё из присланной рецептуры, которого у вас нет: берётся из предложения (временно, пока идёт проверка) или из общей базы */
function rvMissingIngs(j,items,made){
  var ctx=syCtx(),m=syMap(ctx,'ing'),sidIdx={},nameIdx={};
  Object.keys(m).forEach(function(id){if(m[id].sid&&S.ings[id])sidIdx[m[id].sid]=id;});
  Object.keys(S.ings).forEach(function(id){var k=normKey(S.ings[id].name);if(k&&!nameIdx[k])nameIdx[k]=id;});
  (j.rows||[]).forEach(function(x){
    var sid=String(x.ing||''),k=normKey(x['in']);
    if(!sid||sidIdx[sid]||(k&&nameIdx[k]))return;
    var src=null,rev=0,i,pb=S.sy.pub['ing|'+sid],id;
    for(i=0;i<(items||[]).length;i++)if(items[i].kind==='ing'&&items[i].sid===sid)src=items[i].json;
    if(!src&&pb){src=pb.json;rev=pb.rev;}
    if(!src)return;
    id=uid();
    S.ings[id]=normIng(syIngClean(src));
    m[id]={sid:sid,rev:rev,h:''};
    if(rev)m[id].h=syCur(ctx,'ing',id).h;
    sidIdx[sid]=id;nameIdx[normKey(S.ings[id].name)]=id;
    if(!rev&&made)made.push(id);
  });
}
function rvShow(id){
  var r=S.recipes[id];
  if(!r)return;
  if(r.reg&&regKnown(r.reg)&&r.reg!==curRegion())setRegion(r.reg);
  S.tab='calc';S.ttkHome=false;setActive(id);renderAll();window.scrollTo(0,0);
}

/* ----- технолог ----- */
function rvOpen(batchId,sid){
  if(!syAdmin())return;
  var b=rvBatchById(batchId),it=rvRecIn(b,sid),rv=S.sy.rv,id;
  if(!it)return;
  if(S.sy.fr&&S.recipes[S.sy.fr.recId]){flash('Сначала завершите проверку файла «'+S.sy.fr.name+'» или закройте её');rvShow(S.sy.fr.recId);return;}
  if(rv&&rv.batch!==batchId){
    flash('Сначала завершите проверку ТТК от '+rv.by+' или закройте её');
    id=rvTmpIds(rv)[0];
    if(id)rvShow(id);else{S.sy.rv=null;}
    return;
  }
  if(!rv)rv=S.sy.rv={batch:batchId,by:b.by,at:b.at,recs:{},ings:[]};
  id=rv.recs[sid];
  if(!id||!S.recipes[id]){
    var made=[];
    rvMissingIngs(it.json,b.items,made);
    rv.ings=rv.ings.concat(made);
    id=uid();S.recipes[id]=syRecToLocal(syCtx(),syRecClean(it.json));rv.recs[sid]=id;
    queueSave('recipes',id);if(made.length)queueSave('ingredients','rv');
  }
  S.sy.rvAsk='';S.sy.rvNote='';delete S.sy.msg.review;
  syPersist();rvShow(id);
}
/* что уйдёт при публикации: присланные позиции, где открытые карты заменены их версией у технолога (и новое сырьё для них) */
function rvItems(){
  var rv=S.sy.rv,b=rvBatchById(rv.batch)||{items:[]},ctx=syCtx(),m=syMap(ctx,'rec'),sel=[],saved=[],edited=false,out=[],byKey=Object.create(null),bt;
  Object.keys(rv.recs).forEach(function(sid){
    var id=rv.recs[sid];
    if(!S.recipes[id])return;
    saved.push([id,m[id]]);m[id]={sid:sid,rev:0,h:''};sel.push({kind:'rec',id:id});   // временно связываем копию с её общим ид, чтобы ушла именно она
  });
  bt=syBatch(ctx,sel);
  saved.forEach(function(p){if(p[1])m[p[0]]=p[1];else delete m[p[0]];});
  bt.items.forEach(function(x){byKey[x.kind+'|'+x.sid]=x;});
  b.items.forEach(function(it){
    var k=it.kind+'|'+it.sid,x=byKey[k],o;
    if(x){
      delete byKey[k];
      o=it.kind==='rec'?syRecClean(it.json):syIngClean(it.json);
      if(syH(x.json)!==syH(o))edited=true;
      out.push({kind:x.kind,sid:x.sid,name:x.name,baseRev:it.baseRev||0,json:x.json});
    }else out.push({kind:it.kind,sid:it.sid,name:it.name,baseRev:it.baseRev||0,json:it.json});
  });
  Object.keys(byKey).forEach(function(k){var x=byKey[k];edited=true;out.push({kind:x.kind,sid:x.sid,name:x.name,baseRev:x.baseRev||0,json:x.json});});
  return{items:out,edited:edited};
}
/* закрыть проверку без публикации: копии и временное сырьё убираются */
function rvDrop(){
  var rv=S.sy.rv;
  if(!rv)return;
  var ctx=syCtx(),mi=syMap(ctx,'ing'),used={};
  Object.keys(rv.recs).forEach(function(sid){
    var id=rv.recs[sid];
    if(S.recipes[id])removeDoc('recipes',id);
    delete syMap(ctx,'rec')[id];
  });
  Object.keys(S.recipes).forEach(function(r){S.recipes[r].rows.forEach(function(x){if(x.ing)used[x.ing]=1;});});
  rv.ings.forEach(function(id){
    if(S.ings[id]&&!used[id]&&mi[id]&&!mi[id].rev){removeDoc('ingredients',id);delete mi[id];}
  });
  S.sy.rv=null;S.sy.rvAsk='';S.sy.rvNote='';syPersist();
  fixActive();
}
/* после публикации копия остаётся картой технолога (связанной с общей); если такая у него уже была, остаётся она, а копия убирается */
function rvFinish(){
  var rv=S.sy.rv,ctx=syCtx(),show='';
  Object.keys(rv.recs).forEach(function(sid){
    var id=rv.recs[sid],other;
    if(!S.recipes[id])return;
    other=rvLocalOf('rec',sid);
    if(other&&other!==id){removeDoc('recipes',id);show=show||other;}
    else{syMap(ctx,'rec')[id]={sid:sid,rev:0,h:''};show=show||id;}
  });
  S.sy.rv=null;S.sy.rvAsk='';S.sy.rvNote='';syPersist();
  return show;
}
/* файлы .docx принятых ТТК: после принятия кладутся в «ТТК в облаке» (регион и папка по самой ТТК) */
function rvFileJobs(b,recs){
  var jobs=[],ctx=syCtx();
  if(S.sy.rvFileOff||!syFilesOn()||!syAdmin()||!b)return jobs;
  b.items.forEach(function(it){
    var id=recs&&recs[it.sid],r=id&&S.recipes[id],m;
    if(it.kind!=='rec'||(it.json&&it.json._del))return;
    try{
      if(!r)r=syRecToLocal(ctx,syRecClean(it.json));
      jobs.push(syTtkJob(r));
    }catch(e0){}
  });
  return jobs;
}
function rvFilesPut(jobs){
  var ok=0,fail=[],p=Promise.resolve();
  if(!jobs||!jobs.length)return p;
  var arc=0;
  jobs.forEach(function(j){p=p.then(function(){return syUploadBuf(j.name,j.buf,j.tg,j.rep).then(function(r){ok++;arc+=(r&&r.archived)||0;},function(e){fail.push('«'+j.name+'»: '+syErrText(e));});});});
  return p.then(function(){
    if(fail.length){syMsg('review','warn','Опубликовано, но файл в «ТТК в облаке» положить не удалось: '+fail.join(' '));flash('Опубликовано, но файл в облако не лёг');}
    else if(ok)syMsg('review','ok','Опубликовано'+(ok>1?'; файлов в «ТТК в облаке»: '+ok:'; файл лежит в «ТТК в облаке»')+(arc?'; прежних версий в «Архиве»: '+arc:'')+' · '+nowHm());
    return syFilesLoad(true,true);
  });
}
function rvDecide(op){
  var rv=S.sy.rv,note=String(S.sy.rvNote||'').trim(),extra,bi=null,jobs=[];
  if(!rv||S.sy.busy.review||!syAdmin())return;
  if(op==='rework'&&note.length<3){
    S.sy.rvAsk='rew';syMsg('review','err','Напишите комментарий: что нужно исправить. Без него отправить на доработку нельзя.');
    rvBarUpdate();var t=$('#rvNote');if(t)t.focus();return;
  }
  extra={batch:rv.batch,note:note};
  if(op==='approve'){bi=rvItems();if(bi.edited)extra.items=bi.items;try{jobs=rvFileJobs(rvBatchById(rv.batch),rv.recs);}catch(e1){jobs=[];}}
  syBusy('review',true);syMsg('review','busy',op==='approve'?'Публикую…':(op==='rework'?'Возвращаю на доработку…':'Отклоняю…'));rvBarUpdate();
  syPost(op,extra,S.sy.cfg.code).then(function(){
    var show='';
    syBusy('review',false);
    if(op==='approve')show=rvFinish();else{rvDrop();S.tab='sync';}
    syMsg('review','ok',(op==='approve'?(bi&&bi.edited?'Опубликовано с вашими правками':'Опубликовано'):(op==='rework'?'Возвращено автору на доработку':'Отклонено'))+' · '+nowHm());
    flash(op==='approve'?'Опубликовано':(op==='rework'?'Карта возвращена автору':'Предложение отклонено'));
    syChanged();
    return syPull(true).then(function(){return syRefresh(true);}).then(function(){return rvFilesPut(jobs);}).then(function(){
      if(show&&S.recipes[show])setActive(show);
      renderAll();
    });
  }).catch(function(e){syBusy('review',false);syMsg('review','err',syErrText(e));scheduleRender();rvBarUpdate();});
}

/* ----- редактор: уведомления о доработке ----- */
function syInboxOn(){return S.mode==='local'&&syLinked()&&(S.sy.cfg.role==='editor'||S.sy.cfg.role==='finance');}
function rwNames(b){
  var r=b.items.filter(function(x){return x.kind==='rec';}),l=(r.length?r:b.items).map(function(x){return x.name;});
  return l.slice(0,2).join(', ')+(l.length>2?' и ещё '+(l.length-2):'');
}
function syInbox(force){
  if(!syInboxOn()||S.sy.busy.inbox)return Promise.resolve();
  if(!force&&Date.now()-S.sy.inboxAt<50000)return Promise.resolve();
  S.sy.inboxAt=Date.now();syBusy('inbox',true);
  return syGet({a:'inbox',by:S.sy.cfg.name.trim()}).then(function(d){
    var seen={},old={},fresh,freshF,freshR,ctxR=syCtx(),chR=false;
    syBusy('inbox',false);
    try{old=JSON.parse(lsGet('kbzhu:rwseen')||'{}')||{};}catch(e0){old={};}
    S.sy.inbox=d.batches||[];
    S.sy.inboxF=Array.isArray(d.files)?d.files:[];
    S.sy.inboxR=Array.isArray(d.rejected)?d.rejected:[];
    freshR=S.sy.inboxR.filter(function(b){return!old['r:'+b.batch];});
    fresh=S.sy.inbox.filter(function(b){return!old[b.batch];});
    freshF=S.sy.inboxF.filter(function(x){return!old['f:'+x.id+':'+x.decided];});
    S.sy.inbox.forEach(function(b){seen[b.batch]=1;});
    S.sy.inboxF.forEach(function(x){seen['f:'+x.id+':'+x.decided]=1;});
    S.sy.inboxR.forEach(function(b){seen['r:'+b.batch]=1;});
    /* отклонено: позиция снова числится неотправленной (её можно поправить, отправить снова или вернуть общее) */
    freshR.forEach(function(b){b.items.forEach(function(it){
      var id=rvLocalOf(it.kind,it.sid),e=id&&syMap(ctxR,it.kind)[id];
      if(e&&e.sent&&it.json&&e.sent===syH(it.json)){e.sent='';chR=true;}
    });});
    if(chR)syPersist();
    lsSet('kbzhu:rwseen',JSON.stringify(seen));
    if(fresh.length)flash('Технолог вернул на доработку: '+rwNames(fresh[0])+(fresh.length>1?' (и ещё предложений: '+(fresh.length-1)+')':''));
    else if(freshF.length)flash('Технолог вернул файл на доработку: '+freshF[0].name+(freshF.length>1?' (и ещё файлов: '+(freshF.length-1)+')':''));
    else if(freshR.length)flash('Технолог отклонил: '+rwNames(freshR[0])+(freshR[0].reply?'. Причина: '+freshR[0].reply:''));
    scheduleRender();
  },function(){syBusy('inbox',false);if(!S.sy.inbox)S.sy.inbox=[];});
}
/* открыть возвращённую карту: у автора она уже есть (в том же браузере), иначе создаётся из предложения */
function rwOpen(batchId,sid){
  var b=rvBatchById(batchId),it=rvRecIn(b,sid),ctx=syCtx(),m=syMap(ctx,'rec'),id,cur,nr,o,made=[];
  if(!it)return;
  id=rvLocalOf('rec',sid);
  if(!id){
    rvMissingIngs(it.json,b.items,made);
    id=uid();S.recipes[id]=syRecToLocal(ctx,syRecClean(it.json));
    m[id]={sid:sid,rev:0,h:''};             // не опубликована: числится новой и уйдёт повторно вместе с правками
    queueSave('recipes',id);if(made.length)queueSave('ingredients','rw');
  }else{
    /* в другом браузере карта есть, но без правок автора (чистая копия общей): подставляется то, что он отправлял */
    cur=syCur(ctx,'rec',id);
    if(m[id].rev>0&&m[id].h===cur.h&&cur.h!==syH(syRecClean(it.json))){
      rvMissingIngs(it.json,b.items,made);
      o=S.recipes[id];nr=syRecToLocal(ctx,syRecClean(it.json));
      if(o.qty)nr.qty=o.qty;if(o.op)nr.op=o.op;if(o.cat)nr.cat=o.cat;if(o.arch)nr.arch=true;
      S.recipes[id]=nr;queueSave('recipes',id);if(made.length)queueSave('ingredients','rw');
    }
  }
  S.sy.rwNote='';delete S.sy.msg.review;
  syPersist();rvShow(id);
}
function rwFor(id){
  var l=S.sy.inbox,sid=((syMap(syCtx(),'rec')[id])||{}).sid,r=null;
  if(!l||!sid)return null;
  l.forEach(function(b){if(!r&&rvRecIn(b,sid))r=b;});
  return r;
}
function rwSend(batchId){
  var b=rvBatchById(batchId),ctx=syCtx(),dirty={},sel=[],bt,items,big,note=String(S.sy.rwNote||'').trim();
  if(!b||S.sy.busy.send||!syLinked()||!syCanSend())return;
  syDirty(ctx).forEach(function(d){dirty[d.kind+'|'+d.id]=1;});
  b.items.forEach(function(it){var id=rvLocalOf(it.kind,it.sid);if(id&&dirty[it.kind+'|'+id])sel.push({kind:it.kind,id:id});});
  if(!sel.length){syMsg('review','warn','Нечего отправлять: карта совпадает с общей базой. Исправьте её по комментарию технолога.');rvBarUpdate();return;}
  bt=syBatch(ctx,sel);syPersist();
  items=bt.items.map(function(it){return{kind:it.kind,sid:it.sid,name:it.name,baseRev:it.baseRev,json:it.json};});
  big=items.filter(function(it){return JSON.stringify(it.json).length>40000;}).map(function(it){return it.name;});
  if(big.length){syMsg('review','err','Слишком большие для одной ячейки таблицы: '+big.slice(0,3).join(', ')+'. Сократите тексты в ТТК.');rvBarUpdate();return;}
  syBusy('send',true);syMsg('review','busy','Отправляю на проверку…');rvBarUpdate();
  syPost('propose',{items:items,note:note,re:batchId}).then(function(){
    bt.items.forEach(function(it){var e=syMap(ctx,it.kind)[it.localId];if(e)e.sent=syH(it.json);});
    syPersist();syBusy('send',false);S.sy.rwNote='';
    syMsg('review','ok','Отправлено на проверку повторно · '+nowHm());flash('Отправлено технологу на проверку');
    return syInbox(true).then(function(){return syRefresh(true);}).then(function(){renderAll();});
  }).catch(function(e){syBusy('send',false);syMsg('review','err',syErrText(e));scheduleRender();rvBarUpdate();});
}
/* убрать из уведомлений: автор доделывать не будет */
function rwDrop(batchId){
  if(S.sy.busy.review||!syInboxOn())return;
  syBusy('review',true);
  syPost('rwclose',{batch:batchId}).then(function(){syBusy('review',false);flash('Убрано из уведомлений');return syInbox(true);})
    .catch(function(e){syBusy('review',false);syMsg('review','err',syErrText(e));scheduleRender();});
}

/* ----- проверка файла из «ТТК в облаке» → «На проверке» (технолог) -----
   Файл открывается как копия карты, которую можно править; сверху плашка с решением: принять в выбранную папку (если карту правили,
   уйдёт пересобранный файл), вернуть автору на доработку (комментарий обязателен) или отклонить. После решения копия убирается. */
function frDishOf(n){return dishKey(String(n||'').replace(/\.docx$/i,'').replace(/^\s*ттк\s*№?\s*[\d_]*\s*/i,'').toLowerCase());}
function frSameFile(a,b){var x=frDishOf(a),y=frDishOf(b);return!!x&&!!y&&sameDishCore(x,y);}
function frFile(id){var l=S.sy.files&&S.sy.files.files;return l?(l.filter(function(x){return x.id===id;})[0]||null):null;}
function frEdited(fr){var r=S.recipes[fr.recId];return!!r&&JSON.stringify(r)!==fr.h0;}
function frCopy(o){var c={},k;for(k in o)c[k]=o[k];return c;}
function frSnap(){var fr=S.sy.fr;if(fr&&S.recipes[fr.recId]){fr.h0=JSON.stringify(S.recipes[fr.recId]);syPersist();}}
function frStart(rev,rid,made,base,cmp){
  S.sy.fr={id:rev.id,name:rev.name,by:rev.by||'',at:rev.at||0,recId:rid,ings:made||[],uniq:S.recipes[rid].name,base:base||'',cmp:cmp||'',h0:''};
  S.sy.frAsk='';S.sy.frNote='';delete S.sy.msg.review;
  S.sy.fr.h0=JSON.stringify(S.recipes[rid]);syPersist();
}
/* убрать копию карты и сырьё, которое для неё создавалось и больше нигде не нужно */
function frDrop(){
  var fr=S.sy.fr,used={};
  if(!fr)return;
  if(S.recipes[fr.recId])removeDoc('recipes',fr.recId);
  delete syMap(syCtx(),'rec')[fr.recId];
  Object.keys(S.recipes).forEach(function(r){S.recipes[r].rows.forEach(function(x){if(x.ing)used[x.ing]=1;});});
  fr.ings.forEach(function(id){if(S.ings[id]&&!used[id]){removeDoc('ingredients',id);delete syMap(syCtx(),'ing')[id];}});
  S.sy.fr=null;S.sy.frAsk='';S.sy.frNote='';syPersist();
  fixActive();
}
function frShow(){var fr=S.sy.fr;if(fr&&S.recipes[fr.recId])rvShow(fr.recId);}
/* файл, пересобранный из карты (название блюда — как в присланном файле, без пометки «(2)», которую карта получает при совпадении названий) */
function frBuild(fr){
  var r=S.recipes[fr.recId],rr=frCopy(r);
  if(fr.base&&r.name===fr.uniq)rr.name=fr.base;
  var fm=ttkModel(rr);
  return buildTtkDocx(fm);
}
function frAfter(msg,tab){
  frDrop();
  syMsg('files','ok',msg+' · '+nowHm());
  S.tab=tab||'cloud';S.sy.creg='pend';S.sy.cdir='all';S.sy.fq='';S.sy.fshow=SY_PAGE;
  renderAll();window.scrollTo(0,0);
  return syUpDone();
}
function frDecide(op){
  var fr=S.sy.fr,note=String(S.sy.frNote||'').trim(),x={id:fr&&fr.id},f,tg,edited,buf;
  if(!fr||S.sy.busy.review||!syAdmin())return;
  if(op==='frework'&&note.length<3){
    S.sy.frAsk='rew';syMsg('review','err','Напишите комментарий: что нужно исправить. Без него отправить на доработку нельзя.');
    rvBarUpdate();var t=$('#frNote');if(t)t.focus();return;
  }
  if(op==='fapprove'){
    f=frFile(fr.id);tg=syTargetParse(f?syWantDefault(f):'|');
    if(!syOldScript()){var q=syPlaceReq(tg.reg,tg.dir);Object.keys(q).forEach(function(k){x[k]=q[k];});}
    edited=frEdited(fr);
    if(edited){
      if(S.sy.info&&Number(S.sy.info.v)<12){syMsg('review','err','Принять с правками можно со скриптом версии 12: вставьте новый скрипт (вкладка «Личный кабинет» → «Настройка скрипта») и разверните новую версию. Пока можно закрыть проверку и принять присланный файл как есть.');rvBarUpdate();return;}
      try{buf=frBuild(fr);}catch(e){syMsg('review','err','Не получилось собрать файл из карты: '+(e&&e.message?e.message:'ошибка')+'.');rvBarUpdate();return;}
      if(buf.length>3*1024*1024-2048){syMsg('review','err','Файл получился больше 3 МБ: сократите тексты в карте.');rvBarUpdate();return;}
      x.b64=bufToB64(buf);
    }
  }else if(note)x.note=note;
  if(S.sy.info&&Number(S.sy.info.v)<12&&op==='frework'){syMsg('review','err','Возврат на доработку работает со скриптом версии 12: вставьте новый скрипт (вкладка «Личный кабинет» → «Настройка скрипта») и разверните новую версию.');rvBarUpdate();return;}
  syBusy('review',true);syMsg('review','busy',op==='fapprove'?'Принимаю в облако…':(op==='frework'?'Возвращаю на доработку…':'Отклоняю…'));rvBarUpdate();
  syPost(op,x,S.sy.cfg.code).then(function(){
    syBusy('review',false);delete S.sy.fwant[fr.id];
    flash(op==='fapprove'?'Файл принят в облако':(op==='frework'?'Файл возвращён автору':'Файл отклонён'));
    return frAfter(op==='fapprove'?(edited?'Принят файл с вашими правками':'Принят файл')+' «'+fr.name+'»':(op==='frework'?'Возвращён автору на доработку файл «'+fr.name+'»':'Отклонён файл «'+fr.name+'»'));
  }).catch(function(e){syBusy('review',false);syMsg('review','err',syErrText(e));scheduleRender();rvBarUpdate();});
}
/* автор: снять свой файл с проверки */
function syFWithdraw(id){
  var f=frFile(id),nm=f?f.name:'файл';
  if(S.sy.busy.fop||!syCanSend())return;
  syBusy('fop',true);syMsg('files','busy','Снимаю «'+nm+'» с проверки…');
  syPost('fwithdraw',{id:id},S.sy.cfg.code).then(function(){
    syBusy('fop',false);
    syMsg('files','ok','Файл «'+nm+'» снят с проверки · '+nowHm());
    return Promise.all([syUpDone(),syInbox(true)]);
  }).catch(function(e){syBusy('fop',false);syMsg('files','err',syErrText(e));scheduleRender();});
}
/* технолог: вернуть файл на доработку прямо из списка */
function syFReworkGo(){
  var id=S.sy.frow,note=String(S.sy.frn||'').trim(),f=frFile(id);
  if(!id||S.sy.busy.fop||!syAdmin())return;
  if(note.length<3){syMsg('files','err','Напишите комментарий: что нужно исправить. Без него вернуть файл на доработку нельзя.');scheduleRender();return;}
  if(S.sy.info&&Number(S.sy.info.v)<12){syMsg('files','err','Возврат на доработку работает со скриптом версии 12: вставьте новый скрипт (вкладка «Личный кабинет» → «Настройка скрипта») и разверните новую версию.');scheduleRender();return;}
  syBusy('fop',true);syMsg('files','busy','Возвращаю «'+(f?f.name:'файл')+'» на доработку…');
  syPost('frework',{id:id,note:note},S.sy.cfg.code).then(function(){
    syBusy('fop',false);S.sy.frow='';S.sy.frn='';
    syMsg('files','ok','Файл «'+(f?f.name:'')+'» возвращён автору на доработку · '+nowHm());
    return syUpDone();
  }).catch(function(e){syBusy('fop',false);syMsg('files','err',syErrText(e));syBlurSel();scheduleRender();});
}
function frReviewBarHtml(fr){
  var f=frFile(fr.id),busy=S.sy.busy.review,ask=S.sy.frAsk,dis=busy?' disabled':'',edited=frEdited(fr),gone=!!(S.sy.files&&S.sy.files.ready&&!f);
  var h='<div class="bkbar rvbar" role="region" aria-label="Проверка файла ТТК"><div class="rvh"><b>Проверка файла ТТК</b> · «'+esc(fr.name)+'»'+(fr.by?' · от '+esc(fr.by):'')+(fr.at?' · '+esc(syWhen(fr.at)):'');
  if(f&&f.st==='rework')h+='<div class="rvq">Уже возвращён автору: «'+esc(f.reply||'')+'»</div>';
  if(gone)h+='<div class="rvt">Этого файла уже нет в «На проверке»: его приняли, отклонили или автор снял. Карту можно только закрыть.</div>';
  else h+='<div class="rvt">Карту можно править. '+(edited?'<b>Карта изменена: в облако уйдёт файл, пересобранный из неё.</b>':'Пока правок нет: примется присланный файл без изменений.')+' После решения копия карты убирается из вашей базы.</div>';
  h+='</div>'+hlPanelHtml();
  if(gone)h+='<div class="rvbtns"><button class="btn mini" data-act="frClose">Закрыть проверку</button></div>';
  else if(ask)h+='<div class="rvask"><label class="lbl" for="frNote">'+(ask==='rej'?'Причина отклонения (необязательно)':'Комментарий автору (обязателен): что исправить')+'</label><textarea id="frNote" rows="3" maxlength="300"></textarea>'
    +'<div class="rvbtns"><button class="btn mini primary" data-act="frSend"'+dis+'>'+(ask==='rej'?'Отклонить':'Вернуть на доработку')+'</button><button class="btn mini" data-act="frAskNo">Отмена</button></div></div>';
  else h+='<div class="rvbtns"><label class="rvwhere"><span class="sysub">Куда принять</span> <select data-act="syFWant" data-id="'+esc(fr.id)+'" aria-label="Куда положить файл при приёме: регион и папка">'+syTargetOptsHtml(f?syWantDefault(f):'|')+'</select></label>'
    +'<button class="btn mini primary" data-act="frApprove"'+dis+'>'+(edited?'Принять с правками':'Принять')+'</button>'
    +'<button class="btn mini" data-act="frAsk" data-v="rew"'+dis+'>На доработку</button>'
    +'<button class="btn mini" data-act="frAsk" data-v="rej"'+dis+'>Отклонить</button><button class="btn mini" data-act="frClose">Закрыть проверку</button></div>';
  return h+rvMsgHtml()+'</div>';
}
/* у автора: технолог вернул файл */
function rjInboxBarHtml(){
  var l=S.sy.inboxR,b;
  if(!l||!l.length||!syInboxOn())return'';
  b=l[0];
  return'<div class="bkbar warn" role="status"><span>Технолог отклонил: <b>'+esc(rwNames(b))+'</b>'+(l.length>1?' (и ещё предложений: '+(l.length-1)+')':'')+(b.reply?'. Причина: «'+esc(b.reply)+'»':'')+'</span><span class="bkb"><button class="btn mini primary" data-act="rwDrop" data-batch="'+esc(b.batch)+'">Понятно</button></span></div>';
}
function edBarsHtml(){return rjInboxBarHtml()+frInboxBarHtml();}
function frInboxBarHtml(){
  var l=S.sy.inboxF,key,x;
  if(!l||!l.length||!syInboxOn())return'';
  key='f'+l.map(function(y){return y.id+':'+y.decided;}).join(',');
  if(S.sy.inboxHide===key)return'';
  x=l[0];
  return'<div class="bkbar warn" role="status"><span>Технолог вернул файл на доработку: <b>'+esc(x.name)+'</b>'+(l.length>1?' (и ещё файлов: '+(l.length-1)+')':'')+'. Комментарий: «'+esc(x.reply||'')+'»</span><span class="bkb"><button class="btn mini primary" data-act="frInboxOpen">Открыть</button><button class="btn mini" data-act="rwHide" data-key="'+esc(key)+'">Позже</button></span></div>';
}
