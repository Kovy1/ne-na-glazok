/*BK-START*/
/* ---- копия рабочих данных пользователя на Диске: чтобы в любом браузере были одни и те же данные ----
   Чистые функции: состояние страницы им передаётся параметрами. В копию входит всё, что человек накопил в браузере:
   сырьё, ТТК, настройки (регионы, меню, финансы, история цен), связи с общей базой и несколько личных настроек.
   Адрес скрипта, ФИО и код в копию не входят: подключение у каждого браузера своё. */
var BK_VER=1;
var BK_LS=['kbzhu:links','kbzhu:c1rule','kbzhu:c1mass','kbzhu:c1obj','kbzhu:abc','kbzhu:region'];
/* чья это копия: роль и ФИО (для общего кода сервер считает так же; у именного доступа владелец — учётная запись, а присланное ФИО не читается) */
function bkWho(role,name){return String(role||'')+'|'+normKey(name);}
/* c: {at, dev, ings, recipes, cfg, map, gone, rev (версия общей базы), hm, ls:{ключ:строка}} */
function bkSnap(c){
  var o={v:BK_VER,at:c.at,dev:c.dev,ings:c.ings,recipes:c.recipes,cfg:c.cfg,sync:{map:c.map,gone:c.gone,rev:Number(c.rev)||0,hm:c.hm==='np'?'np':''},ls:{}};
  if(c.del&&typeof c.del==='object'&&Object.keys(c.del).length)o.sync.del=c.del;
  BK_LS.forEach(function(k){if(c.ls&&typeof c.ls[k]==='string')o.ls[k]=c.ls[k];});
  return o;
}
function bkCounts(s){return{ings:Object.keys(s.ings||{}).length,recipes:Object.keys(s.recipes||{}).length};}
/* проверка пришедшей копии: текст или объект -> {ok,snap} либо {ok:false,msg} */
function bkCheck(raw){
  var s;
  try{s=typeof raw==='string'?JSON.parse(raw):raw;}catch(e){return{ok:false,msg:'Копия на Диске повреждена: она не читается.'};}
  if(!s||typeof s!=='object'||Array.isArray(s)||typeof s.v!=='number')return{ok:false,msg:'Копия на Диске не похожа на данные калькулятора.'};
  if(s.v>BK_VER)return{ok:false,msg:'Копия сделана более новой версией калькулятора. Откройте свежий файл калькулятора и повторите.'};
  function obj(x){return!!x&&typeof x==='object'&&!Array.isArray(x);}
  if(!obj(s.ings)||!obj(s.recipes)||!obj(s.cfg))return{ok:false,msg:'В копии на Диске нет сырья или ТТК: заменять данные нечем.'};
  return{ok:true,snap:s};
}
/* что записать в браузер при замене данных. cur: {cfg,map,gone} — подключение этого браузера (оно остаётся своим),
   info: {rev (версия копии на Диске), who, at, dirty (после замены есть, что записать обратно)} */
function bkApply(s,cur,info){
  var cfg={},k,sy=s.sync||{};
  for(k in cur.cfg)if(Object.prototype.hasOwnProperty.call(cur.cfg,k))cfg[k]=cur.cfg[k];
  cfg.rev=Number(sy.rev)||0;cfg.hm=sy.hm==='np'?'np':'';
  cfg.bkRev=Number(info.rev)||0;cfg.bkWho=String(info.who||'');cfg.bkAt=Number(info.at)||0;cfg.bkDirty=!!info.dirty;
  var out={v1:JSON.stringify({ings:s.ings,recipes:s.recipes,cfg:s.cfg}),
    sync:{cfg:cfg,map:(sy.map&&typeof sy.map==='object')?sy.map:{ing:{},rec:{}},gone:(sy.gone&&typeof sy.gone==='object')?sy.gone:{}},
    ls:s.ls&&typeof s.ls==='object'?s.ls:{}};
  if(sy.del&&typeof sy.del==='object'&&Object.keys(sy.del).length)out.sync.del=sy.del;
  return out;
}
/* состояние копии. c: {linked (этот браузер уже сверен с копией этого пользователя), rev (версия, с которой сверен),
   dirty (после этого были правки), dev (номер этого браузера), cloud (копия на Диске: {rev,dev} или null)}
   none — копии нет и браузер ни с чем не сверен; free — копия есть, а этот браузер с ней ещё не сверялся;
   ok — всё совпадает; push — у вас есть правки, которых нет на Диске; behind — на Диске новее, у вас правок нет;
   conflict — правки и тут, и в другом браузере */
function bkState(c){
  var cl=c.cloud;
  if(!cl)return c.linked?'push':'none';
  if(!c.linked)return'free';
  if(cl.rev===c.rev||(cl.dev&&cl.dev===c.dev))return c.dirty?'push':'ok';
  return c.dirty?'conflict':'behind';
}
/* версия, поверх которой разрешено писать без вопросов */
function bkBase(c){
  var cl=c.cloud;
  if(!cl)return 0;
  return(cl.dev&&cl.dev===c.dev)?cl.rev:c.rev;
}
/* подпись браузера для людей: «Chrome · Windows» */
function bkLabelOf(ua){
  ua=String(ua||'');
  var b=/YaBrowser/i.test(ua)?'Яндекс Браузер':/Edg\//.test(ua)?'Edge':/OPR\/|Opera/.test(ua)?'Opera':/Firefox\//.test(ua)?'Firefox':/Chrome\/|CriOS/.test(ua)?'Chrome':/Safari\//.test(ua)?'Safari':'Браузер';
  var o=/Windows/.test(ua)?'Windows':/Android/.test(ua)?'Android':/iPhone|iPad|iPod/.test(ua)?'iOS':/Mac OS X|Macintosh/.test(ua)?'Mac':/Linux|X11/.test(ua)?'Linux':'';
  return o?b+' · '+o:b;
}
/*BK-END*/
/*PF-END*/
/*PURE-END*/

