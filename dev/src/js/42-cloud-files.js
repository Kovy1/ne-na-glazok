/* ---------- файлы ТТК в облаке (Google Диск через тот же скрипт) ---------- */
function fileSizeText(n){n=Number(n)||0;return n>=1048576?(Math.round(n/104857.6)/10+' МБ').replace('.',','):Math.max(1,Math.round(n/1024))+' КБ';}
function bufToB64(buf){
  var u=buf instanceof Uint8Array?buf:new Uint8Array(buf),s='',i,ch=0x8000;
  for(i=0;i<u.length;i+=ch)s+=String.fromCharCode.apply(null,u.subarray(i,i+ch));
  return btoa(s);
}
function b64ToBuf(b64){
  var s=atob(String(b64||'').replace(/\s+/g,'')),u=new Uint8Array(s.length),i;
  for(i=0;i<s.length;i++)u[i]=s.charCodeAt(i);
  return u.buffer;
}
function syCode(){return S.sy.cfg.code;}
function readBuf(file){
  return new Promise(function(res,rej){var fr=new FileReader();fr.onerror=function(){rej({message:'не удалось прочитать файл'});};fr.onload=function(){res(fr.result);};fr.readAsArrayBuffer(file);});
}
var SY_PAGE=50;
function syFilesOn(){return S.mode==='local'&&syLinked()&&!syMgr();}
function syFilesLoad(force,fresh){
  if(!syFilesOn()||S.sy.busy.files)return Promise.resolve();
  if(!force&&Date.now()-S.sy.fseen<15000)return Promise.resolve();
  S.sy.fseen=Date.now();syBusy('files',true);
  var q={a:'files'};if(fresh)q.fresh=1;
  return syGet(q,60000).then(function(d){
    syBusy('files',false);S.sy.files=d;S.sy.fvKnown=(d&&typeof d.fv==='number')?d.fv:undefined;
    if(S.sy.creg==='pend'&&!syPendFiles())S.sy.creg=null;           /* опустевшая «На проверке»: возвращаемся к региону по умолчанию */
    if(S.sy.creg==='arch'&&!syArchFiles())S.sy.creg=null;
    if(S.sy.cdir&&S.sy.cdir!=='all'&&syFCur()==='all')S.sy.cdir='';   /* удалённая папка -> список папок региона */
    syRegSync();                                                    /* технолог: папки регионов на Диске подгоняются под список регионов */
    var m=S.sy.msg.files;if(m&&m.state==='err')syMsg('files','','');
    if(S.tab==='cloud'&&isTyping()){syFilesPaint();renderTabs();}     /* человек печатает в поиске: список и счётчики обновляем, не трогая поле */
    scheduleRender();
  },function(e){syBusy('files',false);syMsg('files','err',syErrText(e));scheduleRender();});
}
/* библиотека ТТК в облаке: регионы (папки на Диске) → папки региона → файлы; «Без региона» — прежние файлы; «На проверке» — заявки редакторов */
function syNorm(s){return String(s||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();}
function syFReady(){var d=S.sy.files;return!!(d&&d.ready);}
function syFiles(){var d=S.sy.files;return d&&d.ready?d.files:[];}
function syDirs(){var d=S.sy.files;return(d&&d.dirs)||[];}
function syRegs(){var d=S.sy.files;return(d&&Array.isArray(d.regs))?d.regs:[];}
function syRegScript(){var d=S.sy.files;return!!(d&&d.ready&&Array.isArray(d.regs));}     /* скрипт версии 9: на Диске есть папки регионов */
function syOldScript(){var d=S.sy.files;return!!(d&&d.ready&&!d.dirs);}
function syDirInfo(id){var a=syDirs(),i;for(i=0;i<a.length;i++)if(a[i].id===id)return a[i];return null;}
function syDirName(id){var x=syDirInfo(id);return x?x.name:null;}
function syFRegName(id){
  var a=syRegs(),i;
  for(i=0;i<a.length;i++)if(a[i].id===id)return a[i].name;
  return id?regionName(id):'Без региона';
}
function syPendFiles(){return syFiles().filter(function(x){return x.kind==='pend';}).length;}
/* архив прежних версий: только технолог, и только если там что-то есть */
function syArchFiles(){return syAdmin()?syFiles().filter(function(x){return x.kind==='arch';}).length:0;}
function syMainFiles(){return syFiles().filter(function(x){return x.kind==='main';}).length;}
function syRegDirs(reg){return syDirs().filter(function(d){return(d.reg||'')===reg;});}
/* есть ли прежние файлы и папки вне регионов (или скрипт старый, и регионов нет вовсе) */
function syLegacy(){
  if(!syRegScript())return true;
  return syFiles().some(function(x){return x.kind==='main'&&!x.reg;})||syDirs().some(function(x){return!x.reg;});
}
/* регион по умолчанию: тот, что выбран вверху страницы, если для него есть папка, иначе первый */
function syDefReg(){
  var rs=syRegs(),g=curRegion(),i;
  if(!rs.length)return'';
  for(i=0;i<rs.length;i++)if(rs[i].id===g)return g;
  return rs[0].id;
}
/* выбранный раздел: id региона, '' — «Без региона» (и скрипты прежних версий), 'pend' — «На проверке» */
function syFReg(){
  var c=S.sy.creg;
  if(c==='pend')return syPendFiles()?'pend':syDefReg();
  if(c==='arch')return syArchFiles()?'arch':syDefReg();
  if(c===''&&syLegacy())return'';
  if(c&&syRegs().some(function(r){return r.id===c;}))return c;
  return syDefReg();
}
/* выбранная папка внутри региона: 'all', 'root' (прямо в папке региона) или id папки; удалённая папка -> 'all' */
function syFCur(){
  var reg=syFReg(),c=S.sy.cdir;
  if(reg==='pend'||reg==='arch'||!c||c==='all')return'all';
  var ds=syRegDirs(reg);
  if(c==='root')return ds.length?'root':'all';
  return ds.some(function(d){return d.id===c;})?c:'all';
}
function syRealDir(){var c=syFCur();return(c!=='all'&&c!=='root')?c:null;}
/* куда класть новые файлы: регион и папка ('' — прямо в папку региона) */
function syUpTarget(){
  var reg=syFReg();
  if(reg==='pend'||reg==='arch')reg=syDefReg();
  var c=syFCur();
  return{reg:reg,dir:(c==='all'||c==='root')?'':c};
}
/* параметры места для запроса: у скрипта с регионами — регион (и его название, чтобы недостающую папку создали) и папка */
function syPlaceReq(reg,dir){
  var x={dir:dir||''};
  if(syRegScript()){x.reg=reg||'';if(reg)x.regName=syFRegName(reg);}
  return x;
}
function syPlaceText(reg,dir){
  var p=[];
  if(syRegScript()&&reg)p.push(syFRegName(reg));
  if(dir&&syDirName(dir))p.push(syDirName(dir));
  return p.join(' › ');
}
function syTargetParse(v){v=String(v==null?'':v);var i=v.indexOf('|');return{reg:i<0?v:v.slice(0,i),dir:i<0?'':v.slice(i+1)};}
/* меню «куда»: регион и его папки одним списком */
function syTargetOptsHtml(sel){
  var h='',dirs=syDirs(),rs=syRegs();
  function opt(v,t){return'<option value="'+esc(v)+'"'+(v===sel?' selected':'')+'>'+esc(t)+'</option>';}
  if(!syRegScript())return opt('|','Без папки')+dirs.map(function(d){return opt('|'+d.id,d.name);}).join('');
  rs.forEach(function(r){
    h+='<optgroup label="'+esc(r.name)+'">'+opt(r.id+'|',r.name+' — без папки')+syRegDirs(r.id).map(function(d){return opt(r.id+'|'+d.id,r.name+' › '+d.name);}).join('')+'</optgroup>';
  });
  if(syLegacy())h+='<optgroup label="Без региона">'+opt('|','Без региона и папки')+syRegDirs('').map(function(d){return opt('|'+d.id,'Без региона › '+d.name);}).join('')+'</optgroup>';
  return h;
}
function syWantDefault(x){
  if(S.sy.fwant[x.id]!==undefined)return S.sy.fwant[x.id];
  var di=x.want?syDirInfo(x.want):null;
  if(di)return(di.reg||'')+'|'+di.id;
  var r=x.wantReg&&syRegs().some(function(g){return g.id===x.wantReg;})?x.wantReg:(syRegScript()?syDefReg():'');
  return r+'|';
}
/* папка меню с тем же названием, что у блюда, среди папок региона */
function syTargetForRec(r){
  var rs=syRegs(),reg=(r&&r.reg&&rs.some(function(g){return g.id===r.reg;}))?r.reg:syDefReg();
  var c=r&&r.cat&&catById(r.cat),dir='';
  if(c){var k=syNorm(c.name);syRegDirs(reg).forEach(function(d){if(!dir&&(syNorm(d.name)===k||syNorm(syDirTitle(d.name))===k))dir=d.id;});}
  return{reg:reg,dir:dir};
}
function syWhere(x){
  var d=x.dir?syDirInfo(x.dir):null;
  return syPlaceText(x.reg||'',d?d.id:'')||(syRegScript()?'Без региона':'');
}
/* файл подходит под поисковый запрос: имя, регион или папка */
function syFileMatch(x){
  var q=syNorm(S.sy.fq);
  return!q||syNorm(x.name+' '+(x.kind==='pend'?'':syWhere(x))).indexOf(q)>-1;
}
/* уровни облака: 'top' — плитки регионов; 'folders' — папки открытого региона; 'cards' — карты */
function syFTiles(){
  var d=S.sy.files;if(!d||!d.ready)return[];
  var main=syFiles().filter(function(x){return x.kind==='main';}),np=syPendFiles(),t=[];
  if(syRegScript()){
    syRegs().forEach(function(r){t.push({k:r.id,name:r.name,n:main.filter(function(x){return x.reg===r.id;}).length,dirs:syRegDirs(r.id).length});});
    if(syLegacy())t.push({k:'',name:'Без региона',n:main.filter(function(x){return!x.reg;}).length,dirs:syRegDirs('').length});
  }else if(np)t.push({k:'',name:'Библиотека',n:main.length,dirs:0});
  if(np)t.push({k:'pend',name:'На проверке',n:np,files:true,attn:syAdmin()});
  if(syArchFiles())t.push({k:'arch',name:'Архив',n:syArchFiles(),files:true});
  return t;
}
function syFHasTop(){return syFTiles().length>1;}
function syFTop(){
  var c=S.sy.creg;
  if((c==='pend'&&syPendFiles())||(c==='arch'&&syArchFiles()))return false;
  return!S.sy.cin&&syFHasTop();
}
function syFLevel(){
  if(syFTop())return'top';
  var reg=syFReg();
  if(reg==='pend'||reg==='arch'||syNorm(S.sy.fq))return'cards';
  if(!syRegDirs(reg).length)return'cards';
  return S.sy.cdir?'cards':'folders';
}
function syFRegLabel(reg){
  if(reg==='pend')return'На проверке';
  if(reg==='arch')return'Архив';
  if(reg===''&&!syRegScript())return'Библиотека';
  return syFRegName(reg);
}
/* поиск идёт внутри открытого региона (или «На проверке» / «Архива»); сколько совпадений в других регионах — для подсказки */
function syFOtherHits(){
  var reg=syFReg(),out={},list=[];
  if(reg==='pend'||reg==='arch'||!syRegScript())return list;
  syFiles().forEach(function(x){
    if(x.kind!=='main'||(x.reg||'')===reg||!syFileMatch(x))return;
    out[x.reg||'']=(out[x.reg||'']||0)+1;
  });
  Object.keys(out).forEach(function(k){list.push({k:k,name:syFRegLabel(k),n:out[k]});});
  return list;
}
function syFList(){
  var all=syFiles(),reg=syFReg();
  if(syNorm(S.sy.fq)){
    return all.filter(function(x){
      if(!syFileMatch(x))return false;
      if(reg==='pend')return x.kind==='pend';
      if(reg==='arch')return x.kind==='arch'&&syAdmin();
      return x.kind==='main'&&(x.reg||'')===reg;
    });
  }
  var cur=syFCur();
  if(reg==='pend')return all.filter(function(x){return x.kind==='pend';});
  if(reg==='arch')return all.filter(function(x){return x.kind==='arch';}).sort(function(a,b){return((b.arch&&b.arch.at)||0)-((a.arch&&a.arch.at)||0);});
  return all.filter(function(x){
    if(x.kind!=='main'||(x.reg||'')!==reg)return false;
    return cur==='all'||(x.dir||'root')===cur;
  });
}
var SY_ICO_DIR='<svg class="cti" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h4l2 2.2h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>';
/* верхний уровень: плитки регионов (и «На проверке», «Архив») */
function syRegChipsHtml(){
  var d=S.sy.files;if(!d||!d.ready||syFLevel()!=='top')return'';
  var h='<div class="ctiles">';
  syFTiles().forEach(function(t){
    var sub=t.files?t.n+' '+plural(t.n,['файл','файла','файлов'])+(t.k==='pend'?' ждут проверки':' заменённых версий'):t.n+' '+plural(t.n,['карта','карты','карт'])+(t.dirs?' · '+t.dirs+' '+plural(t.dirs,['папка','папки','папок']):'');
    h+='<button class="ctile'+(t.attn?' attn':'')+'" data-act="syFReg" data-reg="'+esc(t.k)+'">'+SY_ICO_DIR+'<span class="ctn">'+esc(t.name)+'</span><span class="cts">'+esc(sub)+'</span></button>';
  });
  return h+'</div>';
}
/* где мы: «‹ Облако» или «‹ Регион», название региона и папки */
function syFNavHtml(){
  var d=S.sy.files;if(!d||!d.ready)return'';
  var lv=syFLevel();if(lv==='top')return'';
  var reg=syFReg(),nm=syFRegLabel(reg),inFolder=lv==='cards'&&!syNorm(S.sy.fq)&&reg!=='pend'&&reg!=='arch'&&syRegDirs(reg).length>0,cur=inFolder?syFCur():'',crumb='<b>'+esc(nm)+'</b>';
  if(inFolder)crumb+=' › <b>'+esc(cur==='all'?'Все карты':(cur==='root'?'Без папки':(syDirName(cur)||'')))+'</b>';
  var back=inFolder?'‹ '+nm:(syFHasTop()?'‹ Облако':''),np=syPendFiles();
  return(back?'<button class="btn mini" data-act="syFBack" title="'+(inFolder?'К папкам региона':'К списку регионов')+'">'+esc(back)+'</button>':'')+'<span class="ccp">'+crumb+'</span>'
    +((np&&reg!=='pend')?'<button class="chip attn" data-act="syFReg" data-reg="pend" title="Файлы, которые ждут проверки технолога">На проверке · '+np+'</button>':'');
}
/* папки региона строками со счётчиками (технолог: «+ Папка») */
function syFChipsHtml(){
  var d=S.sy.files;if(!d||!d.ready||syNorm(S.sy.fq))return'';
  var lv=syFLevel();if(lv==='top')return'';
  var reg=syFReg();if(reg==='pend'||reg==='arch')return'';
  var ds=syRegDirs(reg),admin=syAdmin(),canAdd=admin&&!syOldScript()&&!(reg===''&&syRegScript());
  var add=canAdd?'<button class="chip add" data-act="syFAdm" aria-expanded="'+(!!S.sy.fadm)+'" title="Создать папку в этом регионе">+ Папка</button>':'';
  if(lv!=='folders')return ds.length?'':add;
  var c={all:0,root:0};
  ds.forEach(function(x){c[x.id]=0;});
  syFiles().forEach(function(x){
    if(x.kind!=='main'||(x.reg||'')!==reg)return;
    c.all++;var k=x.dir||'root';c[k]=(c[k]||0)+1;
  });
  function row(k,l,n,cls){return'<button class="cfold'+(cls?' '+cls:'')+'" data-act="syFDir" data-dir="'+esc(k)+'">'+SY_ICO_DIR+'<span class="cfn">'+esc(l)+'</span><span class="cfc">'+n+'</span><span class="cfa" aria-hidden="true">›</span></button>';}
  var h='<div class="cfolds">';
  ds.forEach(function(x){h+=row(x.id,x.name,c[x.id]||0);});
  if(c.root)h+=row('root','Без папки',c.root);
  h+=row('all','Все карты региона',c.all,'all')+'</div>';
  return h+(add?'<div class="chips" style="margin-top:10px">'+add+'</div>':'');
}
/* строка архива: прежняя версия, кто и когда её заменил; технолог возвращает её на место одной кнопкой */
function syFArchRowHtml(x,admin){
  var a=x.arch||{},id=esc(x.id),w=syWhere(x),btns='';
  if(canDl())btns+='<button class="btn mini" data-act="syFDl" data-id="'+id+'">Скачать</button>';
  if(admin)btns+='<button class="btn mini" data-act="syFRestore" data-id="'+id+'" title="Вернуть этот файл на прежнее место: текущая версия на этом месте уйдёт в архив">Вернуть на место</button>';
  return'<div class="syrow"><div class="syn"><b>'+esc(a.name||x.name)+'</b> <span class="tstat neutral">В архиве</span> <span class="sysub">'+fileSizeText(x.size)
    +(a.at?' · заменён '+syWhen(a.at):'')+(a.by?' · '+esc(a.by):'')+(a.why?' · '+esc(a.why):'')+(w?' · лежал: '+esc(w):'')+'</span></div><div class="syst" style="flex-direction:row;flex-wrap:wrap">'+btns+'</div></div>';
}
function syFRowHtml(x,admin,showWhere){
  if(x.kind==='arch')return syFArchRowHtml(x,admin);
  var pend=x.kind==='pend',id=esc(x.id),chef=syChef(),rw=pend&&x.st==='rework',mine=pend&&!admin&&syNorm(x.by)===syNorm(S.sy.cfg.name);
  var btns='';
  if(!chef&&pend&&admin)btns+='<button class="btn mini primary" data-act="syFReview" data-id="'+id+'" title="Открыть присланную ТТК в расчёте: её можно поправить, затем принять, вернуть автору или отклонить">'+((S.sy.fr&&S.sy.fr.id===x.id&&S.recipes[S.sy.fr.recId])?'Продолжить проверку':'Открыть для правки')+'</button>';
  else if(!chef)btns+='<button class="btn mini primary" data-act="syFOpen" data-id="'+id+'" title="Прочитать файл и создать по нему расчёт">В расчёт</button>';
  if(canDl())btns+='<button class="btn mini'+(chef?' primary':'')+'" data-act="syFDl" data-id="'+id+'">Скачать</button>';
  var sub=fileSizeText(x.size)+(x.by?' · '+esc(x.by):'')+(x.at?' · '+syWhen(x.at):'');
  if(pend){
    var want=syWantDefault(x),sg=syPlaceText(x.wantReg||((x.want&&syDirInfo(x.want))?syDirInfo(x.want).reg:''),x.want&&syDirInfo(x.want)?x.want:'');
    if(sg)sub+=' · предлагает: '+esc(sg);
    var oldF=syOldFileFor(x.name,x.wantReg||((x.want&&syDirInfo(x.want))?syDirInfo(x.want).reg:''));
    if(oldF&&oldF.id!==x.id)sub+=' · заменит «'+esc(oldF.name)+'»'+(oldF.at?' от '+syWhen(oldF.at):'')+', прежний уйдёт в «Архив»';
    if(admin){
      btns+='<select data-act="syFWant" data-id="'+id+'" aria-label="Куда положить файл «'+esc(x.name)+'»" title="Куда положить при приёме: регион и папка">'+syTargetOptsHtml(want)+'</select>';
      btns+='<button class="btn mini" data-act="syFApprove" data-id="'+id+'">Принять</button><button class="btn mini" data-act="syFRework" data-id="'+id+'">На доработку</button><button class="btn mini" data-act="syFReject" data-id="'+id+'">Отклонить</button>';
    }else if(mine)btns+='<button class="btn mini" data-act="syFWithdraw" data-id="'+id+'" title="Убрать свой файл из «На проверке»">Снять с проверки</button>';
  }else{
    var w=showWhere===true?syWhere(x):(showWhere==='dir'?(x.dir&&syDirName(x.dir)||''):'');
    if(w)sub+=' · '+esc(w);
    if(admin){
      btns+='<select data-act="syFMove" data-id="'+id+'" aria-label="Куда перенести файл «'+esc(x.name)+'»" title="Перенести в регион и папку">'+syTargetOptsHtml((x.reg||'')+'|'+(x.dir||''))+'</select>';
      btns+='<button class="btn mini danger" data-act="syFDel" data-id="'+id+'">Удалить</button>';
    }
  }
  var rwNote=rw?'<div class="rwq">'+(admin?'Возвращён автору':'Технолог вернул файл')+(x.reviewer?' ('+esc(x.reviewer)+')':'')+(x.decided?' · '+syWhen(x.decided):'')+': «'+esc(x.reply||'')+'»'+(admin?'':'<div class="sysub">Исправьте файл и предложите его снова под тем же названием: прежний заменится.</div>')+'</div>':'';
  var ask=(pend&&admin&&S.sy.frow===x.id)?'<div class="cloudrow" style="margin-top:8px"><label class="field"><span class="lbl">Комментарий автору: что исправить</span><input type="text" maxlength="300" autocomplete="off" data-act="syFRN" data-fk="sy:frn" value="'+esc(S.sy.frn)+'"></label>'
    +'<button class="btn primary" data-act="syFReworkGo">Вернуть автору</button><button class="btn" data-act="syFReworkNo">Отмена</button></div>':'';
  return'<div class="syrow"><div class="syn"><b>'+esc(x.name)+'</b> '+(pend?(rw?'<span class="tstat bad">На доработке</span> ':'<span class="tstat warn">На проверке</span> '):syFMenuTag(x))+'<span class="sysub">'+sub+'</span>'+rwNote+ask+syDlPanelHtml(x.id)+'</div><div class="syst" style="flex-direction:row;flex-wrap:wrap">'+btns+'</div></div>';
}
function syFListHtml(){
  var d=S.sy.files;if(!d||!d.ready)return'';
  var lv=syFLevel();if(lv!=='cards')return'';
  var admin=syAdmin(),cur=syFCur(),reg=syFReg(),has=!!syNorm(S.sy.fq),list=syFList();
  if(!list.length){
    var oth=has?syFOtherHits():[],oh='';
    if(oth.length)oh='<p class="hint" style="margin:10px 0 4px">Есть в других регионах:</p><div class="chips">'+oth.map(function(o){return'<button class="chip" data-act="syFReg" data-reg="'+esc(o.k)+'">'+esc(o.name)+' · '+o.n+'</button>';}).join('')+'</div>';
    return'<p class="hint" style="margin:10px 0 0">'+(has?'В «'+esc(syFRegLabel(reg))+'» ничего не найдено. Поиск идёт по названию файла и папке.':(reg==='pend'?'Заявок на проверку нет.':(reg==='arch'?'В архиве пока пусто.':(cur!=='all'?'В этой папке пока нет файлов.':(syCanSend()?'В этом разделе пока нет файлов. Добавьте их кнопкой выше'+(admin?' или перетащите в папку региона на Google Диске и нажмите «Обновить список».':'.'):'В этом разделе пока нет файлов.')))))+'</p>'+oh;
  }
  var n=Math.max(SY_PAGE,Number(S.sy.fshow)||SY_PAGE),shown=list.slice(0,n),where=(has||(reg!=='pend'&&reg!=='arch'&&cur==='all'&&syRegDirs(reg).length>0))?'dir':false;
  SY_MX=null;
  var sum=(reg==='pend'||reg==='arch')?'':syFMenuSum(list),rows=shown.map(function(x){return syFRowHtml(x,admin,where);}).join('');
  SY_MX=null;
  return sum+'<div class="sylist">'+rows+'</div>'
    +(list.length>shown.length?'<div class="btns" style="margin-top:10px"><button class="btn" data-act="syFMore">Показать ещё '+Math.min(SY_PAGE,list.length-shown.length)+'</button><span class="sysub" style="align-self:center">показано '+shown.length+' из '+list.length+'</span></div>':(list.length>SY_PAGE?'<p class="sysub" style="margin:10px 0 0">Показаны все: '+list.length+'.</p>':''));
}
function syFileSearchHtml(){
  var d=S.sy.files;if(!d||!d.ready||syFLevel()==='top')return'';
  var reg=syFReg(),nm=syFRegLabel(reg);
  return'<label class="field" id="syFSearch" style="margin-top:10px;max-width:420px"><span class="lbl">Найти ТТК в «'+esc(nm)+'»</span><input type="text" autocomplete="off" data-act="syFQ" data-fk="sy:fq" value="'+esc(S.sy.fq)+'" placeholder="'+(reg==='pend'||reg==='arch'?'Название файла':'Название блюда или папки: борщ, суп')+'"></label>'
    +'<p class="sysub" id="syFQInfo" style="margin:6px 0 0"'+(syNorm(S.sy.fq)?'':' hidden')+'>'+syFQInfoHtml()+'</p>';
}
function syFQInfoHtml(){
  if(!syNorm(S.sy.fq))return'';
  return'Поиск в «'+esc(syFRegLabel(syFReg()))+'» · найдено: '+syFList().length+' <button class="btn mini" data-act="syFQClear">Сбросить</button>';
}
function syFilesNoFolder(){
  return'<p class="hint cmsg warn" style="margin-top:10px">'+(syAdmin()?'Папка для файлов ещё не создана. Откройте скрипт в таблице, выберите функцию «setup», нажмите «Выполнить» и разрешите доступ к Google Диску. Папка также создастся сама при загрузке первого файла.':'Папку для файлов ещё не создал технолог.')+'</p>';
}
/* управление папками региона (технолог) */
function syFToolsHtml(){
  if(!syAdmin()||!syFReady()||syOldScript())return'';
  var rd=syRealDir(),h='',reg=syFReg();
  if(S.sy.fadm&&reg!=='pend'&&reg!=='arch')h+='<div class="mfrow" id="syFTools"><label class="field"><span class="lbl">Новая папка'+(syRegScript()&&reg?' в регионе «'+esc(syFRegName(reg))+'»':'')+'</span><input type="text" maxlength="60" autocomplete="off" data-act="syFNew" data-fk="sy:fnew" value="'+esc(S.sy.fnew)+'" placeholder="Например: Первые блюда"></label>'
    +'<div class="mfbtns"><button class="btn" data-act="syFDirAdd">Создать папку</button></div></div>';
  if(rd){
    if(S.sy.fren===rd)h+='<div class="mfrow"><label class="field"><span class="lbl">Новое название папки «'+esc(syDirName(rd))+'»</span><input type="text" maxlength="60" autocomplete="off" data-act="syFRenV" data-fk="sy:frenv" value="'+esc(S.sy.frenv)+'"></label><div class="mfbtns"><button class="btn primary" data-act="syFRenOk">Сохранить</button><button class="btn" data-act="syFRenNo">Отмена</button></div></div>';
    else h+='<div class="mfrow"><span class="mfcnt sysub">Папка «'+esc(syDirName(rd))+'»</span><div class="mfbtns"><button class="btn mini" data-act="syFRen">Переименовать</button><button class="btn mini danger" data-act="syFDirDel">Удалить папку</button></div></div>';
  }
  return h;
}
function syFUpHint(){
  var t=syUpTarget(),admin=syAdmin(),pl=syPlaceText(t.reg,t.dir);
  if(admin)return'Новые файлы попадут '+(pl?'в «'+esc(pl)+'»':(syRegScript()?'в «Без региона»':'в папку «ТТК калькулятора»'))+(t.dir?'':(syFLevel()==='top'?' (откройте нужный регион или папку, чтобы класть сразу туда)':(syRegDirs(t.reg).length?' (откройте нужную папку, чтобы класть сразу в неё)':'')))+'.';
  return'Ваш файл уйдёт на проверку технологу'+(pl?', вы предложите ему «'+esc(pl)+'»':'')+'.';
}
function syCloudHow(){
  if(syChef())return'Принятые технологом ТТК (.docx), разложенные по регионам и папкам. Файл можно скачать и открыть в Word; изменить его здесь нельзя.';
  return'Готовые ТТК (.docx) из папки «ТТК калькулятора» на Google Диске: внутри неё папка на каждый регион, в регионах — свои папки. «В расчёт» читает файл: состав, технологию и органолептику, и предлагает выбрать регион. '
    +(syAdmin()?'Файлы можно добавлять и перетаскиванием прямо в папку региона на Диске: после этого нажмите «Обновить список».':'Ваши файлы попадают в «На проверке», технолог их принимает и раскладывает по регионам и папкам.');
}
/*BULK-START*/
