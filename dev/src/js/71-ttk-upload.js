/* ---------- загрузка ТТК (.docx) ---------- */
var W_NS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';
function wKids(el,name){return Array.prototype.filter.call(el.childNodes,function(n){return n.nodeType===1&&n.localName===name&&n.namespaceURI===W_NS;});}
function pText(p){
  var out='',els=p.getElementsByTagNameNS(W_NS,'*'),i,n;
  for(i=0;i<els.length;i++){n=els[i].localName;if(n==='t')out+=els[i].textContent;else if(n==='tab'||n==='br')out+=' ';}
  return out;
}
function inflateRaw(data){
  var stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer().then(function(b){return new Uint8Array(b);});
}
/* docx — это zip-архив; достаём из него один файл без сторонних библиотек */
function unzipEntry(buf,wanted){
  var u8=new Uint8Array(buf),dv=new DataView(buf),i=u8.length-22,min=Math.max(0,u8.length-65557);
  while(i>=min&&dv.getUint32(i,true)!==0x06054b50)i--;
  if(i<min)return Promise.reject(new Error('zip'));
  var n=dv.getUint16(i+10,true),p=dv.getUint32(i+16,true),k;
  for(k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)return Promise.reject(new Error('zip'));
    var method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),elen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),lho=dv.getUint32(p+42,true);
    var name=new TextDecoder('utf-8').decode(u8.subarray(p+46,p+46+nlen));
    if(name===wanted){
      var start=lho+30+dv.getUint16(lho+26,true)+dv.getUint16(lho+28,true),data=u8.subarray(start,start+csize);
      if(method===0)return Promise.resolve(data);
      if(method===8)return inflateRaw(data);
      return Promise.reject(new Error('method'));
    }
    p+=46+nlen+elen+clen;
  }
  return Promise.resolve(null);
}
/* весь архив .docx: список файлов с распакованным содержимым (папки пропускаем) */
function unzipAll(buf){
  var u8=new Uint8Array(buf),dv=new DataView(buf),i=u8.length-22,min=Math.max(0,u8.length-65557);
  while(i>=min&&dv.getUint32(i,true)!==0x06054b50)i--;
  if(i<min)return Promise.reject(new Error('zip'));
  var n=dv.getUint16(i+10,true),p=dv.getUint32(i+16,true),k,jobs=[];
  for(k=0;k<n;k++){
    if(dv.getUint32(p,true)!==0x02014b50)return Promise.reject(new Error('zip'));
    var method=dv.getUint16(p+10,true),csize=dv.getUint32(p+20,true),nlen=dv.getUint16(p+28,true),elen=dv.getUint16(p+30,true),clen=dv.getUint16(p+32,true),lho=dv.getUint32(p+42,true);
    var name=new TextDecoder('utf-8').decode(u8.subarray(p+46,p+46+nlen)),start=lho+30+dv.getUint16(lho+26,true)+dv.getUint16(lho+28,true),data=u8.subarray(start,start+csize);
    p+=46+nlen+elen+clen;
    if(/\/$/.test(name))continue;
    jobs.push(method===0?Promise.resolve({name:name,data:data}):method===8?inflateRaw(data).then((function(nm){return function(x){return{name:nm,data:x};};})(name)):Promise.reject(new Error('method')));
  }
  return Promise.all(jobs);
}
/* абзацы шапки «УТВЕРЖДАЮ» в документе: строка должности и организации, строка ФИО, строка даты (так же, как их читает ttkFields) */
function hdrLocate(doc){
  var body=doc.getElementsByTagNameNS(W_NS,'body')[0],items=[],i,iu=-1,it=-1;
  if(!body)return null;
  (function walk(node){
    Array.prototype.forEach.call(node.childNodes,function(n){
      if(n.nodeType!==1||n.namespaceURI!==W_NS)return;
      var ln=n.localName;
      if(ln==='p')items.push({n:n,t:pText(n).replace(/\s+/g,' ').trim()});
      else if(ln==='sdt'){var sc=wKids(n,'sdtContent')[0];if(sc)walk(sc);}
      else if(ln==='sdtContent'||ln==='customXml'||ln==='smartTag'||ln==='ins')walk(n);
    });
  })(body);
  for(i=0;i<items.length&&iu<0;i++)if(/^УТВЕРЖДАЮ/i.test(items[i].t))iu=i;
  if(iu<0)return null;
  for(i=iu+1;i<items.length&&it<0;i++)if(/^ТЕХНИКО/i.test(items[i].t))it=i;
  var end=it>iu?it:Math.min(items.length,iu+6),hl=[],dateP=null;
  for(i=iu+1;i<end;i++){
    var t=items[i].t;
    if(!t||/^[_\s]+$/.test(t))continue;
    if(/«\s*\d{1,2}\s*»|20\d\d\s*г/.test(t)){dateP=items[i];continue;}
    hl.push(items[i]);
  }
  return hl.length?{hl:hl,dateP:dateP}:null;
}
function wSetPara(p,text){
  var ts=p.getElementsByTagNameNS(W_NS,'t'),i;
  if(!ts.length)return false;
  ts[0].textContent=text;ts[0].setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
  for(i=1;i<ts.length;i++)ts[i].textContent='';
  return true;
}
/* замена текста в абзаце с сохранением оформления: совпадение может лежать в нескольких кусках (runs) */
function wReplaceIn(p,oldS,newS){
  var ts=Array.prototype.slice.call(p.getElementsByTagNameNS(W_NS,'t')),from=0,guard=0,n=0;
  while(guard++<20){
    var full=ts.map(function(x){return x.textContent;}).join(''),at=full.indexOf(oldS,from);
    if(at<0)break;
    var end=at+oldS.length,pos=0,j,first=false;
    for(j=0;j<ts.length;j++){
      var tx=ts[j].textContent,e=pos+tx.length;
      if(!first&&at<e){
        first=true;ts[j].textContent=tx.slice(0,at-pos)+newS+(end<=e?tx.slice(end-pos):'');
        ts[j].setAttributeNS('http://www.w3.org/XML/1998/namespace','xml:space','preserve');
        if(end<=e)break;
      }else if(first){
        if(end<=e){ts[j].textContent=tx.slice(end-pos);break;}
        ts[j].textContent='';
      }
      pos=e;
    }
    from=at+newS.length;n++;
  }
  return n;
}
/* готовый .docx с другой шапкой: организация, должность, ФИО, дата; прежнее название организации заменяется и в тексте разделов */
function docxPatchHeader(buf,hdr,orig){
  return unzipAll(buf).then(function(files){
    var fi=files.filter(function(f){return f.name==='word/document.xml';})[0];
    if(!fi)throw new Error('nodoc');
    var doc=new DOMParser().parseFromString(new TextDecoder('utf-8').decode(fi.data),'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw new Error('xml');
    var b=hdrLocate(doc);if(!b)throw new Error('nohdr');
    var oo=String((orig&&orig.org)||'').trim(),no=String(hdr.org||'').trim(),i,ps;
    if(oo&&no&&oo!==no){ps=doc.getElementsByTagNameNS(W_NS,'p');for(i=0;i<ps.length;i++)wReplaceIn(ps[i],oo,no);}
    var l0=[hdr.head,hdr.org].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' ');
    wSetPara(b.hl[0].n,l0);
    if(b.hl[1]){
      var raw=pText(b.hl[1].n),us=/(_+)\s*$/.exec(raw);
      wSetPara(b.hl[1].n,String(hdr.headName||'').trim()+(us?us[1]:''));
    }
    if(b.dateP)wSetPara(b.dateP.n,String(hdr.date||'').trim());
    var xml='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'+new XMLSerializer().serializeToString(doc).replace(/^<\?xml[^>]*\?>\s*/,'');
    return zipStore(files.map(function(f){return f.name==='word/document.xml'?{name:f.name,data:new TextEncoder().encode(xml)}:f;}));
  });
}
function ttkRows(tbl){
  return wKids(tbl,'tr').map(function(tr){
    var cells=wKids(tr,'tc').map(function(tc){
      var span=1,pr=wKids(tc,'tcPr')[0],g=pr?wKids(pr,'gridSpan')[0]:null;
      if(g)span=parseInt(g.getAttributeNS(W_NS,'val')||g.getAttribute('w:val'),10)||1;
      var ps=tc.getElementsByTagNameNS(W_NS,'p'),txt=[],i,s;
      for(i=0;i<ps.length;i++){s=pText(ps[i]).replace(/\s+/g,' ').trim();if(s)txt.push(s);}
      return{text:txt.join(' '),span:span};
    });
    var grid=[];
    cells.forEach(function(c){grid.push(c.text);for(var k=1;k<c.span;k++)grid.push('');});
    return{cells:cells,grid:grid};
  });
}
function ttkNum(s){var r=parseNum(s||'');return(r.ok&&!r.empty)?r.v:null;}
function ttkRecipe(rows){
  var hi=-1,gc=-1,nc=-1,namec=-1,hfix=false,i,j,g;
  var hdSame=function(a,b){var f=function(x){return String(x||'').toLowerCase().replace(/[\s.,]/g,'');};return f(a)===f(b);};
  for(i=0;i<Math.min(rows.length,8)&&hi<0;i++){
    g=rows[i].grid;var gi=-1,ni=-1,hf=false;
    for(j=0;j<g.length&&gi<0;j++)if(/брутто/i.test(g[j]))gi=j;
    if(gi>=0)for(j=gi+1;j<g.length;j++)if(/нетто/i.test(g[j])){ni=j;break;}
    /* опечатка в шапке: вторая колонка «на 1 порцию» подписана «Брутто, гр.» (как первая) вместо «Нетто, гр.»; иначе взялась бы «Нетто, кг.» из блока «на 10 порций», а граммы стали бы больше в 1000 раз */
    if(gi>=0&&gi+1<g.length&&/брутто/i.test(g[gi+1])&&!/нетто/i.test(g[gi+1])&&hdSame(g[gi],g[gi+1])&&(ni<0||ni>gi+1)){ni=gi+1;hf=true;}
    if(gi>=0&&ni>=0){hi=i;gc=gi;nc=ni;hfix=hf;}
  }
  if(hi<0)return null;
  for(i=0;i<=hi&&namec<0;i++)for(j=0;j<rows[i].grid.length;j++)if(namec<0&&/наименован/i.test(rows[i].grid[j]))namec=j;
  if(namec<0)namec=1;
  var head=rows[hi].grid[nc]||'',mul=(/кг/i.test(head)&&!/гр/i.test(head))?1000:1,unitFix=false,gh=rows[hi].grid;
  /* опечатка в подписи: «Брутто, гр.» рядом с «Нетто, кг.», а следом ещё пара «Брутто, кг.» «Нетто, кг.» (на 10 порций): у порции нетто тоже в граммах */
  if(mul===1000&&nc===gc+1&&/гр/i.test(gh[gc])&&!/кг/i.test(gh[gc])&&/брутто/i.test(gh[nc+1]||'')&&/нетто/i.test(gh[nc+2]||'')){mul=1;unitFix=true;}
  /* шапка говорит «кг», а «Выход готового блюда» — 50 и больше (в «кг» это 50 кг на карту): в файле граммы, подпись ошибочна */
  var kgFix=false;
  if(mul===1000){
    var finRe0=/^выход\s*готов\S*(\s+(блюда|блюдо|изделия|продукта|порции))?\s*[:.]?\s*$/i;
    for(i=hi+1;i<rows.length;i++){
      var g0=rows[i].grid,n0=(g0[namec]||'').trim();
      if(n0&&finRe0.test(n0)){var m0=String(g0[nc]||'').match(/\d+(?:[.,]\d+)?/);if(m0&&Number(m0[0].replace(',','.'))>=50){mul=1;kgFix=true;}break;}
    }
  }
  var out={rows:[],output:0,outputText:'',semi:[],alts:[],groups:[],skipped:[],totals:[],subs:[],hdrFix:hfix,kgFix:kgFix,unitFix:unitFix},run=0,runAll=0,sq=0;
  var orphan=false;function lead(o){if(orphan)o.lead=true;return o;}
  var finalRe=/^выход\s*(готов\S*)?(\s+(блюда|блюдо|изделия|продукта|порции))?\s*[:.]?\s*$/i,altRe=/^или(?:\s+|\s*[:,]\s*)/i,lastIdx=-1;
  for(i=hi+1;i<rows.length;i++){
    g=rows[i].grid;
    var name=(g[namec]||'').trim();
    if(!name||name.length>120)continue;
    var net=ttkNum(g[nc]),gross=ttkNum(g[gc]);
    /* «Или Чеснок сушёный» — вариант строки выше (количество может быть не указано: тогда то же): считать второй раз нельзя, но запоминаем, чтобы его можно было выбрать вместо основной */
    orphan=false;
    if(altRe.test(name)){
      var an=name.replace(altRe,'').trim();
      if(!an)continue;
      if(lastIdx>=0){
        out.alts.push(name);
        var br=out.rows[lastIdx];(br.alts=br.alts||[]).push({name:an,net:net===null?null:net*mul,gross:gross===null?null:gross*mul});
        continue;
      }
      /* «Или …» в самом начале рецептуры или сразу после итоговой строки: варианта не к чему привязать, это обычная строка (иначе она пропала бы из карты) */
      name=an;orphan=true;
    }
    /* «Итого фарша:», «Итого соуса:», «Итого:», «Всего»: промежуточные и общие итоги, это не сырьё; строки состава выше уже учтены */
    if(isSubName(name)){
      var tm=net===null?(gross===null?null:gross*mul):net*mul,tt={name:name,mass:tm,sum:isBareTotal(name)?runAll:run,at:out.rows.length,seq:sq++};
      out.totals.push(tt);out.subs.push(tt);
      run=0;lastIdx=-1;continue;
    }
    if(/^выход/i.test(name)){
      if(finalRe.test(name)){
        var txt=String(g[nc]||'').trim(),nums=txt.match(/\d+(?:[.,]\d+)?/g)||[];
        var vals=nums.map(function(x){return Number(x.replace(',','.'));});
        /* «250/10» — блюдо и добавка к нему (например, суп и мясо): выход порции равен сумме */
        out.output=vals.length?(txt.indexOf('/')>-1?vals.reduce(function(a,b){return a+b;},0):vals[0])*mul:0;
        out.outputText=txt;
        break;
      }
      /* «Выход куриного бульона» и подобные: промежуточный полуфабрикат, не выход блюда */
      var sv1={name:name,mass:net===null?null:net*mul,sum:run,cooked:true,at:out.rows.length,seq:sq++};out.semi.push(sv1);if(sv1.mass>0)out.subs.push(sv1);run=0;lastIdx=-1;continue;
    }
    if(/^(масса|полуфабрикат|п\/ф)/i.test(name)){
      var sv2={name:name,mass:net===null?null:net*mul,sum:run,cooked:/отвар|варен|жарен|печен|запечен|тушен|бульон/i.test(name),at:out.rows.length,seq:sq++};out.semi.push(sv2);if(sv2.mass>0)out.subs.push(sv2);run=0;lastIdx=-1;continue;
    }
    var cook=null;
    if(net===null){
      /* «173/130*»: нетто сырья и (через косую) масса после тепловой обработки, звёздочки отсылают к сноске под таблицей; «216*» — просто число со сноской */
      var cm=/^\s*(\d+(?:[.,]\d+)?)\s*(?:\/\s*(\d+(?:[.,]\d+)?))?\s*(\*+)?\s*$/.exec(String(g[nc]||'').replace(/\u00a0/g,' '));
      if(cm&&(cm[2]||cm[3])){net=Number(cm[1].replace(',','.'));if(cm[2])cook={mass:Number(cm[2].replace(',','.')),star:cm[3]||''};}
    }
    if(net===null){
      var nextNum=i+1<rows.length?String(rows[i+1].grid[0]||'').trim():'';
      if(gross!==null){out.rows.push(lead({name:name,net:gross*mul,gross:gross*mul,note:'нетто не указано, взято брутто'}));lastIdx=out.rows.length-1;run+=gross*mul;runAll+=gross*mul;}
      else if(/^\d+\.\d+/.test(nextNum)){out.groups.push(name);lastIdx=-1;}
      else{out.skipped.push(name);out.rows.push(lead({name:name,net:null,gross:null,noqty:true}));lastIdx=out.rows.length-1;}      /* «Зелень свежая» без граммов: остаётся в карте для поваров, в расчёт не входит */
      continue;
    }
    out.rows.push(lead({name:name,net:net*mul,gross:gross===null?null:gross*mul}));lastIdx=out.rows.length-1;
    run+=net*mul;runAll+=net*mul;
    if(cook){var ck={name:'',star:cook.star,rowName:name,mass:cook.mass*mul,sum:run,cooked:true,at:out.rows.length,seq:sq++};out.totals.push(ck);out.subs.push(ck);}      /* масса после обработки: строка «Масса …» в карте под основной */
  }
  return out;
}
function ttkRef(rows){
  var i,j,k;
  for(i=0;i<rows.length;i++){
    var c=rows[i].cells.map(function(x){return x.text;});
    if(c.length<4)continue;
    var idx={};
    c.forEach(function(t,n){if(/белк/i.test(t))idx.p=n;else if(/жир/i.test(t))idx.f=n;else if(/углевод/i.test(t))idx.c=n;else if(/ккал|калор/i.test(t))idx.kcal=n;});
    if(idx.p===undefined||idx.f===undefined||idx.c===undefined||idx.kcal===undefined)continue;
    var label='';
    for(j=i+1;j<Math.min(i+5,rows.length);j++){
      var cc=rows[j].cells.map(function(x){return x.text;}),nums=cc.map(ttkNum);
      if(cc.length>=4&&nums.filter(function(v){return v!==null;}).length>=4){
        /* «1 порция 250 гр. содержит» — значения на порцию; «100 гр содержит» — на 100 г */
        var m=/(\d+(?:[.,]\d+)?)\s*(?:гр|г(?![а-я])|грамм)/i.exec(label),portion=m?Number(m[1].replace(',','.')):0;
        var basis=/порци/i.test(label)?'portion':'100';
        var res={label:label,portion:portion,basis:basis,p:nums[idx.p],f:nums[idx.f],c:nums[idx.c],kcal:nums[idx.kcal]};
        for(k in res)if(res[k]===null)return null;
        return res;
      }
      if(cc.length===1&&cc[0])label=cc[0];
    }
  }
  return null;
}
/* ---------- поля карты из загруженной ТТК (реквизиты, тексты разделов) ---------- */
function reEsc(s){return String(s).replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&');}
function ttkTok(s,dish,portion,org){
  s=String(s||'').replace(/\s+/g,' ').trim();
  if(dish)s=s.replace(new RegExp('[«"“]\\s*'+reEsc(dish).replace(/\s+/g,'\\s+')+'\\s*[»"”]','gi'),'{блюдо}');
  if(portion)s=s.replace(new RegExp('\\{блюдо\\}\\s*'+reEsc(portion).replace(/\s+/g,'\\s*'),'g'),'{блюдо} {порция}');
  if(org)s=s.replace(new RegExp(reEsc(org),'g'),'{орг}');
  return s;
}
/* раздел карты по заголовку: цифра римская или арабская, точка и скобка необязательны; без цифры берём только короткую строку */
function ttkSecOf(p){
  if(!p||p.length>120)return 0;
  var m=/^\s*(?:[IVX]{1,4}|\d{1,2})(?:\s*[.)]\s*|\s+)/i.exec(p),num=!!m,s=(m?p.slice(m[0].length):p).replace(/^[.:\s]+/,'');
  var t=s.toLowerCase().replace(/ё/g,'е').trim();
  if(!t)return 0;
  var short=t.length<=70&&!/[:;]/.test(t);
  if(/^область\s+применения/.test(t))return 1;
  if(/^требования\s+к\s+сырью/.test(t))return 2;
  if(/^рецептура\s*[.:]?$/.test(t))return 3;
  if(/^(технология|технологический\s+процесс|описание\s+технолог)/.test(t)&&(num||short))return 4;
  if(/^(оформление|требования\s+к\s+оформлению|подача|реализация)/.test(t)&&(num||short))return 5;
  if(/^(показатели\s+качества|органолептическ)/.test(t)&&(num||short))return 6;
  if(/^(пищевая|энергетическая|информация\s+о\s+пищевой)\b.*ценност/.test(t)&&(num||short))return 7;
  return 0;
}
function ttkFields(doc){
  var f={},body=doc.getElementsByTagNameNS(W_NS,'body')[0],items=[],i,m;
  if(!body)return f;
  function walk(node){
    Array.prototype.forEach.call(node.childNodes,function(n){
      if(n.nodeType!==1||n.namespaceURI!==W_NS)return;
      var ln=n.localName;
      if(ln==='p'){var t=pText(n).replace(/\s+/g,' ').trim();if(t)items.push({p:t});}
      else if(ln==='tbl'){
        items.push({tbl:ttkRows(n)});
        /* часть карт сверстана одной таблицей: разделы IV–VI лежат в ячейках (иногда с вложенной таблицей органолептики), читаем и их */
        wKids(n,'tr').forEach(function(tr){wKids(tr,'tc').forEach(function(tc){walk(tc);});});
      }
      else if(ln==='sdt'){var sc0=wKids(n,'sdtContent')[0];if(sc0)walk(sc0);}
      else if(ln==='sdtContent'||ln==='customXml'||ln==='smartTag'||ln==='ins')walk(n);
    });
  }
  walk(body);
  function idx(re,from){for(var k=from||0;k<items.length;k++)if(items[k].p&&re.test(items[k].p))return k;return-1;}
  /* шапка «УТВЕРЖДАЮ» */
  var iu=idx(/^УТВЕРЖДАЮ/i),it=idx(/^ТЕХНИКО/i);
  if(iu>=0){
    var hl=[],end=it>iu?it:Math.min(items.length,iu+6);
    for(i=iu+1;i<end;i++){
      if(!items[i].p)continue;
      var t1=items[i].p;
      if(/^[_\s]+$/.test(t1))continue;
      if(/«\s*\d{1,2}\s*»|20\d\d\s*г/.test(t1)){f.date=t1.replace(/«\s*(\d+)\s*»/,'«$1»');continue;}
      hl.push(t1.replace(/_+/g,'').trim());
    }
    if(hl[0]){
      m=/^(.*?)\s*((?:ООО|АО|ЗАО|ПАО|ОАО|ИП|МУП|МБУ|ГБУ|МАУ|МКУ)(?=[\s«"“]).*)$/.exec(hl[0]);
      if(m){if(m[1])f.head=m[1];f.org=m[2];}else f.head=hl[0];
    }
    if(hl[1])f.headName=hl[1];
  }
  /* название и порция из строки «Наименование блюда: «…» 1/100гр.» */
  var dish='',portion='',idn=idx(/Наименование блюда/i);
  if(idn>=0&&(m=/Наименование блюда\s*:?\s*[«"“]\s*(.+?)\s*[»"”]\s*(.*)$/i.exec(items[idn].p))){
    dish=m[1].trim();portion=m[2].replace(/\s+/g,'');
    f.dish=dish;f.portion=portion;
  }
  var org=f.org||'';
  function tok(s){return ttkTok(s,dish,portion,org);}
  /* границы разделов: первый найденный заголовок каждого раздела до следующего заголовка */
  var H={},order=[];
  items.forEach(function(x,k){var s=x.p?ttkSecOf(x.p):0;if(s&&H[s]===undefined){H[s]=k;order.push(k);}});
  order.sort(function(a,b){return a-b;});
  function sec(s){
    if(H[s]===undefined)return[];
    var a=H[s],e=items.length,k;
    for(k=0;k<order.length;k++)if(order[k]>a){e=order[k];break;}
    return items.slice(a+1,e);
  }
  var sc=sec(1).filter(function(x){return x.p;}).map(function(x){return x.p;});
  if(sc.length)f.scope=tok(sc.join(' '));
  else if((i=idx(/^Настоящая технико-технологическая карта/i))>=0)f.scope=tok(items[i].p);
  sec(2).forEach(function(x){
    if(!x.p)return;
    var key='',txt='',lc=x.p.toLowerCase().replace(/ё/g,'е');
    if((m=/^2\.([123])\.?\s*(.*)$/.exec(x.p))&&m[2]){key=['','r21','r22','r23'][m[1]];txt=m[2];}
    else if(!/^\d/.test(x.p)){
      if(/нормы\s+потерь/.test(lc))key='r23';
      else if(/подготовка\s+сырья/.test(lc))key='r22';
      else if(/продовольственное\s+сырье|пищевые\s+продукты\s+и\s+полуфабрикаты/.test(lc))key='r21';
      txt=x.p;
    }
    if(key&&!f[key])f[key]=tok(txt);
  });
  /* технология: пункты 4.1 и 4.2 могут быть без номеров (нумерация Word), тогда ищем по смыслу */
  var steps=[],inSteps=false,s4=sec(4),mark42=s4.some(function(x){return x.p&&/^4\.2\.?\s*технолог/i.test(x.p);});
  s4.forEach(function(x){
    if(!x.p)return;
    var p=x.p;
    if(!inSteps&&(m=/^4\.1\.?\s*(.*)$/.exec(p))){if(m[1])f.t41=tok(m[1]);return;}
    if(!inSteps&&(m=/^4\.2\.?\s*технология[^:]*:?\s*(.*)$/i.exec(p))){inSteps=true;if(m[1])steps.push(tok(m[1]));return;}
    if(inSteps){steps.push(tok(p));return;}
    if(mark42)return;
    if(!f.t41&&!steps.length&&/предварительн\S*\s+подготовк/i.test(p)){f.t41=tok(p);return;}
    if(/^технология\s+приготовления\s*:?\s*$/i.test(p))return;
    steps.push(tok(p));
  });
  if(steps.length)f.t42=steps.join('\n');
  /* пункты V называются по смыслу, так как нумерация в картах разная */
  sec(5).forEach(function(x){
    if(!x.p)return;
    var body=x.p.replace(/^5\.\d\.?\s*/,''),key='';
    if(/доставк/i.test(body))key='s53';
    else if(/срок|хранени|хранить|хранят|хранитс/i.test(body))key='s54';       /* «Готовое блюдо хранить при температуре не ниже 65°C не более 3 часов» — это хранение, а не температура подачи */
    else if(/температур/i.test(body))key='s52';
    else if(/подают|подаётся|подается|тарелк|оформлен/i.test(body))key='s51';
    /* два абзаца попали в одно поле: второй не пропадает, а занимает поле по своему номеру, иначе первое свободное */
    if(key&&f[key]){
      var nm5=/^5\.(\d)/.exec(x.p),alt5=nm5?'s5'+nm5[1]:'';
      key=(alt5&&/^s5[1-4]$/.test(alt5)&&!f[alt5])?alt5:(['s51','s52','s53','s54'].filter(function(k){return!f[k];})[0]||'');
    }
    if(key&&!f[key])f[key]=tok(body);
  });
  /* органолептика: таблица (показатели в строке или в столбце) либо абзацы «Внешний вид: …» */
  var OK_=[['look',/^внешн\S*\s+вид/],['color',/^цвет/],['texture',/^консистенц/],['taste',/^вкус/],['smell',/^запах/]],org2={};
  function okey(t){t=String(t||'').toLowerCase().replace(/ё/g,'е').replace(/^[\s\d.)]+/,'').trim();for(var q=0;q<OK_.length;q++)if(OK_[q][1].test(t))return OK_[q][0];return'';}
  function oset(k,v){v=String(v||'').replace(/\s+/g,' ').replace(/[;\s]+$/,'').replace(/^[:\-–—\s]+/,'').trim();if(v&&!org2[k])org2[k]=v;}
  items.forEach(function(x){
    if(!x.tbl||!x.tbl.length)return;
    var rows=x.tbl.map(function(rw){return rw.cells.map(function(c){return c.text;});}),k0;
    for(k0=0;k0<rows.length-1;k0++){
      var keys=rows[k0].map(okey);
      if(keys.filter(Boolean).length>=2){keys.forEach(function(kk,n){if(kk&&rows[k0+1][n]!==undefined)oset(kk,rows[k0+1][n]);});return;}
    }
    var cnt=0,tmp=[];
    rows.forEach(function(rw){var kk=okey(rw[0]);if(kk&&rw.length>1){tmp.push([kk,rw.slice(1).filter(Boolean).join(' ')]);cnt++;}});
    if(cnt>=2)tmp.forEach(function(q){oset(q[0],q[1]);});
  });
  var s6=H[6]!==undefined?sec(6):items;
  if(!(org2.look||org2.color||org2.texture||org2.taste)){
    s6.forEach(function(x){
      if(!x.p)return;
      var re=/(^|[.;]\s+)(внешний\s+вид|цвет|консистенци[яи]|вкус\s+и\s+запах|вкус|запах)\s*[:–—-]\s*/gi,hits=[],mm;
      while((mm=re.exec(x.p)))hits.push({k:okey(mm[2]),s:mm.index+mm[1].length,e:mm.index+mm[0].length});
      hits.forEach(function(h,n){oset(h.k,x.p.slice(h.e,n+1<hits.length?hits[n+1].s:x.p.length));});
    });
  }
  if(org2.smell)org2.taste=org2.taste?org2.taste+', '+org2.smell:org2.smell;
  ['look','color','texture','taste'].forEach(function(k){if(org2[k])f[k]=tok(org2[k]);});
  /* методы и микробиология (пункты 6.2 и 6.3) */
  s6.forEach(function(x){
    if(!x.p)return;
    var p=x.p.replace(/^6\.\d\.?\s*/,'');
    if(/^(физико-химическ\S*|микробиологическ\S*)\s+показател\S*\s*[.:]?\s*$/i.test(p))return;     /* только заголовок пункта, текст в следующем абзаце */
    if(/^физико-химическ/i.test(p)&&!f.p62a)f.p62a=tok(p);
    else if(/^выход готового блюда\s+регламентирует/i.test(p)&&!f.p62b)f.p62b=tok(p);
    else if(/^допустимые\s+отклонения/i.test(p)&&!f.p62c)f.p62c=tok(p);
    else if(/^микробиологическ/i.test(p)&&!f.m63)f.m63=tok(p);
  });
  /* допуски по массе */
  var all=[];
  items.forEach(function(x){if(x.p)all.push(x.p);else x.tbl.forEach(function(r){r.cells.forEach(function(c){all.push(c.text);});});});
  var blob=all.join('\n'),num='(\\d+(?:[.,]\\d+)?)';
  if((m=new RegExp('Выход готового блюда\\s*:?\\s*'+num+'\\s*(?:гр|г)\\.?\\s*±\\s*'+num,'i').exec(blob)))f.tol=m[2].replace('.',',');
  if((m=new RegExp('Выход основного продукта\\s*:?\\s*'+num+'\\s*(?:гр|г)\\.?\\s*±\\s*'+num,'i').exec(blob))){f.main=m[1].replace('.',',');if(!f.tol)f.tol=m[2].replace('.',',');}
  Object.keys(f).forEach(function(k){if(f[k]===''||f[k]===undefined)delete f[k];});
  return f;
}
function cleanDish(s){return String(s).replace(/[«»"“”]/g,'').replace(/(\d)\s*гр\.?/gi,'$1 г').replace(/\s+/g,' ').replace(/[\s.:]+$/,'').trim();}
function parseTtk(xml){
  var doc=new DOMParser().parseFromString(xml,'application/xml');
  if(doc.getElementsByTagName('parsererror').length)throw new Error('xml');
  var res={number:'',dish:'',rows:[],output:0,outputText:'',semi:[],alts:[],groups:[],skipped:[],totals:[],subs:[],extraTables:0,ref:null},i,m;
  var ps=doc.getElementsByTagNameNS(W_NS,'p');
  for(i=0;i<ps.length&&(!res.number||!res.dish);i++){
    var t=pText(ps[i]).replace(/\s+/g,' ').trim();
    if(!res.number&&(m=/КАРТА\s*№\s*(\d+)/i.exec(t)))res.number=m[1];
    if(!res.dish&&(m=/Наименование блюда\s*:?\s*(.+)$/i.exec(t)))res.dish=cleanDish(m[1]);
  }
  var tbls=doc.getElementsByTagNameNS(W_NS,'tbl');
  for(i=0;i<tbls.length;i++){
    var rows=ttkRows(tbls[i]);
    var rc=ttkRecipe(rows);
    if(rc&&rc.rows.length){
      if(!res.rows.length){res.rows=rc.rows;res.output=rc.output;res.outputText=rc.outputText;res.semi=rc.semi;res.alts=rc.alts;res.groups=rc.groups;res.skipped=rc.skipped;res.hdrFix=!!rc.hdrFix;res.kgFix=!!rc.kgFix;res.unitFix=!!rc.unitFix;res.totals=rc.totals||[];res.subs=rc.subs||[];}
      else res.extraTables++;
    }
    if(!res.ref)res.ref=ttkRef(rows);
  }
  /* сноски вида «*Масса жареной капусты **Масса пассерованного лука»: название строки с массой после обработки по числу звёздочек */
  var foot={},fi,fr,fm;
  for(fi=0;fi<ps.length;fi++){
    var ft=pText(ps[fi]).replace(/\s+/g,' ').trim();
    if(ft.charAt(0)!=='*')continue;
    fr=/(\*+)\s*([^*]+)/g;
    while((fm=fr.exec(ft)))foot[fm[1]]=fm[2].replace(/[\s.;,]+$/,'');
  }
  (res.subs||[]).forEach(function(x){if(x.cooked&&!x.name)x.name=foot[x.star]||('Масса после обработки: '+x.rowName);});
  try{res.fields=ttkFields(doc);}catch(e){res.fields={};res.fieldsErr=true;}
  return res;
}
function ttkName(t){return(t.dish||'Блюдо из ТТК')+(t.number?' (ТТК №'+t.number+')':'');}
/* название блюда без «(ТТК №N)», цифр и единиц: по нему отличают разные блюда с одним номером ТТК */
function ttkCore(s){return dishKey(String(s==null?'':s).toLowerCase().replace(/\(?\s*ттк\s*№?\s*\d+[^)]*\)?/g,' '));}
/* одно и то же блюдо: ключи равны или почти все слова короткого названия есть в длинном */
function sameDishCore(a,b){
  if(!a||!b)return false;
  if(a===b)return true;
  var ta=a.split(' '),tb=b.split(' '),sh=ta.length<=tb.length?ta:tb,lg=sh===ta?tb:ta,n=0;
  sh.forEach(function(w){if(lg.indexOf(w)>-1)n++;});
  return sh.join('').length>=4&&n/sh.length>=0.75;
}
/* та же ТТК среди карт с той же привязкой к региону (reg), а при any=true среди всех.
   Совпадение по номеру ТТК нужно подтвердить названием блюда: у разных блюд номера бывают одинаковыми */
function findSameRecipe(t,reg,any){
  var nm=normKey(ttkName(t)),re=t.number?new RegExp('ттк\\s*№\\s*'+t.number+'(?!\\d)','i'):null,core=ttkCore(t.dish),found='';
  reg=reg||'';
  Object.keys(S.recipes).forEach(function(id){
    var r=S.recipes[id],n=r.name||'';
    if(!any&&(r.reg&&regKnown(r.reg)?r.reg:'')!==reg)return;
    if(found)return;
    if(normKey(n)===nm||normKey(recBase(r))===nm)found=id;
    else if(re&&re.test(n.toLowerCase().replace(/ё/g,'е'))&&sameDishCore(core,ttkCore(recBase(r))))found=id;
  });
  return found;
}
/* шапка «Утверждаю»: в одном регионе бывает несколько столовых с разными юридическими лицами и директорами, поэтому шапки хранятся списком (на этом устройстве) и выбираются одним нажатием */
var HDR_KEYS=['org','head','headName','date'];
function hdrKey(h){return String([h.org,h.head,h.headName].map(function(x){return String(x||'').toLowerCase().replace(/ё/g,'е').replace(/\s+/g,' ').trim();}).join('|'));}
/* сохранённые на этом устройстве шапки */
function hdrLocal(){
  try{var a=JSON.parse(lsGet('kbzhu:ttkhdrs')||'[]');if(!Array.isArray(a))return[];
    return a.filter(function(x){return x&&typeof x==='object'&&(String(x.org||'').trim()||String(x.headName||'').trim());}).slice(0,12).map(function(x){return{org:String(x.org||''),head:String(x.head||''),headName:String(x.headName||'')};});
  }catch(e){return[];}
}
/* шапки для выбора: сначала сохранённые на устройстве, затем юридические лица из общего справочника (одинаковые показываются один раз, справочник главнее) */
function hdrPresets(){
  var loc=hdrLocal(),sh=drHdrShared(),keys={};
  sh.forEach(function(x){keys[hdrKey(x)]=1;});
  return loc.filter(function(x){return!keys[hdrKey(x)];}).concat(sh);
}
function hdrPresetPut(h){
  if(!String(h.org||'').trim()&&!String(h.headName||'').trim())return;
  var k=hdrKey(h),a=hdrLocal().filter(function(x){return hdrKey(x)!==k;});
  if(drHdrShared().some(function(x){return hdrKey(x)===k;}))return;           /* такая шапка уже есть в справочнике: второй копии на устройстве не заводим */
  a.unshift({org:String(h.org||'').trim(),head:String(h.head||'').trim(),headName:String(h.headName||'').trim()});
  lsSet('kbzhu:ttkhdrs',JSON.stringify(a.slice(0,12)));
}
function hdrPresetDel(i){var all=hdrPresets(),x=all[i],k;if(!x||x.shared)return;k=hdrKey(x);lsSet('kbzhu:ttkhdrs',JSON.stringify(hdrLocal().filter(function(y){return hdrKey(y)!==k;})));}
function hdrLabel(h){return[String(h.org||'').trim(),[h.head,h.headName].map(function(x){return String(x||'').trim();}).filter(Boolean).join(' ')].filter(Boolean).join(' — ');}
function hdrFromFile(t){var f=t.fields||{};return HDR_KEYS.some(function(k){return String(f[k]||'').trim();});}
function hdrObj(ctx){return ctx==='dl'?(S.sy.dl&&S.sy.dl.hdr):(S.ttk&&S.ttk.hdr);}
function hdrOrigObj(ctx){return ctx==='dl'?(S.sy.dl&&S.sy.dl.orig):(S.ttk&&S.ttk.hdr0);}
function hdrSame(a,b){return!!a&&!!b&&HDR_KEYS.every(function(k){return String(a[k]||'').trim()===String(b[k]||'').trim();});}
function ttkHdrInit(t){
  var f=t.fields||{},o=(t.sameId&&S.recipes[t.sameId]&&S.recipes[t.sameId].ttk)||null,m=hdrPresets()[0]||null,h={};
  HDR_KEYS.forEach(function(k){
    var v=f[k];
    if(v===undefined||v===null||!String(v).trim()){
      if(o&&o[k]!==undefined&&String(o[k]).trim())v=o[k];
      else if(m&&k!=='date'&&String(m[k]||'').trim())v=m[k];
      else v=TT_DEF[k];
    }
    h[k]=String(v==null?'':v).replace(/\s+/g,' ').trim();
  });
  return h;
}
/* поля шапки + выбор сохранённой; ctx: 'ttk' — карточка загрузки, 'dl' — скачивание у шеф-повара */
function hdrBoxHtml(ctx,id,h,orig,note){
  var ps=hdrPresets(),sel=-1,edit=ctx==='ttk'?' data-edit':'';
  ps.forEach(function(x,j){if(sel<0&&hdrKey(x)===hdrKey(h))sel=j;});
  function fld(k,lbl,cls,ph){return'<label class="field'+(cls?' '+cls:'')+'"><span class="lbl">'+lbl+'</span><input data-act="hdrIn" data-ctx="'+ctx+'" data-k="'+k+'"'+edit+' data-fk="th:'+ctx+k+'" autocomplete="off" value="'+esc(h[k]||'')+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'></label>';}
  var pick='';
  if(ps.length)pick='<div class="hdrpick"><label class="field"><span class="lbl">Сохранённые шапки (по столовым)</span><select data-act="hdrPick" data-ctx="'+ctx+'"'+edit+' aria-label="Выбрать сохранённую шапку"><option value="">'+(sel<0?'Выбрать из сохранённых…':'Другая шапка…')+'</option>'
    +ps.map(function(x,j){return'<option value="'+j+'"'+(j===sel?' selected':'')+'>'+esc(hdrLabel(x))+(x.shared?' · справочник':'')+'</option>';}).join('')+'</select></label>'
    +(sel>=0&&!ps[sel].shared?'<button class="btn mini" data-act="hdrDel" data-ctx="'+ctx+'" data-i="'+sel+'"'+edit+' title="Убрать эту шапку из списка сохранённых">Убрать из списка</button>':'')+'</div>';
  return'<div class="thdr" id="'+id+'"><h3>Шапка карты «Утверждаю»</h3>'
    +'<p class="hint" style="margin:2px 0 8px">'+note+'</p>'+pick
    +'<div class="fgrid">'+fld('org','Организация','','ООО «Название»')+fld('head','Должность','w180','Директор')+fld('headName','ФИО утверждающего','','Иванов И.И.')+fld('date','Дата утверждения','w180','«1» сентября 2026г.')+'</div>'
    +(orig&&!hdrSame(h,orig)?'<div class="btns" style="margin-top:2px"><button class="btn mini" data-act="hdrOrig" data-ctx="'+ctx+'"'+edit+' title="Вернуть шапку, которая написана в файле">Как в файле</button></div>':'')
    +'</div>';
}
function ttkHdrHtml(t){
  return hdrBoxHtml('ttk','ttkHdr',t.hdr||{},t.hdr0,(hdrFromFile(t)?'Прочитана из файла.':'В файле шапки не нашлось, подставлены стандартные значения.')+' Если карта для другого юридического лица, столовой или директора, исправьте или выберите сохранённую шапку: в карту попадёт то, что написано здесь (название организации подставится и в тексты разделов).');
}
function startTtk(parsed,fileName){
  var t=parsed;t.file=fileName;
  t.rows=t.rows.map(function(x){
    var mt=matchIng(x.name,S.ings),nq=x.noqty===true,o={name:x.name,net:x.net,gross:x.gross,note:x.note||'',alts:x.alts||[],ing:nq?'':mt.id,how:nq?'none':mt.how,score:nq?0:mt.score,remember:!nq&&mt.how==='fuzzy'};
    if(nq){o.noqty=true;o.skip=true;}
    if(x.lead)o.lead=true;
    return o;
  });
  t.reg='';
  if(t.cloudId&&!t.review){var cf=syFileById(t.cloudId);if(cf&&cf.reg&&regKnown(cf.reg)&&regionList().length>1)t.reg=cf.reg;}   /* регион ТТК — как у файла в облаке */
  t.sameId=t.review?null:findSameRecipe(t,t.reg);
  if(t.forId&&!t.review&&S.recipes[t.forId]){t.sameId=t.forId;t.reg=S.recipes[t.forId].reg||'';}   /* «Привязать ТТК» из карты без ТТК: файл ложится в эту карту */
  t.hdr=ttkHdrInit(t);t.hdr0=hdrFromFile(t)?{org:t.hdr.org,head:t.hdr.head,headName:t.hdr.headName,date:t.hdr.date}:null;
  t.back=(S.tab==='cloud'||t.cloudId||t.review)?'cloud':(S.ttkHome?'home':'');     /* куда вернуться по «Отмена»: список облака, стартовый экран или открытая карта */
  S.ttk=t;S.tab='calc';S.ttkHome=false;
  renderAll();
  var c=$('#ttkCard');if(c&&c.scrollIntoView)c.scrollIntoView({block:'start'});
}
/* разбор .docx из байтов: файл с компьютера или из облака */
function loadTtkBuffer(buf,name,extra){
  if(typeof DecompressionStream==='undefined'){flash('Этот браузер не открывает .docx. Нужен современный Chrome, Edge, Firefox или Safari.');return Promise.resolve();}
  return unzipEntry(buf,'word/document.xml').then(function(u8){
    if(!u8)throw new Error('nodoc');
    var parsed=parseTtk(new TextDecoder('utf-8').decode(u8));
    if(!parsed.rows.length){flash('В файле не найдена таблица рецептуры с колонками «Брутто» и «Нетто»');return;}
    parsed.buf=buf;
    if(extra&&extra.cloudId)parsed.cloudId=extra.cloudId;
    if(extra&&extra.review)parsed.review=extra.review;
    if(extra&&extra.forId)parsed.forId=extra.forId;
    startTtk(parsed,name);
  }).catch(function(){flash('Не получилось разобрать файл. Проверьте, что это .docx из Word.');});
}
function onTtkFile(file){
  if(!file)return;
  if(!/\.docx$/i.test(file.name)){flash('Нужен файл Word с расширением .docx');return;}
  var fr=new FileReader();
  fr.onerror=function(){flash('Не удалось прочитать файл');};
  var forId=S.ttkFor||'';S.ttkFor='';
  fr.onload=function(){loadTtkBuffer(fr.result,file.name,forId?{forId:forId}:null);};
  fr.readAsArrayBuffer(file);
}
/* итог по файлу: что из карты загружено, чего в файле нет */
function ttkFoundNotes(t){
  if(t.fieldsErr)return[['warn','Реквизиты и тексты разделов из файла прочитать не удалось: в карте останутся стандартные тексты. Рецептура загружена.']];
  var f=t.fields||{};
  function has(ks){return ks.some(function(k){return String(f[k]||'').trim();});}
  var got=[],miss=[];
  function chk(ok,name){(ok?got:miss).push(name);}
  chk(has(['num','dish','org','head','headName','date'])||!!t.number,'реквизиты и шапка');
  chk(has(['scope']),'область применения (I)');
  chk(has(['r21','r22','r23']),'требования к сырью (II)');
  chk(has(['t41','t42']),'технология приготовления (IV)');
  chk(has(['s51','s52','s53','s54']),'оформление, подача, хранение (V)');
  var no=['look','color','texture','taste'].filter(function(k){return String(f[k]||'').trim();}).length;
  if(no===4)got.push('органолептика (п. 6.1)');
  else if(no>0)got.push('органолептика, частично: '+no+' из 4');
  else miss.push('органолептика (п. 6.1)');
  var out=[];
  if(got.length)out.push(['good','Из файла загружено: '+got.join('; ')+'.']);
  if(miss.length)out.push(['warn','В файле не найдено: '+miss.join('; ')+'. В карте останутся стандартные тексты или пустые поля. Заполните их ниже, в блоке «Карта ТТК».']);
  return out;
}
function ttkStatus(x){
  if(x.skip)return['neutral','Пропущено'];
  if(x.ing==='__new__')return['warn','Новое сырьё'];
  if(!x.ing)return['bad','Не выбрано'];
  if(x.how==='alias')return['ok','Запомнено'];
  if(x.how==='exact')return['ok','Совпало'];
  if(x.how==='fuzzy')return['warn','Проверьте'];
  return['neutral','Выбрано вами'];
}
function ttkHtml(){
  var t=S.ttk;if(!t)return'';
  var h='<section class="card ttk" id="ttkCard"><h2>'+(t.review?'Проверка файла':'Загружена ТТК')+(t.number?' №'+esc(t.number):'')+': '+esc(t.dish||'без названия')+'</h2>'
    +(t.review?'<p class="hint cmsg warn" style="margin-top:2px">Файл «'+esc(t.file)+'»'+(t.review.by?' от '+esc(t.review.by):'')+' ждёт проверки. Сверьте строки с сырьём из базы и нажмите «Открыть для проверки»: откроется карта, которую можно поправить; сверху будет плашка с решением (принять, вернуть автору с комментарием или отклонить).</p>':'')
    +'<p class="hint" style="margin-top:2px">Файл «'+esc(t.file)+'»'+(t.cloudId?' (из облака)':'')+'. Для каждой строки рецептуры проверьте, какое сырьё из базы подставлено. КБЖУ считается по нетто, себестоимость — по брутто. Брутто берётся из ТТК (серым под нетто); если его в файле нет, оно считается по проценту потерь из базы сырья, а если и его нет, равно нетто.</p>'
    +ttkHdrHtml(t)
    +'<div class="trows"><div class="trow thead"><span>В ТТК</span><span class="r">Нетто (брутто), г</span><span>Сырьё в базе</span><span>Статус</span></div>';
  t.rows.forEach(function(x,i){
    var st=ttkStatus(x);
    h+='<div class="trow'+(x.skip?' tskip':'')+'" data-i="'+i+'"><span class="tn">'+esc(x.name)+(x.note?'<span class="tsub">'+esc(x.note)+'</span>':(x.noqty&&x.skip?'<span class="tsub">количество не указано</span>':(x.lead?'<span class="tsub">в файле стояло «Или», но основной строки выше нет: взято как обычная строка</span>':'')))+'</span><span class="tnet">'+toInput(x.net)+((x.gross!==null&&x.gross!==undefined)?'<small class="tgr">брутто '+toInput(x.gross)+'</small>':'')+'</span>'
      +'<span class="tsel">'+pickerHtml('ttkIng','t:'+i,x.skip?'__skip__':x.ing,'Сырьё из базы для «'+x.name+'»','— выбрать из базы —','new')+'</span>'
      +'<span class="tst"><span class="tstat '+st[0]+'">'+st[1]+'</span>'
      +((x.ing&&x.ing!=='__new__'&&x.how!=='alias'&&x.how!=='exact')?'<label class="trem"><input type="checkbox" data-act="ttkRem" data-edit'+(x.remember?' checked':'')+'>запомнить</label>':'')
      +'</span></div>';
    if(x.alts&&x.alts.length&&!uiRO()){
      h+='<div class="talts"><span>или:</span>'+x.alts.map(function(a,k){
        return'<button class="btn mini" data-act="ttkAlt" data-i="'+i+'" data-k="'+k+'" title="Взять этот вариант вместо «'+esc(x.name)+'»: сырьё подберётся по его названию">'+esc(a.name)+((a.net!==null&&a.net!==undefined)?' · '+toInput(a.net)+' г':'')+'</button>';
      }).join(' ')+'</div>';
    }
  });
  h+='</div>';
  var unmatched=t.rows.filter(function(x){return!x.ing&&!x.skip;}).length,skipCnt=t.rows.filter(function(x){return x.skip;}).length,newCnt=t.rows.filter(function(x){return x.ing==='__new__';}).length;
  h+='<div class="tout"><label class="field w150"><span class="lbl">Выход 1 порции, г</span><input class="num" inputmode="decimal" autocomplete="off" data-act="ttkOut" data-edit data-fk="t:out" value="'+toInput(t.output)+'"></label></div>';
  if(regionList().length>1&&!t.review){
    h+='<div class="tout"><label class="field" style="max-width:320px"><span class="lbl">Для какого региона эта ТТК</span><select data-act="ttkReg" data-edit data-fk="t:reg"><option value="">Для всех регионов</option>'
      +regionList().map(function(g){return'<option value="'+esc(g.id)+'"'+(t.reg===g.id?' selected':'')+'>Только «'+esc(g.name||g.id)+'»</option>';}).join('')
      +'</select></label></div>'
      +'<p class="hint" style="margin-top:6px">Если выход блюда в регионах разный, загрузите ТТК для каждого региона отдельно: у региона будет своя карта, а в остальных регионах останется общая.</p>';
  }
  var notes=[];
  if(unmatched)notes.push(['bad','Не выбрано сырьё в строках: '+unmatched+'. Они войдут в расчёт без КБЖУ, а расчёт покажет ошибку.']);
  if(skipCnt)notes.push(['good','Пропущено строк: '+skipCnt+'. Они останутся в карте ТТК, но в КБЖУ, себестоимость и предупреждения не войдут.']);
  if(newCnt)notes.push(['warn','Новое сырьё ('+newCnt+') добавится в базу с нулевыми значениями и пометкой «Ориентир». Заполните КБЖУ на вкладке «База сырья».']);
  t.semi.forEach(function(s){
    if(!s.cooked&&s.mass!==null&&Math.abs(s.sum-s.mass)>0.5)notes.push(['warn','Проверьте ТТК: сумма нетто строк выше «'+esc(s.name)+'» равна '+fmt(s.sum,1)+' г, а в ТТК указано '+fmt(s.mass,1)+' г.']);
  });
  if(t.unitFix)notes.push(['warn','В шапке у нетто на 1 порцию стоит «кг», а у брутто «гр.»: это опечатка, взяты граммы. Проверьте количество в строках.']);
  if(t.kgFix)notes.push(['warn','В шапке колонки стоит «кг», но выход блюда указан как граммы (50 и больше). Числа прочитаны как граммы. Проверьте количество в строках.']);
  if(t.hdrFix)notes.push(['warn','В шапке таблицы вторая колонка подписана «Брутто» (как первая), хотя по значениям это нетто: взята как нетто. Проверьте количество в строках.']);
  if(!(t.output>0))notes.push(['bad','Выход блюда в ТТК не найден. Введите его вручную.']);
  else if(/[\/+]/.test(t.outputText||''))notes.push(['good','Выход в ТТК указан как «'+esc(t.outputText)+'», принято '+fmt(t.output,0)+' г (сумма частей).']);
  if(t.skipped&&t.skipped.length)notes.push(['warn','Строки без количества: '+t.skipped.map(esc).join('; ')+'. Они сохранятся в карте ТТК (в состоянии «Пропущено»), но в КБЖУ и себестоимость не войдут. Чтобы учесть строку в расчёте, выберите для неё сырьё из базы и после создания расчёта укажите количество.']);
  if(t.totals&&t.totals.length){
    notes.push(['good','Строки итогов не считаются сырьём и в расчёт не входят, но сохранятся в карте для поваров: '+t.totals.map(function(x){return esc(x.name.replace(/[\s:.]+$/,''));}).join('; ')+'.']);
    t.totals.forEach(function(x){
      if(!x.cooked&&x.mass!==null&&x.sum>0&&Math.abs(x.sum-x.mass)>0.5)notes.push(['warn','Проверьте ТТК: сумма нетто строк выше «'+esc(x.name.replace(/[\s:.]+$/,''))+'» равна '+fmt(x.sum,1)+' г, а в ТТК указано '+fmt(x.mass,1)+' г.']);
    });
  }
  if(t.groups&&t.groups.length)notes.push(['good','Заголовки полуфабрикатов без количества: '+t.groups.map(esc).join('; ')+'. Сами заголовки в расчёт не входят, учтены строки состава под ними.']);
  if(t.extraTables)notes.push(['warn','В файле есть ещё таблицы с колонками «Брутто» и «Нетто» ('+t.extraTables+'). Использована первая, остальные не читались.']);
  if(t.rows.some(function(x){return x.note;}))notes.push(['warn','В строках с пометкой вместо нетто взято брутто: проверьте количество.']);
  var leadN=t.rows.filter(function(x){return x.lead;});
  if(leadN.length)notes.push(['warn','Перед названием стояло «Или», но основной строки выше нет: '+leadN.map(function(x){return esc(x.name);}).join('; ')+'. Строка принята как обычное сырьё, слово «Или» убрано из названия. Если оно нужно в карте, допишите его в названии после создания расчёта.']);
  var altN=t.rows.filter(function(x){return x.alts&&x.alts.length;}).length;
  if(altN)notes.push(['good','Варианты «Или …» (строк с вариантом: '+altN+') сохранятся в карте под основной строкой, но в расчёт не входят: считается основная. Если вариант нужен вместо основной строки, нажмите на него под строкой в таблице.']);
  else if(t.alts&&t.alts.length)notes.push(['good','Строки «Или …» пропущены как варианты основной строки, чтобы не считать их дважды: '+t.alts.map(esc).join('; ')+'.']);
  if(t.rows.some(function(x){return/кост/i.test(x.name);}))notes.push(['warn','В рецептуре есть кости: в бульон переходит лишь часть их питательных веществ. Если оставить долю 100 %, КБЖУ завысится. Долю костей можно уменьшить в расчёте.']);
  var rf=t.ref;
  if(rf){
    var per=rf.basis==='portion';
    notes.push(['good','КБЖУ из раздела VII ТТК: Б '+fmt(rf.p,1)+' · Ж '+fmt(rf.f,1)+' · У '+fmt(rf.c,1)+' · '+fmt(rf.kcal,1)+' ккал '+(per?'на 1 порцию'+(rf.portion>0?' ('+fmt(rf.portion,0)+' г)':''):'на 100 г')+'. Расчёт сверит себя с этими значениями'+(per?' на порцию':'')+'.']);
    if(per&&rf.portion>0&&t.output>0&&Math.abs(rf.portion-t.output)>0.5)notes.push(['warn','В ТТК порция указана как '+fmt(rf.portion,0)+' г, а выход рецептуры '+fmt(t.output,0)+' г. Сверка идёт со всем составом рецептуры, проверьте, входит ли в значения ТТК вся порция.']);
  }else notes.push(['warn','Раздел VII с КБЖУ в ТТК не найден, сверки не будет.']);
  ttkFoundNotes(t).forEach(function(q){notes.push(q);});
  if(t.review){}
  else if(t.sameId)notes.push(['warn','Расчёт этой ТТК уже есть'+(t.reg?' для региона «'+esc(regionName(t.reg))+'»':'')+': «'+esc(S.recipes[t.sameId].name)+'». Кнопка «Обновить расчёт» заменит его состав, значения протокола в блоке сверки сохранятся.']);
  else{
    var oth=findSameRecipe(t,t.reg||'',true);
    if(oth){var orr=S.recipes[oth];notes.push(['good','Такая ТТК уже есть ('+(orr.reg&&regKnown(orr.reg)?'для региона «'+esc(regionName(orr.reg))+'»':'для всех регионов')+'). Будет создана отдельная ТТК'+(t.reg?' для региона «'+esc(regionName(t.reg))+'»':'')+', существующая не изменится.']);}
  }
  h+='<ul class="warns">'+notes.map(function(n){return'<li class="w-'+n[0]+'">'+n[1]+'</li>';}).join('')+'</ul>';
  h+='<div class="btns" style="margin-top:12px">'
    +(t.review?'<button class="btn primary" data-act="ttkCreate" data-edit>Открыть для проверки</button>':(t.sameId?'<button class="btn primary" data-act="ttkCreate" data-edit>Обновить расчёт</button><button class="btn" data-act="ttkCreateNew" data-edit>Создать как новый</button>':'<button class="btn primary" data-act="ttkCreate" data-edit>Создать расчёт</button>'))
    +(S.mode==='local'&&syLinked()&&!t.cloudId&&t.buf?'<button class="btn" data-act="syFSaveLoaded">'+(syAdmin()?'Положить файл в облако':'Отправить файл на проверку')+'</button>':'')
    +'<button class="btn" data-act="ttkCancel">Отмена</button></div>'+syMsgHtml('fload')+'</section>';
  return h;
}
function addAlias(id,name){
  var ing=S.ings[id],k=normKey(name);
  if(!ing||!k||normKey(ing.name)===k)return;
  if(!ing.aliases)ing.aliases=[];
  if(ing.aliases.indexOf(k)<0){ing.aliases.push(k);queueSave('ingredients',id);}
}
/* вариант «Или …» вместо основной строки: основная становится вариантом (можно вернуть обратно), сырьё подбирается по названию; количество берётся у варианта, если оно в файле указано */
function ttkAltPick(i,k){
  var t=S.ttk,x=t&&t.rows[i],a=x&&x.alts&&x.alts[k],mt,had;
  if(!a)return;
  had=a.net!==null&&a.net!==undefined;
  x.alts[k]={name:x.name,net:had?x.net:null,gross:had?x.gross:null,note:had?(x.note||''):''};
  x.name=a.name;
  if(had){x.net=a.net;x.gross=(a.gross===undefined)?null:a.gross;x.note=a.note||'';}
  mt=matchIng(x.name,S.ings);
  x.ing=mt.id;x.how=mt.how;x.score=mt.score;x.remember=mt.how==='fuzzy';delete x.skip;
  S.focusFk='t:'+i;renderAll();
}
function doTtkCreate(asNew){
  var t=S.ttk;if(!t)return;
  var created={},rev=t.review||null,rows=t.rows.map(function(x){
    var id=x.ing;
    if(id==='__new__'){
      var k=normKey(x.name);
      if(!created[k]){
        created[k]=newId();
        S.ings[created[k]]=normIng({name:x.name,p:0,f:0,c:0,kind:'estimate',source:'Добавлено из ТТК'+(t.number?' №'+t.number:'')+': значения КБЖУ не заполнены'});
        S.ings[created[k]].aliases=[k];
        queueSave('ingredients',created[k]);
      }
      id=created[k];
    }else if(id&&x.remember&&x.how!=='alias'&&x.how!=='exact'){addAlias(id,x.name);}
    var nr={rid:newId(),ing:id,net:x.net,share:100,tname:x.name};
    if(x.skip&&!id)nr.skip=true;
    if(x.gross!==null&&x.gross!==undefined)nr.gross=x.gross;
    if(x.alts&&x.alts.length)nr.alts=normAlts(x.alts);
    return nr;
  });
  var old=(!asNew&&t.sameId)?S.recipes[t.sameId]:null,rid=old?t.sameId:newId();
  var cmpId=rev?findSameRecipe(t,t.reg||'',true):'';
  var rf=t.ref;
  var ref={label:'',p:null,f:null,c:null,kcal:null,tol:10,basis:'100'};
  if(rf)ref={label:'ТТК'+(t.number?' №'+t.number:'')+', раздел VII (значения из файла)',p:rf.p,f:rf.f,c:rf.c,kcal:rf.kcal,tol:10,basis:rf.basis};
  if(old&&old.ref&&[old.ref.p,old.ref.f,old.ref.c,old.ref.kcal].some(function(v){return v!==null;})&&!/^ттк/i.test(old.ref.label||''))ref=old.ref;
  var tf={},k0;
  if(old&&old.ttk)for(k0 in old.ttk)tf[k0]=old.ttk[k0];
  if(t.fields)for(k0 in t.fields)tf[k0]=t.fields[k0];
  if(t.number)tf.num=t.number;
  if(t.hdr){HDR_KEYS.forEach(function(k){tf[k]=String(t.hdr[k]==null?'':t.hdr[k]).replace(/\s+/g,' ').trim();});hdrPresetPut(t.hdr);}   /* шапка, как её поправил человек; запоминается для региона */
  /* итоговые строки рецептуры («Итого фарша:», «Масса полуфабриката»): в карту для поваров, в расчёт не входят */
  tf.subs=JSON.stringify((t.subs||[]).slice().sort(function(a,b){return a.seq-b.seq;}).map(function(x){
    return{n:String(x.name).replace(/\s+/g,' ').trim(),m:x.mass>0?dnum(x.mass,3):'',a:(x.at>0&&rows[x.at-1])?rows[x.at-1].rid:''};
  }));
  tf.semiName='';tf.semiMass='';tf.semiAfter='0';
  var reg=(t.reg&&regKnown(t.reg))?t.reg:'',nm0=old?old.name:ttkName(t);
  if(!old&&reg&&nameTaken(nm0))nm0=nm0+' · '+regionName(reg);
  if(!old){
    var lblTaken=function(n){var k=normKey(recLabel({name:n,reg:reg||undefined}));return Object.keys(S.recipes).some(function(i){return normKey(recLabel(S.recipes[i]))===k;});};
    if(nameTaken(nm0)||lblTaken(nm0)){var nb0=nm0,ni0=2;while(nameTaken(nm0)||lblTaken(nm0))nm0=nb0+' ('+(ni0++)+')';}
  }   /* «Создать как новый»: название всегда своё, чтобы карты не путались и не склеивались при синхронизации */
  var nrd={name:nm0,output:t.output,rows:rows,ref:ref,ttk:tf};
  if(reg)nrd.reg=reg;
  if(old)['sell','qty','aliases','op','cat','arch'].forEach(function(k){if(old[k]!==undefined)nrd[k]=old[k];});
  S.recipes[rid]=normRecipe(nrd);
  if(t.cloudId&&!rev&&!layOn()&&!(S.recipes[rid].cat&&catById(S.recipes[rid].cat))){      /* папка — как у файла в облаке */
    var cf0=syFileById(t.cloudId),tt0=lyFileTitle(cf0),cid0=tt0?lyCatFor(tt0,true):'';
    if(cid0){S.recipes[rid].cat=cid0;saveMenu();}
  }
  if(reg&&reg!==curRegion())setRegion(reg);
  S.ttk=null;S.tab='calc';S.ttkHome=false;setActive(rid);queueSave('recipes',rid);
  if(rev)frStart(rev,rid,Object.keys(created).map(function(k){return created[k];}),ttkName(t),cmpId);
  renderAll();
  if(rev){frSnap();window.scrollTo(0,0);flash('Файл открыт для проверки: можно править и принять решение на плашке сверху');return;}
  flash((old?'Расчёт обновлён':'Расчёт создан')+(reg?' для региона «'+regionName(reg)+'»':''));
}
function usedIn(iid){return Object.keys(S.recipes).filter(function(id){return S.recipes[id].rows.some(function(x){return x.ing===iid;});}).map(function(id){return S.recipes[id].name||'Без названия';});}
function importRows(text,kind){
  var lines=parseRecords(text);
  var add=0,upd=0,skip=[],foreign='',priceSkipped=0,partial=[],unk=0;
  /* колонка цены подписана регионом выгрузки («Цена, ₽ (Москва)»): если это не выбранный регион, цены из файла не записываются — КБЖУ загрузится */
  var h0=lines[0],lab=(h0&&!parseNumL(h0[1]||'').ok)?String(h0[13]||'').match(/^Цена, ₽\s*\((.+)\)\s*$/):null;
  if(lab&&lab[1].trim().toLowerCase()!==String(regionName(curRegion())).trim().toLowerCase())foreign=lab[1].trim();
  var byLower={};Object.keys(S.ings).forEach(function(id){byLower[S.ings[id].name.trim().toLowerCase()]=id;});
  var kindByLabel={};Object.keys(KINDS).forEach(function(k){kindByLabel[KINDS[k].toLowerCase()]=k;});
  var lossKeys=['cold','boil','fry','stew','bake'];
  lines.forEach(function(parts,idx){
    var name=(parts[0]||'').trim(),p=parseNumL(parts[1]||''),f=parseNumL(parts[2]||''),c=parseNumL(parts[3]||'');
    if(!name||parts.length<2||!p.ok||!f.ok||!c.ok){if(idx>0||(name&&p.ok&&f.ok&&c.ok))skip.push(idx+1);return;}
    /* пустая клетка — это «не знаем», а не ноль: частично заполненные БЖУ не загружаются, полностью пустые дают «КБЖУ неизвестно», а у уже известного сырья значения не затираются */
    var ne=(p.empty?1:0)+(f.empty?1:0)+(c.empty?1:0);
    if(ne>0&&ne<3){partial.push(idx+1);return;}
    var allEmpty=ne===3;
    var src=(parts[4]||'').trim(),key=name.toLowerCase(),id=byLower[key];
    /* колонки выгрузки: 6 — ккал (игнорируется), 7 — тип данных, 8–12 — потери, 13 — синонимы */
    var rowKind=kindByLabel[(parts[6]||'').trim().toLowerCase()]||kind;
    var loss={},hasLoss=false;
    lossKeys.forEach(function(k,j){var cell=(parts[7+j]||'').trim(),q=cell===''?null:parseNumL(cell);loss[k]=(q&&q.ok)?q.v:null;if(loss[k]!==null)hasLoss=true;});
    var al=(parts[12]||'').split('|').map(normKey).filter(Boolean);
    /* колонки 14–17: цена, единица цены, масса упаковки, позиция в прайсе */
    var pq=(parts[13]||'').trim()===''?null:parseNumL(parts[13]),pu=/уп|шт/i.test(parts[14]||'')?'pack':'',pgq=(parts[15]||'').trim()===''?null:parseNumL(parts[15]),psrc=(parts[16]||'').trim();
    function setPrice(o){
      var g=curRegion();
      if(NOPRICE)return;
      if(!((pq&&pq.ok)||(pgq&&pgq.ok&&pgq.v>0)||psrc))return;
      if(foreign){priceSkipped++;return;}
      var rec=recFor(o,g,true);
      if(pq&&pq.ok)rec.price=pq.v;
      if(pq&&pq.ok){if(pu)rec.priceUnit=pu;else delete rec.priceUnit;}
      if(pgq&&pgq.ok&&pgq.v>0)rec.packG=pgq.v;
      if(psrc)rec.priceSrc=psrc.slice(0,200);
      pruneRec(o,g);
    }
    var icat=(parts[17]||'').trim().replace(/\s+/g,' ').slice(0,40);
    if(id){var o=S.ings[id];if(icat){if(icat===autoCat(o.name))delete o.cat;else o.cat=icat;}if(!allEmpty){o.p=p.v;o.f=f.v;o.c=c.v;o.kind=rowKind;}if(src)o.source=src;if(hasLoss)o.loss=loss;if(al.length){o.aliases=(o.aliases||[]).concat(al.filter(function(a){return(o.aliases||[]).indexOf(a)<0;}));}setPrice(o);upd++;}
    else{id=newId();S.ings[id]={name:name,p:p.v,f:f.v,c:c.v,kind:allEmpty?'estimate':rowKind,source:src};if(allEmpty)unk++;if(icat&&icat!==autoCat(name))S.ings[id].cat=icat;if(hasLoss)S.ings[id].loss=loss;else lossFill(S.ings[id]);if(al.length)S.ings[id].aliases=al;setPrice(S.ings[id]);byLower[key]=id;add++;}
    queueSave('ingredients',id);
  });
  return{add:add,upd:upd,skip:skip,foreign:foreign,priceSkipped:priceSkipped,partial:partial,unk:unk};
}
/* пояснение, когда цены из файла другого региона не записаны */
function importForeignNote(r){
  return r.foreign&&r.priceSkipped?' Цены ('+r.priceSkipped+' поз.) не записаны: файл выгружен из региона «'+r.foreign+'», а выбран «'+regionName(curRegion())+'». Чтобы загрузить цены, выберите вверху регион «'+r.foreign+'» и загрузите файл ещё раз.':'';
}
function doImport(){
  var ta=$('#impText'),r=importRows(ta.value,$('#impKind').value);
  S.importMsg='Добавлено: '+r.add+', обновлено: '+r.upd+(r.skip.length?', пропущено строк: '+r.skip.length+' (номера: '+r.skip.slice(0,6).join(', ')+(r.skip.length>6?'…':'')+')':'')+'.'+(r.unk?' Без КБЖУ в файле: '+r.unk+' (в базе помечены «Ориентир — проверить», в расчёт идут как «КБЖУ неизвестно», не как ноль).':'')+(r.partial.length?' Не загружены строки с частично заполненным БЖУ (номера: '+r.partial.slice(0,6).join(', ')+(r.partial.length>6?'…':'')+'): впишите все три значения или оставьте все пустыми.':'')+importForeignNote(r);
  if(!r.skip.length&&!r.partial.length)ta.value='';
  renderAll();
}
