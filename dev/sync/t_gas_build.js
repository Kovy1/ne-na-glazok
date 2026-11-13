/* номер сборки страницы на ссылке: берётся из файла при загрузке, отдаётся в ping (по коду и без) и в меню без кода */
const assert = require('assert'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234';
const g = createGas({});
const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const page = bld => '<!doctype html><html><head><meta charset="utf-8"></head><body><script>window.KBZHU_SEED={};window.KBZHU_RELEASE=1;' + (bld ? 'window.KBZHU_BUILD=' + bld + ';' : '') + '</script>' + 'Борщ · '.repeat(9000) + '<script>var x=1;</script></body></html>';
const put = (html, code) => post({ op: 'pagePut', code: code || A, by: 'Технолог', html });

assert.strictEqual(get(null, { a: 'ping' }).v, 30, 'версия скрипта 30');
// до загрузки страницы номера нет
let p = get(null, { a: 'ping' }); assert.strictEqual(p.pgb, 0); assert.strictEqual(p.pga, 0);
assert.strictEqual(get(null, { a: 'menu' }).pgb, 0);
assert.strictEqual(get(A, { a: 'pageinfo' }).bld, 0);

// загрузка: номер берётся из файла
let r = put(page(202610231640)); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.bld, 202610231640);
p = get(null, { a: 'ping' }); assert.strictEqual(p.pgb, 202610231640, 'ping отдаёт номер без кода'); assert.ok(Math.abs(p.pga - Date.now()) < 60000);
assert.strictEqual(get(A, { a: 'pageinfo' }).bld, 202610231640);
assert.strictEqual(get(null, { a: 'menu' }).pgb, 202610231640, 'меню без кода тоже отдаёт номер');
// кэш меню не держит старый номер: новая страница — новый номер сразу
get(null, { a: 'menu' });
r = put(page(202611011200)); assert.strictEqual(r.ok, true);
assert.strictEqual(get(null, { a: 'menu' }).pgb, 202611011200, 'меню после загрузки новой страницы');
assert.strictEqual(get(E, { a: 'ping' }).pgb, 202611011200);
// файл без номера (старая сборка): номер 0, страница принимается
r = put(page(0)); assert.strictEqual(r.ok, true); assert.strictEqual(r.bld, 0); assert.strictEqual(get(null, { a: 'ping' }).pgb, 0);
// чужой код страницу не грузит
r = put(page(202611011200), E); assert.strictEqual(r.ok, false);
console.log('GAS build ok');
