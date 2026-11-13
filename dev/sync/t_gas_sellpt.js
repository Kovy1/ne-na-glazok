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

// --- v28: цена продажи точки «регион:точка» относится к региону
const ap = (items) => { const p = post({ op: 'propose', code: A, by: 'Технолог', items }); assert.strictEqual(p.ok, true, JSON.stringify(p)); const a = post({ op: 'approve', code: A, by: 'Технолог', batch: p.batch }); assert.strictEqual(a.ok, true, JSON.stringify(a)); return a; };
ap([
  { kind: 'rec', sid: 'r-borsch', name: 'Борщ', baseRev: 0, json: rec('Борщ', { sell: { main: 250, 'main:p1': 270, msk: 400, 'msk:p2': 420 } }) },
]);
const pullOf = (code, who) => get(code, who, { a: 'pull', since: 0 });
const byName = (p, nm) => p.items.find(x => x.name === nm);
assert.deepStrictEqual(byName(pullOf(cV, 'Волгоградов В.В.'), 'Борщ').json.sell, { main: 250, 'main:p1': 270 }, 'цены точек своего региона видны, чужого — нет');
assert.deepStrictEqual(byName(pullOf(cM, 'Москвин М.М.'), 'Борщ').json.sell, { msk: 400, 'msk:p2': 420 });
assert.deepStrictEqual(byName(pullOf(cN, 'Новичков Н.Н.'), 'Борщ').json.sell, undefined, 'без регионов цен нет');
assert.deepStrictEqual(byName(pullOf(A, 'Технолог'), 'Борщ').json.sell, { main: 250, 'main:p1': 270, msk: 400, 'msk:p2': 420 });
// волгоградец меняет цену своей точки и пытается подсунуть цену чужой точки: чужие ключи на сервере сохраняются, подсунутое отбрасывается
const pv = pullOf(cV, 'Волгоградов В.В.'), bv = byName(pv, 'Борщ');
const pr = post({ op: 'propose', code: cV, by: 'Волгоградов В.В.', items: [{ kind: 'rec', sid: 'r-borsch', name: 'Борщ', baseRev: bv.rev, json: Object.assign({}, bv.json, { sell: { main: 250, 'main:p1': 300, 'msk:p2': 1 } }) }] });
assert.strictEqual(pr.ok, true, JSON.stringify(pr));
const ac = post({ op: 'approve', code: A, by: 'Технолог', batch: pr.batch }); assert.strictEqual(ac.ok, true, JSON.stringify(ac));
assert.deepStrictEqual(byName(pullOf(A, 'Технолог'), 'Борщ').json.sell, { main: 250, 'main:p1': 300, msk: 400, 'msk:p2': 420 }, 'своя точка обновилась, чужие цены не тронуты');
console.log('GAS sellpt ok');
