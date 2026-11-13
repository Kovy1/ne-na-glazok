/* ---------- Фудкост: экраны «Анализ» и «План», выгрузки ---------- */
var FC_THR=[['unexRub','Необъяснённое отклонение по позиции, ₽ от'],['unexPct','…и доля фактического расхода, % от'],['shortRub','Недостача по ревизии, ₽ от'],['woPct','Списание готового блюда, % от'],['woQty','…и порций не меньше'],['woRub','Списание сырья, ₽ от'],['priceUp','Рост закупочной цены за период, % от'],['priceUpKg','Цена закупки против цены базы, % от'],['supSpread','Разброс цен поставщиков, % от'],['supKg','Объём у поставщика не меньше, кг'],['anomHi','Цена выше базы в … раз и более'],['anomLo','Цена ниже базы в … раз и менее'],['rawShare','Доля сырья в блюде, % от'],['salesShare','…и доля блюда в выручке, % от'],['calcDiff','Расхождение учёта и факта, % от'],['outGap','Расхождение выпуска и продаж, % от']];
function fcWho(){return String(S.sy&&S.sy.cfg&&S.sy.cfg.name||'').trim();}
function fcSelOk(){var s=S.fc.sel;return s.obj&&s.from&&s.to&&s.from<=s.to;}
function fcSrcBlock(refs,total){
  if(!refs||!refs.length)return'<p class="hint">Расчётный показатель: строк документов нет.</p>';
  return'<ul class="fcsrc">'+refs.map(function(r){return'<li>'+esc(fcSrcText(r))+'</li>';}).join('')+'</ul>'+(total>refs.length?'<p class="hint">…и ещё строк: '+(total-refs.length)+'</p>':'');
}
function fcCfgHtml(cfg){
  var edit=fcCanEdit(),dis=edit?'':' disabled',sel=function(k,opts){return'<select data-act="fcCfg" data-k="'+k+'" data-edit'+dis+'>'+opts.map(function(o){return'<option value="'+o[0]+'"'+(String(cfg[k])===o[0]?' selected':'')+'>'+o[1]+'</option>';}).join('')+'</select>';};
  return'<details class="pgroup fccfg"><summary>Настройки расчёта и пороги отклонений</summary>'
    +'<div class="fgrid"><label class="field w280"><span class="lbl">Денежная оценка</span>'+sel('val',[['auto','Цена закупки периода, иначе цена базы'],['receipts','Только цена закупки периода'],['base','Цена базы региона']])+'</label>'
    +'<label class="field w220"><span class="lbl">Закупочные цены</span>'+sel('vatP',[['','основа не задана'],['with','с НДС'],['without','без НДС']])+'</label>'
    +'<label class="field w220"><span class="lbl">Выручка</span>'+sel('vatS',[['','основа не задана'],['with','с НДС'],['without','без НДС']])+'</label>'
    +'<label class="field w220"><span class="lbl">Единая ставка для строк без ставки, %</span><input type="number" min="0" max="30" step="1" data-act="fcCfg" data-k="rate" data-edit'+dis+' value="'+esc(String(cfg.rate))+'"></label>'
    +'<label class="field w280"><span class="lbl">Строки поступлений без ставки НДС</span>'+sel('vatApprox',[['false','не приводить: результат неточный'],['true','приводить по единой ставке (приближение подтверждаю)']])+'</label>'
    +'<label class="field w280"><span class="lbl">Перемещения и возвраты, если колонок в отчёте нет</span>'+sel('noTrans',[['false','не подтверждено: факт не определяется'],['true','за период их не было (подтверждаю)']])+'</label>'
    +'<label class="field w280"><span class="lbl">Возвраты в отчёте «Движение»</span>'+sel('retOut',[['true','возврат поставщику (уменьшает остаток)'],['false','возврат от покупателя (увеличивает остаток)']])+'</label></div>'
    +'<p class="hint">Если в отчёте «Поступления» есть колонки «Ставка НДС» или «Сумма НДС», приведение выполняется по каждой строке и считается точным. Для строк без этих данных единая ставка применяется только после вашего подтверждения, и такой результат везде помечается как приблизительный. Если основа закупок и выручки одна и та же, приведение не требуется.</p>'
    +'<div class="fgrid fcthr">'+FC_THR.map(function(t){return'<label class="field w220"><span class="lbl">'+esc(t[1])+'</span><input type="number" step="any" min="0" data-act="fcCfg" data-k="thr.'+t[0]+'" data-edit'+dis+' value="'+esc(String(cfg.thr[t[0]]))+'"></label>';}).join('')+'</div>'
    +'<p class="hint">Правило не доказывает причину отклонения: оно показывает, что значение вышло за порог. Версия правил '+FC_RULES_VER+', алгоритма '+FC_ALGO+'. Изменение порогов создаёт новую версию плана.</p></details>';
}
function fcAnHtml(){
  var s=S.fc.sel,cfg=fcCfg(),h='',res,items,ids;
  if(!fcSelOk())return'<section class="card"><p class="w-warn">Выберите объект и период.</p></section>';
  res=fcCalc(s.obj,s.from,s.to,cfg);items=fcPlanItems(res);ids=Object.keys(res.ings).sort(function(a,b){var x=res.ings[a].unexplRub,y=res.ings[b].unexplRub;return((y===null?-1e18:y)-(x===null?-1e18:x))||(a<b?-1:1);});
  h+='<section class="card fcan"><h3 class="h3">Баланс и отклонения: '+esc(s.objName)+', '+fcIsoRu(s.from)+' – '+fcIsoRu(s.to)+'</h3>';
  h+=fcCfgHtml(cfg);
  h+='<p class="hint">Данные: '+FC_TYPES_KEYS.map(function(t){return esc(FC_TYPES[t])+' — '+res.have[t];}).join(' · ')+'. Цены: '+esc(res.ver.prices)+'; ТТК: '+esc(res.ver.ttk)+'.</p>';
  h+=res.exact?'<p class="fcok">Ограничений, влияющих на итоги, не выявлено.</p>':'<div class="w-warn fclim"><b>Итоги приблизительные:</b> '+esc(res.exactWhy.join('; '))+'.</div>';
  if(Object.keys(res.dens).length){
    h+='<div class="fclim fcdens"><b>Литры без плотности: строки не вошли в расчёт</b><p class="hint">Введите плотность или осознанно примите допущение «1 л = 1 кг». Изменение запишется в карточку сырья и затронет все расчёты по нему.</p>'
      +Object.keys(res.dens).sort().map(function(id){var d=res.dens[id];return'<div class="fgrid"><span class="field w280">'+esc(d.nm)+' · строк: '+d.n+'</span>'
        +'<label class="field w220"><span class="lbl">Плотность, г/мл</span><input class="num" inputmode="decimal" autocomplete="off" data-act="fcDens" data-id="'+esc(id)+'" data-edit'+(fcCanEdit()?'':' disabled')+' placeholder="например 1,03"></label>'
        +'<button class="btn sm" type="button" data-act="fcDensAsm" data-id="'+esc(id)+'"'+(fcCanEdit()?'':' disabled')+'>Принять 1 л = 1 кг</button></div>';}).join('')+'</div>';
  }
  if(res.limits.length)h+='<div class="fclim"><b>Ограничения расчёта</b><ul>'+res.limits.map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
  h+='<div class="scroll"><table class="fctab fcmet"><thead><tr><th>Показатель</th><th>Значение</th><th></th></tr></thead><tbody>';
  res.metrics.forEach(function(m){
    var v=m.value===null?'<span class="muted">не определено</span>':'<b>'+esc(m.unit==='%'?fcPctT(m.value):fcRubT(m.value))+'</b>',open=S.fc.drill&&S.fc.drill[m.id];
    h+='<tr><td>'+esc(m.label)+(m.note?'<small class="c1sub">'+esc(m.note)+'</small>':'')+'</td><td class="n">'+v+'</td><td><button class="btn mini" data-act="fcDrill" data-id="'+m.id+'">'+(open?'Скрыть':'Как посчитано')+'</button></td></tr>';
    if(open)h+='<tr class="fcdr"><td colspan="3"><p><b>Формула:</b> '+esc(m.formula)+'</p>'+fcSrcBlock(fcRefs(m.src,30),fcRefs(m.src,100000).length)+'</td></tr>';
  });
  h+='</tbody></table></div>';
  h+='<h4 class="h4">По сырью</h4><div class="scroll"><table class="fctab fcing"><thead><tr><th>Сырьё</th><th>Теоретич., кг</th><th>Учётный, кг</th><th>Факт, кг</th><th>Списания, кг</th><th>Внутр., кг</th><th>Недостача, кг</th><th>Необъясн., кг</th><th>Необъясн., ₽</th><th>Количество, ₽</th><th>Цена, ₽</th><th></th></tr></thead><tbody>';
  ids.forEach(function(id){
    var e=res.ings[id],n3=function(v){return v===null||v===undefined?'<span class="muted">—</span>':fcSp(v,2);},open=S.fc.drill&&S.fc.drill['i:'+id];
    h+='<tr><td>'+esc(e.name)+'</td><td class="n">'+n3(e.th.kg)+'</td><td class="n">'+n3(e.book)+'</td><td class="n">'+n3(e.actual)+'</td><td class="n">'+n3(e.wo.kg+(e.dwo||0))+'</td><td class="n">'+n3(e.it.kg+(e.din||0))+'</td><td class="n">'+n3(e.rv.short||0)+'</td><td class="n">'+n3(e.unexpl)+'</td><td class="n">'+(e.unexplRub===null?'<span class="muted">—</span>':fcSp(e.unexplRub,0))+'</td><td class="n">'+(e.qtyEff===undefined?'<span class="muted">—</span>':fcSp(e.qtyEff,0))+'</td><td class="n">'+(e.priceEff===undefined?'<span class="muted">—</span>':fcSp(e.priceEff,0))+'</td><td><button class="btn mini" data-act="fcDrill" data-id="i:'+esc(id)+'">'+(open?'Скрыть':'Состав')+'</button></td></tr>';
    if(open){
      var ex='<ul class="fcsrc"><li>Теоретический расход = Σ проданных порций × расход сырья по ТТК = '+esc(fcKgT(e.th.kg))+'</li>'
        +(e.book!==null?'<li>Учётный расход = нач. '+fcSp(e.mv.open,3)+' + приход '+fcSp(e.mv['in'],3)+(res.cfg.retOut?' − возвраты ':' + возвраты ')+fcSp(e.mv.ret,3)+' + перемещ. вход '+fcSp(e.mv.tin,3)+' − перемещ. выход '+fcSp(e.mv.tout,3)+' − кон. '+fcSp(e.mv.close,3)+' = '+esc(fcKgT(e.book))+(e.mv.verified===true?' (баланс отчёта сошёлся)':(e.mv.verified===false?' (баланс отчёта НЕ сошёлся: расход по отчёту '+fcSp(e.mv.out,3)+')':' (расход в отчёте не указан: баланс не проверен)'))+'</li>':'')
        +(e.actual!==null?'<li>Фактический расход = '+esc(e.actualNote)+' = '+esc(fcKgT(e.actual))+'</li>':'<li>Фактический расход не определён: нет ревизий с фактом на обе границы периода.</li>')
        +(e.qtyEff!==undefined?'<li>Количество = (расход '+e.cmpBasis+' − теоретический) × цена базы = '+fcRubT(e.qtyEff)+'; цена = (цена закупки − цена базы) × расход = '+fcRubT(e.priceEff)+'; вместе = '+fcRubT(e.totEff)+'</li>':'')
        +'<li>Цена для оценки: '+esc(e.priceSrc)+(e.price!==null?', '+fcSp(e.price,2)+' ₽/кг':', неизвестна')+'</li></ul>';
      var rows=[].concat(e.th.src,e.mv.src,e.rv.src,e.wo.src,e.it.src,e.rec.src);
      h+='<tr class="fcdr"><td colspan="12">'+ex+'<p><b>Строки документов:</b></p>'+fcSrcBlock(fcRefs(rows,30),fcRefs(rows,100000).length)+'</td></tr>';
    }
  });
  h+='</tbody></table></div>';
  var nw=fcNetwork(s.from,s.to,cfg);
  if(nw.rows.length>1){
    h+='<h4 class="h4">Сеть за период</h4><div class="scroll"><table class="fctab fcwrap"><thead><tr><th>Объект</th><th>Выручка</th><th>Теоретич. расход</th><th>Факт. расход</th><th>Доля по рецептуре</th><th>Фактический фудкост</th></tr></thead><tbody>'
      +nw.rows.map(function(r){return'<tr><td>'+esc(r.name)+'</td><td class="n">'+fcRubT(r.rev)+'</td><td class="n">'+fcRubT(r.th)+'</td><td class="n">'+fcRubT(r.act)+'</td><td class="n">'+fcPctT(r.fcRec)+'</td><td class="n">'+fcPctT(r.fcAct)+'</td></tr>';}).join('')
      +'<tr><th>Сеть</th><td></td><td></td><td></td><td class="n"><b>'+fcPctT(nw.fcRec)+'</b></td><td class="n"><b>'+fcPctT(nw.fcAct)+'</b></td></tr></tbody></table></div><p class="hint">'+esc(nw.formula)+'.'+(nw.mixedPrices?' Объекты оценены по разным ценам (закупка периода и база): сравнение приблизительное.':'')+(nw.excluded.length?' Не вошли: '+esc(nw.excluded.map(function(x){return x.name+' — '+x.why;}).join('; '))+'.':'')+'</p>';
  }
  h+='<p class="hint">Недостачи и излишки из ревизий показаны отдельно; недостача уже входит в фактический расход и повторно не прибавляется. Необъяснённое отклонение = фактический расход − теоретический − списания − внутреннее потребление. Расход «Количество» и «Цена» складываются в общую разницу и не пересекаются.</p>';
  h+='<p><b>Найдено отклонений по правилам: '+items.length+'.</b> <button class="btn" data-act="fcView" data-v="plan">Перейти к плану мероприятий</button></p></section>';
  return h;
}
/* ---------- план ---------- */
function fcUserOpts(cur){
  var u=(S.fc.users&&S.fc.users.length?S.fc.users:(S.sy&&S.sy.us&&S.sy.us.list)||[]),seen={},o=[],me=fcWho(),mid=fcMyId();
  u.forEach(function(x){if(x.st!=='отключён'&&!seen[x.id]){seen[x.id]=1;o.push({id:x.id,name:x.name});}});
  if(me&&mid&&!seen[mid])o.push({id:mid,name:me});
  if(cur&&cur.t==='user'&&!o.some(function(x){return x.id===cur.id;}))o.push({id:cur.id,name:cur.name});
  return o.sort(function(a,b){return a.name<b.name?-1:(a.name>b.name?1:0);});
}
function fcPlanHtml(){
  var s=S.fc.sel,pl,m,v,cur,fp,res,h='',edit=fcCanEdit(),ver;
  if(!fcSelOk())return'<section class="card"><p class="w-warn">Выберите объект и период.</p></section>';
  pl=fcPlanOf(s.obj,s.from,s.to);
  if(S.sy&&syLinked&&syLinked()&&syAdmin()&&S.sy.us&&!S.sy.us.list&&!S.sy.us.busy&&typeof usReload==='function')usReload();
  if(!pl)return'<section class="card fcplan"><h3 class="h3">План мероприятий</h3><p>План по объекту «'+esc(s.objName)+'» за '+fcIsoRu(s.from)+' – '+fcIsoRu(s.to)+' ещё не построен. Он собирается по расчёту из раздела «Анализ» и сохраняется: при повторном открытии показывается сохранённая версия, сроки не сдвигаются.</p><div class="btns"><button class="btn primary" data-act="fcBuild" data-edit'+(edit?'':' disabled')+'>Построить план</button></div></section>';
  ver=S.fc.planVer&&S.fc.planVer[pl.id]||pl.versions[pl.versions.length-1].n;
  if(!pl.versions.some(function(x){return x.n===ver;}))ver=pl.versions[pl.versions.length-1].n;
  m=fcPlanModel(pl,ver,s.dlView);v=pl.versions.filter(function(x){return x.n===ver;})[0];
  var latest=ver===pl.versions[pl.versions.length-1].n;
  res=fcCalc(s.obj,s.from,s.to,fcCfg());fp=fcFp(res);
  var changed=fp.fp!==pl.versions[pl.versions.length-1].fp,oldRules=v.algo!==FC_ALGO||v.rules!==FC_RULES_VER;
  h+='<section class="card fcplan"><h3 class="h3">План мероприятий: '+esc(m.obj)+', '+esc(m.period)+'</h3>';
  h+='<div class="fgrid"><label class="field w220"><span class="lbl">Версия</span><select data-act="fcVer">'+pl.versions.map(function(x){return'<option value="'+x.n+'"'+(x.n===ver?' selected':'')+'>Версия '+x.n+' от '+fcIsoRu(x.at)+'</option>';}).join('')+'</select></label>'
    +'<div class="btns"><button class="btn" data-act="fcDl">Скачать план</button></div></div>';
  if(S.fc.dlOpen){
    var dm=fcDlMode(pl),fixD=fcIsoRu(v.stFixAt||v.at);
    h+='<fieldset class="fcdl fcmode"><legend>Какое состояние выполнения включить в файл</legend>'
      +'<label class="rad"><input type="radio" name="fcMode" data-act="fcMode" value="fixed"'+(dm==='fixed'?' checked':'')+(v.stFix?'':' disabled')+'> Зафиксированная версия — ответственные, сроки и статусы на момент фиксации ('+esc(fixD)+')</label>'
      +'<label class="rad"><input type="radio" name="fcMode" data-act="fcMode" value="current"'+(dm==='current'?' checked':'')+'> С текущим состоянием выполнения — на '+esc(fcIsoRu(fcToday()))+'</label>'
      +(v.stFix?'':'<p class="hint">Для этой версии состояние на момент фиксации не сохранено: доступно только текущее.</p>')
      +'<p class="hint">В документе указаны выбранный режим и дата состояния. Состав мероприятий и расчёт берутся из сохранённой версии '+v.n+', план при скачивании не пересчитывается.</p></fieldset>'
      +'<div class="btns fcdl"><button class="btn" data-act="fcDlWord">Word — для редактирования и согласования</button><button class="btn" data-act="fcDlXls">Excel — для контроля мероприятий</button><button class="btn" data-act="fcDlPdf">PDF — файл</button><button class="btn" data-act="fcDlPrint">Печать из браузера</button></div>';
  }
  h+='<p class="hint">'+esc(m.verTxt)+' · план создан '+esc(m.created)+' · отпечаток данных '+esc(m.fp)+' · '+esc(m.algo)+' · цены: '+esc(m.price)+'. '+esc(m.ttk)+'.</p>';
  if(!latest)h+='<p class="w-warn">Открыта прежняя версия: показано состояние мероприятий на момент её фиксации'+(v.stFix?' ('+esc(fcIsoRu(v.stFixAt||v.at))+')':' (оно не сохранено, показано текущее)')+'. Менять можно только последнюю версию; текущее выполнение — в ней.</p>';
  h+='<p class="hint fcsnapnote"><b>Данные расчёта — на дату построения версии'+(v.at?' ('+esc(fcIsoRu(v.at))+')':'')+'.</b> Цены базы, единицы, плотности и ТТК в снимке относятся к этой дате, а не к самому периоду: прошлые значения задним числом приложение не хранит.</p>';
  h+=fcSnapHtml(pl,v);
  if(latest&&changed)h+='<div class="w-warn">Данные или настройки изменились после построения этой версии. План остаётся прежним, пока вы не построите новую версию. <button class="btn mini" data-act="fcBuild" data-edit'+(edit?'':' disabled')+'>Построить новую версию</button></div>';
  if(latest&&!changed&&oldRules)h+='<div class="w-warn">План построен по прежним правилам (версия '+v.rules+'). <button class="btn mini" data-act="fcRebuild" data-edit'+(edit?'':' disabled')+'>Пересчитать по новым правилам</button></div>';
  if(latest&&changed&&oldRules)h+='<p><button class="btn mini" data-act="fcRebuild" data-edit'+(edit?'':' disabled')+'>Пересчитать по новым правилам</button></p>';
  h+='<details class="pgroup"'+(m.ver>1?' open':'')+'><summary>Что изменилось в версии '+m.ver+'</summary><ul>'+m.diff.map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul></details>';
  h+='<p><b>Потенциальная экономия (расчётная): '+esc(fcRubT(m.eff.pot))+'</b> по '+m.eff.groups+' группам с определяемым итогом'+(m.eff.partial?'. Ещё '+m.eff.und.length+' групп без общего итога: показаны отдельные оценки, суммарная экономия по ним не обещается':'')+'.</p>';
  h+='<details class="pgroup fceffg"><summary>Состав групп эффекта</summary><ul>'+(m.eff.groupsInfo||[]).map(function(x){return'<li>'+esc(x.name+': '+x.how+(x.det?' → '+fcRubT(x.tot):''))+'</li>';}).join('')+'</ul></details>';
  h+='<ul class="fcnotes">'+fcModelNotes(m).map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul>';
  if(m.limits.length)h+='<div class="fclim"><b>Ограничения расчёта</b><ul>'+m.limits.map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul></div>';
  h+='<div class="scroll"><table class="fctab fcwrap"><thead><tr><th>Показатель</th><th>Значение</th><th>Расчёт</th></tr></thead><tbody>'+m.metrics.map(function(x){return'<tr><td>'+esc(x.l)+'</td><td class="n">'+esc(x.v)+'</td><td>'+esc(x.f)+(x.note?' <small class="c1sub">'+esc(x.note)+'</small>':'')+'</td></tr>';}).join('')+'</tbody></table></div>';
  if(!m.items.length)h+='<p>Отклонений по правилам не выявлено.</p>';
  m.items.forEach(function(i){h+=fcItemHtml(pl,i,latest&&edit&&m.mode==='current',latest&&m.mode==='current'&&fcCanAct(pl,i.id),m.mode==='fixed'&&v.stFix?v.stFix[i.id]:null);});
  if(latest&&m.stale.length){
    h+='<h4 class="h4">Больше не выявляются</h4><p class="hint">Ситуация по этим мероприятиям в новых данных не найдена. Закройте или отправьте в архив: история и комментарии сохранятся.</p>';
    m.stale.forEach(function(x){h+='<div class="fcm stale"><b>'+esc(x.title)+'</b> · '+esc(x.asg)+' · '+esc(x.st)+' <button class="btn mini" data-act="fcClose" data-mid="'+x.id+'" data-edit'+(edit?'':' disabled')+'>Закрыть</button> <button class="btn mini" data-act="fcArch" data-mid="'+x.id+'" data-edit'+(edit?'':' disabled')+'>В архив</button></div>';});
  }
  return h+'</section>';
}
function fcItemHtml(pl,i,can,actOk,st){
  var s=st||pl.state[i.id],dis=can?'':' disabled',disA=(can||actOk)?'':' disabled',a=s.asg,users=fcUserOpts(a),h;
  var sel='<option value="">Ответственный не назначен</option>'+users.map(function(u){return'<option value="u:'+esc(u.id)+'"'+(a&&a.t==='user'&&a.id===u.id?' selected':'')+'>'+esc(u.name)+'</option>';}).join('')+(a&&a.t==='manual'?'<option value="m" selected>'+esc(fcAsgTxt(a))+'</option>':'')+'<option value="__man__">Указать участника вне приложения…</option>';
  h='<article class="fcm" id="m-'+i.id+'"><h4 class="h4">'+i.n+'. '+esc(i.title)+'</h4><p><span class="tstat '+(i.hyp?'warn':'ok')+'">'+esc(i.basis)+'</span> <span class="tstat neutral">Приоритет: '+esc(i.pri.toLowerCase())+'</span> <span class="tstat neutral">'+esc(i.st)+'</span></p>';
  h+='<div class="scroll"><table class="fctab fcitem"><tbody>'+fcItemRows(i).map(function(r){
    if(r[0]==='Назначенный исполнитель')return'<tr><th>'+r[0]+'</th><td><select data-act="fcAsg" data-mid="'+i.id+'" data-edit'+dis+' aria-label="Исполнитель">'+sel+'</select>'+(S.fc.manFor===i.id?'<div class="fgrid"><label class="field w280"><span class="lbl">Имя участника</span><input type="text" id="fcManName" maxlength="80" data-edit'+dis+'></label><div class="btns"><button class="btn mini" data-act="fcAsgMan" data-mid="'+i.id+'" data-edit'+dis+'>Назначить</button></div></div><p class="hint">Участник без доступа к приложению: он сможет увидеть план только в выгрузке.</p>':'')+'<small class="c1sub">'+esc(i.role?'Предлагаемая роль: '+i.role:'')+'</small></td></tr>';
    if(r[0]==='Срок')return'<tr><th>Срок</th><td><input type="date" data-act="fcDue" data-mid="'+i.id+'" data-edit'+dis+' value="'+esc(s.due||s.dueSug)+'"> <small class="c1sub">'+esc(r[1])+'</small></td></tr>';
    if(r[0]==='Статус')return'<tr><th>Статус</th><td><select data-act="fcSt" data-mid="'+i.id+'" data-pl="'+esc(pl.id)+'"'+disA+'>'+Object.keys(FC_ST).map(function(k){return'<option value="'+k+'"'+(s.st===k?' selected':'')+'>'+FC_ST[k]+'</option>';}).join('')+'</select>'+fcConfHtml(s,i.id,pl.id)+'</td></tr>';
    if(r[0]==='Комментарии')return'<tr><th>Комментарии</th><td>'+esc(r[1]).replace(/\n/g,'<br>')+'<div class="fgrid"><label class="field grow"><span class="lbl">Новый комментарий</span><input type="text" id="fcCm-'+i.id+'" maxlength="300"'+disA+'></label><div class="btns"><button class="btn mini" data-act="fcCm" data-mid="'+i.id+'" data-pl="'+esc(pl.id)+'"'+disA+'>Добавить</button></div></div></td></tr>';
    if(r[0]==='Результат последующей проверки')return'<tr><th>'+r[0]+'</th><td><textarea rows="2" maxlength="600" data-act="fcRes" data-mid="'+i.id+'" data-pl="'+esc(pl.id)+'"'+disA+' aria-label="Результат проверки">'+esc(s.result||'')+'</textarea><label class="field w220"><span class="lbl">Подтверждённое снижение затрат, ₽ (вносит пользователь)</span><input type="number" min="0" step="any" data-act="fcReal" data-mid="'+i.id+'" data-edit'+dis+' value="'+(s.real===null||s.real===undefined?'':esc(String(s.real)))+'"></label>'+(i.fu?'<p class="hint">'+esc(i.fu)+'</p>':'')+'</td></tr>';
    return'<tr><th>'+esc(r[0])+'</th><td>'+esc(r[1]).replace(/\n/g,'<br>')+'</td></tr>';
  }).join('')+'</tbody></table></div></article>';
  return h;
}
/* ---------- события ---------- */
function fcMark(mid,txt,fn,plId){
  var pl=plId?S.fc.plans[plId]:fcPlanOf(S.fc.sel.obj,S.fc.sel.from,S.fc.sel.to),st;
  if(!pl||!(st=pl.state[mid]))return;
  fn(st);
  if(txt)(st.hist=st.hist||[]).push({k:fcKey(),at:fcToday(),by:fcWho(),t:txt});
  fcPut('plans');
}
function fcClick2(act,b){
  var s=S.fc,sl=s.sel,mid=b.getAttribute&&b.getAttribute('data-mid'),pl,r,x;
  switch(act){
    case'fcDensAsm':(function(){var id=b.getAttribute('data-id'),g=S.ings[id];if(!fcCanEdit()||!g){roFlash();return;}g.densAsm=1;queueSave('ingredients',id);flash('Допущение 1 л = 1 кг принято для «'+g.name+'»');renderAll();})();return true;
    case'fcDrill':s.drill=s.drill||{};s.drill[b.getAttribute('data-id')]=!s.drill[b.getAttribute('data-id')];renderAll();return true;
    case'fcBuild':case'fcRebuild':
      if(!fcCanEdit()){roFlash();return true;}
      r=fcPlanBuild(sl.obj,sl.from,sl.to,act==='fcRebuild');
      s.planVer=s.planVer||{};s.planVer[r.plan.id]=r.plan.versions[r.plan.versions.length-1].n;
      flash(r.created?(r.why==='first'?'План построен: версия 1':'Построена версия '+r.plan.versions.length):'Данные и правила те же: возвращена сохранённая версия');
      renderAll();return true;
    case'fcDl':s.dlOpen=!s.dlOpen;renderAll();return true;
    case'fcDlWord':case'fcDlXls':case'fcDlPdf':case'fcDlPrint':
      pl=fcPlanOf(sl.obj,sl.from,sl.to);if(!pl||pl.limited)return true;
      x=fcPlanModel(pl,s.planVer&&s.planVer[pl.id],fcDlMode(pl));if(!x)return true;
      if(act==='fcDlWord')exportFile(fcPlanDocx(x),fcPlanFile(x,'docx'));
      else if(act==='fcDlXls')exportFile(fcPlanXlsx(x),fcPlanFile(x,'xlsx'));
      else if(act==='fcDlPdf')fcPlanPdfSave(x);
      else fcPlanPrint(x);
      return true;
    case'fcSyncNow':fcSync().then(function(r){if(r&&r.ok)flash('Синхронизировано');else if(r&&r.errs&&r.errs.length)flash('Не синхронизировано: '+r.errs[0]);});return true;
    case'fcConfClr':if(mid&&b.getAttribute('data-pl')){var q=S.fc.plans[b.getAttribute('data-pl')];if(q&&q.state[mid]){delete q.state[mid].conf;fcPut('plans');}}else S.fc.sy.conf=[];fcPut('sy');renderAll();return true;
    case'fcBkSave':fcBackupPack().then(function(txt){exportFile(txt,'Фудкост копия аналитики '+fcToday()+'.json');},function(){flash('Не удалось собрать копию');});return true;
    case'fcBkPick':if(!fcCanEdit()){roFlash();return true;}(function(){var f=$('#fcBkFile');if(f){f.value='';f.click();}})();return true;
    case'fcAdopt':fcAdoptLocal().then(function(r){flash(r.ok?'Локальные данные добавлены в вашу учётную запись':r.msg);renderAll();});return true;
    case'fcVerify':(function(){pl=S.fc.plans[b.getAttribute('data-pl')];if(!pl)return;fcSnapVerify(pl,Number(b.getAttribute('data-n'))).then(function(r){S.fc.vfy=S.fc.vfy||{};S.fc.vfy[pl.id+':'+b.getAttribute('data-n')]=r;renderAll();});})();return true;
    case'fcAsgMan':(function(){var el=$('#fcManName'),nm=el?String(el.value).replace(/\s+/g,' ').trim():'';if(!fcCanEdit()){roFlash();return;}if(!nm){flash('Введите имя участника');return;}fcMark(mid,'Назначен участник вне приложения: '+nm,function(st){st.asg={t:'manual',name:nm.slice(0,80)};});s.manFor='';renderAll();})();return true;
    case'fcCm':(function(){var el=$('#fcCm-'+mid),t=el?String(el.value).trim():'';var pid=b.getAttribute('data-pl')||'',pp=pid?S.fc.plans[pid]:fcPlanOf(sl.obj,sl.from,sl.to);if(!pp||!fcCanAct(pp,mid)){roFlash();return;}if(!t){flash('Введите комментарий');return;}fcMark(mid,'',function(st){st.cm=st.cm||[];st.cm.push({k:fcKey(),at:fcToday(),by:fcWho(),t:t.slice(0,300)});},pid);renderAll();})();return true;
    case'fcClose':case'fcArch':
      if(!fcCanEdit()){roFlash();return true;}
      fcMark(mid,act==='fcClose'?'Закрыто: ситуация в новых данных не выявляется':'Отправлено в архив: ситуация в новых данных не выявляется',function(st){st.st=act==='fcClose'?'closed':'arch';});renderAll();return true;
  }
  return false;
}
function fcChange2(act,t){
  var s=S.fc,sl=s.sel,mid=t.getAttribute&&t.getAttribute('data-mid'),v=t.value,pl;
  switch(act){
    case'fcDens':(function(){var id=t.getAttribute('data-id'),g=S.ings[id],p=parseNum(t.value);if(!fcCanEdit()||!g){roFlash();return;}if(!(p.ok&&p.v>=0.2&&p.v<=3)){flash('Плотность — число от 0,2 до 3 г/мл');renderAll();return;}g.dens=Math.round(p.v*1000)/1000;delete g.densAsm;queueSave('ingredients',id);flash('Плотность «'+g.name+'»: '+g.dens+' г/мл');renderAll();})();return true;
    case'fcCfg':(function(){var k=t.getAttribute('data-k');if(!fcCanEdit()){roFlash();return;}if(k==='retOut'||k==='vatApprox'||k==='noTrans')v=(v==='true');else if(k==='rate'||k.indexOf('thr.')===0){v=Number(v);if(!isFinite(v)||v<0){flash('Введите число не меньше нуля');renderAll();return;}}fcCfgSet(k,v);renderAll();})();return true;
    case'fcVer':pl=fcPlanOf(sl.obj,sl.from,sl.to);if(pl){s.planVer=s.planVer||{};s.planVer[pl.id]=Number(v);}renderAll();return true;
    case'fcAsg':
      if(!fcCanEdit()){roFlash();renderAll();return true;}
      if(v==='__man__'){s.manFor=mid;renderAll();return true;}
      if(v==='m')return true;
      fcMark(mid,v===''?'Исполнитель снят: ответственный не назначен':'Назначен исполнитель: '+t.options[t.selectedIndex].text,function(st){
        if(v==='')st.asg=null;else{var id=v.slice(2);st.asg={t:'user',id:id,name:t.options[t.selectedIndex].text};}
      });renderAll();return true;
    case'fcDue':if(!fcCanEdit()){roFlash();return true;}fcMark(mid,v?'Срок выбран пользователем: '+fcIsoRu(v):'Срок сброшен к предложенному',function(st){st.due=isIso(v)?v:'';});renderAll();return true;
    case'fcSt':(function(){var pid=t.getAttribute('data-pl')||'',pp=pid?S.fc.plans[pid]:fcPlanOf(sl.obj,sl.from,sl.to);if(!pp||!fcCanAct(pp,mid)||!FC_ST[v]){roFlash();renderAll();return;}fcMark(mid,'Статус: '+FC_ST[v],function(st){st.st=v;},pid);renderAll();})();return true;
    case'fcRes':(function(){var pid=t.getAttribute('data-pl')||'',pp=pid?S.fc.plans[pid]:fcPlanOf(sl.obj,sl.from,sl.to);if(!pp||!fcCanAct(pp,mid)){roFlash();return;}fcMark(mid,'',function(st){st.result=String(v).slice(0,600);},pid);})();return true;
    case'fcMode':s.dlMode=v==='fixed'?'fixed':'current';renderAll();return true;
    case'fcReal':if(!fcCanEdit()){roFlash();return true;}fcMark(mid,'',function(st){var x=Number(v);st.real=(v===''||!isFinite(x)||x<0)?null:x;});renderAll();return true;
  }
  return false;
}
/* ---------- выгрузки: одна модель — экран, Word, Excel, PDF ---------- */
function fcDlMode(pl){var s=S.fc,vn=(s.planVer&&s.planVer[pl.id])||pl.versions[pl.versions.length-1].n,last=pl.versions[pl.versions.length-1].n===vn;return s.dlMode||(last?'current':'fixed');}
function fcPlanFile(m,ext){return String('План мероприятий '+m.obj+' '+m.period+' версия '+m.ver+(m.mode==='fixed'?' зафиксированная':' с текущим состоянием')).replace(/[\\\/:*?"<>|]+/g,'_').replace(/\s+/g,' ')+'.'+ext;}
function fcHeadRows(m){return[['Объект',m.obj],['Период',m.period],['Версия',m.verTxt+' (версий: '+m.vers+')'],['Режим документа',m.modeName],['Состояние выполнения на',m.stDate],['План создан',m.created],['Отпечаток входных данных',m.fp],['Алгоритм',m.algo],['Денежная оценка',m.price],['Основа НДС',m.basis],['Исходные данные расчёта',m.snap?'Снимок на '+m.created+': цены базы, единицы, плотности и ТТК взяты на дату построения версии и не являются подтверждёнными данными самого периода. Цены закупок из загруженных отчётов относятся к периоду.':'Снимок исходных данных не сохранён'],['Точность итогов',m.exact?'Ограничений, влияющих на итоги, нет':'Приблизительно: '+m.exactWhy.join('; ')],['Потенциальная экономия (расчётная)',fcEffHead(m)],['Состав групп эффекта',fcEffGroupsText(m)]];}
function fcDocP(t,o){return dPara([{t:t,b:o&&o.b,sz:o&&o.sz||20}],{before:o&&o.before||0,after:o&&o.after||40,keepNext:o&&o.keep});}
function fcDocCell(w,text,bold,fill){
  var ps=String(text==null?'':text).split('\n').map(function(l){return dPara([{t:l,b:bold,sz:19}],{after:20});}).join('');
  return dCell(w,ps||dPara([]));
}
function fcPlanDocx(m){
  var W=10466,b=[],i;
  b.push(dPara([{t:m.title,b:true,sz:32}],{al:'center',after:120}));
  b.push(dTable([3000,W-3000],fcHeadRows(m).map(function(r){return dRow([fcDocCell(3000,r[0],true),fcDocCell(W-3000,r[1])]);})));
  b.push(fcDocP('Примечания',{b:true,before:160,keep:true}));
  fcModelNotes(m).forEach(function(x){b.push(fcDocP('• '+x));});
  if(m.limits.length){b.push(fcDocP('Ограничения расчёта',{b:true,before:160,keep:true}));m.limits.forEach(function(x){b.push(fcDocP('• '+x));});}
  b.push(fcDocP('Что изменилось в версии '+m.ver,{b:true,before:160,keep:true}));m.diff.forEach(function(x){b.push(fcDocP('• '+x));});
  b.push(fcDocP('Показатели',{b:true,before:160,keep:true}));
  b.push(dTable([3300,2000,W-5300],[dRow([fcDocCell(3300,'Показатель',true),fcDocCell(2000,'Значение',true),fcDocCell(W-5300,'Расчёт',true)],{header:true})].concat(m.metrics.map(function(x){return dRow([fcDocCell(3300,x.l),fcDocCell(2000,x.v),fcDocCell(W-5300,x.f+(x.note?' ('+x.note+')':''))]);}))));
  b.push(fcDocP('Мероприятия',{b:true,before:200,keep:true}));
  if(!m.items.length)b.push(fcDocP('Отклонений по правилам не выявлено.'));
  m.items.forEach(function(it){
    b.push(fcDocP(it.n+'. '+it.title,{b:true,before:160,keep:true}));
    b.push(dTable([2600,W-2600],fcItemRows(it).map(function(r){return dRow([fcDocCell(2600,r[0],true),fcDocCell(W-2600,r[1])]);})));
  });
  if(m.stale.length){b.push(fcDocP('Больше не выявляются',{b:true,before:160,keep:true}));m.stale.forEach(function(x){b.push(fcDocP('• '+x.title+' — '+x.asg+', '+x.st));});}
  var sect='<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';
  return docxPack('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+b.join('')+sect+'</w:body></w:document>',m.title+' '+m.obj);
}
function fcPlanXlsx(m){
  var plan=[['№','Идентификатор','Мероприятие','Основание','Приоритет','Ситуация','Подтверждающие показатели','Строки документов','Возможные причины','Необходимая проверка','Рекомендуемое действие','Предлагаемая роль','Назначенный исполнитель','Срок','Статус','Ожидаемый эффект и допущения','Критерий выполнения','Комментарии','История изменений','Результат последующей проверки']];
  var rows=m.items.map(function(i){return[String(i.n),i.id,i.title,i.basis,i.pri+'. '+i.why,i.sit,i.ev.join('\n'),i.src.length?i.src.join('\n'):'не привязаны к строкам (расчётный показатель)',i.causes.join('; '),i.check,i.act,i.role,i.asg,i.due,i.st,i.eff,i.crit,i.cm.length?i.cm.join('\n'):'нет',i.hist.length?i.hist.join('\n'):'нет',(i.result||'не внесён')+(i.real!==null&&i.real!==undefined?'\nПодтверждённое снижение затрат (внесено пользователем): '+fcRubT(i.real):'')+(i.fu?'\n'+i.fu:'')];});
  var fm=plan[0].map(function(){return'wrap';});
  var tabs=[{name:'Мероприятия',title:m.title+': '+m.obj+', '+m.period+', '+m.verTxt,note:'Гипотезы отмечены в колонке «Основание». Потенциальная экономия — расчётная оценка. Файл — сохранённая версия плана, а не новый расчёт.',head:plan[0],fmt:fm,widths:[40,110,260,130,260,380,380,380,260,300,300,130,200,200,110,300,260,300,300,300],rows:rows},
    {name:'Показатели',title:'Показатели: '+m.obj+', '+m.period+', '+m.verTxt,note:'Значения и формулы сохранённой версии.',head:['Показатель','Значение','Расчёт'],fmt:['wrap','wrap','wrap'],widths:[300,160,520],rows:m.metrics.map(function(x){return[x.l,x.v,x.f+(x.note?' ('+x.note+')':'')];})},
    {name:'Реквизиты',title:'Реквизиты плана',note:'Ограничения, примечания и изменения относительно предыдущей версии.',head:['Показатель','Значение'],fmt:['wrap','wrap'],widths:[240,680],rows:fcHeadRows(m).concat(fcModelNotes(m).map(function(x){return['Примечание',x];}),m.limits.map(function(x){return['Ограничение расчёта',x];}),m.diff.map(function(x){return['Изменение версии',x];}),m.stale.map(function(x){return['Больше не выявляется',x.title+' — '+x.asg+', '+x.st];}))}];
  return xlsxPack(tabs);
}
function fcPlanPrintHtml(m){
  var h='<div class="rvp"><h1>'+esc(m.title)+'</h1><table class="rvp-meta">'+fcHeadRows(m).map(function(r){return'<tr><th>'+esc(r[0])+'</th><td>'+esc(r[1])+'</td></tr>';}).join('')+'</table>';
  h+='<p><b>Примечания</b></p><ul>'+fcModelNotes(m).map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul>';
  if(m.limits.length)h+='<p><b>Ограничения расчёта</b></p><ul>'+m.limits.map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul>';
  h+='<p><b>Что изменилось в версии '+m.ver+'</b></p><ul>'+m.diff.map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+'</ul>';
  h+='<p><b>Показатели</b></p><table class="rvp-t"><thead><tr><th>Показатель</th><th>Значение</th><th>Расчёт</th></tr></thead><tbody>'+m.metrics.map(function(x){return'<tr><td>'+esc(x.l)+'</td><td>'+esc(x.v)+'</td><td>'+esc(x.f+(x.note?' ('+x.note+')':''))+'</td></tr>';}).join('')+'</tbody></table>';
  h+='<p><b>Мероприятия</b></p>'+(m.items.length?'':'<p>Отклонений по правилам не выявлено.</p>');
  m.items.forEach(function(i){h+='<h2>'+i.n+'. '+esc(i.title)+'</h2><table class="rvp-meta fcp-item">'+fcItemRows(i).map(function(r){return'<tr><th>'+esc(r[0])+'</th><td>'+esc(r[1]).replace(/\n/g,'<br>')+'</td></tr>';}).join('')+'</table>';});
  if(m.stale.length)h+='<p><b>Больше не выявляются</b></p><ul>'+m.stale.map(function(x){return'<li>'+esc(x.title+' — '+x.asg+', '+x.st)+'</li>';}).join('')+'</ul>';
  return h+'</div>';
}
function fcPlanPrint(m){
  var root=document.getElementById('rvPrintRoot'),done;
  if(!root){root=document.createElement('div');root.id='rvPrintRoot';document.body.appendChild(root);}
  root.innerHTML=fcPlanPrintHtml(m);
  document.body.classList.add('rv-printing');
  done=function(){document.body.classList.remove('rv-printing');window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  try{window.print();}catch(e){done();flash('Печать здесь недоступна. Скачайте Word или Excel.');}
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{effects:fcEffects,planBuild:fcPlanBuild,canEdit:fcCanEdit,planHtml:fcPlanHtml,planOf:fcPlanOf,planModel:fcPlanModel,planDocx:fcPlanDocx,planXlsx:fcPlanXlsx,planPrintHtml:fcPlanPrintHtml,itemRows:fcItemRows,planItems:fcPlanItems,rules:fcRules,fp:fcFp,mark:fcMark,cfgSet:fcCfgSet,unzip:function(b,n){return unzipEntry(b,n);}});}catch(e){}
