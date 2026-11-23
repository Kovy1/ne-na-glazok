/* ---- чтение старого формата .xls без библиотек ----
   1) Настоящий .xls (Excel 97–2003, BIFF8; BIFF5 из старых выгрузок): контейнер OLE → поток «Workbook»/«Book» → записи листа.
      Берётся первый рабочий лист: строки, числа, даты (по формату ячейки), результаты формул.
   2) 1С и другие программы часто сохраняют под именем .xls таблицу HTML или XML (SpreadsheetML 2003): такие файлы тоже читаются.
   Результат — массив строк, как у xlRows: [['Номенклатура','Количество',…],…]. */
function xlsU16(b,o){return b[o]|(b[o+1]<<8);}
function xlsU32(b,o){return(b[o]|(b[o+1]<<8)|(b[o+2]<<16))+(b[o+3]*16777216);}
function xlsF64(b,o){return new DataView(b.buffer,b.byteOffset+o,8).getFloat64(0,true);}
function xlsRk(v){
  var n,x=v>>>0;
  if(x&2)n=(x|0)>>2;
  else{var dv=new DataView(new ArrayBuffer(8));dv.setUint32(4,x&0xFFFFFFFC,true);dv.setUint32(0,0,true);n=dv.getFloat64(0,true);}
  return x&1?n/100:n;
}
/* контейнер OLE (Compound File): возвращает содержимое потока по имени */
function xlsCfb(u8,want){
  if(u8.length<512||xlsU32(u8,0)!==0xE011CFD0||xlsU32(u8,4)!==0xE11AB1A1)return null;
  var ss=1<<xlsU16(u8,30),ms=1<<xlsU16(u8,32),nFat=xlsU32(u8,44),dir0=xlsU32(u8,48),cut=xlsU32(u8,56),mf0=xlsU32(u8,60),df0=xlsU32(u8,68),nDif=xlsU32(u8,72),
    END=0xFFFFFFFE,fatSecs=[],i,s,k,fat=[],guard;
  function sec(n){var o=(n+1)*ss;return u8.subarray(o,o+ss);}
  for(i=0;i<109&&fatSecs.length<nFat;i++){s=xlsU32(u8,76+i*4);if(s<END)fatSecs.push(s);}
  for(s=df0,k=0;s<END&&k<nDif&&fatSecs.length<nFat;k++){var d=sec(s);for(i=0;i<ss/4-1&&fatSecs.length<nFat;i++){var x=xlsU32(d,i*4);if(x<END)fatSecs.push(x);}s=xlsU32(d,ss-4);}
  fatSecs.forEach(function(n){var d=sec(n);for(i=0;i<ss/4;i++)fat.push(xlsU32(d,i*4));});
  function chain(start,map){var out=[],n=start;guard=0;while(n<END&&n<map.length&&guard++<1e6){out.push(n);n=map[n];}if(n<END&&guard<1e6)out.push(n);return out;}
  function read(start){var c=chain(start,fat),buf=new Uint8Array(c.length*ss);c.forEach(function(n,j){buf.set(sec(n),j*ss);});return buf;}
  var dir=read(dir0),ents=[];
  for(i=0;i+128<=dir.length;i+=128){
    var nl=xlsU16(dir,i+64),name='';
    for(k=0;k+2<nl&&k<64;k+=2)name+=String.fromCharCode(xlsU16(dir,i+k));
    ents.push({name:name,type:dir[i+66],start:xlsU32(dir,i+116),size:xlsU32(dir,i+120)});
  }
  var root=ents[0],e=null;
  for(i=0;i<ents.length;i++)if(ents[i].type===2&&want.indexOf(ents[i].name)>-1){e=ents[i];break;}
  if(!e)return null;
  if(e.size>=cut)return read(e.start).subarray(0,e.size);
  var mini=read(root.start),mfat=[],mf=read(mf0);                     /* маленький поток лежит в мини-секторах */
  for(i=0;i+4<=mf.length;i+=4)mfat.push(xlsU32(mf,i));
  var c=chain(e.start,mfat),out=new Uint8Array(c.length*ms);
  c.forEach(function(n,j){out.set(mini.subarray(n*ms,n*ms+ms),j*ms);});
  return out.subarray(0,e.size);
}
/* чтение строк BIFF8 с учётом записей CONTINUE: при переходе внутри символов строки — новый байт флагов */
function xlsSeg(segs){
  var si=0,o=0;
  function cur(){while(si<segs.length&&o>=segs[si].length){si++;o=0;}return segs[si];}
  return{
    u8:function(){var b=cur();return b?b[o++]:0;},
    u16:function(){var a=this.u8();return a|(this.u8()<<8);},
    u32:function(){var a=this.u16();return a+this.u16()*65536;},
    skip:function(n){while(n>0){var b=cur();if(!b)return;var t=Math.min(n,b.length-o);o+=t;n-=t;}},
    chars:function(n,hi){
      var s='',b;
      while(n>0){
        b=segs[si];
        if(!b)break;
        if(o>=b.length){si++;o=0;if(!segs[si])break;hi=segs[si][o++]&1;continue;}   /* продолжение строки в CONTINUE */
        if(hi){s+=String.fromCharCode(b[o]|(b[o+1]<<8));o+=2;}else s+=String.fromCharCode(b[o++]);
        n--;
      }
      return s;
    },
    end:function(){return!cur();}
  };
}
function xlsUStr(r,lenBytes){                                          /* XLUnicodeString / RichExtendedString */
  var n=lenBytes===1?r.u8():r.u16(),f=r.u8(),runs=0,ext=0,s;
  if(f&8)runs=r.u16();
  if(f&4)ext=r.u32();
  s=r.chars(n,f&1);
  r.skip(runs*4+ext);
  return s;
}
function xlsDec(bytes,cp){
  try{return new TextDecoder(cp===65001?'utf-8':(cp===1252?'windows-1252':'windows-1251')).decode(bytes);}catch(e){var s='',i;for(i=0;i<bytes.length;i++)s+=String.fromCharCode(bytes[i]);return s;}
}
function xlsDateFmt(id,fmts){
  var f=fmts[id];          /* сначала свой формат книги: 1С кладёт «0.000» под номером 50, который у встроенных — дата */
  if(f==null)return(id>=14&&id<=22)||(id>=27&&id<=36)||(id>=45&&id<=47)||(id>=50&&id<=58);
  f=f.replace(/"[^"]*"/g,'').replace(/\[[^\]]*\]/g,'').replace(/\\./g,'');
  return/[dmyhs]/i.test(f)&&!/[0#]/.test(f);
}
function xlsBiff(wb){
  var recs=[],o=0,t,l;
  while(o+4<=wb.length){t=xlsU16(wb,o);l=xlsU16(wb,o+2);recs.push({t:t,o:o,d:wb.subarray(o+4,o+4+l)});o+=4+l;}
  if(!recs.length||recs[0].t!==0x0809)throw new Error('Это не таблица Excel');
  var ver=xlsU16(recs[0].d,0),b8=ver===0x0600,cp=1251,sst=[],fmts={},xfs=[],sheets=[],i,j,r,dat;
  if(!b8&&ver!==0x0500)throw new Error('Слишком старая версия Excel: пересохраните файл как .xlsx');
  function lstr(d,at){                                                  /* строка ячейки LABEL / STRING / BOUNDSHEET */
    if(b8){return xlsUStr(xlsSeg([d.subarray(at)]));}
    var n=xlsU16(d,at);return xlsDec(d.subarray(at+2,at+2+n),cp);
  }
  /* глобальная часть книги */
  for(i=1;i<recs.length;i++){
    r=recs[i];dat=r.d;
    if(r.t===0x000A)break;
    if(r.t===0x0042)cp=xlsU16(dat,0);
    else if(r.t===0x041E){var fid=xlsU16(dat,0);fmts[fid]=b8?xlsUStr(xlsSeg([dat.subarray(2)])):xlsDec(dat.subarray(3,3+dat[2]),cp);}
    else if(r.t===0x00E0)xfs.push(xlsU16(dat,2));
    else if(r.t===0x0085){if(dat[5]===0)sheets.push({pos:xlsU32(dat,0),hid:dat[4]&3,name:b8?xlsUStr(xlsSeg([dat.subarray(6)]),1):xlsDec(dat.subarray(7,7+dat[6]),cp)});}
    else if(r.t===0x00FC){
      var segs=[dat.subarray(8)];
      for(j=i+1;j<recs.length&&recs[j].t===0x003C;j++)segs.push(recs[j].d);
      var rd=xlsSeg(segs),cnt=xlsU32(dat,4),k;
      for(k=0;k<cnt&&!rd.end();k++)sst.push(xlsUStr(rd));
    }
  }
  if(!sheets.length)throw new Error('В книге нет листов');
  var sh=sheets.filter(function(s){return!s.hid;})[0]||sheets[0],start=-1;
  for(i=0;i<recs.length;i++)if(recs[i].o===sh.pos){start=i;break;}
  if(start<0)throw new Error('Не найден лист «'+sh.name+'»');
  var rows=[],lastF=null;
  function isDate(xf){var f=xfs[xf];return f!=null&&xlsDateFmt(f,fmts);}
  function put(row,col,v){(rows[row]||(rows[row]=[]))[col]=v;}
  function num(xf,v){return isDate(xf)&&v>0&&v<2958466?xlSerial(v):xlNumStr(v);}
  for(i=start+1;i<recs.length;i++){
    r=recs[i];dat=r.d;
    if(r.t===0x000A)break;
    var row=xlsU16(dat,0),col=xlsU16(dat,2),xf=xlsU16(dat,4);
    switch(r.t){
      case 0x00FD:put(row,col,sst[xlsU32(dat,6)]||'');break;                              /* LABELSST */
      case 0x0203:put(row,col,num(xf,xlsF64(dat,6)));break;                               /* NUMBER */
      case 0x027E:put(row,col,num(xf,xlsRk(xlsU32(dat,6))));break;                        /* RK */
      case 0x00BD:(function(){var last=xlsU16(dat,dat.length-2),c,p=4;for(c=col;c<=last&&p+6<=dat.length-2;c++,p+=6)put(row,c,num(xlsU16(dat,p),xlsRk(xlsU32(dat,p+2))));})();break;   /* MULRK */
      case 0x0204:case 0x00D6:put(row,col,lstr(dat,6));break;                              /* LABEL, RSTRING */
      case 0x0205:put(row,col,dat[7]?'':(dat[6]?'ИСТИНА':'ЛОЖЬ'));break;                   /* BOOLERR */
      case 0x0006:                                                                        /* FORMULA: берём сохранённый результат */
        if(xlsU16(dat,12)===0xFFFF){var ty=dat[6];if(ty===0)lastF={row:row,col:col};else if(ty===1)put(row,col,dat[8]?'ИСТИНА':'ЛОЖЬ');}
        else put(row,col,num(xf,xlsF64(dat,6)));
        break;
      case 0x0207:if(lastF){put(lastF.row,lastF.col,lstr(dat,0));lastF=null;}break;       /* STRING — текст формулы */
    }
  }
  var out=[];
  rows.forEach(function(rw){
    if(!rw)return;
    var a=[],c;for(c=0;c<rw.length;c++)a.push(rw[c]==null?'':String(rw[c]));
    if(a.some(function(x){return x!=='';}))out.push(a);
  });
  return out;
}
/* «.xls», который на деле HTML-таблица или XML 2003 */
function xlsText(u8){
  var t=new TextDecoder('utf-8').decode(u8),m;
  if((t.match(/�/g)||[]).length>3)t=xlsDec(u8,1251);
  m=/charset\s*=\s*["']?(windows-1251|cp1251|koi8-r)/i.exec(t.slice(0,3000));
  if(m)t=xlsDec(u8,1251);
  return t;
}
function xlsMarkupRows(t){
  var doc,rows=[];
  if(/urn:schemas-microsoft-com:office:spreadsheet/.test(t)&&/<Workbook/i.test(t)){
    doc=new DOMParser().parseFromString(t,'application/xml');
    var ws=doc.getElementsByTagNameNS('*','Worksheet')[0];if(!ws)throw new Error('В файле нет листа');
    Array.prototype.forEach.call(ws.getElementsByTagNameNS('*','Row'),function(rw){
      var a=[];
      Array.prototype.forEach.call(rw.getElementsByTagNameNS('*','Cell'),function(c){
        var idx=c.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet','Index')||c.getAttribute('ss:Index');
        if(idx)while(a.length<+idx-1)a.push('');
        var d=c.getElementsByTagNameNS('*','Data')[0],v=d?d.textContent:'';
        if(d&&/DateTime/i.test(d.getAttributeNS('urn:schemas-microsoft-com:office:spreadsheet','Type')||d.getAttribute('ss:Type')||'')){var mm=/^(\d{4})-(\d{2})-(\d{2})/.exec(v);if(mm)v=mm[3]+'.'+mm[2]+'.'+mm[1];}
        a.push(v);
      });
      if(a.some(function(x){return String(x).trim()!=='';}))rows.push(a);
    });
    return rows;
  }
  doc=new DOMParser().parseFromString(t,'text/html');
  var tabs=doc.querySelectorAll('table'),best=null;
  Array.prototype.forEach.call(tabs,function(tb){if(!best||tb.rows.length>best.rows.length)best=tb;});
  if(!best)throw new Error('В файле нет таблицы');
  Array.prototype.forEach.call(best.rows,function(tr){
    var a=[];
    Array.prototype.forEach.call(tr.cells,function(td){a.push(td.textContent.replace(/[ \s]+/g,' ').trim());for(var k=1;k<(td.colSpan||1);k++)a.push('');});
    if(a.some(function(x){return x!=='';}))rows.push(a);
  });
  return rows;
}
function xlsRows(buf){
  var u8=new Uint8Array(buf),wb=xlsCfb(u8,['Workbook','Book']);
  if(wb)return xlsBiff(wb);
  if(u8.length>4&&u8[0]===0x50&&u8[1]===0x4B)throw new Error('Это файл .xlsx с расширением .xls: переименуйте его в .xlsx');
  var head=xlsText(u8.subarray(0,Math.min(u8.length,4096)));
  if(/^\s*(﻿)?\s*</.test(head))return xlsMarkupRows(xlsText(u8));
  throw new Error('Не удалось прочитать .xls');
}
/* общий вход для всех загрузок: ok(rows) или fail(сообщение) */
function xlsReadFile(file,ok,fail){
  var fr=new FileReader();
  fr.onerror=function(){fail('Не удалось открыть файл');};
  fr.onload=function(){
    var rows;
    try{rows=xlsRows(fr.result);}catch(e){fail((e&&e.message?e.message+'. ':'')+'Можно пересохранить файл как .xlsx (Файл → Сохранить как → Книга Excel).');return;}
    ok(rows);
  };
  fr.readAsArrayBuffer(file);
}
try{window.kbzhuXls={rows:xlsRows};}catch(e){}      /* для проверок */
