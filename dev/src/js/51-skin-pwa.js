/* ----- оформление: цветовая схема и светлая/тёмная тема; хранятся в этом браузере ----- */
var SKIN_ACC=['mint','indigo','ember','plum'];
function skinGet(k){try{return localStorage.getItem(k)||'';}catch(e){return'';}}
function skinPut(k,v){try{if(v)localStorage.setItem(k,v);else localStorage.removeItem(k);}catch(e){}}
function skinTheme(){var t=skinGet('kbzhu:theme');return t==='dark'||t==='auto'?t:'light';}
/* v94: одна светлая стальная гамма; выбор цвета и тёмная тема убраны */
function skinApply(){
  var acc='mint',th='light',d=document.documentElement;
  if(SKIN_ACC.indexOf(acc)<0)acc='mint';
  if(acc==='mint')d.removeAttribute('data-accent');else d.setAttribute('data-accent',acc);
  if(th==='auto')d.removeAttribute('data-theme');else d.setAttribute('data-theme',th);
  $$('#skinBox .sk[data-accent]').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-accent')===acc?'true':'false');});
  $$('#skinBox .th').forEach(function(b){b.setAttribute('aria-pressed',b.getAttribute('data-th')===th?'true':'false');});
}
function skinPop(open){
  var b=$('#skinBox'),pb=$('#profBtn');
  if(!b||!pb)return;
  b.hidden=!open;pb.setAttribute('aria-expanded',open?'true':'false');
}
function skinStart(){
  var b=$('#skinBox'),pb=$('#profBtn');
  skinApply();
  if(!b)return;
  if(pb){
    pb.addEventListener('click',function(e){e.stopPropagation();skinPop(b.hidden);});
    document.addEventListener('click',function(e){if(!b.hidden&&!b.contains(e.target)&&!pb.contains(e.target))skinPop(false);});
    document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!b.hidden){skinPop(false);pb.focus();}});
  }
  b.addEventListener('click',function(e){
    var t=e.target.closest('button'),th;
    if(!t)return;
    if(t.getAttribute('data-accent'))skinPut('kbzhu:accent',t.getAttribute('data-accent'));
    else if(t.getAttribute('data-th'))skinPut('kbzhu:theme',t.getAttribute('data-th'));
    skinApply();
    if(S.tab==='abc')renderAll();          /* диаграмма берёт цвета из схемы */
  });
}
/* ----- плашка «Есть обновления» и «Ждут проверки» у всех участников ----- */
function upNeed(){
  var i=S.sy.info,c=S.sy.cfg,n={base:false,files:false,pend:0,pendF:0};
  if(S.mode!=='local'||!syLinked()||!i)return n;
  n.base=Number(i.rev)>Number(c.rev||0)||(!S.sy.heal&&!NOPRICE);   // пока не сверены пропавшие цены (syHealPrices), общую базу нужно получить один раз
  n.files=!syAdmin()&&syFilesOn()&&typeof i.fv==='number'&&S.sy.fvKnown!==undefined&&i.fv!==S.sy.fvKnown;
  if(syAdmin()&&!S.sy.rv&&!S.sy.fr){n.pend=Number(i.pending)||0;n.pendF=syFiles().filter(function(x){return x.kind==='pend'&&x.st!=='rework';}).length;}
  return n;
}
/* ----- версия приложения: страница на ссылке свежее той, что открыта у человека ----- */
function appBuild(){return Number(typeof window!=='undefined'&&window.KBZHU_BUILD)||0;}
function appSrvBuild(){var d=guestOn()?GM.d:S.sy.info;return(d&&typeof d.pgb==='number')?d.pgb:0;}
function appNew(){var b=appBuild(),v=appSrvBuild();return!appPwa()&&b>0&&v>b;}
function appOld(){var b=appBuild(),i=S.sy.info;return!appPwa()&&b>0&&S.mode==='local'&&syLinked()&&syAdmin()&&!!i&&typeof i.pgb==='number'&&Number(i.pga)>0&&i.pgb<b;}
/* ----- приложение на постоянном адресе (GitHub Pages): кеш, мгновенное открытие, тихое обновление; включается только в сборке для хостинга ----- */
function appPwa(){return typeof window!=='undefined'&&window.KBZHU_PWA===1;}
/* подсказка «Открыть как приложение»: только в версии по постоянному адресу и пока она открыта во вкладке браузера.
   Это не установка программы: браузер создаёт ярлык, который открывает страницу в своём окне без вкладок и адресной строки */
var pwDef=null,pwHelp=false,pwGone=false,pwLast='';
function pwStandalone(){
  try{return window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: window-controls-overlay)').matches||window.matchMedia('(display-mode: minimal-ui)').matches||navigator.standalone===true;}catch(e){return false;}
}
function pwBarHtml(){
  if(!appPwa()||pwGone||window.top!==window||pwStandalone()||lsGet('kbzhu:pwhint')==='1')return'';
  return'<div class="bkbar pwbar" role="status"><span><b>Откройте как приложение:</b> отдельное окно со своим значком, без установки программ.</span><span class="bkb">'
    +(pwDef?'<button class="btn mini primary" data-act="pwInstall">Открыть как приложение</button>':'<button class="btn mini primary" data-act="pwHow">'+(pwHelp?'Скрыть':'Как это сделать')+'</button>')
    +'<button class="btn mini" data-act="pwNo">Не показывать</button></span>'
    +(pwHelp?'<p class="hint pwhelp"><b>Яндекс Браузер и Chrome:</b> справа в адресной строке нажмите значок установки (экран со стрелкой) и выберите «Установить». Если значка нет, откройте меню браузера → «Дополнительно» или «Сохранить и поделиться» → «Создать ярлык» или «Установить как приложение» и отметьте «Открыть в отдельном окне». <b>Microsoft Edge:</b> меню «…» → «Приложения» → «Установить этот сайт как приложение».<br>Ярлык «Не на глазок» появится на рабочем столе или в «Пуске» и будет открывать калькулятор в своём окне. Это не программа, права администратора не нужны. Данные хранятся в браузере и в таком окне обычно те же; если вдруг пусто, верните их кнопкой «Обновить с Диска» (копия на Диске должна быть сделана заранее).</p>':'')
    +'</div>';
}
function pwBarUpdate(){
  var b=$('#pwBar'),h;
  if(!b)return;
  h=pwBarHtml();
  if(h===pwLast)return;
  pwLast=h;b.innerHTML=h;b.hidden=!h;
}
function pwHintStart(){
  var bar=$('#pwBar');
  if(!appPwa()||!bar)return;
  bar.addEventListener('click',function(e){
    var b=e.target.closest('button[data-act]'),a,d;
    if(!b)return;
    a=b.getAttribute('data-act');
    if(a==='pwHow'){pwHelp=!pwHelp;}
    else if(a==='pwNo'){pwGone=true;lsSet('kbzhu:pwhint','1');}
    else if(a==='pwInstall'&&pwDef){
      d=pwDef;pwDef=null;
      try{d.prompt();d.userChoice.then(function(r){if(r&&r.outcome==='accepted'){pwGone=true;lsSet('kbzhu:pwhint','1');}else pwHelp=true;pwBarUpdate();},function(){pwHelp=true;pwBarUpdate();});}catch(x){pwHelp=true;}
    }
    pwBarUpdate();
  });
  window.addEventListener('beforeinstallprompt',function(e){try{e.preventDefault();}catch(x){}pwDef=e;pwBarUpdate();});
  window.addEventListener('appinstalled',function(){pwGone=true;lsSet('kbzhu:pwhint','1');pwBarUpdate();});
  pwBarUpdate();
}
function pwaReady(reg){S.pwaReg=reg;S.pwaNew=true;upBarUpdate();}
function pwaGo(){var r=S.pwaReg;S.pwaGo=true;if(r&&r.waiting)r.waiting.postMessage('skip');else location.reload();}
function pwaStart(){
  var sw=(typeof navigator!=='undefined')?navigator.serviceWorker:null,again=false;
  if(!appPwa()||!sw)return;
  sw.addEventListener('controllerchange',function(){if(S.pwaGo&&!again){again=true;location.reload();}});
  sw.register('sw.js').then(function(reg){
    function chk(){try{reg.update().then(null,function(){});}catch(e0){}}
    function watch(w){if(w)w.addEventListener('statechange',function(){if(w.state==='installed'&&sw.controller)pwaReady(reg);});}
    if(reg.waiting&&sw.controller)pwaReady(reg);
    reg.addEventListener('updatefound',function(){watch(reg.installing);});
    setTimeout(chk,2500);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)chk();});
    setInterval(chk,600000);
  },function(){});
}
function appHosted(){try{return/(^|\.)(googleusercontent|google)\.com$/.test(location.hostname);}catch(e){return false;}}
function appLink(){return pgSafeUrl(S.sy.cfg.url||syBakedUrl()||'');}
function appBuildTxt(b){var m=/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(String(b||''));return m?syWhen(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5])):'';}
function appBarHtml(){
  var host=appHosted();
  if(S.pwaNew)return'<div class="upbar app" role="alert"><div class="upt"><b>Вышла новая версия приложения</b><span>Нажмите кнопку: страница загрузится заново. Неотправленные изменения сначала отправьте.</span></div><button class="btn big" data-act="pwaGo">Обновить</button></div>';
  if(appNew())return'<div class="upbar app" role="alert"><div class="upt"><b>Вышла новая версия приложения</b><span>'+(host?'Нажмите кнопку: страница загрузится заново.':'Откройте её по ссылке и войдите по коду. Неотправленные изменения сначала отправьте.')+'</span></div><button class="btn big" data-act="upApp">'+(host?'Обновить приложение':'Открыть новую версию')+'</button></div>';
  if(appOld())return'<div class="upbar rev" role="status"><div class="upt"><b>На ссылке лежит прежняя версия приложения</b><span>Загрузите этот файл в блок «Страница по ссылке»: тогда у всех появится оповещение об обновлении.</span></div><button class="btn big" data-act="upPg">Загрузить</button></div>';
  return'';
}
function upApp(){
  var u=appLink(),go;
  if(!u){flash('Адрес не найден: откройте калькулятор по ссылке от технолога');return;}
  go=u+(u.indexOf('?')>-1?'&':'?')+'v='+appSrvBuild();
  if(appHosted()){try{window.top.location.href=go;return;}catch(e){}}
  window.open(go,'_blank','noopener');
}
function upPg(){S.tab='sync';renderAll();window.scrollTo(0,0);setTimeout(function(){var el=$('#pgBox');if(el)el.scrollIntoView({block:'start'});},50);}
/* скрипт в таблице старее того, что зашит в приложение: технологу предлагается вставить новый и развернуть заново */
function syGasVer(){var m=/var VERSION = (\d+);/.exec(typeof SY_GAS==='string'?SY_GAS:'');return m?Number(m[1]):0;}
function gsOld(){
  var i=S.sy.info,v=syGasVer();
  return S.mode==='local'&&syLinked()&&syAdmin()&&!S.sy.gsLater&&!!i&&v>0&&(Number(i.v)||0)<v;
}
function gsBarHtml(){
  if(!gsOld())return'';
  return'<div class="upbar rev" role="alert"><div class="upt"><b>Скрипт в таблице устарел: версия '+(Number(S.sy.info.v)||0)+', новая — '+syGasVer()+'</b><span>Скопируйте новый скрипт, вставьте его вместо старого в Apps Script таблицы и разверните заново: «Развернуть» → «Управление развёртываниями» → «Новая версия». Данные не пострадают.</span></div><button class="btn big" data-act="gsCopy">Скопировать скрипт</button><button class="btn" data-act="gsLater">Позже</button></div>';
}
function upBarHtml(){
  var n=upNeed(),h=appBarHtml();
  if(S.sy.upBusy)return'<div class="upbar" role="status"><div class="upt"><b>Обновляю…</b></div></div>';
  if(S.sy.busy.send||S.sy.busy.pull)return'';
  h+=gsBarHtml();
  if(n.base&&S.sy.plan)h+='<div class="upbar" role="alert"><div class="upt"><b>Есть расхождения с общей базой</b><span>Выберите, что оставить: ваше или общее, и нажмите «Применить».</span></div><button class="btn big" data-act="upGo">Разобрать</button></div>';
  else if((n.base||n.files)&&S.sy.autoErr)h+='<div class="upbar" role="alert"><div class="upt"><b>Не удалось получить обновления</b><span>'+(n.base?'В общей базе изменились данные: ТТК, сырьё или цены.':'')+(n.files?(n.base?' ':'')+'В «ТТК в облаке» изменились файлы.':'')+'</span></div><button class="btn big" data-act="upGo">Обновить сейчас</button></div>';
  if(S.sy.backupErr)h+='<div class="upbar rev" role="alert"><div class="upt"><b>Общая база не применена</b><span>'+esc(S.sy.backupErr)+'</span></div><span class="upbtns"><button class="btn big" data-act="syRetryLoad">Повторить загрузку</button></span></div>';
  if(S.sy.hold)h+=syHoldBarHtml();
  if(n.pend||n.pendF){
    var parts=[];
    if(n.pend)parts.push('предложений в общей базе: '+n.pend);
    if(n.pendF)parts.push('файлов в «ТТК в облаке»: '+n.pendF);
    h+='<div class="upbar rev" role="status"><div class="upt"><b>Ждут проверки: '+(n.pend+n.pendF)+'</b><span>'+parts.join(', ')+'</span></div><button class="btn big" data-act="upReview">Смотреть изменения</button></div>';
  }
  return h;
}
var upLast='';
function upBarUpdate(){
  var b=$('#upBar'),h;
  if(!b)return;
  h=upBarHtml();
  if(h===upLast)return;
  upLast=h;b.innerHTML=h;b.hidden=!h;
  try{document.documentElement.style.setProperty('--upH',h?(b.offsetHeight+10)+'px':'0px');}catch(e){}
}
/* лёгкая проверка раз в 45 секунд (и когда вкладку открыли снова): один запрос «ping» */
function upPoll(force){
  if(S.mode!=='local'||!syLinked()||(document.hidden&&!force))return Promise.resolve();
  if(!force&&Date.now()-S.sy.upAt<20000)return Promise.resolve();
  S.sy.upAt=Date.now();
  return syGet({a:'ping'},20000).then(function(i){
    var tasks=[],pn=Number(i.pending)||0;
    S.sy.info=i;
    if(pn!==S.sy.pendN){S.sy.pendN=pn;tasks.push(syGet({a:'pending'}).then(function(d){S.sy.pend=d.batches;S.sy.rework=d.rework||[];}));}
    if(syAdmin()&&syFilesOn()&&typeof i.fv==='number'&&S.sy.fvKnown!==undefined&&i.fv!==S.sy.fvKnown)tasks.push(syFilesLoad(true,true));
    if(syPhOn()&&typeof i.phv==='number'&&i.phv!==S.sy.phv)tasks.push(syPhSync());
    return Promise.all(tasks).then(function(){upBarUpdate();if(tasks.length)scheduleRender();upAuto();});
  },function(){});
}
/* общая база и файлы подтягиваются сами: ничего нажимать не нужно; ваши непринятые правки остаются, у технолога расхождения разбираются списком */
/* человек сейчас печатает в поле: подождать, пока он остановится (курсор, просто оставленный в поле, не мешает) */
function upTyping(){return isTyping()&&Date.now()-(S.keyAt||0)<5000;}
function upAuto(){
  var n=upNeed(),p=Promise.resolve();
  if(S.mode!=='local'||!syLinked()||S.sy.autoBusy||S.sy.upBusy||S.sy.busy.pull||S.sy.busy.send||!(n.base||n.files))return p;
  if(S.sy.plan&&syAdmin())return p;
  if(upTyping()){if(!S.sy.autoWait){S.sy.autoWait=true;setTimeout(function(){S.sy.autoWait=false;upAuto();},6000);}return p;}
  if(Date.now()-(S.sy.autoAt||0)<12000)return p;
  S.sy.autoBusy=true;S.sy.autoAt=Date.now();S.sy.autoErr=false;
  if(n.base)p=p.then(function(){return syPull(true);});
  if(n.files)p=p.then(function(){return syFilesLoad(true,true);});
  return p.then(function(){S.sy.autoBusy=false;return upPoll(true);}).then(function(){var m=upNeed();S.sy.autoErr=!!(m.base||m.files);upBarUpdate();},function(){S.sy.autoBusy=false;S.sy.autoErr=true;upBarUpdate();});
}
function upGo(){
  var n=upNeed(),p=Promise.resolve();
  if(S.sy.upBusy)return;
  if(n.base&&S.sy.plan){S.tab='sync';renderAll();window.scrollTo(0,0);return;}
  S.sy.upBusy=true;upBarUpdate();
  if(n.base)p=p.then(function(){return syPull(false,true);});
  if(n.files)p=p.then(function(){return syFilesLoad(true,true);});
  p.then(function(){return syRefresh(true);}).then(function(){return upPoll(true);}).then(function(){S.sy.upBusy=false;upBarUpdate();renderAll();},function(){S.sy.upBusy=false;upBarUpdate();});
}
/* технолог: открыть первое предложение на проверку прямо с плашки */
function upReview(){
  if(S.sy.upBusy)return;
  if(S.sy.fr&&S.recipes[S.sy.fr.recId]){frShow();return;}
  if(S.sy.rv&&rvTmpIds(S.sy.rv).length){rvShow(rvTmpIds(S.sy.rv)[0]);return;}
  S.sy.upBusy=true;upBarUpdate();
  syRefresh(true).then(function(){
    var b=(S.sy.pend||[])[0],it;
    S.sy.upBusy=false;upBarUpdate();
    if(b){
      /* страница изменений: все предложения с подсветкой того, что поменялось (карту технолог открывает кнопкой в строке) */
      S.sy.hlB={};(S.sy.pend||[]).forEach(function(q){S.sy.hlB[q.batch]=1;});
      (S.sy.pend||[]).forEach(function(q){if(q.items.length>12)S.sy.openB[q.batch]=true;});
      S.tab='sync';renderAll();window.scrollTo(0,0);
      setTimeout(function(){var el=$('#syPend');if(el&&el.scrollIntoView)el.scrollIntoView({block:'start'});},60);
      return;
    }
    if(syPendFiles()){S.tab='cloud';S.sy.creg='pend';S.sy.cdir='all';S.sy.fq='';S.sy.fshow=SY_PAGE;renderAll();window.scrollTo(0,0);return;}
    flash('Предложений на проверке нет');renderAll();
  },function(){S.sy.upBusy=false;upBarUpdate();});
}
function upStart(){
  var bar=$('#upBar');
  if(bar)bar.addEventListener('click',function(e){var b=e.target.closest('button[data-act]'),a;if(!b)return;a=b.getAttribute('data-act');if(a==='upGo')upGo();else if(a==='hdBack')syHoldBack();else if(a==='hdAsk'){S.sy.holdAsk=true;upBarUpdate();}else if(a==='hdNo'){S.sy.holdAsk=false;upBarUpdate();}else if(a==='hdDrop')syHoldDrop();else if(a==='upReview')upReview();else if(a==='upApp')upApp();else if(a==='pwaGo')pwaGo();else if(a==='upPg')upPg();else if(a==='gsCopy')copyText(SY_GAS,b);else if(a==='gsLater'){S.sy.gsLater=true;upBarUpdate();}});
  gmInit();skinStart();
  document.addEventListener('keydown',function(){S.keyAt=Date.now();},true);document.addEventListener('input',function(){S.keyAt=Date.now();},true);
  setTimeout(function(){upPoll(true);},4500);
  setTimeout(function(){gmLoad(true);},300);
  document.addEventListener('visibilitychange',function(){if(!document.hidden){upPoll(false);gmLoad(false);}});
  window.addEventListener('focus',function(){upPoll(false);});
  setInterval(function(){upPoll(false);},45000);
}
