/* Права на цены (NOPRICE): общий вид позиций без цен, сохранность своих цен, пересчёт хэшей при смене прав */
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('kbzhu.html','utf8');
const Y=(function(){eval(src.slice(src.indexOf('/*PURE-START*/'),src.indexOf('/*PURE-END*/')));return{syPlanPull,syApplyPlan,syDirty,syBatch,syCur,syRecClean,syIngClean,normIng,normRecipe,syRehash,regRec,pricePerKg,costOf,syH,setNP:v=>{NOPRICE=v;},getNP:()=>NOPRICE};})();
const mkIng=(name,o={})=>Y.normIng(Object.assign({name,p:1,f:2,c:3,kind:'table'},o));
const mkRec=(name,rows,o={})=>Y.normRecipe(Object.assign({name,output:200,rows:rows.map((r,i)=>Object.assign({rid:'r'+i,share:100},r)),ref:{},ttk:{}},o));
const R=(kind,sid,name,rev,json)=>({kind,sid,name,rev,json,by:'T',at:1});
const PK=['price','priceUnit','packG','priceSrc','px'];

// 1. очистка
const full=mkIng('Лук',{price:40,priceUnit:'pack',packG:500,priceSrc:'прайс',px:{msk:{price:50}}});
const rec=mkRec('Борщ',[{ing:'a',net:50}],{sell:{main:300,msk:330}});
Y.setNP(false);
assert.ok(PK.every(k=>Y.syIngClean(full)[k]!==undefined),'с правом цены есть');
assert.deepStrictEqual(Y.syRecClean(rec).sell,{main:300,msk:330});
assert.strictEqual(Y.regRec(full,'main'),full); assert.strictEqual(Y.pricePerKg(full,'main'),80);
Y.setNP(true);
const c=Y.syIngClean(full); PK.forEach(k=>assert.strictEqual(c[k],undefined,k)); assert.strictEqual(c.p,1); assert.strictEqual(c.name,'Лук');
assert.deepStrictEqual(Y.syRecClean(rec).sell,{main:300,msk:330},'цена продажи видна по любому коду'); assert.strictEqual(Y.syRecClean(rec).output,200);
assert.strictEqual(Y.regRec(full,'main'),null); assert.strictEqual(Y.regRec(full,'msk'),null); assert.strictEqual(Y.pricePerKg(full,'main'),null);
const co=Y.costOf(rec,{a:full},100,'main'); assert.strictEqual(co.sum,0); assert.ok(co.noPrice.length===1&&!co.complete,'стоимости нет');
assert.strictEqual(full.price,40,'сами данные не тронуты');

// 2. хэш не зависит от цен: правка цены — не «изменение»
Y.setNP(true);
let ctx={ings:{a:mkIng('Лук',{price:40})},recipes:{x:mkRec('Щи',[{ing:'a',net:50}],{sell:{main:100}})},map:{}};
let b=Y.syBatch(ctx,[{kind:'ing',id:'a'},{kind:'rec',id:'x'}]);
b.items.forEach(it=>{const j=JSON.stringify(it.json); assert.ok(!/price|packG|priceSrc|"px"/.test(j),'в пакете закупочных цен нет: '+j);});
ctx.map.ing.a.rev=1; ctx.map.ing.a.h=Y.syCur(ctx,'ing','a').h; ctx.map.rec.x.rev=2; ctx.map.rec.x.h=Y.syCur(ctx,'rec','x').h;
assert.deepStrictEqual(Y.syDirty(ctx),[]);
ctx.ings.a.price=999;   // цена продажи видна всем кодам, но редактор её не правит; закупочная цена без права не считается изменением
assert.deepStrictEqual(Y.syDirty(ctx),[],'цены без права не считаются изменением');
ctx.ings.a.p=7; assert.deepStrictEqual(Y.syDirty(ctx).map(x=>x.name),['Лук'],'КБЖУ считается');
ctx.ings.a.p=1;

// 3. получение общего без цен: свои цены остаются, позиции «совпадают»
const SA=ctx.map.ing.a.sid;
let plan=Y.syPlanPull(ctx,[R('ing',SA,'Лук',3,{name:'Лук',p:1,f:2,c:3,kind:'table'})]);
assert.strictEqual(plan[0].state,'same');
ctx.ings.a.f=5; // у вас правка КБЖУ, в общей базе новая версия: конфликт; берём общее
plan=Y.syPlanPull(ctx,[R('ing',SA,'Лук',4,{name:'Лук',p:9,f:2,c:3,kind:'table'})]);
const upd=plan[0]; assert.ok(['update','conflict'].includes(upd.state));
Y.syApplyPlan(ctx,plan,{['ing|'+SA]:'remote'});
assert.strictEqual(ctx.ings.a.p,9,'общее применено'); assert.strictEqual(ctx.ings.a.price,999,'своя цена сохранилась'); assert.strictEqual(ctx.recipes.x.sell.main,100);
// рецепт: обновление из общей базы не стирает свою цену продажи
let ctx2={ings:{a:mkIng('Лук')},recipes:{x:mkRec('Щи',[{ing:'a',net:50}],{sell:{main:100}})},map:{ing:{a:{sid:'S1',rev:1,h:''}},rec:{x:{sid:'R1',rev:1,h:''}}}};
ctx2.map.ing.a.h=Y.syCur(ctx2,'ing','a').h; ctx2.map.rec.x.h=Y.syCur(ctx2,'rec','x').h;
const rj={name:'Щи',output:250,rows:[{ing:'S1','in':'Лук',net:50,share:100}],ref:{},ttk:{}};
plan=Y.syPlanPull(ctx2,[R('rec','R1','Щи',2,rj)]); assert.strictEqual(plan[0].state,'update');
Y.syApplyPlan(ctx2,plan,{}); assert.strictEqual(ctx2.recipes.x.output,250); assert.strictEqual(ctx2.recipes.x.sell,undefined,'цена продажи берётся из общей базы: там её нет');
const rj2=Object.assign({},rj,{sell:{main:120,msk:130}});
plan=Y.syPlanPull(ctx2,[R('rec','R1','Щи',3,rj2)]); Y.syApplyPlan(ctx2,plan,{}); assert.deepStrictEqual(ctx2.recipes.x.sell,{main:120,msk:130},'опубликованная цена продажи пришла и редактору');
assert.deepStrictEqual(Y.syDirty(ctx2),[]);

// 4. смена прав: хэши сверенных позиций пересчитываются, «изменённых» не появляется
Y.setNP(false);
let ctx3={ings:{a:mkIng('Лук',{price:40}),b:mkIng('Свёкла')},recipes:{x:mkRec('Борщ',[{ing:'a',net:50}],{sell:{main:100}})},map:{}};
Y.syBatch(ctx3,[{kind:'ing',id:'a'},{kind:'ing',id:'b'},{kind:'rec',id:'x'}]);
['ing','rec'].forEach(k=>Object.keys(ctx3.map[k]).forEach(id=>{ctx3.map[k][id].rev=1;ctx3.map[k][id].h=Y.syCur(ctx3,k,id).h;}));
assert.deepStrictEqual(Y.syDirty(ctx3),[],'до смены прав всё сверено');
Y.setNP(true);
assert.ok(Y.syDirty(ctx3).length>0,'без пересчёта хэшей позиции с ценами выглядят изменёнными (ради этого пересчёт)');
Y.setNP(false);
let n=Y.syRehash(ctx3,true); assert.strictEqual(n,3,'пересчитаны все сверенные позиции'); assert.strictEqual(Y.getNP(),false,'флаг прав вернулся');
Y.setNP(true); assert.deepStrictEqual(Y.syDirty(ctx3),[],'после пересчёта в режиме без цен всё сверено');
// обратно: цены открылись
n=Y.syRehash(ctx3,false); Y.setNP(false);
assert.deepStrictEqual(Y.syDirty(ctx3),[],'после возврата прав тоже всё сверено');
// изменённое до смены прав остаётся изменённым
ctx3.ings.b.p=77; Y.syRehash(ctx3,true); Y.setNP(true);
assert.deepStrictEqual(Y.syDirty(ctx3).map(x=>x.name),['Свёкла']);
Y.setNP(false);
console.log('roles pure ok');
