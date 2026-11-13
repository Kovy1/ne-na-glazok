/* ---------- Фудкост и план действий: данные отчётов ----------
   Отчёты (поступления, движение товаров, ревизия, продажи, списания и внутреннее потребление, фактический выпуск) разбираются в
   нормализованные операции. Операция получает устойчивый ключ из своего содержимого, поэтому повторная загрузка того же отчёта, другой
   файл с теми же строками или пересекающийся период не удваивают данные. Название и сумма сами по себе операции не объединяют:
   две одинаковые строки внутри одного документа остаются двумя операциями (счётчик повтора в ключе).
   Объект — то же понятие, что в истории закупок 1С: идентификатор объекта даёт phSlug(название).
   Сопоставление номенклатуры хранится отдельно от операций и применяется при расчёте: подтверждённое решение действует на все загрузки.
   Хранилище — IndexedDB «kbzhu-fc» (на этом устройстве); сырьё, блюда и регионы берутся из общей базы по тем же идентификаторам. */
var FC_TYPES={receipts:'Поступления',moves:'Движение товаров',revision:'Ревизия',sales:'Продажи',writeoff:'Списания и внутреннее потребление',output:'Фактический выпуск'};
var FC_TYPE_HINT={
  receipts:'Поступления от поставщиков: дата, документ, поставщик, номенклатура, единица, количество, сумма.',
  moves:'Движение товаров за период: начальный остаток, поступления, возвраты, перемещения, расход, конечный остаток по позициям.',
  revision:'Ревизия: дата, позиция, учётное и фактическое количество, единица. Учётный остаток без пересчёта фактом фактическим не считается.',
  sales:'Продажи блюд: дата, блюдо, количество, фактическая выручка (с учётом скидок и возвратов).',
  writeoff:'Списания и внутреннее потребление: дата, позиция, количество, причина.',
  output:'Фактический выпуск (и остатки готовых блюд, если есть): дата, блюдо, количество.'
};
/* колонки по типам: [ключ, подпись, обязательна, регулярное выражение заголовка]; порядок = приоритет при распознавании */
var FC_COLS={
  receipts:[['d','Дата',1,/^(дата|период)/],['doc','Документ',0,/(документ|накладн|регистратор|номер)/],['sup','Поставщик',0,/(поставщик|контрагент|партнер|партнёр)/],['wh','Склад / объект',0,/(склад|объект|подразд|точка)/],['code','Код',0,/(^код|артикул)/],['nm','Номенклатура',1,/(номенклатур|наименован|товар|продукт|позиц|сырь)/],['u','Единица',0,/(ед\.? ?изм|единиц|^ед$)/],['q','Количество',1,/(колич|кол-во|^кол)/],['vv','Сумма НДС',0,/(сумма ндс|ндс сумма|сумма налога|^ндс$|в т\.? ?ч\.? ндс)/],['vr','Ставка НДС',0,/(ставка|ндс ?,? ?%|% ?ндс|^ндс ?%)/],['s','Сумма',1,/(сумма|стоимост)/]],
  moves:[['code','Код',0,/(^код|артикул)/],['nm','Номенклатура',1,/(номенклатур|наименован|товар|продукт|позиц|сырь)/],['u','Единица',0,/(ед\.? ?изм|единиц|^ед$)/],['open','Начальный остаток',1,/(начальн|на начало|остаток на начало)/],['tin','Перемещение: приход',0,/(перемещ.*(приход|получ|поступ)|(приход|получ|поступ).*перемещ)/],['tout','Перемещение: расход',0,/(перемещ.*(расход|отправ|отгруз)|(расход|отправ|отгруз).*перемещ)/],['ret','Возвраты',0,/возврат/],['in','Поступления',1,/(приход|поступл)/],['out','Расход',1,/(расход|списан|отгруз|выбыт)/],['close','Конечный остаток',1,/(конечн|на конец|остаток на конец)/]],
  revision:[['d','Дата',0,/^дата/],['code','Код',0,/(^код|артикул)/],['nm','Номенклатура',1,/(номенклатур|наименован|товар|продукт|позиц|сырь)/],['u','Единица',0,/(ед\.? ?изм|единиц|^ед$)/],['book','Учётное количество',1,/(учет|учёт|по данным учет|книжн|остаток)/],['fact','Фактическое количество',1,/(факт|пересчет|пересчёт)/],['s','Стоимость',0,/(сумма|стоимост)/]],
  sales:[['d','Дата',1,/^(дата|период)/],['code','Код',0,/(^код|артикул)/],['nm','Блюдо',1,/(блюдо|номенклатур|наименован|товар|позиц)/],['q','Количество',1,/(колич|кол-во|^кол)/],['s','Выручка',1,/(выручк|сумма|стоимост)/],['disc','Скидка',0,/скидк/],['ret','Возврат (кол-во)',0,/возврат/]],
  writeoff:[['d','Дата',1,/^(дата|период)/],['code','Код',0,/(^код|артикул)/],['nm','Позиция',1,/(номенклатур|наименован|товар|продукт|позиц|сырь|блюдо)/],['u','Единица',0,/(ед\.? ?изм|единиц|^ед$)/],['q','Количество',1,/(колич|кол-во|^кол)/],['reason','Причина',0,/(причин|статья|основани|вид списан)/],['s','Сумма',0,/(сумма|стоимост)/]],
  output:[['d','Дата',1,/^(дата|период)/],['code','Код',0,/(^код|артикул)/],['nm','Блюдо',1,/(блюдо|номенклатур|наименован|товар|позиц)/],['u','Единица',0,/(ед\.? ?изм|единиц|^ед$)/],['q','Выпуск',1,/(выпуск|колич|кол-во|^кол)/],['rest','Остаток готовых',0,/остаток/]]
};
/* причины списания, относимые к внутреннему потреблению (настраивается в параметрах расчёта) */
var FC_INTERNAL_RE=/(внутрен|собствен|питани[ея] персонал|персонал|проб[аы]|дегустац|представит|бракераж|контрольн)/i;
function fcH(s){s=String(s);return phHash(s,5381).toString(36)+phHash(s,52711).toString(36)+phHash(s,7).toString(36);}
function fcNum(v){
  var t=String(v==null?'':v).replace(/[\s  ]/g,'').replace(',','.');
  if(t==='')return null;
  if(!/^[-+−]?\d+(\.\d+)?(e[-+]?\d+)?$/i.test(t))return NaN;
  return Number(t.replace('−','-'));
}
function fcR(v,d){var k=Math.pow(10,d===undefined?4:d);return Math.round(v*k+(v<0?-1e-9:1e-9))/k;}
function fcDate(v){
  var t=String(v==null?'':v).trim(),m;
  if(!t)return'';
  m=/^(\d{4})-(\d{2})-(\d{2})/.exec(t);if(m&&isIso(m[1]+'-'+m[2]+'-'+m[3]))return m[1]+'-'+m[2]+'-'+m[3];
  m=/^(\d{1,2})[.\/](\d{1,2})[.\/](\d{2,4})/.exec(t);
  if(m){var y=m[3].length===2?'20'+m[3]:m[3],iso=y+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2);return isIso(iso)?iso:'';}
  if(/^\d{5}(\.\d+)?$/.test(t)){var d=new Date(Math.round((Number(t)-25569)*86400000));if(!isNaN(d.getTime()))return d.toISOString().slice(0,10);}
  return'';
}
function fcIsoRu(iso){var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));return m?m[3]+'.'+m[2]+'.'+m[1]:String(iso||'');}
function fcHdrKey(s){return String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();}
/* распознать строку заголовков и колонки; каждая колонка файла назначается не более чем одному полю */
function fcDetect(type,rows){
  var cols=FC_COLS[type],best=-1,bi=-1,bm=null,i,j,k,row,m,used,n,c;
  for(i=0;i<Math.min(rows.length,25);i++){
    row=rows[i]||[];m={};used={};n=0;
    for(k=0;k<cols.length;k++){
      c=cols[k];m[c[0]]=-1;
      for(j=0;j<row.length;j++){
        if(used[j])continue;
        if(c[3].test(fcHdrKey(row[j]))){m[c[0]]=j;used[j]=1;n++;break;}
      }
    }
    if(n>best){best=n;bi=i;bm=m;}
  }
  var req=cols.filter(function(c){return c[2];}).length;
  return{hdr:best>=2?bi:-1,map:bm||{},score:best,req:req};
}
function fcMapMissing(type,map){return FC_COLS[type].filter(function(c){return c[2]&&!(map[c[0]]>-1);}).map(function(c){return c[1];});}
/* Разбор. ctx: {obj, from, to, whOk:{значение:true/false}, defU, kind:'auto'|'write'|'internal'} */
function fcParse(type,rows,hdr,map,ctx){
  var out={ops:[],skipped:[],issues:[],ctrl:{rows:0,sumQ:0,sumS:0,tot:null},whs:{},dates:{min:'',max:''}},seen={},i,row,r,nm,get,total=null;
  ctx=ctx||{};
  function cell(row,k){return map[k]>-1?row[map[k]]:undefined;}
  function skip(i,why,nm2){out.skipped.push({r:i+1,why:why,n:nm2||''});}
  for(i=hdr+1;i<rows.length;i++){
    row=rows[i]||[];
    if(!row.some(function(v){return String(v==null?'':v).trim();}))continue;
    nm=String(cell(row,'nm')==null?'':cell(row,'nm')).replace(/\s+/g,' ').trim();
    if(/^(итого|всего)\b/i.test(nm)||(!nm&&/^(итого|всего)/i.test(String(row[0]==null?'':row[0]).trim()))){
      total={q:fcNum(cell(row,'q')!==undefined?cell(row,'q'):cell(row,'out')),s:fcNum(cell(row,'s')),close:fcNum(cell(row,'close')),open:fcNum(cell(row,'open'))};continue;
    }
    if(!nm){skip(i,'нет названия');continue;}
    r={t:type,obj:ctx.obj,nm:nm.slice(0,200),rn:i+1};
    var code=String(cell(row,'code')==null?'':cell(row,'code')).trim();if(code)r.code=code.slice(0,40);
    var bad='',u=cell(row,'u');
    if(map.u>-1&&String(u==null?'':u).trim()){r.u=revUnit(u);if(!r.u){skip(i,'единица «'+String(u).trim()+'» не распознана (кг, г, л, мл, шт, уп)',nm);continue;}}
    else r.u=ctx.defU||'';
    if(map.d>-1){
      r.d=fcDate(cell(row,'d'));
      if(!r.d){skip(i,'дата «'+String(cell(row,'d')==null?'':cell(row,'d')).trim()+'» не распознана',nm);continue;}
      if(ctx.from&&ctx.to&&(r.d<ctx.from||r.d>ctx.to)){skip(i,'дата '+fcIsoRu(r.d)+' вне периода',nm);continue;}
      if(!out.dates.min||r.d<out.dates.min)out.dates.min=r.d;if(r.d>out.dates.max)out.dates.max=r.d;
    }
    if(map.wh>-1){
      var wh=phObjName(cell(row,'wh')),wk=normKey(wh);
      out.whs[wk]=out.whs[wk]||{name:wh,n:0};out.whs[wk].n++;
      if(ctx.whOk&&ctx.whOk[wk]===false){skip(i,'склад «'+wh+'» не относится к объекту',nm);continue;}
      r.wh=wh;
    }
    function nf(k,neg){
      var raw=cell(row,k),x;
      if(map[k]<0||raw===undefined||String(raw).trim()==='')return null;
      x=fcNum(raw);
      if(x!==x){bad=FC_COLS[type].filter(function(c){return c[0]===k;})[0][1]+': «'+String(raw).trim()+'» не число';return null;}
      if(!neg&&x<0){bad=FC_COLS[type].filter(function(c){return c[0]===k;})[0][1]+' меньше нуля';return null;}
      return x;
    }
    if(type==='receipts'){
      r.doc=String(cell(row,'doc')==null?'':cell(row,'doc')).trim().slice(0,60);r.sup=String(cell(row,'sup')==null?'':cell(row,'sup')).trim().slice(0,100);
      r.q=nf('q',true);r.s=nf('s',true);
      var vv=nf('vv',true);if(vv!==null)r.vv=vv;
      if(map.vr>-1&&!bad){var vt=String(cell(row,'vr')==null?'':cell(row,'vr')).replace('%','').replace(/без\s*ндс/i,'0').trim();if(vt!==''){var vx=fcNum(vt);if(vx!==vx||vx<0||vx>100)bad='Ставка НДС: «'+String(cell(row,'vr')).trim()+'» не процент';else r.vr=vx;}}
      if(!bad&&r.q===null&&r.s===null)bad='нет количества и суммы';
      if(!bad&&r.q===null)bad='нет количества';
    }else if(type==='moves'){
      ['open','in','ret','tin','tout','out','close'].forEach(function(k){if(!bad){var x=nf(k,true);if(x!==null)r[k]=x;}});
      if(!bad&&r.open===undefined&&r['in']===undefined&&r.out===undefined&&r.close===undefined)bad='нет ни одного количества';
    }else if(type==='revision'){
      r.book=nf('book',true);r.fact=nf('fact',true);r.s=nf('s',true);
      if(!bad&&r.book===null&&r.fact===null)bad='нет ни учётного, ни фактического количества';
    }else if(type==='sales'){
      r.q=nf('q',true);r.s=nf('s',true);var dsc=nf('disc',true),rt=nf('ret',true);
      if(dsc!==null)r.disc=dsc;if(rt!==null)r.ret=rt;
      if(!bad&&r.q===null)bad='нет количества';
    }else if(type==='writeoff'){
      r.q=nf('q',true);r.s=nf('s',true);r.reason=String(cell(row,'reason')==null?'':cell(row,'reason')).trim().slice(0,120);
      if(!bad&&r.q===null)bad='нет количества';
      r.k=ctx.kind==='write'?'w':(ctx.kind==='internal'?'i':(FC_INTERNAL_RE.test(r.reason)?'i':'w'));
    }else if(type==='output'){
      r.q=nf('q',true);var rs=nf('rest',true);if(rs!==null)r.rest=rs;
      if(!bad&&r.q===null&&r.rest===undefined)bad='нет количества';
    }
    if(bad){skip(i,bad,nm);continue;}
    out.ctrl.rows++;
    if(r.q!=null)out.ctrl.sumQ+=r.q;if(r.s!=null)out.ctrl.sumS+=r.s;
    /* ключ: содержимое операции + номер повтора одинаковых строк внутри одного документа */
    var base=[type,ctx.obj,r.d||'',r.doc||'',r.sup||'',r.code||normKey(r.nm),r.u||'',r.q==null?'':r.q,r.s==null?'':r.s,r.book==null?'':r.book,r.fact==null?'':r.fact,r.reason||'',r.open==null?'':r.open,r['in']==null?'':r['in'],r.ret==null?'':r.ret,r.tin==null?'':r.tin,r.tout==null?'':r.tout,r.out==null?'':r.out,r.close==null?'':r.close,r.disc==null?'':r.disc,r.rest==null?'':r.rest,ctx.from&&type==='moves'?ctx.from+'/'+ctx.to:''].join('|')+(r.vr!=null||r.vv!=null?'|v'+(r.vr==null?'':r.vr)+'/'+(r.vv==null?'':r.vv):'');
    seen[base]=(seen[base]||0)+1;
    r.id=fcH(base+'|'+(seen[base]-1));
    out.ops.push(r);
  }
  if(total){
    out.ctrl.tot=total;
    var tq=total.q,ts=total.s;
    if(type==='receipts'||type==='sales'||type==='writeoff'||type==='output'){
      if(tq!==null&&tq===tq&&Math.abs(tq-out.ctrl.sumQ)>Math.max(0.01,Math.abs(tq)*0.0005))out.issues.push({lv:'warn',txt:'Итог количества в отчёте ('+dnum(tq,3)+') не сходится с суммой строк ('+dnum(out.ctrl.sumQ,3)+'): возможно, часть строк не распознана или единицы разные.'});
      if(ts!==null&&ts===ts&&Math.abs(ts-out.ctrl.sumS)>Math.max(0.5,Math.abs(ts)*0.0005))out.issues.push({lv:'warn',txt:'Итог суммы в отчёте ('+money(ts)+') не сходится с суммой строк ('+money(out.ctrl.sumS)+').'});
    }
  }else if(out.ops.length)out.issues.push({lv:'info',txt:'Строки «Итого» в файле нет: контрольная сверка итогов не выполнена.'});
  if(out.skipped.length)out.issues.push({lv:'warn',txt:'Пропущено строк: '+out.skipped.length+'. Они не вошли в загрузку (список ниже).'});
  return out;
}
/* ---------- хранилище ---------- */
var FC_STORES=['ops','batches','map','cfg','plans','sy'];
function fcFresh(){return{ld:false,ops:{},batches:{},map:{},cfg:{},plans:{},sy:{docs:{}},sel:{objs:[],obj:'',objName:'',from:'',to:''},imp:null,view:'data',busy:false,mem:false,errK:{}};}
S.fc=fcFresh();
var FC_TYPES_KEYS=Object.keys(FC_TYPES);
var fcDb=null,fcTimers={};
function fcIdbOpen(){
  return new Promise(function(res,rej){
    if(typeof indexedDB==='undefined'||!indexedDB){rej(new Error('noidb'));return;}
    var rq;try{rq=indexedDB.open(fcDbName(),1);}catch(e){rej(e);return;}
    rq.onupgradeneeded=function(){if(!rq.result.objectStoreNames.contains('kv'))rq.result.createObjectStore('kv',{keyPath:'id'});};
    rq.onsuccess=function(){res(rq.result);};rq.onerror=function(){rej(rq.error||new Error('idb'));};rq.onblocked=function(){rej(new Error('blocked'));};
  });
}
function fcIdbRun(fn){
  return new Promise(function(res,rej){
    var tx,rq;
    try{tx=fcDb.transaction('kv','readwrite');rq=fn(tx.objectStore('kv'));}catch(e){rej(e);return;}
    tx.oncomplete=function(){res(rq&&rq.result!==undefined?rq.result:undefined);};tx.onerror=tx.onabort=function(){rej(tx.error||new Error('tx'));};
  });
}
/* хранилище отдельное на учётную запись: смена пользователя в браузере не открывает чужие локальные отчёты */
function fcReset(){try{if(fcDb)fcDb.close();}catch(e){}fcDb=null;fcTimers={};S.fc=fcFresh();}
function fcLoad(){
  var k=fcScopeKey();
  if(S.fc.ld&&S.fc.scopeLoaded!==k)fcReset();
  if(S.fc.ld||S.fc.loading)return Promise.resolve();
  S.fc.loading=true;S.fc.scope=k;
  return fcIdbOpen().then(function(db){fcDb=db;return fcIdbRun(function(os){return os.getAll();});}).then(function(rows){
    (rows||[]).forEach(function(r){
      if(!r||!r.id||FC_STORES.indexOf(r.id)<0)return;
      S.fc[r.id]=r.rec||(r.id==='sy'?{docs:{}}:{});
    });
    if(!S.fc.sy||!S.fc.sy.docs)S.fc.sy={docs:{}};
  },function(e){S.fc.mem=true;S.fc.errK.mem=fcSaveMsg(e,true);}).then(function(){
    S.fc.ld=true;S.fc.loading=false;S.fc.scopeLoaded=k;
    if(fcScopeKey()!==k){fcReset();return fcLoad();}
    fcSelInit();fcSyncSoon(300);if(S.tab==='fc')renderAll();
  });
}
function fcPut(key){
  var rec=S.fc[key];
  if(!fcDb){S.fc.errK[key]='Хранилище браузера недоступно: данные есть только до закрытия страницы.';fcStat();return Promise.resolve();}
  fcTimers[key]=(fcTimers[key]||0)+1;
  /* запись считается выполненной только после завершения транзакции; при ошибке (память заполнена, хранилище закрыто) показывается ошибка сохранения */
  return fcIdbRun(function(os){return os.put({id:key,rec:JSON.parse(JSON.stringify(rec))});}).then(function(){fcTimers[key]--;delete S.fc.errK[key];fcStat();if(!S.fc.quiet)fcSyncSoon();},function(e){fcTimers[key]--;fcSaveFail(e,key);});
}
function fcSavedAll(){return new Promise(function(res){var t0=Date.now();(function t(){var n=0;Object.keys(fcTimers).forEach(function(k){n+=fcTimers[k];});if(!n||Date.now()-t0>15000)res(n===0);else setTimeout(t,30);})();});}
try{window.kbzhuFcSaved=fcSavedAll;}catch(e){}
/* ---------- объект и период ---------- */
function fcObjList(){
  var seen={},out=[];
  function add(name){var n=phObjName(name),sl=phSlug(n);if(!sl||seen[sl])return;seen[sl]=1;out.push({id:sl,name:n});}
  phObjects(Object.keys(S.cfg).filter(isPhId).map(function(k){return S.cfg[k];})).forEach(add);
  Object.keys(S.fc.batches).forEach(function(k){add(S.fc.batches[k].objName);});
  (S.fc.sel.objs||[]).forEach(function(o){add(o);});
  try{if(S.dr&&S.dr.pts)S.dr.pts.forEach(function(p){add(p.name);});}catch(e){}
  return out.sort(function(a,b){return a.name<b.name?-1:(a.name>b.name?1:0);});
}
function fcSelInit(){
  var s=S.fc.sel,L=fcObjList(),m,d=new Date(),y=d.getFullYear(),mo=d.getMonth();
  if(!s.obj&&L.length){s.obj=L[0].id;s.objName=L[0].name;}
  if(!s.from||!s.to){
    var pm=mo===0?11:mo-1,py=mo===0?y-1:y,last=new Date(py,pm+1,0).getDate(),z=function(n){return('0'+n).slice(-2);};
    s.from=py+'-'+z(pm+1)+'-01';s.to=py+'-'+z(pm+1)+'-'+z(last);
  }
}
/* ---------- единицы и пересчёт в килограммы ---------- */
function fcPackG(ing,region){var q=ing&&regRec(ing,region||curRegion());return(q&&q.priceUnit==='pack'&&q.packG>0)?q.packG:0;}
/* → {kg, flag}: flag — допущение или ограничение пересчёта; kg=null — пересчёт невозможен */
function fcKg(ingId,u,q,region){
  var ing=S.ings[ingId];
  if(q==null||q!==q)return{kg:null,flag:'нет количества'};
  if(u==='кг')return{kg:q,flag:''};
  if(u==='г')return{kg:q/1000,flag:''};
  if(u==='л'||u==='мл'){
    var v=u==='л'?q:q/1000;
    if(ing&&ing.dens>0)return{kg:v*ing.dens,flag:''};
    if(ing&&ing.densAsm)return{kg:v,flag:'л→кг: принято допущение 1 л = 1 кг'};
    /* без плотности и без осознанного принятия допущения строка в расчёт не входит: молоко и масло в литрах не равны килограммам */
    return{kg:null,flag:'л→кг: нужна плотность или принятие допущения 1 л = 1 кг',need:'dens'};
  }
  if(u==='шт'||u==='уп'){
    var g=fcPackG(ing,region);
    if(g>0)return{kg:q*g/1000,flag:''};
    return{kg:null,flag:'нет массы штуки/упаковки'};
  }
  return{kg:null,flag:'единица не указана'};
}
/* ---------- сопоставление номенклатуры ---------- */
function fcMapKey(kind,nm,code){return kind+':'+(code?'c:'+code:'n:'+normKey(nm));}
/* индекс названий блюд. Подпись строится из названий, видов блюда, псевдонимов и признака архива каждой ТТК: переименование, замена или архивация
   меняют подпись и пересобирают индекс (раньше проверялось только число ТТК). Внутри одного расчёта индекс держится без перепроверки. */
function fcRecSig(){
  var a=[];Object.keys(S.recipes).forEach(function(id){var r=S.recipes[id];if(r&&!r.arch)a.push(id+'\u0001'+r.name+'\u0001'+ttkVal(r,'dish')+'\u0001'+(r.aliases||[]).join('\u0002'));});
  return a.join('\u0003');
}
function fcRecIndex(force){
  if(!force&&fcRecIndex.v&&(fcRecIndex.hold||fcRecIndex.sig===fcRecSig()))return fcRecIndex.v;
  var ix={};
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id];if(!r||r.arch)return;
    [r.name,ttkVal(r,'dish')].concat(r.aliases||[]).forEach(function(n){var k=fcRecKey(n);if(k&&!ix[k])ix[k]=id;});
  });
  fcRecIndex.sig=fcRecSig();fcRecIndex.v=ix;return ix;
}
function fcRecKey(n){return normKey(String(n==null?'':n).replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:гр|г|мл|л|кг)\b\.?/gi,'').replace(/\bтк\b|№\s*\d+/gi,''));}
/* → {id, how: map|alias|exact|fuzzy|none|ignore, cand} ; fuzzy и none требуют решения пользователя */
function fcMatch(kind,nm,code){
  var m=S.fc.map[fcMapKey(kind,nm,code)],mt,ix,k,id;
  if(m){if(m==='-')return{id:'',how:'ignore'};if(kind==='i'?S.ings[m]:S.recipes[m])return{id:m,how:'map'};}
  if(code&&S.fc.map[fcMapKey(kind,nm,'')]){m=S.fc.map[fcMapKey(kind,nm,'')];if(m==='-')return{id:'',how:'ignore'};if(kind==='i'?S.ings[m]:S.recipes[m])return{id:m,how:'map'};}
  if(kind==='i'){
    mt=matchIng(nm,S.ings);
    if(mt.id&&(mt.how==='exact'||mt.how==='alias'))return{id:mt.id,how:mt.how};
    return mt.id?{id:'',how:'fuzzy',cand:mt.id}:{id:'',how:'none'};
  }
  ix=fcRecIndex();k=fcRecKey(nm);id=ix[k];
  if(id&&S.recipes[id])return{id:id,how:normKey(nm)===normKey(S.recipes[id].name)?'exact':'alias'};
  return{id:'',how:'none'};
}
function fcSetMap(kind,nm,code,val){
  S.fc.map[fcMapKey(kind,nm,code)]=val;
  S.fc.map[fcMapKey(kind,nm,'')]=S.fc.map[fcMapKey(kind,nm,'')]||val;
  fcPut('map');
}
/* ---------- загрузка ---------- */
function fcOverlap(a1,a2,b1,b2){return a1<=b2&&b1<=a2;}
/* подготовка к загрузке: что добавится, что уже есть, что мешает */
function fcPlanImport(type,parsed,ctx,name){
  var have=S.fc.ops[type]||{},add=0,dup=0,fp,ids=[],prev=null,blockers=[],notes=[];
  parsed.ops.forEach(function(o){ids.push(o.id);if(have[o.id])dup++;else add++;});
  ids.sort();fp=fcH(type+'|'+ctx.obj+'|'+ids.join(','));
  Object.keys(S.fc.batches).forEach(function(k){var b=S.fc.batches[k];if(b.fp===fp&&b.type===type&&b.obj===ctx.obj)prev=b;});
  if(prev)notes.push('Эти данные уже загружены '+fcIsoRu(prev.at?new Date(prev.at).toISOString().slice(0,10):'')+' (файл «'+prev.file+'»): повторная загрузка ничего не добавит.');
  if(type==='moves'){
    Object.keys(S.fc.batches).forEach(function(k){var b=S.fc.batches[k];
      if(b.type==='moves'&&b.obj===ctx.obj&&b.fp!==fp&&fcOverlap(b.from,b.to,ctx.from,ctx.to))blockers.push('Движение товаров за '+fcIsoRu(b.from)+' – '+fcIsoRu(b.to)+' (файл «'+b.file+'») пересекается с этим периодом. Удалите прежнюю загрузку или загрузите период без пересечения: иначе остатки и расход удвоятся.');});
  }
  return{add:add,dup:dup,fp:fp,prev:prev,blockers:blockers,notes:notes};
}
function fcCommit(type,parsed,ctx,name){
  var pl=fcPlanImport(type,parsed,ctx,name),have,b,id;
  if(pl.blockers.length)return{ok:false,msg:pl.blockers[0]};
  if(pl.prev)return{ok:true,same:true,batch:pl.prev,add:0,dup:parsed.ops.length};
  have=S.fc.ops[type]||(S.fc.ops[type]={});
  id='b'+fcH(pl.fp+'|'+Date.now()).slice(0,10);
  parsed.ops.forEach(function(o){if(!have[o.id]){var c=JSON.parse(JSON.stringify(o));delete c.rn;c.b=id;have[o.id]=c;}});
  b={id:id,type:type,reg:fcReg(),obj:ctx.obj,objName:ctx.objName,from:ctx.from,to:ctx.to,file:String(name||'файл').slice(0,120),at:Date.now(),fp:pl.fp,n:parsed.ops.length,add:pl.add,dup:pl.dup,skipped:parsed.skipped.length,
    ctrl:{rows:parsed.ctrl.rows,sumQ:fcR(parsed.ctrl.sumQ,4),sumS:fcR(parsed.ctrl.sumS,2),tot:parsed.ctrl.tot},issues:parsed.issues.map(function(x){return x.txt;}).slice(0,10),
    dates:parsed.dates,map:ctx.colMap||{}};
  S.fc.batches[id]=b;
  fcPut('ops');fcPut('batches');
  return{ok:true,batch:b,add:pl.add,dup:pl.dup};
}
function fcRemoveBatch(id){
  var b=S.fc.batches[id],ops;
  if(!b)return;
  ops=S.fc.ops[b.type]||{};
  Object.keys(ops).forEach(function(k){if(ops[k].b===id)delete ops[k];});
  delete S.fc.batches[id];
  fcPut('ops');fcPut('batches');
}
/* операции типа для объекта и периода (даты внутри периода; для остатков и движения — по периоду загрузки) */
function fcOps(type,obj,from,to){
  var ops=S.fc.ops[type]||{},out=[];
  Object.keys(ops).forEach(function(k){
    var o=ops[k];if(o.obj!==obj)return;
    if(type==='moves'){var b=S.fc.batches[o.b];if(!b||!fcOverlap(b.from,b.to,from,to))return;out.push(o);return;}
    if(o.d&&(o.d<from||o.d>to))return;
    out.push(o);
  });
  return out.sort(function(a,b){return(a.d||'')<(b.d||'')?-1:((a.d||'')>(b.d||'')?1:(a.id<b.id?-1:1));});
}
