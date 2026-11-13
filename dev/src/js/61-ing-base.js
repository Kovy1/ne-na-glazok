/* ---------- ingredient base ---------- */
function chipsHtml(){
  var ids=Object.keys(S.ings),n=ids.length,e=ids.filter(function(id){return S.ings[id].kind==='estimate';}).length,u=ids.filter(function(id){return kUnknown(S.ings[id]);}).length;
  return '<button class="chip" data-act="filterAll" aria-pressed="'+(!S.onlyEst&&!S.onlyUnk)+'">Все · '+n+'</button><button class="chip" data-act="filterEst" aria-pressed="'+(!!S.onlyEst)+'">Ориентир · '+e+'</button>'
    +(u?'<button class="chip" data-act="filterUnk" aria-pressed="'+(!!S.onlyUnk)+'" title="Сырьё с пометкой «Ориентир» и нулями вместо КБЖУ: в расчёте карт оно считается нулём">КБЖУ не заполнено · '+u+'</button>':'');
}
/* ---------- разделы сырья в базе ---------- */
var CAT_NAMES=null;
function catCounts(){var m={};Object.keys(S.ings).forEach(function(id){var c=ingCat(S.ings[id]);m[c]=(m[c]||0)+1;});return m;}
function catFilterOpts(){
  var cnt=catCounts(),n=Object.keys(S.ings).length;
  return '<option value="">Все разделы · '+n+'</option>'+catNames(S.ings).filter(function(c){return cnt[c]||c===S.catF;}).map(function(c){return'<option value="'+esc(c)+'"'+(c===S.catF?' selected':'')+'>'+esc(c)+' · '+(cnt[c]||0)+'</option>';}).join('');
}
function catOptsHtml(cur){
  return(CAT_NAMES||catNames(S.ings)).map(function(c){return'<option value="'+esc(c)+'"'+(c===cur?' selected':'')+'>'+esc(c)+'</option>';}).join('')+'<option value="__new__">＋ Другой раздел…</option>';
}
function catHeadHtml(name,n){return'<div class="cathead" data-cat="'+esc(name)+'"><span class="cn">'+esc(name)+'</span><span class="cc">'+n+'</span></div>';}
/* раздел сырья вручную: совпадающий с определённым по названию не хранится, чтобы в общую базу уходили только свои правки */
function setIngCat(id,val){
  var ing=S.ings[id];if(!ing)return;
  val=String(val==null?'':val).trim().replace(/\s+/g,' ').slice(0,40);
  if(!val||val===autoCat(ing.name))delete ing.cat;else ing.cat=val;
  queueSave('ingredients',id);
}
function refreshIngList(){
  var l=$('#ingList');if(l){l.innerHTML=ingListHtml();if(uiRO())$$('#ingList [data-edit]').forEach(function(x){x.disabled=true;});}
  var f=$('#catF');if(f)f.innerHTML=catFilterOpts();
  var ch=$('#chips');if(ch)ch.innerHTML=chipsHtml();
}
function kindOptions(sel){return Object.keys(KINDS).map(function(k){return '<option value="'+k+'"'+(k===sel?' selected':'')+'>'+KINDS[k]+'</option>';}).join('');}
function ingRowHtml(id){
  var i=S.ings[id],k=KCAL_P*i.p+KCAL_F*i.f+KCAL_C*i.c,fk='i:'+esc(id)+':',l=i.loss||{},uk=kUnknown(i);
  function nf(act,cls,label,v,f){return '<label class="cell '+cls+'" data-label="'+label+'"><input class="num" inputmode="decimal" autocomplete="off" aria-label="'+label+' на 100 г" data-act="'+act+'" data-edit data-fk="'+fk+f+'" value="'+(uk?'':toInput(v))+'"'+(uk?' placeholder="—" title="КБЖУ не заполнено"':'')+'></label>';}
  function lf(key,label,title){var v=l[key];return '<label class="cell il il-'+key+'" data-label="'+label+'"><input class="num" inputmode="decimal" autocomplete="off" aria-label="'+title+', %" title="'+title+', %" data-act="iLoss" data-k="'+key+'" data-edit data-fk="'+fk+'l'+key+'" value="'+toInput(v===undefined?null:v)+'" placeholder="—"></label>';}
  var open=!!LOSSUI.more[id];
  return '<div class="irow'+(i.kind==='estimate'?' est':'')+(uk?' unk':'')+'" data-iid="'+esc(id)+'">'
    +'<input class="nm" aria-label="Название" autocomplete="off" data-act="iName" data-edit data-fk="'+fk+'name" value="'+esc(i.name)+'" placeholder="Название сырья"'+(i.kind==='estimate'?' title="Ориентир: значения ещё не сверены"':'')+'>'
    +nf('iP','ip','Белки',i.p,'p')+nf('iF','if','Жиры',i.f,'f')+nf('iC','ic','Углеводы',i.c,'c')
    +'<span class="out ik" data-label="ккал" data-out="k"'+(uk?' title="КБЖУ не заполнено"':'')+'>'+(uk?'—':fmt(k,0))+'</span>'
    +lf('cold','Х/о','Холодная обработка (отходы при очистке)')+lf('boil','Варка','Потери при варке')+lf('fry','Жарка','Потери при жарке')+lf('stew','Тушение','Потери при тушении')+lf('bake','Запекание','Потери при запекании')
    +'<button class="mbtn" data-act="iMore" aria-expanded="'+open+'" aria-label="Раздел, тип данных и источник" title="Раздел, тип данных, источник">⋯</button>'
    +'<button class="x" data-act="delIng" data-edit aria-label="Удалить сырьё" title="Удалить сырьё">×</button>'
    +'</div>'
    +(open?'<div class="irow more" data-iid="'+esc(id)+'"><span class="mlbl">Подробнее</span>'
      +(S.catNew===id
        ?'<input class="icat" aria-label="Название нового раздела" maxlength="40" autocomplete="off" data-act="iCatNew" data-edit data-fk="'+fk+'cat" placeholder="Название раздела">'
        :'<select class="icat" aria-label="Раздел" data-act="iCat" data-edit data-fk="'+fk+'cat">'+catOptsHtml(ingCat(i))+'</select>')
      +'<select class="kind" aria-label="Тип данных" data-act="iKind" data-edit data-kind="'+i.kind+'" data-fk="'+fk+'kind">'+kindOptions(i.kind)+'</select>'
      +'<input class="src" aria-label="Источник" autocomplete="off" data-act="iSrc" data-edit data-fk="'+fk+'src" value="'+esc(i.source)+'" placeholder="Источник: этикетка, таблица, протокол">'
      +(uk?'<span class="zrow"><span class="sysub">КБЖУ не заполнено: в картах считается нулём. Впишите значения выше. Если белков, жиров и углеводов в продукте нет (вода, соль), подтвердите ноль.</span> <button type="button" class="btn mini" data-act="iZero" data-edit>Ноль настоящий</button></span>':'')
      +'</div>':'');
}
function ingListHtml(){
  var q=catKey(S.q.trim());
  var ids=Object.keys(S.ings).sort(byName(S.ings)).filter(function(id){
    var i=S.ings[id];
    if(S.onlyEst&&i.kind!=='estimate')return false;
    if(S.onlyUnk&&!kUnknown(i))return false;
    if(S.catF&&String(i.name).trim()&&ingCat(i)!==S.catF)return false;
    return!q||catKey(i.name).indexOf(q)>-1||catKey(i.source).indexOf(q)>-1||catKey(ingCat(i)).indexOf(q)>-1;
  });
  if(!Object.keys(S.ings).length){
    return '<div class="card empty"><h2>База сырья пуста</h2><p>Добавьте продукты по одному или вставьте таблицу из Excel: название, белки, жиры, углеводы на 100 г и источник.</p><div class="btns"><button class="btn primary" data-act="newIng" data-edit>Новое сырьё</button></div></div>';
  }
  if(!ids.length)return '<p class="muted">Ничего не найдено. Измените поиск или фильтр.</p>';
  /* сырьё без названия (только что добавленное) стоит сверху, остальное по разделам */
  var groups={},pin=[];
  ids.forEach(function(id){var i=S.ings[id];if(!String(i.name).trim()){pin.push(id);return;}var c=ingCat(i);(groups[c]||(groups[c]=[])).push(id);});
  CAT_NAMES=catNames(S.ings);
  var h='<div class="card"><div class="irow ihead"><span>Название</span><span class="r">Б</span><span class="r">Ж</span><span class="r">У</span><span class="r">ккал</span><span class="r" title="Холодная обработка: отходы при очистке, из брутто получается нетто">Х/о, %</span><span class="r">Варка</span><span class="r">Жарка</span><span class="r">Тушение</span><span class="r">Запек.</span><span></span><span></span></div>';
  if(pin.length)h+=catHeadHtml('Новое сырьё',pin.length)+pin.map(ingRowHtml).join('');
  CAT_NAMES.forEach(function(c){if(groups[c])h+=catHeadHtml(c,groups[c].length)+groups[c].map(ingRowHtml).join('');});
  CAT_NAMES=null;
  return h+'</div>';
}
function regionsHtml(){
  var l=regionList(),cur=curRegion();
  var h='<p class="rgnote">В списке показаны цены региона <b>'+esc(regionName(cur))+'</b>'+(l.length>1?'. Другой регион выбирается вверху страницы.':'.')+' База сырья, КБЖУ и ТТК у регионов общие.</p>';
  h+='<details class="pgroup rgcard" id="rgCard"'+(S.rgOpen?' open':'')+'><summary>Регионы цен · '+l.length+'</summary><div class="rglist">';
  l.forEach(function(g){
    h+='<div class="rgrow" data-rg="'+esc(g.id)+'"><input aria-label="Название региона" data-act="rgName" data-edit data-fk="rg:'+esc(g.id)+'" autocomplete="off" value="'+esc(g.name)+'" placeholder="Название региона">'
      +(g.id===MAIN?'<span class="muted">основной</span>':'<button class="btn danger mini" data-act="rgDel" data-edit>Удалить</button>')+'</div>';
  });
  h+='</div><div class="btns"><button class="btn" data-act="rgAdd" data-edit'+(l.length>=8?' disabled':'')+'>Добавить регион</button></div>'
    +'<p class="hint">У каждого региона свои цены, единица цены и масса упаковки. Удаление региона стирает его цены у всего сырья и цены продажи блюд.</p></details>';
  return h;
}
/*MG-START*/
/* ---------- сырьё без КБЖУ, заведённое при загрузке ТТК: объединение с тем, что уже есть в базе ----------
   Карты переходят на выбранное сырьё, название из карты запоминается синонимом, лишняя позиция удаляется. Цена переносится, если у принимающего её нет. */
function mgCand(o){return!!o&&o.kind==='estimate'&&!(o.p||o.f||o.c)&&/^Добавлено из ТТК/.test(String(o.source||''));}
function mgOn(){return S.mode==='local'&&(!syLinked()||syAdmin());}
function mg(){return S.mg||(S.mg={sel:{},show:60,open:false,busy:false,ask:0,cards:{}});}
function mgGoLabel(k){var M=mg();return(M.ask&&M.ask===k)?'Нажмите ещё раз: применить '+k:'Применить: '+k;}
function mgCount(){var n=0;Object.keys(S.ings).forEach(function(id){if(mgCand(S.ings[id]))n++;});return n;}
function mgUses(){
  var u={};
  Object.keys(S.recipes).forEach(function(rid){var seen={};S.recipes[rid].rows.forEach(function(x){if(x.ing&&!seen[x.ing]){seen[x.ing]=1;u[x.ing]=(u[x.ing]||0)+1;}});});
  return u;
}
/* карты, где стоит это сырьё, и как оно названо в строке карты */
function mgCardsOf(id){
  var out=[];
  Object.keys(S.recipes).forEach(function(rid){
    var r=S.recipes[rid],hit=r.rows.filter(function(x){return x.ing===id;});
    if(hit.length)out.push({rid:rid,name:recLabel(r),rows:hit});
  });
  out.sort(function(a,b){return String(a.name).localeCompare(String(b.name),'ru');});
  return out;
}
function mgCardsHtml(id){
  var cs=mgCardsOf(id),h='<div class="mgcards" style="margin-top:6px;font-size:13px">';
  cs.slice(0,40).forEach(function(c){
    var x=c.rows[0];
    h+='<div><button type="button" class="tlink" data-act="mgOpen" data-rid="'+esc(c.rid)+'">'+esc(c.name)+'</button>'
      +(x.net>0?' <span class="sysub">нетто '+(Math.round(x.net*10)/10)+' г'+(c.rows.length>1?', строк: '+c.rows.length:'')+'</span>':'')+'</div>';
  });
  if(cs.length>40)h+='<div class="sysub">…и ещё карт: '+(cs.length-40)+'</div>';
  return h+'</div>';
}
/* список: у каждой позиции до пяти подсказок из остальной базы; одинаковые позиции из загрузки подсказываются друг другу (в сторону более ранней в списке) */
function mgList(){
  var uses=mgUses(),cand=[],pool=[];
  Object.keys(S.ings).forEach(function(id){
    var o=S.ings[id];
    if(mgCand(o))cand.push(id);else pool.push({id:id,st:stemList(o.name),name:String(o.name||'')});
  });
  cand.sort(function(a,b){var d=(uses[b]||0)-(uses[a]||0);return d||String(S.ings[a].name).localeCompare(String(S.ings[b].name),'ru');});
  var cs=cand.map(function(id){return{id:id,st:stemList(S.ings[id].name),name:String(S.ings[id].name||'')};});
  var rows=cand.map(function(id,i){
    var A=cs[i].st,sg=[];
    function take(q,min,dup){
      var B=q.st,common,dice;
      if(!B.length||!A.length||B.indexOf(A[0])<0)return;      /* главное слово названия должно встретиться и там */
      common=A.filter(function(s){return B.indexOf(s)>-1;}).length;
      if(!common)return;
      dice=2*common/(A.length+B.length);
      if(dice<min-1e-9)return;
      sg.push({id:q.id,name:q.name,sc:dice,cov:common/A.length,dup:!!dup});
    }
    pool.forEach(function(q){take(q,0.3,false);});
    for(var j=0;j<i;j++)take(cs[j],0.5,true);
    sg.sort(function(a,b){return(b.sc-a.sc)||(b.cov-a.cov)||(a.name.length-b.name.length);});
    return{id:id,name:cs[i].name,n:uses[id]||0,sg:sg.slice(0,5)};
  });
  rows.sort(function(a,b){return((b.sg.length>0&&b.sg[0].sc>=0.5)-(a.sg.length>0&&a.sg[0].sc>=0.5));});     /* сначала те, для кого есть хорошая подсказка; порядок внутри — по числу карт */
  return rows;
}
/* название, выбранное из списка всей базы сырья: точное совпадение, иначе единственное сырьё, в названии которого есть введённое */
function mgFindId(text,self){
  var k=normKey(text),ids=Object.keys(S.ings).filter(function(id){return id!==self;}),ex=[],part=[];
  if(!k)return'';
  ids.forEach(function(id){var n=normKey(S.ings[id].name);if(n===k)ex.push(id);else if(n.indexOf(k)>-1)part.push(id);});
  if(ex.length)return ex.filter(function(id){return!mgCand(S.ings[id]);})[0]||ex[0];
  return part.length===1?part[0]:'';
}
function mgDataList(){
  var ids=Object.keys(S.ings).sort(function(a,b){return String(S.ings[a].name).localeCompare(String(S.ings[b].name),'ru');});
  return'<datalist id="mgDl">'+ids.map(function(id){var o=S.ings[id];return'<option value="'+esc(o.name)+'"'+(mgCand(o)?' label="без КБЖУ, из загрузки"':'')+'></option>';}).join('')+'</datalist>';
}
function mgSelCount(){var M=mg(),n=0;Object.keys(M.sel).forEach(function(id){var t=M.sel[id];if(t&&S.ings[id]&&(t==='__skip__'||S.ings[t]))n++;});return n;}
function mgRowHtml(r){
  var M=mg(),cur=M.sel[r.id]||'',own=cur&&cur!=='__skip__'&&S.ings[cur]&&!r.sg.some(function(x){return x.id===cur;});
  return'<div class="syrow"><div class="syn"><b>'+esc(r.name)+'</b> '+(r.n?'<button type="button" class="tlink" style="font-size:12px" data-act="mgCards" data-id="'+esc(r.id)+'" aria-expanded="'+(M.cards[r.id]?'true':'false')+'">в картах: '+r.n+(M.cards[r.id]?' ▴':' ▾')+'</button>':'<span class="sysub">в картах: 0</span>')
    +(M.cards[r.id]&&r.n?mgCardsHtml(r.id):'')+'</div><div class="syst">'
    +(r.sg.length||own?'':'<span class="sysub">похожего в базе нет</span>')
    +'<select data-act="mgPick" data-id="'+esc(r.id)+'" data-edit aria-label="Что сделать с «'+esc(r.name)+'»"><option value="">Оставить как есть</option>'
      +'<option value="__skip__"'+(cur==='__skip__'?' selected':'')+'>Не считать: строка останется в карте без расчёта</option>'
      +(own?'<option value="'+esc(cur)+'" selected>Объединить с «'+esc(S.ings[cur].name)+'» (выбрано вами)</option>':'')
      +r.sg.map(function(x){return'<option value="'+esc(x.id)+'"'+(cur===x.id?' selected':'')+'>'+(x.dup?'Дубль: ':'Объединить с ')+'«'+esc(x.name)+'» ('+Math.round(x.sc*100)+' %)</option>';}).join('')+'</select>'
    +'<input type="text" list="mgDl" data-act="mgFind" data-id="'+esc(r.id)+'" data-edit autocomplete="off" spellcheck="false" placeholder="Найти другое сырьё в базе…" aria-label="Найти в базе сырья замену для «'+esc(r.name)+'»" style="width:260px;max-width:100%;font-size:13px;padding:4px 8px"></div></div>';
}
function mgInnerHtml(){
  var M=mg(),n=mgCount(),h='<summary>Сырьё без КБЖУ из загрузки карт · '+n+'</summary>',rows,shown,k;
  if(!n)return h+'<p class="hint">Такого сырья нет.</p>';
  if(!M.open)return h;
  rows=mgList();shown=rows.slice(0,M.show);k=mgSelCount();
  h+='<p class="hint" style="margin-top:0">Эти позиции заведены при загрузке карт: название в карте не совпало с вашим сырьём. Для каждой выберите: объединить с вашим сырьём (карты перейдут на него, название запомнится синонимом, лишняя позиция удалится) или «Не считать» (строка останется в карте без расчёта, как «Тесто»). «Подставить подсказки» выбирает только близкие совпадения; остальное найдите в поле поиска. «в картах: N» показывает, где стоит позиция.</p>'
    +'<div class="btns"><button class="btn mini" data-act="mgBest" data-edit>Подставить подсказки</button><button class="btn mini" data-act="mgClear">Снять выбор</button></div>'
    +'<div class="sylist">'+shown.map(mgRowHtml).join('')+'</div>'+mgDataList()
    +(rows.length>shown.length?'<div class="btns"><button class="btn mini" data-act="mgMore">Показать ещё '+Math.min(60,rows.length-shown.length)+'</button></div>':'')
    +'<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="mgGo" data-edit'+(k&&!M.busy?'':' disabled')+'>'+mgGoLabel(k)+'</button></div>'
    +'<p class="hint">'+(syLinked()&&syAdmin()?'Изменения сразу публикуются для всех; прежние версии карт сохраняются в журнале и в истории версий карты. ':'')+'Выбор сохраняется только до закрытия страницы.</p>'+syMsgHtml('mg');
  return h;
}
function mgBoxHtml(){
  if(!mgOn()||!mgCount())return'';
  return'<details class="card" id="mgBox"'+(mg().open?' open':'')+'>'+mgInnerHtml()+'</details>';
}
function mgPaint(){var el=$('#mgBox');if(el)el.innerHTML=mgInnerHtml();}
/* одно объединение: карты → на принимающее сырьё, синоним, цена, удаление лишнего */
function mxZero(o){return!(o.p||o.f||o.c);}
/* история цен ссылается на сырьё по ид: записи сливаемого сырья переходят на оставляемое; если в записи есть оба, строки закупок складываются и цена пересчитывается по правилу записи */
function mgPhRemap(from,to,ph){
  Object.keys(S.cfg).filter(isPhId).forEach(function(bid){
    var b=S.cfg[bid],f=null,t=null,lines;
    if(!b||!b.it)return;
    b.it.forEach(function(x){if(x.ing===from)f=x;else if(x.ing===to)t=x;});
    if(!f)return;
    if(!t)f.ing=to;
    else{
      t.ln=(t.ln||[]).concat(f.ln||[]);
      lines=t.ln.map(function(l){return{d:l[0],pk:l[2],kg:l[3]};});
      var pr=lines.length?c1Pick(lines,b.rule||'avg'):null;
      if(pr>0)t.pr=round4(pr);
      if(!(t.pv>0)&&f.pv>0)t.pv=f.pv;
      b.it=b.it.filter(function(x){return x!==f;});
    }
    b.at=Math.max(Date.now(),(Number(b.at)||0)+1);
    S.cfg[bid]=normPh(b);queueSave('settings',bid);ph[bid]=1;
  });
}
function mgMergeOne(from,to,touched,ph){
  var a=S.ings[from],b=S.ings[to],g;
  Object.keys(S.recipes).forEach(function(rid){
    var r=S.recipes[rid],ch=false;
    r.rows.forEach(function(x){if(x.ing===from){x.ing=to;ch=true;}});
    if(ch){queueSave('recipes',rid);touched[rid]=1;}
  });
  addAlias(to,a.name);
  (a.aliases||[]).forEach(function(k){addAlias(to,k);});
  if(mxZero(b)&&!mxZero(a)){b.p=a.p;b.f=a.f;b.c=a.c;b.kind=a.kind;b.source=a.source;}            /* у оставляемого нет КБЖУ — берём у сливаемого */
  if(a.loss){b.loss=b.loss||{};['cold','boil','fry','stew','bake'].forEach(function(k){if((b.loss[k]===null||b.loss[k]===undefined)&&a.loss[k]!==null&&a.loss[k]!==undefined)b.loss[k]=a.loss[k];});}
  if(ph)mgPhRemap(from,to,ph);
  PRICE_ING.forEach(function(k){if(k!=='px'&&a[k]!==undefined&&!(b.price>0)&&b[k]===undefined)b[k]=a[k];});
  if(a.px)Object.keys(a.px).forEach(function(g2){
    var q=b.px&&b.px[g2];
    if(!q||!(q.price>0)){g=recFor(b,g2,true);Object.keys(a.px[g2]).forEach(function(k){g[k]=a.px[g2][k];});}
  });
  queueSave('ingredients',to);
  syForgetIng(from);removeDoc('ingredients',from);
}
/* строка карты без расчёта: название остаётся, в КБЖУ и себестоимость не входит; лишняя позиция удаляется */
function mgSkipOne(from,touched){
  var a=S.ings[from];
  Object.keys(S.recipes).forEach(function(rid){
    var r=S.recipes[rid],ch=false;
    r.rows.forEach(function(x){if(x.ing===from){if(!x.tname)x.tname=String(a.name||'').slice(0,200);x.ing='';x.skip=true;ch=true;}});
    if(ch){queueSave('recipes',rid);touched[rid]=1;}
  });
  syForgetIng(from);removeDoc('ingredients',from);
}
/* общее выполнение объединения: pairs=[[из,в],…], skipSet={ид:1} — «не считать»; o={st,key,paint,done,after}: st хранит busy, key — ключ сообщения */
function mgExec(pairs,skipSet,o){
  var st=o.st,key=o.key,redirect={},touched={},targets={},goneSid={},ph={},merged=0,skipped=0,set={},sel,msg,nrec,phIds;
  if(S.sy.busy.send){flash('Идёт публикация, подождите');return;}
  function fin(t){var n=0;while(redirect[t]&&n++<30)t=redirect[t];return t;}
  pairs.forEach(function(p){var to=fin(p[1]);if(to!==p[0])redirect[p[0]]=to;});
  Object.keys(redirect).forEach(function(from){var to=fin(from);if(skipSet[to])skipSet[from]=1;});     /* ушло в то, что не считается — не считается и это */
  Object.keys(redirect).forEach(function(from){
    var to=fin(from),e;
    if(skipSet[from]||!S.ings[from]||!S.ings[to]||to===from)return;
    e=S.sy.map.ing[from];if(e&&e.sid)goneSid[e.sid]=1;
    mgMergeOne(from,to,touched,ph);targets[to]=1;merged++;
  });
  Object.keys(skipSet).forEach(function(from){
    var e;
    if(!S.ings[from])return;
    e=S.sy.map.ing[from];if(e&&e.sid)goneSid[e.sid]=1;
    mgSkipOne(from,touched);skipped++;
  });
  if(o.after&&merged)o.after();
  o.done();
  if(!merged&&!skipped){o.paint();return;}
  syPersist();
  nrec=Object.keys(touched).length;phIds=Object.keys(ph);
  msg=(merged?'Объединено: '+merged+'. ':'')+(skipped?'Не считается: '+skipped+'. ':'')+'Карт обновлено: '+nrec+'.'+(phIds.length?' Записей истории цен: '+phIds.length+'.':'');
  if(!(syLinked()&&syAdmin())){syMsg(key,'ok',msg);renderAll();flash(msg.replace(/\.$/,''));return;}
  Object.keys(touched).forEach(function(id){set['rec|'+id]=1;});
  Object.keys(targets).forEach(function(id){if(S.ings[id])set['ing|'+id]=1;});
  sel=syDirtyUi().filter(function(d){return set[sySelKey(d)]||(d.state==='deleted'&&d.kind==='ing'&&goneSid[d.sid]);});
  st.busy=true;renderAll();
  Promise.resolve(sel.length?sySend(true,sel,key,{guard:syV23(),noDoc:1,light:1,chunk:100}):null).then(function(){
    var failed=0;
    if(!phIds.length||!syPhOn()||!syCanSend())return 0;
    return phIds.reduce(function(p,id){return p.then(function(){return syPhPush(id).then(function(ok){if(ok===false)failed++;});});},Promise.resolve()).then(function(){return failed;});
  }).then(function(failed){
    var m=S.sy.msg[key];
    st.busy=false;
    if(!(m&&m.state==='err'))syMsg(key,'ok',msg+((m&&/Не опубликовано/.test(m.msg))?' Часть изменений не опубликована, см. «Мои изменения».':'')+(failed?' История цен сохранена только у вас: в общую базу не ушла.':''));
    renderAll();if(!(S.sy.msg[key]&&S.sy.msg[key].state==='err'))flash(msg.replace(/\.$/,''));
  },function(){st.busy=false;renderAll();});
}
function mgRun(){
  var M=mg(),pairs=[],skipSet={};
  Object.keys(M.sel).forEach(function(id){
    var t=M.sel[id];
    if(!t||!S.ings[id]||!mgCand(S.ings[id]))return;
    if(t==='__skip__')skipSet[id]=1;
    else if(t!==id&&S.ings[t])pairs.push([id,t]);
  });
  mgExec(pairs,skipSet,{st:M,key:'mg',paint:mgPaint,done:function(){M.sel={};M.ask=0;}});
}
function mgClick(act,b){
  var M=mg();
  switch(act){
    case'mgBest':
      M.ask=0;mgList().forEach(function(r){if(r.sg.length&&r.sg[0].sc>=(r.sg[0].dup?0.85:0.66))M.sel[r.id]=r.sg[0].id;});
      mgPaint();return true;
    case'mgClear':M.sel={};M.ask=0;mgPaint();return true;
    case'mgCards':{var ci=b.getAttribute('data-id');M.cards[ci]=!M.cards[ci];mgPaint();return true;}
    case'mgOpen':rvShow(b.getAttribute('data-rid'));return true;
    case'mgMore':M.show+=60;mgPaint();return true;
    case'mgGo':{
      var k=mgSelCount();
      if(!k)return true;
      if(M.ask===k){M.ask=0;clearTimeout(M.askT);mgRun();return true;}
      M.ask=k;clearTimeout(M.askT);M.askT=setTimeout(function(){M.ask=0;var gb=$('#mgBox [data-act="mgGo"]');if(gb)gb.textContent=mgGoLabel(mgSelCount());},6000);
      b.textContent=mgGoLabel(k);return true;
    }
  }
  return false;
}
/*MG-END*/
/*MX-START*/
/* ---------- объединение любого сырья: одно остаётся, остальные — дубли; при разных ценах закупки цена на выбор ---------- */
function mx(){return S.mx||(S.mx={open:false,keep:'',dups:[],ask:0,busy:false,price:'max'});}
function mxClean(){
  var X=mx();
  if(!S.ings[X.keep])X.keep='';
  X.dups=X.dups.filter(function(id,i,a){return S.ings[id]&&id!==X.keep&&a.indexOf(id)===i;});
  return X;
}
function mxKcal(i){return KCAL_P*i.p+KCAL_F*i.f+KCAL_C*i.c;}
function mxGoLabel(n){var X=mx();return(X.ask&&X.ask===n)?'Нажмите ещё раз: объединить '+n:'Объединить: '+n;}
/* цена после объединения по регионам: берётся там, где цена есть у двух и более позиций; mode — max / avg / keep */
function mxPriceCalc(keep,dups,mode){
  var out=[];
  if(NOPRICE||!keep||mode==='keep')return out;
  regionList().forEach(function(rg){
    var vals=[],names=[],sum=0,mx0,mn0;
    [keep].concat(dups).forEach(function(id){
      var pk=S.ings[id]?pricePerKg(S.ings[id],rg.id):null;
      if(pk!==null&&pk>0){vals.push(pk);names.push(S.ings[id].name);}
    });
    if(vals.length<2)return;
    vals.forEach(function(v){sum+=v;});
    mx0=Math.max.apply(null,vals);mn0=Math.min.apply(null,vals);
    if(mx0-mn0<0.005)return;
    out.push({g:rg.id,name:rg.name||rg.id,pk:mode==='avg'?sum/vals.length:mx0,vals:vals,names:names,mode:mode});
  });
  return out;
}
function mxApplyPrice(keep,calc){
  var ing=S.ings[keep];
  if(!ing)return;
  calc.forEach(function(c){
    var rec=recFor(ing,c.g,true);
    if(rec.priceUnit==='pack'&&rec.packG>0)rec.price=r2(c.pk*rec.packG/1000);
    else{rec.price=r2(c.pk);delete rec.priceUnit;delete rec.packG;}
    rec.priceSrc=('Объединение сырья ('+(c.mode==='avg'?'средняя':'большая')+' цена): '+c.names.join(', ')).slice(0,200);
  });
  queueSave('ingredients',keep);
}
function mxWarns(){
  var X=mxClean(),out=[],a;
  if(!X.keep)return out;
  a=S.ings[X.keep];
  X.dups.forEach(function(id){
    var d=S.ings[id],ka=mxKcal(a),kd=mxKcal(d),big=Math.max(ka,kd);
    if(mxZero(a)&&!mxZero(d))out.push('У «'+a.name+'» нет КБЖУ, у «'+d.name+'» есть: КБЖУ перейдёт на «'+a.name+'».');
    else if(!mxZero(a)&&!mxZero(d)&&big>0&&Math.abs(ka-kd)/big>0.15)out.push('КБЖУ у «'+d.name+'» ('+fmt(kd,0)+' ккал) и у «'+a.name+'» ('+fmt(ka,0)+' ккал) заметно отличается. Карты пересчитаются по «'+a.name+'».');
  });
  return out;
}
function mxRowHtml(id,keep){
  var i=S.ings[id],pk=NOPRICE?null:pricePerKg(i,curRegion()),u=mgUses()[id]||0;
  return'<div class="syrow"><div class="syn"><b>'+esc(i.name)+'</b> '+(keep?'<span class="pill good">останется</span>':'<span class="sysub">объединится и исчезнет</span>')
    +'<div class="sysub">Б '+fmt(i.p,1)+' · Ж '+fmt(i.f,1)+' · У '+fmt(i.c,1)+' · '+fmt(mxKcal(i),0)+' ккал'+(NOPRICE?'':' · '+(pk!==null&&pk>0?fmt(pk,2)+' ₽/кг':'цены нет'))+' · в картах: '+u+'</div></div>'
    +'<div class="syst">'+(keep?'':'<button class="btn mini" data-act="mxSwap" data-id="'+esc(id)+'" data-edit>Оставить это</button><button class="btn mini" data-act="mxRm" data-id="'+esc(id)+'">Убрать из списка</button>')+'</div></div>';
}
function mxDataList(){
  var ids=Object.keys(S.ings).sort(function(a,b){return String(S.ings[a].name).localeCompare(String(S.ings[b].name),'ru');});
  return'<datalist id="mxDl">'+ids.map(function(id){return'<option value="'+esc(S.ings[id].name)+'"></option>';}).join('')+'</datalist>';
}
function mxInnerHtml(){
  var X=mxClean(),h='<summary>Объединить сырьё</summary>',n=X.keep?X.dups.length:0,pc,w;
  if(!X.open)return h;
  h+='<p class="hint" style="margin-top:0">Одно и то же сырьё записано в базе дважды? Выберите, какое оставить, и добавьте дубли. Карты, цены и история цен перейдут на оставляемое, названия дублей запомнятся синонимами, сами дубли удалятся.</p>'
    +'<label class="field"><span class="lbl">Оставить</span><input type="text" list="mxDl" data-act="mxKeep" data-edit autocomplete="off" spellcheck="false" placeholder="Начните вводить название и выберите из списка" aria-label="Какое сырьё оставить"></label>'
    +(X.keep?mxRowHtml(X.keep,true):'')
    +'<label class="field" style="margin-top:10px"><span class="lbl">Дубли: что объединить с ним</span><input type="text" list="mxDl" data-act="mxAdd" data-edit autocomplete="off" spellcheck="false" placeholder="Добавьте сырьё, которое нужно убрать" aria-label="Добавить дубль"></label>'
    +X.dups.map(function(id){return mxRowHtml(id,false);}).join('');
  if(n&&!NOPRICE){
    pc=mxPriceCalc(X.keep,X.dups,X.price);
    h+='<label class="field w180" style="margin-top:10px"><span class="lbl">Цена, если у позиций она разная</span><select data-act="mxPrice" data-edit><option value="max"'+(X.price==='max'?' selected':'')+'>Большая</option><option value="avg"'+(X.price==='avg'?' selected':'')+'>Средняя</option><option value="keep"'+(X.price==='keep'?' selected':'')+'>Как у оставляемого</option></select></label>';
    if(pc.length)h+='<p class="hint" style="margin:6px 0 0">Цена после объединения: '+pc.map(function(c){return esc(c.name)+' — '+fmt(c.pk,2)+' ₽/кг (из '+c.vals.map(function(v){return fmt(v,2);}).join(', ')+')';}).join('; ')+'.</p>';
  }
  w=mxWarns();
  if(w.length)h+='<p class="hint" style="color:var(--warn)">'+w.map(esc).join('<br>')+'</p>';
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="mxGo" data-edit'+(n&&!X.busy?'':' disabled')+'>'+mxGoLabel(n)+'</button><button class="btn" data-act="mxClear">Сбросить</button></div>'
    +'<p class="hint">'+(syLinked()&&syAdmin()?'Изменения сразу публикуются для всех; прежние версии карт сохраняются в журнале. ':'')+'Выбор сохраняется только до закрытия страницы.</p>'+syMsgHtml('mx')+mxDataList();
  return h;
}
function mxBoxHtml(){
  if(!mgOn()||Object.keys(S.ings).length<2)return'';
  return'<details class="card" id="mxBox"'+(mx().open?' open':'')+'>'+mxInnerHtml()+'</details>';
}
function mxPaint(){var el=$('#mxBox');if(el)el.innerHTML=mxInnerHtml();}
/* у кодов, кроме технолога, блока нет: объясняем, а не молчим (иначе он выглядит пропавшим) */
function mxNoteHtml(){
  if(S.mode!=='local'||!syLinked()||mgOn()||Object.keys(S.ings).length<2)return'';
  return'<p class="hint" id="mxNote">Объединять сырьё в одну позицию может технолог: при объединении меняются карты во всей общей базе.</p>';
}
function mxRun(){
  var X=mxClean(),pairs=[],calc,keep=X.keep;
  if(!keep||!X.dups.length)return;
  calc=mxPriceCalc(keep,X.dups,X.price);
  X.dups.forEach(function(id){pairs.push([id,keep]);});
  mgExec(pairs,{},{st:X,key:'mx',paint:mxPaint,done:function(){X.keep='';X.dups=[];X.ask=0;},after:function(){mxApplyPrice(keep,calc);}});
}
function mxClick(act,b){
  var X=mx(),id,n;
  switch(act){
    case'mxClear':X.keep='';X.dups=[];X.ask=0;mxPaint();return true;
    case'mxRm':id=b.getAttribute('data-id');X.dups=X.dups.filter(function(x){return x!==id;});X.ask=0;mxPaint();return true;
    case'mxSwap':{
      id=b.getAttribute('data-id');
      var old=X.keep;X.dups=X.dups.filter(function(x){return x!==id;});X.keep=id;if(old&&old!==id)X.dups.push(old);X.ask=0;mxPaint();return true;
    }
    case'mxGo':
      n=mxClean().keep?X.dups.length:0;
      if(!n)return true;
      if(X.ask===n){X.ask=0;clearTimeout(X.askT);mxRun();return true;}
      X.ask=n;clearTimeout(X.askT);X.askT=setTimeout(function(){X.ask=0;var gb=$('#mxBox [data-act="mxGo"]');if(gb)gb.textContent=mxGoLabel(mxClean().keep?mx().dups.length:0);},6000);
      b.textContent=mxGoLabel(n);return true;
  }
  return false;
}
function mxChange(act,t){
  var X=mx(),id;
  if(act==='mxPrice'){X.price=t.value;X.ask=0;mxPaint();return;}
  if(!t.value.trim())return;
  id=mgFindId(t.value,act==='mxAdd'?X.keep:'');
  if(!id){flash('Такого сырья в базе нет. Выберите название из подсказки.');return;}
  if(act==='mxKeep'){X.keep=id;X.dups=X.dups.filter(function(x){return x!==id;});}
  else if(X.dups.indexOf(id)<0)X.dups.push(id);
  X.ask=0;mxPaint();
}
/*MX-END*/
function viewKbzhu(){
  var imp='';
  if(S.importOpen){
    imp='<section class="card import"><h2>Импорт из таблицы</h2>'
      +'<label class="field"><span class="lbl">Загрузите файл CSV или TSV либо вставьте строки из Excel: название, белки, жиры, углеводы на 100 г, источник (необязательно). Выгрузку «Скачать CSV» можно загрузить целиком: тип данных, потери, синонимы и цена (с единицей и массой упаковки) подтянутся из неё. Цены записываются в выбранный вверху регион. Если колонка «Цена» подписана другим регионом (так выгрузка подписывает её сама: «Цена, ₽ (Москва)»), цены из файла не записываются. Если название уже есть в базе, значения обновятся.</span><input type="file" id="impFile" class="filein" accept=".csv,.tsv,.txt,text/csv,text/plain,text/tab-separated-values" data-act="impFile" data-edit aria-label="Загрузить файл CSV или TSV"></label>'
      +'<label class="field"><span class="lbl">Строки таблицы</span><textarea id="impText" rows="6" data-fk="impText"></textarea></label>'
      +'<div class="inline"><label class="field"><span class="lbl">Тип данных</span><select id="impKind" data-fk="impKind">'+kindOptions('table')+'</select></label>'
      +'<button class="btn primary" data-act="doImport" data-edit>Добавить в базу</button><button class="btn" data-act="closeImport">Закрыть</button></div>'
      +'<p class="hint" id="importMsg">'+esc(S.importMsg)+'</p></section>';
  }
  return '<div class="tools"><label class="field grow"><span class="lbl">Поиск по названию, источнику и разделу</span><input id="search" data-act="search" data-fk="search" autocomplete="off" value="'+esc(S.q)+'" placeholder="Например: говядина"></label>'
    +'<label class="field" style="flex:0 0 240px;align-self:flex-end"><span class="lbl">Раздел</span><select id="catF" data-act="catFilter" data-fk="catf">'+catFilterOpts()+'</select></label>'
    +'<div class="chips" id="chips" style="align-self:flex-end">'+chipsHtml()+'</div>'
    +'<div class="btns" style="align-self:flex-end"><button class="btn primary" data-act="newIng" data-edit>Новое сырьё</button><button class="btn" data-act="openImport">Импорт из таблицы</button>'+(canDl()?'<button class="btn" data-act="dlBase">Скачать CSV</button>':'')+'<button class="btn" data-act="cpBase">Копировать для Excel</button></div></div>'
    +cloudBaseHtml()
    +mgBoxHtml()
    +mxBoxHtml()+mxNoteHtml()
    +imp
    +'<div id="ingList">'+ingListHtml()+'</div>'
    +'<p class="hint">Белки, жиры и углеводы указаны на 100 г продукта. Нормы потерь — в процентах от массы сырья: «Х/о» — отходы при очистке (из брутто получается нетто, по брутто считается закупка), варка, жарка, тушение и запекание — потери массы при тепловой обработке. Для нового сырья нормы подставляются по названию, где оно узнано: проверьте и поправьте. Раздел, тип данных и источник открываются кнопкой «⋯» в конце строки. Калорийность считается как 4·Б + 9·Ж + 4·У. Тип данных «Ориентир» помечает значения, которые ещё не сверены с этикеткой, справочником или протоколом: такие строки попадают в предупреждение под расчётом.</p>';
}
function viewBase(){
  if(NOPRICE)return viewKbzhu();
  if(syMgr())return viewPrices();
  return bsubHtml()+(S.bsub==='price'?viewPrices():viewKbzhu());
}

/*P1CUI-START*/
