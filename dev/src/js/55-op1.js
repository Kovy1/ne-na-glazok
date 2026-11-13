/* ---------- калькуляция по форме ОП-1 ---------- */
var OP_KEYS=['okpo','okdp','opType','unit','org','head','headName','recNo','docNo','docDate','calcDate','markup','blocks','prodName','authorName'];
function opVal(r,k){
  if(r.op&&Object.prototype.hasOwnProperty.call(r.op,k))return r.op[k];
  switch(k){
    case'org':return ttkVal(r,'org');
    case'head':return ttkVal(r,'head');
    case'headName':return ttkVal(r,'headName');
    case'recNo':return'ТТК №'+(ttkVal(r,'num')||'__');
    case'docNo':return ttkVal(r,'num');
    case'docDate':case'calcDate':return todayRu();
    case'blocks':return'1';
    case'markup':return opMarkupDefault(r);
    default:return'';
  }
}
/* наценка, при которой карточка ОП-1 даёт цену продажи из вкладки «Меню и финансы» */
function opMarkupDefault(r){
  var sp=sellEff(r,curRegion());if(!sp)return'';
  var c=costOf(r,S.ings,100,curRegion());if(!(c.sum>0))return'';
  return toInput(Math.round((sp*100-c.sum)/c.sum*10000)/100);
}
function opMkFromSell(r){return!(r.op&&Object.prototype.hasOwnProperty.call(r.op,'markup'))&&opMarkupDefault(r)!=='';}
function setOp(r,k,v){if(!r.op)r.op={};r.op[k]=v;queueSave('recipes',S.active);}
function opDish(r){var d=String(ttkVal(r,'dish')||'').trim()||'Блюдо',p=String(ttkVal(r,'portion')||'').trim();return'«'+d+'»'+(p?' '+p:'');}
function opModel(r){
  var c=costOf(r,S.ings,100,curRegion()),mk=parseNum(opVal(r,'markup')),pct=mk.ok?mk.v:0;
  var mr=r2(c.sum*pct/100),price=r2((c.sum+mr)/100);
  var B=Math.max(1,Math.min(6,Math.round(Number(opVal(r,'blocks'))||1)));
  return{
    org:String(opVal(r,'org')||'').trim(),unit:String(opVal(r,'unit')||'').trim(),okpo:String(opVal(r,'okpo')||'').trim(),okdp:String(opVal(r,'okdp')||'').trim(),opType:String(opVal(r,'opType')||'').trim(),
    dish:opDish(r),recNo:String(opVal(r,'recNo')||'').trim(),docNo:String(opVal(r,'docNo')||'').trim(),docDate:String(opVal(r,'docDate')||'').trim(),calcDate:String(opVal(r,'calcDate')||'').trim(),
    head:String(opVal(r,'head')||'').trim(),headName:String(opVal(r,'headName')||'').trim(),prodName:String(opVal(r,'prodName')||'').trim(),authorName:String(opVal(r,'authorName')||'').trim(),
    blocks:B,rows:c.rows.map(function(x){return{name:x.name,code:'',kg:x.kg,price:x.price,sum:x.sum};}),
    sum:c.sum,markupPct:pct,markupRub:mr,priceDish:price,out:r.output,cost:c,markupOk:mk.ok
  };
}
function opIssues(r,m){
  var w=[];
  if(!(r.output>0))w.push(['bad','Не указан выход блюда.']);
  if(!m.rows.length)w.push(['bad','В рецептуре нет сырья.']);
  var cst=m.cost;
  if(cst.unassigned||cst.missing)w.push(['bad','В расчёте есть строки без сырья из базы, цену по ним определить нельзя.']);
  if(cst.noPrice.length)w.push(['bad','Нет цены (или массы упаковки) в регионе «'+esc(regionName(curRegion()))+'» у сырья: '+cst.noPrice.map(esc).join(', ')+'. Заполните на вкладке «База сырья»: пока цена по этим строкам в карточке останется пустой.']);
  var gn=cst.rows.filter(function(x){return x.gsrc==='net'&&x.ing;}).map(function(x){return esc(x.name||'—');});
  if(gn.length)w.push(['warn','Брутто не задано, взято равным нетто ('+gn.slice(0,6).join('; ')+(gn.length>6?'; и ещё '+(gn.length-6):'')+'). Для сырья с потерями при холодной обработке (овощи, зелень, мясо, рыба) введите брутто в блоке «Карта ТТК» вкладки «ТТК» или % потерь в базе, иначе норма и стоимость занижены.']);
  if(!m.markupOk)w.push(['bad','Наценка введена с ошибкой.']);
  else if(!(m.markupPct>0))w.push(['warn','Наценка не указана: цена продажи равна стоимости сырья.']);
  if(!m.unit)w.push(['warn','Не указано структурное подразделение, ОКПО и вид деятельности: эти поля останутся пустыми в шапке.']);
  w.push(['warn','Нормы в карточку берутся по брутто на 100 порций. Колонка «код продукта» остаётся пустой: в вашей базе кодов нет.']);
  if(w.every(function(x){return x[0]!=='bad';}))w.unshift(['good','Карточку можно скачивать. Проверьте реквизиты шапки и подписи.']);
  return w;
}
function opTotalsHtml(m){
  return'<dl class="kv"><div><dt>Сырьевой набор на 100 блюд</dt><dd>'+money(m.sum)+' ₽</dd></div><div><dt>Наценка '+(m.markupOk?fmt(m.markupPct,m.markupPct%1?2:0):'?')+' %</dt><dd>'+money(m.markupRub)+' ₽</dd></div><div><dt>Цена продажи блюда</dt><dd>'+money(m.priceDish)+' ₽</dd></div></dl>';
}
function opLive(r){
  var m=opModel(r),a=$('#opTot'),b=$('#opIssues');
  if(a)a.innerHTML=opTotalsHtml(m);
  if(b)b.innerHTML=opIssues(r,m).map(function(x){return'<li class="w-'+x[0]+'">'+x[1]+'</li>';}).join('');
  var hn=$('#opMkHint');if(hn)hn.hidden=!opMkFromSell(r);
}
function ofIn(r,k,label,cls,ph){
  return'<label class="field'+(cls?' '+cls:'')+'"><span class="lbl">'+label+'</span><input data-act="opf" data-k="'+k+'" data-edit data-fk="op:'+k+'" autocomplete="off" value="'+esc(opVal(r,k))+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'></label>';
}
function viewOp1(){
  var ids=visIds(),r=curRecipe();
  if(!r)return'<div class="card empty"><h2>Нет расчёта</h2><p>Калькуляция строится по рецептуре из расчёта. Создайте расчёт на вкладке «ТТК» или загрузите готовую ТТК (.docx).</p><div class="btns"><button class="btn primary" data-act="gotoCalc">Открыть ТТК</button></div></div>';
  var m=opModel(r);
  var opts=ids.map(function(id){return'<option value="'+esc(id)+'"'+(id===S.active?' selected':'')+'>'+esc(recLabel(S.recipes[id]))+'</option>';}).join('');
  var h='<div class="bar"><label class="field grow"><span class="lbl">Блюдо</span><select id="recipeSel" data-act="pickRecipe" data-fk="recipeSel">'+opts+'</select></label></div><div class="ttkcols">';
  h+='<section class="card"><h2>Реквизиты карточки ОП-1</h2>'
    +'<div class="fgrid">'+ofIn(r,'org','Организация','')+ofIn(r,'unit','Структурное подразделение','')+'</div>'
    +'<div class="fgrid">'+ofIn(r,'okpo','Код по ОКПО','w150')+ofIn(r,'okdp','Вид деятельности по ОКДП','w180')+ofIn(r,'opType','Вид операции','w150')+ofIn(r,'recNo','Номер блюда по сборнику, ТТК, СТП','')+'</div>'
    +'<div class="fgrid">'+ofIn(r,'docNo','Номер документа','w150')+ofIn(r,'docDate','Дата составления','w180')+ofIn(r,'calcDate','Калькуляция № 1 от','w180')
      +'<label class="field w120"><span class="lbl">Граф калькуляции</span><select data-act="opSel" data-k="blocks" data-edit data-fk="op:blocks">'+[1,2,3,4,5,6].map(function(n){return'<option value="'+n+'"'+(m.blocks===n?' selected':'')+'>'+n+'</option>';}).join('')+'</select></label></div>'
    +'<p class="hint" style="margin-top:0">Название блюда, должность и ФИО руководителя берутся из вкладки «ТТК». В бланке шесть граф для калькуляций с разными датами. Для одной калькуляции достаточно одной графы.</p>'
    +'</section>';
  h+='<section class="card"><h2>Калькуляция на 100 блюд</h2><p class="rgtag">Цены региона «'+esc(regionName(curRegion()))+'»</p><div class="crow chead"><span>№</span><span>Продукт</span><span class="r pg" title="Брутто на одну порцию, в граммах">На порцию, г</span><span class="r">Норма, кг</span><span class="r">Цена, ₽/кг</span><span class="r">Сумма, ₽</span></div>';
  m.rows.forEach(function(x,i){
    h+='<div class="crow'+(x.price===null?' nop':'')+'"><span class="n">'+(i+1)+'</span><span class="pn">'+esc(x.name||'—')+'</span><span class="num pg" data-label="На порцию, г">'+dnum(m.cost.rows[i].gross,2)+'</span><span class="num" data-label="Норма, кг">'+kgNum(x.kg)+'</span><span class="num" data-label="Цена, ₽/кг">'+(x.price===null?'нет цены':money(x.price))+'</span><span class="num" data-label="Сумма, ₽">'+(x.sum===null?'—':money(x.sum))+'</span></div>';
  });
  var ex=m.rows.filter(function(x){return x.price!==null&&x.sum!==null;})[0]||m.rows[0];
  if(ex){
    var exg=m.cost.rows[m.rows.indexOf(ex)].gross;
    h+='<p class="hint" style="margin-top:10px">Норма в кг — брутто на одну порцию в граммах × 100 порций ÷ 1000. Например, «'+esc(ex.name||'—')+'»: '+dnum(exg,2)+' г × 100 ÷ 1000 = '+kgNum(ex.kg)+' кг'+(ex.price!==null?', × '+money(ex.price)+' ₽/кг = '+money(ex.sum)+' ₽':'')+'. Брутто берётся из ТТК (колонка «Брутто» в блоке «Карта ТТК» вкладки «ТТК»), а если его там нет — по % потерь при холодной обработке из базы, иначе равно нетто.</p>';
  }
  h+='<div class="fgrid" style="margin-top:14px"><label class="field w150"><span class="lbl">Наценка, %</span><input class="num" inputmode="decimal" data-act="opf" data-k="markup" data-edit data-fk="op:markup" autocomplete="off" value="'+esc(opVal(r,'markup'))+'" placeholder="Например: 100"></label>'
    +'<label class="field w150"><span class="lbl">Выход блюда, г</span><input class="num" value="'+toInput(r.output)+'" disabled aria-label="Выход, задаётся на вкладке Расчёт"></label></div>'
    +'<p class="hint" id="opMkHint" style="margin-top:8px"'+(opMkFromSell(r)?'':' hidden')+'>Наценка рассчитана по цене продажи '+money(sellEff(r,curRegion())||0)+' ₽ с вкладки «Меню и финансы». Введите своё значение, чтобы заменить.</p>'
    +'<div id="opTot">'+opTotalsHtml(m)+'</div></section>';
  h+='<section class="card"><h2>Подписи</h2><div class="fgrid">'+ofIn(r,'headName','Руководитель организации (утверждает)','')+ofIn(r,'prodName','Заведующий производством','')+ofIn(r,'authorName','Калькуляцию составил','')+'</div></section>';
  h+='<section class="card"><h2>Скачать карточку</h2><ul class="warns" id="opIssues">'+opIssues(r,m).map(function(x){return'<li class="w-'+x[0]+'">'+x[1]+'</li>';}).join('')+'</ul>'
    +'<div class="btns" style="margin-top:12px">'+(canDl()?'<button class="btn primary" data-act="dlOp1">Скачать ОП-1 (.docx)</button>':'<span class="muted">Скачивание здесь недоступно.</span>')+'</div></section></div>';
  return h;
}
function doDownloadOp1(r,over){
  if(over===undefined&&drGenGate(r,'op1'))return;
  var m=opModel(r);
  if(over){m.org=over.org;m.head=over.head;m.headName=over.headName;}
  exportFile(buildOp1Docx(m),safeName('ОП-1 '+(ttkVal(r,'num')?'№'+ttkVal(r,'num')+' ':'')+String(ttkVal(r,'dish')||'')+(regionList().length>1?', '+regionName(curRegion()):''))+'.docx');
}
function costHtml(r){
  if(NOPRICE)return'';
  var g=curRegion(),c=costOf(r,S.ings,100,g),tag=regionList().length>1?'<p class="rgtag">Цены региона «'+esc(regionName(g))+'»</p>':'';
  if(!c.rows.length)return'';
  var pp=c.sum/100,p100=r.output>0?pp/r.output*100:null;
  var anyPrice=c.rows.some(function(x){return x.price!==null;});
  if(!anyPrice&&syLoading())return tag+syLoadHtml();
  if(!anyPrice)return tag+incBarHtml(c.noPrice,incIds(c),S.active,'incbig')+'<ul class="warns"><li class="w-warn"><b>Цен нет.</b>В регионе «'+esc(regionName(g))+'» цен нет. Загрузите прайс или введите цены на вкладке «База сырья», тогда здесь появится стоимость сырья.</li></ul>';
  var h=tag+'<dl class="kv"><div><dt>Сырьё на 1 порцию</dt><dd>'+money(pp)+' ₽</dd></div>'+(p100===null?'':'<div><dt>Сырьё на 100 г блюда</dt><dd>'+money(p100)+' ₽</dd></div>')+'<div><dt>Сырьё на 100 порций</dt><dd>'+money(c.sum)+' ₽</dd></div></dl>';
  if(!c.complete)h=tag+incBarHtml(c.noPrice,incIds(c),S.active,'incbig')+h.slice(tag.length);
  if(c.asm.length)h+='<p class="hint warnt">Допущение «1 л = 1 кг» принято для цены сырья: '+c.asm.slice(0,5).map(esc).join(', ')+(c.asm.length>5?' и ещё '+(c.asm.length-5):'')+'. Плотность не подтверждена, поэтому стоимость по этим позициям приблизительная. Укажите плотность в базе сырья или в строке закупки.</p>';
  return h+'<p class="method">Стоимость считается по брутто (колонка «Брутто, г» в рецептуре) и цене за килограмм из вкладки «База сырья». Калькуляционная карточка по форме ОП-1 — на вкладке «Калькуляция ОП-1».</p>';
}

/* стоимость сырья в таблице рецептуры: на одну порцию, по брутто и цене региона; строка и итог считаются так же, как на вкладке «Расчёт» */
function ttkCosts(r){
  var c=costOf(r,S.ings,100,curRegion()),by={};
  c.rows.forEach(function(x){
    if(x.pfrid){      /* строка-полуфабрикат: одна сумма по всему его составу */
      var a=by[x.pfrid]||(by[x.pfrid]={rid:x.pfrid,ing:'pf',pf:1,sum:0,price:1,gross:0,miss:false});
      a.gross+=x.gross;
      if(x.sum===null)a.miss=true;else a.sum+=x.sum;
    }else by[x.rid]=x;
  });
  Object.keys(by).forEach(function(k){var a=by[k];if(a.pf){if(a.miss){a.sum=null;a.price=null;}else a.sum=r2(a.sum);}});
  return{c:c,by:by};
}
function ttkCostCell(x){
  if(!x||!x.ing)return'';
  if(x.price===null||x.sum===null)return'—';
  var v=x.sum/100;
  return v>0&&v<0.005?'< 0,01':money(v);
}
function ttkCostTitle(x){
  if(x&&x.pf)return(x.price===null||x.sum===null)?'У части сырья полуфабриката нет цены в выбранном регионе':'Себестоимость полуфабриката в одной порции: сумма по его составу';
  if(!x||x.price===null||x.sum===null)return'Нет цены в выбранном регионе: введите её на вкладке «База сырья»';
  return'Цена '+money(x.price)+' ₽/кг × брутто '+toInput(Math.round(x.gross*1000)/1000)+' г = стоимость сырья в одной порции';
}
function ttkCostHtml(r){
  if(NOPRICE)return'';
  var c=ttkCosts(r).c,g=curRegion();
  if(!c.rows.length)return'';
  if(!c.rows.some(function(x){return x.price!==null;}))return'Цен в регионе «'+esc(regionName(g))+'» нет: введите их на вкладке «База сырья», тогда здесь появится себестоимость.';
  return'Себестоимость порции (сырьё): <b>'+money(c.sum/100)+' ₽</b>'+(regionList().length>1?' · цены региона «'+esc(regionName(g))+'»':'')
    +(c.complete?'':' · <span class="muted">неполная: '+(c.noPrice.length?'нет цены у '+c.noPrice.map(esc).join(', '):'есть строки без сырья из базы')+'</span>');
}

