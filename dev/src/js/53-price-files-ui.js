/* ---------- файлы цен по регионам на Google Диске ---------- */
function pfFresh(){return{list:null,busy:false,arch:{},archBusy:{}};}
function pfCtxFor(g){
  return{region:g,ings:S.ings,recipes:S.recipes,ids:visIds(g).filter(function(id){return!S.recipes[id].arch;}),cats:menuCats(),batches:phMerge(phList(S.cfg,g)),
    num:function(r){return String(ttkVal(r,'num')||'');}};
}
/* файлы пишет только технолог из браузера, где есть цены; остальные коды файлы только читают */
function pfCanRun(){return S.mode==='local'&&!!S.sy.cfg.url&&syLinked()&&syAdmin()&&!NOPRICE&&S.loaded.ingredients&&S.loaded.recipes;}
function pfScriptOk(){return!!(S.sy.info&&(S.sy.info.v||0)>=5);}
var pfTimer=null;
/* автоматическое обновление: через паузу после последней правки (и после публикации/приёма), если что-то изменилось по сравнению с файлами на Диске */
function pfSchedule(ms){
  if(!pfCanRun()||S.sy.cfg.pfAuto===false)return;
  clearTimeout(pfTimer);
  pfTimer=setTimeout(function(){pfRun(false,true);},ms||5000);
}
function pfOne(rg,force,at){
  var g=rg.id,d=pfData(pfCtxFor(g)),T=pfTables(d,rg.name,at);
  /* h: скрипт сам отвечает «то же», если хэш совпал, и таблиц не читает; при принудительном обновлении читаем прежнее состояние, чтобы не потерять журнал */
  return syGet({a:'pprev',reg:g,h:force?'':T.hash},60000).then(function(pv){
    if(pv.same&&!force)return{id:g,name:rg.name,same:true};
    pfWithLogs(T,pfDiff(d,pv,at),pv);
    var body={region:{id:g,name:rg.name},hash:T.hash,pub:T.pub,prv:T.prv,xlsxPub:bufToB64(xlsxPack(T.pub)),xlsxPrv:bufToB64(xlsxPack(T.prv)),
      nDishes:T.n.dishes,nSold:T.n.sold,nIngs:T.n.ings,force:!!force};
    return syPost('pricesPublish',body,undefined,100).then(function(r){return{id:g,name:rg.name,same:!!r.same,changes:T.changes||0,shared:r.shared!==false};});
  });
}
function pfRun(force,auto){
  var pf=S.sy.pf;
  if(!pfCanRun()||pf.busy)return Promise.resolve();
  pf.busy=true;
  if(!auto)syMsg('pf','busy','Обновляю файлы цен на Диске…');
  pfPaint();
  var ready=S.sy.info?Promise.resolve():syGet({a:'ping'}).then(function(i){S.sy.info=i;});
  return ready.then(function(){
    if(!pfScriptOk())throw{code:'old'};
    var at=Date.now(),res=[];
    return regionList().slice().reduce(function(p,rg){return p.then(function(){return pfOne(rg,force,at).then(function(x){res.push(x);});});},Promise.resolve()).then(function(){return res;});
  }).then(function(res){
    pf.busy=false;
    var upd=res.filter(function(x){return!x.same;}),warn=res.some(function(x){return x.shared===false;}),note=null;
    if(upd.length){
      note=[warn?'warn':'ok','Файлы цен обновлены: '+upd.map(function(x){return x.name;}).join(', ')+' · '+nowHm()+'.'+(function(n){return n?' Новых записей в журнале изменений: '+n+'.':'';})(upd.reduce(function(a,x){return a+(x.changes||0);},0))
        +(warn?' Google не дал открыть ссылку на цены продажи: откройте файл на Диске и включите доступ «все, у кого есть ссылка», чтение.':'')];
    }else if(!auto)note=['ok','Файлы цен актуальны: изменений нет · '+nowHm()+'.'];
    /* сообщение — после обновления списка файлов: так блок уже полный, когда человек (или проверка) его видит */
    return syGet({a:'prices'}).then(function(d){pf.list=d.regions;},function(){}).then(function(){if(note)syMsg('pf',note[0],note[1]);});
  }).catch(function(e){
    pf.busy=false;
    if(e&&e.code==='old')syMsg('pf','err','В таблице стоит прежняя версия скрипта, она не ведёт файлы цен. Вставьте новый скрипт (кнопка «Настройка скрипта» выше) и создайте новую версию развёртывания: Развернуть → Управление развёртываниями → Новая версия.');
    else syMsg('pf','err','Файлы цен не обновились: '+syErrText(e));
  }).then(function(){pfPaint();});
}
function pfLoad(){
  if(!syLinked()||S.mode!=='local')return Promise.resolve();
  return syGet({a:'prices'}).then(function(d){S.sy.pf.list=d.regions;},function(){S.sy.pf.list=S.sy.pf.list||[];}).then(pfPaint);
}
function pfSafeUrl(u){u=String(u||'');return/^https:\/\/(docs|drive)\.google\.com\//.test(u)?u:'';}
function pfArchLoad(reg){
  var pf=S.sy.pf;
  if(pf.archBusy[reg])return;
  pf.archBusy[reg]=true;pfPaint();
  syGet({a:'parch',reg:reg},60000).then(function(d){pf.arch[reg]=d.files;},function(e){syMsg('pf','err','Архив не открылся: '+syErrText(e));}).then(function(){pf.archBusy[reg]=false;pfPaint();});
}
function pfDownload(id,name,btn){
  if(!id||(btn&&btn.disabled))return;
  var old=btn?btn.textContent:'';
  if(btn){btn.disabled=true;btn.textContent='Загружаю…';}
  syGet({a:'pfile',id:id},90000).then(function(d){
    exportFile(new Uint8Array(b64ToBuf(d.b64)),name||d.name);
  },function(e){syMsg('pf','err','Файл не скачался: '+syErrText(e));}).then(function(){if(btn){btn.disabled=false;btn.textContent=old;}});
}
function pfBtn(act,label,attrs,cls){return'<button class="btn mini'+(cls?' '+cls:'')+'" data-act="'+act+'" '+attrs+'>'+label+'</button>';}
function pfLink(url,label){url=pfSafeUrl(url);return url?'<a class="btn mini" href="'+esc(url)+'" target="_blank" rel="noopener">'+label+'</a>':'';}
function pfArchHtml(x){
  var pf=S.sy.pf,pr=syPriceRole(S.sy.cfg.role),files=pf.arch[x.id];
  if(pf.archBusy[x.id])return'<p class="hint">Открываю архив…</p>';
  if(!files)return'';
  if(!files.length)return'<p class="hint">В архиве пока ничего нет.</p>';
  var by={},ms=[];
  files.forEach(function(f){if(!by[f.ym]){by[f.ym]=[];ms.push(f.ym);}by[f.ym].push(f);});
  return'<div class="pfarch">'+ms.map(function(m){
    return'<div class="pfam"><b>'+esc(m)+'</b>'+by[m].map(function(f){
      return pfBtn('pfDl',(f.k==='prv'?'Себестоимость и закупка':'Цены продажи')+' (Excel)','data-id="'+esc(f.id)+'" data-name="'+esc(f.name)+'"');
    }).join('')+'</div>';
  }).join('')+'</div>';
}
function pfRegHtml(x){
  var pr=syPriceRole(S.sy.cfg.role),adm=syAdmin(),n=x.n||{},pub=x.pub||{},prv=x.prv||null,h;
  h='<div class="pfreg"><b>'+esc(x.name)+'</b><small>Обновлено '+esc(syWhen(x.at))+(x.by?', '+esc(x.by):'')+' · блюд с ценой продажи: '+(n.sold||0)+(pr?' · сырья с ценой: '+(n.ings||0):'')+'</small>';
  if(x.shared===false)h+='<p class="hint cmsg warn">Ссылка на файл с ценами продажи закрыта: Google не дал открыть её скрипту. '+(adm?'Откройте файл на Диске и включите доступ «все, у кого есть ссылка», чтение.':'Сообщите технологу.')+'</p>';
  h+='<div class="btns">'
    +pfLink(pub.sheet,'Цены продажи: Google Таблица')
    +(pfSafeUrl(pub.sheet)?pfBtn('pfCopy','Копировать ссылку','data-url="'+esc(pfSafeUrl(pub.sheet))+'"'):'')
    +(pub.x?pfBtn('pfDl','Цены продажи: Excel','data-id="'+esc(pub.x)+'" data-name="'+esc(pub.xn||'')+'"'):'')
    +(prv&&prv.x?pfBtn('pfDl','Себестоимость и закупка: Excel','data-id="'+esc(prv.x)+'" data-name="'+esc(prv.xn||'')+'"'):'')
    +(prv&&prv.sheet?pfLink(prv.sheet,'Себестоимость: Google Таблица'):'')
    +(adm?pfLink(x.folder,'Папка на Диске'):'')
    +pfBtn('pfArch','Архив по месяцам','data-reg="'+esc(x.id)+'"')
    +'</div>'+pfArchHtml(x)+'</div>';
  return h;
}
function pfInner(){
  var pf=S.sy.pf,role=S.sy.cfg.role,pr=syPriceRole(role),adm=syAdmin(),h='<h2>Файлы цен по регионам</h2>';
  h+='<p class="hint" style="margin-top:0">У каждого региона своя папка на Диске: <b>цены продажи</b> блюд (открыты по ссылке) и закрытый файл <b>«Себестоимость и закупка»</b>'+(pr?' (его отдаёт калькулятор по коду)':' (откроется после подключения с кодом)')+'. Копия за каждый месяц лежит в «Архиве».</p>';
  if(adm){
    h+='<label class="trem"><input type="checkbox" data-act="pfAuto" data-fk="pf:auto"'+(S.sy.cfg.pfAuto===false?'':' checked')+'>Обновлять файлы автоматически: через минуту после изменения цен, блюд и после публикации в общую базу</label>'
      +'<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="pfRun"'+(pf.busy?' disabled':'')+'>'+(pf.busy?'Обновляю…':'Обновить файлы цен сейчас')+'</button></div>';
    if(S.sy.info&&!pfScriptOk())h+='<p class="hint cmsg warn">В таблице стоит прежняя версия скрипта: файлы цен она не ведёт. Вставьте новый скрипт («Настройка скрипта») и создайте новую версию развёртывания: Развернуть → Управление развёртываниями → Новая версия.</p>';
  }
  h+=syMsgHtml('pf');
  var l=pf.list;
  if(l===null)h+='<p class="hint">Загружаю список файлов…</p>';
  else if(!l.length)h+='<p class="hint">Файлов цен пока нет. '+(adm?'Они появятся после первого обновления: нажмите кнопку выше.':'Технолог ещё не создавал их.')+'</p>';
  else h+=l.map(pfRegHtml).join('');
  return h;
}
function pfPaint(){var el=$('#pfBox');if(el)el.innerHTML=pfInner();}
/* копия своих данных на Диске и файлы цен по регионам: нужны редко и от плашки обновлений не зависят, поэтому свёрнуты в конце страницы */
function sySvcHtml(){
  var bk=!syChef();
  return'<details class="pgroup svc" id="sySvc"'+(S.sy.svcOpen?' open':'')+'><summary>'+(bk?'Служебное: копия моих данных на Диске и файлы цен':'Служебное: файлы цен')+'</summary>'+(bk?syBkHtml():'')+syPricesHtml()+'</details>';
}
function syPricesHtml(){return'<section class="card" id="pfBox">'+pfInner()+'</section>';}
function pfStart(){
  if(syLinked()&&syAdmin())pfSchedule(12000);
}
