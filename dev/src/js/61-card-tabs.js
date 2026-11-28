/* ---------- карта блюда: шапка, вкладки «Карта · Калькуляция · КБЖУ и сверка», калькуляция на 1 / 100 блюд ---------- */
/* значки 15 px, обводка 1.8, цвет текста */
var IC=(function(){
  function s(d){return'<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'+d+'</svg>';}
  return{
    back:s('<path d="M15 6l-6 6 6 6"/>'),
    eye:s('<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>'),
    dl:s('<path d="M12 4v11"/><path d="M7 10l5 5 5-5"/><path d="M5 20h14"/>'),
    up:s('<path d="M12 20V9"/><path d="M7 14l5-5 5 5"/><path d="M5 4h14"/>'),
    doc:s('<path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5"/><path d="M10 13h6M10 17h6"/>'),
    calc:s('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h2M12 11h2M16 11h0M8 15h2M12 15h2M8 18h2M12 18h4"/>'),
    leaf:s('<path d="M5 19c0-8 5-14 14-14 0 9-6 14-14 14z"/><path d="M5 19l8-8"/>'),
    plus:s('<path d="M12 5v14M5 12h14"/>'),
    more:s('<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>'),
    box:s('<path d="M4 8l8-4 8 4v8l-8 4-8-4z"/><path d="M4 8l8 4 8-4M12 12v8"/>'),
    vis:s('<path d="M3 12s3.3-6 9-6 9 6 9 6-3.3 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.4"/>'),
    search:s('<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>'),
    warn:s('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>'),
    chart:s('<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>'),
    arrow:s('<path d="M5 12h14M13 6l6 6-6 6"/>')
  };
})();
var CARD_TABS=[['card','Карта','doc'],['calc','Калькуляция','calc'],['kbzhu','КБЖУ и сверка','leaf']];
function cardTab(){var t=S.cardTab;if(NOPRICE&&t==='calc')t='card';return t==='calc'||t==='kbzhu'?t:'card';}
function cardTabsHtml(ct){
  return'<div class="ctabs" role="tablist" aria-label="Разделы карты">'+CARD_TABS.filter(function(t){return!(NOPRICE&&t[0]==='calc');}).map(function(t){
    return'<button class="ctab" role="tab" data-act="cardTab" data-t="'+t[0]+'" aria-selected="'+(t[0]===ct)+'" aria-pressed="'+(t[0]===ct)+'">'+IC[t[2]]+t[1]+'</button>';}).join('')+'</div>';
}
/* деньги одной порции в текущем регионе */
function cardMoney(r){
  var g=curRegion(),c=costOf(r,S.ings,100,g),cost=c.rows.length?c.sum/100:null,sell=sellEff(r,g)||null;
  var o={c:c,cost:cost,sell:sell,ok:c.complete,mk:null,mg:null,inc:null,fc:null};
  if(cost>0&&sell>0){o.mk=(sell-cost)/cost*100;o.mg=(sell-cost)/sell*100;o.inc=sell-cost;o.fc=cost/sell*100;}
  return o;
}
function cardHeadHtml(r){
  var num=ttkVal(r,'num'),m=NOPRICE?null:cardMoney(r),bits=[];
  if(num)bits.push('ТТК №'+esc(num));
  if(r.output>0)bits.push('выход '+fmt(r.output,r.output%1?1:0)+' г');
  if(m&&m.cost!==null)bits.push('себестоимость <b class="num">'+money(m.cost)+' ₽</b>'+(m.ok?'':' <span class="muted">(неполная)</span>'));
  if(m&&m.sell)bits.push('цена <b class="num">'+money(m.sell)+' ₽</b>');
  if(m&&m.mg!==null)bits.push('маржа <b class="num">'+fmt(m.mg,1)+' %</b>');
  return'<div class="chead"><p class="kicker">ТТК и калькуляции'+(regionList().length>1?' · '+esc(regionName(curRegion())):'')+'</p><h1 class="ctitle">'+esc(recLabel(r))+'</h1>'
    +(bits.length?'<p class="cmeta">'+bits.join(' · ')+'</p>':'')+'</div>';
}
/* вкладка «Калькуляция»: сырьё по брутто и цене региона, сводка денег, структура себестоимости; ниже — реквизиты и скачивание ОП-1 */
var CALC_STRUCT=['#456F8D','#6E95B1','#9DB5C8','#C9D7E2','#B9A29C'];
function calcTabHtml(r){
  var m=cardMoney(r),c=m.c,n=S.calcN===100?100:1,g=curRegion();
  var h='<div class="calcgrid"><section class="card calctbl"><div class="ch2"><h2>Сырьё на '+(n===1?'1 блюдо':'100 блюд')+'</h2>'
    +'<div class="seg" role="group" aria-label="Количество блюд"><button data-act="calcN" data-n="1" aria-pressed="'+(n===1)+'">1 блюдо</button><button data-act="calcN" data-n="100" aria-pressed="'+(n===100)+'">100 блюд</button></div></div>';
  if(!c.rows.length)h+='<p class="muted">В рецептуре пока нет сырья: добавьте его на вкладке «Карта».</p>';
  else{
    h+='<table class="wtbl ctbl"><thead><tr><th>№</th><th>Сырьё</th><th class="r">Брутто, '+(n===1?'г':'кг')+'</th><th class="r">Цена, ₽/кг</th><th class="r">Сумма, ₽</th></tr></thead><tbody>'
      +c.rows.map(function(x,i){
        var q=n===1?dnum(x.gross,1):kgNum(x.gross*100/1000),sm=x.sum===null?'—':money(n===1?x.sum/100:x.sum);
        return'<tr'+(x.price===null?' class="nop"':'')+'><td class="r">'+(i+1)+'</td><td>'+esc(x.name||'—')+'</td><td class="r">'+q+'</td><td class="r">'+(x.price===null?'<span class="muted">нет цены</span>':money(x.price))+'</td><td class="r">'+sm+'</td></tr>';
      }).join('')
      +'</tbody><tfoot><tr><td></td><td>Итого'+(m.ok?'':' <span class="muted">(неполная: есть сырьё без цены)</span>')+'</td><td></td><td></td><td class="r"><b>'+money(n===1?c.sum/100:c.sum)+'</b></td></tr></tfoot></table>';
  }
  h+='<p class="hint">Цены региона «'+esc(regionName(g))+'». Сумма считается по брутто и цене за килограмм из «Сырьё и КБЖУ».</p></section>';
  /* сводка */
  var k=n,sum=function(v){return v===null?'—':money(v*k)+' ₽';};
  h+='<section class="card calcsum"><p class="kicker">Себестоимость '+(n===1?'порции':'100 блюд')+'</p><p class="bignum">'+(m.cost===null?'—':money(m.cost*n))+'<span> ₽</span></p>'
    +'<dl class="kv2">'
    +'<div><dt>Цена продажи</dt><dd>'+sum(m.sell)+'</dd></div>'
    +'<div><dt>Наценка</dt><dd>'+(m.mk===null?'—':fmt(m.mk,1)+' %')+'</dd></div>'
    +'<div><dt>Маржа</dt><dd>'+(m.mg===null?'—':fmt(m.mg,1)+' %')+'</dd></div>'
    +'<div><dt>Доход после сырья</dt><dd>'+sum(m.inc)+'</dd></div>'
    +'<div><dt>Сырьё в цене (фудкост)</dt><dd>'+(m.fc===null?'—':fmt(m.fc,1)+' %')+'</dd></div>'
    +(n===1&&m.cost!==null?'<div><dt>Сырьё на 100 блюд</dt><dd>'+money(c.sum)+' ₽</dd></div>':'')
    +'</dl>'+(m.sell?'':'<p class="hint">Цену продажи вводят в «Меню и цены».</p>');
  /* структура себестоимости: крупнейшие позиции и остальное */
  var parts=c.rows.filter(function(x){return x.sum>0;}).map(function(x){return{n:x.name||'—',v:x.sum};}).sort(function(a,b){return b.v-a.v;});
  if(parts.length&&c.sum>0){
    var top=parts.slice(0,4),rest=parts.slice(4).reduce(function(a,x){return a+x.v;},0);
    if(rest>0)top.push({n:'Остальное',v:rest});
    h+='<p class="kicker" style="margin-top:16px">Структура себестоимости</p><div class="sbar" role="img" aria-label="Структура себестоимости">'
      +top.map(function(x,i){return'<span style="flex:'+x.v+';background:'+CALC_STRUCT[i]+'" title="'+esc(x.n)+': '+fmt(x.v/c.sum*100,0)+' %"></span>';}).join('')+'</div>'
      +'<ul class="slegend">'+top.map(function(x,i){return'<li><i style="background:'+CALC_STRUCT[i]+'"></i><span>'+esc(x.n)+'</span><b class="num">'+fmt(x.v/c.sum*100,0)+' %</b></li>';}).join('')+'</ul>';
  }
  h+='</section></div>';
  h+='<h2 class="secttl">Калькуляционная карточка ОП-1</h2>'+op1Cards(r,opModel(r));
  return h;
}
function cardClick(act,b){
  switch(act){
    case'cardTab':S.cardTab=b.getAttribute('data-t');renderAll();return true;
    case'calcN':S.calcN=Number(b.getAttribute('data-n'))===100?100:1;renderAll();return true;
    case'mCalc':case'mKbzhu':var id=b.closest('[data-rid]').getAttribute('data-rid');if(S.recipes[id]){S.cardTab=act==='mCalc'?'calc':'kbzhu';mOpenCard(id);}return true;
    case'jump':var to=b.getAttribute('data-to');if((to==='secKbzhu'||to==='secCalc')&&cardTab()!=='kbzhu'){S.cardTab='kbzhu';renderAll();}return false;
  }
  return false;
}
/* «⋯» в строке меню: открыт один, клик мимо закрывает */
document.addEventListener('click',function(e){
  var own=e.target&&e.target.closest?e.target.closest('details.mmore'):null;
  Array.prototype.forEach.call(document.querySelectorAll('details.mmore[open]'),function(d){if(d!==own)d.removeAttribute('open');});
},true);
document.addEventListener('keydown',function(e){if(e.key==='Escape')Array.prototype.forEach.call(document.querySelectorAll('details.mmore[open]'),function(d){d.removeAttribute('open');var s=d.querySelector('summary');if(s)s.focus();});});
