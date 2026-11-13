/* Справочники (версия 26): точки и юридические лица. Права, регионы, проверки реквизитов, защита от параллельной правки */
const assert = require('assert'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234', F = 'fin-9012', V = 'view-3456', U = 'aud-7788';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const g = createGas({ rs: { editor: ['main'], finance: ['msk'], viewer: ['main', 'msk'], audit: [] } });
const get = (code, p) => g.parseOut(g.get(Object.assign({ code, who: 'Тест' }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: rid() }, b)).text);
const put = (code, kind, j, o) => post(Object.assign({ op: 'dirput', code, by: 'Тест', kind, j }, o || {}));

assert.deepStrictEqual(get(A, { a: 'dir' }).pts, []); assert.strictEqual(get(null, { a: 'dir' }).err, 'code');

// юрлица ведёт только технолог
assert.strictEqual(put(E, 'le', { name: 'ООО Ромашка' }).err, 'admin');
assert.strictEqual(put(F, 'le', { name: 'ООО Ромашка' }).err, 'admin');
assert.strictEqual(put(V, 'le', { name: 'ООО Ромашка' }).err, 'role');
let le = put(A, 'le', { name: 'Ромашка', org: 'ООО «Ромашка»', head: 'Директор', headName: 'Иванов И.И.', inn: '3444 123 456', kpp: '344401001', ogrn: '1123456789012', addr: 'г. Волгоград', regs: ['main'] });
assert.strictEqual(le.ok, true, JSON.stringify(le)); assert.strictEqual(le.item.inn, '3444123456', 'пробелы в ИНН убраны'); assert.strictEqual(le.item.ver, 1);
const le2 = put(A, 'le', { name: 'Лютик ИП', org: 'ИП Петров П.П.', inn: '344412345678', ogrn: '312345678901234' });
assert.strictEqual(le2.ok, true, JSON.stringify(le2));
// проверки реквизитов
assert.strictEqual(put(A, 'le', { name: 'X1', inn: '123' }).err, 'inn');
assert.strictEqual(put(A, 'le', { name: 'X2', kpp: '1' }).err, 'kpp');
assert.strictEqual(put(A, 'le', { name: 'X3', ogrn: '12' }).err, 'ogrn');
assert.strictEqual(put(A, 'le', { name: '  ' }).err, 'name');
assert.strictEqual(put(A, 'le', { name: ' ромашка ' }).err, 'dup', 'дубль названия без учёта регистра и пробелов');
assert.strictEqual(put(A, 'zzz', { name: 'x' }).err, 'kind');

// точки: заводят технолог, редактор и тер. управляющий в своих регионах
assert.strictEqual(put(V, 'pt', { name: 'Т1', region: 'main' }).err, 'role');
assert.strictEqual(put(U, 'pt', { name: 'Т1', region: 'main' }).err, 'role');
assert.strictEqual(put(E, 'pt', { name: 'Центр', region: 'msk' }).err, 'region', 'редактору назначен только main');
assert.strictEqual(put(F, 'pt', { name: 'Арбат', region: 'main' }).err, 'region', 'тер. управляющему назначена только msk');
assert.strictEqual(put(A, 'pt', { name: 'Без региона', region: '' }).err, 'region');
assert.strictEqual(put(A, 'pt', { name: 'Точка', region: 'main', le: 'нет-такого' }).err, 'le');
const p1 = put(E, 'pt', { name: 'Центр', region: 'main', address: 'пр. Ленина, 1', le: le.item.id }); assert.strictEqual(p1.ok, true, JSON.stringify(p1));
assert.ok(/^p[0-9a-f]{8}$/.test(p1.item.id)); assert.strictEqual(p1.item.active, true);
const p2 = put(F, 'pt', { name: 'Арбат', region: 'msk', address: 'Арбат, 5' }); assert.strictEqual(p2.ok, true, JSON.stringify(p2));
assert.strictEqual(put(E, 'pt', { name: ' центр ', region: 'main' }).err, 'dup', 'дубль в регионе');
assert.strictEqual(put(A, 'pt', { name: 'Центр', region: 'msk' }).ok, true, 'то же название в другом регионе — можно');

// видимость: точки по регионам, юрлица по регионам (пусто — везде)
const dA = get(A, { a: 'dir' }), dE = get(E, { a: 'dir' }), dF = get(F, { a: 'dir' }), dV = get(V, { a: 'dir' }), dU = get(U, { a: 'dir' });
assert.strictEqual(dA.pts.length, 3); assert.deepStrictEqual(dE.pts.map(p => p.name), ['Центр']); assert.deepStrictEqual(dF.pts.map(p => p.region).sort(), ['msk', 'msk']);
assert.strictEqual(dV.pts.length, 3); assert.deepStrictEqual(dU.pts, []);
assert.deepStrictEqual(dE.les.map(x => x.name), ['Ромашка', 'Лютик ИП'], 'юрлицо с регионом main и юрлицо «везде»');
assert.deepStrictEqual(dF.les.map(x => x.name), ['Лютик ИП'], 'юрлицо только main москвичу не видно');
assert.ok(dA.rev >= 4);

// менять существующую точку (в т.ч. отключать) — технолог; конфликт версий не затирает чужую правку
assert.strictEqual(put(E, 'pt', { name: 'Центр 2', region: 'main' }, { id: p1.item.id, base: 1 }).err, 'admin');
const u1 = put(A, 'pt', { name: 'Центр', region: 'main', address: 'пр. Ленина, 2', le: le.item.id }, { id: p1.item.id, base: 1 });
assert.strictEqual(u1.ok, true, JSON.stringify(u1)); assert.strictEqual(u1.item.ver, 2);
const cf = put(A, 'pt', { name: 'Центр', region: 'main', address: 'устаревшая правка' }, { id: p1.item.id, base: 1 });
assert.strictEqual(cf.ok, false); assert.strictEqual(cf.err, 'conflict'); assert.strictEqual(cf.cur.address, 'пр. Ленина, 2', 'вернулась свежая запись');
assert.strictEqual(get(A, { a: 'dir' }).pts.find(p => p.id === p1.item.id).address, 'пр. Ленина, 2');
const off = put(A, 'pt', { name: 'Центр', region: 'main', address: 'пр. Ленина, 2', active: false }, { id: p1.item.id, base: 2 });
assert.strictEqual(off.item.active, false); assert.strictEqual(off.item.ver, 3);
assert.strictEqual(put(A, 'pt', { name: 'Ч', region: 'main' }, { id: 'p-нет-такого', base: 1 }).err, 'id');
assert.strictEqual(put(A, 'pt', { name: 'Ч', region: 'main' }, { id: 'pnonexist1', base: 1 }).err, 'nodoc');
// юрлицо: переименование и отключение не ломают точки
const lu = put(A, 'le', { name: 'Ромашка', org: 'ООО «Ромашка-2»', inn: '3444123456', regs: ['main'] }, { id: le.item.id, base: 1 });
assert.strictEqual(lu.ok, true, JSON.stringify(lu)); assert.strictEqual(lu.item.org, 'ООО «Ромашка-2»');
// старый клиент без base не затирает
assert.strictEqual(put(A, 'le', { name: 'Ромашка', org: 'старое' }, { id: le.item.id }).err, 'conflict');
// журнал фиксирует изменения справочников
assert.ok(get(A, { a: 'log', n: 50 }).items.some(x => /справочник/.test(x.act || x.action || JSON.stringify(x))));
console.log('GAS dir ok');
