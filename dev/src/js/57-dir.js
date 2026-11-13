/* ---------- справочники: точки и юридические лица (версия 26) ----------
   Один общий справочник на всех, хранится в таблице. Точка: название, регион, адрес, юридическое лицо, «работает».
   Юридическое лицо — это те же реквизиты шапки ТТК («Организация», «Должность», «ФИО утверждающего»), что и в сохранённых шапках
   на этом устройстве (hdrPresets), плюс ИНН, КПП, ОГРН, адрес и регионы, где оно применяется. Второго списка шапок нет: шапки из
   справочника показываются в том же выборе шапок, что и локальные.
   Точки заводят технолог, редактор и тер. управляющий (в своих регионах), менять их и вести юридические лица — технолог. */
S.dr={ld:false,busy:false,err:'',rev:-1,pts:[],les:[],sub:'pt',q:'',reg:'',off:false,ed:null,msg:'',mig:null,at:0};
function drOld(){return syLinked()&&(S.dr.old||!!(S.sy.info&&(Number(S.sy.info.v)||0)<26));}
function drOk(){return syLinked()&&!drOld();}
function drCanPt(){var r=S.sy.cfg.role;return syLinked()&&(r==='admin'||r==='editor'||r==='finance');}
function drCanLe(){return syLinked()&&syAdmin();}
function drLoad(force){
  var d=S.dr;
  if(!drOk()||d.busy)return Promise.resolve();
  if(!force&&d.ld&&Date.now()-d.at<20000)return Promise.resolve();
  d.busy=true;
  return syGet({a:'dir'}).then(function(r){
    d.pts=r.pts||[];d.les=r.les||[];d.rev=r.rev;d.ld=true;d.err='';d.at=Date.now();
  },function(e){if(e&&e.code==='gas'&&(e.err==='a'||e.err==='op'))d.old=true;else d.err=syErrText(e);}).then(function(){d.busy=false;if(S.dg)drGenPaint();if(S.tab==='dir'||S.tab==='rev'||S.sy.dl)scheduleRender();});
}
function drPt(id){var i;for(i=0;i<S.dr.pts.length;i++)if(S.dr.pts[i].id===id)return S.dr.pts[i];return null;}
function drLe(id){var i;for(i=0;i<S.dr.les.length;i++)if(S.dr.les[i].id===id)return S.dr.les[i];return null;}
/* точки региона (работающие; при withOff — и отключённые) */
function drPtsOf(region,withOff){return S.dr.pts.filter(function(p){return(!region||p.region===region)&&(withOff||p.active!==false);}).sort(function(a,b){return a.name<b.name?-1:a.name>b.name?1:0;});}
/* юридические лица, доступные для региона: «везде» или с этим регионом */
function drLesFor(region){return S.dr.les.filter(function(x){return x.active!==false&&(!x.regs||!x.regs.length||!region||x.regs.indexOf(region)>-1);});}
function drLeLabel(x){return x?(x.name+(x.org&&x.org!==x.name?' — '+x.org:'')):'';}

/* ---- текущая точка и память выбора: отдельно для каждой учётной записи (uid), поэтому при смене пользователя на устройстве чужой выбор не подставляется ---- */
function drUid(){return String(S.sy.cfg.uid||('n:'+(S.sy.cfg.name||'-')));}
function drCurPtId(){
  var id,p;
  if(!drOk()||!S.dr.ld)return'';
  id=lsGet('kbzhu:curpt:'+drUid())||'';p=id?drPt(id):null;
  return p&&p.active!==false&&p.region===curRegion()?id:'';
}
function drSetCurPt(id){lsSet('kbzhu:curpt:'+drUid(),id||'');}
function drLeMemGet(ptId){var v=ptId?lsGet('kbzhu:dlle:'+drUid()+':'+ptId):'';return v||'';}
function drLeMemSet(ptId,leId){if(ptId&&leId)lsSet('kbzhu:dlle:'+drUid()+':'+ptId,leId);}
/* ---- выбор юридического лица перед созданием документа (ТТК, ОП-1) из карточки или меню ----
   Реквизиты подставляются только в скачиваемый файл: сама карта (рецепт) не меняется. Выбор запоминается для пары «пользователь + точка». */
function drGenGate(r,kind){
  var reg=curRegion(),pt,le='',p,id;
  if(!syLinked()||S.dg)return false;                  /* без общей базы справочника нет: шапка остаётся такой, как в карте */
  if(drOk()&&!S.dr.ld&&!S.dr.busy)drLoad(true);
  pt=drCurPtId();
  id=pt?drLeMemGet(pt):'';p=pt?drPt(pt):null;
  if(id&&drLe(id)&&drLe(id).active!==false)le=id;else if(p&&p.le&&drLe(p.le)&&drLe(p.le).active!==false)le=p.le;
  S.dg={r:r,kind:kind,reg:reg,pt:pt,le:le,hk:'',mk:null};
  drGenShow();return true;
}
/* сохранённые на этом устройстве шапки, которых нет в справочнике: их можно выбрать, пока юридических лиц в справочнике нет */
function drGenLocal(){return hdrPresets().filter(function(x){return!x.shared;});}
function drGenOver(){
  var d=S.dg,le=d&&d.le?drLe(d.le):null,h=null;
  if(le)return{org:String(le.org||le.name||''),head:String(le.head||''),headName:String(le.headName||'')};
  if(d&&d.hk)drGenLocal().forEach(function(x){if(!h&&hdrKey(x)===d.hk)h={org:x.org,head:x.head,headName:x.headName};});
  return h;
}
function drGenOrig(d){
  var m=d.kind==='op1'?opModel(d.r):ttkModel(d.r);
  return{org:m.org,head:m.head,headName:m.headName};
}
function drGenHtml(){
  var d=S.dg,pts=drOk()&&S.dr.ld?drPtsOf(d.reg):[],les=drOk()&&S.dr.ld?drLesFor(d.reg):[],loc=drGenLocal(),o=drGenOver(),cur=drGenOrig(d),h=o||cur,sel=d.le?'le:'+d.le:(d.hk?'h:'+d.hk:''),mk=d.mk,note;
  if(drOk()&&!S.dr.ld&&!S.dr.err)note='<p class="hint" role="status">Загружаю справочник юридических лиц…</p>';
  else if(drOk()&&S.dr.err)note='<p class="hint cmsg err" role="alert">Справочник не загрузился: '+esc(S.dr.err)+' <button type="button" class="btn mini" data-act="dgRetry">Повторить</button></p>';
  else if(drOld())note='<p class="hint">В общей базе пока старая версия скрипта без справочника: выберите сохранённую шапку или оставьте как в карте.</p>';
  else if(!les.length)note='<p class="hint" role="status"><b>В справочнике нет юридических лиц'+(regionList().length>1?' для региона «'+esc(regionName(d.reg))+'»':'')+'.</b> '+(drCanLe()?'Создайте юридическое лицо ниже':'Юридические лица добавляет технолог. Пока выберите сохранённую шапку или оставьте как в карте')+'.</p>';
  else note='';
  return'<form method="dialog" class="dg-in"><h2 id="dgT">Для какого юридического лица документ?</h2>'
    +'<p class="hint">Реквизиты подставятся только в скачиваемый файл. Сама карта «'+esc(ttkVal(d.r,'dish')||'без названия')+'» не изменится.</p>'+note
    +(pts.length?'<label class="field"><span class="lbl">Точка</span><select data-act="dgPt"><option value="">— не выбрана —</option>'+pts.map(function(p){return'<option value="'+esc(p.id)+'"'+(p.id===d.pt?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</select></label>':'')
    +'<label class="field"><span class="lbl">Юридическое лицо</span><select data-act="dgLe"><option value=""'+(sel===''?' selected':'')+'>Как записано в карте</option>'
      +(les.length?'<optgroup label="Справочник">'+les.map(function(x){return'<option value="le:'+esc(x.id)+'"'+(sel==='le:'+x.id?' selected':'')+'>'+esc(drLeLabel(x))+'</option>';}).join('')+'</optgroup>':'')
      +(loc.length?'<optgroup label="Сохранено на этом устройстве">'+loc.map(function(x){return'<option value="h:'+esc(hdrKey(x))+'"'+(sel==='h:'+hdrKey(x)?' selected':'')+'>'+esc(hdrLabel(x))+'</option>';}).join('')+'</optgroup>':'')
    +'</select></label>'
    +(drOk()&&S.dr.ld&&!les.length&&drCanLe()?(mk?
      '<div class="wspanel inline"><div class="fgrid"><label class="field grow"><span class="lbl">Название (для списка)</span><input data-act="dgMk" data-k="name" autocomplete="off" value="'+esc(mk.name)+'"></label>'
      +'<label class="field grow"><span class="lbl">Организация (как в шапке)</span><input data-act="dgMk" data-k="org" autocomplete="off" placeholder="ООО «Название»" value="'+esc(mk.org)+'"></label>'
      +'<label class="field w180"><span class="lbl">Должность</span><input data-act="dgMk" data-k="head" autocomplete="off" placeholder="Директор" value="'+esc(mk.head)+'"></label>'
      +'<label class="field grow"><span class="lbl">ФИО утверждающего</span><input data-act="dgMk" data-k="headName" autocomplete="off" placeholder="Иванов И.И." value="'+esc(mk.headName)+'"></label></div>'
      +(mk.err?'<p class="hint cmsg err" role="alert">'+esc(mk.err)+'</p>':'')
      +'<div class="btns"><button type="button" class="btn primary" data-act="dgMkSave"'+(mk.busy?' disabled':'')+'>Создать и выбрать</button><button type="button" class="btn" data-act="dgMkNo">Отмена</button></div></div>'
      :'<div class="btns"><button type="button" class="btn" data-act="dgMkOpen">Создать юридическое лицо</button></div>'):'')
    +drDlPreview({org:h.org,head:h.head,headName:h.headName,date:''})
    +'<div class="btns"><button type="button" class="btn primary" data-act="dgGo">Скачать</button><button type="button" class="btn" data-act="dgNo">Отмена</button></div></form>';
}
function drGenPaint(){
  var el=document.getElementById('dgDlg'),fo,a;
  if(!el||!S.dg)return;
  fo=document.activeElement;a=fo&&fo.getAttribute&&el.contains(fo)?fo.getAttribute('data-act'):'';
  if(a==='dgMk')return;                                                 /* не перерисовываем под руками у человека, который печатает */
  el.innerHTML=drGenHtml();
  if(a){fo=el.querySelector('[data-act="'+a+'"]');if(fo)fo.focus();}
}
function drGenMake(){
  var d=S.dg,mk=d&&d.mk,j;
  if(!mk||mk.busy)return;
  if(!String(mk.name||mk.org||'').trim()){mk.err='Укажите название юридического лица.';drGenPaint();return;}
  j={name:String(mk.name||mk.org).trim(),org:String(mk.org||mk.name).trim(),head:String(mk.head||'').trim(),headName:String(mk.headName||'').trim(),regs:[],active:true};
  mk.busy=true;mk.err='';drGenPaint();
  syPost('dirput',{kind:'le',j:j}).then(function(r){
    var id=r&&r.item&&r.item.id;
    return drLoad(true).then(function(){if(S.dg){S.dg.mk=null;if(id&&drLe(id)){S.dg.le=id;S.dg.hk='';}drGenPaint();}});
  },function(e){if(S.dg&&S.dg.mk){S.dg.mk.busy=false;S.dg.mk.err=syErrText(e);drGenPaint();}});
}
function drGenShow(){
  var el=document.getElementById('dgDlg');
  if(!el){
    el=document.createElement('dialog');el.id='dgDlg';el.className='dg';el.setAttribute('aria-labelledby','dgT');
    el.addEventListener('click',function(e){
      var b=e.target.closest('button[data-act]'),d=S.dg,over,a;
      if(!b||!d)return;
      a=b.getAttribute('data-act');
      if(a==='dgNo'){drGenClose();return;}
      if(a==='dgRetry'){drLoad(true).then(drGenPaint);drGenPaint();return;}
      if(a==='dgMkOpen'){d.mk={name:'',org:'',head:'',headName:'',err:'',busy:false};drGenPaint();return;}
      if(a==='dgMkNo'){d.mk=null;drGenPaint();return;}
      if(a==='dgMkSave'){drGenMake();return;}
      if(a==='dgGo'){
        if(d.mk&&d.mk.busy)return;
        over=drGenOver();if(d.le)drLeMemSet(d.pt,d.le);if(d.pt)drSetCurPt(d.pt);
        var r=d.r,k=d.kind;drGenClose();
        try{if(k==='op1')doDownloadOp1(r,over||false);else doDownloadTtk(r,over||false);}catch(er){flash('Не удалось собрать документ');}
      }
    });
    el.addEventListener('input',function(e){
      var t=e.target,d=S.dg;
      if(d&&d.mk&&t.getAttribute&&t.getAttribute('data-act')==='dgMk')d.mk[t.getAttribute('data-k')]=t.value;
    });
    el.addEventListener('change',function(e){
      var t=e.target,d=S.dg,a=t.getAttribute&&t.getAttribute('data-act'),p,id;
      if(!d)return;
      if(a==='dgPt'){
        d.pt=t.value;id=d.pt?drLeMemGet(d.pt):'';p=d.pt?drPt(d.pt):null;
        d.le=(id&&drLe(id)&&drLe(id).active!==false)?id:((p&&p.le&&drLe(p.le)&&drLe(p.le).active!==false)?p.le:d.le);
        if(d.le)d.hk='';
      }else if(a==='dgLe'){
        d.le=t.value.indexOf('le:')===0?t.value.slice(3):'';d.hk=t.value.indexOf('h:')===0?t.value.slice(2):'';
      }else return;
      el.innerHTML=drGenHtml();
      var f=el.querySelector('[data-act="'+a+'"]');if(f)f.focus();
    });
    el.addEventListener('close',function(){S.dg=null;});
    document.body.appendChild(el);
  }
  el.innerHTML=drGenHtml();
  if(el.showModal){if(!el.open)el.showModal();}else el.setAttribute('open','');
  var f=el.querySelector('[data-act="dgLe"]');if(f)f.focus();
}
function drGenClose(){
  var el=document.getElementById('dgDlg');
  S.dg=null;
  if(el){if(el.close)el.close();else el.removeAttribute('open');}
}
/* верхняя строка: регион, точка, пользователь (состояние сохранения — рядом, в #status) */
function drCtxRender(){
  var pb=$('#pointBox'),ps=$('#pointSel'),wb=$('#whoBox'),pts,cur,sig,c=S.sy.cfg;
  if(!pb||!wb)return;
  pts=(drOk()&&S.dr.ld)?drPtsOf(curRegion()):[];cur=drCurPtId();
  sig=cur+'|'+pts.map(function(p){return p.id+':'+p.name;}).join('|');
  if(ps.getAttribute('data-sig')!==sig){
    ps.innerHTML='<option value="">— не выбрана —</option>'+pts.map(function(p){return'<option value="'+esc(p.id)+'"'+(p.id===cur?' selected':'')+'>'+esc(p.name)+'</option>';}).join('');
    ps.setAttribute('data-sig',sig);
  }
  pb.hidden=!pts.length||guestOn();
  wb.hidden=!(syLinked()&&c.name)||guestOn();
  wb.textContent=wb.hidden?'':c.name+' · '+syRoleName(c.role);
  var lb=$('#leBox'),pt=cur?drPt(cur):null,le=pt&&pt.le?drLe(pt.le):null,mem=cur?drLeMemGet(cur):'',le2=mem?drLe(mem):null;
  if(lb){lb.hidden=!(le2||le)||guestOn();lb.textContent=lb.hidden?'':'Юрлицо: '+((le2||le).org||(le2||le).name);lb.title='Юридическое лицо выбранной точки (при скачивании документа его можно сменить)';}
}

/* ---- общий выбор: реквизиты юридических лиц в шапках ТТК и документов ---- */
function drHdrOf(le){return{org:String(le.org||le.name||''),head:String(le.head||''),headName:String(le.headName||''),leId:le.id,shared:true};}
function drHdrShared(){
  if(!drOk()||!S.dr.ld)return[];
  return S.dr.les.filter(function(x){return x.active!==false&&(String(x.org||x.name||'').trim()||String(x.headName||'').trim());}).map(drHdrOf);
}

/* ---- представление ---- */
function drPtRows(){
  var q=normKey(S.dr.q),rows=S.dr.pts.filter(function(p){
    if(!S.dr.off&&p.active===false)return false;
    if(S.dr.reg&&p.region!==S.dr.reg)return false;
    if(q){var le=drLe(p.le);if((normKey(p.name)+' '+normKey(p.address)+' '+normKey(le?le.name:'')).indexOf(q)<0)return false;}
    return true;
  });
  return rows.sort(function(a,b){return a.region<b.region?-1:a.region>b.region?1:(a.name<b.name?-1:a.name>b.name?1:0);});
}
function drLeRows(){
  var q=normKey(S.dr.q);
  return S.dr.les.filter(function(x){
    if(!S.dr.off&&x.active===false)return false;
    if(S.dr.reg&&x.regs&&x.regs.length&&x.regs.indexOf(S.dr.reg)<0)return false;
    if(q&&(normKey(x.name)+' '+normKey(x.org)+' '+normKey(x.inn)+' '+normKey(x.headName)).indexOf(q)<0)return false;
    return true;
  }).sort(function(a,b){return a.name<b.name?-1:a.name>b.name?1:0;});
}
function drStat(on){return'<span class="tstat '+(on===false?'neutral':'ok')+'">'+(on===false?'Отключена':'Работает')+'</span>';}
function drToolbar(){
  var d=S.dr,rl=regionList();
  return'<div class="wstool"><label class="field grow"><span class="lbl">Поиск</span><input type="search" id="dr-q" data-act="drQ" autocomplete="off" placeholder="'+(d.sub==='pt'?'Название, адрес, юрлицо':'Название, организация, ИНН')+'" value="'+esc(d.q)+'"></label>'
    +(rl.length>1?'<label class="field w180"><span class="lbl">Регион</span><select data-act="drReg"><option value="">Все регионы</option>'+rl.map(function(g){return'<option value="'+esc(g.id)+'"'+(d.reg===g.id?' selected':'')+'>'+esc(g.name||g.id)+'</option>';}).join('')+'</select></label>':'')
    +'<label class="chkl wsoff"><input type="checkbox" data-act="drOff"'+(d.off?' checked':'')+'> Показывать отключённые</label></div>';
}
function drPtTable(){
  var rows=drPtRows(),canEdit=syAdmin();
  if(!rows.length)return'<div class="wsempty"><b>'+(S.dr.pts.length?'Ничего не найдено':'Точек пока нет')+'</b><p>'+(S.dr.pts.length?'Измените поиск или включите показ отключённых точек.':(drCanPt()?'Добавьте первую точку: она понадобится для ревизий и документов.':'Точки заводят технолог, редактор и тер. управляющий.'))+'</p></div>';
  return'<div class="wsscroll"><table class="wtbl"><thead><tr><th>Название</th><th>Регион</th><th>Адрес</th><th>Юридическое лицо</th><th>Статус</th>'+(canEdit?'<th><span class="sr">Действия</span></th>':'')+'</tr></thead><tbody>'
    +rows.map(function(p){
      var le=drLe(p.le);
      return'<tr data-id="'+esc(p.id)+'"><td><b>'+esc(p.name)+'</b></td><td>'+esc(regionName(p.region))+'</td><td>'+esc(p.address||'—')+'</td><td>'+esc(le?le.name:(p.le?'нет в справочнике':'—'))+'</td><td>'+drStat(p.active)+'</td>'
        +(canEdit?'<td class="act"><button class="btn mini" data-act="drEdit" data-kind="pt">Изменить</button></td>':'')+'</tr>';
    }).join('')+'</tbody></table></div>';
}
function drLeTable(){
  var rows=drLeRows(),canEdit=drCanLe();
  if(!rows.length)return'<div class="wsempty"><b>'+(S.dr.les.length?'Ничего не найдено':'Юридических лиц пока нет')+'</b><p>'+(S.dr.les.length?'Измените поиск или включите показ отключённых.':(canEdit?'Добавьте юридическое лицо или перенесите сохранённые шапки с этого устройства (ниже).':'Юридические лица ведёт технолог.'))+'</p></div>';
  return'<div class="wsscroll"><table class="wtbl"><thead><tr><th>Название</th><th>Организация в шапке</th><th>Руководитель</th><th>ИНН / КПП</th><th>Регионы</th><th>Статус</th>'+(canEdit?'<th><span class="sr">Действия</span></th>':'')+'</tr></thead><tbody>'
    +rows.map(function(x){
      return'<tr data-id="'+esc(x.id)+'"><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.org||'—')+'</td><td>'+esc([x.head,x.headName].filter(Boolean).join(' ')||'—')+'</td><td>'+esc([x.inn,x.kpp].filter(Boolean).join(' / ')||'—')+'</td>'
        +'<td>'+esc((x.regs&&x.regs.length)?x.regs.map(regionName).join(', '):'все')+'</td><td>'+drStat(x.active)+'</td>'
        +(canEdit?'<td class="act"><button class="btn mini" data-act="drEdit" data-kind="le">Изменить</button></td>':'')+'</tr>';
    }).join('')+'</tbody></table></div>';
}
function drFld(k,lbl,v,o){o=o||{};return'<label class="field'+(o.cls?' '+o.cls:'')+'"><span class="lbl">'+lbl+'</span><input data-act="drF" data-k="'+k+'" data-fk="dr:'+k+'" autocomplete="off" value="'+esc(v==null?'':v)+'"'+(o.ph?' placeholder="'+esc(o.ph)+'"':'')+(o.inputmode?' inputmode="'+o.inputmode+'"':'')+'></label>';}
function drEditHtml(){
  var e=S.dr.ed,f,rl,h;
  if(!e)return'';
  f=e.f;rl=regionList();
  h='<section class="wspanel" id="drEd" aria-label="'+(e.kind==='pt'?'Точка':'Юридическое лицо')+'"><h3>'+(e.id?'Изменить':'Новая')+' '+(e.kind==='pt'?'точка':'юридическое лицо')+'</h3>';
  if(e.err)h+='<p class="hint cmsg err" role="alert">'+esc(e.err)+'</p>';
  if(e.kind==='pt'){
    h+='<div class="fgrid">'+drFld('name','Название',f.name,{ph:'Столовая на Ленина',cls:'grow'})
      +'<label class="field w180"><span class="lbl">Регион</span><select data-act="drF" data-k="region"'+(e.id&&!syAdmin()?' disabled':'')+'><option value="">— выбрать —</option>'+rl.map(function(g){return'<option value="'+esc(g.id)+'"'+(f.region===g.id?' selected':'')+'>'+esc(g.name||g.id)+'</option>';}).join('')+'</select></label></div>'
      +'<div class="fgrid">'+drFld('address','Адрес',f.address,{cls:'grow',ph:'Город, улица, дом'})
      +'<label class="field grow"><span class="lbl">Юридическое лицо</span><select data-act="drF" data-k="le"><option value="">— не указано —</option>'+drLesFor(f.region).map(function(x){return'<option value="'+esc(x.id)+'"'+(f.le===x.id?' selected':'')+'>'+esc(drLeLabel(x))+'</option>';}).join('')+'</select></label></div>';
  }else{
    h+='<div class="fgrid">'+drFld('name','Название в списке',f.name,{cls:'grow',ph:'Ромашка'})+drFld('org','Организация в шапке документов',f.org,{cls:'grow',ph:'ООО «Ромашка»'})+'</div>'
      +'<div class="fgrid">'+drFld('head','Должность руководителя',f.head,{cls:'w180',ph:'Директор'})+drFld('headName','ФИО руководителя',f.headName,{cls:'grow',ph:'Иванов И.И.'})+'</div>'
      +'<div class="fgrid">'+drFld('inn','ИНН',f.inn,{cls:'w180',inputmode:'numeric'})+drFld('kpp','КПП',f.kpp,{cls:'w180',inputmode:'numeric'})+drFld('ogrn','ОГРН / ОГРНИП',f.ogrn,{cls:'w180',inputmode:'numeric'})+'</div>'
      +'<div class="fgrid">'+drFld('addr','Адрес юридического лица',f.addr,{cls:'grow'})+'</div>'
      +'<fieldset class="rgset"><legend>Где применяется</legend><label class="chkl"><input type="checkbox" data-act="drAllReg"'+((!f.regs||!f.regs.length)?' checked':'')+'> Во всех регионах</label>'
      +rl.map(function(g){return'<label class="chkl"><input type="checkbox" data-act="drRg" data-rid="'+esc(g.id)+'"'+((f.regs||[]).indexOf(g.id)>-1?' checked':'')+((!f.regs||!f.regs.length)?' disabled':'')+'> '+esc(g.name||g.id)+'</label>';}).join('')+'</fieldset>';
  }
  h+='<label class="chkl"><input type="checkbox" data-act="drF" data-k="active"'+(f.active!==false?' checked':'')+'> '+(e.kind==='pt'?'Точка работает':'Юридическое лицо используется')+'</label>'
    +'<div class="btns"><button class="btn primary" data-act="drSave"'+(e.busy?' disabled':'')+'>'+(e.busy?'Сохраняю…':'Сохранить')+'</button><button class="btn" data-act="drCancel">Отмена</button></div></section>';
  return h;
}
/* сохранённые на этом устройстве шапки ТТК можно перенести в справочник: дубли (по организации, должности и ФИО) отсеиваются */
function drMigList(){
  var loc=hdrLocal(),seen={},out=[];
  S.dr.les.forEach(function(x){seen[hdrKey({org:x.org||x.name,head:x.head,headName:x.headName})]=1;seen['o:'+normKey(x.org||x.name)]=1;seen['n:'+normKey(x.name)]=1;});
  loc.forEach(function(h,i){
    var k=hdrKey(h),dup=!!seen[k],near=!dup&&!!(seen['o:'+normKey(h.org)]||seen['n:'+normKey(h.org)]);
    out.push({i:i,h:h,dup:dup,near:near});
  });
  return out;
}
function drMigHtml(){
  var loc=hdrLocal(),m;
  if(!drCanLe()||!loc.length)return'';
  m=drMigList();
  return'<section class="wspanel" id="drMig"><h3>Шапки, сохранённые на этом устройстве: '+loc.length+'</h3>'
    +'<p class="hint">Перенесите нужные в справочник юридических лиц, чтобы ими пользовались все. Совпадающие с уже имеющимися отмечены и по умолчанию не переносятся. Сами шапки на устройстве остаются, но в выборе показываются один раз.</p>'
    +'<div class="wsscroll"><table class="wtbl"><thead><tr><th><span class="sr">Перенести</span></th><th>Организация</th><th>Руководитель</th><th>Проверка</th></tr></thead><tbody>'
    +m.map(function(x){
      var on=S.dr.mig?S.dr.mig[x.i]!==false:!(x.dup||x.near);
      return'<tr><td><input type="checkbox" data-act="drMigChk" data-i="'+x.i+'" aria-label="Перенести: '+esc(hdrLabel(x.h))+'"'+(on?' checked':'')+'></td><td>'+esc(x.h.org||'—')+'</td><td>'+esc([x.h.head,x.h.headName].filter(Boolean).join(' ')||'—')+'</td>'
        +'<td>'+(x.dup?'<span class="tstat neutral">Уже есть в справочнике</span>':(x.near?'<span class="tstat warn">Похоже на имеющееся</span>':'<span class="tstat ok">Новое</span>'))+'</td></tr>';
    }).join('')+'</tbody></table></div>'
    +'<div class="btns"><button class="btn" data-act="drMigGo"'+(S.dr.migBusy?' disabled':'')+'>'+(S.dr.migBusy?'Переношу…':'Перенести отмеченные')+'</button></div>'
    +(S.dr.migMsg?'<p class="hint cmsg ok" role="status">'+esc(S.dr.migMsg)+'</p>':'')+'</section>';
}
function viewDir(){
  var d=S.dr,h,canAdd;
  if(!syLinked())return'<section class="card wscard"><div class="wsempty"><b>Справочники ведутся в общей базе</b><p>Подключитесь в «Личном кабинете» по своему коду: точки и юридические лица общие для всех, их проверяет и хранит скрипт.</p><div class="btns"><button class="btn primary" data-act="goTab" data-tab="sync">Открыть «Личный кабинет»</button></div></div></section>';
  if(drOld())return'<section class="card wscard"><div class="wsempty"><b>Нужен скрипт версии 26</b><p>В таблице стоит версия '+esc(String((S.sy.info||{}).v||'прежняя'))+'. Технолог обновляет скрипт в «Личном кабинете» → «Настройка скрипта».</p></div></section>';
  if(acNone())return'<section class="card wscard">'+acNoteHtml()+'</section>';
  canAdd=d.sub==='pt'?drCanPt():drCanLe();
  h='<section class="card wscard" id="drView"><div class="wshead"><h2>Справочники</h2>'
    +(canAdd&&!d.ed?'<button class="btn primary" data-act="drNew">'+(d.sub==='pt'?'Добавить точку':'Добавить юрлицо')+'</button>':'')+'</div>'
    +'<div class="seg wsseg" role="tablist" aria-label="Справочник"><button class="segb" role="tab" data-act="drSub" data-sub="pt" aria-selected="'+(d.sub==='pt')+'">Точки · '+d.pts.length+'</button><button class="segb" role="tab" data-act="drSub" data-sub="le" aria-selected="'+(d.sub==='le')+'">Юридические лица · '+d.les.length+'</button></div>';
  if(d.err)h+='<p class="hint cmsg err" role="alert">'+esc(d.err)+' <button class="btn mini" data-act="drReload">Повторить</button></p>';
  if(d.msg)h+='<p class="hint cmsg ok" role="status">'+esc(d.msg)+'</p>';
  h+=drEditHtml();
  if(!d.ld&&!d.err)h+='<div class="wsempty" aria-busy="true"><b>Загружаю справочник…</b></div>';
  else if(d.ld){h+=drToolbar();h+='<div id="drTbl">'+(d.sub==='pt'?drPtTable():drLeTable())+'</div>';}
  if(d.sub==='le')h+=drMigHtml();
  return h+'</section>';
}

/* ---- действия ---- */
function drBlank(kind){
  var rl=regionList(),reg=S.dr.reg||curRegion();
  return kind==='pt'?{name:'',region:(rl.some(function(g){return g.id===reg;})?reg:(rl[0]?rl[0].id:'')),address:'',le:'',active:true}:{name:'',org:'',head:'Директор',headName:'',inn:'',kpp:'',ogrn:'',addr:'',regs:[],active:true};
}
function drEdit(kind,id){
  var src=kind==='pt'?drPt(id):drLe(id),f;
  if(!src)return;
  f=JSON.parse(JSON.stringify(src));
  S.dr.ed={kind:kind,id:id,base:src.ver||0,f:f,err:'',busy:false};
  renderAll();var el=$('#drEd');if(el&&el.scrollIntoView)el.scrollIntoView({block:'nearest'});
}
function drCollect(){
  var e=S.dr.ed,f=e.f;
  ['name','org','head','headName','inn','kpp','ogrn','addr','address'].forEach(function(k){var el=$('#drEd [data-k="'+k+'"]');if(el)f[k]=el.value;});
  return f;
}
function drSave(){
  var e=S.dr.ed,f,j;
  if(!e||e.busy)return;
  f=drCollect();
  if(!String(f.name||'').trim()){e.err=e.kind==='pt'?'Укажите название точки.':'Укажите название юридического лица.';renderAll();return;}
  if(e.kind==='pt'&&!f.region){e.err='Выберите регион точки.';renderAll();return;}
  j=e.kind==='pt'?{name:f.name,region:f.region,address:f.address,le:f.le||'',active:f.active!==false}:{name:f.name,org:f.org,head:f.head,headName:f.headName,inn:f.inn,kpp:f.kpp,ogrn:f.ogrn,addr:f.addr,regs:f.regs||[],active:f.active!==false};
  e.busy=true;e.err='';renderAll();
  syPost('dirput',{kind:e.kind,id:e.id||undefined,base:e.base||0,j:j}).then(function(r){
    if(r&&r.ok===false&&r.err==='conflict'){
      e.busy=false;e.base=r.cur.ver;e.f=Object.assign({},r.cur);e.err='Запись успели изменить: показана свежая версия, ваши правки не сохранены. Внесите их заново.';
      return drLoad(true);
    }
    S.dr.ed=null;S.dr.msg=(e.kind==='pt'?'Точка':'Юридическое лицо')+' «'+j.name+'» '+(e.id?'сохранено':'добавлено')+'.';
    return drLoad(true).then(function(){return r;});
  },function(err){e.busy=false;e.err=syErrText(err);}).then(function(){renderAll();});
}
function drMigGo(){
  var m=drMigList(),todo=m.filter(function(x){return S.dr.mig?S.dr.mig[x.i]!==false:!(x.dup||x.near);}),n=0,fail=0;
  if(!todo.length){S.dr.migMsg='Отметьте шапки, которые нужно перенести.';renderAll();return;}
  S.dr.migBusy=true;S.dr.migMsg='';renderAll();
  var chain=Promise.resolve();
  todo.forEach(function(x){
    chain=chain.then(function(){
      var h=x.h,nm=String(h.org||h.headName||'Организация').slice(0,80);
      return syPost('dirput',{kind:'le',j:{name:nm,org:h.org,head:h.head,headName:h.headName,regs:[],active:true}}).then(function(r){if(r&&r.ok)n++;else fail++;},function(){fail++;});
    });
  });
  chain.then(function(){return drLoad(true);}).then(function(){
    S.dr.migBusy=false;S.dr.mig=null;
    S.dr.migMsg='Перенесено в справочник: '+n+(fail?'. Не удалось: '+fail+' (возможно, такое название уже есть).':'.');
    renderAll();
  });
}
function drClick(act,b){
  var d=S.dr;
  switch(act){
    case'drSub':d.sub=b.getAttribute('data-sub')==='le'?'le':'pt';d.ed=null;d.msg='';renderAll();return true;
    case'drNew':d.ed={kind:d.sub,id:'',base:0,f:drBlank(d.sub),err:'',busy:false};d.msg='';renderAll();(function(){var el=$('#drEd [data-k="name"]');if(el)el.focus();})();return true;
    case'drEdit':drEdit(b.getAttribute('data-kind'),b.closest('tr').getAttribute('data-id'));return true;
    case'drCancel':d.ed=null;renderAll();return true;
    case'drSave':drSave();return true;
    case'drReload':d.err='';drLoad(true);return true;
    case'drMigGo':drMigGo();return true;
    case'goTab':S.tab=b.getAttribute('data-tab');renderAll();return true;
  }
  return false;
}
function drInput(act,t){
  if(act==='drQ'){S.dr.q=t.value;var tb=$('#drTbl');if(tb)tb.innerHTML=S.dr.sub==='pt'?drPtTable():drLeTable();return true;}
  if(act==='drF'&&S.dr.ed){var k=t.getAttribute('data-k');if(t.type!=='checkbox'&&t.tagName!=='SELECT')S.dr.ed.f[k]=t.value;return true;}
  return false;
}
function drChange(act,t){
  var e=S.dr.ed,k,a;
  switch(act){
    case'drReg':S.dr.reg=t.value;renderAll();return true;
    case'ctxPt':drSetCurPt(t.value);renderAll();return true;
    case'dlPt':drDlPick(t.value);return true;
    case'drOff':S.dr.off=!!t.checked;renderAll();return true;
    case'drF':
      if(!e)return true;
      k=t.getAttribute('data-k');
      e.f[k]=t.type==='checkbox'?t.checked:t.value;
      if(k==='region'){if(e.f.le&&!drLesFor(e.f.region).some(function(x){return x.id===e.f.le;}))e.f.le='';drCollect();renderAll();}
      return true;
    case'drAllReg':if(e){e.f.regs=t.checked?[]:regionList().map(function(g){return g.id;});drCollect();renderAll();}return true;
    case'drRg':
      if(e){a=(e.f.regs||[]).slice();k=t.getAttribute('data-rid');var i=a.indexOf(k);if(t.checked&&i<0)a.push(k);if(!t.checked&&i>-1)a.splice(i,1);e.f.regs=a;}
      return true;
    case'drMigChk':
      if(!S.dr.mig){S.dr.mig={};drMigList().forEach(function(x){S.dr.mig[x.i]=!(x.dup||x.near);});}
      S.dr.mig[Number(t.getAttribute('data-i'))]=!!t.checked;return true;
  }
  return false;
}
