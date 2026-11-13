/* ---------- выгрузка ревизии: XLSX и печатная форма (версия 26) ----------
   В отчёт идёт снимок, записанный при завершении: номер, дата, регион, точка, юридическое лицо, ответственный, строки, итоги
   недостач и излишков отдельно, комментарий и места для подписей. Печатная форма — обычная печать страницы: «Сохранить как PDF»
   выбирается в окне печати браузера. Форма произвольная и унифицированной не называется. */
function revSnapOf(c){
  var d=c.doc,sn=d.snap,done=c.status==='done',pt;
  /* завершённый документ — только из записанного снимка: пустое поле остаётся пустым и не подменяется текущим справочником */
  if(done){
    sn=sn||{};
    return{
      num:revHas(sn.num)?sn.num:c.num,date:revHas(sn.date)?sn.date:d.date,resp:revHas(sn.resp)?sn.resp:d.resp,note:revHas(sn.note)?sn.note:d.note,
      region:sn.region?sn.region.name:'',point:sn.point?sn.point.name:'',address:sn.point?sn.point.address:'',
      le:sn.le||null,at:sn.at||c.at,by:sn.by||c.by,tot:(sn.v>=2&&sn.tot)?sn.tot:revTotals(d.lines),done:true
    };
  }
  pt=drPt(d.point);
  return{
    num:c.num,date:d.date,resp:d.resp,note:d.note,region:regionName(d.region),point:pt?pt.name:'',address:pt?pt.address:'',
    le:(pt&&drLe(pt.le))||null,at:c.at,by:c.by,tot:revTotals(d.lines),done:false
  };
}
function revLeLine(le){
  if(!le)return'не указано';
  return[le.org||le.name,le.inn?'ИНН '+le.inn:'',le.kpp?'КПП '+le.kpp:'',le.ogrn?'ОГРН '+le.ogrn:''].filter(Boolean).join(', ');
}
function revFileName(c,ext){
  var s=revSnapOf(c);
  return('Ревизия '+s.num+' '+s.point).replace(/[\\\/:*?"<>|]+/g,' ').replace(/\s+/g,' ').trim()+'.'+ext;
}
function revXlsx(c){
  var s,d,rows=[],t,n=0,tabs;
  if(!c)return;
  s=revSnapOf(c);d=c.doc;t=s.tot;
  d.lines.forEach(function(l){
    var df=revDiff(l),sm=revSum(l),st=revStat(l);
    rows.push([++n,l.n,l.u,l.b===undefined?null:l.b,l.f===undefined?null:l.f,df,l.p===undefined?null:l.p,sm,st[1]+(revHas(l.f)&&revHas(l.b)&&!revHas(l.p)&&df?' (цена неизвестна)':'')]);
  });
  rows.push([]);
  rows.push(['','Недостача, позиций',t.short,'','','','',t.sumShort,'']);
  rows.push(['','Излишек, позиций',t.over,'','','','',t.sumOver,'']);
  rows.push(['','Итого отклонение, ₽','','','','','',revR2(t.sumShort+t.sumOver),'']);
  rows.push(['','Строк без цены (в суммы не входят)',t.noPrice,'','','','','','']);
  rows.push(['','Строк без учётного остатка (отклонение не определено)',t.noBook||0,'','','','','','']);
  rows.push([]);
  rows.push(['','Комментарий: '+(s.note||'—')]);
  rows.push([]);
  rows.push(['','Ответственное лицо ______________________ / '+s.resp+' /']);
  rows.push(['','Руководитель ______________________ / '+(s.le&&s.le.headName?s.le.headName:'______________')+' /']);
  rows.push(['','Проверил ______________________ / ______________ /']);
  tabs=[{name:'Ревизия',title:'Ведомость ревизии сырья № '+s.num+' от '+revDate(s.date),
    note:'Регион: '+s.region+'. Точка: '+s.point+(s.address?', '+s.address:'')+'. Юридическое лицо: '+revLeLine(s.le)+'. Ответственный: '+s.resp+'.',
    head:['№','Сырьё','Ед.','Учётный остаток','Факт','Разница (факт − учёт)','Учётная цена, ₽ за ед.','Отклонение, ₽','Статус'],
    fmt:['int','text','text','g','g','g','money','money','text'],widths:[40,260,50,110,90,130,130,120,150],rows:rows},
    {name:'Реквизиты',title:'Реквизиты ревизии № '+s.num,note:'Снимок на момент завершения: изменения справочников и цен сюда не попадают.',head:['Показатель','Значение'],fmt:['text','text'],widths:[220,420],rows:[
      ['Номер',s.num],['Дата ревизии',revDate(s.date)],['Регион',s.region],['Точка',s.point],['Адрес точки',s.address],
      ['Юридическое лицо',s.le?(s.le.org||s.le.name):''],['ИНН',s.le?s.le.inn:''],['КПП',s.le?s.le.kpp:''],['ОГРН / ОГРНИП',s.le?s.le.ogrn:''],
      ['Руководитель',s.le?[s.le.head,s.le.headName].filter(Boolean).join(' '):''],['Ответственное лицо',s.resp],['Комментарий',s.note],
      ['Завершена',s.done?(pfDate(s.at)+', '+s.by):'не завершена (черновик)']]}];
  exportFile(xlsxPack(tabs),revFileName(c,'xlsx'));
}
function revPrintHtml(c){
  var s=revSnapOf(c),d=c.doc,t=s.tot,n=0;
  function q(v,dd){return v===null||v===undefined?'':dnum(v,dd===undefined?3:dd);}
  var rows=d.lines.map(function(l){
    var df=revDiff(l),sm=revSum(l),st=revStat(l);
    return'<tr><td class="c">'+(++n)+'</td><td>'+esc(l.n)+'</td><td class="c">'+esc(l.u)+'</td><td class="r">'+(revHas(l.b)?q(l.b):'не введён')+'</td><td class="r">'+(l.f===null||l.f===undefined?'не посчитано':q(l.f))+'</td><td class="r">'+revSignedQ(df)+'</td><td class="r">'+(l.p===null||l.p===undefined?'неизвестна':q(l.p,4))+'</td><td class="r">'+(sm===null?'—':revSigned(sm))+'</td><td>'+st[1]+'</td></tr>';
  }).join('');
  return'<div class="rvp"><h1>Ведомость ревизии сырья № '+esc(s.num)+' от '+esc(revDate(s.date))+'</h1>'
    +'<table class="rvp-meta"><tr><th>Юридическое лицо</th><td>'+esc(revLeLine(s.le))+'</td></tr><tr><th>Регион</th><td>'+esc(s.region)+'</td></tr><tr><th>Точка</th><td>'+esc(s.point)+(s.address?', '+esc(s.address):'')+'</td></tr>'
    +'<tr><th>Ответственное лицо</th><td>'+esc(s.resp)+'</td></tr>'+(s.done?'<tr><th>Завершена</th><td>'+esc(pfDate(s.at))+', '+esc(s.by)+'</td></tr>':'<tr><th>Статус</th><td>Черновик, не завершена</td></tr>')+'</table>'
    +'<table class="rvp-t"><thead><tr><th>№</th><th>Сырьё</th><th>Ед.</th><th>Учётный остаток</th><th>Факт</th><th>Разница</th><th>Цена, ₽ за ед.</th><th>Отклонение, ₽</th><th>Статус</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<table class="rvp-tot"><tr><th>Недостача</th><td>позиций: '+t.short+'</td><td class="r"><b>'+revMoneyTxt(t.sumShort)+' ₽</b></td></tr><tr><th>Излишек</th><td>позиций: '+t.over+'</td><td class="r"><b>+'+revMoneyTxt(t.sumOver)+' ₽</b></td></tr>'
    +'<tr><th>Итого отклонение</th><td></td><td class="r"><b>'+revSigned(revR2(t.sumShort+t.sumOver))+' ₽</b></td></tr>'+(t.noPrice?'<tr><th>Без цены</th><td>позиций: '+t.noPrice+'</td><td class="r">в суммы не входят</td></tr>':'')+(t.noBook?'<tr><th>Без учётного остатка</th><td>позиций: '+t.noBook+'</td><td class="r">отклонение не определено</td></tr>':'')+'</table>'
    +'<p><b>Комментарий:</b> '+(s.note?esc(s.note):'—')+'</p>'
    +'<div class="rvp-sign"><p>Ответственное лицо ______________________ / '+esc(s.resp)+' /</p><p>Руководитель ______________________ / '+esc(s.le&&s.le.headName?s.le.headName:'______________')+' /</p><p>Проверил ______________________ / ______________ /</p></div>'
    +'<p class="rvp-note">Форма составлена в произвольном виде и не является унифицированной формой.</p></div>';
}
function revPrint(c){
  var root,done;
  if(!c)return;
  root=document.getElementById('rvPrintRoot');
  if(!root){root=document.createElement('div');root.id='rvPrintRoot';document.body.appendChild(root);}
  root.innerHTML=revPrintHtml(c);
  document.body.classList.add('rv-printing');
  done=function(){document.body.classList.remove('rv-printing');window.removeEventListener('afterprint',done);};
  window.addEventListener('afterprint',done);
  try{window.print();}catch(e){done();flash('Печать здесь недоступна. Скачайте XLSX и распечатайте его в Excel.');return;}
  setTimeout(function(){if(document.body.classList.contains('rv-printing')&&!document.hasFocus||false){}},0);
}
