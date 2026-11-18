/* Копия данных пользователя на Диске: запись, чтение, номера версий, предыдущая копия, чужие данные недоступны */
const assert = require('assert'), zlib = require('zlib'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012', V = 'view-3456';
function mk(opts) {
  const g = createGas(opts || {});
  /* v26: копия общего кода принадлежит устройству (секрет), а не ФИО. В тестах «устройство» человека задаётся его ФИО: одно ФИО — один секрет, как у одного браузера */
  const tok = by => 'tok-' + Buffer.from(String(by || 'x')).toString('hex').padEnd(16, '0').slice(0, 48);
  const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p && p.by !== undefined && p.bkt === undefined ? { bkt: tok(p.by) } : {}, p))).data;
  const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b && b.by !== undefined && b.bkt === undefined ? { bkt: tok(b.by) } : {}, b)).text);
  return { g, get, post, tok };
}
const json = o => Buffer.from(JSON.stringify(o)).toString('base64');
const gz = o => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
const put = (post, o = {}) => post(Object.assign({ op: 'bkput', code: A, by: 'Технолог', dev: 'devA1', label: 'Chrome · Windows', base: 0, enc: 'gz', data: gz({ v: 1, x: 1 }), n: { ings: 188, recipes: 12 } }, o));
const folder = (g, name) => Object.values(g.drive.items).find(x => x.kind === 'folder' && !x.trashed && x.name === name);
const live = g => Object.values(g.drive.items).filter(x => x.kind === 'file' && !x.trashed && /^Копия · /.test(x.name));

// ---------- версия и пустое состояние ----------
{
  const { g, get } = mk();
  assert.strictEqual(get(null, { a: 'ping' }).v, 31, 'версия скрипта 31');
  let r = get(null, { a: 'bkinfo', by: 'Технолог' });
  assert.strictEqual(r.err, 'code', 'без кода копию не показывают');
  r = get('плохой', { a: 'bkget', by: 'Технолог' }); assert.strictEqual(r.err, 'code');
  r = get(A, { a: 'bkinfo', by: 'Технолог' });
  assert.deepStrictEqual([r.ok, r.has, r.rev, r.cur, r.prev], [true, false, 0, null, null], JSON.stringify(r));
  r = get(A, { a: 'bkget', by: 'Технолог' }); assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'nocopy');
}

// ---------- запись, чтение, предыдущая копия ----------
{
  const { g, get, post } = mk();
  let r = put(post); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 1);
  const fo = folder(g, 'Копии данных ТехнолоGии'); assert.ok(fo, 'папка копий создана');
  assert.strictEqual(live(g).length, 1);
  assert.ok(/\.json\.gz$/.test(live(g)[0].name), live(g)[0].name);
  assert.ok(!live(g)[0].shared, 'файл копии закрыт: общего доступа не задано');
  let i = get(A, { a: 'bkinfo', by: 'Технолог' });
  assert.strictEqual(i.has, true); assert.strictEqual(i.rev, 1); assert.deepStrictEqual(i.cur.n, { ings: 188, recipes: 12 });
  assert.strictEqual(i.cur.dev, 'devA1'); assert.strictEqual(i.cur.label, 'Chrome · Windows'); assert.strictEqual(i.cur.enc, 'gz'); assert.strictEqual(i.prev, null);
  assert.ok(Math.abs(i.cur.at - Date.now()) < 60000);
  let d = get(A, { a: 'bkget', by: 'Технолог' });
  assert.strictEqual(d.ok, true); assert.deepStrictEqual(JSON.parse(zlib.gunzipSync(Buffer.from(d.data, 'base64'))), { v: 1, x: 1 }, 'прочитали ровно то, что записали');
  // вторая запись с верной базой; первая становится предыдущей
  r = put(post, { base: 1, data: gz({ v: 1, x: 2 }), dev: 'devB1' }); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 2);
  i = get(A, { a: 'bkinfo', by: 'Технолог' }); assert.strictEqual(i.rev, 2); assert.strictEqual(i.prev.rev, 1); assert.strictEqual(i.cur.dev, 'devB1');
  d = get(A, { a: 'bkget', by: 'Технолог', which: 'prev' });
  assert.deepStrictEqual(JSON.parse(zlib.gunzipSync(Buffer.from(d.data, 'base64'))), { v: 1, x: 1 }, 'предыдущая копия читается');
  // третья запись: самая старая уходит в корзину, файлов остаётся два
  r = put(post, { base: 2, data: gz({ v: 1, x: 3 }) }); assert.strictEqual(r.rev, 3);
  assert.strictEqual(live(g).length, 2, 'хранятся только текущая и предыдущая');
  i = get(A, { a: 'bkinfo', by: 'Технолог' }); assert.strictEqual(i.prev.rev, 2);
}

// ---------- защита от затирания более новой копии ----------
{
  const { g, get, post } = mk();
  put(post); put(post, { base: 1, data: gz({ x: 2 }) });          // на Диске версия 2
  let r = put(post, { base: 1, data: gz({ x: 'старый браузер' }), dev: 'devOld' });
  assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'newer'); assert.strictEqual(r.cur.rev, 2);
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Технолог' }).rev, 2, 'копия не изменилась');
  r = put(post, { base: 0, data: gz({ x: 'новый браузер' }) }); assert.strictEqual(r.err, 'newer', 'новый браузер без базы тоже не затирает');
  r = put(post, { base: 1, force: true, data: gz({ x: 'сознательно' }) });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 3, 'с подтверждением перезапись проходит');
  assert.deepStrictEqual(JSON.parse(zlib.gunzipSync(Buffer.from(get(A, { a: 'bkget', by: 'Технолог' }).data, 'base64'))), { x: 'сознательно' });
  // копию удалили с Диска вручную: следующая запись создаёт новую
  live(g).forEach(f => { f.trashed = true; });
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Технолог' }).has, false);
  r = put(post, { base: 3, data: gz({ x: 'заново' }) }); assert.strictEqual(r.ok, true); assert.strictEqual(r.rev, 4);
}

// ---------- чужие данные: ключ — роль и ФИО ----------
{
  const { g, get, post, tok } = mk();
  put(post, { by: 'Иванов Иван', data: gz({ who: 'admin' }) });
  assert.strictEqual(get(A, { a: 'bkinfo', by: ' иванов  ИВАН ', bkt: tok('Иванов Иван') }).has, true, 'то же устройство: ФИО можно написать по-разному');
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Иванов Иван', bkt: tok('чужой компьютер') }).has, false, 'v26: ФИО копию не открывает, нужен секрет устройства');
  assert.strictEqual(get(A, { a: 'bkget', by: 'Иванов Иван', bkt: tok('чужой компьютер') }).err, 'nocopy');
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Иванов Иван', bkt: 'короткий' }).err, 'bkt', 'без нормального секрета устройства копию не ведут');
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Иванов Иван', bkt: 'x'.repeat(16) }).has, false);
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Петров Пётр' }).has, false, 'другое ФИО — другая копия');
  assert.strictEqual(get(E, { a: 'bkinfo', by: 'Иванов Иван' }).has, false, 'редактор с таким же ФИО копию технолога не видит');
  assert.strictEqual(get(E, { a: 'bkget', by: 'Иванов Иван' }).err, 'nocopy');
  let r = put(post, { code: E, by: 'Иванов Иван', data: json({ who: 'editor' }), enc: '' });
  assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 1, 'у редактора своя нумерация');
  assert.strictEqual(get(E, { a: 'bkinfo', by: 'Иванов Иван' }).cur.enc, '');
  assert.deepStrictEqual(JSON.parse(Buffer.from(get(E, { a: 'bkget', by: 'Иванов Иван' }).data, 'base64').toString()), { who: 'editor' });
  assert.deepStrictEqual(JSON.parse(zlib.gunzipSync(Buffer.from(get(A, { a: 'bkget', by: 'Иванов Иван' }).data, 'base64'))), { who: 'admin' }, 'копия технолога осталась прежней');
  // экономист и просмотр тоже могут хранить свои данные
  for (const [code, who] of [[F, 'finance'], [V, 'viewer']]) {
    r = put(post, { code, by: 'Сидоров', data: gz({ who }) }); assert.strictEqual(r.ok, true, who + ' ' + JSON.stringify(r));
    assert.strictEqual(get(code, { a: 'bkinfo', by: 'Сидоров' }).has, true);
  }
  assert.strictEqual(get(A, { a: 'bkinfo', by: 'Сидоров' }).has, false);
  assert.strictEqual(post({ op: 'bkput', code: 'чужой-код', by: 'Х', data: gz({}), enc: 'gz' }).err, 'code', 'без верного кода не пишут');
}

// ---------- именной доступ: копия привязана к учётной записи, присланное ФИО чужую копию не открывает ----------
{
  const { g, get, post } = mk();
  const gets = (code, who, p) => g.parseOut(g.get(Object.assign({ code, who }, p))).data;     // именной вход: ФИО + код
  const add = (name, role, own = false) => post({ op: 'usradd', code: A, by: 'Технолог', name, role, own });
  const p1 = add('Петров П.П.', 'editor'), q1 = add('Сидоров С.С.', 'editor'), w1 = add('Волков В.В.', 'viewer');
  assert.ok(p1.ok && q1.ok && w1.ok);
  const P = 'Петров П.П.', Q = 'Сидоров С.С.';
  const putN = (code, by, o = {}) => post(Object.assign({ op: 'bkput', code, by, dev: 'dev' + by.length, label: 'Chrome', base: 0, enc: 'gz', data: gz({ owner: by }), n: { ings: 5, recipes: 2 } }, o));
  const read = d => JSON.parse(zlib.gunzipSync(Buffer.from(d.data, 'base64')));
  // Петров записал свою копию
  let r = putN(p1.code, P); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 1);
  assert.strictEqual(gets(p1.code, P, { a: 'bkinfo', by: P }).has, true);
  // Сидоров (та же роль), подставив ФИО Петрова, получает СВОЮ (пустую) копию, а не копию Петрова
  let i = gets(q1.code, Q, { a: 'bkinfo', by: P }); assert.strictEqual(i.ok, true); assert.strictEqual(i.has, false, 'чужое ФИО в запросе не открывает копию Петрова');
  let d = gets(q1.code, Q, { a: 'bkget', by: P }); assert.strictEqual(d.ok, false); assert.strictEqual(d.err, 'nocopy');
  d = gets(q1.code, Q, { a: 'bkget', by: P, which: 'prev' }); assert.strictEqual(d.err, 'nocopy');
  // запись идёт по ФИО + коду: код Сидорова с ФИО Петрова не пускает вовсе, а своя запись ложится только в копию Сидорова
  assert.strictEqual(putN(q1.code, P, { data: gz({ owner: 'подмена' }) }).err, 'code', 'запись с чужим ФИО не проходит');
  r = putN(q1.code, Q, { data: gz({ owner: Q }) }); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 1, 'у Сидорова своя нумерация');
  assert.deepStrictEqual(read(gets(p1.code, P, { a: 'bkget', by: P })), { owner: P }, 'копия Петрова осталась его');
  assert.strictEqual(gets(p1.code, P, { a: 'bkinfo', by: P }).rev, 1);
  d = gets(q1.code, Q, { a: 'bkget', by: Q }); assert.deepStrictEqual(read(d), { owner: Q });
  assert.strictEqual(d.by, Q, 'автором записан Сидоров (по учётной записи)');
  d = gets(q1.code, Q, { a: 'bkget', by: P }); assert.deepStrictEqual(read(d), { owner: Q }, 'с чужим ФИО Сидоров получает всё равно свою копию');
  // любой вариант записи ФИО у самого Петрова — всё равно его копия
  assert.strictEqual(gets(p1.code, P, { a: 'bkinfo', by: 'ПЕТРОВ п п' }).has, true);
  assert.strictEqual(gets(p1.code, P, { a: 'bkinfo', by: '' }).has, true, 'пустое ФИО в запросе не мешает: владелец определён по входу');
  // без верного кода или с чужим ФИО входа вообще нет
  assert.strictEqual(gets(p1.code, Q, { a: 'bkinfo', by: P }).err, 'code', 'код Петрова с ФИО Сидорова не подходит');
  assert.strictEqual(gets(q1.code, P, { a: 'bkget', by: P }).err, 'code', 'код Сидорова с ФИО Петрова не подходит');
  // общий код редактора не открывает копии именных пользователей ни под каким ФИО из их записи
  for (const nm of [P, 'петров п.п.', 'ПЕТРОВ П П']) {
    assert.strictEqual(get(E, { a: 'bkinfo', by: nm }).err, 'named', nm);
    assert.strictEqual(get(E, { a: 'bkget', by: nm }).err, 'named', nm);
    assert.strictEqual(putN(E, nm).err, 'named', nm);
  }
  assert.strictEqual(get(E, { a: 'bkinfo', by: 'Кто-то другой' }).ok, true, 'свободное имя общему коду доступно, как и раньше');
  // уведомления автору читаются тоже по учётной записи
  assert.deepStrictEqual(Object.keys(gets(q1.code, Q, { a: 'inbox', by: P })).sort(), ['batches', 'files', 'ok', 'rejected']);
  assert.strictEqual(get(E, { a: 'inbox', by: P }).batches.length, 0, 'общему коду с занятым именем уведомления не отдаются');
  // смена роли: копия роли — отдельная, как и раньше (в браузере остаются данные, на Диск запишется новая копия)
  assert.strictEqual(post({ op: 'usrrole', code: A, by: 'Технолог', id: p1.user.id, role: 'finance' }).ok, true);
  i = gets(p1.code, P, { a: 'bkinfo', by: P }); assert.strictEqual(i.has, false, 'у другой роли копии ещё нет'); assert.strictEqual(i.rev, 0);
  r = putN(p1.code, P, { data: gz({ owner: P, v: 2 }) }); assert.strictEqual(r.rev, 1);
  // удалённая учётная запись: новая запись с тем же ФИО начинает с чистой копии
  assert.strictEqual(post({ op: 'usrdel', code: A, by: 'Технолог', id: p1.user.id }).ok, true);
  const p2 = add(P, 'finance');
  assert.strictEqual(gets(p2.code, P, { a: 'bkinfo', by: P }).has, false, 'новая учётная запись не наследует копию удалённой');
}

// ---------- копия, записанная по ФИО до привязки к учётной записи, переезжает к хозяину учётной записи ----------
{
  const { g, get, post, tok } = mk();
  const vm = require('vm');
  const gets = (code, who, p) => g.parseOut(g.get(Object.assign({ code, who }, p))).data;
  const read = d => JSON.parse(zlib.gunzipSync(Buffer.from(d.data, 'base64')));
  /* копия, записанная прежней версией скрипта: ключ — роль и ФИО (теперь общий код так не пишет, поэтому переносим ключ вручную) */
  const legacy = (role, by) => {
    const nk = vm.runInContext('bkKey_(' + JSON.stringify(role) + ', { acct: false, t: ' + JSON.stringify(tok(by)) + ' })', g.ctx), ok = vm.runInContext("'bk:' + hash_(" + JSON.stringify(role) + " + '|' + nk_(" + JSON.stringify(by) + '))', g.ctx);
    const st = JSON.parse(g.props[nk]); if (st.cur) delete st.cur.rg; if (st.prev) delete st.prev.rg;      // прежняя версия скрипта регионы в копии не записывала
    g.props[ok] = JSON.stringify(st); delete g.props[nk];
  };
  // раньше человек работал по общему коду редактора и записал копию под своим ФИО
  let r = put(post, { code: E, by: 'Иванов И.И.', data: gz({ who: 'старая копия по ФИО' }) }); assert.strictEqual(r.ok, true);
  assert.strictEqual(r.rev, 1);
  // и копию другого человека той же роли
  put(post, { code: E, by: 'Кузнецов К.К.', data: gz({ who: 'чужая' }) });
  legacy('editor', 'Иванов И.И.'); legacy('editor', 'Кузнецов К.К.');
  // технолог завёл ему именной доступ с той же ролью
  const u = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Иванов И.И.', role: 'editor', own: false, regs: ['main', 'msk'] }); assert.ok(u.ok);
  assert.strictEqual(get(E, { a: 'bkinfo', by: 'Иванов И.И.' }).err, 'named', 'имя занято именным доступом: общий код старую копию больше не отдаёт');
  assert.strictEqual(get(E, { a: 'bkinfo', by: 'Кузнецов К.К.' }).has, false, 'v26: прежние копии общего кода по ФИО больше не открываются (владелец — секрет устройства), они остаются на Диске');
  let i = gets(u.code, 'Иванов И.И.', { a: 'bkinfo', by: 'иванов и и' });
  assert.strictEqual(i.has, true, 'хозяин учётной записи видит свою старую копию'); assert.strictEqual(i.rev, 1);
  assert.deepStrictEqual(read(gets(u.code, 'Иванов И.И.', { a: 'bkget', by: 'Иванов И.И.' })), { who: 'старая копия по ФИО' });
  // другой именной пользователь с такой же ролью старую копию не получает
  const o = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Орлов О.О.', role: 'editor', own: false, regs: ['main', 'msk'] });
  assert.strictEqual(gets(o.code, 'Орлов О.О.', { a: 'bkinfo', by: 'Иванов И.И.' }).has, false);
  // запись продолжает нумерацию и переносит копию на учётную запись; старая запись по ФИО удаляется
  const before = Object.keys(g.props).filter(k => /^bk:/.test(k)).length;
  r = post({ op: 'bkput', code: u.code, by: 'Иванов И.И.', dev: 'devX', label: 'Chrome', base: 1, enc: 'gz', data: gz({ who: 'новая' }), n: { ings: 1, recipes: 1 } });
  assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(r.rev, 2);
  assert.strictEqual(Object.keys(g.props).filter(k => /^bk:/.test(k)).length, before, 'ключ по ФИО заменён ключом учётной записи, а не добавлен');
  i = gets(u.code, 'Иванов И.И.', { a: 'bkinfo', by: 'Иванов И.И.' }); assert.strictEqual(i.rev, 2); assert.strictEqual(i.prev.rev, 1);
  assert.deepStrictEqual(read(gets(u.code, 'Иванов И.И.', { a: 'bkget', by: 'Иванов И.И.', which: 'prev' })), { who: 'старая копия по ФИО' }, 'предыдущая копия — прежняя');
  // записанная до этого с несовпадающей ролью копия не переезжает
  put(post, { code: V, by: 'Волков В.В.', data: gz({ who: 'шеф' }) }); legacy('viewer', 'Волков В.В.');
  const w = post({ op: 'usradd', code: A, by: 'Технолог', name: 'Волков В.В.', role: 'finance', own: false, regs: ['main', 'msk'] });
  assert.strictEqual(gets(w.code, 'Волков В.В.', { a: 'bkinfo', by: 'Волков В.В.' }).has, false, 'копия роли шеф-повара не переходит к управляющему');
}

// ---------- проверка присланного ----------
{
  const { g, get, post } = mk();
  assert.strictEqual(put(post, { data: '' }).err, 'empty');
  assert.strictEqual(put(post, { data: '***не base64***' }).err, 'b64');
  assert.strictEqual(put(post, { enc: 'gz', data: json({ x: 1 }) }).err, 'fmt', 'не gzip под видом gzip');
  assert.strictEqual(put(post, { enc: '', data: Buffer.from('MZ\u0000\u0000').toString('base64') }).err, 'fmt', 'не JSON');
  assert.strictEqual(put(post, { data: 'A'.repeat(8 * 1024 * 1024 + 4) }).err, 'size');
  assert.strictEqual(live(g).length, 0, 'ничего лишнего не записано');
  let r = put(post, { dev: 'a b<c>/d', label: 'Chrome\nWindows' });
  assert.strictEqual(r.ok, true);
  const i = get(A, { a: 'bkinfo', by: 'Технолог' });
  assert.ok(/^[\w-]*$/.test(i.cur.dev), i.cur.dev); assert.ok(!/\n/.test(i.cur.label));
}

// ---------- Диск не разрешён скрипту ----------
{
  const { g, post } = mk({ noDrive: true });
  const r = put(post); assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'drive', JSON.stringify(r));
}
console.log('GAS bk ok');
