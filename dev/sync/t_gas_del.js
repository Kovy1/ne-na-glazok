/* Удаления в общей базе: метка «удалено» доходит до всех, сырьё в ТТК удалить нельзя, возврат через журнал, предложения редактора */
const assert = require('assert'), { createGas } = require('./gasmock');
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const E = 'ed-1234', A = 'adm-5678', V = 'view-3456';
const ing = (name, extra = {}) => Object.assign({ name, p: 1, f: 2, c: 3, kind: 'table', source: '' }, extra);
const rec = (name, rows, extra = {}) => Object.assign({ name, output: 200, rows, ref: {}, ttk: {} }, extra);
const D = { _del: 1 };

assert.strictEqual(get(null, { a: "ping" }).v, 31);
let r = post({ op: 'publish', code: A, by: 'Технолог', items: [
  { kind: 'ing', sid: 'i-lukk', name: 'Лук', json: ing('Лук', { price: 40 }) },
  { kind: 'ing', sid: 'i-svek', name: 'Свёкла', json: ing('Свёкла') },
  { kind: 'ing', sid: 'i-mask', name: 'Масло', json: ing('Масло') },
  { kind: 'rec', sid: 'r-schi', name: 'Щи', json: rec('Щи', [{ ing: 'i-lukk', in: 'Лук', net: 100, share: 100 }]) },
  { kind: 'rec', sid: 'r-pure', name: 'Пюре', json: rec('Пюре', [{ ing: 'i-mask', in: 'Масло', net: 20, share: 100 }]) }] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 5);

// сырьё в живой ТТК удалить нельзя
r = post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'ing', sid: 'i-lukk', name: 'Лук', json: D }] });
assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'inuse'); assert.ok(/«Лук» \(в «Щи»\)/.test(r.msg), r.msg);
assert.strictEqual(get(A, { a: 'pull', since: 0 }).items.length, 5, 'ничего не записано');

// неиспользуемое сырьё удаляется: строка остаётся с меткой и новой версией
r = post({ op: 'publish', code: A, by: 'Технолог', note: 'убрали', items: [{ kind: 'ing', sid: 'i-svek', name: 'Свёкла', baseRev: 2, json: D }] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, 1); assert.strictEqual(r.rev, 6);
let pl = get(V, { a: 'pull', since: 5 });
assert.strictEqual(pl.items.length, 1); assert.deepStrictEqual(pl.items[0].json, D); assert.strictEqual(pl.items[0].sid, 'i-svek'); assert.strictEqual(pl.items[0].name, 'Свёкла'); assert.strictEqual(pl.items[0].rev, 6);
assert.strictEqual(pl.rev, 6);
assert.strictEqual(get(A, { a: 'pull', since: 0 }).items.length, 5, 'строка остаётся: удаление должно дойти до всех');
// повторное удаление и удаление того, чего нет, ничего не меняют
r = post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'ing', sid: 'i-svek', name: 'Свёкла', json: D }, { kind: 'ing', sid: 'i-nope', name: 'Нет такого', json: D }] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, 0); assert.strictEqual(r.rev, 6);
// журнал и возврат
let lg = get(A, { a: 'log', n: 5 }).items[0];
assert.strictEqual(lg.action, 'удалено'); assert.strictEqual(lg.name, 'Свёкла'); assert.strictEqual(lg.hasPrev, true); assert.strictEqual(lg.rev, 6);
r = post({ op: 'revert', code: A, by: 'Технолог', rev: 6 });
assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 7);
pl = get(E, { a: 'pull', since: 6 });
assert.strictEqual(pl.items.length, 1); assert.strictEqual(pl.items[0].json.name, 'Свёкла'); assert.strictEqual(pl.items[0]._del, undefined); assert.ok(!pl.items[0].json._del, 'удаление отменено');
assert.strictEqual(get(A, { a: 'log', n: 1 }).items[0].action, 'возврат');

// ТТК и её сырьё удаляются одним пакетом (ТТК раньше сырья)
r = post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'ing', sid: 'i-mask', name: 'Масло', json: D }, { kind: 'rec', sid: 'r-pure', name: 'Пюре', json: D }] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, 2); assert.strictEqual(r.rev, 9);
pl = get(E, { a: 'pull', since: 7 });
assert.deepStrictEqual(pl.items.map(x => x.sid + ':' + (x.json._del ? 'del' : 'live')).sort(), ['i-mask:del', 'r-pure:del']);
// ТТК, которая в этом же пакете перестаёт использовать сырьё, не мешает его удалить
r = post({ op: 'publish', code: A, by: 'Технолог', items: [
  { kind: 'rec', sid: 'r-schi', name: 'Щи', json: rec('Щи', []) }, { kind: 'ing', sid: 'i-lukk', name: 'Лук', json: D }] });
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.changed, 2);
// ... а рецептура не может сослаться на удалённое сырьё
r = post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'rec', sid: 'r-new1', name: 'Салат', json: rec('Салат', [{ ing: 'i-lukk', in: 'Лук', net: 50, share: 100 }]) }] });
assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'dangling');

// новое сырьё с названием удалённого не усыновляется удалённой строкой
r = post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'ing', sid: 'i-lukk2', name: 'Лук', json: ing('Лук', { price: 55 }) }] });
assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.remap, {}, 'новая запись, а не возврат старой');
pl = get(A, { a: 'pull', since: 0 });
assert.ok(pl.items.some(x => x.sid === 'i-lukk' && x.json._del) && pl.items.some(x => x.sid === 'i-lukk2' && x.json.price === 55));

// редактор предлагает удаление: идёт на проверку без цен и меток, технолог принимает
const before = g.rows('Общая база').length;
let p = post({ op: 'propose', code: E, by: 'Иван', note: 'не нужно', items: [{ kind: 'ing', sid: 'i-svek', name: 'Свёкла', baseRev: 7, json: Object.assign({ price: 5 }, D) }] });
assert.strictEqual(p.ok, true);
const stored = JSON.parse(g.rows('Предложения')[0][9]); assert.deepStrictEqual(stored, D, 'в предложении только метка');
let pend = get(A, { a: 'pending' }); assert.strictEqual(pend.batches.length, 1); assert.deepStrictEqual(pend.batches[0].items[0].json, D);
assert.strictEqual(get(A, { a: 'pull', since: 0 }).items.find(x => x.sid === 'i-svek').json._del, undefined, 'до принятия ничего не удалено');
r = post({ op: 'approve', code: A, by: 'Технолог', batch: pend.batches[0].batch });
assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, 1);
assert.deepStrictEqual(get(V, { a: 'pull', since: 0 }).items.find(x => x.sid === 'i-svek').json, D);
assert.strictEqual(g.rows('Общая база').length, before, 'строк не прибавилось');
// просмотр удалять не может
assert.strictEqual(post({ op: 'propose', code: V, by: 'Шеф', items: [{ kind: 'ing', sid: 'i-lukk2', name: 'Лук', json: D }] }).err, 'viewer');
assert.strictEqual(post({ op: 'publish', code: E, by: 'Иван', items: [{ kind: 'ing', sid: 'i-lukk2', name: 'Лук', json: D }] }).err, 'admin');
console.log('GAS del ok');
