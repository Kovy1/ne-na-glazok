/* Роль «аудит»: вход по одному коду без имени; видит и выгружает всё, что видит шеф-повар (с ценами), ничего не меняет */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const core = r => { const o = Object.assign({}, r); delete o.regs; delete o.rset; delete o.uid; return o; };   // v26: в ответе входа добавились регионы и ид
const A = 'adm-5678', E = 'ed-1234', V = 'view-3456', U = 'aud-7788';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const mkDocx = (size = 2000, tag = 'x') => { const b = Buffer.alloc(size, 7); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4; b.write(tag, 10); return b; };
const b64 = b => Buffer.from(b).toString('base64');
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: rid() }, b)).text);
vm.runInContext('setup()', g.ctx);

// вход одним кодом, без имени; цены доступны
assert.deepStrictEqual(core(post({ op: 'auth', code: U })), { ok: true, role: 'audit', price: true });
assert.deepStrictEqual(core(post({ op: 'auth', code: U, by: '' })), { ok: true, role: 'audit', price: true });
assert.deepStrictEqual(core(post({ op: 'auth', code: V })), { ok: true, role: 'viewer', price: true }, 'шеф-повар как был');
assert.strictEqual(get(null, { a: 'ping' }).v, 30);

// технолог публикует блюдо с ценами и кладёт файл; редактор присылает файл на проверку
const prices = { price: 120, priceUnit: 'kg', packG: 1000, priceSrc: '1С' };
let r = post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'ing', sid: 'i-1', name: 'Лук', json: { name: 'Лук', p: 1, f: 2, c: 3, kind: 'table', source: '', ...prices } },
  { kind: 'rec', sid: 'r-1', name: 'Щи', json: { name: 'Щи', output: 200, rows: [{ ing: 'i-1', in: 'Лук', net: 100, share: 100 }], ref: {}, ttk: {}, sell: { main: 300 } } }] });
assert.strictEqual(r.ok, true);
const up = post({ op: 'upload', code: A, by: 'Технолог', name: 'ТТК №1 Щи.docx', b64: b64(mkDocx(900, 'shi')) }); assert.strictEqual(up.ok, true);
const pend = post({ op: 'upload', code: E, by: 'Иван', name: 'Ждёт.docx', b64: b64(mkDocx(700, 'wt')) }); assert.strictEqual(pend.ok, true);

// чтение: без имени, с ценами; как у шеф-повара — только принятые файлы
let pull = get(U, { a: 'pull', since: 0 }); assert.strictEqual(pull.ok, true);
const ingr = pull.items.find(x => x.kind === 'ing'); assert.strictEqual(ingr.json.price, 120, 'аудит видит закупочные цены');
assert.strictEqual(pull.items.find(x => x.kind === 'rec').json.sell.main, 300);
assert.strictEqual(get(U, { a: 'log' }).ok, true, 'журнал виден');
const L = get(U, { a: 'files', fresh: '1' }); assert.strictEqual(L.ok, true); assert.ok(L.files.length >= 1 && L.files.every(x => x.kind === 'main'), 'только принятые файлы');
assert.strictEqual(get(U, { a: 'file', id: up.id }).ok, true, 'принятый файл выгружается');
assert.strictEqual(get(U, { a: 'file', id: pend.id }).err, 'nofile', 'файл на проверке не отдаётся');
assert.strictEqual(get(U, { a: 'prices' }).ok !== undefined, true);
assert.strictEqual(get(U, { a: 'inbox', by: '' }).batches.length, 0);
assert.strictEqual(get('bad', { a: 'pull' }).err, 'code');

// запись закрыта: ни одна операция не проходит и данные не меняются
const rows0 = JSON.stringify(g.rows('Общая база')) + JSON.stringify(g.rows('Предложения')) + JSON.stringify(g.rows('Журнал'));
const attempts = [
  ['propose', { by: 'Аудитор', items: [{ kind: 'ing', sid: 'i-9', name: 'Соль', json: { name: 'Соль', p: 0, f: 0, c: 0, kind: 'table', source: '' } }] }],
  ['publish', { by: 'Аудитор', items: [{ kind: 'ing', sid: 'i-9', name: 'Соль', json: { name: 'Соль', p: 0, f: 0, c: 0, kind: 'table', source: '' } }] }],
  ['upload', { by: 'Аудитор', name: 'a.docx', b64: b64(mkDocx(500)) }], ['phput', { by: 'Аудитор', id: 'x', hdr: { org: 'x' } }], ['rwclose', { by: 'Аудитор', batch: 'x' }],
  ['bkput', { by: 'Аудитор', data: 'e30=', base: 0, dev: 'd', label: 'x' }], ['fwithdraw', { by: 'Аудитор', id: up.id }], ['approve', { by: 'Аудитор', batch: 'x' }],
  ['fapprove', { by: 'Аудитор', id: pend.id }], ['fdelete', { by: 'Аудитор', id: up.id }], ['usradd', { by: 'Аудитор', name: 'Иванов И.И.', role: 'editor' }], ['pricesPublish', { by: 'Аудитор' }],
  ['pagePut', { by: 'Аудитор' }], ['layPut', { by: 'Аудитор', cats: [] }], ['ai', { by: 'Аудитор', prompt: 'x' }]];
attempts.forEach(([op, extra]) => { const x = post(Object.assign({ op, code: U }, extra)); assert.strictEqual(x.ok, false, op + ' закрыто для аудита: ' + JSON.stringify(x).slice(0, 120)); });
assert.ok(/аудита/.test(post({ op: 'propose', code: U, by: 'q', items: [] }).msg), 'сообщение называет код аудита');
assert.ok(/шеф-повара/.test(post({ op: 'propose', code: V, by: 'q', items: [] }).msg), 'у шеф-повара прежнее сообщение');
assert.strictEqual(JSON.stringify(g.rows('Общая база')) + JSON.stringify(g.rows('Предложения')) + JSON.stringify(g.rows('Журнал')), rows0, 'ничего не изменилось');

// код аудита не должен совпадать с другими и не годится как именной
const dup = createGas({ audit: 'view-3456' }); assert.strictEqual(dup.parseOut(dup.get({ a: 'ping' })).data.ready, false, 'одинаковые коды — скрипт не готов');
const off = createGas({ audit: null }); assert.strictEqual(JSON.parse(off.post({ rid: rid(), op: 'auth', code: U }).text).err, 'code', 'пока код не задан, роль выключена');
const nm = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Петров П.П.', role: 'editor', code2: U, custom: U }); // именной код равный коду аудита отвергается
assert.ok(nm.ok === false || nm.code !== U);
console.log('GAS audit OK');
