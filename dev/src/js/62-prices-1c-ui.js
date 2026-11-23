/* ============ загрузка цен из выгрузки 1С, история цен и анализ ============ */
function bId(b){return phId(b.region,b.from,b.to,b.obj);}
function c1ObjMemo(){try{return JSON.parse(lsGet('kbzhu:c1obj')||'{}')||{};}catch(e){return{};}}
function c1ObjMemoSet(key,name){var m=c1ObjMemo();m[key]=name;lsSet('kbzhu:c1obj',JSON.stringify(m));}
function c1Slug(name){return phSlug(name)||'none';}
/* склады файла → объекты. Склад берётся из строки закупки, а если в строках его нет — из отбора отчёта «Склад Равно …».
   Название объекта по умолчанию — склад как в 1С либо то, что вы вписали для него раньше */
function c1Objs(P){
  var m={},out=[],memo=c1ObjMemo();
  function add(w){
    var k=normKey(phObjName(w)),e=m[k];
    if(!e){e=m[k]={key:k,wh:phObjName(w),n:0,name:Object.prototype.hasOwnProperty.call(memo,k)?phObjName(memo[k]):phObjName(w)};out.push(e);}
    return e;
  }
  P.items.forEach(function(it){it.lines.forEach(function(l){add(l.wh||P.wh||'').n++;});});
  if(!out.length)add(P.wh||'');
  return out;
}
function c1ObjFor(t,l){
  var k=normKey(phObjName(l.wh||t.parsed.wh||'')),i;
  for(i=0;i<t.objs.length;i++)if(t.objs[i].key===k)return t.objs[i];
  return t.objs[0];
}
/* объекты загрузки: склады с одним названием объединяются */
function c1Groups(t){
  var g={},ord=[];
  t.objs.forEach(function(o){
    var sl=c1Slug(o.name),e=g[sl];
    if(!e){e=g[sl]={name:phObjName(o.name),slug:sl,n:0,whs:[]};ord.push(e);}
    e.n+=o.n;if(o.wh)e.whs.push(o.wh);
  });
  return ord;
}
function c1ObjDynHtml(t){
  var g=curRegion(),P=t.parsed,groups=c1Groups(t),notes=[],h='';
  if(!P.from)return'';
  var key=phId(g,P.from,P.to),recs=phList(S.cfg,g).filter(function(b){return phKey(b)===key;});
  groups.forEach(function(gr){
    var old=S.cfg[phId(g,P.from,P.to,gr.name)];
    if(old)notes.push(['warn','Для '+(gr.name?'объекта «'+esc(gr.name)+'»':'загрузки без объекта')+' за этот период в истории уже есть запись'+(old.at?' от '+esc(new Date(old.at).toLocaleDateString('ru-RU')):'')+': новая заменит её.']);
  });
  var others=recs.filter(function(b){return b.obj&&!groups.some(function(gr){return gr.slug===c1Slug(b.obj);});}).map(function(b){return b.obj;});
  var legacy=S.cfg[key],named=groups.some(function(gr){return!!gr.name;}),unnamed=groups.some(function(gr){return!gr.name;});
  if(groups.length>1)notes.push(['good','В файле несколько объектов: в историю запишется отдельная запись на каждый. Цена региона будет средневзвешенной по объектам.']);
  if(others.length)notes.push(['good','За этот период уже загружены другие объекты: '+others.map(esc).join(', ')+'. Цена региона будет пересчитана как средневзвешенная по всем объектам.']);
  if(unnamed&&(others.length||groups.length>1))notes.push(['warn','У части складов нет названия объекта: впишите его, иначе их закупки попадут в «Без объекта» и не будут сравниваться с остальными.']);
  var canDrop=!(syPhOn()&&!syAdmin());
  if(legacy&&!unnamed&&named){
    notes.push(['warn','За этот период уже есть загрузка без объекта'+(legacy.at?' от '+esc(new Date(legacy.at).toLocaleDateString('ru-RU')):'')+(legacy.file?' (файл «'+esc(legacy.file)+'»)':'')+'. Если это те же закупки, её нужно заменить, иначе они посчитаются дважды.']);
    if(canDrop)h+='<label class="trem c1leg"><input type="checkbox" data-act="c1Legacy" data-edit'+(t.dropLegacy!==false?' checked':'')+'>Заменить прежнюю загрузку без объекта за этот период</label>';
    else notes.push(['warn','Прежнюю загрузку без объекта удаляет технолог.']);
  }
  if(!notes.length&&unnamed&&!others.length)h='<p class="hint" style="margin:6px 0 0">В файле не указан склад. Чтобы цены разных объектов можно было сравнивать, впишите название объекта справа: оно запомнится для таких файлов.</p>'+h;
  return(notes.length?'<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>':'')+h;
}
function c1ObjsHtml(t){
  var rows=t.objs.map(function(o,i){
    return'<div class="c1orow"><span class="c1ow">'+(o.wh?esc(o.wh):'<i>склад не указан</i>')+'</span><span class="c1on">'+o.n+' '+plural(o.n,['закупка','закупки','закупок'])+'</span>'
      +'<span class="c1oi"><input type="text" maxlength="80" autocomplete="off" aria-label="Объект для склада «'+esc(o.wh||'не указан')+'»" data-act="c1Obj" data-edit data-fk="c1o:'+i+'" data-i="'+i+'" value="'+esc(o.name)+'" placeholder="Название объекта"></span></div>';
  }).join('');
  return'<div class="c1objs"><h3 class="h3">Объекты</h3><p class="hint" style="margin:-2px 0 8px">Объект определяется по складу в выгрузке 1С. У каждого объекта своя запись истории цен, а цена региона считается средневзвешенной по объектам. Несколько складов одного объекта объединяются одинаковым названием.</p>'
    +'<div class="c1orow thead"><span>Склад в 1С</span><span class="r">Закупок</span><span>Объект в калькуляторе</span></div>'+rows+'<div id="c1ObjDyn">'+c1ObjDynHtml(t)+'</div></div>';
}
function c1Memo(){try{return JSON.parse(lsGet('kbzhu:c1mass')||'{}')||{};}catch(e){return{};}}
function c1MemoSet(name,g){var m=c1Memo();m[normKey(name)]=g;lsSet('kbzhu:c1mass',JSON.stringify(m));}
/* масса одной штуки по умолчанию: запомненная вами для этой позиции, из карточки сырья (режим «за упаковку»), из названия */
function c1PackDef(x,it){
  var mm=c1Memo()[normKey(it.name)];
  if(mm>0)return{g:mm,src:'memo'};
  var ing=x.ing?S.ings[x.ing]:null,q=ing?regRec(ing,curRegion()):null;
  if(q&&q.priceUnit==='pack'&&q.packG>0)return{g:q.packG,src:'base'};
  var m=c1Mass(it.name);
  if(m>0)return{g:m,src:'name'};
  return{g:0,src:''};
}
/* состояние строки выгрузки: ok — готова, check — проверьте, mass — нужна масса штуки, none — сырьё не выбрано, empty — нет закупок с ценой и количеством */
function c1Row(x){
  var t=S.c1,it=t.parsed.items[x.i],r={it:it,st:'none',pr:null,pack:0,psrc:'',old:null,n:0,cv:null};
  if(x.skip){r.st='skip';return r;}      /* «Не вносить»: позиция отложена сознательно, цена не загрузится */
  var isNew=!!x.add&&!x.ing;
  if(!isNew&&(!x.ing||!S.ings[x.ing]))return r;
  var pk=0;
  if(it.unit==='pc'){
    if(x.packUser>0){pk=x.packUser;r.psrc='user';}
    else{var d=c1PackDef(x,it);pk=d.g;r.psrc=d.src;}
    r.pack=pk;
    if(!(pk>0)){r.st='mass';return r;}
  }
  var ig0=x.ing?S.ings[x.ing]:null,dn=x.densUser>0?x.densUser:((ig0&&ig0.dens>0)?ig0.dens:0);
  var cv=c1Conv(it,pk,dn);
  if(!cv.ok){r.st='empty';return r;}
  r.dens=dn;r.densAssumed=!!cv.assumed;
  /* объём без плотности: 1 л = 1 кг не принимается молча; строка ждёт ввода плотности или явного допущения пользователя */
  if(cv.assumed&&!x.densAsm){r.st='dens';return r;}
  r.densAcc=!!(cv.assumed&&x.densAsm);
  r.cv=cv;r.n=cv.lines.length;r.pr=c1Pick(cv.lines,t.rule);
  r.old=isNew?null:pricePerKg(S.ings[x.ing],curRegion());
  r.isNew=isNew;
  r.st=(isNew||x.sure||x.how==='manual')?'ok':'check';
  if(x.done&&r.st==='ok')r.st='done';
  return r;
}
function c1Start(parsed,fileName){
  if(!parsed.items.length){flash('В файле не нашлось позиций с закупками. Нужен отчёт 1С: название позиции, под ним строки с датой, поставщиком, ценой и количеством.');return;}
  var items=parsed.items.map(function(it,i){
    var mt=c1Match(it.name,S.ings),pick=mt.id,sure=false;
    if(mt.how==='fuzzy'&&mt.score<0.6)pick='';
    if(pick)sure=mt.how==='alias'||mt.how==='exact'||(mt.how==='fuzzy'&&mt.score>=0.8&&!mt.pct&&!mt.extra);
    return{i:i,ing:pick,how:pick?mt.how:'none',score:mt.score,guess:mt.id,sure:sure,remember:sure&&mt.how==='fuzzy',packUser:0,edit:false,add:false,skip:false};
  });
  var rule=lsGet('kbzhu:c1rule');
  S.c1={file:fileName,parsed:parsed,items:items,rule:PH_RULES[rule]?rule:'avg',open:null,objs:c1Objs(parsed),dropLegacy:true};
  var cnt={};S.c1.items.forEach(function(x){var st=c1Row(x).st;cnt[st]=(cnt[st]||0)+1;});
  S.c1.open={dens:true,mass:true,check:true,none:(cnt.none||0)<=12,'new':true,ok:false,empty:false,skip:false};
  S.bsub='price';lsSet('kbzhu:bsub','price');S.pview='tbl';lsSet('kbzhu:pview','tbl');S.tab='base';S.c1Paste=false;
  renderAll();
  var c=$('#c1Card');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
}
function c1Sheet(buf){
  var names=['xl/worksheets/sheet1.xml','xl/worksheets/sheet2.xml','xl/worksheets/sheet3.xml'],i=0;
  function next(){
    if(i>=names.length)return Promise.resolve(null);
    return unzipEntry(buf,names[i++]).then(function(u){return u||next();});
  }
  return next();
}
function c1OnFile(file){
  if(!file)return;
  var ext=(/\.([a-z0-9]+)$/i.exec(file.name)||[])[1];ext=(ext||'').toLowerCase();
  function bad(){flash('Не удалось разобрать файл. Сохраните отчёт из 1С как «Лист Excel 2007 (.xlsx)» или вставьте строки таблицы в поле ниже.');}
  function done(rows){
    if(!rows||!rows.length){bad();return;}
    c1Start(c1Parse(rows),file.name);
  }
  if(ext==='xlsx'||ext==='xlsm'){
    if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .xlsx. Нужен современный Chrome, Edge, Firefox или Safari. Можно вставить строки таблицы в поле ниже.');return;}
    var fr=new FileReader();
    fr.onerror=bad;
    fr.onload=function(){
      var buf=fr.result;
      Promise.all([unzipEntry(buf,'xl/sharedStrings.xml'),unzipEntry(buf,'xl/styles.xml'),c1Sheet(buf)]).then(function(r){
        var dec=new TextDecoder('utf-8');
        if(!r[2])throw new Error('nosheet');
        done(xlRows(dec.decode(r[2]),xlShared(r[0]?dec.decode(r[0]):''),xlDateStyles(r[1]?dec.decode(r[1]):'')));
      })['catch'](bad);
    };
    fr.readAsArrayBuffer(file);
  }else if(ext==='ods'){
    if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .ods. Нужен современный Chrome, Edge, Firefox или Safari.');return;}
    var fr2=new FileReader();
    fr2.onerror=bad;
    fr2.onload=function(){
      unzipEntry(fr2.result,'content.xml').then(function(u8){
        if(!u8)throw new Error('nodoc');
        done(odtRows(new TextDecoder('utf-8').decode(u8)));
      })['catch'](bad);
    };
    fr2.readAsArrayBuffer(file);
  }else if(ext==='csv'||ext==='tsv'||ext==='txt'){
    readTextFile(file,function(err,text){if(err){bad();return;}done(c1Rows(text));});
  }else if(ext==='xls'){
    xlsReadFile(file,done,function(m){flash(m);});
  }else if(ext==='pdf'){
    flash('PDF не читается. Сохраните тот же отчёт из 1С в Excel (.xlsx) и загрузите его.');
  }else flash('Нужен файл .xlsx, .xls, .ods, .csv или .txt с отчётом 1С.');
}
function c1PasteGo(){
  var ta=$('#c1Text'),text=ta?ta.value:'';
  if(!text.trim()){flash('Вставьте строки отчёта из Excel');return;}
  var rows=c1Rows(text);
  if(!rows.length){flash('В тексте нет строк');return;}
  c1Start(c1Parse(rows),'вставленный текст');
}
var C1_RULE_HINT={avg:'Цена с учётом объёма: чем больше закуплено по цене, тем больше её вес. Лучше всего отражает реальную себестоимость месяца.',last:'Цена последней закупки в периоде. Показывает уровень цен на конец месяца.',min:'Самая низкая цена закупки в периоде. Оценка «в лучшем случае».'};
function pcSign(p){return p>0?'▲':(p<0?'▼':'=');}
function pcCls(p){return p>=0.5?'up':(p<=-0.5?'dn':'eq');}
function pcTxt(p){return p===null||p===undefined||!isFinite(p)?'':pcSign(Math.abs(p)<0.05?0:p)+' '+signed(p,1)+' %';}
function c1StatHtml(st,x){
  var m={ok:(x.add&&!x.ing)?['warn','Новое сырьё']:['ok',x.how==='alias'?'Запомнено':'Совпало'],check:['warn','Подтвердите'],done:['ok','Загружено'],mass:['warn','Нужна масса'],dens:['warn','Нужна плотность'],none:['bad','Не найдено'],skip:['neutral','Не вносить'],empty:['neutral','Нет закупок']}[st];
  return'<span class="tstat '+m[0]+'">'+m[1]+'</span>';
}
/* несколько позиций 1С выбрали одно и то же сырьё: цена станет общей, а ошибка автоподбора незаметной */
function c1Shared(){
  var t=S.c1,by={};
  if(!t)return{};
  t.items.forEach(function(x,i){if(x.ing&&!x.skip&&S.ings[x.ing]&&t.parsed.items[i].lines.length)(by[x.ing]||(by[x.ing]=[])).push(i);});
  Object.keys(by).forEach(function(k){if(by[k].length<2)delete by[k];});
  return by;
}
function c1RowHtml(i,r,optsHtml){
  var x=S.c1.items[i],it=r.it,sups={};
  it.lines.forEach(function(l){sups[l.sup]=1;});
  var nsup=Object.keys(sups).length;
  var sub=C1_UNIT_NAME[it.unit]+' · закупок: '+it.lines.length+(nsup?' · поставщиков: '+nsup:'');
  var price='—';
  if(r.pr!==null){
    var dl=(r.old!==null&&r.old>0)?(r.pr/r.old-1)*100:null;
    price='<span class="c1pm"><b>'+money(r.pr)+'</b> <small>₽/кг</small></span>'+((it.unit==='pc'&&it.lines[0])?'<small>'+money(it.lines[0].p)+' ₽/шт'+(it.lines.length>1?' и др.':'')+'</small>':'')
      +(dl!==null?'<small class="pdl '+pcCls(dl)+'">было '+money(r.old)+' · '+pcTxt(dl)+'</small>':(r.old===null?'<small>цены в базе не было</small>':''));
  }else if(it.lines.length){
    price='<small>'+money(it.lines[0].p)+' ₽/'+C1_UNIT_NAME[it.unit]+'</small>';
  }
  var sel,cur=x.ing||(x.add?'__new__':'');
  /* поле с поиском по базе (набираете часть названия) и отдельные кнопки: «Новое сырьё» и «Не вносить» */
  function btns(skipBtn,newBtn){
    return'<span class="c1btns">'+(newBtn?'<button class="btn mini" data-act="c1New" data-edit data-i="'+i+'" title="Добавить позицию в базу как новое сырьё">＋ Новое сырьё</button>':'')
      +(skipBtn?'<button class="btn mini" data-act="c1Skip" data-edit data-i="'+i+'" title="Не вносить цену этой позиции: она останется в списке «Не вносить»">Не вносить</button>':'')+'</span>';
  }
  if(x.skip){
    sel='<span class="c1cur muted">Не вносить: цена этой позиции не загрузится</span><button class="btn mini" data-act="c1Edit" data-i="'+i+'">Вернуть в работу</button>';
  }else if(x.add&&!x.ing&&!x.edit){
    sel='<span class="c1cur">＋ Новое сырьё</span><button class="btn mini" data-act="c1Edit" data-i="'+i+'">Изменить</button>'+btns(true,false);
  }else if(x.ing&&(r.st==='ok'||r.st==='done')&&!x.edit){
    sel='<span class="c1cur">'+esc(S.ings[x.ing].name)+'</span><button class="btn mini" data-act="c1Edit" data-i="'+i+'">Другое сырьё</button>'+btns(true,true);
  }else{
    sel=(((!x.ing)||r.st==='check')&&x.guess&&S.ings[x.guess]?'<span class="tsub">'+(x.ing?'Предложено: ':'Похоже: ')+'<b>'+esc(S.ings[x.guess].name)+'</b> <button class="btn mini" data-act="c1Take" data-edit data-i="'+i+'" title="Подтвердить это сырьё: цена загрузится и (если отмечено) название запомнится">Подтвердить</button></span>':'')
      +pickerHtml('c1Ing','c1i:'+i,x.add&&!x.ing?'':cur,'Сырьё из базы для «'+it.name+'»','Поиск по базе…','new|c1')+btns(true,true);
  }
  if(x.ing&&!x.skip){
    var sh=c1Shared()[x.ing];
    if(sh)sel+='<small class="warnt c1sh">Это сырьё выбрано ещё у: '+sh.filter(function(j){return j!==i;}).slice(0,3).map(function(j){return esc(S.c1.parsed.items[j].name.replace(/\s+[-–]\s*(?:[-–]\s*)*$/,''));}).join('; ')+(sh.length>4?' и др.':'')+'. Цена станет общей: проверьте, что это одно и то же.</small>';
  }
  if(!x.skip&&(x.ing||x.add)&&(it.unit==='l'||it.unit==='ml')){
    sel+='<label class="c1mass">Плотность, г/мл <input class="num" inputmode="decimal" autocomplete="off" data-act="c1Dens" data-edit data-fk="c1d:'+i+'" value="'+toInput(r.dens>0?r.dens:null)+'" placeholder="1"></label>'
      +(r.st==='dens'?'<small class="warnt" title="Литр и килограмм равны только для воды. Для масла, молока, сливок, сиропов плотность другая">плотность не задана: введите её или примите допущение</small><button class="btn mini" data-act="c1DensOk" data-edit data-i="'+i+'" title="Цена за кг будет считаться как цена за литр; пометка сохранится в сырье и в расчётах">Принять 1 л = 1 кг</button>'
        :(r.densAcc?'<small class="warnt">допущение 1 л = 1 кг принято вами</small><button class="btn mini" data-act="c1DensNo" data-edit data-i="'+i+'">Снять допущение</button>':'<small class="muted">плотность задана</small>'));
  }
  if((x.ing||x.add)&&it.unit==='pc'){
    sel+='<label class="c1mass">Масса штуки, г <input class="num" inputmode="decimal" autocomplete="off" data-act="c1Pack" data-edit data-fk="c1p:'+i+'" value="'+toInput(r.pack>0?r.pack:null)+'" placeholder="г"></label>'
      +(r.psrc==='name'?'<small class="muted">взято из названия</small>':(r.psrc==='base'?'<small class="muted">из карточки сырья</small>':(r.psrc==='memo'||r.psrc==='user'?'<small class="muted">как вы указали</small>':'')));
  }
  return'<div class="trow c1row" data-i="'+i+'"><span class="tn">'+esc(it.name)+'<small class="c1sub">'+sub+'</small></span>'
    +'<span class="c1p">'+price+'</span>'
    +'<span class="tsel">'+sel+'</span>'
    +'<span class="tst">'+c1StatHtml(r.st,x)+((x.ing&&(x.how==='fuzzy'||x.how==='manual'))?'<label class="trem"><input type="checkbox" data-act="c1Rem" data-edit'+(x.remember?' checked':'')+'>запомнить название</label>':'')+'</span></div>';
}
function c1CardHtml(){
  var t=S.c1;if(!t)return'';
  var P=t.parsed,g=curRegion(),rows=t.items.map(c1Row);
  var G={dens:[],mass:[],check:[],none:[],ok:[],empty:[],skip:[],'new':[],done:[]};
  rows.forEach(function(r,i){if(r.isNew&&r.st==='ok')G['new'].push(i);else G[r.st].push(i);});
  var ids=Object.keys(S.ings).sort(byName(S.ings));
  var optsHtml=ids.map(function(id){return'<option value="'+esc(id)+'">'+esc(S.ings[id].name||'Без названия')+'</option>';}).join('');
  var sup={},nl=0;P.items.forEach(function(it){it.lines.forEach(function(l){sup[l.sup]=1;nl++;});});
  var ready=G.ok.length+G['new'].length;
  function block(key,title,list){
    if(!list.length)return'';
    var head='<div class="trow thead c1row"><span>В выгрузке 1С</span><span class="r">Цена за кг</span><span>Сырьё в базе</span><span>Статус</span></div>';
    return'<details class="pgroup" id="c1g-'+key+'"'+(t.open[key]?' open':'')+'><summary>'+title+' · '+list.length+'</summary><div class="trows">'+head+list.map(function(i){return c1RowHtml(i,rows[i],optsHtml);}).join('')+'</div></details>';
  }
  var h='<section class="card ttk" id="c1Card"><h2>Загружена выгрузка 1С</h2>'
    +'<p class="rgtag">Цены запишутся в регион «'+esc(regionName(g))+'»</p>'
    +'<dl class="kv"><div><dt>Период</dt><dd>'+(P.from?esc(c1DateRu(P.from)+' – '+c1DateRu(P.to)):'не найден')+'</dd></div><div><dt>Позиций</dt><dd>'+P.items.length+'</dd></div><div><dt>Закупок</dt><dd>'+nl+'</dd></div><div><dt>Поставщиков</dt><dd>'+Object.keys(sup).length+'</dd></div></dl>'
    +'<p class="hint" style="margin-top:10px">Файл «'+esc(t.file)+'»'+(P.wh?', склад «'+esc(P.wh)+'»':'')+'.</p>'
    +c1ObjsHtml(t)
    +'<div class="fgrid" style="margin-top:12px"><label class="field w280"><span class="lbl">Какую цену записать в базу</span><select data-act="c1Rule" data-edit data-fk="c1rule">'
    +Object.keys(PH_RULES).map(function(k){return'<option value="'+k+'"'+(k===t.rule?' selected':'')+'>'+PH_RULES[k]+'</option>';}).join('')+'</select></label>'
    +'<p class="hint" style="margin:0;align-self:end;flex:2 1 280px">'+C1_RULE_HINT[t.rule]+'</p></div>'
    +block('dens','Нужна плотность: введите её или примите допущение «1 л = 1 кг» (цены этих позиций не загрузятся)',G.dens)+block('mass','Нужна масса штуки',G.mass)+block('check','Подтвердите соответствие: цены этих позиций не загрузятся, пока вы не подтвердите',G.check)+(G.none.length?'<div class="btns" style="margin:10px 0 4px"><button class="btn" data-act="c1NewAll" data-edit>＋ Добавить все ненайденные как новое сырьё · '+G.none.length+'</button></div>':'')
    +block('none','Не найдено в базе: выберите сырьё или добавьте как новое',G.none)+block('new','Будут добавлены как новое сырьё',G['new'])+block('ok','Совпали с базой',G.ok)+block('done','Уже загружено',G.done)+block('empty','Без закупок с ценой и количеством',G.empty)+block('skip','Не вносить: цены этих позиций не загрузятся',G.skip);
  var notes=[];
  if(!P.from)notes.push(['bad','В отчёте не найден период («Период: дд.мм.гггг - дд.мм.гггг»), загрузка невозможна. Сформируйте отчёт с указанием периода.']);
  if(P.total!==null)notes.push([P.ok?'good':'warn',P.ok?'Итог отчёта сошёлся с суммой по позициям: все строки распознаны.':'Итог отчёта ('+fmt(P.total,2)+') не сходится с суммой по позициям ('+fmt(P.sum,2)+'): часть строк могла не распознаться.']);
  P.issues.slice(0,4).forEach(function(s){if(!/^Итог отчёта/.test(s))notes.push(['warn',esc(s)]);});
  if(G.none.length)notes.push(['warn','Сырьё не выбрано в '+G.none.length+' позициях: их цены не загрузятся. Выберите сырьё из базы или добавьте как новое.']);
  var shr=c1Shared(),shk=Object.keys(shr);
  if(shk.length)notes.push(['warn','Несколько позиций 1С отнесены к одному сырью ('+shk.length+'): '+shk.slice(0,3).map(function(k){return'«'+esc(S.ings[k].name)+'» ← '+shr[k].length+' поз.';}).join('; ')+(shk.length>3?' и др.':'')+'. Цена такого сырья будет общей; если позиции разные (например, красный и обычный лук), выберите для одной из них другое сырьё или «Новое».']);
  var nNew=rows.filter(function(r){return r.isNew;}).length;
  if(nNew)notes.push(['warn','Новое сырьё ('+nNew+') добавится в базу с нулевыми значениями КБЖУ и пометкой «Ориентир»; цена запишется в регион «'+esc(regionName(g))+'». Заполните КБЖУ на вкладке «КБЖУ и потери»: там же нормы потерь (х/о, варка и др.), они подставляются по справочнику, где название узнано, их стоит проверить.']);
  if(G.dens.length)notes.push(['warn','У '+G.dens.length+' позиций в литрах (мл) не задана плотность: их цены не загрузятся, пока вы не введёте плотность или не примете допущение «1 л = 1 кг». Для масла, молока, сливок и сиропов литр заметно отличается от килограмма.']);
  var nDa=rows.filter(function(r){return r.densAcc&&(r.st==='ok'||r.st==='done');}).length;
  if(nDa)notes.push(['warn','Принято допущение «1 л = 1 кг» у '+nDa+' позиций: цена за кг у них приблизительная, пометка сохранится в сырье и в расчётах себестоимости.']);
  if(G.mass.length)notes.push(['warn','У '+G.mass.length+' штучных позиций не указана масса штуки: без неё цену за килограмм не посчитать.']);
  if(G.check.length)notes.push(['warn','Не подтверждено соответствие у '+G.check.length+' позиций: их цены не загрузятся. Подтвердите предложенное сырьё, выберите другое, создайте новое или нажмите «Не вносить».']);
  notes.push(['good','К загрузке готово цен: '+ready+' из '+P.items.length+' (уверенные совпадения и подтверждённые вами). Цены региона «'+esc(regionName(g))+'» у этих позиций будут заменены, остальные не изменятся.']);
  if(P.from){
    var latest=0,pk0=phId(g,P.from,P.to);
    phList(S.cfg,g).forEach(function(b){if(b.to>P.to)latest++;});
    if(latest)notes.push(['warn','В истории региона есть более поздние загрузки ('+latest+'): эта загрузка попадёт в историю, а цены в базе у сырья, купленного позже, не изменятся.']);
  }
  h+='<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>';
  if(t.confirm&&ready&&P.from)h+=c1ConfHtml()+'<div class="btns" style="margin-top:8px"><button class="btn" data-act="c1Cancel">Закрыть без загрузки</button></div></section>';
  else h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="c1Review" data-edit'+((ready&&P.from)?'':' disabled')+'>Проверить и загрузить '+ready+' цен…</button><button class="btn" data-act="c1Cancel">'+(G.done.length?'Закрыть':'Отмена')+'</button></div></section>';
  return h;
}
/* План загрузки. dry=true: только считает, что запишется (для экрана подтверждения), базу не меняет.
   В историю цен идут только уверенные совпадения и позиции, подтверждённые человеком; строки «Подтвердите» не загружаются */
function c1Plan(dry){
  var t=S.c1,g=curRegion(),P=t.parsed,rows=t.items.map(c1Row),pkey=P.from?phId(g,P.from,P.to):'';
  var pl={g:g,P:P,rows:rows,err:'',nNew:0,nConf:0,skipped:{check:0,none:0,mass:0,dens:0,empty:0,skip:0},built:[],changes:[],same:0,kept:0,mine:{},legacyDrop:'',ingOf:[],made:{},newName:{},rem:0};
  if(!pkey){pl.err='В отчёте не найден период';return pl;}
  rows.forEach(function(r){if(r.st==='ok')pl.nConf++;else if(pl.skipped[r.st]!==undefined)pl.skipped[r.st]++;});
  if(!pl.nConf){pl.err='Нечего загружать: нет подтверждённых позиций';return pl;}
  rows.forEach(function(r,i){
    var x=t.items[i];pl.ingOf[i]=x.ing;
    if(!r.isNew||r.st!=='ok')return;
    var k=normKey(P.items[i].name);
    if(!pl.made[k]){pl.made[k]=dry?('~'+k):addNewIng(P.items[i].name,'Добавлено из выгрузки 1С: значения КБЖУ не заполнены');pl.newName[pl.made[k]]=P.items[i].name;pl.nNew++;}
    pl.ingOf[i]=pl.made[k];
  });
  var picks=rows.map(function(r,i){return(r.st==='ok'||r.st==='done')?{ing:pl.ingOf[i],packG:r.pack,dens:r.dens||0,dAsm:r.densAcc?1:0}:null;});
  rows.forEach(function(r){if(r.st==='ok'&&r.densAssumed)pl.nDens=(pl.nDens||0)+1;});
  /* по записи истории на каждый объект */
  var groups=c1Groups(t);
  groups.forEach(function(gr){
    var its=[],pk2=[],base={},oldPv={},old=S.cfg[phId(g,P.from,P.to,gr.name)];
    if(old)old.it.forEach(function(x){if(x.pv>0)oldPv[x.ing]=x.pv;});
    P.items.forEach(function(it,i){
      if(!picks[i])return;
      var ls=it.lines.filter(function(l){return c1Slug(c1ObjFor(t,l).name)===gr.slug;});
      if(!ls.length)return;
      its.push({name:it.name,unit:it.unit,uraw:it.uraw,qty:it.qty,lines:ls});pk2.push(picks[i]);
      if(base[picks[i].ing]===undefined){
        var ig=S.ings[picks[i].ing],pk=ig?pricePerKg(ig,g):null;
        if(oldPv[picks[i].ing]>0)base[picks[i].ing]=oldPv[picks[i].ing];else if(pk!==null&&pk>0)base[picks[i].ing]=pk;
      }
    });
    if(!its.length)return;
    var b=phBuild(its,pk2,{region:g,from:P.from,to:P.to,file:t.file,wh:gr.whs.join(', '),obj:gr.name,rule:t.rule,base:base,at:Date.now()+pl.built.length});
    if(b.it.length)pl.built.push(b);
  });
  if(!pl.built.length){pl.err='Нечего загружать: нет подтверждённых позиций';return pl;}
  pl.legacyDrop=(t.dropLegacy!==false&&S.cfg[pkey]&&!pl.built.some(function(b){return!b.obj;})&&!(syPhOn()&&!syAdmin()))?pkey:'';
  var bids={};
  pl.built.forEach(function(b){bids[bId(b)]=1;if(!dry){S.cfg[bId(b)]=b;queueSave('settings',bId(b));}});
  /* цена региона за период — средневзвешенная по всем объектам, загруженным за него; более поздние загрузки не затираются */
  var all=phList(S.cfg,g).filter(function(b){return bId(b)!==pl.legacyDrop&&!(dry&&bids[bId(b)]);});
  if(dry)all=all.concat(pl.built);
  var merged=phMerge(all.filter(function(b){return phKey(b)===pkey;}))[0],later={},pcs={},pg={};
  all.forEach(function(b){if(b.to>P.to)b.it.forEach(function(x){later[x.ing]=1;});});
  pl.built.forEach(function(b){b.it.forEach(function(x){pl.mine[x.ing]=1;});});
  rows.forEach(function(r,i){if(picks[i]&&P.items[i].unit==='pc'){pcs[picks[i].ing]=true;pg[picks[i].ing]=r.pack;}});
  var perTxt=c1DateRu(P.from)+' – '+c1DateRu(P.to),nObj=merged.objs?merged.objs.length:1;
  merged.it.forEach(function(x){
    if(!pl.mine[x.ing])return;
    var ing=S.ings[x.ing];
    if(dry){
      if(later[x.ing]){pl.kept++;return;}
      var nm=ing?ing.name:(pl.newName[x.ing]||x.nm),was=ing?pricePerKg(ing,g):null;
      if(was!==null&&Math.abs(was-x.pr)<0.005)pl.same++;
      else pl.changes.push({ing:x.ing,name:nm||'Без названия',was:was,now:x.pr,isNew:!ing});
      return;
    }
    if(!ing)return;
    if(later[x.ing]){pl.kept++;return;}
    var rec=recFor(ing,g,true);
    phSetPrice(rec,x.pr,pg[x.ing]||0,!!pcs[x.ing]);
    rec.priceSrc=('1С '+perTxt+(nObj>1?' · объектов: '+nObj:'')+': '+x.nm).slice(0,200);
    queueSave('ingredients',x.ing);
  });
  pl.picks=picks;
  return pl;
}
function doC1Apply(){
  var t=S.c1;if(!t)return;
  var pl=c1Plan(false);
  if(pl.err){flash(pl.err);return;}
  var P=pl.P,rem=0;
  pl.rows.forEach(function(r,i){
    var x=t.items[i];
    if(!pl.picks[i])return;
    /* название запоминается только у подтверждённых позиций и только если отмечено «запомнить» */
    if(r.st==='ok'&&x.remember&&x.how!=='alias'&&x.how!=='exact'){addAlias(pl.ingOf[i],P.items[i].name);rem++;}
    if(P.items[i].unit==='pc'&&x.packUser>0)c1MemoSet(P.items[i].name,x.packUser);
    if((r.st==='ok'||r.st==='done')&&S.ings[pl.ingOf[i]]&&(P.items[i].unit==='l'||P.items[i].unit==='ml')){
      var gi=S.ings[pl.ingOf[i]];
      if(r.dens>0&&!r.densAcc){gi.dens=r.dens;delete gi.densAsm;queueSave('ingredients',pl.ingOf[i]);}
      else if(r.densAcc&&!(gi.dens>0)){gi.densAsm=1;queueSave('ingredients',pl.ingOf[i]);}
    }   /* подтверждённая плотность запоминается в сырье */
  });
  lsSet('kbzhu:c1rule',t.rule);
  t.objs.forEach(function(o){c1ObjMemoSet(o.key,o.name);});
  var failed=0;
  pl.built.reduce(function(p,b){return p.then(function(){return syPhPush(bId(b)).then(function(ok){if(ok===false)failed++;});});},Promise.resolve()).then(function(){
    if(failed)flash('История цен сохранена только у вас: в общую базу она не ушла'+((((S.sy.info&&S.sy.info.v)||0)<22)?'. Обновите скрипт общей базы до версии 22 (Личный кабинет)':''));
  });
  if(pl.legacyDrop)phDelete(pl.legacyDrop).then(function(ok){if(ok)renderAll();});
  var nIng=Object.keys(pl.mine).length,open=pl.skipped.check+pl.skipped.none+pl.skipped.mass+pl.skipped.dens;
  /* загруженные позиции помечаем «Уже загружено»; неразобранные остаются в карточке: их можно подтвердить и загрузить позже */
  pl.rows.forEach(function(r,i){var x=t.items[i];if(r.st==='ok'){x.ing=pl.ingOf[i];x.done=true;if(r.isNew){x.add=false;x.how='manual';}}});
  if(open){t.confirm=false;t.open.done=false;}else S.c1=null;
  S.pflt='all';
  renderAll();
  flash('Загружено цен: '+nIng+' за '+phLabel(pl.built[0])+(pl.built.length>1?'. Объектов: '+pl.built.length:'')+(pl.nNew?'. Новое сырьё: '+pl.nNew:'')+(rem?'. Запомнено названий: '+rem:'')+(pl.kept?'. В базе цены не менялись у '+pl.kept+' поз.: есть более поздняя загрузка':'')+(open?'. Не разобрано: '+open+' (остались в карточке)':''));
}
/* экран подтверждения: регион, объект, сколько строк загрузится и сколько нет, цены «было → станет» */
function c1ConfHtml(){
  var t=S.c1,pl=c1Plan(true),g=curRegion(),P=t.parsed;
  if(pl.err)return'<div class="c1conf" id="c1Conf"><p class="w-bad">'+esc(pl.err)+'</p><div class="btns"><button class="btn" data-act="c1Back">Назад к проверке</button></div></div>';
  var sk=pl.skipped,nSk=sk.check+sk.none+sk.mass+sk.dens+sk.empty+sk.skip;
  var objs=pl.built.map(function(b){return esc(b.obj||'без указания объекта')+' ('+b.it.length+' поз.)';}).join('; ');
  var up=pl.changes.filter(function(c){return c.was!==null&&c.now>c.was;}).length,dn=pl.changes.filter(function(c){return c.was!==null&&c.now<c.was;}).length,nn=pl.changes.filter(function(c){return c.was===null;}).length;
  var ch=pl.changes.slice().sort(function(a,c){var pa=a.was>0?Math.abs(a.now/a.was-1):9,pc=c.was>0?Math.abs(c.now/c.was-1):9;return pc-pa;});
  var lim=t.confAll?ch.length:40;
  var h='<div class="c1conf" id="c1Conf"><h3>Проверьте перед загрузкой</h3>'
    +'<dl class="kv"><div><dt>Регион</dt><dd>'+esc(regionName(g))+'</dd></div><div><dt>Объект</dt><dd>'+objs+'</dd></div><div><dt>Период</dt><dd>'+esc(c1DateRu(P.from)+' – '+c1DateRu(P.to))+'</dd></div>'
    +'<div><dt>Загрузится строк</dt><dd>'+pl.nConf+(pl.nNew?' (новое сырьё: '+pl.nNew+')':'')+'</dd></div>'
    +'<div><dt>Не загрузится</dt><dd>'+nSk+(nSk?' ('+[sk.check?'не подтверждено '+sk.check:'',sk.none?'не найдено '+sk.none:'',sk.mass?'нет массы штуки '+sk.mass:'',sk.skip?'не вносить '+sk.skip:'',sk.empty?'без закупок '+sk.empty:''].filter(Boolean).join(', ')+')':'')+'</dd></div></dl>';
  if(nSk&&(sk.check||sk.none||sk.mass||sk.dens))h+='<p class="hint">Неразобранные строки останутся в карточке: их можно подтвердить и загрузить позже.</p>';
  if(pl.nDens)h+='<p class="w-warn" style="margin:6px 0">Объём принят за массу (1 л = 1 кг, плотность не задана) у '+pl.nDens+' поз.: цена за кг у них приблизительная.</p>';
  h+='<p class="rgnote">Цены в базе: вырастут у <b>'+up+'</b> · снизятся у <b>'+dn+'</b> · новых <b>'+nn+'</b> · без изменений <b>'+pl.same+'</b>'+(pl.kept?' · не изменятся из-за более поздней загрузки <b>'+pl.kept+'</b>':'')+'</p>';
  if(ch.length){
    h+='<div class="c1chg"><div class="c1cr c1ch"><span>Сырьё</span><span class="r">Было, ₽/кг</span><span class="r">Станет, ₽/кг</span><span class="r">Изменение</span></div>'
      +ch.slice(0,lim).map(function(c){
        var d=(c.was>0)?(c.now/c.was-1)*100:null;
        return'<div class="c1cr"><span>'+esc(c.name)+'</span><span class="r">'+(c.was===null?'нет':money(c.was))+'</span><span class="r">'+money(c.now)+'</span><span class="r '+(d===null?'':pcCls(d))+'">'+(d===null?'новая цена':pcTxt(d))+'</span></div>';
      }).join('')+'</div>';
    if(ch.length>lim)h+='<button class="btn mini" data-act="c1ConfAll">Показать все ('+ch.length+')</button>';
  }
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="c1Apply" data-edit>Применить: загрузить '+pl.nConf+' в «'+esc(regionName(g))+'»</button><button class="btn" data-act="c1Back">Назад к проверке</button></div></div>';
  return h;
}
/* удалить запись истории (для всех, если история общая: это делает технолог) */
function phDelete(id){
  function gone(){delete S.cfg[id];S.sy.phSeen[id]=-1;queueSave('settings',id);syPersist();}
  if(!syPhOn()){gone();return Promise.resolve(true);}
  if(!syAdmin())return Promise.resolve(false);
  return syPost('phdel',{id:id},syCode()).then(function(){S.sy.phv=undefined;gone();return true;},function(e){flash(syErrText(e));return false;});
}

/* ---------- вкладка «База сырья»: подменю «КБЖУ» и «Цены» ---------- */
function bsubHtml(){
  var s=S.bsub==='price'?'price':'kbzhu';
  return'<div class="subtabs" role="tablist" aria-label="Раздел базы сырья"><button class="stab" role="tab" data-act="bsub" data-k="price" aria-selected="'+(s==='price')+'">Цены и динамика</button><button class="stab" role="tab" data-act="bsub" data-k="kbzhu" aria-selected="'+(s==='kbzhu')+'">КБЖУ и потери</button></div>';
}
function pAllRaw(){return phList(S.cfg,curRegion());}
/* история для экрана: периоды региона (объекты сложены, цена средневзвешенная); в «Анализе» можно выбрать один объект */
function pBatches(){
  var raw=pAllRaw(),f=S.pview==='an'?(S.pobj||''):'';
  if(f){
    var one=raw.filter(function(b){return(phSlug(b.obj)||'none')===f;});
    if(one.length)return one;
  }
  return phMerge(raw);
}
function pchipsHtml(bs,ix){
  var ids=Object.keys(S.ings),g=curRegion(),n=ids.length,m=0,ch=0,st=0,last=bs.length?bs[bs.length-1]:null,inLast={};
  if(last)last.it.forEach(function(x){inLast[x.ing]=1;});
  ids.forEach(function(id){
    var pk=pricePerKg(S.ings[id],g),e=ix[id];
    if(pk===null)m++;
    if(e&&e.pct!==null&&Math.abs(e.pct)>=0.5)ch++;
    if(last&&pk!==null&&!inLast[id])st++;
  });
  function chip(k,label,cnt){return'<button class="chip" data-act="pFlt" data-k="'+k+'" aria-pressed="'+((S.pflt||'all')===k)+'">'+label+' · '+cnt+'</button>';}
  return chip('all','Все',n)+chip('nop','Без цены',m)+(bs.length?chip('chg','Изменились',ch)+chip('stale','Нет в последней выгрузке',st):'');
}
function prRowHtml(id,ix){
  var i=S.ings[id],g=curRegion(),q=regRec(i,g)||{},pack=q.priceUnit==='pack',pk=pricePerKg(i,g),e=ix[id],fk='i:'+esc(id)+':';
  var dl='<span class="muted">—</span>',per='<span class="muted">—</span>',man='';
  if(e){
    per=esc(phLabel(e.last.b));
    if(e.pct!==null)dl='<span class="pdl '+pcCls(e.pct)+'">'+pcTxt(e.pct)+'</span><small>было '+money(e.prev)+'</small>';
    if(pk!==null&&Math.abs(pk-e.last.pr)>Math.max(0.02,e.last.pr*0.002))man='<small class="warnt" title="Цена в базе отличается от последней загрузки 1С ('+esc(money(e.last.pr))+' ₽/кг)">правка вручную</small>';
  }
  return'<div class="prow'+(pk===null?' nop':'')+'" data-iid="'+esc(id)+'">'
    +'<span class="pn"><b>'+esc(i.name||'Без названия')+'</b>'+(q.priceSrc?'<small title="Откуда цена">'+esc(q.priceSrc)+'</small>':'')+'</span>'
    +'<label class="cell" data-label="Цена, ₽"><input class="num" inputmode="decimal" autocomplete="off" aria-label="Цена, ₽: '+esc(i.name)+'" data-act="pPrice" data-edit data-fk="'+fk+'price" value="'+toInput(q.price===undefined?null:q.price)+'" placeholder="0"></label>'
    +'<label class="cell" data-label="Цена за"><select aria-label="Цена за: '+esc(i.name)+'" data-act="pUnit" data-edit data-fk="'+fk+'unit"><option value="kg"'+(pack?'':' selected')+'>кг (литр)</option><option value="pack"'+(pack?' selected':'')+'>шт. (упак.)</option></select></label>'
    +(pack?'<label class="cell" data-label="Масса штуки, г"><input class="num" inputmode="decimal" autocomplete="off" aria-label="Масса упаковки, г: '+esc(i.name)+'" data-act="pPack" data-edit data-fk="'+fk+'pack" value="'+toInput(q.packG===undefined?null:q.packG)+'" placeholder="г"></label>':'<span class="cell nopack" aria-hidden="true"></span>')
    +'<span class="out" data-label="₽ за кг" data-out="pk">'+priceInfoHtml(id)+'</span>'
    +'<span class="pch" data-label="Изменение">'+dl+man+'</span>'
    +'<span class="ppd" data-label="Загрузка 1С">'+per+'</span>'
    +(e?'<span class="pbt"><button class="btn mini" data-act="pBuy" data-id="'+esc(id)+'" title="Когда, на какой объект и у кого куплено: по строкам выгрузок 1С">Закупки</button><button class="btn mini" data-act="pHist" data-id="'+esc(id)+'" title="График цены">График</button></span>':'<span></span>')
    +'</div>';
}
function pListHtml(bs,ix){
  var q=(S.pq||'').trim().toLowerCase(),g=curRegion(),f=S.pflt||'all',key=S.psort||'name',last=bs.length?bs[bs.length-1]:null,inLast={};
  if(last)last.it.forEach(function(x){inLast[x.ing]=1;});
  var ids=Object.keys(S.ings).filter(function(id){
    var i=S.ings[id],pk=pricePerKg(i,g),e=ix[id];
    if(S.pDish&&!S.pDish.ids[id])return false;
    if(f==='nop'&&pk!==null)return false;
    if(f==='chg'&&!(e&&e.pct!==null&&Math.abs(e.pct)>=0.5))return false;
    if(f==='stale'&&!(last&&pk!==null&&!inLast[id]))return false;
    return!q||String(i.name).toLowerCase().indexOf(q)>-1||String((regRec(i,g)||{}).priceSrc||'').toLowerCase().indexOf(q)>-1||(i.aliases||[]).some(function(a){return a.indexOf(q)>-1;});
  });
  ids.sort(function(a,b){
    var A=S.ings[a],B=S.ings[b],c=0;
    if(key==='chg'){var pa=ix[a]&&ix[a].pct!==null?Math.abs(ix[a].pct):-1,pb=ix[b]&&ix[b].pct!==null?Math.abs(ix[b].pct):-1;c=pb-pa;}
    else if(key==='price'){var ka=pricePerKg(A,g),kb=pricePerKg(B,g);c=(kb===null?-1:kb)-(ka===null?-1:ka);}
    return c||String(A.name||'').localeCompare(String(B.name||''),'ru');
  });
  if(!Object.keys(S.ings).length)return'<div class="card empty"><h2>База сырья пуста</h2><p>Добавьте сырьё во вкладке «КБЖУ» или загрузите базу из файла.</p></div>';
  if(!ids.length)return'<p class="muted">Ничего не найдено. Измените поиск или фильтр.</p>';
  return'<div class="card"><div class="prow phead"><span>Название</span><span class="r">Цена, ₽</span><span>Цена за</span><span class="r">Масса, г</span><span class="r">₽ за кг</span><span>Изменение</span><span>Загрузка 1С</span><span></span></div>'+ids.map(function(id){return prRowHtml(id,ix);}).join('')+'</div>';
}
/* «Закупки» по сырью: строки выгрузок 1С, из которых сложена цена: дата, объект, поставщик, позиция 1С, цена за кг, количество.
   Нужно, чтобы проверить, не отнесла ли загрузка чужую позицию к этому сырью и не записала ли закупку не на тот объект */
function pBuyRows(id){
  var out=[];
  pAllRaw().forEach(function(b){
    var ob=b.obj||b.wh||'';
    b.it.forEach(function(x){
      if(x.ing!==id)return;
      x.ln.forEach(function(l){
        var ps=(x.pn&&l[4]!==undefined&&x.pn[l[4]])?x.pn[l[4]]:'';
        out.push({d:l[0],obj:ob,sup:l[1]>=0?b.sup[l[1]]:'без поставщика',pos:ps||x.nm,exact:!!ps||!/\(\+\d+\)$/.test(x.nm||''),pk:l[2],kg:l[3]});
      });
    });
  });
  out.sort(function(a,c){return a.d<c.d?1:(a.d>c.d?-1:(a.obj<c.obj?-1:(a.obj>c.obj?1:0)));});
  return out;
}
function pBuyHtml(){
  var id=S.pbuy;if(!id||!S.ings[id])return'';
  var rows=pBuyRows(id),objs=[],seen={},f=S.pbuyObj||'',h;
  function ok(o){return o===''?'__none__':o;}
  rows.forEach(function(r){if(!seen[ok(r.obj)]){seen[ok(r.obj)]=1;objs.push(r.obj);}});
  objs.sort(function(a,c){return a===''?1:(c===''?-1:(a.toLowerCase()<c.toLowerCase()?-1:1));});
  if(f&&!seen[f])f='';
  var shown=rows.filter(function(r){return!f||ok(r.obj)===f;}),kg=0,sm=0;
  shown.forEach(function(r){kg+=r.kg;sm+=r.kg*r.pk;});
  h='<section class="card pbuy" id="pBuyCard"><div class="pbuyhd"><h2>Закупки: '+esc(S.ings[id].name||'Без названия')+'</h2><button class="btn mini" data-act="pBuyX">Закрыть</button></div>';
  if(!rows.length)return h+'<p class="muted">В загруженных выгрузках 1С закупок по этому сырью нет: цена введена вручную или взята из прайса.</p></section>';
  h+='<p class="hint">Какие строки выгрузок 1С отнесены к этому сырью: когда куплено, на какой объект (склад) и у кого. Если строка попала сюда по ошибке, найдите её по колонке «Позиция в 1С» и привяжите к нужному сырью при следующей загрузке.</p>';
  if(objs.length>1){
    h+='<div class="chips" role="group" aria-label="Объект"><button class="chip" data-act="pBuyObj" data-o="" aria-pressed="'+(!f)+'">Все объекты · '+objs.length+'</button>'
      +objs.map(function(o){return'<button class="chip" data-act="pBuyObj" data-o="'+esc(ok(o))+'" aria-pressed="'+(f===ok(o))+'">'+esc(o||'Объект не указан')+'</button>';}).join('')+'</div>';
  }
  h+='<p class="rgnote">Показано закупок: <b>'+shown.length+'</b> · всего <b>'+fmt(kg,2)+'</b> кг · на <b>'+money(sm)+'</b> ₽ · средняя цена <b>'+money(kg>0?sm/kg:0)+'</b> ₽/кг</p>';
  h+='<div class="pbtbl"><div class="pbrow pbhead"><span>Дата</span><span>Объект</span><span>Поставщик</span><span>Позиция в 1С</span><span class="r">₽ за кг</span><span class="r">Кол-во, кг</span></div>'
    +shown.slice(0,400).map(function(r){
      return'<div class="pbrow"><span data-l="Дата">'+esc(c1DateRu(r.d))+'</span><span data-l="Объект">'+esc(r.obj||'не указан')+'</span><span data-l="Поставщик">'+esc(r.sup)+'</span>'
        +'<span data-l="Позиция в 1С">'+esc(r.pos)+(r.exact?'':'<small class="muted"> · в загрузке было несколько позиций, какая именно, не сохранено</small>')+'</span>'
        +'<span class="r" data-l="₽ за кг">'+money(r.pk)+'</span><span class="r" data-l="Кол-во, кг">'+fmt(r.kg,2)+'</span></div>';
    }).join('')+'</div>'+(shown.length>400?'<p class="hint">Показаны последние 400 из '+shown.length+'. Выберите объект, чтобы сузить список.</p>':'')+'</section>';
  return h;
}
function pviewHtml(bs){
  var v=S.pview==='an'?'an':(S.pview==='obj'?'obj':'tbl'),no=phObjects(pAllRaw()).length;
  return'<div class="segs" role="tablist" aria-label="Вид"><button class="seg" role="tab" data-act="pview" data-k="tbl" aria-selected="'+(v==='tbl')+'">Актуальные цены</button><button class="seg" role="tab" data-act="pview" data-k="an" aria-selected="'+(v==='an')+'">Анализ изменений'+(bs.length?' · '+bs.length:'')+'</button>'
    +((no>=2||v==='obj')?'<button class="seg" role="tab" data-act="pview" data-k="obj" aria-selected="'+(v==='obj')+'">По объектам'+(no>=2?' · '+no:'')+'</button>':'')+'</div>';
}
function cloudPriceHtml(){
  return'<details class="pgroup cloud" id="cloudPrice"'+(S.cloudOpenP?' open':'')+'><summary>Прайс по ссылке (Google Таблица, CSV)</summary>'
    +'<p class="rgtag" style="margin-top:10px">Регион «'+esc(regionName(curRegion()))+'»</p>'+cloudNoteHtml()+cloudRowHtml('price')+'</details>';
}
function viewPrices(){
  var bs=pBatches(),ix=phIndex(bs),g=curRegion();
  var paste=S.c1Paste?' open':'';
  var h='<div class="tools"><div class="btns"><button class="btn primary" data-act="pickC1" data-edit>Загрузить выгрузку 1С</button><button class="btn" data-act="pickPrice" data-edit>Загрузить прайс (.odt, .csv)</button></div></div>'
    +'<details class="pgroup c1paste" id="c1PasteBox"'+paste+'><summary>Или вставьте строки отчёта из Excel</summary><label class="field"><span class="lbl">Скопируйте таблицу отчёта 1С целиком, вместе с заголовком «Период», и вставьте сюда</span><textarea id="c1Text" rows="5" data-fk="c1Text" aria-label="Строки отчёта 1С"></textarea></label><div class="btns" style="margin-top:8px"><button class="btn" data-act="c1Paste" data-edit>Разобрать</button></div></details>'
    +c1CardHtml()+priceCardHtml()+cloudPriceHtml();
  h+=mxBoxHtml()+mxNoteHtml()+'<div class="pbar">'+pviewHtml(bs)+'</div>';
  if(S.pview==='an')return h+pAnHtml(bs)+regionsHtml();
  if(S.pview==='obj')return h+pObjHtml()+regionsHtml();
  h+='<div class="tools"><label class="field grow"><span class="lbl">Поиск по названию, источнику и позиции прайса</span><input id="psearch" data-act="pSearch" data-fk="psearch" autocomplete="off" value="'+esc(S.pq||'')+'" placeholder="Например: говядина"></label>'
    +'<div class="chips" id="pchips" style="align-self:flex-end">'+pchipsHtml(bs,ix)+'</div>'
    +'<label class="field" style="flex:0 0 190px;align-self:flex-end"><span class="lbl">Порядок</span><select data-act="pSort" data-fk="psort"><option value="name"'+((S.psort||'name')==='name'?' selected':'')+'>По названию</option><option value="chg"'+(S.psort==='chg'?' selected':'')+'>По изменению цены</option><option value="price"'+(S.psort==='price'?' selected':'')+'>По цене за кг</option></select></label></div>';
  var last=bs.length?bs[bs.length-1]:null;
  if(S.pDish)h+='<p class="rgnote pdish">Показано только сырьё '+(S.pDish.name?'блюда «'+esc(S.pDish.name)+'»':'блюд с неполной себестоимостью')+' без цены: '+S.pDish.n+'. Введите цены, и себестоимость станет полной. <button type="button" class="btn mini" data-act="pDishOff">Показать всё сырьё</button></p>';
  h+='<p class="rgnote">В списке цены региона <b>'+esc(regionName(g))+'</b>'+(regionList().length>1?'. Другой регион выбирается вверху страницы.':'.')+(last?' Последняя загрузка 1С: <b>'+esc(phLabel(last))+'</b>, цен: '+last.it.length+'.':' Загрузок 1С пока нет: после первой здесь появятся изменение цены и анализ.')+'</p>';
  h+=pBuyHtml()+'<div id="pList">'+pListHtml(bs,ix)+'</div>'
    +'<p class="hint">Цена нужна для себестоимости и калькуляции по форме ОП-1. Для штучного товара (яйцо, пакетик ванилина, полуфабрикат по 100 г) выберите «шт. (упак.)» и укажите массу одной штуки в граммах: калькулятор сам пересчитает цену в ₽ за кг. Цена, исправленная здесь вручную, действует до следующей загрузки выгрузки 1С.</p>'
    +regionsHtml();
  return h;
}

/* ---------- анализ изменений цен ---------- */
function pAnState(bs){
  var a=S.pan||(S.pan={}),cur=bs[bs.length-1],i;
  if(a.a){for(i=0;i<bs.length;i++)if(phKey(bs[i])===a.a)cur=bs[i];}
  var ci=bs.indexOf(cur),cmp=null,cmpId='';
  if(a.b==='before'){cmp=phBefore(cur);cmpId=cmp?'before':'';}
  else if(a.b){for(i=0;i<ci;i++)if(phKey(bs[i])===a.b){cmp=bs[i];cmpId=a.b;}}
  if(!cmp){
    if(ci>0){cmp=bs[ci-1];cmpId=phKey(cmp);}
    else{cmp=phBefore(cur);cmpId=cmp?'before':'';}
  }
  return{cur:cur,ci:ci,cmp:cmp,cmpId:cmpId,curId:phKey(cur)};
}
function ingName(id,nm){return S.ings[id]?S.ings[id].name:nm;}
function pBarsHtml(list,kind){
  var max=0;list.forEach(function(r){if(Math.abs(r.impact)>max)max=Math.abs(r.impact);});
  return list.map(function(r){
    var w=max>0?Math.max(2,Math.abs(r.impact)/max*100):0;
    return'<div class="vb"><span class="vn">'+esc(ingName(r.ing,r.nm))+'<small>'+money(r.old)+' → '+money(r.nw)+' ₽/кг · '+pcTxt(r.pct)+'</small></span><span class="vt" aria-hidden="true"><i class="vf '+kind+'" style="width:'+w.toFixed(1)+'%"></i></span><span class="vv '+kind+'">'+signed(r.impact,0)+' ₽</span></div>';
  }).join('');
}
function pTileHtml(label,val,sub,cls){
  return'<div class="ptile"><span class="pt1">'+label+'</span><b class="pt2 '+(cls||'')+'">'+val+'</b><span class="pt3">'+sub+'</span></div>';
}
function pCmpName(st){return st.cmpId==='before'?'цены до загрузки':phLabel(st.cmp);}
function pAnHtml(bs){
  var g=curRegion();
  if(!bs.length){
    return'<div class="card empty"><h2>Истории цен пока нет</h2><p>Загрузите выгрузку 1С за месяц: калькулятор обновит цены в базе и сохранит закупки по датам и поставщикам. После второй загрузки появится сравнение периодов: подорожавшее и подешевевшее сырьё, влияние на себестоимость блюд, сравнение поставщиков.</p><div class="btns"><button class="btn primary" data-act="pickC1" data-edit>Загрузить выгрузку 1С</button></div></div>';
  }
  var st=pAnState(bs),cur=st.cur,cmp=st.cmp,C=cmp?phCompare(cur,cmp):null,SU=phSuppliers(cur),JU=phJumps(cur,3);
  var h='<div class="card"><div class="fgrid">'
    +'<label class="field w220"><span class="lbl">Период</span><select data-act="pCur" data-fk="pcur">'+bs.slice().reverse().map(function(b){return'<option value="'+esc(phKey(b))+'"'+(phKey(b)===st.curId?' selected':'')+'>'+esc(phLabel(b))+(b.objs?' · объектов: '+b.objs.length:'')+' · '+b.it.length+' '+plural(b.it.length,['цена','цены','цен'])+'</option>';}).join('')+'</select></label>'
    +'<label class="field w220"><span class="lbl">Сравнить с</span><select data-act="pCmp" data-fk="pcmp">'
    +bs.slice(0,st.ci).reverse().map(function(b){return'<option value="'+esc(phKey(b))+'"'+(phKey(b)===st.cmpId?' selected':'')+'>'+esc(phLabel(b))+'</option>';}).join('')
    +(phBefore(cur)?'<option value="before"'+(st.cmpId==='before'?' selected':'')+'>Цены в базе до загрузки</option>':'')
    +(!cmp?'<option value="" selected>— нет —</option>':'')+'</select></label>'
    +pObjFltHtml()
    +(canDl()?'<div class="field" style="flex:0 0 auto;align-self:flex-end"><button class="btn" data-act="pCsv">Скачать историю (CSV)</button></div>':'')
    +'</div>'
    +'<p class="rgtag" style="margin-top:6px">Цены региона «'+esc(regionName(g))+'»'+pScopeTxt()+'</p>';
  var tiles='';
  tiles+=pTileHtml('Закупки за период',fmt(SU.total,0)+' ₽',cur.it.length+' '+plural(cur.it.length,['позиция','позиции','позиций'])+' · поставщиков: '+SU.list.length);
  if(C&&C.sum.index!==null){
    tiles+=pTileHtml('Индекс цен',pcTxt(C.sum.index),'к периоду «'+esc(pCmpName(st))+'»: '+signed(C.sum.impact,0)+' ₽ при тех же объёмах',pcCls(C.sum.index));
    tiles+=pTileHtml('Позиции',C.sum.up+' ▲ · '+C.sum.down+' ▼ · '+C.sum.same+' =','сравнено '+C.sum.n+' из '+cur.it.length+(C.sum.onlyNew?', новых: '+C.sum.onlyNew:''));
  }else{
    tiles+=pTileHtml('Индекс цен','—',cmp?'нет общих позиций с «'+esc(pCmpName(st))+'»':'сравнивать не с чем: это первая загрузка');
    tiles+=pTileHtml('Позиции','—','после следующей загрузки здесь появятся подорожавшие и подешевевшие');
  }
  tiles+=pTileHtml('Потенциал экономии',SU.multi.length?fmt(SU.saving,0)+' ₽':'—',SU.multi.length?'= сумма по '+SU.multi.length+' '+plural(SU.multi.length,['позиции','позиций','позиций'])+' с несколькими поставщиками: (средняя цена поставщика − лучшая цена периода) × объём, купленный у него, за период '+esc(phLabel(cur))+'. Не гарантирует, что весь объём был доступен по лучшей цене сейчас':'позиций с несколькими поставщиками нет');
  h+='<div class="ptiles">'+tiles+'</div>';
  if(C&&C.sum.index!==null)h+='<p class="hint">Индекс цен считается на корзине периода «'+esc(phLabel(cur))+'»: те же объёмы закупок по ценам «'+esc(pCmpName(st))+'» и по новым. Так сравнение не зависит от того, сколько чего купили. В расчёте только сырьё, которое есть в обоих периодах.</p>';
  h+='</div>';
  /* что изменилось сильнее всего */
  if(C&&C.rows.length){
    var ups=C.rows.filter(function(r){return r.impact>0.5;}).sort(function(a,b){return b.impact-a.impact;}).slice(0,8),
        dns=C.rows.filter(function(r){return r.impact<-0.5;}).sort(function(a,b){return a.impact-b.impact;}).slice(0,8);
    h+='<div class="card"><h2>Что сильнее всего повлияло на закупки</h2><p class="hint" style="margin:-6px 0 12px">Влияние в рублях: изменение цены за кг × объём закупки периода «'+esc(phLabel(cur))+'».</p><div class="pcols"><div><h3 class="h3 up">▲ Подорожало · '+C.sum.up+'</h3>'+(ups.length?pBarsHtml(ups,'up'):'<p class="muted">Ничего не подорожало.</p>')+'</div><div><h3 class="h3 dn">▼ Подешевело · '+C.sum.down+'</h3>'+(dns.length?pBarsHtml(dns,'dn'):'<p class="muted">Ничего не подешевело.</p>')+'</div></div></div>';
    /* блюда */
    var recs=visIds().filter(function(id){return!S.recipes[id].arch;}).map(function(id){return{id:id,r:S.recipes[id]};});
    var dsh=phDishImpact(recs,S.ings,cur,cmp,g).filter(function(d){return Math.abs(d.d)>=0.01;}).sort(function(a,b){return Math.abs(b.d)-Math.abs(a.d);});
    if(dsh.length){
      h+='<div class="card"><h2>Как изменилась себестоимость блюд</h2><p class="hint" style="margin:-6px 0 8px">Сырьё на одну порцию по ценам «'+esc(pCmpName(st))+'» и «'+esc(phLabel(cur))+'». Блюд с изменением: '+dsh.length+' из '+recs.length+'.</p><div class="scroll" style="margin-top:0"><table><thead><tr><th>Блюдо</th><th>Было, ₽</th><th>Стало, ₽</th><th>Δ, ₽</th><th>Δ, %</th></tr></thead><tbody>'
        +dsh.slice(0,10).map(function(d){return'<tr><th scope="row">'+esc(d.name)+(d.complete?'':' <span class="muted" title="В блюде есть сырьё без цены">*</span>')+'</th><td class="n">'+money(d.old)+'</td><td class="n">'+money(d.nw)+'</td><td class="n"><span class="pdl '+pcCls(d.pct||0)+'">'+signed(d.d,2)+'</span></td><td class="n"><span class="pdl '+pcCls(d.pct||0)+'">'+pcTxt(d.pct)+'</span></td></tr>';}).join('')
        +'</tbody></table></div>'+(dsh.length>10?'<p class="hint">Показаны 10 блюд с самым большим изменением.</p>':'')+'</div>';
    }
  }
  /* поставщики */
  if(SU.list.length){
    h+='<div class="card"><h2>Поставщики за период</h2><div class="scroll" style="margin-top:0"><table><thead><tr><th>Поставщик</th><th>Закупки, ₽</th><th>Доля</th><th>Позиций</th><th title="Насколько цены поставщика выше лучших цен периода по позициям, где есть выбор">Дороже лучшей цены</th></tr></thead><tbody>'
      +SU.list.slice(0,12).map(function(s){return'<tr><th scope="row">'+esc(s.name)+'</th><td class="n">'+fmt(s.spend,0)+'</td><td class="n">'+fmt(s.share,1)+' %</td><td class="n">'+s.items+'</td><td class="n">'+(s.over===null?'—':'<span class="pdl '+(s.over>=0.5?'up':'eq')+'">'+(s.over>=0.5?'▲ ':'')+signed(s.over,1)+' %</span>')+'</td></tr>';}).join('')+'</tbody></table></div>';
    if(SU.multi.length){
      h+='<h3 class="h3" style="margin-top:18px">Потенциал экономии по сырью</h3><p class="hint" style="margin:-4px 0 8px">Формула: для каждого поставщика (его средняя цена − лучшая средняя цена периода) × объём, купленный у него. Сравнивается один период и один регион; НДС, условия доставки, фасовка и доступность всего объёма по лучшей цене не учитываются: прошлая низкая цена не значит, что весь объём можно купить по ней сейчас. Показатель ориентир, а не обещанная экономия.</p><div class="scroll" style="margin-top:0"><table><thead><tr><th>Сырьё</th><th>Цены поставщиков, ₽/кг</th><th>Разброс</th><th>Потенциал, ₽</th></tr></thead><tbody>'
        +SU.multi.slice(0,10).map(function(m){return'<tr><th scope="row">'+esc(ingName(m.ing,m.nm))+'</th><td class="n sups">'+m.rows.map(function(r){return'<span>'+esc(r.name)+' <b>'+money(r.avg)+'</b></span>';}).join('')+'</td><td class="n">'+fmt(m.spread,1)+' %</td><td class="n">'+fmt(m.saving,0)+'</td></tr>';}).join('')+'</tbody></table></div>';
    }
    h+='</div>';
  }
  /* скачки у одного поставщика */
  if(JU.length){
    h+='<div class="card"><h2>Цены менялись внутри периода</h2><p class="hint" style="margin:-6px 0 8px">Один и тот же поставщик продал позицию по разной цене: от первой закупки периода к последней. Изменение не меньше 3 %.</p><div class="scroll" style="margin-top:0"><table><thead><tr><th>Сырьё</th><th>Поставщик</th><th>Было</th><th>Стало</th><th>Δ, %</th></tr></thead><tbody>'
      +JU.slice(0,10).map(function(j){return'<tr><th scope="row">'+esc(ingName(j.ing,j.nm))+'</th><td>'+esc(j.sup)+'</td><td class="n">'+money(j.p1)+' <small class="muted">'+esc(c1DateRu(j.d1).slice(0,5))+'</small></td><td class="n">'+money(j.p2)+' <small class="muted">'+esc(c1DateRu(j.d2).slice(0,5))+'</small></td><td class="n"><span class="pdl '+pcCls(j.pct)+'">'+pcTxt(j.pct)+'</span></td></tr>';}).join('')+'</tbody></table></div>'+(JU.length>10?'<p class="hint">Показаны 10 самых заметных изменений из '+JU.length+'.</p>':'')+'</div>';
  }
  /* график по сырью */
  var all=phIndex(bs),opts=Object.keys(all).sort(function(a,b){return String(ingName(a,'')).localeCompare(String(ingName(b,'')),'ru');});
  var sel=S.pan.ing;
  if(!sel||!all[sel]){
    var best='',bs0=-1;
    cur.it.forEach(function(x){var sp=phSpend(x);if(sp>bs0){bs0=sp;best=x.ing;}});
    sel=S.pan.ing=best||opts[0]||'';
  }
  h+='<div class="card" id="pChartCard"><h2>Динамика цены сырья</h2><div class="fgrid"><label class="field"><span class="lbl">Сырьё</span><select data-act="pIng" data-fk="ping">'+opts.map(function(id){return'<option value="'+esc(id)+'"'+(id===sel?' selected':'')+'>'+esc(ingName(id,all[id].last.x.nm))+'</option>';}).join('')+'</select></label></div>'
    +'<div class="pchart" id="pChart"></div>'+pSeriesTableHtml(bs,sel)+'</div>';
  /* загрузки */
  var rawAll=pAllRaw();
  h+='<div class="card"><h2>Загрузки 1С в истории · '+rawAll.length+'</h2><div class="arows">'+rawAll.slice().reverse().map(function(b){
    return'<div class="arow"><div class="mn"><b>'+esc(phLabel(b))+(b.obj?' · '+esc(b.obj):'')+'</b><small>'+esc(c1DateRu(b.from)+' – '+c1DateRu(b.to))+' · цен: '+b.it.length+' · '+esc(PH_RULES[b.rule].toLowerCase())+(b.file?' · файл «'+esc(b.file)+'»':'')+(b.at?' · загружено '+esc(new Date(b.at).toLocaleDateString('ru-RU')):'')+'</small></div><div class="mbtns">'+(syPhOn()&&!syAdmin()?'':'<button class="btn mini danger" data-act="pDel" data-edit data-id="'+esc(bId(b))+'">Удалить запись</button>')+'</div></div>';
  }).join('')+'</div><p class="hint">Удаление записи убирает её из истории и анализа'+(syPhOn()?' у всех':'')+'. Цены в базе сырья при этом не меняются.'+(syPhOn()?' История общая: её видят все, у кого открыты цены, кто бы ни загрузил выгрузку 1С.':'')+'</p></div>';
  return h;
}
/* ---------- объекты: фильтр в анализе и отчёт «По объектам» ---------- */
function pObjLabel(o){return o||'Без объекта';}
function pObjFltHtml(){
  var objs=phObjects(pAllRaw());
  if(objs.length<2)return'';
  var cur=S.pobj||'';
  return'<label class="field w220"><span class="lbl">Объект</span><select data-act="pObjF" data-fk="pobjf"><option value="">Все объекты (средневзвешенная)</option>'
    +objs.map(function(o){var sl=phSlug(o)||'none';return'<option value="'+sl+'"'+(sl===cur?' selected':'')+'>'+esc(pObjLabel(o))+'</option>';}).join('')+'</select></label>';
}
function pScopeTxt(){
  var objs=phObjects(pAllRaw());
  if(objs.length<2)return'';
  var f=S.pobj||'',i;
  if(f){for(i=0;i<objs.length;i++)if((phSlug(objs[i])||'none')===f)return' · объект «'+esc(pObjLabel(objs[i]))+'»';}
  return' · средневзвешенные по объектам';
}
function pObjState(raw){
  var ps=phObjPeriods(raw).filter(function(p){return p.objs.length>=2;}),a=S.pob||(S.pob={}),cur=ps.length?ps[ps.length-1]:null,i;
  if(a.k){for(i=0;i<ps.length;i++)if(ps[i].key===a.k)cur=ps[i];}
  return{ps:ps,cur:cur};
}
function pObjCell(r,o){
  var p=r.by[o];
  if(!p)return'<td class="n"><span class="muted">—</span></td>';
  var cls=r.spread>=0.5?(o===r.best?'dn':(o===r.worst?'up':'eq')):'eq';
  return'<td class="n"><span class="pdl '+cls+'">'+money(p.pr)+'</span></td>';
}
function pObjHtml(){
  var raw=pAllRaw(),objs=phObjects(raw),g=curRegion();
  if(objs.length<2){
    return'<div class="card empty"><h2>Сравнивать объекты пока не с чем</h2><p>Загрузите выгрузки 1С по складам разных объектов за один и тот же период: отдельным файлом на каждый склад или одним файлом, где склады идут в строках. Калькулятор запишет каждому объекту свою историю цен и покажет, где какое сырьё покупают дороже. Объект определяется по складу в файле.</p><div class="btns"><button class="btn primary" data-act="pickC1" data-edit>Загрузить выгрузку 1С</button></div></div>';
  }
  var st=pObjState(raw);
  if(!st.cur){
    return'<div class="card empty"><h2>Нет периода, загруженного по двум объектам</h2><p>Объекты в истории есть ('+objs.map(function(o){return esc(pObjLabel(o));}).join(', ')+'), но за один и тот же период загружен только один из них. Загрузите выгрузки с других складов за тот же период: тогда появится сравнение цен.</p><div class="btns"><button class="btn primary" data-act="pickC1" data-edit>Загрузить выгрузку 1С</button></div></div>';
  }
  var C=phObjCompare(raw,st.cur.key),a=S.pob,h='';
  h+='<div class="card"><div class="fgrid"><label class="field w220"><span class="lbl">Период</span><select data-act="pObjP" data-fk="pobjp">'
    +st.ps.slice().reverse().map(function(p){return'<option value="'+esc(p.key)+'"'+(p.key===st.cur.key?' selected':'')+'>'+esc(phLabel(p))+' · объектов: '+p.objs.length+'</option>';}).join('')+'</select></label>'
    +(canDl()?'<div class="field" style="flex:0 0 auto;align-self:flex-end"><button class="btn" data-act="pObjCsv">Скачать сравнение (CSV)</button></div>':'')+'</div>'
    +'<p class="rgtag" style="margin-top:6px">Цены региона «'+esc(regionName(g))+'»</p>';
  var spr=0;C.rows.forEach(function(r){spr+=r.spread;});
  var tiles=pTileHtml('Объектов в сравнении',String(C.objs.length),C.objs.map(function(o){return esc(pObjLabel(o));}).join(', '))
    +pTileHtml('Сырья в сравнении',String(C.rows.length),C.single?'ещё '+C.single+' '+plural(C.single,['позицию','позиции','позиций'])+' купил только один объект':'все позиции покупали несколько объектов')
    +pTileHtml('Средний разброс цен',C.rows.length?fmt(spr/C.rows.length,1)+' %':'—','между самой низкой и самой высокой ценой объектов')
    +pTileHtml('Потенциал экономии между объектами',C.rows.length?fmt(C.total.saving,0)+' ₽':'—','= (цена объекта − лучшая цена среди объектов) × объём объекта, только по сырью, купленному минимум двумя объектами. Допущение: по лучшей цене можно было купить весь его объём; поставщики и условия доставки разные');
  h+='<div class="ptiles">'+tiles+'</div></div>';
  /* по объектам */
  h+='<div class="card"><h2>Объекты за период</h2><p class="hint" style="margin:-6px 0 8px">Переплата — насколько корзина объекта дороже, чем она же по средневзвешенным ценам региона. В корзине только сырьё, которое покупали минимум два объекта.</p><div class="scroll" style="margin-top:0"><table><thead><tr><th>Объект</th><th>Закупки за период, ₽</th><th>В сравнении, ₽</th><th>Дороже средней цены региона</th><th>Потенциал экономии, ₽</th><th>Самая низкая цена</th></tr></thead><tbody>'
    +C.per.map(function(q){return'<tr><th scope="row">'+esc(pObjLabel(q.obj))+'</th><td class="n">'+fmt(q.all,0)+'</td><td class="n">'+fmt(q.spend,0)+'</td><td class="n">'+(q.over===null?'—':'<span class="pdl '+(q.over>=0.5?'up':(q.over<=-0.5?'dn':'eq'))+'">'+pcTxt(q.over)+'</span>')+'</td><td class="n">'+fmt(q.saving,0)+'</td><td class="n">'+q.cheapest+' из '+q.n+'</td></tr>';}).join('')+'</tbody></table></div></div>';
  /* сырьё */
  var lim=(a&&a.all)?C.rows.length:30,shown=C.rows.slice(0,lim);
  h+='<div class="card"><h2>Цены сырья по объектам, ₽/кг</h2><p class="hint" style="margin:-6px 0 8px">Зелёным — самая низкая цена, красным — самая высокая. Сверху те, где разница дороже всего обходится в рублях.</p>';
  if(!C.rows.length)h+='<p class="muted">Общих позиций у объектов за этот период нет.</p>';
  else{
    h+='<div class="scroll" style="margin-top:0"><table><thead><tr><th>Сырьё</th>'+C.objs.map(function(o){return'<th>'+esc(pObjLabel(o))+'</th>';}).join('')+'<th>Регион</th><th>Разброс</th><th>Потенциал, ₽</th></tr></thead><tbody>'
      +shown.map(function(r){return'<tr><th scope="row">'+esc(ingName(r.ing,r.nm))+'</th>'+C.objs.map(function(o){return pObjCell(r,o);}).join('')+'<td class="n">'+money(r.avg)+'</td><td class="n">'+fmt(r.spread,1)+' %</td><td class="n">'+fmt(r.saving,0)+'</td></tr>';}).join('')+'</tbody></table></div>';
    if(C.rows.length>lim)h+='<div class="btns" style="margin-top:8px"><button class="btn" data-act="pObjAll">Показать все · '+C.rows.length+'</button></div>';
  }
  h+='</div>';
  /* динамика */
  var have={};raw.forEach(function(b){b.it.forEach(function(x){have[x.ing]=1;});});
  var opts=Object.keys(have).sort(function(x,y){return String(ingName(x,'')).localeCompare(String(ingName(y,'')),'ru');});
  var sel=a&&a.ing;
  if(!sel||!have[sel]){sel=S.pob.ing=C.rows.length?C.rows[0].ing:(opts[0]||'');}
  h+='<div class="card" id="pObjCard"><h2>Динамика цены по объектам</h2><div class="fgrid"><label class="field"><span class="lbl">Сырьё</span><select data-act="pObjI" data-fk="pobji">'
    +opts.map(function(id){return'<option value="'+esc(id)+'"'+(id===sel?' selected':'')+'>'+esc(ingName(id,''))+'</option>';}).join('')+'</select></label></div>'
    +'<div class="pchart" id="pObjChart"></div>'+pObjSeriesTableHtml(raw,sel)+'</div>';
  return h;
}
function pObjSeriesTableHtml(raw,ing){
  var sr=phObjSeries(raw,ing);
  if(!sr.pts.length)return'';
  return'<details class="pgroup"><summary>Таблица данных</summary><div class="scroll" style="margin-top:6px"><table><thead><tr><th>Период</th>'+sr.objs.map(function(o){return'<th>'+esc(pObjLabel(o))+'</th>';}).join('')+'<th>Регион</th></tr></thead><tbody>'
    +sr.pts.map(function(p){return'<tr><th scope="row">'+esc(phLabel(p))+'</th>'+sr.objs.map(function(o){return p.by[o]?'<td class="n">'+money(p.by[o].pr)+'</td>':'<td class="n"><span class="muted">—</span></td>';}).join('')+'<td class="n">'+(p.reg===null?'—':money(p.reg))+'</td></tr>';}).join('')+'</tbody></table></div></details>';
}
function pObjCsvRows(C){
  var rows=[['Период','Сырьё'].concat(C.objs.map(pObjLabel),['Регион, средневзвешенная','Разброс, %','Потенциал экономии, ₽'])];
  C.rows.forEach(function(r){rows.push([phLabel({from:C.from,to:C.to}),ingName(r.ing,r.nm)].concat(C.objs.map(function(o){return r.by[o]?r.by[o].pr:'';}),[r.avg,r.spread,r.saving]));});
  return rows;
}
function pChartWire(box){
  if(box.getAttribute('data-b'))return;
  box.setAttribute('data-b','1');
  box.addEventListener('pointerover',pChartTip);
  box.addEventListener('pointermove',pChartTip);
  box.addEventListener('pointerdown',pChartTip);
  box.addEventListener('pointerleave',function(){var t=box.querySelector('.ptip');if(t)t.hidden=true;});
}
function pObjChartDraw(){
  var box=$('#pObjChart');if(!box)return;
  var raw=pAllRaw(),ing=S.pob&&S.pob.ing,sr=phObjSeries(raw,ing),pts=sr.pts;
  if(!pts.length){box.innerHTML='<p class="muted">Для этого сырья нет данных в загрузках 1С.</p>';return;}
  var W=Math.max(300,Math.floor(box.clientWidth||680)),H=W<560?250:290,mL=W<560?46:56,mR=12,mT=16,mB=32,pw=W-mL-mR,ph=H-mT-mB;
  var d0=Infinity,d1=-Infinity,lo=Infinity,hi=-Infinity;
  function mid(p){return(dayNum(p.from)+dayNum(p.to))/2;}
  pts.forEach(function(p){
    d0=Math.min(d0,dayNum(p.from));d1=Math.max(d1,dayNum(p.to));
    Object.keys(p.by).forEach(function(o){lo=Math.min(lo,p.by[o].pr);hi=Math.max(hi,p.by[o].pr);});
  });
  if(d1<=d0)d1=d0+1;
  var pad=Math.max(1,(d1-d0)*0.04);d0-=pad;d1+=pad;
  var yr=hi-lo;if(yr<=0)yr=Math.max(1,hi*0.1);
  lo=Math.max(0,lo-yr*0.15);hi=hi+yr*0.15;
  var step=pNice(hi-lo,4),ticks=[],v;
  for(v=Math.ceil(lo/step-1e-9)*step;v<=hi+1e-9;v+=step)ticks.push(v);
  var dec=step>=1?0:(step>=0.1?1:2);
  function X(d){return mL+pw*(d-d0)/(d1-d0);}
  function Y(q){return mT+ph*(1-(q-lo)/(hi-lo));}
  function R(q){return Math.round(q*10)/10;}
  var yearTick=(d1-d0)>300;
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="График цены за килограмм по объектам и периодам. Те же данные в таблице ниже.">';
  ticks.forEach(function(q){s+='<line class="gl" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+R(Y(q))+'" y2="'+R(Y(q))+'"/><text x="'+(mL-6)+'" y="'+R(Y(q)+4)+'" text-anchor="end">'+fmt(q,dec)+'</text>';});
  s+='<text x="'+mL+'" y="10">₽ за кг</text>';
  var nx=W<560?4:6,k;
  for(k=0;k<=nx;k++){
    var dd=d0+pad+(d1-d0-2*pad)*k/nx;
    s+='<text x="'+R(X(dd))+'" y="'+(H-10)+'" text-anchor="'+(k===0?'start':(k===nx?'end':'middle'))+'">'+dayStr(Math.round(dd),yearTick)+'</text>';
  }
  /* регион: пунктир по средневзвешенной цене */
  var rp=pts.filter(function(p){return p.reg!==null;}),i;
  for(i=1;i<rp.length;i++)s+='<line class="cn" x1="'+R(X(mid(rp[i-1])))+'" x2="'+R(X(mid(rp[i])))+'" y1="'+R(Y(rp[i-1].reg))+'" y2="'+R(Y(rp[i].reg))+'"/>';
  /* линия объекта */
  sr.objs.forEach(function(o,oi){
    var cls=oi<5?'s'+oi:'so',on=pts.filter(function(p){return p.by[o];}),d='';
    on.forEach(function(p,j){d+=(j?'L':'M')+R(X(mid(p)))+' '+R(Y(p.by[o].pr))+' ';});
    if(on.length>1)s+='<path class="ol '+cls+'" d="'+d+'"/>';
    on.forEach(function(p){
      var cx=R(X(mid(p))),cy=R(Y(p.by[o].pr)),tip=phLabel(p)+'|'+pObjLabel(o)+': '+money(p.by[o].pr)+' ₽/кг|закупок: '+p.by[o].n+', объём '+fmt(p.by[o].kg,1)+' кг'+(p.reg!==null?'|средневзвешенная по региону: '+money(p.reg)+' ₽/кг':'');
      s+='<circle class="dt '+cls+'" cx="'+cx+'" cy="'+cy+'" r="4.5"/><circle class="hit" cx="'+cx+'" cy="'+cy+'" r="11" data-tip="'+esc(tip)+'"/>';
    });
  });
  s+='</svg>';
  var lg=sr.objs.map(function(o,oi){return'<span><i class="lgd '+(oi<5?'s'+oi:'so')+'"></i>'+esc(pObjLabel(o))+'</span>';}).join('')+'<span><i class="lgl rg"></i>Регион (средневзвешенная)</span>';
  box.innerHTML=s+'<div class="plegend">'+lg+'</div><div class="ptip" hidden></div>';
  pChartWire(box);
}
function pChartsDraw(){
  if(S.pview==='an')pChartDraw();else if(S.pview==='obj')pObjChartDraw();
}
function pSeriesTableHtml(bs,ing){
  var s=phSeries(bs,ing);
  if(!s.length)return'';
  return'<details class="pgroup"><summary>Таблица данных</summary><div class="scroll" style="margin-top:6px"><table><thead><tr><th>Период</th><th>Цена за кг</th><th>Мин.</th><th>Макс.</th><th>Объём, кг</th><th>Закупок</th></tr></thead><tbody>'
    +s.map(function(p){return'<tr><th scope="row">'+esc(phLabel(p))+'</th><td class="n">'+money(p.pr)+'</td><td class="n">'+money(p.min)+'</td><td class="n">'+money(p.max)+'</td><td class="n">'+fmt(p.kg,2)+'</td><td class="n">'+p.n+'</td></tr>';}).join('')+'</tbody></table></div></details>';
}
function dayNum(iso){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));return m?Math.round(Date.UTC(+m[1],+m[2]-1,+m[3])/86400000):0;}
function dayStr(n,withYear){
  var d=new Date(n*86400000);function z(v){return(v<10?'0':'')+v;}
  return z(d.getUTCDate())+'.'+z(d.getUTCMonth()+1)+(withYear?'.'+String(d.getUTCFullYear()).slice(2):'');
}
function pNice(range,n){var raw=range/n,mag=Math.pow(10,Math.floor(Math.log(raw)/Math.LN10)),f=raw/mag;return(f<1.5?1:(f<3?2:(f<7?5:10)))*mag;}
function pChartDraw(){
  var box=$('#pChart');if(!box)return;
  var bs=pBatches(),ing=S.pan&&S.pan.ing,pts=[],order=phSupOrder(bs);
  bs.forEach(function(b){b.it.forEach(function(x){if(x.ing===ing)pts.push({b:b,x:x});});});
  if(!pts.length){box.innerHTML='<p class="muted">Для этого сырья нет данных в загрузках 1С.</p>';return;}
  var W=Math.max(300,Math.floor(box.clientWidth||680)),H=W<560?250:290,mL=W<560?46:56,mR=12,mT=16,mB=32,pw=W-mL-mR,ph=H-mT-mB;
  var d0=Infinity,d1=-Infinity,lo=Infinity,hi=-Infinity,used={};
  pts.forEach(function(p){
    d0=Math.min(d0,dayNum(p.b.from));d1=Math.max(d1,dayNum(p.b.to));lo=Math.min(lo,p.x.pr);hi=Math.max(hi,p.x.pr);
    p.x.ln.forEach(function(l){lo=Math.min(lo,l[2]);hi=Math.max(hi,l[2]);if(l[1]>=0)used[p.b.sup[l[1]]]=1;});
  });
  if(d1<=d0)d1=d0+1;
  var pad=Math.max(1,(d1-d0)*0.03);d0-=pad;d1+=pad;
  var yr=hi-lo;if(yr<=0)yr=Math.max(1,hi*0.1);
  lo=Math.max(0,lo-yr*0.15);hi=hi+yr*0.15;
  var step=pNice(hi-lo,4),ticks=[],v;
  for(v=Math.ceil(lo/step-1e-9)*step;v<=hi+1e-9;v+=step)ticks.push(v);
  var dec=step>=1?0:(step>=0.1?1:2);
  function X(d){return mL+pw*(d-d0)/(d1-d0);}
  function Y(q){return mT+ph*(1-(q-lo)/(hi-lo));}
  function R(q){return Math.round(q*10)/10;}
  var yearTick=(d1-d0)>300;
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="График цены за килограмм по периодам и закупкам поставщиков. Те же данные в таблице ниже.">';
  ticks.forEach(function(q){s+='<line class="gl" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+R(Y(q))+'" y2="'+R(Y(q))+'"/><text x="'+(mL-6)+'" y="'+R(Y(q)+4)+'" text-anchor="end">'+fmt(q,dec)+'</text>';});
  s+='<text x="'+mL+'" y="10">₽ за кг</text>';
  var nx=W<560?4:6,k;
  for(k=0;k<=nx;k++){
    var dd=d0+pad+(d1-d0-2*pad)*k/nx;
    s+='<text x="'+R(X(dd))+'" y="'+(H-10)+'" text-anchor="'+(k===0?'start':(k===nx?'end':'middle'))+'">'+dayStr(Math.round(dd),yearTick)+'</text>';
  }
  var i,p,q;
  for(i=1;i<pts.length;i++){
    p=pts[i-1];q=pts[i];
    s+='<line class="cn" x1="'+R(X(dayNum(p.b.to)))+'" x2="'+R(X(dayNum(q.b.from)))+'" y1="'+R(Y(p.x.pr))+'" y2="'+R(Y(q.x.pr))+'"/>';
  }
  pts.forEach(function(p){
    var x1=R(X(dayNum(p.b.from))),x2=R(X(dayNum(p.b.to))),y=R(Y(p.x.pr)),tip=phLabel(p.b)+'|Цена периода: '+money(p.x.pr)+' ₽/кг|'+PH_RULES[p.b.rule].toLowerCase()+'|закупок: '+p.x.ln.length+', объём '+fmt(phKg(p.x),1)+' кг';
    s+='<line class="ps" x1="'+x1+'" x2="'+x2+'" y1="'+y+'" y2="'+y+'"/><line class="hit" x1="'+x1+'" x2="'+x2+'" y1="'+y+'" y2="'+y+'" data-tip="'+esc(tip)+'"/>';
  });
  pts.forEach(function(p){
    p.x.ln.forEach(function(l){
      var nm=l[1]>=0?p.b.sup[l[1]]:'без поставщика',cls=l[1]>=0?pSupCls(order,nm):'so',cx=R(X(dayNum(l[0]))),cy=R(Y(l[2])),tip=c1DateRu(l[0])+' · '+nm+'|'+money(l[2])+' ₽/кг|'+fmt(l[3],2)+' кг';
      s+='<circle class="dt '+cls+'" cx="'+cx+'" cy="'+cy+'" r="4"/><circle class="hit" cx="'+cx+'" cy="'+cy+'" r="10" data-tip="'+esc(tip)+'"/>';
    });
  });
  s+='</svg>';
  var lg='<span><i class="lgl"></i>Цена периода</span>',shown=0,other=false;
  order.forEach(function(n,idx){
    if(!used[n])return;
    if(idx<5){lg+='<span><i class="lgd s'+idx+'"></i>'+esc(n)+'</span>';shown++;}else other=true;
  });
  if(other)lg+='<span><i class="lgd so"></i>Прочие поставщики</span>';
  box.innerHTML=s+'<div class="plegend">'+lg+'</div><div class="ptip" id="pTip" hidden></div>';
  pChartWire(box);
}
function pSupCls(order,name){var k=order.indexOf(name);return(k>-1&&k<5)?'s'+k:'so';}
function pChartTip(e){
  var box=(e.currentTarget&&e.currentTarget.querySelector)?e.currentTarget:$('#pChart'),tip=box?box.querySelector('.ptip'):null,el=e.target&&e.target.closest?e.target.closest('[data-tip]'):null;
  if(!box||!tip)return;
  if(!el){tip.hidden=true;return;}
  var parts=el.getAttribute('data-tip').split('|');
  tip.textContent='';
  parts.forEach(function(s,k){var d=document.createElement('div');if(k===0)d.className='tn1';d.textContent=s;tip.appendChild(d);});
  tip.hidden=false;
  var rc=box.getBoundingClientRect(),x=e.clientX-rc.left,y=e.clientY-rc.top,tw=tip.offsetWidth,th=tip.offsetHeight;
  var left=x+14;if(left+tw>rc.width)left=x-14-tw;if(left<0)left=0;
  var top=y-th-10;if(top<0)top=y+14;
  tip.style.left=left+'px';tip.style.top=top+'px';
}

