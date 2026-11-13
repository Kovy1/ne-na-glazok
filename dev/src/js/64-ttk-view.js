/* ----- просмотр ТТК в окне: те же данные, что и в карте (ttkModel), пересчёт закладки на число порций без изменения рецептуры ----- */
var TV={id:'',n:1,opener:null,key:null};
function tvQty(v,n){
  if(v===null||v===undefined||!isFinite(v))return'—';
  var x=v*n;
  return x>=1000?dnum(x/1000,3)+' кг':dnum(x,1)+' г';
}
/* только то, что записано в карте: шаблонные тексты и организация по умолчанию в просмотре не показываются */
function tvOwn(r,k){var t=r.ttk;return(t&&Object.prototype.hasOwnProperty.call(t,k)&&String(t[k]==null?'':t[k]).trim())?String(t[k]):'';}
function tvTextHtml(title,t){
  var s=String(t==null?'':t).trim();
  if(!s)return'';
  return'<section class="tvsec"><h3>'+esc(title)+'</h3>'+s.split(/\r?\n/).map(function(l){
    l=l.replace(/^[\u0001\u0002]/,'');l=l.trim();return l?'<p>'+esc(l)+'</p>':'';
  }).join('')+'</section>';
}
function tvSubText(r){
  var m=ttkModel(r);
  return(m.num==='__'?'ТТК, номер не указан':'ТТК №'+esc(m.num))+(m.portion?' · порция '+esc(m.portion):'')+(tvOwn(r,'date')?' · утверждена '+esc(tvOwn(r,'date')):'')+(tvOwn(r,'org')?' · '+esc(tvOwn(r,'org')):'');
}
function tvSumHtml(r,n){
  var o=r.output>0;
  return'<div class="tvc"><span class="tvl">Выход порции</span><b class="tvbig">'+(o?dnum(r.output,2)+' г':'не указан')+'</b></div>'
    +'<div class="tvc tvcnt"><span class="tvl" id="tvNl">Порций</span><div class="tvstep" role="group" aria-labelledby="tvNl"><button type="button" class="btn tvpm" data-tv="dec" aria-label="Меньше порций">−</button>'
    +'<input id="tvN" class="num" inputmode="numeric" value="'+n+'" autocomplete="off" aria-label="Число порций"><button type="button" class="btn tvpm" data-tv="inc" aria-label="Больше порций">+</button></div>'
    +'<div class="tvq">'+[1,10,50,100].map(function(k){return'<button type="button" class="tvchip" data-tv="set" data-n="'+k+'" aria-pressed="'+(k===n)+'">'+k+'</button>';}).join('')+'</div></div>'
    +'<div class="tvc"><span class="tvl">Общий выход, '+n+' порц.</span><b class="tvbig">'+(o?tvQty(r.output,n):'—')+'</b></div>';
}
function tvBodyHtml(r,n){
  var m=ttkModel(r),c=compute(r,S.ings),v=m.vii,inc=!!(c.missing||c.unassigned||(c.unk&&c.unk.length)),h='';
  var rows=m.items.filter(function(x){return x.t!=='sum'||x.mass>0;});
  h+='<div class="tvtab" role="region" aria-label="Состав"><table><thead><tr><th>Сырьё</th><th class="num">Брутто'+(n!==1?', на '+n:'')+'</th><th class="num">Нетто'+(n!==1?', на '+n:'')+'</th></tr></thead><tbody>'
    +rows.map(function(x){
      if(x.t==='hdr')return'<tr class="tvh"><td colspan="3">'+esc(x.name)+'</td></tr>';
      if(x.t==='sum')return'<tr class="tvs"><td>'+esc(x.name||'Итого')+'</td><td></td><td class="num">'+tvQty(x.mass,n)+'</td></tr>';
      return'<tr'+(x.t==='alt'?' class="tva"':'')+'><td>'+esc(x.name)+'</td><td class="num">'+tvQty(x.gross,n)+'</td><td class="num">'+tvQty(x.net,n)+'</td></tr>';
    }).join('')+'</tbody></table></div>';
  if(n!==1)h+='<p class="hint">Пересчёт только для просмотра: рецептура в карте не меняется. Закладка округляется до 0,1 г.</p>';
  var t42=ttkTech(r,tvOwn(r,'t42')).trim();
  h+=tvTextHtml('Предварительная подготовка',tvOwn(r,'t41'))+tvTextHtml('Технология приготовления',t42)
    +tvTextHtml('Оформление и подача',tvOwn(r,'s51'))+tvTextHtml('Температура подачи',tvOwn(r,'s52'))+tvTextHtml('Срок хранения',tvOwn(r,'s54'));
  if(!t42&&!tvOwn(r,'t41'))h+='<p class="hint">Технология в карте не заполнена.</p>';
  var org=[['Внешний вид',tvOwn(r,'look')],['Цвет',tvOwn(r,'color')],['Консистенция',tvOwn(r,'texture')],['Вкус и запах',tvOwn(r,'taste')]].filter(function(x){return String(x[1]||'').trim();});
  if(org.length)h+='<section class="tvsec"><h3>Органолептика</h3>'+org.map(function(x){return'<p><b>'+esc(x[0])+':</b> '+esc(x[1])+'</p>';}).join('')+'</section>';
  h+='<section class="tvsec"><h3>Пищевая ценность</h3>'+(v&&[v.p,v.f,v.c,v.kcal].every(function(x){return x!==null&&x!==undefined&&isFinite(x);})
    ?'<p>'+esc(v.label)+' Белки '+fmt(v.p,1)+' г · жиры '+fmt(v.f,1)+' г · углеводы '+fmt(v.c,1)+' г · '+fmt(v.kcal,1)+' ккал <span class="muted">('+esc(v.from)+')</span></p>':'<p>КБЖУ не рассчитано.</p>')
    +(inc?'<p class="hint cmsg warn">Расчёт неполный: у части сырья нет данных КБЖУ или сырья из базы. Значения занижены.</p>':'')+'</section>';
  return h;
}
function tvPrintHtml(r,n){
  var css='body{font:13px/1.45 Arial,sans-serif;color:#111;margin:18px}h1{font-size:18px;margin:0 0 4px}h3{font-size:14px;margin:14px 0 4px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #888;padding:3px 6px;text-align:left}.num{text-align:right}.tvh td{font-weight:bold;background:#eee}.tvs td{font-weight:bold}.hint,.muted{color:#555}';
  return'<!doctype html><html><head><meta charset="utf-8"><title>'+esc(recBase(r))+'</title><style>'+css+'</style></head><body><h1>'+esc(recBase(r))+'</h1><p>'+tvSubText(r)+'</p><p>Выход порции: <b>'+(r.output>0?dnum(r.output,2)+' г':'не указан')+'</b>'+(r.output>0&&n!==1?' · На '+n+' порц.: <b>'+tvQty(r.output,n)+'</b>':'')+'</p>'+tvBodyHtml(r,n)+'</body></html>';
}
function tvPrint(){
  var r=S.recipes[TV.id];if(!r)return;
  var f=document.createElement('iframe');
  f.setAttribute('aria-hidden','true');f.style.cssText='position:fixed;right:0;bottom:0;width:0;height:0;border:0';
  document.body.appendChild(f);
  var d=f.contentWindow.document;d.open();d.write(tvPrintHtml(r,TV.n));d.close();
  setTimeout(function(){try{f.contentWindow.focus();f.contentWindow.print();}catch(e){flash('Не удалось открыть печать');}setTimeout(function(){if(f.parentNode)f.parentNode.removeChild(f);},2000);},150);
}
function tvRender(){
  var box=document.getElementById('ttkViewBox'),r=S.recipes[TV.id];
  if(!box||!r){tvClose();return;}
  var body=box.querySelector('.tvbody'),top=body.scrollTop,sum=box.querySelector('#tvSum'),ae=document.activeElement,keep=(ae&&sum.contains(ae)&&ae.id==='tvN')?ae.selectionStart:-1;
  var inp=sum.querySelector('#tvN');
  if(inp&&ae===inp){/* пока печатают: меняем только остальное */
    sum.querySelectorAll('.tvbig')[1].textContent=r.output>0?tvQty(r.output,TV.n):'—';
    sum.querySelector('.tvc:last-child .tvl').textContent='Общий выход, '+TV.n+' порц.';
    sum.querySelectorAll('.tvchip').forEach(function(c){c.setAttribute('aria-pressed',String(Number(c.getAttribute('data-n'))===TV.n));});
  }else sum.innerHTML=tvSumHtml(r,TV.n);
  body.innerHTML=tvBodyHtml(r,TV.n);body.scrollTop=top;
}
function tvOpen(id,opener){
  var r=S.recipes[id];
  if(!r)return;
  tvClose(true);
  TV.id=id;TV.n=1;TV.opener=opener||document.activeElement;
  var ov=document.createElement('div');
  ov.id='ttkView';ov.className='tvover';
  var dl=(!syChef()&&canDl())?'<button class="btn primary" data-tv="dl">Скачать .docx</button>':(syChef()?'<button class="btn primary" data-tv="cloud">Файл в облаке</button>':'');
  ov.innerHTML='<div class="tvbox" id="ttkViewBox" role="dialog" aria-modal="true" aria-labelledby="tvTitle">'
    +'<div class="tvbar"><div class="tvtt"><h2 id="tvTitle">'+esc(recBase(r))+'</h2><p class="tvsub">'+tvSubText(r)+'</p></div><button class="btn mini tvx" data-tv="close" aria-label="Закрыть">✕</button></div>'
    +'<div class="tvsum" id="tvSum"></div>'
    +'<div class="tvbody" tabindex="0"></div>'
    +'<div class="tvfoot"><button class="btn" data-tv="print">Печать</button>'+dl+'</div></div>';
  document.body.appendChild(ov);
  document.body.classList.add('tvlock');
  tvRender();
  ov.addEventListener('click',function(e){
    var t=e.target;
    if(t===ov){tvClose();return;}
    var a=t.closest&&t.closest('[data-tv]');if(!a)return;
    var k=a.getAttribute('data-tv');
    if(k==='close')tvClose();
    else if(k==='print')tvPrint();
    else if(k==='dl'){try{var rr=S.recipes[TV.id];if(rr)doDownloadTtk(rr);}catch(er){flash('Не удалось собрать документ');}}
    else if(k==='cloud'){var cid=TV.id;tvClose();chefOpenTtk(cid);}
    else if(k==='dec'||k==='inc'||k==='set'){TV.n=Math.max(1,Math.min(9999,k==='set'?Number(a.getAttribute('data-n')):TV.n+(k==='inc'?1:-1)));tvRender();var ni=ov.querySelector('#tvN');if(ni&&k!=='set')ni.focus();}
  });
  ov.addEventListener('input',function(e){
    if(e.target.id!=='tvN')return;
    var v=parseInt(String(e.target.value).replace(/\D/g,''),10);
    TV.n=(v>=1&&v<=9999)?v:1;tvRender();
  });
  TV.key=function(e){
    if(e.key==='Escape'){e.preventDefault();tvClose();return;}
    if(e.key!=='Tab')return;
    var els=[].slice.call(ov.querySelectorAll('button,input,[tabindex="0"]')).filter(function(x){return!x.disabled&&x.offsetParent!==null;});
    if(!els.length)return;
    var f=els[0],l=els[els.length-1];
    if(e.shiftKey&&document.activeElement===f){e.preventDefault();l.focus();}
    else if(!e.shiftKey&&document.activeElement===l){e.preventDefault();f.focus();}
    else if(!ov.contains(document.activeElement)){e.preventDefault();f.focus();}
  };
  document.addEventListener('keydown',TV.key,true);
  var first=ov.querySelector('[data-tv="close"]');if(first)first.focus();
}
function tvClose(quiet){
  var ov=document.getElementById('ttkView');
  if(TV.key){document.removeEventListener('keydown',TV.key,true);TV.key=null;}
  if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
  document.body.classList.remove('tvlock');
  var op=TV.opener;TV.opener=null;TV.id='';
  if(!quiet&&op&&op.focus&&document.body.contains(op))try{op.focus();}catch(e){}
}
