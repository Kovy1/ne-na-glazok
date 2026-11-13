/* ---------- цены сырья и загрузка прайса ---------- */
function todayRu(){var d=new Date();function z(n){return(n<10?'0':'')+n;}return z(d.getDate())+'.'+z(d.getMonth()+1)+'.'+d.getFullYear();}
function priceNum(s){
  var t=String(s==null?'':s).replace(/[\s ₽]/g,'').replace(/руб\.?$/i,'').replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(t))return null;
  return Number(t);
}
function cleanPriceName(s){return String(s==null?'':s).replace(/^[\s\-–•]+/,'').replace(/\s+/g,' ').trim();}
var ODT_T='urn:oasis:names:tc:opendocument:xmlns:table:1.0',ODT_X='urn:oasis:names:tc:opendocument:xmlns:text:1.0';
function odtRows(xml){
  var doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('xml');
  var rows=[];
  Array.prototype.forEach.call(doc.getElementsByTagNameNS(ODT_T,'table-row'),function(tr){
    var cells=[];
    Array.prototype.forEach.call(tr.childNodes,function(c){
      if(c.nodeType!==1||c.namespaceURI!==ODT_T||(c.localName!=='table-cell'&&c.localName!=='covered-table-cell'))return;
      var t=[];
      Array.prototype.forEach.call(c.getElementsByTagNameNS(ODT_X,'p'),function(p){var s=p.textContent.replace(/\s+/g,' ').trim();if(s)t.push(s);});
      var rep=Math.min(Number(c.getAttributeNS(ODT_T,'number-columns-repeated'))||1,4);
      for(var k=0;k<rep;k++)cells.push(t.join(' '));
    });
    if(cells.some(Boolean))rows.push(cells);
  });
  return rows;
}
function startPrice(rows,fileName){
  var items=[];
  rows.forEach(function(cells){
    var name=cleanPriceName(cells[0]);
    if(!name)return;
    var price=null,k;
    for(k=1;k<cells.length;k++){var v=priceNum(cells[k]);if(v!==null){price=v;break;}}
    if(price===null&&/^(наименование|название|продукт|товар)/i.test(name))return;
    var mt=matchIng(name,S.ings),pick=mt.id;
    if(mt.how==='fuzzy'&&mt.score<0.6)pick='';
    items.push({name:name,price:price,ing:pick,how:pick?mt.how:'none',score:mt.score,guess:mt.id,remember:mt.how==='fuzzy'&&!!pick,add:false});
  });
  S.price={file:fileName,items:items};
  S.tab='base';S.bsub='price';S.pview='tbl';renderAll();
  var c=$('#priceCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
}
function onPriceFile(file){
  if(!file)return;
  var ext=(/\.([a-z0-9]+)$/i.exec(file.name)||[])[1];ext=(ext||'').toLowerCase();
  if(ext==='odt'){
    if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .odt. Нужен современный Chrome, Edge, Firefox или Safari.');return;}
    var fr=new FileReader();
    fr.onerror=function(){flash('Не удалось прочитать файл');};
    fr.onload=function(){
      unzipEntry(fr.result,'content.xml').then(function(u8){
        if(!u8)throw new Error('nodoc');
        var rows=odtRows(new TextDecoder('utf-8').decode(u8));
        if(!rows.length)throw new Error('empty');
        startPrice(rows,file.name);
      }).catch(function(){flash('Не удалось разобрать файл. Подойдёт таблица из двух колонок: название и цена.');});
    };
    fr.readAsArrayBuffer(file);
  }else if(ext==='csv'||ext==='tsv'||ext==='txt'){
    readTextFile(file,function(err,text){
      if(err){flash('Не удалось прочитать файл');return;}
      var rows=parseRecords(text);
      if(!rows.length){flash('В файле нет строк');return;}
      startPrice(rows,file.name);
    });
  }else flash('Нужен файл .odt, .csv, .tsv или .txt: две колонки, название и цена за килограмм');
}
/* ориентировочные нормы потерь, %: х/о — отходы при холодной обработке (из брутто получается нетто), остальное — потери массы при тепловой обработке.
   Значения типовые, по названию сырья; перед работой сверьте их со своим сборником и поправьте в строке сырья («КБЖУ и потери») */
var LOSS_REF=[
  {re:/картоф|картошк/,cold:25,boil:3,fry:30,stew:5,bake:15},
  {re:/морков/,cold:20,boil:6,fry:null,stew:18,bake:20},
  {re:/свёкл|свекл/,cold:20,boil:8,fry:null,stew:18,bake:20},
  {re:/лук.?порей/,cold:40,boil:null,fry:null,stew:null,bake:null},
  {re:/зел[её]н.* лук|лук.* зел[её]н|перо лука/,cold:20,boil:null,fry:null,stew:null,bake:null},
  {re:/(^|\s)лук|репчат/,cold:16,boil:null,fry:40,stew:30,bake:null},
  {re:/цветн.* капуст|капуст.* цветн/,cold:40,boil:5,fry:null,stew:null,bake:null},
  {re:/брокколи/,cold:25,boil:5,fry:null,stew:null,bake:null},
  {re:/капуст/,cold:20,boil:10,fry:null,stew:28,bake:null},
  {re:/чеснок/,cold:20,boil:null,fry:null,stew:null,bake:null},
  {re:/огурц/,cold:5,boil:null,fry:null,stew:null,bake:null},
  {re:/помидор|томат(?!н)/,cold:5,boil:null,fry:null,stew:null,bake:null},
  {re:/перец.*(сладк|болгар)|(сладк|болгар).*перец/,cold:25,boil:null,fry:null,stew:null,bake:null},
  {re:/кабач/,cold:20,boil:null,fry:null,stew:null,bake:null},
  {re:/баклажан/,cold:10,boil:null,fry:null,stew:null,bake:null},
  {re:/тыкв/,cold:25,boil:null,fry:null,stew:null,bake:null},
  {re:/сельдерей/,cold:35,boil:null,fry:null,stew:null,bake:null},
  {re:/петрушк|укроп|кинза|базилик|зелень/,cold:25,boil:null,fry:null,stew:null,bake:null},
  {re:/шампиньон/,cold:5,boil:null,fry:null,stew:null,bake:null},
  {re:/говядин|свинин|баранин|телятин|мясо/,cold:null,boil:36,fry:35,stew:38,bake:35},
  {re:/куриц|курин|цыпл[её]н|индейк|птиц/,cold:null,boil:30,fry:33,stew:33,bake:33},
  {re:/рыб|лосос|форел|семг|судак|треск|горбуш|окун/,cold:null,boil:18,fry:20,stew:20,bake:20}
];
function lossRef(name){
  var n=String(name||'').toLowerCase().replace(/ё/g,'е'),i,r;
  if(n.replace(/\s+/g,'').length<3)return null;
  for(i=0;i<LOSS_REF.length;i++){
    r=LOSS_REF[i];
    if(r.re.test(n)||r.re.test(String(name||'').toLowerCase()))return{cold:r.cold,boil:r.boil,fry:r.fry,stew:r.stew,bake:r.bake};
  }
  return null;
}
function lossAny(l){return!!l&&['cold','boil','fry','stew','bake'].some(function(k){return l[k]!==null&&l[k]!==undefined;});}
/* новому сырью, у которого норм потерь нет, подставляются ориентировочные по названию (если оно узнано) */
function lossFill(ing){
  var ref;
  if(!ing||lossAny(ing.loss))return false;
  ref=lossRef(ing.name);
  if(!ref)return false;
  ing.loss=ref;return true;
}
var LOSSUI={more:{},auto:{}};
/* название нового сырья введено: подставить ориентировочные нормы потерь в строку */
function lossDomUpdate(id){
  var ing=S.ings[id],l=(ing&&ing.loss)||{};
  if(!ing)return;
  $$('.irow').forEach(function(r){
    if(r.getAttribute('data-iid')!==id)return;
    $$('input[data-act="iLoss"]',r).forEach(function(x){var v=l[x.getAttribute('data-k')];x.value=toInput(v===undefined?null:v);x.classList.remove('invalid');});
  });
}
function lossAutoName(id){
  var ing=S.ings[id];
  if(!ing||!LOSSUI.auto[id]||lossAny(ing.loss))return;
  if(lossFill(ing)){lossDomUpdate(id);queueSave('ingredients',id);}
}
/* новое сырьё из прайса или выгрузки 1С: КБЖУ нулевые, пометка «Ориентир»; название запоминается как синоним */
function addNewIng(name,src){
  var id=newId();
  S.ings[id]=normIng({name:name,p:0,f:0,c:0,kind:'estimate',source:src});
  lossFill(S.ings[id]);
  S.ings[id].aliases=[normKey(name)];
  queueSave('ingredients',id);
  return id;
}
function priceStatus(x){
  if(x.price===null)return['neutral','Цены нет'];
  if(!x.ing&&x.add)return['warn','Новое сырьё'];
  if(!x.ing)return['bad','Не найдено'];
  if(x.how==='alias')return['ok','Запомнено'];
  if(x.how==='exact')return['ok','Совпало'];
  if(x.how==='fuzzy')return['warn','Проверьте'];
  return['neutral','Выбрано вами'];
}
function priceRowHtml(x,i,base){
  var st=priceStatus(x);
  var opts='<option value="">— пропустить —</option><option value="__new__"'+(x.add&&!x.ing?' selected':'')+'>＋ Добавить как новое сырьё</option>'+base.map(function(b){return b[1].replace('value="'+esc(b[0])+'"','value="'+esc(b[0])+'"'+(b[0]===x.ing?' selected':''));}).join('');
  return'<div class="trow" data-i="'+i+'"><span class="tn">'+esc(x.name)+((!x.ing&&x.guess&&x.price!==null)?'<span class="tsub">Похоже: '+esc(S.ings[x.guess].name)+'</span>':'')+'</span>'
    +'<span class="tnet">'+(x.price===null?'—':money(x.price))+'</span>'
    +'<span class="tsel"><select data-act="priceIng" data-edit data-fk="pi:'+i+'" aria-label="Сырьё из базы для «'+esc(x.name)+'»">'+opts+'</select></span>'
    +'<span class="tst"><span class="tstat '+st[0]+'">'+st[1]+'</span>'
    +((x.ing&&x.how!=='alias'&&x.how!=='exact')?'<label class="trem"><input type="checkbox" data-act="priceRem" data-edit'+(x.remember?' checked':'')+'>запомнить название</label>':'')
    +'</span></div>';
}
function priceCardHtml(){
  var t=S.price;if(!t)return'';
  var ids=Object.keys(S.ings).sort(byName(S.ings));
  var base=ids.map(function(id){return[id,'<option value="'+esc(id)+'">'+esc(S.ings[id].name||'Без названия')+'</option>'];});
  var need=[],check=[],ok=[],none=[],add=[];
  t.items.forEach(function(x,i){
    if(x.price===null)none.push(i);
    else if(!x.ing&&x.add)add.push(i);
    else if(!x.ing)need.push(i);
    else if(x.how==='fuzzy'||x.how==='manual')check.push(i);
    else ok.push(i);
  });
  var seen={},dup=[];
  t.items.forEach(function(x){if(x.ing&&x.price!==null){if(seen[x.ing])dup.push(S.ings[x.ing].name);seen[x.ing]=1;}});
  function block(list,title,open){
    if(!list.length)return'';
    var head='<div class="trow thead"><span>В прайсе</span><span class="r">Цена, ₽</span><span>Сырьё в базе</span><span>Статус</span></div>';
    return'<details class="pgroup"'+(open?' open':'')+'><summary>'+title+' · '+list.length+'</summary><div class="trows">'+head+list.map(function(i){return priceRowHtml(t.items[i],i,base);}).join('')+'</div></details>';
  }
  var applyN=t.items.filter(function(x){return(x.ing||x.add)&&x.price!==null;}).length;
  var h='<section class="card ttk" id="priceCard"><h2>Загружен прайс</h2>'
    +'<p class="rgtag">Цены запишутся в регион «'+esc(regionName(curRegion()))+'»</p>'
    +'<p class="hint" style="margin-top:2px">Файл «'+esc(t.file)+'», позиций: '+t.items.length+'. Цены считаются за килограмм (литр). Если в прайсе цена за штуку или упаковку, после загрузки поменяйте «за» в карточке сырья ниже на «шт. (упак.)» и укажите массу упаковки.</p>'
    +(need.length?'<div class="btns" style="margin:10px 0 4px"><button class="btn" data-act="priceAddAll" data-edit>＋ Добавить все ненайденные как новое сырьё · '+need.length+'</button></div>':'')
    +block(need,'Нужно выбрать сырьё или добавить как новое',true)+block(add,'Будут добавлены как новое сырьё',true)+block(check,'Проверьте соответствие',true)+block(ok,'Совпали по названию',false)+block(none,'Без цены (пропущены)',false);
  var notes=[];
  if(need.length)notes.push(['warn','Сырьё не выбрано в '+need.length+' позициях: цены из них не загрузятся. Выберите сырьё из базы, добавьте как новое или оставьте «пропустить».']);
  if(add.length)notes.push(['warn','Новое сырьё ('+add.length+') добавится в базу с нулевыми значениями КБЖУ и пометкой «Ориентир»; цена запишется в регион «'+esc(regionName(curRegion()))+'». Заполните КБЖУ на вкладке «КБЖУ и потери»: там же нормы потерь (х/о, варка и др.), они подставляются по справочнику, где название узнано, их стоит проверить.']);
  if(dup.length)notes.push(['warn','Несколько позиций прайса выбрали одно сырьё ('+dup.slice(0,4).map(esc).join(', ')+(dup.length>4?'…':'')+'). Применится последняя.']);
  notes.push(['good','К загрузке готово цен: '+applyN+'. Существующие цены региона «'+esc(regionName(curRegion()))+'» у этих позиций будут заменены, остальные регионы не изменятся.']);
  h+='<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>';
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="priceApply" data-edit>Загрузить '+applyN+' цен в «'+esc(regionName(curRegion()))+'»</button><button class="btn" data-act="priceCancel">Отмена</button></div></section>';
  return h;
}
function doPriceApply(){
  var t=S.price;if(!t)return;
  var n=0,skipped=0,g=curRegion(),made={},nNew=0;
  t.items.forEach(function(x){
    if(x.price===null)return;
    var id=x.ing;
    if(!id&&x.add){
      var k=normKey(x.name);
      if(!made[k]){made[k]=addNewIng(x.name,'Добавлено из прайса: значения КБЖУ не заполнены');nNew++;}
      id=made[k];
    }
    if(!id){skipped++;return;}
    var ing=S.ings[id];if(!ing)return;
    var rec=recFor(ing,g,true);phSetPrice(rec,x.price,0,false);rec.priceSrc=x.name.slice(0,200);   /* цена в прайсе — за кг: у позиции в режиме «за упаковку» пересчитывается в цену упаковки */
    if(x.ing&&x.remember&&x.how!=='alias'&&x.how!=='exact')addAlias(x.ing,x.name);
    queueSave('ingredients',id);n++;
  });
  S.price=null;S.pnoprice=false;renderAll();
  flash('Цены загружены в «'+regionName(g)+'»: '+n+(nNew?', новое сырьё: '+nNew:'')+(skipped?', пропущено: '+skipped:''));
}
function priceInfoHtml(id){
  var i=S.ings[id],pk=pricePerKg(i,curRegion());
  return pk===null?'—':fmt(pk,2);
}
