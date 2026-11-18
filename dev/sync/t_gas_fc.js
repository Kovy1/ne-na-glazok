/* v30: фудкост на сервере — отчёты, планы, назначения. Доступ по роли и региону, исполнитель по идентификатору,
   защита от перезаписи (rev), документ не меняется после записи, большие документы отклоняются, удаление загрузки — меткой */
const assert = require('assert'), { createGas } = require('./gasmock');
const g = createGas();
const get = (code, who, p) => g.parseOut(g.get(Object.assign({ code, who }, p))).data;
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
const A = 'adm-5678';
const mk = (name, role, regs) => { const r = post({ op: 'usradd', code: A, by: 'Технолог', name, role, own: false, regs }); assert.strictEqual(r.ok, true, JSON.stringify(r)); return { code: r.code, name, id: r.user.id }; };
const vm = require('vm');
assert.strictEqual(vm.runInContext('VERSION', g.ctx), 31);
const ivan = mk('Иванов И.И.', 'editor', ['main']), petr = mk('Петров П.П.', 'viewer', ['main']), mosk = mk('Москвин М.М.', 'editor', ['msk']), fin = mk('Финансов Ф.Ф.', 'finance', ['main', 'msk']);
const P = (u, b) => post(Object.assign({ code: u.code, by: u.name }, b));
const G = (u, p) => get(u.code, u.name, p);

const batch = (id) => ({ batch: { id, type: 'receipts', from: '2026-10-01', to: '2026-10-31', n: 2 }, ops: { receipts: [{ id: 'o1', item: 'Лук', qty: 5, sum: 100 }, { id: 'o2', item: 'Мясо', qty: 2, sum: 800 }] } });
const plan = (st) => ({ plan: { id: 'p_main_x', obj: 'cafe', objName: 'Кафе', from: '2026-10-01', to: '2026-10-31', createdAt: 1, versions: [{ n: 1, at: '2026-11-01', fp: 'aaa', items: [{ id: 'm_aaa111', title: 'Списания лука' }, { id: 'm_bbb222', title: 'Цена мяса' }] }], state: st } });
const NS = () => ({ asg: null, st: 'new', due: '', cm: [], hist: [], rev: 0 });

// чтение без кода, неверный идентификатор
assert.strictEqual(get('zzz', 'x', { a: 'fcidx' }).err, 'code');
assert.strictEqual(P(ivan, { op: 'fcput', id: '../x', reg: 'main', data: batch('b1') }).err, 'id');

// загрузка отчёта: редактор своего региона пишет, шеф — нет, чужой регион — нет
let r = P(ivan, { op: 'fcput', id: 'b_main_1', reg: 'main', obj: 'cafe', objName: 'Кафе', data: batch('b_main_1') });
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 1);
assert.strictEqual(P(petr, { op: 'fcput', id: 'b_main_2', reg: 'main', data: batch('b_main_2') }).ok, false, 'шеф-повар только читает');
assert.strictEqual(P(mosk, { op: 'fcput', id: 'b_main_3', reg: 'main', data: batch('b_main_3') }).err, 'region', 'чужой регион');
assert.strictEqual(P(ivan, { op: 'fcput', id: 'b_msk_1', reg: 'msk', data: batch('b_msk_1') }).err, 'region');
assert.strictEqual(P(ivan, { op: 'fcput', id: 'b_main_4', reg: 'main', data: { batch: {}, ops: { receipts: 5 } } }).err, 'doc', 'мусор в строках');
// повторная отправка той же загрузки ничего не меняет
r = P(ivan, { op: 'fcput', id: 'b_main_1', reg: 'main', data: batch('b_main_1') }); assert.strictEqual(r.same, true); assert.strictEqual(r.rev, 1);
// видимость: шеф своего региона видит, москвич — нет
let ix = G(petr, { a: 'fcidx' }); assert.strictEqual(ix.ok, true); assert.deepStrictEqual(ix.items.map(x => x.id), ['b_main_1']); assert.strictEqual(ix.write, false);
assert.deepStrictEqual(G(mosk, { a: 'fcidx' }).items, []);
assert.strictEqual(G(mosk, { a: 'fcget', id: 'b_main_1' }).err, 'nofile');
assert.strictEqual(G(petr, { a: 'fcget', id: 'b_main_1' }).doc.data.ops.receipts.length, 2);
// «аудит» и общий код тоже подчиняются региону
assert.strictEqual(get('aud-7788', 'Аудитор', { a: 'fcidx' }).ok, true);

// удаление загрузки — меткой, строки уходят
assert.strictEqual(P(petr, { op: 'fcdel', id: 'b_main_1' }).ok, false);
assert.strictEqual(P(mosk, { op: 'fcdel', id: 'b_main_1' }).err, 'region');
r = P(ivan, { op: 'fcdel', id: 'b_main_1' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.n, 1);
assert.strictEqual(G(ivan, { a: 'fcget', id: 'b_main_1' }).doc.del, 1); assert.deepStrictEqual(G(ivan, { a: 'fcget', id: 'b_main_1' }).doc.data.ops, {});
r = P(ivan, { op: 'fcput', id: 'b_main_1', reg: 'main', data: batch('b_main_1') }); assert.strictEqual(r.deleted, true, 'удалённую загрузку повторной отправкой не вернуть');

// сопоставления: оптимистичная блокировка
r = P(ivan, { op: 'fcput', id: 'm_main', base: 0, data: { map: { a: 1 }, cfg: { vatP: 10 } } }); assert.strictEqual(r.rev, 1);
r = P(fin, { op: 'fcput', id: 'm_main', base: 0, data: { map: { a: 2 }, cfg: {} } }); assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'newer'); assert.strictEqual(r.doc.data.map.a, 1);
r = P(fin, { op: 'fcput', id: 'm_main', base: 1, data: { map: { a: 2 }, cfg: {} } }); assert.strictEqual(r.rev, 2);

// план: исполнитель должен быть среди сотрудников; ручной — без идентификатора
let st = { m_aaa111: Object.assign(NS(), { asg: { t: 'user', id: petr.id, name: petr.name } }), m_bbb222: Object.assign(NS(), { asg: { t: 'manual', name: 'Повар Сергей' } }) };
r = P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: 0, data: plan(Object.assign({}, st, { m_aaa111: Object.assign(NS(), { asg: { t: 'user', id: 'нет-такого', name: 'Призрак' } }) })) });
assert.strictEqual(r.err, 'asg', 'несуществующий исполнитель');
r = P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: 0, data: plan(st) }); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 1);
assert.strictEqual(P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: 0, data: plan(st) }).err, 'newer', 'повтор без свежего rev отклоняется');

// исполнитель Петров: роль «шеф-повар», регион main — видит весь план; москвич не видит вообще
assert.strictEqual(G(mosk, { a: 'fcget', id: 'p_main_x' }).err, 'nofile');
// сотрудник вне региона, но назначенный: только свои мероприятия
const out = mk('Внешний В.В.', 'viewer', []);
r = P(ivan, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 0, set: { asg: { t: 'user', id: out.id, name: out.name } } }); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.m.rev, 1);
assert.deepStrictEqual(G(out, { a: 'fcidx' }).items.map(x => x.id + ':' + x.mine), ['p_main_x:1']);
let d = G(out, { a: 'fcget', id: 'p_main_x' }).doc;
assert.strictEqual(d.limited, true); assert.deepStrictEqual(Object.keys(d.data.plan.state), ['m_bbb222']); assert.strictEqual(d.data.plan.versions[0].items.length, 1);
assert.ok(!JSON.stringify(d).includes('Списания лука'), 'чужие мероприятия исполнителю не отдаются');
let mine = G(out, { a: 'fcmine' }); assert.strictEqual(mine.items.length, 1); assert.strictEqual(mine.items[0].mid, 'm_bbb222');
assert.strictEqual(G(ivan, { a: 'fcmine' }).items.length, 0, 'у Иванова своих нет');
assert.strictEqual(G(petr, { a: 'fcmine' }).items.length, 1, 'у Петрова одно');
// исполнитель меняет статус/результат/комментарий; срок и исполнителя — нет; чужое мероприятие — нет
assert.strictEqual(P(out, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 1, set: { due: '2026-12-01' } }).err, 'denied');
assert.strictEqual(P(out, { op: 'fcact', id: 'p_main_x', mid: 'm_aaa111', base: 0, set: { st: 'work' } }).err, 'nofile', 'чужое мероприятие');
r = P(out, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 1, set: { st: 'work', result: 'Договорился о цене' }, cm: [{ k: 'c-out-1', at: '2026-11-02', t: 'Позвонил поставщику' }] });
assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.m.st, 'work'); assert.strictEqual(r.m.cm.length, 1); assert.strictEqual(r.m.cm[0].uid, out.id, 'автор комментария — по идентификатору');
// одновременное изменение: тот же base — второй получает свежее состояние, ничего не затирает
r = P(ivan, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 1, set: { st: 'done' } });
assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'newer'); assert.strictEqual(r.m.st, 'work');
r = P(ivan, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 2, set: { st: 'done' }, cm: [{ k: 'c-out-1', t: 'повтор' }, { k: 'c-iv-1', at: '2026-11-03', t: 'Принято' }] });
assert.strictEqual(r.ok, true); assert.strictEqual(r.m.cm.length, 2, 'комментарий с тем же ключом не дублируется'); assert.strictEqual(r.m.st, 'done');
assert.strictEqual(P(petr, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 3, set: { st: 'closed' } }).err, 'viewer', 'шеф-повар не назначен на это и не пишет');
assert.strictEqual(P(mosk, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 3, set: { st: 'closed' } }).err, 'nofile');
assert.strictEqual(P(ivan, { op: 'fcact', id: 'p_main_x', mid: 'm_bbb222', base: 3, set: { st: 'взлом' } }).err, 'st');

// новая версия плана: добавляются только версии, состояние существующих мероприятий не затирается
const p2 = plan({ m_aaa111: NS(), m_bbb222: NS(), m_ccc333: NS() }); p2.plan.versions.push({ n: 2, at: '2026-11-05', fp: 'bbb', items: [{ id: 'm_ccc333', title: 'Новое' }] });
r = P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: 0, data: p2 }); assert.strictEqual(r.err, 'newer');
const cur = G(ivan, { a: 'fcget', id: 'p_main_x' }).doc; assert.ok(cur.rev >= 4);
r = P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: cur.rev, data: p2 }); assert.strictEqual(r.ok, true, JSON.stringify(r));
d = G(ivan, { a: 'fcget', id: 'p_main_x' }).doc;
assert.strictEqual(d.data.plan.versions.length, 2); assert.strictEqual(d.data.plan.state.m_bbb222.st, 'done', 'выполнение не затёрто'); assert.strictEqual(d.data.plan.state.m_bbb222.asg.id, out.id); assert.ok(d.data.plan.state.m_ccc333);
// версия 1 переписана другим отпечатком — отклонено
const p3 = JSON.parse(JSON.stringify(p2)); p3.plan.versions[0].fp = 'подмена';
r = P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: d.rev, data: p3 }); assert.strictEqual(r.err, 'newer', 'зафиксированная версия не переписывается');
// меньше версий — тоже нет
const p4 = JSON.parse(JSON.stringify(p2)); p4.plan.versions.pop();
assert.strictEqual(P(ivan, { op: 'fcput', id: 'p_main_x', reg: 'main', base: d.rev, data: p4 }).err, 'newer');

// размер
const big = { batch: { id: 'b_main_big', type: 'sales', from: '2026-10-01', to: '2026-10-31' }, ops: { sales: [{ x: 'я'.repeat(5.5e6) }] } };
assert.strictEqual(P(ivan, { op: 'fcput', id: 'b_main_big', reg: 'main', data: big }).err, 'size');

// снимок версии: пишется один раз, исполнителю не отдаётся
r = P(ivan, { op: 'fcput', id: 's_main_x_1', reg: 'main', data: { snap: { ops: { sales: [{ id: 'o1' }] }, ings: {} } } }); assert.strictEqual(r.ok, true, JSON.stringify(r));
r = P(ivan, { op: 'fcput', id: 's_main_x_1', reg: 'main', data: { snap: { ops: { sales: [{ id: 'подмена' }] } } } }); assert.strictEqual(r.same, true);
assert.strictEqual(G(ivan, { a: 'fcget', id: 's_main_x_1' }).doc.data.snap.ops.sales[0].id, 'o1', 'снимок не перезаписан');
assert.strictEqual(P(mosk, { op: 'fcput', id: 's_main_y_1', reg: 'main', data: { snap: { ops: {} } } }).err, 'region');
assert.strictEqual(G(out, { a: 'fcget', id: 's_main_x_1' }).err, 'nofile');
assert.strictEqual(P(petr, { op: 'fcput', id: 's_main_z_1', reg: 'main', data: { snap: { ops: {} } } }).ok, false);
// список сотрудников для назначения: роль редактора и выше
let us = G(ivan, { a: 'fcusers' }); assert.strictEqual(us.ok, true); assert.ok(us.users.some(u => u.id === petr.id)); assert.ok(!('h' in us.users[0]), 'хэши кодов не отдаются');
assert.strictEqual(G(petr, { a: 'fcusers' }).err, 'role');
// отключённый исполнитель не может получить назначение
assert.strictEqual(post({ op: 'usroff', code: A, by: 'Технолог', id: petr.id, off: true }).ok, true);
assert.strictEqual(P(ivan, { op: 'fcact', id: 'p_main_x', mid: 'm_aaa111', base: 0, set: { asg: { t: 'user', id: petr.id, name: petr.name } } }).err, 'asg');
console.log('GAS fc30 ok');
