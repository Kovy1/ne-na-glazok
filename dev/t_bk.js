/* Копия данных на Диске: снимок, проверка, применение, состояния, подпись браузера (чистая часть) */
const fs = require('fs'), assert = require('assert');
const src = fs.readFileSync('kbzhu.html', 'utf8');
const Y = (function () {
  eval(src.slice(src.indexOf('/*PURE-START*/'), src.indexOf('/*PURE-END*/')));
  return { bkWho, bkSnap, bkCounts, bkCheck, bkApply, bkState, bkBase, bkLabelOf, BK_LS, BK_VER, normIng, normRecipe };
})();

// ---------- чья копия ----------
assert.strictEqual(Y.bkWho('admin', '  Иванов  Иван '), 'admin|иванов иван');
assert.strictEqual(Y.bkWho('editor', 'ИВАНОВ иван'), 'editor|иванов иван');
assert.notStrictEqual(Y.bkWho('admin', 'Иванов'), Y.bkWho('editor', 'Иванов'));

// ---------- снимок ----------
const ings = { a: Y.normIng({ name: 'Лук', p: 1, f: 0, c: 9, kind: 'table', price: 44 }) };
const recipes = { r1: Y.normRecipe({ name: 'Борщ', output: 250, rows: [{ rid: 'x', ing: 'a', net: 50, share: 100 }], ref: {}, ttk: {} }) };
const cfg = { regions: { list: [{ id: 'main', name: 'Волгоград' }] }, menu: { cats: [] } };
const snap = Y.bkSnap({ at: 111, dev: 'd1', ings, recipes, cfg, map: { ing: { a: { sid: 'S1', rev: 3, h: 'h' } }, rec: {} }, gone: { 'rec|X': 1 }, rev: 40, hm: 'np',
  ls: { 'kbzhu:links': '{"a":1}', 'kbzhu:region': 'msk', 'kbzhu:tab': 'sync', 'kbzhu:sync': 'секрет', 'kbzhu:c1rule': 5 } });
assert.strictEqual(snap.v, Y.BK_VER); assert.strictEqual(snap.dev, 'd1');
assert.deepStrictEqual(Object.keys(snap.ls).sort(), ['kbzhu:links', 'kbzhu:region'], 'в копию идут только перечисленные личные настройки (строками)');
assert.strictEqual(snap.sync.rev, 40); assert.strictEqual(snap.sync.hm, 'np');
const text = JSON.stringify(snap);
assert.ok(!/секрет/.test(text), 'подключение (адрес, ФИО, код) в копию не попадает');
assert.deepStrictEqual(Y.bkCounts(snap), { ings: 1, recipes: 1 });
assert.strictEqual(Y.bkSnap({ at: 1, dev: 'x', ings: {}, recipes: {}, cfg: {}, map: {}, gone: {}, rev: 'abc', hm: 'zzz' }).sync.rev, 0);
assert.strictEqual(Y.bkSnap({ at: 1, dev: 'x', ings: {}, recipes: {}, cfg: {}, map: {}, gone: {}, hm: 'zzz' }).sync.hm, '');

// ---------- проверка присланного ----------
let r = Y.bkCheck(text); assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.snap.ings.a.name, 'Лук');
assert.strictEqual(Y.bkCheck(snap).ok, true, 'объект тоже подходит');
for (const bad of ['', '{', 'null', '[]', '123', '{"v":1}', '{"v":1,"ings":{},"recipes":{}}', '{"v":1,"ings":[],"recipes":{},"cfg":{}}', JSON.stringify({ v: 'x', ings: {}, recipes: {}, cfg: {} })]) {
  r = Y.bkCheck(bad); assert.strictEqual(r.ok, false, 'отклонено: ' + bad); assert.ok(r.msg.length > 10);
}
r = Y.bkCheck(JSON.stringify({ v: Y.BK_VER + 1, ings: {}, recipes: {}, cfg: {} })); assert.strictEqual(r.ok, false); assert.ok(/новой версией/.test(r.msg));
assert.strictEqual(Y.bkCheck(JSON.stringify({ v: 1, ings: {}, recipes: {}, cfg: {} })).ok, true, 'пустая, но целая копия допустима');

// ---------- применение: подключение остаётся своим ----------
const curCfg = { url: 'https://script.google.com/macros/s/AAA/exec', name: 'Технолог', code: 'adm-5678', auto: true, rev: 5, role: 'admin', mapUrl: 'm', ptr: 'p', hm: '', pfAuto: false, bkAuto: false, bkRev: 2, bkWho: 'admin|технолог', bkDirty: true, bkDev: 'dB', bkAt: 5 };
const plan = Y.bkApply(snap, { cfg: curCfg, map: { ing: {}, rec: {} }, gone: {} }, { rev: 7, who: 'admin|технолог', at: 999, dirty: false });
const v1 = JSON.parse(plan.v1);
assert.deepStrictEqual(Object.keys(v1).sort(), ['cfg', 'ings', 'recipes']); assert.strictEqual(v1.ings.a.name, 'Лук'); assert.strictEqual(v1.recipes.r1.name, 'Борщ'); assert.deepStrictEqual(v1.cfg, cfg);
const sc = plan.sync.cfg;
assert.strictEqual(sc.url, curCfg.url); assert.strictEqual(sc.code, 'adm-5678'); assert.strictEqual(sc.name, 'Технолог'); assert.strictEqual(sc.role, 'admin'); assert.strictEqual(sc.ptr, 'p');
assert.strictEqual(sc.pfAuto, false, 'свои переключатели остаются'); assert.strictEqual(sc.bkAuto, false); assert.strictEqual(sc.bkDev, 'dB', 'номер браузера остаётся своим');
assert.strictEqual(sc.rev, 40, 'версия общей базы — как в копии, вместе со связями'); assert.strictEqual(sc.hm, 'np');
assert.strictEqual(sc.bkRev, 7); assert.strictEqual(sc.bkDirty, false); assert.strictEqual(sc.bkAt, 999); assert.strictEqual(sc.bkWho, 'admin|технолог');
assert.deepStrictEqual(plan.sync.map, { ing: { a: { sid: 'S1', rev: 3, h: 'h' } }, rec: {} }); assert.deepStrictEqual(plan.sync.gone, { 'rec|X': 1 });
assert.deepStrictEqual(plan.ls, { 'kbzhu:links': '{"a":1}', 'kbzhu:region': 'msk' });
assert.strictEqual(curCfg.rev, 5, 'исходные настройки не тронуты');
assert.strictEqual(Y.bkApply(snap, { cfg: curCfg }, { rev: 8, who: 'w', at: 1, dirty: true }).sync.cfg.bkDirty, true, 'предыдущую копию вернули: её надо записать как новую');
const old = Y.bkApply({ ings: {}, recipes: {}, cfg: {} }, { cfg: curCfg }, { rev: 1, who: 'w', at: 1 });
assert.deepStrictEqual(old.sync.map, { ing: {}, rec: {} }); assert.deepStrictEqual(old.sync.gone, {}); assert.deepStrictEqual(old.ls, {}); assert.strictEqual(old.sync.cfg.rev, 0);

// ---------- состояния ----------
const C = (o = {}) => Object.assign({ linked: true, rev: 3, dirty: false, dev: 'dA', cloud: { rev: 3, dev: 'dA' } }, o);
assert.strictEqual(Y.bkState(C({ linked: false, cloud: null })), 'none', 'копии нет, браузер ни с чем не сверен');
assert.strictEqual(Y.bkState(C({ linked: false })), 'free', 'копия есть, браузер не сверен');
assert.strictEqual(Y.bkState(C()), 'ok');
assert.strictEqual(Y.bkState(C({ dirty: true })), 'push');
assert.strictEqual(Y.bkState(C({ cloud: { rev: 4, dev: 'dB' } })), 'behind', 'в другом браузере записали новее');
assert.strictEqual(Y.bkState(C({ cloud: { rev: 4, dev: 'dB' }, dirty: true })), 'conflict', 'правки и тут, и там');
assert.strictEqual(Y.bkState(C({ cloud: { rev: 4, dev: 'dA' } })), 'ok', 'новее, но записал этот же браузер (ответ не дошёл)');
assert.strictEqual(Y.bkState(C({ cloud: { rev: 4, dev: 'dA' }, dirty: true })), 'push');
assert.strictEqual(Y.bkState(C({ cloud: null })), 'push', 'копию с Диска удалили: запишем заново');
assert.strictEqual(Y.bkState(C({ cloud: { rev: 2, dev: 'dB' } })), 'behind', 'копию откатили на предыдущую: тоже не наша');
assert.strictEqual(Y.bkState(C({ dev: '', cloud: { rev: 4, dev: '' } })), 'behind', 'пустой номер браузера никого не «узнаёт»');

// ---------- версия, поверх которой можно писать ----------
assert.strictEqual(Y.bkBase(C()), 3);
assert.strictEqual(Y.bkBase(C({ cloud: { rev: 6, dev: 'dA' } })), 6, 'своя запись: база — её версия');
assert.strictEqual(Y.bkBase(C({ cloud: { rev: 6, dev: 'dB' } })), 3, 'чужая запись: база прежняя, сервер откажет');
assert.strictEqual(Y.bkBase(C({ cloud: null })), 0);

// ---------- подпись браузера ----------
const ua = {
  'Chrome · Windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
  'Edge · Windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0',
  'Яндекс Браузер · Windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 YaBrowser/24.10.0.0 Safari/537.36',
  'Firefox · Linux': 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0',
  'Safari · Mac': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
  'Chrome · Android': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  'Safari · iOS': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  'Opera · Windows': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 OPR/115.0.0.0'
};
Object.keys(ua).forEach(k => assert.strictEqual(Y.bkLabelOf(ua[k]), k));
assert.strictEqual(Y.bkLabelOf(''), 'Браузер'); assert.strictEqual(Y.bkLabelOf(undefined), 'Браузер');
console.log('bk pure ok');
