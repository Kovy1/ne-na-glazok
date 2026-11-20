/* ---------- правки редактора: где они лежат и напоминание отправить ----------
   Редактор (и тер. управляющий) правит у себя; в общую базу правка попадает только после того, как технолог её примет.
   До этого она хранится только в этом браузере: другие её не видят, а очистка данных браузера её сотрёт.
   1) Первый раз, когда появилась неотправленная правка, — короткое объяснение с кнопкой «Понятно» (один раз на устройстве).
   2) Дальше — тихое напоминание «Отправить на проверку», но только когда человек перестал править (нет правок ED_IDLE мс
      и курсор не в поле ввода). «Позже» прячет его на ED_SNOOZE. Плашка закреплена внизу и не сдвигает страницу. */
var ED_IDLE=90000,ED_SNOOZE=30*60000,edLast='',edTimer=0;
function edOn(){return S.mode==='local'&&syLinked()&&!S.readOnly&&S.sy.loaded&&syCanSend()&&!syAdmin()&&!guestOn();}
function edCounts(){
  var d=[],sent=0;
  try{d=syDirtyUi();}catch(e){d=[];}
  d.forEach(function(x){if(syIsSent(x))sent++;});
  return{un:d.length-sent,sent:sent};
}
function edIntroSeen(){return lsGet('kbzhu:edIntro')==='1';}
function edTyping(){var a=document.activeElement;return!!(a&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)&&!(a.closest&&a.closest('#edBar')));}
function edBarHtml(){
  if(!edOn())return'';
  var c=edCounts(),now=Date.now(),on=S.tab==='sync'&&(S.cabSeg||'tasks')==='tasks';
  if(!c.un||on)return'';
  var who='технолог',n=c.un+' '+plural(c.un,['правка','правки','правок']);
  if(!edIntroSeen())
    return'<div class="edcard" role="status"><b>Ваши правки пока только на этом устройстве</b>'
      +'<p>Вы правите как '+(S.sy.cfg.role==='finance'?'тер. управляющий':'редактор')+': изменения сохраняются в этом браузере и уходят на проверку. В общей базе и у других пользователей они появятся, только когда '+who+' их примет. До этого их видите только вы, а очистка данных браузера их сотрёт.</p>'
      +'<p>Можно поправить несколько позиций подряд и отправить всё одним разом.</p>'
      +'<div class="btns"><button class="btn mini" data-act="edIntroOk">Понятно</button><button class="btn mini primary" data-act="edGo">Отправить на проверку ('+c.un+')</button></div></div>';
  if(S.edShown!==true){                                         /* напоминание появляется, когда правки закончились */
    if(now<(S.edSnooze||0)||now-(S.edAt||0)<ED_IDLE||edTyping())return'';
    S.edShown=true;
  }
  return'<div class="edcard edmini" role="status"><span><b>Не отправлено: '+esc(n)+'</b> · есть только на этом устройстве, '+who+' их ещё не видит</span>'
    +'<div class="btns"><button class="btn mini" data-act="edLater">Позже</button><button class="btn mini primary" data-act="edGo">Отправить на проверку</button></div></div>';
}
function edBarUpdate(){
  var b=$('#edBar'),h;
  if(!b)return;
  h=edBarHtml();
  if(!h)S.edShown=false;
  if(h===edLast)return;
  edLast=h;b.innerHTML=h;b.hidden=!h;
  try{document.body.style.paddingBottom=h?(b.offsetHeight+24)+'px':'';}catch(e){}   /* последнюю строку страницы можно прокрутить выше плашки */
}
function edTouch(){S.edAt=Date.now();}
function edTick(){if(!edTimer)edTimer=setInterval(function(){if(!document.hidden)edBarUpdate();},15000);}
function edClick(act){
  switch(act){
    case'edIntroOk':lsSet('kbzhu:edIntro','1');S.edAt=Date.now();S.edShown=false;edBarUpdate();return true;
    case'edLater':S.edSnooze=Date.now()+ED_SNOOZE;S.edShown=false;edBarUpdate();return true;
    case'edGo':lsSet('kbzhu:edIntro','1');S.edShown=false;S.tab='sync';S.cabSeg='tasks';if(!tabOk(S.tab))S.tab='menu';renderAll();window.scrollTo(0,0);return true;
  }
  return false;
}
function edInit(){
  var bar=$('#edBar');
  if(bar&&!bar._on){bar._on=1;bar.addEventListener('click',function(e){var b=e.target.closest('button[data-act]');if(b)edClick(b.getAttribute('data-act'));});}
  edTick();
}
try{window.kbzhuEd={S:S,update:edBarUpdate,IDLE:ED_IDLE};}catch(e){}      /* для проверок */
