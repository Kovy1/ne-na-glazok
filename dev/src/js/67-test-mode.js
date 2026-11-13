/* Тестовая версия (сборка с --test): данные хранятся отдельно от рабочих (префикс «T~» в хранилище браузера, см. начало страницы),
   рабочий скрипт общей базы заблокирован, сверху плашка «ТЕСТ». Рабочие данные браузера отсюда только читаются и только по кнопке. */
function testOn(){return typeof window!=='undefined'&&window.KBZHU_TEST===1;}
function testProd(u){var p=(typeof window!=='undefined'&&window.KBZHU_TEST_PROD)||'';return!!(p&&String(u||'').indexOf(p)>-1);}
/* Перенос данных в тестовую версию — только явным файлом: из рабочей версии «Скачать файл с данными» (Личный кабинет → «Мои данные»),
   здесь «Загрузить файл данных». В файле нет кодов доступа, адреса общей базы и связей с ней; доступа к хранилищу рабочего сайта у этой страницы нет. */
function testLoadFile(file){
  if(!file)return;
  readTextFile(file,function(err,text){
    var r,plan,bad;
    if(err){flash('Не удалось прочитать файл');return;}
    r=bkCheck(text);
    if(!r.ok){flash('Это не файл с данными «Не на глазок»: '+String(r.msg||'').replace(/Копия на Диске /,'')); return;}
    var nc=bkCounts(r.snap);
    if(!window.confirm('Заменить тестовые данные данными из файла (сырьё: '+nc.ings+', ТТК: '+nc.recipes+')? Тестовые данные будут заменены, рабочие не затрагиваются, прежние тестовые можно вернуть кнопкой «Вернуть прежние данные браузера».'))return;
    delete r.snap.sync;       /* связи с общей базой и подключение в тест не переносятся */
    plan=bkApply(r.snap,{cfg:{},map:{ing:{},rec:{}},gone:{}},{rev:0,who:'',at:0,dirty:false});
    plan.sync=JSON.stringify(plan.sync);
    bad=bkWriteAll(plan);
    if(bad){flash(bad);return;}
    location.reload();
  });
}
function testReset(){
  if(!window.confirm('Очистить все тестовые данные? Рабочие данные не затрагиваются.'))return;
  localStorage.clear();
  try{indexedDB.deleteDatabase('kbzhu-ph');indexedDB.deleteDatabase('kbzhu-park');}catch(e){}
  location.reload();
}
function testBar(){
  var b;
  if(!testOn()||document.getElementById('testBar'))return;
  document.documentElement.classList.add('testmode');
  b=document.createElement('div');b.id='testBar';b.setAttribute('role','status');
  b.innerHTML='<b>ТЕСТ<u>ОВАЯ ВЕРСИЯ</u></b><span>свои данные, рабочая общая база заблокирована</span>'
    +'<button type="button" id="testLoad"><i class="lg">Загрузить файл данных</i><i class="sh">Из файла</i></button><button type="button" id="testSave"><i class="lg">Скачать данные</i><i class="sh">В файл</i></button><input type="file" id="testFile" accept=".json,application/json" hidden><button type="button" id="testReset"><i class="lg">Очистить тест</i><i class="sh">Очистить</i></button>';
  document.body.insertBefore(b,document.body.firstChild);
  document.getElementById('testLoad').addEventListener('click',function(){document.getElementById('testFile').click();});
  document.getElementById('testFile').addEventListener('change',function(e){var f=e.target.files&&e.target.files[0];testLoadFile(f);try{e.target.value='';}catch(x){}});
  document.getElementById('testSave').addEventListener('click',dfOut);
  document.getElementById('testReset').addEventListener('click',testReset);
}
testBar();
