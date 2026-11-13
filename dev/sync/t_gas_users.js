/* Именные доступы: технолог создаёт пользователя (ФИО + права), скрипт выдаёт код из 5 цифр; вход по ФИО и коду;
   временный код меняется при первом входе; отключение, новый код, права, удаление; общие коды работают как раньше */
const assert = require('assert'), { createGas } = require('./gasmock');
const core = r => { const o = Object.assign({}, r); delete o.regs; delete o.rset; delete o.uid; return o; };   // v26: в ответе входа добавились регионы и ид
const g = createGas();
const get = (code, who, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code, who }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const E = 'ed-1234', A = 'adm-5678', V = 'view-3456';

// пока никого нет: список пуст, лист не создаётся чтением
{ const u0 = get(A, 'Технолог', { a: 'users' }); assert.strictEqual(u0.ok, true); assert.deepStrictEqual(u0.users, []); }
assert.strictEqual(get(E, 'Кто-то', { a: 'users' }).err, 'admin', 'список только технологу');
assert.strictEqual(get(null, '', { a: 'users' }).err, 'code');

// создание: только технолог
assert.strictEqual(post({ op: 'usradd', code: E, by: 'Ред', name: 'Петров П.П.', role: 'editor' }).err, 'admin');
assert.strictEqual(post({ op: 'usradd', code: A, by: 'Технолог', name: 'Пе', role: 'editor' }).err, 'name', 'ФИО слишком короткое');
assert.strictEqual(post({ op: 'usradd', code: A, by: 'Технолог', name: 'Петров П.П.', role: 'король' }).err, 'role');
const c1 = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Петров П.П.', role: 'editor' });
assert.strictEqual(c1.ok, true); assert.ok(/^\d{5}$/.test(c1.code), 'код из 5 цифр: ' + c1.code);
assert.notStrictEqual(c1.code, '12345');
assert.strictEqual(c1.user.st, 'новый', 'по умолчанию код временный');
assert.strictEqual(post({ op: 'usradd', code: A, by: 'Технолог', name: 'петров п п', role: 'viewer' }).err, 'dup', 'то же ФИО в другой записи');
const c2 = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Сидорова А.В.', role: 'viewer', own: false });
assert.strictEqual(c2.user.st, 'активен', 'без «задаст сам» код постоянный');

// в таблице только хэш
const sh = g.sheets['Пользователи']._sh || g.sheets['Пользователи'];
const rows = (sh.rows || sh._sh.rows).slice(1);
assert.strictEqual(rows.length, 2);
assert.ok(rows.every(r => r[3] && r[3].length === 64 && !String(r[3]).includes(c1.code)), 'код хранится хэшем');
assert.ok(!JSON.stringify(rows).includes(c1.code), 'кода в таблице нет');

// список для технолога
const l1 = get(A, 'Технолог', { a: 'users' }).users;
assert.deepStrictEqual(l1.map(u => u.name), ['Петров П.П.', 'Сидорова А.В.']);
assert.ok(l1.every(u => u.h === undefined), 'хэш не отдаётся');

// вход: ФИО + код; неправильное ФИО или код не пускают
assert.strictEqual(post({ op: 'auth', code: c2.code, by: 'Сидорова А.В.' }).role, 'viewer');
assert.deepStrictEqual(core(post({ op: 'auth', code: c2.code, by: 'сидорова а в' })), { ok: true, role: 'viewer', price: true, mine: true, name: 'Сидорова А.В.', temp: false }, 'ФИО без учёта регистра, точек и пробелов; приходит ФИО технолога');
assert.strictEqual(post({ op: 'auth', code: c2.code, by: 'Иванов И.И.' }).err, 'code', 'чужое ФИО');
assert.strictEqual(post({ op: 'auth', code: c2.code, by: '' }).err, 'code', 'без ФИО');
assert.strictEqual(post({ op: 'auth', code: '00000', by: 'Сидорова А.В.' }).err, 'code', 'чужой код');
assert.strictEqual(get(c2.code, 'Сидорова А.В.', { a: 'pull' }).ok, true, 'данные по именному коду');
assert.strictEqual(get(c2.code, 'Иванов', { a: 'pull' }).err, 'code');
assert.strictEqual(post({ op: 'propose', code: c2.code, by: 'Сидорова А.В.', items: [] }).err, 'viewer', 'права шеф-повара');

// временный код: до первого входа работает только auth и смена кода
const a1 = post({ op: 'auth', code: c1.code, by: 'Петров П.П.' });
assert.strictEqual(a1.temp, true); assert.strictEqual(a1.role, 'editor');
assert.strictEqual(get(c1.code, 'Петров П.П.', { a: 'pull' }).err, 'usrtemp', 'данные до смены кода закрыты');
assert.strictEqual(post({ op: 'propose', code: c1.code, by: 'Петров П.П.', items: [] }).err, 'usrtemp');
assert.strictEqual(post({ op: 'usrmine', code: c1.code, by: 'Петров П.П.', newCode: '12' }).err, 'short');
assert.strictEqual(post({ op: 'usrmine', code: c1.code, by: 'Петров П.П.', newCode: 'а б вгде' }).err, 'space');
assert.strictEqual(post({ op: 'usrmine', code: c1.code, by: 'Петров П.П.', newCode: A }).err, 'taken', 'общий код занимать нельзя');
assert.strictEqual(post({ op: 'usrmine', code: c1.code, by: 'Петров П.П.', newCode: 'мойкод77' }).ok, true);
assert.strictEqual(post({ op: 'auth', code: c1.code, by: 'Петров П.П.' }).err, 'code', 'выданный код больше не работает');
const a2 = post({ op: 'auth', code: 'мойкод77', by: 'Петров П.П.' });
assert.deepStrictEqual([a2.role, a2.temp, a2.mine], ['editor', false, true]);
assert.strictEqual(get('мойкод77', 'Петров П.П.', { a: 'pull' }).ok, true);
assert.strictEqual(post({ op: 'usrmine', code: E, by: 'Кто-то', newCode: 'жжжж1' }).err, 'nomine', 'общий код менять нельзя');
// свою смену можно и после первого входа
assert.strictEqual(post({ op: 'usrmine', code: 'мойкод77', by: 'Петров П.П.', newCode: 'мойкод88' }).ok, true);
assert.strictEqual(post({ op: 'auth', code: 'мойкод88', by: 'Петров П.П.' }).role, 'editor');

// права редактора на запись работают как у общего кода: правка уходит технологу
const pr = post({ op: 'propose', code: 'мойкод88', by: 'Петров П.П.', note: '', items: [{ kind: 'ing', sid: 'i-x1', name: 'Лук', baseRev: 0, json: { name: 'Лук', p: 1, f: 2, c: 3, kind: 'table', source: '' } }] });
assert.strictEqual(pr.ok, true, JSON.stringify(pr));
assert.strictEqual(post({ op: 'publish', code: 'мойкод88', by: 'Петров П.П.', items: [] }).err, 'admin', 'публиковать редактор не может');

// перебор: десять неверных кодов закрывают вход этому ФИО
for (let i = 0; i < 10; i++) assert.strictEqual(post({ op: 'auth', code: 'нет' + i + 'нет', by: 'Сидорова А.В.' }).err, 'code');
assert.strictEqual(post({ op: 'auth', code: c2.code, by: 'Сидорова А.В.' }).err, 'locked', 'после десяти ошибок вход закрыт и верному коду');
assert.strictEqual(post({ op: 'auth', code: 'мойкод88', by: 'Петров П.П.' }).role, 'editor', 'остальных это не касается');

// новый код, отключение, права, удаление (технолог)
const id2 = l1.find(u => u.name === 'Сидорова А.В.').id;
const rs = post({ op: 'usrreset', code: A, by: 'Технолог', id: id2 });
assert.ok(/^\d{5}$/.test(rs.code));
assert.strictEqual(post({ op: 'usrreset', code: A, by: 'Технолог', id: 'нет-такого' }).err, 'nouser');
g.ctx.CacheService.getScriptCache().remove('uf:' + 'сидороваав');
const a3 = post({ op: 'auth', code: rs.code, by: 'Сидорова А.В.' });
assert.strictEqual(a3.temp, true, 'новый код временный');
assert.strictEqual(post({ op: 'auth', code: c2.code, by: 'Сидорова А.В.' }).err, 'code', 'прежний код не подходит');
assert.strictEqual(post({ op: 'usroff', code: E, by: 'Ред', id: id2, off: true }).err, 'admin');
assert.strictEqual(post({ op: 'usroff', code: A, by: 'Технолог', id: id2, off: true }).ok, true);
assert.strictEqual(post({ op: 'auth', code: rs.code, by: 'Сидорова А.В.' }).err, 'off', 'отключён');
assert.strictEqual(get(A, 'Технолог', { a: 'users' }).users.find(u => u.id === id2).st, 'отключён');
assert.strictEqual(post({ op: 'usroff', code: A, by: 'Технолог', id: id2, off: false }).ok, true);
assert.strictEqual(get(A, 'Технолог', { a: 'users' }).users.find(u => u.id === id2).st, 'новый', 'включение возвращает прежнее состояние');
assert.strictEqual(post({ op: 'usrrole', code: A, by: 'Технолог', id: id2, role: 'finance' }).ok, true);
assert.strictEqual(post({ op: 'auth', code: rs.code, by: 'Сидорова А.В.' }).role, 'finance', 'новые права');
assert.strictEqual(post({ op: 'usrrole', code: A, by: 'Технолог', id: id2, role: 'бог' }).err, 'role');
assert.strictEqual(post({ op: 'usrdel', code: A, by: 'Технолог', id: id2 }).ok, true);
assert.strictEqual(post({ op: 'auth', code: rs.code, by: 'Сидорова А.В.' }).err, 'code', 'удалённый не входит');
assert.deepStrictEqual(get(A, 'Технолог', { a: 'users' }).users.map(u => u.name), ['Петров П.П.']);

// технолог с именным доступом может всё как технолог, но свой код тоже хранится хэшем
const c3 = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Заместитель З.З.', role: 'admin', own: false });
assert.strictEqual(post({ op: 'auth', code: c3.code, by: 'Заместитель З.З.' }).role, 'admin');
assert.strictEqual(post({ op: 'usradd', code: c3.code, by: 'Заместитель З.З.', name: 'Новый Н.Н.', role: 'viewer' }).ok, true, 'именной технолог тоже заводит пользователей');

// общие коды работают с любым ФИО, как раньше
assert.strictEqual(post({ op: 'auth', code: E, by: 'Любое Имя' }).role, 'editor');
assert.strictEqual(post({ op: 'auth', code: V, by: '' }).role, 'viewer');
assert.deepStrictEqual(core(post({ op: 'auth', code: A, by: 'Технолог' })), { ok: true, role: 'admin', price: true });

// без «Пользователей» код общего вида выдаёт тот же ответ (старые клиенты)
console.log('GAS users ok');
