/* ----- плашка вверху страницы ----- */
function rvMsgHtml(){var m=S.sy.msg.review;return(m&&m.msg)?'<p class="hint cmsg '+m.state+'" role="status" style="margin:8px 0 0">'+esc(m.msg)+'</p>':'';}
function rvReviewBarHtml(rv){
  var b=rvBatchById(rv.batch),busy=S.sy.busy.review,ask=S.sy.rvAsk,inRew=!!(S.sy.rework||[]).filter(function(x){return x.batch===rv.batch;}).length,rest=0,dis=busy?' disabled':'';
  var h='<div class="bkbar rvbar" role="region" aria-label="Проверка ТТК"><div class="rvh"><b>Проверка ТТК</b> · от '+esc(rv.by||'')+(rv.at?' · '+esc(syWhen(rv.at)):'');
  if(b){
    rest=b.items.length-Object.keys(rv.recs).length;
    if(b.note)h+='<div class="rvq">«'+esc(b.note)+'»</div>';
    if(b.prevReply)h+='<div class="rvq">Ваш прошлый комментарий: «'+esc(b.prevReply)+'»</div>';
    h+='<div class="rvt">Карту можно править: опубликуется ваша версия.'+(rest>0?' Остальное из предложения (позиций: '+rest+') опубликуется как прислано.':'')+'</div>';
  }else h+='<div class="rvt">Это предложение уже обработано или снято автором: карту можно только закрыть.</div>';
  h+='</div>'+hlPanelHtml();
  if(ask)h+='<div class="rvask"><label class="lbl" for="rvNote">'+(ask==='rej'?'Причина отклонения (необязательно)':'Комментарий автору (обязателен): что исправить')+'</label><textarea id="rvNote" rows="3" maxlength="1000"></textarea>'
    +'<div class="rvbtns"><button class="btn mini primary" data-act="rvSend"'+dis+'>'+(ask==='rej'?'Отклонить':'Вернуть на доработку')+'</button><button class="btn mini" data-act="rvAskNo">Отмена</button></div></div>';
  else if(b)h+=(syFilesOn()?'<label class="rvfile"><input type="checkbox" data-act="rvFile"'+(S.sy.rvFileOff?'':' checked')+'> Положить ТТК (.docx) в «ТТК в облаке»</label>':'')+'<div class="rvbtns"><button class="btn mini primary" data-act="rvApprove"'+dis+'>Опубликовать</button>'
    +(inRew?'':'<button class="btn mini" data-act="rvAsk" data-v="rew"'+dis+'>На доработку</button>')
    +'<button class="btn mini" data-act="rvAsk" data-v="rej"'+dis+'>Отклонить</button><button class="btn mini" data-act="rvClose">Закрыть проверку</button></div>';
  else h+='<div class="rvbtns"><button class="btn mini" data-act="rvClose">Закрыть проверку</button></div>';
  return h+rvMsgHtml()+'</div>';
}
function rwFixBarHtml(b){
  var busy=S.sy.busy.send,dis=busy?' disabled':'';
  return'<div class="bkbar warn rvbar" role="region" aria-label="Доработка ТТК"><div class="rvh"><b>Технолог вернул на доработку</b>'+(b.reviewer?' · '+esc(b.reviewer):'')+(b.decided?' · '+esc(syWhen(b.decided)):'')
    +'<div class="rvq">«'+esc(b.reply||'')+'»</div><div class="rvt">Исправьте карту и отправьте её на проверку снова.</div></div>'
    +'<div class="rvask"><label class="lbl" for="rwNote">Что исправили (необязательно)</label><input type="text" id="rwNote" maxlength="300" autocomplete="off"></div>'
    +'<div class="rvbtns"><button class="btn mini primary" data-act="rwSend" data-batch="'+esc(b.batch)+'"'+dis+'>Отправить на проверку снова</button>'
    +'<button class="btn mini" data-act="rwDrop" data-batch="'+esc(b.batch)+'"'+dis+'>Убрать из уведомлений</button></div>'+rvMsgHtml()+'</div>';
}
function rvBarHtml(){
  var a=S.active,rv=S.sy.rv,l,cur,key,fr=S.sy.fr;
  if(S.mode!=='local'||!syLinked())return'';
  if(syAdmin()&&(rv||fr))hlSet();
  if(syAdmin()){
    if(fr&&S.recipes[fr.recId]){
      if(S.tab==='calc'&&a===fr.recId)return frReviewBarHtml(fr);
      return'<div class="bkbar" role="status"><span>Идёт проверка файла «'+esc(fr.name)+'»'+(fr.by?' от '+esc(fr.by):'')+'.</span><span class="bkb"><button class="btn mini primary" data-act="frBack">К карте</button></span></div>';
    }
    if(!rv)return'';
    if(S.tab==='calc'&&rvTmpIds(rv).indexOf(a)>-1)return rvReviewBarHtml(rv);
    return'<div class="bkbar" role="status"><span>Идёт проверка ТТК от '+esc(rv.by||'')+'.</span><span class="bkb"><button class="btn mini primary" data-act="rvBack">К карте</button></span></div>';
  }
  if(!syInboxOn())return'';
  l=S.sy.inbox;
  if(!l||!l.length)return edBarsHtml();
  cur=rwFor(a);
  if(S.tab==='calc'&&cur)return rwFixBarHtml(cur);
  key=l.map(function(x){return x.batch;}).join(',');
  if(S.sy.inboxHide===key)return edBarsHtml();
  return edBarsHtml()+'<div class="bkbar warn" role="status"><span>Технолог вернул на доработку: <b>'+esc(rwNames(l[0]))+'</b>'+(l.length>1?' (и ещё предложений: '+(l.length-1)+')':'')+'</span><span class="bkb"><button class="btn mini primary" data-act="rwOpenFirst">Открыть</button><button class="btn mini" data-act="rwHide" data-key="'+esc(key)+'">Позже</button></span></div>';
}
function rvBarUpdate(){
  var b=$('#rvBar'),h,ae,keep,t;
  if(!b)return;
  h=rvBarHtml();
  if(h===rvBarLast)return;
  ae=document.activeElement;keep=(ae&&b.contains(ae))?ae.id:'';
  rvBarLast=h;b.innerHTML=h;b.hidden=!h;
  t=$('#rvNote');if(t)t.value=S.sy.rvNote||'';
  t=$('#rwNote');if(t)t.value=S.sy.rwNote||'';
  t=$('#frNote');if(t)t.value=S.sy.frNote||'';
  if(keep){t=$('#'+keep);if(t)t.focus();}
}
function rvClick(act,b){
  var i;
  switch(act){
    case'rvApprove':rvDecide('approve');break;
    case'rvAsk':S.sy.rvAsk=b.getAttribute('data-v');delete S.sy.msg.review;rvBarUpdate();i=$('#rvNote');if(i)i.focus();break;
    case'rvAskNo':S.sy.rvAsk='';delete S.sy.msg.review;rvBarUpdate();break;
    case'rvSend':rvDecide(S.sy.rvAsk==='rej'?'reject':'rework');break;
    case'rvClose':arm(b,'Закрыть без решения?',function(){rvDrop();renderAll();flash('Проверка закрыта, решение не принято');});break;
    case'rvBack':i=S.sy.rv&&rvTmpIds(S.sy.rv)[0];if(i)rvShow(i);break;
    case'frApprove':frDecide('fapprove');break;
    case'frAsk':S.sy.frAsk=b.getAttribute('data-v');delete S.sy.msg.review;rvBarUpdate();i=$('#frNote');if(i)i.focus();break;
    case'frAskNo':S.sy.frAsk='';delete S.sy.msg.review;rvBarUpdate();break;
    case'frSend':frDecide(S.sy.frAsk==='rej'?'freject':'frework');break;
    case'frClose':arm(b,'Закрыть без решения?',function(){frDrop();S.tab='cloud';renderAll();flash('Проверка закрыта, решение не принято');});break;
    case'frBack':frShow();break;
    case'frInboxOpen':S.tab='cloud';S.sy.creg='pend';S.sy.cdir='all';S.sy.fq='';S.sy.fshow=SY_PAGE;renderAll();syFilesLoad(true,true);window.scrollTo(0,0);break;
    case'rwSend':rwSend(b.getAttribute('data-batch'));break;
    case'rwDrop':rwDrop(b.getAttribute('data-batch'));break;
    case'rwOpenFirst':
      i=(S.sy.inbox||[])[0];
      if(i){var rr=i.items.filter(function(x){return x.kind==='rec';})[0];if(rr)rwOpen(i.batch,rr.sid);else{S.tab='sync';renderAll();}}
      break;
    case'rwHide':S.sy.inboxHide=b.getAttribute('data-key');rvBarUpdate();break;
  }
}
function rvStart(){
  var bar=$('#rvBar');
  rvValidate();upStart();
  if(bar){
    bar.addEventListener('click',function(e){var b=e.target.closest('button[data-act]');if(b)rvClick(b.getAttribute('data-act'),b);});
    bar.addEventListener('input',function(e){var t=e.target;if(t.id==='rvNote')S.sy.rvNote=t.value;else if(t.id==='rwNote')S.sy.rwNote=t.value;else if(t.id==='frNote')S.sy.frNote=t.value;});
    bar.addEventListener('change',function(e){var t=e.target;if(t.getAttribute&&t.getAttribute('data-act')==='syFWant')S.sy.fwant[t.getAttribute('data-id')]=t.value;else if(t.getAttribute&&t.getAttribute('data-act')==='rvFile')S.sy.rvFileOff=!t.checked;});
  }
  setTimeout(function(){if(syLinked())syFreshAddr(false).then(function(){return syInbox(true);});},3000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)syInbox(false);});
  /* вернулись во вкладку или появилась связь: общее подтягивается само; правки, которых ещё нет в общей базе, не затираются (сверка по трём версиям) */
  document.addEventListener('visibilitychange',function(){if(!document.hidden&&S.mode==='local'&&syLinked()&&!S.sy.busy.pull&&Date.now()-(S.sy.pullAt||0)>60000)syPull(true);});
  window.addEventListener('online',function(){renderStatus();if(S.mode==='local'&&syLinked()&&!S.sy.busy.pull)syPull(true);});
  window.addEventListener('offline',function(){renderStatus();});
  document.addEventListener('toggle',function(e){if(e.target&&e.target.id==='mExtra')S.mExtra=e.target.open;},true);
  (function(){var st=$('#status');if(st)st.addEventListener('click',function(){var nr=window.matchMedia&&window.matchMedia('(max-width:700px)').matches;if(nr&&!st.classList.contains('open')){st.classList.add('open');return;}st.classList.remove('open');if(st.getAttribute('data-retry')==='1'&&S.mode==='local'&&syLinked()&&!S.sy.busy.pull){S.sy.loadErr='';if(S.sy.msg&&S.sy.msg.send&&S.sy.msg.send.state==='err')S.sy.msg.send.state='';syPull(false);renderStatus();}});})();
  setInterval(function(){if(!document.hidden)syInbox(false);},30000);
}

/* ----- карточки на вкладке «Личный кабинет» ----- */
function rvItemRow(b,it,open){
  return'<div class="syrow"><div class="syn"><b>'+esc(it.name)+'</b> <span class="sysub">'+(it.kind==='rec'?'ТТК':'сырьё')+'</span></div>'
    +(open&&it.kind==='rec'?'<div class="syst"><button class="btn mini" data-act="'+open+'" data-batch="'+esc(b.batch)+'" data-sid="'+esc(it.sid)+'">Открыть ТТК</button></div>':'')+'</div>';
}
/* у редактора: что вернул технолог */
function syInboxHtml(){return syInboxRewHtml()+syInboxRejHtml();}
function syInboxRejHtml(){
  var l=S.sy.inboxR,h;
  if(!syInboxOn()||!l||!l.length)return'';
  h='<section class="card rwcard" id="syInboxR"><h2>Отклонено технологом · '+l.length+'</h2>';
  l.forEach(function(b){
    h+='<div class="sybatch"><div class="syhead"><b>'+esc(b.reviewer||'Технолог')+'</b> <span class="sysub">'+esc(syWhen(b.decided))+'</span>'
      +'<div class="rwq">'+(b.reply?'«'+esc(b.reply)+'»':'Без объяснения причины')+'</div></div><div class="sylist">';
    b.items.forEach(function(it){h+=rvItemRow(b,it,'');});
    h+='</div><div class="btns" style="margin-top:10px"><button class="btn mini" data-act="rwDrop" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>Понятно</button></div></div>';
  });
  return h+'</section>';
}
function syInboxRewHtml(){
  var l=S.sy.inbox,h;
  if(!syInboxOn()||!l||!l.length)return'';
  h='<section class="card rwcard" id="syInbox"><h2>Вернули на доработку · '+l.length+'</h2>';
  l.forEach(function(b){
    h+='<div class="sybatch"><div class="syhead"><b>'+esc(b.reviewer||'Технолог')+'</b> <span class="sysub">'+esc(syWhen(b.decided))+'</span>'
      +'<div class="rwq">«'+esc(b.reply||'')+'»</div></div><div class="sylist">';
    b.items.forEach(function(it){h+=rvItemRow(b,it,'rwOpen');});
    h+='</div><div class="btns" style="margin-top:10px"><button class="btn mini" data-act="rwDrop" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>Убрать из уведомлений</button></div></div>';
  });
  return h+'</section>';
}
/* у технолога: что лежит у авторов на доработке */
function syReworkHtml(){
  var l=S.sy.rework,h;
  if(!syAdmin()||!l||!l.length)return'';
  h='<section class="card" id="syRew"><h2>На доработке у авторов · '+l.length+'</h2>';
  l.forEach(function(b){
    h+='<div class="sybatch"><div class="syhead"><b>'+esc(b.by)+'</b> <span class="sysub">отправлено '+esc(syWhen(b.at))+' · возвращено '+esc(syWhen(b.decided))+(b.reviewer?' ('+esc(b.reviewer)+')':'')+'</span>'
      +'<div class="rwq">«'+esc(b.reply||'')+'»</div></div><div class="sylist">';
    b.items.forEach(function(it){h+=rvItemRow(b,it,'rvOpen');});
    h+='</div><div class="btns" style="margin-top:10px"><button class="btn mini" data-act="syApprove" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>Принять как есть</button>'
      +'<button class="btn mini" data-act="syReject" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>Отклонить</button></div></div>';
  });
  return h+'</section>';
}
/*RVUI-END*/


/* v27: боковая панель сравнения закрывается клавишей Esc; на телефоне нижнюю навигацию можно свернуть */
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('#syPlan.drawer')){S.sy.cmpOpen=false;renderAll();}});
/* телефон: в нижней панели 4 основных раздела и «Ещё»; остальные — во всплывающем списке над панелью */
var NAV_MAIN=4;
function navFit(){
  var nav=$('#tabs'),more=$('#tabMore');
  if(!nav||!more)return;
  var phone=window.matchMedia&&window.matchMedia('(max-width:999.98px)').matches,vis=[],over=0,selOver=false;
  $$('#tabs .tab[data-tab]').forEach(function(b){b.classList.remove('tab-over');if(!b.hidden)vis.push(b);});
  if(phone&&vis.length>NAV_MAIN+1){
    vis.slice(NAV_MAIN).forEach(function(b){b.classList.add('tab-over');over++;if(b.getAttribute('aria-selected')==='true')selOver=true;});
  }
  more.hidden=!over;
  more.setAttribute('aria-selected',selOver?'true':'false');
  if(!over)nav.classList.remove('more-open');
  more.setAttribute('aria-expanded',nav.classList.contains('more-open')?'true':'false');
}
(function(){
  var more=$('#tabMore'),nav=$('#tabs');
  if(more)more.addEventListener('click',function(e){e.stopPropagation();nav.classList.toggle('more-open');navFit();});
  document.addEventListener('click',function(e){if(nav&&nav.classList.contains('more-open')&&!e.target.closest('#tabMore'))nav.classList.remove('more-open');navFit();});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&nav&&nav.classList.contains('more-open')){nav.classList.remove('more-open');navFit();if(more)more.focus();}});
  if(window.matchMedia)try{window.matchMedia('(max-width:999.98px)').addEventListener('change',navFit);}catch(x){}
  window.addEventListener('resize',navFit);
})();
