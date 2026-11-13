/* строки «Итого…» в рецептуре .docx и в таблице ТТК — итоги, а не сырьё */
const fs=require('fs'),assert=require('assert');
const src=fs.readFileSync('kbzhu.html','utf8');
const pure=src.slice(src.indexOf('/*PURE-START*/'),src.indexOf('/*PURE-END*/'));
const a=src.indexOf('function ttkNum('),b=src.indexOf('function ttkRef(');
const Y=(function(){eval(pure+src.slice(a,b)+';this.ttkRecipe=ttkRecipe;this.parseRecipeTable=typeof parseRecipeTable==="function"?parseRecipeTable:null;');return this;}).call({});
const row=(...c)=>({grid:c,cells:c.map(t=>({text:t,span:1}))});
const rows=[
  row('№','Наименование сырья','Брутто','Нетто'),
  row('','Фарш',' ',''),
  row('1.1','Говядина','30','28'),
  row('1.2','Лук репчатый','12','10'),
  row('1.3','Перец чёрный молотый','0,15','0,15'),
  row('','Итого фарша:','','50'),
  row('2.1','Томатная паста','20','20'),
  row('2.2','Сахар-песок','0,2','0,2'),
  row('2.3','Соль пищевая','2','2'),
  row('','Итого соуса:','','60'),
  row('3','Капуста белокочанная','50','40'),
  row('','Итого:','','150'),
  row('','Выход','','150'),
];
const r=Y.ttkRecipe(rows);
assert.deepStrictEqual(r.rows.map(x=>x.name),['Говядина','Лук репчатый','Перец чёрный молотый','Томатная паста','Сахар-песок','Соль пищевая','Капуста белокочанная'],'итоги не попали в сырьё');
assert.strictEqual(r.output,150); assert.strictEqual(r.skipped.length,0);
assert.deepStrictEqual(r.totals.map(x=>x.name),['Итого фарша:','Итого соуса:','Итого:']);
assert.deepStrictEqual(r.totals.map(x=>x.mass),[50,60,150]);
assert.deepStrictEqual(r.subs.map(x=>[x.name,x.mass,x.at]),[['Итого фарша:',50,3],['Итого соуса:',60,6],['Итого:',150,7]],'итоги с местом в рецептуре');
assert.deepStrictEqual(r.subs.map(x=>x.seq),[0,1,2]);
// масса полуфабриката и «Выход …» тоже остаются строками карты, в порядке появления
const r3=Y.ttkRecipe([row('№','Наименование','Брутто','Нетто'),row('1','Кости','60','60'),row('','Выход бульона','','200'),row('2','Картофель','70','50'),row('','Итого:','','50'),row('','Выход','','250')]);
assert.deepStrictEqual(r3.subs.map(x=>[x.name,x.mass,x.at,x.seq]),[['Выход бульона',200,1,0],['Итого:',50,2,1]]);
assert.strictEqual(r3.output,250);
assert.ok(Math.abs(r.totals[0].sum-38.15)<1e-9,'сумма группы '+r.totals[0].sum);
assert.ok(Math.abs(r.totals[1].sum-22.2)<1e-9);
assert.ok(Math.abs(r.totals[2].sum-100.35)<1e-9,'общая сумма '+r.totals[2].sum);
// «Итого» без нетто, но с брутто и без двоеточия; «Всего»; слово «Итоговый» итогом не считается
const r2=Y.ttkRecipe([row('№','Наименование','Брутто','Нетто'),row('1','Мука','100','100'),row('','Итого','','100'),row('','Всего:','110',''),row('2','Итоговый соус','5','5'),row('','Выход','','105')]);
assert.deepStrictEqual(r2.rows.map(x=>x.name),['Мука','Итоговый соус']);
assert.strictEqual(r2.totals.length,2); assert.strictEqual(r2.totals[1].mass,110);
// таблица ТТК по ссылке: «Итого» в колонке сырья пропускается
assert.ok(Y.parseRecipeTable,'parseRecipeTable найден');
if(Y.parseRecipeTable){
  const t=Y.parseRecipeTable([['Блюдо','Сырьё','Нетто'],['Голубцы','Говядина','28'],['','Итого фарша:','50'],['','Итого:','150'],['','Капуста','40']]);
  assert.strictEqual(t.dishes[0].lines.length,2,'в таблице тоже');
  assert.deepStrictEqual(t.dishes[0].subs.map(x=>[x.name,x.mass,x.at]),[['Итого фарша:',50,1],['Итого:',150,1]],'итоги из таблицы'); assert.strictEqual(t.skipped.length,0);
}
console.log('TOTALS OK');
