/* v29: «Что изменилось» — номер прочитанного выпуска за именной учётной записью; по общему коду не хранится; номер только растёт */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const A = 'adm-5678', E = 'ed-1234';
const g = createGas();
const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
vm.runInContext('setup()', g.ctx);
assert.strictEqual(vm.runInContext('VERSION', g.ctx), 30);
// общий код: имени нет, ничего не пишется
let r = post({ op: 'relget', code: E, by: 'Ред' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.shared, true);
r = post({ op: 'relput', code: E, by: 'Ред', v: 90 }); assert.strictEqual(r.shared, true);
// именной пользователь
const c = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Петров П.П.', role: 'editor', own: false });
assert.strictEqual(c.ok, true);
r = post({ op: 'relget', code: c.code, by: 'Петров П.П.' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.v, 0); assert.ok(!r.shared);
r = post({ op: 'relput', code: c.code, by: 'Петров П.П.', v: 91 }); assert.strictEqual(r.v, 91);
r = post({ op: 'relput', code: c.code, by: 'Петров П.П.', v: 80 }); assert.strictEqual(r.v, 91, 'номер не уменьшается');
assert.strictEqual(post({ op: 'relget', code: c.code, by: 'Петров П.П.' }).v, 91);
assert.strictEqual(post({ op: 'relput', code: c.code, by: 'Петров П.П.', v: -5 }).ok, false);
// у другого пользователя своя запись
const c2 = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Сидорова А.В.', role: 'viewer', own: false });
assert.strictEqual(post({ op: 'relget', code: c2.code, by: 'Сидорова А.В.' }).v, 0);
console.log('GAS rel29 ok');
