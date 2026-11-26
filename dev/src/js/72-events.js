function onClick(e){
  var b=e.target.closest('button[data-act]');if(!b)return;
  var act=b.getAttribute('data-act'),r=curRecipe(),id;
  if(uiRO()&&b.hasAttribute('data-edit')){roFlash();return;}
  if(p1cClick(act,b))return;
  if(specClick(act,b))return;
  if(wpClick(act,b))return;
  if(fcClick(act,b))return;
  if(dsClick(act,b))return;
  if(tbClick(act,b))return;
  if(aiClick(act,b))return;
  if(bkClick(act,b))return;
  if(usClick(act,b))return;
  if(drClick(act,b))return;
  if(revClick(act,b))return;
  if(pgClick(act))return;
  if(bulkClick(act,b))return;
  if(mgClick(act,b))return;
  if(mxClick(act,b))return;
  switch(act){
    case'newRecipe':
      id=newId();S.recipes[id]={name:'Новое блюдо',output:100,rows:[{rid:newId(),ing:'',net:0,share:100}],ref:{label:'',p:null,f:null,c:null,kcal:null,tol:10}};
      setActive(id);queueSave('recipes',id);S.focusFk='rname';S.focusSel=1;S.tab='calc';S.ttkHome=false;S.newDraft=id;renderAll();window.scrollTo(0,0);break;
    case'ttkHome':ttkDropDraft();S.tab='calc';S.ttkHome=true;renderAll();window.scrollTo(0,0);break;
    case'ttkSaved':S.ttkHome='saved';renderAll();break;
    case'incFill':(function(){var rid=b.getAttribute('data-rid'),ids={},nm='',n=0;
      if(rid&&S.recipes[rid]){incIds(costOf(S.recipes[rid],S.ings,100,curRegion())).forEach(function(i){ids[i]=1;n++;});nm=S.recipes[rid].name||'блюда';}
      else{menuItems().forEach(function(it){(it.m.noIds||[]).forEach(function(i){if(!ids[i]){ids[i]=1;n++;}});});nm='';}
      if(!n){flash('Недостающих цен у сырья нет');return;}
      S.pDish={name:nm,ids:ids,n:n};S.pflt='nop';S.pq='';S.bsub='price';lsSet('kbzhu:bsub','price');S.pview='tbl';lsSet('kbzhu:pview','tbl');S.tab='base';renderAll();window.scrollTo(0,0);})();break;
    case'pDishOff':S.pDish=null;renderAll();break;
    case'ttkReady':S.ttkHome='ready';S.rdN=0;S.rdConfirm=false;renderAll();window.scrollTo(0,0);break;
    case'rdF':S.rdF=b.getAttribute('data-f')||'';S.rdN=0;S.rdConfirm=false;rdPaint();break;
    case'rdMore':S.rdN=(S.rdN||RD_PAGE)+RD_PAGE;rdPaint();break;
    case'rdOpen':mOpenCard(b.getAttribute('data-rid'));break;
    case'rdAcc':(function(){var rid=b.getAttribute('data-rid'),q=S.recipes[rid],sg=q&&outFromName(q.name);if(!sg||q.output>0)return;q.output=sg.v;queueSave('recipes',rid);rdPaint();flash('Выход «'+(q.name||'карты')+'»: '+dnum(sg.v,2)+' г');})();break;
    case'rdOutOk':(function(){var rid=b.getAttribute('data-rid'),q=S.recipes[rid];if(!q||!(q.output>0))return;
      q.ttk=q.ttk||{};q.ttk.outOk=String(q.output);q.ttk.outKind='portion';q.ttk.outLog=rdLog(q,'выход '+dnum(q.output,2)+' г подтверждён как выход одной порции');
      queueSave('recipes',rid);S.rdArm='';rdPaint();flash('Выход подтверждён: '+dnum(q.output,2)+' г');})();break;
    case'rdOutFix':(function(){var rid=b.getAttribute('data-rid'),k=b.getAttribute('data-k'),q=S.recipes[rid],v=Number(b.getAttribute('data-v'));if(!q||!(v>0))return;
      if(S.rdArm!==rid+':'+k){S.rdArm=rid+':'+k;rdPaint();return;}
      var was=q.output;q.output=v;q.ttk=q.ttk||{};q.ttk.outOk=String(v);q.ttk.outKind='portion';q.ttk.outLog=rdLog(q,'выход изменён с '+dnum(was,2)+' на '+dnum(v,2)+' г');
      queueSave('recipes',rid);S.rdArm='';rdPaint();flash('Выход «'+(q.name||'карты')+'»: было '+dnum(was,2)+' г, стало '+dnum(v,2)+' г');})();break;
    case'rdOutBatch':(function(){var rid=b.getAttribute('data-rid'),n=Number(b.getAttribute('data-n')),q=S.recipes[rid];if(!q||!(n>=2)||!(q.output>0))return;
      if(S.rdArm!==rid+':batch'){S.rdArm=rid+':batch';rdPaint();return;}
      var was=q.output;
      q.rows.forEach(function(x){
        if(x.net>0)x.net=Math.round(x.net/n*10000)/10000;
        if(x.gross>0)x.gross=Math.round(x.gross/n*10000)/10000;
        if(x.alts)x.alts.forEach(function(a){if(a.net>0)a.net=Math.round(a.net/n*10000)/10000;if(a.gross>0)a.gross=Math.round(a.gross/n*10000)/10000;});
      });
      q.output=Math.round(was/n*100)/100;q.ttk=q.ttk||{};q.ttk.outOk=String(q.output);q.ttk.outKind='portion';
      q.ttk.outLog=rdLog(q,'карта была записана на партию из '+n+' порций (выход '+dnum(was,2)+' г); состав и выход разделены на '+n+', выход одной порции '+dnum(q.output,2)+' г');
      queueSave('recipes',rid);S.rdArm='';rdPaint();flash('Карта пересчитана на 1 порцию: выход '+dnum(q.output,2)+' г');})();break;
    case'rdAccAll':S.rdConfirm=true;rdPaint();break;
    case'rdAccNo':S.rdConfirm=false;rdPaint();break;
    case'rdAccGo':(function(){var k=0;S.rdConfirm=false;Object.keys(S.recipes).forEach(function(rid){var q=S.recipes[rid],sg=!(q.output>0)&&!q.arch&&outFromName(q.name);if(sg){q.output=sg.v;queueSave('recipes',rid);k++;}});rdPaint();flash('Выход записан у '+k+' '+(k%10===1&&k%100!==11?'карты':'карт'));})();break;
    case'ttkMore':{var mn=$('#ttkMenu');if(mn){mn.hidden=!mn.hidden;b.setAttribute('aria-expanded',mn.hidden?'false':'true');}break;}
    case'dupRecipe':
      if(!r)break;id=newId();
      var cp=JSON.parse(JSON.stringify(r));cp.name=(r.name||'Блюдо')+' (копия)';cp.rows.forEach(function(x){x.rid=newId();});delete cp.qty;delete cp.aliases;delete cp.arch;
      S.recipes[id]=cp;setActive(id);queueSave('recipes',id);S.focusFk='rname';renderAll();break;
    case'delRecipe':
      if(!r)break;
      var pfu=pfUsedBy(S.active);
      arm(b,pfu.length?'Используется в '+pfu.length+' ТТК. Удалить?':'Удалить?',function(){
        var del=S.active;syForgetRec(del);removeDoc('recipes',del);
        var left=visIds();setActive(left[0]||null);renderAll();flash('Рецепт удалён');
      });break;
    case'addRow':
      if(!r)break;id=newId();r.rows.push({rid:id,ing:'',net:0,share:100});queueSave('recipes',S.active);S.focusFk='r:'+id+':ing';renderAll();break;
    case'addPfRow':
      if(!r)break;id=newId();r.rows.push({rid:id,ing:'',net:0,share:100});queueSave('recipes',S.active);S.pfOnly=id;S.focusFk='r:'+id+':ing';renderAll();break;
    case'pfOpen':
      if(b.getAttribute('data-id')&&S.recipes[b.getAttribute('data-id')])rvShow(b.getAttribute('data-id'));break;
    case'altAdd':case'altDel':
      if(!r)break;
      var arow=r.rows.filter(function(x){return x.rid===b.closest('[data-rid]').getAttribute('data-rid');})[0];if(!arow)break;
      if(act==='altAdd'){arow.alts=(arow.alts||[]);arow.alts.push({name:''});S.focusFk='al:'+arow.rid+':'+(arow.alts.length-1)+':n';}
      else{arow.alts.splice(Number(b.getAttribute('data-k')),1);if(!arow.alts.length)delete arow.alts;}
      queueSave('recipes',S.active);renderAll();break;
    case'delRow':
      if(!r)break;var rid=b.closest('[data-rid]').getAttribute('data-rid');
      r.rows=r.rows.filter(function(x){return x.rid!==rid;});queueSave('recipes',S.active);renderAll();break;
    case'copy':
      if(!r)break;var c=compute(r,S.ings);if(!c.per100)break;
      var v=b.getAttribute('data-which')==='100'?c.per100:c.portion;
      copyText([v.p,v.f,v.c].map(function(x){return x.toFixed(1).replace('.',',');}).concat(String(Math.round(v.k))).join('\t'),b);break;
    case'gotoBase':S.tab='base';renderAll();break;
    case'gotoCalc':S.tab='calc';S.ttkHome=true;renderAll();break;
    case'pickPrice':$('#priceFile').click();break;
    case'cLoad':doCloudLoad(b.getAttribute('data-k'));break;
    case'recsApply':doRecsApply();break;
    case'syFOpen':syFileOpen(b.getAttribute('data-id'));break;
    case'hdrDel':hdrPresetDel(Number(b.getAttribute('data-i')));renderAll();break;
    case'hdrOrig':(function(ctx,o,h){if(o&&h){HDR_KEYS.forEach(function(k){h[k]=String(o[k]||'');});S.focusFk='th:'+ctx+'org';renderAll();}})(b.getAttribute('data-ctx'),hdrOrigObj(b.getAttribute('data-ctx')),hdrObj(b.getAttribute('data-ctx')));break;
    case'dlHdrGo':syDlGo();break;
    case'dlLeMake':drDlLeMake();break;
    case'dlHdrRaw':(function(d){if(d){S.sy.dl=null;exportFile(new Uint8Array(d.buf),d.name);renderAll();}})(S.sy.dl);break;
    case'dlHdrNo':S.sy.dl=null;renderAll();break;
    case'lyGo':lyStart(b);break;
    case'syFReview':syFileOpen(b.getAttribute('data-id'),false,true);break;
    case'syFRework':S.sy.frow=b.getAttribute('data-id');S.sy.frn='';delete S.sy.msg.files;syFilesPaint();break;
    case'syFReworkNo':S.sy.frow='';S.sy.frn='';syFilesPaint();break;
    case'syFReworkGo':syFReworkGo();break;
    case'syFWithdraw':(function(wid){arm(b,'Снять с проверки?',function(){syFWithdraw(wid);});})(b.getAttribute('data-id'));break;
    case'syFDl':syFileOpen(b.getAttribute('data-id'),true);break;
    case'syFApprove':(function(fid){
      var ff=S.sy.files&&S.sy.files.files.filter(function(x){return x.id===fid;})[0];
      var tg=syTargetParse(ff?syWantDefault(ff):'|');
      syFileOp('fapprove',fid,'Принимаю','Принят файл',syOldScript()?null:syPlaceReq(tg.reg,tg.dir));
    })(b.getAttribute('data-id'));break;
    case'syFReject':syFileOp('freject',b.getAttribute('data-id'),'Отклоняю','Отклонён файл');break;
    case'syFRestore':(function(bid){arm(b,'Вернуть?',function(){syFileOp('frestore',bid,'Возвращаю','Возвращён на место файл');});})(b.getAttribute('data-id'));break;
    case'syFDel':(function(bid){arm(b,'Удалить?',function(){syFileOp('fdelete',bid,'Удаляю','Удалён файл');});})(b.getAttribute('data-id'));break;
    case'syFUp':$('#syUpFile').click();break;
    case'syFRefresh':syFilesLoad(true,true);break;
    case'syGoSync':S.tab='sync';renderAll();syOnOpen();window.scrollTo(0,0);break;
    case'syGoFiles':S.tab='cloud';renderAll();syFilesLoad(false);window.scrollTo(0,0);break;
    case'segTab':S.tab=b.getAttribute('data-tab')==='cloud'?'cloud':'calc';S.ttkHome=false;renderAll();syFilesLoad(false);window.scrollTo(0,0);break;
    case'pvTtk':if(!r)break;pvOpen(r);break;
    case'syGoPend':S.tab='cloud';S.sy.creg='pend';S.sy.cdir='all';S.sy.fq='';S.sy.fshow=SY_PAGE;renderAll();syFilesLoad(true,true);window.scrollTo(0,0);break;
    case'syFDir':S.sy.cdir=b.getAttribute('data-dir')||'all';S.sy.fshow=SY_PAGE;S.sy.fren=null;renderAll();window.scrollTo(0,0);break;
    case'syFReg':S.sy.creg=b.getAttribute('data-reg');S.sy.cin=true;S.sy.cdir='';S.sy.fshow=SY_PAGE;S.sy.fren=null;S.sy.fadm=false;renderAll();window.scrollTo(0,0);break;
    case'syFBack':(function(){
      var reg=syFReg();
      if(S.sy.cdir&&!syNorm(S.sy.fq)&&reg!=='pend'&&reg!=='arch'&&syRegDirs(reg).length)S.sy.cdir='';
      else{S.sy.cin=false;S.sy.creg=null;S.sy.cdir='';S.sy.fq='';}
      S.sy.fshow=SY_PAGE;S.sy.fren=null;S.sy.fadm=false;renderAll();window.scrollTo(0,0);
    })();break;
    case'syFQClear':S.sy.fq='';S.sy.fshow=SY_PAGE;renderAll();break;
    case'syFMore':S.sy.fshow=(Number(S.sy.fshow)||SY_PAGE)+SY_PAGE;syFilesPaint();break;
    case'syFDirAdd':syDirAdd();break;
    case'syFAdm':S.sy.fadm=!S.sy.fadm;S.focusFk=S.sy.fadm?'sy:fnew':null;renderAll();break;
    case'syFRen':(function(rd){S.sy.fren=rd;S.sy.frenv=syDirName(rd)||'';S.focusFk='sy:frenv';renderAll();})(syRealDir());break;
    case'syFRenOk':syDirRename();break;
    case'syFRenNo':S.sy.fren=null;renderAll();break;
    case'syFDirDel':(function(rd){arm(b,'Удалить папку?',function(){syDirOp('ddelete',{id:rd},'Удаляю папку…',function(r){return'Папка «'+(r.name||'')+'» удалена';},function(){S.sy.cdir='';S.sy.fren=null;});});})(syRealDir());break;
    case'syFSave':
      if(!r)break;
      var jb=syTtkJob(r);syFileSaveBuf(jb.name,jb.buf,'fsave',jb.tg,jb.rep);break;
    case'syFSaveLoaded':
      if(S.ttk&&S.ttk.buf)syFileSaveBuf(S.ttk.file,S.ttk.buf,'fload');break;
    case'syConnect':syConnect();break;
    case'syDisconnect':arm(b,'Отключить?',function(){syDisconnect();});break;
    case'syCopyGas':copyText(SY_GAS,b);break;
    case'syFirst':syMyCodeSave(true);break;
    case'syMyCode':syMyCodeSave(false);break;
    case'usAdd':usAdd();break;
    case'usCopy':copyText(usCopyText(),b);break;
    case'usMadeHide':S.sy.us.made=null;scheduleRender();break;
    case'usReset':arm(b,'Выдать новый?',function(){usOp('usrreset',{id:b.closest('[data-uid]').getAttribute('data-uid')}).then(function(r){var x=(S.sy.us.list||[]).filter(function(y){return y.id===b.closest('[data-uid]').getAttribute('data-uid');})[0]||{};if(r&&r.code){S.sy.us.made={name:x.name||'',role:x.role||'',code:r.code,own:true};scheduleRender();}});});break;
    case'usOff':usOp('usroff',{id:b.closest('[data-uid]').getAttribute('data-uid'),off:b.getAttribute('data-off')==='1'},b.getAttribute('data-off')==='1'?'Доступ отключён':'Доступ включён');break;
    case'usDel':arm(b,'Удалить?',function(){usOp('usrdel',{id:b.closest('[data-uid]').getAttribute('data-uid')},'Пользователь удалён');});break;
    case'syCopyPtr':copyText(S.sy.cfg.ptr,b);break;
    case'syPull':S.sy.plan=null;syPull(false);break;
    case'syUndel':{
      var uk=b.getAttribute('data-key')||'',ui=uk.indexOf('|~del~');
      if(ui>0)syUndel(uk.slice(0,ui),uk.slice(ui+6));
      break;}
    case'syGoneClear':S.sy.gone={};S.sy.del={};S.sy.cfg.rev=0;syPersist();S.sy.plan=null;syPull(false);break;
    case'syApply':syApply();break;
    case'syRetryLoad':syPull(true);break;
    case'syPlanCancel':S.sy.plan=null;S.sy.cmpOpen=undefined;renderAll();break;
    case'syCmpClose':S.sy.cmpOpen=false;renderAll();break;
    case'syCmpOpen':S.sy.cmpOpen=true;renderAll();setTimeout(function(){var d=$('#syPlan');if(d&&d.focus)d.focus();},0);break;
    case'incMore':(function(){var x=b.parentNode.querySelector('.incx'),o;if(!x)return;o=x.hidden;x.hidden=!o;b.setAttribute('aria-expanded',o?'true':'false');b.textContent=o?'Скрыть':'Почему это важно';})();break;
    case'syPropose':sySend(false);break;
    case'gmRetry':GM.err='';gmLoad(true);renderAll();break;
    case'gmF':GM.f=b.getAttribute('data-f')||'all';renderAll();break;
    case'gmXlsx':exportFile(xlsxPack([gmXlsxTable()]),'Меню'+(GM.f==='ds'?' (задекларированные)':'')+'.xlsx');break;
    case'gmLogin':S.tab='sync';renderAll();window.scrollTo(0,0);break;
    case'syCardSend':syCardSend(false);break;
    case'syCardPub':syCardSend(true);break;
    case'syOne':syOne(b.getAttribute('data-key'));break;
    case'syTake':(function(k){arm(b,'Вернуть общее?',function(){syTake([k]);});})(b.getAttribute('data-key'));break;
    case'syTakeSel':arm(b,'Вернуть у отмеченных?',function(){syTake(sySelected().map(sySelKey));});break;
    case'syPublish':sySend(true);break;
    case'syAll':
      var syOn=b.getAttribute('data-v')==='1';
      syDirtyUi().forEach(function(d0){if(syOn)delete S.sy.unsel[sySelKey(d0)];else S.sy.unsel[sySelKey(d0)]=1;});
      renderAll();break;
    case'syChooseAll':
      var syV=b.getAttribute('data-v');
      if(S.sy.plan)S.sy.plan.entries.forEach(function(e0){if(e0.state==='conflict')S.sy.choose[e0.kind+'|'+e0.sid]=syV;});
      renderAll();break;
    case'syApprove':syReview('approve',b.getAttribute('data-batch'),{});break;
    case'syRework':var syW=b.getAttribute('data-batch');syReview('rework',syW,{note:S.sy.rnote[syW]||''});break;
    case'rvOpen':rvOpen(b.getAttribute('data-batch'),b.getAttribute('data-sid'));break;
    case'rwOpen':rwOpen(b.getAttribute('data-batch'),b.getAttribute('data-sid'));break;
    case'rwDrop':rwDrop(b.getAttribute('data-batch'));break;
    case'syReject':var syB=b.getAttribute('data-batch');syReview('reject',syB,{note:S.sy.rnote[syB]||''});break;
    case'syRefresh':syRefresh(true);break;
    case'pfRun':pfRun(true,false);break;
    case'pfDl':pfDownload(b.getAttribute('data-id'),b.getAttribute('data-name'),b);break;
    case'pfCopy':copyText(b.getAttribute('data-url'),b);break;
    case'pfArch':pfArchLoad(b.getAttribute('data-reg'));break;
    case'syRevert':syRevert(Number(b.getAttribute('data-rev')));break;
    case'pubHistRestore':(function(i){arm(b,'Вернуть?',function(){syHistRestore(i);});})(Number(b.getAttribute('data-i')));break;
    case'pubDocRetry':syDocFlush(true);break;
    case'recsCancel':S.recs=null;renderAll();break;
    case'priceApply':doPriceApply();break;
    case'priceCancel':S.price=null;renderAll();break;
    case'priceAddAll':
      if(S.price)S.price.items.forEach(function(x){if(x.price!==null&&!x.ing){x.add=true;x.how='new';}});
      renderAll();break;
    case'dlOp1':if(!r)break;doDownloadOp1(r);break;
    case'dlTtk':if(!r)break;doDownloadTtk(r);break;
    case'tsAdd':
      if(!r)break;
      var tsa=ttkSubs(r),tsl=ttkRowList(r);
      tsa.push({n:'Итого:',m:'',a:tsl.length?tsl[tsl.length-1].rid:''});setSubs(r,tsa);renderAll();break;
    case'tsDel':
      if(!r)break;
      var tse=ttkSubs(r);tse.splice(Number(b.getAttribute('data-si')),1);setSubs(r,tse);renderAll();break;
    case'ttkResetTexts':
      if(!r)break;
      arm(b,'Сбросить?',function(){
        if(r.ttk)TT_TEXT_KEYS.concat(['look','color','texture','taste']).forEach(function(k){delete r.ttk[k];});
        queueSave('recipes',S.active);renderAll();flash('Тексты возвращены к стандартным');
      });break;
    case'pickTtk':S.ttkFor='';$('#ttkFile').click();break;
    case'jump':var jt=$('#'+b.getAttribute('data-to'));if(jt&&jt.scrollIntoView)jt.scrollIntoView({block:'start',behavior:'smooth'});break;
    case'ttkCreate':doTtkCreate(false);break;
    case'ttkCreateNew':doTtkCreate(true);break;
    case'ttkAlt':ttkAltPick(Number(b.getAttribute('data-i')),Number(b.getAttribute('data-k')));break;
    case'ttkCancel':(function(){var bk=S.ttk&&S.ttk.back;S.ttk=null;if(bk==='cloud'&&ttkCloudOn())S.tab='cloud';else if(bk==='home')S.ttkHome=true;renderAll();window.scrollTo(0,0);})();break;
    case'mFlt':S.mflt=b.getAttribute('data-f');renderAll();break;
    case'gpAsk':S.gpAsk='on';renderAll();break;
    case'gpAskOff':S.gpAsk='off';renderAll();break;
    case'gpCancel':S.gpAsk='';renderAll();break;
    case'gpOn':if(gpExp())break;gpEnable();break;
    case'gpOff':gpDisable();break;
    case'gpRetry':S.sy.gmErr='';gpFlush();renderAll();break;
    case'gpAll':case'gpNone':(function(on){
      var ids=menuItems().filter(function(it){return!on||it.m.price!==null;}).map(function(it){return it.id;}),n=gpMark(ids,on);
      flash(n?(on?'Отмечено блюд: ':'Снято отметок: ')+n:(on?'Все блюда региона с ценой уже отмечены':'Отметок в этом регионе нет'));
      renderAll();
    })(act==='gpAll');break;
    case'mtReset':
      (function(){var f=normFinance(S.cfg.finance||DEFAULT_FINANCE);delete f.tone;S.cfg.finance=normFinance(f);queueSave('settings','finance');S.mtOpen=true;renderAll();flash('Пороги цветов сброшены');})();
      break;
    case'mArch':case'mUnarch':
      id=b.closest('[data-rid]').getAttribute('data-rid');
      if(S.recipes[id]){
        var an=S.recipes[id].name||'Блюдо';
        setRecArch(id,act==='mArch');renderAll();
        flash('«'+an+(act==='mArch'?'» убрано в архив':'» возвращено в меню'));
      }break;
    case'rArch':
      if(!r)break;
      var on0=!r.arch;setRecArch(S.active,on0);renderAll();
      flash('«'+(r.name||'Блюдо')+(on0?'» убрано в архив: ТТК сохранена, в меню и ABC-анализе блюда больше нет':'» возвращено в меню'));break;
    case'mCatAdd':doCatAdd();break;
    case'mCatDrive':doCatDrive();break;
    case'mCatUp':case'mCatDown':
      var cl=ensureMenu(),ci=-1,cid=b.getAttribute('data-cat');
      cl.forEach(function(c,i){if(c.id===cid)ci=i;});
      var cj=act==='mCatUp'?ci-1:ci+1;
      if(ci>-1&&cj>=0&&cj<cl.length){var tmpc=cl[ci];cl[ci]=cl[cj];cl[cj]=tmpc;saveMenu();renderAll();}
      break;
    case'mCatDel':
      (function(cid2){
        arm(b,'Удалить?',function(){
          var cl2=ensureMenu(),k2=-1,nm2='',n2=0;
          cl2.forEach(function(c,i){if(c.id===cid2){k2=i;nm2=c.name;}});
          if(k2<0)return;
          cl2.splice(k2,1);saveMenu();
          Object.keys(S.recipes).forEach(function(rid){if(S.recipes[rid].cat===cid2){delete S.recipes[rid].cat;queueSave('recipes',rid);n2++;}});
          if(S.mmove===cid2)S.mmove='';
          renderAll();flash('Папка «'+nm2+'» удалена'+(n2?', блюд без папки: '+n2:''));
        });
      })(b.getAttribute('data-cat'));break;
    case'mMergeGo':
      (function(){
        var mg=S.mmerge||{};
        if(!mg.from||!mg.to||mg.from===mg.to||!catById(mg.from)||!catById(mg.to)){flash('Выберите две разные папки');return;}
        arm(b,'Точно объединить?',function(){
          var f=catById(mg.from),to=catById(mg.to),cl=ensureMenu(),n=0,k=-1;
          if(!f||!to)return;
          Object.keys(S.recipes).forEach(function(rid){if(S.recipes[rid].cat===f.id){S.recipes[rid].cat=to.id;queueSave('recipes',rid);n++;}});
          cl.forEach(function(c,i){if(c.id===f.id)k=i;});
          if(k>-1)cl.splice(k,1);
          saveMenu();S.mmerge={};if(S.mmove===f.id)S.mmove='';
          renderAll();flash('Папка «'+f.name+'» объединена с «'+to.name+'», блюд перенесено: '+n);
        });
      })();break;
    case'mMove':
      var mv=menuVisible(menuItems()),sel0=$('#mMoveSel'),tg=sel0?sel0.value:'';
      if(!mv.length){flash('Нет блюд для переноса');break;}
      arm(b,'Перенести '+mv.length+'?',function(){
        mv.forEach(function(it){setRecCat(it.id,tg);});
        S.mmove=tg;renderAll();
        flash('Перенесено блюд: '+mv.length+(tg&&catById(tg)?' в папку «'+catById(tg).name+'»':': без папки'));
      });break;
    case'mOpen':
      id=b.closest('[data-rid]').getAttribute('data-rid');
      if(S.recipes[id]){
        if(syChef()){chefOpenTtk(id);break;}
        if(syLimited()){setActive(id);S.tab='op1';renderAll();window.scrollTo(0,0);break;}
        mOpenCard(id);
      }break;
    case'cabSeg':S.cabSeg=b.getAttribute('data-s')||'tasks';renderAll();window.scrollTo(0,0);break;
    case'hmGo':S.tab=b.getAttribute('data-t')||'menu';if(b.getAttribute('data-s'))S.cabSeg=b.getAttribute('data-s');if(!tabOk(S.tab))S.tab='menu';renderAll();window.scrollTo(0,0);break;
    case'hmFilter':S.tab='menu';S.mflt=b.getAttribute('data-f')||'all';renderAll();window.scrollTo(0,0);break;
    case'mView':
      id=b.closest('[data-rid]').getAttribute('data-rid');
      if(S.recipes[id])tvOpen(id,b);
      break;
    case'mDl':
      id=b.closest('[data-rid]').getAttribute('data-rid');
      if(S.recipes[id]&&!syChef()){
        try{if(syLimited())doDownloadOp1(S.recipes[id]);else doDownloadTtk(S.recipes[id]);}catch(e){flash('Не удалось собрать документ');}
      }break;
    case'aMode':abPrefs().m=b.getAttribute('data-m')==='raw'?'raw':'dish';abSavePrefs();S.aflt='all';renderAll();break;
    case'aFlt':S.aflt=b.getAttribute('data-f');abRefresh();break;
    case'aParse':
      var abta=$('#abText');
      if(!abta||!abta.value.trim()){flash('Вставьте таблицу: название блюда и количество порций');break;}
      startSales(parseRecords(abta.value),'вставленный текст');break;
    case'aPickSales':$('#salesFile').click();break;
    case'aApply':doSalesApply();break;
    case'aCancel':S.sales=null;renderAll();break;
    case'aClear':arm(b,'Очистить?',doSalesClear);break;
    case'dlAbc':exportFile(toCsv(abRows()),abFileName()+'.csv');break;
    case'cpAbc':copyText(toTsv(abRows()),b);break;
    case'dlMenuX':if(!guestOn())exportFile(xlsxPack([menuXlsxTable()]),'Меню и финансы'+regSuffix()+'.xlsx');break;
    case'dlBase':exportFile(toCsv(baseRows()),'КБЖУ сырья, база'+(regionList().length>1?' ('+safeName(regionName(curRegion()))+')':'')+'.csv');break;
    case'cpBase':copyText(toTsv(baseRows()),b);break;
    case'dlRecipe':if(!r)break;exportFile(toCsv(recipeRows(r,compute(r,S.ings))),'КБЖУ, '+safeName(r.name)+'.csv');break;
    case'cpRecipe':if(!r)break;copyText(toTsv(recipeRows(r,compute(r,S.ings))),b);break;
    case'iZero':
      (function(){var row=b.closest('.irow'),iid=row&&row.getAttribute('data-iid'),ig=iid&&S.ings[iid];if(!ig)return;
        ig.kind='table';if(!String(ig.source||'').trim()||/^Добавлено из/.test(ig.source))ig.source='Нулевое КБЖУ подтверждено вручную';
        queueSave('ingredients',iid);renderAll();flash('«'+(ig.name||'Сырьё')+'»: ноль признан настоящим, в расчёте карт это уже не «не заполнено»');})();break;
    case'iMore':
      id=b.closest('.irow').getAttribute('data-iid');LOSSUI.more[id]=!LOSSUI.more[id];refreshIngList();break;
    case'newIng':
      id=newId();S.ings[id]={name:'',p:0,f:0,c:0,kind:'estimate',source:''};LOSSUI.auto[id]=1;
      S.q='';S.onlyEst=false;S.onlyUnk=false;S.pnoprice=false;S.catF='';queueSave('ingredients',id);S.focusFk='i:'+id+':name';renderAll();break;
    case'delIng':
      id=b.closest('.irow').getAttribute('data-iid');
      var used=usedIn(id);
      if(used.length){flash('Сырьё используется в рецептах: '+used.slice(0,3).join(', ')+(used.length>3?'…':'')+'. Сначала уберите его из рецептов.');break;}
      arm(b,'Удалить?',function(){syForgetIng(id);removeDoc('ingredients',id);renderAll();});break;
    case'filterAll':S.onlyEst=false;S.onlyUnk=false;S.pnoprice=false;renderAll();break;
    case'filterEst':S.onlyEst=true;S.onlyUnk=false;S.pnoprice=false;renderAll();break;
    case'filterUnk':S.onlyUnk=true;S.onlyEst=false;S.pnoprice=false;renderAll();break;
    case'filterNoPrice':S.pnoprice=true;S.onlyEst=false;S.onlyUnk=false;renderAll();break;
    case'openImport':S.importOpen=true;renderAll();break;
    case'closeImport':S.importOpen=false;renderAll();break;
    case'doImport':doImport();break;
    case'rgAdd':
      var gl=ensureRegions();
      if(gl.length>=8)break;
      var gid='r'+uid().replace(/[^a-z0-9]/g,'').slice(0,12);
      gl.push({id:gid,name:'Новый регион'});S.rgOpen=true;S.focusFk='rg:'+gid;saveRegions();renderAll();var ni=$('[data-fk="rg:'+gid+'"]');if(ni&&ni.select)ni.select();break;
    case'rgDel':
      var rgid=b.closest('.rgrow').getAttribute('data-rg');
      arm(b,'Удалить?',function(){
        var l2=ensureRegions(),k;
        for(k=0;k<l2.length;k++)if(l2[k].id===rgid){l2.splice(k,1);break;}
        Object.keys(S.ings).forEach(function(iid){var ig=S.ings[iid];if(ig.px&&ig.px[rgid]){delete ig.px[rgid];if(!Object.keys(ig.px).length)delete ig.px;queueSave('ingredients',iid);}});
        Object.keys(S.recipes).forEach(function(rid2){var rr=S.recipes[rid2],ch2=false;['sell','qty'].forEach(function(fk){if(rr[fk]&&rr[fk][rgid]){delete rr[fk][rgid];if(!Object.keys(rr[fk]).length)delete rr[fk];ch2=true;}});if(rr.reg===rgid){delete rr.reg;ch2=true;}if(ch2)queueSave('recipes',rid2);});
        if(S.region===rgid)setRegion(MAIN);
        S.rgOpen=true;saveRegions();renderAll();flash('Регион удалён');
      });break;
  }
}
function onInput(e){
  var t=e.target,act=t.getAttribute('data-act');if(!act||t.tagName==='BUTTON')return;
  if(p1cInput(act,t))return;
  if(wpInput(act,t))return;
  if(tbInput(act,t))return;
  if(aiInput(act,t))return;
  if(drInput(act,t))return;
  if(revInput(act,t))return;
  var r=curRecipe(),p,row,ing,el;
  switch(act){
    case'syFQ':S.sy.fq=t.value;S.sy.fshow=SY_PAGE;syFilesPaint();return;
    case'rdQ':S.rdQ=t.value;S.rdN=0;rdPaint();return;
    case'syFNew':S.sy.fnew=t.value;return;
    case'syFRN':S.sy.frn=t.value;return;
    case'syFRenV':S.sy.frenv=t.value;return;
    case'hdrIn':(function(o){if(o)o[t.getAttribute('data-k')]=t.value;})(hdrObj(t.getAttribute('data-ctx')));return;
    case'ttkOut':p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);if(S.ttk)S.ttk.output=p.v;return;
    case'tsName':case'tsMass':
      var tsi=Number(t.closest('.tsr').getAttribute('data-si')),tsb=ttkSubs(r);if(!tsb[tsi])return;
      if(act==='tsName')tsb[tsi].n=t.value.slice(0,120);
      else{p=parseNum(t.value);t.classList.toggle('invalid',!p.ok&&!p.empty);if(!p.ok&&!p.empty)return;tsb[tsi].m=t.value.trim().slice(0,20);}
      setSubs(r,tsb);ttkLive(r);return;
    case'ttf':
      var tk=t.getAttribute('data-k');
      if(tk==='tol'||tk==='main'||tk==='semiMass'){p=parseNum(t.value);t.classList.toggle('invalid',!p.ok&&!p.empty);}
      setTtk(r,tk,t.value);ttkLive(r);return;
    case'mMoveSel':S.mmove=t.value;return;
    case'sxTarget':if(S.sx){S.sx.pt=t.value;S.sx.m=sxMatch(S.sx.items,S.sx.g,S.sx.pt);renderAll();}return;
    case'mQ':S.mq=t.value;$('#mList').innerHTML=mListHtml();if(uiRO())$$('#mList [data-edit]').forEach(function(x){x.disabled=true;});return;
    case'mPrice':
      el=t.closest('.mrow');var mid=el.getAttribute('data-rid'),mr=S.recipes[mid];if(!mr)return;
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);
      if(!p.ok)return;
      setSellCtx(mr,p.empty?null:p.v);queueSave('recipes',mid);menuRefresh();return;
    case'mMk':case'mMg':
      el=t.closest('.mrow');var mid2=el.getAttribute('data-rid'),mr2=S.recipes[mid2];if(!mr2)return;
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);
      if(!p.ok||p.empty)return;
      var m0=finOf(mr2),np=priceFor(m0.cost,act==='mMk'?'markup':'margin',p.v,curFin().round);
      if(np===null){t.classList.add('invalid');return;}
      setSellCtx(mr2,np);queueSave('recipes',mid2);menuRefresh();return;
    case'cUrl':cloudSet(t.getAttribute('data-k'),t.value.trim());S.cloudUrlNote=false;return;
    case'syNc':return;
    case'usF':S.sy.us.f[t.getAttribute('data-k')]=t.type==='checkbox'?t.checked:t.value;return;
    case'syF':if(t.getAttribute('data-k')==='url'){S.sy.addr=t.value.trim();return;}S.sy.cfg[t.getAttribute('data-k')]=t.getAttribute('data-k')==='name'?t.value:t.value.trim();syPersist();return;
    case'syNote':S.sy.note=t.value;return;
    case'syCNote':S.sy.cnote=t.value;return;
    case'gmQ':GM.q=t.value;gmPaint();return;
    case'syRN':S.sy.rnote[t.getAttribute('data-batch')]=t.value;return;
    case'aQ':S.aq=t.value;var abl=$('#abList');if(abl)abl.innerHTML=abListHtml(S.abD||abData());return;
    case'aQty':
      el=t.closest('.srow');var qid=el.getAttribute('data-rid'),qr=S.recipes[qid];if(!qr)return;
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);
      if(!p.ok)return;
      var qg=curRegion();
      if(p.empty||!(p.v>0)){if(qr.qty){delete qr.qty[qg];if(!Object.keys(qr.qty).length)delete qr.qty;}}
      else{if(!qr.qty)qr.qty={};qr.qty[qg]=p.v;}
      queueSave('recipes',qid);abRefresh();return;
    case'abPeriod':setAbc('period',t.value);var abs=$('#abSub');if(abs)abs.innerHTML=abSubText();return;
    case'mtSet':
      (function(){
        var k=t.getAttribute('data-k'),good=k.charAt(2)==='O',pk=k.slice(0,2)+(good?'B':'O'),pn=parseNum(t.value),c=toneCfg(),pv,ok;
        if(pn.empty){setTone(k,null);t.classList.remove('invalid');menuRefresh();return;}
        pv=k.charAt(0)==='p'?(good?toneBounds(c).b:toneBounds(c).o):c[pk];
        ok=pn.ok&&pn.v<100000;
        if(ok&&pv!==null&&pv!==undefined){
          if(k.charAt(0)==='f')ok=good?pn.v<=pv+1e-9:pn.v>=pv-1e-9;     /* сырьё: «хорошо до» не выше «плохо выше» */
          else ok=good?pn.v>=pv-1e-9:pn.v<=pv+1e-9;                       /* наценка, маржа, прибыль: «хорошо от» не ниже «плохо ниже» */
        }
        t.classList.toggle('invalid',!ok);
        if(!ok)return;
        setTone(k,pn.v);menuRefresh();
      })();
      return;
    case'abA':case'abB':
      p=parseNum(t.value);
      var abc0=curAbc(),abok=p.ok&&!p.empty&&(act==='abA'?(p.v>0&&p.v<abc0.b):(p.v>abc0.a&&p.v<=100));
      t.classList.toggle('invalid',!abok);
      if(!abok)return;
      setAbc(act==='abA'?'a':'b',p.v);abRefresh();return;
    case'rgName':
      var rgi=t.closest('.rgrow').getAttribute('data-rg'),gl2=ensureRegions();
      gl2.forEach(function(g){if(g.id===rgi)g.name=t.value.slice(0,60);});
      saveRegions();return;
    case'pPrice':case'pPack':
      el=t.closest('[data-iid]');var pid=el.getAttribute('data-iid');ing=S.ings[pid];if(!ing)return;
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok&&!p.empty);
      var rg0=curRegion(),rec=recFor(ing,rg0,true);
      if(act==='pPrice'){if(p.empty)delete rec.price;else if(p.ok)rec.price=p.v;}
      else{if(p.empty||p.v<=0)delete rec.packG;else if(p.ok)rec.packG=p.v;}
      pruneRec(ing,rg0);
      var po=el.querySelector('[data-out="pk"]');if(po)po.textContent=priceInfoHtml(pid);
      el.classList.toggle('nop',pricePerKg(ing,rg0)===null);
      var pc=$('#pchips');if(pc){var pbs=pBatches();pc.innerHTML=pchipsHtml(pbs,phIndex(pbs));}
      queueSave('ingredients',pid);return;
    case'opf':
      var ok2=t.getAttribute('data-k');
      if(ok2==='markup'){p=parseNum(t.value);t.classList.toggle('invalid',!p.ok&&!p.empty);}
      setOp(r,ok2,t.value);opLive(r);return;
    case'tName':
      row=r.rows.filter(function(x){return x.rid===t.closest('.trw').getAttribute('data-rid');})[0];if(!row)return;
      if(t.value.trim())row.tname=t.value;else delete row.tname;
      queueSave('recipes',S.active);return;
    case'altName':case'altGross':case'altNet':
      row=r.rows.filter(function(x){return x.rid===t.closest('.trw').getAttribute('data-rid');})[0];
      var av=row&&row.alts&&row.alts[Number(t.getAttribute('data-k'))];if(!av)return;
      if(act==='altName')av.name=t.value;
      else{p=parseNum(t.value);t.classList.toggle('invalid',!p.ok&&!p.empty);var ak=act==='altGross'?'gross':'net';if(p.empty)delete av[ak];else if(p.ok)av[ak]=p.v;}
      queueSave('recipes',S.active);return;
    case'tGross':
      row=r.rows.filter(function(x){return x.rid===t.closest('.trw').getAttribute('data-rid');})[0];if(!row)return;
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok&&!p.empty);
      if(S.gr)delete S.gr[row.rid];
      if(p.empty)delete row.gross;else if(p.ok)row.gross=p.v;
      netFromGross(row);
      queueSave('recipes',S.active);updateCalc();return;
    case'search':S.q=t.value;$('#ingList').innerHTML=ingListHtml();if(uiRO())$$('#ingList [data-edit]').forEach(function(x){x.disabled=true;});return;
    case'rName':r.name=t.value;queueSave('recipes',S.active);var o=$('#recipeSel option:checked');if(o)o.textContent=t.value||'Без названия';updateCalc();return;
    case'rOut':p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);r.output=p.v;queueSave('recipes',S.active);updateCalc();return;
    case'rowNet':case'rowShare':
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);
      row=r.rows.filter(function(x){return x.rid===t.closest('[data-rid]').getAttribute('data-rid');})[0];if(!row)return;
      if(act==='rowNet'){
        if(S.na)delete S.na[row.rid];      /* нетто вписано руками: за брутто больше не следует */
        /* заданное брутто следует за нетто в той же пропорции, чтобы себестоимость не оставалась на старой массе */
        var gr=S.gr||(S.gr={}),ex=(row.gross!==undefined&&row.gross!==null&&row.gross>0&&row.net>0)?row.gross/row.net:null;
        if(gr[row.rid]===undefined&&ex!==null)gr[row.rid]=ex;
        if(gr[row.rid]>0&&p.ok&&!p.empty&&p.v>0&&row.gross!==undefined&&row.gross!==null)row.gross=Math.round(p.v*gr[row.rid]*1000)/1000;
        row.net=p.v;
      }else row.share=p.v;
      queueSave('recipes',S.active);updateCalc();return;
    case'refLabel':r.ref.label=t.value;queueSave('recipes',S.active);updateCalc();return;
    case'refP':case'refF':case'refC':case'refK':case'refTol':
      p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);
      var key={refP:'p',refF:'f',refC:'c',refK:'kcal',refTol:'tol'}[act];
      r.ref[key]=(p.empty&&key!=='tol')?null:p.v;
      queueSave('recipes',S.active);updateCalc();return;
    case'iName':case'iP':case'iF':case'iC':case'iSrc':
      el=t.closest('.irow');var iid=el.getAttribute('data-iid');ing=S.ings[iid];if(!ing)return;
      if(act==='iName')ing.name=t.value;
      else if(act==='iSrc')ing.source=t.value;
      else{p=parseNum(t.value);t.classList.toggle('invalid',!p.ok);ing[{iP:'p',iF:'f',iC:'c'}[act]]=p.v;
        var kk=el.querySelector('[data-out="k"]');if(kk){kk.textContent=kUnknown(ing)?'—':fmt(KCAL_P*ing.p+KCAL_F*ing.f+KCAL_C*ing.c,0);kk.title=kUnknown(ing)?'КБЖУ не заполнено':'';}
        el.classList.toggle('unk',kUnknown(ing));}
      queueSave('ingredients',iid);return;
    case'iLoss':
      el=t.closest('.irow');iid=el.getAttribute('data-iid');ing=S.ings[iid];if(!ing)return;
      var lv=null,lk=t.getAttribute('data-k');
      if(String(t.value).trim()===''){t.classList.remove('invalid');}
      else{p=parseNum(t.value);if(!(p.ok&&p.v>=0&&p.v<100)){t.classList.add('invalid');return;}t.classList.remove('invalid');lv=p.v;}
      ing.loss=ing.loss||{cold:null,boil:null,fry:null,stew:null,bake:null};
      ing.loss[lk]=lv;
      if(!lossAny(ing.loss))delete ing.loss;
      delete LOSSUI.auto[iid];
      queueSave('ingredients',iid);return;
  }
}
function onChange(e){
  var t=e.target,act=t.getAttribute('data-act');if(!act)return;
  if(p1cChange(act,t))return;
  if(specChange(act,t))return;
  if(wpChange(act,t))return;
  if(fcChange(act,t))return;
  if(dsChange(act,t))return;
  if(tbChange(act,t))return;
  if(bulkChange(act,t))return;
  if(aiChange(act,t))return;
  if(drChange(act,t))return;
  if(revChange(act,t))return;
  if(bkChange(act,t))return;
  var r=curRecipe();
  switch(act){
    case'syFMove':(function(tg){syFileOp('fmove',t.getAttribute('data-id'),'Переношу','Перенесён файл',syPlaceReq(tg.reg,tg.dir));})(syTargetParse(t.value));break;
    case'syFWant':S.sy.fwant[t.getAttribute('data-id')]=t.value;break;
    case'pickRecipe':if(!t.value)break;setActive(t.value);S.ttkHome=false;renderAll();break;
    case'rdOut':(function(){var rid=t.getAttribute('data-rid'),q=S.recipes[rid],pv=parseNum(t.value);if(!q||pv.empty)return;
      if(!pv.ok||!(pv.v>0)){t.classList.add('invalid');flash('Выход — число больше нуля');return;}
      q.output=pv.v;queueSave('recipes',rid);rdPaint();flash('Выход «'+(q.name||'карты')+'»: '+dnum(pv.v,2)+' г');})();break;
    case'calcCat':{
      S.calcCat=t.value;
      var vl=visIds().filter(function(id){return!S.recipes[id].arch;});
      if(S.calcCat){var lf=vl.filter(function(id){return S.calcCat==='__none__'?!(S.recipes[id].cat&&catById(S.recipes[id].cat)):S.recipes[id].cat===S.calcCat;});if(lf.length&&lf.indexOf(S.active)<0)setActive(lf[0]);}
      renderAll();break;
    }
    case'gpTog':(function(){
      var rid=t.closest('[data-rid]').getAttribute('data-rid');
      if(!gpMark([rid],t.checked))t.checked=!t.checked;
      S.focusFk=t.getAttribute('data-fk');renderAll();
    })();break;
    case'mCat':
      var mid=t.closest('[data-rid]').getAttribute('data-rid');
      setRecCat(mid,t.value);renderAll();
      flash(t.value&&catById(t.value)?'Блюдо перенесено в папку «'+catById(t.value).name+'»':'Блюдо перенесено: без папки');break;
    case'rCat':
      if(!r)break;
      setRecCat(S.active,t.value);renderAll();break;
    case'rPf':
      if(!r)break;
      if(t.checked)r.pf=true;else delete r.pf;
      queueSave('recipes',S.active);break;
    case'mCatName':
      var cn=catById(t.getAttribute('data-cat'));if(!cn)break;
      var nn2=t.value.replace(/\s+/g,' ').trim().slice(0,60);
      if(!nn2||catNameTaken(nn2,cn.id)){flash(!nn2?'Название папки не может быть пустым':'Папка с таким названием уже есть');t.value=cn.name;break;}
      if(nn2!==cn.name){cn.name=nn2;saveMenu();renderAll();}break;
    case'mMoveSel':S.mmove=t.value;break;
    case'mMergeFrom':S.mmerge=S.mmerge||{};S.mmerge.from=t.value;if(S.mmerge.to===t.value)S.mmerge.to='';S.mfOpen=true;renderAll();break;
    case'mMergeTo':S.mmerge=S.mmerge||{};S.mmerge.to=t.value;break;
    case'hdrPick':(function(ctx,i){var ps=hdrPresets(),h=hdrObj(ctx);if(h&&ps[i]){h.org=ps[i].org;h.head=ps[i].head;h.headName=ps[i].headName;S.focusFk='th:'+ctx+'org';renderAll();}})(t.getAttribute('data-ctx'),t.value===''?-1:Number(t.value));break;
    case'ttkReg':
      if(S.ttk){S.ttk.reg=(t.value&&regKnown(t.value))?t.value:'';S.ttk.sameId=findSameRecipe(S.ttk,S.ttk.reg);renderAll();}
      break;
    case'rReg':
      if(!r)break;
      var rg0=(t.value&&regKnown(t.value))?t.value:'';
      if(rg0)r.reg=rg0;else delete r.reg;
      if(rg0){var nk0=normKey(r.name);if(nk0&&Object.keys(S.recipes).some(function(i2){return i2!==S.active&&normKey(S.recipes[i2].name)===nk0;}))r.name=recBase(r)+' · '+regionName(rg0);}
      queueSave('recipes',S.active);
      if(rg0&&rg0!==curRegion())setRegion(rg0);
      renderAll();
      flash(rg0?'ТТК привязана к региону «'+regionName(rg0)+'»':'ТТК действует во всех регионах');
      break;
    case'cAuto':cloudSet('auto',t.checked?true:'');break;
    case'syAuto':S.sy.cfg.auto=!!t.checked;syPersist();break;
    case'pubDocs':S.sy.cfg.pubDocs=!!t.checked;syPersist();syStripUpdate();break;
    case'pubAuto':
      S.sy.cfg.pubAuto=!!t.checked;S.sy.pt={};S.sy.pubHold={};syPersist();clearTimeout(syPubT);syPubT=null;syPubFirst=0;
      if(t.checked)flash('Дальше правки карт будут уходить всем сами через минуту. Что было неопубликовано до этого, остаётся в «Моих изменениях».');
      renderAll();break;
    case'iName':lossAutoName(t.closest('.irow').getAttribute('data-iid'));break;
    case'pfAuto':S.sy.cfg.pfAuto=!!t.checked;syPersist();if(t.checked)pfSchedule(3000);else clearTimeout(pfTimer);break;
    case'sySel':
      var syK=t.getAttribute('data-key');
      if(t.checked)delete S.sy.unsel[syK];else S.sy.unsel[syK]=1;
      syRefreshSendUi();break;
    case'syChoose':S.sy.choose[t.getAttribute('data-key')]=t.value;scheduleRender();break;
    case'mxKeep':case'mxAdd':case'mxPrice':mxChange(act,t);break;
    case'mgFind':{
      var mfi=t.getAttribute('data-id'),mft=mgFindId(t.value,mfi);
      if(!t.value.trim())break;
      if(!mft){flash('Такого сырья в базе нет. Выберите название из подсказки.');break;}
      mg().sel[mfi]=mft;mg().ask=0;mgPaint();break;
    }
    case'mgPick':{mg().sel[t.getAttribute('data-id')]=t.value;mg().ask=0;var mgk=mgSelCount(),mgb=$('#mgBox [data-act="mgGo"]');if(mgb){mgb.textContent=mgGoLabel(mgk);mgb.disabled=!mgk||mg().busy;}break;}
    case'usF':S.sy.us.f[t.getAttribute('data-k')]=t.type==='checkbox'?t.checked:t.value;break;
    case'usRgChk':usRgToggle(t);break;
    case'usRole':usOp('usrrole',{id:t.closest('[data-uid]').getAttribute('data-uid'),role:t.value},'Права изменены');break;
    case'gmReg':GM.reg=t.value;lsSet('kbzhu:region',t.value);renderAll();break;
    case'recsIng':
      var ri=Number(t.closest('.trow').getAttribute('data-i')),rx=S.recs&&S.recs.items[ri];if(!rx)return;
      rx.ing=t.value;rx.how=(t.value&&t.value!=='__new__')?'manual':(t.value?'new':'none');rx.remember=!!t.value&&t.value!=='__new__';
      S.focusFk='rs:'+ri;renderAll();break;
    case'recsRem':
      var ri2=Number(t.closest('.trow').getAttribute('data-i'));if(S.recs&&S.recs.items[ri2])S.recs.items[ri2].remember=t.checked;break;
    case'mSort':S.msort=t.value;S.focusFk='msort';renderAll();break;
    case'aMetric':
      var abp=abPrefs();
      if(abp.m==='raw')abp.rm=t.value==='kg'?'kg':'cost';else abp.dm=['rev','profit','qty'].indexOf(t.value)>-1?t.value:'rev';
      abSavePrefs();S.aflt='all';S.focusFk='a:metric';renderAll();break;
    case'abA':case'abB':t.value=toInput(curAbc()[act==='abA'?'a':'b']);t.classList.remove('invalid');break;
    case'mtSet':t.value=toneInputVal(t.getAttribute('data-k'));t.classList.remove('invalid');break;
    case'salesRec':
      var si=Number(t.closest('.trow').getAttribute('data-i')),sx=S.sales&&S.sales.items[si];if(!sx)return;
      sx.rec=t.value;sx.how=t.value?'manual':'none';sx.remember=!!t.value;S.focusFk='sr:'+si;renderAll();break;
    case'salesRem':
      var si2=Number(t.closest('.trow').getAttribute('data-i'));if(S.sales&&S.sales.items[si2])S.sales.items[si2].remember=t.checked;break;
    case'salesClear':if(S.sales){S.sales.clear=t.checked;S.focusFk='sales:clear';renderAll();}break;
    case'mMk':case'mPrice':case'mMg':
      var mrow=t.closest('.mrow');if(mrow)mFill(mrow,true);break;
    case'priceIng':
      var pi=Number(t.closest('.trow').getAttribute('data-i')),px=S.price&&S.price.items[pi];if(!px)return;
      if(t.value==='__new__'){px.ing='';px.add=true;px.how='new';px.remember=false;}
      else{px.ing=t.value;px.add=false;px.how=t.value?'manual':'none';px.remember=!!t.value;}
      S.focusFk='pi:'+pi;renderAll();break;
    case'priceRem':
      var pi2=Number(t.closest('.trow').getAttribute('data-i'));if(S.price&&S.price.items[pi2])S.price.items[pi2].remember=t.checked;break;
    case'pUnit':
      var pid2=t.closest('[data-iid]').getAttribute('data-iid'),ig=S.ings[pid2];if(!ig)return;
      var rg1=curRegion(),rec1=recFor(ig,rg1,true);
      if(t.value==='pack')rec1.priceUnit='pack';else delete rec1.priceUnit;
      pruneRec(ig,rg1);
      queueSave('ingredients',pid2);S.focusFk=t.value==='pack'?'i:'+pid2+':pack':t.getAttribute('data-fk');renderAll();break;
    case'opSel':if(!r)return;setOp(r,t.getAttribute('data-k'),t.value);S.focusFk=t.getAttribute('data-fk');renderAll();break;
    case'tsAt':
      if(!r)return;
      var tsc=Number(t.closest('.tsr').getAttribute('data-si')),tsd=ttkSubs(r);
      if(tsd[tsc]){tsd[tsc].a=t.value;setSubs(r,tsd);}
      S.focusFk=t.getAttribute('data-fk');renderAll();break;
    case'ttfSel':if(!r)return;setTtk(r,t.getAttribute('data-k'),t.value);S.focusFk=t.getAttribute('data-fk');renderAll();break;
    case'refBasis':r.ref.basis=t.value==='portion'?'portion':'100';queueSave('recipes',S.active);updateCalc();break;
    case'ttkRem':
      var ti2=Number(t.closest('.trow').getAttribute('data-i'));if(S.ttk&&S.ttk.rows[ti2])S.ttk.rows[ti2].remember=t.checked;break;
    case'impFile':
      var fl=t.files&&t.files[0];if(!fl)return;
      readTextFile(fl,function(err,text){
        var ta2=$('#impText'),msg=$('#importMsg');
        if(err||!ta2){flash('Не удалось прочитать файл');return;}
        ta2.value=text;
        S.importMsg='Файл «'+fl.name+'» прочитан, строк: '+parseRecords(text).length+'. Проверьте текст и нажмите «Добавить в базу».';
        if(msg)msg.textContent=S.importMsg;
        try{t.value='';}catch(e3){}
      });break;
    case'catFilter':S.catF=t.value;refreshIngList();break;
    case'iCat':
      var ci=t.closest('.irow').getAttribute('data-iid');
      if(t.value==='__new__'){S.catNew=ci;refreshIngList();var cni=$('[data-fk="i:'+ci+':cat"]');if(cni)cni.focus();break;}
      setIngCat(ci,t.value);refreshIngList();flash('Сырьё перенесено в раздел «'+ingCat(S.ings[ci])+'»');break;
    case'iCatNew':
      var cj=t.closest('.irow').getAttribute('data-iid'),cv=t.value.trim();
      S.catNew=null;if(cv){setIngCat(cj,cv);flash('Сырьё перенесено в раздел «'+ingCat(S.ings[cj])+'»');}
      refreshIngList();break;
    case'iKind':
      var iid=t.closest('.irow').getAttribute('data-iid');S.ings[iid].kind=t.value;t.setAttribute('data-kind',t.value);
      queueSave('ingredients',iid);var ch=$('#chips');if(ch)ch.innerHTML=chipsHtml();break;
  }
}

