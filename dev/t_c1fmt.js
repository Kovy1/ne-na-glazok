/* выгрузка 1С в раскладке «Дата С / Дата по», колонки «Количество, Цена», позиция без итогового количества */
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync('kbzhu.html', 'utf8');
eval(src.slice(src.indexOf('/*PURE-START*/'), src.indexOf('/*PURE-END*/')) + ';globalThis.__a={c1Parse,c1Rows,c1Conv};');
const A = globalThis.__a;
const WH = 'столовая при Университете г. Город, ул. Мира, д.1';
const R = (...a) => a;
const base = [
  R('', '', '', '', '', '', '', ''),
  R('Параметры:', '', 'Дата С: 01.09.2026', '', '', '', '', ''),
  R('', '', 'Дата по: 30.09.2026', '', '', '', '', ''),
  R('Отбор:', '', 'Склад Равно "' + WH + '"', '', '', '', '', ''),
  R('', '', '', '', '', '', '', ''),
  R('Номенклатура', '', '', 'Единица измерения', '', '', '', ''),
  R('Период', '', '', 'Склад', '', 'Партнер', 'Количество', 'Цена'),
  R('Ананас конс ж/б -', '', '', 'кг', '', '', '', ''),
  R('04.09.2026 7:00:00', '', '', WH, '', 'Сукачев ИП', '2.55', '275.56'),
  R('15.09.2026 7:00:00', '', '', WH, '', 'Сукачев ИП', '4.25', '275.56'),
  R('Вода питьевая - - -', '', '', 'л (дм3)', '', '', '', ''),
  R('16.09.2026 7:00:00', '', '', WH, '', 'АКВА ООО', '114', '14.74'),
  R('Чизкейк 100 гр', '', '', 'шт', '', '', '', ''),
  R('08.09.2026 7:00:00', '', '', WH, '', 'АЙСБЕРГ ООО', '36', '84.17'),
];
let P = A.c1Parse(base);
assert.strictEqual(P.ok, true, JSON.stringify(P.issues)); assert.deepStrictEqual(P.issues, []);
assert.strictEqual(P.from, '2026-09-01'); assert.strictEqual(P.to, '2026-09-30'); assert.strictEqual(P.wh, WH);
assert.strictEqual(P.items.length, 3); assert.strictEqual(P.lines, 4);
const an = P.items[0];
assert.strictEqual(an.unit, 'kg'); assert.strictEqual(an.lines.length, 2);
assert.strictEqual(an.lines[0].q, 2.55); assert.strictEqual(an.lines[0].p, 275.56, 'количество и цена не перепутаны');
assert.strictEqual(an.lines[0].sup, 'Сукачев ИП'); assert.strictEqual(an.lines[0].wh, WH); assert.strictEqual(an.lines[0].d, '2026-09-04');
assert.ok(Math.abs(an.qty - 6.8) < 1e-9, 'итоговое количество считается по закупкам'); assert.strictEqual(an.warn, false);
assert.strictEqual(P.items[1].unit, 'l'); assert.strictEqual(P.items[2].unit, 'pc');
const cv = A.c1Conv(an, 0); assert.strictEqual(cv.ok, true); assert.strictEqual(cv.lines[0].pk, 275.56); assert.strictEqual(cv.lines[0].kg, 2.55);

// лишняя колонка «Сумма» после цены: числа берутся из колонок заголовка
const withSum = base.map((r, i) => i === 6 ? r.concat('Сумма') : (/^\d\d\.\d\d\.\d{4}/.test(r[0]) ? r.concat(String(Math.round(Number(r[6]) * Number(r[7]) * 100) / 100)) : r.concat('')));
P = A.c1Parse(withSum);
assert.strictEqual(P.items.length, 3); assert.strictEqual(P.items[0].lines[0].q, 2.55); assert.strictEqual(P.items[0].lines[0].p, 275.56);
assert.strictEqual(P.items[0].lines[0].sup, 'Сукачев ИП');

// вставка из Excel текстом (табуляции, пустые колонки сохраняются)
const tsv = base.map(r => r.join('\t')).join('\n');
P = A.c1Parse(A.c1Rows(tsv));
assert.strictEqual(P.items.length, 3); assert.strictEqual(P.items[0].lines[1].q, 4.25); assert.strictEqual(P.items[0].lines[1].p, 275.56); assert.strictEqual(P.from, '2026-09-01');

// без строки «Дата С/по»: период по датам закупок; частично — недостающая граница тоже
P = A.c1Parse(base.filter((r, i) => i !== 1 && i !== 2));
assert.strictEqual(P.from, '2026-09-04'); assert.strictEqual(P.to, '2026-09-16');
P = A.c1Parse(base.filter((r, i) => i !== 2));
assert.strictEqual(P.from, '2026-09-01'); assert.strictEqual(P.to, '2026-09-16');

// прежняя раскладка («Цена, Количество»; количество в заголовке позиции) разбирается как раньше
const old = [R('Параметры: Период: 01.09.2026 - 30.09.2026'), R('Номенклатура', 'Единица измерения', '', '', 'Количество'), R('Период', 'Склад', 'Партнер', 'Цена', ''),
  R('Мука', 'кг', '', '', '40,00'), R('02.09.2026', 'Склад Центр', 'Альфа ООО', '50,00', '10,00'), R('05.09.2026', 'Склад Север', 'Бета ООО', '60,00', '30,00')];
P = A.c1Parse(old);
assert.strictEqual(P.items[0].qty, 40); assert.strictEqual(P.items[0].lines[0].p, 50); assert.strictEqual(P.items[0].lines[0].q, 10); assert.strictEqual(P.items[0].lines[1].wh, 'Склад Север');
assert.strictEqual(P.items[0].warn, false);
console.log('OK t_c1fmt');
