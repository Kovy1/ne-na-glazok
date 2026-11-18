/* ---------- декларации о соответствии: отметка задекларированных блюд в меню ----------
   Отметка хранится в самой ТТК по регионам, как цена продажи: r.ds[регион] = {g: группа продукции, n: номер декларации ('' — номер не указан), src: файл, d: дата отметки}.
   Поэтому отметки уходят в общую базу вместе с ТТК (технолог отправляет изменённые карты как обычно) и видны всем в этом регионе.
   Ставит и снимает отметки технолог; остальные видят значок «ДС» и фильтр. Декларации разбираются из .docx или из вставленного текста
   (списки «Группа: блюдо, блюдо, …» из «Заявляет, что:» и «Приложения 1», либо список по строке на блюдо, как в выгрузке 1С). */
function dsOf(r,g){var x=r&&r.ds&&r.ds[g||curRegion()];return x||null;}
function dsToday(){return new Date().toISOString().slice(0,10);}
function dsIsoRu(d){return d?d.slice(8,10)+'.'+d.slice(5,7)+'.'+d.slice(0,4):'';}
function dsExpired(x){return!!(x&&x.v&&x.v<dsToday());}
/* «Задекларировано» — есть отметка и срок не истёк; отметка с истёкшим сроком считается отдельно */
function dsValid(x){return!!x&&!dsExpired(x);}
function dsSoon(x){if(!x||!x.v||dsExpired(x))return false;var d=new Date(x.v+'T00:00:00');return(d-new Date())<60*864e5;}
function dsTitle(x){return(dsExpired(x)?'Срок декларации истёк '+dsIsoRu(x.v)+': ':'Задекларировано: ')+(x.g||'группа не указана')+(x.n?' · декларация '+x.n:' · номер декларации не указан (проект)')+(x.v&&!dsExpired(x)?' · действует по '+dsIsoRu(x.v):'');}
function dsCls(x){return'dsb'+(dsExpired(x)?' dsx':(x.n?'':' dsp'))+(dsSoon(x)?' dss':'');}
function dsBadge(r){var x=dsOf(r);return x?' <span class="'+dsCls(x)+'" title="'+esc(dsTitle(x))+'">'+(dsExpired(x)?'ДС истекла':'ДС')+'</span>':'';}
function dsCanEdit(){return!uiRO()&&!syLimited()&&(!syLinked()||syAdmin());}
function dsCount(g){var n=0;visIds(g).forEach(function(id){var r=S.recipes[id];if(!r.arch&&dsOf(r,g))n++;});return n;}

/* ---- разбор ---- */
var DS_SKIP=/^(действ|заявитель|место|адрес|огрн|в лице|изготовитель|продукция изготовлена|продукция|соответствует|дополнительная|декларация|регистрационн|дата|срок|условия|наименование|код|схема|протокол|приложение|сведения|подпись|м\.?п)/i;
function dsDepthSplit(s,re){                                  /* делит по разделителю вне скобок и кавычек «…» */
  var out=[],cur='',d=0,q=0,i,c,m;
  for(i=0;i<s.length;i++){
    c=s[i];
    if(c==='('||c==='[')d++;else if((c===')'||c===']')&&d>0)d--;
    else if(c==='«')q++;else if(c==='»'&&q>0)q--;
    if(!d&&!q){re.lastIndex=0;m=re.exec(s.slice(i));if(m&&m.index===0){out.push(cur);cur='';i+=m[0].length-1;continue;}}
    cur+=c;
  }
  out.push(cur);return out;
}
/* «Котлета мясная, Котлета свиная. Салат Деревенский» → названия; часть с маленькой буквы — продолжение названия с запятой («Картофель, запеченный с паприкой») */
function dsItems(list,notes){
  var parts=dsDepthSplit(list,/^(?:,|;|\.\s+(?=[А-ЯЁA-Z«"“]))/),out=[];
  parts.forEach(function(p){
    p=p.replace(/\s+/g,' ').trim();
    if(!p)return;
    if(/^[а-яё]/.test(p)&&out.length){out[out.length-1]+=', '+p;return;}
    out.push(p);
  });
  return out.map(function(p){
    var rm=/\(([^)]*(убрать|исключ|удалить)[^)]*)\)/i.exec(p);
    if(rm){notes.push('«'+p.replace(rm[0],'').trim()+'» не взято: в файле пометка «'+rm[1].trim()+'»');return null;}
    return dsItem(p);
  }).filter(function(x){return x&&x.nm;});
}
/* строка позиции: убираем номер строки, «СО» из 1С, массу и «ТТК №…»; номер ТТК сохраняем для сверки */
function dsItem(s){
  var t=String(s).replace(/\s+/g,' ').trim(),ttk='',m;
  m=/\(?\s*ТТК\s*№?\s*([0-9][0-9\/.\-]*)\s*\)?/i.exec(t);
  if(m){ttk=m[1].replace(/[.\-]$/,'');t=t.replace(m[0],' ');}
  t=t.replace(/^\d{1,4}[.)]?\s+(?=\S)/,'').replace(/^СО\s+/,'')
    .replace(/\s\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:гр|г|мл|кг|л)\.?(?=\s|$)/gi,' ')
    .replace(/[.;,\s]+$/,'').replace(/\s+/g,' ').trim();
  return{nm:t,ttk:ttk};
}
function dsHead(h){return h.replace(/\s+/g,' ').replace(/\s*в ассортименте\s*$/i,'').replace(/[.\s]+$/,'').trim();}
function dsRuIso(s){var m=/(\d{2})\.(\d{2})\.(\d{4})/.exec(String(s||''));return m?m[3]+'-'+m[2]+'-'+m[1]:'';}
/* «действительна с даты регистрации по 21.09.2031», «Действует по: 21.09.2031»; «Дата регистрации … 22.09.2026» */
function dsValidTo(text){var m=/действ[а-яё]*[^\n]{0,80}?(?:^|[\s(])по[:\s]+(\d{2}\.\d{2}\.\d{4})/i.exec(text);return m?dsRuIso(m[1]):'';}
function dsRegDate(text){var m=/дата\s+регистрации[^\n]{0,60}?(\d{2}\.\d{2}\.\d{4})/i.exec(text);return m?dsRuIso(m[1]):'';}
/* файл со многими декларациями (реестр): блок начинается строкой «Декларация: <номер>» */
function dsParseMany(paras,file){
  var blocks=[],cur=null;
  paras.forEach(function(p){
    if(/^\s*Декларация\s*(?:№|N)?\s*:/i.test(p)){cur=[p];blocks.push(cur);}else if(cur)cur.push(p);
  });
  if(blocks.length<1||!blocks.every(function(b){return/Заявляет|:/i.test(b.slice(1).join('\n'));}))return[dsParse(paras,file)];
  return blocks.map(function(b,i){var d=dsParse(b,file);d.part=i+1;return d;});
}
function dsNum(text){
  var re=/ЕАЭС\s*N\s*RU\s*Д-RU\.[^\s,;]+/gi,m,best='';
  while((m=re.exec(text))){if(!/[ХX]{3,}/i.test(m[0])){best=m[0].replace(/\s+/g,' ').replace(/[.;,]+$/,'');break;}}
  return best;
}
/* paras — абзацы (ячейки таблиц тоже абзацы); → {title, num, groups:[{g, items:[{nm,ttk}]}], notes} */
function dsParse(paras,file){
  var res={file:String(file||'').slice(0,120),title:'',num:'',groups:[],notes:[]},text=paras.join('\n'),decl=/Заявляет,?\s*что\s*:/i.test(text),i,p,lastG=null;
  res.num=dsNum(text);res.v=dsValidTo(text);res.r=dsRegDate(text);
  function addG(head,list){
    var items=dsItems(list,res.notes);if(!items.length)return null;
    var g={g:dsHead(head)||res.title||'Без группы',items:items};res.groups.push(g);return g;
  }
  /* «Группа: список. Группа: список» внутри одного абзаца */
  function scan(s){
    var segs=[],re=/(^|[.;]\s+|\n)([^:.;\n]{3,220}):\s*/g,m,starts=[];
    while((m=re.exec(s)))starts.push({at:m.index+m[1].length,head:m[2],body:re.lastIndex});
    starts.forEach(function(x,k){var end=k+1<starts.length?starts[k+1].at:s.length;segs.push({head:x.head,list:s.slice(x.body,end)});});
    return segs;
  }
  if(!decl){                                                   /* простой список: по строке на блюдо (или одна строка через запятую) */
    var lines=paras.map(function(x){return x.trim();}).filter(Boolean);
    if(lines.length===1&&lines[0].indexOf(',')>-1)lines=dsDepthSplit(lines[0],/^,/);
    var g0={g:'',items:[]};
    lines.forEach(function(l){var it=dsItem(l);if(it.nm&&it.nm.length>1&&!/^(№|наименование)/i.test(it.nm))g0.items.push(it);});
    if(g0.items.length)res.groups.push(g0);
    return res;
  }
  for(i=0;i<paras.length;i++){
    p=paras[i].replace(/\s+/g,' ').trim();if(!p)continue;
    var dm=/^Заявляет,?\s*что\s*:\s*(.*)$/i.exec(p);
    if(dm){
      var body=dm[1],first=body.split(/[.:]/)[0].trim();res.title=dsHead(first);
      if(/смотри\s+приложение|см\.\s*приложение/i.test(body)&&body.indexOf(',')<0){lastG=null;continue;}
      var segs=scan(body);
      if(!segs.length){                                        /* «Изделия мучные кулинарные в ассортименте. Блины с джемом, Блинчики, …» — список без подзаголовка */
        var rest=body.replace(/^[^.]*\.\s*/,'');
        lastG=rest.indexOf(',')>-1?addG(res.title,rest):null;
        continue;
      }
      segs.forEach(function(sg){var hd=sg.head.replace(/^.*?в ассортименте\.\s*/i,'');lastG=addG(hd,sg.list);});
      continue;
    }
    var hm=/^([^:]{3,220}):\s*(.*)$/.exec(p);
    if(hm&&!DS_SKIP.test(hm[1].trim())){
      if(!hm[2].trim()){                                       /* список в следующем абзаце */
        var nx=(paras[i+1]||'').replace(/\s+/g,' ').trim();
        if(nx&&nx.indexOf(':')<0){lastG=addG(hm[1],nx);i++;}else lastG=null;
        continue;
      }
      var ss=scan(p);
      if(ss.length>1)ss.forEach(function(sg){lastG=addG(sg.head,sg.list);});else lastG=addG(hm[1],hm[2]);
      continue;
    }
    if(hm){lastG=null;continue;}
    if(lastG&&p.indexOf(',')>-1&&p.length<2000&&!DS_SKIP.test(p)){       /* продолжение списка в соседнем абзаце той же ячейки */
      var more=dsItems(p,res.notes),have={};lastG.items.forEach(function(x){have[dsKey(x.nm)]=1;});
      more.forEach(function(x){if(!have[dsKey(x.nm)])lastG.items.push(x);});
      continue;
    }
    lastG=null;
  }
  return res;
}
function dsDocxParas(buf){
  return unzipEntry(buf,'word/document.xml').then(function(u8){
    if(!u8)throw new Error('В файле нет текста документа Word');
    var doc=new DOMParser().parseFromString(new TextDecoder('utf-8').decode(u8),'application/xml'),ps=doc.getElementsByTagNameNS(W_NS,'p'),out=[],i;
    for(i=0;i<ps.length;i++)out.push(pText(ps[i]));
    return out;
  });
}

/* ---- сопоставление с ТТК ---- */
var DS_STOP={'с':1,'со':1,'и':1,'в':1,'во':1,'на':1,'по':1,'из':1,'под':1,'для':1,'от':1,'к':1};
function dsKey(s){
  return normKey(String(s==null?'':s).replace(/\(?\s*ТТК\s*№?\s*[0-9][0-9\/.\-]*\s*\)?/gi,' ').replace(/^СО\s+/,'')
    .replace(/\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:гр|г|мл|кг|л)(?![а-яёa-z])\.?/gi,' ').replace(/(?:^|\s)\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+(?=\s|$)/g,' ').replace(/[«»"“”„']/g,''));
}
function dsStems(s){var o={};dsKey(s).split(' ').forEach(function(w){if(w&&!DS_STOP[w]&&!/^\d+$/.test(w))o[w.slice(0,5)]=1;});return o;}
function dsDice(a,b){var na=Object.keys(a).length,nb=Object.keys(b).length,c=0,k;if(!na||!nb)return 0;for(k in a)if(b[k])c++;return 2*c/(na+nb);}
function dsSameSet(a,b){var ka=Object.keys(a),kb=Object.keys(b);return ka.length===kb.length&&ka.every(function(k){return b[k];});}
function dsNumOf(r){return String(ttkVal(r,'num')||'').replace(/\s+/g,'').replace(/^№/,'');}
function dsIndex(g){
  var list=[];
  visIds(g).forEach(function(id){
    var r=S.recipes[id],names=[recBase(r),ttkVal(r,'dish')].concat(r.aliases||[]),keys={},st=[];
    names.forEach(function(n){var k=dsKey(n);if(k&&!keys[k]){keys[k]=1;st.push(dsStems(n));}});
    list.push({id:id,keys:keys,stems:st,num:dsNumOf(r)});
  });
  return list;
}
/* → {id, how: exact|close|fuzzy|none, cands:[{id,score}], why} ; exact и close отмечены по умолчанию, fuzzy — только выбором человека */
function dsMatch(it,ix){
  var k=dsKey(it.nm),st=dsStems(it.nm),k2=dsKey(it.nm.replace(/\s*вариант\s*\d+\s*/i,' ')),hits=[],i,e,best=null;
  for(i=0;i<ix.length;i++){
    e=ix[i];
    var sc=0,how='';
    if(e.keys[k]||e.keys[k2]){sc=1;how='exact';}
    else{e.stems.forEach(function(s){var d=dsDice(st,s);if(dsSameSet(st,s)){d=0.99;}if(d>sc)sc=d;});how=sc>=0.99?'close':(sc>=0.5?'fuzzy':'');}
    if(it.ttk&&e.num&&e.num===it.ttk&&sc>=0.4)sc+=0.2;
    if(how||sc>=0.6)hits.push({id:e.id,score:sc,how:how||'fuzzy',num:e.num});
  }
  hits.sort(function(a,b){return b.score-a.score;});
  if(!hits.length)return{id:'',how:'none',cands:[]};
  best=hits[0];
  var res={id:best.id,how:best.how,cands:hits.slice(0,5)};
  if((res.how==='close'||res.how==='exact')&&hits[1]&&hits[1].score>=0.99&&hits[1].score>=best.score-0.001){res.how='fuzzy';res.why='в меню несколько блюд с таким названием';}   /* решает человек */
  if(res.how!=='fuzzy'&&it.ttk&&best.num&&best.num!==it.ttk){res.how='fuzzy';res.why='№ ТТК в декларации '+it.ttk+', в карте '+best.num;}
  if(res.how==='fuzzy')res.id='';
  return res;
}

/* ---- состояние разбора и применение ---- */
S.dsImp=null;      /* {g:регион, docs:[{file,title,num,groups,notes}], rows:[{di,gi,ii,nm,ttk,m,pick,on}]} */
function dsBuildRows(imp){
  var ix=dsIndex(imp.g),rows=[];
  imp.docs.forEach(function(d,di){d.groups.forEach(function(gr,gi){gr.items.forEach(function(it,ii){
    var m=dsMatch(it,ix);
    rows.push({di:di,gi:gi,nm:it.nm,ttk:it.ttk,m:m,pick:m.id||(m.cands[0]?'':''),on:m.how==='exact'||m.how==='close'});
  });});});
  imp.rows=rows;
}
function dsAddDocs(list){
  var g=curRegion(),imp=S.dsImp&&S.dsImp.g===g?S.dsImp:{g:g,docs:[],rows:[]};
  list.forEach(function(d){if(d.groups.length)imp.docs.push(d);});
  dsBuildRows(imp);S.dsImp=imp;S.dsOpen=true;
}
/* короткую группу («Горячие супы») уточняем названием декларации, длинную («Изделия кулинарные мясные …») оставляем как есть */
function dsGroupLabel(d,gr){var g=gr.g||'',t=(d.title&&g&&g!==d.title&&g.split(' ').length<=3)?d.title+' — '+g:(g||d.title||d.file||'Без группы');return t.slice(0,DS_MAX_G);}
function dsEntry(d,gr,today){var e={g:dsGroupLabel(d,gr),n:String(d.num||'').slice(0,DS_MAX_N),src:d.file,d:today};if(d.v)e.v=d.v;if(d.r)e.r=d.r;return e;}
function dsApply(){
  var imp=S.dsImp,g=imp.g,today=new Date().toISOString().slice(0,10),n=0,re=0,seen={};
  imp.rows.forEach(function(x){
    if(!x.on||!x.pick||!S.recipes[x.pick])return;
    var d=imp.docs[x.di],gr=d.groups[x.gi],r=S.recipes[x.pick],old=dsOf(r,g),e=dsEntry(d,gr,today);
    if(seen[x.pick])return;seen[x.pick]=1;
    if(old&&old.g===e.g&&old.n===e.n&&(old.v||'')===(e.v||''))return;
    if(old)re++;
    r.ds=r.ds||{};r.ds[g]=e;queueSave('recipes',x.pick);n++;
  });
  return{n:n,re:re};
}
/* ---- реестр деклараций региона на этом устройстве: по нему новые и переименованные ТТК отмечаются автоматически ---- */
function dsRegKey(g){return'kbzhu:dsreg:'+(g||curRegion());}
function dsRegGet(g){try{var v=JSON.parse(lsGet(dsRegKey(g))||'[]');return Array.isArray(v)?v:[];}catch(e){return[];}}
function dsRegPut(g,list){lsSet(dsRegKey(g),JSON.stringify(list.slice(0,60)));dsAuto.memo=null;}
function dsRegSave(g,docs){
  var list=dsRegGet(g);
  docs.forEach(function(d){
    var c={title:d.title||'',file:d.file||'',num:d.num||'',v:d.v||'',r:d.r||'',groups:d.groups.map(function(gr){return{g:gr.g,items:gr.items.map(function(x){return{nm:x.nm,ttk:x.ttk||''};})};})},
      labels=c.groups.map(function(gr){return dsGroupLabel(c,gr);}).sort().join('|');
    list=list.filter(function(o){                                              /* та же декларация (номер) или тот же проект (те же группы без номера) заменяется */
      if(c.num&&o.num===c.num)return false;
      return!(o.groups.map(function(gr){return dsGroupLabel(o,gr);}).sort().join('|')===labels&&(!o.num||!c.num||o.num===c.num));
    });
    list.push(c);
  });
  dsRegPut(g,list);
}
/* что можно отметить или обновить по реестру без участия человека: только точные и почти точные совпадения; у блюда в нескольких декларациях
   берётся декларация с номером, затем с самым поздним сроком */
function dsAuto(g){
  g=g||curRegion();
  var reg=dsRegGet(g),sig;
  if(!reg.length)return[];
  sig=g+'|'+lsGet(dsRegKey(g)).length+'|'+visIds(g).map(function(id){var r=S.recipes[id];return id+':'+r.name+':'+dsNumOf(r)+':'+JSON.stringify(r.ds&&r.ds[g]||'');}).join(',');
  if(dsAuto.memo&&dsAuto.memo.sig===sig)return dsAuto.memo.v;
  var ix=dsIndex(g),best={},today=dsToday(),out=[];
  function rank(e){return(e.n?2:0)+(e.v&&e.v>=today?1:0);}
  reg.forEach(function(d){d.groups.forEach(function(gr){gr.items.forEach(function(it){
    var m=dsMatch(it,ix);if(!(m.how==='exact'||m.how==='close')||!m.id)return;
    var e=dsEntry(d,gr,today),b=best[m.id];
    if(!b||rank(e)>rank(b.e)||(rank(e)===rank(b.e)&&(e.v||'')>(b.e.v||'')))best[m.id]={e:e,nm:it.nm,how:m.how};
  });});});
  Object.keys(best).forEach(function(id){
    var r=S.recipes[id],old=dsOf(r,g),e=best[id].e;
    if(old&&old.g===e.g&&old.n===e.n&&(old.v||'')===(e.v||''))return;
    if(old&&old.n&&!e.n)return;                                               /* проект не заменяет декларацию с номером */
    out.push({id:id,nm:best[id].nm,how:best[id].how,e:e,old:old});
  });
  out.sort(function(a,b){return String(S.recipes[a.id].name).localeCompare(String(S.recipes[b.id].name),'ru');});
  dsAuto.memo={sig:sig,v:out};
  return out;
}
function dsAutoApply(g){
  var list=dsAuto(g),today=dsToday();
  list.forEach(function(x){var r=S.recipes[x.id];r.ds=r.ds||{};x.e.d=today;r.ds[g]=x.e;queueSave('recipes',x.id);});
  dsAuto.memo=null;return list.length;
}
function dsAutoBarHtml(){
  if(!dsCanEdit())return'';
  var l=dsAuto(),nw=0,up=0;if(!l.length)return'';
  l.forEach(function(x){if(x.old)up++;else nw++;});
  return'<div class="incbar dsauto" role="status"><b>Декларации: '+(nw?'можно отметить '+nw+' '+plural(nw,['блюдо','блюда','блюд']):'')+(nw&&up?', ':'')+(up?'обновить отметку у '+up+' (номер или срок)':'')+'</b>'
    +'<button type="button" class="btn mini" data-act="dsAutoGo" data-edit>Отметить по декларациям</button>'
    +'<button type="button" class="incmore" data-act="dsAutoMore" aria-expanded="'+(!!S.dsAutoMore)+'">Какие блюда</button>'
    +(S.dsAutoMore?'<ul class="dslist">'+l.map(function(x){return'<li>'+esc(S.recipes[x.id].name||'')+' — '+esc(x.e.g)+(x.e.n?' ('+esc(x.e.n)+')':' (номер не указан)')+(x.how==='close'?' <small class="muted">почти совпадает с «'+esc(x.nm)+'»</small>':'')+'</li>';}).join('')+'</ul>':'')+'</div>';
}
function dsUnmark(g,ids){var n=0;ids.forEach(function(id){var r=S.recipes[id];if(r&&r.ds&&r.ds[g]){delete r.ds[g];if(!Object.keys(r.ds).length)delete r.ds;queueSave('recipes',id);n++;}});return n;}

/* ---- интерфейс: блок в «Дополнительных действиях» меню ---- */
function dsPanelHtml(){
  var g=curRegion(),can=dsCanEdit(),by={},ids=[],h;
  visIds(g).forEach(function(id){var x=dsOf(S.recipes[id],g);if(x){(by[x.g]||(by[x.g]=[])).push(id);ids.push(id);}});
  if(!can&&!ids.length)return'';
  h='<details class="pgroup" id="dsPanel"'+(S.dsOpen?' open':'')+'><summary>Декларации о соответствии · '+ids.length+'</summary>'
    +'<p class="hint" style="margin:8px 0 0">Задекларированные блюда помечены в меню значком <span class="dsb">ДС</span> (регион «'+esc(regionName(g))+'»). Значок <span class="dsb dsp">ДС</span> с пунктиром — номер декларации не указан (проект). Отметка хранится в ТТК'+(syLinked()?' и уходит в общую базу вместе с картой, когда вы отправите изменения':'')+'.</p>';
  if(can)h+='<div class="btns" style="margin:10px 0"><button class="btn" data-act="dsPick" data-edit title="Файлы Word (.docx) или текст (.txt). Старый формат .doc откройте в Word и сохраните как .docx">Загрузить декларации (.docx, .txt)</button>'
    +'<button class="btn" data-act="dsPasteOpen" data-edit>Вставить список текстом</button></div>'
    +(S.dsPaste?'<div class="dspaste"><label class="field grow"><span class="lbl">Список блюд: по строке на блюдо, или текст декларации со строками «Группа: блюдо, блюдо, …»</span><textarea id="dsText" rows="8" data-fk="dstext" placeholder="Например:&#10;СО Булочка с творогом 90г ТТК №1491&#10;СО Ватрушка с творогом 75г ТТК №50"></textarea></label>'
      +'<label class="field w280"><span class="lbl">Группа продукции</span><input id="dsTextG" maxlength="160" autocomplete="off" placeholder="Например: Выпечка"></label>'
      +'<label class="field w280"><span class="lbl">Номер декларации (если есть)</span><input id="dsTextN" maxlength="80" autocomplete="off" placeholder="ЕАЭС N RU Д-RU.…"></label>'
      +'<div class="btns"><button class="btn primary" data-act="dsPasteGo" data-edit>Разобрать</button><button class="btn" data-act="dsPasteClose">Отмена</button></div></div>':'');
  if(S.dsImp&&S.dsImp.g===g)h+=dsImpHtml();
  var reg=can?dsRegGet(g):[];
  if(reg.length)h+='<details class="dsg"><summary><b>Реестр деклараций на этом устройстве</b> · '+reg.length+'</summary><p class="hint" style="margin:4px 0">По реестру новые и переименованные ТТК с совпадающим названием отмечаются кнопкой «Отметить по декларациям» над меню, без повторной загрузки файлов.</p><ul class="dslist">'
    +reg.map(function(d,i){var n=d.groups.reduce(function(a,x){return a+x.items.length;},0),ex=d.v&&d.v<dsToday();return'<li>'+esc(d.title||d.file||'Декларация')+' · '+n+' '+plural(n,['позиция','позиции','позиций'])+' · '+(d.num?esc(d.num):'номер не указан')+(d.v?' · <span class="'+(ex?'dswarn':'')+'">'+(ex?'срок истёк ':'действует по ')+dsIsoRu(d.v)+'</span>':'')+' <button class="btn mini" data-act="dsRegDrop" data-i="'+i+'" data-edit>Убрать</button></li>';}).join('')+'</ul></details>';
  if(ids.length){
    h+='<div class="dsgroups">'+Object.keys(by).sort(function(a,b){return a.localeCompare(b,'ru');}).map(function(gk){
      var arr=by[gk].slice().sort(byName(S.recipes)),x=dsOf(S.recipes[arr[0]],g);
      return'<details class="dsg"><summary><b>'+esc(gk||'Без группы')+'</b> · '+arr.length+' '+plural(arr.length,['блюдо','блюда','блюд'])+' · '+(x.n?esc(x.n):'номер не указан')+(x.v?' · <span class="'+(dsExpired(x)?'dswarn':'')+'">'+(dsExpired(x)?'срок истёк ':'по ')+dsIsoRu(x.v)+'</span>':'')+'</summary>'
        +'<ul class="dslist">'+arr.map(function(id){return'<li data-rid="'+esc(id)+'">'+esc(S.recipes[id].name||'Без названия')+(S.recipes[id].arch?' <small class="muted">(в архиве)</small>':'')+(can?' <button class="btn mini" data-act="dsOff" data-edit>Снять</button>':'')+'</li>';}).join('')+'</ul>'
        +(can?'<button class="btn mini" data-act="dsOffG" data-g="'+esc(gk)+'" data-edit>Снять отметки всей группы</button>':'')+'</details>';
    }).join('')+'</div>';
  }
  return h+'</details>';
}
function dsHowTxt(m){return{exact:'совпадает',close:'почти совпадает — проверьте',fuzzy:'похоже — выберите блюдо',none:'нет в меню'}[m.how];}
function dsImpHtml(){
  var imp=S.dsImp,rows=imp.rows,on=rows.filter(function(x){return x.on&&x.pick;}).length,none=rows.filter(function(x){return x.m.how==='none';}).length,h='';
  h+='<div class="dsimp card"><b>Разбор деклараций</b><p class="hint">Найдено позиций: '+rows.length+'. Совпали с ТТК и отмечены: '+on+'. Не найдены в меню: '+none+'. Проверьте список и нажмите «Отметить в меню».</p>';
  imp.docs.forEach(function(d,di){
    h+='<div class="dsdoc"><div class="fgrid"><span class="field grow"><b>'+esc(d.title||d.file||'Декларация')+'</b>'+(d.file?' <small class="muted">'+esc(d.file)+'</small>':'')+'</span>'
      +'<label class="field w280"><span class="lbl">Номер декларации</span><input data-act="dsNumSet" data-di="'+di+'" maxlength="80" autocomplete="off" value="'+esc(d.num||'')+'" placeholder="не указан (проект)"></label>'
      +'<button class="btn mini" data-act="dsDocDrop" data-di="'+di+'">Убрать файл</button></div>'
      +((d.v||d.r)?'<p class="hint" style="margin:2px 0">'+(d.r?'Зарегистрирована '+dsIsoRu(d.r)+'. ':'')+(d.v?(d.v<dsToday()?'<span class="dswarn">Срок истёк '+dsIsoRu(d.v)+'.</span>':'Действует по '+dsIsoRu(d.v)+'.'):'')+'</p>':'');
    (d.notes||[]).forEach(function(n){h+='<p class="hint cmsg warn">'+esc(n)+'</p>';});
    d.groups.forEach(function(gr,gi){
      h+='<div class="dsgr"><small class="muted">'+esc(dsGroupLabel(d,gr))+'</small>';
      rows.forEach(function(x,ri){
        if(x.di!==di||x.gi!==gi)return;
        var opts=x.m.cands.map(function(c){var r=S.recipes[c.id];return'<option value="'+esc(c.id)+'"'+(x.pick===c.id?' selected':'')+'>'+esc(r.name||'Без названия')+(c.num&&String(r.name||'').indexOf(c.num)<0?' (ТТК №'+esc(c.num)+')':'')+'</option>';}).join('');
        h+='<div class="dsrow ds-'+x.m.how+'"><label class="dsck"><input type="checkbox" data-act="dsRowOn" data-ri="'+ri+'"'+(x.on&&x.pick?' checked':'')+(x.m.cands.length?'':' disabled')+'> '+esc(x.nm)+(x.ttk?' <small class="muted">ТТК №'+esc(x.ttk)+'</small>':'')+'</label>'
          +(x.m.cands.length?'<select data-act="dsRowPick" data-ri="'+ri+'" aria-label="Блюдо меню для «'+esc(x.nm)+'»"><option value="">— выберите блюдо —</option>'+opts+'</select>':'')
          +'<small class="dshow">'+esc(dsHowTxt(x.m))+(x.m.why?': '+esc(x.m.why):'')+'</small></div>';
      });
      h+='</div>';
    });
    h+='</div>';
  });
  h+='<div class="btns" style="margin-top:10px"><button class="btn primary" data-act="dsApply" data-edit'+(on?'':' disabled')+'>Отметить в меню ('+on+')</button><button class="btn" data-act="dsImpCancel">Закрыть разбор</button></div></div>';
  return h;
}
function dsReadFiles(files){
  var jobs=Array.prototype.map.call(files,function(f){   /* → массив деклараций на файл */
    var nm=f.name||'файл';
    if(/\.docx$/i.test(nm))return f.arrayBuffer().then(dsDocxParas).then(function(ps){return dsParseMany(ps,nm);});
    if(/\.(txt|csv)$/i.test(nm))return f.text().then(function(t){return dsParseMany(t.split(/\r?\n/),nm);});
    return Promise.resolve({file:nm,err:/\.doc$/i.test(nm)?'старый формат .doc: откройте файл в Word и сохраните как .docx':(/\.rtf$/i.test(nm)?'формат .rtf: сохраните как .docx или вставьте список текстом':'формат не поддерживается')});
  });
  return Promise.all(jobs.map(function(p){return p.catch(function(e){return{err:(e&&e.message)||'не удалось прочитать'};});})).then(function(l){var o=[];l.forEach(function(x){if(Array.isArray(x))o=o.concat(x);else o.push(x);});return o;});
}
function dsFilesPicked(files){
  dsReadFiles(files).then(function(list){
    var ok=[],bad=[];
    list.forEach(function(d){if(d.err)bad.push((d.file?'«'+d.file+'»: ':'')+d.err);else if(!d.groups.length)bad.push('«'+d.file+'»: не найден список блюд');else ok.push(d);});
    if(ok.length)dsAddDocs(ok);
    flash(bad.length?bad[0]+(bad.length>1?' (и ещё '+(bad.length-1)+')':''):'Разобрано файлов: '+ok.length);
    renderAll();
  });
}
function dsClick(act,b){
  var imp=S.dsImp,g=curRegion();
  switch(act){
    case'dsPick':
      if(!dsCanEdit()){roFlash();return true;}
      (function(){var f=document.createElement('input');f.type='file';f.accept='.docx,.txt,.csv';f.multiple=true;f.addEventListener('change',function(){if(f.files&&f.files.length)dsFilesPicked(f.files);});f.click();})();
      return true;
    case'dsPasteOpen':S.dsPaste=true;S.dsOpen=true;renderAll();return true;
    case'dsPasteClose':S.dsPaste=false;renderAll();return true;
    case'dsPasteGo':(function(){
      var t=($('#dsText')||{}).value||'',gn=(($('#dsTextG')||{}).value||'').trim(),nn0=(($('#dsTextN')||{}).value||'').trim(),ds=dsParseMany(t.split(/\r?\n/),'вставленный текст').filter(function(d){return d.groups.length;});
      if(!ds.length){flash('Не найдено ни одного блюда');return;}
      ds.forEach(function(d){
        if(gn)d.groups.forEach(function(x){if(!x.g)x.g=gn;});
        d.groups.forEach(function(x){if(!x.g)x.g='Без группы';});
        if(gn&&!d.title)d.title=gn;
        if(nn0&&ds.length===1)d.num=nn0;
      });
      dsAddDocs(ds);S.dsPaste=false;renderAll();
    })();return true;
    case'dsApply':
      if(!dsCanEdit()||!imp){roFlash();return true;}
      (function(){dsRegSave(imp.g,imp.docs);var r=dsApply();S.dsImp=null;dsAuto.memo=null;renderAll();flash(r.n?'Отмечено блюд: '+r.n+(r.re?' (у '+r.re+' заменена прежняя отметка)':'')+(syLinked()?'. Отправьте изменения в общую базу':''):'Новых отметок нет');})();
      return true;
    case'dsAutoGo':
      if(!dsCanEdit()){roFlash();return true;}
      (function(){var n=dsAutoApply(g);renderAll();flash('Отмечено по декларациям: '+n+(syLinked()&&n?'. Отправьте изменения в общую базу':''));})();return true;
    case'dsAutoMore':S.dsAutoMore=!S.dsAutoMore;renderAll();return true;
    case'dsRegDrop':
      if(!dsCanEdit()){roFlash();return true;}
      (function(){var i=+b.getAttribute('data-i'),l=dsRegGet(g);l.splice(i,1);dsRegPut(g,l);renderAll();flash('Декларация убрана из реестра. Отметки в ТТК остаются');})();return true;
    case'dsImpCancel':S.dsImp=null;renderAll();return true;
    case'dsDocDrop':(function(){var di=+b.getAttribute('data-di');imp.docs.splice(di,1);if(!imp.docs.length)S.dsImp=null;else dsBuildRows(imp);renderAll();})();return true;
    case'dsOff':
      if(!dsCanEdit()){roFlash();return true;}
      (function(){var id=b.closest('[data-rid]').getAttribute('data-rid');dsUnmark(g,[id]);renderAll();flash('Отметка декларации снята');})();return true;
    case'dsOffG':
      if(!dsCanEdit()){roFlash();return true;}
      (function(){var gk=b.getAttribute('data-g'),ids=visIds(g).filter(function(id){var x=dsOf(S.recipes[id],g);return x&&x.g===gk;});flash('Снято отметок: '+dsUnmark(g,ids));renderAll();})();return true;
  }
  return false;
}
function dsChange(act,t){
  var imp=S.dsImp;
  switch(act){
    case'dsRowOn':(function(){var x=imp&&imp.rows[+t.getAttribute('data-ri')];if(!x)return;if(t.checked&&!x.pick&&x.m.cands[0])x.pick=x.m.cands[0].id;x.on=t.checked&&!!x.pick;renderAll();})();return true;
    case'dsRowPick':(function(){var x=imp&&imp.rows[+t.getAttribute('data-ri')];if(!x)return;x.pick=t.value;x.on=!!t.value;renderAll();})();return true;
    case'dsNumSet':(function(){var d=imp&&imp.docs[+t.getAttribute('data-di')];if(d)d.num=t.value.trim().slice(0,DS_MAX_N);})();return true;
  }
  return false;
}
try{window.kbzhuDs={parseMany:dsParseMany,auto:dsAuto,regGet:dsRegGet,S:S,normRecipe:normRecipe,renderAll:function(){renderAll();},zipStore:zipStore,docxParas:dsDocxParas,parse:dsParse,addDocs:dsAddDocs,match:dsMatch,index:dsIndex,
  xlsx:function(){return menuXlsxTable();},ctx:function(){return syCtx();},shared:function(c,id){return syRecShared(c,id);},toLocal:function(c,j){return syRecToLocal(c,j);},diff:function(k,a,b){return syDiffItems(k,a,b,regionName);}};}catch(e){}      /* для проверок */
