/* ---------- разметка ---------- */
function syField(k,label,type,val,ph){
  return'<label class="field"><span class="lbl">'+label+'</span><input id="sy-'+k+'" type="'+type+'" spellcheck="false" autocomplete="'+(type==='password'?'new-password':'off')+'" data-act="syF" data-k="'+k+'" data-fk="sy:'+k+'" value="'+esc(val)+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'></label>';
}
function syMsgHtml(key){var m=S.sy.msg[key];return'<p class="hint cmsg'+(m?' '+m.state:'')+'" id="sym-'+key+'" role="status" aria-live="polite"'+((m&&m.msg)?'':' hidden')+'>'+(m?esc(m.msg):'')+'</p>';}
function syPtrHtml(linked){
  var c=S.sy.cfg;
  if(!linked||!c.ptr)return'';
  if(syAdmin())return'<div class="ptrbox"><b>Файл подключения для сотрудников</b><p class="hint" style="margin:4px 0 6px">Сотрудники вставляют эту ссылку вместо адреса скрипта. При новом развёртывании адрес обновится у всех сам.</p>'
    +'<div class="btns"><a class="btn" href="'+esc(c.ptr)+'" target="_blank" rel="noopener">Открыть файл</a><button class="btn" data-act="syCopyPtr">Скопировать ссылку</button></div></div>';
  return'<p class="hint" style="margin:8px 0 0">Адрес скрипта берётся из файла подключения и обновляется сам.</p>';
}
/* одна строка о правах: только для той роли, с которой подключились */
function syRoleHint(r){
  if(r==='admin')return'Технолог: принимаете правки и публикуете сразу, видите цены и финансы, работаете с файлами в облаке.';
  if(r==='editor')return'Редактор: видите цены и финансы; ваши правки уходят технологу на проверку.';
  if(r==='finance')return'Тер. управляющий: меню и финансы, ABC-анализ, калькуляция ОП-1 и цены сырья; ТТК и база ТТК не нужны. Ваши правки уходят технологу на проверку.';
  if(r==='viewer')return'Шеф-повар: видите всё, но ничего не меняете. Из ТТК — только рассчитанные и файлы в облаке, и калькуляция ОП-1.';
  if(r==='audit')return'Аудит: смотрите и выгружаете данные (меню и финансы, цены, калькуляция ОП-1, рассчитанные ТТК, файлы в облаке), но ничего не меняете. Вход по одному коду, имя не нужно.';
  return'';
}
/* адрес скрипта вшит в файл (или в страницу по ссылке): сотруднику он не нужен, поле не показывается */
function syAddrBaked(){return!!(syBakedUrl()||(typeof window!=='undefined'&&window.KBZHU_PTR));}
function syConnHtml(){
  var c=S.sy.cfg,linked=syLinked(),busy=S.sy.busy.conn,baked=syAddrBaked();
  var h='<section class="card" id="syConn"><h2>'+(guestOn()?'Вход':'Личный кабинет')+'</h2>'
    +(linked?'<p class="rgtag">Подключено: '+esc(syRoleName(c.role))+(syPriceRole(c.role)?'':' · цены не показываются')+'</p><p class="hint" style="margin:0 0 4px">'+esc(syRoleHint(c.role))+'</p>':'')
    +(!linked&&NOPRICE?'<p class="hint cmsg warn" style="margin-top:0">'+(guestOn()?'Без входа доступно только меню с ценами продажи. Введите ФИО и код доступа, который вам выдали.':'Цены и финансы откроются после подключения.')+'</p>':'')
    +'<div class="sygrid">'
    +(baked?'':syField('url','Адрес скрипта (/exec) или ссылка на файл подключения','text',(!c.url&&!c.ptr&&S.sy.addr===undefined&&syPtrLink())?'':syAddrShown(),syPtrLink()?'Не нужен: адрес возьмётся из файла подключения':'https://script.google.com/macros/s/…/exec или ссылка на файл'))
    +syField('name','Ваше ФИО (попадёт в журнал)','text',c.name,'Петров П.П.')
    +syField('code','Код доступа','password',c.code,'Код, который вам выдали')+'</div>'
    +(linked?'':'<p class="hint" id="syWho" style="margin:6px 0 0">Технолог завёл вам личный доступ? Введите ФИО так же, как он записал (например, Петров П.П.), и выданный код. Общий код подходит с любым ФИО. Для кода аудита ФИО не нужно: оставьте поле пустым.</p>')
    +((S.sy.first&&!linked)?'<div class="sygrid" id="syFirst">'+syNcField('nc1','Новый код')+syNcField('nc2','Повторите код')+'<div class="btns" style="grid-column:1/-1;margin:0"><button class="btn primary" data-act="syFirst"'+(busy?' disabled':'')+'>Сохранить код и войти</button></div></div>':'')
    +syPtrHtml(linked)
    +'<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="syConnect"'+(busy?' disabled':'')+'>'+(linked?'Проверить заново':'Подключиться')+'</button>'
    +(linked?'<button class="btn" data-act="syDisconnect">Отключить</button>':'')+'</div>'+syMsgHtml('conn')
    +((linked&&c.mine)?'<details class="pgroup" id="syMyCode"'+(S.sy.myOpen?' open':'')+'><summary>Сменить мой код</summary><div class="sygrid">'+syNcField('nc1','Новый код')+syNcField('nc2','Повторите код')+'</div><div class="btns"><button class="btn" data-act="syMyCode"'+(busy?' disabled':'')+'>Сохранить новый код</button></div></details>':'');
  /* настройка скрипта нужна один раз и только технологу: у сотрудников её нет, у технолога она свёрнута */
  if(syAdmin()||(!linked&&!baked))h+='<details class="pgroup" id="syHow"><summary>Настройка скрипта (один раз, для технолога)</summary><ol class="syhow">'
    +'<li>Создайте пустую Google Таблицу: она станет общей базой.</li>'
    +'<li>В ней: Расширения → Apps Script. Удалите всё и вставьте скрипт (кнопка ниже копирует его). Замените в начале коды: для сотрудников (редактор), для технолога и при желании для тер. управляющего и для шеф-повара. Все коды должны быть разными.</li>'
    +'<li>Выберите функцию «setup», нажмите «Выполнить» и разрешите доступ к таблице и к Google Диску. Если Google пишет «приложение не проверено»: Дополнительно → Перейти. На Диске появится папка «ТТК калькулятора» с папками регионов (Волгоград, Москва).</li>'
    +'<li>Развернуть → Новое развёртывание → Веб-приложение. «Выполнять от имени»: Я. «У кого есть доступ»: Все.</li>'
    +'<li>Скопируйте адрес веб-приложения (оканчивается на /exec), вставьте сюда с ФИО и кодом технолога и нажмите «Подключиться». Сотрудникам дайте ссылку на созданный скриптом файл подключения, код и ФИО.</li></ol>'
    +'<div class="btns"><button class="btn" data-act="syCopyGas">Скопировать скрипт</button></div>'
    +'<p class="hint">После правки скрипта разверните его заново: Развернуть → Управление развёртываниями → Новая версия. Если стоит прежняя версия скрипта, вставьте новую поверх, с теми же кодами, и снова выполните «setup».</p></details>';
  return h+'</section>';
}
function syRegName(id){return regionName(id);}
function syStateTag(p){
  if(p.state==='delete')return['bad','Удалено'];
  if(p.del)return['bad','Удалено в общей базе'];
  if(p.state==='new')return['ok','Новое'];
  if(p.state==='update')return['warn','Обновится'];
  if(p.state==='migrate')return['warn','Обновится, ваш вариант сохранится'];
  if(p.state==='merge')return['warn','Объединится'];
  return['bad',p.adopt?'Отличается от вашего':'Конфликт'];
}
function syPullHtml(){
  var p=S.sy.plan,busy=S.sy.busy.pull;
  var ng=Object.keys(S.sy.gone||{}).length;   /* удалённые вами позиции (ТТК и сырьё), которые не возвращаются из общей базы */
  var h='<section class="card" id="syPull"><h2>Получить общее</h2>'
    +'<div class="btns"><button class="btn primary" data-act="syPull"'+(busy?' disabled':'')+'>Получить обновления</button></div>'+syMsgHtml('pull')
    +(ng?'<p class="hint" id="syGone" style="margin:8px 0 0">Удалённых вами ТТК и сырья, которые не возвращаются из общей базы: '+ng+'. <button class="btn mini" data-act="syGoneClear">Вернуть их</button></p>':'');
  if(p){
    var rows=p.entries.filter(function(e){return e.state!=='same';});
    var pl='<div class="sylist">'+rows.map(function(e){
      var tag=syStateTag(e),key=e.kind+'|'+e.sid,local=null;
      if(e.localId){try{local=syCur(syCtx(),e.kind,e.localId).shared;}catch(x){local=null;}}
      var diff=syDiffItems(e.kind,e.state==='new'?null:local,e.json,syRegName);
      var pk=syPick(e,S.sy.choose,!syAdmin());
      var sel=e.state==='conflict'?'<select data-act="syChoose" data-key="'+esc(key)+'" aria-label="Что оставить для «'+esc(e.name)+'»">'+(syAdmin()?'<option value=""'+(S.sy.choose[key]?'':' selected')+'>— выберите —</option>':'')+'<option value="local"'+((pk==='remote'||(syAdmin()&&!S.sy.choose[key]))?'':' selected')+'>Оставить моё</option><option value="remote"'+(pk==='remote'?' selected':'')+'>'+(e.del?'Удалить у себя':'Взять общее')+'</option></select>':'';
      return'<div class="syrow"><div class="syn"><b>'+esc(e.name)+'</b> <span class="sysub">'+(e.kind==='rec'?'ТТК':'сырьё')+' · '+esc(e.by||'')+' · '+syWhen(e.at)+' · версия '+e.rev+'</span>'+syDfHtml(diff)+'</div>'
        +'<div class="syst"><span class="tstat '+tag[0]+'">'+tag[1]+'</span>'+sel+'</div></div>';
    }).join('')+'</div>';
    var nc=p.n.conflict,unres=syAdmin()?p.entries.filter(function(e){return e.state==='conflict'&&!S.sy.choose[e.kind+'|'+e.sid];}).length:0;
    if(nc)pl+='<div class="btns" style="margin-top:12px"><button class="btn mini" data-act="syChooseAll" data-v="remote">Во всех конфликтах взять общее</button></div>';
    pl+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="syApply"'+(unres?' disabled':'')+'>Применить: '+(p.n['new']+p.n.update+p.n['delete'])+(nc?', конфликтов: '+nc:'')+'</button><button class="btn" data-act="syPlanCancel">Отмена</button></div>'
      +(nc?(syAdmin()?'<p class="hint">Конфликт: позиция изменена и у вас, и в общей базе. Заранее ничего не выбрано: по каждой позиции выберите «Оставить моё» (оно потом уйдёт на проверку) или «Взять общее». Пока выбор не сделан, кнопка «Применить» неактивна'+(unres?' (осталось выбрать: '+unres+')':'')+'. Свои значения до выбора не меняются; копия ваших правок сохранена на этом устройстве.</p>'
        :'<p class="hint">Эти позиции есть и у вас, и в общей базе, но значения разные. Общая база уже проверена технологом, поэтому для позиций, которые вы раньше с ней не сверяли, по умолчанию берётся она. Если после последней сверки позицию меняли и вы, и другие, остаётся ваше. Выбор можно поменять у каждой позиции: то, что останется вашим, уйдёт на проверку.</p>'):'');
    if(nc){
      if(S.sy.cmpOpen===true)h+='<div class="sybd" data-act="syCmpClose"></div><div class="syplan drawer" id="syPlan" role="dialog" aria-modal="true" aria-label="Сравнение версий: конфликты" tabindex="-1"><div class="sdhead"><h3>Сравнение версий · конфликтов: '+nc+'</h3><button class="btn mini" data-act="syCmpClose">Свернуть</button></div>'+pl+'</div>';
      else h+='<div class="sycmpbar" role="status"><b>Нужно решение: конфликтов '+nc+'.</b><button class="btn mini" data-act="syCmpOpen">Открыть сравнение</button></div>';
    }else h+='<div class="syplan" id="syPlan">'+pl+'</div>';
  }
  return h+'</section>';
}
function syMineHtml(){
  if(!syCanSend())return'<section class="card" id="syMine"><h2>Мои изменения</h2><p class="hint" style="margin-top:0">Код шеф-повара: правки в общую базу отправлять нельзя. Общее обновляется кнопкой «Получить обновления».</p></section>';
  var d=syDirtyUi(),sel=d.filter(function(x){return!S.sy.unsel[sySelKey(x)]&&!syIsSent(x);}),busy=S.sy.busy.send,held=Object.keys(syHeld()).length;
  var h='<section class="card" id="syMine"><h2>Мои изменения · '+d.length+'</h2>'+syPubBarHtml();
  var heldNote=held?'<p class="hint" id="syHeld" style="margin-top:0">Ещё '+held+' поз. уже есть в общей базе: что с ними делать, выберите выше, в блоке «Получить общее». Здесь они не показываются.</p>':'';
  if(!d.length)return h+heldNote+(held?'':'<p class="hint" style="margin-top:0">Всё, что у вас есть, уже совпадает с общей базой. Изменённые цены и ТТК, а также новое сырьё появятся здесь.</p>')+syMsgHtml('send')+'</section>';
  var longList=d.length>30;
  h+=heldNote+'<p class="hint" style="margin-top:0">Отправьте нужную позицию кнопкой в её строке или отметьте несколько и отправьте разом. Уже отправленные ждут решения технолога.</p>'
    +'<div class="btns"><button class="btn mini" data-act="syAll" data-v="1">Выбрать всё</button><button class="btn mini" data-act="syAll" data-v="0">Снять всё</button></div>'
    +(longList?'<details class="pgroup" id="syMineList"'+(S.sy.mineOpen?' open':'')+'><summary>Показать список позиций ('+d.length+')</summary>':'')+'<div class="sylist">';
  d.forEach(function(x){
    var key=sySelKey(x),pub=null,sid=(S.sy.map[x.kind][x.id]||{}).sid,diff=[],canTake=false;
    if(x.state==='deleted'){
      h+='<div class="syrow"><label class="syn"><input type="checkbox" data-act="sySel" data-key="'+esc(key)+'"'+(syIsSent(x)?' disabled':(S.sy.unsel[key]?'':' checked'))+'> <b>'+esc(x.name)+'</b> <span class="sysub">'+(x.kind==='rec'?'ТТК':'сырьё')+'</span>'
        +'<ul class="sydiff"><li>удалено у вас: после отправки исчезнет у всех'+(x.sent?' (предложение уже отправлено на проверку)':'')+'</li></ul></label>'
        +'<div class="syst"><span class="tstat bad">Удалено</span>'+(syIsSent(x)?'<span class="tstat warn">На проверке</span>':'<button class="btn mini primary" data-act="syOne" data-key="'+esc(key)+'"'+(busy?' disabled':'')+'>'+(syAdmin()?'Опубликовать':'Отправить')+'</button>')
        +'<button class="btn mini" data-act="syUndel" data-key="'+esc(key)+'" title="Вернуть позицию такой, как она сейчас в общей базе">Вернуть</button></div></div>';
      return;
    }
    if(x.state==='changed'&&sid&&S.sy.pub[x.kind+'|'+sid]){pub=S.sy.pub[x.kind+'|'+sid].json;canTake=true;}
    try{diff=syDiffItems(x.kind,pub,syCur(syCtx(),x.kind,x.id).shared,syRegName);}catch(e){diff=[];}
    var sentX=syIsSent(x);
    h+='<div class="syrow"><label class="syn"><input type="checkbox" data-act="sySel" data-key="'+esc(key)+'"'+(sentX?' disabled':(S.sy.unsel[key]?'':' checked'))+'> <b>'+esc(x.name)+'</b> <span class="sysub">'+(x.kind==='rec'?'ТТК':'сырьё')+'</span>'
      +((x.state==='changed'&&!pub)?'':syDfHtml(diff))+'</label>'
      +'<div class="syst"><span class="tstat '+(sentX?'warn':(x.state==='new'?'ok':'warn'))+'">'+(sentX?'На проверке':(x.state==='new'?'Новое':'Изменено'))+'</span>'
      +(sentX?'':'<button class="btn mini primary" data-act="syOne" data-key="'+esc(key)+'"'+(busy?' disabled':'')+' title="'+(syAdmin()?'Опубликовать только эту позицию':'Отправить технологу только эту позицию')+'">'+(syAdmin()?'Опубликовать':'Отправить')+'</button>')
      +(canTake?'<button class="btn mini" data-act="syTake" data-key="'+esc(key)+'" title="Отбросить ваши правки и взять то, что сейчас в общей базе">Вернуть общее</button>':'')+'</div></div>';
  });
  h+='</div>'+(longList?'</details>':'');
  var nTake=syTakeKeys(sel).length;
  if(nTake)h+='<div class="btns" style="margin-top:10px"><button class="btn mini" data-act="syTakeSel">Вернуть общее вместо моих правок у отмеченных: '+nTake+'</button></div>';
  var dt=syDepsText(sel);
  h+='<p class="hint cmsg warn" id="sy-deps"'+(dt?'':' hidden')+'>'+esc(dt)+'</p>';
  h+='<label class="field" style="margin-top:12px"><span class="lbl">Что изменили (комментарий для технолога)</span><input type="text" id="sy-note" data-act="syNote" data-fk="sy:note" value="'+esc(S.sy.note)+'" placeholder="Например: новая цена на масло с 1 ноября"></label>'
    +'<div class="btns" style="margin-top:12px"><button class="btn primary" id="sy-send" data-act="syPropose"'+(busy||!sel.length?' disabled':'')+'>Отправить на проверку: '+sel.length+'</button>'
    +(syAdmin()?'<button class="btn" id="sy-pub" data-act="syPublish"'+(busy||!sel.length?' disabled':'')+'>Опубликовать сразу: '+sel.length+'</button>':'')+'</div>'+syMsgHtml('send');
  return h+'</section>';
}
function syPendHtml(){
  var list=S.sy.pend,admin=syAdmin();
  var h='<section class="card" id="syPend"><h2>На проверке'+(list?' · '+list.length:'')+'</h2>';
  if(!list)return h+'<p class="hint" style="margin-top:0">Загружаю…</p>'+syMsgHtml('review')+'</section>';
  if(!list.length)h+='<p class="hint" style="margin-top:0">Предложений на проверке нет.</p>';
  list.forEach(function(b){
    var longB=b.items.length>12;
    var hv=S.sy.hlB&&S.sy.hlB[b.batch];
    if(hv===1)S.sy.hlB[b.batch]=2;
    h+='<div class="sybatch'+(hv?' hl'+(hv===1?' hlf':''):'')+'" id="syBt-'+esc(b.batch)+'"><div class="syhead"><b>'+esc(b.by)+'</b> <span class="sysub">'+syWhen(b.at)+' · позиций '+b.items.length+'</span>'+(b.note?'<div class="sysub">«'+esc(b.note)+'»</div>':'')+'</div>'
      +(longB?'<details class="pgroup" id="syB-'+esc(b.batch)+'"'+(S.sy.openB[b.batch]?' open':'')+'><summary>Показать позиции ('+b.items.length+')</summary>':'')+'<div class="sylist">';
    b.items.forEach(function(it){
      var pub=S.sy.pub[it.kind+'|'+it.sid],diff=[],stale=false;
      if(admin){
        try{diff=syDiffItems(it.kind,pub?pub.json:null,it.json,syRegName);}catch(e){diff=[];}
        stale=!!(pub&&pub.rev>it.baseRev);
      }
      h+='<div class="syrow"><div class="syn"><b>'+esc(it.name)+'</b> <span class="sysub">'+(it.kind==='rec'?'ТТК':'сырьё')+'</span>'
        +(admin?syDfHtml(diff):'')
        +(stale?'<div class="sysub syw">В общей базе позиция изменилась после того, как это предложили (версия '+pub.rev+'). Принятие заменит её.</div>':'')+'</div>'
        +((admin&&it.kind==='rec'&&!(it.json&&it.json._del))?'<div class="syst"><button class="btn mini" data-act="rvOpen" data-batch="'+esc(b.batch)+'" data-sid="'+esc(it.sid)+'">'+((S.sy.rv&&S.sy.rv.recs[it.sid])?'Продолжить проверку':'Открыть ТТК')+'</button></div>':'')+'</div>';
    });
    h+='</div>'+(longB?'</details>':'');
    if(admin)h+='<div class="cloudrow"><label class="field"><span class="lbl">Комментарий автору (при доработке обязателен)</span><input type="text" data-act="syRN" data-batch="'+esc(b.batch)+'" data-fk="sy:rn:'+esc(b.batch)+'" value="'+esc(S.sy.rnote[b.batch]||'')+'"></label>'
      +'<button class="btn primary" data-act="syApprove" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>Принять</button><button class="btn" data-act="syRework" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>На доработку</button><button class="btn" data-act="syReject" data-batch="'+esc(b.batch)+'"'+(S.sy.busy.review?' disabled':'')+'>Отклонить</button></div>';
    h+='</div>';
  });
  if(!admin&&list.length)h+='<p class="hint">Принимает и отклоняет технолог: у него свой код.</p>';
  return h+syMsgHtml('review')+'<div class="btns" style="margin-top:10px"><button class="btn mini" data-act="syRefresh">Обновить</button></div></section>';
}
function syLogHtml(){
  var list=S.sy.log;
  var h='<section class="card" id="syLog"><h2>Журнал изменений</h2>';
  if(!list)return h+'<p class="hint" style="margin-top:0">Загружаю…</p></section>';
  if(!list.length)return h+'<p class="hint" style="margin-top:0">Пока пусто.</p></section>';
  /* записи одной отправки (тот же автор, действие и комментарий в пределах 10 секунд) собираем в одну строку */
  var groups=[];
  list.forEach(function(x){
    var g=groups[groups.length-1];
    if(g&&g.by===x.by&&g.action===x.action&&g.note===x.note&&Math.abs(g.at-x.at)<10000)g.items.push(x);
    else groups.push({by:x.by,action:x.action,note:x.note,at:x.at,items:[x]});
  });
  function one(x){
    var back=syAdmin()&&x.hasPrev&&x.kind&&x.rev>0;
    return'<div class="syrow"><div class="syn">'+(x.name?esc(x.name):'')+(x.rev?' <span class="sysub">версия '+x.rev+'</span>':'')+'</div>'
      +'<div class="syst">'+(back?'<button class="btn mini" data-act="syRevert" data-rev="'+x.rev+'"'+(S.sy.busy.review?' disabled':'')+'>Вернуть прежнее</button>':'')+'</div></div>';
  }
  h+='<div class="sylist">'+groups.slice(0,25).map(function(g,i){
    var head='<span class="sysub">'+syWhen(g.at)+'</span> · <b>'+esc(g.by)+'</b> · '+esc(g.action);
    var note=g.note?'<div class="sysub">'+esc(g.note)+'</div>':'';
    if(g.items.length===1){
      var x=g.items[0],back=syAdmin()&&x.hasPrev&&x.kind&&x.rev>0;
      return'<div class="syrow"><div class="syn">'+head+(x.name?' · '+esc(x.name):'')+(x.rev?' <span class="sysub">версия '+x.rev+'</span>':'')+note+'</div>'
        +'<div class="syst">'+(back?'<button class="btn mini" data-act="syRevert" data-rev="'+x.rev+'"'+(S.sy.busy.review?' disabled':'')+'>Вернуть прежнее</button>':'')+'</div></div>';
    }
    return'<div class="syrow"><div class="syn"><details id="syLg-'+g.items[0].rev+'-'+i+'"><summary>'+head+' · '+esc(g.items[0].name)+' и ещё '+(g.items.length-1)+'</summary>'+note+'<div class="sylist">'+g.items.map(one).join('')+'</div></details></div></div>';
  }).join('')+'</div>';
  return h+'</section>';
}
function syFilesHintHtml(){
  var np=syFilesOn()&&syAdmin()?syPendFiles():0;
  if(!np)return'';
  return'<section class="card" id="syFilesHint"><h2>Файлы ТТК на проверке · '+np+'</h2><p class="hint" style="margin-top:0">Сотрудники предложили файлы в облачную библиотеку. Откройте файл кнопкой «Открыть для правки», при необходимости поправьте карту и примите её в нужную папку, верните автору на доработку с комментарием или отклоните.</p><div class="btns"><button class="btn primary" data-act="syGoPend">Открыть «На проверке»</button></div></section>';
}

























/*BKUI-START*/
