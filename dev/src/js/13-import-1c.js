/*P1C-START*/
/* ---- загрузка цен из выгрузки 1С: отчёт «Номенклатура → Период, Склад, Партнёр, Цена, Количество» ---- */
function c1Str(v){return String(v==null?'':v).replace(/[\u00a0\u2007\u202f\u2009\u200b]/g,' ').replace(/\s+/g,' ').trim();}
/* число из 1С или Excel: «1 589,07», «1589.07», «1,589.07», 275.56 */
function c1Num(v){
  if(typeof v==='number')return isFinite(v)?v:null;
  var t=c1Str(v).replace(/ /g,'').replace(/[−–]/g,'-');
  if(!/^-?\d[\d.,]*$/.test(t))return null;
  var lc=t.lastIndexOf(','),ld=t.lastIndexOf('.');
  if(lc>-1&&ld>-1){
    if(lc>ld)t=t.replace(/\./g,'').replace(',','.');
    else t=t.replace(/,/g,'');
  }else if(lc>-1){
    if(t.indexOf(',')!==lc)return null;
    t=t.replace(',','.');
  }else if(ld>-1&&t.indexOf('.')!==ld)return null;
  var n=Number(t);
  return isFinite(n)?n:null;
}
/* дата → ГГГГ-ММ-ДД; время отбрасывается */
function c1Date(v){
  var s=c1Str(v),m=/^(\d{1,2})\.(\d{1,2})\.(\d{4}|\d{2})(?!\d)/.exec(s),y,mo,d;
  if(m){d=+m[1];mo=+m[2];y=+m[3];if(m[3].length===2)y+=2000;}
  else{
    m=/^(\d{4})-(\d{2})-(\d{2})(?!\d)/.exec(s);
    if(!m)return null;
    y=+m[1];mo=+m[2];d=+m[3];
  }
  if(mo<1||mo>12||d<1||d>31||y<2000||y>2100)return null;
  return y+'-'+(mo<10?'0':'')+mo+'-'+(d<10?'0':'')+d;
}
function c1DateRu(iso){
  var m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso||''));
  return m?m[3]+'.'+m[2]+'.'+m[1]:String(iso||'');
}
var C1_UNITS={'кг':'kg','килограмм':'kg','kg':'kg','г':'g','гр':'g','грамм':'g','л':'l','литр':'l','л(дм3)':'l','л(дм³)':'l','дм3':'l','дм³':'l','мл':'ml',
  'шт':'pc','штук':'pc','штука':'pc','уп':'pc','упак':'pc','упаковка':'pc','пач':'pc','пачка':'pc','пак':'pc','пакет':'pc','бут':'pc','бутылка':'pc','бан':'pc','банка':'pc','кор':'pc','коробка':'pc','рул':'pc','рулон':'pc','порц':'pc','порция':'pc','пара':'pc','компл':'pc','ед':'pc','кусок':'pc'};
function c1Unit(v){
  var t=c1Str(v).toLowerCase().replace(/[.\s]/g,'');
  return Object.prototype.hasOwnProperty.call(C1_UNITS,t)?C1_UNITS[t]:null;
}
var C1_UNIT_NAME={kg:'кг',g:'г',l:'л',ml:'мл',pc:'шт'};
/* масса штуки в граммах по названию: «…80г», «…0,350л», «…0,400 кг»; 0, если в названии массы нет */
function c1Mass(name){
  var m=/(\d+(?:[.,]\d+)?)\s*(кг|гр|г|мл|л)(?![а-яёa-z%])/i.exec(String(name||'').replace(/(\d)\s+(?=\d{3}\b)/g,'$1'));
  if(!m)return 0;
  var v=Number(m[1].replace(',','.')),u=m[2].toLowerCase();
  if(!(v>0))return 0;
  return Math.round((u==='кг'||u==='л'?v*1000:v)*100)/100;
}
var C1_DATE_RE=/^\d{1,2}\.\d{1,2}\.\d{2,4}/;
/* строки таблицы (массивы ячеек) → позиции с закупками. Распознаётся по содержимому, а не по номерам колонок: подходит и вставка из Excel, и .xlsx */
function c1Parse(rows){
  var out={from:'',to:'',wh:'',items:[],total:null,sum:0,issues:[],lines:0,ok:true};
  var cur=null,hasWh=null,byKey={},colQ=-1,colP=-1,qFirst=false;
  function issue(t){if(out.issues.length<30)out.issues.push(t);}
  rows.forEach(function(raw,ri){
    var cells=(raw||[]).map(c1Str).filter(function(x){return x!=='';});
    if(!cells.length)return;
    var line=cells.join(' '),m;
    m=/период\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})\s*[-–—]\s*(\d{1,2}\.\d{1,2}\.\d{4})/i.exec(line);
    if(m&&!out.from){out.from=c1Date(m[1])||'';out.to=c1Date(m[2])||'';}
    m=/дата\s*с\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i.exec(line);
    if(m&&!out.from)out.from=c1Date(m[1])||'';
    m=/дата\s*по\s*:?\s*(\d{1,2}\.\d{1,2}\.\d{4})/i.exec(line);
    if(m&&!out.to)out.to=c1Date(m[1])||'';
    m=/склад\s+равно\s+["«]([^"»]+)["»]/i.exec(line);
    if(m&&!out.wh)out.wh=m[1].trim();
    if(/^(параметры|отбор)(?![а-яёa-z])/i.test(cells[0]))return;
    if(/^номенклатура$/i.test(cells[0]))return;
    if(/^период$/i.test(cells[0])&&cells.length>1&&!C1_DATE_RE.test(cells[1])){
      hasWh=cells.some(function(x){return/^склад/i.test(x);});
      /* порядок колонок берётся из заголовка: бывает «Цена, Количество» и «Количество, Цена»; номера колонок — из строки заголовка */
      colQ=-1;colP=-1;
      (raw||[]).map(c1Str).forEach(function(x,i){if(colQ<0&&/^количество/i.test(x))colQ=i;if(colP<0&&/^цена/i.test(x))colP=i;});
      if(colQ<0||colP<0){colQ=-1;colP=-1;}
      qFirst=colQ>-1&&colQ<colP;
      return;
    }
    if(/^итого(?![а-яёa-z])/i.test(cells[0])){
      var tv=c1Num(cells[cells.length-1]);
      if(tv!==null&&out.total===null)out.total=tv;
      return;
    }
    var last=cells.length-1;
    if(C1_DATE_RE.test(cells[0])&&c1Date(cells[0])){
      if(!cur){issue('Строка '+(ri+1)+': закупка без названия позиции');return;}
      var q=null,p=null,mid,rc=null;
      if(colQ>-1){rc=(raw||[]).map(c1Str);q=c1Num(rc[colQ]);p=c1Num(rc[colP]);}
      if(rc&&q!==null&&p!==null)mid=rc.slice(1,Math.min(colQ,colP)).filter(function(x){return x!=='';});
      else{
        q=c1Num(cells[last]);p=last>=2?c1Num(cells[last-1]):null;
        if(qFirst){var t0=q;q=p;p=t0;}
        mid=cells.slice(1,last-1);
      }
      if(q===null||p===null){issue('Строка '+(ri+1)+': не найдены цена и количество («'+cur.name+'»)');return;}
      var sup='',wh='';
      if(mid.length>=2){wh=mid[0];sup=mid[mid.length-1];}
      else if(mid.length===1){if(hasWh===true)wh=mid[0];else sup=mid[0];}
      cur.lines.push({d:c1Date(cells[0]),wh:wh,sup:sup,p:p,q:q});
      out.lines++;
      return;
    }
    if(cells.length===2&&c1Unit(cells[1])&&c1Num(cells[0])===null){      /* позиция и единица, итогового количества нет: оно считается по закупкам */
      var u2=c1Unit(cells[1]),key2=normKey(cells[0])+'|'+u2;
      if(byKey[key2])cur=byKey[key2];
      else{cur={name:cells[0],unit:u2,uraw:cells[1],qty:null,lines:[]};byKey[key2]=cur;out.items.push(cur);}
      return;
    }
    if(cells.length>=3&&c1Num(cells[last])!==null){
      var ui=c1Unit(cells[1])?1:(c1Unit(cells[last-1])?last-1:-1);
      if(ui>0){
        var u=c1Unit(cells[ui]),key=normKey(cells[0])+'|'+u;
        if(byKey[key]){cur=byKey[key];cur.qty=(cur.qty||0)+c1Num(cells[last]);}
        else{cur={name:cells[0],unit:u,uraw:cells[ui],qty:c1Num(cells[last]),lines:[]};byKey[key]=cur;out.items.push(cur);}
        return;
      }
    }
    if(cells.length===1&&cur&&!cur.lines.length&&c1Num(cells[0])===null){
      cur.name+=' '+cells[0];
      return;
    }
    if(cells.length===1)return;
    if(cells.length===2&&c1Num(cells[1])!==null&&!c1Unit(cells[0]))issue('Строка '+(ri+1)+': у позиции «'+cells[0]+'» нет единицы измерения, пропущена');
  });
  out.items.forEach(function(it){
    var s=0;it.lines.forEach(function(l){s+=l.q;});
    it.sumQ=s;
    if(it.qty===null){it.qty=s;it.warn=false;}
    else it.warn=Math.abs(s-it.qty)>0.011*Math.max(1,it.lines.length);
    out.sum+=it.qty;
  });
  if((!out.from||!out.to)&&out.items.length){
    var ds=[];out.items.forEach(function(it){it.lines.forEach(function(l){ds.push(l.d);});});
    ds.sort();if(ds.length){if(!out.from)out.from=ds[0];if(!out.to)out.to=ds[ds.length-1];}
  }
  if(out.total!==null)out.ok=Math.abs(out.sum-out.total)<=Math.max(0.05,0.005*out.items.length);
  var w=out.items.filter(function(i){return i.warn;}).length;
  if(w)issue('У '+w+' позиций сумма закупок не равна количеству в заголовке позиции');
  if(!out.ok)issue('Итог отчёта ('+out.total+') не сходится с суммой по позициям ('+(Math.round(out.sum*100)/100)+'): возможно, часть строк не распознана');
  return out;
}
/* закупки позиции → строки в пересчёте на килограмм: pk — ₽ за кг, kg — масса. packG — масса штуки, г (для штучных позиций) */
/* литр не равен килограмму: объём переводится в массу по плотности сырья (г/мл). Пока плотность не задана, считается 1 г/мл, и это отмечается (assumed) */
function c1Conv(item,packG,dens){
  var f={kg:1,g:0.001,l:1,ml:0.001}[item.unit],asm=false;
  if(item.unit==='l'||item.unit==='ml'){if(dens>0)f=f*dens;else asm=true;}
  if(item.unit==='pc')f=packG>0?packG/1000:0;
  if(!(f>0))return{ok:false,lines:[],skipped:0};
  var ls=[],sk=0;
  item.lines.forEach(function(l,k){
    if(!(l.p>0)||!(l.q>0)){sk++;return;}
    ls.push({d:l.d,wh:l.wh||'',sup:l.sup,pk:Math.round(l.p/f*10000)/10000,kg:Math.round(l.q*f*10000)/10000,p:l.p,q:l.q,ix:k});
  });
  return{ok:ls.length>0,lines:ls,skipped:sk,assumed:asm};
}
/* проверка цены на ошибку прихода (лук за 1000 ₽): скачок к цене в базе и строки, выбивающиеся из закупок той же позиции */
var C1_JUMP_UP=1.5,C1_JUMP_DN=0.6,C1_SPREAD=1.8;
function c1Sanity(lines,pr,old){
  var w=[],out={},pks=lines.map(function(l){return l.pk;}).sort(function(a,b){return a-b;}),med=0;
  if(pks.length)med=pks.length%2?pks[(pks.length-1)/2]:(pks[pks.length/2-1]+pks[pks.length/2])/2;
  if(lines.length>=2&&med>0)lines.forEach(function(l){if(l.pk>=med*C1_SPREAD||l.pk<=med/C1_SPREAD)out[l.ix]=1;});
  var nOut=Object.keys(out).length;
  if(lines.length===2&&nOut)out={};   /* из двух закупок не понять, какая ошибочная: отмечаем разброс без выделения строки */
  if(lines.length>=2&&pks[0]>0&&pks[pks.length-1]/pks[0]>=C1_SPREAD)w.push('закупки по разной цене: от '+money(pks[0])+' до '+money(pks[pks.length-1])+' ₽/кг');
  if(old>0&&pr>0&&(pr>=old*C1_JUMP_UP||pr<=old*C1_JUMP_DN))w.push((pr>old?'выше':'ниже')+' цены в базе в '+fmt(pr>old?pr/old:old/pr,1)+' раза');
  return{w:w,out:out,med:med};
}
/* цена за кг по правилу: avg — средневзвешенная по количеству, last — последняя закупка периода, min — самая низкая */
function c1Pick(lines,rule){
  var i,s=0,w=0;
  if(!lines.length)return null;
  if(rule==='min'){var m=lines[0].pk;lines.forEach(function(l){if(l.pk<m)m=l.pk;});return m;}
  if(rule==='last'){
    var ld='';lines.forEach(function(l){if(l.d>ld)ld=l.d;});
    lines.forEach(function(l){if(l.d===ld){s+=l.pk*l.kg;w+=l.kg;}});
    return w>0?s/w:null;
  }
  for(i=0;i<lines.length;i++){s+=lines[i].pk*lines[i].kg;w+=lines[i].kg;}
  return w>0?s/w:null;
}
/* «убрать лишнее» из названия 1С перед сопоставлением с базой: скобки с пометками, масса, проценты, одиночные дефисы */
function c1Clean(name){
  return String(name||'').replace(/\([^)]*\)/g,' ').replace(/\d+(?:[.,]\d+)?\s*(?:кг|гр|г|мл|л|шт)(?![а-яёa-z])/gi,' ').replace(/(^|\s)[-–+](?=\s|$)/g,' ').replace(/\s+/g,' ').trim();
}
function c1Pcts(s){var r=[],m,re=/(\d+(?:[.,]\d+)?)\s*%/g;while((m=re.exec(String(s||''))))r.push(Number(m[1].replace(',','.')));return r;}
/* сопоставление названия 1С с сырьём базы: как matchIng, но с поправкой на процент жирности (разные проценты — разное сырьё) */
var C1_NOISE={'мыт':1,'очищ':1,'пище':1,'помо':1,'рез':1,'цел':1};   /* слова-приметы обработки в названиях 1С: не отличают одно сырьё от другого */
function c1Match(name,ings){
  var mt=matchIng(name,ings);
  if(mt.how==='alias'||mt.how==='exact')return mt;
  var m2=matchIng(c1Clean(name),ings);
  if(m2.how!=='none'&&(mt.how==='none'||m2.score>=mt.score))mt=m2;
  if(mt.id&&mt.how==='fuzzy'){
    /* в названии 1С есть значимое слово, которого нет в названии из базы («красный», «белокочанная»…): это может быть другое сырьё, автоматически не засчитываем */
    var sa=stemList(c1Clean(name)),sb=stemList(ings[mt.id].name);
    if(sa.some(function(t){return sb.indexOf(t)<0&&!C1_NOISE[t];}))mt.extra=true;
    var a=c1Pcts(name),b=c1Pcts(ings[mt.id].name);
    if(a.length&&b.length&&a.every(function(x){return b.indexOf(x)<0;}))mt={id:mt.id,how:'fuzzy',score:Math.max(0,mt.score-0.3),pct:true,extra:mt.extra};
  }
  return mt;
}
/* текст (вставка из Excel или CSV) → строки; разделитель выбирается по всему тексту, а не по первой строке */
function c1Rows(text){
  var t=String(text==null?'':text),tabs=(t.match(/\t/g)||[]).length,semi=(t.match(/;/g)||[]).length;
  return parseRecords(t,false,tabs&&tabs>=semi/3?'\t':';');
}
/* ---- чтение .xlsx без библиотек: разбор XML из архива (сам архив распаковывает unzipEntry) ---- */
function xlUnesc(s){
  return String(s).replace(/&#x([0-9a-f]+);/gi,function(a,h){return String.fromCharCode(parseInt(h,16));}).replace(/&#(\d+);/g,function(a,d){return String.fromCharCode(+d);})
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
function xlText(xml){
  var out='',re=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g,m;
  xml=String(xml).replace(/<rPh[\s\S]*?<\/rPh>/g,'');
  while((m=re.exec(xml)))out+=m[1];
  return xlUnesc(out);
}
function xlShared(xml){
  var out=[],re=/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g,m;
  while((m=re.exec(String(xml||''))))out.push(xlText(m[1]));
  return out;
}
/* какие стили ячеек — даты (по встроенным кодам и по маске дд.мм.гггг) */
function xlDateStyles(xml){
  xml=String(xml||'');
  var custom={},m,re=/<numFmt\s[^>]*?numFmtId="(\d+)"[^>]*?formatCode="([^"]*)"/g;
  while((m=re.exec(xml)))custom[m[1]]=xlUnesc(m[2]);
  function isDateFmt(id){
    id=Number(id);
    var f=custom[String(id)];   /* свой формат книги важнее встроенного номера */
    if(f==null)return(id>=14&&id<=22)||(id>=27&&id<=36)||(id>=45&&id<=47)||(id>=50&&id<=58);
    f=f.replace(/"[^"]*"/g,'').replace(/\[[^\]]*\]/g,'').replace(/\\./g,'');
    return/[dmyhs]/i.test(f)&&!/[0#]/.test(f);
  }
  var cx=/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(xml),res=[];
  if(!cx)return res;
  var xr=/<xf\s[^>]*?numFmtId="(\d+)"/g,k;
  var parts=cx[1].match(/<xf\b[^>]*>/g)||[];
  for(k=0;k<parts.length;k++){var mm=/numFmtId="(\d+)"/.exec(parts[k]);res.push(mm?isDateFmt(mm[1]):false);}
  return res;
}
function xlCol(ref){
  var m=/^([A-Z]+)/.exec(ref),n=0,i;
  if(!m)return-1;
  for(i=0;i<m[1].length;i++)n=n*26+(m[1].charCodeAt(i)-64);
  return n-1;
}
function xlSerial(v){
  var ms=Math.round((Number(v)-25569)*86400000),d=new Date(ms);
  function z(n){return(n<10?'0':'')+n;}
  var s=z(d.getUTCDate())+'.'+z(d.getUTCMonth()+1)+'.'+d.getUTCFullYear();
  if(ms%86400000)s+=' '+d.getUTCHours()+':'+z(d.getUTCMinutes())+':'+z(d.getUTCSeconds());
  return s;
}
function xlNumStr(v){
  var n=Number(v);
  if(!isFinite(n))return String(v);
  return String(parseFloat(n.toPrecision(12)));
}
function xlRows(sheetXml,shared,dateSt){
  var rows=[],rre=/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g,rm;
  sheetXml=String(sheetXml||'');
  while((rm=rre.exec(sheetXml))){
    var body=rm[1]||'',row=[],cre=/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g,cm;
    while((cm=cre.exec(body))){
      var at=cm[1],inner=cm[2]||'',ref=/\br="([A-Z]+\d+)"/.exec(at),t=/\bt="(\w+)"/.exec(at),s=/\bs="(\d+)"/.exec(at),ci=ref?xlCol(ref[1]):row.length,val='';
      var vm=/<v>([\s\S]*?)<\/v>/.exec(inner);
      if(t&&t[1]==='s'){val=vm?(shared[Number(vm[1])]||''):'';}
      else if(t&&t[1]==='inlineStr'){val=xlText(inner);}
      else if(t&&t[1]==='str'){val=vm?xlUnesc(vm[1]):'';}
      else if(t&&t[1]==='b'){val=vm?vm[1]:'';}
      else if(vm){
        val=(s&&dateSt[Number(s[1])]&&isFinite(Number(vm[1])))?xlSerial(vm[1]):xlNumStr(vm[1]);
      }
      while(row.length<ci)row.push('');
      row[ci]=val;
    }
    if(row.some(function(x){return x!=='';}))rows.push(row);
  }
  return rows;
}
/* ---- история цен: каждая загрузка 1С — отдельная запись за период (settings/ph_<регион>_<с>_<по>) ---- */
var PH_RULES={avg:'Средневзвешенная за период',last:'Последняя закупка периода',min:'Самая низкая за период'};
function isIso(s){return/^\d{4}-\d{2}-\d{2}$/.test(String(s||''));}
/* объект (ресторан, точка) определяется по складу в выгрузке 1С. Запись истории — это регион + период + объект;
   у записей без объекта (загруженных раньше) идентификатор прежний, без хвоста */
function phObjName(s){return String(s==null?'':s).replace(/[\u00a0\u2007\u202f\u2009\u200b]/g,' ').replace(/\s+/g,' ').replace(/^[\s"«]+|[\s"»]+$/g,'').slice(0,80).trim();}
function phHash(s,seed){var h=seed>>>0,i;for(i=0;i<s.length;i++)h=(Math.imul(h,33)+s.charCodeAt(i))>>>0;return h;}
function phSlug(name){var k=normKey(phObjName(name));return k?'o'+phHash(k,5381).toString(36)+phHash(k,52711).toString(36):'';}
function phId(region,from,to,obj){var sl=phSlug(obj);return'ph_'+region+'_'+String(from).replace(/-/g,'')+'_'+String(to).replace(/-/g,'')+(sl?'_'+sl:'');}
function isPhId(id){return/^ph_[a-z0-9_-]{1,40}_\d{8}_\d{8}(?:_o[a-z0-9]{3,24})?$/i.test(String(id||''));}
function round4(v){return Math.round(v*10000)/10000;}
function normPh(d){
  d=d||{};
  var o={region:REG_ID.test(String(d.region||''))?String(d.region):MAIN,from:isIso(d.from)?d.from:'',to:isIso(d.to)?d.to:'',at:num(d.at),file:String(d.file||'').slice(0,120),wh:String(d.wh||'').slice(0,120),obj:phObjName(d.obj),rule:PH_RULES[d.rule]?d.rule:'avg',sup:[],it:[]};
  (Array.isArray(d.sup)?d.sup:[]).slice(0,300).forEach(function(s){o.sup.push(String(s).slice(0,100));});
  (Array.isArray(d.it)?d.it:[]).slice(0,3000).forEach(function(x){
    if(!x||!x.ing)return;
    var pr=nn(x.pr);if(!(pr>0))return;
    var e={ing:String(x.ing).slice(0,80),nm:String(x.nm||'').slice(0,200),pr:round4(pr),ln:[]};
    var pv=nn(x.pv);if(pv>0)e.pv=round4(pv);
    if(x.da)e.da=1;      /* цена посчитана при допущении «1 л = 1 кг» */
    if(Array.isArray(x.pn)&&x.pn.length)e.pn=x.pn.slice(0,12).map(function(n){return String(n).slice(0,120);});
    (Array.isArray(x.ln)?x.ln:[]).slice(0,600).forEach(function(l){
      if(!Array.isArray(l)||!isIso(l[0]))return;
      var si=Math.floor(Number(l[1])),pk=nn(l[2]),kg=nn(l[3]);
      if(!(pk>0)||!(kg>0))return;
      var ln=[l[0],(si>=0&&si<o.sup.length)?si:-1,round4(pk),round4(kg)],pi=Math.floor(Number(l[4]));
      if(e.pn&&l[4]!==undefined&&pi>=0&&pi<e.pn.length)ln.push(pi);
      e.ln.push(ln);
    });
    o.it.push(e);
  });
  return o;
}
/* записи истории региона по порядку периодов */
function phList(cfg,region){
  return Object.keys(cfg||{}).filter(isPhId).map(function(k){var b=cfg[k];return b;}).filter(function(b){return b&&b.region===region&&b.from&&b.to&&b.it&&b.it.length;})
    .sort(function(a,b){return a.from<b.from?-1:(a.from>b.from?1:(a.to<b.to?-1:(a.to>b.to?1:(a.obj<b.obj?-1:(a.obj>b.obj?1:0)))));});
}
/* запись истории из разобранной выгрузки: picks[i] = {ing, packG} для позиции i или null (пропустить); o = {region,from,to,file,wh,rule,base:{id: ₽/кг до загрузки}} */
function phBuild(items,picks,o){
  var sup=[],supIx={},byIng={},order=[],skipped=0;
  items.forEach(function(it,i){
    var pk=picks[i];
    if(!pk||!pk.ing){skipped++;return;}
    var cv=c1Conv(it,pk.packG||0,pk.dens||0);
    if(!cv.ok){skipped++;return;}
    var e=byIng[pk.ing];
    if(!e){e=byIng[pk.ing]={ing:pk.ing,nm:it.name,n:0,ln:[],pn:[]};order.push(pk.ing);}
    e.n++;if(pk.dAsm)e.da=1;
    var pi=e.pn.length<12?e.pn.push(String(it.name||'').slice(0,120))-1:-1;   /* какая позиция 1С дала строку закупки: чтобы проверить, куда её отнесло */
    cv.lines.forEach(function(l){
      var s=l.sup||'без поставщика';
      if(!Object.prototype.hasOwnProperty.call(supIx,s)){supIx[s]=sup.length;sup.push(s);}
      e.ln.push([l.d,supIx[s],l.pk,l.kg,pi]);
    });
  });
  var its=order.map(function(id){
    var e=byIng[id],lines=e.ln.map(function(x){return{d:x[0],pk:x[2],kg:x[3]};}),pr=c1Pick(lines,o.rule||'avg');
    var r={ing:id,nm:e.nm+(e.n>1?' (+'+(e.n-1)+')':''),pr:round4(pr),ln:e.ln};
    if(e.pn.length>1)r.pn=e.pn;
    if(e.da)r.da=1;
    if(o.base&&o.base[id]>0)r.pv=round4(o.base[id]);
    return r;
  });
  return normPh({region:o.region,from:o.from,to:o.to,at:o.at||Date.now(),file:o.file,wh:o.wh,obj:o.obj,rule:o.rule,sup:sup,it:its});
}
/* записать цену в запись региона по цене за кг: режим «за упаковку» сохраняется, если он уже был; штучная позиция без цены получает упаковку */
function phSetPrice(rec,pk,packG,pcs){
  var had=rec.price!==undefined&&rec.price!==null;
  if(rec.priceUnit==='pack'&&rec.packG>0){rec.price=r2(pk*rec.packG/1000);}
  else if(pcs&&packG>0&&!had){rec.priceUnit='pack';rec.packG=packG;rec.price=r2(pk*packG/1000);}
  else{rec.price=r2(pk);delete rec.priceUnit;delete rec.packG;}
}
function phKg(it){var s=0;it.ln.forEach(function(l){s+=l[3];});return s;}
function phSpend(it){var s=0;it.ln.forEach(function(l){s+=l[2]*l[3];});return s;}
function phSpendAll(b){var s=0;b.it.forEach(function(x){s+=phSpend(x);});return s;}
/* запись «до загрузки» из цен, которые были в базе, для сравнения первой загрузки */
function phBefore(b){
  var it=[];
  b.it.forEach(function(x){if(x.pv>0)it.push({ing:x.ing,nm:x.nm,pr:x.pv,ln:[]});});
  return it.length?{region:b.region,from:'',to:'',it:it,sup:[],before:true}:null;
}
/* сравнение двух периодов по сырью, которое есть в обоих; индекс — на корзине нового периода (те же объёмы, старые и новые цены) */
function phCompare(nb,ob){
  var om={},rows=[],sum={n:0,spend:nb?phSpendAll(nb):0,basketOld:0,basketNew:0,up:0,down:0,same:0,onlyNew:0,onlyOld:0,index:null,impact:0},nm={};
  ob.it.forEach(function(x){om[x.ing]=x;});
  nb.it.forEach(function(x){
    nm[x.ing]=1;
    var o=om[x.ing];
    if(!o){sum.onlyNew++;return;}
    var kg=phKg(x),d=x.pr-o.pr,pct=o.pr>0?d/o.pr*100:null;
    rows.push({ing:x.ing,nm:x.nm,old:o.pr,nw:x.pr,d:d,pct:pct,kg:kg,spend:phSpend(x),impact:d*kg});
    sum.basketOld+=o.pr*kg;sum.basketNew+=x.pr*kg;
    if(pct!==null&&pct>=0.5)sum.up++;else if(pct!==null&&pct<=-0.5)sum.down++;else sum.same++;
  });
  ob.it.forEach(function(x){if(!nm[x.ing])sum.onlyOld++;});
  sum.n=rows.length;
  if(sum.basketOld>0)sum.index=(sum.basketNew/sum.basketOld-1)*100;
  sum.impact=sum.basketNew-sum.basketOld;
  return{rows:rows,sum:sum};
}
/* динамика цены сырья по периодам: точка на каждую загрузку */
function phSeries(batches,ingId){
  var out=[];
  batches.forEach(function(b){
    b.it.forEach(function(x){
      if(x.ing!==ingId)return;
      var mn=null,mx=null;x.ln.forEach(function(l){if(mn===null||l[2]<mn)mn=l[2];if(mx===null||l[2]>mx)mx=l[2];});
      out.push({from:b.from,to:b.to,pr:x.pr,min:mn,max:mx,kg:phKg(x),n:x.ln.length});
    });
  });
  return out;
}
/* поставщики за период: оборот, доли, разброс цен по сырью с несколькими поставщиками и возможная экономия */
function phSuppliers(b){
  var sp=b.sup.map(function(n){return{name:n,spend:0,items:{},kg:0};}),total=0,multi=[],idxN={},idxD={};
  b.it.forEach(function(x){
    var by={};
    x.ln.forEach(function(l){
      var s=l[1]>=0?l[1]:-1;if(s<0)return;
      var e=by[s]||(by[s]={sup:s,spend:0,kg:0,n:0});
      e.spend+=l[2]*l[3];e.kg+=l[3];e.n++;
      sp[s].spend+=l[2]*l[3];sp[s].kg+=l[3];sp[s].items[x.ing]=1;total+=l[2]*l[3];
    });
    var arr=Object.keys(by).map(function(k){var e=by[k];e.avg=e.spend/e.kg;return e;});
    if(arr.length<2)return;
    var best=arr[0].avg,worst=arr[0].avg;
    arr.forEach(function(e){if(e.avg<best)best=e.avg;if(e.avg>worst)worst=e.avg;});
    var saving=0;arr.forEach(function(e){saving+=(e.avg-best)*e.kg;idxN[e.sup]=(idxN[e.sup]||0)+e.avg*e.kg;idxD[e.sup]=(idxD[e.sup]||0)+best*e.kg;});
    multi.push({ing:x.ing,nm:x.nm,rows:arr.map(function(e){return{sup:e.sup,name:b.sup[e.sup],avg:e.avg,kg:e.kg,spend:e.spend};}).sort(function(a,c){return a.avg-c.avg;}),best:best,worst:worst,spread:best>0?(worst/best-1)*100:0,saving:saving});
  });
  var list=sp.map(function(s,i){return{idx:i,name:s.name,spend:s.spend,share:total>0?s.spend/total*100:0,items:Object.keys(s.items).length,over:idxD[i]>0?(idxN[i]/idxD[i]-1)*100:null};}).filter(function(s){return s.spend>0;}).sort(function(a,c){return c.spend-a.spend;});
  multi.sort(function(a,c){return c.saving-a.saving;});
  var save=0;multi.forEach(function(m){save+=m.saving;});
  return{list:list,multi:multi,total:total,saving:save};
}
/* скачки цены у одного поставщика внутри периода */
function phJumps(b,minPct){
  minPct=minPct>0?minPct:3;
  var out=[];
  b.it.forEach(function(x){
    var by={};
    x.ln.forEach(function(l){
      if(l[1]<0)return;
      var s=by[l[1]]||(by[l[1]]={});
      var e=s[l[0]]||(s[l[0]]={spend:0,kg:0});
      e.spend+=l[2]*l[3];e.kg+=l[3];
    });
    Object.keys(by).forEach(function(si){
      var days=Object.keys(by[si]).sort();
      if(days.length<2)return;
      var f=by[si][days[0]],l=by[si][days[days.length-1]],p1=f.spend/f.kg,p2=l.spend/l.kg,pct=(p2/p1-1)*100;
      if(Math.abs(pct)>=minPct)out.push({ing:x.ing,nm:x.nm,sup:b.sup[si],d1:days[0],d2:days[days.length-1],p1:p1,p2:p2,pct:pct});
    });
  });
  return out.sort(function(a,c){return Math.abs(c.pct)-Math.abs(a.pct);});
}
/* справочник сырья, в котором цены региона подменены ценами записи истории; сырья, которого в записи нет, берутся из «запасной» записи */
function phIngsAt(ings,b,fallback,region){
  var m={};
  Object.keys(ings).forEach(function(id){m[id]=ings[id];});
  function put(batch){
    batch.it.forEach(function(x){
      var ing=ings[x.ing];if(!ing)return;
      var c={};Object.keys(ing).forEach(function(k){c[k]=ing[k];});
      if(region===MAIN){c.price=x.pr;delete c.priceUnit;delete c.packG;}
      else{c.px={};Object.keys(ing.px||{}).forEach(function(k){c.px[k]=ing.px[k];});c.px[region]={price:x.pr};}
      m[x.ing]=c;
    });
  }
  if(fallback)put(fallback);
  put(b);
  return m;
}
/* как изменилась себестоимость блюд (на одну порцию) между двумя периодами */
function phDishImpact(recs,ings,nb,ob,region){
  var mn=phIngsAt(ings,nb,ob,region),mo=phIngsAt(ings,ob,nb,region),out=[];
  recs.forEach(function(x){
    var r=x.r,cn=costOf(r,mn,100,region),co=costOf(r,mo,100,region);
    if(!(cn.sum>0)||!(co.sum>0))return;
    var a=r2(co.sum/100),b2=r2(cn.sum/100),d=r2(b2-a);
    out.push({id:x.id,name:r.name,old:a,nw:b2,d:d,pct:a>0?d/a*100:null,complete:cn.complete&&co.complete});
  });
  return out;
}
var PH_MON=['янв','фев','мар','апр','мая','июн','июл','авг','сен','окт','ноя','дек'];
/* подпись периода: целый месяц — «сен 2026», иначе «01.09–15.09.2026» */
function phLabel(b){
  var f=/^(\d{4})-(\d{2})-(\d{2})$/.exec(b.from||''),t=/^(\d{4})-(\d{2})-(\d{2})$/.exec(b.to||'');
  if(!f||!t)return'—';
  var last=new Date(Date.UTC(+t[1],+t[2],0)).getUTCDate();
  if(f[1]===t[1]&&f[2]===t[2]&&f[3]==='01'&&+t[3]===last)return PH_MON[+f[2]-1]+' '+f[1];
  return c1DateRu(b.from).slice(0,5)+'–'+c1DateRu(b.to);
}
/* по сырью: все точки истории, последняя загрузка и изменение к предыдущей (для первой — к цене, что была в базе до загрузки) */
function phIndex(batches){
  var m={};
  batches.forEach(function(b){b.it.forEach(function(x){var e=m[x.ing]||(m[x.ing]={pts:[]});e.pts.push({b:b,x:x,pr:x.pr});});});
  Object.keys(m).forEach(function(id){
    var p=m[id].pts,l=p[p.length-1],prev=p.length>1?p[p.length-2].pr:(l.x.pv>0?l.x.pv:null);
    m[id].last=l;m[id].prev=prev;m[id].pct=prev>0?(l.pr/prev-1)*100:null;
  });
  return m;
}
/* поставщики по обороту за всю историю: цвет закрепляется за поставщиком, а не за местом в списке */
function phSupOrder(batches){
  var s={};
  batches.forEach(function(b){b.it.forEach(function(x){x.ln.forEach(function(l){if(l[1]<0)return;var n=b.sup[l[1]];s[n]=(s[n]||0)+l[2]*l[3];});});});
  return Object.keys(s).sort(function(a,c){return s[c]-s[a]||(a<c?-1:1);});
}
/* строки для CSV: история цен региона */
function phCsvRows(batches,ings){
  var rows=[['Период','Объект','Сырьё','Цена ₽/кг','Мин ₽/кг','Макс ₽/кг','Объём, кг','Закупок','Позиция в 1С']];
  batches.forEach(function(b){
    b.it.slice().sort(function(a,c){return String((ings[a.ing]||{}).name||a.nm).localeCompare(String((ings[c.ing]||{}).name||c.nm),'ru');}).forEach(function(x){
      var mn=null,mx=null;x.ln.forEach(function(l){if(mn===null||l[2]<mn)mn=l[2];if(mx===null||l[2]>mx)mx=l[2];});
      rows.push([phLabel(b),b.obj||'',(ings[x.ing]||{}).name||x.nm,x.pr,mn,mx,phKg(x),x.ln.length,x.nm]);
    });
  });
  return rows;
}
/* ---- объекты: записи разных объектов за один период складываются в «период региона» ---- */
function phKey(b){return phId(b.region,b.from,b.to);}
function phObjOf(b){return String((b&&b.obj)||'');}
function phObjects(list){
  var seen={},out=[];
  list.forEach(function(b){var n=phObjOf(b),k=phSlug(n)||'none';if(!seen[k]){seen[k]=1;out.push(n);}});
  return out.sort(function(a,c){return a===''?1:(c===''?-1:(a.toLowerCase()<c.toLowerCase()?-1:(a.toLowerCase()>c.toLowerCase()?1:0)));});
}
/* записи по периодам в одну: цена сырья — средневзвешенная по объектам (вес — объём закупки объекта), закупки и поставщики складываются.
   Период с одной записью возвращается как есть. list — записи региона по порядку периодов (phList) */
function phMerge(list){
  var groups={},order=[];
  list.forEach(function(b){var k=phKey(b);if(!groups[k]){groups[k]=[];order.push(k);}groups[k].push(b);});
  return order.map(function(k){
    var g=groups[k],f=g[0];
    if(g.length===1)return f;
    var sup=[],supIx={},byIng={},ord=[],at=0,rules={},objs=[];
    g.forEach(function(b){
      at=Math.max(at,b.at||0);rules[b.rule]=1;
      var sm=b.sup.map(function(n){if(!Object.prototype.hasOwnProperty.call(supIx,n)){supIx[n]=sup.length;sup.push(n);}return supIx[n];});
      objs.push({obj:phObjOf(b),n:b.it.length,at:b.at||0,spend:phSpendAll(b)});
      b.it.forEach(function(x){
        var e=byIng[x.ing];
        if(!e){e=byIng[x.ing]={nm:x.nm,parts:[],ln:[],pv:0,pvAt:Infinity};ord.push(x.ing);}
        e.parts.push([x.pr,phKg(x)]);
        x.ln.forEach(function(l){e.ln.push([l[0],l[1]>=0?sm[l[1]]:-1,l[2],l[3]]);});
        if(x.pv>0&&(b.at||0)<e.pvAt){e.pv=x.pv;e.pvAt=b.at||0;}
      });
    });
    var it=ord.map(function(id){
      var e=byIng[id],s=0,w=0,m=0;
      e.parts.forEach(function(p){s+=p[0]*p[1];w+=p[1];m+=p[0];});
      var r={ing:id,nm:e.nm,pr:round4(w>0?s/w:m/e.parts.length),ln:e.ln};
      if(e.pv>0)r.pv=round4(e.pv);
      return r;
    });
    var rl=Object.keys(rules);
    return{region:f.region,from:f.from,to:f.to,at:at,file:'',wh:'',obj:'',rule:rl.length===1?rl[0]:'avg',sup:sup,it:it,objs:objs,merged:true};
  });
}
/* периоды и объекты, загруженные за них */
function phObjPeriods(list){
  var m={},ord=[];
  list.forEach(function(b){
    var k=phKey(b),e=m[k];
    if(!e){e=m[k]={key:k,from:b.from,to:b.to,objs:[],seen:{}};ord.push(e);}
    var sl=phSlug(b.obj)||'none';
    if(!e.seen[sl]){e.seen[sl]=1;e.objs.push(phObjOf(b));}
  });
  return ord.map(function(e){return{key:e.key,from:e.from,to:e.to,objs:e.objs};});
}
/* сравнение объектов за период: цена по объектам для сырья, которое купили минимум два объекта.
   Переплата объекта — на его корзине: сколько он заплатил и сколько заплатил бы по средневзвешенной цене региона; потенциал — по самой низкой цене среди объектов */
function phObjCompare(list,key){
  var recs=list.filter(function(b){return phKey(b)===key;}),objs=phObjects(recs),rows={},ord=[],per={},single=0,out=[],tot={spend:0,saving:0};
  objs.forEach(function(o){per[o]={obj:o,all:0,n:0,spend:0,ref:0,best:0,cheapest:0};});
  recs.forEach(function(b){
    var o=phObjOf(b);
    per[o].all+=phSpendAll(b);
    b.it.forEach(function(x){
      var e=rows[x.ing];if(!e){e=rows[x.ing]={ing:x.ing,nm:x.nm,by:{}};ord.push(x.ing);}
      var kg=phKg(x);e.by[o]={pr:x.pr,kg:kg,spend:x.pr*kg};
    });
  });
  ord.forEach(function(id){
    var e=rows[id],names=Object.keys(e.by);
    if(names.length<2){single++;return;}
    var s=0,w=0,m=0,mn=Infinity,mx=-Infinity,bo='',wo='',saving=0,spend=0;
    names.forEach(function(o){var p=e.by[o];s+=p.pr*p.kg;w+=p.kg;m+=p.pr;if(p.pr<mn){mn=p.pr;bo=o;}if(p.pr>mx){mx=p.pr;wo=o;}});
    var avg=w>0?s/w:m/names.length;
    names.forEach(function(o){
      var p=e.by[o],kg=w>0?p.kg:1,q=per[o];
      q.n++;q.spend+=p.pr*kg;q.ref+=avg*kg;q.best+=mn*kg;
      if(p.pr<=mn*1.005)q.cheapest++;
      saving+=(p.pr-mn)*kg;spend+=p.pr*kg;
    });
    tot.spend+=spend;tot.saving+=saving;
    out.push({ing:id,nm:e.nm,by:e.by,avg:avg,min:mn,max:mx,spread:mn>0?(mx/mn-1)*100:0,best:bo,worst:wo,saving:saving,spend:spend,kg:w});
  });
  out.sort(function(a,c){return c.saving-a.saving||c.spend-a.spend;});
  var pl=objs.map(function(o){var q=per[o];q.over=q.ref>0?(q.spend/q.ref-1)*100:null;q.saving=q.spend-q.best;return q;});
  return{key:key,objs:objs,rows:out,per:pl,single:single,total:tot,from:recs.length?recs[0].from:'',to:recs.length?recs[0].to:''};
}
/* цена сырья по объектам в динамике: точка на каждый период, где сырьё покупали; reg — средневзвешенная по объектам */
function phObjSeries(list,ing){
  var m={},ord=[];
  list.forEach(function(b){
    var k=phKey(b);
    b.it.forEach(function(x){
      if(x.ing!==ing)return;
      var e=m[k];if(!e){e=m[k]={key:k,from:b.from,to:b.to,by:{}};ord.push(e);}
      e.by[phObjOf(b)]={pr:x.pr,kg:phKg(x),n:x.ln.length};
    });
  });
  ord.forEach(function(e){
    var s=0,w=0,mm=0,n=0;
    Object.keys(e.by).forEach(function(o){var p=e.by[o];s+=p.pr*p.kg;w+=p.kg;mm+=p.pr;n++;});
    e.reg=w>0?s/w:(n?mm/n:null);
  });
  return{pts:ord,objs:phObjects(list.filter(function(b){return b.it.some(function(x){return x.ing===ing;});}))};
}
/*P1C-END*/
