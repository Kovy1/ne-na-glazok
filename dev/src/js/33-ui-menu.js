/* ---------- вкладка «Меню и финансы» ---------- */
function curFin(){return S.cfg.finance||DEFAULT_FINANCE;}
function setFin(k,v){
  var f=normFinance(S.cfg.finance||DEFAULT_FINANCE);f[k]=v;
  S.cfg.finance=normFinance(f);queueSave('settings','finance');
}
function setTone(k,v){
  var f=normFinance(S.cfg.finance||DEFAULT_FINANCE),t=f.tone||{};
  if(v===null||v===undefined)delete t[k];else t[k]=v;
  if(Object.keys(t).length)f.tone=t;else delete f.tone;
  S.cfg.finance=normFinance(f);queueSave('settings','finance');
}
/* ---- подсветка показателей меню: g — хорошо, y — внимание, r — плохо ----
   Наценка, маржа и доля сырья — одна и та же пропорция цены и себестоимости, поэтому у них общие пороги и они красятся одинаково.
   Доход после сырья в рублях красится отдельно: по умолчанию относительно среднего дохода по меню, пороги в ₽ можно задать вручную.
   У блюд с неполной себестоимостью (нет цены части сырья) проценты завышены, поэтому оценка предварительная: тот же цвет, но пунктирной рамкой (класс t-p). */
var TONE_DEF={fcO:30,fcB:40,mkO:230,mkB:150,mgO:70,mgB:60};
var TONE_PF=[0.8,0.5];                       /* прибыль: хорошо — от 80 % средней по меню, плохо — ниже 50 % */
var M_TONE={pavg:null,key:null,cfg:null};
var M_TK={markup:'mk',margin:'mg',profit:'pf',fc:'fc'};
function toneCfg(){
  var t=curFin().tone||{},key=JSON.stringify(t);
  if(M_TONE.key===key&&M_TONE.cfg)return M_TONE.cfg;
  var o={},k;
  for(k in TONE_DEF)o[k]=(t[k]!==undefined)?t[k]:TONE_DEF[k];
  if(o.fcO>o.fcB){o.fcO=TONE_DEF.fcO;o.fcB=TONE_DEF.fcB;}
  if(o.mkO<o.mkB){o.mkO=TONE_DEF.mkO;o.mkB=TONE_DEF.mkB;}
  if(o.mgO<o.mgB){o.mgO=TONE_DEF.mgO;o.mgB=TONE_DEF.mgB;}
  o.pfO=(t.pfO!==undefined)?t.pfO:null;o.pfB=(t.pfB!==undefined)?t.pfB:null;
  if(o.pfO!==null&&o.pfB!==null&&o.pfO<o.pfB){o.pfO=null;o.pfB=null;}
  M_TONE.key=key;M_TONE.cfg=o;return o;
}
/* границы для прибыли в ₽: заданные вручную или от средней по меню */
function toneBounds(c){
  var a=M_TONE.pavg,o=c.pfO,b=c.pfB,ao=false,ab=false;
  if(a>0){
    if(o===null){o=a*TONE_PF[0];ao=true;}
    if(b===null){b=a*TONE_PF[1];ab=true;}
    if(b>o)b=o;
  }
  return{o:o,b:b,ao:ao,ab:ab,auto:ao||ab};
}
function toneOf(k,v){
  if(v===null||v===undefined||!isFinite(v))return'';
  var c=toneCfg();
  if(k==='pf'){
    if(v<=0)return'r';
    var q=toneBounds(c);
    if(q.o===null||q.b===null)return'';
    return v>=q.o-1e-9?'g':(v>=q.b-1e-9?'y':'r');
  }
  v=Math.round(v*10)/10;
  if(k==='fc')return v<=c.fcO?'g':(v<=c.fcB?'y':'r');
  return v>=c[k+'O']?'g':(v>=c[k+'B']?'y':'r');
}
function rowTones(m){
  if(!m||m.price===null||m.cost===null)return null;
  return{mk:toneOf('mk',m.markup),mg:toneOf('mg',m.margin),pf:toneOf('pf',m.profit),fc:toneOf('fc',m.fc),pre:!m.complete};
}
var TONE_PRE=' Предварительно: у части сырья нет цены, на деле будет хуже.';
function tnum(v){return fmt(v,v%1?1:0);}
function toneTip(k,t){
  if(!t)return'';
  var c=toneCfg(),W={g:'Хорошо',y:'Внимание',r:'Плохо'}[t],th,nm;
  if(k==='fc')th=t==='g'?'сырьё до '+tnum(c.fcO)+' % цены':(t==='y'?'сырьё '+tnum(c.fcO)+'–'+tnum(c.fcB)+' % цены':'сырьё выше '+tnum(c.fcB)+' % цены');
  else if(k==='pf'){
    var q=toneBounds(c);
    th=t==='g'?'доход от '+money(q.o)+' ₽':(t==='y'?'доход '+money(q.b)+'–'+money(q.o)+' ₽':(q.b>0?'доход ниже '+money(q.b)+' ₽':'дохода нет'));
    if((t==='g'?q.ao:(t==='r'?q.ab:q.auto))&&M_TONE.pavg>0)th+=' (порог от среднего дохода меню, '+money(M_TONE.pavg)+' ₽)';
  }else{
    nm=k==='mk'?'наценка':'маржа';
    th=t==='g'?nm+' от '+tnum(c[k+'O'])+' %':(t==='y'?nm+' '+tnum(c[k+'B'])+'–'+tnum(c[k+'O'])+' %':nm+' ниже '+tnum(c[k+'B'])+' %');
  }
  return W+': '+th;
}
function tcls(t){return t?' t-'+t:'';}
function toneLegendTxt(){
  var c=toneCfg(),q=toneBounds(c),h;
  h='Хорошо: сырьё до '+tnum(c.fcO)+' %, наценка от '+tnum(c.mkO)+' %, маржа от '+tnum(c.mgO)+' %. Плохо: сырьё выше '+tnum(c.fcB)+' %, наценка ниже '+tnum(c.mkB)+' %, маржа ниже '+tnum(c.mgB)+' %.';
  if(q.o!==null&&q.b!==null)h+=' Доход после сырья: хорошо от '+money(q.o)+' ₽, плохо ниже '+money(q.b)+' ₽'+(q.auto?' (границы от среднего дохода меню, '+money(M_TONE.pavg)+' ₽)':'')+'.';
  else h+=' Доход после сырья сравнивается со средним по меню: подсветка появится, когда у блюд будут цены продажи.';
  return h+' Пунктирная рамка — оценка предварительная: у блюда неполная себестоимость (нет цены части сырья), на деле будет хуже. Без цвета — блюда без цены продажи.';
}
function toneInputVal(k){
  var c=toneCfg();
  return c[k]===null||c[k]===undefined?'':toInput(c[k]);
}
function toneField(label,k,pre){
  return'<label class="mtc"><span>'+pre+'</span><input class="num" inputmode="decimal" autocomplete="off" aria-label="'+esc(label)+'" data-act="mtSet" data-edit data-k="'+k+'" data-fk="mt:'+k+'" value="'+toneInputVal(k)+'"'+(k.charAt(0)==='p'?' placeholder="авто"':'')+'></label>';
}
function menuToneHtml(){
  return'<div class="mtone"><div class="mleg"><span class="tl t-g">Хорошо</span><span class="tl t-y">Внимание</span><span class="tl t-r">Плохо</span><details class="mlegd"><summary>Как читать цвета</summary><span class="hint" id="mLegTxt">'+toneLegendTxt()+'</span></details></div>'
    +'<details class="pgroup mtd" id="mTone"'+(S.mtOpen?' open':'')+'><summary>Настроить пороги цветов</summary>'
    +'<p class="hint" style="margin:8px 0 0">Жёлтый — между порогами. Наценка, маржа и доля сырья связаны одной формулой, поэтому красятся одинаково. Доход после сырья в рублях красится отдельно: так видно блюдо с низкой наценкой, но хорошим доходом после сырья. Порог «хорошо» не может быть хуже порога «плохо». Пустое поле возвращает стандартное значение.</p>'
    +'<div class="mtgrid"><span></span><span class="mth">Хорошо</span><span class="mth">Плохо</span>'
    +'<span class="mtl">Наценка, %</span>'+toneField('Наценка, %: хорошо от','mkO','от')+toneField('Наценка, %: плохо ниже','mkB','ниже')
    +'<span class="mtl">Маржа, %</span>'+toneField('Маржа, %: хорошо от','mgO','от')+toneField('Маржа, %: плохо ниже','mgB','ниже')
    +'<span class="mtl">Сырьё в цене, %</span>'+toneField('Сырьё, %: хорошо до','fcO','до')+toneField('Сырьё, %: плохо выше','fcB','выше')
    +'<span class="mtl">Доход после сырья, ₽</span>'+toneField('Доход, ₽: хорошо от','pfO','от')+toneField('Доход, ₽: плохо ниже','pfB','ниже')
    +'</div><div class="btns" style="margin-top:10px"><button class="btn mini" data-act="mtReset" data-edit>Вернуть стандартные пороги</button></div></details></div>';
}
function mToneUi(){
  var l=$('#mLegTxt');if(l)l.innerHTML=toneLegendTxt();
  var q=toneBounds(toneCfg());
  [['pfO',q.o],['pfB',q.b]].forEach(function(x){var i=$('#mTone [data-k="'+x[0]+'"]');if(i)i.title=x[1]!==null&&x[1]!==undefined?'Сейчас '+money(x[1])+' ₽: считается от среднего доходаи меню, пока поле пустое':'Считается от средней прибыли меню, когда у блюд будут цены';});
}
function mToneApply(el,m){
  var tn=rowTones(m);
  function put(c,k){
    if(!c)return;
    c.classList.remove('t-g','t-y','t-r');
    var t=tn&&tn[k];
    c.classList.remove('t-p');
    if(t){c.classList.add('t-'+t);if(tn.pre)c.classList.add('t-p');c.title=toneTip(k,t)+(tn.pre?'.'+TONE_PRE:'');}else c.removeAttribute('title');
  }
  var a1=el.querySelector('[data-act="mMk"]'),a2=el.querySelector('[data-act="mMg"]');
  put(a1&&a1.closest('.cell'),'mk');put(a2&&a2.closest('.cell'),'mg');
  put(el.querySelector('[data-out="profit"]'),'pf');put(el.querySelector('[data-out="fc"]'),'fc');
}
function sellOf(r,g){var v=r&&r.sell&&r.sell[g];return v>0?v:null;}   // цену продажи видят все; закупка и себестоимость скрыты под NOPRICE
/* цена продажи точки: sell['регион:точка'] перекрывает цену региона sell['регион']; точка берётся выбранная вверху */
function sellPtKey(g){var pt=(g===curRegion()&&typeof drCurPtId==='function')?drCurPtId():'';return pt?g+':'+pt:'';}
function sellEff(r,g){var k=sellPtKey(g),v=k&&r&&r.sell&&r.sell[k];return v>0?v:sellOf(r,g);}
function sellOwn(r,g){var k=sellPtKey(g);return(k&&r&&r.sell&&r.sell[k]>0)?r.sell[k]:null;}
function setSellCtx(r,v){var g=curRegion(),k=sellPtKey(g);setSell(r,k||g,v);}
function setSell(r,g,v){
  if(NOPRICE)return;
  if(v>0){if(!r.sell)r.sell={};r.sell[g]=v;}
  else if(r.sell){delete r.sell[g];if(!Object.keys(r.sell).length)delete r.sell;}
}
function pctStr(v){return(v===null||v===undefined||!isFinite(v))?'':String(Math.round(v*10)/10).replace('.',',');}
/* неполная себестоимость: крупная плашка с числом ингредиентов без цены и предложением сначала заполнить цены */
function incIds(c){var seen={},out=[];c.rows.forEach(function(x){if(x.price===null&&x.ing&&S.ings[x.ing]&&!seen[x.ing]){seen[x.ing]=1;out.push(x.ing);}});return out;}
function incTitle(nNames){
  if(nNames>0)return'Себестоимость неполная: '+(nNames===1?'отсутствует цена 1 ингредиента':'отсутствуют цены '+nNames+' '+(nNames%10===1&&nNames%100!==11?'ингредиента':'ингредиентов'));
  return'Себестоимость неполная: в составе есть строки без сырья из базы';
}
function incBarHtml(noPrice,ids,rid,cls){
  if(syLoading())return syLoadHtml();
  var big=cls&&/incbig/.test(cls),
    names=noPrice.length?'<span class="incn">'+noPrice.slice(0,6).map(esc).join(', ')+(noPrice.length>6?' и ещё '+(noPrice.length-6):'')+'</span>':'',
    why='<span class="incs">Сначала заполните цены, потом устанавливайте цену продажи: наценка и маржа сейчас предварительные и на деле окажутся ниже.</span>',
    btn=(ids&&ids.length&&tabOk('base')&&!NOPRICE)?'<button type="button" class="btn mini" data-act="incFill"'+(rid?' data-rid="'+esc(rid)+'"':'')+'>Заполнить цены</button>':'',
    h;
  if(big)return'<div class="incbar incbig" role="status"><b>'+incTitle(noPrice.length)+'</b>'+btn+'<button type="button" class="incmore" data-act="incMore" aria-expanded="false">Почему это важно</button><div class="incx" hidden>'+names+why+'</div></div>';
  h='<div class="incbar'+(cls?' '+cls:'')+'" role="alert"><b>'+incTitle(noPrice.length)+'</b>'+names+why+btn;
  return h+'</div>';
}
function finOf(r){
  var g=curRegion(),c=costOf(r,S.ings,100,g),has=c.rows.length>0;
  var cost=(has&&c.sum>0)?r2(c.sum/100):null;
  var m=finMetrics(cost,sellEff(r,g));
  m.complete=has&&c.complete;m.noPrice=c.noPrice;m.rowsN=c.rows.length;m.noIds=incIds(c);
  return m;
}
function belowTarget(m){
  var f=curFin();if(f.target===null||m.price===null||m.cost===null)return false;
  var v=f.mode==='margin'?m.margin:m.markup;
  return v!==null&&v<f.target-1e-9;
}
function menuItems(){
  M_KBC={};
  var out=visIds().filter(function(id){return!S.recipes[id].arch;}).map(function(id){return{id:id,r:S.recipes[id],m:finOf(S.recipes[id])};});
  var sp=0,np=0;
  out.forEach(function(it){var m=it.m;if(m.price!==null&&m.cost!==null&&m.complete&&m.profit!==null){sp+=m.profit;np++;}});
  M_TONE.pavg=np?sp/np:null;
  return out;
}
function menuVisible(items){
  var q=(S.mq||'').trim().toLowerCase(),f=S.mflt||'all',key=S.msort||'name';
  if(NOPRICE){f='all';key='name';}
  if((f==='gpon'||f==='gpoff')&&!(gpAdmin()&&gpExp()))f='all';
  var out=items.filter(function(it){
    var m=it.m;
    if(f==='noprice'&&m.price!==null)return false;
    if(f==='below'&&!belowTarget(m))return false;
    if(f==='inc'&&m.complete)return false;
    if(f==='gpon'&&!gpIs(it.id))return false;
    if(f==='gpoff'&&gpIs(it.id))return false;
    return!q||String(it.r.name).toLowerCase().indexOf(q)>-1||String(ttkVal(it.r,'num')).toLowerCase().indexOf(q)>-1;
  });
  var dir={cost:-1,price:-1,margin:1,markup:1}[key];
  out.sort(function(a,b){
    var byN=String(a.r.name||'').localeCompare(String(b.r.name||''),'ru');
    if(key==='name'||!dir)return byN;
    var x=a.m[key],y=b.m[key];
    if(x===null&&y===null)return byN;
    if(x===null)return 1;if(y===null)return-1;
    return(x-y)*dir||byN;
  });
  return out;
}
function menuIncBarHtml(items){
  if(syLoading())return syLoadHtml();
  var d=0,seen={},ids=[],names=[];
  items.forEach(function(it){var m=it.m;if(m.complete||!m.rowsN)return;d++;(m.noIds||[]).forEach(function(i){if(!seen[i]){seen[i]=1;ids.push(i);names.push(S.ings[i].name||'без названия');}});});
  if(!d)return'';
  return'<div class="incbar incbig" role="status"><b>У '+d+' '+(d%10===1&&d%100!==11?'блюда':'блюд')+' себестоимость неполная'+(ids.length?': не хватает цен '+ids.length+' '+(ids.length%10===1&&ids.length%100!==11?'ингредиента':'ингредиентов'):'')+'</b>'
    +(ids.length&&tabOk('base')?'<button type="button" class="btn mini" data-act="incFill">Заполнить цены</button><button type="button" class="btn mini" data-act="mFlt" data-f="inc">Показать эти блюда</button>':'')
    +'<button type="button" class="incmore" data-act="incMore" aria-expanded="false">Почему это важно</button><div class="incx" hidden><span class="incn">'+names.slice(0,6).map(esc).join(', ')+(names.length>6?' и ещё '+(names.length-6):'')+'</span><span class="incs">Проценты наценки и маржи у этих блюд предварительные. Сначала заполните цены, потом устанавливайте цену продажи.</span></div></div>';
}
function menuChipsHtml(items){
  var n=items.length,np=0,bl=0,ic=0;
  items.forEach(function(it){if(it.m.price===null)np++;if(belowTarget(it.m))bl++;if(!it.m.complete)ic++;});
  var f=S.mflt||'all';
  if((f==='gpon'||f==='gpoff')&&!(gpAdmin()&&gpExp()))f='all';
  function chip(k,l,c){return'<button class="chip" data-act="mFlt" data-f="'+k+'" aria-pressed="'+(f===k)+'">'+l+' · '+c+'</button>';}
  var gx='',gn=0;
  if(gpAdmin()&&gpExp()){items.forEach(function(it){if(gpIs(it.id))gn++;});gx=chip('gpon','Показаны посетителям',gn)+chip('gpoff','Не показаны посетителям',n-gn);}
  if(syLoading())return chip('all','Все',n)+gx;
  return chip('all','Все',n)+chip('noprice','Без цены',np)+chip('inc','Себестоимость неполная',ic)+gx;
}
function menuKpiHtml(items){
  var ok=[],priced=0,bl=0;
  items.forEach(function(it){var m=it.m;if(m.price!==null)priced++;if(belowTarget(m))bl++;if(m.price!==null&&m.cost!==null&&m.complete)ok.push(m);});
  function avg(k){return ok.length?ok.reduce(function(a,m){return a+m[k];},0)/ok.length:null;}
  function v(x,d,u){return x===null?'—':fmt(x,d)+u;}
  var f=curFin();
  return'<dl class="kv mkpi"><div><dt>Блюд в меню</dt><dd>'+items.length+' <small>с ценой: '+priced+'</small></dd></div>'
    +'<div><dt>Средняя себестоимость порции</dt><dd>'+v(avg('cost'),2,' ₽')+'</dd></div>'
    +'<div><dt>Средняя цена продажи</dt><dd>'+v(avg('price'),2,' ₽')+'</dd></div>'
    +'<div><dt>Средняя наценка</dt><dd>'+v(avg('markup'),1,' %')+'</dd></div>'
    +'<div><dt>Средняя маржинальность</dt><dd>'+v(avg('margin'),1,' %')+'</dd></div>'
    +'<div><dt>Ниже цели'+(f.target===null?'':' ('+(f.mode==='margin'?'маржа ':'наценка ')+fmt(f.target,f.target%1?1:0)+' %)')+'</dt><dd>'+(f.target===null?'цель не задана':bl)+'</dd></div></dl>'
    +'<p class="hint" style="margin:8px 0 0">Средние считаются по блюдам с ценой продажи и полной себестоимостью: '+ok.length+'.</p>';
}
function mCostCell(m){
  if(m.cost===null)return'—';
  return money(m.cost)+(m.complete?'':'<span class="inc-mark" title="'+(m.noPrice.length?'Нет цены: '+esc(m.noPrice.join(', ')):'Есть строки без сырья из базы')+'">неполная</span>');
}
var M_KBC={};
/* КБЖУ на порцию рядом с выходом: коротко, расчёт тот же, что в карте и в просмотре; неполный расчёт помечается */
function mKbHtml(id,r){
  var c,p,inc;
  try{
    if(!M_KBC[id])M_KBC[id]=compute(r,S.ings);
    c=M_KBC[id];p=c&&c.portion;
  }catch(e){p=null;}
  if(!p||![p.p,p.f,p.c,p.k].every(function(x){return typeof x==='number'&&isFinite(x);}))return'<small class="mkb muted">КБЖУ не рассчитано</small>';
  inc=!!(c.missing||c.unassigned||(c.unk&&c.unk.length));
  return'<small class="mkb" title="Пищевая ценность одной порции (выход '+dnum(r.output,2)+' г): калорийность, белки, жиры, углеводы'+(inc?'. Расчёт неполный: у части сырья нет данных КБЖУ, значения занижены':'')+'">На порцию: <span class="kbk">'+fmt(p.k,0)+' ккал</span> · Б '+fmt(p.p,1)+' · Ж '+fmt(p.f,1)+' · У '+fmt(p.c,1)+(inc?' <span class="inc-mark">неполно</span>':'')+'</small>';
}
function mRowHtml(it){
  var r=it.r,m=it.m,id=it.id,fk='m:'+esc(id)+':',nm=String(r.name||'Без названия'),num=ttkVal(r,'num');
  var dis=m.cost===null?' disabled':'';
  var lsp=NOPRICE?sellEff(r,curRegion()):null;
  var mn='<span class="mn"><b>'+esc(nm)+'</b><small>'+(num?'ТТК №'+esc(num)+' · ':'')+'выход '+dnum(r.output,2)+' г'+(rdOutCheck(r).length?' <span class="warnt" title="'+esc(rdOutCheck(r)[0].txt)+' Проверьте в «Готовности карт»: исправление подтверждает технолог.">⚠ проверьте выход</span>':'')+(lsp?' · цена продажи <b class="lsell">'+money(lsp)+' ₽</b>':'')+'</small>'+mKbHtml(id,r)
      +'<span class="mctl">'+gpRowHtml(it)+(menuCats().length&&!layOn()?'<select class="mcat" data-act="mCat" data-edit data-fk="mcat:'+esc(id)+'" aria-label="Папка: '+esc(nm)+'" title="Папка меню">'+catOptionsHtml(r.cat)+'</select>':'')
      +(uiRO()?'':'<button class="btn mini" data-act="mArch" data-edit title="Убрать из меню: блюдо уйдёт в архив, его ТТК останется">В архив</button>')+'</span></span>';
  if(NOPRICE)return'<div class="mrow mlite" data-rid="'+esc(id)+'">'+mn+''+mOpenBtn()+'</div>';
  var tn=rowTones(m);
  function tt(k){return tn&&tn[k]?tcls(tn[k])+(tn.pre?' t-p':''):'';}
  function tl(k){return tn&&tn[k]?' title="'+esc(toneTip(k,tn[k])+(tn.pre?'.'+TONE_PRE:''))+'"':'';}
  return'<div class="mrow'+(m.complete?'':' inc')+(belowTarget(m)?' below':'')+'" data-rid="'+esc(id)+'">'
    +mn
    +'<span class="num" data-label="Себестоимость, ₽" data-s="Себест., ₽" data-out="cost">'+mCostCell(m)+'</span>'
    +'<label class="cell" data-label="Цена продажи, ₽" data-s="Цена продажи, ₽"><input class="num" inputmode="decimal" autocomplete="off" aria-label="Цена продажи, ₽: '+esc(nm)+'" data-act="mPrice" data-edit data-fk="'+fk+'price" value="'+toInput(m.price)+'" placeholder="—"></label>'+(sellOwn(r,curRegion())!==null?'<small class="ptsell" title="У этой точки своя цена. Очистите поле, чтобы вернуть цену региона">цена точки</small>':'')
    +'<label class="cell'+tt('mk')+'"'+tl('mk')+' data-label="Наценка, %" data-s="Наценка, %"><input class="num" inputmode="decimal" autocomplete="off" aria-label="Наценка, %: '+esc(nm)+'" data-act="mMk" data-edit data-fk="'+fk+'mk" value="'+pctStr(m.markup)+'" placeholder="—"'+dis+'></label>'
    +'<label class="cell'+tt('mg')+'"'+tl('mg')+' data-label="Маржинальность, %" data-s="Маржа, %"><input class="num" inputmode="decimal" autocomplete="off" aria-label="Маржинальность, %: '+esc(nm)+'" data-act="mMg" data-edit data-fk="'+fk+'mg" value="'+pctStr(m.margin)+'" placeholder="—"'+dis+'></label>'
    +'<span class="num'+tt('pf')+'"'+tl('pf')+' data-label="Доход после сырья, ₽" data-s="Доход, ₽" data-out="profit">'+(m.profit===null?'—':money(m.profit))+'</span>'
    +'<span class="num'+tt('fc')+'"'+tl('fc')+' data-label="Сырьё в цене, %" data-s="Сырьё, %" data-out="fc">'+(m.fc===null?'—':pctStr(m.fc)+' %')+'</span>'
    +''+mOpenBtn()+''
    +(!m.complete&&m.rowsN?incBarHtml(m.noPrice,m.noIds,id,'minc'):'')
    +'</div>';
}
/* скачать карту прямо из меню, не открывая её: ТТК (.docx), у финансового — ОП-1; у шеф-повара свои файлы в облаке */
function mDlBtn(){
  var op;
  if(syChef()||!canDl())return'';
  op=syLimited();
  return'<button class="btn mini ico" data-act="mDl" title="'+(op?'Скачать ОП-1 (.docx)':'Скачать ТТК (.docx)')+'" aria-label="'+(op?'Скачать ОП-1':'Скачать ТТК')+'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12M7 11l5 5 5-5M5 21h14"/></svg></button>';
}
function mViewBtn(){return'<button class="btn mini" data-act="mView" title="Просмотр ТТК: состав, технология, КБЖУ, пересчёт на число порций">Просмотр</button>';}
function mOpenBtn(){
  var bt,dl;
  if(syChef())return'<span class="mact">'+mViewBtn()+'<button class="btn mini" data-act="mOpen" title="Найти ТТК этого блюда в облаке">ТТК</button></span>';
  bt=syLimited()?'<button class="btn mini" data-act="mOpen" title="Открыть калькуляционную карточку ОП-1 этого блюда">ОП-1</button>':'<button class="btn mini" data-act="mOpen" title="Открыть ТТК этого блюда">ТТК</button>';
  dl=mDlBtn();
  return'<span class="mact">'+mViewBtn()+bt+dl+'</span>';
}
/* открыть карту из списка: сбросить экран выбора «ТТК», перейти в регион карты; незаконченную загрузку из файла не терять */
function mOpenCard(id){
  if(S.ttk){flash('Сначала закончите или отмените загрузку ТТК из файла');return;}
  if(S.newDraft&&S.newDraft!==id)ttkDropDraft();
  rvShow(id);
}
/* шеф-повар: из меню — к файлу ТТК этого блюда в облаке (расчётов ТТК у него нет): поиск по названию блюда, при неудаче по первым словам */
function chefQueries(r){
  var core=ttkCore(recBase(r)),ws=core.split(' ').filter(Boolean),qs=[];
  if(core)qs.push(core);
  if(ws.length>2)qs.push(ws.slice(0,2).join(' '));
  if(ws.length>1&&ws[0].length>=4)qs.push(ws[0]);
  return qs;
}
function chefPick(qs){
  var i,keep=S.sy.fq,main=syFiles().filter(function(x){return x.kind==='main';}),reg=syFReg(),hit;
  for(i=0;i<qs.length;i++){
    S.sy.fq=qs[i];hit=main.filter(syFileMatch);
    if(hit.length){if(!hit.some(function(x){return(x.reg||'')===reg;}))S.sy.creg=hit[0].reg||'';return qs[i];}   /* поиск идёт внутри региона: если в своём нет, открываем регион, где файл нашёлся */
  }
  S.sy.fq=keep;return'';
}
function chefOpenTtk(id){
  var r=S.recipes[id],qs=r?chefQueries(r):[],q;
  if(!r)return;
  S.tab='cloud';S.sy.fshow=SY_PAGE;S.sy.fq=qs[0]||'';S.sy.cin=true;S.sy.creg=(r.reg&&regKnown(r.reg))?r.reg:null;S.sy.cdir='';   /* сразу внутри региона блюда */
  if(syFReady()){
    q=chefPick(qs);S.sy.fq=q;
    if(!q)flash('Файл ТТК для «'+recBase(r)+'» в облаке не найден: выберите его в списке');
  }
  renderAll();window.scrollTo(0,0);
  if(!syFReady())syFilesLoad(true).then(function(){
    if(S.tab!=='cloud'||S.sy.fq!==(qs[0]||''))return;
    var q2=chefPick(qs);S.sy.fq=q2;
    if(!q2&&qs.length)flash('Файл ТТК для «'+recBase(r)+'» в облаке не найден: выберите его в списке');
    renderAll();
  });
}
function mHeadHtml(){
  if(NOPRICE)return'';
  return'<div class="mleg" role="note"><div>Цвет и значок: <span class="lgk lg-r">✕ плохо</span> · <span class="lgk lg-y">! внимание</span> · без значка — в норме. Пороги — в подсказке при наведении.</div><div>Наценка — к себестоимости, маржа — к цене продажи, сырьё — доля себестоимости в цене. <b>Доход после сырья</b> = цена продажи − стоимость сырья по ТТК и ценам региона. Не учтены: зарплата, аренда, коммунальные услуги, налоги, потери при производстве и списания готовых блюд.</div></div>';
}
function mFoldOpen(k){return!(S.mclosed&&S.mclosed[k]);}
/* средние по блюдам папки так же, как в строках: себестоимость — по блюдам с себестоимостью, цена — по блюдам с ценой продажи, наценка, маржа, прибыль и доля сырья — по блюдам с ценой и себестоимостью; неполная себестоимость отмечается */
function mAvg(arr){
  var co=[],pr=[],full=[],ic=0,ifu=0;
  arr.forEach(function(it){
    var m=it.m;
    if(m.cost!==null){co.push(m.cost);if(!m.complete)ic++;}
    if(m.price!==null)pr.push(m.price);
    if(m.price!==null&&m.cost!==null){full.push(m);if(!m.complete)ifu++;}
  });
  function av(a){a=a.filter(function(v){return v!==null&&v!==undefined;});return a.length?a.reduce(function(x,y){return x+y;},0)/a.length:null;}
  function avk(k){return av(full.map(function(m){return m[k];}));}
  return{n:arr.length,nc:co.length,np:pr.length,nf:full.length,ic:ic,ifu:ifu,cost:av(co),price:av(pr),markup:avk('markup'),margin:avk('margin'),profit:avk('profit'),fc:avk('fc')};
}
var M_AVG=[['cost','Себест., ₽'],['price','Цена, ₽'],['markup','Наценка, %'],['margin','Маржа, %'],['profit','Доход, ₽'],['fc','Сырьё, %']];
function mAvgTxt(a,k){
  var v=a[k];if(v===null||v===undefined)return'—';
  return(k==='cost'||k==='price'||k==='profit')?money(v):pctStr(v)+' %';
}
/* средние красятся так же; если среди блюд есть с неполной себестоимостью, оценка предварительная (пунктир) */
function mAvgTone(a,k){return(M_TK[k]&&a.nf>0)?toneOf(M_TK[k],a[k]):'';}
function mAvgCls(a,k){
  var t=mAvgTxt(a,k);
  return'num'+(t==='—'?' nil':'')+((k==='cost'?a.ic:(k==='price'?0:a.ifu))>0?' inc':'')+tcls(mAvgTone(a,k))+(M_TK[k]&&a.ifu>0&&mAvgTone(a,k)?' t-p':'');
}
function mAvgTitle(a,k){
  var base='Среднее по блюдам папки: ',n=k==='cost'?a.nc:(k==='price'?a.np:a.nf),inc=k==='cost'?a.ic:(k==='price'?0:a.ifu);
  var what=k==='cost'?'с себестоимостью':(k==='price'?'с ценой продажи':'с ценой продажи и себестоимостью');
  var tp=toneTip(M_TK[k],mAvgTone(a,k));
  return base+n+' из '+a.n+' (блюда '+what+')'+(inc?'. У '+inc+' из них себестоимость неполная: нет цены сырья или сырья из базы, поэтому среднее занижено':'')+(tp?'. '+tp+(inc&&M_TK[k]?'. Предварительно: среди блюд есть с неполной себестоимостью':''):'');
}
function mAvgCellsHtml(a){
  return M_AVG.map(function(x){return'<span class="'+mAvgCls(a,x[0])+'" data-label="'+x[1]+'" data-avg="'+x[0]+'" title="'+esc(mAvgTitle(a,x[0]))+'">'+mAvgTxt(a,x[0])+'</span>';}).join('')+'<span></span>';
}
function mFoldFill(el){
  var arr=[];
  el.querySelectorAll('.mrow[data-rid]').forEach(function(row){var r=S.recipes[row.getAttribute('data-rid')];if(r)arr.push({r:r,m:finOf(r)});});
  var a=mAvg(arr);
  M_AVG.forEach(function(x){
    var c=el.querySelector('summary [data-avg="'+x[0]+'"]');if(!c)return;
    c.textContent=mAvgTxt(a,x[0]);c.className=mAvgCls(a,x[0]);c.title=mAvgTitle(a,x[0]);
  });
}
function mGroupsHtml(list){
  var cats=menuCats(),by={},none=[];
  list.forEach(function(it){var c=catOf(it.r);if(c)(by[c.id]||(by[c.id]=[])).push(it);else none.push(it);});
  var filtering=!!((S.mq||'').trim()||(S.mflt||'all')!=='all'),h='';
  function fold(key,title,arr){
    var cnt='<span class="sysub">'+arr.length+' '+plural(arr.length,['блюдо','блюда','блюд'])+'</span>';
    return'<details class="mfold" id="mf-'+esc(key)+'"'+(mFoldOpen(key)?' open':'')+'>'
      +(NOPRICE||!arr.length?'<summary><span class="mfh"><span class="mft">'+esc(title)+'</span>'+cnt+'</span></summary>':'<summary class="mfavg"><span class="mfh"><span class="mft">'+esc(title)+'</span>'+cnt+'</span>'+mAvgCellsHtml(mAvg(arr))+'</summary>')
      +(arr.length?arr.map(mRowHtml).join(''):'<p class="hint" style="margin:4px 0 10px">В папке пока нет блюд. Перенесите их из строки блюда или из блока «Папки меню».</p>')+'</details>';
  }
  cats.forEach(function(c){var arr=by[c.id]||[];if(!arr.length&&(filtering||layOn()))return;h+=fold(c.id,c.name,arr);});
  if(none.length)h+=fold('_none','Без папки',none);
  return h;
}
function mBulkHtml(n){
  if(!menuCats().length||!n||layOn())return'';
  return'<div class="mbulk"><label class="field"><span class="lbl">Перенести показанные блюда ('+n+') в папку</span><select id="mMoveSel" data-act="mMoveSel" data-edit data-fk="mmove">'+catOptionsHtml(S.mmove||'')+'</select></label>'
    +'<button class="btn" id="mMoveBtn" data-act="mMove" data-edit>Перенести</button></div>';
}
function mArchRowHtml(id){
  var r=S.recipes[id],num=ttkVal(r,'num'),c=catOf(r);
  return'<div class="arow" data-rid="'+esc(id)+'"><span class="mn"><b>'+esc(r.name||'Без названия')+'</b><small>'+(num?'ТТК №'+esc(num)+' · ':'')+'выход '+dnum(r.output,2)+' г'+(c?' · папка «'+esc(c.name)+'»':'')+'</small></span>'
    +'<span class="mbtns"><button class="btn mini" data-act="mUnarch" data-edit>Вернуть в меню</button>'+mOpenBtn()+'</span></div>';
}
function mArchHtml(){
  var all=visIds().filter(function(id){return S.recipes[id].arch;});
  var q=(S.mq||'').trim().toLowerCase();
  var list=all.filter(function(id){var r=S.recipes[id];return!q||String(r.name).toLowerCase().indexOf(q)>-1||String(ttkVal(r,'num')).toLowerCase().indexOf(q)>-1;});
  var h='<details class="pgroup" id="mArch"'+(S.marchOpen?' open':'')+'><summary>Архив · '+all.length+'</summary>';
  if(!all.length)return h+'<p class="hint" style="margin:8px 0 0">Здесь будут блюда, которые вывели из меню или которых нет в сезоне. Кнопка «В архив» есть в строке блюда. ТТК блюда в архиве сохраняется, из архива его можно вернуть в любой момент.</p></details>';
  h+='<p class="hint" style="margin:8px 0 0">Блюда в архиве не входят в средние показатели, назначение цен, файл CSV и ABC-анализ.</p>';
  h+=list.length?'<div class="arows">'+list.map(mArchRowHtml).join('')+'</div>':'<p class="muted">В архиве ничего не найдено по этому поиску.</p>';
  return h+'</details>';
}
function mListHtml(){
  var items=menuItems(),list=menuVisible(items),cats=menuCats(),h='';
  if(!list.length)h+='<p class="muted">'+(items.length?'Ничего не найдено. Измените поиск или фильтр.':'В меню нет блюд: все ТТК в архиве.')+'</p>';
  else if(!cats.length)h+='<div class="card">'+mHeadHtml()+list.map(mRowHtml).join('')+'</div>';
  else h+='<div class="card">'+mHeadHtml()+mGroupsHtml(list)+'</div>';
  return h+mBulkHtml(list.length)+mArchHtml();
}
function mFoldersHtml(){
  if(layOn())return'';                      /* у не-технолога папки общие, их ведёт технолог */
  var cats=menuCats(),cnt={},all={};
  Object.keys(S.recipes).forEach(function(id){var c=catOf(S.recipes[id]);if(c)all[c.id]=(all[c.id]||0)+1;});
  visIds().forEach(function(id){var r=S.recipes[id];if(r.arch)return;var c=catOf(r);if(c)cnt[c.id]=(cnt[c.id]||0)+1;});    /* как в меню: выбранный регион, без архива */
  var h='<details class="pgroup" id="mFolders"'+(S.mfOpen?' open':'')+'><summary>Папки меню · '+cats.length+'</summary>'
    +'<p class="hint" style="margin:8px 0 0">Папки делят меню на разделы: первые блюда, салаты, гарниры и т. д. Блюдо переносят в папку в строке блюда или на вкладке «ТТК», а сразу много блюд: найдите их поиском (например, «суп») и нажмите «Перенести» над списком. '+(syAdmin()&&syLinked()?'Эти папки и раскладка блюд видны всем сотрудникам, подключённым к общей базе: у них меню разложено так же. Название и порядок можно взять с Диска из папок региона. Архив у каждого свой.':'Папки и архив только ваши: в общую базу они не отправляются.')+'</p>'
    +(syAdmin()&&syLinked()&&S.sy.layOld?'<p class="hint cmsg warn" style="margin:8px 0 0">В таблице стоит скрипт прежней версии: общие папки у остальных появятся, когда вы вставите новый скрипт (вкладка «Личный кабинет» → «Настройка скрипта») и создадите новую версию развёртывания.</p>':'')
    +(syAdmin()&&syLinked()&&S.sy.layErr?'<p class="hint cmsg warn" style="margin:8px 0 0">Общие папки не отправились: '+esc(S.sy.layErr)+'</p>':'')
    +'<div class="cloudrow"><label class="field"><span class="lbl">Новая папка</span><input id="mNewCat" maxlength="60" autocomplete="off" data-act="mCatNew" data-edit data-fk="mnewcat" placeholder="Например: Первые блюда"></label><button class="btn primary" data-act="mCatAdd" data-edit>Создать папку</button>'
    +(syAdmin()&&syFilesOn()?'<button class="btn" data-act="mCatDrive" data-edit title="Создать папки меню с названиями папок на Диске и разложить по ним блюда, чьи файлы лежат в этих папках">Взять папки с Диска'+(syFReady()?' ('+syDriveTitles().filter(function(t){return!catNameTaken(t.name,'');}).length+')':'')+'</button>':'')+'</div>';
  cats.forEach(function(c,i){
    h+='<div class="mfrow"><label class="field"><span class="lbl">Название папки</span><input maxlength="60" autocomplete="off" data-act="mCatName" data-cat="'+esc(c.id)+'" data-edit data-fk="mcn:'+esc(c.id)+'" value="'+esc(c.name)+'"></label>'
      +'<span class="sysub mfcnt"'+((all[c.id]||0)>(cnt[c.id]||0)?' title="Остальные блюда папки лежат в архиве или в другом регионе"':'')+'>блюд: '+(cnt[c.id]||0)+((all[c.id]||0)>(cnt[c.id]||0)?' · ещё '+((all[c.id]||0)-(cnt[c.id]||0))+' в архиве или другом регионе':'')+'</span>'
      +'<span class="mfbtns"><button class="btn mini" data-act="mCatUp" data-cat="'+esc(c.id)+'" data-edit aria-label="Папку «'+esc(c.name)+'» выше"'+(i?'':' disabled')+'>↑</button><button class="btn mini" data-act="mCatDown" data-cat="'+esc(c.id)+'" data-edit aria-label="Папку «'+esc(c.name)+'» ниже"'+(i<cats.length-1?'':' disabled')+'>↓</button>'
      +'<button class="btn mini danger" data-act="mCatDel" data-cat="'+esc(c.id)+'" data-edit>Удалить</button></span></div>';
  });
  if(cats.length>1){
    var mg=S.mmerge||{},opt=function(sel,ex){return'<option value="">Выберите…</option>'+cats.filter(function(c){return c.id!==ex;}).map(function(c){return'<option value="'+esc(c.id)+'"'+(c.id===sel?' selected':'')+'>'+esc(c.name)+'</option>';}).join('');};
    h+='<div class="cloudrow" style="margin-top:12px"><label class="field"><span class="lbl">Объединить папку</span><select data-act="mMergeFrom" data-edit data-fk="mmgf">'+opt(mg.from,'')+'</select></label>'
      +'<label class="field"><span class="lbl">с папкой (название останется у неё)</span><select data-act="mMergeTo" data-edit data-fk="mmgt">'+opt(mg.to,mg.from)+'</select></label>'
      +'<button class="btn" data-act="mMergeGo" data-edit>Объединить</button></div>'
      +'<p class="hint" style="margin:6px 0 0">Блюда первой папки во всех регионах и в архиве перейдут во вторую, первая папка удалится. Так у регионов будут одинаковые папки.</p>';
  }
  if(cats.length)h+='<p class="hint" style="margin:10px 0 0">При удалении папки её блюда не удаляются: они переходят в «Без папки».</p>';
  return h+'</details>';
}
/* папки на Диске («1.Первые блюда», «2.Вторые блюда»…) -> папки меню: номер в начале задаёт порядок и в название не входит */
function syDirTitle(name){var n=String(name||'').replace(/\s+/g,' ').trim(),t=n.replace(/^\d+\s*[.)\]:\-–—]*\s*/,'').trim();return(t||n).slice(0,60);}
function syDirOrd(name){var m=/^\s*(\d+)/.exec(String(name||''));return m?parseInt(m[1],10):null;}
function syDriveTitles(){
  var by={};
  syDirs().forEach(function(d){
    var t=syDirTitle(d.name),k=normKey(t),o=syDirOrd(d.name);
    if(!k)return;
    if(!by[k])by[k]={name:t,ord:o};
    else if(o!==null&&(by[k].ord===null||o<by[k].ord))by[k].ord=o;
  });
  return Object.keys(by).map(function(k){return by[k];}).sort(function(a,b){
    var x=a.ord===null?1e9:a.ord,y=b.ord===null?1e9:b.ord;
    return x-y||String(a.name).localeCompare(String(b.name),'ru');
  });
}
/* название блюда или файла для сопоставления: без «ТТК», номеров, веса и единиц */
var SY_MSTOP={'ттк':1,'г':1,'гр':1,'мл':1,'кг':1,'л':1,'шт':1,'порц':1,'порция':1,'выход':1,'docx':1};
function syMatchKey(s){
  return normKey(String(s||'').replace(/\.docx$/i,'').replace(/[0-9]+(?:[.,][0-9]+)?/g,' ')).split(' ').filter(function(w){return w&&!SY_MSTOP[w];}).join(' ');
}
/* тот же файл ТТК в облаке: то же блюдо и тот же номер (если номера нет у одного из двух, совпасть должна и порция); правило такое же, как в скрипте */
function syTtkNum(n){var m=/№\s*(\d+)/.exec(String(n||''));return m?m[1]:'';}
function syTtkSize(n){return(String(n||'').replace(/\.docx$/i,'').replace(/№\s*\d+/g,' ').match(/\d+(?:[.,]\d+)?/g)||[]).join('/').replace(/,/g,'.');}
function syTtkSame(a,b){
  var ka=syMatchKey(a),kb=syMatchKey(b),na=syTtkNum(a),nb=syTtkNum(b),sa,sb;
  if(!ka||ka!==kb)return false;
  if(na&&nb)return na===nb;
  sa=syTtkSize(a);sb=syTtkSize(b);
  return!sa||!sb||sa===sb;
}
/* принятый файл библиотеки с тем же блюдом: сначала в регионе reg, потом (если он один во всей библиотеке) в любом */
function syOldFileFor(name,reg){
  var all=syFiles().filter(function(x){return x.kind==='main'&&syTtkSame(x.name,name);});
  var here=all.filter(function(x){return(x.reg||'')===(reg||'');});
  if(here.length===1)return here[0];
  if(here.length>1){var ex=here.filter(function(x){return x.name===name;});return ex.length===1?ex[0]:null;}
  return all.length===1?all[0]:null;
}
/* файл ТТК для библиотеки. Если файл этого блюда там уже есть, новый встаёт на его место и под его названием, а прежний уходит в «Архив» */
function syTtkJob(r){
  var m=ttkModel(r),nm=safeName('ТТК №'+m.num+' '+m.dish)+'.docx',tg=syTargetForRec(r),old=syOldFileFor(nm,tg.reg),rep='';
  if(old){nm=old.name;tg={reg:old.reg||'',dir:old.dir||''};rep=old.id;}
  return{name:nm,buf:buildTtkDocx(m),tg:tg,rep:rep};
}
/* блюда без папки: если файл с похожим названием лежит ровно в одной папке Диска, блюдо кладётся в папку меню с этим названием */
function syDriveAssign(){
  var cands=[],n=0,amb=0;
  syFiles().forEach(function(x){
    if(x.kind!=='main'||!x.dir)return;
    var di=syDirInfo(x.dir),k=syMatchKey(x.name);
    if(di&&k)cands.push({k:k,t:normKey(syDirTitle(di.name)),reg:x.reg||''});
  });
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id];
    if(r.cat&&catById(r.cat))return;
    var rk=syMatchKey(r.name),hit={},cnt=0;
    if(rk.length<3)return;
    cands.forEach(function(f){
      if(r.reg&&regKnown(r.reg)&&f.reg&&f.reg!==r.reg)return;
      if(f.k===rk||(rk.length>=5&&f.k.indexOf(rk)>-1)||(f.k.length>=5&&rk.indexOf(f.k)>-1)){if(!hit[f.t]){hit[f.t]=1;cnt++;}}
    });
    if(cnt>1){amb++;return;}
    if(cnt!==1)return;
    var title=Object.keys(hit)[0],c=menuCats().filter(function(x){return normKey(x.name)===title;})[0];
    if(c){r.cat=c.id;queueSave('recipes',id);n++;}
  });
  return{n:n,amb:amb};
}
function doCatDrive(){
  if(!syFReady()){
    flash('Читаю папки с Диска…');
    syFilesLoad(true,true).then(function(){if(syFReady())doCatDrive();else flash('Диск не открылся: проверьте вкладку «ТТК в облаке»');});
    return;
  }
  var cl=ensureMenu(),made=0,total=syDriveTitles();
  if(!total.length){flash('На Диске пока нет папок: создайте их в «ТТК в облаке» или прямо на Диске');return;}
  total.forEach(function(t){
    if(cl.length>=60||catNameTaken(t.name,''))return;
    cl.push({id:newId(),name:t.name});made++;
  });
  var as=syDriveAssign();
  if(made||as.n)saveMenu();
  S.mfOpen=true;renderAll();
  flash(made||as.n?('Папок создано: '+made+(as.n?', блюд разложено: '+as.n:'')+(as.amb?', неясных (файл в нескольких папках): '+as.amb:'')):'Все папки с Диска уже есть, новых блюд для раскладки не нашлось');
}
/* ---- ТТК по раскладке облака: блюдо ↔ файл в «ТТК в облаке» (то же блюдо и номер); от файла берутся папка и регион ---- */
function syFileById(id){return syFiles().filter(function(x){return x.id===id;})[0]||null;}
function lyFileTitle(f){var d=f&&f.dir?syDirInfo(f.dir):null;return d?syDirTitle(d.name):'';}
function lyCatFor(title,make){
  var k=normKey(title),c=menuCats().filter(function(x){return normKey(x.name)===k;})[0];
  if(c)return c.id;
  if(!make||menuCats().length>=60||!String(title||'').trim())return'';
  c={id:newId(),name:String(title).slice(0,60)};ensureMenu().push(c);
  return c.id;
}
function lyMatchK(rk,rn,fk,fn){
  if(!rk||!fk)return false;
  if(rn&&fn&&rn!==fn)return false;
  if(fk===rk)return rk.length>=3||!!(rn&&fn);      /* короткое название («Щи») — только при одинаковом номере ТТК */
  return(rk.length>=5&&fk.indexOf(rk)>-1)||(fk.length>=5&&rk.indexOf(fk)>-1);
}
function lyRecNum(r){return(r.ttk&&r.ttk.num)?String(r.ttk.num).replace(/\D/g,''):syTtkNum(r.name);}
function lyMatch(r,f){return lyMatchK(syMatchKey(r.name),lyRecNum(r),syMatchKey(f.name),syTtkNum(f.name));}
/* значок у файла в облаке: карта этого блюда опубликована в общей базе и есть в меню (указана цена продажи) */
var SY_MX=null;
/* полный номер ТТК с точкой («382» и «382.1» — разные карты); у карты — из поля номера или из названия, у файла — из названия */
function lyFullNum(r){
  var m=/\d+(?:[.,]\d+)?/.exec(String(r.ttk&&r.ttk.num||''))||/№\s*(\d+(?:[.,]\d+)?)/.exec(String(r.name||''));
  return m?String(m[1]||m[0]).replace(',','.'):'';
}
function lyFileNum(n){var m=/№\s*(\d+(?:[.,]\d+)?)/.exec(String(n||''));return m?m[1].replace(',','.'):'';}
/* тот же полный номер ТТК и слова одного названия целиком входят в другое («Борщ … с курочкой» и «Борщ … на к/б с курочкой 250/10 г») */
function lyTokEq(a,b){
  if(a===b)return true;
  var n=Math.min(a.length,b.length),c=0;
  if(n<4)return false;
  while(c<n&&a.charAt(c)===b.charAt(c))c++;
  return c>=4&&c>=Math.ceil(n*0.75);          /* общее начало: «соусе»/«соусом», «запеченый»/«запеченный» */
}
function lyStrong(e,fk,ff){
  if(!e.rf||!ff||e.rf!==ff)return false;
  var A=fk.split(' ').filter(function(w){return w.length>2;}),B=e.rk.split(' ').filter(function(w){return w.length>2;});      /* предлоги и союзы («в», «с», «на», «к/б») не считаются */
  function sub(X,Y){return X.length>0&&X.every(function(t){return Y.some(function(u){return lyTokEq(t,u);});});}
  return sub(A,B)||sub(B,A);
}
function syMenuIndex(){
  var a=[];
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id];if(!r||r.arch)return;
    var rk=syMatchKey(r.name);if(!rk)return;
    a.push({id:id,r:r,rk:rk,rn:lyRecNum(r),rf:lyFullNum(r)});
  });
  return a;
}
/* 'menu' — опубликована и есть цена продажи; 'noprice' — опубликована без цены; 'local' — есть только у вас; 'none' — блюда нет; '' — ещё не получали общую базу */
function syFMenuState(x){
  if(!S.sy.cfg.rev)return'';
  if(!SY_MX)SY_MX=syMenuIndex();
  var fk=syMatchKey(x.name),fn=syTtkNum(x.name),ff=lyFileNum(x.name),g=(x.reg&&regKnown(x.reg))?x.reg:'',best='none',rank=0;
  SY_MX.forEach(function(e){
    var rg=(e.r.reg&&regKnown(e.r.reg))?e.r.reg:'';
    if(g&&rg&&rg!==g)return;
    if(!lyMatchK(e.rk,e.rn,fk,fn)&&!lyStrong(e,fk,ff))return;
    var m=S.sy.map.rec[e.id],pub=!!(m&&m.sid),k='local',sv=e.r.sell||{},gg=g||rg,priced=gg?sv[gg]>0:Object.keys(sv).some(function(q){return sv[q]>0;});
    if(pub)k=priced?'menu':'noprice';
    var rk2={menu:3,noprice:2,local:1}[k];
    if(rk2>rank){rank=rk2;best=k;}
  });
  return best;
}
var SY_MENU_TAG={
  menu:['ok','✓ В меню','Карта опубликована в общей базе, цена продажи указана: блюдо есть в меню'],
  noprice:['warn','Нет цены','Карта опубликована, но цены продажи нет: в меню она не появится. Цена указывается на вкладке «Меню и финансы»'],
  local:['warn','Не опубликована','Карта есть только у вас, в общую базу она ещё не попала'],
  none:['neutral','Нет в базе','Блюда с таким названием и номером в общей базе нет']
};
function syFMenuTag(x){
  var k=syFMenuState(x),t=SY_MENU_TAG[k];
  return t?'<span class="mchk '+t[0]+'" title="'+esc(t[2])+'">'+t[1]+'</span> ':'';
}
/* строка-итог над списком: сколько карт из показанных уже в меню */
function syFMenuSum(list){
  var c={menu:0,noprice:0,local:0,none:0},n=0;
  list.forEach(function(x){if(x.kind!=='main')return;var k=syFMenuState(x);if(!k)return;c[k]++;n++;});
  if(!n)return'';
  var bits=[];
  if(c.noprice)bits.push('без цены продажи: '+c.noprice);
  if(c.local)bits.push('не опубликовано: '+c.local);
  if(c.none)bits.push('нет в базе: '+c.none);
  return'<p class="sysub" id="syFMenuSum" style="margin:10px 0 6px"><span class="mchk ok">✓ В меню</span> '+c.menu+' из '+n+(bits.length?' · '+bits.join(' · '):'')+'</p>';
}
/* что изменится: у каких блюд другая папка и у каких не задан регион (без изменений данных) */
function lyPlan(){
  var files=syFiles().filter(function(x){return x.kind==='main'&&(x.dir||x.reg);}),multi=regionList().length>1,out={items:[],cat:0,reg:0,amb:0,none:0};
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],rr=(r.reg&&regKnown(r.reg))?r.reg:'',cand=files.filter(function(f){return(!rr||!f.reg||f.reg===rr)&&lyMatch(r,f);}),titles={},regs={},nt=0,nr=0,it={id:id},cur;
    if(!cand.length){out.none++;return;}
    cand.forEach(function(f){
      var t=lyFileTitle(f),k=normKey(t);
      if(t&&!titles[k]){titles[k]=t;nt++;}
      if(f.reg&&regKnown(f.reg)&&!regs[f.reg]){regs[f.reg]=1;nr++;}
    });
    if(nt===1){
      var title=titles[Object.keys(titles)[0]];cur=r.cat&&catById(r.cat);
      if(!cur||normKey(cur.name)!==normKey(title)){it.title=title;out.cat++;}
    }else if(nt>1)out.amb++;
    if(!rr&&multi&&nr===1){it.reg=Object.keys(regs)[0];out.reg++;}
    if(it.title||it.reg)out.items.push(it);
  });
  return out;
}
function lyApply(p){
  var nc=0,nr=0,touched=false;
  p.items.forEach(function(it){
    var r=S.recipes[it.id],cid;
    if(!r)return;
    if(it.title){cid=lyCatFor(it.title,true);if(cid){r.cat=cid;nc++;touched=true;}}
    if(it.reg){r.reg=it.reg;nr++;}
    queueSave('recipes',it.id);
  });
  if(touched)saveMenu();
  return{cat:nc,reg:nr};
}
function lyStart(btn){
  if(!syFReady()){
    flash('Читаю папки и файлы из облака…');
    syFilesLoad(true,true).then(function(){if(syFReady())lyStart(btn);else flash('Облако не открылось: проверьте вкладку «ТТК в облаке»');});
    return;
  }
  var p=lyPlan();
  if(!p.items.length){
    flash('Все ТТК уже разложены как в облаке'+(p.amb?'. Неясно, куда класть: '+p.amb+' (файл в нескольких папках)':'')+(p.none?'. Без файла в облаке: '+p.none:''));
    return;
  }
  arm(btn,'Папка: '+p.cat+(p.reg?', регион: '+p.reg:'')+'. Подтвердить?',function(){
    var q=lyPlan(),a=lyApply(q);
    S.calcCat='';renderAll();
    flash('Разложено как в облаке: папка у '+a.cat+' ТТК'+(a.reg?', регион у '+a.reg+' (регион общий для всех: отправьте его в «Моих изменениях»)':'')+(q.amb?'. Неясно, куда класть: '+q.amb:''));
  });
}
function doCatAdd(){
  var el=$('#mNewCat');if(!el)return;
  var nm=el.value.replace(/\s+/g,' ').trim().slice(0,60);
  if(!nm){flash('Введите название папки');return;}
  if(catNameTaken(nm,'')){flash('Папка с таким названием уже есть');return;}
  if(menuCats().length>=60){flash('Можно создать не больше 60 папок');return;}
  ensureMenu().push({id:newId(),name:nm});saveMenu();S.mfOpen=true;renderAll();
  flash('Папка «'+nm+'» создана');
}
/* обновление цифр без перерисовки: поле, в котором сейчас печатают, не трогаем */
function mFill(el,force){
  var r=S.recipes[el.getAttribute('data-rid')];if(!r)return;
  var m=finOf(r),act=document.activeElement;
  function setIn(a,val){var i=el.querySelector('[data-act="'+a+'"]');if(i&&(force||i!==act))i.value=val;}
  function setOut(k,html){var o=el.querySelector('[data-out="'+k+'"]');if(o)o.innerHTML=html;}
  setIn('mPrice',toInput(m.price));setIn('mMk',pctStr(m.markup));setIn('mMg',pctStr(m.margin));
  setOut('cost',mCostCell(m));setOut('profit',m.profit===null?'—':money(m.profit));setOut('fc',m.fc===null?'—':pctStr(m.fc)+' %');
  mToneApply(el,m);
  ['mMk','mMg'].forEach(function(a){var i=el.querySelector('[data-act="'+a+'"]');if(i)i.disabled=m.cost===null||uiRO();});
  el.classList.toggle('inc',!m.complete);el.classList.toggle('below',belowTarget(m));
}
function menuRefresh(){
  var items=menuItems(),k=$('#mKpi'),c=$('#mChips');           /* сначала средняя прибыль меню: от неё границы подсветки */
  $$('#mList .mrow[data-rid]').forEach(function(el){mFill(el,false);});
  $$('#mList .mfold').forEach(function(el){if(el.querySelector('summary.mfavg'))mFoldFill(el);});
  mToneUi();
  if(k)k.innerHTML=menuKpiHtml(items);
  if(c)c.innerHTML=menuChipsHtml(items);
}
/* выгрузка меню в Excel: цена продажи, финансы и КБЖУ блюд, без состава (ингредиентов). Весь список меню региона, без учёта поиска и фильтра */
function menuXlsxTable(){
  var g=curRegion(),np=NOPRICE,cats=menuCats();
  function rd(v,d){if(v===null||v===undefined||!isFinite(v))return'';var m=Math.pow(10,d);return Math.round(v*m)/m;}
  function ci(r){var k=-1;cats.forEach(function(c,i){if(r.cat&&c.id===r.cat)k=i;});return k<0?9999:k;}
  var items=menuItems().sort(function(a,b){return ci(a.r)-ci(b.r)||String(a.r.name||'').localeCompare(String(b.r.name||''),'ru');});
  var cols=[
    ['Блюдо','text',250,function(x){return x.r.name||'Без названия';}],
    ['ТТК №','text',70,function(x){var n=String(ttkVal(x.r,'num')||'').trim();return n==='__'?'':n;}],
    ['Папка','text',150,function(x){return(catOf(x.r)||{name:''}).name;}],
    ['Выход порции, г','g',90,function(x){return rd(x.r.output,2);}],
    ['Цена продажи, ₽','money',100,function(x){return rd(x.m.price,2);}]
  ];
  if(!np)cols=cols.concat([
    ['Себестоимость порции, ₽','money',120,function(x){return rd(x.m.cost,2);}],
    ['Наценка, %','pct',90,function(x){return rd(x.m.markup,1);}],
    ['Маржинальность, %','pct',110,function(x){return rd(x.m.margin,1);}],
    ['Доход после сырья, ₽','money',110,function(x){return rd(x.m.profit,2);}],
    ['Сырьё в цене, %','pct',90,function(x){return rd(x.m.fc,1);}],
    ['Себестоимость','text',100,function(x){return x.m.cost===null?'':(x.m.complete?'полная':'неполная');}]
  ]);
  [['Белки','p'],['Жиры','f'],['Углеводы','c']].forEach(function(n){cols.push([n[0]+' на порцию, г','pct',90,function(x){return rd(x.k.portion[n[1]],1);}]);});
  cols.push(['Ккал на порцию','int',90,function(x){return rd(x.k.portion.k,0);}]);
  [['Белки','p'],['Жиры','f'],['Углеводы','c']].forEach(function(n){cols.push([n[0]+' на 100 г, г','pct',90,function(x){return x.k.per100?rd(x.k.per100[n[1]],1):'';}]);});
  cols.push(['Ккал на 100 г','int',90,function(x){return x.k.per100?rd(x.k.per100.k,0):'';}]);
  var rows=items.map(function(it){var x={r:it.r,m:it.m,k:compute(it.r,S.ings)};return cols.map(function(c){return c[3](x);});});
  var rn=regionName(g);
  return{name:'Меню',title:'Меню · регион «'+rn+'»',
    note:'Выгружено '+todayRu()+'. Блюд: '+items.length+'. '+(np?'Цены продажи региона «'+rn+'».':'Себестоимость по ценам сырья региона «'+rn+'», цена продажи этого региона.')+' Состав блюд (ингредиенты) не выгружается.',
    head:cols.map(function(c){return c[0];}),fmt:cols.map(function(c){return c[1];}),widths:cols.map(function(c){return c[2];}),rows:rows};
}
function menuXlsxBtnHtml(){
  if(guestOn()||!canDl())return'';
  return'<div class="btns" style="margin-bottom:12px"><button class="btn primary" data-act="dlMenuX" title="Меню региона с ценами продажи, финансами и КБЖУ, без состава блюд">Скачать Excel</button></div>';
}
function regSuffix(){return regionList().length>1?' ('+safeName(regionName(curRegion()))+')':'';}
/* меню без финансов (нет права на цены): блюда по папкам, архив и поиск */
function viewMenuLite(){
  return menuXlsxBtnHtml()+recsCardHtml()
    +'<p class="rgnote" style="margin-top:0">'+(syLinked()?'Закупочные цены и себестоимость для вашего кода не показываются. Цены продажи блюд видны, менять их может технолог или тер. управляющий.':'Закупочные цены и себестоимость закрыты. Чтобы открыть их, подключитесь на вкладке «Личный кабинет» с вашим кодом доступа. <button class="btn mini" data-act="syGoSync">Подключиться</button>')+'</p>'
    +'<div class="tools" style="margin-top:12px"><label class="field grow"><span class="lbl">Поиск по названию или номеру ТТК</span><input id="msearch" data-act="mQ" data-fk="msearch" autocomplete="off" value="'+esc(S.mq||'')+'" placeholder="Например: котлета"></label></div>'
    +mFoldersHtml()
    +'<div id="mList">'+mListHtml()+'</div>';
}
function viewMenu(){
  if(syLimited()&&!visIds().length)return'<div class="card empty"><h2>Рассчитанных ТТК пока нет</h2><p>Здесь появятся ТТК, когда технолог рассчитает их и опубликует в общей базе. Нерассчитанные карты не показываются.</p><div class="btns"><button class="btn primary" data-act="syGoSync">Общая база</button></div></div>';
  if(!Object.keys(S.recipes).length)return recsCardHtml()+'<div class="card empty"><h2>ТТК пока нет</h2><p>Здесь появятся все заведённые ТТК с себестоимостью и ценой продажи. Создайте расчёт на вкладке «ТТК» или загрузите готовую ТТК (.docx).</p><div class="btns"><button class="btn primary" data-act="gotoCalc">Открыть ТТК</button></div></div>';
  if(NOPRICE)return viewMenuLite();
  var items=menuItems(),g=curRegion();
  var h=sxCardHtml(),ex=menuXlsxBtnHtml()+(S.sx?'':'<div class="btns" style="margin-bottom:12px"><button class="btn" data-act="pickSx" data-edit title="Прейскурант: наименование блюда, единица, стоимость. Цены попадут в выбранный регион">Загрузить цены продажи из файла</button></div>')+'<p class="rgtag">Цены региона «'+esc(regionName(g))+'»'+(sellPtKey(g)?' · точка «'+esc((drPt(drCurPtId())||{}).name||'')+'»: у блюда без своей цены точки берётся цена региона':'')+'</p><p class="rgnote">Себестоимость считается по ценам сырья этого региона, цена продажи хранится отдельно для каждого региона. Регион выбирается вверху страницы.</p>';
  h+=syLimited()?'':recsCardHtml();
  h+=menuIncBarHtml(items);
  ex+=gpPanelHtml();

  var sortH='<label class="field w180" style="flex:0 0 190px"><span class="lbl">Сортировка</span><select data-act="mSort" data-fk="msort">'+[['name','По названию'],['cost','Сначала дорогие по себестоимости'],['price','Сначала дорогие по цене'],['margin','Сначала с низкой маржой'],['markup','Сначала с низкой наценкой']].map(function(x){return'<option value="'+x[0]+'"'+((S.msort||'name')===x[0]?' selected':'')+'>'+x[1]+'</option>';}).join('')+'</select></label>';

  h+='<div class="tools mtools" style="margin-top:14px"><label class="field grow"><span class="lbl">Поиск по названию или номеру ТТК</span><input id="msearch" data-act="mQ" data-fk="msearch" autocomplete="off" value="'+esc(S.mq||'')+'" placeholder="Поиск по названию или номеру ТТК"></label>'+'</div>'
    +'<div class="chips" id="mChips" style="margin-bottom:12px">'+menuChipsHtml(items)+'</div>'
    +'<details class="mextra" id="mExtra"'+(S.mExtra?' open':'')+'><summary>Дополнительные действия</summary><div class="mxbody">'+ex+sortH+menuToneHtml()+mFoldersHtml()+tbHtml()+'</div></details>'
    +'<div id="mList">'+mListHtml()+'</div>'
    +'<p class="hint">Себестоимость порции — только сырьё по брутто, без зарплаты и накладных расходов. Наценка = (цена − себестоимость) / себестоимость. Маржинальность = (цена − себестоимость) / цена. «Сырьё, %» — доля сырья в цене. Цена продажи и цены сырья должны быть на одной базе: обе с НДС или обе без. Меняя цену, наценку или маржинальность, вы меняете цену продажи: остальные показатели пересчитываются сами. Цена продажи подставляется в калькуляцию ОП-1 как наценка.</p>'
    ;
  return h;
}
