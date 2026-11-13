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
  if(hmFin()){
    row(h.incomplete,'Себестоимость неполная: нет цены сырья','hmFilter','inc','Показать');
    row(h.noPrice,'Нет цены продажи','hmFilter','noprice','Показать');
  }
  row(h.noKbzhu,'КБЖУ не рассчитано полностью','hmGo','','Открыть меню');
  if(syAdmin()&&syLinked()&&S.sy.info&&S.sy.info.pending)l.push('<li><span>Ждут проверки технолога</span><button class="btn mini" data-act="hmGo" data-t="sync">'+S.sy.info.pending+' · Открыть</button></li>');
  if(syInboxOn()&&S.sy.inbox&&S.sy.inbox.length)l.push('<li><span>Возвращено на доработку</span><button class="btn mini" data-act="hmGo" data-t="sync">'+S.sy.inbox.length+' · Открыть</button></li>');
  return l.length?'<ul class="hmatt">'+l.join('')+'</ul>':'<p class="hmok">✓ Замечаний к данным нет.</p>';
}
function viewHome(){
  var h=hmData(),d=h.fin,f=curAbc(),k='',src;
  if(!h.n)return'<div class="card empty"><h2>ТТК пока нет</h2><p>Здесь появятся показатели, когда в приложении будут ТТК.</p><div class="btns"><button class="btn primary" data-act="gotoCalc">Открыть ТТК</button></div></div>';
  if(hmRoleKey()==='viewer'){k='';}
  else if(!hmFin()){
    k=hmKpi('ТТК в меню',String(h.n),'регион «'+esc(regionName(h.g))+'»','',HM_IC.doc)+hmKpi('КБЖУ не рассчитано',String(h.noKbzhu),h.noKbzhu?'проверьте карты':'все рассчитаны',h.noKbzhu?'warn':'good',h.noKbzhu?HM_IC.warn:HM_IC.chk);
  }else{
    k=hmKpi('Выручка',d&&d.tot.nRev?esc(hmRub(d.tot.rev)):'<span class="hmdash">Нет данных</span>',d&&d.tot.nRev?(f.period?esc(f.period)+' · ':'')+'по '+d.tot.nRev+' блюдам':'нужны продажи за период','good',HM_IC.rub)
      +hmKpi('Фудкост',h.fc!==null?fmt(h.fc,1)+' %':'<span class="hmdash">Нет данных</span>',h.fc!==null?'по рецептурам · '+h.fcN+' '+plural(h.fcN,['блюдо','блюда','блюд']):'нужны продажи, цены продажи и сырья','',HM_IC.pct)
      +hmKpi('Требуют внимания',String(h.incomplete+h.noPrice+h.noOut),'нет цены, выхода, сырья',(h.incomplete+h.noPrice+h.noOut)?'warn':'good',(h.incomplete+h.noPrice+h.noOut)?HM_IC.warn:HM_IC.chk)
      +(hmRoleKey()&&hmRoleKey()!=='audit'?'':hmKpi('На проверке',String(syAdmin()&&syLinked()&&S.sy.info?(S.sy.info.pending||0):(syInboxOn()&&S.sy.inbox?S.sy.inbox.length:0)),syAdmin()?'ждут решения технолога':'возвраты на доработку','',HM_IC.doc));
  }
  src='Источник: ТТК и цены региона «'+esc(regionName(h.g))+'», продажи введены на вкладке «ABC-анализ»'+(f.period?' за '+esc(f.period):'')+'. Продажи в приложении вводятся по региону, не по точке. Фудкост расчётный: себестоимость по рецептурам проданных блюд, не фактический расход по учёту. Динамика фудкоста, потери и учётные остатки в приложение не загружаются, поэтому здесь не показаны.';
  return'<section class="hm"><div class="hmhead"><h2>Обзор</h2><p>'+(hmRoleKey()==='viewer'?'Меню и утверждённые ТТК':'Продажи, себестоимость и качество данных')+'</p></div>'
    +hmRole(h)
    +(k?'<div class="hmkpi">'+k+'</div>':'')
    +(!hmFin()?'':'<div class="hmrow"><section class="card hmc">'+hmAbc(h)+'</section><section class="card hmc">'+hmComposition(h)+'</section></div>')
    +'<section class="card hmc"><div class="hmch"><h3>Требуют внимания</h3></div>'+hmAttention(h)+'</section>'
    +(!hmFin()?'':'<details class="hmsrc"><summary>Как считаются показатели</summary><p>'+src+'</p></details>')+'</section>';
}
