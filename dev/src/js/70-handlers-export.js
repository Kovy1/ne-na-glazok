/* ---------- обработчики ---------- */
function c1Item(el){var row=el.closest('[data-i]'),x=S.c1&&row?S.c1.items[Number(row.getAttribute('data-i'))]:null;if(x)x.done=false;return x;}   /* любая правка строки снимает «Уже загружено» */
function p1cClick(act,b){
  var x,id,i;
  switch(act){
    case'bsub':S.bsub=b.getAttribute('data-k')==='price'?'price':'kbzhu';lsSet('kbzhu:bsub',S.bsub);renderAll();return true;
    case'pview':x=b.getAttribute('data-k');S.pview=x==='an'?'an':(x==='obj'?'obj':'tbl');lsSet('kbzhu:pview',S.pview);renderAll();return true;
    case'pObjAll':S.pob=S.pob||{};S.pob.all=true;renderAll();return true;
    case'pObjCsv':
      (function(){
        var st=pObjState(pAllRaw());if(!st.cur)return;
        var rows=pObjCsvRows(phObjCompare(pAllRaw(),st.cur.key)).map(function(r,ri){return ri?r.map(function(v){return typeof v==='number'?csvNum(v,2):v;}):r;});
        exportFile(toCsv(rows),'Сравнение объектов '+safeName(regionName(curRegion()))+'.csv');
      })();return true;
    case'pickC1':$('#c1File').click();return true;
    case'pickSx':if(uiRO()){roFlash();return true;}$('#sxFile').click();return true;
    case'sxApply':sxApply();return true;
    case'sxCancel':S.sx=null;renderAll();return true;
    case'sxSim':if(S.sx){var kk=b.getAttribute('data-k');S.sx.simOn=S.sx.simOn||{};S.sx.simOn[kk]=!S.sx.simOn[kk];renderAll();}return true;
    case'sxOnly':if(S.sx){S.sx.only=!S.sx.only;renderAll();}return true;
    case'c1Paste':c1PasteGo();return true;
    case'c1Cancel':S.c1=null;renderAll();return true;
    case'c1Review':if(S.c1){S.c1.confirm=true;renderAll();(function(){var c=$('#c1Conf');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});})();}return true;
    case'c1Back':if(S.c1){S.c1.confirm=false;renderAll();}return true;
    case'c1ConfAll':if(S.c1){S.c1.confAll=true;renderAll();}return true;
    case'c1Apply':doC1Apply();return true;
    case'c1New':x=c1Item(b);if(x){x.ing='';x.add=true;x.skip=false;x.how='new';x.remember=false;x.edit=false;renderAll();}return true;
    case'c1Skip':x=c1Item(b);if(x){x.ing='';x.add=false;x.skip=true;x.how='skip';x.remember=false;x.edit=false;renderAll();}return true;
    case'c1NewAll':
      if(S.c1)S.c1.items.forEach(function(x,i){if(!x.ing&&!x.skip&&S.c1.parsed.items[i].lines.length){x.add=true;x.how='new';x.remember=false;x.edit=false;}});
      renderAll();return true;
    case'c1Edit':x=c1Item(b);if(x){x.edit=true;x.skip=false;S.focusFk='c1i:'+x.i;renderAll();}return true;
    case'c1PriceOk':x=c1Item(b);if(x){var rr=c1Row(x);if(rr.pr!==null)x.okPr=rr.pr;renderAll();}return true;
    case'c1DensOk':x=c1Item(b);if(x){x.densAsm=true;renderAll();}return true;
    case'c1DensNo':x=c1Item(b);if(x){x.densAsm=false;renderAll();}return true;
    case'c1Take':x=c1Item(b);if(x&&x.guess){x.skip=false;x.ing=x.guess;x.how='manual';x.remember=true;x.edit=false;renderAll();}return true;
    case'pFlt':S.pflt=b.getAttribute('data-k')||'all';renderAll();return true;
    case'pHist':
      id=b.getAttribute('data-id');S.pview='an';lsSet('kbzhu:pview','an');S.pan=S.pan||{};S.pan.ing=id;renderAll();
      (function(){var c=$('#pChartCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});})();return true;
    case'pBuy':
      id=b.getAttribute('data-id');S.pbuy=(S.pbuy===id)?'':id;S.pbuyObj='';renderAll();
      (function(){var c=$('#pBuyCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});})();return true;
    case'pBuyX':S.pbuy='';S.pbuyObj='';renderAll();return true;
    case'pBuyObj':S.pbuyObj=b.getAttribute('data-o')||'';renderAll();return true;
    case'pDel':
      id=b.getAttribute('data-id');
      arm(b,'Точно удалить?',function(){
        if(syPhOn()&&!syAdmin()){flash('Запись истории у всех удаляет технолог');return;}
        phDelete(id).then(function(ok){if(ok){renderAll();flash('Запись удалена из истории');}});
      });return true;
    case'pCsv':
      (function(){
        var rows=phCsvRows(pBatches(),S.ings).map(function(r,ri){return ri?r.map(function(v){return typeof v==='number'?csvNum(v,2):v;}):r;});
        exportFile(toCsv(rows),'История цен '+safeName(regionName(curRegion()))+'.csv');
      })();return true;
  }
  return false;
}
function p1cChange(act,t){
  var x;
  switch(act){
    case'c1Ing':x=c1Item(t);if(x){
      x.skip=false;
      if(t.value==='__new__'){x.ing='';x.add=true;x.how='new';x.remember=false;}
      else{x.ing=t.value;x.add=false;x.how=t.value?'manual':'none';x.remember=!!t.value;}
      x.edit=false;S.focusFk='c1i:'+x.i;renderAll();}return true;
    case'c1Rule':if(S.c1){S.c1.rule=PH_RULES[t.value]?t.value:'avg';S.c1.items.forEach(function(x){x.done=false;});lsSet('kbzhu:c1rule',S.c1.rule);S.focusFk='c1rule';renderAll();}return true;
    case'c1Pack':x=c1Item(t);if(x){var p=parseNum(t.value);x.packUser=(p.ok&&p.v>0)?p.v:0;S.focusFk='c1p:'+x.i;renderAll();}return true;
    case'c1Dens':x=c1Item(t);if(x){var dp=parseNum(t.value);x.densUser=(dp.ok&&dp.v>=0.2&&dp.v<=3)?dp.v:0;if(x.densUser>0)x.densAsm=false;S.focusFk='c1d:'+x.i;renderAll();}return true;
    case'c1Rem':x=c1Item(t);if(x)x.remember=t.checked;return true;
    case'c1Drop':x=c1Item(t);if(x){var k=Number(t.getAttribute('data-k'));x.drop=x.drop||{};if(t.checked)delete x.drop[k];else x.drop[k]=1;if(!Object.keys(x.drop).length)delete x.drop;renderAll();}return true;
    case'pSort':S.psort=t.value;S.focusFk='psort';renderAll();return true;
    case'pCur':S.pan=S.pan||{};S.pan.a=t.value;S.pan.b=null;S.focusFk='pcur';renderAll();return true;
    case'pObjF':S.pobj=t.value;S.pan=S.pan||{};S.pan.a=null;S.pan.b=null;S.focusFk='pobjf';renderAll();return true;
    case'pObjP':S.pob=S.pob||{};S.pob.k=t.value;S.pob.all=false;S.focusFk='pobjp';renderAll();return true;
    case'pObjI':S.pob=S.pob||{};S.pob.ing=t.value;S.focusFk='pobji';renderAll();return true;
    case'c1Legacy':if(S.c1)S.c1.dropLegacy=t.checked;return true;
    case'pCmp':S.pan=S.pan||{};S.pan.b=t.value;S.focusFk='pcmp';renderAll();return true;
    case'pIng':S.pan=S.pan||{};S.pan.ing=t.value;S.focusFk='ping';renderAll();return true;
  }
  return false;
}
function p1cInput(act,t){
  if(act==='c1Obj'){
    var o=S.c1&&S.c1.objs[Number(t.getAttribute('data-i'))];
    if(o){o.name=phObjName(t.value);var dy=$('#c1ObjDyn');if(dy)dy.innerHTML=c1ObjDynHtml(S.c1);}
    return true;
  }
  if(act==='pSearch'){
    S.pq=t.value;
    var bs=pBatches(),el=$('#pList');
    if(el){el.innerHTML=pListHtml(bs,phIndex(bs));if(uiRO())$$('#pList [data-edit]').forEach(function(y){y.disabled=true;});}
    return true;
  }
  return false;
}
/*P1CUI-END*/
/* ---------- actions ---------- */
function newId(){return uid();}
function arm(btn,label,fn){
  if(btn.getAttribute('data-armed')){clearTimeout(Number(btn.getAttribute('data-armed')));btn.removeAttribute('data-armed');btn.classList.remove('armed');btn.textContent=btn.getAttribute('data-label');fn();return;}
  btn.setAttribute('data-label',btn.textContent);btn.textContent=label;btn.classList.add('armed');
  btn.setAttribute('data-armed',String(setTimeout(function(){btn.removeAttribute('data-armed');btn.classList.remove('armed');btn.textContent=btn.getAttribute('data-label');},3500)));
}
function copyText(text,btn){
  var done=function(){var old=btn.textContent;btn.textContent='Скопировано';setTimeout(function(){btn.textContent=old;},1500);};
  var fallback=function(){
    var b=$('#copybox');
    if(!b){b=document.createElement('textarea');b.id='copybox';b.className='copybox';b.readOnly=true;b.rows=4;b.setAttribute('aria-label','Текст для копирования');(btn.closest('.tools')||btn.parentNode).appendChild(b);}
    b.hidden=false;b.value=text;b.focus();b.select();flash('Скопируйте выделенный текст сочетанием Ctrl+C');
  };
  try{navigator.clipboard.writeText(text).then(done,fallback);}catch(e){fallback();}
}
/* ---------- export ---------- */
function csvCell(v){var s=String(v==null?'':v);return/[";\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
function csvNum(v,d){if(v==null||!isFinite(v))return'';var m=Math.pow(10,d);return String(Math.round(v*m)/m).replace('.',',');}
function toCsv(rows){return'\ufeff'+rows.map(function(r){return r.map(csvCell).join(';');}).join('\r\n');}
function toTsv(rows){return rows.map(function(r){return r.map(function(v){return String(v==null?'':v).replace(/[\t\r\n]+/g,' ');}).join('\t');}).join('\n');}
function safeName(s){return String(s||'').replace(/[\\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim().slice(0,80)||'расчёт';}
/* колонка цены в выгрузке базы подписана регионом, из которого взяты цены: «Цена, ₽ (Москва)». Загрузка не пускает такие цены в другой регион */
function PRICE_COL(){return'Цена, ₽'+(regionList().length>1?' ('+regionName(curRegion())+')':'');}
function baseRows(){
  var rows=[['Название','Белки, г','Жиры, г','Углеводы, г','Источник','Ккал (4·Б+9·Ж+4·У)','Тип данных','Потери: холодная обработка, %','Потери: варка, %','Потери: жарка, %','Потери: тушение, %','Потери: запекание, %','Синонимы (как в ТТК)',PRICE_COL(),'Цена за (кг / упаковка)','Масса упаковки, г','Позиция в прайсе','Раздел']];
  Object.keys(S.ings).sort(byName(S.ings)).forEach(function(id){
    var i=S.ings[id],l=i.loss||{},q=regRec(i,curRegion())||{};
    rows.push([i.name,csvNum(i.p,2),csvNum(i.f,2),csvNum(i.c,2),i.source,csvNum(KCAL_P*i.p+KCAL_F*i.f+KCAL_C*i.c,0),KINDS[i.kind],csvNum(l.cold,1),csvNum(l.boil,1),csvNum(l.fry,1),csvNum(l.stew,1),csvNum(l.bake,1),(i.aliases||[]).join(' | '),csvNum(q.price,2),q.priceUnit==='pack'?'упаковка':(q.price!=null?'кг':''),csvNum(q.packG,2),q.priceSrc||'',ingCat(i)]);
  });
  return rows;
}
function recipeRows(r,c){
  var rows=[['Блюдо',r.name],['Выход 1 порции, г',csvNum(r.output,2)],[],
    ['Сырьё','Нетто, г','Доля в блюде, %','Белки на 100 г сырья','Жиры на 100 г сырья','Углеводы на 100 г сырья','Ккал на 100 г сырья','Тип данных','Источник','Белки в порции, г','Жиры в порции, г','Углеводы в порции, г','Ккал в порции']];
  r.rows.forEach(function(row){
    var ing=row.ing?S.ings[row.ing]:null,o=c.rows[row.rid];
    rows.push([ing?ing.name:(row.ing?'Нет в базе':''),csvNum(row.net,3),csvNum(row.share,1),
      ing&&!kUnknown(ing)?csvNum(ing.p,2):'',ing&&!kUnknown(ing)?csvNum(ing.f,2):'',ing&&!kUnknown(ing)?csvNum(ing.c,2):'',ing&&!kUnknown(ing)?csvNum(KCAL_P*ing.p+KCAL_F*ing.f+KCAL_C*ing.c,0):(ing?'не заполнено':''),
      ing?KINDS[ing.kind]:'',ing?ing.source:'',
      o.has&&!o.unk?csvNum(o.p,2):'',o.has&&!o.unk?csvNum(o.f,2):'',o.has&&!o.unk?csvNum(o.c,2):'',o.has&&!o.unk?csvNum(o.k,0):'']);
  });
  rows.push([]);
  var pt=c.portion;
  var ul=c.unk.length?' (не менее: КБЖУ не заполнено)':'';
  rows.push(['Итого на порцию'+ul,'','','','','','','','',csvNum(pt.p,2),csvNum(pt.f,2),csvNum(pt.c,2),csvNum(pt.k,0)]);
  if(c.per100)rows.push(['На 100 г готового блюда'+ul,'','','','','','','','',csvNum(c.per100.p,2),csvNum(c.per100.f,2),csvNum(c.per100.c,2),csvNum(c.per100.k,0)]);
  if(c.unk.length)rows.push(['КБЖУ не заполнено у сырья',c.unk.join('; ')]);
  return rows;
}
function canDl(){return!!S.dl||!window.claude;}
function anchorSave(text,name){
  var mime=/\.docx$/i.test(name)?'application/vnd.openxmlformats-officedocument.wordprocessingml.document':(/\.xlsx$/i.test(name)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':(/\.pdf$/i.test(name)?'application/pdf':(/\.json$/i.test(name)?'application/json':'text/csv;charset=utf-8')));
  var blob=new Blob([text],{type:mime});
  var url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(function(){document.body.removeChild(a);URL.revokeObjectURL(url);},1000);
  flash('Файл сохранён');
}
function readTextFile(file,cb){
  var fr=new FileReader();
  fr.onerror=function(){cb(true);};
  fr.onload=function(){
    var buf=fr.result,text;
    /* Excel сохраняет «CSV с разделителем — точка с запятой» в windows-1251, поэтому при ошибке UTF-8 пробуем её */
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf);}
    catch(e){try{text=new TextDecoder('windows-1251').decode(buf);}catch(e2){cb(true);return;}}
    cb(null,text);
  };
  fr.readAsArrayBuffer(file);
}
function exportFile(text,name){
  if(!S.dl){
    if(!window.claude){anchorSave(text,name);return;}
    flash('Скачивание здесь недоступно. Нажмите «Копировать для Excel».');return;
  }
  S.dl.save({filename:name,data:text}).then(function(){flash('Файл сохранён');},function(e){
    if(e&&e.code==='declined')return;
    flash('Не удалось скачать файл. Нажмите «Копировать для Excel».');
  });
}
function localNotice(){
  if(S.mode!=='local'||Object.keys(S.ings).length||Object.keys(S.recipes).length)return'';
  return'<ul class="warns notice"><li class="w-warn"><b>Данных нет.</b>Эта страница открыта без доступа к хранилищу claude.ai, поэтому база сырья и рецепты пусты: они лежат в хранилище страницы и не сохраняются в скачанной копии. Загрузите базу из файла: «База сырья» → «КБЖУ» → «Импорт из таблицы» → «Загрузить файл». Подойдёт CSV, который выгружает кнопка «Скачать CSV», или таблица из Excel. Можно и по ссылке на таблицу Google: «База сырья» → «КБЖУ» → «Загрузка по ссылке».</li></ul>';
}
