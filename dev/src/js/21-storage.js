/* ---------- persistence ---------- */
function setSave(state,msg){S.save=state;S.saveMsg=msg||'';renderStatus();}
function renderStatus(){
  var el=$('#status'),s='',t='',ss=null;el.removeAttribute('data-retry');el.removeAttribute('title');
  if(S.mode==='init'){t='Подключаюсь…';}
  else if(S.readOnly){t='Только просмотр';}
  else if(S.save==='error'){s='error';t=S.saveMsg||'Не удалось сохранить';}
  else if(S.mode==='local'&&syLinked()&&(ss=syStatusInfo())){s=ss.s;t=ss.t;el.title=bkStatusLine()||ss.hint||'';el.setAttribute('data-retry',ss.retry?'1':'');}
  else if(S.mode==='local'){t=bkStatusLine()||'Сохраняется только в этом браузере';}
  else if(S.save==='saving'){s='saving';t='Сохраняю…';}
  else{s='ok';t='Данные сохранены';}
  el.setAttribute('data-s',s);el.textContent=t;el.hidden=guestOn();
  el.setAttribute('data-short',s==='ok'?'Сохранено':(s==='saving'?'Сохраняется':(s==='error'?'Ошибка':(s==='warn'?(/^Нет сети/.test(t)?'Нет сети':'Не отправлено'):(S.readOnly?'Просмотр':(S.mode==='init'?'Подключение':'Только здесь'))))));
  el.setAttribute('data-hint',el.title||t);
  var pc=$('#periodChip'),pf=(typeof curAbc==='function'&&S.cfg&&S.cfg.abc&&S.cfg.abc.period)?String(S.cfg.abc.period):'';
  if(pc){pc.hidden=!(pf&&(S.tab==='home'||S.tab==='abc'))||guestOn();pc.textContent=pc.hidden?'':'Период: '+pf;}
  bkBarUpdate();rvBarUpdate();upBarUpdate();
}
/* состояние обмена с общей базой: «Сохранено» только если изменений, не ушедших на сервер, нет и последний обмен прошёл */
function syStatusInfo(){
  var sy=S.sy,n=0,e=sy.loadErr||(sy.msg&&sy.msg.send&&sy.msg.send.state==='err'?sy.msg.send.msg:'');
  if(typeof navigator!=='undefined'&&navigator.onLine===false)return{s:'warn',t:'Нет сети — изменения на устройстве',hint:'Правки хранятся на этом устройстве и уйдут в общую базу, когда появится сеть.'};
  if(sy.busy&&(sy.busy.send||sy.busy.pull||sy.busy.csend))return{s:'saving',t:'Сохраняется…'};
  if(e)return{s:'error',t:'Ошибка — повторить',retry:true,hint:String(e)};
  if(!sy.loaded)return{s:'saving',t:'Загружаю общую базу…'};
  try{n=syDirtyUi().length;}catch(x){n=0;}
  if(n>0)return{s:'warn',t:'Не отправлено: '+n,hint:'Эти правки есть только на этом устройстве: отправьте их на проверку или в общую базу.'};
  return{s:'ok',t:'Сохранено',hint:'Все правки на сервере, общая база получена.'};
}
function mapOf(kind){return kind==='ingredients'?S.ings:(kind==='settings'?S.cfg:S.recipes);}
/* ---------- записи истории цен: в IndexedDB, а не в общем блоке localStorage ----------
   В блоке kbzhu:v1 лежат сырьё и все ТТК, а лимит localStorage в браузере общий (около 5 МБ). Одна загрузка 1С весит 40–100 КБ, а их десятки
   (объекты × месяцы), поэтому записи истории хранятся отдельно. Флаг kbzhu:phdb = записи перенесены, блок их больше не содержит.
   Не получилось открыть IndexedDB или записать — всё остаётся как раньше, в блоке, ничего не теряется. */
var phDb=null,phDirty={},phReady=Promise.resolve();
function phIdbOpen(){
  return new Promise(function(res,rej){
    var rq;
    try{rq=indexedDB.open('kbzhu-ph',1);}catch(e){rej(e);return;}
    rq.onupgradeneeded=function(){if(!rq.result.objectStoreNames.contains('ph'))rq.result.createObjectStore('ph',{keyPath:'id'});};
    rq.onsuccess=function(){res(rq.result);};
    rq.onerror=function(){rej(rq.error||new Error('idb'));};
    rq.onblocked=function(){rej(new Error('idb blocked'));};
  });
}
function phIdbRun(db,fn){
  return new Promise(function(res,rej){
    var tx,rq;
    try{tx=db.transaction('ph','readwrite');rq=fn(tx.objectStore('ph'));}catch(e){rej(e);return;}
    tx.oncomplete=function(){res(rq&&rq.result!==undefined?rq.result:undefined);};
    tx.onerror=tx.onabort=function(){rej(tx.error||new Error('idb tx'));};
  });
}
function phIdbPut(db,ids){
  return phIdbRun(db,function(os){ids.forEach(function(id){if(S.cfg[id])os.put({id:id,rec:JSON.parse(JSON.stringify(S.cfg[id]))});else os['delete'](id);});});
}
function phIdbInit(){
  if(typeof indexedDB==='undefined'||!indexedDB)return Promise.resolve();
  var flag=lsGet('kbzhu:phdb')==='1';
  return phIdbOpen().then(function(db){
    phDb=db;
    return phIdbRun(db,function(os){return os.getAll();}).then(function(rows){
      rows=rows||[];
      /* флага нет, а записи в хранилище есть: данные браузера чистили, это остатки; действует блок localStorage */
      if(!flag&&rows.length)return phIdbRun(db,function(os){return os.clear();}).then(function(){return[];});
      return rows;
    }).then(function(rows){
      var changed=false,have={},puts=[];
      rows.forEach(function(r){
        if(!r||!isPhId(r.id)||!r.rec)return;
        have[r.id]=1;
        var n=normPh(r.rec),loc=S.cfg[r.id];
        if(!loc||(n.at||0)>(loc.at||0)){S.cfg[r.id]=n;changed=true;}
        else if((loc.at||0)>(n.at||0))puts.push(r.id);
      });
      Object.keys(S.cfg).forEach(function(id){if(isPhId(id)&&!have[id])puts.push(id);});
      return(puts.length?phIdbPut(db,puts):Promise.resolve()).then(function(){
        var extra=Object.keys(phDirty);phDirty={};      /* записи, что добавились, пока шёл перенос */
        return extra.length?phIdbPut(db,extra):undefined;
      }).then(function(){
        if(!lsSet('kbzhu:phdb','1'))throw new Error('flag');
        S.phIdb=true;
        if(Object.keys(S.cfg).some(isPhId))lsSet('kbzhu:v1',JSON.stringify(localBlob()));      /* блок localStorage перезаписан уже без записей истории */
        phFlush();
        if(changed)scheduleRender();
      });
    });
  })['catch'](function(){S.phIdb=false;});
}
/* что уходит в блок localStorage: без записей истории, когда они в IndexedDB */
function localBlob(){
  if(!S.phIdb)return{ings:S.ings,recipes:S.recipes,cfg:S.cfg};
  var c={};
  Object.keys(S.cfg).forEach(function(k){if(!isPhId(k))c[k]=S.cfg[k];});
  return{ings:S.ings,recipes:S.recipes,cfg:c};
}
function phFlush(){
  var ids=Object.keys(phDirty);
  if(!ids.length||!S.phIdb||!phDb||bkFrozen)return;
  phDirty={};
  phIdbPut(phDb,ids)['catch'](function(){
    /* не записалось: возвращаемся к блоку localStorage, записи в нём не потеряются */
    S.phIdb=false;phDirty={};
    try{localStorage.removeItem('kbzhu:phdb');}catch(e){}
    queueSave('settings','phfall');
  });
}
function queueSave(kind,id){
  var key=kind+'/'+id;
  if(S.readOnly)return;
  if(S.mode==='local'){
    if(kind==='settings'&&isPhId(id))phDirty[id]=1;
    clearTimeout(localTimer);
    localTimer=setTimeout(function(){
      localTimer=null;
      var ok=lsSet('kbzhu:v1',JSON.stringify(localBlob()));
      phFlush();
      setSave(ok?'ok':'error',ok?'':'Браузер не даёт сохранить данные');
      syStripUpdate();
    },400);
    pfSchedule(60000);     // файлы цен на Диске обновятся через минуту после последней правки
    bkTouch();             // и копия данных на Диске тоже
    syPubTouch(kind,id);   // и автопубликация технолога (если включена)
    return;
  }
  dirty[key]=1;
  clearTimeout(timers[key]);
  setSave('saving');
  timers[key]=setTimeout(function(){pending[key]=1;pump();},500);
}
function pump(){
  while(running<MAXC){
    var key=Object.keys(pending).filter(function(k){return!inflight[k];})[0];
    if(!key)break;
    delete pending[key];inflight[key]=1;running++;
    doWrite(key).then(function(k){return function(){
      delete inflight[k];running--;
      if(!Object.keys(pending).length&&!Object.keys(inflight).length&&!Object.keys(dirty).length&&S.save==='saving')setSave('ok');
      pump();
    };}(key));
  }
}
function doWrite(key){
  var kind=key.split('/')[0],id=key.split('/')[1],map=mapOf(kind);
  delete dirty[key];
  var ref=S.db.doc(key);
  var p=map[id]?ref.set(JSON.parse(JSON.stringify(map[id]))):ref['delete']();
  return p.then(function(){delete retries[key];},function(e){
    var code=e&&e.code;
    if((code==='resource_exhausted'||code==='unavailable')&&(retries[key]||0)<3){
      retries[key]=(retries[key]||0)+1;dirty[key]=1;
      setTimeout(function(){pending[key]=1;pump();},1500*retries[key]);
    }else if(code==='quota_exceeded'){setSave('error','Хранилище заполнено, запись не удалась');}
    else if(code==='invalid_argument'){S.readOnly=true;renderStatus();renderAll();flash('Нет права на запись: данные открыты только для просмотра');}
    else{setSave('error','Не удалось сохранить, проверьте соединение');}
  });
}
/* Подтверждение завершения сохранения: промис выполняется, когда в очереди нет ни отложенной записи, ни записи в пути (без фиксированных пауз). Нужен проверкам и сценариям, где важно дождаться записи, а не времени */
function savesPending(){return!!(localTimer||running||Object.keys(pending).length||Object.keys(inflight).length||Object.keys(dirty).length||Object.keys(phDirty).length);}
function savesDone(maxMs){
  return new Promise(function(res){
    var t0=Date.now();
    (function tick(){if(!savesPending())res({ok:S.save!=='error'});else if(Date.now()-t0>(maxMs||15000))res({ok:false,timeout:true});else setTimeout(tick,40);})();
  });
}
try{window.kbzhuSaved=savesDone;}catch(e){}
function removeDoc(kind,id){delete mapOf(kind)[id];queueSave(kind,id);}
function loadLocal(){
  try{
    var d=null;
    try{d=JSON.parse(lsGet('kbzhu:v1')||'null');}catch(e0){d=null;}
    var has=d&&((d.ings&&Object.keys(d.ings).length)||(d.recipes&&Object.keys(d.recipes).length));
    /* В автономной копии база встроена в файл (window.KBZHU_SEED) и подставляется, пока в браузере нет своих данных */
    if(!has&&window.KBZHU_SEED)d=window.KBZHU_SEED;
    if(d){
      Object.keys(d.ings||{}).forEach(function(id){S.ings[id]=normIng(d.ings[id]);});
      /* копия со встроенной базой: подтягиваем цены и названия из прайса для сырья, у которого их ещё нет */
      var sdSig=(window.KBZHU_SEED&&window.KBZHU_SEED.ings)?syHash(JSON.stringify(window.KBZHU_SEED.ings)):'';
      if(sdSig&&!has)S.seedMark=sdSig;   // чистый браузер: всё взято из встроенной базы, подставлять нечего
      else if(sdSig&&lsGet('kbzhu:seedfill')!==sdSig){
        /* один раз на версию встроенной базы: иначе цена, убранная у сырья (или пришедшая без цены из общей базы), возвращалась бы при каждом открытии и снова считалась правкой */
        var sd=window.KBZHU_SEED.ings;S.seedMark=sdSig;S.seedFill=true;
        Object.keys(sd).forEach(function(id){
          var loc=S.ings[id],se=sd[id];
          if(!loc||se.price===undefined||se.price===null||(loc.price!==undefined&&loc.price!==null))return;
          var n=normIng(se);
          loc.price=n.price;if(n.priceUnit)loc.priceUnit=n.priceUnit;if(n.packG)loc.packG=n.packG;if(n.priceSrc)loc.priceSrc=n.priceSrc;
          if(n.aliases)loc.aliases=(loc.aliases||[]).concat(n.aliases.filter(function(a){return(loc.aliases||[]).indexOf(a)<0;}));
        });
      }
      Object.keys(d.recipes||{}).forEach(function(id){S.recipes[id]=normRecipe(d.recipes[id]);});
      if(d.cfg&&d.cfg.regions)S.cfg.regions={list:normRegions(d.cfg.regions)};
      if(d.cfg&&d.cfg.finance)S.cfg.finance=normFinance(d.cfg.finance);
      if(d.cfg&&d.cfg.abc)S.cfg.abc=normAbc(d.cfg.abc);
      if(d.cfg&&d.cfg.menu)S.cfg.menu=normMenu(d.cfg.menu);
      if(d.cfg)Object.keys(d.cfg).forEach(function(k){if(isPhId(k))S.cfg[k]=normPh(d.cfg[k]);});
    }
  }catch(e){}
}
function applySnap(kind,snap){
  var map=mapOf(kind),changed=false;
  snap.docChanges().forEach(function(ch){
    var id=ch.doc.id,key=kind+'/'+id;
    if(ch.type==='removed'){if(map[id]&&!dirty[key]&&!inflight[key]){delete map[id];changed=true;}return;}
    if(dirty[key]||inflight[key])return;
    var d=ch.doc.data();if(!d)return;
    if(kind==='settings'&&id!=='regions'&&id!=='finance'&&id!=='abc'&&id!=='menu'&&!isPhId(id))return;
    var n=kind==='ingredients'?normIng(d):(kind==='settings'?(id==='finance'?normFinance(d):(id==='abc'?normAbc(d):(id==='menu'?normMenu(d):(isPhId(id)?normPh(d):{list:normRegions(d)})))):normRecipe(d));
    if(canon(map[id])!==canon(n)){map[id]=n;changed=true;}
  });
  if(!snap.metadata.fromCache&&!S.loaded[kind]){S.loaded[kind]=true;changed=true;}
  if(changed)scheduleRender();
}
function subscribe(){
  var fail=function(kind){return function(){S.loaded[kind]=true;setSave('error','Нет связи с хранилищем');renderAll();};};
  S.db.collection('ingredients').onSnapshot(function(s){applySnap('ingredients',s);},fail('ingredients'));
  S.db.collection('recipes').onSnapshot(function(s){applySnap('recipes',s);},fail('recipes'));
  S.db.collection('settings').onSnapshot(function(s){applySnap('settings',s);},function(){});
  setTimeout(function(){if(!S.loaded.ingredients||!S.loaded.recipes){S.loaded.ingredients=S.loaded.recipes=true;renderAll();}},4000);
}
function isTyping(){var a=document.activeElement;return!!(a&&$('#view').contains(a)&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT'));}
function scheduleRender(){if(isTyping()){renderPending=true;}else{renderAll();}}

