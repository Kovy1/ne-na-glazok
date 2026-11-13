/* ---------- Фудкост: снимок исходных данных версии плана ----------
   Для каждой версии хранятся сами данные, по которым она посчитана: операции отчётов, пакеты загрузки, сопоставления, настройки и пороги,
   рецептуры (ТТК) с выходами, сырьё с ценами, единицами и плотностями, история закупок 1С. Отпечаток (fp) только сообщает, что данные
   изменились, — расчёт версии воспроизводится из снимка, а не из общей базы. Обновление базы снимок не меняет. */
var FC_SNAP_V=1;
function fcClone(o){return JSON.parse(JSON.stringify(o));}
var FC_SNAP_WARN='Цены, единицы, плотности и ТТК в снимке — состояние общей базы на дату построения версии. Какие значения действовали в самом периоде, приложение не хранит, поэтому эти данные нельзя считать подтверждённым состоянием прошлого периода. Закупочные цены из загруженных отчётов относятся к периоду.';
function fcSnapMake(res,cfg){
  var ops={},batches={},ings={},recs={},ph={},n={ops:0,batches:0,ings:0,recs:0,ph:0},sn,txt;
  function addIng(id){if(id&&!ings[id]&&S.ings[id])ings[id]=fcClone(S.ings[id]);}
  function addRec(id){
    if(!id||recs[id]||!S.recipes[id])return;
    recs[id]=fcClone(S.recipes[id]);
    (S.recipes[id].rows||[]).forEach(function(row){if(row.ing)addIng(row.ing);if(row.pf)addRec(row.pf);});
  }
  FC_TYPES_KEYS.forEach(function(t){var a=fcOps(t,res.obj,res.from,res.to);if(a.length){ops[t]=fcClone(a);n.ops+=a.length;}});
  Object.keys(S.fc.batches).forEach(function(k){var b=S.fc.batches[k];if(b.obj===res.obj&&fcOverlap(b.from,b.to,res.from,res.to)){batches[k]=fcClone(b);}});
  Object.keys(res.ings).forEach(addIng);
  Object.keys(res.dishes).forEach(addRec);
  Object.keys(S.cfg||{}).filter(isPhId).forEach(function(k){var b=S.cfg[k];if(b&&b.region===res.region&&b.it&&b.it.length&&phSlug(phObjOf(b))===fcObjSlug(res.obj)&&b.from<=res.to&&b.to>=res.from)ph[k]=fcClone(b);});
  n.batches=Object.keys(batches).length;n.ings=Object.keys(ings).length;n.recs=Object.keys(recs).length;n.ph=Object.keys(ph).length;
  sn={v:FC_SNAP_V,obj:res.obj,objName:res.objName||'',from:res.from,to:res.to,region:res.region,algo:FC_ALGO,rules:FC_RULES_VER,cfg:fcCanon(cfg),map:fcClone(S.fc.map||{}),ops:ops,batches:batches,ings:ings,recs:recs,ph:ph,
    warn:FC_SNAP_WARN};
  txt=JSON.stringify(fcCanon(sn));
  return{snap:sn,info:{v:FC_SNAP_V,h:fcH(txt),bytes:txt.length,n:n,hist:false}};
}
/* выполнить расчёт над данными снимка: общая база и загруженные отчёты на время расчёта подменяются, затем возвращаются на место */
function fcSnapEnv(snap,fn){
  var keep={ops:S.fc.ops,batches:S.fc.batches,map:S.fc.map,cfg:S.fc.cfg,ings:S.ings,recipes:S.recipes,scfg:S.cfg},o={},c2={},r;
  Object.keys(snap.ops||{}).forEach(function(t){o[t]={};snap.ops[t].forEach(function(x){o[t][x.id]=x;});});
  Object.keys(keep.scfg||{}).forEach(function(k){if(!isPhId(k))c2[k]=keep.scfg[k];});
  Object.keys(snap.ph||{}).forEach(function(k){c2[k]=snap.ph[k];});
  try{
    S.fc.ops=o;S.fc.batches=snap.batches||{};S.fc.map=snap.map||{};S.fc.cfg=snap.cfg||{};S.ings=snap.ings||{};S.recipes=snap.recs||{};S.cfg=c2;
    r=fn();
  }finally{S.fc.ops=keep.ops;S.fc.batches=keep.batches;S.fc.map=keep.map;S.fc.cfg=keep.cfg;S.ings=keep.ings;S.recipes=keep.recipes;S.cfg=keep.scfg;}
  return r;
}
/* пересчёт версии по её снимку → {fp, same, was} */
function fcSnapRecalc(snap){
  return fcSnapEnv(snap,function(){var res=fcCalc(snap.obj,snap.from,snap.to,snap.cfg,snap.region),f=fcFp(res);return{res:res,fp:f.fp,parts:f.parts};});
}
/* ---------- хранение снимков отдельными записями на устройстве ---------- */
function fcSnapKey(pid,n){return'snap:'+pid+':'+n;}
function fcSnapSave(pid,n,snap){
  var key=fcSnapKey(pid,n);
  S.fc.snapMem=S.fc.snapMem||{};S.fc.snapMem[key]=snap;
  if(!fcDb)return Promise.resolve();
  fcTimers.snap=(fcTimers.snap||0)+1;
  return fcIdbRun(function(os){return os.put({id:key,rec:snap});}).then(function(){fcTimers.snap--;},function(e){fcTimers.snap--;fcSaveFail(e);});
}
function fcSnapGet(pid,n){
  var key=fcSnapKey(pid,n);
  S.fc.snapMem=S.fc.snapMem||{};
  if(S.fc.snapMem[key])return Promise.resolve(S.fc.snapMem[key]);
  if(!fcDb)return Promise.resolve(null);
  return fcIdbRun(function(os){return os.get(key);}).then(function(r){var s=r&&r.rec||null;if(s)S.fc.snapMem[key]=s;return s;},function(){return null;});
}
/* проверка воспроизводимости: расчёт из снимка даёт тот же отпечаток, что записан в версии */
function fcSnapVerify(pl,n){
  var v=pl.versions.filter(function(x){return x.n===n;})[0];
  if(!v)return Promise.resolve({ok:false,why:'нет такой версии'});
  return fcSnapGet(pl.id,n).then(function(sn){
    if(!sn)return{ok:false,why:'снимок этой версии не найден на устройстве'};
    var r=fcSnapRecalc(sn);
    return{ok:r.fp===v.fp,fp:r.fp,was:v.fp,why:r.fp===v.fp?'расчёт по снимку совпал с сохранённой версией':'расчёт по снимку не совпал с сохранённой версией'};
  });
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{snapMake:fcSnapMake,snapRecalc:fcSnapRecalc,snapVerify:fcSnapVerify,snapGet:fcSnapGet});}catch(e){}
