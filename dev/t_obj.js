/* цены по объектам: чистая логика (идентификатор записи, склады в выгрузке, слияние периода, сравнение объектов) */
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync('kbzhu.html', 'utf8');
eval(src.slice(src.indexOf('/*PURE-START*/'), src.indexOf('/*PURE-END*/')) + ';globalThis.__a={c1Parse,c1Rows,c1Conv,phBuild,normPh,phList,phId,isPhId,phSlug,phObjName,phKey,phObjects,phMerge,phObjPeriods,phObjCompare,phObjSeries,phCsvRows,phSpendAll,phKg,phIndex};');
const A = globalThis.__a;
const eq = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-6, (m || '') + ' ' + a + ' vs ' + b);

// --- идентификатор: без объекта прежний, с объектом — хвост из букв и цифр; название склада любое
assert.strictEqual(A.phId('main', '2026-09-01', '2026-09-30'), 'ph_main_20260901_20260930');
assert.strictEqual(A.phId('main', '2026-09-01', '2026-09-30', ''), 'ph_main_20260901_20260930');
const idC = A.phId('main', '2026-09-01', '2026-09-30', 'Склад Центр');
assert.ok(/^ph_main_20260901_20260930_o[a-z0-9]{3,24}$/.test(idC), idC);
assert.ok(A.isPhId(idC) && A.isPhId('ph_main_20260901_20260930') && !A.isPhId('ph_main_20260901_20260930_x') && !A.isPhId('ph_main_20260901_20260930_o'));
assert.strictEqual(A.phId('main', '2026-09-01', '2026-09-30', '  склад   «ЦЕНТР» '), idC, 'регистр, пробелы и кавычки не важны');
assert.notStrictEqual(A.phId('main', '2026-09-01', '2026-09-30', 'Склад Север'), idC);
assert.strictEqual(A.phId('msk', '2026-09-01', '2026-09-30', 'Склад Центр').slice(0, 24), 'ph_msk_20260901_20260930');
assert.strictEqual(A.phObjName('  «Склад   Центр»  '), 'Склад Центр');
assert.strictEqual(A.phSlug(''), ''); assert.strictEqual(A.phSlug('   '), '');

// --- выгрузка: склад в строке закупки и в отборе отчёта
const rows2 = [['Период: 01.09.2026 - 30.09.2026'], ['Номенклатура', 'Единица измерения', 'Количество'], ['Период', 'Склад', 'Партнер', 'Цена'],
  ['Мука', 'кг', '', '', '40,00'],
  ['02.09.2026', 'Склад Центр', 'Альфа ООО', '50,00', '10,00'], ['05.09.2026', 'Склад Север', 'Бета ООО', '60,00', '30,00'],
  ['Сахар', 'кг', '', '', '20,00'],
  ['03.09.2026', 'Склад Север', 'Альфа ООО', '80,00', '20,00'],
  ['Итого', '', '', '', '60,00']];
const P2 = A.c1Parse(A.c1Rows(rows2.map(r => r.join('\t')).join('\n')));
assert.strictEqual(P2.ok, true, JSON.stringify(P2.issues));
assert.deepStrictEqual(P2.items[0].lines.map(l => l.wh), ['Склад Центр', 'Склад Север']);
assert.deepStrictEqual(A.c1Conv(P2.items[0], 0).lines.map(l => l.wh), ['Склад Центр', 'Склад Север'], 'склад доходит до строк пересчёта');
const rowsF = [['Период: 01.09.2026 - 30.09.2026'], ['Отбор: Склад Равно "Склад Центр"'], ['Номенклатура', 'Единица измерения', 'Количество'], ['Период', 'Партнер', 'Цена'],
  ['Мука', 'кг', '', '10,00'], ['02.09.2026', 'Альфа ООО', '50,00', '10,00']];
const PF = A.c1Parse(A.c1Rows(rowsF.map(r => r.join('\t')).join('\n')));
assert.strictEqual(PF.wh, 'Склад Центр'); assert.strictEqual(PF.items[0].lines[0].wh, '');

// --- запись на объект: строки только его склада
const byObj = (P, wh) => P.items.map(it => ({ name: it.name, unit: it.unit, qty: it.qty, lines: it.lines.filter(l => l.wh === wh) })).filter(it => it.lines.length);
const picks = i => i.map((_, k) => ({ ing: ['m', 's'][k] }));
const bC = A.phBuild(byObj(P2, 'Склад Центр'), picks(byObj(P2, 'Склад Центр')), { region: 'main', from: P2.from, to: P2.to, obj: 'Склад Центр', rule: 'avg', at: 100 });
const bS = A.phBuild(byObj(P2, 'Склад Север'), picks(byObj(P2, 'Склад Север')), { region: 'main', from: P2.from, to: P2.to, obj: 'Склад Север', rule: 'avg', at: 200, base: { m: 45 } });
assert.strictEqual(bC.obj, 'Склад Центр'); assert.strictEqual(bC.it.length, 1); eq(bC.it[0].pr, 50);
assert.strictEqual(bS.it.length, 2); eq(bS.it[0].pr, 60); eq(bS.it[0].pv, 45);
assert.deepStrictEqual(A.normPh(JSON.parse(JSON.stringify(bS))), bS, 'нормализация повторно не меняет запись');
assert.strictEqual(A.normPh({ region: 'main', from: '2026-01-01', to: '2026-01-31', it: [] }).obj, '', 'у прежних записей объекта нет');

// --- слияние периода: цена — средневзвешенная по объёму объектов, закупки складываются, поставщики без дублей
const cfg = {}; [bC, bS].forEach(b => { cfg[A.phId(b.region, b.from, b.to, b.obj)] = b; });
const old = A.normPh({ region: 'main', from: '2026-08-01', to: '2026-08-31', at: 50, sup: ['Альфа ООО'], it: [{ ing: 'm', nm: 'Мука', pr: 44, ln: [['2026-08-05', 0, 44, 10]] }] });
cfg[A.phId('main', '2026-08-01', '2026-08-31')] = old;
const list = A.phList(cfg, 'main'); assert.strictEqual(list.length, 3);
assert.deepStrictEqual(list.map(b => b.from), ['2026-08-01', '2026-09-01', '2026-09-01']);
const M = A.phMerge(list);
assert.strictEqual(M.length, 2); assert.strictEqual(M[0], old, 'период с одной записью возвращается как есть');
const m9 = M[1]; assert.strictEqual(m9.merged, true); assert.strictEqual(m9.objs.length, 2);
const mm = m9.it.find(x => x.ing === 'm');
eq(mm.pr, (50 * 10 + 60 * 30) / 40, 'мука: взвешено по кг объектов'); eq(mm.pv, 45);
assert.strictEqual(mm.ln.length, 2); assert.deepStrictEqual(m9.sup.slice().sort(), ['Альфа ООО', 'Бета ООО']);
const supOf = l => m9.sup[l[1]];
assert.deepStrictEqual(mm.ln.map(supOf).sort(), ['Альфа ООО', 'Бета ООО']);
eq(m9.it.find(x => x.ing === 's').pr, 80);
eq(A.phSpendAll(m9), A.phSpendAll(bC) + A.phSpendAll(bS), 'оборот не теряется при слиянии');
assert.strictEqual(A.phKey(bC), 'ph_main_20260901_20260930');
const ix = A.phIndex(M); eq(ix.m.pct, ((50 * 10 + 60 * 30) / 40 / 44 - 1) * 100, 'изменение к прошлому периоду — по средневзвешенной цене региона');

// --- сравнение объектов
assert.deepStrictEqual(A.phObjects(list), ['Склад Север', 'Склад Центр', ''].filter((x, i, a) => true).sort((a, c) => a === '' ? 1 : c === '' ? -1 : a < c ? -1 : 1));
const per = A.phObjPeriods(list); assert.deepStrictEqual(per.map(p => p.objs.length), [1, 2]);
const C = A.phObjCompare(list, 'ph_main_20260901_20260930');
assert.strictEqual(C.rows.length, 1, 'сравнивается сырьё, которое купили оба объекта'); assert.strictEqual(C.single, 1, 'сахар купил только один');
const r = C.rows[0]; assert.strictEqual(r.ing, 'm'); assert.strictEqual(r.best, 'Склад Центр'); assert.strictEqual(r.worst, 'Склад Север');
eq(r.spread, (60 / 50 - 1) * 100); eq(r.avg, 57.5); eq(r.saving, (60 - 50) * 30, 'экономия: Север по цене Центра');
const pc = C.per.find(q => q.obj === 'Склад Центр'), ps = C.per.find(q => q.obj === 'Склад Север');
eq(pc.over, (50 / 57.5 - 1) * 100); eq(ps.over, (60 / 57.5 - 1) * 100); eq(ps.saving, 300); eq(pc.saving, 0);
eq(ps.all, 60 * 30 + 80 * 20, 'закупки объекта за период — вся корзина'); assert.strictEqual(pc.cheapest, 1); assert.strictEqual(ps.cheapest, 0);

// --- динамика по объектам
const b2 = A.normPh({ region: 'main', from: '2026-10-01', to: '2026-10-31', obj: 'Склад Центр', at: 300, sup: ['Альфа ООО'], it: [{ ing: 'm', nm: 'Мука', pr: 55, ln: [['2026-10-04', 0, 55, 10]] }] });
cfg[A.phId('main', '2026-10-01', '2026-10-31', 'Склад Центр')] = b2;
const sr = A.phObjSeries(A.phList(cfg, 'main'), 'm');
assert.strictEqual(sr.pts.length, 3); assert.deepStrictEqual(sr.pts[2].by['Склад Центр'].pr, 55); assert.strictEqual(sr.pts[2].by['Склад Север'], undefined);
eq(sr.pts[2].reg, 55); eq(sr.pts[1].reg, 57.5); assert.deepStrictEqual(sr.objs, ['Склад Север', 'Склад Центр', ''].filter(x => x !== '' || true).sort((a, c) => a === '' ? 1 : c === '' ? -1 : a < c ? -1 : 1));

// --- CSV: объект в отдельной колонке
const csv = A.phCsvRows(A.phList(cfg, 'main'), { m: { name: 'Мука' }, s: { name: 'Сахар' } });
assert.deepStrictEqual(csv[0].slice(0, 3), ['Период', 'Объект', 'Сырьё']); assert.ok(csv.some(rw => rw[1] === 'Склад Север' && rw[2] === 'Сахар'));
console.log('OK t_obj');
