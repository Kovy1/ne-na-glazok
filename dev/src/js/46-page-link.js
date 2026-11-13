/* ---------- страница по ссылке: калькулятор открывается по адресу скрипта, без файла и установки ---------- */
var PG_MARK='window.KBZHU_'+'RELEASE=1;'; /* метка не должна встречаться в тексте программы целиком, иначе подойдёт любая сборка */
function pgS(){return S.sy.pg||(S.sy.pg={info:null,busy:false,loading:false,old:false,err:''});}
function pgCan(){return S.mode==='local'&&syLinked()&&syAdmin();}
function pgSafeUrl(u){u=String(u||'');return new RegExp('^(?:'+SY_EXEC_RE.source+')$').test(u)?u:'';}
function pgLoad(){
  var pg=pgS();
  if(!pgCan()||pg.loading||pg.busy)return Promise.resolve();
  pg.loading=true;
  return syGet({a:'pageinfo'},30000).then(function(d){pg.info=d;pg.old=false;pg.err='';},function(e){
    if(e&&e.code==='gas'&&e.err==='a')pg.old=true;else pg.err=syErrText(e);
  }).then(function(){pg.loading=false;pgPaint();});
}
function pgUpload(file){
  var pg=pgS();
  if(!file||pg.busy||!pgCan())return;
  if(file.size>6*1024*1024){syMsg('pg','err','Файл больше 6 МБ: это не файл калькулятора.');return;}
  pg.busy=true;syMsg('pg','busy','Читаю файл…');pgPaint();
  readBuf(file).then(function(buf){
    var html=new TextDecoder('utf-8').decode(buf);
    if(html.indexOf(PG_MARK)<0)throw{code:'pg',msg:'Это не готовый файл калькулятора для рассылки: в нём нет метки чистой сборки, а в такой странице могут оказаться цены. Выберите файл «КБЖУ_калькулятор_автономный.html» целиком.'};
    syMsg('pg','busy','Загружаю страницу на Диск…');
    return syPost('pagePut',{html:html},undefined,60);
  }).then(function(){
    pg.busy=false;
    syMsg('pg','ok','Страница загружена · '+nowHm()+'. Теперь калькулятор открывается по ссылке ниже.');
    return pgLoad();
  }).catch(function(e){
    syMsg('pg','err',(e&&e.code==='pg')?e.msg:'Страница не загрузилась: '+syErrText(e));
  }).then(function(){pg.busy=false;pgPaint();});
}
function pgCardHtml(){
  var pg=pgS(),i=pg.info,link=pgSafeUrl(S.sy.cfg.url),old=pg.old||(S.sy.info&&(S.sy.info.v||0)<7),has=!!(i&&i.has);
  var h='<h2>Страница по ссылке</h2>'
    +'<p class="hint" style="margin-top:0">Калькулятор открывается по ссылке вашего скрипта, без файла и установки. Загрузите готовый файл и отправьте сотрудникам ссылку ниже.</p>';
  if(old)return h+'<p class="hint cmsg warn">В таблице стоит прежняя версия скрипта: страницу она отдавать не умеет. Вставьте новый скрипт («Настройка скрипта») и создайте новую версию развёртывания: Развернуть → Управление развёртываниями → Новая версия.</p>';
  h+='<p class="hint cmsg bkst '+(has?'ok':'warn')+'" id="pgStat">'+(i?(has?'На ссылке лежит страница от '+esc(syWhen(i.at))+(i.by?' ('+esc(i.by)+')':'')+'.':'Страница ещё не загружена: по ссылке пока видна заглушка.'):(pg.err?'Не удалось узнать, загружена ли страница: '+esc(pg.err)+'.':'Проверяю, загружена ли страница…'))+'</p>'
    +'<div class="btns"><button class="btn primary" data-act="pgPick"'+(pg.busy?' disabled':'')+'>'+(has?'Обновить страницу из файла':'Загрузить файл калькулятора')+'</button></div>'
    +(i&&has&&appBuild()?'<p class="hint" style="margin:6px 0 0">'+(i.bld?(i.bld===appBuild()?'На ссылке та же версия, что у вас.':(i.bld<appBuild()?'На ссылке версия старше вашей (от '+esc(appBuildTxt(i.bld))+'): загрузите этот файл, чтобы у всех появилось оповещение.':'На ссылке версия новее вашей (от '+esc(appBuildTxt(i.bld))+').')):'На ссылке версия без номера сборки: загрузите этот файл, дальше оповещения пойдут сами.')+' Ваша версия от '+esc(appBuildTxt(appBuild()))+'.</p>':'')
    +(link?'<div class="ptrbox"><b>Ссылка на калькулятор</b><p class="hint" style="margin:4px 0 6px;overflow-wrap:anywhere" id="pgLink">'+esc(link)+'</p>'
      +'<div class="btns"><a class="btn mini" href="'+esc(link)+'" target="_blank" rel="noopener">Открыть</a><button class="btn mini" data-act="pfCopy" data-url="'+esc(link)+'">Копировать ссылку</button></div></div>':'')
    +syMsgHtml('pg');
  return h;
}
function syPgHtml(){return pgCan()?'<section class="card" id="pgBox">'+pgCardHtml()+'</section>':'';}
function pgPaint(){var el=$('#pgBox');if(el)el.innerHTML=pgCardHtml();}
function pgClick(act){
  if(act==='pgPick'){var f=$('#pgFile');if(f)f.click();return true;}
  return false;
}
function pgStart(){
  var f=$('#pgFile');
  if(f)f.addEventListener('change',function(){var fl=this.files&&this.files[0];try{this.value='';}catch(e){}if(fl)pgUpload(fl);});
  setTimeout(pgLoad,6000);
}
/*PGUI-END*/

/*RVUI-START*/
