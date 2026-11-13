/* Файлы цен по регионам: папки на Диске, Google Таблицы и Excel, архив по месяцам, доступ по ролям */
const assert = require('assert'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012', V = 'view-3456';
function mk(opts) {
  const g = createGas(opts || {});
  const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
  const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
  return { g, get, post };
}
const xl = tag => Buffer.concat([Buffer.from('PK'), Buffer.alloc(300, tag.charCodeAt(0))]).toString('base64');
const pubTables = rows => [
  { name: 'Цены продажи', title: 'Цены продажи — Волгоград', note: 'Актуально на 01.10.2026', head: ['Раздел', 'Блюдо', 'ТТК №', 'Выход, г', 'Цена продажи, ₽'], fmt: ['text', 'text', 'text', 'int', 'money'], widths: [120, 260, 70, 80, 110], rows },
  { name: 'Изменения цен', title: 'Изменения цен продажи', note: '', head: ['Дата', 'Блюдо', 'Было, ₽', 'Стало, ₽', 'Изменение, %'], fmt: ['text', 'text', 'money', 'money', 'pct'], widths: [120, 260, 80, 80, 90], rows: [] }
];
const prvTables = (cost, ing) => [
  { name: 'Блюда', title: 'Блюда', note: '', head: ['Раздел', 'Блюдо', 'ТТК №', 'Выход, г', 'Себестоимость порции, ₽', 'Цена продажи, ₽'], fmt: ['text', 'text', 'text', 'int', 'money', 'money'], widths: [100, 240, 60, 70, 110, 110], rows: [['Супы', 'Борщ', '12', 300, cost, 250]] },
  { name: 'Сырьё', title: 'Сырьё', note: '', head: ['Раздел', 'Сырьё', 'Цена, ₽/кг'], fmt: ['text', 'text', 'money'], widths: [100, 240, 90], rows: [['Овощи', 'Свёкла', ing], ['Овощи', '=HYPERLINK("http://x")', 10]] },
  { name: 'Изменения', title: 'Изменения', note: '', head: ['Дата', 'Что', 'Название', 'Показатель', 'Было', 'Стало', 'Изменение, %'], fmt: ['text', 'text', 'text', 'text', 'money', 'money', 'pct'], widths: [120, 90, 200, 120, 80, 80, 90], rows: [['01.10.2026 10:00', 'Сырьё', 'Свёкла', 'Цена, ₽/кг', 30, 32, 6.7]] }
];
const req = (o = {}) => Object.assign({
  op: 'pricesPublish', code: A, by: 'Технолог', region: { id: 'main', name: 'Волгоград' }, hash: 'h1abcd',
  pub: pubTables([['Супы', 'Борщ', '12', 300, 250]]), prv: prvTables(80.5, 32), xlsxPub: xl('p'), xlsxPrv: xl('v'), nDishes: 1, nSold: 1, nIngs: 2
}, o);
const folderByName = (g, name, parent) => Object.values(g.drive.items).find(x => x.kind === 'folder' && !x.trashed && x.name === name && (!parent || x.parents.includes(parent)));
const filesIn = (g, fid) => Object.values(g.drive.items).filter(x => x.kind === 'file' && !x.trashed && x.parents.includes(fid));

// ---------- запись: папки, таблицы, Excel, архив ----------
{
  const { g, get, post } = mk();
  const r = post(req());
  assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.same, false); assert.strictEqual(r.shared, true);
  const root = folderByName(g, 'Цены ТехнолоGии'); assert.ok(root, 'корневая папка цен');
  const reg = folderByName(g, 'Волгоград', root.id); assert.ok(reg, 'папка региона');
  const arch = folderByName(g, 'Архив', reg.id); assert.ok(arch, 'подпапка архива');
  const names = filesIn(g, reg.id).map(x => x.name).sort();
  assert.deepStrictEqual(names, ['Себестоимость и закупка — Волгоград', 'Себестоимость и закупка — Волгоград.xlsx', 'Цены продажи — Волгоград', 'Цены продажи — Волгоград.xlsx'], 'четыре файла региона');
  const ym = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit' }).format(new Date()).replace('/', '-').slice(0, 7);
  assert.deepStrictEqual(filesIn(g, arch.id).map(x => x.name).sort(), [ym + ' · Себестоимость и закупка — Волгоград.xlsx', ym + ' · Цены продажи — Волгоград.xlsx'], 'копии за месяц в архиве');
  // доступ: цены продажи по ссылке, остальное закрыто
  const byName = n => filesIn(g, reg.id).find(x => x.name === n);
  assert.deepStrictEqual(byName('Цены продажи — Волгоград').shared, ['ANYONE_WITH_LINK', 'VIEW']);
  assert.deepStrictEqual(byName('Цены продажи — Волгоград.xlsx').shared, ['ANYONE_WITH_LINK', 'VIEW']);
  assert.deepStrictEqual(byName('Себестоимость и закупка — Волгоград').shared, ['PRIVATE', 'NONE']);
  assert.deepStrictEqual(byName('Себестоимость и закупка — Волгоград.xlsx').shared, ['PRIVATE', 'NONE']);
  assert.deepStrictEqual(filesIn(g, arch.id).find(x => x.name.includes('Себестоимость')).shared, ['PRIVATE', 'NONE'], 'архив себестоимости закрыт');
  assert.deepStrictEqual(filesIn(g, arch.id).find(x => x.name.includes('Цены продажи')).shared, ['ANYONE_WITH_LINK', 'VIEW']);
  // содержимое таблиц: заголовок, примечание, шапка в 4-й строке, данные с 5-й
  const books = Object.values(g.books);
  const bp = books.find(b => b.name === 'Цены продажи — Волгоград'), bv = books.find(b => b.name === 'Себестоимость и закупка — Волгоград');
  assert.deepStrictEqual(bp.sheets.map(s => s.getName()), ['Цены продажи', 'Изменения цен'], 'лишний «Sheet1» удалён');
  assert.deepStrictEqual(bv.sheets.map(s => s.getName()), ['Блюда', 'Сырьё', 'Изменения']);
  const s1 = bp.sheets[0]._sh;
  assert.strictEqual(s1.rows[0][0], 'Цены продажи — Волгоград'); assert.strictEqual(s1.rows[1][0], 'Актуально на 01.10.2026');
  assert.deepStrictEqual(s1.rows[3], ['Раздел', 'Блюдо', 'ТТК №', 'Выход, г', 'Цена продажи, ₽']); assert.deepStrictEqual(s1.rows[4], ['Супы', 'Борщ', '12', 300, 250]);
  assert.strictEqual(s1.frozen, 4); assert.strictEqual(s1.widths[2], 260);
  assert.ok(s1.fmt.some(f => f.c === 5 && f.f === '#,##0.00' && f.r === 5), 'денежный формат');
  const sv = bv.sheets[1]._sh;
  assert.ok(sv.fmt.some(f => f.c === 2 && f.f === '@' && f.r === 5 && f.nr === 2), 'название сырья записано как текст: «=…» не станет формулой');
  // файлы Excel: описание (вид, регион), папка
  const meta = n => JSON.parse(byName(n).desc);
  assert.deepStrictEqual(meta('Цены продажи — Волгоград.xlsx'), { pf: 1, k: 'pub', reg: 'main' });
  assert.deepStrictEqual(meta('Себестоимость и закупка — Волгоград.xlsx'), { pf: 1, k: 'prv', reg: 'main' });
  assert.strictEqual(JSON.parse(filesIn(g, arch.id)[0].desc).ym, ym);
  // журнал
  const lg = g.rows('Журнал').filter(x => x[2] === 'цены обновлены'); assert.strictEqual(lg.length, 1); assert.strictEqual(lg[0][4], 'Волгоград'); assert.ok(/блюд с ценой продажи: 1/.test(lg[0][5]));

  // повтор без изменений: ничего не пишется
  const nItems = Object.keys(g.drive.items).length;
  const r2 = post(req()); assert.strictEqual(r2.ok, true); assert.strictEqual(r2.same, true);
  assert.strictEqual(Object.keys(g.drive.items).length, nItems, 'ничего не создано');
  assert.strictEqual(g.rows('Журнал').filter(x => x[2] === 'цены обновлены').length, 1);

  // изменение: таблицы те же (по идентификатору), Excel новый, в архиве тот же месяц заменён
  const idPub = Object.keys(g.books).find(k => g.books[k].name === 'Цены продажи — Волгоград');
  const oldX = byName('Цены продажи — Волгоград.xlsx').id;
  const r3 = post(req({ hash: 'h2abcd', prv: prvTables(90, 35), xlsxPub: xl('P') }));
  assert.strictEqual(r3.ok, true); assert.strictEqual(r3.same, false);
  assert.ok(Object.keys(g.books).filter(k => g.books[k].name === 'Цены продажи — Волгоград').length === 1 && idPub in g.books, 'Google Таблица осталась той же: ссылка не меняется');
  assert.strictEqual(g.books[idPub].sheets[0]._sh.rows.length >= 5, true);
  assert.strictEqual(g.drive.items[oldX].trashed, true, 'прежний Excel в корзине');
  assert.strictEqual(filesIn(g, reg.id).length, 4); assert.strictEqual(filesIn(g, arch.id).length, 2, 'за месяц один набор файлов');
  assert.strictEqual(bv.sheets[0]._sh.rows[4][4], 90, 'себестоимость обновилась в таблице');
  assert.strictEqual(Buffer.from(Object.values(g.drive.items).find(x => x.name === 'Цены продажи — Волгоград.xlsx' && !x.trashed).bytes)[5], 'P'.charCodeAt(0));

  // следующий месяц: архив пополняется, старый месяц остаётся
  g.opts.now = () => Date.UTC(2099, 0, 15, 10);
  assert.strictEqual(post(req({ hash: 'h3abcd' })).ok, true);
  assert.deepStrictEqual(filesIn(g, arch.id).map(x => x.name.slice(0, 7)).sort(), [ym, ym, '2099-01', '2099-01'].sort(), 'в архиве два месяца');
  g.opts.now = null;

  // второй регион: своя папка и свои файлы
  const m = post(req({ region: { id: 'msk', name: 'Москва' }, hash: 'hmsk01' }));
  assert.strictEqual(m.ok, true);
  const reg2 = folderByName(g, 'Москва', root.id); assert.ok(reg2 && reg2.id !== reg.id);
  assert.deepStrictEqual(filesIn(g, reg2.id).map(x => x.name).sort(), ['Себестоимость и закупка — Москва', 'Себестоимость и закупка — Москва.xlsx', 'Цены продажи — Москва', 'Цены продажи — Москва.xlsx']);
  assert.strictEqual(filesIn(g, reg.id).length, 4, 'файлы Волгограда не тронуты');

  // регион переименовали: папка и файлы следуют за названием
  assert.strictEqual(post(req({ region: { id: 'msk', name: 'Москва и область' }, hash: 'hmsk02' })).ok, true);
  assert.ok(folderByName(g, 'Москва и область', root.id) && !folderByName(g, 'Москва', root.id), 'папка переименована, не задвоена');
  assert.ok(Object.values(g.books).some(b => b.name === 'Цены продажи — Москва и область'));

  // ---------- чтение и права ----------
  const pe = get(E, { a: 'prices' }), pf = get(F, { a: 'prices' }), pa = get(A, { a: 'prices' }), pv = get(V, { a: 'prices' });
  assert.deepStrictEqual(pe.regions.map(x => x.id).sort(), ['main', 'msk']);
  const e0 = pe.regions.find(x => x.id === 'main');
  assert.ok(e0.pub.sheet.startsWith('https://docs.google.com/spreadsheets/d/') && e0.pub.x, 'цены продажи видны редактору');
  assert.ok(e0.prv && e0.prv.x && !e0.prv.sheet, 'редактор получает Excel себестоимости, но не ссылки на закрытые таблицы'); assert.strictEqual(e0.folder, undefined); assert.strictEqual(e0.hash, undefined);
  const f0 = pf.regions.find(x => x.id === 'main'); assert.ok(f0.prv.x && !f0.prv.sheet && !f0.folder, 'экономист получает Excel себестоимости, но не ссылки на закрытые таблицы и папки');
  assert.ok(pv.regions[0].prv.x);
  const a0 = pa.regions.find(x => x.id === 'main'); assert.ok(a0.prv.sheet && a0.folder && a0.archive && a0.hash === 'h3abcd', 'технолог видит всё');
  assert.strictEqual(get(null, { a: 'prices' }).err, 'code'); assert.strictEqual(get('bad', { a: 'prices' }).err, 'code');

  // скачивание Excel
  const dl = (c, id) => get(c, { a: 'pfile', id });
  assert.strictEqual(dl(E, e0.pub.x).ok, true, 'редактор скачивает цены продажи');
  assert.strictEqual(Buffer.from(dl(E, e0.pub.x).b64, 'base64')[0], 80);
  assert.strictEqual(dl(E, f0.prv.x).ok, true, 'редактору себестоимость отдаётся');
  assert.strictEqual(dl(F, f0.prv.x).ok, true); assert.strictEqual(dl(V, f0.prv.x).ok, true); assert.strictEqual(dl(A, f0.prv.x).ok, true);
  assert.strictEqual(dl(null, f0.prv.x).err, 'code'); assert.strictEqual(dl('bad', e0.pub.x).err, 'code');
  const lib = g.dropFile('main', 'чужой.docx', Buffer.concat([Buffer.from('PK'), Buffer.alloc(300)]));
  assert.strictEqual(dl(A, lib).err, 'nofile', 'файл не из папок цен не отдаётся');
  assert.strictEqual(dl(A, 'abc').err, 'id'); assert.strictEqual(dl(A, 'zzzzzzzzzzzz').err, 'nofile');
  // архив
  const ae = get(E, { a: 'parch', reg: 'main' }).files, af = get(F, { a: 'parch', reg: 'main' }).files;
  assert.ok(ae.some(x => x.k === 'prv') && ae.length === 4, 'редактору в архиве то же, что экономисту');
  assert.ok(af.some(x => x.k === 'prv') && af.length === 4);
  assert.strictEqual(af[0].ym, '2099-01', 'новые месяцы сверху');
  assert.strictEqual(dl(E, af.find(x => x.k === 'prv').id).ok, true); assert.strictEqual(dl(E, ae[0].id).ok, true);
  assert.deepStrictEqual(get(E, { a: 'parch', reg: 'zzz' }).files, []);

  // прежнее состояние для журнала изменений — только технологу
  assert.strictEqual(get(F, { a: 'pprev', reg: 'main' }).err, 'admin'); assert.strictEqual(get(E, { a: 'pprev', reg: 'main' }).err, 'admin');
  const pp = get(A, { a: 'pprev', reg: 'main' });
  assert.strictEqual(pp.has, true); assert.strictEqual(pp.same, false);
  assert.deepStrictEqual(pp.pub.sell, [['Борщ', 250]]);
  assert.deepStrictEqual(pp.prv.ing, [['Свёкла', 32], ['=HYPERLINK("http://x")', 10]]);
  assert.deepStrictEqual(pp.prv.dish, [['Борщ', 80.5, 250]]);
  assert.deepStrictEqual(pp.prv.log, [['01.10.2026 10:00', 'Сырьё', 'Свёкла', 'Цена, ₽/кг', 30, 32, 6.7]]);
  assert.strictEqual(get(A, { a: 'pprev', reg: 'main', h: 'h3abcd' }).same, true, 'тот же хэш: таблицы не читаются');
  assert.strictEqual(get(A, { a: 'pprev', reg: 'nope' }).has, false);

  // файл удалили на Диске: следующая запись создаёт его заново, хотя хэш тот же
  Object.values(g.drive.items).filter(x => x.name === 'Цены продажи — Волгоград' && x.parents.includes(reg.id)).forEach(x => { x.trashed = true; });
  const rr = post(req({ hash: 'h3abcd' })); assert.strictEqual(rr.ok, true); assert.strictEqual(rr.same, false);
  assert.strictEqual(filesIn(g, reg.id).filter(x => x.name === 'Цены продажи — Волгоград').length, 1, 'таблица создана заново');
}

// ---------- кто может писать и что проверяется ----------
{
  const { g, get, post } = mk();
  [E, F, V].forEach(c => assert.strictEqual(post(req({ code: c })).err, 'admin', 'запись цен не по коду технолога'));
  assert.strictEqual(post(req({ code: 'bad' })).err, 'code');
  assert.strictEqual(Object.keys(g.drive.items).length, 0, 'при отказе Диск не тронут');
  assert.strictEqual(post(req({ region: { id: '../x', name: 'a' } })).err, 'region');
  assert.strictEqual(post(req({ region: { id: '', name: 'a' } })).err, 'region');
  assert.strictEqual(post(req({ hash: 'x' })).err, 'hash');
  assert.strictEqual(post(req({ pub: [] })).err, 'tables');
  assert.strictEqual(post(req({ prv: 'нет' })).err, 'tables');
  assert.strictEqual(post(req({ xlsxPub: Buffer.from('not a zip at all, long enough '.repeat(20)).toString('base64') })).err, 'xlsx');
  assert.strictEqual(post(req({ xlsxPrv: '' })).err, 'xlsx');
  assert.strictEqual(post(req({ xlsxPub: '!!!' })).err, 'b64');
  const big = pubTables([]); big[0].rows = Array.from({ length: 6001 }, (_, i) => ['a', 'b', 'c', i, 1]);
  assert.strictEqual(post(req({ pub: big })).err, 'many');
  const dup = pubTables([]); dup[1].name = 'Цены продажи'; assert.strictEqual(post(req({ pub: dup })).err, 'tables');
  const wide = pubTables([]); wide[0].head = Array.from({ length: 21 }, (_, i) => 'c' + i); assert.strictEqual(post(req({ pub: wide })).err, 'tables');
  assert.strictEqual(Object.keys(g.drive.items).length, 0, 'ни одна проверка не оставила следов на Диске');
  // странные значения в ячейках приводятся к тексту/числу
  const odd = pubTables([['Супы', null, undefined, NaN, { a: 1 }]]);
  assert.strictEqual(post(req({ pub: odd })).ok, true);
  const bp = Object.values(g.books).find(b => b.name === 'Цены продажи — Волгоград');
  assert.deepStrictEqual(bp.sheets[0]._sh.rows[4].slice(0, 4), ['Супы', '', '', ''], 'null/NaN → пусто');
  assert.strictEqual(typeof bp.sheets[0]._sh.rows[4][4], 'string');
  // без цен в базе и до первой записи
  assert.deepStrictEqual(mk().get(A, { a: 'prices' }).regions, []);
}

// ---------- сбои Диска ----------
{
  const { g, get, post } = mk({ noShare: true });
  const r = post(req()); assert.strictEqual(r.ok, true); assert.strictEqual(r.shared, false, 'ссылку открыть не удалось — это видно в ответе');
  assert.strictEqual(get(A, { a: 'prices' }).regions[0].shared, false);
  assert.strictEqual(get(E, { a: 'prices' }).regions[0].shared, false);
}
{
  const { post } = mk({ noDrive: true });
  const r = post(req()); assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'drive', JSON.stringify(r));
}
console.log('GAS prices ok');
