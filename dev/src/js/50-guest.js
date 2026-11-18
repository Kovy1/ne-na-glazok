/* ----- экран до входа: только меню с ценами продажи; данные открыты по ссылке (действие «menu» скрипта), состава и закупочных цен в них нет ----- */
var GM={d:null,busy:false,at:0,cat:0,err:'',reg:'',q:'',f:'all'};
/* файл привязан к общей базе (адрес вшит или задан), а код ещё не введён или не подошёл */
function guestOn(){return S.mode==='local'&&!syLinked()&&!!(S.sy.cfg.url||syBakedUrl()||syPtrLink());}
function gmInit(){try{var c=JSON.parse(lsGet('kbzhu:gmenu')||'null');if(c&&c.d&&Array.isArray(c.d.items)){GM.d=c.d;GM.cat=c.at||0;}}catch(e){}}
function gmLoad(force){
  if(!guestOn()||GM.busy)return Promise.resolve();
  if(!force&&Date.now()-GM.at<60000)return Promise.resolve();
  GM.busy=true;GM.at=Date.now();
  return syFreshAddr(false).then(function(){
    var u=S.sy.cfg.url||syBakedUrl();
    if(!u)throw{code:'url'};
    return jsonpGet(u+(u.indexOf('?')>-1?'&':'?')+'a=menu&callback=__CB__',20000);
  }).then(function(d){
    if(!d||d.ok===false){GM.err=(d&&d.err==='a')?'old':'net';return;}
    GM.d=d;GM.err='';GM.cat=Date.now();lsSet('kbzhu:gmenu',JSON.stringify({d:d,at:GM.cat}));
  }).catch(function(){GM.err='net';}).then(function(){GM.busy=false;upBarUpdate();if(guestOn()&&S.tab==='menu')scheduleRender();});
}
function gmRegId(){
  var regs=(GM.d&&GM.d.regs)||[],want=GM.reg||lsGet('kbzhu:region')||'',i;
  for(i=0;i<regs.length;i++)if(regs[i].id===want)return want;
  return regs.length?regs[0].id:'main';
}
function gmItems(){
  var d=GM.d,g=gmRegId(),own={},q=normKey(GM.q||''),out=[];
  if(!d)return out;
  d.items.forEach(function(x){if(x.g===g)own[normKey(x.n)]=1;});
  d.items.forEach(function(x){
    if(x.g?x.g!==g:own[normKey(x.n)])return;
    if(!(x.p&&x.p[g]>0))return;
    if(q&&(normKey(x.n)+' '+String(x.t||'')).indexOf(q)<0)return;
    if(GM.f==='ds'&&!dsValid(gmDs(x,g)))return;
    if(GM.f==='nods'&&dsValid(gmDs(x,g)))return;
    out.push(x);
  });
  out.sort(function(a,b){return String(a.n).localeCompare(String(b.n),'ru');});
  return out;
}
/* декларация о соответствии у блюда (скрипт версии 31 отдаёт номер и срок по регионам) */
function gmDs(x,g){var d=x&&x.d&&x.d[g];return d?{g:'',n:String(d.n||''),v:d.v||''}:null;}
function gmDsBadge(x,g){var d=gmDs(x,g);return d?' <span class="'+dsCls(d)+'" title="'+esc(dsTitle(d).replace(': группа не указана',''))+'">'+(dsExpired(d)?'ДС истекла':'ДС')+'</span>':'';}
function gmDsChips(){
  var d=GM.d,g=gmRegId(),f0=GM.f,all,n,dn=0;
  if(!d||!d.items.some(function(x){return x.d;}))return'';
  GM.f='all';all=gmItems();GM.f=f0;n=all.length;
  all.forEach(function(x){if(dsValid(gmDs(x,g)))dn++;});
  function chip(k,l,c){return'<button class="chip" data-act="gmF" data-f="'+k+'" aria-pressed="'+(GM.f===k)+'">'+l+' · '+c+'</button>';}
  return'<div class="chips" style="margin:0 0 10px">'+chip('all','Все',n)+chip('ds','Задекларировано',dn)+chip('nods','Без декларации',n-dn)+'</div>';
}
/* Excel для меню на доставку: показанные блюда с ценами и декларацией */
function gmXlsxTable(){
  var g=gmRegId(),list=gmItems(),regs=(GM.d&&GM.d.regs)||[],rn=g,i;
  for(i=0;i<regs.length;i++)if(regs[i].id===g)rn=regs[i].name||g;
  return{name:'Меню',title:'Меню · регион «'+rn+'»'+(GM.f==='ds'?' · задекларированные блюда':(GM.f==='nods'?' · без декларации':'')),
    note:'Выгружено '+todayRu()+'. Блюд: '+list.length+'. Цены продажи региона «'+rn+'».',
    head:['Блюдо','ТТК №','Выход порции, г','Цена продажи, ₽','Декларация о соответствии','Декларация действует по'],fmt:['text','text','g','money','text','text'],widths:[260,70,90,100,200,110],
    rows:list.map(function(x){var d=gmDs(x,g);return[x.n,x.t||'',x.o>0?x.o:'',x.p[g],d?(d.n||'да, номер не указан')+(dsExpired(d)?' (срок истёк)':''):'',d&&d.v?dsIsoRu(d.v):''];})};
}
function gmRowHtml(x,g){
  var pr=x.p[g],sub=[];
  if(x.t)sub.push('ТТК № '+x.t);
  if(x.o>0)sub.push(fmt(x.o,0)+' г');
  return'<div class="gmrow"><div class="gmn"><b>'+esc(x.n)+gmDsBadge(x,g)+'</b>'+(sub.length?'<span class="gmsub">'+esc(sub.join(' · '))+'</span>':'')+'</div><div class="gmp">'+fmt(pr,pr%1?2:0)+'\u00a0₽</div></div>';
}
function gmListHtml(){
  var list=gmItems(),d=GM.d,g=gmRegId(),cats=(d&&d.cats)||[],bySid={},used={},h='';
  if(!d){
    if(GM.busy)return'<p class="muted">Загружаю меню…</p>';
    return'<p class="hint cmsg warn" style="margin:0">'+(GM.err==='old'?'Меню без входа пока недоступно: технолог должен обновить скрипт общей базы. Войдите по коду.':'Не удалось загрузить меню. Проверьте интернет.')+'</p>'
      +(GM.err==='old'?'':'<div class="btns" style="margin-top:10px"><button class="btn" data-act="gmRetry">Повторить</button></div>');
  }
  if(!list.length)return'<p class="muted">'+(GM.q?'Ничего не найдено. Измените поиск.':(d.exp?'Технолог пока не выбрал блюда для гостевого меню.':'Блюд с ценой продажи в этом регионе пока нет.'))+'</p>';
  list.forEach(function(x){bySid[x.s]=x;});
  cats.forEach(function(c){
    var rows=(c.r||[]).map(function(sid){return bySid[sid];}).filter(function(x){return x&&!used[x.s];});
    if(!rows.length)return;
    rows.forEach(function(x){used[x.s]=1;});
    h+='<h3 class="gmcat">'+esc(c.n)+' · '+rows.length+'</h3>'+rows.map(function(x){return gmRowHtml(x,g);}).join('');
  });
  var rest=list.filter(function(x){return!used[x.s];});
  if(rest.length)h+=(cats.length?'<h3 class="gmcat">Другое · '+rest.length+'</h3>':'')+rest.map(function(x){return gmRowHtml(x,g);}).join('');
  return h;
}
function gmPaint(){var el=$('#gmList');if(el)el.innerHTML=gmListHtml();}
function viewGuest(){
  var d=GM.d,regs=(d&&d.regs)||[],g=gmRegId(),rn=g,i;
  for(i=0;i<regs.length;i++)if(regs[i].id===g)rn=regs[i].name||g;
  return'<section class="card gmcard"><div class="gmtop"><div><h2>Меню</h2><p class="hint" style="margin:0">Цены продажи'+(regs.length>1?' региона «'+esc(rn)+'»':'')+'. Остальные разделы откроются после входа по коду.</p></div>'
    +(regs.length>1?'<label class="field w180"><span class="lbl">Регион</span><select data-act="gmReg" data-fk="gmreg">'+regs.map(function(r){return'<option value="'+esc(r.id)+'"'+(r.id===g?' selected':'')+'>'+esc(r.name||r.id)+'</option>';}).join('')+'</select></label>':'')+'</div>'
    +'<div class="tools"><label class="field grow"><span class="lbl">Поиск по названию или номеру ТТК</span><input id="gmsearch" data-act="gmQ" data-fk="gmsearch" autocomplete="off" value="'+esc(GM.q)+'"></label></div>'
    +gmDsChips()
    +'<div id="gmList">'+gmListHtml()+'</div>'
    +'<div class="btns" style="margin-top:14px"><button class="btn primary" data-act="gmLogin">Войти по коду</button>'+(GM.d&&canDl()?'<button class="btn" data-act="gmXlsx" title="Показанные блюда с ценами и декларацией: для меню на доставку">Скачать Excel</button>':'')+'</div></section>';
}
