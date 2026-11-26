/* ---------- «Начать заново»: удалить ТТК, цены с историей и отчёты фудкоста, чтобы загрузить всё заново. База сырья (КБЖУ, потери, названия) остаётся ---------- */
var WIPE_WORD='ОЧИСТИТЬ';
function wpS(){return S.wipe||(S.wipe={open:false,rec:true,price:true,fc:true,saved:false,word:'',busy:false});}
/* очищать может технолог; без общей базы — владелец этого браузера */
function wpOn(){return S.mode==='local'&&!S.readOnly&&!guestOn()&&(!syLinked()||syAdmin());}
function wpCounts(){
  var n={rec:Object.keys(S.recipes).length,price:0,ph:Object.keys(S.cfg).filter(isPhId).length,fc:S.fc&&S.fc.batches?Object.keys(S.fc.batches).length:0};
  Object.keys(S.ings).forEach(function(id){var g=S.ings[id];if(g.price!=null||g.px)n.price++;});
  return n;
}
function wipeHtml(){
  if(!wpOn())return'';
  var w=wpS(),n=wpCounts(),shared=syLinked();
  if(!w.open)return'<section class="card wipe" id="wipeCard"><h3 class="h3">Начать заново</h3><p class="hint">Удалить ТТК, цены с историей и отчёты фудкоста, чтобы загрузить всё заново. База сырья остаётся.</p><div class="btns"><button class="btn" data-act="wpOpen" data-edit>Очистить данные…</button></div></section>';
  if(S.fc&&!S.fc.ld&&!S.fc.loading)fcLoad().then(function(){if(S.wipe&&S.wipe.open)wpPaint();});
  var ok=(w.rec||w.price||w.fc)&&w.saved&&w.word.trim().toUpperCase()===WIPE_WORD&&!w.busy;
  function ck(k,t){return'<label class="chk"><input type="checkbox" data-act="wpSel" data-edit data-k="'+k+'"'+(w[k]?' checked':'')+'> '+t+'</label>';}
  return'<section class="card wipe" id="wipeCard"><h3 class="h3">Начать заново</h3>'
    +'<p class="w-bad" style="margin:0 0 8px">'+(shared?'Данные удалятся из общей базы у всех пользователей, а не только у вас. Вернуть их можно только из копии, которую вы скачаете ниже.':'Данные удалятся из этого браузера. Вернуть их можно только из копии, которую вы скачаете ниже.')+'</p>'
    +ck('rec','ТТК и блюда меню: '+n.rec+' (вместе с ценами продажи и отметками деклараций)')
    +ck('price','Закупочные цены сырья: '+n.price+' поз., история цен: '+n.ph+' загр.')
    +ck('fc','Отчёты фудкоста: '+(S.fc&&S.fc.ld?n.fc+' загр.':'загружаю…')+' (планы мероприятий остаются)')
    +'<p class="hint">Остаётся: база сырья с КБЖУ, нормами потерь и запомненными названиями из 1С, папки меню, пользователи и настройки.</p>'
    +'<ol class="wsteps"><li><button class="btn'+(w.saved?'':' primary')+'" data-act="wpSave">Скачать копию данных (.json)</button>'+(w.saved?' <span class="tstat ok">копия скачана</span>':'')+'</li>'
    +'<li><label class="field w280"><span class="lbl">Введите слово '+WIPE_WORD+'</span><input data-act="wpWord" data-edit data-fk="wpword" autocomplete="off" value="'+esc(w.word)+'"'+(w.saved?'':' disabled')+'></label></li></ol>'
    +'<div class="btns"><button class="btn danger" data-act="wpGo" data-edit'+(ok?'':' disabled')+'>'+(w.busy?'Удаляю…':'Удалить выбранное')+'</button><button class="btn" data-act="wpClose">Отмена</button></div></section>';
}
function wpPaint(){var el=$('#wipeCard');if(el)el.outerHTML=wipeHtml();}
function wpBackup(){
  var d={kind:'ne-na-glazok-backup',at:new Date().toISOString(),ings:S.ings,recipes:S.recipes,cfg:S.cfg};
  if(S.fc&&S.fc.ld)d.fc={batches:S.fc.batches,ops:S.fc.ops};
  exportFile(JSON.stringify(d),'Не на глазок — копия перед очисткой '+new Date().toISOString().slice(0,10)+'.json');
}
function wpRun(){
  var w=wpS(),n={rec:0,price:0,ph:0,fc:0},jobs=[];
  w.busy=true;wpPaint();
  if(w.rec)Object.keys(S.recipes).forEach(function(id){syForgetRec(id);removeDoc('recipes',id);n.rec++;});
  if(w.rec){setActive(null);S.spec=null;S.ttk=null;}
  if(w.price){
    Object.keys(S.ings).forEach(function(id){
      var g=S.ings[id],had=g.price!=null||!!g.px;
      ['price','priceUnit','packG','priceSrc','px'].forEach(function(k){delete g[k];});
      if(had){queueSave('ingredients',id);n.price++;}
    });
    Object.keys(S.cfg).filter(isPhId).forEach(function(id){jobs.push(function(){return phDelete(id).then(function(ok){if(ok)n.ph++;});});});
    S.c1=null;
  }
  if(w.fc)jobs.push(function(){return fcLoad().then(function(){Object.keys(S.fc.batches).forEach(function(id){fcRemoveBatch(id);n.fc++;});});});
  return jobs.reduce(function(p,f){return p.then(f);},Promise.resolve()).then(function(){
    S.wipe=null;renderAll();
    flash('Удалено: ТТК '+n.rec+', цен сырья '+n.price+', записей истории цен '+n.ph+', загрузок фудкоста '+n.fc+(syLinked()?'. Изменения уйдут в общую базу при синхронизации':''));
    return n;
  });
}
function wpClick(act,b){
  var w;
  switch(act){
    case'wpOpen':w=wpS();w.open=true;wpPaint();return true;
    case'wpClose':S.wipe=null;wpPaint();return true;
    case'wpSave':wpBackup();wpS().saved=true;wpPaint();return true;
    case'wpGo':w=wpS();if(w.busy||!w.saved||w.word.trim().toUpperCase()!==WIPE_WORD)return true;wpRun();return true;
  }
  return false;
}
function wpChange(act,t){
  if(act==='wpSel'){wpS()[t.getAttribute('data-k')]=t.checked;wpPaint();return true;}
  return false;
}
function wpInput(act,t){
  if(act!=='wpWord')return false;
  var w=wpS();w.word=t.value;
  var b=$('#wipeCard [data-act="wpGo"]');if(b)b.disabled=!((w.rec||w.price||w.fc)&&w.saved&&w.word.trim().toUpperCase()===WIPE_WORD&&!w.busy);
  return true;
}
try{window.kbzhuWipe={run:wpRun,S:S,counts:wpCounts};}catch(e){}      /* для проверок */
