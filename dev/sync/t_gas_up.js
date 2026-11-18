/* v13: версия списка файлов в ping (fv), причина отказа доходит до автора (inbox.rejected), «Понятно» убирает уведомление */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', V = 'view-3456';
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const mkDocx = (size = 500, tag = 'x') => { const b = Buffer.alloc(size, 7); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4; b.write(tag, 10); return b.toString('base64'); };
vm.runInContext('setup()', g.ctx);
assert.strictEqual(get(null, { a: 'ping' }).v, 31);
const fv0 = get(null, { a: 'ping' }).fv; assert.strictEqual(typeof fv0, 'number');
assert.strictEqual(get(null, { a: 'ping' }).fv, fv0, 'без записей версия не меняется');
post({ op: 'upload', code: E, by: 'Кузя', name: 'Борщ.docx', b64: mkDocx() });
const fv1 = get(null, { a: 'ping' }).fv; assert.ok(fv1 > fv0, 'после загрузки файла версия выросла');
assert.strictEqual(get(A, { a: 'files' }).fv, fv1); assert.strictEqual(get(V, { a: 'files' }).fv, fv1, 'шеф-повар получает ту же версию');
const id = get(A, { a: 'files' }).files[0].id;
post({ op: 'fapprove', code: A, by: 'Т', id, reg: 'main', dir: '' });
assert.ok(get(null, { a: 'ping' }).fv > fv1, 'принятие файла тоже меняет версию');

// отказ с причиной: автор видит её в inbox.rejected, другой автор — нет
const items = [{ kind: 'ing', sid: 'i-n', name: 'Чеснок', baseRev: 0, json: { name: 'Чеснок', p: 1, f: 2, c: 3, kind: 'table', source: '' } },
  { kind: 'rec', sid: 'r-n', name: 'Борщ новый', baseRev: 0, json: { name: 'Борщ новый', output: 200, rows: [{ ing: 'i-n', in: 'Чеснок', net: 5, share: 100 }], ref: {}, ttk: {} } }];
const p1 = post({ op: 'propose', code: E, by: 'Кузя', note: 'новое', items }); assert.ok(p1.ok);
assert.strictEqual(get(E, { a: 'inbox', by: 'Кузя' }).rejected.length, 0);
assert.ok(post({ op: 'reject', code: A, by: 'Технолог', batch: p1.batch, note: 'Такое блюдо уже есть' }).ok);
let ib = get(E, { a: 'inbox', by: 'Кузя' });
assert.strictEqual(ib.batches.length, 0, 'это не доработка'); assert.strictEqual(ib.rejected.length, 1);
assert.strictEqual(ib.rejected[0].reply, 'Такое блюдо уже есть'); assert.strictEqual(ib.rejected[0].reviewer, 'Технолог'); assert.ok(ib.rejected[0].decided > 0); assert.strictEqual(ib.rejected[0].st, 'отклонено');
assert.deepStrictEqual(ib.rejected[0].items.map(x => x.kind + ':' + x.name).sort(), ['ing:Чеснок', 'rec:Борщ новый']);
assert.strictEqual(get(E, { a: 'inbox', by: 'Мария' }).rejected.length, 0, 'чужое не показывается');
assert.strictEqual(get(V, { a: 'inbox', by: 'Кузя' }).rejected.length, 0);
assert.strictEqual(get(A, { a: 'pending' }).batches.length, 0);
assert.strictEqual(post({ op: 'rwclose', code: E, by: 'Мария', batch: p1.batch }).err, 'nobatch', 'чужое убрать нельзя');
assert.ok(post({ op: 'rwclose', code: E, by: 'Кузя', batch: p1.batch }).ok);
assert.strictEqual(get(E, { a: 'inbox', by: 'Кузя' }).rejected.length, 0, 'после «Понятно» уведомления нет');
// отказ без причины тоже доходит (причина пустая)
const p2 = post({ op: 'propose', code: E, by: 'Кузя', note: '', items }); assert.ok(post({ op: 'reject', code: A, by: 'Т', batch: p2.batch }).ok);
ib = get(E, { a: 'inbox', by: 'Кузя' }); assert.strictEqual(ib.rejected.length, 1); assert.strictEqual(ib.rejected[0].reply, '');
console.log('GAS up ok');
