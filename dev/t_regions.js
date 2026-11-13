const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('kbzhu.html','utf8');
const pure=src.slice(src.indexOf('/*PURE-START*/'),src.indexOf('/*PURE-END*/'));
eval(pure+';globalThis.__p={normIng,normRegions,pricePerKg,regRec,costOf,DEFAULT_REGIONS};');
const P=globalThis.__p;
// normIng: основной регион на верхнем уровне, остальные в px
const i=P.normIng({name:'Лук',p:1,f:0,c:9,price:95,px:{msk:{price:130,priceSrc:'Лук реп'},main:{price:1},'bad id':{price:5},x:{}, r1:{price:'abc'}}});
assert.deepStrictEqual(i.px,{msk:{price:130,priceSrc:'Лук реп'}});
assert.strictEqual(i.price,95);
assert.strictEqual(P.pricePerKg(i),95); assert.strictEqual(P.pricePerKg(i,'main'),95); assert.strictEqual(P.pricePerKg(i,'msk'),130);
assert.strictEqual(P.pricePerKg(i,'r1'),null);
// упаковка и масса — отдельно по регионам
const e=P.normIng({name:'Яйцо',price:140.63,priceUnit:'pack',packG:550,px:{msk:{price:12,priceUnit:'pack',packG:55}}});
assert.ok(Math.abs(P.pricePerKg(e,'main')-255.69)<0.01); assert.ok(Math.abs(P.pricePerKg(e,'msk')-218.18)<0.01);
const e2=P.normIng({name:'Яйцо',price:140,priceUnit:'pack',px:{msk:{price:12,priceUnit:'pack'}}});
assert.strictEqual(P.pricePerKg(e2,'main'),null); assert.strictEqual(P.pricePerKg(e2,'msk'),null); // без массы упаковки цены за кг нет
// себестоимость по регионам
const ings={a:P.normIng({name:'Лук',price:100,px:{msk:{price:150}}}),b:P.normIng({name:'Соль',price:20})};
const r={rows:[{rid:'1',ing:'a',net:20,share:100},{rid:'2',ing:'b',net:10,share:100}]};
const cm=P.costOf(r,ings,100), cx=P.costOf(r,ings,100,'msk');
console.log('main',cm.sum,cm.complete,'msk',cx.sum,cx.complete,cx.noPrice);
assert.strictEqual(cm.sum,200+20); assert.strictEqual(cx.sum,300); assert.deepStrictEqual(cx.noPrice,['Соль']); assert.strictEqual(cx.complete,false);
// регионы
assert.deepStrictEqual(P.normRegions(undefined).map(g=>g.id),['main','msk']);
assert.deepStrictEqual(P.normRegions({list:[{id:'msk',name:'Москва'},{id:'a b',name:'x'},{id:'msk',name:'dup'}]}).map(g=>g.id+':'+g.name),['main:Волгоград','msk:Москва']);
assert.deepStrictEqual(P.normRegions({list:[{id:'msk',name:'М'},{id:'main',name:'Пермь'}]}).map(g=>g.id+':'+g.name),['main:Пермь','msk:М']);
console.log('PURE OK');
// ---- финансы
const F=require('fs').readFileSync('kbzhu.html','utf8');
eval(F.slice(F.indexOf('/*PURE-START*/'),F.indexOf('/*PURE-END*/'))+';globalThis.__f={finMetrics,priceFor,roundUp,normFinance,normSell,normRecipe};');
const Q=globalThis.__f;
const m=Q.finMetrics(17.03,35);
assert.strictEqual(m.profit,17.97); assert.ok(Math.abs(m.markup-105.5)<0.1); assert.ok(Math.abs(m.margin-51.34)<0.01); assert.ok(Math.abs(m.fc-48.66)<0.01);
assert.strictEqual(Q.finMetrics(null,35).markup,null); assert.strictEqual(Q.finMetrics(10,0).margin,null); assert.strictEqual(Q.finMetrics(0,10).markup,null);
// цена по цели
assert.strictEqual(Q.priceFor(17.03,'markup',100,1),35);          // 34.06 -> 35
assert.strictEqual(Q.priceFor(17.03,'markup',100,0),34.06);
assert.strictEqual(Q.priceFor(17.03,'margin',60,0),42.58);        // 17.03/0.4 = 42.575 -> 42.58
assert.strictEqual(Q.priceFor(17.03,'margin',60,5),45);
assert.strictEqual(Q.priceFor(17.03,'margin',100,1),null); assert.strictEqual(Q.priceFor(null,'markup',100,1),null); assert.strictEqual(Q.priceFor(0,'markup',100,1),null);
assert.strictEqual(Q.priceFor(20,'markup',100,10),40); assert.strictEqual(Q.priceFor(20,'markup',100,5),40);
// цена не падает ниже цели из-за округления
for(const c of [3.33,17.03,99.99,250.5]) for(const mode of ['markup','margin']) for(const st of [0,1,5,10]){
  const pr=Q.priceFor(c,mode,50,st), mt=Q.finMetrics(c,pr); assert.ok((mode==='markup'?mt.markup:mt.margin)>=50-1e-6,[c,mode,st,pr,mt].join());
}
assert.deepStrictEqual(Q.normFinance(undefined),{mode:'markup',target:null,round:1});
assert.deepStrictEqual(Q.normFinance({mode:'margin',target:'55',round:'5'}),{mode:'margin',target:55,round:5});
assert.deepStrictEqual(Q.normFinance({mode:'x',target:-3,round:7}),{mode:'markup',target:null,round:1});
assert.deepStrictEqual(Q.normSell({main:250,msk:'320',bad:'x','a b':5,r1:0}),{main:250,msk:320});
const rc=Q.normRecipe({name:'A',output:100,rows:[],sell:{msk:300}}); assert.deepStrictEqual(rc.sell,{msk:300});
assert.strictEqual('sell' in Q.normRecipe({name:'B',output:1,rows:[]}),false);
console.log('FIN OK');
/* прежнее название основного региона заменяется, свои названия сохраняются */
assert.deepStrictEqual(P.normRegions({list:[{id:'main',name:'Основной'},{id:'msk',name:'Москва'}]}).map(g=>g.name),['Волгоград','Москва']);
assert.deepStrictEqual(P.normRegions({list:[{id:'main',name:'Юг'},{id:'msk',name:'Основной'}]}).map(g=>g.name),['Юг','Основной']);
assert.deepStrictEqual(P.normRegions(null).map(g=>g.name),['Волгоград','Москва']);
console.log('REGION NAME OK');
