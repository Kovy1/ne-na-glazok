/* v14: публичное меню для экрана до входа: название, выход, цена продажи, папки и регионы; без состава и закупочных цен */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678';
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
vm.runInContext('setup()', g.ctx);
assert.strictEqual(get(null, { a: 'ping' }).v, 31);
let m = get(null, { a: 'menu' });
assert.strictEqual(m.ok, true); assert.deepStrictEqual(m.items, []); assert.ok(m.regs.length >= 1 && m.regs[0].id && m.regs[0].name);
const ing = (name, o) => Object.assign({ name, p: 1, f: 1, c: 1, kind: 'table', source: '' }, o);
const items = [
  { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 0, json: ing('Лук', { price: 130, priceUnit: 'kg', packG: 1000 }) },
  { kind: 'rec', sid: 'r-111', name: 'Суп с луком', baseRev: 0, json: { name: 'Суп с луком', output: 250, rows: [{ ing: 'i-aaa', in: 'Лук', net: 50, share: 100 }], ref: {}, ttk: { num: '15' }, sell: { main: 180, msk: 210 } } },
  { kind: 'rec', sid: 'r-222', name: 'Без цены', baseRev: 0, json: { name: 'Без цены', output: 100, rows: [{ ing: 'i-aaa', in: 'Лук', net: 10, share: 100 }], ref: {}, ttk: {} } },
  { kind: 'rec', sid: 'r-333', name: 'Только Москва', baseRev: 0, json: { name: 'Только Москва', output: 120, reg: 'msk', rows: [{ ing: 'i-aaa', in: 'Лук', net: 10, share: 100 }], ref: {}, ttk: { num: '7' }, sell: { msk: 99.5 } } },
];
assert.ok(post({ op: 'publish', code: A, by: 'Технолог', items }).ok);
m = get(null, { a: 'menu' });
console.log(JSON.stringify(m).slice(0, 500));
assert.deepStrictEqual(m.items.map(x => x.n).sort(), ['Суп с луком', 'Только Москва'], 'без цены продажи блюдо не попадает');
const soup = m.items.find(x => x.n === 'Суп с луком');
assert.deepStrictEqual(soup, { s: 'r-111', n: 'Суп с луком', o: 250, t: '15', g: '', p: { main: 180, msk: 210 } });
assert.strictEqual(m.items.find(x => x.n === 'Только Москва').g, 'msk');
// ничего лишнего: ни закупочных цен, ни состава, ни себестоимости
const txt = JSON.stringify(m);
assert.ok(!/130|priceUnit|packG|rows|Лук/.test(txt.replace('Суп с луком', '')), 'в ответе нет сырья и закупочных цен: ' + txt);
// удалённое из общей базы пропадает из меню
assert.ok(post({ op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'rec', sid: 'r-333', name: 'Только Москва', baseRev: 1, json: { _del: 1 } }] }).ok);
m = get(null, { a: 'menu' }); assert.deepStrictEqual(m.items.map(x => x.n), ['Суп с луком']);
// остальные данные по-прежнему только по коду
assert.strictEqual(get(null, { a: 'pull', since: '0' }).ok, false);
assert.strictEqual(get(null, { a: 'pull', since: '0' }).err, 'code');
console.log('GAS menu ok');
