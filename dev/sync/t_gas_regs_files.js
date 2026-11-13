/* Регионы (версия 26): файлы ТТК, файлы цен, история цен и копии данных режутся по назначенным регионам на сервере */
const assert = require('assert'), vm = require('vm'), zlib = require('zlib'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const mkDocx = tag => { const b = Buffer.alloc(1200 + (++n), 7); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4; b.write(tag, 10); return b.toString('base64'); };
const g = createGas({ rs: {} }); vm.runInContext('setup()', g.ctx);
const get = (code, who, p) => g.parseOut(g.get(Object.assign({ code, who }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: rid() }, b)).text);
const mku = (name, regs) => post({ op: 'usradd', code: A, by: 'Технолог', name, role: 'editor', own: false, regs }).code;
const cV = mku('Волгоградов В.В.', ['main']), cM = mku('Москвин М.М.', ['msk']), cN = mku('Новичков Н.Н.');
const W = 'Волгоградов В.В.', M = 'Москвин М.М.', N = 'Новичков Н.Н.';
const nameOf = { [cV]: W, [cM]: M, [cN]: N };
const up = (code, name, reg) => post({ op: 'upload', code, by: nameOf[code] || 'Технолог', name, reg, regName: reg === 'msk' ? 'Москва' : 'Волгоград', b64: mkDocx(name) });

// ----- файлы ТТК
const fa = up(A, 'ТТК №1 Борщ.docx', 'main'), fb = up(A, 'ТТК №2 Хачапури.docx', 'msk');
assert.ok(fa.ok && fb.ok, JSON.stringify([fa, fb]));
const names = (code, who) => get(code, who, { a: 'files', fresh: 1 }).files.filter(x => x.kind === 'main').map(x => x.name).sort();
assert.deepStrictEqual(names(A, 'Технолог'), ['ТТК №1 Борщ.docx', 'ТТК №2 Хачапури.docx']);
assert.deepStrictEqual(names(cV, W), ['ТТК №1 Борщ.docx']);
assert.deepStrictEqual(names(cM, M), ['ТТК №2 Хачапури.docx']);
assert.deepStrictEqual(names(cN, N), [], 'без назначения чужих файлов нет');
assert.deepStrictEqual(get(cV, W, { a: 'files' }).regs.map(r => r.id), ['main']);
// открыть файл чужого региона по ид нельзя
assert.strictEqual(get(cV, W, { a: 'file', id: fb.id }).err, 'nofile');
assert.strictEqual(get(cN, N, { a: 'file', id: fa.id }).err, 'nofile');
assert.strictEqual(get(cV, W, { a: 'file', id: fa.id }).ok, true);
// загрузить файл в чужой регион нельзя, в свой можно
assert.strictEqual(up(cV, 'ТТК №3 Подмена.docx', 'msk').err, 'region');
assert.strictEqual(up(cN, 'ТТК №4 Новичок.docx', 'main').err, 'region');
assert.strictEqual(up(cV, 'ТТК №5 Окрошка.docx', 'main').ok, true);

// ----- история цен
const rec = (region) => ({ region, from: '2026-09-01', to: '2026-09-30', at: 1760000000000, file: 'в.xlsx', rule: 'avg', sup: ['П'], it: [{ ing: 'i-aaa', nm: 'Лук', pr: 40, ln: [['2026-09-03', 0, 40, 10]] }] });
assert.strictEqual(post({ op: 'phput', code: A, by: 'Технолог', id: 'ph_main_20260901_20260930', rec: rec('main') }).ok, true);
assert.strictEqual(post({ op: 'phput', code: A, by: 'Технолог', id: 'ph_msk_20260901_20260930', rec: rec('msk') }).ok, true);
assert.deepStrictEqual(get(A, 'Технолог', { a: 'phlist' }).items.map(x => x.region).sort(), ['main', 'msk']);
assert.deepStrictEqual(get(cV, W, { a: 'phlist' }).items.map(x => x.region), ['main']);
assert.deepStrictEqual(get(cN, N, { a: 'phlist' }).items, []);
assert.strictEqual(get(cV, W, { a: 'phget', id: 'ph_msk_20260901_20260930' }).err, 'nofile', 'чужую запись истории не открыть даже по ид');
assert.strictEqual(get(cV, W, { a: 'phget', id: 'ph_main_20260901_20260930' }).ok, true);
assert.strictEqual(post({ op: 'phput', code: cV, by: W, id: 'ph_msk_20261001_20261031', rec: rec('msk') }).err, 'region', 'записать чужую историю нельзя');
assert.strictEqual(post({ op: 'phput', code: cN, by: N, id: 'ph_main_20261001_20261031', rec: rec('main') }).err, 'region');

// ----- файлы цен
const xl = tag => Buffer.concat([Buffer.from('PK'), Buffer.alloc(300, tag.charCodeAt(0))]).toString('base64');
const pub = [{ name: 'Цены продажи', title: 'Цены', note: '', head: ['Раздел', 'Блюдо', 'ТТК №', 'Выход, г', 'Цена продажи, ₽'], fmt: ['text', 'text', 'text', 'int', 'money'], widths: [100, 200, 60, 60, 90], rows: [['Супы', 'Борщ', '1', 300, 250]] }];
const prv = [{ name: 'Блюда', title: 'Блюда', note: '', head: ['Раздел', 'Блюдо', 'ТТК №', 'Выход, г', 'Себестоимость порции, ₽', 'Цена продажи, ₽'], fmt: ['text', 'text', 'text', 'int', 'money', 'money'], widths: [100, 200, 60, 60, 90, 90], rows: [['Супы', 'Борщ', '1', 300, 80, 250]] }];
const pp = (region, name) => post({ op: 'pricesPublish', code: A, by: 'Технолог', region: { id: region, name }, hash: 'h-' + region + 'abc', pub, prv, xlsxPub: xl('p'), xlsxPrv: xl('v'), nDishes: 1, nSold: 1, nIngs: 1 });
assert.strictEqual(pp('main', 'Волгоград').ok, true); assert.strictEqual(pp('msk', 'Москва').ok, true);
assert.deepStrictEqual(get(A, 'Технолог', { a: 'prices' }).regions.map(r => r.id).sort(), ['main', 'msk']);
assert.deepStrictEqual(get(cV, W, { a: 'prices' }).regions.map(r => r.id), ['main']);
assert.deepStrictEqual(get(cN, N, { a: 'prices' }).regions, []);
assert.deepStrictEqual(get(cV, W, { a: 'parch', id: 'msk' }).files, [], 'архив чужого региона пуст');
// файл Excel чужого региона не отдаётся по ид
const rm = get(A, 'Технолог', { a: 'prices' }).regions.find(r => r.id === 'msk'), rmain = get(A, 'Технолог', { a: 'prices' }).regions.find(r => r.id === 'main');
const mskP = rm.pub.x, mskV = rm.prv.x, mainP = rmain.pub.x;
assert.ok(mskP && mskV && mainP, 'ид Excel-файлов есть');
assert.strictEqual(get(cV, W, { a: 'pfile', id: mskP }).err, 'nofile', 'Excel чужого региона не отдаётся');
assert.strictEqual(get(cV, W, { a: 'pfile', id: mskV }).err, 'nofile');
assert.strictEqual(get(cN, N, { a: 'pfile', id: mainP }).err, 'nofile', 'без назначения Excel не отдаётся');
assert.strictEqual(get(cV, W, { a: 'pfile', id: mainP }).ok, true, 'свой регион отдаётся');
assert.strictEqual(get(A, 'Технолог', { a: 'pfile', id: mskP }).ok, true);

// ----- копии данных: у общего кода ключ — секрет устройства, а не ФИО
const tok = s => 'tok-' + Buffer.from(String(s)).toString('hex').padEnd(16, '0').slice(0, 48);
const bk = (code, by, bkt, o) => post(Object.assign({ op: 'bkput', code, by, bkt, dev: 'devA1', label: 'Chrome', base: 0, enc: 'gz', data: zlib.gzipSync(JSON.stringify({ v: 1, x: 1 })).toString('base64'), n: { ings: 1, recipes: 1 } }, o || {}));
const bi = (code, by, bkt) => get(code, by, { a: 'bkinfo', bkt });
// общий код редактора с регионом main
assert.strictEqual(post({ op: 'rssc', code: A, by: 'Технолог', role: 'editor', regs: ['main'] }).ok, true);
{ const r = bk(E, 'Иван', tok('devA-секрет')); assert.strictEqual(r.ok, true, JSON.stringify(r)); }
assert.strictEqual(bi(E, 'Иван', tok('devA-секрет')).has, true);
assert.strictEqual(bi(E, 'Иван', tok('чужой-секрет')).has, false, 'ФИО без секрета устройства копию не открывает');
assert.strictEqual(bi(E, 'Иван', 'коротко').err, 'bkt');
assert.strictEqual(get(E, 'Иван', { a: 'bkget', bkt: tok('чужой-секрет') }).err, 'nocopy');
// именной пользователь: ключ — его ид, чужая копия недоступна
assert.strictEqual(bk(cV, W, tok('любой-секрет-1')).ok, true);
assert.strictEqual(bi(cV, W, tok('любой-секрет-2')).has, true, 'именной пользователь: по ид учётной записи, секрет устройства не требуется');
assert.strictEqual(bi(cM, M, tok('любой-секрет-1')).has, false, 'копию другого пользователя не видно');
console.log('GAS regs files ok');
