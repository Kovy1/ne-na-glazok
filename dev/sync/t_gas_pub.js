/* Скрипт 23: автопубликация не перезаписывает то, что успели изменить (guard), история версий одной позиции */
const assert = require('assert'), { createGas } = require('./gasmock');
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const getRaw = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p)));
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const E = 'ed-1234', A = 'adm-5678';
const ing = (name, extra = {}) => Object.assign({ name, p: 1, f: 2, c: 3, kind: 'table', source: '' }, extra);
const rec = (name, rows, extra = {}) => Object.assign({ name, output: 200, rows, ref: {}, ttk: {} }, extra);
const D = { _del: 1 };
const pub = (items, extra) => post(Object.assign({ op: 'publish', code: A, by: 'Технолог', items }, extra || {}));
const net = sid => get(A, { a: 'pull', since: 0 }).items.filter(x => x.sid === sid)[0].json.rows[0].net;

// --- исходная база: сырьё и две карты
let r = pub([
  { kind: 'ing', sid: 'i-lukk', name: 'Лук', json: ing('Лук') },
  { kind: 'rec', sid: 'r-schi', name: 'Щи', json: rec('Щи', [{ ing: 'i-lukk', in: 'Лук', net: 100, share: 100 }]) },
  { kind: 'rec', sid: 'r-pure', name: 'Пюре', json: rec('Пюре', [{ ing: 'i-lukk', in: 'Лук', net: 50, share: 100 }]) }]);
assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 3); assert.strictEqual(r.skipped, undefined, 'без guard ответ прежний');

// --- guard: версия совпадает с прочитанной → записывается
r = pub([{ kind: 'rec', sid: 'r-schi', name: 'Щи', baseRev: 2, json: rec('Щи', [{ ing: 'i-lukk', in: 'Лук', net: 110, share: 100 }]) }], { guard: 1 });
assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, 1); assert.deepStrictEqual(r.skipped, []); assert.strictEqual(r.rev, 4);
assert.strictEqual(net('r-schi'), 110);

// --- guard: после этого кто-то (другое устройство технолога) изменил карту; устаревшая копия не затирает
r = pub([{ kind: 'rec', sid: 'r-schi', name: 'Щи', json: rec('Щи', [{ ing: 'i-lukk', in: 'Лук', net: 130, share: 100 }]) }]);
assert.strictEqual(r.rev, 5);
r = pub([{ kind: 'rec', sid: 'r-schi', name: 'Щи', baseRev: 4, json: rec('Щи', [{ ing: 'i-lukk', in: 'Лук', net: 777, share: 100 }]) },
  { kind: 'rec', sid: 'r-pure', name: 'Пюре', baseRev: 3, json: rec('Пюре', [{ ing: 'i-lukk', in: 'Лук', net: 60, share: 100 }]) }], { guard: 1 });
assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, 1, 'записалась только неизменённая другими');
assert.deepStrictEqual(r.skipped, [{ kind: 'rec', sid: 'r-schi', name: 'Щи' }]);
assert.strictEqual(net('r-schi'), 130, 'чужая версия цела'); assert.strictEqual(net('r-pure'), 60);
assert.strictEqual(r.rev, 6);

// --- guard: новая позиция с названием, которое уже есть в базе, считается конфликтом (а не склеивается молча)
r = pub([{ kind: 'rec', sid: 'r-new1', name: 'Щи', baseRev: 0, json: rec('Щи', [{ ing: 'i-lukk', in: 'Лук', net: 1, share: 100 }]) }], { guard: 1 });
assert.strictEqual(r.changed, 0); assert.strictEqual(r.skipped.length, 1); assert.strictEqual(r.rev, 6); assert.strictEqual(net('r-schi'), 130);
// ... а действительно новая — записывается
r = pub([{ kind: 'rec', sid: 'r-salat', name: 'Салат', baseRev: 0, json: rec('Салат', [{ ing: 'i-lukk', in: 'Лук', net: 30, share: 100 }]) }], { guard: 1 });
assert.strictEqual(r.changed, 1); assert.deepStrictEqual(r.skipped, []); assert.strictEqual(r.rev, 7);

// --- guard: удалённую другим карту не воскрешает
r = pub([{ kind: 'rec', sid: 'r-salat', name: 'Салат', json: D }]);
assert.strictEqual(r.changed, 1);
r = pub([{ kind: 'rec', sid: 'r-salat', name: 'Салат', baseRev: 7, json: rec('Салат', [{ ing: 'i-lukk', in: 'Лук', net: 31, share: 100 }]) }], { guard: 1 });
assert.strictEqual(r.changed, 0); assert.strictEqual(r.skipped.length, 1, 'удалённое не возвращается автопубликацией');
// ручная публикация без guard по-прежнему возвращает
r = pub([{ kind: 'rec', sid: 'r-salat', name: 'Салат', json: rec('Салат', [{ ing: 'i-lukk', in: 'Лук', net: 31, share: 100 }]) }]);
assert.strictEqual(r.changed, 1);

// --- история версий одной позиции: свежие сверху, с номером версии и признаком «есть прежнее»
let h = get(A, { a: 'hist', kind: 'rec', sid: 'r-schi' });
assert.strictEqual(h.ok, true);
assert.deepStrictEqual(h.items.map(x => x.rev), [5, 4, 2]);
assert.deepStrictEqual(h.items.map(x => x.hasPrev), [true, true, false], 'у создания прежнего нет');
assert.strictEqual(h.items[0].by, 'Технолог'); assert.ok(h.items[0].at > 0); assert.strictEqual(h.items[0].action, 'опубликовано');
assert.ok(!('json' in h.items[0]) && !('prev' in h.items[0]), 'содержимое версий не передаётся');
assert.deepStrictEqual(get(A, { a: 'hist', kind: 'rec', sid: 'r-nope' }).items, []);
// возврат: «прежнее» правки 5 — это версия, которая была после правки 4 (net 110)
r = post({ op: 'revert', code: A, by: 'Технолог', rev: 5 });
assert.strictEqual(r.ok, true); assert.strictEqual(net('r-schi'), 110);
h = get(A, { a: 'hist', kind: 'rec', sid: 'r-schi' });
assert.strictEqual(h.items[0].action, 'возврат'); assert.strictEqual(h.items.length, 4);
// чужие позиции в историю не попадают, вид проверяется
assert.ok(get(A, { a: 'hist', kind: 'ing', sid: 'i-lukk' }).items.every(x => x.action === 'опубликовано'));
assert.strictEqual(getRaw(A, { a: 'hist', kind: 'zzz', sid: 'r-schi' }).data.err, 'kind');
assert.strictEqual(getRaw(A, { a: 'hist', kind: 'rec', sid: 'x' }).data.err, 'sid');
// только технолог
assert.strictEqual(get(E, { a: 'hist', kind: 'rec', sid: 'r-schi' }).err, 'admin');
assert.strictEqual(get(null, { a: 'hist', kind: 'rec', sid: 'r-schi' }).err, 'code');
console.log('GAS pub OK');
