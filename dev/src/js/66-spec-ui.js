/* ---------- блюда из ресурсной спецификации 1С: состав без ТТК, ТТК привязывается позже ---------- */
/* все листы книги .xlsx: имена из workbook.xml, файлы листов из связей */
function xlsxSheetsAll(buf){
  var dec=new TextDecoder('utf-8');
  return Promise.all([unzipEntry(buf,'xl/workbook.xml'),unzipEntry(buf,'xl/_rels/workbook.xml.rels'),unzipEntry(buf,'xl/sharedStrings.xml'),unzipEntry(buf,'xl/styles.xml')]).then(function(r){
    if(!r[0])throw new Error('nowb');
    var wb=dec.decode(r[0]),rel=r[1]?dec.decode(r[1]):'',tgt={},m,re=/<Relationship\b[^>]*>/g;
    while((m=re.exec(rel))){var id=/\bId="([^"]+)"/.exec(m[0]),t=/\bTarget="([^"]+)"/.exec(m[0]);if(id&&t)tgt[id[1]]=t[1];}
    var sh=[],rs=/<sheet\b[^>]*>/g;
    while((m=rs.exec(wb))){
      if(/\bstate="(hidden|veryHidden)"/.test(m[0]))continue;
      var nm=/\bname="([^"]*)"/.exec(m[0]),rid=/\br:id="([^"]+)"/.exec(m[0])||/\bid="([^"]+)"/.exec(m[0]),p=rid&&tgt[rid[1]];
      if(!p)continue;
      p=p.replace(/^\/?xl\//,'').replace(/^\//,'');
      sh.push({name:xmlUnesc(nm?nm[1]:''),path:'xl/'+p});
    }
    if(!sh.length)sh=[{name:'',path:'xl/worksheets/sheet1.xml'}];
    var shared=xlShared(r[2]?dec.decode(r[2]):''),ds=xlDateStyles(r[3]?dec.decode(r[3]):'');
    return sh.reduce(function(pr,s){return pr.then(function(acc){return unzipEntry(buf,s.path).then(function(u){if(u)acc.push({name:s.name,rows:xlRows(dec.decode(u),shared,ds)});return acc;});});},Promise.resolve([]));
  });
}
function xmlUnesc(s){return String(s||'').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');}
function specOnFile(file){
  if(!file)return;
  var ext=((/\.([a-z0-9]+)$/i.exec(file.name)||[])[1]||'').toLowerCase();
  function bad(m){flash(m||'Не удалось разобрать файл. Сохраните спецификацию из 1С как «Лист Excel 2007 (.xlsx)».');}
  function done(sheets){
    var P=specParse(sheets||[]);
    if(!P.dishes.length){bad('В файле не нашлось блюд. Нужен отчёт 1С «Список сырья по Спецификации»: блюдо в строке «Выходные изделия», под ним «Сырьё» с количеством.');return;}
    specStart(P,file.name);
  }
  if(ext==='xlsx'||ext==='xlsm'){
    if(typeof DecompressionStream==='undefined'){bad('Этот браузер не открывает .xlsx. Нужен современный Chrome, Edge, Firefox или Safari.');return;}
    readBuf(file).then(xlsxSheetsAll).then(done)['catch'](function(){bad();});
  }else if(ext==='xls')xlsReadFile(file,done,bad,true);
  else bad('Нужен файл .xlsx или .xls со спецификацией из 1С.');
}
/* та же карта в базе: по названию или номеру ТТК с похожим названием блюда */
function specFind(d){return findSameRecipe({dish:d.dish,number:d.num},'',true);}
function specNoTtk(r){return!!(r&&r.spec);}
function specStart(P,file){
  var ing={};
  P.dishes.forEach(function(d){d.rows.forEach(function(x){
    var e=ing[x.k];
    if(!e){
      var mt=c1Match(x.raw,S.ings),pick=mt.id;
      if(mt.how==='fuzzy'&&mt.score<0.6)pick='';
      var sure=!!pick&&(mt.how==='alias'||mt.how==='exact'||(mt.how==='fuzzy'&&mt.score>=0.8&&!mt.pct&&!mt.extra));
      e=ing[x.k]={k:x.k,raw:x.raw,name:x.name,n:0,ing:pick,guess:mt.id,how:pick?mt.how:'none',sure:sure,add:false,skip:false,edit:false};
    }
    e.n++;
  });});
  var ds=P.dishes.map(function(d,i){
    var ex=specFind(d),er=ex?S.recipes[ex]:null,st=!ex?'new':(specNoTtk(er)?'upd':'has');
    return{i:i,ex:ex,st:st,sel:st!=='has'&&!d.bad};
  });
  S.spec={file:file,P:P,ing:ing,ds:ds,cat:false,open:{}};
  S.tab='calc';S.ttkHome=false;
  renderAll();
  var c=$('#specCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
}
function specIngSt(e){
  if(e.skip)return'skip';
  if(e.add&&!e.ing)return'new';
  if(e.ing&&S.ings[e.ing])return(e.sure||e.how==='manual')?'ok':'check';
  return'none';
}
var SPEC_ST={none:['bad','Не найдено'],check:['warn','Подтвердите'],'new':['warn','Новое сырьё'],ok:['ok','Совпало'],skip:['neutral','Не переносить']};
function specIngRow(e){
  var st=specIngSt(e),k=esc(e.k),sel;
  function btns(){return'<span class="c1btns"><button class="btn mini" data-act="specNew" data-edit data-k="'+k+'">＋ Новое сырьё</button><button class="btn mini" data-act="specSkip" data-edit data-k="'+k+'" title="Строка останется в карте без сырья и не войдёт в расчёт">Не переносить</button></span>';}
  if(st==='skip')sel='<span class="c1cur muted">Не переносить в состав</span><button class="btn mini" data-act="specEdit" data-k="'+k+'">Вернуть</button>';
  else if(st==='new'&&!e.edit)sel='<span class="c1cur">＋ Новое сырьё</span><button class="btn mini" data-act="specEdit" data-k="'+k+'">Изменить</button>';
  else if(st==='ok'&&!e.edit)sel='<span class="c1cur">'+esc(S.ings[e.ing].name)+'</span><button class="btn mini" data-act="specEdit" data-k="'+k+'">Другое сырьё</button>';
  else sel=((st==='check'||st==='none')&&e.guess&&S.ings[e.guess]?'<span class="tsub">'+(e.ing?'Предложено: ':'Похоже: ')+'<b>'+esc(S.ings[e.guess].name)+'</b> <button class="btn mini" data-act="specTake" data-edit data-k="'+k+'">Подтвердить</button></span>':'')
    +pickerHtml('specIng','sp:'+e.k,e.ing||'','Сырьё из базы для «'+e.name+'»','Поиск по базе…','new|c1')+btns();
  return'<div class="trow sprow" data-k="'+k+'"><span class="tn">'+esc(e.name)+'<small class="c1sub">в блюдах: '+e.n+'</small></span><span class="tsel">'+sel+'</span><span class="tst"><span class="tstat '+SPEC_ST[st][0]+'">'+SPEC_ST[st][1]+'</span></span></div>';
}
function specDishRow(x){
  var d=S.spec.P.dishes[x.i],st={'new':['ok','Новая карта'],upd:['warn','Обновится (карта без ТТК)'],has:['neutral','Есть ТТК: не меняется']}[x.st];
  var info=(d.out?fmt(d.out,0)+' г':'выход не указан')+' · сырья: '+d.rows.length+(d.sk.length?' · без массы: '+d.sk.map(function(s){return esc(s.name)+' '+fmt(s.q||0,0)+' '+esc(s.u);}).join(', '):'');
  return'<label class="trow spd'+(d.bad?' c1warn':'')+'" data-i="'+x.i+'"><span class="tn"><input type="checkbox" data-act="specSel" data-edit data-i="'+x.i+'"'+(x.sel?' checked':'')+(x.st==='has'?' disabled':'')+'> '+esc(d.name)
    +'<small class="c1sub">'+info+'</small>'+(d.bad?'<small class="warnt">⚠ Проверьте спецификацию: '+esc(d.bad)+'</small>':'')+'</span><span class="tst"><span class="tstat '+st[0]+'">'+st[1]+'</span></span></label>';
}
function specHtml(){
  var t=S.spec;if(!t)return'';
  var P=t.P,es=Object.keys(t.ing).map(function(k){return t.ing[k];}).sort(function(a,b){return a.name.localeCompare(b.name,'ru');});
  var G={none:[],check:[],'new':[],ok:[],skip:[]};es.forEach(function(e){G[specIngSt(e)].push(e);});
  var sheets=[],bySh={};
  t.ds.forEach(function(x){var s=P.dishes[x.i].sheet||'Без листа';if(!bySh[s]){bySh[s]=[];sheets.push(s);}bySh[s].push(x);});
  var nSel=t.ds.filter(function(x){return x.sel;}).length,nBad=P.dishes.filter(function(d){return d.bad;}).length,nLit=P.dishes.filter(function(d){return d.rows.some(function(r){return r.lit;});}).length;
  function iblock(key,title,list,open){
    if(!list.length)return'';
    return'<details class="pgroup"'+(open?' open':'')+'><summary>'+title+' · '+list.length+'</summary><div class="trows">'+list.map(specIngRow).join('')+'</div></details>';
  }
  var h='<section class="card ttk" id="specCard"><h2>Блюда из ресурсной спецификации</h2>'
    +'<p class="hint" style="margin-top:2px">Файл «'+esc(t.file)+'». Из спецификации переносятся выход и сырьё на одну порцию: количество сырья идёт в брутто (по нему считается себестоимость), нетто считается по нормам холодной обработки из базы сырья. Технологии и документа ТТК в спецификации нет: такие карты помечаются «Нет ТТК», файл ТТК можно привязать позже.</p>'
    +'<dl class="kv"><div><dt>Блюд</dt><dd>'+P.dishes.length+'</dd></div><div><dt>Листов</dt><dd>'+sheets.length+'</dd></div><div><dt>Сырья (разного)</dt><dd>'+es.length+'</dd></div>'+(P.d?'<div><dt>Спецификация на дату</dt><dd>'+esc(c1DateRu(P.d))+'</dd></div>':'')+'</dl>';
  var notes=[];
  if(G.none.length)notes.push(['warn','Не найдено в базе сырья: '+G.none.length+'. Выберите сырьё, добавьте как новое или «Не переносить»: иначе строка будет в карте без сырья и без цены.']);
  if(G.check.length)notes.push(['warn','Подтвердите сопоставление: '+G.check.length+'. Пока не подтверждено, строка будет в карте без сырья.']);
  if(nBad)notes.push(['bad','В '+nBad+' блюдах сырья намного больше выхода: похоже на ошибку в самой спецификации (например, килограммы вместо граммов). Эти блюда не отмечены к загрузке: проверьте их в 1С.']);
  if(nLit)notes.push(['warn','В '+nLit+' блюдах есть сырьё в литрах без массы: принято 1 л = 1 кг.']);
  var nHas=t.ds.filter(function(x){return x.st==='has';}).length,nUpd=t.ds.filter(function(x){return x.st==='upd';}).length;
  if(nHas)notes.push(['good','Уже есть с ТТК: '+nHas+'. Их состав не меняется.']);
  if(nUpd)notes.push(['warn','Уже загружены из спецификации раньше (без ТТК): '+nUpd+'. Их состав обновится.']);
  if(notes.length)h+='<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>';
  h+='<h3 class="h3">Сырьё</h3>'
    +(G.none.length?'<div class="btns" style="margin:6px 0"><button class="btn" data-act="specNewAll" data-edit>＋ Добавить все ненайденные как новое сырьё · '+G.none.length+'</button></div>':'')
    +iblock('none','Не найдено в базе',G.none,true)+iblock('check','Подтвердите соответствие',G.check,true)+iblock('new','Будут добавлены как новое сырьё',G['new'],false)+iblock('ok','Совпали с базой',G.ok,false)+iblock('skip','Не переносить',G.skip,false);
  h+='<h3 class="h3">Блюда</h3>'
    +sheets.map(function(s){
      var l=bySh[s],n=l.filter(function(x){return x.sel;}).length;
      return'<details class="pgroup"'+(t.open[s]?' open':'')+' data-sh="'+esc(s)+'"><summary>'+esc(s)+' · отмечено '+n+' из '+l.length+'</summary><div class="btns" style="margin:4px 0"><button class="btn mini" data-act="specSelAll" data-edit data-sh="'+esc(s)+'" data-on="1">Отметить все</button><button class="btn mini" data-act="specSelAll" data-edit data-sh="'+esc(s)+'" data-on="0">Снять все</button></div><div class="trows">'+l.map(specDishRow).join('')+'</div></details>';
    }).join('')
    +'<label class="chk" style="margin-top:10px"><input type="checkbox" data-act="specCat" data-edit'+(t.cat?' checked':'')+'> Разложить блюда по папкам меню с названиями листов ('+sheets.map(esc).join(', ')+')</label>'
    +'<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="specApply" data-edit'+(nSel?'':' disabled')+'>Загрузить блюд: '+nSel+'</button><button class="btn" data-act="specCancel">Отмена</button></div></section>';
  return h;
}
function specNet(id,g){
  var ig=id?S.ings[id]:null,c=ig&&ig.loss&&ig.loss.cold;
  return(c>0&&c<100)?Math.round(g*(1-c/100)*1000)/1000:g;
}
function specApply(){
  var t=S.spec;if(!t)return;
  var P=t.P,made={},nNew=0,nRem=0,nC=0,nU=0,firstId='';
  Object.keys(t.ing).forEach(function(k){
    var e=t.ing[k],st=specIngSt(e);
    if(st==='new'){e.ing=addNewIng(e.name,'Добавлено из ресурсной спецификации 1С: значения КБЖУ не заполнены');made[k]=e.ing;nNew++;}
    else if(st==='ok'&&e.how==='manual'){addAlias(e.ing,e.raw);nRem++;}
  });
  t.ds.forEach(function(x){
    if(!x.sel||x.st==='has')return;
    var d=P.dishes[x.i];
    var rows=d.rows.map(function(r){
      var e=t.ing[r.k],st=specIngSt(e),id=(st==='ok'||st==='new')?e.ing:'';
      var o={rid:newId(),ing:id,net:specNet(id,r.g),gross:r.g,share:100,tname:r.name};
      if(st==='skip')o.skip=true;
      return o;
    });
    var old=x.ex?S.recipes[x.ex]:null,rid=old?x.ex:newId();
    var sp={f:t.file,d:d.from||P.from||'',sh:d.sheet||'',at:Date.now()};
    if(d.sk.length)sp.sk=d.sk.map(function(s){return s.name+' '+fmt(s.q||0,0)+' '+s.u;}).join('; ');
    var nrd={name:old?old.name:d.name,output:d.out||0,rows:rows,ref:old?old.ref:{label:'',p:null,f:null,c:null,kcal:null,tol:10},ttk:old&&old.ttk?old.ttk:{},spec:sp};
    if(d.num)nrd.ttk.num=d.num;
    if(old)['sell','qty','aliases','op','cat','arch','reg','ds'].forEach(function(k){if(old[k]!==undefined)nrd[k]=old[k];});
    if(t.cat&&d.sheet){var cid=lyCatFor(d.sheet,true);if(cid)nrd.cat=cid;}
    S.recipes[rid]=normRecipe(nrd);queueSave('recipes',rid);
    if(old)nU++;else nC++;
    if(!firstId)firstId=rid;
  });
  if(t.cat)saveMenu();
  S.spec=null;S.ttkHome='home';S.tab='calc';
  renderAll();
  flash('Загружено блюд: '+(nC+nU)+(nU?' (обновлено '+nU+')':'')+(nNew?'. Новое сырьё: '+nNew:'')+(nRem?'. Запомнено названий: '+nRem:'')+'. У этих карт нет ТТК: привяжите файл ТТК, когда он будет');
}
/* плашка в карте: состав из спецификации, документа ТТК нет */
function specStripHtml(r){
  if(!specNoTtk(r))return'';
  var s=r.spec;
  return'<section class="card sendstrip specstrip"><div class="ssl"><span class="tstat warn">Нет ТТК</span><span class="grow">Состав загружен из ресурсной спецификации 1С'+(s.f?' («'+esc(s.f)+'»'+(s.d?', действует с '+esc(c1DateRu(s.d)):'')+')':'')+'. Технологии и документа ТТК нет. Брутто взято из спецификации, нетто посчитано по нормам холодной обработки: сверьте с ТТК.'
    +(s.sk?' Без массы, в состав не перенесено: '+esc(s.sk)+'.':'')
    +' Загрузите файл ТТК (.docx), когда он будет готов, в том числе из «ТТК в облаке»: карта найдётся по номеру и названию и обновится.</span>'
    +'<button class="btn" data-act="specTtk" data-edit>Привязать ТТК (.docx)</button></div></section>';
}
function specNoTtkIds(){return visIds().filter(function(id){return specNoTtk(S.recipes[id])&&!S.recipes[id].arch;});}
function specHomeHtml(){
  var ids=specNoTtkIds();
  if(!ids.length)return'';
  ids.sort(function(a,b){return recLabel(S.recipes[a]).localeCompare(recLabel(S.recipes[b]),'ru');});
  return'<details class="pgroup spnottk" id="specNoTtk"><summary>Нет ТТК: '+ids.length+' '+plural(ids.length,['блюдо','блюда','блюд'])+' загружено из спецификации</summary><p class="hint">Загрузите файл ТТК в карту блюда кнопкой «Привязать ТТК» или откройте ТТК из облака: карта найдётся по номеру.</p><div class="trows">'
    +ids.map(function(id){return'<div class="trow" data-rid="'+esc(id)+'"><span class="tn">'+esc(recLabel(S.recipes[id]))+'</span><button class="btn mini" data-act="specOpen" data-rid="'+esc(id)+'">Открыть</button></div>';}).join('')+'</div></details>';
}
function specClick(act,b){
  var t=S.spec,e,k=b.getAttribute('data-k');
  e=t&&k!=null?t.ing[k]:null;
  switch(act){
    case'pickSpec':$('#specFile').click();return true;
    case'specCancel':S.spec=null;S.ttkHome='home';renderAll();return true;
    case'specApply':specApply();return true;
    case'specNew':if(e){e.ing='';e.add=true;e.skip=false;e.how='new';e.edit=false;renderAll();}return true;
    case'specSkip':if(e){e.ing='';e.add=false;e.skip=true;e.how='skip';e.edit=false;renderAll();}return true;
    case'specEdit':if(e){e.edit=true;e.skip=false;S.focusFk='sp:'+k;renderAll();}return true;
    case'specTake':if(e&&e.guess){e.ing=e.guess;e.how='manual';e.add=false;e.skip=false;e.edit=false;renderAll();}return true;
    case'specNewAll':if(t)Object.keys(t.ing).forEach(function(kk){var x=t.ing[kk];if(specIngSt(x)==='none'){x.add=true;x.how='new';x.edit=false;}});renderAll();return true;
    case'specSelAll':if(t){var sh=b.getAttribute('data-sh'),on=b.getAttribute('data-on')==='1';t.open[sh]=true;t.ds.forEach(function(x){if((t.P.dishes[x.i].sheet||'Без листа')===sh&&x.st!=='has')x.sel=on;});renderAll();}return true;
    case'specTtk':S.ttkFor=S.active;$('#ttkFile').click();return true;
    case'specOpen':var id=b.getAttribute('data-rid');if(S.recipes[id]){setActive(id);S.ttkHome=false;S.tab='calc';renderAll();window.scrollTo(0,0);}return true;
  }
  return false;
}
function specChange(act,el){
  var t=S.spec;
  if(act==='specSel'&&t){var x=t.ds[Number(el.getAttribute('data-i'))];if(x){x.sel=el.checked;var dt=el.closest('details');if(dt)t.open[dt.getAttribute('data-sh')]=true;renderAll();}return true;}
  if(act==='specCat'&&t){t.cat=el.checked;return true;}
  return false;
}
/* выбор сырья в поле с поиском */
function specPick(inp,v){
  var t=S.spec,k=String(inp.getAttribute('data-fk')||'').slice(3),e=t&&t.ing[k];
  if(!e)return false;
  if(v==='__skip__'){e.ing='';e.add=false;e.skip=true;e.how='skip';}
  else if(v==='__new__'){e.ing='';e.add=true;e.skip=false;e.how='new';}
  else{e.ing=v;e.add=false;e.skip=false;e.how=v?'manual':'none';}
  e.edit=false;S.focusFk='sp:'+k;renderAll();
  return true;
}
try{window.kbzhuSpec={parse:specParse,start:specStart,S:S,apply:specApply,ingSt:specIngSt};}catch(e){}      /* для проверок */
