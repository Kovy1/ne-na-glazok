/* Файл с адресом подключения: Code.gs создаёт таблицу на Диске, записывает адрес /exec, открывает доступ по ссылке */
const assert = require('assert'), { createGas } = require('./gasmock');
const post = (g, o) => g.parseOut(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, o))).data;
const EXEC = 'https://script.google.com/macros/s/AKfycbxTESTdeploymentIDabcdefghijklmnopqrstuvwxyz0123456789/exec';
const EXEC2 = 'https://script.google.com/macros/s/AKfycbyNEWdeploymentIDabcdefghijklmnopqrstuvwxyz0123456789/exec';
(function () {
  const g = createGas({ strictExec: true });
  assert.strictEqual(g.parseOut(g.get({ a: 'ping' })).data.v, 31, 'версия скрипта 31');
  assert.strictEqual(g.parseOut(g.get({ a: 'ping' })).data.ptr, '', 'до подключения файла нет');
  // редактор не может записывать адрес
  let r = post(g, { op: 'addr', code: 'ed-1234', url: EXEC });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'admin');
  // неверный код
  r = post(g, { op: 'addr', code: 'bad-code', url: EXEC }); assert.strictEqual(r.err, 'code');
  // чужой адрес не принимается
  ['', 'http://script.google.com/macros/s/abc/exec', 'https://evil.example.com/macros/s/abc/exec', 'https://script.google.com/macros/s/abc/dev', 'https://script.google.com/macros/s/abc/exec?x=1'].forEach(u => {
    const x = post(g, { op: 'addr', code: 'adm-5678', url: u });
    assert.strictEqual(x.ok, false, u); assert.strictEqual(x.err, 'url', u);
  });
  assert.strictEqual(Object.keys(g.books).length, 0, 'при ошибке файл не создаётся');
  // технолог: создаётся файл, адрес записан, доступ по ссылке
  r = post(g, { op: 'addr', code: 'adm-5678', url: EXEC });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, true); assert.strictEqual(r.shared, true);
  assert.ok(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit$/.test(r.ptr), r.ptr);
  const ids = Object.keys(g.books); assert.strictEqual(ids.length, 1);
  const b = g.books[ids[0]]; assert.strictEqual(b.name, 'ТехнолоGия — адрес подключения');
  assert.strictEqual(b.sheet._sh.rows[0][0], EXEC); assert.ok(!/adm-5678|ed-1234/.test(JSON.stringify(b.sheet._sh.rows)), 'кодов в файле нет');
  assert.deepStrictEqual(b.item.shared, ['ANYONE_WITH_LINK', 'VIEW']);
  assert.strictEqual(g.parseOut(g.get({ a: 'ping' })).data.ptr, r.ptr, 'ping отдаёт ссылку на файл');
  // тот же адрес повторно: без изменений и без нового файла
  r = post(g, { op: 'addr', code: 'adm-5678', url: EXEC });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.changed, false); assert.strictEqual(Object.keys(g.books).length, 1);
  // новый адрес после нового развёртывания: тот же файл, новое значение
  r = post(g, { op: 'addr', code: 'adm-5678', url: EXEC2 });
  assert.strictEqual(r.changed, true); assert.strictEqual(Object.keys(g.books).length, 1); assert.strictEqual(b.sheet._sh.rows[0][0], EXEC2);
  // адрес в домене Workspace
  const EXEC3 = 'https://script.google.com/a/macros/example.com/s/AKfycbzDOMAINid123/exec';
  assert.strictEqual(post(g, { op: 'addr', code: 'adm-5678', url: EXEC3 }).ok, true);
  console.log('addr ok');
})();
(function () {
  // setup() создаёт файл заранее; адрес появится при подключении технолога
  const g = createGas({ strictExec: true });
  g.ctx.setup();
  assert.strictEqual(Object.keys(g.books).length, 1);
  const r = post(g, { op: 'addr', code: 'adm-5678', url: EXEC });
  assert.strictEqual(r.ok, true); assert.strictEqual(Object.keys(g.books).length, 1, 'файл тот же, что создал setup');
  console.log('setup ok');
})();
(function () {
  // организация запретила общий доступ: адрес записан, но об этом сказано
  const g = createGas({ noShare: true, strictExec: true });
  const r = post(g, { op: 'addr', code: 'adm-5678', url: EXEC });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.shared, false);
  console.log('noshare ok');
})();
(function () {
  // нет доступа к Диску: понятная ошибка, а не обрыв
  const g = createGas({ noDrive: true, strictExec: true });
  const r = post(g, { op: 'addr', code: 'adm-5678', url: EXEC });
  assert.strictEqual(r.ok, false); console.log('nodrive', r.err, String(r.msg).slice(0, 60));
})();
console.log('GAS PTR OK');
