/* ---------- Фудкост: PDF-файл плана ----------
   Настоящий PDF (а не окно печати): страницы A4, встроенный шрифт Liberation Sans, текст выделяется и ищется. Содержимое — та же модель плана, что на экране, в Word и Excel
   (fcPlanModel), поэтому режим документа и дата состояния указаны так же. Файл собирается здесь без сторонних библиотек. */
var fcPdfFonts=null;
function fcPdfFont(k){
  var f,i,bin,map={};
  fcPdfFonts=fcPdfFonts||{};
  if(fcPdfFonts[k])return fcPdfFonts[k];
  f=FC_PDF_FONT[k];bin=atob(f.b64);
  var bytes=new Uint8Array(bin.length);for(i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
  f.m.forEach(function(t){map[t[0]]=[t[1],t[2]];});
  fcPdfFonts[k]={k:k,bytes:bytes,map:map,tri:f.m,bbox:f.bbox,asc:f.asc,desc:f.desc,cap:f.cap};
  return fcPdfFonts[k];
}
function fcPdfGl(font,ch){
  var c=ch.charCodeAt(0),g=font.map[c];
  if(!g){if(c===0xA0||c===0x202F||c===0x2009)g=font.map[0x20];else if(c===0x2011)g=font.map[0x2D];else g=font.map[0x3F];}
  return g||font.map[0x20];
}
function fcPdfW(font,s,size){var w=0,i;for(i=0;i<s.length;i++)w+=fcPdfGl(font,s.charAt(i))[1];return w*size/1000;}
function fcPdfHex(font,s){var o='',i,g;for(i=0;i<s.length;i++){g=fcPdfGl(font,s.charAt(i))[0];o+=('000'+g.toString(16)).slice(-4);}return o;}
function fcPdfWrap(font,s,size,width){
  var out=[];
  String(s==null?'':s).replace(/₽/g,'руб.').replace(/\r/g,'').split('\n').forEach(function(par){
    var words=par.split(/ +/),line='',i,w;
    if(!par){out.push('');return;}
    for(i=0;i<words.length;i++){
      w=words[i];
      while(fcPdfW(font,w,size)>width){                       /* слово шире строки: режется по символам */
        var j=1;while(j<w.length&&fcPdfW(font,w.slice(0,j+1),size)<=width)j++;
        if(line){out.push(line);line='';}
        out.push(w.slice(0,j));w=w.slice(j);
      }
      if(!line)line=w;
      else if(fcPdfW(font,line+' '+w,size)<=width)line+=' '+w;
      else{out.push(line);line=w;}
    }
    out.push(line);
  });
  return out;
}
function fcPdfNum(n){return String(Math.round(n*100)/100);}
/* раскладка модели по страницам → [{ops:[…]}] */
function fcPdfLayout(m){
  var R=fcPdfFont('r'),B=fcPdfFont('b'),W=595.28,H=841.89,ML=36,MR=36,MT=40,MB=44,CW=W-ML-MR,pages=[],pg=null,y=0;
  function newPage(){pg={ops:[]};pages.push(pg);y=H-MT;}
  function txt(f,size,x,yy,s){if(!s)return;pg.ops.push('BT /'+(f===B?'F2':'F1')+' '+fcPdfNum(size)+' Tf '+fcPdfNum(x)+' '+fcPdfNum(yy)+' Td <'+fcPdfHex(f,s)+'> Tj ET');}
  function need(h){if(y-h<MB)newPage();}
  function title(s){var L=fcPdfWrap(B,s,15,CW);L.forEach(function(l){need(20);y-=15;txt(B,15,ML,y,l);y-=5;});y-=4;}
  function h2(s){need(34);y-=8;pg.ops.push('0.94 g '+fcPdfNum(ML)+' '+fcPdfNum(y-14)+' '+fcPdfNum(CW)+' 18 re f 0 g');y-=11;txt(B,10.5,ML+4,y,s);y-=9;}
  function para(s,size,indent,bullet){
    size=size||8.5;indent=indent||0;
    var L=fcPdfWrap(R,s,size,CW-indent-(bullet?9:0)),lh=size*1.3;
    L.forEach(function(l,i){need(lh);y-=lh;if(bullet&&i===0)txt(R,size,ML+indent,y,'•');txt(R,size,ML+indent+(bullet?9:0),y,l);});
    y-=2;
  }
  /* строка таблицы: клетки — {f,lines,fill}; может переходить на следующую страницу по строкам текста */
  function row(cells,widths,size,hdr){
    var lh=size*1.3,pad=2.5,n=0,i=0,k,x,c;
    cells.forEach(function(c2){n=Math.max(n,c2.lines.length);});
    n=Math.max(n,1);
    while(i<n){
      var avail=Math.floor((y-MB-2*pad)/lh);
      if(avail<1||(avail<Math.min(3,n-i)&&i===0&&n<=8)){newPage();continue;}
      k=Math.min(avail,n-i);
      var hh=k*lh+2*pad;x=ML;
      for(c=0;c<cells.length;c++){
        if(cells[c].fill||hdr)pg.ops.push('0.94 g '+fcPdfNum(x)+' '+fcPdfNum(y-hh)+' '+fcPdfNum(widths[c])+' '+fcPdfNum(hh)+' re f 0 g');
        pg.ops.push('0.65 G 0.5 w '+fcPdfNum(x)+' '+fcPdfNum(y-hh)+' '+fcPdfNum(widths[c])+' '+fcPdfNum(hh)+' re S');
        cells[c].lines.slice(i,i+k).forEach(function(l,j){txt(cells[c].f||R,size,x+3,y-pad-(j+1)*lh+(lh-size)+size*0.2,l);});
        x+=widths[c];
      }
      y-=hh;i+=k;
    }
  }
  function kv(rows,w1,size){
    size=size||8.5;
    rows.forEach(function(r){row([{f:B,lines:fcPdfWrap(B,r[0],size,w1-6),fill:true},{f:R,lines:fcPdfWrap(R,r[1],size,CW-w1-6)}],[w1,CW-w1],size);});
    y-=6;
  }
  newPage();
  title(m.title);
  kv(fcHeadRows(m),150,8.5);
  h2('Примечания');fcModelNotes(m).forEach(function(x){para(x,8.5,4,true);});
  if(m.limits.length){h2('Ограничения расчёта');m.limits.forEach(function(x){para(x,8.5,4,true);});}
  h2('Что изменилось в версии '+m.ver);m.diff.forEach(function(x){para(x,8.5,4,true);});
  h2('Показатели');
  var w3=[150,95,CW-245];
  row([{f:B,lines:['Показатель']},{f:B,lines:['Значение']},{f:B,lines:['Расчёт']}],w3,8.5,true);
  m.metrics.forEach(function(x){row([{f:R,lines:fcPdfWrap(R,x.l,8.5,w3[0]-6)},{f:R,lines:fcPdfWrap(R,x.v,8.5,w3[1]-6)},{f:R,lines:fcPdfWrap(R,x.f+(x.note?' ('+x.note+')':''),8.5,w3[2]-6)}],w3,8.5);});
  y-=6;
  h2('Мероприятия');
  if(!m.items.length)para('Отклонений по правилам не выявлено.');
  m.items.forEach(function(it){
    need(60);y-=6;
    fcPdfWrap(B,it.n+'. '+it.title,10,CW).forEach(function(l){need(14);y-=13;txt(B,10,ML,y,l);});
    y-=3;
    kv(fcItemRows(it),130,8.2);
  });
  if(m.stale.length){h2('Больше не выявляются');m.stale.forEach(function(x){para(x.title+' — '+x.asg+', '+x.st,8.5,4,true);});}
  var foot=m.title+': '+m.obj+', '+m.period+' · версия '+m.ver+' · '+m.modeName+' ('+m.stDate+')';
  pages.forEach(function(p,i){
    pg=p;
    pg.ops.push('0.65 G 0.5 w '+ML+' 34 m '+fcPdfNum(W-MR)+' 34 l S');
    var fl=fcPdfWrap(R,foot,7,CW-60)[0];
    txt(R,7,ML,24,fl);
    var pn='Стр. '+(i+1)+' из '+pages.length;txt(R,7,W-MR-fcPdfW(R,pn,7),24,pn);
  });
  return pages;
}
/* сборка файла */
function fcPdfBuild(m){
  var pages=fcPdfLayout(m),R=fcPdfFont('r'),B=fcPdfFont('b'),enc=new TextEncoder(),objs=[],chunks=[],off=0,offs=[],i;
  function add(body){objs.push(body);return objs.length;}                 /* body: строка или {head, bytes} */
  function utf16hex(s){var o='FEFF',j;for(j=0;j<s.length;j++)o+=('000'+s.charCodeAt(j).toString(16)).slice(-4);return o;}
  function toUni(f){
    var out='/CIDInit /ProcSet findresource begin 12 dict begin begincmap /CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def /CMapName /Adobe-Identity-UCS def /CMapType 2 def 1 begincodespacerange <0000> <FFFF> endcodespacerange\n',j,n;
    for(j=0;j<f.tri.length;j+=100){var part=f.tri.slice(j,j+100);out+=part.length+' beginbfchar\n'+part.map(function(t){return'<'+('000'+t[1].toString(16)).slice(-4)+'> <'+('000'+t[0].toString(16)).slice(-4)+'>';}).join('\n')+'\nendbfchar\n';}
    return out+'endcmap CMapName currentdict /CMap defineresource pop end end';
  }
  /* 1 каталог, 2 страницы — номера известны заранее */
  add('');add('');
  var fontIds={};
  [['F1',R,'AAAAAA'],['F2',B,'BBBBBB']].forEach(function(t){
    var f=t[1],nm=t[2]+'+LiberationSans'+(f===B?'-Bold':''),file,tu,desc,cid,w='';
    file=add({head:'<< /Length '+f.bytes.length+' /Length1 '+f.bytes.length+' >>',bytes:f.bytes});
    var tub=enc.encode(toUni(f));tu=add({head:'<< /Length '+tub.length+' >>',bytes:tub});
    desc=add('<< /Type /FontDescriptor /FontName /'+nm+' /Flags 32 /FontBBox ['+f.bbox.join(' ')+'] /ItalicAngle 0 /Ascent '+f.asc+' /Descent '+f.desc+' /CapHeight '+f.cap+' /StemV '+(f===B?140:80)+' /FontFile2 '+file+' 0 R >>');
    f.tri.forEach(function(x){w+=x[1]+' ['+x[2]+'] ';});
    cid=add('<< /Type /Font /Subtype /CIDFontType2 /BaseFont /'+nm+' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor '+desc+' 0 R /DW 556 /W ['+w+'] /CIDToGIDMap /Identity >>');
    fontIds[t[0]]=add('<< /Type /Font /Subtype /Type0 /BaseFont /'+nm+' /Encoding /Identity-H /DescendantFonts ['+cid+' 0 R] /ToUnicode '+tu+' 0 R >>');
  });
  var kids=[];
  pages.forEach(function(p){
    var cb=enc.encode(p.ops.join('\n')),c=add({head:'<< /Length '+cb.length+' >>',bytes:cb});
    kids.push(add('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 '+fontIds.F1+' 0 R /F2 '+fontIds.F2+' 0 R >> >> /Contents '+c+' 0 R >>')+' 0 R');
  });
  objs[0]='<< /Type /Catalog /Pages 2 0 R >>';
  objs[1]='<< /Type /Pages /Kids ['+kids.join(' ')+'] /Count '+kids.length+' >>';
  var info=add('<< /Title <'+utf16hex(m.title+': '+m.obj+', '+m.period+', версия '+m.ver)+'> /Subject <'+utf16hex(m.modeName+', состояние на '+m.stDate)+'> /Producer <'+utf16hex('Не на глазок')+'> >>');
  function push(u8){chunks.push(u8);off+=u8.length;}
  push(new Uint8Array([37,80,68,70,45,49,46,52,10,37,226,227,207,211,10]));        /* %PDF-1.4 и метка двоичного файла */
  for(i=0;i<objs.length;i++){
    offs.push(off);
    var o=objs[i];
    if(typeof o==='string')push(enc.encode((i+1)+' 0 obj\n'+o+'\nendobj\n'));
    else{push(enc.encode((i+1)+' 0 obj\n'+o.head+'\nstream\n'));push(o.bytes);push(enc.encode('\nendstream\nendobj\n'));}
  }
  var xr=off,x='xref\n0 '+(objs.length+1)+'\n0000000000 65535 f \n';
  offs.forEach(function(o2){x+=('0000000000'+o2).slice(-10)+' 00000 n \n';});
  x+='trailer\n<< /Size '+(objs.length+1)+' /Root 1 0 R /Info '+info+' 0 R >>\nstartxref\n'+xr+'\n%%EOF\n';
  push(enc.encode(x));
  var tot=0;chunks.forEach(function(c){tot+=c.length;});
  var out=new Uint8Array(tot),p=0;chunks.forEach(function(c){out.set(c,p);p+=c.length;});
  return out;
}
function fcPlanPdfSave(m){
  var bytes;
  try{bytes=fcPdfBuild(m);}catch(e){flash('Не удалось собрать PDF: '+(e&&e.message||'ошибка')+'. Скачайте Word или Excel, либо используйте печать из браузера.');return;}
  exportFile(bytes,fcPlanFile(m,'pdf'));
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{planPdf:fcPdfBuild});}catch(e){}
