/* файлы цен региона: расчёт снимка (сырьё → себестоимость → цена продажи), журнал изменений, книга Excel, обмен со скриптом */
const fs = require('fs'), assert = require('assert'), cp = require('child_process'), os = require('os'), path = require('path');
const src = fs.readFileSync('kbzhu.html', 'utf8');
const pure = src.slice(src.indexOf('/*PURE-START*/'), src.indexOf('/*PURE-END*/'));
const Y = (function () { eval(pure + ';this.pfData=pfData;this.pfTables=pfTables;this.pfDiff=pfDiff;this.pfWithLogs=pfWithLogs;this.xlsxPack=xlsxPack;this.pfDate=pfDate;this.pfMonth=pfMonth;this.PF_H=PF_H;'); return this; }).call({});
const { createGas } = require('./sync/gasmock');

const ings = {
  i1: { name: 'Свёкла', p: 1, f: 0, c: 8, kind: 'table', source: '', price: 30, px: { msk: { price: 40, priceSrc: 'Прайс Москва' } }, priceSrc: '1С' },
  i2: { name: 'Говядина лопатка б/к с/м', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
  i3: { name: 'Яйцо куриное кат.1', p: 12, f: 11, c: 1, kind: 'table', source: '', price: 12, priceUnit: 'pack', packG: 55 },
  i4: { name: 'Соль поваренная', p: 0, f: 0, c: 0, kind: 'table', source: '' },
  i5: { name: '=ЛОЖЬ', p: 0, f: 0, c: 0, kind: 'table', source: '', price: 10 }
};
const recipes = {
  r1: { name: 'Борщ', output: 300, cat: 'c1', rows: [{ rid: 'a', ing: 'i1', net: 100, share: 50, gross: 120 }, { rid: 'b', ing: 'i2', net: 60, share: 50 }], sell: { main: 250, msk: 300 }, ttk: { num: '12' } },
  r2: { name: 'Омлет', output: 110, rows: [{ rid: 'c', ing: 'i3', net: 110, share: 100 }, { rid: 'd', ing: 'i4', net: 1, share: 0 }], sell: {}, ttk: { num: '7' } },
  r3: { name: 'Салат «Свёкла»', output: 150, cat: 'c2', rows: [{ rid: 'e', ing: 'i1', net: 150, share: 100 }], sell: { main: 120 }, ttk: {} }
};
const cats = [{ id: 'c1', name: 'Первые блюда' }, { id: 'c2', name: 'Салаты' }];
const batches = [{ region: 'main', from: '2026-09-01', to: '2026-09-30', sup: [], it: [{ ing: 'i1', nm: 'Свёкла 1С', pr: 30, pv: 28, ln: [] }] }];
const ctx = g => ({ region: g, ings, recipes, ids: ['r1', 'r2', 'r3'], cats, batches: g === 'main' ? batches : [], num: r => (r.ttk && r.ttk.num) || '' });
const AT = new Date(2026, 9, 21, 16, 40).getTime();

// ---------- расчёт ----------
const d = Y.pfData(ctx('main'));
assert.deepStrictEqual(d.dishes.map(x => x.name), ['Борщ', 'Салат «Свёкла»', 'Омлет'], 'порядок: папки меню, затем без папки');
const b = d.dishes[0];
assert.strictEqual(b.cost, 33.6, 'себестоимость: 120 г × 30 + 60 г × 500'); assert.strictEqual(b.sell, 250); assert.strictEqual(b.sec, 'Первые блюда'); assert.strictEqual(b.num, '12');
assert.ok(Math.abs(b.markup - 644.047) < 0.01 && Math.abs(b.margin - 86.56) < 0.01 && b.profit === 216.4 && Math.abs(b.fc - 13.44) < 0.01);
assert.deepStrictEqual(b.comp.map(x => [x.ing, x.gross, x.pk, x.cost]), [['Свёкла', 120, 30, 3.6], ['Говядина лопатка б/к с/м', 60, 500, 30]]);
const om = d.dishes[2]; assert.strictEqual(om.sec, 'Без раздела'); assert.strictEqual(om.complete, false, 'у соли нет цены'); assert.strictEqual(om.sell, null);
assert.strictEqual(om.cost, 24, 'яйцо в упаковке 12 ₽ за 55 г: 110 г = 24 ₽, соль без цены не добавляет ничего');
assert.deepStrictEqual(d.ings.map(x => x.name), ['Говядина лопатка б/к с/м', 'Яйцо куриное кат.1', 'Свёкла', '=ЛОЖЬ'], 'сырьё по разделам: мясо, молочные и яйца, овощи… «Прочее» последним; без цены не попадает');
const sv = d.ings.find(x => x.name === 'Свёкла'); assert.strictEqual(sv.pk, 30); assert.strictEqual(sv.per, 'сен 2026'); assert.strictEqual(sv.uses, 2); assert.ok(Math.abs(sv.pct - 7.14) < 0.01 && sv.prev === 28);
assert.strictEqual(d.ings.find(x => x.name === 'Яйцо куриное кат.1').how, '12,00 ₽ за упаковку 55 г'); assert.strictEqual(d.noPrice, 1, 'соль нужна блюду, а цены нет');
// другой регион: свои цены сырья и свои цены продажи
const dm = Y.pfData(ctx('msk'));
assert.strictEqual(dm.dishes.find(x => x.name === 'Борщ').sell, 300); assert.strictEqual(dm.ings.find(x => x.name === 'Свёкла').pk, 40);
assert.strictEqual(dm.ings.find(x => x.name === 'Свёкла').src, 'Прайс Москва'); assert.strictEqual(dm.ings.find(x => x.name === 'Говядина лопатка б/к с/м'), undefined, 'в Москве цены говядины нет');
assert.strictEqual(dm.dishes.find(x => x.name === 'Борщ').complete, false);

// ---------- таблицы ----------
const T = Y.pfTables(d, 'Волгоград', AT);
assert.deepStrictEqual(T.pub[0].head, ['Раздел', 'Блюдо', 'ТТК №', 'Выход, г', 'Цена продажи, ₽']);
assert.deepStrictEqual(T.pub[0].rows, [['Первые блюда', 'Борщ', '12', 300, 250], ['Салаты', 'Салат «Свёкла»', '', 150, 120]], 'в открытом файле только блюда с ценой продажи');
assert.ok(!/Себестоимость|Омлет|Говядина|500/.test(JSON.stringify(T.pub)), 'в открытом файле нет ни себестоимости, ни закупки, ни блюд без цены');
assert.strictEqual(T.pub[0].title, 'Цены продажи — Волгоград'); assert.ok(/21\.10\.2026 16:40/.test(T.pub[0].note));
assert.deepStrictEqual(T.prv.map(t => t.name), ['Блюда', 'Сырьё', 'Состав себестоимости', 'Изменения']);
assert.deepStrictEqual(T.prv[0].rows[0], ['Первые блюда', 'Борщ', '12', 300, 33.6, 250, 644, 86.6, 216.4, 13.4, 'полная']);
assert.strictEqual(T.prv[0].rows[2][10], 'неполная'); assert.strictEqual(T.prv[0].rows[2][5], '');
assert.deepStrictEqual(T.prv[1].rows[2], ['Овощи, грибы и зелень', 'Свёкла', 30, 'за кг (литр)', '1С', 'сен 2026', 7.1, 28, 2]);
assert.strictEqual(T.prv[2].rows.length, 5, 'состав: 2 + 2 + 1 строка'); assert.deepStrictEqual(T.prv[2].rows[0], ['Первые блюда', 'Борщ', 'Свёкла', 120, 30, 3.6]);
T.pub.concat(T.prv).forEach(t => t.rows.forEach(r => assert.strictEqual(r.length, t.head.length, t.name + ': ширина строки')));
// контрольная сумма: от данных и месяца, не от времени и не от примечаний
assert.strictEqual(Y.pfTables(d, 'Волгоград', AT + 3600e3).hash, T.hash, 'тот же месяц и данные — тот же хэш');
assert.notStrictEqual(Y.pfTables(d, 'Волгоград', new Date(2026, 10, 2).getTime()).hash, T.hash, 'новый месяц — новая копия в архив');
assert.notStrictEqual(Y.pfTables(d, 'Москва', AT).hash, T.hash, 'название региона входит в хэш');
const rc2 = JSON.parse(JSON.stringify(recipes)); rc2.r1.sell.main = 260;
assert.notStrictEqual(Y.pfTables(Y.pfData(Object.assign(ctx('main'), { recipes: rc2 })), 'Волгоград', AT).hash, T.hash, 'другая цена — другой хэш');

// ---------- Excel ----------
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pf-')), fx = path.join(dir, 'prv.xlsx'), fp = path.join(dir, 'pub.xlsx');
const xv = Buffer.from(Y.xlsxPack(T.prv)), xp = Buffer.from(Y.xlsxPack(T.pub));
fs.writeFileSync(fx, xv); fs.writeFileSync(fp, xp);
assert.strictEqual(xv[0], 80); assert.strictEqual(xv[1], 75);
const py = `
import openpyxl, json, sys
wb = openpyxl.load_workbook(sys.argv[1])
out = {'sheets': wb.sheetnames, 'freeze': [ws.freeze_panes for ws in wb], 'a1': [ws['A1'].value for ws in wb], 'head': [[c.value for c in ws[4]] for ws in wb],
       'rows': [[[c.value for c in r] for r in ws.iter_rows(min_row=5)] for ws in wb], 'fmt': [[ws.cell(5, j).number_format for j in range(1, ws.max_column + 1)] for ws in wb],
       'widths': [ws.column_dimensions['B'].width for ws in wb]}
print(json.dumps(out, ensure_ascii=False))`;
const rd = f => JSON.parse(cp.execFileSync('python3', ['-c', py, f], { encoding: 'utf8' }));
const X = rd(fx);
assert.deepStrictEqual(X.sheets, ['Блюда', 'Сырьё', 'Состав себестоимости', 'Изменения']);
assert.deepStrictEqual(X.freeze, ['A5', 'A5', 'A5', 'A5']); assert.strictEqual(X.a1[0], 'Блюда: себестоимость и цена продажи — Волгоград');
assert.deepStrictEqual(X.head[0], T.prv[0].head); assert.deepStrictEqual(X.rows[0][0], T.prv[0].rows[0], 'ячейки книги = таблица, число остаётся числом');
assert.strictEqual(X.rows[0][2][5], null, 'пустая цена продажи — пустая ячейка'); assert.deepStrictEqual(X.rows[1][3].slice(0, 3), ['Прочее', '=ЛОЖЬ', 10], '«=…» в названии остаётся текстом');
assert.deepStrictEqual(X.fmt[0].slice(3, 9), ['General', '#,##0.00', '#,##0.00', '0.0', '0.0', '#,##0.00']); assert.ok(X.widths[0] > 30);
const nz = rows => rows.map(r => r.map(v => (v === '' ? null : v)));
const XP = rd(fp); assert.deepStrictEqual(XP.sheets, ['Цены продажи', 'Изменения цен']); assert.deepStrictEqual(XP.rows[0], nz(T.pub[0].rows));
// LibreOffice открывает файл без замечаний (это же проверяет и Excel)
try {
  cp.execFileSync('soffice', ['--headless', '--convert-to', 'csv', '--outdir', dir, fp], { timeout: 120000, stdio: 'pipe' });
  const csv = fs.readFileSync(path.join(dir, 'pub.csv'), 'utf8');
  assert.ok(/Борщ/.test(csv) && /Цена продажи/.test(csv), 'LibreOffice прочитал книгу');
} catch (e) { if (e.code === 'ENOENT') console.log('soffice нет, проверка пропущена'); else throw e; }

// ---------- обмен со скриптом и журнал изменений ----------
const g = createGas();
const post = body => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef', code: 'adm-5678', by: 'Технолог' }, body)).text);
const get = (code, p) => g.parseOut(g.get(Object.assign({ code }, p))).data;
const send = (tabs, extra) => post(Object.assign({ op: 'pricesPublish', region: { id: 'main', name: 'Волгоград' }, hash: tabs.hash, pub: tabs.pub, prv: tabs.prv, xlsxPub: Buffer.from(Y.xlsxPack(tabs.pub)).toString('base64'), xlsxPrv: Buffer.from(Y.xlsxPack(tabs.prv)).toString('base64'), nDishes: tabs.n.dishes, nSold: tabs.n.sold, nIngs: tabs.n.ings }, extra || {}));
let pv = get('adm-5678', { a: 'pprev', reg: 'main' }); assert.strictEqual(pv.has, false, 'до первой записи прежнего состояния нет');
let r = send(Y.pfWithLogs(T, Y.pfDiff(d, pv, AT), pv)); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(T.changes, 0, 'первая запись: журнал пуст');
// цены меняются: свёкла 30 → 33, цена борща 250 → 260, салат снят с продажи, новое блюдо с ценой
const ings2 = JSON.parse(JSON.stringify(ings)); ings2.i1.price = 33;
const rec2 = JSON.parse(JSON.stringify(recipes)); rec2.r1.sell.main = 260; delete rec2.r3.sell.main;
rec2.r4 = { name: 'Окрошка', output: 300, rows: [{ rid: 'z', ing: 'i1', net: 100, share: 100 }], sell: { main: 180 }, ttk: {} };
const AT2 = AT + 86400e3;
const d2 = Y.pfData({ region: 'main', ings: ings2, recipes: rec2, ids: ['r1', 'r2', 'r3', 'r4'], cats, batches, num: () => '' });
const T2 = Y.pfTables(d2, 'Волгоград', AT2);
pv = get('adm-5678', { a: 'pprev', reg: 'main', h: T2.hash }); assert.strictEqual(pv.same, false); assert.ok(pv.has && pv.prv.ing.length === 4 && pv.pub.sell.length === 2);
const df = Y.pfDiff(d2, pv, AT2);
assert.deepStrictEqual(df.sell.map(x => x.slice(1)), [['Борщ', 250, 260, 4], ['Окрошка', '', 180, ''], ['Салат «Свёкла»', 120, '', '']].map(x => x), 'цены продажи: изменилась, новая, снята');
const prvLog = df.prv.map(x => x.slice(1));
assert.deepStrictEqual(prvLog.find(x => x[1] === 'Свёкла'), ['Сырьё', 'Свёкла', 'Цена, ₽/кг', 30, 33, 10]);
assert.deepStrictEqual(prvLog.find(x => x[1] === 'Борщ' && x[2].startsWith('Себест')), ['Блюдо', 'Борщ', 'Себестоимость порции, ₽', 33.6, 33.96, 1.1]);
assert.deepStrictEqual(prvLog.find(x => x[1] === 'Борщ' && x[2].startsWith('Цена')), ['Блюдо', 'Борщ', 'Цена продажи, ₽', 250, 260, 4]);
assert.ok(prvLog.some(x => x[1] === 'Окрошка' && x[2].startsWith('Себест') && x[3] === ''), 'новое блюдо: «было» пусто');
assert.ok(prvLog.some(x => x[1] === 'Салат «Свёкла»' && x[2].startsWith('Цена') && x[4] === ''), 'цену продажи сняли');
assert.ok(!prvLog.some(x => x[1] === 'Омлет'), 'то, что не менялось, в журнал не попадает');
r = send(Y.pfWithLogs(T2, df, pv)); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(T2.changes, df.sell.length + df.prv.length);
// в таблицах на Диске журнал: новые строки сверху
const bk = Object.values(g.books).find(x => x.name === 'Себестоимость и закупка — Волгоград');
const logRows = bk.sheets.find(s => s.getName() === 'Изменения')._sh.rows.slice(4);
assert.strictEqual(logRows.length, df.prv.length); assert.strictEqual(logRows[0][0], Y.pfDate(AT2));
const bp = Object.values(g.books).find(x => x.name === 'Цены продажи — Волгоград');
assert.strictEqual(bp.sheets.find(s => s.getName() === 'Изменения цен')._sh.rows.slice(4).length, 3);
// третье обновление: прежний журнал не теряется
const ings3 = JSON.parse(JSON.stringify(ings2)); ings3.i2.price = 520;
const d3 = Y.pfData({ region: 'main', ings: ings3, recipes: rec2, ids: ['r1', 'r2', 'r3', 'r4'], cats, batches, num: () => '' });
const AT3 = AT2 + 86400e3, T3 = Y.pfTables(d3, 'Волгоград', AT3), pv3 = get('adm-5678', { a: 'pprev', reg: 'main', h: T3.hash });
const df3 = Y.pfDiff(d3, pv3, AT3); r = send(Y.pfWithLogs(T3, df3, pv3)); assert.strictEqual(r.ok, true);
const log3 = bk.sheets.find(s => s.getName() === 'Изменения')._sh.rows.slice(4);
assert.strictEqual(log3.length, df3.prv.length + df.prv.length, 'старые записи остались ниже новых'); assert.strictEqual(log3[0][0], Y.pfDate(AT3)); assert.strictEqual(log3[log3.length - 1][0], Y.pfDate(AT2));
assert.ok(df3.prv.some(x => x[2] === 'Говядина лопатка б/к с/м' && x[4] === 500 && x[5] === 520));
// ничего не изменилось → скрипт отвечает «то же» и ничего не пишет
const n0 = Object.keys(g.drive.items).length, same = send(T3); assert.strictEqual(same.same, true); assert.strictEqual(Object.keys(g.drive.items).length, n0);
// по коду редактора отдаются и открытые, и закрытые Excel (как экономисту), но не ссылки на закрытые таблицы
const pr = get('ed-1234', { a: 'prices' }).regions[0]; assert.ok(pr.prv && pr.prv.x && !pr.prv.sheet);
const got = Buffer.from(get('ed-1234', { a: 'pfile', id: pr.pub.x }).b64, 'base64'); fs.writeFileSync(path.join(dir, 'got.xlsx'), got);
assert.deepStrictEqual(rd(path.join(dir, 'got.xlsx')).rows[0], nz(T3.pub[0].rows), 'скачанный редактором файл = цены продажи');
assert.strictEqual(get('ed-1234', { a: 'pfile', id: get('fin-9012', { a: 'prices' }).regions[0].prv.x }).ok, true, 'Excel себестоимости редактору отдаётся (как экономисту)');
assert.strictEqual(get('bad-code', { a: 'pfile', id: pr.prv.x }).err, 'code', 'без верного кода не отдаётся');
console.log('prices ok');
