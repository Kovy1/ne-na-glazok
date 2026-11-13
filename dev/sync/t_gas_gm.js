/* v25: гостевое меню по явному выбору технолога: список блюд для посетителей в хранилище папок меню; цена блюдо больше не публикует */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012', V = 'view-3456';
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
vm.runInContext('setup()', g.ctx);
const ing = (name, o) => Object.assign({ name, p: 1, f: 1, c: 1, kind: 'table', source: '' }, o);
const rec = (sid, name, o) => ({ kind: 'rec', sid, name, baseRev: 0, json: Object.assign({ name, output: 100, rows: [{ ing: 'i-aaa', in: 'Лук', net: 10, share: 100 }], ref: {}, ttk: {} }, o || {}) });
const items = [
  { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 0, json: ing('Лук', { price: 130, priceUnit: 'kg', packG: 1000 }) },
  rec('r-111', 'Суп с луком', { sell: { main: 180, msk: 210 }, ttk: { num: '15' } }),
  rec('r-222', 'Без цены'),
  rec('r-333', 'Только Москва', { reg: 'msk', sell: { msk: 300 } }),
  rec('r-444', 'В проработке', { sell: { main: 99 } }),
  rec('r-555', 'Салат', { sell: { main: 150 } }),
];
assert.ok(post({ op: 'publish', code: A, by: 'Технолог', items }).ok);
const names = m => m.items.map(x => x.n).sort();
// 1. до включения всё как раньше: видно каждое блюдо с ценой
assert.strictEqual(get(null, { a: 'ping' }).v, 30);
let m = get(null, { a: 'menu' }), l = get(A, { a: 'lay' });
assert.strictEqual(m.exp, false);
assert.deepStrictEqual(names(m), ['В проработке', 'Салат', 'Суп с луком', 'Только Москва']);
assert.strictEqual(l.ok, true); assert.strictEqual(l.gm, null); assert.deepStrictEqual(l.cats, []);
// 2. папки без списка блюд: список не появляется, прежнее хранение
let r = post({ op: 'layPut', code: A, by: 'Технолог', cats: [{ n: 'Первые блюда', r: ['r-111', 'r-444'] }, { n: 'Салаты', r: ['r-555'] }, { n: 'В проработке', r: ['r-444'] }] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.gm, null);
l = get(A, { a: 'lay' }); assert.strictEqual(l.gm, null); assert.strictEqual(l.cats.length, 3);
// 3. включение ручного выбора доступно только технологу
for (const c of [E, F, V]) {
  const x = post({ op: 'layPut', code: c, by: 'Кто-то', gm: ['r-111'] });
  assert.strictEqual(x.ok, false); assert.strictEqual(x.err, 'admin');
}
assert.strictEqual(get(A, { a: 'lay' }).gm, null, 'чужие попытки список не включили');
// 4. разовое изменение «добавить / убрать» без включённого режима не работает
r = post({ op: 'layPut', code: A, by: 'Технолог', gmOn: ['r-111'] });
assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'gm');
r = post({ op: 'layPut', code: A, by: 'Технолог', gmOff: ['r-111'] });
assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'gm');
// 5. включение: полный список (мусорные и повторяющиеся ид отбрасываются, порядок не важен)
r = post({ op: 'layPut', code: A, by: 'Технолог', gm: ['r-555', 'r-111', 'r-111', 'плохой ид', '', null, 'x/y'] });
assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.gm, ['r-111', 'r-555']);
m = get(null, { a: 'menu' }); l = get(A, { a: 'lay' });
assert.strictEqual(m.exp, true, 'клиент узнаёт, что включён ручной выбор');
assert.deepStrictEqual(names(m), ['Салат', 'Суп с луком'], 'блюдо с ценой, но не отмеченное, гостям не видно');
assert.deepStrictEqual(l.gm, ['r-111', 'r-555']);
assert.strictEqual(l.cats.length, 3, 'папки при включении сохранились');
// папки для гостей: только с показанными блюдами и только их блюда; «В проработке» в ответе нет совсем
assert.deepStrictEqual(m.cats, [{ n: 'Первые блюда', r: ['r-111'] }, { n: 'Салаты', r: ['r-555'] }]);
assert.ok(!JSON.stringify(m).includes('проработке'), 'название рабочей папки и неотмеченное блюдо не утекают');
// 6. добавить / убрать по одному: список других не затирается
r = post({ op: 'layPut', code: A, by: 'Технолог', gmOn: ['r-333', 'r-444'], gmOff: ['r-555'] });
assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.gm, ['r-111', 'r-333', 'r-444']);
m = get(null, { a: 'menu' });
assert.deepStrictEqual(names(m), ['В проработке', 'Суп с луком', 'Только Москва']);
assert.deepStrictEqual(m.cats.map(c => c.n), ['Первые блюда', 'В проработке'], 'Салаты остались без показанных блюд и пропали');
// 7. отмеченное блюдо без цены продажи гостям не показывается, но в списке остаётся
r = post({ op: 'layPut', code: A, by: 'Технолог', gmOn: ['r-222'] });
assert.deepStrictEqual(r.gm, ['r-111', 'r-222', 'r-333', 'r-444']);
m = get(null, { a: 'menu' });
assert.ok(!names(m).includes('Без цены'));
// 8. запись папок без списка блюд список не трогает (так делают калькуляторы, которые про него не знают)
r = post({ op: 'layPut', code: A, by: 'Технолог', cats: [{ n: 'Первые блюда', r: ['r-111'] }] });
assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.gm, ['r-111', 'r-222', 'r-333', 'r-444']);
l = get(A, { a: 'lay' }); assert.strictEqual(l.cats.length, 1); assert.deepStrictEqual(l.gm, ['r-111', 'r-222', 'r-333', 'r-444']);
// и наоборот: список без папок папки не трогает
r = post({ op: 'layPut', code: A, by: 'Технолог', gmOff: ['r-444'] });
assert.strictEqual(r.ok, true); l = get(A, { a: 'lay' });
assert.strictEqual(l.cats.length, 1); assert.deepStrictEqual(l.gm, ['r-111', 'r-222', 'r-333']);
// 9. повтор того же ничего не меняет
const rv = l.rev;
r = post({ op: 'layPut', code: A, by: 'Технолог', gmOn: ['r-111'] });
assert.strictEqual(r.same, true); assert.strictEqual(get(A, { a: 'lay' }).rev, rv);
// 10. удалённое из общей базы блюдо гостям не видно, даже если оно в списке
assert.ok(post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'rec', sid: 'r-333', name: 'Только Москва', baseRev: 1, json: { _del: 1 } }] }).ok);
assert.ok(!names(get(null, { a: 'menu' })).includes('Только Москва'));
// 11. вернуть показ по цене: список снимается, папки остаются, хранение снова прежнее
r = post({ op: 'layPut', code: A, by: 'Технолог', gm: null });
assert.strictEqual(r.ok, true); assert.strictEqual(r.gm, null);
m = get(null, { a: 'menu' }); l = get(A, { a: 'lay' });
assert.strictEqual(m.exp, false); assert.strictEqual(l.gm, null); assert.strictEqual(l.cats.length, 1);
assert.deepStrictEqual(names(m), ['В проработке', 'Салат', 'Суп с луком']);
const pr = g.ctx.PropertiesService.getScriptProperties();
assert.ok(Array.isArray(JSON.parse(pr.getProperty('lay0'))), 'без ручного выбора хранится прежний вид: просто список папок');
// 12. прежний вид хранения читается новой версией, список пустой — «никому не показывать»
r = post({ op: 'layPut', code: A, by: 'Технолог', gm: [] });
assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.gm, []);
m = get(null, { a: 'menu' }); assert.strictEqual(m.exp, true); assert.deepStrictEqual(m.items, []); assert.deepStrictEqual(m.cats, []);
// 13. в ответе без кода по-прежнему нет состава и закупочных цен
r = post({ op: 'layPut', code: A, by: 'Технолог', gm: ['r-111'] });
const txt = JSON.stringify(get(null, { a: 'menu' }));
assert.ok(!/130|priceUnit|packG|rows|Лук/.test(txt.replace('Суп с луком', '')), txt);
// 14. меню кэшируется: после правки списка гость сразу видит новое
get(null, { a: 'menu' });
post({ op: 'layPut', code: A, by: 'Технолог', gmOn: ['r-555'] });
assert.deepStrictEqual(names(get(null, { a: 'menu' })), ['Салат', 'Суп с луком']);
console.log('GAS gm ok');
