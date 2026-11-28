/* ----- «Обзор»: показатели и графики только из данных приложения; нет данных — так и сказано ----- */
var HM_COL=['#5E8B7E','#A7C7E7','#EBAEB7','#8FB3A8','#C9DDF0','#F3CDD3'];
function hmData(){
  var g=curRegion(),f=curAbc(),ids=abIds(),fin=NOPRICE?null:abcDishes(abMap(g),S.ings,g,'rev',f.a,f.b),h={g:g,n:ids.length,noOut:0,incomplete:0,noPrice:0,noKbzhu:0,fin:fin};
  ids.forEach(function(id){
    var r=S.recipes[id];
    if(!(r.output>0))h.noOut++;
    if(!calcReady(r))h.noKbzhu++;
    if(!NOPRICE){var m=finOf(r);if(!m.complete)h.incomplete++;if(m.price===null)h.noPrice++;}
  });
  if(fin){
    var rv=0,co=0,nc=0,by={};
    fin.rows.forEach(function(x){
      var r=S.recipes[x.id],c=catOf(r),k=c?c.name:'Без папки';
      by[k]=(by[k]||0)+x.rev;
      if(x.profit!==null&&x.rev>0){rv+=x.rev;co+=x.rev-x.profit;nc++;}
    });
    h.fcRev=rv;h.fcCost=co;h.fcN=nc;
    h.fc=rv>0?co/rv*100:null;
    h.by=Object.keys(by).map(function(k){return{name:k,v:by[k]};}).sort(function(a,b){return b.v-a.v;});
  }
  return h;
}
function hmRub(v){return fmt(Math.round(v),0)+' ₽';}
function hmKpi(label,val,sub,tone,ico){
  return'<div class="hmk '+(tone||'')+'"><span class="hmi" aria-hidden="true">'+ico+'</span><div><div class="hml">'+esc(label)+'</div><div class="hmv">'+val+'</div>'+(sub?'<div class="hms" title="'+sub.replace(/<[^>]*>/g,'').replace(/"/g,'&quot;')+'">'+sub+'</div>':'')+'</div></div>';
}
function hmSvg(d){return'<svg viewBox="0 0 24 24" focusable="false">'+d+'</svg>';}
var HM_IC={rub:hmSvg('<path d="M5 20V11M12 20V4M19 20v-6"/>'),pct:hmSvg('<circle cx="12" cy="12" r="8.5"/><path d="M9 15l6-6"/><circle cx="9.3" cy="9.3" r=".9"/><circle cx="14.7" cy="14.7" r=".9"/>'),warn:hmSvg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.4"/>'),chk:hmSvg('<circle cx="12" cy="12" r="8.5"/><path d="M8 12.3l2.8 2.8L16 9.5"/>'),doc:hmSvg('<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>')};
function hmNoData(txt,btn){return'<div class="hmnd"><b>Нет данных</b><span>'+txt+'</span>'+(btn||'')+'</div>';}
function hmDonut(rows,total){
  var R=52,C=2*Math.PI*R,off=0,seg='';
  rows.forEach(function(x,i){
    var len=x.v/total*C;
    seg+='<circle cx="70" cy="70" r="'+R+'" fill="none" stroke="'+HM_COL[i%HM_COL.length]+'" stroke-width="22" stroke-dasharray="'+len.toFixed(2)+' '+(C-len).toFixed(2)+'" stroke-dashoffset="'+(-off).toFixed(2)+'" transform="rotate(-90 70 70)"/>';
    off+=len;
  });
  return'<svg viewBox="0 0 140 140" class="hmdon" role="img" aria-label="Состав выручки по папкам меню">'+seg+'<text x="70" y="68" text-anchor="middle" class="hmdt">'+esc(hmRub(total))+'</text><text x="70" y="83" text-anchor="middle" class="hmds">выручка</text></svg>';
}
function hmComposition(h){
  var d=h.fin,rows,total=0,rest=0,hd='<div class="hmch"><h3>Состав продаж</h3></div>';
  if(!d||!d.tot.nRev)return hd+'<div class="hmcb">'+hmNoData('Нет продаж с ценой. Введите продажи за период на вкладке «ABC-анализ».','<button class="btn mini" data-act="hmGo" data-t="abc">Открыть ABC-анализ</button>')+'</div>';
  rows=h.by.slice(0,5);h.by.slice(5).forEach(function(x){rest+=x.v;});
  if(rest>0)rows.push({name:'Остальное',v:rest});
  rows.forEach(function(x){total+=x.v;});
  return hd+'<div class="hmcb"><div class="hmdw">'+hmDonut(rows,total)+'<ul class="hmlg">'+rows.map(function(x,i){return'<li><i style="background:'+HM_COL[i%HM_COL.length]+'"></i><span><b>'+esc(x.name)+' — '+fmt(x.v/total*100,0)+' %</b><small>'+esc(money(x.v))+' ₽</small></span></li>';}).join('')+'</ul></div></div>'
    +'<details class="hmtbl hmcf"><summary>Таблица</summary><table><thead><tr><th>Папка меню</th><th class="num">Выручка, ₽</th><th class="num">Доля, %</th></tr></thead><tbody>'
    +rows.map(function(x){return'<tr><td>'+esc(x.name)+'</td><td class="num">'+esc(money(x.v))+'</td><td class="num">'+fmt(x.v/total*100,1)+'</td></tr>';}).join('')+'</tbody></table></details>';
}
function hmAbc(h){
  var d=h.fin,rows,mx=0,cf=curAbc(),W=700,H=130,X0=62,TOP=12,n,hd='<div class="hmch"><h3>ABC-анализ меню</h3></div>';
  if(!d||!d.rows.length)return hd+'<div class="hmcb">'+hmNoData('ABC считается по выручке блюд: нужны продажи и цена продажи.','<button class="btn mini" data-act="hmGo" data-t="abc">Открыть ABC-анализ</button>')+'</div>';
  rows=d.rows.slice(0,14);rows.forEach(function(x){if(x.v>mx)mx=x.v;});n=rows.length;
  var slot=(W-X0)/n,bw=Math.min(56,Math.floor(slot*.72)),grid='',k;
  for(k=0;k<=3;k++){var gy=TOP+H-Math.round(H*k/3);grid+='<line class="hmgrid-l" x1="'+X0+'" x2="'+W+'" y1="'+gy+'" y2="'+gy+'"/><text x="'+(X0-8)+'" y="'+(gy+4)+'" text-anchor="end" class="hmax">'+esc(fmt(Math.round(mx*k/3),0))+'</text>';}
  var svg='<svg viewBox="0 0 '+W+' '+(H+TOP+24)+'" class="hmbar" role="img" aria-label="Выручка блюд по классам ABC, ₽">'+grid+rows.map(function(x,i){
    var bh=Math.max(2,Math.round(x.v/mx*H)),cl=x.cls||x.class||x.abc||'C',col=cl==='A'?HM_COL[0]:(cl==='B'?HM_COL[1]:HM_COL[2]),bx=Math.round(X0+i*slot+(slot-bw)/2);
    return'<rect x="'+bx+'" y="'+(TOP+H-bh)+'" width="'+bw+'" height="'+bh+'" rx="6" fill="'+col+'"/><text x="'+(bx+bw/2)+'" y="'+(TOP+H+18)+'" text-anchor="middle" class="hmax">'+esc(cl)+'</text>';
  }).join('')+'</svg>';
  var leg='<div class="hmleg3"><span><i style="background:'+HM_COL[0]+'"></i>A — '+d.counts.A+' '+plural(d.counts.A,['позиция','позиции','позиций'])+' ('+fmt(d.shares.A,0)+' %)</span><span><i style="background:'+HM_COL[1]+'"></i>B — '+d.counts.B+' ('+fmt(d.shares.B,0)+' %)</span><span><i style="background:'+HM_COL[2]+'"></i>C — '+d.counts.C+' ('+fmt(d.shares.C,0)+' %)</span></div>';
  return hd.replace('</div>',leg+'</div>')+'<div class="hmcb">'+svg+'</div>'
    +'<details class="hmtbl hmcf"><summary>Таблица и метод</summary><p class="hint">Классификация по выручке, ₽ за период. Границы классов: A до '+fmt(cf.a,0)+' %, B до '+fmt(cf.b,0)+' % накопленной доли. На графике '+n+' блюд с наибольшей выручкой.</p><table><thead><tr><th>Блюдо</th><th>Класс</th><th class="num">Выручка, ₽</th></tr></thead><tbody>'
    +d.rows.slice(0,30).map(function(x){return'<tr><td>'+esc(x.name)+'</td><td>'+esc(x.cls||x.class||x.abc||'')+'</td><td class="num">'+esc(fmt(Math.round(x.v),0))+'</td></tr>';}).join('')+'</tbody></table></details>';
}
/* главная по роли: рабочие очереди из подключённой базы (черновики, возвраты, проверка); без подключения блока нет, чисел «для вида» нет */
function hmRoleKey(){return(S.mode==='local'&&syLinked())?S.sy.cfg.role:'';}
function hmFin(){return!NOPRICE&&hmRoleKey()!=='viewer';}
function hmTile(n,label,go,seg,hint){
  var on=n>0&&go;
  return'<li class="hmtask'+(n>0?' has':'')+'"><b>'+n+'</b><span>'+esc(label)+(hint?'<small>'+esc(hint)+'</small>':'')+'</span>'
    +(on?'<button class="btn mini" data-act="hmGo" data-t="'+go+'"'+(seg?' data-s="'+seg+'"':'')+'>Открыть</button>':'<i class="hmz" aria-hidden="true">'+(n>0?'':'✓')+'</i>')+'</li>';
}
function hmRole(h){
  var r=hmRoleKey(),t=[],title='',sub='',d,sent,drafts,rv,rj,pend,rw;
  if(!r)return'';
  if(r==='editor'||r==='finance'){
    try{d=syDirtyUi();}catch(e){d=[];}
    sent=d.filter(function(x){return syIsSent(x);}).length;drafts=d.length-sent;
    rv=(S.sy.inbox||[]).length;rj=(S.sy.inboxR||[]).length;
    title=r==='editor'?'Мои ТТК':'Мои задачи';
    sub=r==='editor'?'Черновики, возвраты и ответы технолога':'Цены и правки по вашей точке; решение за технологом';
    t.push(hmTile(drafts,'Черновики: не отправлены на проверку','sync','tasks'));
    t.push(hmTile(sent,'Отправлено, ждёт решения технолога','sync','review'));
    t.push(hmTile(rv,'Вернули на доработку','sync','tasks'));
    t.push(hmTile(rj,'Отклонено технологом','sync','tasks'));
  }else if(r==='admin'){
    pend=S.sy.info&&S.sy.info.pending||0;rw=(S.sy.rework||[]).length;
    title='Согласование';sub='Очередь проверки и возвраты авторам';
    t.push(hmTile(pend,'Ждут проверки','sync','review'));
    t.push(hmTile(rw,'На доработке у авторов','sync','tasks'));
    t.push(hmTile(h.noOut+h.noKbzhu,'Качество данных: нет выхода или КБЖУ не рассчитано','menu','','список ниже'));
  }else if(r==='viewer'){
    title='Меню и ТТК';sub='Утверждённые карты вашей точки; только просмотр';
    t.push(hmTile(h.n,'ТТК в меню региона «'+regionName(h.g)+'»','menu',''));
    t.push(hmTile(h.n-h.noKbzhu,'Рассчитаны полностью','menu',''));
    t.push(hmTile(h.noKbzhu,'КБЖУ рассчитано не полностью','menu',''));
  }
  if(!t.length)return'';
  return'<section class="card hmc hmrole" aria-label="'+esc(title)+'"><div class="hmch"><h3>'+esc(title)+'</h3><span class="hmsub">'+esc(sub)+'</span></div><ul class="hmtasks">'+t.join('')+'</ul></section>';
}
function hmAttention(h){
  var l=[];
  function row(n,txt,act,f,label){if(n>0)l.push('<li><span>'+esc(txt)+'</span><button class="btn mini" data-act="'+act+'"'+(f?' data-f="'+f+'"':'')+'>'+n+' · '+esc(label)+'</button></li>');}
  row(h.noOut,'ТТК без выхода порции','hmGo','','Открыть меню');
  /* неполная себестоимость и цены продажи — в «Где теряются деньги» */
  row(h.noKbzhu,'КБЖУ не рассчитано полностью','hmGo','','Открыть меню');
  if(syAdmin()&&syLinked()&&S.sy.info&&S.sy.info.pending)l.push('<li><span>Ждут проверки технолога</span><button class="btn mini" data-act="hmGo" data-t="sync">'+S.sy.info.pending+' · Открыть</button></li>');
  if(syInboxOn()&&S.sy.inbox&&S.sy.inbox.length)l.push('<li><span>Возвращено на доработку</span><button class="btn mini" data-act="hmGo" data-t="sync">'+S.sy.inbox.length+' · Открыть</button></li>');
  return l.length?'<ul class="hmatt">'+l.join('')+'</ul>':'<p class="hmok">✓ Замечаний к данным нет.</p>';
}
/* деньги меню: средняя маржа и фудкост по блюдам с ценой и полной себестоимостью; потери на цене — до цены по цели (если цель задана) */
function hmMoney(h){
  var items=menuItems(),ok=[],f=curFin(),qty={},loss=[],lossSum=0,perPort=0,np=0,inc=0;
  if(h.fin)h.fin.rows.concat(h.fin.skipped||[]).forEach(function(x){if(x.qty>0)qty[x.id]=x.qty;});
  items.forEach(function(it){
    var m=it.m;if(m.price===null)np++;if(!m.complete)inc++;
    if(m.price===null||m.cost===null||!m.complete)return;
    ok.push(it);
    if(f.target!==null&&belowTarget(m)){
      var t=f.target/100,pt=f.mode==='margin'?(t<1?m.cost/(1-t):null):m.cost*(1+t);
      if(pt!==null&&pt>m.price){var gap=pt-m.price,q=qty[it.id]||0;loss.push({it:it,gap:gap,q:q,sum:gap*q,pt:pt});perPort+=gap;lossSum+=gap*q;}
    }
  });
  function avg(k){return ok.length?ok.reduce(function(a,x){return a+x.m[k];},0)/ok.length:null;}
  loss.sort(function(a,b){return(b.sum-a.sum)||(b.gap-a.gap);});
  var low=ok.slice().sort(function(a,b){return a.m.margin-b.m.margin;}).slice(0,5);
  return{items:items,ok:ok,mg:avg('margin'),fc:avg('fc'),f:f,loss:loss,lossSum:lossSum,perPort:perPort,hasQty:Object.keys(qty).length>0,low:low,np:np,inc:inc};
}
function hmMTile(label,ico,val,sub,tone){
  return'<div class="hmt'+(tone?' '+tone:'')+'"><div class="hmtl">'+ico+'<span>'+esc(label)+'</span></div><div class="hmtv">'+val+'</div><div class="hmts">'+sub+'</div></div>';
}
function hmScale(pct,label){
  var p=Math.max(0,Math.min(100,pct)),ticks='';
  for(var i=1;i<10;i++)ticks+='<i style="left:'+(i*10)+'%"></i>';
  return'<div class="hscale" role="img" aria-label="'+esc(label)+': '+fmt(p,0)+' %"><div class="hsbase">'+ticks+'<span class="hsfill" style="width:'+p+'%"></span><span class="hsmark" style="left:'+p+'%"></span></div><b class="num">'+fmt(p,0)+' %</b></div>';
}
function hmLossHtml(M,h){
  var rows=[],f=M.f;
  if(f.target===null)rows.push({t:'Цель по марже или наценке не задана',s:'Задайте её в «Меню и цены» → «Дополнительные действия»: тогда здесь появятся потери на цене.',v:'',act:'hmGo',d:'data-t="menu"',b:'Открыть меню'});
  else if(M.loss.length)rows.push({t:M.loss.length+' '+plural(M.loss.length,['блюдо','блюда','блюд'])+' ниже цели '+(f.mode==='margin'?'по марже':'по наценке')+' '+fmt(f.target,f.target%1?1:0)+' %',s:'Сколько не хватает до цены по цели'+(M.hasQty?' с учётом продаж за период':' на одну порцию каждого блюда'),v:money(M.hasQty?M.lossSum:M.perPort)+' ₽',act:'hmGo',d:'data-t="menu"',b:'Показать блюда'});
  if(M.inc)rows.push({t:'Себестоимость неполная у '+M.inc+' '+plural(M.inc,['блюда','блюд','блюд']),s:'Нет цены части сырья: себестоимость и маржа этих блюд занижены и не входят в средние.',v:'',act:'hmFilter',d:'data-f="inc"',b:'Показать'});
  if(M.np)rows.push({t:'Нет цены продажи у '+M.np+' '+plural(M.np,['блюда','блюд','блюд']),s:'Без цены нельзя посчитать маржу и фудкост.',v:'',act:'hmFilter',d:'data-f="noprice"',b:'Показать'});
  if(!rows.length)return'<p class="hmok">Потерь на цене не видно: все блюда с ценой не ниже цели, себестоимость полная.</p>';
  return'<ol class="hloss">'+rows.slice(0,3).map(function(x,i){return'<li><span class="hln num">'+('0'+(i+1))+'</span><span class="hlt"><b>'+esc(x.t)+'</b><small>'+esc(x.s)+'</small></span><span class="hlv num">'+x.v+'</span><button class="btn mini" data-act="'+x.act+'" '+x.d+'>'+esc(x.b)+'</button></li>';}).join('')+'</ol>';
}
function hmLowHtml(M){
  if(!M.low.length)return'<p class="muted">Нет блюд с ценой продажи и полной себестоимостью.</p>';
  return'<table class="wtbl hlow"><thead><tr><th>Блюдо</th><th class="r">Себестоимость</th><th class="r">Цена</th><th class="r">Маржа</th><th class="r">Фудкост</th></tr></thead><tbody>'
    +M.low.map(function(it){var m=it.m,b=belowTarget(m);return'<tr data-rid="'+esc(it.id)+'"><td><button type="button" class="tlink hlown" data-act="mCalc">'+esc(it.r.name||'Без названия')+'</button></td><td class="r">'+money(m.cost)+'</td><td class="r">'+money(m.price)+'</td><td class="r'+(b?' hbad':'')+'">'+fmt(m.margin,1)+' %</td><td class="r">'+fmt(m.fc,1)+' %</td></tr>';}).join('')
    +'</tbody></table>';
}
function hmExtraHtml(h){
  var ids=abIds(),kb=h.n-h.noKbzhu,dn=0;
  ids.forEach(function(id){if(dsValid(dsOf(S.recipes[id])))dn++;});
  return'<section class="card hmx"><div class="hmch"><h3>Дополнительно: КБЖУ и декларации</h3><span class="hmsub">на расчёт денег не влияет</span></div>'
    +'<div class="hmxr"><span>КБЖУ рассчитано полностью: <b class="num">'+kb+'</b> из <b class="num">'+h.n+'</b></span>'+hmScale(h.n?kb/h.n*100:0,'КБЖУ рассчитано')+'</div>'
    +'<div class="hmxr"><span>Задекларировано: <b class="num">'+dn+'</b> из <b class="num">'+h.n+'</b></span>'+hmScale(h.n?dn/h.n*100:0,'Задекларировано')+'</div></section>';
}
function viewHome(){
  var h=hmData(),d=h.fin,f=curAbc(),k='',src,fin=hmFin(),M=fin?hmMoney(h):null,sum='';
  if(!h.n)return'<div class="card empty"><h2>ТТК пока нет</h2><p>Здесь появятся показатели, когда в приложении будут ТТК.</p><div class="btns"><button class="btn primary" data-act="gotoCalc">Открыть ТТК</button></div></div>';
  var dt=new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long'});
  if(fin){
    sum='В меню <b class="num">'+M.items.length+'</b> '+plural(M.items.length,['блюдо','блюда','блюд'])+(M.np?', у <b class="num">'+M.np+'</b> нет цены продажи':'')+'.';
    if(M.mg!==null)sum+=' Средняя маржа <b class="num">'+fmt(M.mg,1)+' %</b>, сырьё в цене <b class="num">'+fmt(M.fc,1)+' %</b>.';
    if(d&&d.tot.nRev)sum+=' Выручка за период <b class="num">'+hmRub(d.tot.rev)+'</b>'+(h.fc!==null?', фудкост по продажам <b class="num">'+fmt(h.fc,1)+' %</b>':'')+'.';
    if(M.loss.length)sum+=' Ниже цели — <b class="num">'+M.loss.length+'</b> '+plural(M.loss.length,['блюдо','блюда','блюд'])+'.';
    var lossV=M.f.target===null?'<span class="hmdash">цель не задана</span>':money(M.hasQty?M.lossSum:M.perPort)+' ₽';
    k=hmMTile('Выручка',IC.chart,d&&d.tot.nRev?esc(hmRub(d.tot.rev)):'<span class="hmdash">Нет данных</span>',d&&d.tot.nRev?(f.period?esc(f.period)+' · ':'')+'по '+d.tot.nRev+' блюдам':'нужны продажи за период')
      +hmMTile('Фудкост',IC.calc,h.fc!==null?fmt(h.fc,1)+' %':(M.fc!==null?fmt(M.fc,1)+' %':'<span class="hmdash">Нет данных</span>'),h.fc!==null?'по продажам · '+h.fcN+' '+plural(h.fcN,['блюдо','блюда','блюд']):(M.fc!==null?'среднее по меню, без продаж':'нужны цены продажи и сырья'))
      +hmMTile('Маржа',IC.leaf,M.mg!==null?fmt(M.mg,1)+' %':'<span class="hmdash">Нет данных</span>',M.ok.length?'среднее по '+M.ok.length+' '+plural(M.ok.length,['блюду','блюдам','блюдам']):'нет блюд с ценой и себестоимостью')
      +hmMTile('Потери на цене',IC.warn,lossV,M.f.target===null?'задайте цель в меню':(M.loss.length?M.loss.length+' '+plural(M.loss.length,['блюдо','блюда','блюд'])+(M.hasQty?' · за период':' · на порцию каждого'):'все не ниже цели'),M.loss.length?'warn':'');
  }else if(hmRoleKey()!=='viewer'){
    k=hmMTile('ТТК в меню',IC.doc,String(h.n),'регион «'+esc(regionName(h.g))+'»')+hmMTile('КБЖУ не рассчитано',IC.leaf,String(h.noKbzhu),h.noKbzhu?'проверьте карты':'все рассчитаны',h.noKbzhu?'warn':'');
  }
  src='Источник: ТТК и цены региона «'+esc(regionName(h.g))+'», продажи введены на вкладке «ABC-анализ»'+(f.period?' за '+esc(f.period):'')+'. Средние по меню считаются по блюдам с ценой продажи и полной себестоимостью. Потери на цене — разница между ценой по цели и текущей ценой; с продажами — умноженная на число проданных порций.';
  return'<section class="hm"><div class="phead"><p class="kicker">'+esc(regionName(h.g))+' · '+esc(dt)+'</p><h1 class="ptitle">Обзор</h1>'
    +'<p class="psum">'+(fin?sum:(hmRoleKey()==='viewer'?'Меню и утверждённые ТТК':'ТТК и качество данных'))+'</p></div>'
    +(fin?'<div class="btns pbtns"><button class="btn primary" data-act="hmGo" data-t="menu">'+IC.doc+'Меню и цены</button><button class="btn" data-act="hmGo" data-t="fc">'+IC.calc+'Фудкост</button><button class="btn" data-act="hmGo" data-t="abc">'+IC.chart+'ABC-анализ</button></div>':'')
    +hmRole(h)
    +(k?'<div class="hmtiles">'+k+'</div>':'')
    +(fin?'<section class="card hmc"><div class="hmch"><h3>Где теряются деньги</h3></div>'+hmLossHtml(M,h)+'</section>'
      +'<section class="card hmc"><div class="hmch"><h3>Блюда, которые забирают маржу</h3><span class="hmsub">самая низкая маржа</span></div>'+hmLowHtml(M)+'</section>':'')
    +(!fin||!(d&&d.tot.nRev)?'':'<div class="hmrow"><section class="card hmc">'+hmAbc(h)+'</section><section class="card hmc">'+hmComposition(h)+'</section></div>')
    +'<section class="card hmc"><div class="hmch"><h3>Качество данных</h3></div>'+hmAttention(h)+'</section>'
    +(hmRoleKey()==='viewer'?'':hmExtraHtml(h))
    +(!fin?'':'<details class="hmsrc"><summary>Как считаются показатели</summary><p>'+src+'</p></details>')+'</section>';
}
