/*PURE-START*/
var KINDS={estimate:'Ориентир — проверить',label:'Этикетка',table:'Справочник',lab:'Лаборатория'};
var KCAL_P=4,KCAL_F=9,KCAL_C=4,KJ_PER_KCAL=4.184;
/* КБЖУ не заполнено: сырьё с пометкой «Ориентир» и нулями во всех трёх полях (заведено из прайса или ТТК, значения ещё не внесены).
   Настоящий ноль (вода, соль) — сырьё другого типа: справочник, этикетка, лаборатория. */
function kUnknown(ing){return!!ing&&ing.kind==='estimate'&&!(ing.p||ing.f||ing.c);}

function num(x){var v=Number(x);return isFinite(v)&&v>=0?v:0;}
function nn(x){if(x===null||x===undefined||x==='')return null;var v=Number(x);return isFinite(v)?v:null;}
function parseNum(str){
  var t=String(str).replace(/\s/g,'').replace(',','.');
  if(t==='')return{v:0,ok:true,empty:true};
  var v=Number(t);
  return(isFinite(v)&&v>=0)?{v:v,ok:true,empty:false}:{v:0,ok:false,empty:false};
}
/* Разбор таблицы из Excel (табуляция) или CSV с «;». Поля в кавычках могут содержать «;», переводы строк и удвоенные кавычки. */
function parseRecords(text,sniff,forced){
  var t=String(text==null?'':text).replace(/^﻿/,'');
  var first=t.split(/\r?\n/).filter(function(l){return l.trim()!=='';})[0]||'';
  var d=forced||(sniff?sniffDelim(t):(first.indexOf('\t')>-1?'\t':';'));
  var rows=[],row=[],cell='',q=false,i,ch;
  function endCell(){row.push(cell.trim());cell='';}
  function endRow(){endCell();if(row.some(function(x){return x!=='';}))rows.push(row);row=[];}
  for(i=0;i<t.length;i++){
    ch=t.charAt(i);
    if(q){
      if(ch==='"'){if(t.charAt(i+1)==='"'){cell+='"';i++;}else{q=false;}}
      else{cell+=ch;}
    }else if(ch==='"'&&cell===''){q=true;}
    else if(ch===d){endCell();}
    else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&t.charAt(i+1)==='\n')i++;endRow();}
    else{cell+=ch;}
  }
  endRow();
  return rows;
}
function canon(v){
  if(Array.isArray(v))return'['+v.map(canon).join(',')+']';
  if(v&&typeof v==='object')return'{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+canon(v[k]);}).join(',')+'}';
  return JSON.stringify(v===undefined?null:v);
}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
/* разделы сырья (мясо, рыба, бакалея…). У сырья есть необязательное поле cat; пока оно пустое, раздел определяется по названию (autoCat),
   поэтому у всей встроенной базы разделы есть без правки данных, а в общую базу уходят только разделы, выбранные вручную */
var CATS=['Мясо и птица','Рыба и морепродукты','Молочные продукты и яйца','Овощи, грибы и зелень','Фрукты и ягоды','Бакалея','Консервы','Хлеб, тесто и полуфабрикаты','Масла и жиры','Специи и приправы','Соусы и заправки','Напитки','Прочее'];
var CAT_RULES=[
  ['Напитки',/^(квас|чай|кофе|какао|компот|кисель|морс|сок)(?![а-яa-z])/],
  ['Масла и жиры',/(^|[^а-яa-z])масло(?![а-яa-z])|маргарин|смалец/],
  ['Рыба и морепродукты',/рыб|лосос|горбуш|форел|минтай|сельд|сардин|шпрот|тунец|кальмар|креветк|мидии|краб|икра|морск|сайра|треск|(^|[^а-яa-z])хек(?![а-яa-z])|судак|скумбри|осетр|(^|[^а-яa-z])кета|анчоус|камбал|палтус|щук|мойва|ставрид|навага/],
  ['Хлеб, тесто и полуфабрикаты',/пицц|вареник|пельмен|пирожок|пирожк|(^|[^а-яa-z])тесто(?![а-яa-z])|^хлеб|^батон|^багет|^булк|бульон|дольки|луковые кольца|сырные палочки|наггетс|^манты|хинкали|блинч|полуфабрикат/],
  ['Соусы и заправки',/соус|кетчуп|майонез|заправк|бешамель|горчиц|паста томатн|томатная паста|аджик|уксус|тахини|песто|ткемали/],
  ['Специи и приправы',/(^|[^а-яa-z])соль(?![а-яa-z])|молот|паприк|(^|[^а-яa-z])зира|кориандр|корица|куркум|лавров|приправ|хмели|прованск|карри|чеснок сушен|лук сушен|укроп сушен|пряност|специ|перец (черн|красн|бел|душист)|имбир|гвоздик|кардамон|шафран|мускат|орегано|тимьян|розмарин/],
  ['Консервы',/конс\.|консерв/],
  ['Молочные продукты и яйца',/молок|сливк|сметан|творог|(^|[^а-яa-z])сыр(?![а-яa-z])|йогурт|кефир|ряженк|яйц|плавленн|простокваш|брынз|мороженое/],
  ['Мясо и птица',/говяд|говяж|свин|куриц|курин|(^|[^а-яa-z])кур(?![а-яa-z])|цыпл|индей|(^|[^а-яa-z])утк|(^|[^а-яa-z])гус[ьи]|баран|ягнен|телят|мяс|фарш|(^|[^а-яa-z])кост|печень(?![а-яa-z])|окороч|окорок|грудк|купат|сосиск|колбас|ветчин|(^|[^а-яa-z])сало|ребр|гуляш|(^|[^а-яa-z])язык|(^|[^а-яa-z])ше[яи](?![а-яa-z])|лопатк|карбонат|бекон|сарделк|голень|бедр|крыл[ыь]|субпродукт|сердц/],
  ['Бакалея',/круп|макарон|(^|[^а-яa-z])паст[аы](?![а-яa-z])|лапш|вермишел|спагетти|(^|[^а-яa-z])мук[аи](?![а-яa-z])|сахар|крахмал|дрожж|разрыхл|желатин|(^|[^а-яa-z])горох(?![а-яa-z])|фасоль сух|булгур|пшено|(^|[^а-яa-z])рис(?![а-яa-z])|джем|повидло|сироп|^мед(?![а-яa-z])|посыпк|ванилин|краситель|лимонная кислот|кунжут|(^|[^а-яa-z])мак(?![а-яa-z])|сухари|печенье|сушки|(^|[^а-яa-z])сода(?![а-яa-z])|орех|миндал|арахис|фундук|семечк|чечевиц|(^|[^а-яa-z])нут(?![а-яa-z])|мюсли|хлопья|отруби|геркулес|смесь для/],
  ['Овощи, грибы и зелень',/капуст|картофел|морков|свекл|(^|[^а-яa-z])лук(?![а-яa-z])|чеснок|огур|помидор|томат|перец|баклажан|кабач|тыкв|редис|шампиньон|гриб|зелен|петрушк|укроп|кинз|микрозелен|салат|сельдер|брокколи|смесь овощ|кукуруз|шпинат|щавел|редьк|(^|[^а-яa-z])репа|горошек|фасоль|овощ|базилик|спарж|порей|пастернак|ревень/],
  ['Фрукты и ягоды',/яблок|апельсин|лимон|банан|груш|вишн|смородин|облепих|клубник|малин|черник|ягод|абрикос|персик|виноград|мандарин|(^|[^а-яa-z])слив[аы](?![а-яa-z])|киви|ананас|сухофрукт|изюм|курага|чернослив|брусник|клюкв|земляник|(^|[^а-яa-z])дын|арбуз|гранат|хурм|финик|инжир/]
];
function catKey(s){return String(s==null?'':s).toLowerCase().replace(/ё/g,'е');}
function autoCat(name){var s=catKey(name);for(var i=0;i<CAT_RULES.length;i++)if(CAT_RULES[i][1].test(s))return CAT_RULES[i][0];return'Прочее';}
function ingCat(i){return i&&i.cat?i.cat:autoCat(i&&i.name);}
/* порядок разделов: стандартные, затем свои по алфавиту, «Прочее» последним */
function catNames(ings){
  var seen={},head=CATS.slice(0,-1),extra=[];
  CATS.forEach(function(c){seen[c]=1;});
  Object.keys(ings||{}).forEach(function(id){var c=ingCat(ings[id]);if(c&&!seen[c]){seen[c]=1;extra.push(c);}});
  extra.sort(function(a,b){return a.localeCompare(b,'ru');});
  return head.concat(extra,[CATS[CATS.length-1]]);
}
function normIng(d){
  d=d||{};
  var o={name:String(d.name||''),p:num(d.p),f:num(d.f),c:num(d.c),kind:KINDS[d.kind]?d.kind:'estimate',source:String(d.source||'')};
  /* % потерь из таблицы пользователя (холодная обработка, варка, жарка, тушение, запекание): страница их не использует, но сохраняет при правке позиции */
  if(d.loss&&typeof d.loss==='object')o.loss={cold:nn(d.loss.cold),boil:nn(d.loss.boil),fry:nn(d.loss.fry),stew:nn(d.loss.stew),bake:nn(d.loss.bake)};
  /* синонимы: как это сырьё называется в ТТК (в нормализованном виде, см. normKey); по ним сырьё находится при загрузке ТТК */
  if(Array.isArray(d.aliases)&&d.aliases.length)o.aliases=d.aliases.map(function(a){return String(a);}).filter(Boolean).slice(0,40);
  /* раздел сырья (мясо, рыба, бакалея…), выбранный вручную; пока его нет, раздел определяется по названию */
  if(typeof d.cat==='string'&&d.cat.trim())o.cat=d.cat.trim().replace(/\s+/g,' ').slice(0,40);
  /* цена из прайса: за килограмм или за упаковку (штуку) с массой упаковки в граммах. Поля price/priceUnit/packG/priceSrc на самом сырье — цены основного региона */
  /* плотность, г/мл: нужна, чтобы литры из закупок пересчитывать в килограммы; без неё 1 л принимается за 1 кг с пометкой */
  if(nn(d.dens)!==null&&num(d.dens)>=0.2&&num(d.dens)<=3)o.dens=Math.round(num(d.dens)*1000)/1000;
  else if(d.densAsm)o.densAsm=1;      /* пользователь явно принял допущение «1 л = 1 кг» для цены этого сырья */
  var pm=normPriceRec(d);Object.keys(pm).forEach(function(k){o[k]=pm[k];});
  /* цены остальных регионов: px[идентификатор региона] = {price, priceUnit, packG, priceSrc} */
  if(d.px&&typeof d.px==='object'){
    var px={},cnt=0;
    Object.keys(d.px).forEach(function(k){
      if(!REG_ID.test(k)||k===MAIN||cnt>=8)return;
      var q=normPriceRec(d.px[k]);
      if(Object.keys(q).length){px[k]=q;cnt++;}
    });
    if(cnt)o.px=px;
  }
  return o;
}
var MAIN='main',REG_ID=/^[a-z0-9_-]{1,40}$/i,SELL_KEY=/^[a-z0-9_-]{1,40}(?::[a-z0-9_-]{1,60})?$/i;
/* Доступ к ценам. NOPRICE: права на цены нет (файл привязан к общей базе, а код ещё не введён или не подошёл; по любому верному коду цены видны).
   Тогда закупочные цены сырья (price, priceUnit, packG, priceSrc, px) и цены продажи блюд (sell) не показываются, не считаются
   и не уходят в общий обмен; свои цены, если они были, лежат нетронутыми. */
var NOPRICE=false;
var PRICE_ING=['price','priceUnit','packG','priceSrc','px'];
function stripIngPrice(o){PRICE_ING.forEach(function(k){delete o[k];});return o;}
var DEFAULT_REGIONS=[{id:'main',name:'Волгоград'},{id:'msk',name:'Москва'}];
var OLD_MAIN_NAME='Основной';   // прежнее название основного региона: при чтении заменяется на «Волгоград»
function normPriceRec(d){
  var o={};d=d||{};
  var pr=nn(d.price);if(pr!==null&&pr>=0)o.price=pr;
  if(d.priceUnit==='pack')o.priceUnit='pack';
  var pg=nn(d.packG);if(pg!==null&&pg>0)o.packG=pg;
  if(d.priceSrc)o.priceSrc=String(d.priceSrc).slice(0,200);
  return o;
}
/* финансовая политика: цель (наценка или маржинальность, %) и округление цены вверх */
var DEFAULT_FINANCE={mode:'markup',target:null,round:1};
/* пороги подсветки показателей меню (только заданные вручную; остальные — стандартные) */
var TONE_KEYS=['fcO','fcB','mkO','mkB','mgO','mgB','pfO','pfB'];
function normTone(d){
  if(!d||typeof d!=='object')return null;
  var o={},n=0;
  TONE_KEYS.forEach(function(k){var v=nn(d[k]);if(v!==null&&v>=0&&v<100000){o[k]=v;n++;}});
  return n?o:null;
}
function normFinance(d){
  d=d||{};var t=nn(d.target),rd=Number(d.round),tn=normTone(d.tone);
  var o={mode:d.mode==='margin'?'margin':'markup',target:(t!==null&&t>=0&&t<100000)?t:null,round:[0,1,5,10].indexOf(rd)>-1?rd:1};
  if(tn)o.tone=tn;
  return o;
}
/* цена продажи по регионам: sell[регион] = ₽ за порцию */
function normSell(d){
  if(!d||typeof d!=='object')return null;
  var o={},n=0;
  Object.keys(d).forEach(function(k){
    var v=nn(d[k]);
    if(SELL_KEY.test(k)&&v!==null&&v>0&&n<80){o[k]=v;n++;}   /* ключ: регион или «регион:точка» (своя цена точки) */
  });
  return n?o:null;
}
function roundUp(v,step){
  if(!(step>0))return Math.ceil(v*100-1e-7)/100;
  return Math.ceil(v/step-1e-9)*step;
}
/* цена по цели: наценка = (цена − себестоимость) / себестоимость, маржинальность = (цена − себестоимость) / цена */
function priceFor(cost,mode,target,step){
  if(cost===null||!(cost>0)||target===null||!isFinite(target)||target<0)return null;
  var raw;
  if(mode==='margin'){if(target>=100)return null;raw=cost/(1-target/100);}
  else raw=cost*(1+target/100);
  return raw>0?roundUp(raw,step):null;
}
function finMetrics(cost,price){
  var o={cost:cost,price:price,profit:null,markup:null,margin:null,fc:null};
  if(cost===null||!(price>0))return o;
  o.profit=r2(price-cost);
  if(cost>0)o.markup=(price-cost)/cost*100;
  o.margin=(price-cost)/price*100;
  o.fc=cost/price*100;
  return o;
}
/* список регионов цен: основной всегда первый */
function normRegions(d){
  if(!d||!Array.isArray(d.list))return DEFAULT_REGIONS.map(function(g){return{id:g.id,name:g.name};});
  var out=[],seen={};
  d.list.forEach(function(g){
    if(!g||out.length>=8)return;
    var id=String(g.id||'').trim();
    if(!REG_ID.test(id)||seen[id])return;
    seen[id]=1;out.push({id:id,name:(id===MAIN&&String(g.name).trim()===OLD_MAIN_NAME)?DEFAULT_REGIONS[0].name:String(g.name==null?'':g.name).slice(0,60)});
  });
  if(!seen[MAIN])out.unshift({id:MAIN,name:DEFAULT_REGIONS[0].name});
  out.sort(function(a,b){return(a.id===MAIN?0:1)-(b.id===MAIN?0:1);});
  return out;
}
/* ---- сопоставление названий из ТТК с базой ---- */
var STOP={};'для во со без зам свеж свежий свежая цел вак очищ очищен раф дез пищевая пищевой из по на при кат вес фас мыт пак бум пач ведро кор бут упак'.split(' ').forEach(function(w){STOP[w]=1;});
function normKey(s){return String(s==null?'':s).toLowerCase().replace(/ё/g,'е').replace(/[^a-zа-я0-9]+/g,' ').trim();}
function stemList(s){
  var out=[],seen={};
  normKey(s).split(' ').forEach(function(t){
    if(t.length<2||STOP[t]||/^\d+$/.test(t))return;
    var st=t.slice(0,Math.max(3,Math.min(5,t.length-2)));
    if(!seen[st]){seen[st]=1;out.push(st);}
  });
  return out;
}
function matchIng(name,ings){
  var key=normKey(name),ids=Object.keys(ings),i;
  if(!key)return{id:'',how:'none',score:0};
  for(i=0;i<ids.length;i++){var a=ings[ids[i]].aliases;if(a&&a.indexOf(key)>-1)return{id:ids[i],how:'alias',score:1};}
  for(i=0;i<ids.length;i++){if(normKey(ings[ids[i]].name)===key)return{id:ids[i],how:'exact',score:1};}
  var A=stemList(name);if(!A.length)return{id:'',how:'none',score:0};
  var best='',bs=0,bc=0;
  ids.forEach(function(id){
    var B=stemList(ings[id].name);if(!B.length)return;
    var common=A.filter(function(s){return B.indexOf(s)>-1;}).length;
    /* главное слово названия (лук, яйцо, масло…) обязано встретиться в названии из базы, иначе совпадёт только прилагательное */
    if(!common||B.indexOf(A[0])<0)return;
    var dice=2*common/(A.length+B.length),cov=common/A.length;
    if(dice>bs+1e-9||(Math.abs(dice-bs)<1e-9&&cov>bc)){best=id;bs=dice;bc=cov;}
  });
  return bs>=0.5?{id:best,how:'fuzzy',score:bs}:{id:'',how:'none',score:bs};
}
/* варианты «Или …» строки состава: запасная замена на случай, если основного сырья нет; в расчёт не входят, печатаются в карте под основной строкой */
function normAlts(a){
  if(!Array.isArray(a))return[];
  return a.slice(0,6).map(function(y){
    y=y||{};var n=String(y.name||'').replace(/\s+/g,' ').trim().slice(0,200);
    if(!n)return null;
    var o={name:n};
    if(nn(y.net)!==null)o.net=num(y.net);
    if(nn(y.gross)!==null)o.gross=num(y.gross);
    return o;
  }).filter(Boolean);
}
function normRecipe(d){
  d=d||{};var r=d.ref||{};
  var o={
    name:String(d.name||''),
    output:num(d.output),
    rows:(Array.isArray(d.rows)?d.rows:[]).map(function(x){
      x=x||{};
      var o={rid:String(x.rid||uid()),ing:String(x.ing||''),net:num(x.net),share:(x.share===undefined||x.share===null)?100:num(x.share)};
      /* для генерации ТТК: брутто и название сырья так, как оно записано в карте */
      if(nn(x.gross)!==null)o.gross=num(x.gross);
      if(x.tname)o.tname=String(x.tname).slice(0,200);
      if(x.skip===true&&!o.ing)o.skip=true;        /* «Пропустить»: строка остаётся в карте, но в расчёт не входит */
      if(!x.pf&&!x.pfs){var al=normAlts(x.alts);if(al.length)o.alts=al;}
      if(x.pf&&!o.ing)o.pf=String(x.pf).slice(0,60);       /* полуфабрикат: ссылка на другую ТТК */
      if(x.pfs&&!o.ing&&!o.pf)o.pfs=String(x.pfs).slice(0,60);        /* ссылка из общей базы, карта-полуфабрикат у вас ещё не загружена */
      if((o.pf||o.pfs)&&x.pfn)o.pfn=String(x.pfn).slice(0,200);
      return o;
    }),
    ref:{label:String(r.label||''),p:nn(r.p),f:nn(r.f),c:nn(r.c),kcal:nn(r.kcal),tol:(r.tol===undefined||r.tol===null)?10:num(r.tol),basis:r.basis==='portion'?'portion':'100'},
    ttk:normTtk(d.ttk),
    op:normTtk(d.op)
  };
  if(d.pf===true||d.pf===1)o.pf=true;            /* эту ТТК можно добавлять в другие карты как полуфабрикат */
  var sl=normSell(d.sell);if(sl)o.sell=sl;
  var qt=normQty(d.qty);if(qt)o.qty=qt;
  if(Array.isArray(d.aliases)&&d.aliases.length)o.aliases=d.aliases.map(function(a){return String(a).slice(0,120);}).filter(Boolean).slice(0,20);
  if(typeof d.reg==='string'&&d.reg)o.reg=d.reg.slice(0,40);
  if(typeof d.cat==='string'&&d.cat)o.cat=d.cat.slice(0,40);
  if(d.arch===true)o.arch=true;
  return o;
}
/* поля карты (реквизиты, тексты разделов): только строки, остальное отбрасывается */
function normTtk(d){
  var o={};
  if(d&&typeof d==='object')Object.keys(d).slice(0,60).forEach(function(k){if(typeof d[k]==='string')o[k]=d[k].slice(0,6000);});
  return o;
}
/* ---- полуфабрикаты: строка рецептуры ссылается на другую ТТК (row.pf), net — сколько граммов готового полуфабриката идёт в порцию.
   Состав полуфабриката берётся пропорционально: net ÷ выход его карты. Цепочки ограничены по глубине, петли (карта внутри самой себя) отсекаются ---- */
var PF_DEPTH=5;
function pfRec(row){return(row&&row.pf)?(S.recipes[row.pf]||null):null;}
function pfBad(q,stack){return!q||!(q.output>0)||stack.indexOf(q)>-1||stack.length>=PF_DEPTH;}
function pfTitle(q){var d=String(ttkVal(q,'dish')||'').trim()||q.name||'Полуфабрикат',n=String(ttkVal(q,'num')||'').trim();return d+(n?' ТТК№'+n:'');}
/* карта src прямо или через полуфабрикаты содержит карту target */
function pfUses(src,target,seen){
  seen=seen||[];
  if(src===target)return true;
  if(seen.indexOf(src)>-1)return false;
  seen.push(src);
  return src.rows.some(function(x){var q=pfRec(x);return!!q&&pfUses(q,target,seen);});
}
/* в каких картах эта ТТК используется как полуфабрикат */
function pfUsedBy(id){return Object.keys(S.recipes).filter(function(k){return k!==id&&S.recipes[k].rows.some(function(x){return x.pf===id;});});}
/* название строки так, как оно стоит в карте: своё название строки, иначе название сырья */
function ttkRowName(w){var ig=S.ings[w.ing];return w.tname||(ig?ig.name:'—');}
/* пояснение под строкой-полуфабрикатом: из чего он состоит в этой порции */
function pfSubText(x){
  var q=pfRec(x),cr=curRecipe();
  if(!x.pf)return'';
  if(!q)return'ТТК-полуфабрикат не найдена: возможно, её удалили. Выберите другую.';
  if(cr&&pfUses(q,cr))return'Эту карту нельзя добавить: она сама содержит карту «'+(cr.name||'без названия')+'». Выберите другой полуфабрикат.';
  var f=(q.output>0&&x.net>0)?x.net/q.output:0,all=ttkRowList(q).filter(function(w){return w.net>0;}),list=all.slice(0,10);
  if(!(q.output>0))return'У карты '+pfTitle(q)+' не указан выход: состав раскрыть нельзя.';
  if(!(f>0))return'Состав из '+pfTitle(q)+' (выход '+toInput(q.output)+' г). Укажите, сколько граммов полуфабриката идёт в порцию.';
  return'Состав из '+pfTitle(q)+' (выход '+toInput(q.output)+' г), нетто: '+list.map(function(w){return(w.pf&&pfRec(w)?pfTitle(pfRec(w)):ttkRowName(w))+' '+dnum(w.net*f,2);}).join(' · ')+(all.length>list.length?' · …':'');
}
/* варианты «Или …» под строкой: название, брутто, нетто; в расчёт не входят, в карте стоят под основной строкой */
function altSubHtml(x){
  if(x.pf||x.pfs)return'';
  var ri=esc(x.rid),h='<div class="altsub">';
  (x.alts||[]).forEach(function(a,k){
    h+='<div class="altrow"><span class="alt-l">или</span>'
      +'<input class="nm" data-act="altName" data-edit data-k="'+k+'" data-fk="al:'+ri+':'+k+':n" autocomplete="off" aria-label="Вариант «Или» для строки, название" value="'+esc(a.name||'')+'" placeholder="Чем можно заменить">'
      +'<input class="num" inputmode="decimal" data-act="altGross" data-edit data-k="'+k+'" data-fk="al:'+ri+':'+k+':g" autocomplete="off" aria-label="Вариант «Или», брутто, г" value="'+((a.gross!==undefined&&a.gross!==null)?toInput(a.gross):'')+'" placeholder="брутто">'
      +'<input class="num" inputmode="decimal" data-act="altNet" data-edit data-k="'+k+'" data-fk="al:'+ri+':'+k+':t" autocomplete="off" aria-label="Вариант «Или», нетто, г" value="'+((a.net!==undefined&&a.net!==null)?toInput(a.net):'')+'" placeholder="нетто">'
      +'<button class="x" data-act="altDel" data-edit data-k="'+k+'" aria-label="Убрать вариант «Или»" title="Убрать вариант">×</button></div>';
  });
  if((x.alts||[]).length<6)h+='<button type="button" class="tlink" data-act="altAdd" data-edit title="Запасная замена этого сырья на случай, если его нет: в карте появится строка «Или …», в расчёт она не входит">+ или</button>';
  return h+'</div>';
}
function pfSubHtml(x){
  if(!x.pf)return'';
  var q=pfRec(x),cr=curRecipe(),bad=!q||!(q.output>0)||(cr&&pfUses(q,cr));
  return'<div class="pfsub'+(bad?' bad':'')+'"><span class="pfst">'+esc(pfSubText(x))+'</span>'+(q?' <button type="button" class="tlink" data-act="pfOpen" data-id="'+esc(x.pf)+'">Открыть ТТК</button>':'')+'</div>';
}
function compute(r,ings,stack){
  stack=(stack||[]).concat([r]);
  var res={p:0,f:0,c:0,eff:0,rows:{},missing:0,unassigned:0,nonet:0,est:[],unk:[],per100:null,portion:null};
  var est={},unk={};
  r.rows.forEach(function(row){
    if(row.skip&&!row.ing){res.rows[row.rid]={has:false,p:0,f:0,c:0,k:0,skip:true};return;}      /* пропущенная строка: ни КБЖУ, ни массы, ни предупреждений */
    var eff=row.net*row.share/100;
    var o={has:false,p:0,f:0,c:0,k:0};
    var ing=row.ing?ings[row.ing]:null;
    if(row.pf){
      var pq=pfRec(row);
      if(pfBad(pq,stack))res.missing++;
      else{
        var sub=compute(pq,ings,stack),pk=eff>0?eff/pq.output:0;
        o.has=true;
        if(!(row.net>0))res.nonet++;
        o.p=sub.p*pk;o.f=sub.f*pk;o.c=sub.c*pk;
        o.k=KCAL_P*o.p+KCAL_F*o.f+KCAL_C*o.c;
        res.missing+=sub.missing;res.unassigned+=sub.unassigned;
        if(pk>0){sub.est.forEach(function(n){est[n]=1;});sub.unk.forEach(function(n){unk[n]=1;});}
      }
    }
    else if(!row.ing){if(row.net>0)res.unassigned++;}
    else if(!ing){res.missing++;}
    else{
      o.has=true;
      if(!(row.net>0))res.nonet++;
      o.p=eff*ing.p/100;o.f=eff*ing.f/100;o.c=eff*ing.c/100;
      o.k=KCAL_P*o.p+KCAL_F*o.f+KCAL_C*o.c;
      if(ing.kind==='estimate'&&eff>0){est[ing.name||'без названия']=1;if(kUnknown(ing)){unk[ing.name||'без названия']=1;o.unk=true;}}
    }
    res.p+=o.p;res.f+=o.f;res.c+=o.c;res.eff+=eff;
    res.rows[row.rid]=o;
  });
  res.est=Object.keys(est);res.unk=Object.keys(unk);
  res.portion={p:res.p,f:res.f,c:res.c,k:KCAL_P*res.p+KCAL_F*res.f+KCAL_C*res.c};
  if(r.output>0){
    var m=100/r.output,p=res.p*m,f=res.f*m,c=res.c*m;
    res.per100={p:p,f:f,c:c,k:KCAL_P*p+KCAL_F*f+KCAL_C*c};
  }
  return res;
}
/* ---- сборка .docx: ТТК по шаблону ООО «Кредо» (разделы I–VII), без библиотек ---- */
var CRC_T=null;
function crc32(u8){
  if(!CRC_T){CRC_T=new Uint32Array(256);for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);CRC_T[n]=c>>>0;}}
  var crc=0xFFFFFFFF;for(var i=0;i<u8.length;i++)crc=CRC_T[(crc^u8[i])&255]^(crc>>>8);
  return(crc^0xFFFFFFFF)>>>0;
}
/* zip без сжатия: Word и LibreOffice открывают такой docx без замечаний */
function zipStore(files){
  var enc=new TextEncoder(),parts=[],cd=[],off=0;
  files.forEach(function(f){
    var nm=enc.encode(f.name),crc=crc32(f.data),sz=f.data.length;
    var lh=new Uint8Array(30+nm.length),dv=new DataView(lh.buffer);
    dv.setUint32(0,0x04034b50,true);dv.setUint16(4,20,true);dv.setUint16(6,0x0800,true);dv.setUint16(8,0,true);dv.setUint16(10,0,true);dv.setUint16(12,0x21,true);
    dv.setUint32(14,crc,true);dv.setUint32(18,sz,true);dv.setUint32(22,sz,true);dv.setUint16(26,nm.length,true);dv.setUint16(28,0,true);lh.set(nm,30);
    parts.push(lh,f.data);
    var ch=new Uint8Array(46+nm.length),cv=new DataView(ch.buffer);
    cv.setUint32(0,0x02014b50,true);cv.setUint16(4,20,true);cv.setUint16(6,20,true);cv.setUint16(8,0x0800,true);cv.setUint16(10,0,true);cv.setUint16(12,0,true);cv.setUint16(14,0x21,true);
    cv.setUint32(16,crc,true);cv.setUint32(20,sz,true);cv.setUint32(24,sz,true);cv.setUint16(28,nm.length,true);cv.setUint32(42,off,true);ch.set(nm,46);
    cd.push(ch);off+=lh.length+sz;
  });
  var cdSize=cd.reduce(function(a,c){return a+c.length;},0),end=new Uint8Array(22),ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true);ev.setUint16(8,files.length,true);ev.setUint16(10,files.length,true);ev.setUint32(12,cdSize,true);ev.setUint32(16,off,true);
  var all=parts.concat(cd,[end]),total=all.reduce(function(a,c){return a+c.length;},0),out=new Uint8Array(total),p=0;
  all.forEach(function(c){out.set(c,p);p+=c.length;});
  return out;
}
function xe(s){return String(s==null?'':s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function dnum(v,d){
  if(v===null||v===undefined||!isFinite(v))return'';
  var m=Math.pow(10,d===undefined?3:d);
  return String(Math.round(v*m)/m).replace('.',',');
}
/* текст с метками: {блюдо} → «название» жирным, {орг}, {порция}, **жирный** */
function richRuns(text,m,bold){
  var out=[];
  String(text==null?'':text).split(/(\{блюдо\}|\{орг\}|\{порция\}|\*\*[^*]+\*\*)/).forEach(function(p){
    if(!p)return;
    if(p==='{блюдо}')out.push({t:'«'+m.dish+'»',b:true});
    else if(p==='{орг}')out.push({t:m.org});
    else if(p==='{порция}')out.push({t:m.portion});
    else if(/^\*\*[^*]+\*\*$/.test(p))out.push({t:p.slice(2,-2),b:true});
    else out.push({t:p,b:!!bold});
  });
  return out;
}
function dRuns(runs){
  return runs.map(function(r){
    if(r.t==='\t')return'<w:r><w:tab/></w:r>';
    var pr=(r.b?'<w:b/><w:bCs/>':'')+(r.i?'<w:i/><w:iCs/>':'')+(r.sz?'<w:sz w:val="'+r.sz+'"/><w:szCs w:val="'+r.sz+'"/>':'')+(r.u?'<w:u w:val="single"/>':'');
    return'<w:r>'+(pr?'<w:rPr>'+pr+'</w:rPr>':'')+'<w:t xml:space="preserve">'+xe(r.t)+'</w:t></w:r>';
  }).join('');
}
function dPara(runs,o){
  o=o||{};
  var pr='';
  if(o.keepNext)pr+='<w:keepNext/>';
  if(o.tab)pr+='<w:tabs><w:tab w:val="left" w:pos="'+o.tab+'"/></w:tabs>';
  if(o.before!==undefined||o.after!==undefined)pr+='<w:spacing w:before="'+(o.before||0)+'" w:after="'+(o.after||0)+'"/>';
  if(o.left)pr+='<w:ind w:left="'+o.left+'"/>';
  if(o.al)pr+='<w:jc w:val="'+o.al+'"/>';
  return'<w:p>'+(pr?'<w:pPr>'+pr+'</w:pPr>':'')+dRuns(runs)+'</w:p>';
}
function dText(text,m,o){
  /* несколько строк — несколько абзацев */
  return String(text==null?'':text).split(/\r?\n/).filter(function(l){return l.trim()!=='';}).map(function(l){
    return dPara(richRuns(l.trim(),m),o);
  }).join('');
}
function dHead(t,sp){return dPara([{t:t,b:true}],{al:'center',keepNext:true,before:sp===undefined?80:sp,after:20});}
function dCell(w,inner,o){
  o=o||{};
  var pr='<w:tcW w:w="'+w+'" w:type="dxa"/>';
  if(o.span>1)pr+='<w:gridSpan w:val="'+o.span+'"/>';
  if(o.vm)pr+='<w:vMerge'+(o.vm==='restart'?' w:val="restart"':'')+'/>';
  pr+='<w:vAlign w:val="center"/>';
  return'<w:tc><w:tcPr>'+pr+'</w:tcPr>'+(inner||dPara([]))+'</w:tc>';
}
function dRow(cells,o){return'<w:tr><w:trPr><w:cantSplit/>'+((o&&o.header)?'<w:tblHeader/>':'')+'</w:trPr>'+cells.join('')+'</w:tr>';}
function dTable(widths,rows){
  return'<w:tbl><w:tblPr><w:tblStyle w:val="TableGrid"/><w:tblW w:w="'+widths.reduce(function(a,b){return a+b;},0)+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>'
    +'<w:tblGrid>'+widths.map(function(w){return'<w:gridCol w:w="'+w+'"/>';}).join('')+'</w:tblGrid>'+rows.join('')+'</w:tbl>';
}
function dCtr(t,b){return dPara([{t:t,b:b}],{al:'center'});}
/* «1. текст» / уже пронумерованные строки остаются как есть, номер выделяется жирным */
function dSteps(text,prefix,m){
  var n=0,last='',lines=String(text==null?'':text).split(/\r?\n/).filter(function(l){return l.trim()!=='';}).map(function(l){return l.trim();});
  var numRe=/^(\d+(?:\.\d+)*\.?)\s+(.*)$/;
  var manual=lines.some(function(l){return numRe.test(l);});
  return lines.map(function(l){
    /* \u0001 — заголовок блока полуфабриката без номера, \u0002 — его пункт: нумерация продолжается с последнего номера */
    if(l.charAt(0)==='\u0001')return dPara([{t:l.slice(1),b:true}],{al:'both',before:60,keepNext:true});
    if(l.charAt(0)==='\u0002'){
      n++;
      var pn=prefix+'.'+n+'.';
      if(last){var pp=String(last).replace(/\.$/,'').split('.');pp[pp.length-1]=String(n);pn=pp.join('.')+'.';}      /* свои пункты нумеровали вручную: продолжаем в том же виде */
      return dPara([{t:pn+' ',b:true}].concat(richRuns(l.slice(1),m)),{al:'both'});
    }
    var mm=numRe.exec(l),num,body;
    if(mm){num=mm[1];body=mm[2];last=num;var sg=Number(String(num).replace(/\.$/,'').split('.').pop());if(isFinite(sg))n=sg;}
    else if(manual){return dPara(richRuns(l,m),{al:'both'});}
    else{n++;num=prefix+'.'+n+'.';body=l;}
    return dPara([{t:num+' ',b:true}].concat(richRuns(body,m)),{al:'both'});
  }).join('');
}
var DOC_W=10466;
function ttkDocXml(m){
  var J={al:'both'},b=[];
  /* шапка «УТВЕРЖДАЮ» в правой части листа */
  var L=6200;
  b.push(dPara([{t:'УТВЕРЖДАЮ:'}],{left:L}));
  b.push(dPara([{t:((m.head&&m.org&&m.head.indexOf(m.org)>-1)?m.head:((m.head?m.head+' ':'')+m.org)).trim()}],{left:L}));
  if(m.headName)b.push(dPara([{t:m.headName}],{left:L}));
  b.push(dPara([{t:'________________________'}],{left:L,after:60}));
  b.push(dPara([{t:m.date||'«____» ____________ 20__г.'}],{left:L,after:120}));
  b.push(dPara([{t:'ТЕХНИКО-ТЕХНОЛОГИЧЕСКАЯ КАРТА № '+m.num,b:true}],{al:'center',after:0}));
  b.push(dPara([{t:'Наименование блюда: '},{t:'«'+m.dish+'» '+m.portion,b:true}],{al:'center',after:40}));
  b.push(dHead('I. Область применения'));
  b.push(dText(m.texts.scope,m,J));
  b.push(dHead('II. Требования к сырью'));
  [['2.1.',m.texts.r21],['2.2.',m.texts.r22],['2.3.',m.texts.r23]].forEach(function(x){
    if(String(x[1]||'').trim())b.push(dPara([{t:x[0]+' '}].concat(richRuns(String(x[1]).replace(/\s*\n\s*/g,' '),m)),J));
  });
  /* III. Рецептура */
  b.push(dHead('III. Рецептура'));
  b.push(dPara([{t:'Рецептура блюда: ',b:true},{t:'«'+m.dish+'» '+m.portion,b:true}],{al:'center',keepNext:true,after:40}));
  var W=[600,4166,1425,1425,1425,1425];
  var rows=[
    dRow([dCell(W[0],dCtr('№ п/п',true),{vm:'restart'}),dCell(W[1],dCtr('Наименование сырья',true),{vm:'restart'}),dCell(W[2]+W[3]+W[4]+W[5],dCtr('Расход сырья и полуфабрикатов',true),{span:4})],{header:true}),
    dRow([dCell(W[0],'',{vm:'cont'}),dCell(W[1],'',{vm:'cont'}),dCell(W[2]+W[3],dCtr('на 1 порцию '+dnum(m.out,2)+'гр.',true),{span:2}),dCell(W[4]+W[5],dCtr('на 10 порций',true),{span:2})],{header:true}),
    dRow([dCell(W[0],'',{vm:'cont'}),dCell(W[1],'',{vm:'cont'}),dCell(W[2],dCtr('Брутто, гр.',true)),dCell(W[3],dCtr('Нетто, гр.',true)),dCell(W[4],dCtr('Брутто, гр.',true)),dCell(W[5],dCtr('Нетто, гр.',true))],{header:true})
  ];
  function dataRow(n,name,gross,net){
    return dRow([dCell(W[0],dCtr(n)),dCell(W[1],dPara([{t:name}])),dCell(W[2],dCtr(gross===null?'':dnum(gross))),dCell(W[3],dCtr(net===null?'':dnum(net))),dCell(W[4],dCtr(gross===null?'':dnum(gross*10))),dCell(W[5],dCtr(net===null?'':dnum(net*10)))]);
  }
  function sumRow(name,net){
    var has=net!==null&&net!==undefined&&isFinite(net);
    return dRow([dCell(W[0],''),dCell(W[1],dPara([{t:name,b:true}])),dCell(W[2],''),dCell(W[3],dCtr(has?dnum(net):'',true)),dCell(W[4],''),dCell(W[5],dCtr(has?dnum(net*10):'',true))]);
  }
  function hdrRow(name){return dRow([dCell(W[0],''),dCell(W[1],dPara([{t:name,b:true}])),dCell(W[2],''),dCell(W[3],''),dCell(W[4],''),dCell(W[5],'')]);}
  /* строки таблицы: сырьё, заголовки полуфабрикатов («Соус «Цезарь» ТТК№1458:») и итоги; у карты без items — прежний вид из rows и subs */
  var items=m.items;
  if(!Array.isArray(items)){
    var subs=Array.isArray(m.subs)?m.subs:((m.semi&&m.semi.mass>0)?[{name:m.semi.name||'Масса полуфабриката',mass:m.semi.mass,at:Number(m.semi.after)||0}]:[]);
    items=[];
    var put=function(k){subs.forEach(function(x){if(Math.max(0,Math.min(m.rows.length,Number(x.at)||0))===k)items.push({t:'sum',name:x.name||'Итого:',mass:x.mass});});};
    put(0);
    m.rows.forEach(function(r,i){items.push({t:'row',name:r.name,gross:r.gross,net:r.net});put(i+1);});
  }
  var num=0;
  items.forEach(function(it){
    if(it.t==='row'){num++;rows.push(dataRow(String(num),it.name,it.gross,it.net));}
    else if(it.t==='alt')rows.push(dataRow('',it.name,it.gross,it.net));
    else if(it.t==='hdr')rows.push(hdrRow(it.name));
    else rows.push(sumRow(it.name||'Итого:',it.mass));
  });
  rows.push(sumRow('Выход готового блюда',m.out));
  b.push(dTable(W,rows));
  /* IV. Технология */
  b.push(dHead('IV. Технология приготовления'));
  if(String(m.texts.t41||'').trim())b.push(dPara([{t:'4.1. ',b:true}].concat(richRuns(String(m.texts.t41).replace(/\s*\n\s*/g,' '),m)),J));
  b.push(dPara([{t:'4.2. Технология приготовления:',b:true}],{keepNext:true}));
  b.push(dSteps(m.texts.t42,'4.2',m));
  /* V. Оформление */
  b.push(dHead('V. Оформление, подача, реализация и хранение'));
  [['5.1.',m.texts.s51],['5.2.',m.texts.s52],['5.3.',m.texts.s53],['5.4.',m.texts.s54]].forEach(function(x){
    if(String(x[1]||'').trim())b.push(dPara([{t:x[0]+' '}].concat(richRuns(String(x[1]).replace(/\s*\n\s*/g,' '),m)),J));
  });
  /* VI. Показатели качества */
  b.push(dHead('VI. Показатели качества и безопасности.'));
  b.push(dPara([{t:'6.1. Органолептические показатели блюда «'+m.dish+'»',b:true}],{al:'center',keepNext:true,after:40}));
  var OW=[2616,2616,2617,2617],o=m.organo||{};
  b.push(dTable(OW,[
    dRow(['Внешний вид','Цвет','Консистенция','Вкус и запах'].map(function(t,i){return dCell(OW[i],dPara([{t:t}]));})),
    dRow([o.look,o.color,o.texture,o.taste].map(function(t,i){return dCell(OW[i],dPara([{t:t||''}]));}))
  ]));
  b.push(dPara([{t:'6.2. Физико-химические показатели',b:true}],{al:'center',keepNext:true,before:60,after:20}));
  b.push(dText(m.texts.p62a,m,J));
  b.push(dText(m.texts.p62b,m,J));
  b.push(dText(m.texts.p62c,m,J));
  b.push(dPara([{t:'Выход готового блюда'},{t:'\t'},{t:dnum(m.out,2)+'гр. ± '+dnum(m.tol,2)+'гр.'}],{tab:3400}));
  b.push(dPara([{t:'Выход основного продукта'},{t:'\t'},{t:dnum(m.main,2)+'гр. ± '+dnum(m.tol,2)+'гр.'}],{tab:3400}));
  b.push(dPara([{t:'6.3. Микробиологические показатели',b:true}],{al:'center',keepNext:true,before:60,after:20}));
  b.push(dText(m.texts.m63,m,J));
  /* VII. КБЖУ */
  b.push(dHead('VII. Пищевая и энергетическая ценность блюда «'+m.dish+'» '+m.portion,60));
  var VW=[2616,2616,2617,2617],v=m.vii;
  b.push(dTable(VW,[
    dRow(['Белки, г','Жиры, г','Углеводы, г','Калорийность, ккал'].map(function(t,i){return dCell(VW[i],dCtr(t));})),
    dRow([dCell(DOC_W,dCtr(v.label,true),{span:4})]),
    dRow([v.p,v.f,v.c,v.kcal].map(function(x,i){return dCell(VW[i],dCtr(dnum(x,1)));}))
  ]));
  if(v.note)b.push(dPara([{t:v.note,i:true}],{al:'left',before:40}));
  var sect='<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';
  return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+b.join('')+sect+'</w:body></w:document>';
}
var DOC_STYLES='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
  +'<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="ru-RU" w:eastAsia="ru-RU" w:bidi="ar-SA"/></w:rPr></w:rPrDefault>'
  +'<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>'
  +'<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>'
  +'<w:style w:type="table" w:default="1" w:styleId="TableNormal"><w:name w:val="Normal Table"/><w:uiPriority w:val="99"/><w:semiHidden/><w:tblPr><w:tblInd w:w="0" w:type="dxa"/><w:tblCellMar><w:top w:w="0" w:type="dxa"/><w:left w:w="108" w:type="dxa"/><w:bottom w:w="0" w:type="dxa"/><w:right w:w="108" w:type="dxa"/></w:tblCellMar></w:tblPr></w:style>'
  +'<w:style w:type="table" w:styleId="TableGrid"><w:name w:val="Table Grid"/><w:basedOn w:val="TableNormal"/><w:uiPriority w:val="39"/><w:tblPr><w:tblBorders><w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/><w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders></w:tblPr></w:style>'
  +'</w:styles>';
function docxPack(docXml,title){
  var enc=new TextEncoder();
  var types='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>';
  var rels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>';
  var drels='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>';
  var core='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>'+xe(title)+'</dc:title></cp:coreProperties>';
  return zipStore([
    {name:'[Content_Types].xml',data:enc.encode(types)},
    {name:'_rels/.rels',data:enc.encode(rels)},
    {name:'word/document.xml',data:enc.encode(docXml)},
    {name:'word/_rels/document.xml.rels',data:enc.encode(drels)},
    {name:'word/styles.xml',data:enc.encode(DOC_STYLES)},
    {name:'docProps/core.xml',data:enc.encode(core)}
  ]);
}
function buildTtkDocx(m){return docxPack(ttkDocXml(m),'ТТК №'+m.num+' '+m.dish);}

/* ---- цены и калькуляция ---- */
/* запись о цене сырья в регионе: для основного это само сырьё, для остальных — ing.px[регион] */
function regRec(ing,region){
  if(!ing||NOPRICE)return null;
  if(!region||region===MAIN)return ing;
  return(ing.px&&ing.px[region])||null;
}
function pricePerKg(ing,region){
  var q=regRec(ing,region);
  if(!q||q.price===undefined||q.price===null)return null;
  if(q.priceUnit==='pack')return q.packG>0?q.price*1000/q.packG:null;
  return q.price;
}
/* брутто строки: введённое в карте, иначе по % потерь при холодной обработке из базы, иначе равно нетто */
function grossFor(row,ing){
  if(row.gross!==undefined&&row.gross!==null)return row.gross;
  var cold=ing&&ing.loss&&ing.loss.cold;
  return(cold>0&&cold<100)?row.net/(1-cold/100):row.net;
}
function r2(v){return Math.round(v*100+1e-7)/100;}
/* норма в кг: не меньше трёх знаков после запятой (3,850; 2,000; 0,100), четвёртый знак — только если он нужен */
function kgNum(v){
  if(v===null||v===undefined||!isFinite(v))return'';
  var t=(Math.round(v*10000)/10000).toFixed(4);
  if(t.charAt(t.length-1)==='0')t=t.slice(0,-1);
  return t.replace('.',',');
}
function money(v){
  if(v===null||v===undefined||!isFinite(v))return'';
  var s=r2(v).toFixed(2).split('.');
  return s[0].replace(/\B(?=(\d{3})+(?!\d))/g,' ')+','+s[1];
}
/* стоимость сырьевого набора: нормы на nPort порций в кг, сумма по строке округляется до копеек */
function costOf(r,ings,nPort,region,stack){
  nPort=nPort||100;
  stack=(stack||[]).concat([r]);
  var out={rows:[],sum:0,portion:0,noPrice:[],asm:[],missing:0,unassigned:0,complete:true};
  r.rows.forEach(function(row){
    if(!(row.net>0)&&!row.ing)return;
    if(row.skip&&!row.ing)return;
    if(row.pf){
      /* полуфабрикат: в стоимость идёт сырьё из его карты в доле net ÷ выход; строки возвращаются по сырью, pfrid — строка-источник */
      var pq=pfRec(row);
      if(pfBad(pq,stack)){out.missing++;out.complete=false;return;}
      var sc=costOf(pq,ings,nPort,region,stack),pf=row.net/pq.output;
      sc.rows.forEach(function(x){
        var g=x.gross*pf,kg=Math.round(g*nPort/1000*10000)/10000,it={rid:row.rid+'/'+x.rid,ing:x.ing,name:x.name,gross:g,gsrc:x.gsrc,kg:kg,price:x.price,sum:x.price===null?null:r2(kg*x.price),pfrid:row.rid,pf:row.pf};
        if(it.sum!==null){out.sum+=it.sum;out.portion+=g/1000*x.price;}
        out.rows.push(it);
      });
      sc.noPrice.forEach(function(n){if(out.noPrice.indexOf(n)<0)out.noPrice.push(n);});
      sc.asm.forEach(function(n){if(out.asm.indexOf(n)<0)out.asm.push(n);});
      out.missing+=sc.missing;out.unassigned+=sc.unassigned;
      if(!sc.complete)out.complete=false;
      return;
    }
    var ing=row.ing?ings[row.ing]:null,g=grossFor(row,ing),pk=pricePerKg(ing,region);
    if(pk!==null)pk=r2(pk);
    var kg=Math.round(g*nPort/1000*10000)/10000;
    var gsrc=(row.gross!==undefined&&row.gross!==null)?'row':((ing&&ing.loss&&ing.loss.cold>0&&ing.loss.cold<100)?'loss':'net');
    var it={rid:row.rid,ing:row.ing,name:row.tname||(ing?ing.name:''),gross:g,gsrc:gsrc,kg:kg,price:pk,sum:pk===null?null:r2(kg*pk)};
    if(!row.ing){out.unassigned++;out.complete=false;}
    else if(!ing){out.missing++;out.complete=false;}
    else if(pk===null){if(out.noPrice.indexOf(ing.name)<0)out.noPrice.push(ing.name);out.complete=false;}
    if(it.sum!==null){out.sum+=it.sum;out.portion+=g/1000*pk;}
    if(ing&&ing.densAsm&&pk!==null&&out.asm.indexOf(ing.name)<0)out.asm.push(ing.name);
    out.rows.push(it);
  });
  out.sum=r2(out.sum);
  return out;
}
/* ---- калькуляционная карточка ОП-1 (постановление Госкомстата № 132), А4 альбомная ---- */
function dTableNB(widths,rows){
  return'<w:tbl><w:tblPr><w:tblW w:w="'+widths.reduce(function(a,b){return a+b;},0)+'" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr><w:tblGrid>'+widths.map(function(w){return'<w:gridCol w:w="'+w+'"/>';}).join('')+'</w:tblGrid>'+rows.join('')+'</w:tbl>';
}
function opP(t,o){
  o=o||{};
  return dPara([{t:t,b:o.b,i:o.i,u:o.u,sz:o.sz||18}],{al:o.al||'left',before:o.before||0,after:o.after||0,left:o.left,keepNext:o.keepNext});
}
function opField(label,value,sz){
  return dPara([{t:label+' ',sz:sz||18},{t:(value&&String(value).trim())?String(value):'          ',b:true,u:true,sz:sz||18}],{al:'left',before:30,after:30});
}
function op1Xml(m){
  var W=15704,B=Math.max(1,Math.min(6,m.blocks||1)),b=[];
  var code=dTable([2700,1600],[['','Код'],['Форма по ОКУД','0330501'],['по ОКПО',m.okpo],['Вид деятельности по ОКДП',m.okdp],['Вид операции',m.opType]].map(function(x,i){
    return dRow([dCell(2700,opP(x[0],{al:'right',sz:16})),dCell(1600,opP(x[1]||'',{al:'center',sz:16}))]);
  }))+dPara([]);
  b.push(dTableNB([10300,5404],[dRow([
    dCell(10300,opP('Унифицированная форма № ОП-1',{sz:16})+opP('Утверждена постановлением Госкомстата России от 25.12.98 № 132',{sz:16})),
    dCell(5404,code)
  ])]));
  var appr=opP('УТВЕРЖДАЮ',{b:true,al:'center',before:240})
    +opP('Руководитель организации',{al:'center',before:20})
    +opP((m.head&&m.org&&m.head.indexOf(m.org)>-1)?m.head:((m.head?m.head+' ':'')+m.org),{al:'center',sz:16})
    +opP('________________  '+(m.headName||'____________'),{al:'center',before:80})
    +opP('(подпись)        (расшифровка подписи)',{al:'center',sz:14});
  b.push(dTableNB([10300,5404],[dRow([
    dCell(10300,opField('Организация',m.org)+opField('Структурное подразделение',m.unit)+opField('Наименование блюда',m.dish)+opField('Номер блюда по сборнику рецептур, ТТК, СТП',m.recNo)),
    dCell(5404,appr)
  ])]));
  b.push(opP('КАЛЬКУЛЯЦИОННАЯ КАРТОЧКА',{b:true,al:'center',sz:26,before:100,after:60}));
  b.push(dTable([2400,2400],[
    dRow([dCell(2400,opP('Номер документа',{al:'center'})),dCell(2400,opP('Дата составления',{al:'center'}))]),
    dRow([dCell(2400,opP(m.docNo,{al:'center',b:true})),dCell(2400,opP(m.docDate,{al:'center',b:true}))])
  ]).replace('<w:tblLayout','<w:jc w:val="center"/><w:tblLayout')+opP('',{sz:8}));
  /* таблица калькуляции: № | наименование | код | B блоков (норма, цена, сумма) */
  var cNum=B>3?450:700,cCode=800,cw=Math.min(1500,Math.floor((W-cNum-cCode-(B>3?2200:3000))/(3*B))),cName=W-cNum-cCode-cw*3*B,fz=B>3?14:16;
  var widths=[cNum,cName,cCode],i,k;
  for(i=0;i<3*B;i++)widths.push(cw);
  var sz=fz;
  var h1=[dCell(cNum,opP('Номер по порядку',{al:'center',sz:sz}),{vm:'restart'}),dCell(cName+cCode,opP('Продукты',{al:'center',sz:sz}),{span:2})],
      h2=[dCell(cNum,'',{vm:'cont'}),dCell(cName,opP('наименование',{al:'center',sz:sz})),dCell(cCode,opP('код',{al:'center',sz:sz}))],
      h3=[1,2,3].map(function(n,j){return dCell([cNum,cName,cCode][j],opP(String(n),{al:'center',sz:sz}));});
  for(k=0;k<B;k++){
    h1.push(dCell(cw*3,opP('Калькуляция № '+(k+1)+' от '+(k===0?(m.calcDate||'__________'):'__________'),{al:'center',sz:sz,b:k===0}),{span:3}));
    ['норма, кг','цена, руб. коп.','сумма, руб. коп.'].forEach(function(t){h2.push(dCell(cw,opP(t,{al:'center',sz:sz})));});
    for(i=0;i<3;i++)h3.push(dCell(cw,opP(String(4+k*3+i),{al:'center',sz:sz})));
  }
  var rows=[dRow(h1,{header:true}),dRow(h2,{header:true}),dRow(h3,{header:true})];
  m.rows.forEach(function(x,n){
    var cells=[dCell(cNum,opP(String(n+1),{al:'center',sz:fz})),dCell(cName,opP(x.name,{sz:fz})),dCell(cCode,opP(x.code||'',{al:'center',sz:fz}))];
    for(k=0;k<B;k++){
      if(k===0)cells.push(dCell(cw,opP(kgNum(x.kg),{al:'right',sz:fz})),dCell(cw,opP(x.price===null?'':money(x.price),{al:'right',sz:fz})),dCell(cw,opP(x.sum===null?'':money(x.sum),{al:'right',sz:fz})));
      else for(i=0;i<3;i++)cells.push(dCell(cw,opP('')));
    }
    rows.push(dRow(cells));
  });
  function tot(label,val,lbl2){
    var cells=[dCell(cNum+cName+cCode,opP(label,{b:true,al:'right',sz:fz}),{span:3})];
    for(k=0;k<B;k++){
      if(k===0)cells.push(dCell(cw,opP('Х',{al:'center',sz:fz})),dCell(cw,opP(lbl2||'Х',{al:'center',sz:fz})),dCell(cw,opP(val,{al:'right',b:true,sz:fz})));
      else for(i=0;i<3;i++)cells.push(dCell(cw,opP('')));
    }
    return dRow(cells);
  }
  rows.push(tot('Общая стоимость сырьевого набора на 100 блюд',money(m.sum)));
  rows.push(tot('Наценка '+dnum(m.markupPct,2)+' %, руб. коп.',money(m.markupRub)));
  rows.push(tot('Цена продажи блюда, руб. коп.',money(m.priceDish)));
  rows.push(tot('Выход одного блюда в готовом виде, грамм',dnum(m.out,2)));
  b.push(dTable(widths,rows).replace('</w:tblPr>','<w:tblCellMar><w:left w:w="50" w:type="dxa"/><w:right w:w="50" w:type="dxa"/></w:tblCellMar></w:tblPr>'));
  b.push(opP('',{sz:8}));
  b.push(dTableNB([7852,7852],[dRow([
    dCell(7852,opP('Заведующий производством   ________________   '+(m.prodName||'____________________'),{before:120})+opP('(подпись)                      (расшифровка подписи)',{sz:14,left:2500})),
    dCell(7852,opP('Калькуляцию составил   ________________   '+(m.authorName||'____________________'),{before:120})+opP('(подпись)                      (расшифровка подписи)',{sz:14,left:2200}))
  ])]));
  var sect='<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="567" w:right="567" w:bottom="567" w:left="567" w:header="0" w:footer="0" w:gutter="0"/></w:sectPr>';
  return'<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>'+b.join('')+sect+'</w:body></w:document>';
}
function buildOp1Docx(m){return docxPack(op1Xml(m),'ОП-1 '+m.dish);}

/* ---- ABC-анализ: продажи по блюдам, расход сырья, классы A / B / C ---- */
var DEFAULT_ABC={a:80,b:95,period:''};
/* границы классов (накопленная доля, %) и подпись периода */
function normAbc(d){
  d=d||{};var a=nn(d.a),b=nn(d.b);
  if(!(a!==null&&a>0&&a<100))a=80;
  if(!(b!==null&&b>a&&b<=100))b=Math.min(100,Math.max(95,a+1));
  return{a:a,b:b,period:String(d.period==null?'':d.period).slice(0,60)};
}
/* продано порций по регионам: qty[регион] = число порций за период */
function normQty(d){return normSell(d);}
function plural(n,f){var m=Math.abs(n)%100,k=m%10;if(m>10&&m<20)return f[2];if(k>1&&k<5)return f[1];if(k===1)return f[0];return f[2];}
function qtyNum(s){
  var t=String(s==null?'':s).replace(/[\s\u00a0]/g,'').replace(/(шт|порц|порций|пц)\.?$/i,'').replace(',','.');
  if(!/^\d+(\.\d+)?$/.test(t))return null;
  var v=Number(t);return(isFinite(v)&&v>0&&v<1e9)?v:null;
}
/* название блюда без цифр и единиц («Котлета мясная 1/100 гр.» и «Котлета мясная» дают один ключ) */
function dishKey(s){
  return normKey(s).split(' ').filter(function(t){return t&&!/^\d+(гр|г|мл|л|шт)?$/.test(t)&&!/^(гр|г|мл|л|шт|порц|порция|порции)$/.test(t);}).join(' ');
}
/* соответствие названия из учётной системы блюду из базы: синоним, точное название, название без цифр, похожее */
function matchRecipe(name,recs,fake){
  var key=normKey(name),dk=dishKey(name),ids=Object.keys(recs),i;
  if(!key)return{id:'',how:'none',score:0};
  for(i=0;i<ids.length;i++){var a=recs[ids[i]].aliases;if(a&&a.indexOf(key)>-1)return{id:ids[i],how:'alias',score:1};}
  var ex=ids.filter(function(id){return normKey(recs[id].name)===key;});
  if(ex.length===1)return{id:ex[0],how:'exact',score:1};
  if(ex.length>1)return{id:ex[0],how:'fuzzy',score:1,multi:true};
  if(dk){
    var dm=ids.filter(function(id){return dishKey(recs[id].name)===dk;});
    if(dm.length===1)return{id:dm[0],how:'exact',score:1};
    if(dm.length>1)return{id:dm[0],how:'fuzzy',score:1,multi:true};
  }
  if(!fake){fake={};ids.forEach(function(id){fake[id]={name:dishKey(recs[id].name)};});}
  var m=matchIng(dk||key,fake);
  return m.how==='fuzzy'?m:{id:'',how:'none',score:m.score};
}
var QTY_COL=/кол-?во|количеств|порц|продан|qty|count|^шт\.?$/i,SALES_HEAD=/наимен|назван|блюд|товар|номенклат|продукт|позици|кол-?во|количеств|порц|продан|qty|count/i;
/* строки таблицы продаж → [{name, qty|null}]: заголовок и «Итого» пропускаются, количество — колонка «Количество» или первое число после названия */
function parseSales(rows){
  var start=0,qc=-1,i,k,out=[];
  if(rows.length){
    var h=rows[0];
    if(!h.some(function(c){return qtyNum(c)!==null;})&&h.some(function(c){return SALES_HEAD.test(c);})){
      start=1;
      for(k=0;k<h.length;k++)if(QTY_COL.test(h[k])){qc=k;break;}
    }
  }
  for(i=start;i<rows.length;i++){
    var row=rows[i],ni=0,q=null,name;
    if(row.length>1&&qtyNum(row[0])!==null&&qtyNum(row[1])===null&&String(row[1]==null?'':row[1]).trim())ni=1;
    name=String(row[ni]==null?'':row[ni]).replace(/\s+/g,' ').trim();
    if(row.length===1){
      var mm=/^(.*?\S)\s+(\d[\d\s.,]*)$/.exec(name);
      if(mm&&qtyNum(mm[2])!==null){name=mm[1];q=qtyNum(mm[2]);}
    }else if(qc>-1&&qc!==ni)q=qtyNum(row[qc]);
    else for(k=ni+1;k<row.length;k++){var v=qtyNum(row[k]);if(v!==null){q=v;break;}}
    if(!name||/^(итого|всего)(\s|:|$)/i.test(name))continue;
    out.push({name:name,qty:q});
  }
  return out;
}
/* классы по накопленной доле, как в типовой формуле Excel: A — накопленная доля вместе с позицией не больше границы A, B — не больше границы B, остальное C.
   Первая (самая крупная) позиция всегда в A. Нулевые и убыточные позиции — класс C, в базу долей не входят. При равных значениях порядок по названию. */
function abcClassify(items,a,b){
  var arr=items.slice().sort(function(x,y){return(y.v-x.v)||String(x.name||'').localeCompare(String(y.name||''),'ru');});
  var total=0,cum=0,cnt={A:0,B:0,C:0},sh={A:0,B:0,C:0};
  arr.forEach(function(x){if(x.v>0)total+=x.v;});
  arr.forEach(function(x,i){
    x.rank=i+1;
    if(!(x.v>0)||!(total>0)){x.share=0;x.cum=total>0?cum/total*100:0;x.cls='C';}
    else{
      var first=cum<=0;
      cum+=x.v;x.share=x.v/total*100;x.cum=cum/total*100;
      x.cls=(first||x.cum<=a+1e-9)?'A':(x.cum<=b+1e-9?'B':'C');
    }
    cnt[x.cls]++;sh[x.cls]+=x.share;
  });
  return{rows:arr,total:total,counts:cnt,shares:sh};
}
/* ABC блюд региона по выручке, валовой прибыли (выручка − сырьё) или числу порций */
function abcDishes(recs,ings,region,metric,a,b){
  var items=[],skipped=[],tot={qty:0,rev:0,profit:0,nAll:0,nQty:0,nRev:0,nProfit:0};
  Object.keys(recs).forEach(function(id){
    var r=recs[id],q=(r.qty&&r.qty[region]>0)?r.qty[region]:0,price=(r.sell&&r.sell[region]>0)?r.sell[region]:null;
    var c=costOf(r,ings,100,region),has=c.rows.length>0,cost=(has&&c.sum>0)?r2(c.sum/100):null,complete=has&&c.complete&&cost!==null;
    var it={id:id,name:String(r.name||'Без названия'),qty:q,price:price,cost:cost,complete:complete,rev:null,profit:null,v:null,reason:''};
    tot.nAll++;
    if(q>0){
      tot.nQty++;tot.qty+=q;
      if(price!==null){it.rev=r2(q*price);tot.rev+=it.rev;tot.nRev++;}
      if(price!==null&&complete){it.profit=r2(q*(price-cost));tot.profit+=it.profit;tot.nProfit++;}
    }
    if(!(q>0))it.reason='noqty';
    else if(metric==='qty')it.v=q;
    else if(price===null)it.reason='noprice';
    else if(metric==='rev')it.v=it.rev;
    else if(!complete)it.reason='nocost';
    else it.v=it.profit;
    (it.reason?skipped:items).push(it);
  });
  skipped.sort(function(x,y){return x.name.localeCompare(y.name,'ru');});
  var cl=abcClassify(items,a,b);
  tot.rev=r2(tot.rev);tot.profit=r2(tot.profit);
  return{mode:'dish',metric:metric,rows:cl.rows,total:cl.total,counts:cl.counts,shares:cl.shares,skipped:skipped,tot:tot};
}
/* ABC сырья региона: расход по брутто (кг) и затраты по продажам и рецептурам блюд */
function abcRaw(recs,ings,region,metric,a,b){
  var agg={},items=[],skipped=[],nDish=0,nAll=0,unlinked=0,totKg=0,totCost=0,noPrice=[];
  Object.keys(recs).forEach(function(rid){
    var r=recs[rid],q=(r.qty&&r.qty[region]>0)?r.qty[region]:0;
    nAll++;if(!(q>0))return;
    nDish++;
    var c=costOf(r,ings,q,region),seen={};
    c.rows.forEach(function(it){
      if(!it.ing||!ings[it.ing]){unlinked++;return;}
      var x=agg[it.ing];
      if(!x)x=agg[it.ing]={id:it.ing,name:String(ings[it.ing].name||'Без названия'),kg:0,dishes:0};
      x.kg+=it.kg;
      if(!seen[it.ing]){seen[it.ing]=1;x.dishes++;}
    });
  });
  Object.keys(agg).forEach(function(id){
    var x=agg[id],ing=ings[id],pk=pricePerKg(ing,region),rec=regRec(ing,region);
    x.kg=Math.round(x.kg*10000)/10000;
    x.price=pk===null?null:r2(pk);
    x.cost=x.price===null?null:r2(x.kg*x.price);
    x.pcs=(rec&&rec.priceUnit==='pack'&&rec.packG>0)?x.kg*1000/rec.packG:null;
    totKg+=x.kg;if(x.cost!==null)totCost+=x.cost;else noPrice.push(x.name);
    x.reason='';x.v=null;
    if(metric==='cost'){if(x.cost===null)x.reason='noprice';else x.v=x.cost;}
    else x.v=x.kg;
    (x.reason?skipped:items).push(x);
  });
  skipped.sort(function(x,y){return x.name.localeCompare(y.name,'ru');});
  var cl=abcClassify(items,a,b);
  return{mode:'raw',metric:metric,rows:cl.rows,total:cl.total,counts:cl.counts,shares:cl.shares,skipped:skipped,
    tot:{kg:totKg,cost:r2(totCost),nDish:nDish,nAll:nAll,items:Object.keys(agg).length,unlinked:unlinked,noPrice:noPrice}};
}

