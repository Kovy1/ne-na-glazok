/* исправленная ТТК заменяет старый файл: прежний уходит в «Архив», новый встаёт на его место; история цен общая */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', V = 'view-3456', F = 'fin-9012';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const mkDocx = (size = 2000, tag = 'x') => { const b = Buffer.alloc(size, 7); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4; b.write(tag, 10); return b; };
const b64 = b => Buffer.from(b).toString('base64');
const g = createGas(); vm.runInContext('setup()', g.ctx);
const get = (p, code) => g.parseOut(g.get(Object.assign({ code: code || A }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: rid() }, b)).text);
const up = (name, o, code) => post(Object.assign({ op: 'upload', code: code || A, by: code === E ? 'Иван' : 'Технолог', name, b64: b64(mkDocx(1000 + (++n), 't' + n)) }, o || {}));
const files = (code) => get({ a: 'files', fresh: 1 }, code).files;
const byId = id => files().find(x => x.id === id);
const mk = (name, reg, dir) => { const r = up(name, { reg: reg || 'main', dir: dir || '', regName: reg === 'msk' ? 'Москва' : 'Волгоград' }); assert.ok(r.ok, JSON.stringify(r)); return r.id; };

// папки Волгограда: «4.Салаты» и «1.Первые блюда»
const dSal = post({ op: 'dcreate', code: A, by: 'T', name: '4.Салаты', reg: 'main', regName: 'Волгоград' }).id;
const dFirst = post({ op: 'dcreate', code: A, by: 'T', name: '1.Первые блюда', reg: 'main', regName: 'Волгоград' }).id;
assert.ok(dSal && dFirst);
assert.strictEqual(post({ op: 'dcreate', code: A, by: 'T', name: 'Архив' }).err, 'taken', 'имя «Архив» зарезервировано');

// ===== 1. технолог кладёт исправленный файл с другим именем и называет, что он заменяет (rep)
const old1 = mk('ТТК №11 Салат Коктейль 90 гр.docx', 'main', dSal);
let r = up('ТТК №11 Салат Коктейль.docx', { reg: 'main', regName: 'Волгоград', dir: dSal, rep: old1 });
assert.ok(r.ok && r.archived === 1, JSON.stringify(r));
let L = files();
assert.strictEqual(L.filter(x => x.kind === 'main' && /Коктейль/.test(x.name)).length, 1, 'в библиотеке одна версия');
assert.strictEqual(byId(r.id).dir, dSal, 'новая стоит в той же папке');
const a1 = byId(old1); assert.strictEqual(a1.kind, 'arch'); assert.strictEqual(a1.arch.name, 'ТТК №11 Салат Коктейль 90 гр.docx'); assert.strictEqual(a1.reg, 'main'); assert.strictEqual(a1.dir, dSal); assert.ok(/заменён/.test(a1.arch.why)); assert.strictEqual(a1.arch.by, 'Технолог');
assert.ok(/^ТТК №11 Салат Коктейль 90 гр \(до \d{4}-\d{2}-\d{2} \d{2}-\d{2}\)\.docx$/.test(a1.name), a1.name);
assert.ok(!get({ a: 'files' }).dirs.some(d => d.name === 'Архив'), 'архив не показывается как папка библиотеки');
assert.ok(g.rows('Журнал').some(x => /файл добавлен/.test(x[2]) && /В архив: ТТК №11 Салат Коктейль 90 гр\.docx/.test(x[5])), 'в журнале сказано про архив');

// ===== 2. без rep: единственный похожий файл региона (то же блюдо и номер) заменяется, остальные нет
const sib = mk('ТТК №11 Салат Витаминный 100 гр.docx', 'main', dSal);       // другое блюдо с тем же номером
const oth = mk('ТТК №12 Салат Коктейль 90 гр.docx', 'main', dSal);          // то же блюдо, другой номер
const msk = mk('ТТК №11 Салат Коктейль 90 гр.docx', 'msk', '');             // тот же файл в Москве
r = up('ТТК №11 Салат Коктейль 95 гр.docx', { reg: 'main', regName: 'Волгоград', dir: dSal });
assert.ok(r.ok && r.archived === 1, 'заменил единственного двойника: ' + JSON.stringify(r));
assert.strictEqual(byId(sib).kind, 'main'); assert.strictEqual(byId(oth).kind, 'main'); assert.strictEqual(byId(msk).kind, 'main', 'другой регион не трогается');
assert.strictEqual(byId(r.id).kind, 'main');
// несколько похожих: ничего не архивируется
const t1 = mk('ТТК №20 Борщ 250 гр.docx', 'main', dFirst);
const t2 = mk('ТТК №21 Борщ 300 гр.docx', 'main', '');
r = up('Борщ.docx', { reg: 'main', regName: 'Волгоград', dir: dFirst });
assert.strictEqual(r.archived, 0, 'похожих два: без явного указания ничего не заменяется'); assert.strictEqual(byId(t1).kind, 'main'); assert.strictEqual(byId(t2).kind, 'main');
// файл без номера заменяет только того, у кого совпадает порция
const n1 = mk('Уха домашняя 260 гр.docx', 'main', dFirst), n2 = mk('Уха сливочная 260 гр.docx', 'main', dFirst);
r = up('Уха домашняя 300 гр.docx', { reg: 'main', regName: 'Волгоград', dir: dFirst }); assert.strictEqual(r.archived, 0, 'порция другая и номера нет — это другая карта');
r = up('Уха домашняя 260 гр.docx', { reg: 'main', regName: 'Волгоград', dir: dFirst }); assert.strictEqual(r.archived, 1, 'то же имя: прежняя в архив'); assert.strictEqual(byId(n1).kind, 'arch');

// ===== 3. редактор: файл на проверку несёт, что исправляет; принятие кладёт новый на место старого
const base = mk('ТТК №30 Суп Кудрявый 250 гр.docx', 'main', dFirst);
r = up('ТТК №30 Суп Кудрявый.docx', { reg: 'main', dir: dSal, rep: base }, E);
assert.ok(r.ok && r.kind === 'pend', JSON.stringify(r));
const pend = byId(r.id); assert.strictEqual(pend.rep, base, 'в заявке указано, какой файл исправлен'); assert.strictEqual(byId(base).kind, 'main', 'до решения старый на месте');
r = post({ op: 'fapprove', code: A, by: 'Технолог', id: pend.id, reg: 'main', regName: 'Волгоград', dir: dFirst });
assert.ok(r.ok && r.archived === 1, JSON.stringify(r));
assert.strictEqual(byId(base).kind, 'arch'); assert.strictEqual(byId(pend.id).kind, 'main'); assert.strictEqual(byId(pend.id).dir, dFirst);
assert.strictEqual(files().filter(x => x.kind === 'main' && /Кудрявый/.test(x.name)).length, 1);
// заявка без явного rep: найдётся единственный двойник
const base2 = mk('ТТК №31 Щи 250 гр.docx', 'main', dFirst);
r = up('ТТК №31 Щи.docx', { reg: 'main', dir: dFirst }, E); const p2 = r.id;
r = post({ op: 'fapprove', code: A, by: 'Технолог', id: p2, reg: 'main', regName: 'Волгоград', dir: dFirst }); assert.strictEqual(r.archived, 1); assert.strictEqual(byId(base2).kind, 'arch');
// принятие с правками технолога (пересобранный файл) тоже архивирует прежний
const base3 = mk('ТТК №32 Рассольник 250 гр.docx', 'main', dFirst);
r = up('ТТК №32 Рассольник.docx', { reg: 'main', dir: dFirst, rep: base3 }, E); const p3 = r.id;
r = post({ op: 'fapprove', code: A, by: 'Технолог', id: p3, reg: 'main', regName: 'Волгоград', dir: dFirst, b64: b64(mkDocx(1700, 'ed')) });
assert.ok(r.ok && r.edited && r.archived === 1, JSON.stringify(r)); assert.strictEqual(byId(base3).kind, 'arch');
assert.strictEqual(files().filter(x => x.kind === 'main' && /Рассольник/.test(x.name)).length, 1);
// несуществующий или чужой rep не мешает
r = up('ТТК №40 Каша.docx', { reg: 'main', regName: 'Волгоград', dir: dFirst, rep: 'нет-такого-файла-12345' }); assert.ok(r.ok && r.archived === 0);

// ===== 4. роли: шеф-повар не видит архив и заявки, редактор видит архив; вернуть из архива может только технолог
assert.ok(!get({ a: 'files' }, V).files.some(x => x.kind !== 'main'), 'шеф-повар: только принятые файлы');
assert.ok(get({ a: 'files' }, E).files.some(x => x.kind === 'arch'), 'редактор видит архив');
assert.strictEqual(get({ a: 'file', id: base }, V).err, 'nofile', 'шеф-повару файл из архива не отдаётся');
assert.strictEqual(get({ a: 'file', id: base }, E).ok, true);
assert.strictEqual(post({ op: 'frestore', code: E, by: 'Иван', id: base }).err, 'admin');

// ===== 5. возврат из архива: на прежнее место, текущая версия уходит в архив
const cur = files().find(x => x.kind === 'main' && /Кудрявый/.test(x.name)).id;
r = post({ op: 'frestore', code: A, by: 'Технолог', id: base }); assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(r.name, 'ТТК №30 Суп Кудрявый 250 гр.docx');
assert.strictEqual(byId(base).kind, 'main'); assert.strictEqual(byId(base).name, 'ТТК №30 Суп Кудрявый 250 гр.docx'); assert.strictEqual(byId(base).dir, dFirst);
assert.strictEqual(byId(base).arch, undefined);
assert.ok(r.ok); // то же имя в месте возврата нет (у новой другое имя): обе версии теперь в библиотеке — технолог решает сам
assert.strictEqual(post({ op: 'frestore', code: A, by: 'T', id: cur }).err, 'nofile', 'файл не из архива вернуть нельзя');

// ===== 6. перемещение на место одноимённого: тот уходит в архив
const mvA = mk('Цезарь.docx', 'main', dSal), mvB = mk('Цезарь.docx', 'main', dFirst);
r = post({ op: 'fmove', code: A, by: 'T', id: mvB, reg: 'main', dir: dSal }); assert.ok(r.ok);
assert.strictEqual(byId(mvA).kind, 'arch'); assert.strictEqual(byId(mvB).kind, 'main'); assert.strictEqual(byId(mvB).dir, dSal);

// ===== 7. история цен: общая для всех кодов
const rec = (from, to, k) => ({ region: 'main', from, to, at: 1760000000000, file: 'выгрузка.xlsx', rule: 'avg', sup: ['Поставщик А'], it: [{ ing: 'i-aaa', nm: 'Лук', pr: 40 + k, ln: [['2026-09-03', 0, 40 + k, 10]] }] });
assert.strictEqual(get({ a: 'ping' }, null).phv, 0);
assert.strictEqual(get({ a: 'phlist' }, 'неверный').err, 'code', 'список только по коду');
assert.deepStrictEqual(get({ a: 'phlist' }).items, []);
r = post({ op: 'phput', code: E, by: 'Иван', id: 'ph_main_20260901_20260930', rec: rec('2026-09-01', '2026-09-30', 0) }); assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(r.n, 1);
assert.strictEqual(post({ op: 'phput', code: V, by: 'Шеф', id: 'ph_main_20260901_20260930', rec: rec('2026-09-01', '2026-09-30', 0) }).err, 'viewer');
r = post({ op: 'phput', code: F, by: 'Мария', id: 'ph_main_20261001_20261031', rec: rec('2026-10-01', '2026-10-31', 5) }); assert.ok(r.ok);
assert.strictEqual(post({ op: 'phput', code: A, by: 'T', id: '../x', rec: rec('2026-10-01', '2026-10-31', 5) }).err, 'id');
assert.strictEqual(post({ op: 'phput', code: A, by: 'T', id: 'ph_main_20261101_20261130', rec: { it: [] } }).err, 'rec');
assert.strictEqual(get({ a: 'ping' }, null).phv, 2, 'версия истории растёт с каждой загрузкой');
for (const c of [A, E, F, V]) { const l = get({ a: 'phlist' }, c); assert.strictEqual(l.items.length, 2, 'список видят все роли: ' + c); }
const l = get({ a: 'phlist' }); assert.deepStrictEqual(l.items.map(x => [x.id, x.region, x.from, x.to, x.by, x.n]), [['ph_main_20260901_20260930', 'main', '20260901', '20260930', 'Иван', 1], ['ph_main_20261001_20261031', 'main', '20261001', '20261031', 'Мария', 1]]);
let ph = get({ a: 'phget', id: 'ph_main_20261001_20261031' }, V); assert.ok(ph.ok); assert.strictEqual(ph.rec.it[0].pr, 45); assert.strictEqual(ph.rec.region, 'main');
assert.strictEqual(get({ a: 'phget', id: 'ph_main_20991231_20991231' }).err, 'nofile'); assert.strictEqual(get({ a: 'phget', id: '../x' }).err, 'id');
// повторная загрузка того же периода заменяет запись; в папке по-прежнему один файл на период
post({ op: 'phput', code: A, by: 'Технолог', id: 'ph_main_20261001_20261031', rec: rec('2026-10-01', '2026-10-31', 9) });
assert.strictEqual(get({ a: 'phget', id: 'ph_main_20261001_20261031' }).rec.it[0].pr, 49); assert.strictEqual(get({ a: 'phlist' }).items.length, 2);
assert.strictEqual(get({ a: 'phlist' }).items.find(x => x.id === 'ph_main_20261001_20261031').by, 'Технолог');
// удалить запись может только технолог
assert.strictEqual(post({ op: 'phdel', code: E, by: 'Иван', id: 'ph_main_20260901_20260930' }).err, 'admin');
assert.strictEqual(post({ op: 'phdel', code: A, by: 'T', id: 'ph_main_20260901_20260930' }).n, 1);
assert.deepStrictEqual(get({ a: 'phlist' }, V).items.map(x => x.id), ['ph_main_20261001_20261031']);
assert.strictEqual(get({ a: 'ping' }, null).phv, 4);
console.log('GAS arch ok');
