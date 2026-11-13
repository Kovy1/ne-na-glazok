/* ---------- вкладка «Личный кабинет»: обмен с Google Таблицей через скрипт ---------- */
var SY_KEY='kbzhu:sync';
S.sy={pf:pfFresh(),us:{list:null,busy:false,open:false,f:{name:'',role:'editor',own:true,regs:[]},rg:{},shared:null,regions:[],made:null,err:''},hold:null,holdAsk:false,first:false,cfg:{url:'',name:'',code:'',auto:false,rev:0,role:'',mapUrl:'',ptr:'',hm:'',pfAuto:true,bkAuto:true,bkRev:0,bkWho:'',bkDirty:false,bkDev:'',bkAt:0,pubAuto:false,pubDocs:true,rset:false,uid:''},addr:undefined,ptrAt:0,ptrFailAt:0,ptrP:null,map:{ing:{},rec:{}},gone:{},del:{},info:null,msg:{},busy:{},plan:null,choose:{},pend:null,pub:{},log:null,unsel:{},note:'',rnote:{},seen:0,mineOpen:false,openB:{},files:null,fq:'',fseen:0,cdir:'all',creg:null,rsig:'',fadm:false,fshow:50,fwant:{},fnew:'',fren:null,frenv:'',rv:null,rework:[],inbox:null,inboxF:null,inboxAt:0,inboxHide:'',rvAsk:'',rvNote:'',rwNote:'',fr:null,frAsk:'',frNote:'',frow:'',frn:'',upAt:0,upBusy:false,fvKnown:undefined,pendN:-1,inboxR:null,cnote:'',rvFileOff:false,dq:{},pt:{},pubHold:{},hist:null,histOpen:false,layGm:null,gmQ:null};
/*GAS-START*/var SY_GAS="";/*GAS-END*/
function syLoad(){
  var d=null;
  try{d=JSON.parse(lsGet(SY_KEY)||'null');}catch(e){d=null;}
  if(!d)return;
  var c=d.cfg||{};
  S.sy.cfg={url:String(c.url||''),name:String(c.name||''),code:String((c.role==='admin'?(c.acode||c.code):(c.code||c.acode))||''),auto:c.auto===true,rev:Number(c.rev)||0,role:(c.role==='admin'||c.role==='editor'||c.role==='finance'||c.role==='viewer'||c.role==='audit')?c.role:'',mapUrl:String(c.mapUrl||''),ptr:String(c.ptr||''),hm:c.hm==='np'?'np':'',pfAuto:c.pfAuto!==false,bkAuto:c.bkAuto!==false,bkRev:Number(c.bkRev)||0,bkWho:String(c.bkWho||''),bkDirty:c.bkDirty===true,bkDev:String(c.bkDev||'').replace(/[^\w-]/g,'').slice(0,40),bkAt:Number(c.bkAt)||0,mine:c.mine===true,pubAuto:c.pubAuto===true,pubDocs:c.pubDocs!==false,rset:c.rset===true,uid:String(c.uid||'').replace(/[^\w:|.-]/g,'').slice(0,80)};
  if(Array.isArray(c.regs))S.sy.cfg.regs=c.regs.filter(function(x){return REG_ID.test(String(x));}).slice(0,16);else if(c.regs===null)S.sy.cfg.regs=null;
  S.sy.map={ing:(d.map&&d.map.ing)||{},rec:(d.map&&d.map.rec)||{}};
  S.sy.gone=(d.gone&&typeof d.gone==='object')?d.gone:{};
  S.sy.del=(d.del&&typeof d.del==='object')?d.del:{};
  /* связи удалённых у вас позиций не нужны */
  Object.keys(S.sy.map.ing).forEach(function(id){if(!S.ings[id])delete S.sy.map.ing[id];});
  Object.keys(S.sy.map.rec).forEach(function(id){if(!S.recipes[id])delete S.sy.map.rec[id];});
  S.sy.rv=(d.rv&&typeof d.rv==='object'&&d.rv.batch&&d.rv.recs&&Array.isArray(d.rv.ings))?d.rv:null;
  S.sy.fr=(d.fr&&typeof d.fr==='object'&&d.fr.id&&d.fr.recId&&Array.isArray(d.fr.ings))?d.fr:null;
  S.sy.phSeen=(d.ph&&typeof d.ph==='object'&&!Array.isArray(d.ph))?d.ph:{};
  S.sy.dq=(d.dq&&typeof d.dq==='object'&&!Array.isArray(d.dq))?d.dq:{};
  S.sy.pt=(d.pt&&typeof d.pt==='object'&&!Array.isArray(d.pt))?d.pt:{};
  S.sy.heal=d.hl?1:0;S.sy.bs=d.bs?1:0;
  S.sy.hold=(d.hd&&typeof d.hd==='object'&&d.hd.items&&typeof d.hd.items==='object'&&Object.keys(d.hd.items).length)?d.hd:null;
  bkSig=JSON.stringify([S.sy.map,S.sy.gone,S.sy.del,S.sy.cfg.rev]);
  if(syMigrateHash(syCtx()))syPersist();
}
function syPersist(){
  var sg=JSON.stringify([S.sy.map,S.sy.gone,S.sy.del,S.sy.cfg.rev]),ch=!!bkSig&&sg!==bkSig;
  bkSig=sg;
  lsSet(SY_KEY,JSON.stringify({cfg:S.sy.cfg,map:S.sy.map,gone:S.sy.gone,del:S.sy.del,rv:S.sy.rv,fr:S.sy.fr,ph:S.sy.phSeen,hd:S.sy.hold,dq:S.sy.dq,pt:S.sy.pt,hl:S.sy.heal,bs:S.sy.bs}));
  if(ch)bkTouch();
}
function syCtx(){return{ings:S.ings,recipes:S.recipes,map:S.sy.map,cats:ensureMenu(),gone:S.sy.gone,del:S.sy.del,bases:S.sy.bases||{}};}
/* вы удалили ТТК: на проверку это не уходит и в журнал не попадает, а при получении общего блюдо не возвращается */
function syForgetRec(id){
  var e=S.sy.map.rec[id];
  syMarkDel('rec',id);
  if(e&&e.sid){S.sy.gone['rec|'+e.sid]=1;syPersist();}
  delete S.sy.map.rec[id];
}
/* вы удалили сырьё: оно не возвращается из общей базы, а удаление уходит остальным вместе с вашими изменениями */
/* вернуть удалённое: позиция берётся такой, как она сейчас в общей базе */
function syUndel(kind,sid){
  var k=kind+'|'+sid,R=S.sy.pub[k];
  delete S.sy.del[k];delete S.sy.gone[k];
  if(R&&R.json&&!R.json._del){
    var j=kind==='ing'?syIngClean(R.json):syRecClean(R.json);
    syApplyPlan(syCtx(),[{kind:kind,sid:sid,name:R.name,rev:R.rev,json:j,h:syH(j),localId:'',adopt:false,state:'new'}],{});
    syChanged();syPersist();renderAll();flash('Позиция возвращена');
  }else{
    S.sy.cfg.rev=0;syPersist();renderAll();syPull(false);
  }
}
function syForgetIng(id){
  var e=S.sy.map.ing[id];
  syMarkDel('ing',id);
  if(e&&e.sid){S.sy.gone['ing|'+e.sid]=1;syPersist();}
  delete S.sy.map.ing[id];
}
/* позиция была в общей базе: удаление ждёт отправки (у технолога «Опубликовать сразу», у редактора проверка) */
function syMarkDel(kind,id){
  if(!syLinked()||!syCanSend())return;
  var e=syMap(syCtx(),kind)[id],o=(kind==='ing'?S.ings:S.recipes)[id];
  if(!e||!e.sid||!(e.rev>0)||!o)return;
  S.sy.del[kind+'|'+e.sid]={kind:kind,sid:e.sid,name:String(o.name||'Без названия'),rev:e.rev};
  syPersist();
}
function syOk(){var c=S.sy.cfg;return!!(c.url&&c.name.trim()&&c.code);}
function syLinked(){return syOk()&&!!S.sy.cfg.role;}
function syAdmin(){return S.sy.cfg.role==='admin';}
/* роли: технолог (всё), редактор (то же, но правки уходят технологу на подтверждение), тер. управляющий (меню и финансы, ABC, ОП-1, цены сырья; без ТТК; правки на подтверждение),
   шеф-повар (видит всё без права правки; из ТТК только рассчитанные и файлы в облаке, и ОП-1),
   аудит (то же, что шеф-повар, но вход по одному коду без имени, а скачанная ТТК остаётся как в файле, без правки шапки) */
var SY_ROLES={admin:'технолог',editor:'редактор',finance:'тер. управляющий',viewer:'шеф-повар',audit:'аудит'};
function syRoleName(r){return SY_ROLES[r]||'';}
/* скрипт в таблице старее файла: что это значит для того, кто подключился (в версии 8 редактор стал видеть цены) */
function syOldNote(role,v){
  v=v||0;if(v>=8)return'';
  if(role==='admin')return' Скрипт прежней версии: по коду редактора он ещё прячет цены (в новой версии редактор их видит), а страницу по ссылке отдавать не умеет. Вставьте новый скрипт (кнопка ниже) и разверните его заново.';
  if(role==='editor')return' Внимание: в таблице стоит прежняя версия скрипта, она прячет цены от редактора. Попросите технолога вставить новый скрипт и развернуть его заново.';
  return'';
}
function syPriceRole(r){return r==='admin'||r==='editor'||r==='finance'||r==='viewer'||r==='audit';}
function syCanSend(){return S.sy.cfg.role!=='viewer'&&S.sy.cfg.role!=='audit';}
/* тер. управляющий и шеф-повар: ограниченный вид; права на вкладки и на правку считаются здесь, в одном месте */
function syMgr(){return S.mode==='local'&&syLinked()&&S.sy.cfg.role==='finance';}
/* «шеф-повар» в кодах ниже — любой код только для чтения: шеф-повар и аудит */
function syChef(){return S.mode==='local'&&syLinked()&&(S.sy.cfg.role==='viewer'||S.sy.cfg.role==='audit');}
function syAudit(){return S.mode==='local'&&syLinked()&&S.sy.cfg.role==='audit';}
function syLimited(){return syMgr()||syChef();}
/* правка через интерфейс закрыта: данные из БД только для чтения или код шеф-повара (синхронизация при этом сохраняет данные как обычно) */
function uiRO(){return!!S.readOnly||syChef();}
function roFlash(){flash(syAudit()?'У аудита доступ только для чтения и выгрузки: менять данные нельзя':(syChef()?'У шеф-повара доступ только для чтения: менять данные нельзя':'Нет права на запись: данные открыты только для просмотра'));}
function tabOk(t){
  if(guestOn())return t==='menu'||t==='sync';
  if(syMgr())return t==='home'||t==='menu'||t==='abc'||t==='op1'||t==='base'||t==='sync'||t==='rev'||t==='dir'||t==='fc';
  if(syChef())return t!=='calc';
  return true;
}
/* ТТК рассчитана: есть состав, все строки привязаны к сырью из базы, задан выход, КБЖУ считается */
function calcReady(r){
  if(!r||!Array.isArray(r.rows)||!(r.output>0))return false;
  if(!r.rows.some(function(x){return x&&x.net>0;}))return false;
  var c=compute(r,S.ings);
  return c.unassigned===0&&c.missing===0&&c.eff>0;
}
/* права на цены нет, если файл привязан к общей базе (адрес вшит или задан), а код ещё не введён или не подошёл */
function priceBlocked(){
  if(S.mode!=='local')return false;
  var c=S.sy.cfg;
  if(syPriceRole(c.role))return false;
  return!!(c.url||syBakedUrl()||syPtrLink());
}
function applyPriceMode(){
  var np=priceBlocked();
  NOPRICE=np;
  if(S.mode!=='local'||!S.loaded.ingredients||!S.loaded.recipes)return;
  var c=S.sy.cfg,want=np?'np':'';
  if((c.hm||'')===want)return;
  syRehash(syCtx(),np);
  c.hm=want;
  if(!np)c.rev=0;        // цены открылись: общую базу нужно получить заново, теперь уже с ценами
  syPersist();
}
function syWhen(ms){if(!ms)return'';var d=new Date(ms);function z(n){return(n<10?'0':'')+n;}return z(d.getDate())+'.'+z(d.getMonth()+1)+' '+z(d.getHours())+':'+z(d.getMinutes());}
function syMsg(key,state,text){
  S.sy.msg[key]={state:state,msg:text};if((key==='send'||key==='pull')&&typeof renderStatus==='function')renderStatus();
  var el=$('#sym-'+key);
  if(el){el.textContent=text;el.className='hint cmsg '+state;el.hidden=!text;}
}

/* ---------- файл с адресом подключения: адрес скрипта берётся из маленькой таблицы на Диске, а не вводится руками ---------- */
var SY_EXEC_RE=/https:\/\/script\.google\.com\/(?:macros\/s|a\/macros\/[\w.-]+\/s)\/[\w-]+\/exec|http:\/\/(?:127\.0\.0\.1|localhost):\d+\/exec/;
function syAddrKind(t){
  t=String(t||'').trim();
  if(!t)return'';
  if(/^https?:\/\/\S+\/exec(\?\S*)?$/i.test(t))return'exec';
  /* файл подключения: таблица Google (любая ссылка) или прямая ссылка на .csv/.txt/.json */
  return(/^https?:\/\/docs\.google\.com\/spreadsheets\//i.test(t)||/^https?:\/\/\S+\.(csv|txt|json)(\?\S*)?$/i.test(t))?'ptr':'';
}
function syPid(link){var m=/\/spreadsheets\/d\/([\w-]+)/.exec(String(link||''));return m?m[1]:'';}
function syBakedUrl(){var u=(typeof window!=='undefined'&&window.KBZHU_URL)?String(window.KBZHU_URL):'';return syAddrKind(u)==='exec'?u:'';}
function syPtrLink(){return S.sy.cfg.ptr||(typeof window!=='undefined'&&window.KBZHU_PTR?String(window.KBZHU_PTR):'');}
function syFindExec(rows){
  var i,j,m;
  for(i=0;i<(rows||[]).length;i++)for(j=0;j<rows[i].length;j++){m=SY_EXEC_RE.exec(String(rows[i][j]||''));if(m)return m[0];}
  return'';
}
function syFetchPtr(link){
  return cloudFetch(link).then(function(r){
    var u=syFindExec(r.rows);
    if(!u)throw{code:'noaddr'};
    return u;
  });
}
/* адрес в файле мог измениться (технолог развернул скрипт заново): обновляем у себя; связи с общей базой при этом не теряются */
function syFreshAddr(force){
  var link=syPtrLink(),now=Date.now();
  if(!link||S.mode!=='local')return Promise.resolve(false);
  if(S.sy.ptrP)return S.sy.ptrP;
  if(!force&&now-S.sy.ptrAt<300000)return Promise.resolve(false);
  if(force&&now-S.sy.ptrFailAt<20000)return Promise.resolve(false);
  S.sy.ptrP=syFetchPtr(link).then(function(u){
    S.sy.ptrAt=Date.now();
    var c=S.sy.cfg,old=c.url;
    if(!u||u===old)return false;
    if(c.mapUrl&&c.mapUrl===old)c.mapUrl=u;
    c.url=u;if(S.sy.addr&&syAddrKind(S.sy.addr)==='exec')S.sy.addr=undefined;
    syPersist();
    return true;
  }).catch(function(){S.sy.ptrFailAt=Date.now();return false;}).then(function(ch){S.sy.ptrP=null;return ch;});
  return S.sy.ptrP;
}

