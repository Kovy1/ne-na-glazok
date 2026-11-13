/* ---------- массовая загрузка карт из «ТТК в облаке» в общую базу (технолог) ----------
   Читает файлы библиотеки, создаёт только те карты, которых ещё нет, и публикует их пачками. Ничего не удаляет и не заменяет:
   карты, которые уже есть в базе, не создаются заново; файлы .docx в облаке остаются как есть (заново они не загружаются).
   Тексты разделов (технология, подача, срок хранения) у уже загруженных карт можно обновить из исправленных файлов: показывается «было → станет», рецептура и цены не меняются. */
var BULK_FZ=0.85;                     /* похожесть названий, начиная с которой сырьё из карты связывается с базой само */
var BULK_PAR=4;                       /* файлов читается одновременно */
function bulkShow(){return S.mode==='local'&&syAdmin()&&syFilesOn()&&syFReady();}
function bulkOn(){return bulkShow()&&syV23();}
function bulkBusy(){var B=S.sy.bulk;return!!B&&(B.st==='scan'||B.st==='apply');}
function bulkFiles(){return syFiles().filter(function(f){return f.kind==='main'&&/\.docx$/i.test(f.name);});}
function bulkReg(f){return(f&&f.reg&&regKnown(f.reg)&&regionList().length>1)?f.reg:'';}
function bulkMsg(st,t){syMsg('imp',st,t);}
function bulkPaint(){
  var el=$('#syBulk');
  if(!el)return;
  var h=bulkInnerHtml();
  if(el._h!==h){el._h=h;el.innerHTML=h;}
}
function bulkRead(f){
  function once(){
    return syGet({a:'file',id:f.id},90000).then(function(d){
      return unzipEntry(b64ToBuf(d.b64),'word/document.xml').then(function(u8){
        if(!u8)throw new Error('в файле нет текста документа');
        return parseTtk(new TextDecoder('utf-8').decode(u8));
      });
    });
  }
  return once().catch(function(e){
    return new Promise(function(ok){setTimeout(ok,1200);}).then(once);
  });
}
var BULK_TXT=['t42','t41','s51','s52','s53','s54'];
var BULK_TXT_N={t41:'4.1',t42:'4.2',s51:'5.1',s52:'5.2',s53:'5.3',s54:'5.4'};
function bulkNorm(x){return String(x==null?'':x).replace(/\r/g,'').split('\n').map(function(l){return l.replace(/\s+/g,' ').trim();}).filter(Boolean).join('\n');}
/* что в тексте разделов карты отличается от файла; раздел, которого в файле нет или он пустой, не трогается */
function bulkTxtDiff(rid,t,f){
  var r=S.recipes[rid],fl=t.fields||{},d=[];
  if(!r||t.fieldsErr)return null;
  BULK_TXT.forEach(function(k){
    var nw=fl[k],old;
    if(nw===undefined||!bulkNorm(nw))return;
    old=ttkVal(r,k);
    if(bulkNorm(old)!==bulkNorm(nw))d.push({k:k,old:String(old==null?'':old),nw:String(nw)});
  });
  return d.length?{rid:rid,name:r.name||'',file:f.name,diffs:d}:null;
}
function bulkWhy(e){var m=String((e&&(e.msg||e.message))||e||'');return(!m||/^(zip|xml|nodoc)$/i.test(m))?'файл повреждён или это не документ Word':m.slice(0,160);}
/* 1. проверка: файлы читаются, ничего не создаётся */
function bulkScan(){
  if(!bulkOn()||bulkBusy()||S.sy.bulkPre||S.sy.busy.send||S.sy.busy.fup)return;
  /* файлы в облаке могли заменить с прошлого просмотра: список берётся заново, а не из памяти */
  S.sy.bulkPre=1;bulkMsg('busy','Обновляю список файлов…');bulkPaint();
  syFilesLoad(true,true).then(function(){S.sy.bulkPre=0;bulkScan2();},function(){S.sy.bulkPre=0;bulkScan2();});
}
function bulkScan2(){
  if(!bulkOn()||bulkBusy()||S.sy.busy.send||S.sy.busy.fup)return;
  if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .docx. Нужен современный Chrome, Edge, Firefox или Safari.');return;}
  var files=bulkFiles(),B,i=0,run=0;
  if(!files.length){S.sy.bulk=null;bulkMsg('warn','В «ТТК в облаке» нет файлов .docx.');scheduleRender();return;}
  files.sort(function(a,b){return(b.at||0)-(a.at||0);});     /* свежие раньше: из двух одинаковых карт берётся новая */
  B=S.sy.bulk={st:'scan',total:files.length,done:0,got:[],stop:false,plan:null,res:null,exU:{}};
  bulkMsg('busy','Сверяю с общей базой…');bulkPaint();scheduleRender();
  syPull(true).then(function(){
    bulkMsg('busy','Читаю файлы…');bulkPaint();
    return new Promise(function(fin){
      function pump(){
        if(B.stop||i>=files.length){if(!run)fin();return;}
        while(run<BULK_PAR&&i<files.length&&!B.stop){
          (function(f,k){
            run++;
            bulkRead(f).then(function(t){B.got[k]={f:f,t:t,err:''};},function(e){B.got[k]={f:f,t:null,err:bulkWhy(e)};}).then(function(){
              run--;B.done++;
              if(B.done%5===0||B.done===B.total){bulkMsg('busy','Прочитано файлов: '+B.done+' из '+B.total+'…');bulkPaint();}
              pump();
            });
          })(files[i],i);i++;
        }
      }
      pump();
    });
  }).then(function(){
    if(B.stop){S.sy.bulk=null;bulkMsg('warn','Проверка остановлена, ничего не создано.');scheduleRender();return;}
    return bulkPlan(B);
  }).catch(function(e){S.sy.bulk=null;bulkMsg('err',syErrText(e)||bulkWhy(e));scheduleRender();});
}
/* 2. план: что создастся, что пропустится, что с файлом не так. Сырьё сопоставляется по названию; всё сомнительное заводится новым, а не подставляется чужое */
function bulkPlan(B){
  var V={},memo={},newIngs={},nOrder=[],cards=[],probs=[],skips=[],dups=[],warns=[],doubt=[],upds=[],updSeen={},k=0;
  Object.keys(S.ings).forEach(function(id){V[id]={name:S.ings[id].name,aliases:S.ings[id].aliases};});
  function nameOf(id){return V[id]?V[id].name:'';}
  function sameInRun(t,reg){
    var nm=normKey(ttkName(t)),core=ttkCore(t.dish),i,c;
    for(i=0;i<cards.length;i++){
      c=cards[i];
      if(c.reg!==reg)continue;
      if(c.key===nm)return c;
      if(t.number&&c.t.number===t.number&&sameDishCore(core,c.core))return c;
    }
    return null;
  }
  function step(){
    var end=Math.min(B.got.length,k+25);
    for(;k<end;k++){
      var g=B.got[k],f=g.f,t=g.t,reg,same,twin,rows,bad;
      if(!t){probs.push({name:f.name,why:g.err||'не удалось прочитать файл'});continue;}
      if(!t.rows.length){probs.push({name:f.name,why:'не найдена таблица рецептуры с колонками «Брутто» и «Нетто»'});continue;}
      if(!String(t.dish||'').trim()){probs.push({name:f.name,why:'не найдено название блюда («Наименование блюда:»)'});continue;}
      reg=bulkReg(f);
      same=findSameRecipe(t,reg);
      if(same){
        skips.push({name:f.name,as:S.recipes[same].name||''});
        if(!updSeen[same]){updSeen[same]=1;var u0=bulkTxtDiff(same,t,f);if(u0)upds.push(u0);}      /* из нескольких файлов одной карты берётся самый свежий */
        continue;
      }
      twin=sameInRun(t,reg);
      if(twin){dups.push({name:f.name,as:twin.f.name});continue;}
      rows=[];bad=0;
      t.rows.forEach(function(x){
        var key=normKey(x.name),m,r={x:x,ing:'',skip:false};
        if(x.noqty===true){r.skip=true;rows.push(r);return;}
        if(!key){r.skip=true;bad++;rows.push(r);return;}
        m=memo[key];
        if(!m){m=memo[key]=matchIng(x.name,V);}
        if(m.id&&(m.how==='exact'||m.how==='alias'||(m.how==='fuzzy'&&m.score>=BULK_FZ)))r.ing=m.id;
        else{
          if(!newIngs[key]){
            newIngs[key]={key:key,name:String(x.name).replace(/\s+/g,' ').trim(),n:0,cards:0,guess:m.id?nameOf(m.id):''};
            nOrder.push(key);V['n:'+key]={name:x.name,aliases:[key]};memo[key]={id:'n:'+key,how:'exact',score:1};
          }
          newIngs[key].n++;r.ing='n:'+key;
        }
        if(!(Number(x.net)>0))warns.push({name:f.name,why:'строка «'+x.name+'»: нет массы нетто'});
        rows.push(r);
      });
      if(bad)warns.push({name:f.name,why:'строк без названия сырья: '+bad+' (пропущены)'});
      if(!rows.some(function(r){return r.ing;})){probs.push({name:f.name,why:'в карте нет ни одной строки с сырьём и массой'});continue;}
      if(!(Number(t.output)>0))warns.push({name:f.name,why:'не найден выход блюда'});
      cards.push({f:f,t:t,reg:reg,rows:rows,key:normKey(ttkName(t)),core:ttkCore(t.dish)});
    }
    bulkMsg('busy','Сверяю с базой: '+Math.min(k,B.got.length)+' из '+B.got.length+'…');bulkPaint();
    if(k<B.got.length)return new Promise(function(ok){setTimeout(ok,0);}).then(step);
  }
  return Promise.resolve().then(step).then(function(){
    var seenIn={};
    cards.forEach(function(c){c.rows.forEach(function(r){if(r.ing&&r.ing.indexOf('n:')===0&&!seenIn[c.f.id+'|'+r.ing]){seenIn[c.f.id+'|'+r.ing]=1;newIngs[r.ing.slice(2)].cards++;}});});
    nOrder.forEach(function(key){if(newIngs[key].guess)doubt.push(newIngs[key]);});
    B.plan={upds:upds,cards:cards,newIngs:newIngs,nOrder:nOrder,probs:probs,skips:skips,dups:dups,warns:warns,doubt:doubt,files:B.got.length};
    B.got=null;B.st='ready';
    bulkMsg('ok','Проверено файлов: '+B.plan.files+'. Ничего пока не создано.');
    scheduleRender();
  });
}
/* 3. создание карт в этой базе и публикация пачками. Файлы .docx заново не грузятся: в облаке уже лежат оригиналы */
function bulkApply(){
  var B=S.sy.bulk,P=B&&B.plan;
  if(!B||B.st!=='ready'||!P||!P.cards.length||S.sy.busy.send||!bulkOn())return;
  var idMap={},recIds=[],menuTouched=false,nCats=0;
  B.st='apply';bulkMsg('busy','Создаю карты…');bulkPaint();
  P.nOrder.forEach(function(key){
    var n=P.newIngs[key],id=newId();
    S.ings[id]=normIng({name:n.name,p:0,f:0,c:0,kind:'estimate',source:'Добавлено из ТТК (загрузка из облака): значения КБЖУ не заполнены'});
    S.ings[id].aliases=[key];
    idMap['n:'+key]=id;queueSave('ingredients',id);
  });
  P.cards.forEach(function(c){
    var t=c.t,rf=t.ref,rid=newId(),reg=c.reg,tf={},k0,ref,rows,nm0,nb0,ni0,nrd;
    rows=c.rows.map(function(r){
      var x=r.x,id=r.ing?(r.ing.indexOf('n:')===0?idMap[r.ing]:r.ing):'',nr={rid:newId(),ing:id,net:x.net,share:100,tname:x.name};
      if(r.skip&&!id)nr.skip=true;
      if(x.gross!==null&&x.gross!==undefined)nr.gross=x.gross;
      if(x.alts&&x.alts.length)nr.alts=normAlts(x.alts);
      return nr;
    });
    ref={label:'',p:null,f:null,c:null,kcal:null,tol:10,basis:'100'};
    if(rf)ref={label:'ТТК'+(t.number?' №'+t.number:'')+', раздел VII (значения из файла)',p:rf.p,f:rf.f,c:rf.c,kcal:rf.kcal,tol:10,basis:rf.basis};
    if(t.fields)for(k0 in t.fields)tf[k0]=t.fields[k0];
    if(t.number)tf.num=t.number;
    HDR_KEYS.forEach(function(k){if(tf[k]!==undefined)tf[k]=String(tf[k]==null?'':tf[k]).replace(/\s+/g,' ').trim();});
    tf.subs=JSON.stringify((t.subs||[]).slice().sort(function(a,b){return a.seq-b.seq;}).map(function(x){
      return{n:String(x.name).replace(/\s+/g,' ').trim(),m:x.mass>0?dnum(x.mass,3):'',a:(x.at>0&&rows[x.at-1])?rows[x.at-1].rid:''};
    }));
    tf.semiName='';tf.semiMass='';tf.semiAfter='0';
    nm0=ttkName(t);
    if(reg&&nameTaken(nm0))nm0=nm0+' · '+regionName(reg);
    var lblTaken=function(n){var kk=normKey(recLabel({name:n,reg:reg||undefined}));return Object.keys(S.recipes).some(function(i){return normKey(recLabel(S.recipes[i]))===kk;});};
    if(nameTaken(nm0)||lblTaken(nm0)){nb0=nm0;ni0=2;while(nameTaken(nm0)||lblTaken(nm0))nm0=nb0+' ('+(ni0++)+')';}
    nrd={name:nm0,output:t.output,rows:rows,ref:ref,ttk:tf};
    if(reg)nrd.reg=reg;
    S.recipes[rid]=normRecipe(nrd);
    if(!layOn()&&c.f){
      var tt0=lyFileTitle(c.f),cid0=tt0?lyCatFor(tt0,true):'';
      if(cid0){S.recipes[rid].cat=cid0;menuTouched=true;nCats++;}
    }
    queueSave('recipes',rid);recIds.push(rid);c.rid=rid;
  });
  if(menuTouched)saveMenu();
  /* слишком большие для одной ячейки таблицы остаются у вас: их можно сократить и опубликовать позже */
  var set={},sel,big=[];
  recIds.forEach(function(id){set['rec|'+id]=1;});
  sel=syDirtyUi().filter(function(d){return set[sySelKey(d)];});
  sel=sel.filter(function(d){
    var n=0;try{n=JSON.stringify(syCur(syCtx(),'rec',d.id).shared).length;}catch(e){n=0;}
    if(n>40000){big.push(S.recipes[d.id].name);return false;}
    return true;
  });
  B.made=recIds.length;B.big=big;B.newIng=P.nOrder.length;
  S.sy.pt={};
  syPersist();renderAll();
  Promise.resolve(sel.length?sySend(true,sel,'imp',{guard:1,noDoc:1,light:1,chunk:100}):null).then(function(){
    var ctx=syCtx(),pubd=0,left=[];
    recIds.forEach(function(id){
      var e=syMap(ctx,'rec')[id],cur;
      if(!S.recipes[id])return;
      try{cur=syCur(ctx,'rec',id);}catch(x){cur=null;}
      if(e&&e.rev>0&&cur&&e.h===cur.h)pubd++;else left.push(S.recipes[id].name);
    });
    B.pub=pubd;B.left=left;B.st='done';
    bulkMsg(left.length?'warn':'ok','Опубликовано карт: '+pubd+' из '+recIds.length+(left.length?'. Остальные — в «Мои изменения»: опубликуйте их кнопкой там.':'.'));
    return syFilesLoad(true).then(null,function(){});
  }).then(function(){scheduleRender();},function(e){B.st='done';B.pub=0;B.left=['публикация не завершилась'];bulkMsg('err',syErrText(e)||bulkWhy(e));scheduleRender();});
}
/* 3б. обновить тексты разделов у уже загруженных карт из файлов; только эти разделы, публикация пачками */
function bulkUpdApply(){
  var B=S.sy.bulk,P=B&&B.plan,sel,ids={},dirty,big=[];
  if(!B||B.st!=='ready'||!P||!P.upds||S.sy.busy.send||!bulkOn())return;
  sel=P.upds.filter(function(u){return!B.exU[u.rid]&&S.recipes[u.rid];});
  if(!sel.length)return;
  sel.forEach(function(u){
    var r=S.recipes[u.rid];
    if(!r.ttk)r.ttk={};
    u.diffs.forEach(function(d){r.ttk[d.k]=d.nw;});
    queueSave('recipes',u.rid);ids['rec|'+u.rid]=1;
  });
  B.st='apply';B.upd=sel.length;B.made=0;B.newIng=0;B.big=[];bulkMsg('busy','Обновляю разделы…');bulkPaint();
  dirty=syDirtyUi().filter(function(d){return ids[sySelKey(d)];});
  dirty=dirty.filter(function(d){
    var n=0;try{n=JSON.stringify(syCur(syCtx(),'rec',d.id).shared).length;}catch(e){n=0;}
    if(n>40000){big.push(S.recipes[d.id].name);return false;}
    return true;
  });
  B.big=big;S.sy.pt={};syPersist();renderAll();
  Promise.resolve(dirty.length?sySend(true,dirty,'imp',{guard:1,noDoc:1,light:1,chunk:100}):null).then(function(){
    var ctx=syCtx(),pubd=0,left=[];
    sel.forEach(function(u){
      var e=syMap(ctx,'rec')[u.rid],cur;
      if(!S.recipes[u.rid])return;
      try{cur=syCur(ctx,'rec',u.rid);}catch(x){cur=null;}
      if(e&&e.rev>0&&cur&&e.h===cur.h)pubd++;else left.push(S.recipes[u.rid].name);
    });
    B.pub=pubd;B.left=left;B.st='done';
    bulkMsg(left.length?'warn':'ok','Обновлено карт: '+sel.length+', опубликовано: '+pubd+(left.length?'. Остальные — в «Мои изменения»: опубликуйте их кнопкой там.':'.'));
  }).then(function(){scheduleRender();},function(e){B.st='done';B.pub=0;B.left=['публикация не завершилась'];bulkMsg('err',syErrText(e)||bulkWhy(e));scheduleRender();});
}
function bulkStop(){var B=S.sy.bulk;if(B&&B.st==='scan'){B.stop=true;bulkMsg('busy','Останавливаю…');bulkPaint();}}
function bulkClose(){if(bulkBusy())return;S.sy.bulk=null;syMsg('imp','','');scheduleRender();}
function bulkList(title,items,fmt,open){
  if(!items.length)return'';
  var shown=items.slice(0,200),more=items.length-shown.length;
  return'<details class="pgroup"'+(open?' open':'')+'><summary>'+esc(title)+' · '+items.length+'</summary><div class="sylist">'
    +shown.map(function(x){return'<div class="syrow"><div class="syn">'+fmt(x)+'</div></div>';}).join('')
    +(more?'<p class="hint" style="margin:6px 0 0">…и ещё '+more+'. Полный список — кнопкой «Скопировать список».</p>':'')+'</div></details>';
}
function bulkText(B){
  var P=B.plan,L=[];
  function add(t,a,f){if(a&&a.length){L.push(t+' ('+a.length+'):');a.forEach(function(x){L.push('  '+f(x));});L.push('');}}
  if(!P)return'';
  add('Файлы, которые не загрузились',P.probs,function(x){return x.name+' — '+x.why;});
  add('Замечания по картам',P.warns,function(x){return x.name+' — '+x.why;});
  add('Новое сырьё без КБЖУ',P.nOrder.map(function(k){return P.newIngs[k];}),function(x){return x.name+' (в картах: '+x.cards+')'+(x.guess?', похоже на «'+x.guess+'»':'');});
  add('Дубли файлов в облаке',P.dups,function(x){return x.name+' — то же, что '+x.as;});
  add('Уже были в базе',P.skips,function(x){return x.name+' — '+x.as;});
  if(B.left&&B.left.length)add('Не опубликованы',B.left,function(x){return x;});
  if(B.big&&B.big.length)add('Слишком большие карты',B.big,function(x){return x;});
  return L.join('\n');
}
function bulkUpdHtml(B){
  var U=(B.plan&&B.plan.upds)||[],sel,n=0;
  if(!U.length)return'';
  sel=U.filter(function(u){return!B.exU[u.rid];});
  return'<details class="pgroup" open><summary>Обновить тексты из файлов · '+sel.length+' из '+U.length+'</summary><p class="hint" style="margin:6px 0">Заменяются только перечисленные разделы, и только если в файле они заполнены. Если вы правили этот текст прямо в приложении, он будет заменён текстом из файла. Лишнюю карту можно снять.</p><div class="sylist">'
    +U.slice(0,200).map(function(u){
      return'<div class="syrow" style="display:block"><label class="chkl" style="margin:0"><input type="checkbox" data-act="bulkExU" data-id="'+esc(u.rid)+'"'+(B.exU[u.rid]?'':' checked')+'><span><b>'+esc(u.name)+'</b> <span class="sysub">файл: '+esc(u.file)+'</span></span></label>'
        +u.diffs.map(function(d){return'<div class="sysub" style="margin:2px 0 0 26px">'+BULK_TXT_N[d.k]+': '+bulkFrag(d.old,d.nw)+'</div>';}).join('')+'</div>';
    }).join('')+(U.length>200?'<p class="hint">Показаны первые 200 из '+U.length+'; применятся все отмеченные.</p>':'')
    +'</div><div class="btns" style="margin-top:10px"><button class="btn primary" data-act="bulkUpd"'+(sel.length?'':' disabled')+'>Обновить тексты в '+sel.length+' '+plural(sel.length,['карте','картах','картах'])+' и опубликовать</button></div></details>';
}
/* показывает только изменившееся место с небольшим окружением: «…не более <24> → <36> часов…» */
function bulkFrag(o,n){
  o=String(o).replace(/\s+/g,' ').trim();n=String(n).replace(/\s+/g,' ').trim();
  if(!o)return'пусто → <ins>'+esc(tbCutB(n,140))+'</ins>';
  var p=0,q=0,lo=o.length,ln=n.length,C=28,om,nm,pre,suf;
  while(p<lo&&p<ln&&o.charAt(p)===n.charAt(p))p++;
  while(q<lo-p&&q<ln-p&&o.charAt(lo-1-q)===n.charAt(ln-1-q))q++;
  om=o.slice(p,lo-q);nm=n.slice(p,ln-q);
  pre=o.slice(Math.max(0,p-C),p);suf=o.slice(lo-q,Math.min(lo,lo-q+C));
  return(p>C?'…':'')+esc(pre)+(om?'<del>'+esc(tbCutB(om,120))+'</del>':'')+' → <ins>'+(nm?esc(tbCutB(nm,120)):'(удалено)')+'</ins> '+esc(suf)+(lo-q+C<lo?'…':'');
}
function tbCutB(t,n){t=String(t).replace(/\s+/g,' ').trim();return t?(t.length>n?t.slice(0,n)+'…':t):'пусто';}
function bulkChange(act,t){
  if(act!=='bulkExU')return false;
  var B=S.sy.bulk,id=t.getAttribute('data-id');
  if(B&&B.exU){if(t.checked)delete B.exU[id];else B.exU[id]=1;bulkPaint();}
  return true;
}
function bulkInnerHtml(){
  var B=S.sy.bulk,P=B&&B.plan,h='',reg={};
  h+='<summary>Загрузить все карты из облака в общую базу</summary>';
  if(!B){
    return h+'<p class="hint" style="margin-top:0">Для первого наполнения и для обновления текстов: программа прочитает файлы .docx из «ТТК в облаке» и покажет, что получится: какие карты создадутся и в каких изменится технология, подача или срок хранения. Сначала только проверка, ничего не создаётся. Карты, которые уже есть в базе, не трогаются; файлы в облаке остаются как есть.</p>'
      +'<div class="btns"><button class="btn primary" data-act="bulkScan">Проверить библиотеку</button></div>'+syMsgHtml('imp');
  }
  if(B.st==='scan')return h+'<p class="hint" style="margin-top:0">Читаю файлы: '+B.done+' из '+B.total+'. Это займёт несколько минут; страницу можно не закрывать.</p>'
    +'<div class="btns"><button class="btn" data-act="bulkStop">Остановить</button></div>'+syMsgHtml('imp');
  if(B.st==='apply')return h+'<p class="hint" style="margin-top:0">Создаю карты и публикую пачками. Не закрывайте страницу, пока идёт публикация.</p>'+syMsgHtml('imp');
  if(B.st==='ready'&&P){
    P.cards.forEach(function(c){var n=c.reg?regionName(c.reg):'Без региона';reg[n]=(reg[n]||0)+1;});
    h+='<div class="sylist"><div class="syrow"><div class="syn"><b>К созданию: '+P.cards.length+' '+plural(P.cards.length,['карта','карты','карт'])+'</b>'
      +'<span class="sysub"> '+Object.keys(reg).map(function(n){return esc(n)+': '+reg[n];}).join(' · ')+'</span></div></div>'
      +'<div class="syrow"><div class="syn">Новое сырьё без КБЖУ: <b>'+P.nOrder.length+'</b><span class="sysub"> (заведено нулями. После загрузки в «Базе сырья» одним нажатием объединяется с вашим похожим сырьём, остальное заполните вручную)</span></div></div>'
      +'<div class="syrow"><div class="syn">Уже есть в базе, пропущено: <b>'+P.skips.length+'</b></div></div>'
      +'<div class="syrow"><div class="syn">Тексты разделов отличаются от файла: <b>'+((P.upds||[]).length)+'</b><span class="sysub"> (технология, подача, срок хранения; рецептура и цены не меняются)</span></div></div>'
      +'<div class="syrow"><div class="syn">Дубли файлов в облаке: <b>'+P.dups.length+'</b></div></div>'
      +'<div class="syrow"><div class="syn">Файлы с проблемами, не будут загружены: <b>'+P.probs.length+'</b></div></div></div>';
    h+=bulkList('Файлы с проблемами',P.probs,function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">'+esc(x.why)+'</span>';},P.probs.length<=15);
    h+=bulkList('Замечания по картам (карты создадутся)',P.warns,function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">'+esc(x.why)+'</span>';},false);
    h+=bulkList('Новое сырьё без КБЖУ',P.nOrder.map(function(k){return P.newIngs[k];}),function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">в картах: '+x.cards+(x.guess?' · похоже на «'+esc(x.guess)+'»':'')+'</span>';},false);
    h+=bulkList('Дубли файлов (берётся более новый)',P.dups,function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">то же, что '+esc(x.as)+'</span>';},false);
    h+=bulkUpdHtml(B);
    h+=bulkList('Уже есть в базе',P.skips,function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">'+esc(x.as)+'</span>';},false);
    h+='<div class="btns" style="margin-top:12px">'+(P.cards.length?'<button class="btn primary" data-act="bulkGo">Создать и опубликовать: '+P.cards.length+'</button>':'')
      +'<button class="btn" data-act="bulkCopy">Скопировать список</button><button class="btn" data-act="bulkClose">Закрыть</button></div>'
      +'<p class="hint">Публикация идёт пачками по 100 позиций и ничего не заменяет в общей базе: если карта с таким названием там уже появилась, она останется у вас в «Мои изменения».</p>'+syMsgHtml('imp');
    return h;
  }
  if(B.st==='done'){
    h+='<div class="sylist"><div class="syrow"><div class="syn"><b>'+(B.upd?'Обновлено карт: '+B.upd:'Создано карт: '+(B.made||0))+', опубликовано: '+(B.pub||0)+'</b>'
      +(B.newIng?'<span class="sysub"> · нового сырья без КБЖУ: '+B.newIng+'</span>':'')+'</div></div></div>';
    h+=bulkList('Не опубликованы (остались в «Мои изменения»)',B.left||[],function(x){return'<b>'+esc(x)+'</b>';},true);
    h+=bulkList('Слишком большие для одной ячейки таблицы',B.big||[],function(x){return'<b>'+esc(x)+'</b>';},true);
    if(P){
      h+=bulkList('Файлы с проблемами',P.probs,function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">'+esc(x.why)+'</span>';},true);
      h+=bulkList('Замечания по картам',P.warns,function(x){return'<b>'+esc(x.name)+'</b> <span class="sysub">'+esc(x.why)+'</span>';},false);
    }
    h+='<div class="btns" style="margin-top:12px"><button class="btn" data-act="bulkCopy">Скопировать список</button><button class="btn" data-act="bulkClose">Закрыть</button></div>'+syMsgHtml('imp');
    return h;
  }
  return h+syMsgHtml('imp');
}
function bulkBoxHtml(){
  if(!bulkShow())return'';
  if(!syV23())return'<details class="pgroup" id="syBulk" style="margin-top:12px"><summary>Загрузить все карты из облака в общую базу</summary><p class="hint" style="margin-top:0">Для этого нужен скрипт версии '+SY_PUB_V+': вставьте новый (вкладка «Личный кабинет» → «Настройка скрипта») и разверните «Новая версия». Он защищает общую базу от перезаписи при массовой загрузке.</p></details>';
  return'<details class="pgroup" id="syBulk" style="margin-top:12px"'+(S.sy.bulk?' open':'')+'>'+bulkInnerHtml()+'</details>';
}
function bulkClick(act,b){
  switch(act){
    case'bulkScan':bulkScan();return true;
    case'bulkStop':bulkStop();return true;
    case'bulkGo':bulkApply();return true;
    case'bulkUpd':bulkUpdApply();return true;
    case'bulkClose':bulkClose();return true;
    case'bulkCopy':if(S.sy.bulk)copyText(bulkText(S.sy.bulk),b);return true;
  }
  return false;
}
/*BULK-END*/
function viewCloud(){
  var d=S.sy.files,admin=syAdmin(),n=syMainFiles(),np=syPendFiles();
  var how='<details class="cloudhow"><summary>Как это устроено</summary><p class="hint" style="margin:6px 0 0">'+syCloudHow()+'</p></details>';
  var h='<section class="card" id="syCloud"><h2>ТТК в облаке'+(d&&d.ready?' · '+n:'')+'</h2>'
    +'<div class="btns" style="margin-top:0">'+(syCanSend()?'<button class="btn mini primary" data-act="syFUp">Добавить файл .docx</button>':'')+'<button class="btn mini" data-act="syFRefresh">Обновить список</button></div>'
    +(d&&d.ready&&syCanSend()?'<p class="sysub" id="syFUpHint" style="margin:6px 0 0">'+syFUpHint()+'</p>':'')
    +syMsgHtml('files');
  if(!d)return h+'<p class="hint">Загружаю список…</p>'+how+'</section>';
  if(!d.ready)return h+syFilesNoFolder()+how+'</section>';
  if(syOldScript())h+='<p class="hint cmsg warn" style="margin-top:10px">В таблице стоит скрипт прежней версии: файлы показываются общим списком, без папок. '+(admin?'Чтобы появились регионы и папки, вставьте новый скрипт поверх старого (вкладка «Личный кабинет» → «Настройка скрипта») и создайте новую версию развёртывания.':'Папки появятся после того, как технолог обновит скрипт.')+'</p>';
  else if(!syRegScript())h+='<p class="hint cmsg warn" style="margin-top:10px">В таблице стоит скрипт без папок регионов. '+(admin?'Вставьте новый скрипт поверх старого (вкладка «Личный кабинет» → «Настройка скрипта») и создайте новую версию развёртывания: на Диске появятся папки Волгоград и Москва.':'Папки регионов появятся после того, как технолог обновит скрипт.')+'</p>';
  h+='<div class="ccrumb" id="syFNav">'+syFNavHtml()+'</div>'+syFileSearchHtml()+'<div id="syFRegs">'+syRegChipsHtml()+'</div><div id="syFChips" style="margin-top:10px">'+syFChipsHtml()+'</div>'+syFToolsHtml();
  if(np&&admin&&syFLevel()==='top')h+='<p class="hint" style="margin:10px 0 0">Файлов на проверке: '+np+'. Откройте «На проверке»: файл открывается кнопкой «Открыть для правки», его можно поправить, затем принять в нужную папку, вернуть автору с комментарием или отклонить.</p>';
  return h+bulkBoxHtml()+'<div id="syFList">'+syFListHtml()+'</div>'+how+'</section>';
}
function syFilesPaint(){
  var a=$('#syFList'),c=$('#syFChips'),r=$('#syFRegs'),q=$('#syFQInfo'),nv=$('#syFNav');
  if(nv)nv.innerHTML=syFNavHtml();
  if(a)a.innerHTML=syFListHtml();
  if(c)c.innerHTML=syFChipsHtml();
  if(r)r.innerHTML=syRegChipsHtml();
  if(q){q.innerHTML=syFQInfoHtml();q.hidden=!syNorm(S.sy.fq);}
}
/* технолог: папки регионов на Диске приводятся к списку регионов калькулятора (создаются недостающие, переименовываются по названию региона) */
function syRegsDiffer(){
  var d=S.sy.files;if(!d||!d.ready||!Array.isArray(d.regs))return false;
  function clean(s){return String(s==null?'':s).replace(/[\\\/:*?"<>|\r\n]+/g,' ').replace(/\s+/g,' ').trim().slice(0,60);}
  return regionList().some(function(g){
    var f=d.regs.filter(function(r){return r.id===g.id;})[0];
    return!f||f.name!==clean(g.name);
  });
}
function syRegSync(){
  if(!syAdmin()||!syRegScript()||S.sy.busy.rsetup)return;
  var sig=JSON.stringify(regionList());
  if(S.sy.rsig===sig||!syRegsDiffer())return;
  S.sy.rsig=sig;syBusy('rsetup',true);
  syPost('rsetup',{regs:regionList().map(function(g){return{id:g.id,name:g.name};})},syCode()).then(function(){
    syBusy('rsetup',false);
    return syFilesLoad(true,true);
  },function(e){syBusy('rsetup',false);syMsg('files','err',syErrText(e));scheduleRender();});
}
function syLogReload(){return syGet({a:'log',n:120}).then(function(d){S.sy.log=d.items;},function(){});}
function syFileOpen(id,thenDl,review){
  if(S.sy.busy.fop)return;
  var f=S.sy.files&&S.sy.files.files.filter(function(x){return x.id===id;})[0],nm=f?f.name:'файл';
  if(review){
    if(S.sy.fr&&S.recipes[S.sy.fr.recId]){
      if(S.sy.fr.id!==id)flash('Сначала завершите проверку файла «'+S.sy.fr.name+'» или закройте её');
      frShow();return;
    }
    if(S.sy.rv&&rvTmpIds(S.sy.rv).length){flash('Сначала завершите проверку ТТК от '+S.sy.rv.by+' или закройте её');rvShow(rvTmpIds(S.sy.rv)[0]);return;}
  }
  syBusy('fop',true);syMsg('files','busy',(thenDl?'Скачиваю «':'Открываю «')+nm+'»…');
  syGet({a:'file',id:id},90000).then(function(d){
    var buf=b64ToBuf(d.b64),name=d.name||nm;
    syBusy('fop',false);syMsg('files','','');
    if(thenDl){
      var dn=safeName(name.replace(/\.docx$/i,''))+'.docx';
      syDlStart(id,buf,dn,f);return;                       /* все роли сначала выбирают шапку и юридическое лицо; справочник может быть пуст — тогда выбор из сохранённых шапок или «как в файле» */
      exportFile(new Uint8Array(buf),dn);return;
    }
    return loadTtkBuffer(buf,name,review?{cloudId:id,review:{id:id,name:nm,by:f?f.by:'',at:f?f.at:0}}:{cloudId:id});
  }).catch(function(e){syBusy('fop',false);syMsg('files','err',syErrText(e));});
}
/* шеф-повар: перед скачиванием можно поправить шапку (другое юридическое лицо, столовая, директор); по умолчанию — шапка, с которой он скачивал в прошлый раз */
function syDlStart(id,buf,name,f){
  return unzipEntry(buf,'word/document.xml').then(function(u8){
    var fl={},can=false,doc;
    if(u8){try{doc=new DOMParser().parseFromString(new TextDecoder('utf-8').decode(u8),'application/xml');fl=ttkFields(doc);can=!!hdrLocate(doc);}catch(e){fl={};can=false;}}
    var o={org:String(fl.org||'').trim(),head:String(fl.head||'').trim(),headName:String(fl.headName||'').trim(),date:String(fl.date||'').trim()},h={org:o.org,head:o.head,headName:o.headName,date:o.date},m=hdrPresets()[0];
    var reg=(f&&f.reg&&regKnown(f.reg))?f.reg:curRegion(),pt=drCurPtId();
    S.sy.dl={id:id,name:name,buf:buf,orig:o,hdr:h,can:can,busy:false,reg:reg,pt:pt};
    if(drOk()&&!S.dr.ld)drLoad(true);
    if(can){
      if(!drDlFromPt(S.sy.dl,pt)&&m){h.org=m.org;h.head=m.head;h.headName=m.headName;}
    }
    renderAll();
  },function(){exportFile(new Uint8Array(buf),name);});
}
/* есть ли смысл спрашивать юридическое лицо: справочник подключён и в нём есть юрлица для региона файла */
function drDlAsk(f){var reg=(f&&f.reg&&regKnown(f.reg))?f.reg:curRegion();return drOk()&&!!S.dr.ld&&drLesFor(reg).length>0;}
/* подставить юридическое лицо точки: сначала то, что этот пользователь выбирал для этой точки, затем юрлицо из карточки точки */
function drDlFromPt(d,ptId){
  var le=null,p=ptId?drPt(ptId):null,id;
  if(!p)return false;
  id=drLeMemGet(ptId);le=id?drLe(id):null;
  if(!le||le.active===false)le=p.le?drLe(p.le):null;
  if(!le||le.active===false)return false;
  var h=drHdrOf(le);d.hdr.org=h.org;d.hdr.head=h.head;d.hdr.headName=h.headName;
  return true;
}
function drDlPick(v){
  var d=S.sy.dl;if(!d)return;
  d.pt=v;
  if(v&&!drDlFromPt(d,v)){}
  renderAll();
}
/* предпросмотр шапки «Утверждаю» так, как она встанет в файле */
function drDlPreview(h){
  return'<div class="hdrprev" aria-label="Предпросмотр шапки"><div class="hp-t">Так шапка будет выглядеть в файле</div><div class="hp-b"><div>Утверждаю</div><div><b>'+esc([h.head,h.org].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' ')||'—')+'</b></div><div>________________ '+esc(String(h.headName||'').trim())+'</div><div>'+esc(String(h.date||'').trim())+'</div></div></div>';
}
function syDlPanelHtml(id){
  var d=S.sy.dl;if(!d||d.id!==id)return'';
  if(!d.can)return'<div class="dlhdr" id="dlHdr"><p class="hint" style="margin:0 0 8px">В этом файле нет шапки «Утверждаю», которую можно поправить: он скачается как есть.</p><div class="btns"><button class="btn primary" data-act="dlHdrRaw">Скачать</button><button class="btn" data-act="dlHdrNo">Отмена</button></div></div>';
  return'<div class="dlhdr" id="dlHdr">'+drDlPtHtml(d)+drDlEmptyHtml(d)+hdrBoxHtml('dl','dlHdrBox',d.hdr,d.orig,'Для какой столовой нужна карта? Выберите сохранённую шапку или впишите организацию, директора и дату: файл скачается уже с ними. В файле: '+esc(hdrLabel(d.orig)||'шапка пустая')+'.')
    +drDlPreview(d.hdr)
    +'<div class="btns" style="margin-top:6px"><button class="btn primary" data-act="dlHdrGo"'+(d.busy?' disabled':'')+'>Скачать с этой шапкой</button><button class="btn" data-act="dlHdrRaw">Скачать как в файле</button><button class="btn" data-act="dlHdrNo">Отмена</button></div></div>';
}
/* справочник пуст (или не загрузился): объясняем, что делать; технолог может завести юридическое лицо из введённой шапки */
function drDlEmptyHtml(d){
  var les;
  if(!drOk())return syLinked()?'<p class="dlnote">В общей базе пока старая версия скрипта без справочника юридических лиц: выберите сохранённую шапку или впишите реквизиты.</p>':'';
  if(!S.dr.ld)return S.dr.err?'<p class="dlnote cmsg err" role="alert">Справочник не загрузился: '+esc(S.dr.err)+'. Можно выбрать сохранённую шапку или скачать как в файле.</p>':'<p class="dlnote" role="status">Загружаю справочник юридических лиц…</p>';
  les=drLesFor(d.reg);
  if(les.length)return'';
  return'<p class="dlnote" role="status"><b>В справочнике нет юридических лиц.</b> '+(drCanLe()?'Впишите реквизиты ниже и нажмите «Добавить в справочник»: юрлицо появится у всех.':'Юридические лица добавляет технолог. Выберите сохранённую шапку или впишите реквизиты: они попадут только в этот файл.')+'</p>'
    +(drCanLe()&&String(d.hdr.org||'').trim()?'<div class="btns" style="margin-bottom:8px"><button class="btn mini" data-act="dlLeMake"'+(d.mk?' disabled':'')+'>Добавить «'+esc(String(d.hdr.org).trim().slice(0,40))+'» в справочник</button></div>':'');
}
function drDlLeMake(){
  var d=S.sy.dl,h;
  if(!d||d.mk)return;
  h=d.hdr;d.mk=true;renderAll();
  syPost('dirput',{kind:'le',j:{name:String(h.org||'').trim(),org:String(h.org||'').trim(),head:String(h.head||'').trim(),headName:String(h.headName||'').trim(),regs:[],active:true}}).then(function(){
    return drLoad(true);
  },function(e){flash('Не удалось добавить юридическое лицо: '+syErrText(e));}).then(function(){if(S.sy.dl){S.sy.dl.mk=false;drDlRemember(S.sy.dl);}renderAll();});
}
function drDlPtHtml(d){
  var pts=(drOk()&&S.dr.ld)?drPtsOf(d.reg):[];
  if(!pts.length)return'';
  return'<label class="field" style="max-width:360px;margin-bottom:8px"><span class="lbl">Точка (запоминается юридическое лицо для неё)</span><select data-act="dlPt" aria-label="Точка"><option value="">— не выбрана —</option>'+pts.map(function(p){return'<option value="'+esc(p.id)+'"'+(p.id===d.pt?' selected':'')+'>'+esc(p.name)+'</option>';}).join('')+'</select></label>';
}
/* запомнить выбор: если шапка совпала с юридическим лицом справочника — это выбор для данной точки у данного пользователя */
function drDlRemember(d){
  var k=hdrKey(d.hdr),le=null;
  if(!d.pt)return;
  S.dr.les.forEach(function(x){if(!le&&x.active!==false&&hdrKey(drHdrOf(x))===k)le=x;});
  if(le){drLeMemSet(d.pt,le.id);}
}
function syDlGo(){
  var d=S.sy.dl;if(!d||d.busy)return;
  d.busy=true;
  docxPatchHeader(d.buf,d.hdr,d.orig).then(function(u8){
    hdrPresetPut(d.hdr);drDlRemember(d);S.sy.dl=null;exportFile(u8,d.name);renderAll();
  },function(){d.busy=false;flash('Не удалось поправить шапку в файле. Скачайте его «как в файле».');renderAll();});
}
function syUploadBuf(name,buf,t,rep){
  var len=buf.byteLength!==undefined?buf.byteLength:buf.length;
  if(!syCanSend())return Promise.reject({code:'gas',err:'viewer',msg:'Это код шеф-повара: файлы добавлять нельзя'});
  if(len>3*1024*1024)return Promise.reject({code:'gas',msg:'Файл «'+name+'» больше 3 МБ.'});
  var x={name:name,b64:bufToB64(buf)};
  if(rep)x.rep=rep;
  if(t){var q=syPlaceReq(t.reg,t.dir);Object.keys(q).forEach(function(k){x[k]=q[k];});}
  return syPost('upload',x,syCode());
}
/* выбор в списке (перенос файла) держит фокус и откладывает перерисовку: снимаем фокус, чтобы список сразу обновился */
function syBlurSel(){var a=document.activeElement;if(a&&a.tagName==='SELECT'&&$('#view').contains(a))a.blur();}
function syUpDone(){return Promise.all([syFilesLoad(true),syLogReload()]).then(function(){syBlurSel();if(S.tab==='cloud'){renderPending=false;renderAll();}else scheduleRender();});}
function syFileUpload(files){
  files=Array.prototype.slice.call(files||[]);
  if(!files.length)return;
  if(S.sy.busy.fup)return;
  if(!syLinked()){flash('Сначала подключите общую базу');return;}
  if(!syCanSend()){flash('Это код шеф-повара: файлы добавлять нельзя');return;}
  var bad=files.filter(function(f){return!/\.docx$/i.test(f.name);});
  if(bad.length){syMsg('files','err','Нужны файлы Word с расширением .docx. Не подходит: '+bad.map(function(f){return f.name;}).join(', ')+'.');scheduleRender();return;}
  syBusy('fup',true);
  var ok=0,fail=[],admin=syAdmin(),tg=syUpTarget(),arc=0;
  function next(i){
    if(i>=files.length)return Promise.resolve();
    syMsg('files','busy','Загружаю '+(i+1)+' из '+files.length+': «'+files[i].name+'»…');
    return readBuf(files[i]).then(function(buf){return syUploadBuf(files[i].name,buf,tg);}).then(function(r){ok++;arc+=(r&&r.archived)||0;},function(e){fail.push('«'+files[i].name+'»: '+syErrText(e));}).then(function(){return next(i+1);});
  }
  next(0).then(function(){
    syBusy('fup',false);
    if(!admin&&ok){S.sy.creg='pend';S.sy.cdir='all';S.sy.fshow=SY_PAGE;}       /* редактор сразу видит свои файлы в «На проверке» */
    if(!fail.length)syMsg('files','ok','Загружено файлов: '+ok+'.'+(admin?(arc?' Прежних версий ушло в «Архив»: '+arc+'.':''):' Они ждут проверки технолога.')+' '+nowHm());
    else syMsg('files',ok?'warn':'err',(ok?'Загружено: '+ok+'. ':'')+'Не загружено: '+fail.join(' '));
    return syUpDone();
  });
}
function syFileSaveBuf(name,buf,key,tg,rep){
  if(S.sy.busy.fup)return;
  syBusy('fup',true);syMsg(key,'busy','Загружаю «'+name+'» в облако…');
  syUploadBuf(name,buf,tg,rep).then(function(r){
    syBusy('fup',false);
    /* исправленный файл взамен возвращённого (название могло немного измениться): прежний убирается из «На проверке» */
    var old=(syAdmin()||!(S.sy.files&&S.sy.files.files))?[]:S.sy.files.files.filter(function(x){
      return x.kind==='pend'&&x.st==='rework'&&x.id!==(r&&r.id)&&syNorm(x.by)===syNorm(S.sy.cfg.name)&&x.name!==name&&frSameFile(x.name,name);
    });
    old.forEach(function(x){syPost('fwithdraw',{id:x.id},S.sy.cfg.code).catch(function(){});});
    var dn=tg?syPlaceText(tg.reg,tg.dir):'';
    if(key==='fsave')flash(r&&r.kind==='pend'?'Отправлено технологу на проверку':'Файл сохранён в облаке');
    syMsg(key,'ok',(r&&r.kind==='pend'?'Файл «'+name+'» отправлен на проверку технологу'+(rep?'. Принятый файл заменится им, прежний уйдёт в «Архив».':'.'):'Файл «'+name+'» сохранён в облаке'+(dn?' («'+dn+'»).':'.')+(r&&r.archived?' Прежняя версия ушла в «Архив».':''))+' '+nowHm());
    return syUpDone();
  }).catch(function(e){syBusy('fup',false);syMsg(key,'err',syErrText(e));});
}
function syFileOp(op,id,doing,done,extra){
  if(S.sy.busy.fop||!syAdmin())return;
  var f=S.sy.files&&S.sy.files.files.filter(function(x){return x.id===id;})[0],nm=f?f.name:'файл';
  var x={id:id};if(extra)Object.keys(extra).forEach(function(k){x[k]=extra[k];});
  syBusy('fop',true);syMsg('files','busy',doing+' «'+nm+'»…');
  syPost(op,x,S.sy.cfg.code).then(function(){
    syBusy('fop',false);delete S.sy.fwant[id];
    var pt=extra&&extra.dir!==undefined?syPlaceText(extra.reg||'',extra.dir):'';
    syMsg('files','ok',done+' «'+nm+'»'+(pt?' ('+pt+')':'')+' · '+nowHm());
    return syUpDone();
  }).catch(function(e){syBusy('fop',false);syMsg('files','err',syErrText(e));syBlurSel();scheduleRender();});
}
/* папки библиотеки: создать, переименовать, удалить (пустую) */
function syDirOp(op,extra,doing,done,after){
  if(S.sy.busy.fop||!syAdmin())return;
  syBusy('fop',true);syMsg('files','busy',doing);
  syPost(op,extra,S.sy.cfg.code).then(function(r){
    syBusy('fop',false);
    syMsg('files','ok',done(r||{})+' · '+nowHm());
    if(after)after(r||{});
    return syUpDone();
  }).catch(function(e){syBusy('fop',false);syMsg('files','err',syErrText(e));syBlurSel();scheduleRender();});
}
function syDirAdd(){
  var nm=String(S.sy.fnew||'').replace(/\s+/g,' ').trim().slice(0,60);
  if(!nm){syMsg('files','err','Введите название папки.');return;}
  var reg=syFReg();if(reg==='pend'||reg==='arch')reg=syDefReg();
  var x={name:nm};
  if(syRegScript()){x.reg=reg;if(reg)x.regName=syFRegName(reg);}
  syDirOp('dcreate',x,'Создаю папку «'+nm+'»…',function(r){return'Папка «'+(r.name||nm)+'» создана';},function(r){S.sy.fnew='';S.sy.fadm=false;if(r.id){S.sy.creg=reg;S.sy.cdir=r.id;S.sy.fshow=SY_PAGE;}});
}
function syDirRename(){
  var id=syRealDir(),nm=String(S.sy.frenv||'').replace(/\s+/g,' ').trim().slice(0,60);
  if(!id)return;
  if(!nm){syMsg('files','err','Введите название папки.');return;}
  syDirOp('drename',{id:id,name:nm},'Переименовываю…',function(r){return'Папка переименована: «'+(r.name||nm)+'»';},function(){S.sy.fren=null;});
}
