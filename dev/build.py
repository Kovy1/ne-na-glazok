import json,glob,os,sys,subprocess
os.makedirs('out',exist_ok=True)
# исходники лежат в src/: сначала склейка в kbzhu.html (assemble.py), дальше всё как раньше
if os.path.exists('src/manifest.txt'):
    if subprocess.run([sys.executable,'assemble.py']).returncode: sys.exit(1)
ings={os.path.basename(p)[:-5]:json.load(open(p,encoding='utf-8')) for p in sorted(glob.glob('live/ingredients/*.json'))}
recs={os.path.basename(p)[:-5]:json.load(open(p,encoding='utf-8')) for p in sorted(glob.glob('live/recipes/*.json'))}
# демо-блюдо (ТТК №14) в готовый файл не кладётся: иначе оно появляется в каждом чистом браузере; для тестов: python3 build.py --demo
demo='--demo' in sys.argv
test='--test' in sys.argv     # тестовая сборка: свои данные (отдельный префикс хранилища), рабочая база заблокирована, плашка «ТЕСТ»
if test: demo=True
if not demo: recs={}
html=open('kbzhu.html',encoding='utf-8').read()
# встроенный скрипт для копирования всегда берётся из sync/Code.gs
gas=open('sync/Code.gs',encoding='utf-8').read()
lit=json.dumps(gas,ensure_ascii=False).replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
ga=html.index('/*GAS-START*/');gb=html.index('/*GAS-END*/')
html=html[:ga]+'/*GAS-START*/var SY_GAS='+lit+';'+html[gb:]
open('kbzhu.html','w',encoding='utf-8').write(html)
assert html.count('<script>')==1
# ссылка на файл подключения (необязательно): sync/pointer.txt; тогда сотрудникам не нужно вводить адрес скрипта
ptr=''
if os.path.exists('sync/pointer.txt'):
    ptr=open('sync/pointer.txt',encoding='utf-8').read().strip()
    assert ptr.startswith('https://docs.google.com/spreadsheets/d/'), 'в sync/pointer.txt должна быть ссылка на таблицу Google'
url=''
if os.path.exists('sync/script_url.txt'):
    url=open('sync/script_url.txt',encoding='utf-8').read().strip()
    assert url.startswith('https://script.google.com/') and url.endswith('/exec'), 'в sync/script_url.txt должен быть адрес веб-приложения (оканчивается на /exec)'
# тестовая сборка (--demo) адрес не вшивает; в готовом файле с вшитым адресом цены из встроенной базы убираются:
# без кода технолога, экономиста или просмотра цен в файле нет (они лежат в общей базе и у технолога в браузере)
if demo: ptr='';url=''
testprod=''
if test and os.path.exists('sync/script_url.txt'):
    import re as _re
    _m=_re.search(r'/macros/s/([^/]+)/exec',open('sync/script_url.txt',encoding='utf-8').read())
    testprod=_m.group(1) if _m else ''
# адрес ТЕСТОВОГО скрипта общей базы для тестовой сборки: --test-url=https://script.google.com/macros/s/…/exec (рабочий адрес запрещён)
turl=[a.split('=',1)[1] for a in sys.argv if a.startswith('--test-url=')]
if turl:
    assert test, '--test-url только вместе с --test'
    url=turl[0].strip()
    assert url.startswith('https://script.google.com/macros/s/') and url.endswith('/exec'), 'адрес тестового скрипта должен оканчиваться на /exec'
    assert not testprod or testprod not in url, 'это адрес рабочего скрипта: тестовая сборка не должна подключаться к рабочей базе'
keep='--keep-prices' in sys.argv
strip='--strip-prices' in sys.argv    # без цен и цен продажи (для тестовой страницы, которую открывают по ссылке)
if ((ptr or url) and not keep) or strip:
    for d in ings.values():
        for k in ('price','priceUnit','packG','priceSrc','px'): d.pop(k,None)
    for d in recs.values(): d.pop('sell',None)
seed=json.dumps({'ings':ings,'recipes':recs},ensure_ascii=False,separators=(',',':'))
seed=seed.replace('<','\\u003c').replace('\u2028','\\u2028').replace('\u2029','\\u2029')
rel=bool((ptr or url) and not keep and not test)   # чистая сборка (без цен, с вшитым адресом): только такую страницу принимает скрипт для раздачи по ссылке
import time
build=time.strftime('%Y%m%d%H%M',time.gmtime())   # номер сборки: по нему страница на ссылке сравнивается с открытой у человека
TEST_PRE=r"""(function(){
var real=window.localStorage,P='T~',w,fail=0;
try{
 w={getItem:function(k){return real.getItem(P+k);},setItem:function(k,v){real.setItem(P+k,v);},removeItem:function(k){real.removeItem(P+k);},
  clear:function(){var a=[],i,k;for(i=0;i<real.length;i++){k=real.key(i);if(k&&k.indexOf(P)===0)a.push(k);}a.forEach(function(x){real.removeItem(x);});},
  key:function(n){var a=[],j,k;for(j=0;j<real.length;j++){k=real.key(j);if(k&&k.indexOf(P)===0)a.push(k.slice(P.length));}return n<a.length?a[n]:null;}};
 Object.defineProperty(w,'length',{get:function(){var n=0,j,k;for(j=0;j<real.length;j++){k=real.key(j);if(k&&k.indexOf(P)===0)n++;}return n;}});
 Object.defineProperty(window,'localStorage',{configurable:true,value:w});
 if(window.localStorage!==w)fail=1;
 var IP=window.IDBFactory&&window.IDBFactory.prototype;
 if(IP){var o=IP.open,d=IP.deleteDatabase;IP.open=function(n,v){return v===undefined?o.call(this,P+n):o.call(this,P+n,v);};IP.deleteDatabase=function(n){return d.call(this,P+n);};}
}catch(e){fail=1;}
window.__realLS=real;window.KBZHU_TEST=1;
if(fail){window.stop();document.documentElement.innerHTML='<body style="font:16px sans-serif;padding:24px"><h2>Тестовая версия остановлена</h2><p>Браузер не дал отделить тестовые данные от рабочих, поэтому ничего не запущено. Рабочие данные не тронуты.</p></body>';throw new Error('test-isolation');}
})();"""
boot=(TEST_PRE+'window.KBZHU_TEST_PROD='+json.dumps(testprod)+';' if test else '')+'window.KBZHU_SEED='+seed+';'+('window.KBZHU_RELEASE=1;' if rel else '')+'window.KBZHU_BUILD='+build+';'+('window.KBZHU_PTR='+json.dumps(ptr)+';' if ptr else '')+('window.KBZHU_URL='+json.dumps(url)+';' if url else '')
outf='out/Не_на_глазок_ТЕСТ.html' if test else 'out/КБЖУ_калькулятор_автономный.html'
html2=html.replace('<script>','<script>'+boot+'</script>\n<script>',1)
if test:
    html2=html2.replace('<title>Не на глазок</title>','<title>ТЕСТ · Не на глазок</title>',1)
open(outf,'w',encoding='utf-8').write(html2)
print(len(ings),len(recs),'ptr' if ptr else '','url' if url else '','prices-stripped' if ((ptr or url) and not keep) else '')
