/* ---------- rendering ---------- */
function captureFocus(){
  var a=document.activeElement;
  if(a&&a.getAttribute&&a.getAttribute('data-fk')&&$('#view').contains(a)){
    var s=null,e=null;try{s=a.selectionStart;e=a.selectionEnd;}catch(x){}
    return{fk:a.getAttribute('data-fk'),s:s,e:e};
  }
  return null;
}
function restoreFocus(k){
  if(S.focusFk){k={fk:S.focusFk,s:null,e:null};S.focusFk=null;}
  if(!k)return;
  var el=$('[data-fk="'+k.fk.replace(/"/g,'\\"')+'"]');
  if(!el)return;
  el.focus();
  if(S.focusSel){S.focusSel=0;try{el.select();}catch(x){}return;}
  try{if(k.s!==null&&el.setSelectionRange)el.setSelectionRange(k.s,k.e);}catch(x){}
}
function renderTabs(){
  $$('.tab').forEach(function(b){var t=b.getAttribute('data-tab');b.setAttribute('aria-selected',(t===S.tab||(t==='calc'&&S.tab==='cloud'))?'true':'false');});
  $('#tabBase').innerHTML='Сырьё и КБЖУ'+(S.loaded.ingredients?'<span class="tdot"> · </span><span class="tcnt">'+Object.keys(S.ings).length+'</span>':'');
  var th=$('#tabHome');if(th)th.hidden=guestOn()||!tabOk('home');
  var tm=$('#tabMenu'),ta=$('#tabAbc'),to=$('#tabOp1'),tk=$('#tabCalc');
  if(syMgr())$('#tabBase').textContent='Цены сырья';
  if(tm)tm.textContent=NOPRICE?'Меню':'Меню и цены';
  if(ta)ta.hidden=NOPRICE||!tabOk('abc');
  if(to)to.hidden=true;
  if(tk){tk.hidden=!(tabOk('calc')||ttkCloudOn());tk.setAttribute('data-cloud',ttkCloudOn()?'1':'0');}
  var tb=$('#tabBase');if(tb)tb.hidden=!tabOk('base');
  var tfc=$('#tabFc');if(tfc)tfc.hidden=!(S.mode==='local'&&!guestOn()&&!NOPRICE&&tabOk('fc'));
  var tr=$('#tabRev'),td=$('#tabDir');
  if(tr)tr.hidden=!(S.mode==='local'&&!guestOn()&&tabOk('rev'));
  if(td)td.hidden=!(S.mode==='local'&&!guestOn()&&tabOk('dir'));
  var ts=$('#tabSync');
  setTimeout(navFit,0);
  if(ts){ts.hidden=S.mode!=='local';ts.textContent=guestOn()?'Вход':'Личный кабинет'+((syLinked()&&S.sy.info&&S.sy.info.pending)?' · '+S.sy.info.pending:'')+((syInboxOn()&&S.sy.inbox&&S.sy.inbox.length)?' · вернули: '+S.sy.inbox.length:'');}
}
/* «ТТК» — одна вкладка: внутри «Мои ТТК» (создание и правка) и «ТТК в облаке» (готовые файлы). Шеф-повару расчёт не нужен: у него сразу облако */
function ttkCloudOn(){return syFilesOn()&&tabOk('cloud');}
function ttkCloudLabel(){var np=syAdmin()?syPendFiles():0;return'ТТК в облаке'+(np?' · '+np:'');}
/* в облаке (список файлов): только возврат на стартовый экран «ТТК» */
function ttkSegHtml(){
  if(!ttkCloudOn()||!tabOk('calc'))return'';
  return'<div class="bar ttkbar" id="ttkSeg"><button class="btn" id="segCalc" data-act="ttkHome" title="К выбору: создать новую или скачать из облака">‹ ТТК</button></div>';
}
/* стартовый экран вкладки «ТТК»: два действия. Открыть сохранённую карту и загрузить .docx — тихими ссылками ниже */
function ttkHomeHtml(note){
  var cl=ttkCloudOn(),n=visIds().length,np=syAdmin()?syPendFiles():0;
  return'<section class="thome" id="ttkHome"><h2>ТТК</h2><p class="lead">'+(note||'Технико-технологические карты: создайте новую или возьмите готовую из облака.')+'</p>'
    +'<div class="tbig"><button class="tbigb primary" id="ttkNew" data-act="newRecipe" data-edit><b>Создать новую</b><span>Пустая карта: состав, технология, КБЖУ и себестоимость</span></button>'
    +(cl?'<button class="tbigb" id="tabCloud" data-act="segTab" data-tab="cloud"><b>Скачать из облака</b><span>Готовые карты из общей библиотеки'+(np?' · на проверке: '+np:'')+'</span></button>'
        :'<button class="tbigb" id="ttkLoad" data-act="pickTtk" data-edit><b>Загрузить из файла</b><span>Карта в формате .docx</span></button>')
    +'</div><div class="tlinks">'
    +(n?'<button class="tlink" id="ttkSavedLink" data-act="ttkSaved">Открыть сохранённую ('+n+')</button>':'')
    +(n&&!syLimited()?(function(){var k=rdCounts(rdAll());return'<button class="tlink" id="ttkReadyLink" data-act="ttkReady">Готовность карт'+(k.all>k.ready?' · не готовы: '+(k.all-k.ready):' · все готовы')+'</button>';})():'')
    +(cl?'<button class="tlink" id="ttkLoad" data-act="pickTtk" data-edit>Загрузить файл .docx</button>':'')
    +(syLimited()?'':'<button class="tlink" id="specLoad" data-act="pickSpec" data-edit title="Отчёт 1С «Список сырья по Спецификации»: блюда с составом, ТТК можно привязать позже">Загрузить блюда из спецификации 1С</button>')
    +'</div>'+(syLimited()?'':specHomeHtml())+'</section>';
}
/* сохранённые карты: папка и блюдо; выбор сразу открывает карту */
function ttkSavedHtml(){
  var ids=visIds();
  function ropt(id){return'<option value="'+esc(id)+'">'+esc(recLabel(S.recipes[id])+(compute(S.recipes[id],S.ings).unk.length?' · КБЖУ не заполнено':'')+(S.recipes[id].spec?' · нет ТТК':''))+'</option>';}
  var idsA=ids.filter(function(id){return!S.recipes[id].arch;}),idsZ=ids.filter(function(id){return S.recipes[id].arch;});
  var cats=menuCats(),fcat=S.calcCat||'';
  if(fcat&&fcat!=='__none__'&&!catById(fcat))fcat=S.calcCat='';
  function inCat(id,f){var c=S.recipes[id].cat,has=!!(c&&catById(c));return f==='__none__'?!has:c===f;}
  var catCnt={},noCat=0;
  idsA.forEach(function(id){var c=S.recipes[id].cat;if(c&&catById(c))catCnt[c]=(catCnt[c]||0)+1;else noCat++;});
  var shownA=fcat?idsA.filter(function(id){return inCat(id,fcat);}):idsA;
  var opts;
  if(cats.length&&!fcat){
    opts=cats.map(function(c){var l=shownA.filter(function(id){return S.recipes[id].cat===c.id;});return l.length?'<optgroup label="'+esc(c.name)+'">'+l.map(ropt).join('')+'</optgroup>':'';}).join('');
    var rest=shownA.filter(function(id){var c=S.recipes[id].cat;return!(c&&catById(c));});
    if(rest.length)opts+=opts?'<optgroup label="Без папки">'+rest.map(ropt).join('')+'</optgroup>':rest.map(ropt).join('');
  }else opts=shownA.map(ropt).join('');
  if(idsZ.length)opts+='<optgroup label="В архиве">'+idsZ.map(ropt).join('')+'</optgroup>';
  var catSel=cats.length?'<label class="field w180"><span class="lbl">Папка</span><select data-act="calcCat" data-fk="calcCat" aria-label="Показать ТТК из папки"><option value="">Все папки · '+idsA.length+'</option>'
    +cats.map(function(c){return'<option value="'+esc(c.id)+'"'+(fcat===c.id?' selected':'')+'>'+esc(c.name)+' · '+(catCnt[c.id]||0)+'</option>';}).join('')
    +'<option value="__none__"'+(fcat==='__none__'?' selected':'')+'>Без папки · '+noCat+'</option></select></label>':'';
  return'<div class="bar ttkbar"><button class="btn" id="ttkBack" data-act="ttkHome" title="К выбору: создать новую или скачать из облака">‹ ТТК</button></div>'
    +'<section class="card"><h2>Сохранённые карты</h2><div class="bar" style="margin-bottom:0">'+catSel
    +'<label class="field grow"><span class="lbl">Блюдо</span><select id="recipeSel" data-act="pickRecipe" data-fk="recipeSel"><option value="">Выберите карту…</option>'+opts+'</select></label></div></section>';
}
/* ---------- готовность карт: что мешает проверить карту ---------- */
/* масса из названия блюда: «Булгур с овощами 250 гр» → 250; «Борщ 250/30 г» → 280 (сумма частей); «Пюре 1/150гр» → 150 (1 порция). Предложение только для подтверждения */
function outFromName(name){
  var s=String(name||'').replace(/\(\s*ТТК[^)]*\)/ig,' '),m=/(\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*)\s*(?:г|гр|грамм)\.?(?![а-яёa-z])/ig,x,last=null,nums,sum;
  while((x=m.exec(s)))last=x;
  if(!last)return null;
  nums=last[1].split('/').map(function(t){return parseFloat(t.replace(',','.').replace(/\s/g,''));}).filter(function(v){return isFinite(v)&&v>0;});
  if(nums.length>1&&nums[0]===1)nums.shift();
  sum=nums.reduce(function(a,b){return a+b;},0);
  if(!(sum>0)||sum>5000)return null;
  return{v:Math.round(sum*100)/100,src:last[0].trim(),parts:nums};
}
/* Проверка выхода: подозрения, не приговор. Карты автоматически не правятся: выход может быть выходом партии или нормой для другой порции.
   Технолог либо подтверждает выход как есть, либо принимает исправление. Выход в карте нормативный (из ТТК), не результат контрольного взвешивания. */
function rdOutCheck(r){
  var w=[],out=r.output,t=r.ttk||{};
  if(!(out>0))return w;
  if(t.outOk&&Math.abs(Number(String(t.outOk).replace(',','.'))-out)<0.005)return w;      /* подтверждено технологом именно для этого значения */
  var nm=outFromName(r.name),nv=nm?nm.v:0,near=function(a,b,tol){return b>0&&Math.abs(a-b)/b<=tol;},u=false;
  if(out>=10000||(nv&&near(out/1000,nv,0.02))){
    w.push({k:'unit',txt:'Выход '+dnum(out,2)+' г: похоже на ошибку пересчёта граммов и килограммов'+(nv?' (в названии '+dnum(nv,2)+' г)':'')+'. Возможно, верно '+dnum(out/1000,2)+' г.',fix:Math.round(out/10)/100});u=true;
  }else if(nv&&out<=20&&near(out*1000,nv,0.02)){
    w.push({k:'unit',txt:'Выход '+dnum(out,2)+' г: похоже, килограммы записаны как граммы (в названии '+dnum(nv,2)+' г). Возможно, верно '+dnum(out*1000,2)+' г.',fix:Math.round(out*1000*100)/100});u=true;
  }
  if(!u){
    if(nv){
      var ratio=out/nv,k=Math.round(ratio);
      if(near(out,nv,0.05)){/* совпадает с названием */}
      else if(k>=2&&k<=24&&near(ratio,k,0.03))w.push({k:'batch',n:k,txt:'Выход '+dnum(out,2)+' г в '+k+' раза больше массы в названии ('+dnum(nv,2)+' г). Это выход партии из '+k+' порций или одной порции? Расчёт на порцию зависит от этого.'});
      else w.push({k:'name',txt:'Выход '+dnum(out,2)+' г не совпадает с массой в названии ('+dnum(nv,2)+' г).',fix:nv});
    }
    if(out>3000||out<10)w.push({k:'odd',txt:'Необычный выход одной порции: '+dnum(out,2)+' г.'});
  }
  return w;
}
/* пометка в карте о принятом решении по выходу: кто и когда (в имени пользователя при общей базе), чтобы изменение не терялось */
function rdLog(q,txt){
  var d=new Date(),dd=('0'+d.getDate()).slice(-2)+'.'+('0'+(d.getMonth()+1)).slice(-2)+'.'+d.getFullYear(),prev=String((q.ttk&&q.ttk.outLog)||'').split('\n').filter(Boolean).slice(-4);
  return prev.concat([dd+': '+txt]).join('\n').slice(0,1500);
}
function rdArm(id,k){return S.rdArm===id+':'+k;}
/* состояние одной карты: нет выхода / нет закупочных цен / КБЖУ не заполнено / ошибки состава / готова */
function rdOf(id){
  var r=S.recipes[id],c=compute(r,S.ings),cost=NOPRICE?null:costOf(r,S.ings,100,curRegion()),o={id:id,r:r,unk:c.unk,noPrice:cost?cost.noPrice:[],errs:0,errTxt:[]};
  o.noOut=!(r.output>0);
  if(!r.rows.some(function(x){return x.ing||x.pf;})){o.errs++;o.errTxt.push('в составе нет сырья');}
  if(c.unassigned){o.errs+=c.unassigned;o.errTxt.push('строк без сырья: '+c.unassigned);}
  if(c.missing){o.errs+=c.missing;o.errTxt.push('сырья нет в базе: '+c.missing);}
  o.sug=o.noOut?outFromName(r.name):null;
  o.outW=rdOutCheck(r);
  o.ready=!o.noOut&&!o.unk.length&&!o.noPrice.length&&!o.errs&&!o.outW.length;
  return o;
}
function rdAll(){return visIds().filter(function(id){return!S.recipes[id].arch;}).map(rdOf);}
var RD_PAGE=60;
function rdCounts(list){
  var n={all:list.length,out:0,price:0,kbzhu:0,err:0,ready:0,sug:0,ow:0};
  list.forEach(function(o){if(o.noOut){n.out++;if(o.sug)n.sug++;}if(o.outW.length)n.ow++;if(o.noPrice.length)n.price++;if(o.unk.length)n.kbzhu++;if(o.errs)n.err++;if(o.ready)n.ready++;});
  return n;
}
function rdMatch(o,f){return f==='out'?o.noOut:f==='price'?o.noPrice.length>0:f==='kbzhu'?o.unk.length>0:f==='err'?o.errs>0:f==='ow'?o.outW.length>0:f==='ready'?o.ready:true;}
function rdNames(a,k){k=k||4;return a.slice(0,k).map(esc).join(', ')+(a.length>k?' и ещё '+(a.length-k):'');}
function rdRowHtml(o){
  var r=o.r,id=o.id,num=ttkVal(r,'num'),h='<div class="rdrow" data-rid="'+esc(id)+'"><div class="rdh"><button type="button" class="tlink rdn" data-act="rdOpen" data-rid="'+esc(id)+'">'+esc(r.name||'Без названия')+'</button>'
    +'<small>'+(num?'ТТК №'+esc(num)+' · ':'')+(o.noOut?'выход не указан':'выход '+dnum(r.output,2)+' г')+'</small></div><div class="rdc">';
  if(o.noOut){
    h+='<div class="rdi"><span class="rdp bad">Нет выхода</span><label class="rdo">Выход, г <input class="num" inputmode="decimal" autocomplete="off" data-act="rdOut" data-edit data-rid="'+esc(id)+'" data-fk="rd:'+esc(id)+':out" placeholder="г" aria-label="Выход, г: '+esc(r.name)+'"></label>'
      +(o.sug?'<span class="sysub">В названии: «'+esc(o.sug.src)+'»'+(o.sug.parts.length>1?' ('+o.sug.parts.join(' + ')+')':'')+'</span><button type="button" class="btn mini" data-act="rdAcc" data-edit data-rid="'+esc(id)+'">Принять '+dnum(o.sug.v,2)+' г</button>':'')+'</div>';
  }
  o.outW.forEach(function(w){
    h+='<div class="rdi"><span class="rdp warn">'+({unit:'Г или кг?',odd:'Необычный выход',name:'Выход и название',batch:'Партия или порция?'}[w.k])+'</span><span class="sysub">'+esc(w.txt)+'</span><span class="rdacts">';
    if(w.k==='unit'||w.k==='name')h+='<button type="button" class="btn mini" data-act="rdOutFix" data-edit data-rid="'+esc(id)+'" data-k="'+w.k+'" data-v="'+w.fix+'">'+(rdArm(id,w.k)?'Точно? Заменить выход на '+dnum(w.fix,2)+' г':'Исправить на '+dnum(w.fix,2)+' г')+'</button>';
    if(w.k==='batch')h+='<button type="button" class="btn mini" data-act="rdOutBatch" data-edit data-rid="'+esc(id)+'" data-n="'+w.n+'">'+(rdArm(id,'batch')?'Точно? Разделить состав и выход на '+w.n:'Это партия из '+w.n+' порций: пересчитать на 1 порцию')+'</button>';
    h+='<button type="button" class="btn mini" data-act="rdOutOk" data-edit data-rid="'+esc(id)+'" title="Выход '+dnum(r.output,2)+' г — это выход одной порции по карте. Подтверждение хранится в карте.">Выход верный, подтверждаю</button></span></div>';
  });
  if(o.noPrice.length)h+='<div class="rdi"><span class="rdp warn">Нет закупочных цен: '+o.noPrice.length+'</span><span class="sysub">'+rdNames(o.noPrice)+'</span></div>';
  if(o.unk.length)h+='<div class="rdi"><span class="rdp bad">КБЖУ не заполнено: '+o.unk.length+'</span><span class="sysub">'+rdNames(o.unk)+'</span></div>';
  if(o.errs)h+='<div class="rdi"><span class="rdp bad">Состав с ошибками</span><span class="sysub">'+o.errTxt.map(esc).join('; ')+'</span></div>';
  if(o.ready)h+='<div class="rdi"><span class="rdp good">Готово к проверке</span></div>';
  return h+'</div></div>';
}
function rdBodyHtml(){
  var list=rdAll(),n=rdCounts(list),f=S.rdF||'',q=catKey(S.rdQ||'').trim(),shown=list.filter(function(o){return rdMatch(o,f)&&(!q||catKey(o.r.name).indexOf(q)>-1);}),lim=S.rdN||RD_PAGE;
  function chip(k,t,c){return(k==='price'&&NOPRICE)?'':'<button class="chip" data-act="rdF" data-f="'+k+'" aria-pressed="'+(f===k)+'">'+t+' · '+c+'</button>';}
  var h='<p class="lead rdlead">Готовы к проверке: <b>'+n.ready+'</b> из '+n.all+'. '+(NOPRICE?'':'Цены региона «'+esc(regionName(curRegion()))+'».')+' У остальных не хватает данных: отметки показывают, каких. Выход в карте — нормативный, его вводит технолог или он считается по составу; это не результат контрольной варки или взвешивания готового блюда.</p>'
    +'<div class="chips rdchips">'+chip('','Все',n.all)+chip('out','Нет выхода',n.out)+chip('price','Нет закупочных цен',n.price)+chip('kbzhu','КБЖУ не заполнено',n.kbzhu)+(n.ow?chip('ow','Проверить выход',n.ow):'')+(n.err?chip('err','Состав с ошибками',n.err):'')+chip('ready','Готово к проверке',n.ready)+'</div>';
  if(n.sug&&(f===''||f==='out')){
    h+='<div class="rdbar">'+(S.rdConfirm
      ?'<span>Выход по названиям будет записан у <b>'+n.sug+'</b> '+(n.sug%10===1&&n.sug%100!==11?'карты':'карт')+'. Проверьте предложения в списке: каждое показано рядом с названием.</span> <button type="button" class="btn mini primary" data-act="rdAccGo" data-edit>Записать выход у '+n.sug+'</button><button type="button" class="btn mini" data-act="rdAccNo">Отмена</button>'
      :'<span>Массу в названии нашли у <b>'+n.sug+'</b> '+(n.sug%10===1&&n.sug%100!==11?'карты':'карт')+' без выхода.</span> <button type="button" class="btn mini" data-act="rdAccAll" data-edit>Принять все предложения</button>')+'</div>';
  }
  if(!shown.length)return h+'<p class="muted" style="margin-top:14px">'+(list.length?'Нет карт с таким отбором.':'Карт пока нет.')+'</p>';
  h+='<div class="rdlist">'+shown.slice(0,lim).map(rdRowHtml).join('')+'</div>';
  if(shown.length>lim)h+='<div class="btns"><button type="button" class="btn" data-act="rdMore">Показать ещё (осталось '+(shown.length-lim)+')</button></div>';
  return h;
}
function rdHtml(){
  return'<div class="bar ttkbar"><button class="btn" id="ttkBack" data-act="ttkHome" title="К выбору: создать новую или скачать из облака">‹ ТТК</button></div>'
    +'<section class="card rdscr" id="rdScr"><h2>Готовность карт</h2>'
    +'<label class="field rdq"><span class="lbl">Найти карту</span><input type="search" data-act="rdQ" data-fk="rdq" autocomplete="off" value="'+esc(S.rdQ||'')+'" placeholder="Название блюда"></label>'
    +'<div id="rdBody">'+rdBodyHtml()+'</div></section>';
}
function rdPaint(){var el=$('#rdBody');if(el){el.innerHTML=rdBodyHtml();if(uiRO())$$('#rdBody [data-edit]').forEach(function(x){x.disabled=true;});}}
function renderAll(){
  var keep=captureFocus();
  applyPriceMode();
  if(S.tab==='op1'){S.tab='calc';S.cardTab='calc';S.ttkHome=false;}   /* калькуляция ОП-1 — вкладка карты, отдельного раздела нет */
  if(NOPRICE){if(S.tab==='abc'||S.tab==='op1')S.tab='menu';if(S.bsub==='price')S.bsub='kbzhu';}
  if(!tabOk(S.tab))S.tab='menu';
  if(syMgr())S.bsub='price';
  renderTabs();renderStatus();renderRegionSel();
  var v=$('#view');
  if(!S.loaded.ingredients||!S.loaded.recipes){v.innerHTML='<p class="muted">Загружаю рецепты и базу сырья…</p>';return;}
  if(S.tab==='sync'&&S.mode!=='local')S.tab='menu';
  if(S.tab==='cloud'&&!syFilesOn())S.tab='menu';
  if(!S.active||!S.recipes[S.active]){var saved=lsGet('kbzhu:active');if(S.recipes[saved])S.active=saved;}
  fixActive();
  lsSet('kbzhu:tab',S.tab);
  if(S.tab==='calc')hlSet();
  if(S.tab!=='sync'&&S.sy&&S.sy.hlB)S.sy.hlB=null;
  if(S.tab==='sync'){
    v.innerHTML=viewSync();
  }else if(S.tab==='dir'){
    v.innerHTML=viewDir();
  }else if(S.tab==='fc'){
    v.innerHTML=localNotice()+viewFc();
  }else if(S.tab==='rev'){
    v.innerHTML=viewRev();
  }else if(S.tab==='cloud'){
    v.innerHTML=localNotice()+ttkSegHtml()+viewCloud();
  }else if(S.tab==='home'){
    v.innerHTML=localNotice()+viewHome();
  }else if(S.tab==='menu'){
    if(guestOn()){v.innerHTML=viewGuest();gmLoad(false);}
    else v.innerHTML=localNotice()+viewMenu();
  }else if(S.tab==='abc'){
    v.innerHTML=localNotice()+viewAbc();
    abDrawChart();
  }else if(S.tab==='calc'||S.tab==='op1'){
    if(S.tab==='op1')v.innerHTML=localNotice()+viewOp1();
    else if(S.spec&&!S.ttk){v.innerHTML=localNotice()+specHtml();}
    else if(S.ttkHome==='saved'&&!S.ttk){v.innerHTML=localNotice()+ttkSavedHtml();}
    else if(S.ttkHome==='ready'&&!S.ttk&&!syLimited()){v.innerHTML=localNotice()+rdHtml();}
    else if(S.ttkHome&&!S.ttk){v.innerHTML=localNotice()+ttkHomeHtml();}
    else{S.ttkHome=false;v.innerHTML=localNotice()+ttkHtml()+viewCalc();updateCalc();}
  }else{
    v.innerHTML=localNotice()+viewBase();
    var ta=$('#impText');
    if(ta)ta.placeholder='Лук репчатый\t1,4\t0\t9\tТаблицы состава\nБатон нарезной\t7,5\t2,9\t51,4\tЭтикетка';
  }
  if(uiRO())$$('#view [data-edit]').forEach(function(el){el.disabled=true;});
  if(S.tab==='base'&&S.bsub==='price'&&(S.pview==='an'||S.pview==='obj'))pChartsDraw();
  restoreFocus(keep);
}

