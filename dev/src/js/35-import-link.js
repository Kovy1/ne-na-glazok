/* ---------- загрузка по ссылке (таблица Google, CSV) ---------- */
var CLOUD_KINDS={
  base:{title:'База сырья с ценами',ph:'https://docs.google.com/spreadsheets/d/…/edit#gid=0',
    hint:'Колонки как в выгрузке «Скачать CSV»: название, белки, жиры, углеводы, источник, а дальше по желанию тип данных, потери, синонимы, цена, единица цены, масса упаковки. Цены запишутся в выбранный регион. Сырьё с тем же названием обновится, новое добавится, остальное не удаляется.'},
  price:{title:'Прайс',ph:'https://docs.google.com/spreadsheets/d/…/edit#gid=0',
    hint:'Две колонки: название и цена за килограмм. Перед записью покажу, какое сырьё из базы подходит к каждой строке.'},
  sales:{title:'Продажи за период',ph:'https://docs.google.com/spreadsheets/d/…/edit#gid=0',
    hint:'Название блюда и количество проданных порций. Перед записью покажу сопоставление с ТТК.'},
  recipes:{title:'ТТК и цены продажи',ph:'https://docs.google.com/spreadsheets/d/…/edit#gid=0',
    hint:'Одна строка таблицы — одна строка рецептуры: блюдо, ТТК №, выход порции, цена продажи, сырьё, нетто, брутто, доля. Реквизиты блюда достаточно указать в первой строке. Образец даёт кнопка «Скачать ТТК для таблицы». Блюда с тем же названием обновятся, новые добавятся, остальные не удаляются. Сырьё сопоставляется с базой по названию.'}
};
var CLOUD_HOW='В Google Таблице нажмите «Настройки доступа», выберите «Все, у кого есть ссылка» и роль «Читатель». Откройте нужный лист и скопируйте ссылку из адресной строки браузера (…/d/…/edit#gid=…). Данные берутся по ней при каждой загрузке. Ссылку на опубликованный CSV (Файл → Поделиться → Опубликовать в интернете) тоже можно вставить, но Google не всегда отдаёт её браузеру. Числа записывайте без текста, кроме знака ₽ или %. Ссылка запоминается в этом браузере отдельно для каждого региона.';
var CLOUD_ERR={
  empty:'Вставьте ссылку.',
  rtable:'В таблице не нашёл колонки «Блюдо», «Сырьё» и «Нетто, г». Кнопка «Скачать ТТК для таблицы» даёт образец.',
  bad:'Это не похоже на ссылку: она должна начинаться с https://',
  drivefile:'Ссылку на файл или папку Google Диска браузер прочитать не может. Загрузите данные в Google Таблицу (Файл → Импорт), опубликуйте её как CSV и вставьте ссылку на публикацию.',
  timeout:'Ссылка не ответила за 20 секунд.',
  html:'По ссылке открывается веб-страница, а не CSV. Для таблицы Google выберите «Файл» → «Поделиться» → «Опубликовать в интернете», формат CSV, и вставьте полученную ссылку.',
  big:'Файл больше 5 МБ.',
  enc:'Не удалось определить кодировку файла.',
  cors:'Сервер ответил, но браузер не отдал содержимое. Чаще всего таблица не открыта для всех: откройте эту же ссылку в окне инкогнито, там должны быть данные, а не вход. Обычные ссылки на файлы Диска браузер не читает.',
  corsPub:'Google ответил, но не разрешил браузеру прочитать опубликованный CSV. Вставьте вместо неё обычную ссылку на таблицу из адресной строки (…/d/…/edit#gid=…) и откройте доступ: «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель».',
  gv:'Таблица не отдала данные. Откройте доступ: «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель», и вставьте ссылку из адресной строки таблицы (…/d/…/edit#gid=…).',
  blocked:'Страница не смогла обратиться по ссылке: нет интернета или запрос закрыт (блокировщик рекламы, режим экономии трафика, сеть оператора). Попробуйте другую сеть или Wi-Fi.',
  net:'Не удалось получить файл по ссылке. Проверьте ссылку и интернет.'
};
S.cloud={};S.cloudBusy={};
function cloudLinks(){var d=null;try{d=JSON.parse(lsGet('kbzhu:links')||'null');}catch(e){d=null;}return(d&&typeof d==='object')?d:{};}
function cloudGet(kind){var l=cloudLinks()[curRegion()];return(l&&l[kind])||'';}
function cloudSet(kind,val){
  var all=cloudLinks(),g=curRegion();
  if(!all[g]||typeof all[g]!=='object')all[g]={};
  if(!val)delete all[g][kind];else all[g][kind]=(val===true)?true:String(val).slice(0,1000);
  if(!Object.keys(all[g]).length)delete all[g];
  lsSet('kbzhu:links',JSON.stringify(all));
}
function cloudErrText(e){
  if(e&&e.code==='http'){
    if(e.status===404||e.status===400)return'Таблица не найдена ('+e.status+'). Проверьте ссылку.';
    if(e.status===401||e.status===403)return'Нет доступа ('+e.status+'). Опубликуйте таблицу в интернете или откройте доступ «Все, у кого есть ссылка».';
    return'Сервер ответил ошибкой '+e.status+'.';
  }
  if(e&&e.code==='cors'&&e.via==='gpub')return CLOUD_ERR.corsPub;
  if(e&&e.code==='blocked'&&typeof location!=='undefined'&&/claude/i.test(location.hostname))return CLOUD_ERR.blocked+' Внутри claude.ai внешние запросы закрыты: откройте скачанный автономный файл.';
  return CLOUD_ERR[e&&e.code]||CLOUD_ERR.net;
}
function reach(url){
  if(typeof fetch!=='function')return Promise.resolve(false);
  return fetch(url,{mode:'no-cors',credentials:'omit',cache:'no-store'}).then(function(){return true;},function(){return false;});
}
/* Скрипт с адреса Google: ответ приходит вызовом функции. Если скрипт загрузился, а функция не вызвана, таблица недоступна без входа */
function jsonpGet(url,ms){
  if(testProd(url))return Promise.reject({code:'testprod'});
  return new Promise(function(resolve,reject){
    var name='__kbzhuGv'+Math.random().toString(36).slice(2,9),sc=document.createElement('script'),done=false,tm;
    function end(){done=true;clearTimeout(tm);try{delete window[name];}catch(e){window[name]=undefined;}if(sc.parentNode)sc.parentNode.removeChild(sc);}
    window[name]=function(d){if(done)return;end();resolve(d);};
    sc.onerror=function(){if(done)return;end();reject({code:'blocked'});};
    sc.onload=function(){setTimeout(function(){if(!done){end();reject({code:'gv'});}},0);};
    tm=setTimeout(function(){if(done)return;end();reject({code:'gv'});},ms||15000);
    sc.async=true;sc.src=url.replace('__CB__',name);
    document.head.appendChild(sc);
  });
}
function cloudFetch(link){
  var u=cloudUrl(link);
  if(u.err)return Promise.reject({code:u.err});
  if(u.via==='gsheet'){
    return jsonpGet(u.url).then(function(d){
      var rows=gvizRows(d);
      if(!rows)throw{code:'gv'};
      return{rows:rows,via:u.via};
    });
  }
  function get(url){
    var ctl=typeof AbortController!=='undefined'?new AbortController():null,tm=ctl?setTimeout(function(){ctl.abort();},20000):null;
    return fetch(url,{credentials:'omit',cache:'no-store',signal:ctl?ctl.signal:undefined}).then(function(res){
      clearTimeout(tm);
      if(!res.ok)throw{code:'http',status:res.status};
      return res;
    },function(e){
      clearTimeout(tm);
      if(e&&e.name==='AbortError')throw{code:'timeout'};
      /* сеть не дала прочитать ответ: выясняем, дошёл ли запрос (тогда виноваты права доступа или CORS) или страница вообще не может обратиться по ссылке */
      return reach(url).then(function(ok){throw{code:ok?'cors':'blocked',via:u.via};});
    });
  }
  var step=u.via==='yandex'
    ?get('https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key='+encodeURIComponent(u.url)).then(function(r){return r.json();}).then(function(j){if(!j||!j.href)throw{code:'net'};return get(j.href);})
    :get(u.url);
  return step.then(function(res){return res.arrayBuffer();}).then(function(buf){
    if(buf.byteLength>5*1024*1024)throw{code:'big'};
    var text;
    try{text=new TextDecoder('utf-8',{fatal:true}).decode(buf);}
    catch(e){try{text=new TextDecoder('windows-1251').decode(buf);}catch(e2){throw{code:'enc'};}}
    if(looksHtml(text))throw{code:'html'};
    return{rows:parseRecords(text,true),via:u.via};
  });
}
function rowsToCsvText(rows){return rows.map(function(r){return r.map(function(v){return csvCell(String(v==null?'':v).replace(/[\t\r\n]+/g,' '));}).join(';');}).join('\r\n');}
function cloudStatus(kind,state,msg){
  S.cloud[kind]={state:state,msg:msg};
  var el=$('#cm-'+kind);
  if(el){el.textContent=msg;el.className='hint cmsg '+state;el.hidden=!msg;}
  var b=$('[data-act="cLoad"][data-k="'+kind+'"]');if(b)b.disabled=(state==='busy')||uiRO();
}
function nowHm(){var d=new Date();function z(n){return(n<10?'0':'')+n;}return z(d.getHours())+':'+z(d.getMinutes());}
function doCloudLoad(kind){
  if(S.cloudBusy[kind])return;
  if(NOPRICE&&(kind==='price'||kind==='sales')){cloudStatus(kind,'err','Нет доступа к ценам: загрузка закрыта.');return;}
  var inp=$('#cu-'+kind),link=(inp?inp.value:cloudGet(kind)).trim();
  if(inp)cloudSet(kind,link);
  var g=curRegion();
  S.cloudBusy[kind]=true;cloudStatus(kind,'busy','Загружаю…');
  cloudFetch(link).then(function(r){
    S.cloudBusy[kind]=false;
    if(curRegion()!==g){cloudStatus(kind,'err','Регион сменился во время загрузки. Загрузите ещё раз.');return;}
    var rows=r.rows;
    if(!rows.length){cloudStatus(kind,'err','В таблице по ссылке нет строк.');return;}
    cloudStatus(kind,'ok','Получено строк: '+rows.length+' · '+nowHm());
    if(kind==='base'){
      S.importOpen=true;S.cloudText=rowsToCsvText(rows);
      S.importMsg='Из ссылки получено строк: '+rows.length+'. Проверьте текст ниже и нажмите «Добавить в базу».';
      S.tab='base';renderAll();
      var ta=$('#impText');if(ta){ta.value=S.cloudText;}
      S.cloudText=null;
      var ic=$('.import');if(ic&&ic.scrollIntoView)ic.scrollIntoView({block:'nearest'});
    }else if(kind==='price'){startPrice(rows,'таблица по ссылке');}
    else if(kind==='recipes'){var er=startRecs(rows,'таблица по ссылке');if(er)cloudStatus(kind,'err',er);}
    else{startSales(rows,'таблица по ссылке');}
  },function(e){
    S.cloudBusy[kind]=false;
    cloudStatus(kind,'err',cloudErrText(e));
  });
}
/* ссылки можно передать в адресе страницы: …/файл.html#base=https%3A%2F%2F… Они только подставляются в поля, загрузка идёт по кнопке */
function cloudFromUrl(){
  var q=String(location.hash||'').replace(/^#/,'')+'&'+String(location.search||'').replace(/^\?/,''),got=[];
  ['base','price','sales'].forEach(function(k){
    var m=new RegExp('(?:^|&)'+k+'=([^&]*)').exec(q),v='';
    if(!m)return;
    try{v=decodeURIComponent(m[1].replace(/\+/g,' '));}catch(e){v='';}
    if(/^https?:\/\//i.test(v)&&v.length<=1000){cloudSet(k,v);got.push(k);}
  });
  if(got.length){
    S.cloudOpen=true;S.cloudOpenS=true;S.cloudUrlNote=true;
    S.tab=(got.indexOf('base')>-1||got.indexOf('price')>-1)?'base':'abc';
  }
}
function autoBase(link,g){
  cloudStatus('base','busy','Обновляю базу по ссылке…');
  return cloudFetch(link).then(function(r){
    var rows=r.rows;
    if(!rows.length)throw{code:'none'};
    if(curRegion()!==g)return;
    var res=importRows(rowsToCsvText(rows),'table');
    cloudStatus('base','ok','Обновлено при открытии: добавлено '+res.add+', обновлено '+res.upd+(res.skip.length?', пропущено строк: '+res.skip.length:'')+(res.partial.length?', БЖУ заполнено не полностью (не загружено): '+res.partial.length:'')+(res.unk?', без КБЖУ: '+res.unk:'')+(res.foreign&&res.priceSkipped?', цены не записаны: таблица выгружена из региона «'+res.foreign+'»':'')+' · '+nowHm());
    scheduleRender();
    flash('База обновлена по ссылке: добавлено '+res.add+', обновлено '+res.upd);
  }).catch(function(e){
    cloudStatus('base','err',(e&&e.code==='none')?'В таблице по ссылке нет строк.':cloudErrText(e));
    flash('Не удалось обновить базу по ссылке');
  });
}
/* при открытии страницы: сначала база (чтобы сырьё для ТТК уже было), затем ТТК */
function cloudAutoLoad(){
  var l=cloudLinks()[curRegion()],g=curRegion(),p=Promise.resolve();
  if(l&&!uiRO()&&S.mode==='local'){
    if(l.auto===true&&l.base)p=p.then(function(){return autoBase(l.base,g);});
  }
  /* затем общая база (если подключена и включено получение при открытии) */
  p.then(syAutoPull);
}
function cloudRowHtml(kind){
  var k=CLOUD_KINDS[kind],st=S.cloud[kind];
  return'<div class="cloudrow"><label class="field"><span class="lbl">'+k.title+'</span><input id="cu-'+kind+'" type="text" inputmode="url" spellcheck="false" autocomplete="off" data-act="cUrl" data-k="'+kind+'" data-fk="cu:'+kind+'" value="'+esc(cloudGet(kind))+'" placeholder="'+esc(k.ph)+'"></label>'
    +'<button class="btn primary" data-act="cLoad" data-k="'+kind+'" data-edit'+((st&&st.state==='busy')?' disabled':'')+'>Загрузить</button></div>'
    +'<p class="hint cmsg'+(st?' '+st.state:'')+'" id="cm-'+kind+'" role="status" aria-live="polite"'+((st&&st.msg)?'':' hidden')+'>'+(st?esc(st.msg):'')+'</p>'
    +'<p class="hint cdesc">'+esc(k.hint)+'</p>';
}
function cloudNoteHtml(){
  return S.cloudUrlNote?'<p class="hint cmsg warn">Ссылки подставлены из адреса страницы. Убедитесь, что вы им доверяете, и нажмите «Загрузить».</p>':'';
}
function cloudBaseHtml(){
  var auto=cloudLinks()[curRegion()];auto=!!(auto&&auto.auto===true);
  return'<details class="pgroup cloud" id="cloudCard"'+(S.cloudOpen?' open':'')+'><summary>Загрузка по ссылке (Google Таблица, CSV)</summary>'
    +'<p class="rgtag" style="margin-top:10px">Регион «'+esc(regionName(curRegion()))+'»</p>'
    +'<p class="hint" style="margin-top:0">'+esc(CLOUD_HOW)+'</p>'+cloudNoteHtml()
    +cloudRowHtml('base')
    +(S.mode==='local'?'<label class="trem" style="margin-top:8px"><input type="checkbox" data-act="cAuto" data-fk="cu:auto"'+(auto?' checked':'')+'>Обновлять базу при открытии страницы: значения из таблицы заменят правки тех же позиций</label>':'')
    +cloudRowHtml('price')
    +'</details>';
}
function cloudSalesHtml(){
  return'<details class="pgroup cloud" id="cloudSales"'+(S.cloudOpenS?' open':'')+'><summary>Загрузить по ссылке (Google Таблица, CSV)</summary>'
    +'<p class="hint" style="margin-top:8px">'+esc(CLOUD_HOW)+'</p>'+cloudNoteHtml()+cloudRowHtml('sales')+'</details>';
}

/* ---------- ТТК и цены продажи из таблицы ---------- */
/* какое из имеющихся блюд обновит строка таблицы: то же название (или синоним), иначе тот же номер ТТК; пусто — создастся новое */
function recipeTarget(d){
  var mt=matchRecipe(d.name,visMap());
  if(mt.id&&(mt.how==='exact'||mt.how==='alias')&&!mt.multi)return mt.id;
  if(d.num&&d.num!=='__'){
    var found='';
    visIds().forEach(function(id){if(!found&&String(ttkVal(S.recipes[id],'num')||'').trim()===d.num)found=id;});
    if(found)return found;
  }
  return'';
}
function recsMatch(dishes){
  var seen={},items=[];
  dishes.forEach(function(d){d.lines.forEach(function(l){
    var k=normKey(l.name);l.key=k;if(!k)return;
    var it=seen[k];
    if(!it){
      var mt=matchIng(l.name,S.ings),pick=mt.id;
      if(mt.how==='fuzzy'&&mt.score<0.6)pick='';
      it=seen[k]={name:l.name,key:k,count:0,ing:pick,how:pick?mt.how:'none',score:mt.score,guess:mt.id,remember:mt.how==='fuzzy'&&!!pick};
      items.push(it);
    }
    it.count++;
  });});
  return items;
}
/* возвращает текст ошибки или пустую строку; при успехе открывает вкладку «Меню и финансы» с карточкой проверки */
function startRecs(rows,fileName){
  var p=parseRecipeTable(rows);
  if(p.err)return CLOUD_ERR.rtable;
  var dishes=p.dishes.filter(function(d){return d.lines.length;});
  if(!dishes.length)return'В таблице нет строк рецептуры.';
  dishes.forEach(function(d){d.target=recipeTarget(d);});
  S.recs={file:fileName,dishes:dishes,items:recsMatch(dishes),skipped:p.skipped,empty:p.dishes.length-dishes.length};
  S.tab='menu';renderAll();
  var c=$('#recsCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
  return'';
}
function recsStatus(x){
  if(x.ing==='__new__')return['warn','Новое сырьё'];
  if(!x.ing)return['bad','Не выбрано'];
  if(x.how==='alias')return['ok','Запомнено'];
  if(x.how==='exact')return['ok','Совпало'];
  if(x.how==='fuzzy')return['warn','Проверьте'];
  return['neutral','Выбрано вами'];
}
function recsCardHtml(){
  var t=S.recs;if(!t)return'';
  var g=curRegion(),ids=Object.keys(S.ings).sort(byName(S.ings));
  var base=ids.map(function(id){return'<option value="'+esc(id)+'">'+esc(S.ings[id].name||'Без названия')+'</option>';}).join('');
  var need=[],check=[],ok=[];
  t.items.forEach(function(x,i){
    if(!x.ing)need.push(i);
    else if(x.ing==='__new__'||x.how==='fuzzy'||x.how==='manual')check.push(i);
    else ok.push(i);
  });
  function row(i){
    var x=t.items[i],st=recsStatus(x);
    var opts='<option value="">— оставить без сырья —</option><option value="__new__"'+(x.ing==='__new__'?' selected':'')+'>＋ Добавить как новое сырьё</option>'+base.replace('value="'+esc(x.ing)+'"','value="'+esc(x.ing)+'" selected');
    return'<div class="trow" data-i="'+i+'"><span class="tn">'+esc(x.name)+((!x.ing&&x.guess&&S.ings[x.guess])?'<span class="tsub">Похоже: '+esc(S.ings[x.guess].name)+'</span>':'')+'</span>'
      +'<span class="tnet">'+x.count+'</span>'
      +'<span class="tsel"><select data-act="recsIng" data-edit data-fk="rs:'+i+'" aria-label="Сырьё из базы для «'+esc(x.name)+'»">'+opts+'</select></span>'
      +'<span class="tst"><span class="tstat '+st[0]+'">'+st[1]+'</span>'
      +((x.ing&&x.ing!=='__new__'&&x.how!=='alias'&&x.how!=='exact')?'<label class="trem"><input type="checkbox" data-act="recsRem" data-edit'+(x.remember?' checked':'')+'>запомнить название</label>':'')
      +'</span></div>';
  }
  function block(list,title,open){
    if(!list.length)return'';
    return'<details class="pgroup"'+(open?' open':'')+'><summary>'+title+' · '+list.length+'</summary><div class="trows"><div class="trow thead"><span>В таблице</span><span class="r">Строк</span><span>Сырьё в базе</span><span>Статус</span></div>'+list.map(row).join('')+'</div></details>';
  }
  var nNew=0,nUpd=0,nSell=0,guess=[];
  t.dishes.forEach(function(d){
    if(d.target)nUpd++;else nNew++;
    if(d.sell>0)nSell++;
    if(!d.outputGiven)guess.push(d.name);
  });
  var dl='<details class="pgroup"><summary>Блюда · '+t.dishes.length+'</summary><div class="trows"><div class="trow thead"><span>Блюдо</span><span class="r">Строк</span><span>'+(NOPRICE?'':'Цена продажи, ₽')+'</span><span>Что будет</span></div>'
    +t.dishes.map(function(d){
      var old=d.target&&S.recipes[d.target];
      return'<div class="trow"><span class="tn">'+esc(d.name)+((old&&normKey(old.name)!==normKey(d.name))?'<span class="tsub">Обновит «'+esc(old.name)+'»</span>':'')+'</span><span class="tnet">'+d.lines.length+'</span>'
        +'<span class="tsel">'+(NOPRICE?'':(d.sell>0?money(d.sell):'—'))+'</span><span class="tst"><span class="tstat '+(old?'warn':'ok')+'">'+(old?'Обновится':'Новое')+'</span></span></div>';
    }).join('')+'</div></details>';
  var h='<section class="card ttk" id="recsCard"><h2>Загружены ТТК из таблицы</h2>'
    +(NOPRICE?'':'<p class="rgtag">Цены продажи запишутся в регион «'+esc(regionName(g))+'»</p>')
    +'<p class="hint" style="margin-top:2px">Источник: '+esc(t.file)+'. Блюд: '+t.dishes.length+', строк рецептуры: '+t.dishes.reduce(function(a,d){return a+d.lines.length;},0)+'. Проверьте, какое сырьё из базы подставлено к названиям из таблицы.</p>'
    +block(need,'Нужно выбрать сырьё',true)+block(check,'Проверьте соответствие',true)+block(ok,'Совпали по названию',false)+dl;
  var notes=[];
  var nNeedLines=need.reduce(function(a,i){return a+t.items[i].count;},0);
  if(need.length)notes.push(['bad','Сырьё не выбрано у названий: '+need.length+' (строк: '+nNeedLines+'). Эти строки войдут без сырья, и расчёт покажет ошибку. Выберите сырьё из базы или добавьте как новое.']);
  var nNewIng=t.items.filter(function(x){return x.ing==='__new__';}).length;
  if(nNewIng)notes.push(['warn','Новое сырьё ('+nNewIng+') добавится в базу с нулевыми значениями и пометкой «Ориентир». Заполните КБЖУ и цену на вкладке «База сырья»; нормы потерь (х/о, варка и др.) подставляются по справочнику, где название узнано, их стоит проверить в «КБЖУ и потери».']);
  if(nUpd)notes.push(['warn','Обновится ТТК: '+nUpd+'. Состав и выход заменятся значениями из таблицы. Реквизиты карты, тексты разделов, значения протокола и продажи сохранятся.']);
  if(nNew)notes.push(['good','Создастся ТТК: '+nNew+'.']);
  if(guess.length)notes.push(['warn','Выход не указан у блюд: '+guess.slice(0,4).map(esc).join(', ')+(guess.length>4?'…':'')+'. Выход не придумывается: у новых блюд он остаётся пустым (ТТК помечена «Нет выхода»), у существующих не меняется. Укажите выход на вкладке «Готовность карт»: если вес написан в названии, там предложат его для подтверждения.']);
  var nSubs=t.dishes.reduce(function(a,d){return a+(d.subs?d.subs.length:0);},0);
  if(nSubs)notes.push(['good','Строки итогов («Итого фарша:», «Итого:») не считаются сырьём и в расчёт не входят, но сохранятся в карте ТТК для поваров: '+nSubs+'.']);
  if(t.skipped.length)notes.push(['warn','Строки без количества пропущены: '+t.skipped.length+' ('+t.skipped.slice(0,3).map(function(s){return esc(s.name);}).join(', ')+(t.skipped.length>3?'…':'')+').']);
  if(t.empty)notes.push(['warn','Блюда без строк рецептуры пропущены: '+t.empty+'.']);
  if(nSell&&!NOPRICE)notes.push(['good','Цена продажи есть у блюд: '+nSell+'.']);
  h+='<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>';
  h+='<div class="btns" style="margin-top:12px"><button class="btn primary" data-act="recsApply" data-edit>Загрузить ТТК: '+t.dishes.length+'</button><button class="btn" data-act="recsCancel">Отмена</button></div></section>';
  return h;
}
/* запись блюд в базу: возвращает счётчики. dish.skip — блюдо не записывается (используется при автообновлении) */
function applyRecipes(t){
  var g=curRegion(),created={},map={},res={add:0,upd:0,sell:0,skip:0,newIng:0};
  t.items.forEach(function(x){
    var id=x.ing;
    if(id==='__new__'){
      if(!created[x.key]){
        created[x.key]=newId();
        S.ings[created[x.key]]=normIng({name:x.name,p:0,f:0,c:0,kind:'estimate',source:'Добавлено из таблицы ТТК: значения КБЖУ не заполнены'});lossFill(S.ings[created[x.key]]);
        S.ings[created[x.key]].aliases=[x.key];
        queueSave('ingredients',created[x.key]);res.newIng++;
      }
      id=created[x.key];
    }else if(id&&x.remember&&x.how!=='alias'&&x.how!=='exact')addAlias(id,x.name);
    map[x.key]=id||'';
  });
  t.dishes.forEach(function(d){
    if(d.skip){res.skip++;return;}
    var rows=d.lines.map(function(l){
      var id=map[l.key]||'',ing=id?S.ings[id]:null,row={rid:newId(),ing:id,net:l.net,share:l.share===null?100:l.share};
      if(l.gross!==null&&l.gross!==undefined)row.gross=l.gross;
      var tn=l.tname||((ing&&normKey(ing.name)!==l.key)?l.name:'');
      if(tn)row.tname=tn;
      return row;
    });
    var old=d.target&&S.recipes[d.target],sv=d.sell>0?d.sell:null;
    var subsJ=(d.subs||[]).map(function(x){return{n:x.name,m:x.mass>0?dnum(x.mass,3):'',a:(x.at>0&&rows[x.at-1])?rows[x.at-1].rid:''};});
    if(old){
      old.name=d.name;old.rows=rows;
      if(d.outputGiven)old.output=d.output;
      if(d.num){if(!old.ttk)old.ttk={};old.ttk.num=d.num;}
      if(subsJ.length){if(!old.ttk)old.ttk={};old.ttk.subs=JSON.stringify(subsJ);}
      if(sv)setSell(old,g,sv);
      queueSave('recipes',d.target);res.upd++;
    }else{
      var nt=d.num?{num:d.num}:{};if(subsJ.length)nt.subs=JSON.stringify(subsJ);
      var nr=normRecipe({name:d.name,output:d.outputGiven?d.output:0,rows:rows,ttk:nt}),nid=newId();
      if(sv)setSell(nr,g,sv);
      S.recipes[nid]=nr;queueSave('recipes',nid);res.add++;
    }
    if(sv)res.sell++;
  });
  return res;
}
function doRecsApply(){
  var t=S.recs;if(!t)return;
  var res=applyRecipes(t);
  S.recs=null;S.tab='menu';
  if(!S.active||!S.recipes[S.active]){var l=visIds();setActive(l[0]||null);}
  renderAll();
  flash('ТТК загружены: создано '+res.add+', обновлено '+res.upd+(res.sell?', цен продажи: '+res.sell:''));
}
/* автообновление при открытии: пишутся только блюда, у которых всё сырьё нашлось по названию или синониму */
