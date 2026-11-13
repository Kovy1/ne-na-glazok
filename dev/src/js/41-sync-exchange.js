/* ---------- обмен со скриптом ---------- */
function syErrText(e){
  var c=e&&e.code;
  if(c==='gas'){
    if(e.err==='code')return'Код не подходит. Введите код, который вам выдали (технолога, редактора, тер. управляющего или шеф-повара). Если вы технолог: коды в скрипте должны быть не короче 4 знаков и разными, а после правки скрипта нужна новая версия развёртывания.';
    if(e.err==='viewer')return String(e.msg||'Это код шеф-повара: он только читает, отправлять правки и файлы по нему нельзя.');
    if(e.err==='a'||e.err==='op')return'В таблице стоит старая версия скрипта, она не умеет работать с файлами. Откройте вкладку «Личный кабинет» → «Настройка скрипта»: скопируйте новый скрипт, вставьте его вместо старого (коды задайте те же), выполните «setup» и создайте новую версию развёртывания.';
    return String(e.msg||'Скрипт вернул ошибку.');
  }
  if(c==='testprod')return'ТЕСТОВАЯ ВЕРСИЯ: рабочая общая база заблокирована, чтобы ничего не испортить. Подключите отдельную тестовую копию таблицы со своим скриптом.';
  if(c==='ac')return String(e.msg||'Не удалось разделить данные пользователей.');
  if(c==='url')return'Вставьте адрес веб-приложения из Apps Script (он оканчивается на /exec) или ссылку на файл подключения.';
  if(c==='ptrfail')return'Не удалось прочитать файл подключения. '+cloudErrText(e.inner);
  if(c==='noaddr')return'В файле подключения нет адреса скрипта. Пусть технолог один раз подключится в калькуляторе по адресу скрипта: адрес запишется в файл сам.';
  if(c==='blocked'||c==='gv'){
    var inCl=typeof location!=='undefined'&&/claude/i.test(location.hostname);
    return'Нет связи с общей базой. Проверьте интернет и повторите.'+(inCl?' Из окна claude.ai связь закрыта: откройте автономный файл.':' Если не помогает, технологу: развёртывание скрипта должно быть открыто для «Все», адрес оканчиваться на /exec, а после правки скрипта нужна новая версия развёртывания.');
  }
  if(c==='wait')return'Скрипт не подтвердил запись за 30 секунд. Нажмите «Обновить»: возможно, запись всё же прошла.';
  return'Не получилось: '+(e&&e.message?e.message:'неизвестная ошибка')+'.';
}
var SY_AUTH_ACTS={dir:1,rvlist:1,rvget:1,users:1,inbox:1,pull:1,pending:1,log:1,files:1,file:1,prices:1,pprev:1,parch:1,pfile:1,bkinfo:1,bkget:1,pageinfo:1,lay:1,phlist:1,phget:1,hist:1,aiinfo:1,aimodels:1,fcidx:1,fcget:1,fcusers:1,fcmine:1};
function syGet(params,ms,again){
  var u=S.sy.cfg.url,q='callback=__CB__';
  if(SY_AUTH_ACTS[params.a]&&S.sy.cfg.code)q+='&code='+encodeURIComponent(S.sy.cfg.code)+'&who='+encodeURIComponent(String(S.sy.cfg.name||'').trim())+'&bkt='+encodeURIComponent(acBkt());
  Object.keys(params).forEach(function(k){q+='&'+encodeURIComponent(k)+'='+encodeURIComponent(params[k]);});
  return jsonpGet(u+(u.indexOf('?')>-1?'&':'?')+q,ms).then(function(d){
    if(!d||d.ok===false){
      /* код больше не подходит: права снимаются, цены закрываются, пока не подключатся заново */
      if(d&&(d.err==='code'||d.err==='off')&&SY_AUTH_ACTS[params.a]&&S.sy.cfg.role){S.sy.cfg.role='';syPersist();}
      throw{code:'gas',err:d&&d.err,msg:d&&d.msg,res:d};
    }
    return d;
  },function(e){
    /* адрес не отвечает: если он взят из файла подключения, смотрим, не сменился ли он там, и пробуем ещё раз */
    if(!again&&(e&&(e.code==='blocked'||e.code==='gv'))&&syPtrLink())return syFreshAddr(true).then(function(ch){if(ch)return syGet(params,ms,true);throw e;});
    throw e;
  });
}
function syWait(rid,n,max){
  return new Promise(function(r){setTimeout(r,n===0?400:900);}).then(function(){return syGet({a:'result',rid:rid});}).then(function(d){
    if(d.done){
      if(d.res&&d.res.ok===false)throw{code:'gas',err:d.res.err,msg:d.res.msg,res:d.res};
      return d.res;
    }
    if(n>=(max||32))throw{code:'wait'};
    return syWait(rid,n+1,max);
  });
}
/* запись: тело уходит без чтения ответа (так её принимает любой браузер), итог забирается по номеру запроса */
function syPost(op,extra,code,maxWait){
  if(testProd(S.sy.cfg.url))return Promise.reject({code:'testprod'});
  var c=S.sy.cfg,req={op:op,code:code||c.code,by:c.name.trim(),bkt:acBkt(),rid:'q'+uid()+Math.random().toString(36).slice(2,6)};
  Object.keys(extra||{}).forEach(function(k){req[k]=extra[k];});
  return fetch(c.url,{method:'POST',mode:'no-cors',credentials:'omit',cache:'no-store',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(req)})
    .then(function(){return syWait(req.rid,0,maxWait);},function(){throw{code:'blocked'};});
}
function syBusy(k,v){S.sy.busy[k]=v;if(typeof renderStatus==='function'&&S.mode==='local')renderStatus();}

/* ---------- общая история цен ----------
   Каждая загрузка цен 1С — запись истории (settings/ph_<регион>_<с>_<по>). Она лежит на Диске в папке «История цен»: кто бы ни загрузил цены,
   анализ изменений видят все, у кого открыты цены. S.sy.phSeen: записи, которые уже были на Диске (id → когда). Запись, которую убрали на Диске,
   убирается и здесь; записи, которых на Диске ещё нет (загружены до общей истории), уходят туда сами. */
if(!S.sy.phSeen)S.sy.phSeen={};
function syPhOn(){return S.mode==='local'&&syLinked()&&!NOPRICE;}
function syPhPush(id){
  var b=S.cfg[id];
  if(!syPhOn()||!syCanSend()||!b||!isPhId(id))return Promise.resolve(null);
  return syPost('phput',{id:id,rec:b},syCode()).then(function(){S.sy.phv=undefined;return true;},function(){return false;});
}
/* выполнить задачи (функции, возвращающие обещание) не больше n одновременно; ошибка одной не останавливает остальные */
function syPool(tasks,n){
  return new Promise(function(res){
    var i=0,run=0,done=0,total=tasks.length;
    if(!total){res();return;}
    function next(){
      while(run<n&&i<total){
        (function(f){
          var p;run++;
          try{p=Promise.resolve(f());}catch(e){p=Promise.resolve();}
          p.then(function(){},function(){}).then(function(){run--;done++;if(done>=total)res();else next();});
        })(tasks[i++]);
      }
    }
    next();
  });
}
function syPhSync(){
  if(!syPhOn()||S.sy.busy.ph)return Promise.resolve();
  syBusy('ph',true);
  return phReady.then(function(){return syGet({a:'phlist'},30000);}).then(function(d){
    var items=(d&&d.items)||[],srv={},seen=S.sy.phSeen,ps=[],ch=false,mine=syCanSend();
    items.forEach(function(it){srv[it.id]=it;});
    items.forEach(function(it){
      var loc=S.cfg[it.id],sa=Number(it.at)||0;
      if(loc&&seen[it.id]===sa)return;
      if(loc){
        if(seen[it.id]===undefined&&it.n===loc.it.length){seen[it.id]=sa;ch=true;return;}       /* та же запись: просто помечаем, что она на Диске */
        if(mine&&(Number(loc.at)||0)>sa){ps.push(function(){return syPhPush(it.id);});return;}   /* ваша запись новее той, что на Диске */
      }
      ps.push(function(){return syGet({a:'phget',id:it.id},60000).then(function(r){
        if(!r||!r.rec)return;
        S.cfg[it.id]=normPh(r.rec);seen[it.id]=sa;queueSave('settings',it.id);ch=true;
      },function(){});});
    });
    Object.keys(S.cfg).filter(isPhId).forEach(function(id){
      if(srv[id])return;
      if(seen[id]!==undefined){delete S.cfg[id];seen[id]=-1;queueSave('settings',id);ch=true;}       /* технолог убрал запись для всех; метка -1 не даёт вернуть её на Диск, если страницу закрыли раньше, чем удаление записалось */
      else if(mine)ps.push(function(){return syPhPush(id);});                                              /* загружена до общей истории */
    });
    if(typeof d.v==='number')S.sy.phv=d.v;
    return syPool(ps,3).then(function(){syBusy('ph',false);if(ch){syPersist();scheduleRender();}});
  },function(){syBusy('ph',false);});
}

/* ---------- подключение ---------- */
function syReadFields(){
  ['name','code'].forEach(function(k){var el=$('#sy-'+k);if(el)S.sy.cfg[k]=k==='name'?el.value:el.value.trim();});
  var u=$('#sy-url');if(u)S.sy.addr=u.value.trim();
}
/* что показать в поле адреса: набранное, иначе файл подключения (он постоянный), иначе адрес скрипта */
function syAddrShown(){return S.sy.addr!==undefined?S.sy.addr:(S.sy.cfg.ptr||S.sy.cfg.url);}
function syConnect(){
  if(S.sy.busy.conn)return;
  syReadFields();
  var c=S.sy.cfg,v=S.sy.addr,kind;
  if(!v)v=S.sy.cfg.ptr||(typeof window!=='undefined'&&window.KBZHU_PTR?String(window.KBZHU_PTR):'')||c.url||syBakedUrl();
  kind=syAddrKind(v);
  if(!kind){syMsg('conn','err',syErrText({code:'url'}));return;}
  if(!c.code){syMsg('conn','err','Введите код доступа.');return;}               /* имя нужно всем, кроме кода аудита: это видно только по ответу скрипта */
  syBusy('conn',true);syMsg('conn','busy',kind==='ptr'?'Читаю адрес из файла подключения…':'Проверяю подключение…');scheduleRender();
  var role='',info=null,addrNote='';
  /* файл подключения не читается (сеть оператора, блокировщик, Google не открыл таблицу), а адрес скрипта уже известен — подключаемся по нему */
  var known=(syAddrKind(c.url)==='exec'&&c.url)||syBakedUrl();
  var step=kind==='exec'?Promise.resolve(v):syFetchPtr(v).then(function(u){c.ptr=v;return u;},function(e){
    if(known)return known;
    throw(e&&e.code==='noaddr')?e:{code:'ptrfail',inner:e};
  });
  step.then(function(u){
    c.url=u;
    return syPost('auth',{},c.code);
  }).then(function(r){
    role=r.role;c.mine=!!r.mine;
    if(r.mine&&r.name)c.name=r.name;              /* именной доступ: ФИО как его ввёл технолог */
    if(!c.name.trim()||(role!=='audit'&&!r.mine&&c.name.trim()==='Аудит')){if(role==='audit')c.name='Аудит';else throw{code:'noname'};}   /* код аудита работает без имени, остальным ФИО нужно для журнала (подставленное «Аудит» чужому коду не подходит) */
    if(r.temp)throw{code:'first'};                /* выданный технологом код временный: человек сначала придумывает свой */
    S.sy.first=false;
    return acAuth(r).then(function(){return syGet({a:'ping'});});
  }).then(function(i){
    info=i;
    var dbId=syPid(info.ptr)||c.url;
    /* другая общая база (не тот же скрипт после нового развёртывания): прежние связи не подходят */
    if(c.mapUrl&&c.mapUrl!==c.url&&c.mapUrl!==dbId){S.sy.map={ing:{},rec:{}};S.sy.gone={};S.sy.del={};c.rev=0;}
    c.mapUrl=dbId;c.role=role;applyPriceMode();
    if(info.ptr)c.ptr=info.ptr;else if(kind==='exec')c.ptr='';
    S.sy.info=info;S.sy.addr=undefined;S.sy.ptrAt=Date.now();syPersist();
    /* технолог при подключении записывает в файл актуальный адрес: остальным он подтянется сам */
    if(role==='admin'&&(info.v||0)>=3){
      return syPost('addr',{url:c.url},c.code).then(function(r){
        if(r&&r.ptr){c.ptr=r.ptr;syPersist();}
        if(r&&r.shared===false)addrNote=' Файл подключения создан, но Google не дал открыть его по ссылке: откройте доступ вручную (на Диске: «Все, у кого есть ссылка», чтение).';
      },function(e){addrNote=' Файл подключения записать не удалось: '+syErrText(e);});
    }
  }).then(function(){
    syBusy('conn',false);
    syMsg('conn','ok','Подключено: '+syRoleName(role)+(syPriceRole(role)?'':' (цены не показываются)')+'. Версия общей базы '+info.rev+(info.pending?', на проверке: '+info.pending:'')+'.'+addrNote+syOldNote(role,info.v));
    S.sy.loaded=false;S.sy.loadErr='';S.sy.preSaved=false;
    syRefresh(true);syPull(true);bkRefresh();pgLoad();
  }).catch(function(e){
    syBusy('conn',false);c.role='';syPersist();
    if(e&&e.code==='noname'){syMsg('conn','err','Укажите своё ФИО: оно попадёт в журнал изменений. Без имени входит только аудит по своему коду.');c.role='';syPersist();scheduleRender();return;}
    if(!c.name.trim()&&e&&e.code==='gas'&&e.err==='code'){syMsg('conn','err','Код не подходит. Если вам завели личный доступ, введите ещё и ФИО. Для кода аудита ФИО не нужно.');scheduleRender();return;}
    if(e&&e.code==='first'){S.sy.first=true;syMsg('conn','ok','Вы входите впервые. Придумайте свой код доступа ниже: выданный технологом после этого перестанет работать.');scheduleRender();return;}
    syMsg('conn','err',syErrText(e));scheduleRender();
  });
}
/* свой код: при первом входе по выданному технологом и позже в «Личном кабинете» (только для именных доступов) */
function syNcField(k,label){return'<label class="field"><span class="lbl">'+label+'</span><input id="sy-'+k+'" type="password" spellcheck="false" autocomplete="new-password" data-act="syNc" data-fk="sy:'+k+'" placeholder="От 4 символов, без пробелов"></label>';}
function syMyCodeSave(first){
  var a=String(($('#sy-nc1')||{}).value||'').trim(),b=String(($('#sy-nc2')||{}).value||'').trim(),c=S.sy.cfg;
  function bad(t){syMsg('conn','err',t);scheduleRender();}
  if(a.length<4)return bad('Код не короче 4 символов.');
  if(/\s/.test(a))return bad('В коде не должно быть пробелов.');
  if(a!==b)return bad('Коды не совпали: повторите.');
  if(a===c.code)return bad('Придумайте код, отличный от прежнего.');
  syBusy('conn',true);syMsg('conn','busy','Сохраняю код…');scheduleRender();
  syPost('usrmine',{newCode:a},c.code).then(function(){
    c.code=a;syPersist();syBusy('conn',false);
    var el=$('#sy-code');if(el)el.value=a;
    if(first){syConnect();return;}
    syMsg('conn','ok','Код изменён. Входите теперь по новому коду.');flash('Код изменён');scheduleRender();
  },function(e){syBusy('conn',false);syMsg('conn','err',syErrText(e));scheduleRender();});
}
function syDisconnect(){
  S.sy.cfg={url:'',name:S.sy.cfg.name,code:'',auto:false,rev:0,role:'',mapUrl:'',ptr:S.sy.cfg.ptr,pfAuto:S.sy.cfg.pfAuto!==false,bkAuto:S.sy.cfg.bkAuto!==false,bkRev:S.sy.cfg.bkRev||0,bkWho:S.sy.cfg.bkWho||'',bkDirty:!!S.sy.cfg.bkDirty,bkDev:S.sy.cfg.bkDev||'',bkAt:S.sy.cfg.bkAt||0,pubAuto:S.sy.cfg.pubAuto===true,pubDocs:S.sy.cfg.pubDocs!==false};S.sy.bk=null;S.sy.pg=null;S.sy.pf=pfFresh();S.sy.addr=undefined;
  S.sy.heal=0;S.sy.bs=0;S.sy.map={ing:{},rec:{}};S.sy.gone={};S.sy.del={};S.sy.phSeen={};S.sy.phv=undefined;S.sy.info=null;S.sy.plan=null;S.sy.pend=null;S.sy.log=null;S.sy.pub={};S.sy.msg={};S.sy.hold=null;S.sy.holdAsk=false;S.sy.first=false;S.sy.us={list:null,busy:false,open:false,f:{name:'',role:'editor',own:true},made:null,err:''};S.sy.files=null;S.sy.lay=null;S.sy.layKnown=false;S.sy.layForce=false;S.sy.layGm=null;S.sy.gmQ=null;
  syPersist();renderAll();flash('Отключено. Ваши данные остались в этом браузере');
}

/* ---------- получение общего ---------- */
function syChanged(){queueSave('ingredients','sync');queueSave('recipes','sync');}
/* Миграция: у позиции, уже связанной с общей базой, цены на этом устройстве пропали (так вышло в версии 79: «Оставить моё» при пустых ценах).
   Пустое место на устройстве — не доказательство, что цены нет: недостающие цены берутся из общей базы. Свои заполненные цены не трогаются,
   ничего не отправляется. Выполняется один раз на устройство. */
function syHealPrices(ctx,items){
  var m=syMap(ctx,'ing'),by=Object.create(null),n=0;
  Object.keys(m).forEach(function(id){if(m[id]&&m[id].sid&&m[id].rev>0&&ctx.ings[id])by[m[id].sid]=id;});
  items.forEach(function(R){
    if(R.kind!=='ing'||!R.json||R.json._del)return;
    var id=by[R.sid],loc=id&&ctx.ings[id],j,k,did=false,r,have;
    if(!loc)return;
    j=normIng(syIngClean(R.json));
    ['price','priceUnit','packG','priceSrc'].forEach(function(f){
      if((loc[f]===undefined||loc[f]===null||(f==='priceUnit'&&loc.price===undefined&&j.price!==undefined))&&j[f]!==undefined&&j[f]!==null){loc[f]=j[f];did=true;}
    });
    if(j.px&&typeof j.px==='object'){
      have=(loc.px&&typeof loc.px==='object')?loc.px:{};
      for(r in j.px){if(have[r]===undefined){have[r]=j.px[r];did=true;}}
      if(did||loc.px)loc.px=have;
    }
    if(did)n++;
  });
  return n;
}
/* снимок общей версии на момент последней сверки: от него считается объединение трёх версий. Лежит на устройстве (IndexedDB), не в основном хранилище */
function syBaseKey(kind,sid){return'base:'+(S.sy.cfg.uid||S.sy.cfg.name||'-')+':'+kind+'|'+sid;}
function syBasesSave(list){
  if(!list||!list.length)return Promise.resolve();
  try{return acKvPutMany(list.map(function(b){return[syBaseKey(b.kind,b.sid),b.json];}))['catch'](function(){});}catch(e){return Promise.resolve();}
}
/* основы нужны только там, где пришла новая общая версия, а у вас запись менялась */
function syBasesFor(items){
  var ctx=syCtx(),want=[],idx={ing:Object.create(null),rec:Object.create(null)};
  ['ing','rec'].forEach(function(k){var m=syMap(ctx,k);Object.keys(m).forEach(function(id){if(m[id]&&m[id].sid)idx[k][m[id].sid]=id;});});
  items.forEach(function(R){
    if(!R||(R.json&&R.json._del))return;
    var id=idx[R.kind]&&idx[R.kind][R.sid],e,src;
    if(!id)return;
    e=syMap(ctx,R.kind)[id];src=R.kind==='ing'?ctx.ings:ctx.recipes;
    if(!e||!(e.rev>0)||!src[id]||syCur(ctx,R.kind,id).h===e.h)return;
    want.push(R.kind+'|'+R.sid);
  });
  if(!want.length)return Promise.resolve({});
  function key(k){var i=k.indexOf('|');return syBaseKey(k.slice(0,i),k.slice(i+1));}
  try{
    return acKvGetMany(want.map(key)).then(function(o){var out={};want.forEach(function(k){if(o[key(k)])out[k]=o[key(k)];});return out;},function(){return{};});
  }catch(e){return Promise.resolve({});}
}
/* карточка ТТК открыта и в ней сейчас вводят текст: входящее её не трогает, применится после закрытия */
function syOpenCard(){
  var a;
  if(S.tab!=='calc'||!S.active||!S.recipes[S.active]||typeof document==='undefined')return'';
  a=document.activeElement;
  if(!a||!/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)||!a.closest||!a.closest('#view'))return'';
  return S.active;
}
function syOpenRetry(){
  if(S.sy.openT)return;
  S.sy.openT=setTimeout(function(){
    S.sy.openT=0;
    if(!S.sy.openSkip||!syLinked())return;
    if(syOpenCard()||S.sy.busy.pull){syOpenRetry();return;}
    S.sy.openSkip=0;syPull(true);
  },8000);
}
function syPull(auto,quick){
  if(!syLinked()||S.sy.busy.pull)return Promise.resolve();
  syBusy('pull',true);S.sy.merged=0;if(!auto){syMsg('pull','busy','Получаю обновления…');scheduleRender();}
  var healAll=!S.sy.heal&&!NOPRICE;     /* один раз на устройство: полная сверка цен (см. syHealPrices) */
  var fullAll=healAll||!S.sy.bs;     /* один раз на устройство: полная сверка заодно сохраняет снимки общих версий для объединения правок */
  return syGet({a:'pull',since:fullAll?0:S.sy.cfg.rev}).then(function(d){
    return acPull(d).then(function(ch){
    if(ch){syBusy('pull',false);return syPull(auto,quick);}      /* регионы изменились: общую базу берём заново */
    d.items.forEach(function(it){if(it.json&&it.json._del)delete S.sy.pub[it.kind+'|'+it.sid];else S.sy.pub[it.kind+'|'+it.sid]=it;});
    var healed=healAll?syHealPrices(syCtx(),d.items):0;
    if(healAll){S.sy.heal=1;syPersist();if(healed){syChanged();flash('Вернул цены из общей базы: '+healed+' поз. Ничего не отправлено.');}}
    return syBasesFor(d.items).then(function(bs){
    S.sy.bases=bs;
    var plan=syPlanPull(syCtx(),d.items),n={'new':0,update:0,conflict:0,same:0,'delete':0,migrate:0};
    var take=!syAdmin();   /* не технолог: версия технолога главная, расхождения не разбираются; свои правки, которые она заменила, откладываются */
    /* открытая карточка: пока в ней вводят текст, входящее для неё откладывается (версию заберёт следующая сверка) */
    var openId=syOpenCard(),later=0;
    if(openId)plan=plan.filter(function(p0){if(p0.kind==='rec'&&p0.localId===openId&&p0.state!=='same'){later++;return false;}return true;});
    S.sy.openSkip=later;
    if(later)syOpenRetry();
    plan.forEach(function(p){n[p.state==='merge'?'update':(p.state==='migrate'?'update':p.state)]++;});
    /* то, что заменится общей версией и чего нет нигде, кроме вашего устройства: сначала копия на устройство, и только после записи — замена */
    var repl=plan.filter(function(p0){return p0.localId&&(p0.state==='migrate'||(take&&p0.state==='conflict'));});
    return syPreBackup(repl).then(function(ok){
    syBusy('pull',false);
    if(!ok){
      S.sy.loadErr=S.sy.backupErr||'Не удалось сохранить копию ваших данных на этом устройстве. Загрузка остановлена: ваши данные не тронуты.';
      syMsg('pull','err',S.sy.loadErr);if(auto)flash('Общая база не применена: копию ваших данных сохранить не удалось');scheduleRender();upBarUpdate();
      return;
    }
    S.sy.loaded=true;S.sy.loadErr='';S.sy.backupErr='';S.sy.pullAt=Date.now();
    if(!auto&&(n['new']||n.update||n.conflict||n['delete'])&&n.same){
      /* совпавшие позиции только связываются с общей базой, данные не меняются: делаем это сразу, чтобы они не висели в «Моих изменениях» */
      var r0=syApplyPlan(syCtx(),plan.filter(function(p){return p.state==='same';}),{});syPersist();
      S.sy.merged=r0.merged;if(r0.merged)syChanged();
    }
    var defer=!take&&n.conflict>0&&(auto||quick);       /* настоящие конфликты не решаются молча: безопасное применяется сразу, спорное — в панель сравнения */
    if(take||(auto&&!defer)||(quick&&!n.conflict)||!(n['new']||n.update||n.conflict||n['delete'])){
      var ch={},hd=null;
      if(take)plan.forEach(function(p0){if(p0.state==='conflict')ch[p0.kind+'|'+p0.sid]='remote';});
      if(syHoldCan())hd=syHoldMake(plan,take);
      var res=syApplyPlan(syCtx(),plan,ch,!syAdmin());
      if(hd)syHoldAdd(hd);
            if(!later)S.sy.cfg.rev=d.rev;
      if(fullAll&&!later)S.sy.bs=1;
      syPersist();
      if(res.added||res.updated||res.merged||res.removed)syChanged();
      var parts=[];
      if(res.added)parts.push('новых '+res.added);
      if(res.updated)parts.push('обновлено '+res.updated);
      if(res.removed)parts.push('удалено '+res.removed);
      if(res.merged)parts.push('синонимов дополнено у '+res.merged);
      var tail=res.kept?(take?', осталось сырьё, которое нужно вашим ТТК: '+res.kept:', у вас оставлено своё в конфликтах: '+res.kept):'';
      var text=parts.length?'Получено из общей базы: '+parts.join(', ')+tail+'.':(res.kept?(take?'Общая база применена'+tail+'.':'Есть расхождения с общей базой: '+res.kept+', ваше оставлено. Откройте вкладку «Личный кабинет».'):'Всё актуально: в общей базе нет ничего нового.');
      syMsg('pull',(res.kept&&!take)?'warn':'ok',text+' · '+nowHm());
      if(hd)flash(take?'Данные обновлены по версии технолога. Свои правки можно вернуть кнопкой «Продолжить работу»':'Общая база загружена. Ваши прежние варианты сохранены как восстановленные черновики: кнопка «Продолжить работу» вернёт их как правки');
      else if(later&&(auto||quick))flash('Есть новая версия карточки, которую вы сейчас правите: она применится, когда вы её закроете');
      else if((auto||quick)&&(res.added||res.updated||res.removed||res.kept))flash(text);
      if(S.active&&!S.recipes[S.active]){S.active=null;}
      S.sy.plan=null;layRefresh();
    }else{
      if(defer){
        var safe=plan.filter(function(p0){return p0.state!=='conflict';}),rs=null;
        var hd2=safe.length&&syHoldCan()?syHoldMake(safe,false):null;
        if(safe.length){rs=syApplyPlan(syCtx(),safe,{});if(hd2)syHoldAdd(hd2);if(fullAll)S.sy.bs=1;syPersist();if(safe.some(function(p0){return p0.state!=='same';}))syChanged();}   /* совпавшие тоже связываются с общей версией, иначе они остаются «изменёнными» */
        plan=plan.filter(function(p0){return p0.state==='conflict';});
        n={'new':0,update:0,conflict:plan.length,same:0,'delete':0};
        if(rs&&(rs.added||rs.updated||rs.removed))flash('Получено из общей базы: '+((rs.added||0)+(rs.updated||0)+(rs.removed||0))+'. Есть расхождения: выберите, что оставить');
      }
      S.sy.plan={entries:plan,items:d.items,rev:d.rev,n:n};S.sy.choose={};S.sy.cmpOpen=(!auto&&!quick);       /* панель сравнения открывается сама только после ручного «Получить обновления»; фоновая загрузка её не навязывает */
      syMsg('pull','warn',defer?'Есть расхождения с вашими правками: '+plan.length+'. Откройте «Личный кабинет» и выберите по каждому, что оставить.':'Нашёл изменения в общей базе. Проверьте список ниже и нажмите «Применить».');
      if(quick){S.tab='sync';flash('Есть расхождения с вашими правками: выберите, что оставить, и нажмите «Применить»');}
    }
    scheduleRender();
    });
    });
    });
  }).catch(function(e){
    syBusy('pull',false);S.sy.backupErr='';
    S.sy.loadErr=syErrText(e);           /* кэш остаётся прежним; загрузку можно повторить кнопкой */
    syMsg('pull','err',S.sy.loadErr);if(auto)flash('Не удалось получить общую базу');scheduleRender();upBarUpdate();
  });
}
/* состояния загрузки общей базы: «загрузка» и «нет связи» отличаются от «данных действительно нет» (пока не загружено, нехватку цен не показываем) */
function syLoading(){return S.mode==='local'&&syLinked()&&!S.sy.loaded;}
function syLoadHtml(){
  if(S.sy.backupErr)return'<div class="incbar" role="alert"><b>Общая база не применена.</b><span class="incs">'+esc(S.sy.backupErr)+'</span><button type="button" class="btn mini" data-act="syRetryLoad">Повторить загрузку</button></div>';
  if(S.sy.loadErr)return'<div class="incbar" role="status"><b>Нет связи с общей базой.</b><span class="incs">Показаны данные, сохранённые на этом устройстве; цены могут быть неполными.</span><button type="button" class="btn mini" data-act="syRetryLoad">Повторить загрузку</button></div>';
  return'<div class="incbar" role="status"><b>Загружаю общую базу…</b><span class="incs">Цены и карты появятся после загрузки.</span></div>';
}
/* Перед первым применением общей базы: правки человека, которых нет во встроенной базе и которые затрагиваются обновлением,
   сохраняются отдельной копией на этом устройстве (IndexedDB), чтобы при любом выборе ничего не пропало */
function syPreBackup(entries){
  var o={},n=0,c=S.sy.cfg,fail=function(e){
    S.sy.backupErr='Не удалось сохранить копию ваших данных на этом устройстве'+(e&&e.message?' ('+String(e.message).slice(0,80)+')':'')+'. Загрузка остановлена: ваши данные не тронуты. Нажмите «Повторить загрузку».';
    return false;
  };
  (entries||[]).forEach(function(p){
    var src=p.kind==='ing'?S.ings:S.recipes;
    if(p.localId&&src[p.localId]){o[p.kind+'|'+p.localId]={kind:p.kind,id:p.localId,sid:p.sid,name:p.curName||p.name,j:JSON.parse(JSON.stringify(src[p.localId]))};n++;}
  });
  if(!n)return Promise.resolve(true);
  /* «копия есть» только после подтверждённой записи; ошибка не глушится: замена не выполняется, данные остаются как были */
  try{
    return acKvPut('pre:'+(c.uid||c.name||'-')+':'+Date.now(),{at:Date.now(),items:o}).then(function(){S.sy.backupErr='';S.sy.preSaved=true;return true;},fail);
  }catch(e){return Promise.resolve(fail(e));}
}
/* Не технолог (редактор, тер. управляющий, шеф-повар): при получении общего версия технолога применяется целиком, выбирать не нужно.
   Редактору и тер. управляющему копии их неотправленных правок, которые эта версия заменила, откладываются на плашку «Продолжить работу»:
   это только страховка от потерь при обновлении. Если замен не было, остаётся одна версия технолога и кнопки нет. */
function syHoldCan(){return S.sy.cfg.role==='admin'||S.sy.cfg.role==='editor'||S.sy.cfg.role==='finance';}
function syHoldMake(plan,take){
  var ctx=syCtx(),items={},n=0;
  plan.forEach(function(e){
    var src=e.kind==='ing'?ctx.ings:ctx.recipes,o=e.localId&&src[e.localId];
    if(!o||!(e.state==='migrate'||(take&&e.state==='conflict')))return;
    items[e.kind+'|'+e.sid]={kind:e.kind,sid:e.sid,id:e.localId,name:String(e.curName||o.name||''),j:JSON.parse(JSON.stringify(o))};
    n++;
  });
  return n?items:null;
}
function syHoldAdd(items){
  var h=S.sy.hold||{at:0,items:{}};
  Object.keys(items).forEach(function(k){h.items[k]=items[k];});
  h.at=Date.now();S.sy.hold=Object.keys(h.items).length?h:null;S.sy.holdAsk=false;
}
/* вернуть отложенные правки поверх версии технолога; то, что вы уже правили заново после обновления, не затирается */
function syHoldBack(){
  var h=S.sy.hold,ctx=syCtx(),back=0,skip=0,keys;
  if(!h)return;
  keys=Object.keys(h.items);
  ['ing','rec'].forEach(function(kind){
    keys.forEach(function(k){
      var it=h.items[k],src,m,e,cur,bad;
      if(it.kind!==kind)return;
      src=kind==='ing'?ctx.ings:ctx.recipes;m=syMap(ctx,kind);
      if(src[it.id]){
        e=m[it.id];cur=syCur(ctx,kind,it.id);
        if(e&&e.h&&cur.h!==e.h){skip++;return;}
      }
      if(kind==='rec'){
        bad=(it.j.rows||[]).some(function(x){return x.ing&&!ctx.ings[x.ing];});
        if(bad){skip++;return;}
      }
      src[it.id]=kind==='ing'?normIng(it.j):normRecipe(it.j);back++;
    });
  });
  S.sy.hold=null;S.sy.holdAsk=false;
  syPfResolve(ctx);syPersist();
  if(back)syChanged();
  layRefresh();renderAll();upBarUpdate();
  flash(back?'Ваши правки возвращены: '+back+(skip?'. Не возвращено, потому что вы уже правили заново: '+skip:'')+'. Они ждут отправки технологу':'Возвращать нечего: вы уже правили заново');
}
function syHoldDrop(){S.sy.hold=null;S.sy.holdAsk=false;syPersist();upBarUpdate();}
function syHoldBarHtml(){
  var hd=S.sy.hold,ks=Object.keys(hd.items),ni=0,nr=0,p=[],nm=[];
  ks.forEach(function(k){var x=hd.items[k];if(x.kind==='ing')ni++;else nr++;if(nm.length<3&&x.name)nm.push(x.name);});
  if(ni)p.push('сырьё и цены: '+ni);
  if(nr)p.push('ТТК: '+nr);
  if(S.sy.holdAsk)return'<div class="upbar rev" role="alert"><div class="upt"><b>Отбросить свои правки?</b><span>Останется только версия технолога ('+esc(p.join(', '))+'). Вернуть их потом будет нельзя.</span></div><span class="upbtns"><button class="btn big" data-act="hdDrop">Отбросить</button><button class="btn" data-act="hdNo">Назад</button></span></div>';
  if(syAdmin())return'<div class="upbar rev" role="status"><div class="upt"><b>Общая база загружена</b><span>Ваши прежние варианты сохранены как восстановленные черновики ('+esc(p.join(', '))+(nm.length?': '+esc(nm.join(', '))+(ks.length>nm.length?'…':''):'')+'). Они сами никуда не отправятся. «Продолжить работу» вернёт их как ваши правки.</span></div><span class="upbtns"><button class="btn big" data-act="hdBack">Продолжить работу</button><button class="btn" data-act="hdAsk">Не нужно</button></span></div>';
  return'<div class="upbar rev" role="status"><div class="upt"><b>Данные обновлены по версии технолога</b><span>Ваши последние правки отложены ('+esc(p.join(', '))+(nm.length?': '+esc(nm.join(', '))+(ks.length>nm.length?'…':''):'')+'). Нажмите «Продолжить работу», чтобы вернуть их.</span></div><span class="upbtns"><button class="btn big" data-act="hdBack">Продолжить работу</button><button class="btn" data-act="hdAsk">Не нужно</button></span></div>';
}
function syApply(){
  var p=S.sy.plan;if(!p)return;
  var un=p.entries.filter(function(e){return e.state==='conflict'&&!S.sy.choose[e.kind+'|'+e.sid]&&syAdmin();}).length;
  if(un){flash('Выберите, что оставить, в каждом конфликте: осталось '+un);return;}
  if(S.sy.busy.apply)return;
  /* пока список был на экране, вы могли что-то поправить: состояния пересчитываем заново */
  var plan=syPlanPull(syCtx(),p.items),take=!syAdmin();
  /* общее, которое заменит ваши варианты, сначала сохраняется на устройстве; не записалось — ничего не меняется */
  var repl=plan.filter(function(e){return e.localId&&(e.state==='migrate'||(e.state==='conflict'&&syPick(e,S.sy.choose,take)==='remote'));});
  S.sy.busy.apply=true;
  syPreBackup(repl).then(function(ok){
    S.sy.busy.apply=false;
    if(!ok){syMsg('pull','err',S.sy.backupErr);flash('Не применено: копию ваших данных сохранить не удалось');scheduleRender();return;}
    var hd=syHoldCan()?syHoldMake(plan.filter(function(e){return e.state==='migrate';}),false):null;
    var res=syApplyPlan(syCtx(),plan,S.sy.choose,take);
    if(hd)syHoldAdd(hd);
        S.sy.cfg.rev=p.rev;S.sy.plan=null;syPersist();syChanged();
    var parts=[];
    if(res.added)parts.push('новых '+res.added);
    if(res.updated)parts.push('обновлено '+res.updated);
    if(res.removed)parts.push('удалено '+res.removed);
    var mg=res.merged+(S.sy.merged||0);S.sy.merged=0;
    if(mg)parts.push('синонимов дополнено у '+mg);
    if(res.kept)parts.push('оставлено ваше '+res.kept);
    syMsg('pull','ok','Применено: '+(parts.join(', ')||'ничего не менялось')+' · '+nowHm());
    if(S.active&&!S.recipes[S.active]){S.active=null;}
    layRefresh();
    renderAll();flash('Общая база получена');
  });
}

/* ---------- отправка своих правок ---------- */
function sySelKey(d){return d.kind+'|'+d.id;}
/* позиции, которые уже нашлись в общей базе по названию и ждут вашего решения в «Получить общее»: пока не решено, они не «новые» и не «изменённые» */
function syHeld(){
  var h=Object.create(null),p=S.sy.plan;
  if(p)p.entries.forEach(function(e){if(e.localId&&e.adopt&&e.state!=='same')h[e.kind+'|'+e.localId]=1;});
  return h;
}
function syDirtyUi(){var h=syHeld();return syDirty(syCtx()).filter(function(d){return!h[sySelKey(d)]&&!rvIsTmp(d.kind,d.id);});}
/* уже отправлено на проверку и с тех пор не менялось */
function syIsSent(d){
  var e;
  if(d.state==='deleted')return!!d.sent;
  e=(syMap(syCtx(),d.kind)||{})[d.id];
  return!!(e&&e.sent&&e.sent===syCur(syCtx(),d.kind,d.id).h);
}
function sySelected(){return syDirtyUi().filter(function(d){return!S.sy.unsel[sySelKey(d)]&&!syIsSent(d);});}
function syDirtyFor(kind,id){var k=kind+'|'+id,r=null;syDirtyUi().forEach(function(d){if(sySelKey(d)===k)r=d;});return r;}
/* вернуть общее вместо своих правок: позиция заменяется той, что сейчас в общей базе, и перестаёт считаться изменённой */
function syTakeKeys(sel){
  var ctx=syCtx(),m,out=[];
  sel.forEach(function(d){
    if(d.state!=='changed')return;
    var e=syMap(ctx,d.kind)[d.id],R=e&&e.sid?S.sy.pub[d.kind+'|'+e.sid]:null;
    if(R&&R.json)out.push({d:d,R:R});
  });
  return out;
}
function syTake(keys){
  var ctx=syCtx(),plan=[];
  syTakeKeys(syDirtyUi().filter(function(d){return keys.indexOf(sySelKey(d))>-1;})).forEach(function(x){
    var j=x.d.kind==='ing'?syIngClean(x.R.json):syRecClean(x.R.json);
    plan.push({kind:x.d.kind,sid:x.R.sid,name:x.R.name,rev:x.R.rev,json:j,h:syH(j),localId:x.d.id,adopt:false,state:'update'});
  });
  if(!plan.length){flash('Нечего возвращать');return;}
  var res=syApplyPlan(ctx,plan,{});
  syPersist();syChanged();
  if(S.active&&!S.recipes[S.active]){S.active=null;}
  syMsg('send','ok','Возвращено общее вместо ваших правок: '+res.updated+' · '+nowHm());
  renderAll();
}
function syAutoDeps(sel){
  var ctx=syCtx(),names={},m=syMap(ctx,'ing'),chosen={};
  sel.forEach(function(s){if(s.kind==='ing')chosen[s.id]=1;});
  function walk(r,seen){
    r.rows.forEach(function(x){
      if(x.pf&&S.recipes[x.pf]&&seen.indexOf(x.pf)<0){seen.push(x.pf);walk(S.recipes[x.pf],seen);}      /* сырьё полуфабрикатов тоже уйдёт вместе с картой */
      if(!x.ing||!S.ings[x.ing]||chosen[x.ing])return;
      var e=m[x.ing];
      if(!e||!e.rev)names[S.ings[x.ing].name]=1;
    });
  }
  sel.forEach(function(s){
    if(s.kind!=='rec'||s.state==='deleted'||!S.recipes[s.id])return;
    walk(S.recipes[s.id],[s.id]);
  });
  return Object.keys(names);
}
function syDepsText(sel){
  var deps=syAutoDeps(sel);
  return deps.length?'К отправке добавится новое сырьё для ТТК: '+deps.slice(0,6).join(', ')+(deps.length>6?'…':'')+' ('+deps.length+').':'';
}
function syRefreshSendUi(){
  var sel=sySelected(),a=$('#sy-send'),b=$('#sy-pub'),dp=$('#sy-deps'),off=!!S.sy.busy.send||!sel.length,dt=syDepsText(sel);
  if(a){a.textContent='Отправить на проверку: '+sel.length;a.disabled=off;}
  if(b){b.textContent='Опубликовать сразу: '+sel.length;b.disabled=off;}
  if(dp){dp.textContent=dt;dp.hidden=!dt;}
}
/* ----- отправка отдельной ТТК прямо с её карточки ----- */
function rjFor(id){
  var l=S.sy.inboxR,sid=((syMap(syCtx(),'rec')[id])||{}).sid,r=null;
  if(!l||!sid)return null;
  l.forEach(function(b){if(!r&&rvRecIn(b,sid))r=b;});
  return r;
}
/* k: new / changed — есть что отправлять; wait — уже на проверке; rework / rejected — решение технолога; same — совпадает с общей базой */
/* файл этой новой ТТК, который автор уже присылал в «На проверке» (возвращённый технологом или ещё ждущий) */
function syFileFor(r){
  var me=syNorm(S.sy.cfg.name),res=null,m,nm;
  if(syAdmin()||!(S.sy.files&&S.sy.files.files))return null;
  try{m=ttkModel(r);nm=safeName('ТТК №'+m.num+' '+m.dish)+'.docx';}catch(e){return null;}
  S.sy.files.files.forEach(function(x){if(!res&&x.kind==='pend'&&syNorm(x.by)===me&&(x.name===nm||frSameFile(x.name,nm)))res=x;});
  return res;
}
function syCardState(id){
  var r=S.recipes[id],ctx,e,cur,rj,base;
  if(!r||S.mode!=='local'||!syLinked()||!syCanSend()||rvIsTmp('rec',id))return null;
  if(syHeld()['rec|'+id])return null;
  ctx=syCtx();e=syMap(ctx,'rec')[id];cur=syCur(ctx,'rec',id);
  if(rwFor(id))return{k:'rework'};
  base=(!e||!e.rev)?'new':'changed';
  if(base==='new'&&!syAdmin()){rj=syFileFor(r);if(rj)return{k:rj.st==='rework'?'file':'filewait',f:rj};}
  if(e&&e.rev>0&&e.h===cur.h)return{k:'same'};
  if(e&&e.sent&&e.sent===cur.h)return{k:'wait'};
  rj=rjFor(id);
  if(rj&&!syAdmin())return{k:'rejected',base:base,b:rj};
  return{k:base};
}
function syStripHtml(r){
  var st=syCardState(S.active),admin=syAdmin(),dis=S.sy.busy.send?' disabled':'',btn;
  if(!st||st.k==='same'||st.k==='rework')return'';
  if(st.k==='wait')return'<section class="card sendstrip"><div class="ssl"><span class="tstat warn">На проверке</span><span>Отправлено технологу, ждёт решения. Если поправите карту, её можно будет отправить снова.</span></div></section>';
  if(st.k==='file'||st.k==='filewait')return'<section class="card sendstrip"><div class="ssl"><span class="tstat '+(st.k==='file'?'bad':'warn')+'">'+(st.k==='file'?'На доработке':'На проверке')+'</span><span class="grow">'
    +(st.k==='file'?'Технолог вернул файл'+(st.f.reply?': «'+esc(st.f.reply)+'»':'')+'. Исправьте карту и отправьте снова.':'Файл отправлен технологу, ждёт решения. Поправили карту — отправьте снова.')
    +'</span><button class="btn primary" data-act="syFSave"'+dis+'>'+(st.k==='file'?'Отправить на проверку':'Отправить снова')+'</button></div></section>';
  btn=admin?'<button class="btn primary" data-act="syCardPub"'+dis+'>Опубликовать для всех</button>':'<button class="btn primary" data-act="syCardSend"'+dis+'>'+(st.k==='rejected'?'Отправить снова':'Отправить на проверку')+'</button>';
  if(st.k==='rejected')return'<section class="card sendstrip"><div class="ssl"><span class="tstat bad">Отклонено</span><span class="grow">Технолог отклонил это предложение'+(st.b.reply?': «'+esc(st.b.reply)+'»':'')+'.</span>'
    +'<button class="btn mini" data-act="rwDrop" data-batch="'+esc(st.b.batch)+'">Понятно</button>'+btn+'</div></section>';
  return'<section class="card sendstrip"><div class="ssl"><span class="tstat '+(st.k==='new'?'ok':'warn')+'">'+(st.k==='new'?'Новая':'Изменена')+'</span><span class="grow">'
    +(admin?(syPubAutoOn()?'Опубликуется сама через минуту после последней правки.':'Этой ТТК ещё нет в общей базе у всех.'):(st.k==='new'?'Эта ТТК ещё не отправлена технологу.':'В ТТК есть правки, которых нет в общей базе.'))+'</span>'+btn+'</div>'+(admin?syPubOptHtml():'')+'</section>';
}
function syBotHtml(r){
  var st=syCardState(S.active),admin=syAdmin(),dis=S.sy.busy.send?' disabled':'',h;
  function hint(t){return'<p class="hint" style="margin:10px 0 0">'+t+'</p>';}
  if(!st)return'';
  if(st.k==='same')return hint('ТТК совпадает с общей базой: отправлять нечего.');
  if(st.k==='rework')return hint('Технолог вернул эту ТТК на доработку: исправьте её и отправьте кнопкой в жёлтой плашке вверху страницы.');
  if(st.k==='wait')return hint('Отправлено на проверку технологу. Поправите карту, и здесь снова появится кнопка «Отправить на проверку».');
  if(st.k==='file'||st.k==='filewait')return hint(st.k==='file'?'Технолог вернул файл этой ТТК на доработку. Исправьте карту и отправьте её снова.':'Файл этой ТТК уже ждёт технолога. Поправили карту — отправьте снова.')
    +'<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="syFSave"'+dis+'>'+(st.k==='file'?'Отправить на проверку':'Отправить снова')+'</button></div>';
  h='<label class="field" style="margin-top:12px"><span class="lbl">Что изменили (необязательно, увидит технолог)</span><input type="text" id="sy-cnote" data-act="syCNote" data-fk="sy:cnote" maxlength="300" autocomplete="off" value="'+esc(S.sy.cnote)+'"></label>'
    +'<div class="btns" style="margin-top:10px">'+(admin?'<button class="btn primary" data-act="syCardPub"'+dis+'>Опубликовать для всех</button>':'<button class="btn primary" data-act="syCardSend"'+dis+'>'+(st.k==='rejected'?'Отправить снова':'Отправить на проверку')+'</button>')+'</div>'+(admin?syPubOptHtml():'')+syMsgHtml('csend');
  return h;
}
var syBotAe=0;
function syStripUpdate(){
  var el=$('#syStrip'),bt=$('#syBot'),r=curRecipe(),h,st,sg,sg2,hb,ae=document.activeElement;
  if(S.tab!=='calc'||!r)return;
  if(el){h=syStripHtml(r);if(el._h!==h){el._h=h;el.innerHTML=h;}}
  if(bt&&!(ae&&bt.contains(ae))){st=syCardState(S.active);sg=(st?st.k:'')+'|'+(S.sy.busy.send?1:0)+'|'+(syDocsOn()?1:0)+(S.sy.cfg.pubAuto===true?1:0);if(bt._sg!==sg){bt._sg=sg;bt.innerHTML=syBotHtml(r);}}
  hb=$('#syHistBox');
  if(hb&&S.sy.histOpen&&!(ae&&hb.contains(ae))){sg2=(syDirtyFor('rec',S.active)?1:0)+'|'+(S.sy.busy.send?1:0);if(hb._sg!==sg2){syHistPaint();hb=$('#syHistBox');if(hb)hb._sg=sg2;}}   /* «Вернуть» прячется, пока в карте есть неопубликованные правки */
}
function syCardSend(direct){
  var d;
  if(!curRecipe()||!S.active)return;
  if(direct&&!syAdmin()){flash('Публиковать сразу может только технолог');return;}
  d=syDirtyFor('rec',S.active);
  if(!d){syMsg('csend','warn','Эта ТТК совпадает с общей базой: отправлять нечего.');flash('Эта ТТК совпадает с общей базой');syStripUpdate();return;}
  if(syIsSent(d)){flash('Эта ТТК уже отправлена и ждёт технолога');syStripUpdate();return;}
  sySend(!!direct,[d],'csend');
}
/* одна позиция из «Моих изменений» */
function syOne(key){
  var d=null;
  syDirtyUi().forEach(function(x){if(sySelKey(x)===key)d=x;});
  if(!d||syIsSent(d))return;
  sySend(syAdmin(),[d],'send');
}
function sySend(direct,only,mk,opt){
  mk=mk||'send';opt=opt||{};
  function sm(st,t){syMsg(mk,st,t);if((mk==='csend'||mk==='auto')&&(st==='err'||st==='warn'))flash(t);}
  if(S.sy.busy.send||!syLinked())return;
  if(!syCanSend()){flash('Это код шеф-повара: он только читает, отправлять правки нельзя');return;}
  if(direct&&!syAdmin()){flash('Публиковать сразу может только технолог');return;}
  var sel=only||sySelected();
  if(!sel.length){sm('warn','Ничего не выбрано.');return;}
  var b=syBatch(syCtx(),sel);syPersist();
  var skipDel=0;
  if(S.sy.info&&Number(S.sy.info.v)<11){      /* старый скрипт удалений не понимает: остальное отправляется, удаления ждут нового скрипта */
    var keepIt=b.items.filter(function(it){return!it.del;});
    skipDel=b.items.length-keepIt.length;b.items=keepIt;
    if(skipDel&&!keepIt.length){
      sm('err','Удаления в общую базу доходят только со скриптом версии 11: вставьте новый скрипт (вкладка «Личный кабинет» → «Настройка скрипта») и разверните новую версию.');scheduleRender();return;
    }
  }
  var items=b.items.map(function(it){return{kind:it.kind,sid:it.sid,name:it.name,baseRev:it.baseRev,json:it.json};});
  var big=items.filter(function(it){return JSON.stringify(it.json).length>40000;}).map(function(it){return it.name;});
  if(big.length){sm('err','Слишком большие для одной ячейки таблицы: '+big.slice(0,3).join(', ')+'. Сократите тексты в ТТК или снимите отметку.');scheduleRender();return;}
  var note=mk==='auto'?'автопубликация':String((mk==='csend'?S.sy.cnote:S.sy.note)||'').trim();
  syBusy('send',true);sm('busy',direct?(mk==='auto'?'Публикую автоматически…':'Публикую…'):'Отправляю на проверку…');scheduleRender();
  var chunks=[];
  if(direct){var CH=opt.chunk>0?opt.chunk:150;for(var i=0;i<items.length;i+=CH)chunks.push(items.slice(i,i+CH));}
  else{
    if(items.length>400){syBusy('send',false);sm('err','Слишком много позиций для одного предложения ('+items.length+'). Снимите часть галочек и отправьте по частям.');scheduleRender();return;}
    chunks.push(items);
  }
  var done=0,skipped=[],p=Promise.resolve();
  chunks.forEach(function(ch){p=p.then(function(){
    var x={items:ch,note:note};
    if(direct&&opt.guard)x.guard=1;      /* автопубликация: то, что успели изменить после вашего чтения, не перезаписывается */
    return syPost(direct?'publish':'propose',x).then(function(res){done+=ch.length;if(res&&res.skipped)skipped=skipped.concat(res.skipped);sm('busy',(direct?'Опубликовано ':'Отправлено ')+done+' из '+items.length+'…');});
  });});
  return p.then(function(){
    var skipKey={},recIds=[];
    skipped.forEach(function(x){skipKey[x.kind+'|'+x.sid]=1;});
    b.items.forEach(function(it){
      if(it.del){var dk=it.kind+'|'+it.sid;if(direct)delete S.sy.del[dk];else if(S.sy.del[dk])S.sy.del[dk].sent=1;return;}
      if(skipKey[it.kind+'|'+it.sid]){if(it.localId)S.sy.pubHold[it.kind+'|'+it.localId]=syH(it.json);return;}      /* конфликт: автопубликация эту версию больше не пробует */
      var e=syMap(syCtx(),it.kind)[it.localId];if(e)e.sent=syH(it.json);
      if(it.localId)delete S.sy.pt[it.kind+'|'+it.localId];
      if(direct&&it.kind==='rec'&&it.localId)recIds.push(it.localId);
    });
    if(direct&&syAdmin()&&syDocsOn()&&!opt.noDoc)syDocEnq(recIds);       /* файл .docx встаёт в очередь: не загрузился сейчас — загрузится при следующем открытии */
    syPersist();
    syBusy('send',false);if(mk==='csend')S.sy.cnote='';else if(mk!=='auto')S.sy.note='';
    var okN=items.length-skipped.length;
    if(mk==='csend'&&!skipped.length)flash(direct?'Опубликовано для всех':'Отправлено технологу на проверку');
    if(mk==='auto'&&okN)flash('Опубликовано автоматически: '+okN);
    sm(skipped.length?'warn':'ok',(direct?'Опубликовано: ':'Отправлено на проверку технологу: ')+okN+(b.auto.length?' (с новым сырьём для ТТК: '+b.auto.length+')':'')+(skipDel?'. Удаления ('+skipDel+') не отправлены: нужен скрипт версии 11 (вкладка «Личный кабинет» → «Настройка скрипта»)':'')
      +(skipped.length?'. Не опубликовано, в общей базе уже другая версия: '+skipped.slice(0,4).map(function(x){return'«'+x.name+'»';}).join(', ')+(skipped.length>4?'…':'')+'. Нажмите «Получить общее», сверьте версии и опубликуйте нужную вручную':'')+' · '+nowHm());
    scheduleRender();
    return syPull(true).then(function(){syStripUpdate();return opt.light?null:syRefresh(true);}).then(function(){return syDocFlush();});
  }).catch(function(e){
    syBusy('send',false);
    sm('err',(done?'Записано '+done+' из '+items.length+'. ':'')+syErrText(e));scheduleRender();syStripUpdate();
  });
}

/* ---------- публикация одной кнопкой: карта и файл .docx, автопубликация технолога, история версий карты ---------- */
var SY_PUB_V=23;
function syV23(){var v=S.sy.info&&Number(S.sy.info.v);return!!v&&v>=SY_PUB_V;}
function syDocsOn(){return S.sy.cfg.pubDocs!==false;}
function syPubAutoOn(){return syAdmin()&&syLinked()&&S.mode==='local'&&S.sy.cfg.pubAuto===true;}
function syPubWait(){return(window.KBZHU_PUB_WAIT>0)?window.KBZHU_PUB_WAIT:60000;}
function syPubOptHtml(){
  if(!syAdmin())return'';
  var old=!!S.sy.info&&!syV23();
  return'<div class="sypo"><label class="trem"><input type="checkbox" data-act="pubDocs"'+(syDocsOn()?' checked':'')+'>Вместе с картой класть файл .docx в «ТТК в облаке»</label>'
    +'<label class="trem"><input type="checkbox" data-act="pubAuto"'+(S.sy.cfg.pubAuto===true?' checked':'')+(old?' disabled':'')+'>Публиковать мои правки сразу, без кнопки'+(old?' (нужен скрипт версии '+SY_PUB_V+')':'')+'</label></div>';
}
function syDocQueue(){var q=S.sy.dq||{};return Object.keys(q).filter(function(id){return S.recipes[id];});}
function syPubBarHtml(){
  if(!syAdmin()||!syCanSend())return'';
  var q=syDocQueue(),old=!!S.sy.info&&!syV23();
  return'<div class="sypub" id="syPubBar">'+syPubOptHtml()
    +'<p class="hint" style="margin:6px 0 0">'+(S.sy.cfg.pubAuto===true?'Через минуту после последней правки карты и сырья уходят всем сами. ':'')+'Удаления сами не публикуются: их отправляете вы. Прежняя версия карты при каждой публикации сохраняется, вернуть её можно на карточке: «История версий карты».</p>'
    +(old?'<p class="hint cmsg warn">Автопубликации и истории версий нужен скрипт версии '+SY_PUB_V+': вставьте новый (Личный кабинет → Настройка скрипта) и разверните «Новая версия».</p>':'')
    +(q.length?'<p class="hint cmsg warn" id="syDocQ">Файлов .docx ждут загрузки в облако: '+q.length+'. <button class="btn mini" data-act="pubDocRetry"'+(syDocBusy?' disabled':'')+'>Загрузить сейчас</button></p>':'')
    +syMsgHtml('auto')+syMsgHtml('doc')+'</div>';
}

/* очередь файлов: после публикации карты её .docx кладётся в библиотеку; если не получилось (связь, закрыли страницу), он остаётся в очереди и догружается сам */
var syDocBusy=false,syDocAgain=false;
function syDocEnq(ids){
  ids.forEach(function(id){if(S.recipes[id]){var q=S.sy.dq[id]||{};q.n=0;q.err='';S.sy.dq[id]=q;}});
  syPersist();
}
function syDocFlush(manual){
  var ids,done=0,fail=[],arch=0;
  Object.keys(S.sy.dq||{}).forEach(function(id){if(!S.recipes[id])delete S.sy.dq[id];});
  if(manual)Object.keys(S.sy.dq).forEach(function(id){S.sy.dq[id].n=0;});
  ids=Object.keys(S.sy.dq||{}).filter(function(id){return(S.sy.dq[id].n||0)<3;});      /* три неудачи подряд — ждёт нажатия «Загрузить сейчас» */
  if(syDocBusy||S.sy.busy.fup){if(manual)syDocAgain=true;return Promise.resolve(null);}      /* нажали «Загрузить сейчас» во время загрузки: после неё запускается ещё раз */
  if(!ids.length||!syAdmin()||!syLinked()||S.mode!=='local')return Promise.resolve(null);
  syDocBusy=true;S.sy.busy.fup=true;
  function next(i){
    if(i>=ids.length)return Promise.resolve();
    var id=ids[i],r=S.recipes[id],q=S.sy.dq[id],job;
    if(!r||!q)return next(i+1);
    syMsg('doc','busy','Файлы в облако: '+(i+1)+' из '+ids.length+'…');
    try{job=syTtkJob(r);}catch(e){q.n=3;q.err='карта не собирается в документ';fail.push('«'+r.name+'»: '+q.err);syPersist();return next(i+1);}
    return syUploadBuf(job.name,job.buf,job.tg,job.rep).then(function(res){delete S.sy.dq[id];done++;arch+=(res&&res.archived)||0;},function(e){q.n=(q.n||0)+1;q.err=syErrText(e);fail.push('«'+r.name+'»: '+q.err);}).then(function(){syPersist();return next(i+1);});
  }
  return next(0).then(function(){
    syDocBusy=false;S.sy.busy.fup=false;
    syMsg('doc',fail.length?(done?'warn':'err'):'ok',(done?'Файлов .docx в облаке: '+done+(arch?' (прежних версий в «Архиве»: '+arch+')':'')+'. ':'')+(fail.length?'Не загрузились (останутся в очереди): '+fail.slice(0,3).join('; ')+(fail.length>3?'…':'')+'. ':'')+nowHm());
    if(fail.length&&done===0)flash('Файлы .docx не загрузились: они в очереди, повторить можно на вкладке «Личный кабинет»');
    return syUpDone().then(null,function(){}).then(function(){if(syDocAgain){syDocAgain=false;return syDocFlush(true);}});
  });
}

/* автопубликация: через минуту после последней правки то, что правили в этом сеансе, уходит в общую базу вместе с файлом; удаления не публикуются никогда */
var syPubT=null,syPubFirst=0,syPubRun=false;
function syPubKind(kind){return kind==='recipes'?'rec':(kind==='ingredients'?'ing':'');}
function syPubTouch(kind,id){
  var k=syPubKind(kind),now=Date.now();
  if(!k||!id||id==='sync'||!syPubAutoOn()||(S.sy.bulk&&S.sy.bulk.st==='apply'))return;
  S.sy.pt[k+'|'+id]=1;
  if(syPubT&&syPubFirst&&now-syPubFirst>300000)return;       // правят без остановки: публикация откладывается не дольше пяти минут
  if(!syPubT)syPubFirst=now;
  clearTimeout(syPubT);
  syPubT=setTimeout(function(){syPubT=null;syPubFirst=0;syPubAutoRun();},syPubWait());
}
/* карта готова к публикации: есть название и сырьё, нет строк с граммами без сырья */
function syRecReady(r){
  var good=0,bad=0,nm;
  if(!r)return false;
  nm=String(r.name||'').trim();
  if(!nm||nm==='Новое блюдо')return false;
  (r.rows||[]).forEach(function(x){
    if(x.skip&&!x.ing)return;
    if((x.ing&&S.ings[x.ing])||(x.pf&&S.recipes[x.pf])||x.pfs){good++;return;}
    if(Number(x.net)>0||Number(x.gross)>0)bad++;
  });
  return good>0&&!bad;
}
/* локальная база не должна выглядеть урезанной по сравнению с общей, иначе автопубликация не работает */
function syPubSane(){
  var n=0,have=Object.keys(S.recipes).length+Object.keys(S.sy.gone||{}).length;
  Object.keys(S.sy.pub||{}).forEach(function(k){if(k.indexOf('rec|')===0)n++;});
  return!(n>=10&&have<n*0.5);
}
function syPubCands(){
  var ctx=syCtx(),pt=S.sy.pt||{},hold=S.sy.pubHold||{},out=[],alive={};
  syDirtyUi().forEach(function(d){
    var k=sySelKey(d);
    if(d.state==='deleted')return;
    alive[k]=1;
    if(!pt[k]||syIsSent(d))return;
    if(hold[k]===syCur(ctx,d.kind,d.id).h)return;
    if(d.kind==='rec'&&!syRecReady(S.recipes[d.id]))return;
    out.push(d);
  });
  Object.keys(pt).forEach(function(k){if(!alive[k])delete pt[k];});      // уже совпало с общей базой или удалено
  return out;
}
function syPubAutoRun(){
  if(!syPubAutoOn())return Promise.resolve();
  if(S.sy.busy.send||S.sy.busy.pull||S.sy.busy.refresh||syPubRun||syDocBusy){clearTimeout(syPubT);syPubT=setTimeout(function(){syPubT=null;syPubAutoRun();},5000);return Promise.resolve();}
  if(!syV23()){syMsg('auto','warn','Автопубликации нужен скрипт версии '+SY_PUB_V+': вставьте новый и разверните «Новая версия».');return Promise.resolve();}
  if(!syPubSane()){syMsg('auto','warn','Автопубликация приостановлена: в вашей базе заметно меньше ТТК, чем в общей. Сначала нажмите «Получить общее».');return Promise.resolve();}
  var c=syPubCands();
  if(!c.length){syPersist();return Promise.resolve();}
  syPubRun=true;
  return Promise.resolve(sySend(true,c,'auto',{guard:true,light:true})).then(function(){syPubRun=false;},function(){syPubRun=false;});
}

/* ----- возврат версии: вместо позиции в общей базе встаёт прежняя, и у вас тоже ----- */
function syLocalIdOf(kind,sid){
  var m=syMap(syCtx(),kind),src=kind==='ing'?S.ings:S.recipes,id='';
  Object.keys(m).forEach(function(k){if(m[k].sid===sid&&src[k])id=k;});
  return id;
}
function syForceTake(kind,sid){
  var id=syLocalIdOf(kind,sid),R=S.sy.pub[kind+'|'+sid],j;
  if(!id||!R||!R.json||R.json._del)return false;
  j=kind==='ing'?syIngClean(R.json):syRecClean(R.json);
  syApplyPlan(syCtx(),[{kind:kind,sid:sid,name:R.name,rev:R.rev,json:j,h:syH(j),localId:id,adopt:false,state:'update'}],{});
  syPersist();syChanged();
  return true;
}
function syHistHtml(){
  var id=S.active,e,H=S.sy.hist,h,dirty;
  if(!syAdmin()||!id||!S.recipes[id]||!syV23())return'';
  e=syMap(syCtx(),'rec')[id];
  if(!e||!e.sid||!(e.rev>0))return'';
  h='<details class="pgroup" id="syHistBox"'+(S.sy.histOpen?' open':'')+'><summary>История версий карты</summary>';
  if(S.sy.histOpen){
    if(!H||H.sid!==e.sid){
      h+='<p class="hint">Загружаю…</p>';
      if(!(H&&H.loading))setTimeout(function(){syHistLoad(false);},0);
    }else if(H.loading)h+='<p class="hint">Загружаю…</p>';
    else if(H.err)h+='<p class="hint cmsg err">'+esc(H.err)+'</p>';
    else if(!H.items.length)h+='<p class="hint">У этой карты в общей базе пока нет сохранённых версий.</p>';
    else{
      dirty=!!syDirtyFor('rec',id);
      h+='<p class="hint" style="margin-top:0">Каждая публикация сохраняет прежнюю версию. «Вернуть» ставит выбранную версию у всех и у вас; нынешняя остаётся в этом списке.'+(dirty?' В карте есть неопубликованные правки: сначала опубликуйте их, тогда можно возвращать версию.':'')+'</p><div class="sylist">';
      H.items.forEach(function(x,i){
        var can=i>0&&H.items[i-1].hasPrev&&!dirty&&!S.sy.busy.send;
        h+='<div class="syrow"><div class="syn"><b>'+(i===0?'Сейчас в общей базе':esc(syWhen(x.at)))+'</b> <span class="sysub">'+(i===0?esc(syWhen(x.at))+' · ':'')+esc(x.by)+' · '+esc(x.action)+' · версия '+x.rev+(x.note?' · '+esc(x.note):'')+'</span></div>'
          +'<div class="syst">'+(i===0?'<span class="tstat ok">Текущая</span>':(can?'<button class="btn mini" data-act="pubHistRestore" data-i="'+i+'">Вернуть эту версию</button>':''))+'</div></div>';
      });
      h+='</div>';
    }
  }
  return h+syMsgHtml('hist')+'</details>';
}
function syHistPaint(){
  var el=$('#syHistBox'),t,n;
  if(!el)return;
  t=document.createElement('div');t.innerHTML=syHistHtml();n=t.firstChild;
  if(n)el.replaceWith(n);
}
function syHistLoad(force){
  var id=S.active,e=id&&syMap(syCtx(),'rec')[id],H=S.sy.hist;
  if(!e||!e.sid||!syAdmin()||!syV23()||(H&&H.loading))return Promise.resolve();
  if(!force&&H&&H.sid===e.sid&&H.at&&Date.now()-H.at<20000)return Promise.resolve();
  S.sy.hist={sid:e.sid,loading:true,items:[],err:'',at:0};
  syHistPaint();
  return syGet({a:'hist',kind:'rec',sid:e.sid}).then(function(d){
    S.sy.hist={sid:e.sid,loading:false,items:d.items||[],err:'',at:Date.now()};
  },function(er){
    S.sy.hist={sid:e.sid,loading:false,items:[],err:syErrText(er),at:Date.now()};
  }).then(syHistPaint);
}
function syHistRestore(i){
  var H=S.sy.hist,id=S.active,x,nw;
  if(!H||!syAdmin()||S.sy.busy.send)return;
  x=H.items[i];nw=H.items[i-1];
  if(!x||!nw||!nw.hasPrev)return;
  if(syDirtyFor('rec',id)){syMsg('hist','warn','В карте есть неопубликованные правки: сначала опубликуйте их.');return;}
  syBusy('send',true);syMsg('hist','busy','Возвращаю версию от '+syWhen(x.at)+'…');
  syPost('revert',{rev:nw.rev},S.sy.cfg.code).then(function(){return syPull(true);}).then(function(){
    syForceTake('rec',H.sid);
    S.sy.pubHold={};
    syBusy('send',false);
    flash('Версия карты возвращена');
    S.sy.hist=null;
    return syHistLoad(true);
  }).then(function(){
    syMsg('hist','ok','Возвращена версия от '+syWhen(x.at)+' · '+nowHm());
    renderAll();
  }).catch(function(e){syBusy('send',false);syMsg('hist','err',syErrText(e));scheduleRender();});
}

/* ---------- проверка технолога, журнал ---------- */
function syRefresh(force){
  if(!syLinked()||S.sy.busy.refresh)return Promise.resolve();
  if(!force&&Date.now()-S.sy.seen<15000)return Promise.resolve();
  S.sy.seen=Date.now();syBusy('refresh',true);
  syFilesLoad(true);
  var tasks=[
    syGet({a:'ping'}).then(function(i){S.sy.info=i;}),
    syGet({a:'pending'}).then(function(d){S.sy.pend=d.batches;S.sy.rework=d.rework||[];}),
    syInbox(true),
    syGet({a:'log',n:120}).then(function(d){S.sy.log=d.items;}),
    /* полный список общей базы нужен, чтобы показать, что именно изменено (сравнение с опубликованным) */
    syGet({a:'pull',since:0}).then(function(d){d.items.forEach(function(it){if(it.json&&it.json._del)delete S.sy.pub[it.kind+'|'+it.sid];else S.sy.pub[it.kind+'|'+it.sid]=it;});}),
    /* файлы цен: у прежней версии скрипта такого действия нет, это не ошибка обновления */
    syGet({a:'prices'}).then(function(d){S.sy.pf.list=d.regions;},function(){S.sy.pf.list=S.sy.pf.list||[];}),
    pgLoad(),      /* страница по ссылке: загружена ли, когда */
    syLayLoad(),   /* общие папки меню (скрипт версии 10) */
    syPhSync(),    /* общая история цен (скрипт версии 16) */
    drLoad(true),  /* точки и юридические лица (версия 26) */
    revLoad(false)  /* список ревизий */
  ];
  return Promise.all(tasks).then(function(){syBusy('refresh',false);layApply();scheduleRender();if(syAdmin()){pfSchedule(2500);syDocFlush();}},function(e){
    syBusy('refresh',false);syMsg('refresh','err',syErrText(e));scheduleRender();
  });
}
function syReview(op,batch,extra){
  if(S.sy.busy.review||!syAdmin())return;
  if(op==='rework'&&String((extra&&extra.note)||'').trim().length<3){syMsg('review','err','Напишите комментарий: что нужно исправить. Без него отправить на доработку нельзя.');scheduleRender();return;}
  var jobs=[];
  if(op==='approve'){try{jobs=rvFileJobs(rvBatchById(batch),null);}catch(e1){jobs=[];}}
  syBusy('review',true);syMsg('review','busy',op==='approve'?'Принимаю…':(op==='rework'?'Возвращаю на доработку…':'Отклоняю…'));scheduleRender();
  syPost(op,Object.assign({batch:batch},extra||{}),S.sy.cfg.code).then(function(){
    syBusy('review',false);syMsg('review','ok',(op==='approve'?'Принято и опубликовано':(op==='rework'?'Возвращено автору на доработку':'Отклонено'))+' · '+nowHm());
    return syPull(true).then(function(){return syRefresh(true);}).then(function(){return rvFilesPut(jobs);}).then(function(){scheduleRender();});
  }).catch(function(e){syBusy('review',false);syMsg('review','err',syErrText(e));scheduleRender();});
}
function syRevert(rev){
  if(S.sy.busy.review||!syAdmin())return;
  /* возвращаете удалённое: оно снова должно приходить и к вам */
  var li=(S.sy.log||[]).filter(function(x){return x.rev===rev;})[0],lid=(li&&li.sid)?syLocalIdOf(li.kind,li.sid):'';
  if(lid&&syDirtyFor(li.kind,lid)){syMsg('review','warn','У этой позиции есть ваши неопубликованные правки: опубликуйте их или верните общее, иначе они затрут возврат.');scheduleRender();return;}
  if(li&&li.sid&&S.sy.gone[li.kind+'|'+li.sid]){delete S.sy.gone[li.kind+'|'+li.sid];syPersist();}
  syBusy('review',true);syMsg('review','busy','Возвращаю прежнее значение…');scheduleRender();
  syPost('revert',{rev:rev},S.sy.cfg.code).then(function(){
    syBusy('review',false);syMsg('review','ok','Прежнее значение возвращено · '+nowHm());
    return syPull(true).then(function(){if(li&&li.sid){S.sy.pubHold={};syForceTake(li.kind,li.sid);}return syRefresh(true);});
  }).catch(function(e){syBusy('review',false);syMsg('review','err',syErrText(e));scheduleRender();});
}
function syAutoPull(){
  if(S.mode!=='local'||!syLinked())return Promise.resolve();
  return syFreshAddr(false).then(function(){return syPull(true);});
}
function syOnOpen(){if(syLinked())syFreshAddr(false).then(function(){return syRefresh(false);}).then(aiLoad);}


