/* ---------- вкладка «ТТК»: создание карты по рецептуре и расчёту ---------- */
var TT_DEF={
  scope:'Настоящая технико-технологическая карта распространяется на блюдо {блюдо} {порция}, вырабатываемое {орг}.',
  r21:'Продовольственное сырье, пищевые продукты и полуфабрикаты, используемые для приготовления данного блюда {блюдо}, должны соответствовать требованиям Технического регламента Таможенного союза ТР ТС 021/2011 "О безопасности пищевой продукции", иметь сопроводительные документы, подтверждающие их безопасность и качество.',
  r22:'Подготовка сырья к производству блюда {блюдо} производится в соответствии с соблюдением требований СанПиНа 2.3/2.4.4282-26 «Санитарно-эпидемиологические требования к организации общественного питания населения».',
  r23:'Нормы потерь при холодной и тепловой обработке определяются по унифицированным таблицам: таблица № 15 «Расчет расхода мяса, выхода полуфабрикатов и готовых изделий», таблица № 23 «Расчет расхода сырья, выхода полуфабрикатов и готовых изделий из птицы сельскохозяйственной», таблица № 32 «Расчет расхода сырья, выхода полуфабрикатов и готовых изделий из овощей, фруктов, ягод», таблица № 33 «Расчет расхода сырья и выхода гастрономических изделий».',
  t41:'Предварительная подготовка сырья производится в соответствии с «Инструкцией по предварительной подготовке сырья к производству».',
  t42:'',
  s51:'Блюдо {блюдо} подается на порционной тарелке.',
  s52:'Температура подачи блюда {блюдо} +55-65°С.',
  s53:'Для доставки готового блюда в буфетно-раздаточные отделения используют гастроёмкость с плотно закрывающейся крышкой, которую вместе с продукцией устанавливают в изотермический контейнер «УПСА», предназначенный для удержания постоянной температуры во время транспортировки.',
  s54:'Допустимый срок хранения изделия согласно СанПиН 2.3/2.4.4282-26 при температуре 4±2°С не более 24 часов с момента окончания технологического процесса.',
  p62a:'Физико-химические показатели блюда {блюдо} определяют по методикам, изложенным в ГОСТ 30390-2013 «Услуги общественного питания. Продукция общественного питания, реализуемая населению. Общие требования» п.10.4.',
  p62b:'Выход готового блюда регламентирует ГОСТ Р 54607.2-2012 «Услуги общественного питания. Методы лабораторного контроля продукции общественного питания».',
  p62c:'Допустимые отклонения по массе готового блюда, основного продукта не должны превышать показатели Таблицы 2 и 4 из п.8 «Методы физико-химических испытаний» ГОСТ Р 54607.2-2012:',
  m63:'Микробиологические показатели качества блюда {блюдо} должны соответствовать требованиям Технического регламента Таможенного союза "О безопасности пищевой продукции" ТР ТС 021/2011, или гигиеническим нормативам, установленным в соответствии с нормативными правовыми актами или нормативными документами, действующими на территории государства, принявшего стандарт.',
  look:'',color:'',texture:'',taste:'',
  org:'ООО «Кредо»',head:'Директор',headName:'',date:'',
  semiName:'',semiMass:'',semiAfter:'0',viiLabel:'',viiNote:''
};
var TT_TEXT_KEYS=['scope','r21','r22','r23','t41','t42','s51','s52','s53','s54','p62a','p62b','p62c','m63'];
function dishParts(r){
  var base=String(r.name||'').replace(/\s*\(ТТК[^)]*\)\s*$/i,'').trim();
  var m=/^(.*?)\s+(\d+(?:\/\d+)*)\s*г[р.]*$/i.exec(base);
  return m?{dish:m[1].trim(),portion:m[2]+'гр.'}:{dish:base,portion:'1/'+dnum(r.output,2)+'гр.'};
}
function ttkDefault(r,k){
  var m;
  switch(k){
    case'num':m=/ттк\s*№\s*(\d+)/i.exec(r.name||'');return m?m[1]:'';
    case'dish':return dishParts(r).dish;
    case'portion':return dishParts(r).portion;
    case'tol':return dnum(Math.round(r.output*5)/100,2);
    case'main':return dnum(r.output,2);
    case'viiSrc':return ttkViiFromRef(r)?'ref':'calc';
    case'viiBasis':return'por';
    default:return TT_DEF[k]!==undefined?TT_DEF[k]:'';
  }
}
function ttkVal(r,k){var t=r.ttk;if(t&&Object.prototype.hasOwnProperty.call(t,k))return t[k];return ttkDefault(r,k);}
function setTtk(r,k,v){if(!r.ttk)r.ttk={};r.ttk[k]=v;queueSave('recipes',S.active);}
function ttkRowList(r){return r.rows.filter(function(x){return x.net>0||x.ing||x.pf||x.skip;});}
/* итоговые строки карты («Итого фарша:», «Итого:», «Масса полуфабриката»): список в r.ttk.subs, место задаётся строкой, после которой стоит итог. В расчёт КБЖУ и себестоимости они не входят */
function ttkSubs(r){
  var raw=r.ttk&&Object.prototype.hasOwnProperty.call(r.ttk,'subs')?r.ttk.subs:null,out=[];
  if(raw!==null){
    try{var a=JSON.parse(raw);if(Array.isArray(a))a.slice(0,30).forEach(function(x){if(x&&typeof x==='object')out.push({n:String(x.n||'').slice(0,120),m:String(x.m==null?'':x.m).slice(0,20),a:String(x.a||'').slice(0,40)});});}catch(e){}
    return out;
  }
  /* карты, сохранённые до появления списка: одна строка «Масса полуфабриката» */
  var sm=ttkPn(ttkVal(r,'semiMass'));
  if(sm>0){
    var list=ttkRowList(r),k=Math.max(0,Math.min(list.length,ttkPn(ttkVal(r,'semiAfter'))));
    out.push({n:String(ttkVal(r,'semiName')||'').trim()||'Масса полуфабриката',m:String(ttkVal(r,'semiMass')),a:k>0?list[k-1].rid:''});
  }
  return out;
}
function setSubs(r,arr){if(!r.ttk)r.ttk={};r.ttk.subs=JSON.stringify(arr);queueSave('recipes',S.active);}
/* итоги с местом в списке строк (at: 0 — перед первой строкой) и массой; пустая масса — сумма нетто строк выше (для «Итого» без уточнения — всех строк выше) */
function ttkSubRows(r){
  var list=ttkRowList(r),idx={},out=[],prev=0;
  list.forEach(function(x,i){idx[x.rid]=i+1;});
  ttkSubs(r).forEach(function(s,k){
    out.push({name:s.n.trim()||'Итого:',m:s.m,at:s.a===''?0:(idx[s.a]!==undefined?idx[s.a]:list.length),k:k,mass:0,auto:false});
  });
  out.sort(function(a,b){return a.at-b.at||a.k-b.k;});
  out.forEach(function(s){
    var p=parseNum(s.m),from=isBareTotal(s.name)?0:prev,sum=0,i;
    for(i=from;i<s.at;i++)sum+=list[i].net;
    s.sum=Math.round(sum*1000)/1000;
    if(p.ok&&!p.empty&&p.v>0)s.mass=p.v;
    else{s.mass=s.sum;s.auto=true;}
    prev=s.at;
  });
  return out;
}
function grossDefault(row){return grossFor({net:row.net},S.ings[row.ing]);}
/* в строке рецептуры введено брутто, а нетто пусто: нетто считается по потерям при холодной обработке из базы сырья (S.na — строки с таким «авто»-нетто:
   пока его не вписали руками, оно следует за брутто и за выбранным сырьём) */
function netFromGross(row){
  var na=S.na||(S.na={});
  if(!(row.gross>0))return;
  if(row.net>0&&!na[row.rid])return;
  var ing=S.ings[row.ing],cold=ing&&ing.loss&&ing.loss.cold;
  row.net=Math.round((cold>0&&cold<100?row.gross*(1-cold/100):row.gross)*1000)/1000;
  na[row.rid]=1;
}
function ttkPn(s){var p=parseNum(s);return p.ok?p.v:0;}
/* значения исходной ТТК (эталон) заполнены полностью, а расчёт неполный (у сырья нет КБЖУ): раздел VII берёт их, пока человек не выбрал иное */
function ttkViiFromRef(r){
  var ref=r&&r.ref;
  if(!ref||![ref.p,ref.f,ref.c,ref.kcal].every(function(x){return x!==null&&x!==undefined;}))return false;
  return compute(r,S.ings).unk.length>0;
}
function ttkVii(r,c){
  var src=ttkVal(r,'viiSrc'),basis=ttkVal(r,'viiBasis'),ref=r.ref,out=r.output;
  var hasRef=[ref.p,ref.f,ref.c,ref.kcal].every(function(x){return x!==null;});
  var por='1 порция ('+dnum(out,2)+' грамм) содержит:',h100='100 грамм блюда содержит:',v;
  if(src==='ref'&&hasRef)v={p:ref.p,f:ref.f,c:ref.c,kcal:ref.kcal,label:ref.basis==='portion'?por:h100,from:'эталон'};
  else{
    var use100=basis==='100'&&c.per100,b=use100?c.per100:c.portion;
    v={p:b.p,f:b.f,c:b.c,kcal:b.k,label:use100?h100:por,from:'расчёт'};
  }
  var custom=String(ttkVal(r,'viiLabel')||'').trim();
  if(custom)v.label=custom;
  v.note=String(ttkVal(r,'viiNote')||'').trim();
  return v;
}
function ttkViiHtml(v){
  return'<b>'+esc(v.label)+'</b> Б '+fmt(v.p,1)+' · Ж '+fmt(v.f,1)+' · У '+fmt(v.c,1)+' · '+fmt(v.kcal,1)+' ккал <span class="muted">(источник: '+v.from+')</span>';
}
function ttkIssuesHtml(r,c){
  return ttkIssues(r,c).map(function(x){return'<li class="w-'+x[0]+'">'+x[1]+'</li>';}).join('');
}
function ttkLive(r){
  var c=compute(r,S.ings),a=$('#tVii'),b=$('#ttkIssues');
  if(a)a.innerHTML=ttkViiHtml(ttkVii(r,c));
  if(b)b.innerHTML=ttkIssuesHtml(r,c);
}
/* название итоговой строки полуфабриката: последняя итоговая строка его карты вида «Вес готового соуса», иначе общее */
function pfSumName(q){
  var nm='';
  ttkSubs(q).forEach(function(x){var n=String(x.n||'').replace(/[\s:]+$/,'').trim();if(/^(вес|масса|выход)/i.test(n))nm=n;});
  return nm||'Вес готового полуфабриката';
}
/* строки таблицы рецептуры: сырьё, заголовок полуфабриката с номером его карты, состав в пересчёте на используемый вес, итог «Вес готового …» */
function ttkItems(r){
  var items=[],list=ttkRowList(r),subs=ttkSubRows(r);
  function grossOf(w){return(w.gross!==undefined&&w.gross!==null)?w.gross:grossDefault(w);}
  function expand(x,U,stack){
    var q=pfRec(x);
    if(pfBad(q,stack)){items.push({t:'row',name:q?pfTitle(q):'Полуфабрикат (ТТК не найдена)',gross:U,net:U});return;}
    var f=U/q.output;
    items.push({t:'hdr',name:pfTitle(q)+':'});
    ttkRowList(q).forEach(function(w){
      if(w.pf)expand(w,w.net*f,stack.concat([q]));
      else items.push({t:'row',name:ttkRowName(w),gross:grossOf(w)*f,net:w.net*f});
    });
    items.push({t:'sum',name:pfSumName(q),mass:U});
  }
  function put(k){subs.forEach(function(x){if(Math.max(0,Math.min(list.length,Number(x.at)||0))===k)items.push({t:'sum',name:x.name||'Итого:',mass:x.mass});});}
  put(0);
  list.forEach(function(x,i){
    if(x.pf)expand(x,x.net,[r]);
    else if(x.skip&&!x.ing&&!(x.net>0))items.push({t:'row',name:ttkRowName(x),gross:null,net:null});       /* без количества: пустые ячейки, не «0» */
    else items.push({t:'row',name:ttkRowName(x),gross:grossOf(x),net:x.net});
    if(!x.pf)normAlts(x.alts).forEach(function(a){items.push({t:'alt',name:'Или '+a.name,gross:(a.gross===undefined?null:a.gross),net:(a.net===undefined?null:a.net)});});
    put(i+1);
  });
  return items;
}
/* технология карты: свои пункты, затем пункты технологии каждого полуфабриката (с заголовком и номером его карты), нумерация продолжается */
function ttkTech(r,own){
  var out=[String(own==null?'':own)],seen={};
  function walk(rr,stack){
    ttkRowList(rr).forEach(function(w){
      if(!w.pf)return;
      var q=pfRec(w);
      if(pfBad(q,stack)||seen[w.pf])return;
      seen[w.pf]=1;
      var t=String(ttkVal(q,'t42')||'').trim();
      if(t){
        out.push('\u0001'+pfTitle(q)+' — технология приготовления:');
        t.split(/\r?\n/).forEach(function(l){l=l.trim().replace(/^\d+(?:\.\d+)*\.?\s+/,'');if(l)out.push('\u0002'+l);});
      }
      walk(q,stack.concat([q]));
    });
  }
  walk(r,[r]);
  return out.join('\n');
}
function ttkModel(r){
  var c=compute(r,S.ings);
  var texts={};
  TT_TEXT_KEYS.forEach(function(k){texts[k]=ttkVal(r,k);});
  texts.t42=ttkTech(r,texts.t42);
  return{
    num:String(ttkVal(r,'num')||'').trim()||'__',dish:String(ttkVal(r,'dish')||'').trim()||'Блюдо',portion:String(ttkVal(r,'portion')||'').trim(),
    org:String(ttkVal(r,'org')||'').trim(),head:String(ttkVal(r,'head')||'').trim(),headName:String(ttkVal(r,'headName')||'').trim(),date:String(ttkVal(r,'date')||'').trim(),
    out:r.output,tol:ttkPn(ttkVal(r,'tol')),main:ttkPn(ttkVal(r,'main')),
    rows:ttkRowList(r).map(function(x){
      var ing=S.ings[x.ing];
      return{name:x.tname||(ing?ing.name:'—'),net:x.net,gross:(x.gross!==undefined&&x.gross!==null)?x.gross:grossDefault(x)};
    }),
    subs:ttkSubRows(r).map(function(x){return{name:x.name,mass:x.mass,at:x.at};}),
    items:ttkItems(r),
    texts:texts,
    organo:{look:ttkVal(r,'look'),color:ttkVal(r,'color'),texture:ttkVal(r,'texture'),taste:ttkVal(r,'taste')},
    vii:ttkVii(r,c)
  };
}
function ttkIssues(r,c){
  var w=[],list=ttkRowList(r);
  if(!String(ttkVal(r,'num')||'').trim())w.push(['bad','Не указан номер ТТК.']);
  if(!(r.output>0))w.push(['bad','Не указан выход блюда.']);
  if(c.missing||c.unassigned)w.push(['bad','В расчёте есть строки без сырья из базы: КБЖУ в разделе VII будет неполным.']);
  list.filter(function(x){return x.pf;}).forEach(function(x){
    var q=pfRec(x),nm=q?(q.name||'без названия'):'';
    if(!q||!(q.output>0)){w.push(['bad','Полуфабрикат в строке рецептуры не найден или у его карты не указан выход: состав в карте не раскроется.']);return;}
    if(pfUses(q,r)){w.push(['bad','Полуфабрикат «'+esc(nm)+'» сам содержит эту карту: так считать нельзя, уберите строку.']);return;}
    if(!String(ttkVal(q,'num')||'').trim())w.push(['warn','У полуфабриката «'+esc(nm)+'» не указан номер ТТК: в таблице его заголовок останется без номера карты.']);
    if(!(x.net>0))w.push(['warn','Для полуфабриката «'+esc(nm)+'» не указан вес в порции: состав не раскроется.']);
  });
  var estOnly=c.est.filter(function(n){return c.unk.indexOf(n)<0;});
  if(c.unk.length){
    if(ttkVal(r,'viiSrc')==='ref')w.push(['good','КБЖУ сырья не заполнено ('+c.unk.map(esc).join(', ')+'): раздел VII взят из исходной ТТК, а не из расчёта.']);
    else w.push(['bad','КБЖУ не заполнено у сырья: '+c.unk.map(esc).join(', ')+'. В разделе VII эти продукты посчитаны как ноль, значения занижены. Заполните КБЖУ в базе сырья'+(ttkViiFromRef(r)?' или выберите «Значения взять из» → исходная ТТК':'')+'.']);
  }
  if(estOnly.length)w.push(['warn','КБЖУ в разделе VII посчитано по ориентировочным значениям сырья ('+estOnly.map(esc).join(', ')+'). Замените их данными этикетки или справочника.']);
  if(!String(ttkVal(r,'t42')||'').trim())w.push(['warn','Не заполнена технология приготовления (п. 4.2).']);
  if(!['look','color','texture','taste'].every(function(k){return String(ttkVal(r,k)||'').trim();}))w.push(['warn','Не заполнены органолептические показатели (п. 6.1).']);
  if(!String(ttkVal(r,'headName')||'').trim())w.push(['warn','Не указан ФИО утверждающего: в шапке останется пустая строка.']);
  ttkSubRows(r).forEach(function(x){
    if(x.auto||!(x.sum>0)||Math.abs(x.sum-x.mass)<=0.5)return;
    w.push(['warn','Строка «'+esc(x.name.replace(/[\s:.]+$/,''))+'»: указано '+dnum(x.mass,2)+' г, а сумма нетто строк, которые она подводит, '+dnum(x.sum,2)+' г. Для сырого полуфабриката эти числа должны совпадать, для варёного (отварного, жареного) могут отличаться.']);
  });
  var tol=ttkPn(ttkVal(r,'tol'));
  w.push(['warn','Проверьте допуск по массе блюда ±'+dnum(tol,2)+' г (п. 6.2), номера таблиц потерь (п. 2.3) и срок хранения (п. 5.4) по вашим нормам.']);
  if(w.every(function(x){return x[0]!=='bad';}))w.unshift(['good','Файл можно скачивать. Названия сырья, брутто и тексты разделов проверьте перед утверждением.']);
  return w;
}
function tfIn(r,k,label,cls,ph){
  return'<label class="field'+(cls?' '+cls:'')+'"><span class="lbl">'+label+'</span><input data-act="ttf" data-k="'+k+'" data-edit data-fk="tf:'+k+'" autocomplete="off" value="'+esc(ttkVal(r,k))+'"'+(ph?' placeholder="'+esc(ph)+'"':'')+'></label>';
}
function tfArea(r,k,label,rows,hint){
  return'<div class="ta"><label class="field"><span class="lbl">'+label+'</span><textarea class="prose" rows="'+rows+'" data-act="ttf" data-k="'+k+'" data-edit data-fk="tf:'+k+'">'+esc(ttkVal(r,k))+'</textarea></label>'+(hint?'<p class="hint" style="margin:4px 0 0">'+hint+'</p>':'')+'</div>';
}
function viewTtkDoc(r){
  var c=compute(r,S.ings),list=ttkRowList(r);
  var h='<h2 class="secttl" id="secDoc">Карта ТТК (документ .docx)</h2><p class="hint" style="margin:-2px 0 12px">Реквизиты, рецептура, тексты разделов и скачивание. Выход задаётся в карточке блюда выше, состав — в рецептуре. По ней же считаются КБЖУ и себестоимость.</p>';
  h+='<div class="ttkcols">';
  h+='<section class="card"><h2>Реквизиты карты</h2>'
    +'<div class="fgrid">'+tfIn(r,'num','Номер ТТК','w120')+tfIn(r,'dish','Наименование блюда','')+tfIn(r,'portion','Порция в названии, например 1/100гр.','w180')+'</div>'
    +'<div class="fgrid">'+tfIn(r,'org','Организация','')+tfIn(r,'head','Должность','w180')+tfIn(r,'headName','ФИО утверждающего','')+tfIn(r,'date','Дата утверждения','w180','«1» сентября 2026г.')+'</div>'
    +'</section>';
  /* рецептура */
  h+='<section class="card"><h2>III. Рецептура</h2>'
    +'<p class="hint" style="margin:-4px 0 8px">Состав блюда вводится здесь: выберите сырьё из базы, укажите брутто и нетто. Таблица расчёта КБЖУ внизу страницы берёт данные отсюда.</p>'
    +'<div class="trw thead'+(NOPRICE?'':' cst')+'"><span>№</span><span>Сырьё из базы</span><span>Название сырья в ТТК</span><span class="r">Брутто, г</span><span class="r">Нетто, г</span>'+(NOPRICE?'':'<span class="r" title="Стоимость сырья в одной порции: брутто × цена за кг">Себест., ₽</span>')+'<span></span></div>';
  var inl={},kc=NOPRICE?null:ttkCosts(r);list.forEach(function(x,i){inl[x.rid]=i+1;});
  r.rows.forEach(function(x,i){
    var ing=S.ings[x.ing],pq=pfRec(x),nm=x.pf?(pq?pfTitle(pq):''):(x.tname||(ing?ing.name:'')),gd=grossDefault(x),no=inl[x.rid],ri=esc(x.rid),cx=kc?kc.by[x.rid]:null;
    h+='<div class="trw'+(NOPRICE?'':' cst')+hlCls(x.rid)+'" data-rid="'+ri+'" data-inl="'+(no?1:0)+'"><span class="n">'+(no||'·')+'</span>'
      +pickerHtml('rowIng','r:'+ri+':ing',(x.skip&&!x.ing)?'__skip__':(x.pf?'pf:'+x.pf:x.ing),'Сырьё из базы, строка '+(i+1),S.pfOnly===x.rid?'Выберите полуфабрикат (ТТК)':'Начните вводить название сырья','create'+(S.pfOnly===x.rid?'|pfonly':''),'sel')
      +'<input class="nm" data-act="tName" data-edit data-fk="tn:'+ri+'" aria-label="Название в ТТК, строка '+(i+1)+'" autocomplete="off" value="'+esc(nm)+'" placeholder="'+esc(ing?ing.name:'Название')+'"'+(x.pf?' readonly tabindex="-1" title="Название берётся из карты полуфабриката"':'')+'>'
      +'<label class="cell gr" data-label="Брутто, г"><input class="num" inputmode="decimal" data-act="tGross" data-edit data-fk="tg:'+ri+'" aria-label="Брутто, г, строка '+(i+1)+'" autocomplete="off" value="'+((x.gross!==undefined&&x.gross!==null)?toInput(x.gross):'')+'" placeholder="'+toInput(Math.round(gd*1000)/1000)+'"'+(x.pf?' readonly tabindex="-1"':'')+' title="Масса до обработки: по ней считается себестоимость. Пусто — по проценту потерь из базы сырья."></label>'
      +'<label class="cell nt" data-label="Нетто, г"><input class="num" inputmode="decimal" data-act="rowNet" data-edit data-fk="r:'+ri+':net" aria-label="Нетто, г, строка '+(i+1)+'" autocomplete="off" value="'+toInput(x.net)+'"></label>'
      +(NOPRICE?'':'<span class="cs'+(cx&&cx.sum!==null?' has':'')+'" data-out="rc" data-label="Себестоимость, ₽" title="'+esc(ttkCostTitle(cx))+'">'+esc(ttkCostCell(cx))+'</span>')
      +'<button class="x" data-act="delRow" data-edit aria-label="Удалить строку '+(i+1)+'" title="Удалить строку">×</button>'+pfSubHtml(x)+altSubHtml(x)+'</div>';
  });
  h+='<button class="btn" data-act="addRow" data-edit>+ Добавить сырьё</button> <button class="btn" data-act="addPfRow" data-edit title="Строка из другой ТТК: её состав раскроется в карте с номером карты-источника">+ Добавить полуфабрикат</button>'
    +(NOPRICE?'':'<p class="ttkcost" id="ttkCost">'+ttkCostHtml(r)+'</p>');
  var subsH='',subsCalc={};
  ttkSubRows(r).forEach(function(x){subsCalc[x.k]=x;});
  ttkSubs(r).forEach(function(sb,si){
    var known=!sb.a||list.some(function(x){return x.rid===sb.a;});
    var opts='<option value=""'+(sb.a===''?' selected':'')+'>перед первой строкой</option>'+list.map(function(x,i){return'<option value="'+esc(x.rid)+'"'+(sb.a===x.rid?' selected':'')+'>после строки '+(i+1)+'</option>';}).join('')+(known?'':'<option value="'+esc(sb.a)+'" selected>в конце (строка удалена)</option>');
    var cx=subsCalc[si];
    subsH+='<div class="tsr" data-si="'+si+'"><input data-act="tsName" data-edit data-fk="ts:'+si+':n" autocomplete="off" aria-label="Название итоговой строки" value="'+esc(sb.n)+'" placeholder="Например: Итого фарша:">'
      +'<input class="num" inputmode="decimal" data-act="tsMass" data-edit data-fk="ts:'+si+':m" autocomplete="off" aria-label="Масса итоговой строки, г" value="'+esc(sb.m)+'" placeholder="'+(cx?esc(toInput(cx.sum)):'авто')+'">'
      +'<select data-act="tsAt" data-edit data-fk="ts:'+si+':a" aria-label="Где показать итоговую строку">'+opts+'</select>'
      +'<button class="btn mini danger" data-act="tsDel" data-edit data-si="'+si+'">Убрать</button></div>';
  });
  h+='<p class="hint">Брутто, нетто и выход указывайте на одну порцию. Себестоимость считается по брутто, КБЖУ — по нетто. Пустое брутто заполняется автоматически: по % потерь при холодной обработке из базы сырья, а если его нет, брутто равно нетто. Введите своё значение, чтобы заменить. Если поменять нетто, введённое брутто изменится в той же пропорции.</p>'
    +'<div class="subs"><span class="lbl">Итоговые строки рецептуры («Итого фарша:», «Итого соуса:», «Масса полуфабриката»)</span>'
    +(subsH||'<p class="hint" style="margin:4px 0">Итогов в рецептуре нет. Они подгружаются из ТТК автоматически; добавить свои можно кнопкой ниже.</p>')
    +'<div class="btns" style="margin-top:6px"><button class="btn mini" data-act="tsAdd" data-edit>+ Добавить итоговую строку</button></div>'
    +'<p class="hint" style="margin:6px 0 0">Эти строки выводятся в рецептуре карты для поваров и не входят в расчёт КБЖУ и себестоимости. Пустая масса считается сама: сумма нетто строк, которые итог подводит.</p></div>'
    +'<div class="fgrid"><label class="field w120"><span class="lbl">Выход, г</span><input id="ttkOutShow" class="num" value="'+toInput(r.output)+'" disabled aria-label="Выход, задаётся в карточке блюда выше"></label>'
    +tfIn(r,'tol','Допуск по массе, ± г','w150')+tfIn(r,'main','Выход основного продукта, г','w180')+'</div>'
    +'</section>';
  /* VII */
  var vv=ttkVii(r,c);
  var hasRef=[r.ref.p,r.ref.f,r.ref.c,r.ref.kcal].every(function(x){return x!==null;});
  h+='<section class="card"><h2>VII. Пищевая и энергетическая ценность</h2>'
    +'<div class="fgrid"><label class="field"><span class="lbl">Значения взять из</span><select data-act="ttfSel" data-k="viiSrc" data-edit data-fk="tf:viiSrc"><option value="calc"'+(ttkVal(r,'viiSrc')!=='ref'?' selected':'')+'>расчёта калькулятора</option><option value="ref"'+(ttkVal(r,'viiSrc')==='ref'?' selected':'')+(hasRef?'':' disabled')+'>эталона из блока сверки'+(hasRef?'':' (не заполнен)')+'</option></select></label>'
    +'<label class="field"><span class="lbl">Расчёт показать</span><select data-act="ttfSel" data-k="viiBasis" data-edit data-fk="tf:viiBasis"><option value="por"'+(ttkVal(r,'viiBasis')!=='100'?' selected':'')+'>на порцию</option><option value="100"'+(ttkVal(r,'viiBasis')==='100'?' selected':'')+'>на 100 г</option></select></label></div>'
    +'<div class="fgrid">'+tfIn(r,'viiLabel','Подпись над значениями (необязательно)','',vv.label)+tfIn(r,'viiNote','Примечание под таблицей (необязательно)','','Например: по протоколу испытаний № 5909/26-П')+'</div>'
    +'<p class="vii" id="tVii">'+ttkViiHtml(vv)+'</p>'
    +'</section>';
  /* тексты */
  h+='<section class="card" id="secTexts"><h2>Тексты разделов</h2>'
    +'<p class="hint" style="margin-top:0">Подставляется название блюда: <b>{блюдо}</b>, <b>{орг}</b> — организация, <b>{порция}</b> — порция. Жирным в документе: <b>**текст**</b>. Нумерация пунктов добавляется сама. Пустое поле — пункт не попадёт в карту.</p>'
    +tfArea(r,'scope','I. Область применения',3)
    +tfArea(r,'r21','2.1. Требования к сырью',4)
    +tfArea(r,'r22','2.2. Подготовка сырья',3)
    +tfArea(r,'r23','2.3. Нормы потерь',4,'Оставьте номера таблиц, которые относятся к сырью этого блюда.')
    +tfArea(r,'t41','4.1. Предварительная подготовка',2)
    +tfArea(r,'t42','4.2. Технология приготовления',9,'Каждая строка — отдельный пункт, номера 4.2.1, 4.2.2… ставятся сами. Если нумеруете вручную, строка без номера считается продолжением предыдущего пункта.')
    +aiBarHtml('tech')
    +tfArea(r,'s51','5.1. Оформление и подача',2)+tfArea(r,'s52','5.2. Температура подачи',2)+tfArea(r,'s53','5.3. Доставка',3)+tfArea(r,'s54','5.4. Срок хранения',2)
    +'<div class="fgrid">'+tfArea(r,'look','6.1. Внешний вид',3)+tfArea(r,'color','Цвет',3)+'</div><div class="fgrid">'+tfArea(r,'texture','Консистенция',3)+tfArea(r,'taste','Вкус и запах',3)+'</div>'
    +aiBarHtml('organo')
    +tfArea(r,'p62a','6.2. Физико-химические показатели (метод)',3)+tfArea(r,'p62b','6.2. Выход готового блюда',2)+tfArea(r,'p62c','6.2. Допустимые отклонения по массе',3)
    +tfArea(r,'m63','6.3. Микробиологические показатели',4)
    +'</section>';
  /* скачать */
  h+='<section class="card" id="secDl"><h2>Скачать карту</h2><ul class="warns" id="ttkIssues">'+ttkIssuesHtml(r,c)+'</ul>'
    +'<div class="btns" style="margin-top:12px"><button class="btn" data-act="pvTtk" title="Показать карту так, как она будет в документе">Предпросмотр</button>'+(canDl()?'<button class="btn primary" data-act="dlTtk">Скачать ТТК (.docx)</button>':'<span class="muted">Скачивание здесь недоступно.</span>')
    +'<button class="btn" data-act="ttkResetTexts" data-edit>Вернуть тексты по умолчанию</button>'
    +(S.mode==='local'&&syLinked()&&syAdmin()?'<button class="btn" data-act="syFSave" title="Положить файл .docx этой ТТК в библиотеку «ТТК в облаке»">Сохранить файл в облако</button>':'')+'</div>'
    +'<div id="syBot">'+(S.mode==='local'&&syLinked()?syBotHtml(r):'')+'</div>'+(S.mode==='local'&&syLinked()&&syAdmin()?syHistHtml():'')+syMsgHtml('fsave')+'</section>';
  h+='</div>';
  return h;
}
function doDownloadTtk(r,over){
  if(over===undefined&&drGenGate(r,'ttk'))return;          /* сначала спрашиваем юридическое лицо, если оно есть в справочнике */
  var m=ttkModel(r),bytes;
  if(over){m.org=over.org;m.head=over.head;m.headName=over.headName;}
  bytes=buildTtkDocx(m);
  exportFile(bytes,safeName('ТТК №'+m.num+' '+m.dish)+'.docx');
}

/* ---- предпросмотр карты: тот самый документ, который скачивается, показанный на листе ---- */
var PV_W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',pvState=null;
function pvKids(el,name){var o=[];if(!el)return o;Array.prototype.forEach.call(el.childNodes,function(c){if(c.nodeType===1&&c.localName===name)o.push(c);});return o;}
function pvAt(el,a){return el?el.getAttributeNS(PV_W,a):null;}
function pvPx(tw){return Math.round(Number(tw)/15*100)/100;}
function pvPara(p){
  var pr=pvKids(p,'pPr')[0],st='',tab=0,h='';
  if(pr){
    var jc=pvKids(pr,'jc')[0],ind=pvKids(pr,'ind')[0],sp=pvKids(pr,'spacing')[0],tb=pvKids(pr,'tabs')[0],t0=tb?pvKids(tb,'tab')[0]:null,v=jc?pvAt(jc,'val'):'';
    if(v)st+='text-align:'+(v==='both'?'justify':(v==='center'?'center':(v==='right'?'right':'left')))+';';
    if(ind&&Number(pvAt(ind,'left')))st+='margin-left:'+pvPx(pvAt(ind,'left'))+'px;';
    if(sp)st+='margin-top:'+pvPx(pvAt(sp,'before')||0)+'px;margin-bottom:'+pvPx(pvAt(sp,'after')||0)+'px;';
    if(t0)tab=Number(pvAt(t0,'pos'))||0;
  }
  pvKids(p,'r').forEach(function(r){
    if(pvKids(r,'tab').length){if(tab){h='<span class="pvtab" style="min-width:'+pvPx(tab)+'px">'+h+'</span>';tab=0;}return;}
    var rp=pvKids(r,'rPr')[0],t=pvKids(r,'t')[0],x=esc(t?t.textContent:'');
    if(!x)return;
    if(rp){
      var sz=pvKids(rp,'sz')[0];
      if(sz&&Number(pvAt(sz,'val')))x='<span style="font-size:'+(Number(pvAt(sz,'val'))/2)+'pt">'+x+'</span>';
      if(pvKids(rp,'u').length)x='<u>'+x+'</u>';
      if(pvKids(rp,'i').length)x='<i>'+x+'</i>';
      if(pvKids(rp,'b').length)x='<b>'+x+'</b>';
    }
    h+=x;
  });
  return'<p'+(st?' style="'+st+'"':'')+'>'+h+'</p>';
}
function pvTable(tbl){
  var grid=pvKids(pvKids(tbl,'tblGrid')[0],'gridCol').map(function(c){return Number(pvAt(c,'w'))||0;});
  var open={},rows=pvKids(tbl,'tr').map(function(tr){
    var col=0,list=[];
    pvKids(tr,'tc').forEach(function(tc){
      var pr=pvKids(tc,'tcPr')[0],gs=pr?pvKids(pr,'gridSpan')[0]:null,vmEl=pr?pvKids(pr,'vMerge')[0]:null,span=gs?(Number(pvAt(gs,'val'))||1):1;
      var vm=vmEl?(pvAt(vmEl,'val')==='restart'?'restart':'cont'):'',o={col:col,span:span,tc:tc,rs:1,skip:false};
      if(vm==='cont'&&open[col]){open[col].rs++;o.skip=true;}
      else if(vm==='restart')open[col]=o;
      else delete open[col];
      list.push(o);col+=span;
    });
    return list;
  });
  var tw=grid.reduce(function(a,b){return a+b;},0);
  var h='<table style="width:'+pvPx(tw)+'px"><colgroup>'+grid.map(function(w){return'<col style="width:'+pvPx(w)+'px">';}).join('')+'</colgroup><tbody>';
  rows.forEach(function(list){
    h+='<tr>';
    list.forEach(function(o){
      if(o.skip)return;
      h+='<td'+(o.span>1?' colspan="'+o.span+'"':'')+(o.rs>1?' rowspan="'+o.rs+'"':'')+'>'+pvBlocks(o.tc)+'</td>';
    });
    h+='</tr>';
  });
  return h+'</tbody></table>';
}
function pvBlocks(el){
  var h='';
  Array.prototype.forEach.call(el.childNodes,function(c){
    if(c.nodeType!==1)return;
    if(c.localName==='p')h+=pvPara(c);else if(c.localName==='tbl')h+=pvTable(c);
  });
  return h;
}
/* масштаб листа под ширину окна: лист A4 (794 px) на телефоне уменьшается целиком */
function pvFit(){
  var ov=$('#pvOv');if(!ov)return;
  var sc=ov.querySelector('.pvscroll'),fit=ov.querySelector('.pvfit');
  if(!sc||!fit)return;
  var k=Math.min(1,(sc.clientWidth-24)/794);
  fit.style.zoom=k>0?String(Math.round(k*1000)/1000):'1';
}
function pvClose(){
  var ov=$('#pvOv');
  if(ov&&ov.parentNode)ov.parentNode.removeChild(ov);
  var w=$('.wrap');if(w){try{w.inert=false;}catch(e){}w.removeAttribute('aria-hidden');}
  document.documentElement.classList.remove('pvlock');
  var f=pvState&&pvState.focus;pvState=null;
  if(f&&f.isConnected&&f.focus)try{f.focus();}catch(e){}
}
function pvOpen(r){
  var xml,doc,body;
  try{
    xml=ttkDocXml(ttkModel(r));
    doc=new DOMParser().parseFromString(xml,'application/xml');
    if(doc.getElementsByTagName('parsererror').length)throw new Error('xml');
    body=doc.getElementsByTagNameNS(PV_W,'body')[0];
  }catch(e){flash('Не удалось собрать предпросмотр');return;}
  var ov=$('#pvOv');
  if(!ov){ov=document.createElement('div');ov.id='pvOv';ov.className='pvov';ov.setAttribute('role','dialog');ov.setAttribute('aria-modal','true');ov.setAttribute('aria-label','Предпросмотр ТТК');document.body.appendChild(ov);}
  var m=ttkModel(r),bad=ttkIssues(r,compute(r,S.ings)).filter(function(x){return x[0]==='bad';}).length;
  ov.innerHTML='<div class="pvbar"><span class="pvh"><b>Предпросмотр ТТК №'+esc(m.num)+'</b><span class="pvn"> Так карта выглядит в документе; переносы страниц в Word могут отличаться.'+(bad?' Есть то, что нужно исправить перед скачиванием.':'')+'</span></span>'
    +'<span class="pvbtn">'+(canDl()?'<button class="btn primary" type="button" data-pv="dl">Скачать (.docx)</button>':'')+'<button class="btn" type="button" data-pv="close" id="pvClose">Закрыть</button></span></div>'
    +'<div class="pvscroll"><div class="pvfit"><div class="pvpage" id="pvPage">'+pvBlocks(body)+'</div></div></div>';
  pvState={focus:document.activeElement,rid:S.active};
  var w=$('.wrap');if(w){try{w.inert=true;}catch(e){}w.setAttribute('aria-hidden','true');}
  document.documentElement.classList.add('pvlock');
  pvFit();
  var cb=$('#pvClose');if(cb)cb.focus();
}
document.addEventListener('click',function(e){
  var b=e.target.closest&&e.target.closest('#pvOv [data-pv]');if(!b)return;
  if(b.getAttribute('data-pv')==='close')pvClose();
  else if(b.getAttribute('data-pv')==='dl'){var r=pvState&&S.recipes[pvState.rid];if(r)doDownloadTtk(r);}
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'&&$('#pvOv')){e.preventDefault();pvClose();}});
window.addEventListener('resize',pvFit);

