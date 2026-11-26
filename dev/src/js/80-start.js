/* ---------- start ---------- */
/* меню «Ещё» в шапке карты: закрывается кликом в другом месте, выбором пункта и Esc (удаление просит второе нажатие, пока меню остаётся) */
function ttkMenuClose(){var mn=$('#ttkMenu'),mb=$('#ttkMore');if(mn&&!mn.hidden){mn.hidden=true;if(mb)mb.setAttribute('aria-expanded','false');}}
document.addEventListener('click',function(e){
  var mn=$('#ttkMenu');if(!mn||mn.hidden)return;
  if(!e.target.closest('.tmore')){ttkMenuClose();return;}
  var bb=e.target.closest('.tmenu button[data-act]');
  if(bb&&bb.getAttribute('data-act')!=='delRecipe')ttkMenuClose();
});
document.addEventListener('keydown',function(e){if(e.key==='Escape')ttkMenuClose();});
$('#tabs').addEventListener('click',function(e){
  var b=e.target.closest('.tab');if(!b||b.id==='tabMore')return;
  S.tab=b.getAttribute('data-tab');
  if(S.tab==='calc'&&!tabOk('calc')&&ttkCloudOn())S.tab='cloud';          /* шеф-повару расчёт не нужен: у него «ТТК» открывает сразу облако */
  if(S.tab==='calc'){ttkDropDraft();S.ttkHome=true;}
  renderAll();
  if(S.tab==='sync')syOnOpen();else if(S.tab==='calc'||S.tab==='cloud')syFilesLoad(false);
  else if(S.tab==='fc')fcLoad();
  else if(S.tab==='fc')fcLoad();
  else if(S.tab==='dir')drLoad(true);
  else if(S.tab==='rev')revLoad(true);
});
$('#pointSel').addEventListener('change',function(){drSetCurPt(this.value);renderAll();});
$('#regionSel').addEventListener('change',function(){
  setRegion(this.value);
  fixActive();
  if(S.price){S.price=null;flash('Загрузка прайса отменена: регион сменился');}
  if(S.c1){S.c1=null;flash('Загрузка выгрузки 1С отменена: регион сменился');}
  if(S.sales){S.sales=null;flash('Загрузка продаж отменена: регион сменился');}
  if(S.recs){S.recs=null;flash('Загрузка ТТК отменена: регион сменился');}
  renderAll();
});
$('#view').addEventListener('toggle',function(e){
  var id=e.target&&e.target.id;
  if(id==='rgCard')S.rgOpen=e.target.open;
  else if(id==='cloudCard')S.cloudOpen=e.target.open;
  else if(id==='cloudPrice')S.cloudOpenP=e.target.open;
  else if(id==='cloudSales')S.cloudOpenS=e.target.open;
  else if(id==='syMineList')S.sy.mineOpen=e.target.open;
  else if(id==='syHistBox'){S.sy.histOpen=e.target.open;if(e.target.open)syHistLoad(false);}
  else if(id==='tbBox')tb().open=e.target.open;
  else if(id==='mgBox'){mg().open=e.target.open;mgPaint();}
  else if(id==='mxBox'){mx().open=e.target.open;mxPaint();}
  else if(id==='sySvc')S.sy.svcOpen=e.target.open;
  else if(id==='syMyCode')S.sy.myOpen=e.target.open;
  else if(id==='syUsr'){S.sy.us.open=e.target.open;if(e.target.open&&!S.sy.us.list)usReload();}
  else if(id&&id.indexOf('c1g-')===0){if(S.c1&&S.c1.open)S.c1.open[id.slice(4)]=e.target.open;}
  else if(id==='c1PasteBox')S.c1Paste=e.target.open;
  else if(id==='mFolders')S.mfOpen=e.target.open;
  else if(id==='mTone')S.mtOpen=e.target.open;
  else if(id==='mArch')S.marchOpen=e.target.open;
  else if(id&&id.indexOf('mf-')===0){
    if(!S.mclosed)S.mclosed={};
    if(e.target.open)delete S.mclosed[id.slice(3)];else S.mclosed[id.slice(3)]=true;
    lsSet('kbzhu:mclosed',JSON.stringify(S.mclosed));
  }
  else if(id&&id.indexOf('syB-')===0)S.sy.openB[id.slice(4)]=e.target.open;
},true);
$('#priceFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()){roFlash();return;}onPriceFile(f);}});
$('#fcFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()||!fcCanEdit()){roFlash();return;}fcFilePicked(f);}});
$('#fcBkFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f)fcRestoreFile(f);});
$('#c1File').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()){roFlash();return;}c1OnFile(f);}});
$('#sxFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()){roFlash();return;}sxOnFile(f);}});
$('#salesFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()){roFlash();return;}onSalesFile(f);}});
/* какие блоки ввода продаж раскрыты, помним только после щелчка по заголовку: по умолчанию вставка открыта, пока продаж нет */
$('#view').addEventListener('click',function(e){
  var sm=e.target.closest&&e.target.closest('summary'),dt=sm&&sm.parentNode;
  if(dt&&(dt.id==='abPaste'||dt.id==='abManual'))setTimeout(function(){if(dt.id==='abPaste')S.aPaste=dt.open;else S.aManual=dt.open;},0);
});
var abResizeT=null;
window.addEventListener('resize',function(){clearTimeout(abResizeT);abResizeT=setTimeout(function(){if(S.tab==='abc')abDrawChart();else if(S.tab==='base'&&S.bsub==='price'&&(S.pview==='an'||S.pview==='obj'))pChartsDraw();},150);});
$('#specFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()){roFlash();return;}specOnFile(f);}});
$('#ttkFile').addEventListener('change',function(){var f=this.files&&this.files[0];try{this.value='';}catch(e){}if(f){if(uiRO()){roFlash();return;}onTtkFile(f);}});
$('#syUpFile').addEventListener('change',function(){var fl=Array.prototype.slice.call(this.files||[]);try{this.value='';}catch(e){}if(fl.length)syFileUpload(fl);});
/* перетаскивание .docx на страницу */
document.addEventListener('dragover',function(e){var dt=e.dataTransfer;if(dt&&Array.prototype.indexOf.call(dt.types||[],'Files')>-1)e.preventDefault();});
document.addEventListener('drop',function(e){
  var dt=e.dataTransfer,f=dt&&dt.files&&dt.files[0];if(!f||!/\.docx$/i.test(f.name))return;
  e.preventDefault();if(uiRO()){roFlash();return;}onTtkFile(f);
});
var view=$('#view');
view.addEventListener('click',onClick);
view.addEventListener('input',onInput);
view.addEventListener('change',onChange);
view.addEventListener('paste',aiOnPaste);
view.addEventListener('keydown',function(e){
  var t=e.target;
  if(t&&t.getAttribute&&e.key==='Enter'&&t.getAttribute('data-act')==='syFNew'){e.preventDefault();syDirAdd();return;}
  if(t&&t.getAttribute&&e.key==='Enter'&&t.getAttribute('data-act')==='syFRenV'){e.preventDefault();syDirRename();return;}
  if(t&&t.getAttribute&&e.key==='Escape'&&t.getAttribute('data-act')==='syFRenV'){e.preventDefault();S.sy.fren=null;renderAll();return;}
  if(e.key==='Enter'&&t&&t.getAttribute&&t.getAttribute('data-act')==='mCatNew'){e.preventDefault();if(uiRO()){roFlash();return;}doCatAdd();return;}
  if(e.key==='Enter'&&t&&t.getAttribute&&t.getAttribute('data-act')==='cUrl'){e.preventDefault();if(uiRO()){roFlash();return;}doCloudLoad(t.getAttribute('data-k'));}
});
view.addEventListener('focusout',function(){setTimeout(function(){if(renderPending&&!isTyping()){renderPending=false;renderAll();}},0);});
view.addEventListener('focusout',function(){setTimeout(function(){var a=document.activeElement;if(S.catNew&&!(a&&a.getAttribute&&a.getAttribute('data-act')==='iCatNew')){S.catNew=null;if(S.tab==='base'&&$('#ingList'))refreshIngList();}},0);});
view.addEventListener('click',function(e){
  var t=e.target;
  if(t.hasAttribute&&t.hasAttribute('data-pick')){
    if(t.disabled)return;
    if(!pickIsOpen(t)){pickOpen(t);if(!t._typed&&t.select)t.select();}
    return;
  }
  var o=t.closest&&t.closest('.ipo');
  if(o&&o.closest('.ipl'))pickChoose(o);
});
view.addEventListener('mousedown',function(e){var t=e.target;if(t.closest&&t.closest('.ipl'))e.preventDefault();});
view.addEventListener('mouseover',function(e){
  var o=e.target.closest&&e.target.closest('.ipo');if(!o||!o.closest('.ipl'))return;
  var inp=o.closest('.ipick').querySelector('.ipi'),os=Array.prototype.slice.call(o.closest('.ipl').querySelectorAll('.ipo'));
  var k=os.indexOf(o);if(k!==inp._ai)pickActive(inp,k,false);
});
view.addEventListener('input',function(e){
  var t=e.target;if(!(t.hasAttribute&&t.hasAttribute('data-pick')))return;
  t._typed=true;pickOpen(t);
});
view.addEventListener('keydown',function(e){
  var t=e.target;if(!(t.hasAttribute&&t.hasAttribute('data-pick')))return;
  var open=pickIsOpen(t);
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    if(!open){pickOpen(t);return;}
    pickActive(t,(t._ai==null||t._ai<0?(e.key==='ArrowDown'?0:-1):t._ai+(e.key==='ArrowDown'?1:-1)));
  }else if(e.key==='Enter'){
    if(!open)return;
    e.preventDefault();
    var os=pickList(t).querySelectorAll('.ipo');
    if(os.length&&t._ai>=0&&os[t._ai])pickChoose(os[t._ai]);else if(os.length&&t._typed)pickChoose(os[0]);
  }else if(e.key==='Escape'){
    if(open){e.preventDefault();pickClose(t,true);}
  }
});
view.addEventListener('focusout',function(e){
  var t=e.target;if(!(t.hasAttribute&&t.hasAttribute('data-pick')))return;
  setTimeout(function(){if(document.activeElement!==t&&t.isConnected)pickClose(t,true);},220);
});


function startLocal(){
  S.mode='local';loadLocal();S.loaded.ingredients=S.loaded.recipes=true;
  phReady=phIdbInit();
  if(S.seedMark){lsSet('kbzhu:seedfill',S.seedMark);if(S.seedFill)queueSave('ingredients','seed');}
  syLoad();
  cloudFromUrl();renderAll();cloudAutoLoad();
  if(S.tab==='sync')syOnOpen();else if(S.tab==='calc'||S.tab==='cloud')syFilesLoad(false);
  else if(S.tab==='dir')drLoad(true);
  else if(S.tab==='rev')revLoad(true);
  pfStart();
  bkStart();
  pgStart();
  rvStart();
}
function init(){
  S.region=lsGet('kbzhu:region')||MAIN;
  try{S.mclosed=JSON.parse(lsGet('kbzhu:mclosed')||'{}')||{};}catch(e0){S.mclosed={};}
  S.bsub=lsGet('kbzhu:bsub')==='price'?'price':'kbzhu';S.pview=({an:'an',obj:'obj'})[lsGet('kbzhu:pview')]||'tbl';
  var st=lsGet('kbzhu:tab');if(st==='ttk')st='calc';S.tab=(st&&['home','menu','abc','calc','cloud','op1','base','sync','fc'].indexOf(st)>-1)?st:'home';
  renderStatus();
  var c=window.claude;
  if(!c||!c.use){startLocal();return;}
  Promise.all([c.use('db').then(function(x){return x;},function(){return null;}),c.use('user').then(function(x){return x;},function(){return null;}),c.use('downloads').then(function(x){return x;},function(){return null;})]).then(function(res){
    var db=res[0],user=res[1];S.dl=res[2];
    if(!db){startLocal();return;}
    S.db=db;S.mode='db';
    var gate=user&&user.can?user.can('data.write').then(function(v){if(v===false)S.readOnly=true;},function(){}):Promise.resolve();
    gate.then(function(){renderStatus();subscribe();});
  });
}
init();
pwaStart();
pwHintStart();
relStart();
