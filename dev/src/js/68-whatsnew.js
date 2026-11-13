/* ---------- «Что изменилось»: журнал выпусков и окно после запуска новой версии ----------
   Журнал лежит в самом приложении, поэтому объявляется только то, что уже работает в запущенной версии (v ≤ APP_REL).
   Ознакомление хранится по человеку и проекту: именной пользователь общей базы — на сервере (операция relget/relput, скрипт версии 29)
   и на устройстве; гость, вход по общему коду и работа без общей базы — только на устройстве. Код доступа идентификатором не служит.
   Окно появляется, когда нет незавершённой работы (ввод, импорт, несохранённая правка), не перекрывает страницу и не повторяется после «Понятно». */
var REL_FIRST=91;         /* с какого выпуска ведётся журнал для объявлений: прежнюю историю прежним пользователям не показываем */
/* k: new — новое, fix — исправлено, act — нужно сделать; r — роли, которым это важно (нет — всем) */
var REL_LOG=[
  {v:91,d:'2026-11-13',items:[
    {k:'new',r:['admin','editor','finance'],t:'Загрузка цен из 1С: сомнительные соответствия больше не грузятся сами. По каждой позиции можно подтвердить предложенное сырьё, выбрать другое, создать новое или пропустить; подтверждённую часть можно загрузить отдельно.'},
    {k:'new',r:['admin','editor','finance'],t:'Перед загрузкой показываются регион, объект, число загружаемых и пропускаемых строк и изменения цен «было → станет». Повторная загрузка тех же данных дублей не создаёт.'},
    {k:'new',r:['admin','editor','finance'],t:'Позиции в литрах и миллилитрах: введите плотность или явно примите допущение «1 л = 1 кг». Допущение сохраняется и отмечается в себестоимости.'},
    {k:'new',r:['admin','editor'],t:'«Готовность карт»: предупреждения о выходе блюда (граммы и килограммы, партия и порция, несовпадение с названием). Карту исправляет только технолог, по подтверждению.'},
    {k:'fix',t:'«Прибыль с порции» теперь «Доход после сырья» (цена продажи минус сырьё), «Экономия на поставщиках» — «Потенциал экономии». Рядом написано, что учтено и на каких допущениях считается.'},
    {k:'new',r:['admin','editor','finance','viewer'],t:'Раздел «Фудкост»: загрузка отчётов (поступления, движение товаров, ревизии, продажи, списания, выпуск), баланс и отклонения с формулами и строками документов, план мероприятий с ответственными и сроками, скачивание в Word, Excel и PDF. План строится по формулам, без ИИ: одинаковые данные дают одинаковый план.'},
    {k:'new',r:['admin','editor','finance','viewer'],t:'Фудкост между устройствами: отчёты, версии плана, ответственные, сроки, статусы и комментарии хранятся в общей базе (нужен скрипт версии 30). Сотрудник видит назначенные ему мероприятия после входа; права проверяются на сервере. Состояние показано рядом с планом: «Сохранено на устройстве», «Синхронизировано», «Ошибка сохранения». Данные разных учётных записей в одном браузере разделены.'},
    {k:'new',r:['admin','editor','finance','viewer'],t:'Каждая версия плана хранит снимок данных расчёта (операции, сопоставления, рецептуры, цены, настройки). Обновление базы не меняет сохранённые результаты; пересчёт по новым ценам или ТТК — отдельное действие, создающее новую версию. Скачать можно «Зафиксированную версию» или «С текущим состоянием выполнения»; в документе указан режим и дата состояния. Добавлено скачивание PDF.'},
    {k:'fix',r:['admin','editor','finance'],t:'НДС: закупки приводятся по ставке или сумме НДС каждой строки (колонки «Ставка НДС», «Сумма НДС» в поступлениях). Единая ставка применяется только после вашего подтверждения, и такой результат помечается приблизительным. Потенциальная экономия: одна потеря и одна цена считаются один раз, пересечения вычитаются, а где общий эффект определить нельзя, показаны отдельные оценки без суммы.'},
    {k:'act',r:['admin','editor','finance'],t:'Фудкост: в настройках расчёта задайте основу НДС закупок и выручки; без ставок строк результат будет приблизительным. Загрузка отчётов 1С проверена только на синтетических файлах, реальные выгрузки ещё не проверялись.'},
    {k:'new',t:'Окно «Что изменилось»: после обновления показывает важное для вашей роли один раз. Вся история доступна по ссылке под страницей.'},
    {k:'act',r:['admin'],t:'Чтобы фудкост хранился на сервере, а отметка «Понятно» запоминалась между устройствами именных пользователей, обновите скрипт общей базы до версии 30 (она включает версию 29).'}
  ]},
  {v:90,d:'2026-11-12',items:[
    {k:'new',r:['admin','editor','finance'],t:'У сырья кнопка «Закупки»: дата, объект, поставщик и позиция 1С, чтобы проверить, куда отнесло сырьё.'},
    {k:'fix',r:['admin','editor','finance'],t:'Автосопоставление 1С строже: названия с лишним значимым словом (например, «красный» лук) попадают в «Подтвердите».'}
  ]},
  {v:89,d:'2026-11-09',items:[
    {k:'fix',t:'Строка меню читается проще: подписи, КБЖУ на порцию, пояснение расчёта.'},
    {k:'new',r:['admin','editor','finance'],t:'Карточка 1С: отдельные кнопки «Новое сырьё» и «Не вносить», поиск по базе.'}
  ]}
];
var REL_KIND={'new':'Новое','fix':'Исправлено','act':'Нужно сделать'};
var relFresh=(function(){try{return localStorage.getItem('kbzhu:v1')===null&&localStorage.getItem('kbzhu:tab')===null;}catch(e){return false;}})();
S.rel={all:false,srv:{},last:'',push:{}};
function relRole(){return guestOn()?'viewer':(syLinked()?(S.sy.cfg.role||'admin'):'admin');}
function relUid(){var u=String(S.sy.cfg.uid||'');return(syLinked()&&u.indexOf('u:')===0)?u:'dev';}
function relProj(){
  var u=syLinked()?String(S.sy.cfg.url||''):'',h=5381,i;
  if(!u)return'local';
  for(i=0;i<u.length;i++)h=((h<<5)+h+u.charCodeAt(i))|0;
  return'p'+(h>>>0).toString(36);
}
function relKey(){return'kbzhu:rel:'+relProj()+':'+relUid();}
function relItems(e,role){return e.items.filter(function(x){return!x.r||x.r.indexOf(role)>-1;});}
/* сколько выпусков человек уже видел; undefined — пока неизвестно (ждём ответа сервера), null нет — отметки нет */
function relSeen(){
  var uid=relUid(),st=S.rel.srv[uid],loc=lsGet(relKey()),n=(loc!==null&&loc!==''&&isFinite(Number(loc)))?Number(loc):null,sv=0;
  if(uid!=='dev'){
    if(st===undefined||st==='wait')return undefined;
    if(st&&st.v>0)sv=st.v;
  }
  if(sv>(n||0)){n=sv;lsSet(relKey(),String(n));}
  return n;
}
function relPending(){
  var seen=relSeen(),role=relRole(),base;
  if(seen===undefined)return[];
  if(seen===null){
    if(relFresh){lsSet(relKey(),String(APP_REL));return[];}      /* первый запуск: прежняя история непрочитанной не считается */
    base=REL_FIRST-1;
  }else base=seen;
  return REL_LOG.filter(function(e){return e.v>base&&e.v<=APP_REL&&relItems(e,role).length;}).sort(function(a,b){return b.v-a.v;});
}
function relFetch(){
  var uid=relUid();
  if(uid==='dev'||S.rel.srv[uid]!==undefined||!syLinked()||S.mode!=='local')return;
  S.rel.srv[uid]='wait';
  syPost('relget',{}).then(function(r){
    S.rel.srv[uid]=(r&&r.ok&&!r.shared)?{v:Number(r.v)||0}:{v:0,na:1};
  },function(){S.rel.srv[uid]={v:0,na:1};});
}
function relMark(){
  var top=0,uid=relUid();
  REL_LOG.forEach(function(e){if(e.v<=APP_REL&&e.v>top)top=e.v;});
  lsSet(relKey(),String(top));
  if(uid!=='dev'&&S.rel.srv[uid]&&!S.rel.srv[uid].na){
    S.rel.srv[uid].v=top;
    syPost('relput',{v:top}).then(null,function(){});
  }
}
/* нет незавершённой работы: поле в фокусе, идущий импорт, несохранённая правка, подключение, вкладка не видна */
function relIdle(){
  var a=document.activeElement,tg=a&&a.tagName;
  if(document.hidden||S.mode!=='local')return false;
  if(S.c1||S.price||S.sales||S.recs||S.sx||S.pwaGo)return false;
  if(tg==='INPUT'||tg==='TEXTAREA'||tg==='SELECT'||(a&&a.isContentEditable))return false;
  if(typeof savesPending==='function'&&savesPending())return false;
  return true;
}
function relListHtml(list,role){
  return list.map(function(e){
    var its=relItems(e,role);
    return'<div class="relv"><b>Версия '+e.v+'</b>'+(e.d?'<span class="reld">'+esc(e.d.split('-').reverse().join('.'))+'</span>':'')+'<ul>'
      +its.map(function(x){return'<li class="rel-'+x.k+'"><i>'+REL_KIND[x.k]+'</i> '+esc(x.t)+'</li>';}).join('')+'</ul></div>';
  }).join('');
}
function relBarHtml(){
  var role=relRole(),p=relPending(),h='';
  if(S.rel.all)return'<div class="relbar" role="region" aria-label="История выпусков"><div class="relh"><b>История выпусков</b><span>Установлена версия '+APP_REL+'</span><button type="button" class="btn mini" data-rel="close">Свернуть</button></div>'
    +relListHtml(REL_LOG.filter(function(e){return e.v<=APP_REL&&relItems(e,role).length;}).sort(function(a,b){return b.v-a.v;}),role)+'</div>';
  if(!p.length||!S.rel.show)return'';
  h='<div class="relbar" role="status" aria-label="Что изменилось"><div class="relh"><b>Что изменилось</b><span>Установлена версия '+APP_REL+'</span></div>'+relListHtml(p.slice(0,3),role)
    +(p.length>3?'<p class="hint">Ещё выпусков: '+(p.length-3)+'. Они в полной истории.</p>':'')
    +'<div class="relbtns"><button type="button" class="btn primary" data-rel="ok">Понятно</button><button type="button" class="btn" data-rel="all">Вся история</button></div></div>';
  return h;
}
function relPaint(){
  var b=$('#relBar'),f=$('#relFoot'),h=relBarHtml();
  if(f){var ft='<button type="button" class="tlink" data-rel="'+(S.rel.all?'close':'all')+'">'+(S.rel.all?'Свернуть историю выпусков':'Что изменилось · версия '+APP_REL)+'</button>';if(f.innerHTML!==ft)f.innerHTML=ft;}
  if(!b||h===S.rel.last)return;
  S.rel.last=h;b.innerHTML=h;b.hidden=!h;
}
function relTick(){
  relFetch();
  if(!S.rel.show&&!S.rel.all&&relIdle()&&relPending().length)S.rel.show=true;     /* показываем, когда человек ничего не делает; дальше окно остаётся, пока не нажато «Понятно» */
  if(S.rel.show&&!relPending().length)S.rel.show=false;
  relPaint();
}
function relStart(){
  var b=$('#relBar'),f=$('#relFoot');
  function clk(e){
    var t=e.target.closest('[data-rel]'),a;
    if(!t)return;
    a=t.getAttribute('data-rel');
    if(a==='ok'){relMark();S.rel.show=false;S.rel.all=false;}
    else if(a==='all')S.rel.all=true;
    else if(a==='close')S.rel.all=false;
    relPaint();
  }
  if(b)b.addEventListener('click',clk);
  if(f)f.addEventListener('click',clk);
  setInterval(relTick,2500);
  setTimeout(relTick,1200);
}
try{window.kbzhuRel={tick:relTick,idle:relIdle,pending:relPending};}catch(e){}      /* для проверок */
