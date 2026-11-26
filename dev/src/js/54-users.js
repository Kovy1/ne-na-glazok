/* ---------- технолог: пользователи с именным доступом ---------- */
function usRoleOpts(sel){return['editor','finance','viewer','admin'].map(function(r){return'<option value="'+r+'"'+(sel===r?' selected':'')+'>'+esc(syRoleName(r))+'</option>';}).join('');}
function usReload(){
  var u=S.sy.us;
  if(u.busy)return Promise.resolve();
  u.busy=true;u.err='';
  return syGet({a:'users'}).then(function(d){u.list=d.users||[];u.shared=d.shared||null;u.regions=d.regions||[];u.rg={};},function(e){u.err=syErrText(e);}).then(function(){u.busy=false;scheduleRender();});
}
function usStTxt(x){return x.st==='новый'?'ждёт первого входа':(x.st==='отключён'?'отключён':'активен');}
function syUsrHtml(){
  if(!(S.mode==='local'&&syLinked()&&syAdmin()))return'';
  var u=S.sy.us,i=S.sy.info||{},f=u.f,h='<details class="pgroup" id="syUsr"'+(u.open?' open':'')+'><summary>Пользователи и коды доступа'+(u.list?' · '+u.list.length:'')+'</summary>';
  if((Number(i.v)||0)<19)return h+'<p class="hint cmsg warn">В таблице стоит скрипт версии '+esc(String(i.v||'?'))+'. Для именных доступов нужна версия 19: вставьте новый скрипт («Настройка скрипта» выше) поверх старого, с теми же кодами, и разверните новую версию.</p></details>';
  h+='<p class="hint" style="margin-top:8px">Введите фамилию с инициалами и выберите права: система создаст логин (ФИО так, как вы его написали) и код из 5 цифр. Человек входит по ФИО и коду.</p>'
    +'<div class="fgrid"><label class="field grow"><span class="lbl">Фамилия и инициалы</span><input id="us-name" type="text" autocomplete="off" spellcheck="false" placeholder="Иванов И.И." data-act="usF" data-k="name" data-fk="us:name" value="'+esc(f.name)+'"></label>'
    +'<label class="field w180"><span class="lbl">Права</span><select id="us-role" data-act="usF" data-k="role">'+usRoleOpts(f.role)+'</select></label></div>'
    +usRgBoxes('new',f.regs,true)
    +'<label class="chkl"><input type="checkbox" id="us-own" data-act="usF" data-k="own"'+(f.own?' checked':'')+'> Человек задаст свой код при первом входе (выданный будет временным)</label>'
    +'<div class="btns"><button class="btn primary" data-act="usAdd"'+(u.busy?' disabled':'')+'>Создать пользователя</button></div>';
  if(u.made)h+='<div class="usmade" role="status"><p style="margin:0">Создан: <b>'+esc(u.made.name)+'</b> · '+esc(syRoleName(u.made.role))+'<br>Логин: <b>'+esc(u.made.name)+'</b> · Код: <b class="uscode">'+esc(u.made.code)+'</b></p><p class="hint" style="margin:4px 0 0">Код показывается один раз'+(u.made.own?': при первом входе человек придумает свой':'')+'. Потеряете — выдайте новый кнопкой «Новый код».</p><div class="btns"><button class="btn" data-act="usCopy">Скопировать для отправки</button><button class="btn" data-act="usMadeHide">Готово</button></div></div>';
  if(u.err)h+='<p class="hint cmsg err">'+esc(u.err)+'</p>';
  h+=usUnsetHtml();
  if(u.list&&u.list.length){
    h+='<div class="uslist">'+u.list.map(function(x){
      return'<div class="syrow" data-uid="'+esc(x.id)+'"><div class="syn"><b>'+esc(x.name)+'</b> <span class="tstat neutral">'+esc(syRoleName(x.role))+'</span> <span class="sysub">'+usStTxt(x)+(x.last?' · вход '+esc(syWhen(x.last)):'')+'</span></div>'
        +'<div class="btns"><select aria-label="Права: '+esc(x.name)+'" data-act="usRole">'+usRoleOpts(x.role)+'</select>'
        +'<button class="btn mini" data-act="usReset">Новый код</button>'
        +'<button class="btn mini" data-act="usOff" data-off="'+(x.st==='отключён'?'0':'1')+'">'+(x.st==='отключён'?'Включить':'Отключить')+'</button>'
        +'<button class="btn mini danger" data-act="usDel">Удалить</button></div>'
        +'<div class="usrg">'+usRgBlock('u:'+x.id,x.regs)+'</div></div>';
    }).join('')+'</div>';
  }else if(u.list)h+='<p class="hint">Пока никого нет: общие коды из скрипта продолжают работать.</p>';
  else h+='<p class="hint">'+(u.busy?'Загружаю список…':'')+'</p>';
  h+=usSharedHtml();
  return h+'</details>';
}
function usOp(op,extra,okMsg){
  var u=S.sy.us;
  if(u.busy)return Promise.resolve();
  u.busy=true;u.err='';scheduleRender();
  return syPost(op,extra).then(function(r){u.busy=false;if(okMsg)flash(okMsg);return r;},function(e){u.busy=false;u.err=syErrText(e);scheduleRender();return null;}).then(function(r){return usReload().then(function(){return r;});});
}
function usAdd(){
  var u=S.sy.us,f=u.f,el=$('#us-name');
  if(el)f.name=el.value;
  if(String(f.name).trim().length<3){u.err='Укажите фамилию и инициалы.';scheduleRender();return;}
  usOp('usradd',{name:f.name,role:f.role,own:!!f.own,regs:(f.role==='admin'||!(f.regs||[]).length)?undefined:f.regs}).then(function(r){
    if(r&&r.code){u.made={name:r.user.name,role:r.user.role,code:r.code,own:r.user.st==='новый'};f.name='';f.regs=[];scheduleRender();}
  });
}
function usCopyText(){
  var m=S.sy.us.made,i=S.sy.info||{},link=Number(i.pga)>0?appLink():(S.sy.cfg.ptr||'');
  return'Вход в калькулятор «Не на глазок»'+(link?'\nСсылка: '+link:'')+'\nЛогин (ФИО): '+m.name+'\nКод: '+m.code+(m.own?'\nПри первом входе калькулятор предложит придумать свой код.':'');
}
/* ---------- регионы пользователей и общих кодов (версия 26) ---------- */
function usRgSaved(k){
  var u=S.sy.us,i,x;
  if(k.indexOf('u:')===0){x=(u.list||[]).filter(function(y){return y.id===k.slice(2);})[0];return x?x.regs:null;}
  if(k.indexOf('r:')===0){x=u.shared&&u.shared[k.slice(2)];return x?x.regs:null;}
  return null;
}
function usRgSel(k,saved){var u=S.sy.us;if(k==='new')return u.f.regs||[];return(u.rg&&u.rg[k])?u.rg[k]:(saved||[]);}
function usRgName(id){var l=S.sy.us.regions||[],i;for(i=0;i<l.length;i++)if(l[i].id===id)return l[i].name||id;return id;}
function usRgBoxes(k,saved){
  var u=S.sy.us,list=u.regions||[],sel=usRgSel(k,saved);
  if(k==='new'&&u.f.role==='admin')return'<p class="hint">Технолог видит все регионы.</p>';
  if(!list.length)return'<p class="hint">Регионов в скрипте пока нет: создайте их в «Библиотеке ТТК в облаке».</p>';
  return'<fieldset class="rgset"><legend>Доступные регионы</legend>'+list.map(function(g){
    return'<label class="chkl"><input type="checkbox" data-act="usRgChk" data-rk="'+esc(k)+'" data-rid="'+esc(g.id)+'"'+(sel.indexOf(g.id)>-1?' checked':'')+'> '+esc(g.name||g.id)+'</label>';
  }).join('')+'</fieldset>';
}
function usRgBlock(k,saved){
  var h='<div class="usrgrow"><span class="rglbl">Регионы:</span> ';
  if(saved===null||saved===undefined)h+='<span class="tstat warn">не назначены</span> <span class="sysub">пока технолог не назначит, цены и карты регионов человеку не показываются</span>';
  else if(!saved.length)h+='<span class="tstat warn">нет доступа ни к одному</span>';
  else h+=saved.map(function(id){return'<span class="tstat neutral">'+esc(usRgName(id))+'</span>';}).join(' ');
  h+='</div>'+usRgBoxes(k,saved)+'<div class="btns"><button class="btn mini" data-act="usRgSave" data-rk="'+esc(k)+'" disabled>Сохранить регионы</button></div>';
  return h;
}
function usSharedHtml(){
  var u=S.sy.us,sh=u.shared,roles=['editor','finance','viewer','audit'],h='';
  if(!sh)return'';
  h='<h4 class="usgrp">Общие коды</h4><p class="hint">Общий код один на всех, у кого он есть, поэтому регионы назначаются коду целиком. Личные доступы удобнее: регионы задаются каждому человеку отдельно.</p><div class="uslist">';
  roles.forEach(function(r){
    var x=sh[r];
    if(!x||!x.on)return;
    h+='<div class="syrow"><div class="syn"><b>'+esc(syRoleName(r))+'</b> <span class="sysub">общий код</span></div><div class="usrg">'+usRgBlock('r:'+r,x.regs)+'</div></div>';
  });
  return h+'</div>';
}
/* пользователи и коды, которым регионы ещё не назначены (после обновления скрипта так у всех, кроме технолога) */
function usUnsetN(){
  var u=S.sy.us,n=0;
  (u.list||[]).forEach(function(x){if(x.role!=='admin'&&(x.regs===null||x.regs===undefined))n++;});
  ['editor','finance','viewer','audit'].forEach(function(r){var x=u.shared&&u.shared[r];if(x&&x.on&&(x.regs===null||x.regs===undefined))n++;});
  return n;
}
function usUnsetHtml(){
  var n=usUnsetN();
  if(!n||!S.sy.us.list)return'';
  return'<div class="acnote" role="status"><b>Регионы не назначены: '+n+'.</b> После обновления скрипта новым и прежним пользователям, кроме технолога, регионы автоматически не открываются: назначьте их ниже. До этого человек видит общую базу без цен и без региональных карт; его данные не пропадают.</div>';
}
function usRgToggle(t){
  var u=S.sy.us,k=t.getAttribute('data-rk'),id=t.getAttribute('data-rid'),a=usRgSel(k,usRgSaved(k)).slice(),i=a.indexOf(id),box;
  if(t.checked&&i<0)a.push(id);
  if(!t.checked&&i>-1)a.splice(i,1);
  if(k==='new')u.f.regs=a;else{u.rg=u.rg||{};u.rg[k]=a;box=t.closest('.usrg');var bt=box&&box.querySelector('[data-act="usRgSave"]');if(bt)bt.disabled=false;}
}
function usClick(act,b){
  var k;
  if(act==='usRgSave'){
    k=b.getAttribute('data-rk');
    var sel=usRgSel(k,usRgSaved(k));
    if(k.indexOf('u:')===0)usOp('usrregs',{id:k.slice(2),regs:sel},'Регионы сохранены');
    else usOp('rssc',{role:k.slice(2),regs:sel},'Регионы общего кода сохранены');
    return true;
  }
  return false;
}
/* единый номер выпуска: приложение (APP_REL) и скрипт общей базы (нужна версия не ниже SRV_NEED); обновление репозитория не обновляет скрипт */
var APP_REL=93,SRV_NEED=28;
function syRelHtml(){
  var i=S.sy.info,v=i&&Number(i.v)||0;
  if(!syLinked()||!i||!syAdmin())return'';
  return'<p class="hint cmsg '+(v>=SRV_NEED?'ok':'warn')+'" role="status">Выпуск приложения: '+APP_REL+' · скрипт общей базы: '+(v||'неизвестно')+(v>=SRV_NEED?' (совместим)':'. Нужна версия '+SRV_NEED+': часть функций (цены точек, ревизии) работает неполно. Вставьте новый Code.gs и разверните: Развернуть → Управление развёртываниями → Новая версия. Обновление сайта на GitHub скрипт не меняет.')+'</p>';
}
/* Личный кабинет: разделы по задачам. Профиль и вход — отдельно; «Мои задачи», «На проверке», «Администрирование», «Настройки системы» — по ролям.
   Блоки не дублируются: каждый лежит ровно в одном разделе; раздел без содержимого не показывается. */
var CAB_SEGS=[['tasks','Мои задачи'],['review','На проверке'],['admin','Администрирование'],['sys','Настройки системы'],['prof','Профиль']];
function cabParts(){
  return{
    tasks:syInboxHtml()+syMineHtml()+syReworkHtml()+syPullHtml()+syFilesHintHtml(),
    review:S.sy.cfg.role==='viewer'?'':syPendHtml()+syLogHtml(),
    admin:syUsrHtml(),
    sys:syRelHtml()+syPgHtml()+syAiHtml()+sySvcHtml()+wipeHtml(),
    prof:syConnHtml()
  };
}
function cabCount(k){
  var n=0;
  if(k==='tasks'){try{n=syDirtyUi().length;}catch(e){}if(syInboxOn()&&S.sy.inbox)n+=S.sy.inbox.length;}
  else if(k==='review'&&S.sy.pend)n=S.sy.pend.length;
  return n;
}
function viewSync(){
  if(!syLinked())return syConnHtml()+wipeHtml();
  var parts=cabParts(),segs=CAB_SEGS.filter(function(x){return parts[x[0]];}),cur=S.cabSeg;
  if(!segs.some(function(x){return x[0]===cur;}))cur=(syAdmin()&&S.sy.info&&S.sy.info.pending&&parts.review)?'review':'tasks';
  if(!segs.some(function(x){return x[0]===cur;}))cur=segs.length?segs[0][0]:'prof';
  return'<div class="cab" id="cab"><div class="seg" role="tablist" aria-label="Разделы личного кабинета">'+segs.map(function(x){var n=cabCount(x[0]);return'<button type="button" class="segb" role="tab" data-act="cabSeg" data-s="'+x[0]+'" aria-selected="'+(x[0]===cur)+'">'+esc(x[1])+(n?' <span class="cabn">'+n+'</span>':'')+'</button>';}).join('')+'</div>'
    +segs.map(function(x){return'<div class="cabseg" data-seg="'+x[0]+'"'+(x[0]===cur?'':' hidden')+'>'+parts[x[0]]+'</div>';}).join('')+'</div>';
}

