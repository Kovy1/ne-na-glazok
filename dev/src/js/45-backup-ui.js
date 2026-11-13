/* ---------- мои данные на Диске: копия рабочих данных, чтобы во всех браузерах было одно и то же ---------- */
var bkFrozen=false,bkTimer=null,bkSig='',bkBarLast='';
function bkS(){return S.sy.bk||(S.sy.bk={info:null,busy:false,loading:false,gen:0,confirm:'',old:false,hide:false,at:0,schedAt:0,err:''});}
function bkRaw(k,v){try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
function bkDev(){var c=S.sy.cfg;if(!c.bkDev){c.bkDev='d'+Math.random().toString(36).slice(2,8)+Date.now().toString(36).slice(-3);syPersist();}return c.bkDev;}
function bkWhoNow(){return bkWho(S.sy.cfg.role,S.sy.cfg.name);}
/* у шеф-повара своих данных нет (он смотрит карты в облаке): копию на Диск не предлагаем */
function bkCan(){return S.mode==='local'&&!S.readOnly&&syLinked()&&!syChef()&&S.loaded.ingredients&&S.loaded.recipes&&!bkFrozen;}
function bkLinked(){var c=S.sy.cfg;return(c.bkRev||0)>0&&c.bkWho===bkWhoNow();}
function bkCloud(){var i=bkS().info;return(i&&i.has&&i.cur)?i.cur:null;}
function bkCtx(){var c=S.sy.cfg;return{linked:bkLinked(),rev:c.bkRev||0,dirty:!!c.bkDirty,dev:c.bkDev||'',cloud:bkCloud()};}
function bkSt(){var bk=bkS();if(bk.old)return'old';if(!bk.info)return'';return bkState(bkCtx());}
function bkWait(){return(window.KBZHU_BK_WAIT>0)?window.KBZHU_BK_WAIT:45000;}
function bkLabel(){try{return bkLabelOf(navigator.userAgent);}catch(e){return'Браузер';}}
function bkCopyTxt(m){return m?syWhen(m.at)+(m.label?' · '+m.label:'')+(m.n?' · сырья '+m.n.ings+', ТТК '+m.n.recipes:''):'';}
function bkUndoAt(){var v=Number(lsGet('kbzhu:undoAt'))||0;return(v&&lsGet('kbzhu:undo'))?v:0;}

/* правка данных: если браузер сверен с копией на Диске, отмечаем «есть что записать» и ставим автозапись */
function bkTouch(){
  if(!syLinked()||!bkLinked())return;
  var bk=bkS();bk.gen++;
  if(!S.sy.cfg.bkDirty){S.sy.cfg.bkDirty=true;syPersist();bkPaint();}
  bkSchedule();
}
function bkSchedule(ms){
  var bk=bkS();
  if(!bkCan()||S.sy.cfg.bkAuto===false||!bkLinked())return;
  var now=Date.now();
  if(bkTimer&&bk.schedAt&&now-bk.schedAt>240000)return;      // правят без остановки: запись не откладывается дольше пяти минут
  if(!bkTimer)bk.schedAt=now;
  clearTimeout(bkTimer);
  bkTimer=setTimeout(function(){bkTimer=null;bk.schedAt=0;bkAutoRun();},ms||bkWait());
}
function bkAutoRun(){
  if(!bkCan()||S.sy.cfg.bkAuto===false)return Promise.resolve();
  if(bkS().busy){bkSchedule(5000);return Promise.resolve();}
  return bkRefresh().then(function(){if(bkSt()==='push')return bkSave({auto:true});});
}

/* что лежит на Диске */
function bkRefresh(){
  var bk=bkS();
  if(!bkCan()||bk.busy||bk.loading)return Promise.resolve();
  bk.loading=true;
  return syGet({a:'bkinfo',by:S.sy.cfg.name.trim()},30000).then(function(d){
    var c=S.sy.cfg,cl=d.cur;
    bk.info=d;bk.old=false;bk.err='';bk.at=Date.now();
    if(cl&&cl.blocked)syMsg('bk','warn','В копии на Диске есть данные регионов, которые вам сейчас не назначены, поэтому забрать её нельзя. Сохраните новую копию: в ней будут только ваши регионы.');
    /* эту же копию записал этот браузер, а ответ не дошёл: считаем браузер сверенным */
    if(cl&&bkLinked()&&cl.dev&&cl.dev===c.bkDev&&cl.rev!==c.bkRev&&!c.bkDirty){c.bkRev=cl.rev;c.bkAt=cl.at;syPersist();}
  },function(e){
    if(e&&e.code==='gas'&&e.err==='a')bk.old=true;else bk.err=syErrText(e);
  }).then(function(){bk.loading=false;bkPaint();if(bkSt()==='push')bkSchedule(2000);});
}

/* снимок рабочих данных браузера */
function bkCfg(){
  if(!S.phIdb)return S.cfg;
  var c={};
  Object.keys(S.cfg).forEach(function(k){if(!isPhId(k))c[k]=S.cfg[k];});
  return c;
}
function bkTake(){
  var ls={};
  BK_LS.forEach(function(k){var v=lsGet(k);if(v!==null)ls[k]=v;});
  return bkSnap({at:Date.now(),dev:bkDev(),ings:S.ings,recipes:S.recipes,cfg:bkCfg(),map:S.sy.map,gone:S.sy.gone,del:S.sy.del,rev:S.sy.cfg.rev,hm:S.sy.cfg.hm,ls:ls});
}
function bkPack(str){
  var bytes=new TextEncoder().encode(str);
  if(typeof CompressionStream==='undefined')return Promise.resolve({enc:'',b64:bufToB64(bytes)});
  var cs=new CompressionStream('gzip'),w=cs.writable.getWriter();
  w.write(bytes);w.close();
  return new Response(cs.readable).arrayBuffer().then(function(b){return{enc:'gz',b64:bufToB64(b)};});
}
function bkUnpack(enc,b64){
  var buf=b64ToBuf(b64);
  if(enc!=='gz')return Promise.resolve(new TextDecoder().decode(buf));
  if(typeof DecompressionStream==='undefined')return Promise.reject({code:'bk',msg:'Этот браузер не умеет распаковывать копию. Откройте калькулятор в современном Chrome, Edge, Firefox или Safari.'});
  var ds=new DecompressionStream('gzip'),w=ds.writable.getWriter();
  w.write(new Uint8Array(buf));w.close();
  return new Response(ds.readable).text();
}

/* запись на Диск. force: сознательно заменить копию, которая новее */
function bkSave(o){
  o=o||{};
  var bk=bkS(),c=S.sy.cfg;
  if(!bkCan()||bk.busy)return Promise.resolve();
  bk.busy=true;bk.confirm='';
  if(!o.auto)syMsg('bk','busy','Сохраняю копию на Диск…');
  bkPaint();
  var gen=bk.gen,snap=bkTake(),cl=bkCloud();
  return bkPack(JSON.stringify(snap)).then(function(p){
    if(p.b64.length>7.8e6)throw{code:'bk',msg:'Копия получилась больше 8 МБ: на Диск она не помещается.'};
    return syPost('bkput',{dev:snap.dev,label:bkLabel(),base:o.force?(cl?cl.rev:0):bkBase({cloud:cl,dev:c.bkDev||'',rev:c.bkRev||0}),force:!!o.force,enc:p.enc,data:p.b64,n:bkCounts(snap)},undefined,60);
  }).then(function(r){
    c.bkRev=r.rev;c.bkWho=bkWhoNow();c.bkAt=r.at||Date.now();
    if(bk.gen===gen)c.bkDirty=false;
    syPersist();bk.busy=false;
    syMsg('bk','ok','Копия сохранена на Диск · '+nowHm()+'.');
    return bkRefresh();
  }).catch(function(e){
    bk.busy=false;
    if(e&&e.err==='newer'){
      syMsg('bk','warn','На Диске уже есть более свежая копия из другого браузера: ничего не записано. Выберите ниже, чьи данные оставить.');
      return bkRefresh();
    }
    syMsg('bk',o.auto?'warn':'err','Копия не сохранилась: '+syErrText(e));
  }).then(function(){bk.busy=false;bkPaint();});
}

/* замена данных в браузере: сначала текущие уходят в запасную копию, потом страница перезагружается */
function bkWriteAll(plan){
  var prev={at:Date.now(),v1:lsGet('kbzhu:v1'),sync:lsGet(SY_KEY),ls:{}},oldUndo=lsGet('kbzhu:undo'),oldAt=lsGet('kbzhu:undoAt'),ok;
  BK_LS.forEach(function(k){var v=lsGet(k);if(v!==null)prev.ls[k]=v;});
  if(!(bkRaw('kbzhu:undo',JSON.stringify(prev))&&bkRaw('kbzhu:undoAt',String(prev.at)))){
    if(oldUndo!==null)bkRaw('kbzhu:undo',oldUndo);
    return'В браузере не хватило места для запасной копии ваших текущих данных, поэтому замена отменена.';
  }
  bkFrozen=true;clearTimeout(localTimer);clearTimeout(bkTimer);clearTimeout(pfTimer);
  ok=bkRaw('kbzhu:v1',plan.v1)&&bkRaw(SY_KEY,plan.sync);
  if(!ok){
    if(prev.v1!==null)bkRaw('kbzhu:v1',prev.v1);
    if(prev.sync!==null)bkRaw(SY_KEY,prev.sync);
    try{if(oldUndo!==null){localStorage.setItem('kbzhu:undo',oldUndo);localStorage.setItem('kbzhu:undoAt',oldAt||'0');}else{localStorage.removeItem('kbzhu:undo');localStorage.removeItem('kbzhu:undoAt');}}catch(e0){}
    bkFrozen=false;
    return'Браузер не дал записать данные (не хватает места). Замена отменена, ваши данные остались прежними.';
  }
  BK_LS.forEach(function(k){
    var v=plan.ls[k];
    if(typeof v==='string')bkRaw(k,v);else{try{localStorage.removeItem(k);}catch(e1){}}
  });
  return'';
}
function bkRestore(which){
  var bk=bkS(),c=S.sy.cfg;
  if(!bkCan()||bk.busy)return Promise.resolve();
  bk.busy=true;bk.confirm='';
  syMsg('bk','busy','Забираю копию с Диска…');bkPaint();
  return syGet({a:'bkget',by:c.name.trim(),which:which==='prev'?'prev':''},90000).then(function(d){
    return bkUnpack(d.enc,d.data).then(function(txt){
      var r=bkCheck(txt);
      if(!r.ok)throw{code:'bk',msg:r.msg};
      var cur=bkCloud(),plan=bkApply(r.snap,{cfg:c,map:S.sy.map,gone:S.sy.gone},{rev:(which==='prev'&&cur)?cur.rev:d.rev,who:bkWhoNow(),at:d.at,dirty:which==='prev'});
      plan.sync=JSON.stringify(plan.sync);
      var bad=bkWriteAll(plan);
      if(bad)throw{code:'bk',msg:bad};
      location.reload();
    });
  }).catch(function(e){
    bk.busy=false;
    syMsg('bk','err',(e&&e.code==='bk')?e.msg:'Копия не получена: '+syErrText(e));
    bkPaint();
  });
}
/* вернуть данные браузера, какими они были до последней замены (и обратно: кнопка работает как переключатель) */
function bkUndo(){
  var raw=lsGet('kbzhu:undo'),u;
  try{u=JSON.parse(raw||'null');}catch(e){u=null;}
  if(!u||typeof u.v1!=='string'||typeof u.sync!=='string'){syMsg('bk','err','Запасной копии в этом браузере нет.');bkPaint();return;}
  var bad=bkWriteAll({v1:u.v1,sync:u.sync,ls:u.ls||{}});
  if(bad){syMsg('bk','err',bad);bkPaint();return;}
  location.reload();
}

/* вопросы и кнопки */
function bkAsk(kind){
  var bk=bkS();
  if(bk.busy||!bkCan())return;
  bkRefresh().then(function(){
    var st=bkSt(),cl=bkCloud();
    if(st==='old'){bkPaint();return;}
    if(st===''){syMsg('bk','err','Не удалось связаться с Диском: '+(bk.err||'нет ответа')+'.');bkPaint();return;}
    if(kind==='push'){
      if(st==='none'||st==='push'||st==='ok'){bkSave({force:false});return;}
      bk.confirm='push';bkPaint();return;
    }
    if(kind==='prev'){
      if(!(bk.info&&bk.info.prev)){syMsg('bk','warn','Предыдущей копии на Диске нет.');bkPaint();return;}
      bk.confirm='prev';bkPaint();return;
    }
    if(!cl){syMsg('bk','warn','Копии на Диске пока нет: сначала сохраните данные в том браузере, где они есть.');bkPaint();return;}
    if(st==='ok'){syMsg('bk','ok','Данные в этом браузере уже совпадают с Диском · '+nowHm()+'.');bkPaint();return;}
    if(st==='behind'){bkRestore('cur');return;}
    bk.confirm='pull';bkPaint();
  });
}
function bkYes(){
  var bk=bkS(),k=bk.confirm;
  bk.confirm='';
  if(k==='push')bkSave({force:true});
  else if(k==='prev')bkRestore('prev');
  else if(k==='pull')bkRestore('cur');
  else bkPaint();
}
function bkClick(act,b){
  switch(act){
    case'dfOut':dfOut();return true;
    case'bkPull':bkAsk('pull');return true;
    case'bkPullPrev':bkAsk('prev');return true;
    case'bkSaveNow':bkAsk('push');return true;
    case'bkYes':bkYes();return true;
    case'bkNo':bkS().confirm='';bkPaint();return true;
    case'bkUndo':bkUndo();return true;
    case'bkHide':bkS().hide=true;bkPaint();return true;
    case'bkCheck':syMsg('bk','busy','Проверяю копию на Диске…');bkRefresh().then(function(){var s=bkSt();if(s==='ok')syMsg('bk','ok','Данные совпадают с Диском · '+nowHm()+'.');else syMsg('bk','','');bkPaint();});return true;
  }
  return false;
}
function bkChange(act,t){
  if(act!=='bkAuto')return false;
  S.sy.cfg.bkAuto=!!t.checked;syPersist();
  if(t.checked)bkSchedule(3000);else clearTimeout(bkTimer);
  bkPaint();
  return true;
}

/* вид */
function bkStatusText(){
  var st=bkSt(),cl=bkCloud(),auto=S.sy.cfg.bkAuto!==false,bk=bkS();
  switch(st){
    case'old':return'В таблице стоит прежняя версия скрипта: копии данных она не ведёт. Вставьте новый скрипт («Настройка скрипта») и создайте новую версию развёртывания: Развернуть → Управление развёртываниями → Новая версия.';
    case'none':return'Копии на Диске ещё нет.';
    case'free':return'На Диске есть копия ваших данных ('+bkCopyTxt(cl)+'), а этот браузер с ней ещё не сверялся. «Обновить с Диска» заменит данные здесь копией, «Сохранить на Диск» заменит копию данными из этого браузера.';
    case'ok':return'Данные в этом браузере и на Диске совпадают. Копия: '+bkCopyTxt(cl)+'.';
    case'push':return'В этом браузере есть правки, которых нет на Диске.'+(auto?' Они запишутся сами примерно через минуту.':' Нажмите «Сохранить на Диск».');
    case'behind':return'На Диске данные новее ('+bkCopyTxt(cl)+'). Нажмите «Обновить с Диска», чтобы получить их здесь.';
    case'conflict':return'Данные менялись и в этом браузере, и в другом ('+bkCopyTxt(cl)+'). «Обновить с Диска» заменит данные здесь копией, «Сохранить на Диск» заменит копию данными из этого браузера. Заменённое не пропадает: здесь остаётся запасная копия, на Диске предыдущая.';
  }
  return bk.err?'Не удалось связаться с Диском: '+bk.err+'.':'Проверяю копию на Диске…';
}
function bkConfirmHtml(){
  var bk=bkS(),k=bk.confirm,m=k==='prev'?(bk.info&&bk.info.prev):bkCloud(),t,yes;
  if(!k)return'';
  if(k==='push'){t='Копия на Диске будет заменена данными из этого браузера ('+(S.sy.cfg.bkDirty||!bkLinked()?'с вашими последними правками':'без правок')+'). Прежняя копия останется на Диске как «предыдущая».';yes='Заменить копию на Диске';}
  else{t='Данные в этом браузере будут заменены копией с Диска ('+bkCopyTxt(m)+'). Текущие данные браузера сохранятся в запасной копии: вернуть их можно кнопкой «Вернуть прежние данные».';yes='Заменить данные в браузере';}
  return'<div class="bkbar warn" role="alert"><span>'+esc(t)+'</span><span class="bkb"><button class="btn mini primary" data-act="bkYes">'+yes+'</button><button class="btn mini" data-act="bkNo">Отмена</button></span></div>';
}
function bkBarHtml(){
  var bk=bkS(),st,cl;
  if(!bkCan()||guestOn())return'';
  if(bk.confirm)return bkConfirmHtml();
  if(bk.hide||S.tab==='sync')return'';
  st=bkSt();cl=bkCloud();
  function bar(txt,btns){return'<div class="bkbar" role="status"><span>'+esc(txt)+'</span><span class="bkb">'+btns+'<button class="btn mini" data-act="bkHide">Позже</button></span></div>';}
  if(st==='behind')return bar('На Диске данные новее ('+bkCopyTxt(cl)+').','<button class="btn mini primary" data-act="bkPull">Обновить с Диска</button>');
  if(st==='free')return bar('На Диске есть копия ваших данных ('+bkCopyTxt(cl)+'). В этом браузере данные могут быть другими.','<button class="btn mini primary" data-act="bkPull">Обновить с Диска</button><button class="btn mini" data-act="bkSaveNow">Сохранить мои на Диск</button>');
  if(st==='conflict')return bar('Данные менялись и в этом браузере, и в другом ('+bkCopyTxt(cl)+').','<button class="btn mini primary" data-act="bkPull">Взять с Диска</button><button class="btn mini" data-act="bkSaveNow">Записать мои на Диск</button>');
  if(st==='none')return bar('Ваши данные хранятся только в этом браузере.','<button class="btn mini primary" data-act="bkSaveNow">Сохранить на Диск</button>');
  return'';
}
/* данные одним файлом: сырьё, ТТК, настройки. Без кода доступа, адреса общей базы и связей с ней — файл можно безопасно передать в тестовую версию */
function dfOut(){
  var s=bkTake();
  delete s.sync;s.file='kbzhu-data';
  anchorSave(JSON.stringify(s),'Не_на_глазок_данные_'+new Date().toISOString().slice(0,10)+'.json');
}
function bkCardHtml(){
  var bk=bkS(),c=S.sy.cfg,st=bkSt(),at=bkUndoAt(),busy=bk.busy||st==='old',cls=(st==='behind'||st==='conflict'||st==='free'||st==='old')?'warn':(st==='ok'?'ok':'');
  var h='<h2>Мои данные на Диске</h2>'
    +'<p class="hint" style="margin-top:0">Данные хранятся в браузере. Копия на Диске переносит их в другой браузер: сохраните здесь, там нажмите «Обновить с Диска». Копия своя у каждого пользователя.</p>'
    +(c.mine?'<p class="hint">Копия закреплена за вашей учётной записью: другой сотрудник её не откроет, даже указав ваше ФИО.</p>':'<p class="hint">Вы вошли по общему коду, он один на всех с этой ролью. Копия привязана к ФИО, которое вы вписали, и защищена только им. Чтобы копию не мог открыть никто другой, попросите технолога завести вам именной доступ.</p>')
    +'<p class="hint cmsg bkst '+cls+'" id="bkStat">'+esc(bkStatusText())+'</p>'
    +'<div class="btns"><button class="btn primary" data-act="bkPull"'+(busy?' disabled':'')+'>Обновить с Диска</button>'
    +'<button class="btn" data-act="bkSaveNow"'+(busy?' disabled':'')+'>Сохранить на Диск</button>'
    +(bk.info&&bk.info.prev?'<button class="btn" data-act="bkPullPrev"'+(busy?' disabled':'')+'>Вернуть предыдущую копию с Диска</button>':'')
    +'<button class="btn" data-act="dfOut">Скачать файл с данными</button>'
    +(at?'<button class="btn" data-act="bkUndo"'+(bk.busy?' disabled':'')+'>Вернуть прежние данные браузера ('+esc(syWhen(at))+')</button>':'')
    +'</div>'
    +'<label class="trem"><input type="checkbox" data-act="bkAuto"'+(c.bkAuto===false?'':' checked')+'>Сохранять на Диск автоматически: через минуту после правок и когда вы уходите из окна</label>'
    +syMsgHtml('bk');
  return h;
}
function syBkHtml(){return'<section class="card" id="bkBox">'+bkCardHtml()+'</section>';}
/* плашка вверху страницы: перерисовывается, только если изменился её текст (иначе нажатие на кнопку могло бы пропасть) */
function bkBarUpdate(){
  var b=$('#bkBar'),h;
  if(!b)return;
  h=bkBarHtml();
  if(h!==bkBarLast){bkBarLast=h;b.innerHTML=h;b.hidden=!h;}
}
function bkPaint(){
  var el=$('#bkBox');
  if(el)el.innerHTML=bkCardHtml();
  renderStatus();
}
/* строка состояния вверху: куда сейчас сохраняются данные */
function bkStatusLine(){
  if(!bkCan()||!bkLinked())return'';
  var st=bkSt();
  if(st==='push')return S.sy.cfg.bkAuto===false?'Есть правки, которых нет на Диске':'Сохраняется в браузере, на Диск запишется сама';
  if(st==='behind'||st==='conflict')return'На Диске другая копия данных';
  if(st==='ok')return'Сохранено в браузере и на Диске';
  return'';
}
function bkStart(){
  var bar=$('#bkBar');
  if(bar)bar.addEventListener('click',function(e){var b=e.target.closest('button[data-act]');if(b)bkClick(b.getAttribute('data-act'),b);});
  setTimeout(function(){bkRefresh();},5000);
  /* ушли из окна: если есть правки, пишем сразу (в другом браузере они понадобятся); вернулись: смотрим, не появилось ли новее */
  document.addEventListener('visibilitychange',function(){
    if(document.hidden){if(S.sy.cfg.bkDirty&&S.sy.cfg.bkAuto!==false&&bkSt()==='push')bkSave({auto:true});}
    else if(Date.now()-bkS().at>20000)bkRefresh();
  });
  setInterval(function(){if(!document.hidden&&!bkS().busy&&Date.now()-bkS().at>85000)bkRefresh();},30000);
}
/*BKUI-END*/

/*PGUI-START*/
