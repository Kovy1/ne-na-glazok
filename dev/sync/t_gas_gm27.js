/* v27: гостевое меню по умолчанию — только допущенные блюда: не архив, не «на проработке»/внутренние, выход указан */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234';
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
vm.runInContext('setup()', g.ctx);
const rec = (sid, name, o) => ({ kind: 'rec', sid, name, baseRev: 0, json: Object.assign({ name, output: 100, rows: [], ref: {}, ttk: {} }, o || {}) });
assert.ok(post({ op: 'publish', code: A, by: 'Технолог', items: [
  rec('r-ok', 'Борщ', { sell: { main: 200 } }), rec('r-arch', 'Старый суп', { sell: { main: 150 } }), rec('r-work', 'Новинка', { sell: { main: 300 } }),
  rec('r-int', 'Для персонала', { sell: { main: 90 } }), rec('r-noout', 'Без выхода', { sell: { main: 120 }, output: 0 }), rec('r-also', 'Салат', { sell: { main: 140 } }),
] }).ok);
const names = () => get(null, { a: 'menu' }).items.map(x => x.n).sort();
assert.deepStrictEqual(names(), ['Борщ', 'Для персонала', 'Новинка', 'Салат', 'Старый суп'], 'выход 0 → блюда нет; папки и архив ещё не переданы')
// папки «На проработке» и «Внутренние» + архив
let r = post({ op: 'layPut', code: A, by: 'Технолог', cats: [{ n: 'Первые', r: ['r-ok'] }, { n: 'На проработке', r: ['r-work'] }, { n: 'Внутренние блюда', r: ['r-int'] }], archOn: ['r-arch'] });
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.deepStrictEqual(r.arch, ['r-arch']);
assert.deepStrictEqual(names(), ['Борщ', 'Салат'], 'архив, проработка, внутренние и без выхода скрыты');
assert.deepStrictEqual(get(A, { a: 'lay' }).arch, ['r-arch']);
// только технолог меняет архив
const x = post({ op: 'layPut', code: E, by: 'Редактор', archOff: ['r-arch'] }); assert.strictEqual(x.ok, false); assert.strictEqual(x.err, 'admin');
// блюдо вернули из архива
r = post({ op: 'layPut', code: A, by: 'Технолог', archOff: ['r-arch'] }); assert.deepStrictEqual(r.arch, []);
assert.deepStrictEqual(names(), ['Салат', 'Старый суп', 'Борщ'].sort());
// повтор без изменений — без нового номера
const rv = get(A, { a: 'lay' }).rev; r = post({ op: 'layPut', code: A, by: 'Технолог', archOff: ['r-arch'] }); assert.strictEqual(r.same, true); assert.strictEqual(get(A, { a: 'lay' }).rev, rv);
// папки пересохранили, не передав архив — архив сохранился
post({ op: 'layPut', code: A, by: 'Технолог', archOn: ['r-arch'] });
post({ op: 'layPut', code: A, by: 'Технолог', cats: [{ n: 'Первые', r: ['r-ok', 'r-also'] }] });
assert.deepStrictEqual(get(A, { a: 'lay' }).arch, ['r-arch'], 'правка папок не сбросила архив');
assert.deepStrictEqual(names(), ['Борщ', 'Для персонала', 'Новинка', 'Салат'].sort(), 'без папки «на проработке» блюда снова допущены (кроме архива и без выхода)');
// ручной режим: решает технолог, список как отметил
r = post({ op: 'layPut', code: A, by: 'Технолог', gm: ['r-arch', 'r-ok'] }); assert.strictEqual(r.ok, true);
assert.deepStrictEqual(names(), ['Борщ', 'Старый суп'], 'в ручном режиме показано то, что отмечено');
assert.deepStrictEqual(get(A, { a: 'lay' }).arch, ['r-arch'], 'архив хранится и в ручном режиме');
post({ op: 'layPut', code: A, by: 'Технолог', gm: null }); assert.deepStrictEqual(names(), ['Борщ', 'Для персонала', 'Новинка', 'Салат'].sort());
console.log('GAS gm27 ok');
