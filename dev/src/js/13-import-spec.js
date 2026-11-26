/* ---------- ресурсная спецификация 1С («Список сырья по Спецификации»): блюдо и сырьё на 1 шт ----------
   Блоки повторяются: шапка «Выходные изделия» → строка блюда (выход в кг) → «Сырьё:» → шапка «Наименование товара» → строки сырья → итог в кг */
var SPEC_TOO_MUCH=2.5;
function specDate(s){var m=/(\d{1,2})\.(\d{1,2})\.(\d{4})/.exec(String(s||''));return m?m[3]+'-'+('0'+m[2]).slice(-2)+'-'+('0'+m[1]).slice(-2):'';}
function specCols(cells){
  var c={n:-1,u:-1,q:-1,kg:-1};
  cells.forEach(function(x,i){
    x=String(x||'').trim().toLowerCase().replace(/ё/g,'е');
    if(c.n<0&&/^(выходные изделия|наименование товара|наименование|номенклатура)/.test(x))c.n=i;
    else if(c.u<0&&/^ед\.?\s*изм/.test(x))c.u=i;
    else if(c.kg<0&&/количество\s+в\s+кг/.test(x))c.kg=i;
    else if(c.q<0&&/^количество$/.test(x))c.q=i;
  });
  return c;
}
function specClean(s){return String(s||'').replace(/(\s+[-–])+\s*$/,'').replace(/\s+/g,' ').trim();}
/* «СМ Борщ с курицей 250/10 ТТК №381» → номер ТТК и название без номера */
function specDishName(raw){
  var s=String(raw||'').replace(/\s+/g,' ').trim(),m=/(?:^|\s)\(?\s*т?тк\s*№?\s*(\d+)\s*\)?/i.exec(s),num='';
  if(m){num=m[1];s=(s.slice(0,m.index)+' '+s.slice(m.index+m[0].length)).replace(/\s+/g,' ').trim();}
  return{num:num,dish:specClean(s)};
}
/* sheets: [{name, rows}] — строки листов как в выгрузке (ячейки по колонкам) */
function specParse(sheets){
  var out={dishes:[],from:'',d:'',issues:[],raw:0};
  function issue(t){if(out.issues.length<30)out.issues.push(t);}
  sheets.forEach(function(sh){
    var mode='',cols=null,cur=null,from='';
    (sh.rows||[]).forEach(function(raw,ri){
      var cells=(raw||[]).map(function(x){return x==null?'':String(x).trim();}),f=cells.filter(function(x){return x!=='';});
      if(!f.length)return;
      var c0=f[0].toLowerCase().replace(/ё/g,'е');
      if(/^список сырья/.test(c0)){mode='';return;}
      if(/^на дату/.test(c0)){if(!out.d)out.d=specDate(f.slice(1).join(' '));return;}
      if(/^действует с/.test(c0)){from=specDate(f.slice(1).join(' '));if(from&&(!out.from||from>out.from))out.from=from;return;}
      if(/^сырье:?$/.test(c0))return;
      if(cells.some(function(x){return/^выходные изделия/i.test(x);})){mode='dish';cols=specCols(cells);return;}
      if(cells.some(function(x){return/^наименование товара/i.test(x);})){mode='raw';cols=specCols(cells);return;}
      if(!cols||cols.n<0)return;
      var nm=cells[cols.n]||'';
      if(!nm||c1Num(nm)!==null)return;                    /* итог блока: только количество в кг */
      var u=String(cells[cols.u]||'').toLowerCase(),q=cols.q>-1?c1Num(cells[cols.q]):null,kg=cols.kg>-1?c1Num(cells[cols.kg]):null;
      if(mode==='dish'){
        var dn=specDishName(nm);
        cur={raw:nm,num:dn.num,dish:dn.dish,qty:q>0?q:1,kg:kg,sheet:sh.name||'',from:from,rows:[],sk:[]};
        out.dishes.push(cur);
        if(!(kg>0))issue('«'+nm+'»: не указан выход в кг');
        return;
      }
      if(mode==='raw'){
        if(!cur){issue('Строка '+(ri+1)+' листа «'+(sh.name||'')+'»: сырьё без блюда');return;}
        var lit=false,g=kg>0?kg*1000:(/^кг/.test(u)&&q>0?q*1000:(/^г/.test(u)&&q>0?q:null));
        if(g===null&&q>0&&/^(л|дм)/.test(u)){g=q*1000;lit=true;}       /* литры без массы: 1 л ≈ 1 кг, отмечается */
        else if(g===null&&q>0&&/^мл/.test(u)){g=q;lit=true;}
        if(g===null){cur.sk.push({name:specClean(nm),q:q,u:u||'шт'});return;}     /* штуки без массы (упаковка, лаваш поштучно): в состав не переносятся, список виден */
        g=g/(cur.qty||1);
        var k=normKey(nm),ex=cur.rows.filter(function(x){return x.k===k;})[0];
        if(ex)ex.g+=g;else cur.rows.push({k:k,raw:nm,name:specClean(nm),g:g,u:u,q:q,lit:lit});
        out.raw++;
      }
    });
  });
  /* общая приставка объекта («СМ ») у большинства блюд убирается из названия */
  var pre={},n=out.dishes.length;
  out.dishes.forEach(function(d){var m=/^([А-ЯЁA-Z]{2,3})\s+(?=[А-ЯЁA-Z«"])/.exec(d.dish);if(m)pre[m[1]]=(pre[m[1]]||0)+1;});
  Object.keys(pre).forEach(function(p){if(n&&pre[p]/n>=0.6)out.dishes.forEach(function(d){if(d.dish.indexOf(p+' ')===0)d.dish=d.dish.slice(p.length+1).trim();});});
  out.dishes.forEach(function(d){
    d.out=d.kg>0?Math.round(d.kg*1000/(d.qty||1)*10)/10:null;
    d.rows.forEach(function(x){x.g=Math.round(x.g*1000)/1000;});
    d.name=d.dish+(d.num?' (ТТК №'+d.num+')':'');
    d.sum=Math.round(d.rows.reduce(function(a,x){return a+x.g;},0)*10)/10;
    if(d.out>0&&d.sum>d.out*SPEC_TOO_MUCH)d.bad='сырья '+Math.round(d.sum)+' г на выход '+Math.round(d.out)+' г';   /* ошибка в спецификации (20 кг сгущёнки на порцию) */
  });
  return out;
}
