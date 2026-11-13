/* Ревизии (версия 26): черновик, пустой факт не ноль, неизвестная цена не ноль, итоги недостач и излишков отдельно,
   завершение со снимком реквизитов и цен, защита от параллельной правки, права и регионы */
const assert = require('assert'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234', F = 'fin-9012', V = 'view-3456';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const g = createGas({ rs: { editor: ['main'], finance: ['msk'], viewer: ['main', 'msk'], audit: ['main'] } });
const get = (code, p) => g.parseOut(g.get(Object.assign({ code, who: 'Тест' }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: rid() }, b)).text);
const dput = (kind, j, o) => post(Object.assign({ op: 'dirput', code: A, by: 'Технолог', kind, j }, o || {}));

const le = dput('le', { name: 'Ромашка', org: 'ООО «Ромашка»', head: 'Директор', headName: 'Иванов И.И.', inn: '3444123456', kpp: '344401001', regs: [] }).item;
const ptM = dput('pt', { name: 'Центр', region: 'main', address: 'пр. Ленина, 1', le: le.id }).item;
const ptX = dput('pt', { name: 'Арбат', region: 'msk' }).item;
const ptOff = dput('pt', { name: 'Старая', region: 'main' }).item;
dput('pt', { name: 'Старая', region: 'main', active: false }, { id: ptOff.id, base: 1 });

const L = (n, u, b, f, p, extra) => Object.assign({ n, u, b, f, p }, extra || {});
const doc = (lines, o) => Object.assign({ date: '2026-10-30', point: ptM.id, region: 'main', resp: 'Сидоров С.С.', note: '', lines }, o || {});
const save = (code, d, o) => post(Object.assign({ op: 'rvput', code, by: 'Тест', doc: d }, o || {}));
const fin = (code, d, o) => post(Object.assign({ op: 'rvfinish', code, by: 'Тест', doc: d }, o || {}));

// --- права
assert.strictEqual(save(V, doc([L('Лук', 'кг', 10, 9, 40)])).err, 'role', 'шеф-повар только читает');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 9, 40)], { region: 'msk', point: ptX.id })).err, 'region', 'редактор: регион msk не назначен');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 9, 40)], { point: ptX.id })).err, 'point', 'точка другого региона');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 9, 40)], { point: 'pнет' })).err, 'point');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 9, 40)], { point: ptOff.id })).err, 'point', 'в отключённой точке новую ревизию не начать');
assert.strictEqual(save(E, doc([L('Лук', 'фунт', 10, 9, 40)])).err, 'unit');
assert.strictEqual(save(E, doc([L('', 'кг', 10, 9, 40)])).err, 'line');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 'abc', 40)])).err, 'num');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, -1, 40)])).err, 'num', 'отрицательный факт не бывает');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 9, -5)])).err, 'num');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 10, 9, 40)], { date: '30.10.2026' })).err, 'date');

// --- черновик: пропуск (факт пуст), ноль, недостача, излишек, неизвестная цена
const lines = [
  L('Лук', 'кг', 10, 8, 40),                // недостача 2 × 40 = 80
  L('Морковь', 'кг', 5, 7.5, 30),           // излишек 2.5 × 30 = 75
  L('Соль', 'кг', 3, 0, 20),                // ноль — посчитано: недостача 3 × 20 = 60
  L('Перец', 'г', 500, null, 2),            // не посчитано
  L('Укроп', 'кг', 1, 2, null),             // излишек, цена неизвестна — в сумму не входит
  L('Яйцо', 'шт', 100, 100, 12, { g: 55 }), // сошлось
];
const r1 = save(E, doc(lines)); assert.strictEqual(r1.ok, true, JSON.stringify(r1));
assert.ok(/^MAIN-2026-001$/.test(r1.num), r1.num); assert.strictEqual(r1.status, 'draft'); assert.strictEqual(r1.ver, 1);
assert.deepStrictEqual({ cnt: r1.sum.cnt, skip: r1.sum.skip, short: r1.sum.short, over: r1.sum.over, sumShort: r1.sum.sumShort, sumOver: r1.sum.sumOver, noPrice: r1.sum.noPrice },
  { cnt: 5, skip: 1, short: 2, over: 2, sumShort: -140, sumOver: 75, noPrice: 1 }, 'итоги: пропуск не в итогах, ноль считается, цена null ≠ 0');
// черновик читается целиком, пустой факт остаётся пустым
const got = get(E, { a: 'rvget', id: r1.id }).rv; assert.strictEqual(got.doc.lines[3].f, null); assert.strictEqual(got.doc.lines[2].f, 0); assert.strictEqual(got.doc.lines[4].p, null);
assert.strictEqual(got.ver, 1);
// автономер идёт по порядку и не повторяется
assert.strictEqual(save(E, doc([L('Лук', 'кг', 1, 1, 1)])).num, 'MAIN-2026-002');
assert.strictEqual(save(E, doc([L('Лук', 'кг', 1, 1, 1)], { num: 'MAIN-2026-001' })).err, 'dup', 'свой номер не должен совпасть');
// список: по регионам
const lst = code => get(code, { a: 'rvlist' }).items;
assert.strictEqual(lst(E).length, 2); assert.deepStrictEqual(lst(F), [], 'тер. управляющий (msk) ревизий main не видит');
assert.strictEqual(get(F, { a: 'rvget', id: r1.id }).err, 'norev', 'по ид чужую ревизию не открыть');
assert.strictEqual(lst(V).length, 2); assert.strictEqual(lst(A).length, 2);

// --- параллельные правки
const upd = Object.assign(doc(lines), { resp: 'Сидоров С.С.' });
const s2 = save(E, upd, { id: r1.id, base: 1 }); assert.strictEqual(s2.ok, true); assert.strictEqual(s2.ver, 2); assert.strictEqual(s2.num, r1.num);
const cf = save(A, doc([L('Чужая правка', 'кг', 1, 1, 1)]), { id: r1.id, base: 1 });
assert.strictEqual(cf.ok, false); assert.strictEqual(cf.err, 'conflict'); assert.strictEqual(cf.cur.ver, 2); assert.strictEqual(cf.doc.lines.length, 6, 'вернулась свежая версия, чужая правка не записана');
assert.strictEqual(get(A, { a: 'rvget', id: r1.id }).rv.doc.lines.length, 6);

// --- завершение: нельзя с пустым фактом, без ответственного и без строк
let f = fin(E, doc(lines), { id: r1.id, base: 2 }); assert.strictEqual(f.err, 'notcounted'); assert.ok(/№4 «Перец»/.test(f.msg), f.msg);
assert.strictEqual(get(E, { a: 'rvget', id: r1.id }).rv.status, 'draft', 'неудачное завершение не меняет статус');
const full = lines.map((l, i) => i === 3 ? Object.assign({}, l, { f: 480 }) : i === 4 ? Object.assign({}, l, { p: 25 }) : l);   // у строки с отклонением должна быть цена      // посчитали: 480 г при учёте 500 г
assert.strictEqual(fin(E, doc(full, { resp: '' }), { id: r1.id, base: 2 }).err, 'resp');
assert.strictEqual(fin(E, doc([]), { id: r1.id, base: 2 }).err, 'empty');
assert.strictEqual(fin(V, doc(full), { id: r1.id, base: 2 }).err, 'role');
f = fin(E, doc(full, { note: 'Ревизия по итогам октября' }), { id: r1.id, base: 2 });
assert.strictEqual(f.ok, true, JSON.stringify(f)); assert.strictEqual(f.status, 'done'); assert.strictEqual(f.ver, 3);
assert.strictEqual(f.sum.skip, 0); assert.strictEqual(f.sum.cnt, 6);
// снимок: реквизиты, точка, регион, итоги — на момент завершения
let rv = get(A, { a: 'rvget', id: r1.id }).rv; const snap0 = JSON.stringify(rv.doc.snap);
assert.strictEqual(rv.status, 'done'); assert.strictEqual(rv.doc.snap.le.org, 'ООО «Ромашка»'); assert.strictEqual(rv.doc.snap.le.inn, '3444123456'); assert.strictEqual(rv.doc.snap.le.headName, 'Иванов И.И.');
assert.strictEqual(rv.doc.snap.point.name, 'Центр'); assert.strictEqual(rv.doc.snap.point.address, 'пр. Ленина, 1'); assert.strictEqual(rv.doc.snap.region.id, 'main');
assert.strictEqual(rv.doc.snap.tot.sumShort, -180, 'недостача: лук 80 + соль 60 + перец 40'); assert.strictEqual(rv.doc.snap.tot.sumOver, 100, 'морковь 75 + укроп 25');

assert.ok(rv.doc.snap.at > 0 && rv.doc.snap.by);

// --- завершённый отчёт неизменен: меняем справочник (точка, юрлицо) и цены — снимок прежний
dput('le', { name: 'Ромашка', org: 'ООО «Ромашка-НОВОЕ»', inn: '7707083893', headName: 'Другой Д.Д.', regs: [] }, { id: le.id, base: 1 });
dput('pt', { name: 'Центр-2', region: 'main', address: 'другой адрес', le: le.id }, { id: ptM.id, base: 1 });
rv = get(A, { a: 'rvget', id: r1.id }).rv;
assert.strictEqual(JSON.stringify(rv.doc.snap), snap0, 'снимок реквизитов не изменился');
assert.strictEqual(rv.doc.lines[0].p, 40, 'учётная цена в строке не изменилась');
assert.strictEqual(save(E, doc(full), { id: r1.id, base: 3 }).err, 'done', 'завершённую не правят');
assert.strictEqual(post({ op: 'rvdel', code: A, by: 'T', id: r1.id, base: 3 }).err, 'done', 'завершённую не удаляют');
assert.strictEqual(fin(E, doc(full), { id: r1.id, base: 3 }).err, 'done');

// --- удаление черновика: только свой регион и со свежей версией
const d1 = save(E, doc([L('Лук', 'кг', 1, 1, 1)])); assert.strictEqual(d1.ok, true);
assert.strictEqual(post({ op: 'rvdel', code: F, by: 'T', id: d1.id, base: 1 }).err, 'norev');
assert.strictEqual(post({ op: 'rvdel', code: V, by: 'T', id: d1.id, base: 1 }).err, 'role');
assert.strictEqual(post({ op: 'rvdel', code: E, by: 'T', id: d1.id, base: 5 }).err, 'conflict');
assert.strictEqual(post({ op: 'rvdel', code: E, by: 'T', id: d1.id, base: 1 }).ok, true);
assert.strictEqual(get(E, { a: 'rvget', id: d1.id }).err, 'norev');

// --- масса штуки/упаковки и единицы
assert.strictEqual(save(E, doc([L('Яйцо', 'шт', 100, 98, 12, { g: 55 }), L('Масло', 'уп', 4, 3, 180, { g: 200 }), L('Вода', 'л', 20, 19, 5), L('Сироп', 'мл', 500, 400, 0.2)])).ok, true);
assert.strictEqual(save(E, doc([L('Яйцо', 'шт', 100, 98, 12, { g: -5 })])).err, 'num');

// --- ревизия в Москве: редактор (main) не может, тер. управляющий (msk) может
assert.strictEqual(save(F, doc([L('Сыр', 'кг', 5, 4, 600)], { region: 'msk', point: ptX.id })).ok, true);
assert.strictEqual(lst(F).length, 1); assert.strictEqual(lst(F)[0].num, 'MSK-2026-001'); assert.strictEqual(lst(E).every(x => x.region === 'main'), true);
// размер: слишком много строк
assert.strictEqual(save(A, doc(Array.from({ length: 1501 }, (_, i) => L('Сырьё ' + i, 'кг', 1, 1, 1)))).err, 'many');

// --- версия 27: пустой учётный остаток — не ноль
{
  const nb = save(E, doc([L('Сахар', 'кг', null, 5, 100)])); assert.strictEqual(nb.ok, true, JSON.stringify(nb));
  assert.deepStrictEqual({ cnt: nb.sum.cnt, noBook: nb.sum.noBook, over: nb.sum.over, short: nb.sum.short, sumOver: nb.sum.sumOver, sumShort: nb.sum.sumShort },
    { cnt: 1, noBook: 1, over: 0, short: 0, sumOver: 0, sumShort: 0 }, 'пустой остаток при факте 5 и цене 100 не даёт излишек 500');
  const z = save(E, doc([L('Сахар', 'кг', 0, 5, 100)])); assert.strictEqual(z.sum.sumOver, 500, 'явный ноль допустим и даёт излишек');
  // завершение: не хватает остатка, факта и цены у строк с отклонением; сообщения называют строки
  const bad = [L('Сахар', 'кг', null, 5, 100), L('Мука', 'кг', 4, null, 30), L('Соль', 'кг', 3, 1, null), L('Рис', 'кг', 2, 2, null)];
  const fb = fin(E, doc(bad)); assert.strictEqual(fb.ok, false); assert.strictEqual(fb.err, 'nobook');
  assert.ok(/№1 «Сахар»/.test(fb.msg) && /№2 «Мука»/.test(fb.msg) && /№3 «Соль»/.test(fb.msg), fb.msg);
  assert.ok(!/№4/.test(fb.msg), 'строка без отклонения не требует цены: ' + fb.msg);
  assert.strictEqual(fin(E, doc([L('Соль', 'кг', 3, 1, null)])).err, 'noprice');
  assert.strictEqual(fin(E, doc([L('Рис', 'кг', 2, 2, null)])).ok, true, 'нет отклонения — цена не нужна');
}
// --- одно правило округления: итог равен сумме округлённых сумм строк (3 × 0,333 × 1)
{
  const r = save(E, doc([L('А', 'кг', 0, 0.333, 1), L('Б', 'кг', 0, 0.333, 1), L('В', 'кг', 0, 0.333, 1)]));
  assert.strictEqual(r.sum.sumOver, 0.99, 'три строки по 0,33 дают 0,99, а не 1,00');
  const r2 = save(E, doc([L('А', 'кг', 0.333, 0, 1), L('Б', 'кг', 0.333, 0, 1), L('В', 'кг', 0.333, 0, 1)]));
  assert.strictEqual(r2.sum.sumShort, -0.99);
}
// --- снимок записывает всё, что нужно отчёту; правка справочника его не меняет
{
  const pt2 = dput('pt', { name: 'Снимок', region: 'main', address: 'ул. Мира, 5', le: le.id }).item;
  const r = fin(E, doc([L('Лук', 'кг', 10, 9, 40)], { point: pt2.id, resp: 'Петров П.П.', note: 'к' }));
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  let rv = get(A, { a: 'rvget', id: r.id }).rv; const s0 = JSON.stringify(rv.doc.snap);
  assert.strictEqual(rv.doc.snap.v, 2); assert.strictEqual(rv.doc.snap.resp, 'Петров П.П.'); assert.strictEqual(rv.doc.snap.num, r.num); assert.strictEqual(rv.doc.snap.date, '2026-10-30');
  dput('pt', { name: 'Переименована', region: 'main', address: '', le: '' }, { id: pt2.id, base: pt2.ver || 1 });
  dput('le', { name: 'Новое', org: 'ООО «Новое»', head: '', headName: '', inn: '3444123456', kpp: '', regs: [] }, { id: le.id, base: le.ver || 1 });
  rv = get(A, { a: 'rvget', id: r.id }).rv; assert.strictEqual(JSON.stringify(rv.doc.snap), s0, 'справочник не меняет завершённый документ');
}
// --- нумерация: после 999 без обрезания, без повторов, счётчик не отстаёт от выданных номеров
{
  g.props['rvn:main:2026'] = '998';
  const nums = []; for (let i = 0; i < 4; i++) nums.push(save(E, doc([L('Лук', 'кг', 1, 1, 1)])).num);
  assert.deepStrictEqual(nums, ['MAIN-2026-999', 'MAIN-2026-1000', 'MAIN-2026-1001', 'MAIN-2026-1002']);
  g.props['rvn:main:2026'] = '3';                                       // счётчик «отстал»: номера не должны повториться
  const n2 = save(E, doc([L('Лук', 'кг', 1, 1, 1)])).num; assert.strictEqual(n2, 'MAIN-2026-1003', n2);
  assert.strictEqual(save(E, doc([L('Лук', 'кг', 1, 1, 1)], { num: 'MAIN-2026-1004' })).ok, true, 'свой номер, совпадающий со следующим автономером');
  assert.strictEqual(save(E, doc([L('Лук', 'кг', 1, 1, 1)])).num, 'MAIN-2026-1005', 'автономер пропускает занятый');
}

// --- v27: прямой запрос чужого региона: чтение, запись, удаление и список не отдают и не меняют данные
{
  const mskDraft = save(F, doc([L('Сыр', 'кг', 5, 4, 600)], { region: 'msk', point: ptX.id })); assert.strictEqual(mskDraft.ok, true);
  const mainDone = fin(E, doc([L('Лук', 'кг', 2, 1, 40)])); assert.strictEqual(mainDone.ok, true);
  const rgE = g.parseOut(g.get({ code: E, who: 'Тест', a: 'rvget', id: mskDraft.id })).data; assert.strictEqual(rgE.ok, false); assert.strictEqual(rgE.err, 'norev', 'редактор main не читает ревизию msk по ид');
  const rgF = g.parseOut(g.get({ code: F, who: 'Тест', a: 'rvget', id: mainDone.id })).data; assert.strictEqual(rgF.ok, false); assert.strictEqual(rgF.err, 'norev', 'управляющий msk не читает ревизию main по ид');
  assert.strictEqual(post({ op: 'rvdel', code: E, by: 'Тест', id: mskDraft.id, base: mskDraft.ver }).err, 'norev', 'чужой черновик не удалить');
  assert.strictEqual(save(E, doc([L('Сыр', 'кг', 5, 3, 600)], { region: 'msk', point: ptX.id }), { id: mskDraft.id, base: mskDraft.ver }).err, 'region', 'чужой черновик не изменить');
  assert.strictEqual(fin(E, doc([L('Сыр', 'кг', 5, 3, 600)], { region: 'msk', point: ptX.id }), { id: mskDraft.id, base: mskDraft.ver }).err, 'region', 'и не завершить');
  assert.strictEqual(get(E, { a: 'rvlist' }).items.some(x => x.region === 'msk'), false, 'в списке чужих ревизий нет');
  const dE = get(E, { a: 'dir' }); assert.ok(dE.pts.every(x => x.region === 'main'), 'справочник точек: только свой регион');
  assert.strictEqual(get(F, { a: 'rvget', id: mskDraft.id }).rv.doc.lines[0].n, 'Сыр', 'свой регион читается');
}
console.log('GAS rev ok');
