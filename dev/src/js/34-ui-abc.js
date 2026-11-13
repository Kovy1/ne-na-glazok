/* ---------- вкладка «ABC-анализ» ---------- */
function curAbc(){return S.cfg.abc||DEFAULT_ABC;}
function setAbc(k,v){var f=normAbc(S.cfg.abc||DEFAULT_ABC);f[k]=v;S.cfg.abc=normAbc(f);queueSave('settings','abc');}
/* что смотрим (блюда или сырьё, показатель) помнит этот браузер; границы классов и период общие */
function abPrefs(){
  if(!S.ap){
    var p=null;try{p=JSON.parse(lsGet('kbzhu:abc')||'null');}catch(e){p=null;}
    p=p||{};
    S.ap={m:p.m==='raw'?'raw':'dish',dm:['rev','profit','qty'].indexOf(p.dm)>-1?p.dm:'rev',rm:p.rm==='kg'?'kg':'cost'};
  }
  return S.ap;
}
function abSavePrefs(){lsSet('kbzhu:abc',JSON.stringify(abPrefs()));}
var AB_DM={rev:'Выручка',profit:'Доход после сырья',qty:'Количество порций'};
var AB_RM={cost:'Затраты на сырьё',kg:'Расход сырья, кг'};
var AB_GEN={rev:'выручки',profit:'дохода после сырья',qty:'порций',cost:'затрат',kg:'расхода'};
var AB_WHY={noqty:'нет продаж',noprice:'нет цены продажи',nocost:'себестоимость неполная'};
function abMetric(){var p=abPrefs();return p.m==='raw'?p.rm:p.dm;}
function abMetricName(){var p=abPrefs();return(p.m==='raw'?AB_RM:AB_DM)[abMetric()];}
function abData(){
  var f=curAbc(),p=abPrefs(),g=curRegion();
  var vm=abMap(g);
  return p.m==='raw'?abcRaw(vm,S.ings,g,p.rm,f.a,f.b):abcDishes(vm,S.ings,g,p.dm,f.a,f.b);
}
function abSalesStat(){
  var g=curRegion(),n=0,t=0,vi=abIds();
  vi.forEach(function(id){var q=S.recipes[id].qty;if(q&&q[g]>0){n++;t+=q[g];}});
  return{n:n,qty:t,all:vi.length};
}
function abSalesInfoHtml(){
  var s=abSalesStat();
  return s.n?'Продажи введены по <b>'+s.n+'</b> из '+s.all+' '+plural(s.all,['блюда','блюд','блюд'])+', всего порций: <b>'+fmt(s.qty,0)+'</b>.':'Продажи за период пока не введены.';
}
function abSubText(){var f=curAbc();return'Регион «'+esc(regionName(curRegion()))+'»'+(f.period?' · '+esc(f.period):'');}
function abTilesHtml(d){
  var raw=abPrefs().m==='raw',N=d.rows.length,word=raw?['позиция','позиции','позиций']:['блюдо','блюда','блюд'],gen=AB_GEN[abMetric()];
  return'<div class="atiles">'+['A','B','C'].map(function(k){
    var n=d.counts[k];
    return'<div class="atile"><span class="abadge '+k+'">'+k+'</span><div><div class="at1"><b>'+n+'</b> '+plural(n,word)+(N?' <small>· '+fmt(n/N*100,0)+' % списка</small>':'')+'</div><div class="at2">'+fmt(d.shares[k],1)+' % '+gen+'</div></div></div>';
  }).join('')+'</div>';
}
function abKpiHtml(d){
  var raw=abPrefs().m==='raw',t=d.tot;
  function it(l,v){return'<div><dt>'+l+'</dt><dd>'+v+'</dd></div>';}
  var h=raw
    ?it('Позиций сырья в анализе',d.rows.length+' <small>из '+t.items+'</small>')+it('Блюд с продажами',t.nDish+' <small>из '+t.nAll+'</small>')+it('Расход сырья, брутто',fmt(t.kg,t.kg>=100?0:1)+' кг')+it('Затраты на сырьё',t.noPrice.length&&!t.cost?'—':money(t.cost)+' ₽')
    :it('Блюд в анализе',d.rows.length+' <small>из '+t.nAll+'</small>')+it('Продано порций',fmt(t.qty,0))+it('Выручка',t.nRev?money(t.rev)+' ₽':'—')+it('Доход после сырья',t.nProfit?money(t.profit)+' ₽':'—');
  return'<dl class="kv mkpi abkpi">'+h+'</dl>';
}
function abWarnHtml(d){
  var raw=abPrefs().m==='raw',t=d.tot,w=[],g=esc(regionName(curRegion()));
  if(!raw){
    var np=d.skipped.filter(function(x){return x.reason==='noprice';}).length,nc=d.skipped.filter(function(x){return x.reason==='nocost';}).length;
    var loss=d.rows.filter(function(x){return x.v<0;}).length;
    if(np)w.push(['warn',np+' '+plural(np,['блюдо','блюда','блюд'])+' с продажами не вошли в анализ: нет цены продажи в регионе «'+g+'». Укажите её на вкладке «Меню и финансы».']);
    if(nc)w.push(['warn',nc+' '+plural(nc,['блюдо','блюда','блюд'])+' с продажами не вошли в анализ по доходу после сырья: себестоимость неполная, у части сырья нет цены в регионе «'+g+'». Заполните цены на вкладке «База сырья».']);
    if(loss)w.push(['warn','Убыточных блюд: '+loss+' (цена ниже себестоимости сырья). Они попали в класс C и в расчёт долей не входят.']);
    if(d.metric==='rev'&&t.nProfit<t.nRev)w.push(['good','Доход после сырья в итогах считается только по блюдам с полной себестоимостью: '+t.nProfit+' из '+t.nRev+'.']);
  }else{
    if(d.metric==='cost'&&d.skipped.length)w.push(['warn','Нет цены в регионе «'+g+'» у сырья: '+d.skipped.slice(0,6).map(function(x){return esc(x.name);}).join(', ')+(d.skipped.length>6?' и ещё '+(d.skipped.length-6):'')+'. Расход в кг по ним учтён, в затраты они не вошли.']);
    if(t.unlinked)w.push(['warn','В '+t.unlinked+' '+plural(t.unlinked,['строке','строках','строках'])+' рецептур нет сырья из базы, расход по ним не посчитан.']);
    w.push(['good','Расход считается по брутто на порцию из ТТК и числу проданных порций: сколько сырья нужно закупить на этот объём продаж.']);
  }
  return w.length?'<ul class="warns">'+w.map(function(x){return'<li class="w-'+x[0]+'">'+x[1]+'</li>';}).join('')+'</ul>':'';
}
function abSumHtml(d){
  if(!abSalesStat().n)return'<p class="muted">Продаж за период пока нет. Вставьте таблицу из учётной системы или введите количество порций по блюдам выше, и здесь появятся классы A, B и C.</p>';
  if(!d.rows.length)return'<p class="muted">Нет данных для анализа по выбранному показателю.</p>'+abWarnHtml(d);
  return abTilesHtml(d)+abKpiHtml(d)+abWarnHtml(d);
}
function abChipsHtml(d){
  if(!abSalesStat().n)return'';
  var f=S.aflt||'all';
  function chip(k,l,c){return'<button class="chip" data-act="aFlt" data-f="'+k+'" aria-pressed="'+(f===k)+'">'+l+' · '+c+'</button>';}
  return chip('all','Все',d.rows.length)+chip('A','A',d.counts.A)+chip('B','B',d.counts.B)+chip('C','C',d.counts.C)+chip('skip','Не учтены',d.skipped.length);
}
function abHeadHtml(raw){
  var h=raw?['Сырьё','Расход, кг','Цена, ₽/кг','Затраты, ₽']:['Блюдо','Порций','Выручка, ₽','Доход, ₽'];
  return'<div class="arow ahead"><span>№</span><span>'+h[0]+'</span><span class="r">'+h[1]+'</span><span class="r">'+h[2]+'</span><span class="r">'+h[3]+'</span><span class="r">Доля, %</span><span class="r">Накопл., %</span><span class="ctr">Класс</span></div>';
}
function abRowHtml(x,raw){
  var sel=abMetric(),cls=x.cls||'',parts=[],c3,c4,c5,l3,l4,l5,selc;
  if(!raw){
    var r=S.recipes[x.id],num=r?ttkVal(r,'num'):'';
    l3='Порций';l4='Выручка, ₽';l5='Доход, ₽';
    c3=x.qty>0?fmt(x.qty,x.qty%1?2:0):'—';c4=x.rev===null?'—':money(x.rev);c5=x.profit===null?'—':money(x.profit);
    selc={qty:3,rev:4,profit:5};
    if(num)parts.push('ТТК №'+esc(num));
    if(x.price!==null)parts.push('цена '+money(x.price)+' ₽');
    if(x.cost!==null)parts.push('себест. '+money(x.cost)+' ₽'+(x.complete?'':' (неполная)'));
    if(!cls&&AB_WHY[x.reason])parts.push('<span class="why">'+AB_WHY[x.reason]+'</span>');
  }else{
    l3='Расход, кг';l4='Цена, ₽/кг';l5='Затраты, ₽';
    c3=fmt(x.kg,x.kg>=100?0:(x.kg>=10?1:2));c4=x.price===null?'нет цены':money(x.price);c5=x.cost===null?'—':money(x.cost);
    selc={kg:3,cost:5};
    parts.push('в '+x.dishes+' '+plural(x.dishes,['блюде','блюдах','блюдах']));
    if(x.pcs!==null)parts.push('≈ '+fmt(x.pcs,0)+' шт.');
    if(!cls&&x.reason==='noprice')parts.push('<span class="why">нет цены сырья</span>');
  }
  function cell(n,v,l){return'<span class="num'+(selc[sel]===n?' sel':'')+'" data-label="'+l+'">'+v+'</span>';}
  return'<div class="arow'+(cls?'':' skip')+(x.v<0?' loss':'')+'"><span class="rk">'+(cls?x.rank:'—')+'</span>'
    +'<span class="an"><b>'+esc(x.name)+'</b>'+(parts.length?'<small>'+parts.join(' · ')+'</small>':'')+'</span>'
    +cell(3,c3,l3)+cell(4,c4,l4)+cell(5,c5,l5)
    +'<span class="num" data-label="Доля, %">'+(cls?fmt(x.share,1):'—')+'</span><span class="num" data-label="Накопл., %">'+(cls?fmt(x.cum,1):'—')+'</span>'
    +'<span class="ac">'+(cls?'<span class="abadge '+cls+'">'+cls+'</span>':'<span class="abadge N" title="Не вошло в анализ">—</span>')+'</span></div>';
}
function abListHtml(d){
  if(!abSalesStat().n)return'';
  var f=S.aflt||'all',q=(S.aq||'').trim().toLowerCase(),raw=abPrefs().m==='raw';
  var src=f==='skip'?d.skipped:(f==='all'?d.rows:d.rows.filter(function(x){return x.cls===f;}));
  var list=q?src.filter(function(x){return String(x.name).toLowerCase().indexOf(q)>-1;}):src;
  if(!list.length)return'<p class="muted">'+(f==='skip'&&!d.skipped.length?'Все позиции с продажами учтены в анализе.':'Ничего не найдено. Измените поиск или фильтр.')+'</p>';
  return'<div class="arows">'+abHeadHtml(raw)+list.map(function(x){return abRowHtml(x,raw);}).join('')+'</div>';
}
function abValStr(x){
  var m=abMetric();
  if(m==='qty')return fmt(x.v,x.v%1?2:0)+' порц.';
  if(m==='kg')return fmt(x.v,x.v>=100?0:2)+' кг';
  return money(x.v)+' ₽';
}
/* диаграмма Парето на одной оси (доли в процентах от итога): столбцы — доля позиции, линия — накопленная доля, цвет столбцов — класс */
function abDrawChart(){
  var box=$('#abChart');if(!box)return;
  var d=S.abD,pts=d?d.rows.filter(function(x){return x.v>0;}):[];
  S.abPts=pts;
  if(!pts.length){box.innerHTML='';box.hidden=true;return;}
  box.hidden=false;
  var W=Math.max(300,Math.floor(box.clientWidth||680)),H=W<560?220:260,mL=W<560?38:44,mR=10,mT=28,mB=26,pw=W-mL-mR,ph=H-mT-mB,n=pts.length,slot=pw/n;
  var gap=slot>=7?2:(slot>=3.5?1:0),bw=Math.max(1,Math.min(24,slot-gap)),raw=abPrefs().m==='raw';
  function R1(v){return Math.round(v*10)/10;}
  function X(i){return mL+slot*i+slot/2;}
  function Y(q){return mT+ph*(1-q/100);}
  var s='<svg viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" data-ml="'+mL+'" data-pw="'+R1(pw)+'" role="img" aria-label="Диаграмма Парето: доля каждой позиции и накопленная доля, классы A, B и C. Те же данные в таблице ниже.">';
  [0,20,40,60,80,100].forEach(function(q){
    s+='<line class="gl" x1="'+mL+'" x2="'+(W-mR)+'" y1="'+R1(Y(q))+'" y2="'+R1(Y(q))+'"/><text x="'+(mL-6)+'" y="'+R1(Y(q)+4)+'" text-anchor="end">'+q+' %</text>';
  });
  pts.forEach(function(x,i){
    var h=Math.max(1.5,ph*x.share/100),y=mT+ph-h,xl=X(i)-bw/2,r=Math.min(4,bw/2,h);
    s+='<path class="b'+x.cls+'" d="M'+R1(xl)+' '+R1(y+h)+'V'+R1(y+r)+'Q'+R1(xl)+' '+R1(y)+' '+R1(xl+r)+' '+R1(y)+'H'+R1(xl+bw-r)+'Q'+R1(xl+bw)+' '+R1(y)+' '+R1(xl+bw)+' '+R1(y+r)+'V'+R1(y+h)+'Z"/>';
  });
  s+='<polyline class="cl" points="'+pts.map(function(x,i){return R1(X(i))+','+R1(Y(x.cum));}).join(' ')+'"/>';
  var zi={};
  pts.forEach(function(x,i){var z=zi[x.cls]||(zi[x.cls]={a:i,b:i});z.b=i;});
  ['A','B','C'].forEach(function(k){
    var z=zi[k];if(!z)return;
    var x0=mL+slot*z.a,x1=mL+slot*(z.b+1),last=pts[z.b],cx=R1(X(z.b)),cy=R1(Y(last.cum));
    if(z.a>0)s+='<line class="zl" x1="'+R1(x0)+'" x2="'+R1(x0)+'" y1="'+(mT-6)+'" y2="'+(mT+ph)+'"/>';
    s+='<text class="zt" x="'+R1((x0+x1)/2)+'" y="'+(mT-11)+'" text-anchor="middle">'+(x1-x0>=70?k+' · '+d.counts[k]:k)+'</text>';
    s+='<circle class="dt" cx="'+cx+'" cy="'+cy+'" r="4"/>';
    if(k!=='C'){
      var right=cx+8+40<=W-mR;
      s+='<text class="cv" x="'+R1(right?cx+8:cx-8)+'" y="'+R1(cy+16)+'" text-anchor="'+(right?'start':'end')+'">'+fmt(last.cum,1)+' %</text>';
    }
  });
  s+='<text x="'+mL+'" y="'+(H-8)+'">1</text><text x="'+R1(mL+pw/2)+'" y="'+(H-8)+'" text-anchor="middle">'+(raw?'позиции сырья':'блюда')+' по убыванию показателя</text><text x="'+(W-mR)+'" y="'+(H-8)+'" text-anchor="end">'+n+'</text>';
  s+='<rect id="abHi" class="hi" x="0" y="'+mT+'" width="0" height="'+ph+'" style="display:none"/>';
  s+='<rect id="abHit" x="'+mL+'" y="'+mT+'" width="'+R1(pw)+'" height="'+ph+'" fill="transparent"/></svg><div class="abtip" id="abTip" hidden></div>';
  box.innerHTML=s;
  if(!box.getAttribute('data-b')){
    box.setAttribute('data-b','1');
    box.addEventListener('pointermove',abChartMove);
    box.addEventListener('pointerdown',abChartMove);
    box.addEventListener('pointerleave',abChartLeave);
  }
}
function abChartLeave(){var tip=$('#abTip'),hi=$('#abHi');if(tip)tip.hidden=true;if(hi)hi.style.display='none';}
function abChartMove(e){
  var box=$('#abChart'),svg=box&&box.querySelector('svg'),pts=S.abPts,tip=$('#abTip');
  if(!svg||!tip||!pts||!pts.length)return;
  var rc=svg.getBoundingClientRect(),W=Number(svg.getAttribute('width'))||rc.width,k=rc.width?W/rc.width:1;
  var mL=Number(svg.getAttribute('data-ml')),pw=Number(svg.getAttribute('data-pw')),n=pts.length,slot=pw/n;
  var x=(e.clientX-rc.left)*k,i=Math.floor((x-mL)/slot);
  if(x<mL-4||x>mL+pw+4){abChartLeave();return;}
  if(i<0)i=0;if(i>=n)i=n-1;
  var hi=svg.querySelector('#abHi');
  if(hi){hi.setAttribute('x',mL+slot*i);hi.setAttribute('width',slot);hi.style.display='';}
  var x0=pts[i];
  tip.textContent='';
  var hd=document.createElement('div');hd.className='tn1';hd.textContent='№'+x0.rank+' · '+x0.name+' · класс '+x0.cls;tip.appendChild(hd);
  function line(v,l){var dv=document.createElement('div'),st=document.createElement('strong'),sp=document.createElement('span');st.textContent=v;sp.textContent=' '+l;dv.appendChild(st);dv.appendChild(sp);tip.appendChild(dv);}
  line(abValStr(x0),abMetricName().toLowerCase());
  line(fmt(x0.share,1)+' %','доля');
  line(fmt(x0.cum,1)+' %','накопленная доля');
  tip.hidden=false;
  var px=(mL+slot*i+slot/2)/k,tw=tip.offsetWidth,left=px+14;
  if(left+tw>rc.width)left=px-14-tw;
  if(left<0)left=0;
  tip.style.left=left+'px';
}
function abRefresh(){
  S.abD=abData();
  var d=S.abD,st=abSalesStat();
  var s=$('#abSum'),c=$('#abChips'),l=$('#abList'),inf=$('#abSalesInfo'),tl=$('#abTools'),sb=$('#abSub'),cl=$('#abClearBtn');
  if(s)s.innerHTML=abSumHtml(d);
  if(c)c.innerHTML=abChipsHtml(d);
  if(l)l.innerHTML=abListHtml(d);
  if(inf)inf.innerHTML=abSalesInfoHtml();
  if(tl)tl.hidden=!st.n;
  if(sb)sb.innerHTML=abSubText();
  if(cl)cl.hidden=!st.n;
  abDrawChart();
}
function abFileName(){return safeName('ABC-анализ, '+(abPrefs().m==='raw'?'сырьё':'блюда')+', '+abMetricName().toLowerCase()+regSuffix());}
function abRows(){
  var d=abData(),f=curAbc(),raw=abPrefs().m==='raw',rows=[];
  rows.push(['ABC-анализ: '+(raw?'сырьё':'блюда'),abMetricName()]);
  rows.push(['Регион',regionName(curRegion())]);
  rows.push(['Период',f.period]);
  rows.push(['Классы по накопленной доле','A до '+csvNum(f.a,1)+' %, B до '+csvNum(f.b,1)+' %, C остальное']);
  rows.push([]);
  if(raw){
    rows.push(['№','Сырьё','Расход, кг','Цена, ₽/кг','Затраты, ₽','В скольких блюдах','Доля, %','Накопленная доля, %','Класс','Примечание']);
    d.rows.forEach(function(x){rows.push([x.rank,x.name,csvNum(x.kg,3),csvNum(x.price,2),csvNum(x.cost,2),x.dishes,csvNum(x.share,2),csvNum(x.cum,2),x.cls,'']);});
    d.skipped.forEach(function(x){rows.push(['',x.name,csvNum(x.kg,3),csvNum(x.price,2),csvNum(x.cost,2),x.dishes,'','','','нет цены сырья']);});
  }else{
    rows.push(['№','Блюдо','ТТК №','Продано порций','Цена продажи, ₽','Себестоимость порции, ₽','Выручка, ₽','Доход после сырья, ₽','Доля, %','Накопленная доля, %','Класс','Примечание']);
    function pr(x,cls){
      var r=S.recipes[x.id],num=r?ttkVal(r,'num'):'';
      return[cls?x.rank:'',x.name,num,csvNum(x.qty,3),csvNum(x.price,2),csvNum(x.cost,2),csvNum(x.rev,2),csvNum(x.profit,2),cls?csvNum(x.share,2):'',cls?csvNum(x.cum,2):'',cls||'',cls?(x.complete?'':'себестоимость неполная'):(AB_WHY[x.reason]||'')];
    }
    d.rows.forEach(function(x){rows.push(pr(x,x.cls));});
    d.skipped.forEach(function(x){rows.push(pr(x,''));});
  }
  return rows;
}
/* продано порций по блюдам: ввод вручную */
function abEntryHtml(){
  var g=curRegion(),ids=abIds();
  return ids.map(function(id){
    var r=S.recipes[id],q=(r.qty&&r.qty[g]>0)?r.qty[g]:null,sp=sellEff(r,g),num=ttkVal(r,'num');
    return'<div class="srow" data-rid="'+esc(id)+'"><span class="mn"><b>'+esc(r.name||'Без названия')+'</b><small>'+(num?'ТТК №'+esc(num)+' · ':'')+(sp?'цена '+money(sp)+' ₽':'<span class="nop">нет цены продажи</span>')+'</small></span>'
      +'<input class="num" inputmode="decimal" autocomplete="off" aria-label="Продано порций: '+esc(r.name||'Без названия')+'" data-act="aQty" data-edit data-fk="aq:'+esc(id)+'" value="'+toInput(q)+'" placeholder="0"></div>';
  }).join('');
}
function viewAbc(){
  if(!Object.keys(S.recipes).length)return'<div class="card empty"><h2>ТТК пока нет</h2><p>ABC-анализ строится по продажам блюд. Сначала создайте расчёт на вкладке «ТТК» или загрузите готовую ТТК (.docx).</p><div class="btns"><button class="btn primary" data-act="gotoCalc">Открыть ТТК</button></div></div>';
  var f=curAbc(),p=abPrefs(),g=curRegion(),raw=p.m==='raw',st=abSalesStat();
  S.abD=abData();
  var d=S.abD,mset=raw?AB_RM:AB_DM;
  var metricOpts=Object.keys(mset).map(function(k){return'<option value="'+k+'"'+(abMetric()===k?' selected':'')+'>'+mset[k]+'</option>';}).join('');
  var pasteOpen=S.aPaste===undefined?!st.n:S.aPaste;
  var h='<p class="rgtag">Продажи и цены региона «'+esc(regionName(g))+'»</p><p class="rgnote">Продажи вводятся и хранятся отдельно для каждого региона. Расход сырья считается по рецептурам ТТК и продажам, затраты и выручка — по ценам региона. Регион выбирается вверху страницы.</p>';
  h+=salesCardHtml();
  h+='<section class="card"><h2>Параметры анализа</h2>'
    +'<div class="chips" style="margin-bottom:12px"><button class="chip" data-act="aMode" data-m="dish" aria-pressed="'+!raw+'">Блюда</button><button class="chip" data-act="aMode" data-m="raw" aria-pressed="'+raw+'">Сырьё</button></div>'
    +'<div class="fgrid"><label class="field w220"><span class="lbl">Показатель</span><select data-act="aMetric" data-fk="a:metric">'+metricOpts+'</select></label>'
    +'<label class="field"><span class="lbl">Период (для подписи и выгрузки)</span><input data-act="abPeriod" data-edit data-fk="a:period" autocomplete="off" value="'+esc(f.period)+'" placeholder="Например: сентябрь 2026"></label>'
    +'<label class="field w120"><span class="lbl">Граница A, %</span><input class="num" inputmode="decimal" autocomplete="off" data-act="abA" data-edit data-fk="a:a" value="'+toInput(f.a)+'"></label>'
    +'<label class="field w120"><span class="lbl">Граница B, %</span><input class="num" inputmode="decimal" autocomplete="off" data-act="abB" data-edit data-fk="a:b" value="'+toInput(f.b)+'"></label></div>'
    +'<p class="hint" style="margin-top:0">'+(raw
      ?'Сырьё: сколько его уходит на проданные блюда и сколько это стоит. Показывает главные статьи закупки.'
      :'Блюда: какие позиции дают основную выручку или прибыль, а какие почти не продаются.')
    +' Класс A — позиции, у которых накопленная доля вместе с ними не больше '+fmt(f.a,f.a%1?1:0)+' %, B — не больше '+fmt(f.b,f.b%1?1:0)+' %, остальные C. Границы общие для всех регионов и всех, кто открывает страницу.</p></section>';
  h+='<section class="card" id="abSalesCard"><h2>Продажи за период</h2><p class="hint" style="margin:0 0 10px" id="abSalesInfo">'+abSalesInfoHtml()+'</p>'
    +cloudSalesHtml()
    +'<details class="pgroup" id="abPaste"'+(pasteOpen?' open':'')+'><summary>Вставить таблицу из учётной системы</summary>'
    +'<p class="hint" style="margin-top:8px">Скопируйте из Excel, 1С, iiko, r_keeper или другой программы колонки с названием блюда и количеством проданных порций и вставьте сюда. Другие колонки не мешают: берётся колонка «Количество» или первое число после названия. Блюда сопоставятся с вашими ТТК, соответствие можно будет проверить до загрузки.</p>'
    +'<textarea id="abText" rows="6" data-fk="abText" aria-label="Таблица продаж" placeholder="Котлета мясная;120&#10;Борщ с мясом;95"></textarea>'
    +'<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="aParse" data-edit>Разобрать</button><button class="btn" data-act="aPickSales" data-edit>Выбрать файл (CSV, TXT)</button></div></details>'
    +'<details class="pgroup" id="abManual"'+(S.aManual?' open':'')+'><summary>Ввести количество по блюдам · '+abIds().length+'</summary><div class="srows">'+abEntryHtml()+'</div></details>'
    +'<div class="btns" style="margin-top:12px"><button class="btn" id="abClearBtn" data-act="aClear" data-edit'+(st.n?'':' hidden')+'>Очистить продажи региона</button></div></section>';
  h+='<section class="card" id="abRes"><h2>ABC-анализ: '+(raw?'сырьё':'блюда')+', показатель «'+abMetricName().toLowerCase()+'»</h2><p class="rgtag" id="abSub">'+abSubText()+'</p>'
    +'<div id="abSum">'+abSumHtml(d)+'</div><div class="abchart" id="abChart" hidden></div>'
    +'<div id="abTools"'+(st.n?'':' hidden')+'><div class="tools" style="margin-top:16px"><label class="field grow"><span class="lbl">Поиск по названию</span><input id="abSearch" data-act="aQ" data-fk="aq" autocomplete="off" value="'+esc(S.aq||'')+'" placeholder="Например: котлета"></label></div>'
    +'<div class="chips" id="abChips" style="margin-bottom:12px">'+abChipsHtml(d)+'</div>'
    +'<div class="btns" style="margin-bottom:12px">'+(canDl()?'<button class="btn" data-act="dlAbc">Скачать CSV</button>':'')+'<button class="btn" data-act="cpAbc">Копировать для Excel</button></div>'
    +'<div id="abList">'+abListHtml(d)+'</div></div>'
    +'<details class="pgroup"><summary>Как читать ABC-анализ</summary>'
    +'<p class="hint">Позиции сортируются по убыванию показателя, считается накопленная доля. Класс A — позиции, у которых накопленная доля вместе с ними не больше '+fmt(f.a,f.a%1?1:0)+' %: это основа результата. Класс B — до '+fmt(f.b,f.b%1?1:0)+' %, класс C — остальные, «хвост». Самая крупная позиция всегда в A. Нулевые и убыточные позиции попадают в C и в расчёт долей не входят. При равных значениях порядок по названию. Так же классы считаются в типовой формуле Excel, поэтому результат можно перепроверить.</p>'
    +'<p class="hint">Блюда класса A держите в наличии и стабильного качества, рецептуру меняйте только после проверки. Блюда класса C с малой прибылью — кандидаты на пересмотр цены или вывод из меню, но сначала проверьте, не дополняют ли они ассортимент. Сырьё класса A — главные статьи закупки: договоры, торг, контроль цен и остатков.</p>'
    +'<p class="hint">ABC не учитывает сезонность и акции, берите период от месяца. Выручка — цена продажи × порции. Доход после сырья — выручка минус сырьё по рецептурам; зарплата, аренда, коммунальные услуги, налоги, потери и списания готовых блюд не учтены. Цена продажи и цены сырья должны быть на одной базе: обе с НДС или обе без.</p></details></section>';
  return h;
}
/* ---- загрузка продаж из таблицы ---- */
function startSales(rows,fileName){
  var items=[],fake={},vm=visMap();
  Object.keys(vm).forEach(function(id){fake[id]={name:dishKey(vm[id].name)};});
  parseSales(rows).forEach(function(x){
    var mt=x.qty===null?{id:'',how:'none',score:0}:matchRecipe(x.name,vm,fake);
    var pick=mt.id;if(mt.how==='fuzzy'&&mt.score<0.6)pick='';
    items.push({name:x.name,qty:x.qty,rec:pick,how:pick?mt.how:'none',score:mt.score,guess:mt.id,remember:mt.how==='fuzzy'&&!!pick&&!mt.multi});
  });
  if(!items.length){flash('В таблице нет строк с названием блюда');return;}
  S.sales={file:fileName,items:items,clear:true};
  S.tab='abc';renderAll();
  var c=$('#salesCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
}
function onSalesFile(file){
  var ext=(/\.([a-z0-9]+)$/i.exec(file.name)||[])[1];ext=(ext||'').toLowerCase();
  if(ext==='csv'||ext==='tsv'||ext==='txt'){
    readTextFile(file,function(err,text){
      if(err){flash('Не удалось прочитать файл');return;}
      var rows=parseRecords(text);
      if(!rows.length){flash('В файле нет строк');return;}
      startSales(rows,file.name);
    });
  }else flash('Нужен файл .csv, .tsv или .txt. Из Excel: «Сохранить как → CSV» или скопируйте таблицу и вставьте в поле.');
}
function salesStatus(x){
  if(x.qty===null)return['neutral','Нет количества'];
  if(!x.rec)return['bad','Не найдено'];
  if(x.how==='alias')return['ok','Запомнено'];
  if(x.how==='exact')return['ok','Совпало'];
  if(x.how==='fuzzy')return['warn','Проверьте'];
  return['neutral','Выбрано вами'];
}
function salesRowHtml(x,i,opts){
  var st=salesStatus(x),sel=opts.replace('value="'+esc(x.rec)+'"','value="'+esc(x.rec)+'" selected');
  return'<div class="trow" data-i="'+i+'"><span class="tn">'+esc(x.name)+((!x.rec&&x.guess&&x.qty!==null&&S.recipes[x.guess])?'<span class="tsub">Похоже: '+esc(S.recipes[x.guess].name)+'</span>':'')+'</span>'
    +'<span class="tnet">'+(x.qty===null?'—':fmt(x.qty,x.qty%1?2:0))+'</span>'
    +'<span class="tsel"><select data-act="salesRec" data-edit data-fk="sr:'+i+'" aria-label="Блюдо для «'+esc(x.name)+'»">'+sel+'</select></span>'
    +'<span class="tst"><span class="tstat '+st[0]+'">'+st[1]+'</span>'
    +((x.rec&&x.how!=='alias'&&x.how!=='exact')?'<label class="trem"><input type="checkbox" data-act="salesRem" data-edit'+(x.remember?' checked':'')+'>запомнить название</label>':'')+'</span></div>';
}
function salesCardHtml(){
  var t=S.sales;if(!t)return'';
  var g=curRegion(),ids=visIds();
  var opts='<option value="">— пропустить —</option>'+ids.map(function(id){return'<option value="'+esc(id)+'">'+esc(S.recipes[id].name||'Без названия')+'</option>';}).join('');
  var none=[],need=[],check=[],ok=[];
  t.items.forEach(function(x,i){
    if(x.qty===null)none.push(i);
    else if(!x.rec||!S.recipes[x.rec])need.push(i);
    else if(x.how==='fuzzy'||x.how==='manual')check.push(i);
    else ok.push(i);
  });
  function block(list,title,open){
    if(!list.length)return'';
    var head='<div class="trow thead"><span>В таблице</span><span class="r">Порций</span><span>Блюдо в базе</span><span>Статус</span></div>';
    return'<details class="pgroup"'+(open?' open':'')+'><summary>'+title+' · '+list.length+'</summary><div class="trows">'+head+list.map(function(i){return salesRowHtml(t.items[i],i,opts);}).join('')+'</div></details>';
  }
  var per={},rows=0,lost=0,tq=0,clr=0;
  t.items.forEach(function(x){if(x.qty===null)return;if(x.rec&&S.recipes[x.rec]){per[x.rec]=(per[x.rec]||0)+x.qty;rows++;}else lost+=x.qty;});
  var nD=Object.keys(per).length,merged=rows-nD;
  Object.keys(per).forEach(function(id){tq+=per[id];});
  if(t.clear)visIds().forEach(function(id){var q=S.recipes[id].qty;if(q&&q[g]>0&&!per[id])clr++;});
  var h='<section class="card ttk" id="salesCard"><h2>Загружены продажи</h2>'
    +'<p class="rgtag">Продажи запишутся в регион «'+esc(regionName(g))+'»</p>'
    +'<p class="hint" style="margin-top:2px">Источник: '+esc(t.file)+', строк: '+t.items.length+'. Проверьте, что название из таблицы сопоставлено нужному блюду. Выберите блюдо из списка или оставьте «пропустить».</p>'
    +block(need,'Нужно выбрать блюдо',true)+block(check,'Проверьте соответствие',true)+block(ok,'Совпали по названию',false)+block(none,'Без количества (пропущены)',false);
  var notes=[];
  if(need.length)notes.push(['warn','Блюдо не выбрано в '+need.length+' '+plural(need.length,['строке','строках','строках'])+', порций в них: '+fmt(lost,0)+'. Они не загрузятся.']);
  if(merged>0)notes.push(['warn','Несколько строк таблицы относятся к одному блюду ('+merged+'): количества сложатся.']);
  if(t.clear&&clr)notes.push(['warn','У '+clr+' '+plural(clr,['блюда','блюд','блюд'])+' региона продажи были, а в таблице их нет: они будут очищены.']);
  notes.push([nD?'good':'warn','К загрузке готово: '+nD+' '+plural(nD,['блюдо','блюда','блюд'])+', порций: '+fmt(tq,0)+'.']);
  h+='<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>';
  h+='<label class="trem" style="margin-top:12px"><input type="checkbox" data-act="salesClear" data-edit data-fk="sales:clear"'+(t.clear?' checked':'')+'>Сначала очистить продажи региона «'+esc(regionName(g))+'»: новый период заменяет прежний</label>';
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="aApply" data-edit'+(nD?'':' disabled')+'>Загрузить продажи: '+nD+' '+plural(nD,['блюдо','блюда','блюд'])+'</button><button class="btn" data-act="aCancel">Отмена</button></div></section>';
  return h;
}
function addRecipeAlias(id,name){
  var r=S.recipes[id];if(!r)return;
  var k=normKey(name);if(!k||k===normKey(r.name))return;
  if(!r.aliases)r.aliases=[];
  if(r.aliases.indexOf(k)<0&&r.aliases.length<20)r.aliases.push(k);
}
function doSalesApply(){
  var t=S.sales;if(!t)return;
  var g=curRegion(),per={},changed={},n=0;
  t.items.forEach(function(x){if(x.qty===null||!x.rec||!S.recipes[x.rec])return;per[x.rec]=(per[x.rec]||0)+x.qty;});
  if(t.clear)visIds().forEach(function(id){
    var r=S.recipes[id];
    if(r.qty&&r.qty[g]&&!per[id]){delete r.qty[g];if(!Object.keys(r.qty).length)delete r.qty;changed[id]=1;}
  });
  Object.keys(per).forEach(function(id){
    var r=S.recipes[id];if(!r.qty)r.qty={};
    r.qty[g]=Math.round(per[id]*1000)/1000;changed[id]=1;n++;
  });
  t.items.forEach(function(x){
    if(x.qty!==null&&x.rec&&S.recipes[x.rec]&&x.remember&&x.how!=='alias'&&x.how!=='exact'){addRecipeAlias(x.rec,x.name);changed[x.rec]=1;}
  });
  Object.keys(changed).forEach(function(id){queueSave('recipes',id);});
  S.sales=null;S.aPaste=undefined;renderAll();
  flash('Продажи загружены в «'+regionName(g)+'»: '+n+' '+plural(n,['блюдо','блюда','блюд']));
}
function doSalesClear(){
  var g=curRegion(),n=0;
  visIds().forEach(function(id){
    var r=S.recipes[id];
    if(r.qty&&r.qty[g]){delete r.qty[g];if(!Object.keys(r.qty).length)delete r.qty;queueSave('recipes',id);n++;}
  });
  S.aPaste=undefined;renderAll();
  flash('Продажи региона «'+regionName(g)+'» очищены: '+n+' '+plural(n,['блюдо','блюда','блюд']));
}

