/* ---------- Фудкост и план действий: экран «Отчёты» (загрузка, проверка, сопоставление) ---------- */
function fcCanEdit(){return S.mode==='local'&&!NOPRICE&&(!syLinked()||['admin','editor','finance'].indexOf(S.sy.cfg.role)>-1);}
function fcReadFile(file,cb){
  var ext=((/\.([a-z0-9]+)$/i.exec(file.name)||[])[1]||'').toLowerCase();
  function bad(m){cb(null,m||'Не удалось разобрать файл. Сохраните отчёт как .xlsx или .csv.');}
  if(ext==='xlsx'||ext==='xlsm'){
    if(typeof DecompressionStream==='undefined'){bad('Этот браузер не открывает .xlsx: нужен современный Chrome, Edge, Firefox или Safari. Можно сохранить отчёт как .csv.');return;}
    var fr=new FileReader();fr.onerror=function(){bad();};
    fr.onload=function(){
      var buf=fr.result;
      Promise.all([unzipEntry(buf,'xl/sharedStrings.xml'),unzipEntry(buf,'xl/styles.xml'),c1Sheet(buf)]).then(function(r){
        var dec=new TextDecoder('utf-8');if(!r[2])throw new Error('nosheet');
        cb(xlRows(dec.decode(r[2]),xlShared(r[0]?dec.decode(r[0]):''),xlDateStyles(r[1]?dec.decode(r[1]):'')));
      })['catch'](function(){bad();});
    };
    fr.readAsArrayBuffer(file);
  }else if(ext==='ods'){
    var f2=new FileReader();f2.onerror=function(){bad();};
    f2.onload=function(){unzipEntry(f2.result,'content.xml').then(function(u8){if(!u8)throw new Error('nodoc');cb(odtRows(new TextDecoder('utf-8').decode(u8)));})['catch'](function(){bad();});};
    f2.readAsArrayBuffer(file);
  }else if(ext==='csv'||ext==='tsv'||ext==='txt'){
    readTextFile(file,function(err,text){if(err){bad();return;}cb(c1Rows(text));});
  }else if(ext==='xls')bad('Старый формат .xls не читается: пересохраните файл как .xlsx или .csv.');
  else bad('Нужен файл .xlsx, .ods, .csv или .txt.');
}
/* ---------- загрузка файла ---------- */
function fcImpOpen(type,rows,name){
  var d=fcDetect(type,rows),defU=(type==='sales'||type==='output')?'шт':'кг';
  S.fc.imp={type:type,name:name,rows:rows,hdr:d.hdr,map:d.map,defU:defU,kind:'auto',whOk:null,parsed:null,plan:null,all:false};
  fcImpRun();
}
function fcImpCtx(){
  var s=S.fc.sel,im=S.fc.imp;
  return{obj:s.obj,objName:s.objName,from:s.from,to:s.to,defU:im.defU,kind:im.kind,whOk:im.whOk,colMap:im.map};
}
function fcImpRun(){
  var im=S.fc.imp,miss;
  if(!im)return;
  im.parsed=null;im.plan=null;
  if(im.hdr<0){renderAll();return;}
  miss=fcMapMissing(im.type,im.map);
  if(!miss.length){
    var ctx=fcImpCtx(),first=fcParse(im.type,im.rows,im.hdr,im.map,{obj:ctx.obj,from:ctx.from,to:ctx.to,defU:im.defU,kind:im.kind});
    if(!im.whOk){im.whOk={};var ks=Object.keys(first.whs),selk=normKey(ctx.objName);ks.forEach(function(k){im.whOk[k]=ks.length===1||k===selk||selk.indexOf(k)>-1||k.indexOf(selk)>-1;});}
    ctx.whOk=im.whOk;
    im.parsed=fcParse(im.type,im.rows,im.hdr,im.map,ctx);im.parsed.allWhs=first.whs;
    im.plan=fcPlanImport(im.type,im.parsed,ctx,im.name);
  }
  renderAll();
}
function fcImpHtml(){
  var im=S.fc.imp,t,h,P,pl,rows,i,cols,hdrRow,mis;
  if(!im)return'';
  t=FC_TYPES[im.type];
  h='<section class="card fcimp" id="fcImp"><h3 class="h3">Загрузка: '+esc(t)+'</h3><p class="hint">Файл «'+esc(im.name)+'». Объект «'+esc(S.fc.sel.objName)+'», период '+fcIsoRu(S.fc.sel.from)+' – '+fcIsoRu(S.fc.sel.to)+'. Проверьте распознавание колонок и результат проверок; в приложение ничего не попадёт, пока вы не нажмёте «Загрузить».</p>';
  if(im.hdr<0)return h+'<p class="w-warn">Не удалось найти строку заголовков. Проверьте, что в файле есть названия колонок (номенклатура, количество и другие), или выберите строку заголовков.</p><div class="btns"><button class="btn" data-act="fcImpCancel">Отмена</button></div></section>';
  hdrRow=im.rows[im.hdr]||[];
  cols=FC_COLS[im.type];
  h+='<div class="fcmap">'+cols.map(function(c){
    return'<label class="field"><span class="lbl">'+esc(c[1])+(c[2]?' *':'')+'</span><select data-act="fcCol" data-k="'+c[0]+'" data-edit><option value="-1">— нет в файле —</option>'
      +hdrRow.map(function(x,j){return'<option value="'+j+'"'+(im.map[c[0]]===j?' selected':'')+'>'+esc(String(x==null?'':x).slice(0,40)||('колонка '+(j+1)))+'</option>';}).join('')+'</select></label>';
  }).join('')+'</div>';
  h+='<div class="fgrid">'
    +'<label class="field w160"><span class="lbl">Строка заголовков</span><input class="num" inputmode="numeric" data-act="fcHdr" data-edit value="'+(im.hdr+1)+'"></label>'
    +'<label class="field w160"><span class="lbl">Единица, если колонки нет</span><select data-act="fcDefU" data-edit>'+['кг','г','л','мл','шт','уп'].map(function(u){return'<option'+(u===im.defU?' selected':'')+'>'+u+'</option>';}).join('')+'</select></label>'
    +(im.type==='writeoff'?'<label class="field w280"><span class="lbl">Что в этом отчёте</span><select data-act="fcKind" data-edit><option value="auto"'+(im.kind==='auto'?' selected':'')+'>По причине: внутреннее потребление отдельно</option><option value="write"'+(im.kind==='write'?' selected':'')+'>Все строки — списания</option><option value="internal"'+(im.kind==='internal'?' selected':'')+'>Все строки — внутреннее потребление</option></select></label>':'')
    +'</div>';
  mis=fcMapMissing(im.type,im.map);
  if(mis.length)return h+'<p class="w-warn">Не выбраны обязательные колонки: '+esc(mis.join(', '))+'. Выберите их выше.</p><div class="btns"><button class="btn" data-act="fcImpCancel">Отмена</button></div></section>';
  P=im.parsed;pl=im.plan;
  var ws=P.allWhs||{},wk=Object.keys(ws);
  if(wk.length)h+='<div class="fcwh"><h4 class="h4">Склады в файле: какие относятся к объекту «'+esc(S.fc.sel.objName)+'»</h4>'+wk.map(function(k){return'<label class="chk"><input type="checkbox" data-act="fcWh" data-k="'+esc(k)+'" data-edit'+(im.whOk[k]?' checked':'')+'> '+esc(ws[k].name||'склад не указан')+' · '+ws[k].n+' '+plural(ws[k].n,['строка','строки','строк'])+'</label>';}).join('')+'</div>';
  h+='<div class="fcpre"><h4 class="h4">Предпросмотр (первые строки)</h4><div class="scroll"><table class="fctab"><thead><tr>'+hdrRow.map(function(x){return'<th>'+esc(String(x==null?'':x).slice(0,40))+'</th>';}).join('')+'</tr></thead><tbody>'
    +im.rows.slice(im.hdr+1,im.hdr+7).map(function(r){return'<tr>'+hdrRow.map(function(x,j){return'<td>'+esc(String(r[j]==null?'':r[j]).slice(0,40))+'</td>';}).join('')+'</tr>';}).join('')+'</tbody></table></div></div>';
  h+='<dl class="kv fckv"><div><dt>Распознано строк</dt><dd>'+P.ctrl.rows+'</dd></div><div><dt>Будет добавлено</dt><dd>'+pl.add+'</dd></div><div><dt>Уже были загружены</dt><dd>'+pl.dup+'</dd></div><div><dt>Пропущено</dt><dd>'+P.skipped.length+'</dd></div>'
    +(P.dates.min?'<div><dt>Даты в файле</dt><dd>'+fcIsoRu(P.dates.min)+' – '+fcIsoRu(P.dates.max)+'</dd></div>':'')
    +(P.ctrl.sumQ?'<div><dt>Сумма количеств</dt><dd>'+dnum(P.ctrl.sumQ,3)+'</dd></div>':'')+(P.ctrl.sumS?'<div><dt>Сумма, ₽</dt><dd>'+money(P.ctrl.sumS)+'</dd></div>':'')+'</dl>';
  P.issues.forEach(function(x){h+='<p class="'+(x.lv==='warn'?'w-warn':'hint')+'">'+esc(x.txt)+'</p>';});
  pl.notes.forEach(function(x){h+='<p class="w-warn">'+esc(x)+'</p>';});
  pl.blockers.forEach(function(x){h+='<p class="w-err">'+esc(x)+'</p>';});
  if(P.skipped.length)h+='<details class="fcsk"'+(im.all?' open':'')+'><summary>Пропущенные строки ('+P.skipped.length+')</summary><ul class="warns">'+P.skipped.slice(0,im.all?500:25).map(function(x){return'<li class="w-warn"><b>Строка '+x.r+(x.n?' · '+esc(x.n):'')+'.</b> '+esc(x.why)+'</li>';}).join('')+'</ul>'+(P.skipped.length>25&&!im.all?'<button class="btn mini" data-act="fcSkAll">Показать все</button>':'')+'</details>';
  var can=P.ctrl.rows>0&&!pl.blockers.length;
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="fcImpGo" data-edit'+(can?'':' disabled')+'>'+(pl.prev?'Уже загружено':'Загрузить '+pl.add+' '+plural(pl.add,['строку','строки','строк']))+'</button><button class="btn" data-act="fcImpCancel">Отмена</button></div></section>';
  return h;
}
/* ---------- сопоставление номенклатуры ---------- */
function fcItems(){
  var s=S.fc.sel,by={},out=[];
  FC_TYPES_KEYS.forEach(function(type){
    fcOps(type,s.obj,s.from,s.to).forEach(function(o){
      var kind=(type==='sales'||type==='output')?'r':'i',key,e;
      if(type==='writeoff'){var mi=fcMatch('i',o.nm,o.code);if(mi.how==='none'||mi.how==='fuzzy'){var mr=fcMatch('r',o.nm,o.code);if(mr.id)kind='r';}}
      key=kind+'|'+(o.code||normKey(o.nm));e=by[key];
      if(!e){e=by[key]={kind:kind,nm:o.nm,code:o.code||'',n:0,types:{}};out.push(e);}
      e.n++;e.types[type]=1;
    });
  });
  out.forEach(function(e){e.m=fcMatch(e.kind,e.nm,e.code);});
  return out.sort(function(a,b){var ra=(a.m.how==='none'||a.m.how==='fuzzy')?0:1,rb=(b.m.how==='none'||b.m.how==='fuzzy')?0:1;return ra-rb||(b.n-a.n)||(a.nm<b.nm?-1:1);});
}
function fcItemRowHtml(e,i){
  var m=e.m,need=(m.how==='none'||m.how==='fuzzy'),st,sel='',tag;
  tag={map:['ok','Подтверждено вами'],alias:['ok','Совпало (синоним)'],exact:['ok','Совпало'],ignore:['neutral','Не учитывается'],fuzzy:['warn','Подтвердите'],none:['bad','Не найдено']}[m.how];
  st='<span class="tstat '+tag[0]+'">'+tag[1]+'</span>';
  if(m.how==='fuzzy'&&S.ings[m.cand])sel+='<span class="tsub">Предложено: <b>'+esc(S.ings[m.cand].name)+'</b> <button class="btn mini" data-act="fcTake" data-edit data-i="'+i+'">Подтвердить</button></span>';
  if(need||S.fc.itemEdit===e.kind+'|'+(e.code||normKey(e.nm))){
    if(e.kind==='i')sel+=pickerHtml('fcIng','fci:'+i,m.id||'','Сырьё из базы для «'+e.nm+'»','Поиск по базе…','');
    else sel+='<select class="fcrec" data-act="fcRecPick" data-edit data-i="'+i+'" aria-label="Блюдо для «'+esc(e.nm)+'»"><option value="">— выбрать блюдо —</option>'+Object.keys(S.recipes).filter(function(r){return!S.recipes[r].arch;}).sort(function(a,b){return S.recipes[a].name<S.recipes[b].name?-1:1;}).map(function(r){return'<option value="'+esc(r)+'"'+(m.id===r?' selected':'')+'>'+esc(S.recipes[r].name)+'</option>';}).join('')+'</select>';
    sel+='<button class="btn mini" data-act="fcIgnore" data-edit data-i="'+i+'" title="Строки этой позиции в анализ не войдут">Не учитывать</button>';
  }else{
    var nm=m.id?(e.kind==='i'?S.ings[m.id].name:S.recipes[m.id].name):'';
    sel+='<span class="c1cur">'+esc(nm||'—')+'</span><button class="btn mini" data-act="fcEdit" data-edit data-i="'+i+'">Изменить</button>';
  }
  return'<div class="trow fcrow" data-i="'+i+'"><span class="tn">'+esc(e.nm)+'<small class="c1sub">'+(e.kind==='r'?'блюдо':'сырьё')+' · строк: '+e.n+' · '+Object.keys(e.types).map(function(k){return FC_TYPES[k];}).join(', ')+'</small></span><span class="tsel">'+sel+'</span><span class="tst">'+st+'</span></div>';
}
function fcMatchHtml(){
  var L=S.fc.items=fcItems(),need=L.filter(function(e){return e.m.how==='none'||e.m.how==='fuzzy';}),show,h;
  if(!L.length)return'';
  show=S.fc.allItems?L:need;
  h='<section class="card fcmatch"><h3 class="h3">Сопоставление номенклатуры</h3><p class="hint">Позиции из отчётов связываются с сырьём и блюдами базы. Уверенные совпадения принимаются сами; сомнительные и ненайденные нужно подтвердить: они не войдут в анализ, пока решение не принято. Подтверждённое решение запоминается и действует на все загрузки.</p>'
    +'<p class="'+(need.length?'w-warn':'hint')+'">Позиций: '+L.length+'. Требуют решения: <b>'+need.length+'</b>.</p>';
  if(show.length)h+='<div class="trows">'+show.slice(0,S.fc.allItems?400:60).map(function(e){return fcItemRowHtml(e,L.indexOf(e));}).join('')+'</div>';
  if(!S.fc.allItems&&L.length>need.length)h+='<div class="btns"><button class="btn mini" data-act="fcAllItems">Показать все позиции</button></div>';
  if(S.fc.allItems)h+='<div class="btns"><button class="btn mini" data-act="fcAllItems">Только требующие решения</button></div>';
  return h+'</section>';
}
/* ---------- шапка и список отчётов ---------- */
function fcHeadHtml(){
  var s=S.fc.sel,L=fcObjList(),views=[['data','1. Отчёты и сопоставление'],['an','2. Анализ'],['plan','3. План и контроль']];
  if(syLinked()&&fcMyId())views.push(['mine','4. Мои мероприятия']);
  return'<section class="card fchead"><h2>Фудкост и план действий</h2><p class="lead">Выберите объект и период, загрузите отчёты, проверьте распознавание и сопоставление, получите анализ, сформируйте план, назначьте ответственных и проверьте результат в следующем периоде.</p>'
    +'<div class="fgrid"><label class="field w280"><span class="lbl">Объект</span><select id="fcObj" data-act="fcObj" data-edit>'+L.map(function(o){return'<option value="'+esc(o.id)+'"'+(o.id===s.obj?' selected':'')+'>'+esc(o.name)+'</option>';}).join('')+'<option value="__new__">＋ Новый объект…</option></select></label>'
    +(S.fc.newObj?'<label class="field w280"><span class="lbl">Название объекта</span><input type="text" id="fcNewObj" maxlength="80" autocomplete="off" data-act="fcNewObj" data-edit placeholder="например, Столовая Север"></label>':'')
    +'<label class="field w160"><span class="lbl">Период с</span><input type="date" data-act="fcFrom" data-edit value="'+esc(s.from)+'"></label><label class="field w160"><span class="lbl">по</span><input type="date" data-act="fcTo" data-edit value="'+esc(s.to)+'"></label></div>'
    +'<div id="fcSyncLine">'+fcSyncHtml()+'</div>'+fcSyConfHtml()
    +'<div class="segs fcsegs">'+views.map(function(v){return'<button type="button" class="btn'+(S.fc.view===v[0]?' primary':'')+'" data-act="fcView" data-v="'+v[0]+'">'+v[1]+'</button>';}).join('')+'</div></section>';
}
/* статус проверки форматов отчётов на реальных выгрузках: меняется только после проверки на рабочих файлах одного объекта и закрытого периода */
var FC_FMT_CHECKED=false;
function fcTypesHtml(){
  var s=S.fc.sel,edit=fcCanEdit();
  return'<section class="card fctypes"><h3 class="h3">Отчёты за период</h3>'+(FC_FMT_CHECKED?'':'<p class="hint fcfmt" id="fcFmtNote"><b>Форматы рабочих отчётов не проверены.</b> Распознавание отлажено на синтетических файлах; на реальных выгрузках 1С его ещё не проверяли. После каждой загрузки сверяйте число строк и итоги с исходным файлом.</p>')+'<div class="trows">'+FC_TYPES_KEYS.map(function(type){
    var ops=fcOps(type,s.obj,s.from,s.to),bs=Object.keys(S.fc.batches).map(function(k){return S.fc.batches[k];}).filter(function(b){return b.type===type&&b.obj===s.obj&&fcOverlap(b.from,b.to,s.from,s.to);});
    return'<div class="trow fctrow"><span class="tn">'+esc(FC_TYPES[type])+'<small class="c1sub">'+esc(FC_TYPE_HINT[type])+'</small></span><span class="tsel">'+(ops.length?'Строк: <b>'+ops.length+'</b> · загрузок: '+bs.length:'<span class="muted">не загружено</span>')+'</span><span class="tst"><button class="btn mini" data-act="fcPick" data-t="'+type+'" data-edit'+(edit&&s.obj?'':' disabled')+'>Загрузить файл</button></span></div>';
  }).join('')+'</div>'+(s.obj?'':'<p class="w-warn">Сначала выберите или добавьте объект.</p>')+'</section>';
}
function fcBatchesHtml(){
  var s=S.fc.sel,bs=Object.keys(S.fc.batches).map(function(k){return S.fc.batches[k];}).filter(function(b){return b.obj===s.obj;}).sort(function(a,b){return b.at-a.at;});
  if(!bs.length)return'';
  return'<section class="card fcbatches"><h3 class="h3">Загруженные файлы</h3><div class="scroll"><table class="fctab"><thead><tr><th>Отчёт</th><th>Период</th><th>Файл</th><th>Добавлено</th><th>Уже были</th><th>Пропущено</th><th>Загружен</th><th></th></tr></thead><tbody>'
    +bs.map(function(b){return'<tr><td>'+esc(FC_TYPES[b.type])+'</td><td>'+fcIsoRu(b.from)+' – '+fcIsoRu(b.to)+'</td><td>'+esc(b.file)+'</td><td class="n">'+b.add+'</td><td class="n">'+b.dup+'</td><td class="n">'+b.skipped+'</td><td>'+esc(fcIsoRu(new Date(b.at).toISOString().slice(0,10)))+'</td><td><button class="btn mini" data-act="fcDelBatch" data-edit data-id="'+esc(b.id)+'">Удалить загрузку</button></td></tr>';}).join('')
    +'</tbody></table></div><p class="hint">Удаление загрузки убирает только строки, которые добавила именно она. Строки, уже бывшие от других загрузок, остаются.</p></section>';
}
function viewFc(){
  var h;
  if(!S.fc.ld||S.fc.scopeLoaded!==fcScopeKey()){fcLoad();return'<p class="muted">Загружаю данные раздела…</p>';}
  fcSelInit();
  h=fcHeadHtml();
  if(S.fc.view==='an'&&typeof fcAnHtml==='function')h+=fcAnHtml();
  else if(S.fc.view==='plan'&&typeof fcPlanHtml==='function')h+=fcPlanHtml();
  else if(S.fc.view==='mine')h+=fcMineHtml();
  else h+=fcTypesHtml()+fcImpHtml()+fcMatchHtml()+fcBatchesHtml()+fcBackupHtml();
  return h;
}
/* ---------- события ---------- */
function fcClick(act,b){
  var s=S.fc,im=s.imp,i,e;
  if(typeof fcClick2==='function'&&fcClick2(act,b))return true;
  switch(act){
    case'fcView':s.view=b.getAttribute('data-v');renderAll();return true;
    case'fcPick':if(!fcCanEdit()){roFlash();return true;}s.pendType=b.getAttribute('data-t');var f=$('#fcFile');if(f){f.value='';f.click();}return true;
    case'fcImpCancel':s.imp=null;renderAll();return true;
    case'fcSkAll':im.all=true;renderAll();return true;
    case'fcImpGo':(function(){
      var ctx=fcImpCtx(),r;ctx.whOk=im.whOk;
      r=fcCommit(im.type,im.parsed,ctx,im.name);
      if(!r.ok){flash(r.msg);return;}
      s.imp=null;
      flash(r.same?'Эти данные уже загружены: ничего не добавлено':'Загружено строк: '+r.add+(r.dup?'; уже были: '+r.dup:''));
      renderAll();
    })();return true;
    case'fcDelBatch':if(s.delAsk!==b.getAttribute('data-id')){s.delAsk=b.getAttribute('data-id');flash('Нажмите «Удалить загрузку» ещё раз, чтобы подтвердить');return true;}fcRemoveBatch(s.delAsk);s.delAsk='';renderAll();return true;
    case'fcAllItems':s.allItems=!s.allItems;renderAll();return true;
    case'fcEdit':e=s.items[Number(b.getAttribute('data-i'))];if(e){s.itemEdit=e.kind+'|'+(e.code||normKey(e.nm));renderAll();}return true;
    case'fcTake':e=s.items[Number(b.getAttribute('data-i'))];if(e&&e.m.cand){fcSetMap(e.kind,e.nm,e.code,e.m.cand);s.itemEdit='';renderAll();}return true;
    case'fcIgnore':e=s.items[Number(b.getAttribute('data-i'))];if(e){fcSetMap(e.kind,e.nm,e.code,'-');s.itemEdit='';renderAll();}return true;
  }
  return false;
}
function fcChange(act,t){
  var s=S.fc,im=s.imp,e,v;
  if(typeof fcChange2==='function'&&fcChange2(act,t))return true;
  switch(act){
    case'fcObj':
      if(t.value==='__new__'){s.newObj=true;renderAll();return true;}
      s.newObj=false;s.obj=s.sel.obj=t.value;
      fcObjList().forEach(function(o){if(o.id===t.value)s.sel.objName=o.name;});
      s.imp=null;renderAll();return true;
    case'fcNewObj':(function(){
      var n=phObjName(t.value),sl=phSlug(n);
      if(!sl)return;
      s.sel.objs=(s.sel.objs||[]).concat([n]);s.sel.obj=sl;s.sel.objName=n;s.newObj=false;s.imp=null;renderAll();
    })();return true;
    case'fcFrom':case'fcTo':
      v=fcDate(t.value);if(!v)return true;
      s.sel[act==='fcFrom'?'from':'to']=v;
      if(s.sel.from>s.sel.to){if(act==='fcFrom')s.sel.to=v;else s.sel.from=v;}
      if(s.imp)fcImpRun();else renderAll();return true;
    case'fcCol':im.map[t.getAttribute('data-k')]=Number(t.value);fcImpRun();return true;
    case'fcHdr':v=Math.round(Number(t.value));if(v>=1&&v<=im.rows.length){im.hdr=v-1;var d=fcDetect(im.type,im.rows.slice(im.hdr,im.hdr+1));im.map=fcDetectRow(im.type,im.rows[im.hdr]);im.whOk=null;fcImpRun();}return true;
    case'fcDefU':im.defU=t.value;fcImpRun();return true;
    case'fcKind':im.kind=t.value;fcImpRun();return true;
    case'fcWh':im.whOk[t.getAttribute('data-k')]=t.checked;fcImpRun();return true;
    case'fcRecPick':e=s.items[Number(t.getAttribute('data-i'))];if(e&&t.value){fcSetMap('r',e.nm,e.code,t.value);s.itemEdit='';renderAll();}return true;
  }
  return false;
}
function fcDetectRow(type,row){var d=fcDetect(type,[row]);return d.map;}
function fcFilePicked(file){
  var type=S.fc.pendType;
  if(!file||!type)return;
  if(!S.fc.sel.obj){flash('Сначала выберите объект');return;}
  fcReadFile(file,function(rows,msg){
    if(!rows||!rows.length){flash(msg||'В файле нет строк');return;}
    fcImpOpen(type,rows,file.name);
    var el=$('#fcImp');if(el&&el.scrollIntoView)el.scrollIntoView({block:'start'});
  });
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{S:S,parse:fcParse,detect:fcDetect,commit:fcCommit,match:fcMatch,ops:fcOps,kg:fcKg,H:fcH,rows:fcReadFile});}catch(e){}
