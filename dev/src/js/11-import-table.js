/* ---------- таблица по ссылке: разделитель, адрес, числа ---------- */
/* Google публикует CSV с запятой, Excel и наша выгрузка — с «;». Берём самый частый вне кавычек разделитель; при равенстве табуляция, затем «;», затем запятая */
function sniffDelim(text){
  var cands=['\t',';',','],cnt=[0,0,0],q=false,i,k,ch,best=0,seen=false;
  text=String(text==null?'':text).replace(/^\ufeff/,'');
  for(i=0;i<text.length;i++){
    ch=text.charAt(i);
    if(ch==='"'){q=!q;seen=true;continue;}
    if(q)continue;
    if(ch==='\n'||ch==='\r'){if(seen)break;continue;}
    if(ch!==' ')seen=true;
    k=cands.indexOf(ch);if(k>-1)cnt[k]++;
  }
  if(!cnt[0]&&!cnt[1]&&!cnt[2])return';';
  for(k=1;k<3;k++)if(cnt[k]>cnt[best])best=k;
  return cands[best];
}
function looksHtml(text){return /^\s*<(!doctype|html|head|body|\?xml)/i.test(String(text==null?'':text).replace(/^﻿/,''));}
/* Что именно запрашивать по ссылке пользователя. Таблицы Google читаются через публикацию (pub?output=csv) или через gviz, остальное как есть */
function cloudUrl(u){
  u=String(u==null?'':u).trim();
  if(!u)return{err:'empty'};
  if(!/^https?:\/\//i.test(u)){
    if(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}\//i.test(u))u='https://'+u;else return{err:'bad'};
  }
  if(/^https?:\/\/drive\.google\.com\//i.test(u)||/^https?:\/\/docs\.google\.com\/(document|presentation|forms)\//i.test(u))return{err:'drivefile'};
  var m=/^https?:\/\/docs\.google\.com\/spreadsheets\/d\/e\/([\w-]+)\/pub/i.exec(u),gid;
  if(m){
    gid=/[?&#]gid=(\d+)/.exec(u);
    return{url:'https://docs.google.com/spreadsheets/d/e/'+m[1]+'/pub?output=csv'+(gid?'&gid='+gid[1]+'&single=true':''),via:'gpub'};
  }
  m=/^https?:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)/i.exec(u);
  if(m){
    gid=/[?&#]gid=(\d+)/.exec(u);
    /* обычная ссылка на таблицу с доступом «все, у кого есть ссылка»: читаем скриптом (JSONP), он не зависит от CORS */
    return{url:'https://docs.google.com/spreadsheets/d/'+m[1]+'/gviz/tq?tqx=out:json%3BresponseHandler:__CB__'+(gid?'&gid='+gid[1]:''),via:'gsheet'};
  }
  if(/^https?:\/\/(disk\.yandex\.[a-z]+|yadi\.sk)\/[di]\/[\w-]+\/?$/i.test(u.split(/[?#]/)[0]))return{url:u.split(/[?#]/)[0],via:'yandex'};
  return{url:u,via:'direct'};
}
/* Ответ gviz (таблица Google) в строки. Шапка, если Google её распознал, идёт первой строкой; проценты берём как в таблице («20%» → 20) */
function gvizRows(d){
  if(!d||d.status==='error'||!d.table)return null;
  var t=d.table,cols=t.cols||[],rows=[],hdr=cols.map(function(c){return String(c&&c.label!=null?c.label:'');});
  function cell(x){
    if(x==null||(x.v==null&&x.f==null))return'';
    if(typeof x.v==='number')return(x.f!=null&&/%/.test(x.f))?String(x.f):String(x.v);
    return String(x.f!=null?x.f:x.v);
  }
  if(hdr.some(function(h){return h.trim()!=='';}))rows.push(hdr);
  (t.rows||[]).forEach(function(r){
    var c=(r&&r.c)||[],row=[],i,n=Math.max(c.length,cols.length);
    for(i=0;i<n;i++)row.push(cell(c[i]));
    if(row.some(function(v){return v!=='';}))rows.push(row);
  });
  return rows;
}
/* число из таблицы пользователя: допускает ₽, % и «руб.» */
function parseNumL(str){return parseNum(String(str==null?'':str).replace(/[₽%]|руб\.?/gi,''));}

/* ---------- ТТК из таблицы: одна строка таблицы = одна строка рецептуры ---------- */
function rtCol(h){
  var k=normKey(h);
  if(!k)return'';
  if(/в ттк/.test(k))return'name';
  if(/^(блюдо|наименование блюда|название блюда)/.test(k))return'dish';
  if(/^(ттк|номер ттк|номер)$/.test(k))return'num';
  if(/^выход/.test(k))return'out';
  if(/цен/.test(k)&&/прод/.test(k))return'sell';
  if(/^(сырье|ингредиент|продукт|наименование сырья|наименование продукта)/.test(k))return'ing';
  if(/нетто/.test(k))return'net';
  if(/брутто/.test(k))return'gross';
  if(/доля|переход/.test(k))return'share';
  return'';
}
/* Шапка ищется в первых строках, порядок колонок любой. Название блюда можно не повторять: пустая ячейка значит то же блюдо. Реквизиты блюда берутся из первой непустой ячейки */
/* строка итога («Итого», «Итого фарша:», «Всего»): не сырьё, но нужна поварам в карте */
function isSubName(s){return/^(итого|всего)(?![а-яёa-z])/i.test(String(s||'').trim());}
function isBareTotal(s){return/^(итого|всего)\s*[:.]?\s*$/i.test(String(s||'').trim());}
function parseRecipeTable(rows){
  var hi=-1,map={},i;
  for(i=0;i<Math.min(rows.length,10)&&hi<0;i++){
    var m={};
    rows[i].forEach(function(h,j){var f=rtCol(h);if(f&&m[f]===undefined)m[f]=j;});
    if(m.dish!==undefined&&m.ing!==undefined&&m.net!==undefined){hi=i;map=m;}
  }
  if(hi<0)return{err:'header',dishes:[],skipped:[]};
  var dishes=[],byKey={},cur=null,skipped=[];
  rows.slice(hi+1).forEach(function(r){
    function cell(f){return map[f]===undefined?'':String(r[map[f]]==null?'':r[map[f]]).trim();}
    var dn=cell('dish'),d,k;
    if(dn){if(/^(итого|всего)(\s|:|$)/i.test(dn))return;cur=dn;}
    if(!cur)return;
    k=normKey(cur);if(!k)return;
    d=byKey[k];
    if(!d){d=byKey[k]={name:cur,num:'',output:null,sell:null,lines:[],subs:[]};dishes.push(d);}
    var nm=cell('num'),o=cell('out'),sv=cell('sell');
    if(!d.num&&nm)d.num=nm;
    if(d.output===null&&o){var po=parseNumL(o);if(po.ok&&!po.empty&&po.v>0)d.output=po.v;}
    if(d.sell===null&&sv){var ps=parseNumL(sv);if(ps.ok&&!ps.empty&&ps.v>0)d.sell=ps.v;}
    var ing=cell('ing');
    if(!ing)return;
    if(isSubName(ing)){     /* строка итога («Итого фарша:», «Итого:»): не сырьё, но остаётся в карте */
      var pv=parseNumL(cell('net'));
      d.subs.push({name:ing.replace(/\s+/g,' ').trim(),mass:(pv.ok&&!pv.empty&&pv.v>0)?pv.v:null,at:d.lines.length});
      return;
    }
    var pn=parseNumL(cell('net'));
    if(!pn.ok||pn.empty){skipped.push({dish:d.name,name:ing,why:cell('net')?'нетто не число':'нет нетто'});return;}
    var gs=cell('gross'),pg=gs?parseNumL(gs):null,sh=cell('share'),psh=sh?parseNumL(sh):null;
    d.lines.push({name:ing,net:pn.v,gross:(pg&&pg.ok&&!pg.empty)?pg.v:null,share:(psh&&psh.ok&&!psh.empty)?psh.v:null,tname:cell('name')});
  });
  dishes.forEach(function(d){
    var sum=d.lines.reduce(function(a,l){return a+l.net;},0);
    d.outGuess=Math.round(sum*1000)/1000;
    d.outputGiven=d.output!==null;
    if(d.output===null)d.output=d.outGuess;
  });
  return{dishes:dishes,skipped:skipped};
}

