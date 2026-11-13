/* ---------- state ---------- */
var S={ings:{},recipes:{},cfg:{},region:'main',rgOpen:false,active:null,tab:'calc',q:'',pDish:null,onlyEst:false,onlyUnk:false,rdF:'',rdQ:'',rdN:0,rdConfirm:false,
  loaded:{ingredients:false,recipes:false},mode:'init',readOnly:false,
  save:'ok',saveMsg:'',importOpen:false,importMsg:'',focusFk:null,db:null,dl:null,ttk:null};
var dirty={},inflight={},pending={},timers={},retries={};
var running=0,MAXC=4,renderPending=false,localTimer=null;

function $(s,r){return(r||document).querySelector(s);}
function $$(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s));}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(v,d){return isFinite(v)?v.toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';}
function signed(v,d){if(!isFinite(v))return'—';var s=v>0?'+':(v<0?'−':'');return s+Math.abs(v).toLocaleString('ru-RU',{minimumFractionDigits:d,maximumFractionDigits:d});}
function toInput(v){if(v===null||v===undefined)return'';return String(Math.round(v*10000)/10000).replace('.',',');}
function byName(map){return function(a,b){return String(map[a].name||'').localeCompare(String(map[b].name||''),'ru');};}
function lsGet(k){try{return localStorage.getItem(k);}catch(e){return null;}}
function lsSet(k,v){if(bkFrozen)return true;try{localStorage.setItem(k,v);return true;}catch(e){return false;}}
function flash(msg){var t=$('#toast');t.textContent=msg;t.classList.add('on');clearTimeout(flash.t);flash.t=setTimeout(function(){t.classList.remove('on');},2600);}
function curRecipe(){return S.active?S.recipes[S.active]:null;}
function setActive(id){S.active=id;lsSet('kbzhu:active',id||'');}

/* ---------- ТТК, привязанные к региону: у блюда может быть своя карта (свой выход) для каждого региона ---------- */
function recBase(r){
  var n=String((r&&r.name)||'');
  if(r&&r.reg)n=n.replace(/\s+·\s+[^·]+$/,'');
  return n;
}
function recKey(r){return normKey(recBase(r));}
function regKnown(g){var l=regionList(),i;for(i=0;i<l.length;i++)if(l[i].id===g)return true;return false;}
/* что видно в регионе g: общие ТТК и привязанные к нему; общая ТТК скрыта, если у региона есть своя карта этого блюда */
function visIds(g){
  g=g||curRegion();
  var ids=Object.keys(S.recipes),own={};
  if(syLimited())ids=ids.filter(function(id){return calcReady(S.recipes[id]);});      /* тер. управляющий и шеф-повар не видят нерассчитанные ТТК */
  ids.forEach(function(id){var r=S.recipes[id];if(r.reg&&r.reg===g&&regKnown(g))own[recKey(r)]=1;});
  return ids.filter(function(id){var r=S.recipes[id];if(r.reg&&regKnown(r.reg))return r.reg===g;return!own[recKey(r)];}).sort(byName(S.recipes));
}
function visMap(g){var m={};visIds(g).forEach(function(id){m[id]=S.recipes[id];});return m;}
function recLabel(r){
  var n=r.name||'Без названия';
  if(r.reg&&regKnown(r.reg)&&regionList().length>1&&n.indexOf(regionName(r.reg))<0)n+=' · '+regionName(r.reg);
  if(r.arch)n+=' · архив';
  return n;
}
/* ---------- папки меню и архив ---------- */
function normMenu(d){
  var cats=[],seen={};
  (d&&Array.isArray(d.cats)?d.cats:[]).forEach(function(c){
    if(!c)return;
    var id=String(c.id||'').slice(0,40),nm=String(c.name||'').replace(/\s+/g,' ').trim().slice(0,60);
    if(!id||!nm||seen[id])return;
    seen[id]=1;cats.push({id:id,name:nm});
  });
  return{cats:cats.slice(0,60)};
}
function menuCats(){var m=S.cfg.menu;return(m&&Array.isArray(m.cats))?m.cats:[];}
function ensureMenu(){if(!S.cfg.menu||!Array.isArray(S.cfg.menu.cats))S.cfg.menu={cats:[]};return S.cfg.menu.cats;}
function saveMenu(){queueSave('settings','menu');layTouch();}
/* ---------- общие папки меню ----------
   Папки и раскладку блюд по ним ведёт технолог: они уходят в общую базу отдельно от ТТК (скрипт версии 10) и у остальных кодов подставляются в меню сами.
   У технолога главные его локальные папки; у остальных вместо личных появляются общие, и менять их там нельзя, пока технолог их ведёт.
   Состояние: S.sy.cfg.laySh (1 — у этого кода общие папки), S.sy.cfg.layLs (подпись раскладки, с которой локальные папки сверены в последний раз). */
function layOn(){return S.mode==='local'&&!syAdmin()&&syLinked()&&S.sy.cfg.laySh===1;}
function laySig(cats){return syHash(JSON.stringify((cats||[]).map(function(c){return[c.n,(c.r||[]).slice().sort()];})));}
/* раскладка из локальных папок технолога: в ней только блюда, уже попавшие в общую базу (у остальных других нет) */
function layBuild(){
  var m=syMap(syCtx(),'rec'),idx={},byName={},known={},out=[];
  menuCats().forEach(function(c){var o={n:c.name,r:[]};idx[c.id]=o;byName[normKey(c.name)]=o;out.push(o);});
  Object.keys(m).forEach(function(id){if(m[id]&&m[id].sid)known[m[id].sid]=1;});
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],e=m[id],o=r.cat&&idx[r.cat];
    if(o&&e&&e.sid&&e.rev>0)o.r.push(e.sid);
  });
  /* блюда, которых этот компьютер ещё не получил, остаются в общей раскладке как были: пустой или неполный браузер её не затирает */
  (S.sy.lay||[]).forEach(function(rc){
    var o=byName[normKey(rc.n)];if(!o)return;
    (rc.r||[]).forEach(function(sid){if(!known[sid]&&!S.sy.gone['rec|'+sid])o.r.push(sid);});
  });
  out.forEach(function(o){o.r.sort();});
  return out;
}
/* технолог: блюдам без папки подставляется папка из общей раскладки (блюдо могло прийти позже папок) */
function layFill(remote){
  var m=syMap(syCtx(),'rec'),byKey={},sidCat={},ch=false;
  menuCats().forEach(function(c){byKey[normKey(c.name)]=c.id;});
  remote.forEach(function(x){var id=byKey[normKey(x.n)];if(id)(x.r||[]).forEach(function(sid){sidCat[sid]=id;});});
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],e=m[id],d=e&&e.sid&&sidCat[e.sid];
    if(r.cat&&catById(r.cat))return;
    if(d){r.cat=d;queueSave('recipes',id);ch=true;}
  });
  return ch;
}
/* общие папки -> локальные: strict (у не-технолога) убирает папку и у блюд, которых в раскладке нет */
function layMirror(remote,strict){
  var cl=ensureMenu(),byKey={},ch=false,sidCat={},m=syMap(syCtx(),'rec');
  cl.forEach(function(c){byKey[normKey(c.name)]=c;});
  var want=remote.map(function(x){var c=byKey[normKey(x.n)];return{id:c?c.id:newId(),name:x.n};});
  var same=want.length===cl.length&&want.every(function(w,i){return cl[i].id===w.id&&cl[i].name===w.name;});
  if(!same){S.cfg.menu.cats=want;ch=true;}
  remote.forEach(function(x,i){(x.r||[]).forEach(function(sid){sidCat[sid]=want[i].id;});});
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],e=m[id],d=(e&&e.sid&&sidCat[e.sid])||'',cur=r.cat||'';
    if(d){if(cur!==d){r.cat=d;ch=true;queueSave('recipes',id);}}
    else if(cur&&(strict||!catById(cur))){delete r.cat;ch=true;queueSave('recipes',id);}
  });
  if(ch)queueSave('settings','menu');
  return ch;
}
var layTimer=null;
/* технолог правит папки: через секунду раскладка уйдёт в общую базу */
function layTouch(){
  if(S.mode!=='local'||!syAdmin()||!syLinked())return;
  S.sy.layForce=true;
  clearTimeout(layTimer);layTimer=setTimeout(function(){layTimer=null;layApply();},1200);
}
function syLayLoad(){
  return syGet({a:'lay'}).then(function(d){
    S.sy.lay=Array.isArray(d.cats)?d.cats:[];S.sy.layRev=d.rev||0;S.sy.layKnown=true;S.sy.layOld=false;
    S.sy.layArch=Array.isArray(d.arch)?d.arch:null;                /* null — скрипт старше версии 27: архив ему неизвестен */
    if(!gpBusy())S.sy.layGm=Array.isArray(d.gm)?d.gm:null;       /* пока технолог отмечает блюда, чужой старый ответ его отметки не затирает */
  },function(e){if(e&&e.err==='a')S.sy.layOld=true;});
}
/* прочитать общие папки и сверить с локальными; если меню изменилось, перерисовать */
function layRefresh(){var g0=JSON.stringify(S.sy.layGm);return syLayLoad().then(function(){var ch=layApply();if(ch||JSON.stringify(S.sy.layGm)!==g0)scheduleRender();});}
/* ---------- гостевое меню: что видят посетители без кода ----------
   Пока ручной выбор не включён (или скрипт старше версии 25), посетителям видно каждое блюдо с ценой продажи: цена сама публикует блюдо.
   Технолог может включить ручной выбор: тогда посетители видят только блюда с переключателем «Показывать посетителям» (и только там, где указана цена),
   а папка меню на показ не влияет. Список блюд (общие ид) лежит в скрипте рядом с папками меню: S.sy.layGm (null — ручной выбор не включён). Правит его только технолог;
   отметки уходят в скрипт «добавить / убрать», поэтому два технолога не затирают друг другу списки. */
var gpTimer=null,gpMemo={a:null,s:null};
function gpAdmin(){return S.mode==='local'&&syLinked()&&syAdmin()&&!NOPRICE;}
function gpNew(){return!!(S.sy.info&&Number(S.sy.info.v)>=25)&&!S.sy.layOld;}
function gpExp(){return Array.isArray(S.sy.layGm);}
function gpBusy(){var q=S.sy.gmQ;return!!(S.sy.busy.gm||(q&&(Object.keys(q.on).length||Object.keys(q.off).length)));}
function gpSet(){var a=S.sy.layGm,m;if(!Array.isArray(a))return null;if(gpMemo.a!==a){m={};a.forEach(function(x){m[x]=1;});gpMemo={a:a,s:m};}return gpMemo.s;}
/* общий ид блюда, если оно уже в общей базе; иначе пусто (посетители читают только общую базу) */
function gpSid(id){var m=S.sy.map&&S.sy.map.rec,e=m&&m[id];return(e&&e.sid&&e.rev>0)?e.sid:'';}
function gpIs(id){var s=gpSet(),sid=gpSid(id);return!!(s&&sid&&s[sid]);}
function gpPriced(r){var k=Object.keys(r.sell||{});return k.some(function(g){return g.indexOf(':')<0&&r.sell[g]>0;});}   /* гостям показывается цена региона; цена точки — только у самой точки */
var GP_WORK=/проработ|внутрен/i;                          /* то же правило GM_HOLD в скрипте */
/* почему блюдо не попадает к посетителям по умолчанию (пусто — допущено) */
function gpHide(r){
  var c;
  if(r.arch)return'в архиве';
  c=catOf(r);if(c&&GP_WORK.test(c.name))return'в папке «'+c.name+'»';
  if(!(r.output>0))return'не указан выход порции';
  return'';
}
function gpStat(){
  var s=gpSet(),st={vis:0,sel:0,work:0,arch:0,noout:0,marked:0,noprice:0};
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],sid=gpSid(id),pr=gpPriced(r),c;
    if(!sid)return;
    if(s){if(s[sid]){st.marked++;if(!pr)st.noprice++;}return;}
    if(!pr)return;
    c=catOf(r);
    if(r.arch)st.arch++;else if(c&&GP_WORK.test(c.name))st.work++;else if(!(r.output>0))st.noout++;else{st.vis++;st.sel++;}
  });
  return st;
}
function gpMerge(srv){            /* ответ скрипта плюс то, что технолог успел отметить, пока шёл запрос */
  var m={},q=S.sy.gmQ;
  srv.forEach(function(x){m[x]=1;});
  if(q){Object.keys(q.on).forEach(function(x){m[x]=1;});Object.keys(q.off).forEach(function(x){delete m[x];});}
  return Object.keys(m).sort();
}
function gpFail(e){
  S.sy.busy.gm=false;
  if(e&&e.err==='gm'){S.sy.gmQ=null;S.sy.gmErr='';layRefresh();return;}      /* ручной выбор выключили с другого компьютера */
  S.sy.gmErr=syErrText(e);scheduleRender();
}
/* включить / выключить ручной выбор или заменить список целиком */
function gpSend(extra,okMsg){
  if(!gpNew()||S.sy.busy.gm){flash('Скрипт общей базы устарел: обновите его, чтобы выбирать блюда для посетителей');return;}
  S.sy.busy.gm=true;S.sy.gmErr='';scheduleRender();
  syPost('layPut',extra,S.sy.cfg.code).then(function(r){
    S.sy.busy.gm=false;
    if(r&&r.gm===null)S.sy.layGm=null;else if(r&&Array.isArray(r.gm))S.sy.layGm=gpMerge(r.gm);
    S.sy.layRev=(r&&r.rev)||S.sy.layRev;
    if(okMsg)flash(typeof okMsg==='function'?okMsg():okMsg);
    if(gpBusy())gpSchedule();
    scheduleRender();
  },gpFail);
}
function gpEnable(){
  var ids=[];
  S.gpAsk='';
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],sid=gpSid(id),c;
    if(!sid||!gpPriced(r)||gpHide(r))return;
    ids.push(sid);
  });
  ids.sort();
  gpSend({gm:ids},function(){return'Ручной выбор включён: посетителям показано '+ids.length+' '+plural(ids.length,['блюдо','блюда','блюд']);});
}
function gpDisable(){S.gpAsk='';gpSend({gm:null},'Посетители снова видят все блюда с ценой продажи');}
/* отметить / снять отметку у блюд (локальные ид); возвращает, сколько отметок изменилось */
function gpMark(ids,on){
  var a=S.sy.layGm,q,m={},n=0;
  if(!Array.isArray(a)||!gpNew())return 0;
  q=S.sy.gmQ||(S.sy.gmQ={on:{},off:{}});
  a.forEach(function(x){m[x]=1;});
  ids.forEach(function(id){
    var sid=gpSid(id);
    if(!sid||!!m[sid]===on)return;
    if(on){m[sid]=1;q.on[sid]=1;delete q.off[sid];}else{delete m[sid];q.off[sid]=1;delete q.on[sid];}
    n++;
  });
  if(n){S.sy.layGm=Object.keys(m).sort();gpSchedule();}
  return n;
}
function gpSchedule(){clearTimeout(gpTimer);gpTimer=setTimeout(gpFlush,600);}
function gpFlush(){
  var q=S.sy.gmQ,on,off;
  clearTimeout(gpTimer);
  if(!q||S.sy.busy.gm||!gpNew())return;
  on=Object.keys(q.on);off=Object.keys(q.off);
  S.sy.gmQ=null;
  if(!on.length&&!off.length)return;
  S.sy.busy.gm=true;S.sy.gmErr='';
  syPost('layPut',{gmOn:on,gmOff:off},S.sy.cfg.code).then(function(r){
    S.sy.busy.gm=false;
    if(r&&Array.isArray(r.gm))S.sy.layGm=gpMerge(r.gm);
    S.sy.layRev=(r&&r.rev)||S.sy.layRev;
    if(gpBusy())gpSchedule();
    scheduleRender();
  },function(e){
    var q2=S.sy.gmQ||(S.sy.gmQ={on:{},off:{}});        /* не ушло: отметки остаются в очереди и уйдут при повторе */
    on.forEach(function(x){if(!q2.off[x])q2.on[x]=1;});off.forEach(function(x){if(!q2.on[x])q2.off[x]=1;});
    gpFail(e);
  });
}
function gpPanelHtml(){
  var st,h,n;
  if(!gpAdmin())return'';
  if(S.sy.layOld||(S.sy.info&&!gpNew()))return'<section class="card gppanel"><h3>Гостевое меню</h3><p class="hint" style="margin:0">Выбирать блюда для посетителей можно со скриптом общей базы версии 25: обновите скрипт по плашке «Скрипт в таблице устарел». Пока посетителям без кода видно каждое блюдо с ценой продажи.</p></section>';
  if(!S.sy.layKnown||!gpNew())return'';
  st=gpStat();
  if(!gpExp()){
    h='<section class="card gppanel"><h3>Гостевое меню</h3><p>Посетители без кода сейчас видят блюда с ценой продажи, <b>допущенные к публикации</b>: <b>'+st.vis+'</b> '+plural(st.vis,['блюдо','блюда','блюд'])+'.'
      +((st.arch||st.work||st.noout)?' Не показываются: '+[st.arch?'в архиве — '+st.arch:'',st.work?'в папках «на проработке» и внутренних — '+st.work:'',st.noout?'без выхода порции — '+st.noout:''].filter(Boolean).join('; ')+'.':'')
      +(archNew()?'':' <span class="muted">Чтобы архивные блюда не попадали к посетителям, обновите скрипт общей базы до версии 27.</span>')+'</p>';
    if(S.gpAsk==='on'){
      h+='<div class="gpask" role="alert"><p>После включения посетители увидят только отмеченные блюда. Сейчас будет отмечено <b>'+st.sel+'</b>.'
        +(st.work?' Не отмечу блюда из папок «в проработке» и внутренних: '+st.work+'.':'')+(st.arch?' Не отмечу блюда из архива: '+st.arch+'.':'')+(st.noout?' Не отмечу блюда без выхода порции: '+st.noout+'.':'')
        +' Дальше отмечайте блюда переключателем «Показывать посетителям» в каждой строке. Вернуть показ по цене можно в любой момент.</p>'
        +'<div class="btns"><button type="button" class="btn primary" data-act="gpOn">Включить ручной выбор</button><button type="button" class="btn" data-act="gpCancel">Отмена</button></div></div>';
    }else h+='<div class="btns"><button type="button" class="btn" data-act="gpAsk">Выбрать блюда вручную</button></div>';
    if(S.sy.busy.gm)h+='<p class="hint">Сохраняю…</p>';
    if(S.sy.gmErr)h+='<p class="hint cmsg warn">'+esc(S.sy.gmErr)+'</p>';
    return h+'</section>';
  }
  h='<section class="card gppanel"><h3>Гостевое меню: ручной выбор</h3><p>Посетители без кода видят блюда, у которых включено «Показывать посетителям» и указана цена продажи в их регионе. Цена и папка блюдо сами не публикуют. Отмечено блюд: <b>'+st.marked+'</b>'
    +(st.noprice?', из них без цены продажи: '+st.noprice+' (посетителям не видны)':'')+'.</p>';
  if(S.gpAsk==='off'){
    h+='<div class="gpask" role="alert"><p>Отметки будут сброшены, посетители снова увидят каждое блюдо с ценой продажи. Вернуть показ по цене?</p><div class="btns"><button type="button" class="btn primary" data-act="gpOff">Вернуть показ по цене</button><button type="button" class="btn" data-act="gpCancel">Отмена</button></div></div>';
  }else h+='<div class="btns"><button type="button" class="btn mini" data-act="gpAll">Отметить все с ценой</button><button type="button" class="btn mini" data-act="gpNone">Снять все отметки</button><button type="button" class="btn mini" data-act="gpAskOff">Вернуть показ по цене</button></div>'
    +'<p class="hint" style="margin-top:8px">«Отметить все» и «Снять все» действуют на блюда выбранного региона «'+esc(regionName(curRegion()))+'», которые сейчас в меню (архив не считается).</p>';
  if(S.sy.busy.gm||(S.sy.gmQ&&(Object.keys(S.sy.gmQ.on).length||Object.keys(S.sy.gmQ.off).length)&&!S.sy.gmErr))h+='<p class="hint">Сохраняю…</p>';
  if(S.sy.gmErr)h+='<p class="hint cmsg warn">Не сохранилось: '+esc(S.sy.gmErr)+' <button type="button" class="btn mini" data-act="gpRetry">Повторить</button></p>';
  return h+'</section>';
}
/* переключатель и пометки в строке меню */
function gpRowHtml(it){
  var id=it.id,sid,on,h='';
  if(!gpAdmin()||!S.sy.layKnown||!gpNew())return'';
  sid=gpSid(id);
  if(!gpExp()){
    if(!sid||it.m.price===null)return'';
    var why=gpHide(S.recipes[id]);
    return why?'<span class="gptag warn" title="По умолчанию посетителям не показываются блюда из архива, из папок «на проработке» и без выхода порции">не показывается посетителям: '+esc(why)+'</span>':'<span class="gptag" title="Посетители без кода видят блюдо: у него указана цена продажи и оно допущено к публикации">видно посетителям</span>';
  }
  on=gpIs(id);
  h='<label class="gpsw'+(on?' on':'')+'" title="'+(sid?'Показывать это блюдо посетителям без кода (если указана цена продажи)':'Блюда ещё нет в общей базе: сначала опубликуйте его')+'"><input type="checkbox" data-act="gpTog" data-fk="gp:'+esc(id)+'"'+(on?' checked':'')+(sid?'':' disabled')+'> Показывать посетителям</label>';
  if(!sid)h+='<span class="gptag warn">ещё не в общей базе</span>';
  else if(on&&it.m.price===null)h+='<span class="gptag warn">цены продажи нет — посетителям региона не видно</span>';
  return h;
}
function layPush(cats,now){
  var c=S.sy.cfg;
  S.sy.layForce=false;S.sy.busy.lay=true;
  syPost('layPut',{cats:cats},c.code).then(function(r){
    S.sy.busy.lay=false;c.layLs=now;S.sy.lay=cats;S.sy.layRev=r.rev||S.sy.layRev;S.sy.layErr='';syPersist();
  },function(e){
    S.sy.busy.lay=false;
    if(e&&e.err==='op'){S.sy.layOld=true;return;}
    S.sy.layForce=true;S.sy.layErr=syErrText(e);scheduleRender();
  });
}
/* сверка локальных и общих папок; вызывается после чтения общей базы, после обновления и после правки папок технологом */
function layApply(){
  var r=layApply0();layArchSchedule();return r;
}
function layApply0(){
  if(S.mode!=='local'||!syLinked()||!S.sy.layKnown||S.sy.layOld||S.sy.busy.lay)return false;
  var c=S.sy.cfg,remote=S.sy.lay||[],rs=laySig(remote);
  if(syAdmin()){
    if(S.sy.layForce){                              /* технолог правил папки: его раскладка главная */
      var cats=layBuild(),now=laySig(cats);
      if(now===rs){S.sy.layForce=false;if(c.layLs!==rs){c.layLs=rs;syPersist();}return false;}
      layPush(cats,now);return false;
    }
    var ch=layFill(remote),cats2=layBuild(),now2=laySig(cats2);
    if(now2===rs){if(c.layLs!==rs){c.layLs=rs;syPersist();}return ch;}
    if(rs!==c.layLs&&!(c.layLs===undefined&&!remote.length)){   /* общие папки изменены с другого компьютера (или это первое подключение): берём их */
      ch=layMirror(remote,false)||ch;c.layLs=rs;syPersist();return ch;
    }
    layPush(cats2,now2);                            /* общие папки не менялись, а у технолога появилось новое (например, опубликованные блюда) */
    return ch;
  }
  var on=remote.length>0?1:0,ch2=false;
  if(on)ch2=layMirror(remote,true);
  if(c.laySh!==on||c.layLs!==rs){c.laySh=on;c.layLs=rs;syPersist();ch2=true;}
  return ch2;
}
function catById(id){var l=menuCats(),i;for(i=0;i<l.length;i++)if(l[i].id===id)return l[i];return null;}
function catOf(r){return(r&&r.cat)?catById(r.cat):null;}
function catNameTaken(nm,exceptId){var k=normKey(nm);return!!k&&menuCats().some(function(c){return c.id!==exceptId&&normKey(c.name)===k;});}
function catOptionsHtml(cur){
  return'<option value="">Без папки</option>'+menuCats().map(function(c){return'<option value="'+esc(c.id)+'"'+(c.id===cur?' selected':'')+'>'+esc(c.name)+'</option>';}).join('');
}
function setRecCat(id,catId){
  var r=S.recipes[id];if(!r)return;
  if(catId&&catById(catId))r.cat=catId;else delete r.cat;
  queueSave('recipes',id);layTouch();
}
function setRecArch(id,on){
  var r=S.recipes[id],sid;if(!r)return;
  if(on)r.arch=true;else delete r.arch;
  queueSave('recipes',id);
  sid=gpSid(id);
  if(sid&&archNew()&&syAdmin()){var q=S.sy.archQ||(S.sy.archQ={on:{},off:{}});if(on){q.on[sid]=1;delete q.off[sid];}else{q.off[sid]=1;delete q.on[sid];}layArchSchedule();}
}
/* архив блюд уходит в общую базу вместе с папками меню: по умолчанию такие блюда посетителям не показываются (скрипт версии 27) */
var layArchTimer=null;
function archNew(){return Array.isArray(S.sy.layArch)&&!S.sy.layOld&&!!(S.sy.info&&Number(S.sy.info.v)>=27);}
function layArchSchedule(){
  if(S.mode!=='local'||!syLinked()||!syAdmin()||!S.sy.layKnown||!archNew()||layArchTimer)return;
  layArchTimer=setTimeout(function(){layArchTimer=null;layArchFlush();},1500);
}
function layArchFlush(){
  var q=S.sy.archQ||(S.sy.archQ={on:{},off:{}}),srv={},on={},off={},sent;
  if(!archNew()||!syAdmin()||S.sy.busy.arch)return;
  S.sy.layArch.forEach(function(x){srv[x]=1;});
  Object.keys(S.recipes).forEach(function(id){var sid=gpSid(id);if(sid&&S.recipes[id].arch&&!srv[sid])on[sid]=1;});      /* то, что уже в архиве у технолога, а в базе ещё нет */
  Object.keys(q.on).forEach(function(x){if(!srv[x])on[x]=1;});
  Object.keys(q.off).forEach(function(x){if(srv[x])off[x]=1;});
  if(!Object.keys(on).length&&!Object.keys(off).length){S.sy.archQ={on:{},off:{}};return;}
  sent={on:q.on,off:q.off};S.sy.archQ={on:{},off:{}};S.sy.busy.arch=true;
  syPost('layPut',{archOn:Object.keys(on),archOff:Object.keys(off)},S.sy.cfg.code).then(function(r){
    S.sy.busy.arch=false;if(r&&Array.isArray(r.arch))S.sy.layArch=r.arch;S.sy.layRev=(r&&r.rev)||S.sy.layRev;
    if(Object.keys(S.sy.archQ.on).length||Object.keys(S.sy.archQ.off).length)layArchSchedule();scheduleRender();
  },function(e){
    S.sy.busy.arch=false;
    Object.keys(sent.on).forEach(function(x){if(!S.sy.archQ.off[x])S.sy.archQ.on[x]=1;});Object.keys(sent.off).forEach(function(x){if(!S.sy.archQ.on[x])S.sy.archQ.off[x]=1;});
    if(e&&e.err==='op')S.sy.layOld=true;
  });
}
function abIds(){return visIds().filter(function(id){return!S.recipes[id].arch;});}
function abMap(g){var m={};visIds(g).forEach(function(id){if(!S.recipes[id].arch)m[id]=S.recipes[id];});return m;}
/* активное блюдо должно быть видно в текущем регионе: иначе берём то же блюдо региона или первое */
function fixActive(){
  var ids=visIds();
  if(S.active&&S.recipes[S.active]&&ids.indexOf(S.active)>-1)return;
  var keep=(S.active&&S.recipes[S.active])?recKey(S.recipes[S.active]):'',pick='';
  if(keep)ids.forEach(function(id){if(!pick&&recKey(S.recipes[id])===keep)pick=id;});
  if(!pick)ids.forEach(function(id){if(!pick&&!S.recipes[id].arch)pick=id;});
  setActive(pick||ids[0]||null);
}
/* новая карта, в которую ничего не внесли, при возврате на стартовый экран не остаётся пустой записью */
function ttkDropDraft(){
  var id=S.newDraft;S.newDraft=null;
  var r=id&&S.recipes[id];
  if(!r)return;
  var blank=r.name==='Новое блюдо'&&r.output===100&&r.rows.every(function(x){return!x.ing&&!x.pf&&!(x.net>0)&&!x.tname;})&&!Object.keys(r.ttk||{}).length&&!r.sell&&!r.qty&&!r.cat;
  if(!blank)return;
  syForgetRec(id);removeDoc('recipes',id);
  if(S.active===id){S.active=null;fixActive();}
}
function nameTaken(nm){var k=normKey(nm);return!!k&&Object.keys(S.recipes).some(function(id){return normKey(S.recipes[id].name)===k;});}
/* ---------- регионы цен ---------- */
function regionList(){var r=S.cfg.regions;return acFilter((r&&r.list)?r.list:DEFAULT_REGIONS);}
function curRegion(){var l=regionList(),i;for(i=0;i<l.length;i++)if(l[i].id===S.region)return S.region;for(i=0;i<l.length;i++)if(l[i].id===MAIN)return MAIN;return l.length?l[0].id:MAIN;}
function regionName(id){var l=regionList(),i,c=String(id||'').indexOf(':');if(c>0){var pt=(typeof drPt==='function'&&S.dr)?drPt(String(id).slice(c+1)):null;return regionName(String(id).slice(0,c))+' · '+(pt?pt.name:'точка');}for(i=0;i<l.length;i++)if(l[i].id===id)return l[i].name||l[i].id;return id;}
function setRegion(id){S.region=id;lsSet('kbzhu:region',id);}
function ensureRegions(){if(!S.cfg.regions)S.cfg.regions={list:DEFAULT_REGIONS.map(function(g){return{id:g.id,name:g.name};})};return S.cfg.regions.list;}
function saveRegions(){queueSave('settings','regions');renderRegionSel();}
function renderRegionSel(){
  var sel=$('#regionSel'),box=$('#regionBox');if(!sel)return;
  var cur=curRegion(),l=regionList();
  var sig=cur+'|'+l.map(function(g){return g.id+':'+g.name;}).join('|');
  if(sel.getAttribute('data-sig')!==sig){
    sel.innerHTML=l.map(function(g){return'<option value="'+esc(g.id)+'"'+(g.id===cur?' selected':'')+'>'+esc(g.name||g.id)+'</option>';}).join('');
    sel.setAttribute('data-sig',sig);
  }
  box.style.display=(l.length>1&&!guestOn())?'':'none';
  var rl=box.querySelector('span');if(rl)rl.textContent=NOPRICE?'Регион':'Цены региона';
  drCtxRender();
}
/* запись о цене в регионе для правки: у основного региона это само сырьё */
function recFor(ing,region,create){
  if(region===MAIN)return ing;
  if(!ing.px){if(!create)return null;ing.px={};}
  if(!ing.px[region]){if(!create)return null;ing.px[region]={};}
  return ing.px[region];
}
function pruneRec(ing,region){
  if(region===MAIN||!ing.px)return;
  if(ing.px[region]&&!Object.keys(ing.px[region]).length)delete ing.px[region];
  if(!Object.keys(ing.px).length)delete ing.px;
}

