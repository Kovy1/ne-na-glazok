/* ---------- Фудкост: расчёт баланса и отклонений ----------
   Только формулы, без случайности и без текущего времени: одинаковые данные, настройки и версия алгоритма дают одинаковый результат.
   Раздельно считаются: теоретический расход (продажи × ТТК), учётный расход (по движению товаров), фактический расход (только по
   ревизиям с фактом на начало и конец периода), документированные списания, внутреннее потребление, недостачи и излишки (из ревизий),
   необъяснённое отклонение. Недостачи входят в фактический расход и повторно к нему не прибавляются.
   Каждый показатель хранит формулу и ссылки на строки отчётов (src: [тип, ключ операции]). */
var FC_ALGO=2;
var FC_DEF={
  val:'auto',           /* оценка в рублях: auto = закупочная цена периода по поступлениям, иначе цена из базы; receipts; base */
  vatP:'',vatS:'',rate:10,vatApprox:false,   /* основа НДС закупок и выручки: with / without / '' — не задана */
  noTrans:false,        /* подтверждение пользователя: перемещений и возвратов за период не было (если в отчёте «Движение» нет их колонок) */
  retOut:true,          /* возврат в отчёте «Движение» — возврат поставщику (уменьшает остаток) */
  tolBal:0.005,         /* допуск сходимости баланса отчёта, доля */
  revTol:3,             /* дней: насколько ревизия может отстоять от границы периода */
  thr:{unexRub:3000,unexPct:5,shortRub:3000,woPct:3,woQty:5,woRub:2000,priceUp:7,priceUpKg:10,supSpread:10,supKg:5,anomHi:5,anomLo:0.2,rawShare:40,salesShare:2,calcDiff:8,outGap:10}
};
function fcCfg(){
  var c=S.fc.cfg||{},o=JSON.parse(JSON.stringify(FC_DEF));
  Object.keys(c).forEach(function(k){if(k==='thr'){Object.keys(c.thr||{}).forEach(function(t){if(isFinite(Number(c.thr[t])))o.thr[t]=Number(c.thr[t]);});}else if(o[k]!==undefined)o[k]=c[k];});
  return o;
}
function fcCfgSet(path,v){
  var c=S.fc.cfg=S.fc.cfg||{};
  if(path.indexOf('thr.')===0){c.thr=c.thr||{};c.thr[path.slice(4)]=v;}else c[path]=v;
  fcPut('cfg');
}
function fcDay(iso,n){var d=new Date(iso+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);}
function fcMoney(v){return v===null||v===undefined?'—':money(v)+' ₽';}
function fcQ(v,d){return v===null||v===undefined?'—':dnum(v,d===undefined?3:d)+' кг';}
/* ТТК: расход сырья на одну порцию (кг), с раскрытием полуфабрикатов; полнота и цена порции по базе */
function fcRecipeKg(rid,region){
  var r=S.recipes[rid],c,by={},ok;
  if(!r)return null;
  if(!(r.output>0)||!r.rows.length)return{kg:{},cost:null,ok:false,why:'нет выхода или состава'};
  c=costOf(r,S.ings,1000,region);
  c.rows.forEach(function(x){if(x.ing)by[x.ing]=(by[x.ing]||0)+x.kg/1000;});
  ok=c.complete&&!c.missing&&!c.unassigned&&!c.noPrice.length;
  return{kg:by,cost:c.sum/1000,ok:ok,why:ok?'':(c.noPrice.length?'нет цены у сырья: '+c.noPrice.slice(0,3).join(', '):'не весь состав привязан к базе'),output:r.output};
}
function fcSrc(type,o){return[type,o.id];}
function fcAdd(o,k,v){o[k]=(o[k]||0)+v;}
function fcIngOf(res,id){
  var e=res.ings[id];
  if(!e)e=res.ings[id]={id:id,name:S.ings[id]?S.ings[id].name:id,rec:{xfer:0,nXfer:0,kg:0,kgS:0,kgNoSum:0,nNoSum:0,nNoQty:0,sumNoQty:0,sum:0,sup:{},src:[]},mv:{open:0,'in':0,ret:0,tin:0,tout:0,out:0,close:0,src:[],n:0},rv:{src:[]},wo:{kg:0,src:[]},it:{kg:0,src:[]},th:{kg:0,src:[],by:{}},flags:{}};
  return e;
}
function fcCalc(obj,from,to,cfgIn,regionIn){
  fcRecIndex(true);fcRecIndex.hold=true;
  try{return fcCalc0(obj,from,to,cfgIn,regionIn);}finally{fcRecIndex.hold=false;}
}
function fcCalc0(obj,from,to,cfgIn,regionIn){
  var cfg=cfgIn||fcCfg(),region=regionIn||curRegion(),res={algo:FC_ALGO,vat:fcVatNew(),obj:obj,objName:'',from:from,to:to,region:region,cfg:cfg,ings:{},dishes:{},limits:[],unmatched:{},dens:{},flags:[],have:{},metrics:[],ver:{}},
    types=FC_TYPES_KEYS,ops={},ix,id,e;
  types.forEach(function(t){ops[t]=fcOps(t,obj,from,to);res.have[t]=ops[t].length;});
  res.ver.prices='текущие цены базы региона «'+regionName(region)+'»';res.ver.ttk='текущие версии ТТК (исторические версии не сохраняются)';
  function unm(kind,o,why){var k=kind+'|'+(o.code||normKey(o.nm));var u=res.unmatched[k]||(res.unmatched[k]={kind:kind,nm:o.nm,n:0,why:why});u.n++;}
  function ingOf(o){var m=fcMatch('i',o.nm,o.code);if(m.how==='ignore')return'';if(!m.id){unm('i',o,m.how==='fuzzy'?'не подтверждено сопоставление':'не найдено в базе');return'';}return m.id;}
  function recOf(o){var m=fcMatch('r',o.nm,o.code);if(m.how==='ignore')return'';if(!m.id){unm('r',o,m.how==='fuzzy'?'не подтверждено сопоставление':'блюдо не найдено среди ТТК');return'';}return m.id;}
  function kgOf(id,o){
    var k=fcKg(id,o.u,o.q!=null?o.q:0,region),e2;
    if(k.need==='dens'){var dd=res.dens[id]||(res.dens[id]={id:id,nm:S.ings[id]?S.ings[id].name:id,n:0});dd.n++;return null;}   /* строка вне расчёта до решения пользователя */
    if(k.flag){e2=fcIngOf(res,id);e2.flags[k.flag]=(e2.flags[k.flag]||0)+1;}
    return k.kg;
  }
  function noDens(id,o){return fcKg(id,o.u,0,region).need==='dens';}
  /* 1. поступления: поставщики, цена за кг */
  if(ops.receipts.length){
    res.recSource='отчёт «Поступления»';
    ops.receipts.forEach(function(o){
      id=ingOf(o);if(!id)return;
      if(o.q==null){                                        /* сумма есть, количества нет: цену за кг посчитать нельзя, сумму в числитель не берём */
        e=fcIngOf(res,id);e.rec.nNoQty++;if(o.s!=null)e.rec.sumNoQty+=o.s;e.rec.src.push(fcSrc('receipts',o));return;
      }
      var kg=kgOf(id,o);if(kg===null){if(!noDens(id,o))res.limits.push('Поступление «'+o.nm+'»: '+fcKg(id,o.u,o.q,region).flag+'; в расчёт цены не вошло.');return;}
      if(/перемещ/i.test(o.doc||'')){e=fcIngOf(res,id);e.rec.xfer+=kg;e.rec.nXfer++;e.rec.src.push(fcSrc('receipts',o));return;}      /* перемещение между складами — не закупка: ни в цену, ни в приход, ни в поставщиков */
      e=fcIngOf(res,id);e.rec.kg+=kg;e.rec.src.push(fcSrc('receipts',o));
      var sB=o.s!=null?fcVatLine(cfg,o,res.vat):null,sk=o.sup||'без поставщика',sp=e.rec.sup[sk]||(e.rec.sup[sk]={kg:0,sum:0});
      if(o.s!=null){e.rec.sum+=o.s;e.rec.sumB=(e.rec.sumB||0)+sB;e.rec.kgS+=kg;sp.kg+=kg;sp.sum+=o.s;}      /* цена — только по строкам с известной суммой */
      else{e.rec.kgNoSum+=kg;e.rec.nNoSum++;sp.kgNoSum=(sp.kgNoSum||0)+kg;}                                 /* неизвестная стоимость не равна нулю */
      (e.rec.rows=e.rec.rows||[]).push({d:o.d,sup:o.sup||'',kg:kg,s:o.s,pk:(o.s!=null&&kg>0)?o.s/kg:null,pkB:(sB!=null&&kg>0)?sB/kg:null,pn:fcPn(cfg,o,kg),id:o.id,src:fcSrc('receipts',o)});
    });
  }else{
    /* запасной источник: история закупок 1С по объекту (сопоставление уже сделано при загрузке цен) */
    var sl=fcObjSlug(obj),hist=phList(S.cfg,region).filter(function(b){return phSlug(phObjOf(b))===sl&&b.from<=to&&b.to>=from;});
    if(hist.length){
      res.recSource='история закупок 1С (загрузка цен по объекту)';
      res.limits.push('Отчёт «Поступления» не загружен: количества и цены закупок взяты из истории закупок 1С по объекту.');
      hist.forEach(function(b){b.it.forEach(function(it){
        if(!S.ings[it.ing])return;
        it.ln.forEach(function(l){
          if(l[0]<from||l[0]>to)return;
          var e3=fcIngOf(res,it.ing);e3.rec.kg+=l[3];e3.rec.kgS+=l[3];e3.rec.sum+=l[2]*l[3];e3.rec.sumB=(e3.rec.sumB||0)+fcVatLine(cfg,{s:l[2]*l[3]},res.vat);
          var sn=(b.sup&&b.sup[l[1]])||'без поставщика',sp=e3.rec.sup[sn]||(e3.rec.sup[sn]={kg:0,sum:0});sp.kg+=l[3];sp.sum+=l[2]*l[3];
          e3.rec.src.push(['ph',b.from+'|'+b.to+'|'+it.ing+'|'+l[0]]);
          (e3.rec.rows=e3.rec.rows||[]).push({d:l[0],sup:sn,kg:l[3],s:l[2]*l[3],pk:l[2],pn:fcPn(cfg,{s:l[2]*l[3]},l[3]),id:'ph',src:['ph',b.from+'|'+b.to+'|'+it.ing+'|'+l[0]]});
        });
      });});
    }else res.limits.push('Нет данных о поступлениях: цены закупок за период неизвестны, оценка по цене базы.');
  }
  /* 2. движение товаров: баланс отчёта */
  var mvBatches=Object.keys(S.fc.batches).map(function(k){return S.fc.batches[k];}).filter(function(b){return b.type==='moves'&&b.obj===obj&&fcOverlap(b.from,b.to,from,to);}).sort(function(a,b){return a.from<b.from?-1:1;});
  res.mvCover=null;res.mvCols={tin:false,tout:false,ret:false};
  if(mvBatches.length){
    var cf=mvBatches[0].from,ct=mvBatches[mvBatches.length-1].to;
    res.mvCover=[cf,ct];
    ['tin','tout','ret'].forEach(function(k){res.mvCols[k]=mvBatches.every(function(b){var c=b.map&&b.map[k];return typeof c==='number'&&c>=0;});});
    if(cf>from||ct<to)res.limits.push('Движение товаров покрывает '+fcIsoRu(cf)+' – '+fcIsoRu(ct)+', период анализа '+fcIsoRu(from)+' – '+fcIsoRu(to)+': расход по движению неполный.');
    for(var bi=1;bi<mvBatches.length;bi++)if(fcDay(mvBatches[bi-1].to,1)<mvBatches[bi].from)res.limits.push('В движении товаров есть разрыв между '+fcIsoRu(mvBatches[bi-1].to)+' и '+fcIsoRu(mvBatches[bi].from)+'.');
  }
  ops.moves.forEach(function(o){
    id=ingOf(o);if(!id)return;
    var f={},bad=false,dn=false;
    ['open','in','ret','tin','tout','out','close'].forEach(function(k){
      if(o[k]===undefined||o[k]===null){f[k]=0;return;}
      var kg=kgOf(id,{u:o.u,q:o[k]});if(kg===null){bad=true;if(noDens(id,o))dn=true;return;}f[k]=kg;
    });
    if(bad){if(!dn)res.limits.push('Движение «'+o.nm+'»: единица не приводится к кг (нет массы штуки/упаковки); позиция не вошла в баланс.');return;}
    e=fcIngOf(res,id);e.mv.n++;
    ['open','in','ret','tin','tout','out','close'].forEach(function(k){e.mv[k]+=f[k];});
    e.mv.src.push(fcSrc('moves',o));e.mv.has={open:o.open!=null,close:o.close!=null,out:o.out!=null};
  });
  Object.keys(res.ings).forEach(function(k){
    var m=res.ings[k].mv;if(!m.n)return;
    var retSign=cfg.retOut?-1:1;
    m.bookKg=m.open+m['in']+retSign*m.ret+m.tin-m.tout-m.close;           /* учётный расход по балансу: начало + приход ∓ возвраты ± перемещения − конец */
    if(m.has&&m.has.out){m.gap=m.out-m.bookKg;m.verified=Math.abs(m.gap)<=Math.max(0.01,cfg.tolBal*Math.max(Math.abs(m.out),Math.abs(m.open+m['in'])));}
    else m.verified=null;
  });
  /* 3. ревизии: факт на начало и конец периода, недостачи и излишки отдельно */
  var revs={};
  ops.revision.forEach(function(o){
    id=ingOf(o);if(!id)return;
    var b=o.book!=null?kgOf(id,{u:o.u,q:o.book}):null,f=o.fact!=null?kgOf(id,{u:o.u,q:o.fact}):null;
    if((o.book!=null&&b===null)||(o.fact!=null&&f===null)){if(!noDens(id,o))res.limits.push('Ревизия «'+o.nm+'»: единица не приводится к кг; позиция не вошла.');return;}
    (revs[id]=revs[id]||[]).push({d:o.d||'',book:b,fact:f,src:fcSrc('revision',o)});
  });
  Object.keys(revs).forEach(function(k){
    var L=revs[k].sort(function(a,b){return a.d<b.d?-1:1;}),e4=fcIngOf(res,k),fl=L.filter(function(x){return x.fact!==null;}),first=fl[0],last=fl[fl.length-1];
    e4.rv.list=L;
    L.forEach(function(x){
      if(x.fact===null||x.book===null)return;
      var df=x.fact-x.book;x.diff=df;
      if(df<-1e-9){e4.rv.short=(e4.rv.short||0)+(-df);}else if(df>1e-9){e4.rv.over=(e4.rv.over||0)+df;}
      e4.rv.src.push(x.src);
    });
    if(first&&last&&first.d!==last.d&&first.d<=fcDay(from,cfg.revTol)&&last.d>=fcDay(to,-cfg.revTol)){e4.rv.open=first;e4.rv.close=last;}
  });
  var anyRev=Object.keys(revs).length;
  if(anyRev&&!Object.keys(res.ings).some(function(k){return res.ings[k].rv.open;}))res.limits.push('Ревизии есть, но нет фактического пересчёта на начало и конец периода (допуск '+cfg.revTol+' дн.): фактический расход не определён, учётный остаток за факт не принят.');
  /* 4. продажи → теоретический расход; выручка */
  var rev={rev:0,disc:0,qty:0,n:0,src:[]},dishWo={};
  ops.sales.forEach(function(o){
    var rid=recOf(o);if(!rid)return;
    var d=res.dishes[rid]||(res.dishes[rid]={id:rid,name:S.recipes[rid].name,sold:0,rev:0,wo:0,woRub:0,wi:0,out:0,src:[],woSrc:[]}),q=(o.q||0)-(o.ret||0),p=fcPortions(rid,o.u||'шт',q);
    if(p===null){res.limits.push('Продажи «'+o.nm+'»: единица «'+(o.u||'не указана')+'» не приводится к порциям.');return;}
    d.sold+=p;d.rev+=(o.s||0)-(o.disc||0);d.src.push(fcSrc('sales',o));
    rev.rev+=(o.s||0)-(o.disc||0);rev.qty+=p;rev.n++;rev.src.push(fcSrc('sales',o));
  });
  res.rev=rev;
  /* 5. списания и внутреннее потребление */
  ops.writeoff.forEach(function(o){
    var isI=o.k==='i',mi=fcMatch('i',o.nm,o.code),mr=fcMatch('r',o.nm,o.code),rid,iid;
    if(mi.how==='ignore'||mr.how==='ignore')return;
    if(mi.id&&(mi.how==='exact'||mi.how==='alias'||mi.how==='map'))iid=mi.id;else if(mr.id)rid=mr.id;else{unm('i',o,mi.how==='fuzzy'?'не подтверждено сопоставление':'не найдено в базе');return;}
    if(iid){var kg=kgOf(iid,o);if(kg===null){if(!noDens(iid,o))res.limits.push('Списание «'+o.nm+'»: единица не приводится к кг.');return;}var e5=fcIngOf(res,iid),t=isI?e5.it:e5.wo;t.kg+=kg;t.src.push(fcSrc('writeoff',o));(t.rows=t.rows||[]).push({d:o.d,reason:o.reason,kg:kg,s:o.s});}
    else{
      var p=fcPortions(rid,o.u||'шт',o.q);if(p===null){res.limits.push('Списание блюда «'+o.nm+'»: единица не приводится к порциям.');return;}
      var d=res.dishes[rid]||(res.dishes[rid]={id:rid,name:S.recipes[rid].name,sold:0,rev:0,wo:0,woRub:0,wi:0,out:0,src:[],woSrc:[]});
      if(isI)d.wi+=p;else{d.wo+=p;if(o.s!=null)d.woRub+=o.s;}d.woSrc.push(fcSrc('writeoff',o));
    }
  });
  ops.output.forEach(function(o){
    var rid=recOf(o);if(!rid)return;
    var p=o.q!=null?fcPortions(rid,o.u||'шт',o.q):null;if(p===null)return;
    var d=res.dishes[rid]||(res.dishes[rid]={id:rid,name:S.recipes[rid].name,sold:0,rev:0,wo:0,woRub:0,wi:0,out:0,src:[],woSrc:[]});
    d.out+=p;(d.outSrc=d.outSrc||[]).push(fcSrc('output',o));
  });
  /* 6. теоретический расход: порции (проданные, списанные, внутреннее потребление) × расход по ТТК */
  var incomplete=[];
  Object.keys(res.dishes).forEach(function(rid){
    var d=res.dishes[rid],k=fcRecipeKg(rid,region),pSold=d.sold,pWo=d.wo,pIn=d.wi;
    d.rk=k;
    if(!k||!k.ok){incomplete.push(d.name+(k&&k.why?' ('+k.why+')':''));}
    if(!k)return;
    d.cost=k.cost;
    Object.keys(k.kg).forEach(function(ing){
      var e6=fcIngOf(res,ing);
      e6.th.kg+=k.kg[ing]*pSold;e6.th.by[rid]=(e6.th.by[rid]||0)+k.kg[ing]*pSold;
      e6.dwo=(e6.dwo||0)+k.kg[ing]*pWo;e6.din=(e6.din||0)+k.kg[ing]*pIn;       /* сырьё, ушедшее в списанные и внутренне потреблённые готовые блюда */
      if(pSold)e6.th.src=e6.th.src.concat(d.src.slice(0,50));
    });
  });
  res.thIncomplete=incomplete;
  if(incomplete.length)res.limits.push('Теоретический расход неполный: ТТК не рассчитана полностью у блюд — '+incomplete.slice(0,6).join('; ')+(incomplete.length>6?' и ещё '+(incomplete.length-6):'')+'.');
  /* 7. фактический расход, необъяснённое отклонение, деньги */
  var basis=fcBasis(cfg,res.vat),priceMode=cfg.val==='auto'?(res.recSource?'receipts':'base'):cfg.val;
  res.priceMode=priceMode;res.basis=basis;
  Object.keys(res.ings).forEach(function(k){
    var e7=res.ings[k],ing=S.ings[k],base=pricePerKg(ing,region),pr=null;
    e7.basePrice=base;
    e7.rec.partial=!!(e7.rec.kgNoSum>0||e7.rec.nNoQty>0);
    if(e7.rec.kgS>0&&e7.rec.sum>0){e7.actPriceRaw=e7.rec.sum/e7.rec.kgS;e7.actPrice=(e7.rec.sumB!=null?e7.rec.sumB:e7.rec.sum)/e7.rec.kgS;}else{e7.actPrice=null;e7.actPriceRaw=null;}       /* цена закупки периода, приведённая к основе НДС */
    pr=priceMode==='receipts'&&e7.actPrice!==null?e7.actPrice:base;
    e7.price=pr;e7.priceSrc=(priceMode==='receipts'&&e7.actPrice!==null)?(e7.rec.partial?'закупка периода (только строки с суммой)':'закупка периода'):'база (текущая цена)';
    if(e7.rec.partial)res.limits.push('Поступления «'+e7.name+'»: '+(e7.rec.kgNoSum>0?fcQ(e7.rec.kgNoSum)+' без суммы':'')+(e7.rec.kgNoSum>0&&e7.rec.nNoQty?'; ':'')+(e7.rec.nNoQty?e7.rec.nNoQty+' '+(e7.rec.nNoQty===1?'строка':'строк')+' без количества':'')+': стоимость неизвестна и не принята за ноль. '+(e7.actPriceRaw!==null?'Цена закупки '+fcSp(e7.actPriceRaw,2)+' ₽/кг посчитана только по строкам с суммой и количеством, эффект цены не определён.':'Цена закупки не определена.'));
    var m=e7.mv;
    e7.book=m.n?m.bookKg:null;
    /* фактический расход — только при ревизиях с фактом на обе границы */
    e7.actual=null;
    if(e7.rv.open&&e7.rv.close){
      var inRng=(e7.rec.rows||[]).filter(function(x){return x.d>e7.rv.open.d&&x.d<=e7.rv.close.d;}).reduce(function(a,x){return a+x.kg;},0),
        covOk=!!(m.n&&res.mvCover&&res.mvCover[0]<=fcDay(e7.rv.open.d,cfg.revTol)&&res.mvCover[1]>=fcDay(e7.rv.close.d,-cfg.revTol)),
        colsOk=!!(res.mvCols.tin&&res.mvCols.tout&&res.mvCols.ret)||!!cfg.noTrans,
        base0=e7.rv.open.fact+inRng-e7.rv.close.fact,retSg=cfg.retOut?-1:1;
      /* приход — только из «Поступлений» (не из «Движения»: там тот же приход, двойной учёт); перемещения и возвраты — только из «Движения» */
      if(covOk&&colsOk){
        var tI=res.mvCols.tin?m.tin:e7.rec.xfer,tO=res.mvCols.tout?m.tout:0,tR=res.mvCols.ret?m.ret:0;       /* колонки нет — по подтверждению пользователя ноль */
        e7.trans={tin:tI,tout:tO,ret:tR};
        e7.actual=base0+tI-tO+retSg*tR;
        e7.actualNote='остаток по ревизии на '+fcIsoRu(e7.rv.open.d)+' + поступления за период + перемещения на склад ('+fcQ(tI)+') − перемещения со склада ('+fcQ(tO)+') '+(cfg.retOut?'− возвраты поставщику':'+ возвраты')+' ('+fcQ(tR)+') − остаток по ревизии на '+fcIsoRu(e7.rv.close.d)+(cfg.noTrans&&!(res.mvCols.tin&&res.mvCols.tout&&res.mvCols.ret)?' (перемещения и возвраты, которых нет в отчёте, приняты по подтверждению пользователя: ноль, а приход по документам «перемещение» из поступлений учтён как перемещение)':'');
      }else{
        e7.actualWithout=base0;
        e7.actualNote='не определён: '+(!m.n?'по позиции нет строк в отчёте «Движение товаров», перемещения и возвраты неизвестны':(!covOk?'отчёт «Движение товаров» не покрывает период между ревизиями ('+fcIsoRu(e7.rv.open.d)+' – '+fcIsoRu(e7.rv.close.d)+')':'в отчёте «Движение товаров» нет колонок перемещений и возвратов; подтвердите в настройках, что их не было'))+'. Без них расход по ревизиям и поступлениям ('+fcQ(base0)+') мог бы быть искажён.';
        res.transMiss=(res.transMiss||[]);res.transMiss.push(e7.name);
      }
    }
    var basisKg=e7.actual!==null?e7.actual:null;
    e7.explained=e7.th.kg+(e7.dwo||0)+(e7.din||0)+e7.wo.kg+e7.it.kg;
    e7.unexpl=basisKg!==null?basisKg-e7.explained:null;
    e7.unexplRub=(e7.unexpl!==null&&pr!==null)?e7.unexpl*pr:null;
    /* учётная картина без факта: что не объяснено продажами и документами по учётному расходу — отдельная, неточная величина */
    e7.unexplBook=e7.book!==null?e7.book-e7.explained:null;
    e7.unexplBookRub=(e7.unexplBook!==null&&pr!==null)?e7.unexplBook*pr:null;
    e7.shortRub=(e7.rv.short&&pr!==null)?e7.rv.short*pr:(e7.rv.short?null:0);
    e7.overRub=(e7.rv.over&&pr!==null)?e7.rv.over*pr:(e7.rv.over?null:0);
    /* количество и цена отдельно: (факт − план) × плановая цена и (цена факта − плановая) × факт; сумма равна общей разнице */
    var cmpQ=e7.actual!==null?e7.actual:(e7.book!==null?e7.book:null);
    e7.cmpBasis=e7.actual!==null?'факт':(e7.book!==null?'учёт':'');
    if(cmpQ!==null&&e7.th.kg>0&&e7.basePrice!==null&&e7.actPriceRaw!==null&&!e7.rec.partial){
      e7.qtyEff=(cmpQ-e7.th.kg)*e7.basePrice;e7.priceEff=(e7.actPriceRaw-e7.basePrice)*cmpQ;e7.totEff=cmpQ*e7.actPriceRaw-e7.th.kg*e7.basePrice;
    }
  });
  var dk=Object.keys(res.dens);
  if(dk.length)res.limits.push('Литры без плотности: '+dk.slice(0,6).map(function(k){return res.dens[k].nm+' ('+res.dens[k].n+' стр.)';}).join(', ')+(dk.length>6?' и ещё '+(dk.length-6):'')+'. Строки в литрах (мл) не вошли в расчёт: введите плотность в карточке сырья или осознанно примите допущение «1 л = 1 кг». До этого они не входят в подтверждённый расчёт.');
  if(res.transMiss&&res.transMiss.length)res.limits.push('Фактический расход не определён из-за перемещений и возвратов ('+res.transMiss.slice(0,5).join(', ')+(res.transMiss.length>5?' и ещё '+(res.transMiss.length-5):'')+'): загрузите отчёт «Движение товаров» с колонками перемещений и возвратов за период между ревизиями или подтвердите, что их не было.');
  fcMetrics(res);
  fcExact(res);
  return res;
}
function fcObjSlug(obj){return obj;}
/* порции из количества: шт/порц — как есть; кг/г — по нормативному выходу ТТК */
function fcPortions(rid,u,q){
  if(q==null)return null;
  if(!u||u==='шт')return q;
  if(u==='кг'||u==='г'){var out=S.recipes[rid]&&S.recipes[rid].output;if(!(out>0))return null;return(u==='кг'?q*1000:q)/out;}
  return null;
}
/* НДС по строкам. Строка приводится к основе выручки:
   1) если в строке есть сумма НДС или ставка — по ним (точно);
   2) иначе по единой ставке настроек ТОЛЬКО при явном подтверждении приближения (cfg.vatApprox);
   3) иначе строка не приводится, результат помечается как неточный.
   res.vat — счётчики: n строк, same (приведение не нужно), amt (по сумме НДС), rate (по ставке строки), approx (по единой ставке), none (не приведены). */
/* цена за кг без НДС для сопоставления закупок между собой (поставщики, динамика): null, если ставка строки неизвестна при ценах с НДС */
function fcPn(cfg,o,kg){
  if(o.s==null||!(kg>0))return null;
  if(cfg.vatP==='without')return o.s/kg;
  if(cfg.vatP==='with'){
    if(o.vv!=null&&o.vv>=0)return(o.s-o.vv)/kg;
    if(o.vr!=null&&o.vr>=0)return o.s/(1+o.vr/100)/kg;
  }
  return null;
}
function fcVatNew(){return{n:0,same:0,amt:0,rate:0,approx:0,none:0};}
function fcVatLine(cfg,o,vat){
  var p=cfg.vatP,s=cfg.vatS,sum=o.s,rt=Number(cfg.rate);
  vat.n++;
  if(!p||!s){vat.none++;return sum;}
  if(p===s){vat.same++;return sum;}
  if(o.vv!=null&&o.vv>=0){vat.amt++;return p==='with'?sum-o.vv:sum+o.vv;}
  if(o.vr!=null&&o.vr>=0){vat.rate++;var kr=1+o.vr/100;return p==='with'?sum/kr:sum*kr;}
  if(cfg.vatApprox&&rt>=0&&rt===rt){vat.approx++;var ka=1+rt/100;return p==='with'?sum/ka:sum*ka;}
  vat.none++;return sum;
}
/* основа НДС: ok=false — итоговые доли и закупки приблизительные; exact — все строки приведены по их данным */
function fcBasis(cfg,vat){
  vat=vat||fcVatNew();
  var p=cfg.vatP,s=cfg.vatS,txt='',ok=true,conv=(p&&s&&p!==s),how='',parts=[];
  if(!p||!s){ok=false;txt='основа НДС закупок и/или выручки не задана: итоговые доли приблизительные';}
  else if(p===s)txt='закупки и выручка '+(p==='with'?'с НДС':'без НДС')+': приведение не нужно';
  else{
    var dir=p==='with'?'закупки с НДС приведены к цене без НДС':'закупки без НДС приведены к цене с НДС';
    if(vat.amt)parts.push('по сумме НДС строки — '+vat.amt);
    if(vat.rate)parts.push('по ставке строки — '+vat.rate);
    if(vat.approx)parts.push('по единой ставке '+cfg.rate+'% (подтверждённое приближение) — '+vat.approx);
    if(vat.none)parts.push('не приведены (нет ставки, приближение не подтверждено) — '+vat.none);
    how=parts.join('; ');
    if(vat.none){ok=false;txt=dir+' частично: '+how+'. Загрузите отчёт со ставкой или суммой НДС, выровняйте основу отчётов либо подтвердите приближение по единой ставке: итоговые доли приблизительные';}
    else if(vat.approx){ok=false;txt=dir+': '+how+'. Результат приблизительный (единая ставка — допущение, подтверждено пользователем)';}
    else txt=dir+': '+(how||'нет строк с суммами');
  }
  return{ok:ok,txt:txt,conv:conv,how:how,vat:vat};
}
/* показатели объекта: у каждого формула и ссылки на строки */
function fcMetrics(res){
  var M=res.metrics,ids=Object.keys(res.ings),sum=function(f){var v=0,any=false;ids.forEach(function(k){var x=f(res.ings[k]);if(x!==null&&x!==undefined&&x===x){v+=x;any=true;}});return any?v:null;},srcOf=function(f){var a=[];ids.forEach(function(k){f(res.ings[k]).forEach(function(x){a.push(x);});});return a;};
  function val(e,kg){return kg!==null&&e.price!==null?kg*e.price:null;}
  function add(id,label,value,unit,formula,src,note){M.push({id:id,label:label,value:value,unit:unit,formula:formula,src:src||[],note:note||''});}
  var thRub=sum(function(e){return val(e,e.th.kg);}),bookRub=sum(function(e){return e.book!==null?val(e,e.book):null;}),actRub=sum(function(e){return e.actual!==null?val(e,e.actual):null;});
  var woRub=sum(function(e){return val(e,e.wo.kg+(e.dwo||0));}),inRub=sum(function(e){return val(e,e.it.kg+(e.din||0));});
  var shortRub=sum(function(e){return e.shortRub;}),overRub=sum(function(e){return e.overRub;}),unRub=sum(function(e){return e.unexplRub;}),unBookRub=sum(function(e){return e.unexplBookRub;});
  /* полнота: итог по расходу считается полным, только если он определён по всем позициям сырья, участвующим в расчёте */
  var used=ids.filter(function(k){var e=res.ings[k];return e.th.kg>0||e.rec.kg>0||e.mv.n>0||e.rv.list;}),cov=function(f){var w=used.filter(function(k){return f(res.ings[k])!==null;}).length;return{n:w,of:used.length,full:w===used.length&&used.length>0,miss:used.filter(function(k){return f(res.ings[k])===null;}).map(function(k){return res.ings[k].name;})};};
  res.cov={act:cov(function(e){return e.actual;}),book:cov(function(e){return e.book;})};
  if(actRub!==null&&!res.cov.act.full)res.limits.push('Фактический расход определён по '+res.cov.act.n+' из '+res.cov.act.of+' позиций сырья (нет ревизий на обе границы периода: '+res.cov.act.miss.slice(0,5).join(', ')+(res.cov.act.miss.length>5?' и ещё '+(res.cov.act.miss.length-5):'')+'): фактический фудкост объекта не рассчитывается.');
  if(bookRub!==null&&!res.cov.book.full)res.limits.push('Учётный расход определён по '+res.cov.book.n+' из '+res.cov.book.of+' позиций сырья (нет движения товаров по: '+res.cov.book.miss.slice(0,5).join(', ')+(res.cov.book.miss.length>5?' и ещё '+(res.cov.book.miss.length-5):'')+'): учётный фудкост объекта не рассчитывается.');
  var recRub=sum(function(e){return e.rec.sum>0?(e.rec.sumB!=null?e.rec.sumB:e.rec.sum):null;}),recPart=ids.filter(function(k){return res.ings[k].rec.partial;}).map(function(k){return res.ings[k].name;});
  var revNet=res.rev.n?fcRevNet(res):null;
  res.revNet=revNet;
  add('th','Теоретический расход сырья (продажи × ТТК)',thRub,'₽','Σ по сырью: проданные порции × расход сырья на порцию по ТТК × цена ('+(res.priceMode==='receipts'?'закупка периода':'база')+')',srcOf(function(e){return e.th.src;}),res.thIncomplete.length?'Неполный: ТТК не рассчитана у '+res.thIncomplete.length+' блюд':'');
  add('book','Учётный расход (по движению товаров)',bookRub,'₽','Σ по сырью: начальный остаток + поступления '+(res.cfg.retOut?'− возвраты поставщику':'+ возвраты')+' ± перемещения − конечный остаток; в рублях по цене периода',srcOf(function(e){return e.mv.src;}),'Это учётные остатки, не результат пересчёта');
  add('act','Фактический расход (по ревизиям)',actRub,'₽','Остаток по ревизии на начало + поступления между ревизиями − остаток по ревизии на конец; в рублях по цене периода',srcOf(function(e){return e.rv.src;}),actRub===null?'Нет ревизий с фактом на начало и конец периода':(res.cov.act.full?'':'Частично: по '+res.cov.act.n+' из '+res.cov.act.of+' позиций сырья'));
  add('wo','Документированные списания',woRub,'₽','Σ списаний сырья + сырьё в списанных готовых блюдах (по ТТК) × цена',srcOf(function(e){return e.wo.src;}));
  add('int','Внутреннее потребление',inRub,'₽','Σ внутреннего потребления сырья + сырьё во внутренне потреблённых блюдах (по ТТК) × цена',srcOf(function(e){return e.it.src;}));
  add('short','Недостачи (ревизии)',shortRub,'₽','Σ (учёт − факт) по позициям, где факт меньше учёта; в расход уже входят и повторно не прибавляются',srcOf(function(e){return e.rv.src;}),'Показаны отдельно от излишков');
  add('over','Излишки (ревизии)',overRub,'₽','Σ (факт − учёт) по позициям, где факт больше учёта',srcOf(function(e){return e.rv.src;}),'Показаны отдельно от недостач');
  add('unex','Необъяснённое отклонение',unRub,'₽','Фактический расход − теоретический − списания − внутреннее потребление (по сырью, затем в рублях)',[],unRub===null?'Не определено: нет фактического расхода':'');
  add('unexb','Не объяснено при учётном расходе',unBookRub,'₽','Учётный расход − теоретический − списания − внутреннее потребление. Учёт не является фактом: величина ориентировочная',[],'Ориентир, не итог');
  add('rev','Выручка (с учётом скидок и возвратов)',revNet,'₽','Σ (сумма продаж − скидка) '+(res.basis.ok?'':'; '+fcVatWhy(res)),res.rev.src);
  add('rec','Закупки за период',recRub,'₽','Σ сумм поступлений'+(res.basis.conv?' (приведены к основе выручки: '+res.basis.how+')':''),srcOf(function(e){return e.rec.src;}),(res.recSource?'Источник: '+res.recSource:'')+(recPart.length?(res.recSource?'. ':'')+'Неполно: у '+recPart.length+' позиций часть поступлений без суммы или без количества ('+recPart.slice(0,4).join(', ')+'), их стоимость неизвестна и в итог не вошла':''));
  var base=revNet>0?revNet:null,note=res.basis.ok?'':res.basis.txt;
  add('fcRec','Доля сырья по рецептуре',(thRub!==null&&base)?thRub/base*100:null,'%','Теоретический расход ÷ выручка. Рецептурная доля, не фактический фудкост',[],note);
  add('fcAct','Фактический фудкост объекта',(actRub!==null&&base&&res.cov.act.full)?actRub/base*100:null,'%','Фактический расход ÷ выручка; считается, только если факт определён по всем позициям сырья',[],res.cov.act.full||actRub===null?note:'Не рассчитан: факт определён не по всем позициям');
  add('fcBook','Учётный фудкост (ориентир)',(bookRub!==null&&base&&res.cov.book.full)?bookRub/base*100:null,'%','Учётный расход ÷ выручка. Не заменяет фактический',[],note||'Ориентир: учёт без пересчёта');
  res.sums={thRub:thRub,bookRub:bookRub,actRub:actRub,woRub:woRub,inRub:inRub,shortRub:shortRub,overRub:overRub,unRub:unRub,unBookRub:unBookRub,revNet:revNet,recRub:recRub};
}
function fnum(v){return dnum(v,4);}
/* выручка: по основе НДС приводится к «без НДС», если известно */
function fcRevNet(res){
  var r=res.rev.rev,c=res.cfg;
  return r;
}
/* точность итогов: «точный» итог только если нет ограничений, влияющих на цифры */
function fcVatWhy(res){var v=res.vat||{};if(!res.cfg.vatP||!res.cfg.vatS)return'основа НДС не задана';return v.none?'часть закупок ('+v.none+' строк) не приведена к основе НДС':'НДС приведён по единой ставке (приближение): '+(v.approx||0)+' строк';}
function fcExact(res){
  var why=[];
  if(res.thIncomplete.length)why.push('теоретический расход неполный');
  if(Object.keys(res.unmatched).length)why.push('есть неподтверждённые позиции ('+Object.keys(res.unmatched).length+')');
  if(!res.basis.ok)why.push(fcVatWhy(res));
  if(res.priceMode==='base')why.push('цены периода неизвестны: оценка по текущей цене базы');
  var fl=0;Object.keys(res.ings).forEach(function(k){fl+=Object.keys(res.ings[k].flags).length;});
  if(fl)why.push('есть допущения по единицам (л→кг, масса штуки)');
  if(Object.keys(res.dens).length)why.push('строки в литрах без плотности не вошли в расчёт ('+Object.keys(res.dens).length+')');
  if(Object.keys(res.ings).some(function(k){return res.ings[k].rec.partial;}))why.push('в поступлениях есть строки без суммы или без количества');
  if(res.transMiss&&res.transMiss.length)why.push('фактический расход не определён: нет перемещений и возвратов');
  if(!res.have.sales)why.push('нет продаж');
  res.exact=!why.length;res.exactWhy=why;
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{calc:fcCalc,cfgDef:FC_DEF,slug:phSlug});}catch(e){}
/* фудкост сети: сумма затрат ÷ сумма выручки по сопоставимым объектам (не среднее процентов); остальные объекты названы с причиной */
function fcNetwork(from,to,cfgIn){
  var cfg=cfgIn||fcCfg(),rows=[],ex=[],sum={th:0,act:0,book:0,revA:0,revT:0,revB:0},modes={};
  fcObjList().forEach(function(o){
    var any=FC_TYPES_KEYS.some(function(t){return fcOps(t,o.id,from,to).length>0;});
    if(!any)return;
    var r=fcCalc(o.id,from,to,cfg),s=r.sums,row={obj:o.id,name:o.name,rev:s.revNet,th:s.thRub,act:s.actRub,book:s.bookRub,mode:r.priceMode,exact:r.exact};
    row.fcRec=(s.thRub!==null&&s.revNet>0)?s.thRub/s.revNet*100:null;row.full=r.cov.act.full;row.fcAct=(s.actRub!==null&&r.cov.act.full&&s.revNet>0)?s.actRub/s.revNet*100:null;
    rows.push(row);modes[r.priceMode]=1;
    if(!(s.revNet>0)){ex.push({name:o.name,why:'нет выручки за период'});return;}
    if(s.thRub!==null){sum.th+=s.thRub;sum.revT+=s.revNet;}
    if(s.actRub!==null&&r.cov.act.full){sum.act+=s.actRub;sum.revA+=s.revNet;}else ex.push({name:o.name,why:(s.actRub===null?'нет фактического расхода (ревизий на обе границы периода)':'фактический расход определён не по всем позициям сырья')+': в фактический фудкост сети не входит'});
  });
  rows.sort(function(a,b){return a.name<b.name?-1:(a.name>b.name?1:0);});
  return{rows:rows,excluded:ex,fcRec:sum.revT>0?sum.th/sum.revT*100:null,fcAct:sum.revA>0?sum.act/sum.revA*100:null,mixedPrices:Object.keys(modes).length>1,
    formula:'Σ затрат объектов ÷ Σ выручки тех же объектов (проценты объектов не усредняются)'};
}
try{window.kbzhuFc=Object.assign(window.kbzhuFc||{},{network:fcNetwork});}catch(e){}
