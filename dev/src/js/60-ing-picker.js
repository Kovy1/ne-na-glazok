/* ---------- выбор сырья с поиском (рецептура карты ТТК, загрузка ТТК) ---------- */
function pickLabel(id){if(id==='__new__')return'＋ Новое сырьё';if(id==='__skip__')return'Пропустить';if(id&&String(id).indexOf('pf:')===0){var pq=S.recipes[String(id).slice(3)];return pq?pfTitle(pq):'ТТК не найдена';}var i=S.ings[id];return i?(i.name||'Без названия'):(id?'Нет в базе':'');}
/* act: rowIng (строка рецептуры) или ttkIng (строка загруженной ТТК); extra: create — создать сырьё с набранным названием, new — добавить как новое при загрузке */
function pickerHtml(act,fk,id,aria,ph,extra,cls){
  return'<div class="ipick'+(cls?' '+cls:'')+'"><input class="ipi" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" autocomplete="off" spellcheck="false" data-pick="'+act+'" data-edit data-fk="'+esc(fk)+'" data-extra="'+(extra||'')+'" data-id="'+esc(id||'')+'" aria-label="'+esc(aria)+'" placeholder="'+esc(ph)+'" value="'+esc(pickLabel(id))+'"><div class="ipl" role="listbox" hidden></div></div>';
}
/* совпадения: каждое слово запроса должно встретиться в названии, синонимах или названии раздела; сначала начало слова в названии */
function pickMatch(q){
  var toks=catKey(q).split(/[\s,.;:()"«»\/\\\-+%]+/).filter(Boolean),res=[];
  Object.keys(S.ings).forEach(function(id){
    var i=S.ings[id],nm=catKey(i.name),cat=catKey(ingCat(i)),al=(i.aliases||[]).join(' '),sc=0,ok=true,k,t,p;
    for(k=0;k<toks.length&&ok;k++){
      t=toks[k];p=nm.indexOf(t);
      if(p===0||(p>0&&/[^а-яa-z0-9]/.test(nm.charAt(p-1))))sc+=0;
      else if(p>0)sc+=2;
      else if(al.indexOf(t)>-1)sc+=3;
      else if((' '+cat).indexOf(' '+t)>-1)sc+=4;
      else if(t.length>=5&&(' '+nm).indexOf(' '+t.slice(0,t.length>=7?-2:-1))>-1)sc+=1;   /* окончание слова не совпало: «говяд» находит «говяжья», «курицы» — «куриный» */
      else ok=false;
    }
    if(!ok)return;
    if(toks.length&&nm.indexOf(toks.join(' '))===0)sc-=1;
    res.push({id:id,sc:sc,nm:nm});
  });
  res.sort(function(a,b){return a.sc-b.sc||a.nm.length-b.nm.length||(a.nm<b.nm?-1:a.nm>b.nm?1:0);});
  return res;
}
var SKIP_OPT='<div class="ipo ipx{c}" role="option" data-v="__skip__" title="Строка остаётся в карте ТТК, но в КБЖУ, себестоимость и массу блюда не входит">Пропустить: не учитывать в расчёте</div>';
function pickOptHtml(id,cur){
  var i=S.ings[id];
  return'<div class="ipo'+(id===cur?' cur':'')+'" role="option" data-v="'+esc(id)+'">'+'<span class="ipn">'+esc(i.name||'Без названия')+'</span><small>'+(i.kind==='estimate'?'ориентир · ':'')+esc(ingCat(i))+'</small></div>';
}
/* полуфабрикаты для строки рецептуры: ТТК, отмеченные как полуфабрикат (по запросу — и любые другие), кроме самой карты и тех, что содержат её */
function pfPickIds(q){
  var cr=curRecipe(),toks=catKey(q||'').split(/[\s,.;:()"«»\/\\\-+%]+/).filter(Boolean);
  return Object.keys(S.recipes).filter(function(id){
    var x=S.recipes[id];
    if(x===cr||x.arch||!(x.output>0)||(cr&&pfUses(x,cr)))return false;
    if(!toks.length)return!!x.pf;
    var nm=catKey(x.name+' '+pfTitle(x));
    return toks.every(function(t){return nm.indexOf(t)>-1;});
  }).sort(function(a,b){var A=S.recipes[a],B=S.recipes[b];return(B.pf?1:0)-(A.pf?1:0)||String(A.name).localeCompare(String(B.name),'ru');});
}
function pfOptHtml(id,cur){
  var x=S.recipes[id];
  return'<div class="ipo'+(('pf:'+id)===cur?' cur':'')+'" role="option" data-v="pf:'+esc(id)+'"><span class="ipn">'+esc(pfTitle(x))+'</span><small>полуфабрикат · выход '+esc(toInput(x.output))+' г</small></div>';
}
function pickListHtml(q,cur,extra){
  var h='',qq=String(q||'').trim(),n,res,pfo=/pfonly/.test(extra||''),pfi;
  if(pfo){
    pfi=pfPickIds(qq);
    return pfi.length?pfi.map(function(id){return pfOptHtml(id,cur);}).join('')+(qq?'':'<div class="ipe">Другую карту найдёте, введя её название</div>'):'<div class="ipe">'+(qq?'Такой карты нет.':'Полуфабрикатов пока нет. Введите название карты или отметьте нужную ТТК галочкой «Полуфабрикат» в карточке блюда.')+'</div>';
  }
  var c1=/\|c1/.test(String(extra||'')),skipOpt=c1?'<div class="ipo ipx{c}" role="option" data-v="__skip__">Не вносить: цена позиции не загрузится</div>':SKIP_OPT;
  extra=String(extra||'').replace(/\|.*$/,'');
  pfi=extra==='create'?pfPickIds(qq):[];
  if(!qq){
    h+='<div class="ipo ipx'+(!cur?' cur':'')+'" role="option" data-v="">'+(extra==='new'?'— выбрать из базы —':'— сырьё не выбрано —')+'</div>';
    h+=skipOpt.replace('{c}',cur==='__skip__'?' cur':'');
    if(pfi.length)h+='<div class="ipg">Полуфабрикаты (ТТК)</div>'+pfi.map(function(id){return pfOptHtml(id,cur);}).join('');
    if(extra==='new')h+='<div class="ipo ipx'+(cur==='__new__'?' cur':'')+'" role="option" data-v="__new__">＋ Добавить как новое сырьё</div>';
    var by={};
    Object.keys(S.ings).sort(byName(S.ings)).forEach(function(id){var c=ingCat(S.ings[id]);(by[c]||(by[c]=[])).push(id);});
    catNames(S.ings).forEach(function(c){if(by[c])h+='<div class="ipg">'+esc(c)+'</div>'+by[c].map(function(id){return pickOptHtml(id,cur);}).join('');});
    return h;
  }
  res=pickMatch(qq);n=res.length;
  if(extra==='new')h+='<div class="ipo ipx" role="option" data-v="__new__">＋ Добавить как новое сырьё</div>';
  if(pfi.length)h+='<div class="ipg">Полуфабрикаты (ТТК)</div>'+pfi.slice(0,8).map(function(id){return pfOptHtml(id,cur);}).join('')+(res.length?'<div class="ipg">Сырьё из базы</div>':'');
  h+=res.slice(0,60).map(function(x){return pickOptHtml(x.id,cur);}).join('');
  if(!n&&!pfi.length)h+='<div class="ipe">Ничего не найдено</div>';
  else if(n>60)h+='<div class="ipe">Показано 60 из '+n+', уточните запрос</div>';
  h+=skipOpt.replace('{c}',cur==='__skip__'?' cur':'');
  if(extra==='create'){
    var exact=Object.keys(S.ings).some(function(id){return catKey(S.ings[id].name).trim()===catKey(qq);});
    if(!exact)h+='<div class="ipo ipx" role="option" data-v="__create__" data-q="'+esc(qq.slice(0,120))+'">＋ Добавить «'+esc(qq.slice(0,60))+'» в базу сырья</div>';
  }
  return h;
}
function pickList(inp){return inp.parentNode.querySelector('.ipl');}
function pickIsOpen(inp){var l=pickList(inp);return!!l&&!l.hidden;}
function pickClose(inp,revert){
  var l=pickList(inp);if(l){l.hidden=true;l.innerHTML='';}
  inp.setAttribute('aria-expanded','false');inp._typed=false;
  if(revert)inp.value=pickLabel(inp.getAttribute('data-id'));
}
function pickActive(inp,idx,scroll){
  var l=pickList(inp),os=l.querySelectorAll('.ipo');if(!os.length)return;
  if(idx<0)idx=os.length-1;if(idx>=os.length)idx=0;
  Array.prototype.forEach.call(os,function(o,k){o.classList.toggle('act',k===idx);});
  inp._ai=idx;if(scroll!==false&&os[idx].scrollIntoView)os[idx].scrollIntoView({block:'nearest'});
}
function pickOpen(inp){
  var l=pickList(inp),extra=inp.getAttribute('data-extra'),cur=inp.getAttribute('data-id'),q=inp._typed?inp.value:'';
  l.innerHTML=pickListHtml(q,cur,extra);l.hidden=false;l.classList.remove('up');
  inp.setAttribute('aria-expanded','true');
  var rc=inp.getBoundingClientRect(),below=window.innerHeight-rc.bottom;
  if(below<260&&rc.top>below)l.classList.add('up');
  var os=l.querySelectorAll('.ipo'),k=-1;
  if(q.trim()){for(var i=0;i<os.length;i++)if(!os[i].classList.contains('ipx')){k=i;break;}if(k<0&&os.length)k=0;}
  else{for(var j=0;j<os.length;j++)if(os[j].classList.contains('cur')){k=j;break;}}
  inp._ai=-1;
  if(k>=0)pickActive(inp,k,!q.trim());
}
function pickCommit(inp,v,q){
  var kind=inp.getAttribute('data-pick'),old=inp.getAttribute('data-id');
  if(kind==='rowIng'){
    var r=curRecipe(),row=r&&r.rows.filter(function(x){return x.rid===inp.closest('[data-rid]').getAttribute('data-rid');})[0];
    if(!row){pickClose(inp,true);return;}
    if(v==='__create__'){v=addNewIng(String(q||'').trim(),'');flash('Сырьё «'+String(q||'').trim()+'» добавлено в базу с нулевыми значениями: заполните КБЖУ во вкладке «База сырья».');}
    if(v===old){pickClose(inp,true);return;}
    if(S.pfOnly===row.rid)S.pfOnly=null;
    if(v==='__skip__'){row.ing='';row.skip=true;delete row.pf;}
    else if(String(v).indexOf('pf:')===0){row.ing='';delete row.skip;delete row.gross;row.pf=String(v).slice(3);}
    else{row.ing=v;delete row.skip;delete row.pf;if(S.na&&S.na[row.rid])netFromGross(row);}
    queueSave('recipes',S.active);S.focusFk=inp.getAttribute('data-fk');renderAll();
  }else if(kind==='fcIng'){
    var fe=S.fc.items&&S.fc.items[Number(String(inp.getAttribute('data-fk')||'').split(':')[1])];
    if(!fe){pickClose(inp,true);return;}
    if(v==='__skip__')fcSetMap(fe.kind,fe.nm,fe.code,'-');
    else if(v&&S.ings[v])fcSetMap(fe.kind,fe.nm,fe.code,v);
    else{pickClose(inp,true);return;}
    S.fc.itemEdit='';renderAll();
  }else if(kind==='c1Ing'){
    var cx=c1Item(inp);
    if(!cx){pickClose(inp,true);return;}
    if(v===old){pickClose(inp,true);return;}
    if(v==='__skip__'){cx.ing='';cx.add=false;cx.skip=true;cx.how='skip';cx.remember=false;}
    else if(v==='__new__'){cx.ing='';cx.add=true;cx.skip=false;cx.how='new';cx.remember=false;}
    else{cx.ing=v;cx.add=false;cx.skip=false;cx.how=v?'manual':'none';cx.remember=!!v;}
    cx.edit=false;S.focusFk='c1i:'+cx.i;renderAll();
  }else if(kind==='ttkIng'){
    var ti=Number(inp.closest('.trow').getAttribute('data-i')),tx=S.ttk&&S.ttk.rows[ti];
    if(!tx){pickClose(inp,true);return;}
    if(v===old){pickClose(inp,true);return;}
    if(v==='__skip__'){tx.ing='';tx.skip=true;tx.how='skip';tx.remember=false;}
    else{tx.ing=v;delete tx.skip;tx.how=v?'manual':'none';tx.remember=!!v&&v!=='__new__';}
    S.focusFk='t:'+ti;renderAll();
  }
}
function pickChoose(o){
  var inp=o.closest('.ipick').querySelector('.ipi');
  pickCommit(inp,o.getAttribute('data-v'),o.getAttribute('data-q'));
}
function rowName(row){var ig=S.ings[row.ing];if(row.pf){var q=pfRec(row);return q?pfTitle(q):'— ТТК не найдена —';}return ig?(ig.name||'Без названия'):(row.ing?'— нет в базе —':(row.skip?'— пропущено —':'— сырьё не выбрано —'));}
/* таблица расчёта КБЖУ: состав (сырьё и нетто) берётся из рецептуры карты ТТК, здесь можно менять только долю */
/* строки таблицы расчёта: пропущенные в расчёт не входят */
function calcRows(r){return r.rows.filter(function(x){return!(x.skip&&!x.ing);});}
function rowHtml(row,i){
  var n=i+1;
  return '<div class="row'+hlCls(row.rid)+'" data-rid="'+esc(row.rid)+'">'
    +'<span class="rnm'+((S.ings[row.ing]||pfRec(row))?'':' empty')+'">'+esc(rowName(row))+'</span>'
    +'<span class="out o-n" data-label="Нетто, г" data-out="n">'+toInput(row.net)+'</span>'
    +'<label class="cell sh" data-label="Доля в блюде, %"><input class="num" inputmode="decimal" autocomplete="off" aria-label="Доля в блюде, %, строка '+n+'" data-act="rowShare" data-edit data-fk="r:'+esc(row.rid)+':share" value="'+toInput(row.share)+'"></label>'
    +'<span class="out o-p" data-label="Б, г" data-out="p"></span>'
    +'<span class="out o-f" data-label="Ж, г" data-out="f"></span>'
    +'<span class="out o-c" data-label="У, г" data-out="c"></span>'
    +'<span class="out o-k" data-label="ккал" data-out="k"></span>'
    +'</div>';
}
function emptyCalc(){
  var note=Object.keys(S.recipes).length?'В регионе «'+esc(regionName(curRegion()))+'» ТТК нет: все они привязаны к другим регионам. Выберите другой регион вверху страницы или создайте карту для этого региона.':'Карт пока нет. Создайте новую или загрузите готовую.';
  return ttkHomeHtml(note);
}
function viewCalc(){
  var ids=visIds();
  if(!ids.length)return emptyCalc();
  var r=curRecipe();
  if(!r)return emptyCalc();
  var lyBtn=(S.mode==='local'&&syLinked()&&syFilesOn()&&!layOn()&&syFReady())?'<button class="btn" data-act="lyGo" data-edit title="Разложить ТТК по папкам и регионам так же, как лежат файлы в «ТТК в облаке»">Разложить как в облаке</button>':'';
  var ref=r.ref;
  var rgOpts='<option value="">Все регионы</option>'+regionList().map(function(g){return'<option value="'+esc(g.id)+'"'+(r.reg===g.id?' selected':'')+'>'+esc(g.name||g.id)+'</option>';}).join('');
  var lyItem=lyBtn?lyBtn.replace('<button class="btn"','<button role="menuitem"'):'';
  return '<div class="bar ttkbar">'
    +'<button class="btn" id="ttkBack" data-act="ttkHome" title="К выбору: создать новую или скачать из облака">‹ ТТК</button><span class="sp"></span>'
    +'<button class="btn" data-act="pvTtk" title="Показать карту так, как она будет в документе">Предпросмотр</button>'+(canDl()?'<button class="btn primary" data-act="dlTtk">Скачать ТТК (.docx)</button>':'')
    +'<span class="tmore"><button class="btn" id="ttkMore" data-act="ttkMore" aria-haspopup="true" aria-expanded="false">Ещё ▾</button>'
    +'<div class="tmenu" id="ttkMenu" role="menu" hidden>'
      +'<button role="menuitem" data-act="pickTtk" data-edit>Загрузить ТТК (.docx)</button>'
      +'<button role="menuitem" data-act="dupRecipe" data-edit>Сделать копию</button>'
      +'<button role="menuitem" data-act="rArch" data-edit title="Убрать блюдо из меню: ТТК сохранится">'+(r.arch?'Вернуть из архива':'В архив')+'</button>'
      +lyItem
      +'<hr><button role="menuitem" class="danger" data-act="delRecipe" data-edit>Удалить</button>'
    +'</div></span>'
    +'</div>'
    +'<div id="syStrip">'+syStripHtml(r)+'</div>'
    +'<nav class="jump" aria-label="Разделы страницы"><button class="btn mini" data-act="jump" data-to="secDish">Название и выход</button><button class="btn mini" data-act="jump" data-to="secDoc">Реквизиты и рецептура карты</button><button class="btn mini" data-act="jump" data-to="secTexts">Тексты разделов</button><button class="btn mini" data-act="jump" data-to="secDl">Скачать</button><button class="btn mini" data-act="jump" data-to="secKbzhu">КБЖУ и сверка</button><button class="btn mini" data-act="jump" data-to="secCalc">Таблица расчёта КБЖУ</button></nav>'
    +'<div id="secDish"><section class="card">'
      +'<div class="head2" style="margin-bottom:0">'
        +'<label class="field grow"><span class="lbl">Название блюда</span><input id="rname" data-act="rName" data-edit data-fk="rname" autocomplete="off" value="'+esc(r.name)+'" placeholder="Например: Котлета мясная 1/100 г"></label>'
        +'<label class="field w150"><span class="lbl">Выход 1 порции, г</span><input id="rout" class="num" inputmode="decimal" autocomplete="off" data-act="rOut" data-edit data-fk="rout" value="'+toInput(r.output)+'"></label>'
        +(menuCats().length&&!layOn()?'<label class="field w150"><span class="lbl">Папка меню</span><select data-act="rCat" data-edit data-fk="rcat">'+catOptionsHtml(r.cat)+'</select></label>':'')
        +(regionList().length>1?'<label class="field w150"><span class="lbl">Для региона</span><select data-act="rReg" data-edit data-fk="rreg" title="Если выход блюда в регионах разный, держите отдельную ТТК для каждого региона">'+rgOpts+'</select></label>':'')
      +'</div>'
      +'<label class="trem" style="margin-top:10px"><input type="checkbox" data-act="rPf" data-edit data-fk="rpf"'+(r.pf?' checked':'')+'>Полуфабрикат: эту карту можно добавлять в состав других ТТК</label>'
      +(function(){var u=pfUsedBy(S.active);return u.length?'<p class="hint" style="margin:6px 0 0">Используется как полуфабрикат в картах: '+u.slice(0,6).map(function(k){return'<button type="button" class="tlink" data-act="pfOpen" data-id="'+esc(k)+'">'+esc(S.recipes[k].name||'без названия')+'</button>';}).join(', ')+(u.length>6?' и ещё '+(u.length-6):'')+'. Изменения этой карты попадут в них.</p>':'';})()
    +'</section></div>'
    +viewTtkDoc(r)
    +'<h2 class="secttl" id="secKbzhu">Расчёт КБЖУ и сверка</h2><div class="cols"><div class="col-main">'
      +'<section class="card" id="results"><div id="resBody"></div><textarea id="copybox" class="copybox" rows="4" readonly hidden aria-label="Текст для копирования"></textarea></section>'
      +'</div><div class="col-side">'
      +'<section class="card" id="refCard"><h2>Сверка с протоколом или другой ТТК</h2>'
        +'<label class="field"><span class="lbl">Источник эталона</span><input data-act="refLabel" data-edit data-fk="ref:label" autocomplete="off" value="'+esc(ref.label)+'" placeholder="Например: протокол № 5909/26-П"></label>'
        +'<div class="refgrid">'
          +'<label class="field"><span class="lbl">Белки, г</span><input class="num" inputmode="decimal" data-act="refP" data-edit data-fk="ref:p" value="'+toInput(ref.p)+'"></label>'
          +'<label class="field"><span class="lbl">Жиры, г</span><input class="num" inputmode="decimal" data-act="refF" data-edit data-fk="ref:f" value="'+toInput(ref.f)+'"></label>'
          +'<label class="field"><span class="lbl">Углеводы, г</span><input class="num" inputmode="decimal" data-act="refC" data-edit data-fk="ref:c" value="'+toInput(ref.c)+'"></label>'
          +'<label class="field"><span class="lbl">Ккал</span><input class="num" inputmode="decimal" data-act="refK" data-edit data-fk="ref:k" value="'+toInput(ref.kcal)+'"></label>'
        +'</div>'
        +'<div class="refrow"><label class="field"><span class="lbl">Значения эталона даны</span><select data-act="refBasis" data-edit data-fk="ref:basis"><option value="100"'+(ref.basis!=='portion'?' selected':'')+'>на 100 г готового блюда</option><option value="portion"'+(ref.basis==='portion'?' selected':'')+'>на 1 порцию</option></select></label><label class="field"><span class="lbl">Допуск, %</span><input class="num" inputmode="decimal" data-act="refTol" data-edit data-fk="ref:tol" value="'+toInput(ref.tol)+'"></label></div><p class="muted" id="refHint" style="font-size:12px;margin-top:6px"></p>'
        +'<div class="scroll" id="refTable"></div>'
      +'</section>'
    +'</div></div>'
    +'<div id="secCalc"><section class="card"><h2>Таблица расчёта КБЖУ по сырью</h2>'
      +'<p class="hint" style="margin:-4px 0 10px">Таблица ничего не вводит: сырьё и нетто она берёт из рецептуры карты ТТК выше. Добавлять и убирать сырьё нужно там, здесь можно изменить только долю.</p>'
      +'<div class="rows">'
        +'<div class="row rowhead"><span>Сырьё</span><span class="r">Нетто, г</span><span class="r" title="Какая часть сырья остаётся в блюде">Доля, %</span><span class="r">Б, г</span><span class="r">Ж, г</span><span class="r">У, г</span><span class="r">ккал</span></div>'
        +(calcRows(r).length?calcRows(r).map(rowHtml).join(''):'<p class="muted" style="margin:8px 0">В рецептуре пока нет сырья.</p>')
      +'</div>'
      +'<p class="hint">КБЖУ считается по нетто. «Доля, %» по умолчанию 100: если часть масла остаётся на сковороде, уменьшите долю в строке масла. Себестоимость считается по брутто из рецептуры. Нужного сырья нет в списке? Добавьте его во вкладке «База сырья».</p>'
    +'</section></div>';
}

/* поля брутто в расчёте и в карте ТТК показывают одно и то же: свою цифру или серую подсказку из потерь; поле, в котором печатают, не трогаем */
function syncGross(row){
  var act=document.activeElement,gd=toInput(Math.round(grossDefault(row)*1000)/1000),ex=(row.gross!==undefined&&row.gross!==null)?toInput(row.gross):'';
  $$('[data-rid="'+row.rid+'"] input[data-act="tGross"]').forEach(function(i){
    i.placeholder=gd;
    if(i!==act)i.value=ex;
  });
}
function updateCalc(){
  var r=curRecipe();if(!r||S.tab!=='calc')return;
  var c=compute(r,S.ings);
  r.rows.forEach(function(row){
    var el=$('.row[data-rid="'+row.rid+'"]');if(!el)return;
    var o=c.rows[row.rid];
    var nmEl=el.querySelector('.rnm');if(nmEl){nmEl.textContent=rowName(row);nmEl.classList.toggle('empty',!(S.ings[row.ing]||pfRec(row)));}
    var nnEl=el.querySelector('[data-out="n"]');if(nnEl)nnEl.textContent=toInput(row.net);
    ['p','f','c','k'].forEach(function(k){
      var n=el.querySelector('[data-out="'+k+'"]');
      if(n){n.textContent=o.has&&!o.unk?fmt(o[k],k==='k'?0:1):'—';n.title=o.unk?'КБЖУ этого сырья не заполнено: в расчёте оно считается нулём':'';}
    });
    el.classList.toggle('unk',!!o.unk);
    syncGross(row);
  });
  var rb=$('#resBody');if(rb)rb.innerHTML=resultsHtml(r,c);
  var rt=$('#refTable');if(rt)rt.innerHTML=refTableHtml(r,c);
  ttkSync(r);
  var rh=$('#refHint');if(rh)rh.textContent=r.ref.basis==='portion'?'Эталон сравнивается с итогом на порцию рецептуры ('+fmt(c.eff,0)+' г сырья в блюде, выход '+fmt(r.output,0)+' г).':'Эталон сравнивается с расчётом на 100 г готового блюда.';
}
/* расчёт изменился: обновить цифры в части «Карта ТТК» без перерисовки; если поменялся состав строк, перерисовать */
function ttkSync(r){
  var els=$$('.trw[data-rid]'),rows=r.rows,inl={};
  ttkRowList(r).forEach(function(x){inl[x.rid]=1;});
  if(els.length!==rows.length||rows.some(function(x,i){return els[i].getAttribute('data-rid')!==x.rid||els[i].getAttribute('data-inl')!==(inl[x.rid]?'1':'0');})){scheduleRender();return;}
  var act=document.activeElement;
  rows.forEach(function(x,i){
    var ing=S.ings[x.ing],tn=els[i].querySelector('input[data-act="tName"]'),nt=els[i].querySelector('input[data-act="rowNet"]'),ps=els[i].querySelector('.pfst');
    if(x.pf){var pq=pfRec(x);if(tn&&tn!==act)tn.value=pq?pfTitle(pq):'';if(ps)ps.textContent=pfSubText(x);}
    else if(tn){tn.placeholder=ing?ing.name:'Название';if(!x.tname&&tn!==act)tn.value=ing?ing.name:'';}
    if(nt&&nt!==act)nt.value=toInput(x.net);
  });
  if(!NOPRICE){
    var kc=ttkCosts(r);
    rows.forEach(function(x,i){
      var cs=els[i].querySelector('[data-out="rc"]'),cx=kc.by[x.rid];
      if(!cs)return;
      cs.textContent=ttkCostCell(cx);cs.title=ttkCostTitle(cx);cs.classList.toggle('has',!!(cx&&cx.sum!==null));
    });
    var tc=$('#ttkCost');if(tc)tc.innerHTML=ttkCostHtml(r);
  }
  var o=$('#ttkOutShow');if(o)o.value=toInput(r.output);
  ttkLive(r);
}
function macroHtml(l,name,v,cls,lb){
  return '<div class="macro"><span class="sw '+cls+'">'+l+'</span><span class="mv">'+(lb?'≥ ':'')+fmt(v,1)+'<small> г</small></span><span class="ml">'+name+'</span></div>';
}
function warnHtml(r,c){
  var w=[];
  if(!(r.output>0))w.push(['bad','Ошибка','Укажите выход готового блюда больше нуля.']);
  if(c.unassigned)w.push(['bad','Ошибка','Строк с массой, но без выбранного сырья: '+c.unassigned+'.']);
  if(c.missing)w.push(['bad','Ошибка','Строк, где сырья нет в базе: '+c.missing+'. Выберите другое сырьё или добавьте его в базу.']);
  if(c.nonet)w.push(['warn','Не указано нетто','В строках рецептуры нетто пустое или 0: '+c.nonet+'. КБЖУ считается по нетто, эти строки пока дают нули. Впишите «Нетто, г» в рецептуре карты ТТК; если известно только брутто, впишите его: нетто посчитается по потерям сырья.']);
  var estOnly=c.est.filter(function(n){return c.unk.indexOf(n)<0;});
  if(c.unk.length)w.push(['bad','КБЖУ не заполнено','У сырья: '+c.unk.map(esc).join(', ')+'. Оно посчитано как ноль, поэтому значения блюда занижены (в результате они помечены «не менее»). Впишите КБЖУ в базе сырья; если у продукта правда нет белков, жиров и углеводов (вода, соль), отметьте у позиции в базе сырья («⋯» → «Ноль настоящий»).']);
  if(estOnly.length)w.push(['warn','Внимание','Ориентировочные значения у сырья: '+estOnly.map(esc).join(', ')+'. Расчёт предварительный. Замените данные в базе на этикетку, справочник или лабораторные значения.']);
  if(!w.length&&r.rows.length)w.push(['good','Готово','Ориентировочных значений в расчёте нет.']);
  return '<ul class="warns">'+w.map(function(x){return '<li class="w-'+x[0]+'"><b>'+x[1]+'.</b>'+x[2]+'</li>';}).join('')+'</ul>';
}
function resultsHtml(r,c){
  var h='<h2>Результат'+(r.name?': '+esc(r.name):'')+'</h2>';
  if(!c.per100){return h+'<p class="muted">Заполните выход готового блюда, чтобы получить расчёт на 100 г.</p>'+warnHtml(r,c);}
  var a=c.per100,y=r.output,kj=a.k*KJ_PER_KCAL,lb=c.unk.length>0;
  if(lb)h+='<div class="unkbar" role="alert"><b>КБЖУ не заполнено у '+c.unk.length+' '+(c.unk.length%10===1&&c.unk.length%100!==11?'ингредиента':'ингредиентов')+'</b><span>'+c.unk.map(esc).join(', ')+'. Эти продукты посчитаны как ноль: показанные значения — «не менее».</span></div>';
  var tot=a.k,sp=tot>0?KCAL_P*a.p/tot*100:0,sf=tot>0?KCAL_F*a.f/tot*100:0,sc=tot>0?KCAL_C*a.c/tot*100:0;
  h+='<div class="hero'+(lb?' unkv':'')+'"><div class="kcal"><span class="big">'+(lb?'≥ ':'')+fmt(a.k,0)+'</span><span class="unit">ккал<br>на 100 г</span></div><div class="kj">'+(lb?'≥ ':'')+fmt(kj,0)+' кДж</div></div>';
  h+='<div class="macros'+(lb?' unkv':'')+'">'+macroHtml('Б','Белки',a.p,'p',lb)+macroHtml('Ж','Жиры',a.f,'f',lb)+macroHtml('У','Углеводы',a.c,'c',lb)+'</div>';
  if(tot>0){
    h+='<div class="split" role="img" aria-label="Вклад в калорийность: белки '+Math.round(sp)+'%, жиры '+Math.round(sf)+'%, углеводы '+Math.round(sc)+'%"><i class="p" style="flex:'+sp+'"></i><i class="f" style="flex:'+sf+'"></i><i class="c" style="flex:'+sc+'"></i></div>';
    h+='<div class="legend"><span class="p">Белки '+Math.round(sp)+'%</span><span class="f">Жиры '+Math.round(sf)+'%</span><span class="c">Углеводы '+Math.round(sc)+'%</span></div>';
  }
  var same=Math.abs(y-100)<1e-9,pt=c.portion;
  function tr(label,v,which){
    var g=lb?'≥ ':'';return '<tr><th scope="row">'+label+'</th><td class="n">'+g+fmt(v.p,1)+'</td><td class="n">'+g+fmt(v.f,1)+'</td><td class="n">'+g+fmt(v.c,1)+'</td><td class="n">'+g+fmt(v.k,0)+'</td><td class="n">'+g+fmt(v.k*KJ_PER_KCAL,0)+'</td><td><button class="btn mini" data-act="copy" data-which="'+which+'">Копировать</button></td></tr>';
  }
  h+='<div class="scroll"><table><thead><tr><th></th><th title="Белки">Б, г</th><th title="Жиры">Ж, г</th><th title="Углеводы">У, г</th><th>Ккал</th><th>кДж</th><th></th></tr></thead><tbody>'
    +(same?tr('100 г (порция)',a,'100'):tr('На 100 г',a,'100')+tr('1 порция ('+fmt(y,0)+' г)',pt,'por'))
    +'</tbody></table></div>';
  h+='<div class="btns" style="margin-top:12px">'+(canDl()?'<button class="btn" data-act="dlRecipe">Скачать расчёт (CSV)</button>':'')+'<button class="btn" data-act="cpRecipe">Копировать для Excel</button></div>';
  if(c.eff>0){
    var d=c.eff-y,lbl=d>=0?'Убыль массы':'Прирост массы';
    h+='<dl class="kv"><div><dt>Масса сырья в блюде</dt><dd>'+fmt(c.eff,1)+' г</dd></div><div><dt>Выход готового</dt><dd>'+fmt(y,1)+' г</dd></div><div><dt>'+lbl+'</dt><dd>'+fmt(Math.abs(d)/c.eff*100,0)+' %</dd></div></dl>';
  }
  h+=costHtml(r);
  h+=warnHtml(r,c);
  h+='<p class="method">Расчёт: сумма (нетто × доля × состав на 100 г ÷ 100), пересчитанная на 100 г выхода. Калорийность = 4·Б + 9·Ж + 4·У, кДж = ккал × 4,184. Потери белков, жиров и углеводов при тепловой обработке не учитываются: вся их масса остаётся в готовом блюде.</p>';
  return h;
}
function refTableHtml(r,c){
  var ref=r.ref,any=[ref.p,ref.f,ref.c,ref.kcal].some(function(v){return v!==null;});
  var perPortion=ref.basis==='portion',src=perPortion?c.portion:c.per100;
  if(!any)return '<p class="hint" style="margin-top:0">Введите значения из протокола или другой карточки, укажите, на что они даны (на 100 г или на порцию), и здесь появится расхождение с расчётом.</p>';
  if(!src)return '<p class="hint" style="margin-top:0">Расчёт недоступен: укажите выход готового блюда.</p>';
  var items=[['Белки, г','p',1],['Жиры, г','f',1],['Углеводы, г','c',1],['Ккал','kcal',0]];
  var tol=ref.tol,unkN=c.unk.length;
  var h=(unkN?'<p class="unkbar" role="alert"><b>Расчёт неполный</b><span>КБЖУ не заполнено у сырья: '+c.unk.map(esc).join(', ')+'. Расхождение с эталоном ниже показывает недостающие данные, а не ошибку в карте.</span></p>':'')+'<table><thead><tr><th>Показатель</th><th>Расчёт'+(perPortion?' на порцию':' на 100 г')+'</th><th>Эталон</th><th>Δ</th><th>Δ, %</th><th>Оценка</th></tr></thead><tbody>';
  items.forEach(function(it){
    var calc=it[1]==='kcal'?src.k:src[it[1]],rv=ref[it[1]];
    if(rv===null){h+='<tr><th scope="row">'+it[0]+'</th><td class="n">'+fmt(calc,it[2])+'</td><td class="n">—</td><td class="n">—</td><td class="n">—</td><td></td></tr>';return;}
    var abs=calc-rv,pct=rv>0?abs/rv*100:null,cls='',txt='—';
    if(pct!==null){var a=Math.abs(pct);if(unkN&&abs<0){cls='warn';txt='Расчёт неполный';}else if(a<=tol){cls='good';txt='В допуске';}else if(a<=2*tol){cls='warn';txt='Расхождение';}else{cls='bad';txt='Не сходится';}}
    h+='<tr><th scope="row">'+it[0]+'</th><td class="n">'+fmt(calc,it[2])+'</td><td class="n">'+fmt(rv,it[2])+'</td><td class="n">'+signed(abs,it[2])+'</td><td class="n">'+(pct===null?'—':signed(pct,0))+'</td><td>'+(cls?'<span class="pill '+cls+'">'+txt+'</span>':'')+'</td></tr>';
  });
  h+='</tbody></table><p class="hint">Допуск ±'+fmt(tol,tol%1?1:0)+' %. До удвоенного допуска оценка «Расхождение», выше «Не сходится». Допуск условный, задайте свой.'+(ref.label?' Эталон: '+esc(ref.label)+'.':'')+'</p>';
  return h;
}

