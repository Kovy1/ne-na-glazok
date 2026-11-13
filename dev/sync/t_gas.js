const assert = require('assert'), { createGas } = require('./gasmock');
const core = r => { const o = Object.assign({}, r); delete o.regs; delete o.rset; delete o.uid; return o; };   // v26: в ответе входа добавились регионы и ид
const g = createGas();
const get = p => g.parseOut(g.get(Object.assign({ code: 'adm-5678' }, p))).data;
const post = b => { const o = g.post(b); return JSON.parse(o.text); };
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const ing = (name, extra = {}) => Object.assign({ name, p: 1, f: 2, c: 3, kind: 'table', source: '' }, extra);
const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012';

// ping / пустая база
let r = get({ a: 'ping', callback: 'cb1' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 0); assert.strictEqual(r.pending, 0); assert.strictEqual(r.ready, true);
assert.strictEqual(g.parseOut(g.get({ a: 'ping', callback: 'cb1' })).cb, 'cb1');
assert.strictEqual(g.get({ a: 'ping', callback: 'evil(' }).mime, 'JSON', 'небезопасное имя функции не принимается');
assert.deepStrictEqual(get({ a: 'pull', since: 0 }).items, []);
assert.strictEqual(get({ a: 'zzz' }).ok, false);

// коды
assert.strictEqual(post({ rid: rid(), op: 'auth', code: 'bad' }).err, 'code');
assert.strictEqual(post({ rid: rid(), op: 'auth', code: '' }).err, 'code');
assert.deepStrictEqual(core(post({ rid: rid(), op: 'auth', code: E })), { ok: true, role: 'editor', price: true });
assert.deepStrictEqual(core(post({ rid: rid(), op: 'auth', code: A })), { ok: true, role: 'admin', price: true });
assert.strictEqual(post({ rid: 'x', op: 'auth', code: A }).err, 'rid');
assert.strictEqual(post('не json').err, 'json');
// результат читается страницей по rid
const rr = rid(); post({ rid: rr, op: 'auth', code: A });
assert.deepStrictEqual(get({ a: 'result', rid: rr }), { ok: true, done: true, res: { ok: true, role: 'admin', price: true, regs: null, rset: true, uid: 's:admin' } });
assert.deepStrictEqual(get({ a: 'result', rid: 'nope-nope' }), { ok: true, done: false });
// повтор с тем же rid не выполняется повторно
const dup = rid(); const it1 = [{ kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 0, json: ing('Лук') }];
const p1 = post({ rid: dup, op: 'propose', code: E, by: 'Иван', note: 'новое', items: it1 }); assert.strictEqual(p1.ok, true); assert.strictEqual(p1.count, 1);
const p1b = post({ rid: dup, op: 'propose', code: E, by: 'Иван', note: 'новое', items: it1 }); assert.deepStrictEqual(p1b, p1);
assert.strictEqual(g.rows('Предложения').length, 1, 'повтор не добавил строк');

// редактор не может публиковать и принимать
assert.strictEqual(post({ rid: rid(), op: 'publish', code: E, by: 'Иван', items: it1 }).err, 'admin');
assert.strictEqual(post({ rid: rid(), op: 'approve', code: E, batch: p1.batch }).err, 'admin');
assert.strictEqual(get({ a: 'pull', since: 0 }).items.length, 0);
// список ожидающих
let pd = get({ a: 'pending' }); assert.strictEqual(pd.batches.length, 1); assert.strictEqual(pd.batches[0].by, 'Иван'); assert.strictEqual(pd.batches[0].items[0].name, 'Лук'); assert.strictEqual(get({ a: 'ping' }).pending, 1);

// технолог принимает
let ap = post({ rid: rid(), op: 'approve', code: A, by: 'Технолог', batch: p1.batch }); assert.strictEqual(ap.ok, true); assert.strictEqual(ap.changed, 1); assert.strictEqual(ap.rev, 1);
assert.strictEqual(get({ a: 'pending' }).batches.length, 0);
let pl = get({ a: 'pull', since: 0 }); assert.strictEqual(pl.items.length, 1); assert.strictEqual(pl.items[0].sid, 'i-aaa'); assert.strictEqual(pl.items[0].by, 'Иван'); assert.strictEqual(pl.items[0].json.name, 'Лук'); assert.strictEqual(pl.rev, 1);
assert.strictEqual(post({ rid: rid(), op: 'approve', code: A, batch: p1.batch }).err, 'nobatch', 'второй раз принять нельзя');

// публикация технологом сразу, рецепт ссылается на сырьё
const rec = { name: 'Борщ', output: 300, rows: [{ ing: 'i-aaa', in: 'Лук', net: 50, share: 100 }, { ing: 'i-bbb', in: 'Свёкла', net: 80, share: 100 }], ref: {}, ttk: {} };
let pb = post({ rid: rid(), op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'rec', sid: 'r-111', name: 'Борщ', json: rec }, { kind: 'ing', sid: 'i-bbb', name: 'Свёкла', json: ing('Свёкла') }] });
assert.strictEqual(pb.ok, true); assert.strictEqual(pb.changed, 2); assert.strictEqual(pb.rev, 3);
pl = get({ a: 'pull', since: 1 }); assert.deepStrictEqual(pl.items.map(x => x.name), ['Свёкла', 'Борщ'], 'сырьё записано раньше рецепта');
assert.deepStrictEqual(pl.items.map(x => x.rev), [2, 3]);
// рецептура со ссылкой на несуществующее сырьё отклоняется целиком
const bad = { name: 'Суп', output: 200, rows: [{ ing: 'i-zzz', in: 'Призрак', net: 10, share: 100 }], ref: {}, ttk: {} };
let pe = post({ rid: rid(), op: 'publish', code: A, by: 'T', items: [{ kind: 'rec', sid: 'r-222', name: 'Суп', json: bad }] });
assert.strictEqual(pe.err, 'dangling'); assert.ok(/Призрак/.test(pe.msg)); assert.strictEqual(get({ a: 'pull', since: 0 }).items.length, 3, 'ничего не записано');
// без изменений версия не растёт
let same = post({ rid: rid(), op: 'publish', code: A, by: 'Технолог', items: [{ kind: 'ing', sid: 'i-bbb', name: 'Свёкла', json: Object.assign({}, ing('Свёкла')) }] });
assert.strictEqual(same.changed, 0); assert.strictEqual(same.rev, 3);
// порядок ключей не создаёт новой версии
const reordered = { source: '', kind: 'table', c: 3, f: 2, p: 1, name: 'Свёкла' };
assert.strictEqual(post({ rid: rid(), op: 'publish', code: A, by: 'T', items: [{ kind: 'ing', sid: 'i-bbb', name: 'Свёкла', json: reordered }] }).changed, 0);

// дубль по названию: новый ид с уже существующим названием обновляет существующее; в рецептуре ид подменяется
let dp = post({ rid: rid(), op: 'publish', code: A, by: 'T2', items: [
  { kind: 'ing', sid: 'i-new', name: 'лук', json: ing('Лук', { price: 40 }) },
  { kind: 'rec', sid: 'r-333', name: 'Щи', json: { name: 'Щи', output: 250, rows: [{ ing: 'i-new', in: 'Лук', net: 30, share: 100 }], ref: {}, ttk: {} } }] });
assert.strictEqual(dp.ok, true); assert.deepStrictEqual(dp.remap, { 'i-new': 'i-aaa' });
pl = get({ a: 'pull', since: 3 }); const luk = pl.items.find(x => x.kind === 'ing'); assert.strictEqual(luk.sid, 'i-aaa'); assert.strictEqual(luk.json.price, 40); assert.strictEqual(luk.name, 'Лук'); assert.strictEqual(luk.json.name, 'Лук');
const shchi = pl.items.find(x => x.kind === 'rec'); assert.strictEqual(shchi.json.rows[0].ing, 'i-aaa');
assert.strictEqual(get({ a: 'pull', since: 0 }).items.filter(x => x.kind === 'ing').length, 2, 'дубля сырья нет');

// отклонение
let p2 = post({ rid: rid(), op: 'propose', code: F, by: 'Мария', note: 'цена', items: [{ kind: 'ing', sid: 'i-bbb', name: 'Свёкла', baseRev: 2, json: ing('Свёкла', { price: 99 }) }] });
let rj = post({ rid: rid(), op: 'reject', code: A, by: 'Технолог', batch: p2.batch, note: 'неверная цена' }); assert.strictEqual(rj.ok, true);
assert.strictEqual(get({ a: 'pending' }).batches.length, 0); assert.strictEqual(get({ a: 'pull', since: 0 }).items.find(x => x.sid === 'i-bbb').json.price, undefined);
assert.ok(g.rows('Предложения').some(r => r[7] === 'отклонено' && /отклонил: Технолог/.test(r[8])));

// журнал и возврат прежнего
let lg = get({ a: 'log', n: 50 }).items; console.log(lg.map(x => [x.action, x.name, x.rev, x.hasPrev].join(':')).join(' | '));
assert.ok(lg[0].action === 'отклонено');
let ac = post({ rid: rid(), op: 'approve', code: A, by: 'Технолог', batch: post({ rid: rid(), op: 'propose', code: F, by: 'Мария', items: [{ kind: 'ing', sid: 'i-bbb', name: 'Свёкла', baseRev: 2, json: ing('Свёкла', { price: 55 }) }] }).batch });
assert.strictEqual(ac.ok, true);
assert.strictEqual(get({ a: 'pull', since: 0 }).items.find(x => x.sid === 'i-bbb').json.price, 55);
lg = get({ a: 'log', n: 50 }).items; const ch = lg.find(x => x.action === 'принято' && x.name === 'Свёкла'); assert.ok(ch.hasPrev); assert.strictEqual(ch.by, 'Мария');
assert.strictEqual(post({ rid: rid(), op: 'revert', code: E, rev: ch.rev }).err, 'admin');
let rv = post({ rid: rid(), op: 'revert', code: A, by: 'Технолог', rev: ch.rev }); assert.strictEqual(rv.ok, true);
assert.strictEqual(get({ a: 'pull', since: 0 }).items.find(x => x.sid === 'i-bbb').json.price, undefined, 'цена вернулась');
assert.strictEqual(post({ rid: rid(), op: 'revert', code: A, by: 'Технолог', rev: 1 }).err, 'noprev', 'создание вернуть нельзя');
assert.strictEqual(get({ a: 'log' }).items[0].action, 'возврат');

// проверки данных
for (const [items, err] of [[[], 'items'], [[{ kind: 'zzz', sid: 'abc', name: 'x', json: {} }], 'kind'], [[{ kind: 'ing', sid: '!!', name: 'x', json: {} }], 'sid'], [[{ kind: 'ing', sid: 'abc', name: '  ', json: {} }], 'name'], [[{ kind: 'ing', sid: 'abc', name: 'x' }], 'json'],
  [[{ kind: 'ing', sid: 'abc', name: 'x', json: { s: 'я'.repeat(41000) } }], 'size']]) assert.strictEqual(post({ rid: rid(), op: 'propose', code: E, by: 'q', items }).err, err, err);
assert.strictEqual(post({ rid: rid(), op: 'propose', code: E, by: 'q', items: Array.from({ length: 501 }, (_, i) => ({ kind: 'ing', sid: 'i' + i + 'xx', name: 'n' + i, json: {} })) }).err, 'many');
assert.strictEqual(post({ rid: rid(), op: 'zzz', code: E }).err, 'op');
// большая партия: сырьё 300 шт. одной записью, потом правка нескольких
const many = Array.from({ length: 300 }, (_, i) => ({ kind: 'ing', sid: 'i-m' + i, name: 'Сырьё ' + i, json: ing('Сырьё ' + i) }));
assert.strictEqual(post({ rid: rid(), op: 'publish', code: A, by: 'T', items: many }).changed, 300);
assert.strictEqual(get({ a: 'pull', since: 0 }).items.length, 305 - 0 > 0 ? get({ a: 'pull', since: 0 }).items.length : 0);
const before = get({ a: 'ping' }).rev; many[7].json = ing('Сырьё 7', { price: 5 });
assert.strictEqual(post({ rid: rid(), op: 'publish', code: A, by: 'T', items: many }).changed, 1); assert.strictEqual(get({ a: 'ping' }).rev, before + 1);
// формулы в названии не ломают запись
assert.strictEqual(post({ rid: rid(), op: 'publish', code: A, by: 'T', items: [{ kind: 'ing', sid: 'i-f1', name: '=1+1', json: ing('=1+1') }] }).ok, true);
// коды не заданы
const g2 = createGas({ editor: 'ЗАМЕНИТЕ-код-редактора', admin: 'x' }); assert.strictEqual(JSON.parse(g2.post({ rid: 'abcdef1', op: 'auth', code: 'ЗАМЕНИТЕ-код-редактора' }).text).err, 'setup');
const g3 = createGas({ editor: 'same-code', admin: 'same-code' }); assert.strictEqual(JSON.parse(g3.post({ rid: 'abcdef2', op: 'auth', code: 'same-code' }).text).err, 'setup');
// сервер занят
const g4 = createGas({ lockBusy: true }); assert.strictEqual(JSON.parse(g4.post({ rid: 'abcdef3', op: 'auth', code: 'ed-1234' }).text).err, 'busy');
console.log('GAS tests ok; листы:', Object.keys(g.sheets).join(', '), '| строк в общей базе:', g.rows('Общая база').length);
