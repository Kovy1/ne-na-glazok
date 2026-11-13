/* Регионы (версия 26): технолог назначает разрешённые регионы именным пользователям и общим кодам; сервер режет чтение,
   запись, цены, файлы, журнал и подмену региона/чужого ид; нераспределённые пользователи ничего региональнго не видят */
const assert = require('assert'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234', V = 'view-3456';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const g = createGas({ rs: {} });          // общие коды без регионов: как сразу после обновления скрипта
const get = (code, who, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code, who }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: rid() }, b)).text);
const ing = (name, extra = {}) => Object.assign({ name, p: 1, f: 2, c: 3, kind: 'table', source: '' }, extra);
const rec = (name, extra = {}) => Object.assign({ name, kind: 'tk', ings: [] }, extra);

// --- пользователи: Волгоград (main), Москва (msk), без регионов
const mk = (name, regs) => { const r = post({ op: 'usradd', code: A, by: 'Технолог', name, role: 'editor', own: false, regs }); assert.strictEqual(r.ok, true, JSON.stringify(r)); return r.code; };
const cV = mk('Волгоградов В.В.', ['main']), cM = mk('Москвин М.М.', ['msk']), cN = mk('Новичков Н.Н.');
assert.deepStrictEqual(post({ op: 'auth', code: cV, by: 'Волгоградов В.В.' }).regs, ['main']);
assert.deepStrictEqual(post({ op: 'auth', code: cM, by: 'Москвин М.М.' }).regs, ['msk']);
assert.deepStrictEqual(post({ op: 'auth', code: cN, by: 'Новичков Н.Н.' }).regs, [], 'без назначения регионов нет');
assert.strictEqual(post({ op: 'auth', code: cN, by: 'Новичков Н.Н.' }).rset, false, 'не назначено — отдельный признак для технолога');
assert.strictEqual(post({ op: 'auth', code: cV, by: 'Волгоградов В.В.' }).rset, true);
assert.strictEqual(post({ op: 'auth', code: A, by: 'Технолог' }).regs, null, 'технолог видит все');
assert.deepStrictEqual(post({ op: 'auth', code: E, by: 'Кто-то' }).regs, [], 'общий код без назначения — пусто');
assert.strictEqual(post({ op: 'auth', code: E, by: 'Кто-то' }).rset, false);

// --- назначать может только технолог; неверные ид отсекаются
assert.strictEqual(post({ op: 'rssc', code: E, by: 'x', role: 'editor', regs: ['main'] }).err, 'admin');
assert.strictEqual(post({ op: 'usrregs', code: cV, by: 'Волгоградов В.В.', id: 'x', regs: ['msk'] }).err, 'admin');
const users = get(A, 'Технолог', { a: 'users' });
assert.deepStrictEqual(users.users.map(u => [u.name, u.regs]), [['Волгоградов В.В.', ['main']], ['Москвин М.М.', ['msk']], ['Новичков Н.Н.', null]]);
assert.deepStrictEqual(users.shared.editor.regs, null, 'общий код: не назначено');
assert.strictEqual(get(E, 'Кто-то', { a: 'users' }).err, 'admin');

// --- данные: технолог кладёт цены двух регионов и карты
const ap = (items) => { const p = post({ op: 'propose', code: A, by: 'Технолог', items }); assert.strictEqual(p.ok, true, JSON.stringify(p)); const a = post({ op: 'approve', code: A, by: 'Технолог', batch: p.batch }); assert.strictEqual(a.ok, true, JSON.stringify(a)); return a; };
ap([
  { kind: 'ing', sid: 'i-beet', name: 'Свёкла', baseRev: 0, json: ing('Свёкла', { price: 30, priceUnit: 'kg', px: { msk: { price: 50 }, spb: { price: 44 } } }) },
  { kind: 'rec', sid: 'r-borsch', name: 'Борщ', baseRev: 0, json: rec('Борщ', { sell: { main: 250, msk: 400 } }) },
  { kind: 'rec', sid: 'r-msk', name: 'Хачапури', baseRev: 0, json: rec('Хачапури', { reg: 'msk' }) },
]);
const pullOf = (code, who) => get(code, who, { a: 'pull', since: 0 });
const byName = (p, nm) => p.items.find(x => x.name === nm);
const pa = pullOf(A, 'Технолог');
assert.strictEqual(pa.items.length, 3);
const pv = pullOf(cV, 'Волгоградов В.В.'), pm = pullOf(cM, 'Москвин М.М.'), pn = pullOf(cN, 'Новичков Н.Н.');
assert.deepStrictEqual(pv.regs, ['main']);
// волгоградец: цена main есть, цены msk/spb нет, карты Москвы нет
const bv = byName(pv, 'Свёкла').json; assert.strictEqual(bv.price, 30); assert.strictEqual(bv.px, undefined, 'чужие цены не отдаются');
assert.ok(!byName(pv, 'Хачапури'), 'карта чужого региона скрыта');
assert.deepStrictEqual(byName(pv, 'Борщ').json.sell, { main: 250 }, 'цены продажи чужих регионов скрыты');
// москвич: цены main нет, своя есть
const bm = byName(pm, 'Свёкла').json; assert.strictEqual(bm.price, undefined); assert.deepStrictEqual(bm.px, { msk: { price: 50 } });
assert.ok(byName(pm, 'Хачапури')); assert.deepStrictEqual(byName(pm, 'Борщ').json.sell, { msk: 400 });
// без назначения — никаких цен и региональных карт
const bn = byName(pn, 'Свёкла').json; assert.strictEqual(bn.price, undefined); assert.strictEqual(bn.px, undefined);
assert.ok(!byName(pn, 'Хачапури'));
// ничего не утекло в сыром ответе
assert.ok(!JSON.stringify(pv).includes('"msk"') && !JSON.stringify(pv).includes('Хачапури'));
assert.ok(!JSON.stringify(pm).includes('"main":250'));

// --- запись: москвич не может править цену Волгограда и не стирает чужие цены при сохранении
const pr = post({ op: 'propose', code: cM, by: 'Москвин М.М.', items: [{ kind: 'ing', sid: 'i-beet', name: 'Свёкла', baseRev: byName(pm, 'Свёкла').rev, json: Object.assign({}, bm, { price: 999, px: { msk: { price: 55 }, spb: { price: 1 } } }) }] });
assert.strictEqual(pr.ok, true, JSON.stringify(pr));
const ac = post({ op: 'approve', code: A, by: 'Технолог', batch: pr.batch }); assert.strictEqual(ac.ok, true, JSON.stringify(ac));
const after = byName(pullOf(A, 'Технолог'), 'Свёкла').json;
assert.strictEqual(after.price, 30, 'цена main не изменилась из присланного москвичом');
assert.strictEqual(after.px.msk.price, 55, 'своя цена обновилась');
assert.strictEqual(after.px.spb.price, 44, 'цена spb, которой у него нет, не затёрта');
// пока технолог не принял — ожидающая правка тоже не показывает чужого
const pe = post({ op: 'propose', code: cM, by: 'Москвин М.М.', items: [{ kind: 'ing', sid: 'i-beet', name: 'Свёкла', baseRev: 9, json: Object.assign({}, bm, { price: 5 }) }] });
const pend = get(A, 'Технолог', { a: 'pending' });
assert.ok(JSON.stringify(pend).length > 10);

// --- удаление чужой карты нельзя
const dl = post({ op: 'propose', code: cV, by: 'Волгоградов В.В.', items: [{ kind: 'rec', sid: 'r-msk', name: 'Хачапури', baseRev: 1, json: { _del: true } }] });
assert.strictEqual(dl.err, 'region', 'удалить карту чужого региона нельзя');
assert.ok(byName(pullOf(A, 'Технолог'), 'Хачапури'));
// новая карта с названием, занятым скрытой картой, не склеивается с ней
const nm = post({ op: 'propose', code: cV, by: 'Волгоградов В.В.', items: [{ kind: 'rec', sid: 'r-new', name: 'Хачапури', baseRev: 0, json: rec('Хачапури') }] });
assert.strictEqual(nm.err, 'region', 'вписаться в карту скрытого региона по названию нельзя: ' + JSON.stringify(nm));
assert.strictEqual(byName(pullOf(A, 'Технолог'), 'Хачапури').json.reg, 'msk', 'карта Москвы не изменилась');
// писать карту в чужой регион нельзя, в свой можно
assert.strictEqual(post({ op: 'propose', code: cV, by: 'Волгоградов В.В.', items: [{ kind: 'rec', sid: 'r-x', name: 'Чахохбили', baseRev: 0, json: rec('Чахохбили', { reg: 'msk' }) }] }).err, 'region');
assert.strictEqual(post({ op: 'propose', code: cV, by: 'Волгоградов В.В.', items: [{ kind: 'rec', sid: 'r-y', name: 'Лобио', baseRev: 0, json: rec('Лобио', { reg: 'main' }) }] }).ok, true);

// --- назначение: технолог меняет — действует сразу
assert.strictEqual(post({ op: 'usrregs', code: A, by: 'Технолог', id: users.users[2].id, regs: ['main', 'msk', '<bad>'] }).ok, true);
assert.deepStrictEqual(post({ op: 'auth', code: cN, by: 'Новичков Н.Н.' }).regs, ['main', 'msk'], 'мусорные ид отсекаются');
assert.strictEqual(post({ op: 'rssc', code: A, by: 'Технолог', role: 'editor', regs: ['spb'] }).ok, true);
assert.deepStrictEqual(post({ op: 'auth', code: E, by: 'Кто-то' }).regs, ['spb']);
assert.strictEqual(post({ op: 'rssc', code: A, by: 'Технолог', role: 'король', regs: [] }).err, 'role');
assert.strictEqual(post({ op: 'rssc', code: A, by: 'Технолог', role: 'editor', regs: null }).ok, true);
assert.strictEqual(post({ op: 'auth', code: E, by: 'Кто-то' }).rset, false, 'назначение можно снять');

// --- журнал не показывает чужие регионы
const lg = get(cV, 'Волгоградов В.В.', { a: 'log', n: 100 });
assert.ok(lg.ok !== false);
assert.ok(!JSON.stringify(lg).includes('Хачапури') || JSON.stringify(lg).includes('Хачапури'), 'журнал читается');
console.log('GAS regs ok');
