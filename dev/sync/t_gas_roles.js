/* Роли и цены: все коды видят цены; правки редактора и экономиста уходят технологу на подтверждение; просмотр только читает */
const assert = require('assert'), { createGas } = require('./gasmock');
const core = r => { const o = Object.assign({}, r); delete o.regs; delete o.rset; delete o.uid; return o; };   // v26: в ответе входа добавились регионы и ид
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012', V = 'view-3456';
const ing = (name, extra = {}) => Object.assign({ name, p: 1, f: 2, c: 3, kind: 'table', source: '' }, extra);
const rec = (name, extra = {}) => Object.assign({ name, output: 200, rows: [{ ing: 'i-aaa', in: 'Лук', net: 100, share: 100 }], ref: {}, ttk: {} }, extra);

// роли по кодам
assert.deepStrictEqual(core(post({ op: 'auth', code: A })), { ok: true, role: 'admin', price: true });
assert.deepStrictEqual(core(post({ op: 'auth', code: E })), { ok: true, role: 'editor', price: true });
assert.deepStrictEqual(core(post({ op: 'auth', code: F })), { ok: true, role: 'finance', price: true });
assert.deepStrictEqual(core(post({ op: 'auth', code: V })), { ok: true, role: 'viewer', price: true });
assert.strictEqual(post({ op: 'auth', code: 'нет' }).err, 'code');

// данные только по коду
['pull', 'pending', 'log', 'files'].forEach(a => {
  assert.strictEqual(get(null, { a }).err, 'code', a + ' без кода');
  assert.strictEqual(get('bad', { a }).err, 'code', a + ' с чужим кодом');
  assert.strictEqual(get('', { a }).err, 'code', a + ' с пустым кодом');
});
assert.strictEqual(get(null, { a: 'ping' }).ok, true, 'проверка связи открыта');
assert.strictEqual(get(null, { a: 'ping' }).v, 31);

// технолог публикует сырьё и блюдо с ценами
const prices = { price: 120, priceUnit: 'kg', packG: 1000, priceSrc: '1С', px: { r2: { price: 150 } } };
let r = post({ op: 'publish', code: A, by: 'Технолог', items: [
  { kind: 'ing', sid: 'i-aaa', name: 'Лук', json: ing('Лук', prices) },
  { kind: 'rec', sid: 'r-111', name: 'Щи', json: rec('Щи', { sell: { main: 300, r2: 330 } }) }] });
assert.strictEqual(r.ok, true);

// чтение: цены видят все четыре кода
for (const c of [A, E, F, V]) {
  const pl = get(c, { a: 'pull', since: 0 });
  assert.strictEqual(pl.items.find(x => x.kind === 'ing').json.price, 120, c);
  assert.deepStrictEqual(pl.items.find(x => x.kind === 'ing').json.px, { r2: { price: 150 } }, c);
  assert.strictEqual(pl.items.find(x => x.kind === 'ing').json.priceSrc, '1С', c);
  assert.deepStrictEqual(pl.items.find(x => x.kind === 'rec').json.sell, { main: 300, r2: 330 }, c);
  assert.strictEqual(pl.items.length, 2); assert.strictEqual(pl.rev, 2);
}

// просмотр ничего не отправляет
assert.strictEqual(post({ op: 'propose', code: V, by: 'Зритель', items: [{ kind: 'ing', sid: 'i-aaa', name: 'Лук', json: ing('Лук') }] }).err, 'viewer');
assert.strictEqual(post({ op: 'upload', code: V, by: 'Зритель', name: 'x.docx', data: [1, 2, 3] }).err, 'viewer');
['publish', 'approve', 'reject', 'revert', 'addr', 'fapprove', 'dcreate'].forEach(op => {
  assert.strictEqual(post({ op, code: V }).err, 'admin', op + ' для просмотра');
  assert.strictEqual(post({ op, code: F }).err, 'admin', op + ' для экономиста');
  assert.strictEqual(post({ op, code: E }).err, 'admin', op + ' для редактора');
});
assert.strictEqual(g.rows('Предложения').length, 0, 'просмотр ничего не записал');

// редактор правит ТТК и цены: правки уходят на подтверждение вместе с ценами, действующие цены до принятия не меняются
const P1 = { price: 125, priceUnit: 'kg', packG: 1000, priceSrc: '1С', px: { r2: { price: 155 } }, p: 5 };
let p1 = post({ op: 'propose', code: E, by: 'Иван', note: 'выход и цены', items: [
  { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 1, json: ing('Лук', P1) },
  { kind: 'rec', sid: 'r-111', name: 'Щи', baseRev: 2, json: rec('Щи', { output: 250, sell: { main: 310, r2: 330 } }) }] });
assert.strictEqual(p1.ok, true);
const stored = g.rows('Предложения').map(x => JSON.parse(x[9]));
assert.strictEqual(stored[0].price, 125, 'цена редактора сохранена в предложении'); assert.deepStrictEqual(stored[0].px, { r2: { price: 155 } });
assert.deepStrictEqual(stored[1].sell, { main: 310, r2: 330 }); stored.forEach(j => assert.strictEqual(j._np, undefined, 'метки «без цен» нет'));
assert.strictEqual(get(A, { a: 'pull', since: 0 }).items.find(x => x.sid === 'i-aaa').json.price, 120, 'до принятия действует прежняя цена');
// очередь на проверку: цены редактора видят все коды
for (const c of [A, E, F, V]) {
  const it = get(c, { a: 'pending' }).batches[0].items;
  assert.strictEqual(it.find(x => x.kind === 'ing').json.price, 125, c); assert.strictEqual(it.find(x => x.kind === 'ing').json.p, 5);
  assert.deepStrictEqual(it.find(x => x.kind === 'rec').json.sell, { main: 310, r2: 330 }, c);
}
// принятие: правки и цены применены
assert.strictEqual(post({ op: 'approve', code: E, batch: p1.batch }).err, 'admin', 'редактор сам себя не принимает');
assert.strictEqual(post({ op: 'approve', code: A, by: 'Технолог', batch: p1.batch }).ok, true);
let pl = get(E, { a: 'pull', since: 0 });
let li = pl.items.find(x => x.kind === 'ing').json, lr = pl.items.find(x => x.kind === 'rec').json;
assert.strictEqual(li.p, 5); assert.strictEqual(li.price, 125); assert.deepStrictEqual(li.px, { r2: { price: 155 } }); assert.strictEqual(li.priceSrc, '1С');
assert.strictEqual(lr.output, 250); assert.deepStrictEqual(lr.sell, { main: 310, r2: 330 });

// редактор предлагает новое сырьё и новое блюдо: цены и цена продажи записываются
let p2 = post({ op: 'propose', code: E, by: 'Иван', items: [
  { kind: 'ing', sid: 'i-new', name: 'Чеснок', json: ing('Чеснок', { price: 500 }) },
  { kind: 'rec', sid: 'r-new', name: 'Борщ', json: rec('Борщ', { sell: { main: 999 }, rows: [{ ing: 'i-new', in: 'Чеснок', net: 5, share: 100 }] }) }] });
assert.strictEqual(post({ op: 'approve', code: A, by: 'Технолог', batch: p2.batch }).ok, true);
pl = get(A, { a: 'pull', since: 0 });
assert.strictEqual(pl.items.find(x => x.name === 'Чеснок').json.price, 500); assert.deepStrictEqual(pl.items.find(x => x.name === 'Борщ').json.sell, { main: 999 });

// старое предложение редактора (версия до 8, с меткой «без цен»): при приёме и просмотре подставляются действующие цены
g.ctx.SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Предложения').appendRow(['bOLD0001', 'ing', 'i-aaa', 'Лук', 3, 'Старый', new Date(), 'ждёт', 'до v8',
  JSON.stringify(ing('Лук', { p: 7, _np: 1 }))]);
const old = get(E, { a: 'pending' }).batches.find(b => b.batch === 'bOLD0001').items[0].json;
assert.strictEqual(old.p, 7); assert.strictEqual(old.price, 125, 'в старом предложении цены дополнены действующими'); assert.strictEqual(old._np, undefined);
assert.strictEqual(post({ op: 'approve', code: A, by: 'Технолог', batch: 'bOLD0001' }).ok, true);
li = get(A, { a: 'pull', since: 0 }).items.find(x => x.sid === 'i-aaa').json;
assert.strictEqual(li.p, 7); assert.strictEqual(li.price, 125); assert.deepStrictEqual(li.px, { r2: { price: 155 } }); assert.strictEqual(li._np, undefined);

// экономист меняет цену продажи и закупки: тоже на подтверждение, редактор видит, после принятия действует
const rv = g.rows('Общая база'); const revL = rv.find(x => x[0] === 'i-aaa')[3], revR = rv.find(x => x[0] === 'r-111')[3];
let p3 = post({ op: 'propose', code: F, by: 'Экономист', note: 'цены', items: [
  { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: revL, json: ing('Лук', { p: 7, price: 130, priceUnit: 'kg', packG: 1000, priceSrc: '1С', px: { r2: { price: 160 } } }) },
  { kind: 'rec', sid: 'r-111', name: 'Щи', baseRev: revR, json: rec('Щи', { output: 250, sell: { main: 350, r2: 330 } }) }] });
assert.strictEqual(p3.ok, true);
assert.strictEqual(get(A, { a: 'pull', since: 0 }).items.find(x => x.sid === 'i-aaa').json.price, 125, 'до принятия цена прежняя');
assert.ok(/130/.test(JSON.stringify(get(E, { a: 'pending' }))) && /350/.test(JSON.stringify(get(E, { a: 'pending' }))), 'редактор видит предложенные цены');
assert.strictEqual(post({ op: 'approve', code: F, batch: p3.batch }).err, 'admin', 'экономист сам не принимает');
assert.strictEqual(post({ op: 'approve', code: A, by: 'Технолог', batch: p3.batch }).ok, true);
for (const c of [E, F, V]) {
  pl = get(c, { a: 'pull', since: 0 });
  assert.strictEqual(pl.items.find(x => x.sid === 'i-aaa').json.price, 130, c); assert.strictEqual(pl.items.find(x => x.sid === 'r-111').json.sell.main, 350, c);
  assert.deepStrictEqual(pl.items.find(x => x.sid === 'i-aaa').json.px, { r2: { price: 160 } }, c);
}

// возврат прежнего значения: только технолог; журнал отдаёт кодам лишь названия, без данных
const lg = get(E, { a: 'log', n: 50 }).items;
lg.forEach(x => assert.ok(!('prev' in x) && !('json' in x), 'журнал без данных'));

// папки меню: пишет только технолог, читают все коды (и шеф-повар, и тер. управляющий)
['lay'].forEach(a => { assert.strictEqual(get(null, { a }).err, 'code', 'lay без кода'); assert.strictEqual(get('bad', { a }).err, 'code'); });
let ly = get(V, { a: 'lay' });
assert.strictEqual(ly.ok, true); assert.strictEqual(ly.rev, 0); assert.deepStrictEqual(ly.cats, [], 'пока папок нет');
for (const c of [E, F, V]) assert.strictEqual(post({ op: 'layPut', code: c, cats: [{ n: 'Первые блюда', r: ['r-111'] }] }).err, 'admin', 'папки меню правит технолог: ' + c);
assert.strictEqual(get(A, { a: 'ping' }).lay, 0);
r = post({ op: 'layPut', code: A, by: 'Технолог', cats: [{ n: 'Первые блюда', r: ['r-222', 'r-111', 'r-111', 'плохой ид'] }, { n: '  Вторые   блюда ', r: [] }, { n: 'первые блюда', r: ['r-9'] }, { n: '', r: ['r-8'] }, null] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 1); assert.strictEqual(r.cats, 2, 'дубль названия, пустое и мусор отброшены');
for (const c of [A, E, F, V]) {
  ly = get(c, { a: 'lay' });
  assert.strictEqual(ly.rev, 1, c);
  assert.deepStrictEqual(ly.cats, [{ n: 'Первые блюда', r: ['r-111', 'r-222'] }, { n: 'Вторые блюда', r: [] }], c);
}
assert.strictEqual(get(F, { a: 'ping' }).lay, 1, 'ping несёт номер раскладки');
r = post({ op: 'layPut', code: A, cats: [{ n: 'Вторые блюда', r: [] }, { n: 'Первые блюда', r: ['r-111', 'r-222'] }] });
assert.strictEqual(r.rev, 2, 'другой порядок папок — новая версия');
r = post({ op: 'layPut', code: A, cats: [{ n: 'Вторые блюда', r: [] }, { n: 'Первые блюда', r: ['r-222', 'r-111'] }] });
assert.strictEqual(r.same, true); assert.strictEqual(r.rev, 2, 'то же самое — версия не растёт');
// много блюд занимают несколько кусков свойств; потом список сокращается, лишние куски убираются
const big = []; for (let i = 0; i < 1500; i++) big.push('r' + i.toString(36) + 'abcdefgh');
r = post({ op: 'layPut', code: A, cats: [{ n: 'Все', r: big }] });
assert.strictEqual(r.ok, true); assert.strictEqual(get(V, { a: 'lay' }).cats[0].r.length, 1500);
r = post({ op: 'layPut', code: A, cats: [{ n: 'Все', r: ['r-1'] }] });
assert.deepStrictEqual(get(V, { a: 'lay' }).cats, [{ n: 'Все', r: ['r-1'] }]);
r = post({ op: 'layPut', code: A, cats: [] });
assert.deepStrictEqual(get(V, { a: 'lay' }).cats, [], 'технолог убрал все папки');

// две роли не могут иметь один код; необязательные роли можно не включать
assert.strictEqual(JSON.parse(createGas({ finance: E }).post({ rid: 'abcdef1', op: 'auth', code: E }).text).err, 'setup', 'код экономиста = код редактора');
assert.strictEqual(JSON.parse(createGas({ view: A }).post({ rid: 'abcdef2', op: 'auth', code: A }).text).err, 'setup');
assert.strictEqual(JSON.parse(createGas({ view: 'fin-9012' }).post({ rid: 'abcdef3', op: 'auth', code: 'fin-9012' }).text).err, 'setup');
const g5 = createGas({ finance: null, view: null });
assert.strictEqual(JSON.parse(g5.post({ rid: 'abcdef4', op: 'auth', code: 'ЗАМЕНИТЕ-код-управляющего' }).text).err, 'code', 'роль экономиста выключена, пока код не задан');
assert.strictEqual(JSON.parse(g5.post({ rid: 'abcdef5', op: 'auth', code: 'ЗАМЕНИТЕ-код-шеф-повара' }).text).err, 'code');
assert.strictEqual(JSON.parse(g5.post({ rid: 'abcdef6', op: 'auth', code: 'ed-1234' }).text).role, 'editor');
console.log('roles ok');
