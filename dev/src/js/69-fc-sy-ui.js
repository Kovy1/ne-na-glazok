/* ---------- Фудкост: экраны, связанные с общей базой — «Мои мероприятия», исходные данные версии, резервная копия, расхождения ---------- */
function fcConfHtml(s,mid,plId){
  if(!s||!s.conf||!s.conf.length)return'';
  return'<div class="w-warn fcconf" role="alert"><b>Ваше изменение не сохранено в общей базе:</b> другой пользователь уже изменил то же поле.<ul>'+s.conf.map(function(c){
    var nm={asg:'Исполнитель',due:'Срок',st:'Статус',result:'Результат',real:'Подтверждённое снижение'}[c.f]||c.f;
    function t(v){if(v&&typeof v==='object')return fcAsgTxt(v);if(c.f==='st')return FC_ST[v]||String(v);return v===null||v===undefined||v===''?'не задано':String(v);}
    return'<li>'+esc(nm)+': ваше значение «'+esc(t(c.mine))+'», сохранено более раннее чужое «'+esc(t(c.theirs))+'». Проверьте и повторите изменение, если оно нужно.</li>';
  }).join('')+'</ul><button class="btn mini" data-act="fcConfClr" data-mid="'+esc(mid)+'" data-pl="'+esc(plId)+'">Понятно</button></div>';
}
function fcSyConfHtml(){
  var c=S.fc.sy&&S.fc.sy.conf;
  if(!c||!c.length)return'';
  return'<div class="w-warn" role="alert"><b>При объединении с общей базой часть данных осталась серверной:</b><ul>'+c.slice(0,8).map(function(x){return'<li>'+esc(x)+'</li>';}).join('')+(c.length>8?'<li>…и ещё '+(c.length-8)+'</li>':'')+'</ul><button class="btn mini" data-act="fcConfClr">Понятно</button></div>';
}
/* исходные данные версии: что сохранено и воспроизводится ли расчёт */
function fcSnapHtml(pl,v){
  var i=v.snapInfo,r=S.fc.vfy&&S.fc.vfy[pl.id+':'+v.n],h;
  if(!i)return'<p class="hint">Снимок исходных данных для этой версии не сохранён (версия построена до его введения).</p>';
  h='<details class="pgroup"><summary>Исходные данные версии '+v.n+' (снимок)</summary><p>Сохранено: операций отчётов — '+i.n.ops+', загрузок — '+i.n.batches+', рецептур — '+i.n.recs+', позиций сырья с ценами, единицами и плотностями — '+i.n.ings+', записей истории закупок — '+i.n.ph+'. Настройки, пороги и версия алгоритма — в составе версии. Контрольный отпечаток снимка: '+esc(i.h)+'.</p>'
    +'<p class="hint">'+esc(v.snapWarn||'')+'</p><p class="hint">Обновление общей базы (цены, ТТК, номенклатура) эту версию не меняет. Пересчёт по новым ценам или ТТК — отдельное действие «Построить новую версию».</p>'
    +'<p><button class="btn mini" data-act="fcVerify" data-pl="'+esc(pl.id)+'" data-n="'+v.n+'">Проверить воспроизводимость по снимку</button> '+(r?'<span class="tstat '+(r.ok?'ok':'warn')+'">'+esc(r.why)+'</span>':'')+'</p></details>';
  return h;
}
/* ---------- «Мои мероприятия» ---------- */
function fcMineList(){
  var me=fcMyId(),out=[];
  if(!me)return out;
  Object.keys(S.fc.plans).forEach(function(k){
    var pl=S.fc.plans[k];
    Object.keys(pl.state||{}).forEach(function(mid){
      var s=pl.state[mid],it=null,i;
      if(!(s&&s.asg&&s.asg.t==='user'&&s.asg.id===me))return;
      for(i=pl.versions.length-1;i>=0&&!it;i--)(pl.versions[i].items||[]).forEach(function(x){if(x.id===mid&&!it)it=x;});
      if(it)out.push({pl:pl,mid:mid,s:s,it:it});
    });
  });
  return out.sort(function(a,b){var x=a.s.due||a.s.dueSug||'9',y=b.s.due||b.s.dueSug||'9';return x<y?-1:(x>y?1:(a.mid<b.mid?-1:1));});
}
function fcMineHtml(){
  var L=fcMineList(),h='<section class="card fcmine"><h3 class="h3">Мои мероприятия</h3>';
  if(!fcSyncOn())return h+'<p class="hint">Назначения приходят из общей базы: подключитесь по своему коду.</p></section>';
  if(!fcMyId())return h+'<p class="hint">Вы вошли по общему коду, а не по личному: назначения по именам не привязаны к вам. Попросите технолога выдать личный доступ.</p></section>';
  if(!L.length)return h+'<p>Назначенных вам мероприятий пока нет. Они появятся здесь после синхронизации.</p></section>';
  h+='<p class="hint">Вы видите только мероприятия, назначенные вам. Менять можно статус, результат и комментарии; срок и исполнителя назначает технолог.</p>';
  L.forEach(function(x){
    var it=x.it,s=x.s,pid=esc(x.pl.id),can=fcCanAct(x.pl,x.mid),dis=can?'':' disabled';
    h+='<article class="fcm" id="my-'+x.mid+'"><h4 class="h4">'+esc(it.title)+'</h4><p class="hint">'+esc(x.pl.objName)+' · '+fcIsoRu(x.pl.from)+' – '+fcIsoRu(x.pl.to)+' · срок: '+esc(fcIsoRu(s.due||s.dueSug)||'не назначен')+(s.due?'':' (предложен)')+'</p>'
      +'<p><b>Что сделать:</b> '+esc(it.act)+'</p><p><b>Критерий выполнения:</b> '+esc(it.crit||'')+'</p>'
      +'<div class="fgrid"><label class="field w220"><span class="lbl">Статус</span><select data-act="fcSt" data-mid="'+x.mid+'" data-pl="'+pid+'"'+dis+'>'+Object.keys(FC_ST).map(function(k){return'<option value="'+k+'"'+(s.st===k?' selected':'')+'>'+FC_ST[k]+'</option>';}).join('')+'</select></label></div>'
      +fcConfHtml(s,x.mid,x.pl.id)
      +'<label class="field"><span class="lbl">Результат</span><textarea rows="2" maxlength="600" data-act="fcRes" data-mid="'+x.mid+'" data-pl="'+pid+'"'+dis+'>'+esc(s.result||'')+'</textarea></label>'
      +((s.cm||[]).length?'<ul>'+s.cm.map(function(c){return'<li>'+esc(fcIsoRu(c.at)+(c.by?', '+c.by:'')+': '+c.t)+'</li>';}).join('')+'</ul>':'')
      +'<div class="fgrid"><label class="field grow"><span class="lbl">Новый комментарий</span><input type="text" id="fcCm-'+x.mid+'" maxlength="300"'+dis+'></label><div class="btns"><button class="btn mini" data-act="fcCm" data-mid="'+x.mid+'" data-pl="'+pid+'"'+dis+'>Добавить</button></div></div></article>';
  });
  return h+'</section>';
}
/* ---------- резервная копия ---------- */
function fcBackupHtml(){
  var edit=fcCanEdit(),h='<section class="card fcbk"><h3 class="h3">Резервная копия аналитики</h3><p class="hint">В копию входят загрузки отчётов, сопоставления, настройки, планы со всеми версиями, назначениями, комментариями и историей, а также снимки исходных данных версий. Восстановление только добавляет недостающее: существующие данные и более свежие изменения в общей базе не переписываются.</p>'
    +'<div class="btns"><button class="btn" data-act="fcBkSave">Скачать копию</button><button class="btn" data-act="fcBkPick" data-edit'+(edit?'':' disabled')+'>Восстановить из файла…</button>'+(S.fc.scope&&edit?'<button class="btn" data-act="fcAdopt" data-edit>Перенести данные, созданные без входа</button>':'')+'</div>';
  if(S.fc.restored)h+='<p class="hint">Последнее восстановление: загрузок '+S.fc.restored.rep.batches+', планов '+S.fc.restored.rep.plans+', версий '+S.fc.restored.rep.versions+'.</p>';
  return h+'</section>';
}
