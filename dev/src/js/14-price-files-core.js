/*PF-START*/
/* ---- файлы цен региона на Диске: «Цены продажи» (открытый файл) и «Себестоимость и закупка» (закрытый) ----
   Чистые функции: состояние страницы им передаётся параметрами. Заголовки PF_H читает скрипт (Code.gs, PF_HEAD),
   когда достаёт из таблиц прежние цены для журнала изменений: менять их надо вместе. */
var PF_NONE='Без раздела';
var PF_H={dish:'Блюдо',ing:'Сырьё',sell:'Цена продажи, ₽',cost:'Себестоимость порции, ₽',price:'Цена, ₽/кг'};
var PF_LOG_MAX=1000;
function pfDate(ms){var d=new Date(ms);function z(n){return(n<10?'0':'')+n;}return z(d.getDate())+'.'+z(d.getMonth()+1)+'.'+d.getFullYear()+' '+z(d.getHours())+':'+z(d.getMinutes());}
function pfMonth(ms){var d=new Date(ms);return d.getFullYear()+'-'+(d.getMonth()<9?'0':'')+(d.getMonth()+1);}
function pfRound(v,d){if(v===null||v===undefined||!isFinite(v))return'';var m=Math.pow(10,d);return Math.round(v*m+(v<0?-1e-9:1e-9))/m;}
function pfCmp(a,b){return a.so-b.so||String(a.name).localeCompare(String(b.name),'ru');}
/* c: {region, ings, recipes, ids (блюда региона, без архива), cats (папки меню), batches (история цен региона), num(r) → номер ТТК} */
function pfData(c){
  var g=c.region,ings=c.ings,ix=phIndex(c.batches||[]),uses={},catIdx={},catName={},ci={},dishes=[],il=[],i;
  (c.cats||[]).forEach(function(x,k){catIdx[x.id]=k;catName[x.id]=x.name;});
  catNames(ings).forEach(function(n,k){ci[n]=k;});
  c.ids.forEach(function(id){
    var r=c.recipes[id],k=costOf(r,ings,100,g),has=k.rows.length>0,cost=(has&&k.sum>0)?r2(k.sum/100):null;
    var sv=r.sell&&r.sell[g],sell=sv>0?sv:null,m=finMetrics(cost,sell),nm=String(r.name||'Без названия');
    var sec=(r.cat&&catName[r.cat])||PF_NONE,so=(r.cat&&catIdx[r.cat]!==undefined)?catIdx[r.cat]:99999,seen={};
    var comp=k.rows.map(function(x){
      if(x.ing&&!seen[x.ing]){seen[x.ing]=1;uses[x.ing]=(uses[x.ing]||0)+1;}
      return{dish:nm,sec:sec,ing:x.name||'—',gross:x.gross,pk:x.price,cost:x.sum===null?null:x.sum/100};
    });
    dishes.push({id:id,name:nm,num:String(c.num?c.num(r):''),sec:sec,so:so,out:r.output>0?r.output:null,cost:cost,complete:has&&k.complete,sell:sell,
      markup:m.markup,margin:m.margin,profit:m.profit,fc:m.fc,comp:comp});
  });
  dishes.sort(pfCmp);
  var noPrice=0;
  Object.keys(ings).forEach(function(id){
    var q=ings[id],pk=pricePerKg(q,g),rec=regRec(q,g)||{},e=ix[id],sec=ingCat(q);
    if(pk===null){if(uses[id])noPrice++;return;}
    il.push({id:id,name:String(q.name||''),sec:sec,so:ci[sec]===undefined?9999:ci[sec],pk:r2(pk),
      how:rec.priceUnit==='pack'?(money(rec.price)+' ₽ за упаковку '+dnum(rec.packG,2)+' г'):'за кг (литр)',src:String(rec.priceSrc||''),
      per:e?phLabel(e.last.b):'',pct:(e&&e.pct!==null)?e.pct:null,prev:(e&&e.prev>0)?e.prev:null,uses:uses[id]||0});
  });
  il.sort(pfCmp);
  return{region:g,dishes:dishes,ings:il,noPrice:noPrice};
}
/* таблицы файлов без журналов изменений; hash считается только по данным (без дат и примечаний), месяц входит в него: в новом месяце копия в архив ляжет в любом случае */
function pfTables(d,regName,at){
  var when=pfDate(at),sold=d.dishes.filter(function(x){return x.sell>0;});
  var comp=[];d.dishes.forEach(function(x){x.comp.forEach(function(y){comp.push(y);});});
  var pubRows=sold.map(function(x){return[x.sec,x.name,x.num,x.out===null?'':x.out,x.sell];});
  var dishRows=d.dishes.map(function(x){return[x.sec,x.name,x.num,x.out===null?'':x.out,x.cost===null?'':x.cost,x.sell===null?'':x.sell,
    x.markup===null?'':pfRound(x.markup,1),x.margin===null?'':pfRound(x.margin,1),x.profit===null?'':x.profit,x.fc===null?'':pfRound(x.fc,1),x.complete?'полная':'неполная'];});
  var ingRows=d.ings.map(function(x){return[x.sec,x.name,x.pk,x.how,x.src,x.per,x.pct===null?'':pfRound(x.pct,1),x.prev===null?'':r2(x.prev),x.uses];});
  var compRows=comp.map(function(x){return[x.sec,x.dish,x.ing,pfRound(x.gross,2),x.pk===null?'':x.pk,x.cost===null?'':pfRound(x.cost,4)];});
  var note='Актуально на '+when+'. Файл обновляется автоматически, править его вручную не нужно.';
  var pub=[{name:'Цены продажи',title:'Цены продажи — '+regName,note:note,head:['Раздел',PF_H.dish,'ТТК №','Выход, г',PF_H.sell],fmt:['text','text','text','g','money'],widths:[150,320,70,80,130],rows:pubRows},
    {name:'Изменения цен',title:'Изменения цен продажи — '+regName,note:'Новые записи сверху, хранятся последние '+PF_LOG_MAX+'.',head:['Дата',PF_H.dish,'Было, ₽','Стало, ₽','Изменение, %'],fmt:['text','text','money','money','pct'],widths:[120,320,90,90,100],rows:[]}];
  var prv=[
    {name:'Блюда',title:'Блюда: себестоимость и цена продажи — '+regName,note:note+' Себестоимость порции — только сырьё по брутто, без зарплаты и накладных расходов. Наценка = (цена − себестоимость) / себестоимость.',
      head:['Раздел',PF_H.dish,'ТТК №','Выход, г',PF_H.cost,PF_H.sell,'Наценка, %','Маржинальность, %','Доход после сырья, ₽','Сырьё в цене, %','Себестоимость'],
      fmt:['text','text','text','g','money','money','pct','pct','money','pct','text'],widths:[150,320,70,80,130,110,90,120,120,110,110],rows:dishRows},
    {name:'Сырьё',title:'Закупочные цены сырья — '+regName,note:note+(d.noPrice?' Нет цены у сырья, которое используется в блюдах: '+d.noPrice+'.':''),
      head:['Раздел',PF_H.ing,PF_H.price,'Как задана цена','Источник цены','Загрузка 1С','Изменение, %','Было, ₽/кг','Блюд с этим сырьём'],
      fmt:['text','text','money','text','text','text','pct','money','int'],widths:[170,300,100,200,240,110,100,100,100],rows:ingRows},
    {name:'Состав себестоимости',title:'Из чего складывается себестоимость порции — '+regName,note:note+' Брутто — масса сырья в порции с учётом потерь при холодной обработке.',
      head:['Раздел',PF_H.dish,PF_H.ing,'Брутто на порцию, г','Цена, ₽/кг','Стоимость на порцию, ₽'],
      fmt:['text','text','text','g','money','money'],widths:[150,320,300,130,100,130],rows:compRows},
    {name:'Изменения',title:'Журнал изменений цен и себестоимости — '+regName,note:'Новые записи сверху, хранятся последние '+PF_LOG_MAX+'.',
      head:['Дата','Что','Название','Показатель','Было','Стало','Изменение, %'],fmt:['text','text','text','text','money','money','pct'],widths:[120,80,320,190,90,90,100],rows:[]}];
  var tabs={pub:pub,prv:prv,hash:'',n:{dishes:d.dishes.length,sold:sold.length,ings:d.ings.length}};
  tabs.hash=syHash(canon([regName,pfMonth(at),pubRows,dishRows,ingRows,compRows]));
  return tabs;
}
/* что изменилось с прошлого обновления: prev — ответ скрипта (a=pprev) с содержимым прежних таблиц */
function pfDiff(d,prev,at){
  var out={sell:[],prv:[]};
  if(!prev||!prev.has||prev.same||!prev.pub||!prev.prv)return out;
  var when=pfDate(at),pi={},pn={},pd={},pdn={},ps={},psn={};
  prev.prv.ing.forEach(function(a){var k=normKey(a[0]);pi[k]=a[1];pn[k]=a[0];});
  prev.prv.dish.forEach(function(a){var k=normKey(a[0]);pd[k]={cost:a[1],sell:a[2]};pdn[k]=a[0];});
  prev.pub.sell.forEach(function(a){var k=normKey(a[0]);ps[k]=a[1];psn[k]=a[0];});
  function pct(o,n){return(o>0&&n!==null&&n!==undefined&&n!=='')?pfRound((n/o-1)*100,1):'';}
  function chg(rows,what,name,label,o,n,eps){
    var oo=(o===null||o===undefined)?null:o,nn_=(n===null||n===undefined)?null:n;
    if(oo===null&&nn_===null)return;
    if(oo!==null&&nn_!==null&&Math.abs(nn_-oo)<eps)return;
    rows.push([when,what,name,label,oo===null?'':oo,nn_===null?'':nn_,pct(oo,nn_)]);
  }
  var seenI={},seenD={},seenS={};
  d.ings.forEach(function(x){var k=normKey(x.name);seenI[k]=1;chg(out.prv,'Сырьё',x.name,'Цена, ₽/кг',pi[k],x.pk,0.005);});
  Object.keys(pi).forEach(function(k){if(!seenI[k])chg(out.prv,'Сырьё',pn[k],'Убрано из файла (нет цены)',pi[k],null,0);});
  d.dishes.forEach(function(x){
    var k=normKey(x.name),o=pd[k];seenD[k]=1;
    chg(out.prv,'Блюдо',x.name,'Себестоимость порции, ₽',o?o.cost:null,x.cost,0.01);
    chg(out.prv,'Блюдо',x.name,'Цена продажи, ₽',o?o.sell:null,x.sell,0.005);
    if(x.sell>0){
      seenS[k]=1;var os=ps[k];
      if(os===undefined)out.sell.push([when,x.name,'',x.sell,'']);
      else if(Math.abs(x.sell-os)>=0.005)out.sell.push([when,x.name,os,x.sell,pct(os,x.sell)]);
    }
  });
  Object.keys(pd).forEach(function(k){if(!seenD[k])out.prv.push([when,'Блюдо',pdn[k],'Убрано из меню','','','']);});
  Object.keys(ps).forEach(function(k){if(!seenS[k])out.sell.push([when,psn[k],ps[k],'','']);});
  return out;
}
/* дописывает журналы: новые записи сверху, прежние (из таблиц на Диске) ниже */
function pfWithLogs(tabs,diff,prev){
  var pl=(prev&&prev.pub&&prev.pub.log)||[],vl=(prev&&prev.prv&&prev.prv.log)||[];
  tabs.pub[1].rows=diff.sell.concat(pl).slice(0,PF_LOG_MAX);
  tabs.prv[3].rows=diff.prv.concat(vl).slice(0,PF_LOG_MAX);
  tabs.changes=diff.sell.length+diff.prv.length;
  return tabs;
}

/* ---- книга Excel (.xlsx) без библиотек: строки внутри листа, свои стили, закреплённая шапка ---- */
function xlsxCol(n){var s='';n++;while(n>0){var m=(n-1)%26;s=String.fromCharCode(65+m)+s;n=Math.floor((n-1)/26);}return s;}
var XLSX_STYLE={title:1,head:2,text:3,money:4,pct:5,int:6,g:0,note:8,wrap:9};
var XLSX_STYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
  +'<numFmts count="2"><numFmt numFmtId="164" formatCode="#,##0.00"/><numFmt numFmtId="165" formatCode="0.0"/></numFmts>'
  +'<fonts count="4"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="13"/><name val="Calibri"/></font><font><i/><sz val="10"/><color rgb="FF666666"/><name val="Calibri"/></font></fonts>'
  +'<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFE8EEF7"/><bgColor indexed="64"/></patternFill></fill></fills>'
  +'<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>'
  +'<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
  +'<cellXfs count="10">'
  +'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  +'<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  +'<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>'
  +'<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  +'<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  +'<xf numFmtId="165" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  +'<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>'
  +'<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>'
  +'<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/>'
  +'<xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>'
  +'</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>';
function xlsxSheet(t,first){
  var nc=t.head.length,rows=[],cols='',j;
  function str(ref,s,st){return s===''||s===null||s===undefined?'':'<c r="'+ref+'" s="'+st+'" t="inlineStr"><is><t xml:space="preserve">'+xe(s)+'</t></is></c>';}
  rows.push('<row r="1">'+str('A1',t.title,XLSX_STYLE.title)+'</row>');
  rows.push('<row r="2">'+str('A2',t.note,XLSX_STYLE.note)+'</row>');
  var h='';for(j=0;j<nc;j++)h+=str(xlsxCol(j)+'4',t.head[j],XLSX_STYLE.head);
  rows.push('<row r="4" ht="34" customHeight="1">'+h+'</row>');
  t.rows.forEach(function(r,i){
    var n=i+5,cs='';
    for(j=0;j<nc;j++){
      var v=r[j],ref=xlsxCol(j)+n,f=t.fmt[j]||'text';
      if(v===''||v===null||v===undefined)continue;
      if(f==='text'||f==='wrap'||typeof v!=='number'||!isFinite(v))cs+=str(ref,String(v),f==='wrap'?XLSX_STYLE.wrap:XLSX_STYLE.text);
      else cs+='<c r="'+ref+'" s="'+(XLSX_STYLE[f]||0)+'"><v>'+String(v)+'</v></c>';
    }
    rows.push('<row r="'+n+'">'+cs+'</row>');
  });
  for(j=0;j<nc;j++)cols+='<col min="'+(j+1)+'" max="'+(j+1)+'" width="'+Math.round(Math.max(6,Math.min(80,(t.widths[j]||110)/7))*100)/100+'" customWidth="1"/>';
  return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="A1:'+xlsxCol(nc-1)+(4+t.rows.length)+'"/>'
    +'<sheetViews><sheetView workbookViewId="0"'+(first?' tabSelected="1"':'')+'><pane ySplit="4" topLeftCell="A5" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A5" sqref="A5"/></sheetView></sheetViews>'
    +'<sheetFormatPr defaultRowHeight="15"/><cols>'+cols+'</cols><sheetData>'+rows.join('')+'</sheetData></worksheet>';
}
function xlsxPack(tables){
  var enc=new TextEncoder(),R='http://schemas.openxmlformats.org/officeDocument/2006/relationships',M='http://schemas.openxmlformats.org/spreadsheetml/2006/main',n=tables.length,i;
  var types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  for(i=1;i<=n;i++)types+='<Override PartName="/xl/worksheets/sheet'+i+'.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
  types+='</Types>';
  var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="'+R+'/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  var wb='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="'+M+'" xmlns:r="'+R+'"><bookViews><workbookView activeTab="0"/></bookViews><sheets>',wr='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  var files=[];
  tables.forEach(function(t,k){
    wb+='<sheet name="'+xe(String(t.name).slice(0,31))+'" sheetId="'+(k+1)+'" r:id="rId'+(k+1)+'"/>';
    wr+='<Relationship Id="rId'+(k+1)+'" Type="'+R+'/worksheet" Target="worksheets/sheet'+(k+1)+'.xml"/>';
    files.push({name:'xl/worksheets/sheet'+(k+1)+'.xml',data:enc.encode(xlsxSheet(t,k===0))});
  });
  wb+='</sheets></workbook>';wr+='<Relationship Id="rId'+(n+1)+'" Type="'+R+'/styles" Target="styles.xml"/></Relationships>';
  return zipStore([{name:'[Content_Types].xml',data:enc.encode(types)},{name:'_rels/.rels',data:enc.encode(rels)},{name:'xl/workbook.xml',data:enc.encode(wb)},{name:'xl/_rels/workbook.xml.rels',data:enc.encode(wr)},{name:'xl/styles.xml',data:enc.encode(XLSX_STYLES)}].concat(files));
}
