/* ---------- регионы пользователя и изоляция данных между пользователями (версия 26) ----------
   Какие регионы доступны человеку, решает технолог, а проверяет скрипт. Здесь страница лишь не показывает лишнего:
   • regs у пользователя: null — все регионы (технолог или нет связи с общей базой), иначе список назначенных (может быть пустым);
   • данные региона, который человеку больше не назначен, убираются с экрана и прячутся в отдельное хранилище браузера (IndexedDB),
     а не удаляются: если регион назначат снова, данные вернутся;
   • на одном устройстве работают разные люди: при входе под другим пользователем рабочие данные прежнего (сырьё, карты, настройки,
     шапки ТТК, записи истории цен) откладываются в то же отдельное хранилище и возвращаются, когда он войдёт снова. Коды доступа
     в отложенную копию не попадают. */
var AC_OWNER='kbzhu:owner',AC_BKT='kbzhu:bkt',AC_HDRS='kbzhu:ttkhdrs';
/* секрет устройства: по нему скрипт отличает копии данных общего кода (по ФИО копия больше не открывается) */
function acBkt(){
  var v=lsGet(AC_BKT),a=[],i,u;
  if(/^[\w-]{16,64}$/.test(v||''))return v;
  try{u=new Uint8Array(16);crypto.getRandomValues(u);for(i=0;i<u.length;i++)a.push(('0'+u[i].toString(16)).slice(-2));}
  catch(e){a=[];for(i=0;i<16;i++)a.push(('0'+Math.floor(Math.random()*256).toString(16)).slice(-2));}
  v='d'+a.join('');lsSet(AC_BKT,v);return v;
}
/* null — без ограничений */
function acRegs(){var c=S.sy.cfg;if(!syLinked()||c.role==='admin')return null;return Array.isArray(c.regs)?c.regs:null;}
function acAllowed(id){var r=acRegs();return r===null||r.indexOf(String(id))>-1;}
function acFilter(list){var r=acRegs();return r===null?list:list.filter(function(g){return r.indexOf(g.id)>-1;});}
/* вошёл по общему или именному коду, но технолог ещё не назначил ни одного региона */
function acNone(){var r=acRegs();return r!==null&&!r.length;}
function acNoteHtml(){
  if(!acNone())return'';
  return'<div class="acnote" role="alert"><b>Регионы не назначены.</b> Пока технолог не откроет вам доступ к региону, цены и карты регионов не показываются. Попросите его назначить регионы в «Личном кабинете» → «Пользователи и коды доступа».</div>';
}

/* ---- отдельное хранилище браузера: откладываются данные другого пользователя и скрытые регионы ---- */
var acDb=null;
function acKvOpen(){
  if(acDb)return Promise.resolve(acDb);
  return new Promise(function(res,rej){
    var rq;
    if(typeof indexedDB==='undefined'||!indexedDB){rej(new Error('idb'));return;}
    try{rq=indexedDB.open('kbzhu-park',1);}catch(e){rej(e);return;}
    rq.onupgradeneeded=function(){if(!rq.result.objectStoreNames.contains('kv'))rq.result.createObjectStore('kv',{keyPath:'k'});};
    rq.onsuccess=function(){acDb=rq.result;res(acDb);};
    rq.onerror=function(){rej(rq.error||new Error('idb'));};
    rq.onblocked=function(){rej(new Error('idb blocked'));};
  });
}
function acKv(mode,fn){
  return acKvOpen().then(function(db){return new Promise(function(res,rej){
    var tx,rq;
    try{tx=db.transaction('kv',mode);rq=fn(tx.objectStore('kv'));}catch(e){rej(e);return;}
    tx.oncomplete=function(){res(rq&&rq.result!==undefined?rq.result:undefined);};
    tx.onerror=tx.onabort=function(){rej(tx.error||new Error('idb tx'));};
  });});
}
function acKvGet(k){return acKv('readonly',function(os){return os.get(k);}).then(function(r){return r?r.v:null;});}
function acKvPut(k,v){return acKv('readwrite',function(os){return os.put({k:k,v:v});});}
function acKvPutMany(pairs){return acKv('readwrite',function(os){var last;pairs.forEach(function(p){last=os.put({k:p[0],v:p[1]});});return last;});}
function acKvGetMany(keys){
  return acKvOpen().then(function(db){return new Promise(function(res,rej){
    var out={},tx;
    try{tx=db.transaction('kv','readonly');var os=tx.objectStore('kv');keys.forEach(function(k){var rq=os.get(k);rq.onsuccess=function(){if(rq.result)out[k]=rq.result.v;};});}catch(e){rej(e);return;}
    tx.oncomplete=function(){res(out);};
    tx.onerror=tx.onabort=function(){rej(tx.error||new Error('idb tx'));};
  });});
}
function acKvDel(k){return acKv('readwrite',function(os){return os['delete'](k);});}
function acClone(o){return JSON.parse(JSON.stringify(o));}

/* регион записи истории цен: ph_<регион>_<с>_<по>[_o<объект>] */
function acPhRegion(id){var m=/^ph_([a-z0-9_-]{1,40})_\d{8}_\d{8}(?:_o[a-z0-9]{3,24})?$/i.exec(String(id||''));return m?m[1]:'';}
/* цены продажи и карты других регионов у человека без этих регионов */
function acHidKey(){return'hid:'+(S.sy.cfg.uid||'-');}
function acHideRegions(regs){
  var hid={ings:{},recipes:{},ph:{},sell:{}},n=0;
  Object.keys(S.ings).forEach(function(id){
    var g=S.ings[id],h={},px;
    if(regs.indexOf(MAIN)<0)['price','priceUnit','packG','priceSrc'].forEach(function(k){if(g[k]!==undefined){h[k]=g[k];}});
    if(g.px)Object.keys(g.px).forEach(function(r){if(regs.indexOf(r)<0){px=px||{};px[r]=g.px[r];}});
    if(px)h.px=px;
    if(Object.keys(h).length){hid.ings[id]=h;n++;}
  });
  Object.keys(S.recipes).forEach(function(id){
    var q=S.recipes[id],h;
    if(q.reg&&regs.indexOf(q.reg)<0){hid.recipes[id]=acClone(q);n++;return;}
    if(q.sell)Object.keys(q.sell).forEach(function(r){if(regs.indexOf(String(r).split(':')[0])<0){h=h||{};h[r]=q.sell[r];}});
    if(h){hid.sell[id]=h;n++;}
  });
  Object.keys(S.cfg).forEach(function(id){
    var r=isPhId(id)?acPhRegion(id):'';
    if(r&&regs.indexOf(r)<0){hid.ph[id]=acClone(S.cfg[id]);n++;}
  });
  if(!n)return Promise.resolve(0);
  return acKvGet(acHidKey()).then(function(old){
    old=old||{};
    old.ings=old.ings||{};old.recipes=old.recipes||{};old.ph=old.ph||{};old.sell=old.sell||{};
    Object.keys(hid.ings).forEach(function(id){
      var o=old.ings[id]||{},x=hid.ings[id];
      Object.keys(x).forEach(function(k){if(k==='px'){o.px=o.px||{};Object.keys(x.px).forEach(function(r){o.px[r]=x.px[r];});}else o[k]=x[k];});
      old.ings[id]=o;
    });
    Object.keys(hid.sell).forEach(function(id){var o=old.sell[id]||{};Object.keys(hid.sell[id]).forEach(function(r){o[r]=hid.sell[id][r];});old.sell[id]=o;});
    Object.keys(hid.recipes).forEach(function(id){old.recipes[id]=hid.recipes[id];});
    Object.keys(hid.ph).forEach(function(id){old.ph[id]=hid.ph[id];});
    return acKvPut(acHidKey(),old);
  }).then(function(){
    /* сохранилось — теперь убираем с экрана */
    Object.keys(hid.ings).forEach(function(id){
      var g=S.ings[id],h=hid.ings[id];
      if(!g)return;
      Object.keys(h).forEach(function(k){if(k!=='px')delete g[k];});
      if(h.px&&g.px){Object.keys(h.px).forEach(function(r){delete g.px[r];});if(!Object.keys(g.px).length)delete g.px;}
    });
    Object.keys(hid.recipes).forEach(function(id){if(S.recipes[id]&&regs.indexOf(S.recipes[id].reg)<0){delete S.recipes[id];delete S.sy.map.rec[id];if(S.active===id)S.active=null;}});
    Object.keys(hid.sell).forEach(function(id){
      var q=S.recipes[id];if(!q||!q.sell)return;
      Object.keys(hid.sell[id]).forEach(function(r){delete q.sell[r];});
      if(!Object.keys(q.sell).length)delete q.sell;
    });
    Object.keys(hid.ph).forEach(function(id){delete S.cfg[id];delete S.sy.phSeen[id];if(S.phIdb&&phDb)phIdbPut(phDb,[id])['catch'](function(){});});
    return n;
  });
}
/* регион назначили (или человек стал технологом): спрятанное возвращается на место */
function acRestoreRegions(regs){
  return acKvGet(acHidKey()).then(function(h){
    if(!h)return 0;
    var back=0,left={ings:{},recipes:{},ph:{},sell:{}},ok=function(r){return regs===null||regs.indexOf(String(r).split(':')[0])>-1;};
    Object.keys(h.ings||{}).forEach(function(id){
      var g=S.ings[id],x=h.ings[id],keep={},i;
      if(!g){left.ings[id]=x;return;}
      ['price','priceUnit','packG','priceSrc'].forEach(function(k){
        if(x[k]===undefined)return;
        if(ok(MAIN)){if(g[k]===undefined){g[k]=x[k];back++;}}else keep[k]=x[k];
      });
      if(x.px)Object.keys(x.px).forEach(function(r){
        if(ok(r)){g.px=g.px||{};if(!g.px[r]){g.px[r]=x.px[r];back++;}}
        else{keep.px=keep.px||{};keep.px[r]=x.px[r];}
      });
      for(i in keep){left.ings[id]=keep;break;}
    });
    Object.keys(h.recipes||{}).forEach(function(id){
      var q=h.recipes[id];
      if(!ok(q.reg)){left.recipes[id]=q;return;}
      if(!S.recipes[id]){S.recipes[id]=normRecipe(q);back++;}
    });
    Object.keys(h.sell||{}).forEach(function(id){
      var q=S.recipes[id],x=h.sell[id],keep={},i;
      if(!q){left.sell[id]=x;return;}
      Object.keys(x).forEach(function(r){if(ok(r)){q.sell=q.sell||{};if(!q.sell[r]){q.sell[r]=x[r];back++;}}else keep[r]=x[r];});
      for(i in keep){left.sell[id]=keep;break;}
    });
    Object.keys(h.ph||{}).forEach(function(id){
      if(!ok(acPhRegion(id))){left.ph[id]=h.ph[id];return;}
      if(!S.cfg[id]){S.cfg[id]=normPh(h.ph[id]);phDirty[id]=1;back++;}
    });
    var empty=!Object.keys(left.ings).length&&!Object.keys(left.recipes).length&&!Object.keys(left.sell).length&&!Object.keys(left.ph).length;
    return(empty?acKvDel(acHidKey()):acKvPut(acHidKey(),left)).then(function(){return back;});
  });
}
/* новый список регионов от скрипта (вход или обновление базы) */
function acSetRegs(regs,rset){
  var c=S.sy.cfg,before=c.regs===undefined?'?':JSON.stringify(c.regs),after=JSON.stringify(regs);
  c.regs=regs;c.rset=!!rset;
  return(regs===null?Promise.resolve(0):acHideRegions(regs)).then(function(){return acRestoreRegions(regs);}).then(function(){
    if(!acAllowed(S.region)){var l=regionList();setRegion(l.length?l[0].id:MAIN);}
    if(before!==after&&before!=='?'){c.rev=0;S.sy.plan=null;}      /* набор регионов изменился: общую базу берём заново, иначе новые цены не придут */
    syPersist();queueSave('settings','acx');
    return before!==after;
  },function(){
    /* спрятать не удалось (хранилище недоступно): не показываем регион, но и не теряем данные — остаёмся без изменений */
    c.regs=before==='?'?undefined:JSON.parse(before);
    throw{code:'ac',msg:'Не удалось убрать данные регионов, которые вам не назначены: браузер не даёт сохранить их отдельно. Освободите место или откройте калькулятор в другом браузере.'};
  });
}

/* ---- смена пользователя на этом устройстве ---- */
function acSnap(){
  var c=S.sy.cfg,hd=lsGet(AC_HDRS),ls={};
  BK_LS.forEach(function(k){var v=lsGet(k);if(v!==null)ls[k]=v;});
  return{ings:acClone(S.ings),recipes:acClone(S.recipes),cfg:acClone(S.cfg),
    sy:{map:acClone(S.sy.map),gone:acClone(S.sy.gone),del:acClone(S.sy.del),ph:acClone(S.sy.phSeen||{}),dq:acClone(S.sy.dq||{}),pt:acClone(S.sy.pt||{}),rv:S.sy.rv,fr:S.sy.fr,hd:S.sy.hold,rev:c.rev,mapUrl:c.mapUrl},
    hdrs:hd,ls:ls,region:S.region,at:Date.now()};
}
function acClear(){
  var keep=S.cfg.regions;
  S.ings={};S.recipes={};S.cfg={};if(keep)S.cfg.regions=keep;
  S.active=null;S.newDraft=null;
  S.sy.map={ing:{},rec:{}};S.sy.gone={};S.sy.del={};S.sy.phSeen={};S.sy.dq={};S.sy.pt={};S.sy.rv=null;S.sy.fr=null;S.sy.hold=null;S.sy.bs=0;S.sy.bases={};S.sy.plan=null;S.sy.pub={};S.sy.pend=null;S.sy.log=null;S.sy.files=null;
  var c=S.sy.cfg;c.rev=0;c.mapUrl='';c.bkRev=0;c.bkWho='';c.bkAt=0;c.bkDirty=false;
  BK_LS.concat([AC_HDRS]).forEach(function(k){try{localStorage.removeItem(k);}catch(e){}});
  phDirty={};
  var p=(S.phIdb&&phDb)?phIdbRun(phDb,function(os){return os.clear();})['catch'](function(){}):Promise.resolve();
  return p;
}
function acLoad(d){
  Object.keys(d.ings||{}).forEach(function(id){S.ings[id]=normIng(d.ings[id]);});
  Object.keys(d.recipes||{}).forEach(function(id){S.recipes[id]=normRecipe(d.recipes[id]);});
  var cf=d.cfg||{};
  if(cf.regions)S.cfg.regions={list:normRegions(cf.regions)};
  if(cf.finance)S.cfg.finance=normFinance(cf.finance);
  if(cf.abc)S.cfg.abc=normAbc(cf.abc);
  if(cf.menu)S.cfg.menu=normMenu(cf.menu);
  Object.keys(cf).forEach(function(k){if(isPhId(k)){S.cfg[k]=normPh(cf[k]);phDirty[k]=1;}});
  var y=d.sy||{};
  S.sy.map={ing:(y.map&&y.map.ing)||{},rec:(y.map&&y.map.rec)||{}};S.sy.gone=y.gone||{};S.sy.del=y.del||{};S.sy.phSeen=y.ph||{};S.sy.dq=y.dq||{};S.sy.pt=y.pt||{};
  S.sy.rv=y.rv||null;S.sy.fr=y.fr||null;S.sy.hold=y.hd||null;S.sy.bs=0;S.sy.bases={};S.sy.cfg.rev=Number(y.rev)||0;S.sy.cfg.mapUrl=String(y.mapUrl||'');
  if(d.hdrs)lsSet(AC_HDRS,d.hdrs);
  Object.keys(d.ls||{}).forEach(function(k){lsSet(k,d.ls[k]);});
  if(d.region)S.region=d.region;
}
/* uid: «u:<ид учётной записи>» или «s:<роль>» для общего кода. Возвращает Promise; true — данные другого пользователя отложены */
function acOwner(uid,who){
  var old,c=S.sy.cfg,legacy=false;
  uid=String(uid||'');
  if(!uid)return Promise.resolve(false);
  old=lsGet(AC_OWNER);
  /* до версии 26 владелец не записывался: о прежнем хозяине данных можно судить только по связи с копией на Диске (роль и ФИО) */
  if(!old&&c.bkWho){old='legacy:'+c.bkWho;legacy=true;}
  if(!old||old===uid||(legacy&&who&&old==='legacy:'+who)){lsSet(AC_OWNER,uid);return Promise.resolve(false);}
  /* сначала сохраняем прежнее, и только потом чистим экран: не получилось сохранить — вход под другим пользователем не продолжаем */
  return acKvPut('ws:'+old,acSnap()).then(function(){
    return acClear();
  }).then(function(){
    return acKvGet('ws:'+uid).then(function(d){return d||(who?acKvGet('ws:legacy:'+who):null);});
  }).then(function(d){
    if(d){acLoad(d);return acKvDel('ws:'+uid)['catch'](function(){});}
  }).then(function(){
    lsSet(AC_OWNER,uid);c.uid=uid;
    phFlush();queueSave('settings','acx');syPersist();
    S.acSwitched=true;
    return true;
  },function(e){
    throw{code:'ac',msg:'Не удалось отложить данные прежнего пользователя этого устройства: браузер не даёт сохранить их отдельно. Чтобы не показывать чужое, вход остановлен. Освободите место в браузере или откройте калькулятор в другом профиле.'};
  });
}
/* ответ скрипта на вход */
function acAuth(r){
  var regs=(r.regs===null)?null:(Array.isArray(r.regs)?r.regs.filter(function(x){return REG_ID.test(String(x));}):[]);
  S.sy.cfg.role=(r.role==='admin'||r.role==='editor'||r.role==='finance'||r.role==='viewer'||r.role==='audit')?r.role:S.sy.cfg.role;
  return acOwner(r.uid,bkWho(r.role,S.sy.cfg.name)).then(function(sw){
    S.sy.cfg.uid=String(r.uid||S.sy.cfg.uid||'');
    return acSetRegs(regs,r.rset).then(function(){return sw;});
  });
}
/* ответ скрипта на обновление базы: регионы могли измениться, пока страница была открыта */
function acPull(d){
  if(!d||d.regs===undefined)return Promise.resolve(false);
  var regs=(d.regs===null)?null:(Array.isArray(d.regs)?d.regs:[]);
  if(JSON.stringify(regs)===JSON.stringify(S.sy.cfg.regs))return Promise.resolve(false);
  return acSetRegs(regs,regs!==null);
}
