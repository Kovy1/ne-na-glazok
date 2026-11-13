/* ---------- ревизии (версия 26) ----------
   Ревизия хранится в общей таблице; страница показывает список и редактор. Строка: сырьё, единица (кг, г, л, мл, шт, уп), учётный остаток,
   факт, учётная цена. Пустой факт — «не посчитано», а не ноль: такие строки не входят в итоги и не дают завершить ревизию. Неизвестная
   цена — тоже не ноль: отклонение в рублях по такой строке не считается и помечено. Разница = факт − учёт, сумма = разница × цена;
   недостачи (разница меньше нуля) и излишки считаются отдельно. Завершённая ревизия не меняется: цены и реквизиты юридического лица
   записаны в неё на момент завершения. Черновик сохраняется сам; если его тем временем изменил другой человек, страница не затирает
   его правку молча, а предлагает выбрать. Правила те же, что в скрипте (revTotals повторяет rvTotals_ из Code.gs). */
var REV_UNITS=['кг','г','л','мл','шт','уп'],REV_MAX=1500;
S.rev={ld:false,busy:false,err:'',rev:-1,items:[],q:'',st:'',reg:'',pt:'',cur:null,at:0,imp:null,save:'',saveMsg:'',timer:null,addQ:'',conf:''};
/* версию скрипта знаем не сразу после запуска страницы: пока неизвестно, запрашиваем; старый скрипт отвечает «неизвестное действие» */
function revOk(){return syLinked()&&!S.rev.old&&!(S.sy.info&&(Number(S.sy.info.v)||0)<26);}
function revCanEdit(region){var r=S.sy.cfg.role;return syLinked()&&(r==='admin'||r==='editor'||r==='finance')&&(!region||acAllowed(region));}
function revToday(){var d=new Date(),z=function(n){return(n<10?'0':'')+n;};return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate());}
function revDate(iso){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));return m?m[3]+'.'+m[2]+'.'+m[1]:String(iso||'');}
function revR2(v){return Math.round(v*100+(v<0?-1e-9:1e-9))/100;}
function revR6(v){return Math.round(v*1e6)/1e6;}
/* число из поля: пусто → null, нечисло → NaN */
function revParse(v,neg){
  var t=String(v==null?'':v).replace(/\s/g,'').replace(',','.'),x;
  if(t==='')return null;
  x=Number(t);
  if(!isFinite(x)||(!neg&&x<0))return NaN;
  return revR6(x);
}
function revNumTxt(v,d){return(v===null||v===undefined)?'':dnum(v,d===undefined?3:d);}
function revMoneyTxt(v){return(v===null||v===undefined)?'—':money(v);}
function revSigned(v){return(v===null||v===undefined)?'—':(v>0?'+':v<0?'−':'')+money(Math.abs(v));}
/* Пустой учётный остаток — не ноль: пока он не введён, разница и сумма не определены (null). Явный ноль допустим.
   Одно правило округления: сумма строки округляется до копеек, итог — сумма этих округлённых сумм (как в скрипте, XLSX и печати). */
function revHas(v){return v!==null&&v!==undefined;}
function revDiff(l){return(!revHas(l.f)||!revHas(l.b))?null:revR6(l.f-l.b);}
function revSum(l){var d=revDiff(l);return(d===null||!revHas(l.p))?null:revR2(d*l.p);}
function revTotals(lines){
  var t={n:lines.length,cnt:0,skip:0,noBook:0,short:0,over:0,sumShort:0,sumOver:0,noPrice:0};
  lines.forEach(function(l){
    var d,sm;
    if(!revHas(l.f)){t.skip++;return;}
    t.cnt++;
    if(!revHas(l.b)){t.noBook++;return;}
    d=revDiff(l);
    if(d===0)return;
    if(d<0)t.short++;else t.over++;
    sm=revSum(l);
    if(sm===null){t.noPrice++;return;}
    if(d<0)t.sumShort+=sm;else t.sumOver+=sm;
  });
  t.sumShort=revR2(t.sumShort);t.sumOver=revR2(t.sumOver);
  return t;
}
/* чего не хватает строкам для завершения: те же проверки и слова, что в скрипте (rvIssues_) */
function revIssues(lines){
  var nb=[],nf=[],np=[],out=[];
  function lst(a){return a.slice(0,5).join(', ')+(a.length>5?' и ещё '+(a.length-5):'');}
  lines.forEach(function(l,i){
    var tag='№'+(i+1)+' «'+l.n+'»';
    if(!revHas(l.b))nb.push(tag);
    if(!revHas(l.f))nf.push(tag);
    if(revHas(l.b)&&revHas(l.f)&&!revHas(l.p)&&revDiff(l)!==0)np.push(tag);
  });
  if(nb.length)out.push({code:'nobook',msg:'не указан учётный остаток (ноль, если на учёте пусто): '+lst(nb)});
  if(nf.length)out.push({code:'notcounted',msg:'не введён факт (ноль, если сырья нет): '+lst(nf)});
  if(np.length)out.push({code:'noprice',msg:'нет цены у строк с отклонением: '+lst(np)});
  return out;
}
/* состояние строки: слово видно всегда, цвет только помогает */
function revStat(l){
  var d=revDiff(l);
  if(!revHas(l.f))return['neutral','Не посчитано'];
  if(!revHas(l.b))return['warn','Нет остатка'];
  if(d===0)return['ok','Совпало'];
  return d<0?['bad','Недостача']:['warn','Излишек'];
}
/* отклонение в десять и более раз — вероятно, перепутаны единицы (граммы и килограммы) */
function revSuspect(l){
  if(l.f===null||l.f===undefined||!(l.b>0)||!(l.f>0))return false;
  var q=l.f/l.b;
  return q>=10||q<=0.1;
}
function revPackWarn(l){return(l.u==='шт'||l.u==='уп')&&!(l.g>0);}
/* цена за выбранную единицу из базы сырья: за кг или литр (плотность принята равной единице), за грамм и миллилитр, за штуку и упаковку при известной массе */
function revPriceFor(ingId,unit,g,region){
  var ing=S.ings[ingId],kg;
  if(!ing||NOPRICE)return null;
  kg=pricePerKg(ing,region||curRegion());
  if(kg===null)return null;
  if(unit==='кг'||unit==='л')return revR6(kg);
  if(unit==='г'||unit==='мл')return revR6(kg/1000);
  if((unit==='шт'||unit==='уп')&&g>0)return revR6(kg*g/1000);
  return null;
}
function revPackG(ingId,region){var ing=S.ings[ingId],q=ing&&regRec(ing,region||curRegion());return(q&&q.priceUnit==='pack'&&q.packG>0)?q.packG:0;}
function revUnit(s){
  var t=String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/[.\s]/g,'');
  var m={'кг':'кг','килограмм':'кг','kg':'кг','г':'г','гр':'г','грамм':'г','g':'г','л':'л','литр':'л','l':'л','мл':'мл','миллилитр':'мл','ml':'мл','шт':'шт','штука':'шт','штук':'шт','pcs':'шт','уп':'уп','упак':'уп','упаковка':'уп','пач':'уп','пачка':'уп'};
  return m[t]||'';
}
function revLoad(force){
  var r=S.rev;
  if(!revOk()||r.busy)return Promise.resolve();
  if(!force&&r.ld&&Date.now()-r.at<20000)return Promise.resolve();
  r.busy=true;
  return Promise.all([drLoad(false),syGet({a:'rvlist'})]).then(function(x){
    var d=x[1];r.items=d.items||[];r.rev=d.rev;r.ld=true;r.err='';r.at=Date.now();
  },function(e){if(e&&e.code==='gas'&&(e.err==='a'||e.err==='op'))r.old=true;else r.err=syErrText(e);}).then(function(){r.busy=false;if(S.tab==='rev')scheduleRender();});
}
function revBlank(){
  var rl=regionList(),reg=S.rev.reg||curRegion(),pts;
  if(!rl.some(function(g){return g.id===reg;}))reg=rl[0]?rl[0].id:'';
  pts=drPtsOf(reg);
  return{id:'',ver:0,status:'draft',num:'',by:'',at:0,doc:{date:revToday(),point:pts.length===1?pts[0].id:'',region:reg,resp:String(S.sy.cfg.name||''),note:'',lines:[]},dirty:false,gen:0,err:'',busy:false,conflict:null,newPt:null};
}
function revFromServer(rv){
  var d=rv.doc||{};
  return{id:rv.id,ver:rv.ver,status:rv.status==='done'?'done':'draft',num:rv.num,by:rv.by,at:rv.at,doc:{date:d.date||rv.date,point:d.point||rv.point,region:d.region||rv.region,resp:d.resp||'',note:d.note||'',lines:(d.lines||[]).map(function(l){return Object.assign({},l);}),snap:d.snap||null},dirty:false,gen:0,err:'',busy:false,conflict:null,newPt:null};
}

/* ---- список ---- */
function revRows(){
  var r=S.rev,q=normKey(r.q);
  return r.items.filter(function(x){
    if(r.st&&x.status!==r.st)return false;
    if(r.reg&&x.region!==r.reg)return false;
    if(r.pt&&x.point!==r.pt)return false;
    if(q){var p=drPt(x.point);if((normKey(x.num)+' '+normKey(p?p.name:'')+' '+normKey((x.sum||{}).resp)).indexOf(q)<0)return false;}
    return true;
  });
}
function revListHtml(){
  var r=S.rev,rows=revRows(),rl=regionList(),pts=drPtsOf(r.reg,true),h;
  h='<div class="wstool"><label class="field grow"><span class="lbl">Поиск</span><input type="search" id="rev-q" data-act="revQ" autocomplete="off" placeholder="Номер, точка, ответственный" value="'+esc(r.q)+'"></label>'
    +'<label class="field w180"><span class="lbl">Статус</span><select data-act="revSt"><option value="">Все</option><option value="draft"'+(r.st==='draft'?' selected':'')+'>Черновики</option><option value="done"'+(r.st==='done'?' selected':'')+'>Завершённые</option></select></label>'
    +(rl.length>1?'<label class="field w180"><span class="lbl">Регион</span><select data-act="revReg"><option value="">Все регионы</option>'+rl.map(function(g){return'<option value="'+esc(g.id)+'"'+(r.reg===g.id?' selected':'')+'>'+esc(g.name||g.id)+'</option>';}).join('')+'</select></label>':'')
    +'<label class="field w180"><span class="lbl">Точка</span><select data-act="revPtF"><option value="">Все точки</option>'+pts.map(function(p){return'<option value="'+esc(p.id)+'"'+(r.pt===p.id?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</select></label></div>';
  if(!rows.length)return h+'<div class="wsempty"><b>'+(r.items.length?'Ничего не найдено':'Ревизий пока нет')+'</b><p>'+(r.items.length?'Измените поиск или фильтры.':(revCanEdit()?'Начните первую ревизию: выберите точку, введите остатки и факт.':'Ревизии заводят технолог, редактор и тер. управляющий.'))+'</p></div>';
  return h+'<div class="wsscroll"><table class="wtbl"><thead><tr><th>Номер</th><th>Дата</th><th>Регион</th><th>Точка</th><th>Ответственный</th><th>Статус</th><th class="r">Посчитано, строк</th><th class="r">Недостача, ₽</th><th class="r">Излишек, ₽</th></tr></thead><tbody>'
    +rows.map(function(x){
      var s=x.sum||{},p=drPt(x.point);
      return'<tr class="clk" data-id="'+esc(x.id)+'"><td><button class="linkbtn" data-act="revOpen" data-id="'+esc(x.id)+'"><b>'+esc(x.num)+'</b></button></td><td>'+esc(revDate(x.date))+'</td><td>'+esc(regionName(x.region))+'</td><td>'+esc(p?p.name:x.point)+'</td><td>'+esc(s.resp||'')+'</td>'
        +'<td><span class="tstat '+(x.status==='done'?'ok':'neutral')+'">'+(x.status==='done'?'Завершена':'Черновик')+'</span></td>'
        +'<td class="r">'+esc((s.cnt||0)+' из '+(s.n||0))+(s.skip?' · не посчитано '+s.skip:'')+'</td><td class="r">'+revMoneyTxt(s.sumShort)+'</td><td class="r">'+revMoneyTxt(s.sumOver)+'</td></tr>';
    }).join('')+'</tbody></table></div>';
}

/* ---- редактор ---- */
function revSaveTxt(){
  var r=S.rev,c=r.cur;
  if(!c)return'';
  if(c.status==='done')return'Ревизия завершена';
  if(c.busy)return'Сохраняю…';
  if(c.conflict)return'Ревизию изменил другой человек';
  if(c.err)return'Не сохранено';
  if(c.dirty)return c.doc.point?'Есть несохранённые правки':'Выберите точку, чтобы сохранялся черновик';
  return c.id?'Черновик сохранён':'Черновик ещё не сохранён';
}
function revSaveBadge(){var c=S.rev.cur;if(!c)return'';return'<span class="rvsave" id="revSave" role="status" data-s="'+(c.err||c.conflict?'error':(c.busy?'saving':(c.dirty?'dirty':'ok')))+'">'+esc(revSaveTxt())+'</span>';}
function revPaintSave(){var el=$('#revSave'),c=S.rev.cur,h2=$('#revEd h2.inl');if(h2&&c)h2.textContent='Ревизия'+(c.num?' № '+c.num:' (новая)');if(el&&c){el.textContent=revSaveTxt();el.setAttribute('data-s',c.err||c.conflict?'error':(c.busy?'saving':(c.dirty?'dirty':'ok')));}renderStatus();}
function revTotalsHtml(lines){
  var t=revTotals(lines);
  return'<div class="rvtot" id="revTot" role="status">'
    +'<span class="rvt"><b>'+t.cnt+' из '+t.n+'</b> посчитано'+(t.skip?', <b class="warn">не посчитано: '+t.skip+'</b>':'')+'</span>'
    +(t.noBook?'<span class="rvt warn">Без остатка: <b>'+t.noBook+'</b> (отклонение не определено)</span>':'')
    +'<span class="rvt">Недостача: <b>'+t.short+' поз.</b> на <b>'+revMoneyTxt(t.sumShort)+' ₽</b></span>'
    +'<span class="rvt">Излишек: <b>'+t.over+' поз.</b> на <b>+'+revMoneyTxt(t.sumOver)+' ₽</b></span>'
    +'<span class="rvt">Итого: <b>'+revSigned(revR2(t.sumShort+t.sumOver))+' ₽</b></span>'
    +(t.noPrice?'<span class="rvt warn">Без цены: <b>'+t.noPrice+'</b> (в суммы не входят)</span>':'')+'</div>';
}
function revRowHtml(l,i,ro){
  var d=revDiff(l),sm=revSum(l),st=revStat(l),w=[];
  if(revSuspect(l))w.push('Проверьте единицы: факт и учёт различаются в 10 и более раз');
  if(revPackWarn(l))w.push('Масса '+(l.u==='уп'?'упаковки':'штуки')+' не указана: в вес не пересчитывается');
  if(revHas(l.f)&&!revHas(l.b))w.push('Учётный остаток не введён: отклонение не определено');
  else if(revHas(l.f)&&!revHas(l.p)&&d)w.push('Цена неизвестна: отклонение в рублях не считается');
  var nm='<td class="n" data-l="Сырьё"><b>'+esc(l.n)+'</b>'+(l.c?'<small>'+esc(l.c)+'</small>':'')+w.map(function(x){return'<small class="rvw">⚠ '+esc(x)+'</small>';}).join('')+'</td>';
  if(ro)return'<tr data-i="'+i+'" class="rvl s-'+st[0]+'">'+nm+'<td data-l="Ед.">'+esc(l.u)+'</td><td class="r" data-l="Учёт">'+revNumTxt(l.b)+'</td><td class="r" data-l="Факт">'+revNumTxt(l.f)+'</td><td class="r rd" data-l="Разница">'+revSignedQ(d)+'</td><td class="r" data-l="Цена, ₽/ед.">'+revNumTxt(l.p,4)+'</td><td class="r rs" data-l="Отклонение, ₽">'+revSigned(sm)+'</td><td data-l="Статус"><span class="tstat '+st[0]+'">'+st[1]+'</span></td></tr>';
  return'<tr data-i="'+i+'" class="rvl s-'+st[0]+'">'+nm
    +'<td data-l="Ед."><select data-act="revU" aria-label="Единица: '+esc(l.n)+'">'+REV_UNITS.map(function(u){return'<option'+(u===l.u?' selected':'')+'>'+u+'</option>';}).join('')+'</select></td>'
    +'<td class="r" data-l="Учёт"><input class="num" data-act="revB" inputmode="decimal" autocomplete="off" placeholder="не введён" aria-label="Учётный остаток: '+esc(l.n)+'" value="'+esc(revNumTxt(l.b))+'"></td>'
    +'<td class="r" data-l="Факт"><input class="num factin" data-act="revF" inputmode="decimal" autocomplete="off" placeholder="не посчитано" aria-label="Факт: '+esc(l.n)+'" value="'+esc(revNumTxt(l.f))+'"></td>'
    +'<td class="r rd" data-l="Разница">'+revSignedQ(d)+'</td>'
    +'<td class="r" data-l="Цена, ₽/ед."><input class="num" data-act="revP" inputmode="decimal" autocomplete="off" placeholder="неизвестна" aria-label="Учётная цена: '+esc(l.n)+'" value="'+esc(revNumTxt(l.p,4))+'"></td>'
    +'<td class="r rs" data-l="Отклонение, ₽">'+revSigned(sm)+'</td>'
    +'<td class="st" data-l="Статус"><span class="tstat '+st[0]+'">'+st[1]+'</span></td>'
    +'<td class="x"><button class="btn mini" data-act="revDelLine" aria-label="Убрать строку: '+esc(l.n)+'" title="Убрать строку">×</button></td></tr>';
}
function revSignedQ(d){return d===null?'—':(d>0?'+':d<0?'−':'')+dnum(Math.abs(d),3);}
function revTableHtml(c,ro){
  var lines=c.doc.lines;
  if(!lines.length)return'<div class="wsempty"><b>В ревизии пока нет строк</b><p>'+(ro?'':'Добавьте сырьё из базы, загрузите файл с остатками или введите строку вручную.')+'</p></div>';
  return'<div class="wsscroll rvscroll"><table class="wtbl rvtbl"><thead><tr><th>Сырьё</th><th>Ед.</th><th class="r">Учёт, ед.</th><th class="r">Факт, ед.</th><th class="r">Разница, ед.</th><th class="r">Цена, ₽/ед.</th><th class="r">Отклонение, ₽</th><th>Статус</th>'+(ro?'':'<th><span class="sr">Убрать</span></th>')+'</tr></thead><tbody id="revBody">'
    +lines.map(function(l,i){return revRowHtml(l,i,ro);}).join('')+'</tbody></table></div>';
}
function revHeadHtml(c,ro){
  var d=c.doc,rl=regionList(),pts=drPtsOf(d.region,true),pt=drPt(d.point),le=pt&&drLe(pt.le),sn=d.snap;
  if(ro&&sn){
    return'<dl class="rvmeta"><div><dt>Регион</dt><dd>'+esc(sn.region.name)+'</dd></div><div><dt>Точка</dt><dd>'+esc(sn.point.name)+(sn.point.address?', '+esc(sn.point.address):'')+'</dd></div>'
      +'<div><dt>Юридическое лицо</dt><dd>'+(sn.le?esc(sn.le.org||sn.le.name)+(sn.le.inn?', ИНН '+esc(sn.le.inn):'')+(sn.le.kpp?', КПП '+esc(sn.le.kpp):''):'не указано')+'</dd></div>'
      +'<div><dt>Дата</dt><dd>'+esc(revDate(d.date))+'</dd></div><div><dt>Ответственный</dt><dd>'+esc(d.resp)+'</dd></div><div><dt>Завершена</dt><dd>'+esc(pfDate(sn.at))+', '+esc(sn.by)+'</dd></div>'
      +(d.note?'<div class="wide"><dt>Комментарий</dt><dd>'+esc(d.note)+'</dd></div>':'')+'</dl>';
  }
  var pc=c.newPt;
  return'<div class="fgrid"><label class="field w180"><span class="lbl">Номер</span><input data-act="revH" data-k="num" autocomplete="off" placeholder="присвоится сам" value="'+esc(c.num||'')+'"'+(c.id?' disabled':'')+'></label>'
    +'<label class="field w180"><span class="lbl">Дата ревизии</span><input type="date" data-act="revH" data-k="date" value="'+esc(d.date)+'"></label>'
    +'<label class="field w180"><span class="lbl">Регион</span><select data-act="revH" data-k="region"'+(c.id?' disabled':'')+'>'+rl.map(function(g){return'<option value="'+esc(g.id)+'"'+(d.region===g.id?' selected':'')+'>'+esc(g.name||g.id)+'</option>';}).join('')+'</select></label>'
    +'<label class="field grow"><span class="lbl">Точка</span><select data-act="revH" data-k="point"'+(c.id?' disabled':'')+'><option value="">— выбрать точку —</option>'+pts.map(function(p){return'<option value="'+esc(p.id)+'"'+(d.point===p.id?' selected':'')+(p.active===false?' disabled':'')+'>'+esc(p.name)+(p.active===false?' (отключена)':'')+'</option>';}).join('')+'</select></label>'
    +(!c.id&&drCanPt()&&!pc?'<div class="field"><span class="lbl">&nbsp;</span><button class="btn" data-act="revPtNew">Новая точка</button></div>':'')+'</div>'
    +(pc?'<div class="wspanel inline"><div class="fgrid"><label class="field grow"><span class="lbl">Название новой точки</span><input id="rev-ptn" data-act="revPtF2" data-k="name" autocomplete="off" value="'+esc(pc.name)+'"></label><label class="field grow"><span class="lbl">Адрес</span><input data-act="revPtF2" data-k="address" autocomplete="off" value="'+esc(pc.address)+'"></label></div>'
      +(pc.err?'<p class="hint cmsg err" role="alert">'+esc(pc.err)+'</p>':'')+'<div class="btns"><button class="btn" data-act="revPtMake">Создать точку</button><button class="btn" data-act="revPtCancel">Отмена</button></div></div>':'')
    +(pt?'<p class="hint">'+(le?'Юридическое лицо точки: <b>'+esc(drLeLabel(le))+'</b>.':'<span class="rvw">⚠ У точки не указано юридическое лицо: в отчёте его не будет. Технолог указывает его в «Справочниках».</span>')+'</p>':'')
    +'<div class="fgrid"><label class="field grow"><span class="lbl">Ответственное лицо</span><input data-act="revH" data-k="resp" autocomplete="off" placeholder="Фамилия И.О." value="'+esc(d.resp)+'"></label>'
    +'<label class="field grow"><span class="lbl">Комментарий</span><input data-act="revH" data-k="note" autocomplete="off" value="'+esc(d.note)+'"></label></div>';
}
function revAddHtml(){
  var q=normKey(S.rev.addQ),res=[];
  if(q)Object.keys(S.ings).forEach(function(id){if(res.length<8&&normKey(S.ings[id].name).indexOf(q)>-1)res.push(id);});
  return'<div class="rvadd"><label class="field grow"><span class="lbl">Добавить сырьё из базы</span><input type="search" id="rev-add" data-act="revAddQ" autocomplete="off" placeholder="Начните вводить название" value="'+esc(S.rev.addQ)+'"></label>'
    +'<div class="rvres" id="revRes">'+revResHtml(res,q)+'</div></div>';
}
function revResHtml(res,q){
  if(!q)return'';
  return res.map(function(id){return'<button class="btn mini" data-act="revAddIng" data-id="'+esc(id)+'">'+esc(S.ings[id].name)+'</button>';}).join('')
    +'<button class="btn mini" data-act="revAddFree">'+(res.length?'Другая строка: ':'Нет в базе. Добавить строку «')+esc(S.rev.addQ.trim())+(res.length?'':'»')+'</button>';
}
/* чего не хватает, чтобы завершить ревизию */
function revWhy(c){
  var why=[];
  if(!c.doc.point)why.push('выберите точку');
  if(!c.doc.lines.length)why.push('добавьте строки');
  revIssues(c.doc.lines).forEach(function(x){why.push(x.msg);});
  if(!String(c.doc.resp||'').trim())why.push('укажите ответственное лицо');
  return why;
}
function revEditHtml(){
  var c=S.rev.cur,ro=c.status==='done'||!revCanEdit(c.doc.region),h,why=ro?[]:revWhy(c);
  h='<section class="card wscard" id="revEd"><div class="wshead"><div><button class="btn mini" data-act="revBack">‹ К списку</button> <h2 class="inl">Ревизия'+(c.num?' № '+esc(c.num):' (новая)')+'</h2> <span class="tstat '+(c.status==='done'?'ok':'neutral')+'">'+(c.status==='done'?'Завершена':'Черновик')+'</span></div>'
    +(ro?(c.status==='done'?'<div class="btns"><button class="btn primary" data-act="revPrint">Печать / PDF</button><button class="btn" data-act="revXlsx">Скачать XLSX</button></div>':'')
      :'<div class="btns">'+revSaveBadge()+'<button class="btn primary" data-act="revFinish"'+(why.length||c.busy?' disabled':'')+'>Завершить ревизию</button></div>')+'</div>';
  if(c.err)h+='<p class="hint cmsg err" role="alert">'+esc(c.err)+'</p>';
  if(c.conflict)h+='<div class="acnote" role="alert"><b>Эту ревизию уже изменил '+esc(c.conflict.by||'другой человек')+'.</b> Ваши правки ещё не сохранены. <div class="btns"><button class="btn" data-act="revTake">Взять его версию</button><button class="btn" data-act="revMine">Сохранить мою поверх</button></div></div>';
  if(!ro)h+='<p class="hint" id="revWhy"'+(why.length?'':' hidden')+'>Чтобы завершить: '+esc(why.join('; '))+'.</p>';
  if(c.status==='done')h+='<p class="hint">Завершённая ревизия не меняется: цены и реквизиты записаны в неё на '+esc(pfDate((c.doc.snap||{}).at||c.at))+'. Новые цены и правки справочника в ней не отражаются.</p>';
  h+=revHeadHtml(c,ro);
  if(!ro)h+='<div class="btns rvact"><button class="btn" data-act="revImp">Загрузить из файла</button><button class="btn" data-act="revSaveNow"'+(c.busy?' disabled':'')+'>Сохранить черновик</button>'+(c.id?'<button class="btn danger" data-act="revDel">Удалить черновик</button>':'')+'</div>'+revAddHtml()+revImpHtml();
  h+=revTableHtml(c,ro)+revTotalsHtml(c.doc.lines);
  if(S.rev.conf==='finish')h+='<div class="wspanel" role="alertdialog" aria-label="Подтверждение"><p><b>Завершить ревизию?</b> После этого её нельзя изменить: в отчёт запишутся цены и реквизиты на сегодня.</p><div class="btns"><button class="btn primary" data-act="revFinishYes">Завершить</button><button class="btn" data-act="revFinishNo">Вернуться</button></div></div>';
  if(S.rev.conf==='del')h+='<div class="wspanel" role="alertdialog" aria-label="Подтверждение"><p><b>Удалить черновик?</b> Завершённые ревизии не удаляются.</p><div class="btns"><button class="btn danger" data-act="revDelYes">Удалить</button><button class="btn" data-act="revFinishNo">Вернуться</button></div></div>';
  return h+'</section>';
}
function viewRev(){
  var r=S.rev,h;
  if(!syLinked())return'<section class="card wscard"><div class="wsempty"><b>Ревизии ведутся в общей базе</b><p>Подключитесь в «Личном кабинете» по своему коду: ревизии, точки и юридические лица общие, их хранит и проверяет скрипт.</p><div class="btns"><button class="btn primary" data-act="goTab" data-tab="sync">Открыть «Личный кабинет»</button></div></div></section>';
  if(!revOk())return'<section class="card wscard"><div class="wsempty"><b>Нужен скрипт версии 26</b><p>В таблице стоит версия '+esc(String((S.sy.info||{}).v||'прежняя'))+'. Технолог обновляет скрипт в «Личном кабинете» → «Настройка скрипта».</p></div></section>';
  if(acNone())return'<section class="card wscard">'+acNoteHtml()+'</section>';
  if(r.cur)return revEditHtml();
  h='<section class="card wscard" id="revView"><div class="wshead"><h2>Ревизии</h2>'+(revCanEdit()?'<button class="btn primary" data-act="revNew">Новая ревизия</button>':'')+'</div>';
  if(r.err)h+='<p class="hint cmsg err" role="alert">'+esc(r.err)+' <button class="btn mini" data-act="revReload">Повторить</button></p>';
  if(!r.ld&&!r.err)h+='<div class="wsempty" aria-busy="true"><b>Загружаю ревизии…</b></div>';
  else if(r.ld)h+='<div id="revList">'+revListHtml()+'</div>';
  return h+'</section>';
}

/* ---- сохранение ---- */
function revDirty(){
  var c=S.rev.cur;
  if(!c||c.status==='done')return;
  c.dirty=true;c.gen++;c.err='';
  clearTimeout(S.rev.timer);
  S.rev.timer=setTimeout(function(){revSave(false);},1800);
  revPaintSave();
}
function revReq(c){
  var d=c.doc;
  return{id:c.id||undefined,base:c.ver||0,doc:{num:c.num||undefined,date:d.date,point:d.point,region:d.region,resp:d.resp,note:d.note,lines:d.lines.map(function(l){return{n:l.n,u:l.u,g:l.g===undefined?null:l.g,b:l.b===undefined?null:l.b,f:l.f===undefined?null:l.f,p:l.p===undefined?null:l.p,s:l.s,c:l.c};})},regName:regionName(d.region)};
}
function revSave(manual){
  var c=S.rev.cur,gen,req;
  clearTimeout(S.rev.timer);
  if(!c||c.status==='done'||c.busy||c.conflict)return Promise.resolve(false);
  if(!c.dirty&&!manual)return Promise.resolve(true);
  if(!c.doc.point||!c.doc.region){if(manual){c.err='Выберите точку: без неё черновик не сохраняется.';revPaintSave();}return Promise.resolve(false);}
  gen=c.gen;req=revReq(c);c.busy=true;c.err='';revPaintSave();
  return syPost('rvput',req).then(function(r){
    c.busy=false;
    if(r&&r.ok===false&&r.err==='conflict'){c.conflict={by:r.cur.by,ver:r.cur.ver,doc:r.doc,num:r.cur.num,at:r.cur.at,status:r.cur.status};revPaintSave();scheduleRender();return false;}
    c.id=r.id;c.ver=r.ver;c.num=r.num;c.by=r.by;c.at=r.at;
    if(c.gen===gen)c.dirty=false;else revDirty();
    S.rev.ld&&(S.rev.at=0);
    revPaintSave();if(manual)flash('Черновик сохранён');
    if(!req.id)scheduleRender();
    return true;
  },function(e){c.busy=false;c.err=syErrText(e);revPaintSave();scheduleRender();return false;});
}
function revFinish(){
  var c=S.rev.cur;
  if(!c||c.busy)return;
  c.busy=true;c.err='';S.rev.conf='';renderAll();
  syPost('rvfinish',revReq(c)).then(function(r){
    if(r&&r.ok===false&&r.err==='conflict'){c.busy=false;c.conflict={by:r.cur.by,ver:r.cur.ver,doc:r.doc,num:r.cur.num,at:r.cur.at,status:r.cur.status};return;}
    return syGet({a:'rvget',id:r.id}).then(function(d){S.rev.cur=revFromServer(d.rv);S.rev.at=0;flash('Ревизия завершена');});
  },function(e){c.busy=false;c.err=syErrText(e);}).then(function(){renderAll();window.scrollTo(0,0);});
}
function revOpen(id){
  S.rev.conf='';
  syGet({a:'rvget',id:id}).then(function(d){S.rev.cur=revFromServer(d.rv);renderAll();window.scrollTo(0,0);},function(e){flash(syErrText(e));revLoad(true);});
}
function revClose(){
  clearTimeout(S.rev.timer);
  var c=S.rev.cur,p=(c&&c.dirty&&c.status!=='done'&&c.doc.point)?revSave(false):Promise.resolve();
  p.then(function(){S.rev.cur=null;S.rev.imp=null;S.rev.conf='';S.rev.at=0;revLoad(true);renderAll();});
}
function revAddLine(l){
  var c=S.rev.cur;
  if(c.doc.lines.length>=REV_MAX){flash('В ревизии не больше '+REV_MAX+' строк: разделите её на две');return false;}
  c.doc.lines.push(l);revDirty();return true;
}
function revMkLine(name,ingId){
  var c=S.rev.cur,l={n:String(name).trim().slice(0,200),u:'кг',g:null,b:null,f:null,p:null},g;
  if(ingId&&S.ings[ingId]){
    l.s=ingId;
    g=revPackG(ingId,c.doc.region);
    if(g>0){l.u='уп';l.g=g;}
    l.p=revPriceFor(ingId,l.u,l.g,c.doc.region);
  }
  return l;
}
function revPaintRow(i){
  var c=S.rev.cur,tr=$('#revBody tr[data-i="'+i+'"]'),l,d,st,sm;
  if(!c||!tr)return;
  l=c.doc.lines[i];d=revDiff(l);sm=revSum(l);st=revStat(l);
  tr.className='rvl s-'+st[0];
  tr.querySelector('.rd').textContent=revSignedQ(d);tr.querySelector('.rs').textContent=revSigned(sm);
  var s=tr.querySelector('.st .tstat');if(s){s.className='tstat '+st[0];s.textContent=st[1];}
  var nm=tr.querySelector('td.n');
  if(nm){
    var w=[];
    if(revSuspect(l))w.push('Проверьте единицы: факт и учёт различаются в 10 и более раз');
    if(revPackWarn(l))w.push('Масса '+(l.u==='уп'?'упаковки':'штуки')+' не указана: в вес не пересчитывается');
    if(revHas(l.f)&&!revHas(l.b))w.push('Учётный остаток не введён: отклонение не определено');
    else if(revHas(l.f)&&!revHas(l.p)&&d)w.push('Цена неизвестна: отклонение в рублях не считается');
    Array.prototype.slice.call(nm.querySelectorAll('.rvw')).forEach(function(x){x.parentNode.removeChild(x);});
    w.forEach(function(x){var e=document.createElement('small');e.className='rvw';e.textContent='⚠ '+x;nm.appendChild(e);});
  }
}
function revPaintTot(){
  var c=S.rev.cur,el=$('#revTot');
  if(!c||!el)return;
  var tmp=document.createElement('div');tmp.innerHTML=revTotalsHtml(c.doc.lines);
  el.innerHTML=tmp.firstChild.innerHTML;
  var fb=$('[data-act="revFinish"]'),why=revWhy(c),wy=$('#revWhy');
  if(fb)fb.disabled=!!why.length||c.busy;
  if(wy){wy.hidden=!why.length;wy.textContent='Чтобы завершить: '+why.join('; ')+'.';}
}

/* ---- импорт из файла: те же чтение xlsx/ods/csv и числа, что у выгрузки 1С ---- */
var REV_SYN={
  f:/факт|пересчит|посчит/,
  b:/учет|книжн|по данным|остаток|кол-?во|количество/,
  u:/ед\.?\s*изм|единиц|^ед\.?$/,
  p:/цен|себестоим/,
  n:/номенклатур|наименован|сырь|товар|продукт|название|позиц/
};
function revCols(row){
  var map={n:-1,u:-1,b:-1,f:-1,p:-1},used={},order=['f','u','p','b','n'];
  order.forEach(function(k){
    var j;
    for(j=0;j<row.length;j++){
      var t=normKey(row[j]).replace(/ё/g,'е');
      if(used[j]||!t)continue;
      if(k==='b'&&/факт/.test(t))continue;
      if(k==='p'&&/сумм/.test(t))continue;
      if(REV_SYN[k].test(t)){map[k]=j;used[j]=1;break;}
    }
  });
  return map;
}
function revImpOpen(rows,name){
  var best=0,bi=0,i,m,n;
  for(i=0;i<Math.min(rows.length,15);i++){m=revCols(rows[i]);n=Object.keys(m).filter(function(k){return m[k]>-1;}).length;if(n>best){best=n;bi=i;}}
  S.rev.imp={name:name,rows:rows,hdr:best>=2?bi:-1,map:best>=2?revCols(rows[bi]):{n:0,u:-1,b:-1,f:-1,p:-1},defU:'кг',fillPrice:true,mode:S.rev.cur.doc.lines.length?'add':'replace',busy:false};
  renderAll();
}
function revImpParse(){
  var im=S.rev.imp,c=S.rev.cur,ok=[],errs=[],seen={},start=im.hdr+1,i,row,l,u,x,mt,g;
  for(i=start;i<im.rows.length;i++){
    row=im.rows[i]||[];
    if(!row.some(function(v){return String(v==null?'':v).trim();}))continue;
    var nm=String(im.map.n>-1?row[im.map.n]:'').replace(/\s+/g,' ').trim(),warn=[],bad='';
    if(!nm){errs.push({r:i+1,m:'нет названия сырья'});continue;}
    if(/^(итого|всего)\b/i.test(nm))continue;
    u=im.map.u>-1?String(row[im.map.u]==null?'':row[im.map.u]).trim():'';
    if(u){u=revUnit(u);if(!u){errs.push({r:i+1,n:nm,m:'единица «'+String(row[im.map.u]).trim()+'» не подходит (нужна одна из: '+REV_UNITS.join(', ')+')'});continue;}}
    else u=im.defU;
    l={n:nm.slice(0,200),u:u,g:null,b:null,f:null,p:null};
    var fields=[['b','учётный остаток',true],['f','факт',false],['p','цена',false]];
    fields.forEach(function(fd){
      if(bad||im.map[fd[0]]<0)return;
      var raw=row[im.map[fd[0]]];
      if(raw===null||raw===undefined||String(raw).trim()==='')return;
      x=parseNumL(raw);
      var neg=Number(String(raw).replace(/\s/g,'').replace(',','.'));
      if(fd[2]&&isFinite(neg))x={ok:true,v:neg,empty:false};
      if(!x.ok){bad=fd[1]+': «'+String(raw).trim()+'» не число или меньше нуля';return;}
      l[fd[0]]=revR6(x.v);
    });
    if(bad){errs.push({r:i+1,n:nm,m:bad});continue;}
    mt=matchIng(nm,S.ings);
    if(mt.id&&(mt.how==='exact'||mt.how==='alias')){
      l.s=mt.id;
      if((l.u==='шт'||l.u==='уп')){g=revPackG(mt.id,c.doc.region);if(g>0)l.g=g;}
      if(l.p===null&&im.fillPrice){var bp=revPriceFor(mt.id,l.u,l.g,c.doc.region);if(bp!==null){l.p=bp;warn.push('цена из базы');}}
    }
    if(revPackWarn(l))warn.push('нет массы '+(l.u==='уп'?'упаковки':'штуки'));
    if(revSuspect(l))warn.push('проверьте единицы');
    var key=normKey(nm)+'|'+l.u;
    if(seen[key]){errs.push({r:i+1,n:nm,m:'повтор: строка «'+nm+'» уже есть выше'});continue;}
    seen[key]=1;
    ok.push({l:l,w:warn,r:i+1});
  }
  return{ok:ok,errs:errs};
}
function revImpHtml(){
  var im=S.rev.imp,cols,p,h,hdr;
  if(!im)return'';
  hdr=im.hdr>-1?im.rows[im.hdr]:(im.rows[0]||[]);
  cols=hdr.length;
  function sel(k,lbl,req){
    var o='<option value="-1">— нет —</option>',j;
    for(j=0;j<cols;j++)o+='<option value="'+j+'"'+(im.map[k]===j?' selected':'')+'>'+esc((im.hdr>-1?String(hdr[j]||'').trim():'')||('Колонка '+(j+1)))+'</option>';
    return'<label class="field"><span class="lbl">'+lbl+(req?' *':'')+'</span><select data-act="revImpMap" data-k="'+k+'">'+o+'</select></label>';
  }
  p=revImpParse();
  h='<section class="wspanel" id="revImp"><h3>Загрузка из файла «'+esc(im.name)+'»</h3>'
    +'<p class="hint">Проверьте, какая колонка что значит. Пустой факт останется «не посчитано», пустая цена — «неизвестна» (не ноль). Строки с ошибками не загружаются.</p>'
    +'<div class="fgrid">'+sel('n','Сырьё',true)+sel('u','Единица')+sel('b','Учётный остаток')+sel('f','Факт')+sel('p','Учётная цена')+'</div>'
    +'<div class="fgrid"><label class="field w180"><span class="lbl">Единица, если колонки нет</span><select data-act="revImpDef">'+REV_UNITS.map(function(u){return'<option'+(im.defU===u?' selected':'')+'>'+u+'</option>';}).join('')+'</select></label>'
    +'<label class="chkl"><input type="checkbox" data-act="revImpFill"'+(im.fillPrice?' checked':'')+'> Если цены нет в файле, взять из базы сырья</label>'
    +'<label class="field w180"><span class="lbl">Что сделать</span><select data-act="revImpMode"><option value="add"'+(im.mode==='add'?' selected':'')+'>Добавить к имеющимся</option><option value="replace"'+(im.mode==='replace'?' selected':'')+'>Заменить все строки</option></select></label></div>';
  if(im.map.n<0)h+='<p class="hint cmsg err" role="alert">Укажите колонку с названием сырья.</p>';
  else{
    h+='<p class="hint"><b>Будет загружено: '+p.ok.length+'</b>'+(p.errs.length?'; <b class="warn">с ошибками: '+p.errs.length+'</b>':'')+'.</p>';
    if(p.ok.length)h+='<div class="wsscroll" style="max-height:240px"><table class="wtbl"><thead><tr><th>Строка файла</th><th>Сырьё</th><th>Ед.</th><th class="r">Учёт</th><th class="r">Факт</th><th class="r">Цена, ₽/ед.</th><th>Примечание</th></tr></thead><tbody>'
      +p.ok.slice(0,15).map(function(x){return'<tr><td>'+x.r+'</td><td>'+esc(x.l.n)+'</td><td>'+x.l.u+'</td><td class="r">'+revNumTxt(x.l.b)+'</td><td class="r">'+(x.l.f===null?'<i>не посчитано</i>':revNumTxt(x.l.f))+'</td><td class="r">'+(x.l.p===null?'<i>неизвестна</i>':revNumTxt(x.l.p,4))+'</td><td>'+esc(x.w.join('; '))+'</td></tr>';}).join('')+'</tbody></table></div>'+(p.ok.length>15?'<p class="hint">Показаны первые 15 строк.</p>':'');
    if(p.errs.length)h+='<div class="wsscroll" style="max-height:200px"><table class="wtbl"><thead><tr><th>Строка файла</th><th>Сырьё</th><th>Ошибка</th></tr></thead><tbody>'+p.errs.slice(0,50).map(function(x){return'<tr><td>'+x.r+'</td><td>'+esc(x.n||'')+'</td><td class="bad">'+esc(x.m)+'</td></tr>';}).join('')+'</tbody></table></div>'+(p.errs.length>50?'<p class="hint">Показаны первые 50 ошибок.</p>':'');
  }
  return h+'<div class="btns"><button class="btn primary" data-act="revImpGo"'+((im.map.n<0||!p.ok.length)?' disabled':'')+'>Загрузить строк: '+p.ok.length+'</button><button class="btn" data-act="revImpNo">Отмена</button></div></section>';
}
function revImpGo(){
  var im=S.rev.imp,c=S.rev.cur,p=revImpParse(),lines=im.mode==='replace'?[]:c.doc.lines.slice(),have={};
  lines.forEach(function(l){have[normKey(l.n)+'|'+l.u]=1;});
  var add=0,skip=0;
  p.ok.forEach(function(x){
    var k=normKey(x.l.n)+'|'+x.l.u;
    if(have[k]){skip++;return;}
    if(lines.length>=REV_MAX)return;
    lines.push(x.l);have[k]=1;add++;
  });
  c.doc.lines=lines;S.rev.imp=null;revDirty();renderAll();
  flash('Загружено строк: '+add+(skip?', уже были: '+skip:'')+(p.errs.length?', с ошибками: '+p.errs.length:''));
}
function revReadFile(file){
  var ext=(/\.([a-z0-9]+)$/i.exec(file.name)||[])[1],fr;
  ext=(ext||'').toLowerCase();
  function bad(){flash('Не удалось разобрать файл. Сохраните его как .xlsx или .csv, либо проверьте, что внутри таблица.');}
  function done(rows){if(!rows||!rows.length){bad();return;}revImpOpen(rows,file.name);}
  if(ext==='xlsx'||ext==='xlsm'){
    if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .xlsx. Нужен современный Chrome, Edge, Firefox или Safari.');return;}
    fr=new FileReader();fr.onerror=bad;
    fr.onload=function(){
      var buf=fr.result;
      Promise.all([unzipEntry(buf,'xl/sharedStrings.xml'),unzipEntry(buf,'xl/styles.xml'),c1Sheet(buf)]).then(function(r){
        var dec=new TextDecoder('utf-8');
        if(!r[2])throw new Error('nosheet');
        done(xlRows(dec.decode(r[2]),xlShared(r[0]?dec.decode(r[0]):''),xlDateStyles(r[1]?dec.decode(r[1]):'')));
      })['catch'](bad);
    };
    fr.readAsArrayBuffer(file);
  }else if(ext==='ods'){
    fr=new FileReader();fr.onerror=bad;
    fr.onload=function(){unzipEntry(fr.result,'content.xml').then(function(u8){if(!u8)throw new Error('nodoc');done(odtRows(new TextDecoder('utf-8').decode(u8)));})['catch'](bad);};
    fr.readAsArrayBuffer(file);
  }else if(ext==='csv'||ext==='tsv'||ext==='txt'){
    readTextFile(file,function(err,text){if(err){bad();return;}done(c1Rows(text));});
  }else if(ext==='xls')flash('Старый формат .xls не читается. Пересохраните файл как .xlsx или .csv.');
  else flash('Нужен файл .xlsx, .ods, .csv или .txt.');
}

/* ---- события ---- */
function revFocusNext(el,dir){
  var all=Array.prototype.slice.call(document.querySelectorAll('#revBody .factin')),i=all.indexOf(el),n=all[i+dir];
  if(n){n.focus();if(n.select)n.select();return true;}
  return false;
}
document.addEventListener('keydown',function(e){
  var t=e.target;
  if(!t||!t.classList||!t.classList.contains('factin'))return;
  if(e.key==='Enter'){e.preventDefault();if(!revFocusNext(t,e.shiftKey?-1:1)){var a=$('#rev-add');if(a)a.focus();}}
  else if(e.key==='ArrowDown'){e.preventDefault();revFocusNext(t,1);}
  else if(e.key==='ArrowUp'){e.preventDefault();revFocusNext(t,-1);}
});
function revLineOf(t){var tr=t.closest('tr[data-i]'),c=S.rev.cur;return(tr&&c)?[c.doc.lines[Number(tr.getAttribute('data-i'))],Number(tr.getAttribute('data-i'))]:null;}
function revClick(act,b){
  var r=S.rev,c=r.cur,tr;
  switch(act){
    case'revNew':r.cur=revBlank();r.conf='';renderAll();window.scrollTo(0,0);return true;
    case'revOpen':revOpen(b.getAttribute('data-id'));return true;
    case'revBack':revClose();return true;
    case'revReload':r.err='';revLoad(true);return true;
    case'revSaveNow':revSave(true);return true;
    case'revFinish':
      if(!c)return true;
      r.conf='finish';renderAll();return true;
    case'revFinishYes':
      if(c&&c.dirty){clearTimeout(r.timer);}
      revFinish();return true;
    case'revFinishNo':r.conf='';renderAll();return true;
    case'revDel':r.conf='del';renderAll();return true;
    case'revDelYes':
      if(!c||!c.id){S.rev.cur=null;r.conf='';renderAll();return true;}
      syPost('rvdel',{id:c.id,base:c.ver}).then(function(x){
        if(x&&x.ok===false){c.err=x.msg||'Черновик успели изменить';r.conf='';renderAll();return;}
        S.rev.cur=null;r.conf='';r.at=0;flash('Черновик удалён');revLoad(true);renderAll();
      },function(e){c.err=syErrText(e);r.conf='';renderAll();});
      return true;
    case'revDelLine':
      tr=b.closest('tr[data-i]');if(!tr||!c)return true;
      c.doc.lines.splice(Number(tr.getAttribute('data-i')),1);revDirty();renderAll();return true;
    case'revAddIng':
      if(c&&revAddLine(revMkLine(S.ings[b.getAttribute('data-id')].name,b.getAttribute('data-id')))){r.addQ='';renderAll();var inp=$('#revBody tr:last-child .factin');if(inp)inp.focus();}
      return true;
    case'revAddFree':
      if(c&&String(r.addQ).trim()&&revAddLine(revMkLine(r.addQ,''))){r.addQ='';renderAll();var inp2=$('#revBody tr:last-child .factin');if(inp2)inp2.focus();}
      return true;
    case'revImp':(function(){var f=$('#revFile');if(f){f.value='';f.click();}})();return true;
    case'revImpGo':revImpGo();return true;
    case'revImpNo':r.imp=null;renderAll();return true;
    case'revPtNew':if(c){c.newPt={name:'',address:'',err:''};renderAll();var el=$('#rev-ptn');if(el)el.focus();}return true;
    case'revPtCancel':if(c){c.newPt=null;renderAll();}return true;
    case'revPtMake':
      if(!c||!c.newPt)return true;
      if(!c.newPt.name.trim()){c.newPt.err='Укажите название точки.';renderAll();return true;}
      syPost('dirput',{kind:'pt',j:{name:c.newPt.name,region:c.doc.region,address:c.newPt.address,le:'',active:true}}).then(function(x){
        if(!x||!x.ok){c.newPt.err=(x&&x.msg)||'Не получилось создать точку.';renderAll();return;}
        return drLoad(true).then(function(){c.doc.point=x.item.id;c.newPt=null;flash('Точка «'+x.item.name+'» создана');revDirty();renderAll();});
      },function(e){c.newPt.err=syErrText(e);renderAll();});
      return true;
    case'revTake':
      if(c&&c.conflict){var cf=c.conflict;S.rev.cur=revFromServer({id:c.id,ver:cf.ver,status:cf.status,num:cf.num,by:cf.by,at:cf.at,date:cf.doc.date,point:cf.doc.point,region:cf.doc.region,doc:cf.doc});renderAll();}
      return true;
    case'revMine':
      if(c&&c.conflict){c.ver=c.conflict.ver;c.conflict=null;c.dirty=true;revSave(true).then(function(){renderAll();});}
      return true;
    case'revPrint':revPrint(c);return true;
    case'revXlsx':revXlsx(c);return true;
  }
  if(act==='revOpen'||act==='')return false;
  return false;
}
function revInput(act,t){
  var r=S.rev,c=r.cur,x,v,l;
  switch(act){
    case'revQ':r.q=t.value;(function(){var el=$('#revList');if(el)el.innerHTML=revListHtml();var q=$('#rev-q');if(q){q.focus();try{q.setSelectionRange(q.value.length,q.value.length);}catch(e){}}})();return true;
    case'revAddQ':r.addQ=t.value;(function(){var q=normKey(r.addQ),res=[];if(q)Object.keys(S.ings).forEach(function(id){if(res.length<8&&normKey(S.ings[id].name).indexOf(q)>-1)res.push(id);});var el=$('#revRes');if(el)el.innerHTML=revResHtml(res,q);})();return true;
    case'revH':
      if(!c)return true;
      x=t.getAttribute('data-k');
      if(x==='num'||x==='resp'||x==='note'||x==='date'){if(x==='num')c.num=t.value;else c.doc[x]=t.value;revDirty();revPaintTot();}
      return true;
    case'revB':case'revF':case'revP':
      x=revLineOf(t);if(!x||!c)return true;
      l=x[0];v=revParse(t.value,act==='revB');
      t.classList.toggle('invalid',v!==null&&isNaN(v));
      if(v!==null&&isNaN(v))return true;
      l[act==='revB'?'b':act==='revF'?'f':'p']=v;
      revDirty();revPaintRow(x[1]);revPaintTot();return true;
    case'revPtF2':if(c&&c.newPt)c.newPt[t.getAttribute('data-k')]=t.value;return true;
  }
  return false;
}
function revChange(act,t){
  var r=S.rev,c=r.cur,x,k,pts;
  switch(act){
    case'revSt':r.st=t.value;renderAll();return true;
    case'revReg':r.reg=t.value;r.pt='';renderAll();return true;
    case'revPtF':r.pt=t.value;renderAll();return true;
    case'revU':
      x=revLineOf(t);if(!x)return true;
      x[0].u=t.value;
      if(x[0].s){var g=(x[0].u==='шт'||x[0].u==='уп')?(x[0].g>0?x[0].g:revPackG(x[0].s,c.doc.region)):0;x[0].g=g>0?g:null;if(x[0].p===null||x[0].auto){var np=revPriceFor(x[0].s,x[0].u,x[0].g,c.doc.region);if(np!==null){x[0].p=np;x[0].auto=true;}}}
      revDirty();renderAll();return true;
    case'revH':
      if(!c)return true;
      k=t.getAttribute('data-k');
      if(k==='region'){c.doc.region=t.value;pts=drPtsOf(c.doc.region);c.doc.point=pts.length===1?pts[0].id:'';revDirty();renderAll();}
      else if(k==='point'){c.doc.point=t.value;revDirty();renderAll();}
      return true;
    case'revImpMap':if(r.imp){r.imp.map[t.getAttribute('data-k')]=Number(t.value);renderAll();}return true;
    case'revImpDef':if(r.imp){r.imp.defU=t.value;renderAll();}return true;
    case'revImpFill':if(r.imp){r.imp.fillPrice=!!t.checked;renderAll();}return true;
    case'revImpMode':if(r.imp){r.imp.mode=t.value;renderAll();}return true;
  }
  return false;
}
(function(){
  var f=$('#revFile');
  if(f)f.addEventListener('change',function(){var file=f.files&&f.files[0];if(file&&S.rev.cur)revReadFile(file);});
})();
document.addEventListener('click',function(e){
  var tr=e.target.closest&&e.target.closest('tr.clk[data-id]');
  if(!tr||e.target.closest('button')||!tr.closest('#revList'))return;
  revOpen(tr.getAttribute('data-id'));
});
