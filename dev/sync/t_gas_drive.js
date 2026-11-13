const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678';
const VER = Number(/var VERSION = (\d+)/.exec(require('fs').readFileSync(__dirname + '/Code.gs', 'utf8'))[1]);
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const mkDocx = (size = 2000, tag = 'x') => { const b = Buffer.alloc(size, 7); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4; b.write(tag, 10); return b; };
const b64 = b => Buffer.from(b).toString('base64');

(function main() {
  const g = createGas();
  const get = p => g.parseOut(g.get(Object.assign({ code: 'adm-5678' }, p))).data;
  const post = b => JSON.parse(g.post(b).text);

  // до setup папок нет: список пуст и ready=false, скачивать нечего
  assert.deepStrictEqual(get({ a: 'files' }), { ok: true, ready: false, v: VER, files: [], dirs: [], regs: [] });
  assert.strictEqual(get({ a: 'file', id: 'abcdefghijkl' }).err, 'nofolder');

  // setup создаёт папку и подпапку, повторный setup ничего не дублирует
  vm.runInContext('setup()', g.ctx);
  const f1 = g.props.folder, f2 = g.props.folderPend; assert.ok(f1 && f2 && f1 !== f2);
  assert.strictEqual(g.drive.items[f1].name, 'ТТК калькулятора'); assert.strictEqual(g.drive.items[f2].name, 'На проверке'); assert.deepStrictEqual(g.drive.items[f2].parents, [f1]);
  vm.runInContext('setup()', g.ctx); assert.strictEqual(g.props.folder, f1); assert.strictEqual(Object.values(g.drive.items).filter(x => x.kind === 'folder').length, 4, 'корень, «На проверке» и две папки регионов');
  { const f0 = get({ a: 'files' }); assert.strictEqual(typeof f0.fv, 'number'); delete f0.fv; assert.deepStrictEqual(f0, { ok: true, ready: true, v: VER, files: [], dirs: [], regs: [{ id: 'main', name: 'Волгоград' }, { id: 'msk', name: 'Москва' }] }); }

  // загрузка: технолог → в основную, редактор → «На проверку»
  const d1 = mkDocx(3000, 'one');
  let r = post({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'ТТК №14 Котлета.docx', b64: b64(d1) });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.kind, 'main'); assert.strictEqual(g.drive.items[r.id].parents[0], f1);
  const idA = r.id;
  r = post({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Борщ.docx', b64: b64(mkDocx(1500, 'bor')), note: 'новая' });
  assert.strictEqual(r.ok, true); assert.strictEqual(r.kind, 'pend'); assert.strictEqual(g.drive.items[r.id].parents[0], f2); const idB = r.id;
  let L = get({ a: 'files' }).files;
  assert.deepStrictEqual(L.map(x => [x.name, x.kind, x.by]), [['Борщ.docx', 'pend', 'Иван'], ['ТТК №14 Котлета.docx', 'main', 'Технолог']], 'сортировка по имени, автор из описания');
  assert.strictEqual(L[1].size, 3000); assert.ok(L[1].at > 0);

  // скачивание: байты совпадают, отдаёт и из основной, и из «На проверке»
  let dl = get({ a: 'file', id: idA }); assert.strictEqual(dl.ok, true); assert.strictEqual(dl.name, 'ТТК №14 Котлета.docx'); assert.ok(Buffer.from(dl.b64, 'base64').equals(d1));
  assert.strictEqual(get({ a: 'file', id: idB }).ok, true);
  // чужие и неверные идентификаторы
  const other = g.ctx.DriveApp.createFolder('Чужая папка'); const foreign = other.createFile({ bytes: [80, 75, 3, 4], mime: 'x', name: 'secret.docx' }).getId();
  assert.strictEqual(get({ a: 'file', id: foreign }).err, 'nofile', 'файл вне папок ТТК не отдаётся');
  assert.strictEqual(get({ a: 'file', id: other.getId() }).err, 'nofile');
  assert.strictEqual(get({ a: 'file', id: '../etc/passwd' }).err, 'id'); assert.strictEqual(get({ a: 'file', id: '' }).err, 'id'); assert.strictEqual(get({ a: 'file', id: 'zzzzzzzzzzzz' }).err, 'nofile');

  // замена файла с тем же именем: прежний в корзине, в списке один
  const d2 = mkDocx(3500, 'two');
  r = post({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'ТТК №14 Котлета.docx', b64: b64(d2) }); assert.strictEqual(r.ok, true);
  assert.strictEqual(g.drive.items[idA].trashed, false, 'прежний не удаляется, а уходит в архив'); L = get({ a: 'files' }).files.filter(x => x.kind === 'main'); assert.strictEqual(L.length, 1); assert.strictEqual(L[0].size, 3500);
  { const ar = get({ a: 'files' }).files.filter(x => x.kind === 'arch'); assert.strictEqual(ar.length, 1); assert.strictEqual(ar[0].id, idA); assert.ok(/ТТК №14 Котлета \(до \d{4}-\d{2}-\d{2} \d{2}-\d{2}\)\.docx/.test(ar[0].name), ar[0].name); assert.strictEqual(ar[0].arch.name, 'ТТК №14 Котлета.docx'); }
  assert.strictEqual(get({ a: 'file', id: idA }).ok, true, 'файл из архива технолог может скачать');

  // повтор запроса с тем же rid не создаёт второго файла
  const same = rid(), body = { rid: same, op: 'upload', code: E, by: 'Иван', name: 'Щи.docx', b64: b64(mkDocx(900, 'shi')) };
  const u1 = post(body), u2 = post(body); assert.deepStrictEqual(u1, u2); assert.strictEqual(g.driveFiles('pend').filter(x => x.name === 'Щи.docx').length, 1);

  // проверки загрузки
  const bad = (o, err) => assert.strictEqual(post(Object.assign({ rid: rid(), op: 'upload', code: E, by: 'q', name: 'a.docx', b64: b64(mkDocx(500)) }, o)).err, err, err);
  bad({ name: 'a.xlsx' }, 'ext'); bad({ name: '' }, 'ext'); bad({ name: 'a.docx.exe' }, 'ext'); bad({ b64: '' }, 'empty');
  bad({ b64: b64(Buffer.from('это не docx, а просто текст, очень длинный текст '.repeat(5))) }, 'docx');
  bad({ b64: b64(mkDocx(50)) }, 'docx');
  bad({ b64: '!!!не base64!!!' }, 'b64');
  bad({ b64: b64(mkDocx(3 * 1024 * 1024 + 10)) }, 'size');
  bad({ code: 'bad' }, 'code');
  // имя очищается от опасных символов и путей
  r = post({ rid: rid(), op: 'upload', code: A, by: 'T', name: '..\\..\\a/b:c*?"<>|.docx', b64: b64(mkDocx(500, 'nm')) }); assert.strictEqual(r.ok, true);
  assert.ok(!/[\\\/:*?"<>|]/.test(r.name), r.name); assert.ok(/\.docx$/.test(r.name));
  assert.strictEqual(post({ rid: rid(), op: 'upload', code: A, by: 'T', name: ' '.repeat(5) + 'Длинное' + 'я'.repeat(300) + '.docx', b64: b64(mkDocx(500, 'ln')) }).name.length <= 150, true);

  // принять / отклонить / удалить — только технолог
  for (const op of ['fapprove', 'freject', 'fdelete']) assert.strictEqual(post({ rid: rid(), op, code: E, id: idB }).err, 'admin', op);
  // принять: файл переезжает в основную папку, одноимённый старый уходит в корзину
  post({ rid: rid(), op: 'upload', code: E, by: 'Пётр', name: 'ТТК №14 Котлета.docx', b64: b64(mkDocx(1234, 'ed')) }); const idP = get({ a: 'files' }).files.find(x => x.kind === 'pend' && x.name === 'ТТК №14 Котлета.docx').id;
  const oldMain = get({ a: 'files' }).files.find(x => x.kind === 'main' && x.name === 'ТТК №14 Котлета.docx').id;
  r = post({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: idP, note: 'ок' }); assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(g.drive.items[idP].parents, [f1]); assert.strictEqual(g.drive.items[oldMain].trashed, false); assert.strictEqual(get({ a: 'files' }).files.find(x => x.id === oldMain).kind, 'arch', 'прежняя версия ушла в архив');
  assert.strictEqual(get({ a: 'files' }).files.filter(x => x.name === 'ТТК №14 Котлета.docx').length, 1);
  assert.strictEqual(get({ a: 'files' }).files.find(x => x.name === 'ТТК №14 Котлета.docx').by, 'Пётр', 'автор сохраняется после принятия');
  assert.strictEqual(post({ rid: rid(), op: 'fapprove', code: A, id: idP }).err, 'nofile', 'повторно принять нельзя: файл уже не в «На проверке»');
  // отклонить
  r = post({ rid: rid(), op: 'freject', code: A, by: 'Технолог', id: idB, note: 'нет граммовки' }); assert.strictEqual(r.ok, true); assert.strictEqual(g.drive.items[idB].trashed, true);
  assert.ok(!get({ a: 'files' }).files.some(x => x.id === idB));
  assert.strictEqual(post({ rid: rid(), op: 'freject', code: A, id: idA }).err, 'nofile');
  // удалить можно только файл из основной папки, не из «На проверке»
  const idS = get({ a: 'files' }).files.find(x => x.name === 'Щи.docx').id;
  assert.strictEqual(post({ rid: rid(), op: 'fdelete', code: A, id: idS }).err, 'nofile');
  r = post({ rid: rid(), op: 'fdelete', code: A, by: 'Технолог', id: idP }); assert.strictEqual(r.ok, true); assert.strictEqual(g.drive.items[idP].trashed, true);
  assert.strictEqual(post({ rid: rid(), op: 'fdelete', code: A, id: foreign }).err, 'nofile', 'чужой файл удалить нельзя'); assert.strictEqual(g.drive.items[foreign].trashed, false);

  // файл, положенный в папку вручную (перетаскиванием): виден, без автора; не-docx игнорируются
  const manual = g.dropFile('main', 'Вручную.docx', mkDocx(800, 'man')); g.dropFile('main', 'заметки.txt', Buffer.from('hi'));
  const m = get({ a: 'files' }).files.find(x => x.id === manual); assert.ok(m); assert.strictEqual(m.by, ''); assert.strictEqual(m.kind, 'main');
  assert.ok(!get({ a: 'files' }).files.some(x => x.name === 'заметки.txt'));
  assert.strictEqual(get({ a: 'file', id: manual }).ok, true);

  // журнал: действия с файлами записаны, и работа с ними не ломает журнал общей базы
  const lg = get({ a: 'log', n: 100 }).items.filter(x => x.kind === 'файл'); const acts = lg.map(x => x.action);
  for (const a of ['файл добавлен', 'файл предложен', 'файл принят', 'файл отклонён', 'файл удалён']) assert.ok(acts.includes(a), a);
  assert.ok(lg.every(x => x.hasPrev === false && x.rev === 0));
  assert.strictEqual(get({ a: 'ping' }).rev, 0, 'файлы не меняют версию общей базы');

  // «На проверке» — не больше 100 файлов
  const g2 = createGas(); vm.runInContext('setup()', g2.ctx);
  for (let i = 0; i < 100; i++) g2.dropFile('pend', 'f' + i + '.docx', mkDocx(300, 'f' + i));
  const full = JSON.parse(g2.post({ rid: rid(), op: 'upload', code: E, by: 'q', name: 'ещё.docx', b64: b64(mkDocx(500)) }).text); assert.strictEqual(full.err, 'full');
  assert.strictEqual(JSON.parse(g2.post({ rid: rid(), op: 'upload', code: A, by: 'q', name: 'ещё.docx', b64: b64(mkDocx(500)) }).text).ok, true, 'технолог загружает и при полной «На проверке»');

  // папку удалили в корзину: список снова пуст (ready=false), setup создаёт заново; запись создаёт папки сама
  const g3 = createGas(); vm.runInContext('setup()', g3.ctx); g3.drive.items[g3.props.folder].trashed = true;
  assert.strictEqual(g3.parseOut(g3.get({ a: 'files', code: 'adm-5678' })).data.ready, false);
  const up3 = JSON.parse(g3.post({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'a.docx', b64: b64(mkDocx(400)) }).text); assert.strictEqual(up3.ok, true);
  assert.strictEqual(g3.parseOut(g3.get({ a: 'files', code: 'adm-5678' })).data.files.length, 1);

  // у скрипта нет доступа к Диску (не запускали setup после обновления)
  const g4 = createGas({ noDrive: true });
  const e1 = JSON.parse(g4.post({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'a.docx', b64: b64(mkDocx(400)) }).text); assert.strictEqual(e1.err, 'drive'); assert.ok(/setup/.test(e1.msg));
  g4.props.folder = 'drv9999AbCdEfGhIj'; g4.props.folderPend = 'drv9998AbCdEfGhIj';
  const e2 = g4.parseOut(g4.get({ a: 'files', code: 'adm-5678' })).data; assert.ok(e2.ok === false || e2.ready === false, JSON.stringify(e2));
  // остальные операции общей базы работают без Диска
  assert.strictEqual(JSON.parse(g4.post({ rid: rid(), op: 'publish', code: A, by: 'T', items: [{ kind: 'ing', sid: 'i-1', name: 'Лук', json: { name: 'Лук', p: 1, f: 1, c: 1 } }] }).text).ok, true);

  // ---------- папки библиотеки ----------
  const h = createGas(); vm.runInContext('setup()', h.ctx);
  const hg = p => h.parseOut(h.get(Object.assign({ code: 'adm-5678' }, p))).data, hp = b => JSON.parse(h.post(b).text);
  const hroot = h.props.folder, hpend = h.props.folderPend;
  // создавать и менять папки может только технолог
  for (const o of [{ op: 'dcreate', name: 'Салаты' }, { op: 'drename', id: 'x', name: 'y' }, { op: 'ddelete', id: 'x' }, { op: 'fmove', id: 'x', dir: '' }]) assert.strictEqual(hp(Object.assign({ rid: rid(), code: E, by: 'q' }, o)).err, 'admin', o.op);
  let c1 = hp({ rid: rid(), op: 'dcreate', code: A, by: 'Технолог', name: '  Первые   блюда ' }); assert.strictEqual(c1.ok, true); assert.strictEqual(c1.name, 'Первые блюда');
  assert.deepStrictEqual(h.drive.items[c1.id].parents, [hroot]);
  const c2 = hp({ rid: rid(), op: 'dcreate', code: A, by: 'Технолог', name: 'Салаты' }); assert.strictEqual(c2.ok, true);
  const c3 = hp({ rid: rid(), op: 'dcreate', code: A, by: 'Технолог', name: 'Вторые блюда' });
  // названия: пустое, повтор (без учёта регистра и ё), «На проверке», опасные символы
  const dbad = (name, err) => assert.strictEqual(hp({ rid: rid(), op: 'dcreate', code: A, by: 'T', name }).err, err, String(name));
  dbad('', 'name'); dbad('   ', 'name'); dbad('///', 'name'); dbad('САЛАТЫ', 'taken'); dbad('первые  блюда', 'taken'); dbad('на проверке', 'taken'); dbad('На   проверке!', 'taken');
  assert.strictEqual(hp({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'Ёж/ик' }).name, 'Ёж ик', 'косые черты заменяются пробелом');
  let L2 = hg({ a: 'files' }); assert.deepStrictEqual(L2.dirs.map(d => d.name), ['Ёж ик', 'Вторые блюда', 'Первые блюда', 'Салаты'].sort((a, b) => a.localeCompare(b, 'ru')));
  // «На проверке» не попадает в список папок
  assert.ok(!L2.dirs.some(d => d.id === hpend));

  // технолог загружает сразу в папку, редактор — в «На проверке» с пожеланием
  const dirSal = c2.id, dirFirst = c1.id;
  let u = hp({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'Цезарь.docx', b64: b64(mkDocx(900, 'cz')), dir: dirSal }); assert.strictEqual(u.ok, true); assert.deepStrictEqual(h.drive.items[u.id].parents, [dirSal]);
  const idCz = u.id;
  u = hp({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'Без папки.docx', b64: b64(mkDocx(900, 'bp')) }); assert.deepStrictEqual(h.drive.items[u.id].parents, [hroot]); const idNo = u.id;
  assert.strictEqual(hp({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'z.docx', b64: b64(mkDocx(500)), dir: 'drv9999XXXXXXXXXXXX' }).err, 'nodir', 'технолог: неверная папка — ошибка');
  assert.strictEqual(hp({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'z.docx', b64: b64(mkDocx(500)), dir: hpend }).err, 'nodir', '«На проверке» — не папка библиотеки');
  u = hp({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Борщ.docx', b64: b64(mkDocx(1200, 'bs')), dir: dirFirst }); assert.strictEqual(u.kind, 'pend'); assert.deepStrictEqual(h.drive.items[u.id].parents, [hpend]); const idBorsch = u.id;
  u = hp({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Щи.docx', b64: b64(mkDocx(1200, 'sh')), dir: 'левая-папка-xxxxxx' }); assert.strictEqual(u.ok, true, 'у редактора неверное пожелание не мешает загрузке'); const idShi = u.id;
  L2 = hg({ a: 'files' });
  const row = n => L2.files.find(x => x.name === n);
  assert.deepStrictEqual([row('Цезарь.docx').kind, row('Цезарь.docx').dir, row('Без папки.docx').dir, row('Борщ.docx').kind, row('Борщ.docx').want, row('Щи.docx').want], ['main', dirSal, '', 'pend', dirFirst, '']);

  // кэш списка: повторный запрос из кэша, любая запись его сбрасывает, «fresh» читает Диск заново
  assert.ok(h.cache.fl, 'список сохранён в кэше');
  const manualId = h.dropFileIn(dirSal, 'Вручную.docx', mkDocx(700, 'mn'));
  assert.ok(!hg({ a: 'files' }).files.some(x => x.id === manualId), 'из кэша: файл, брошенный вручную, пока не виден');
  assert.ok(hg({ a: 'files', fresh: '1' }).files.some(x => x.id === manualId), 'fresh читает Диск заново');
  hp({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'Новый.docx', b64: b64(mkDocx(500, 'nv')) }); assert.ok(!('fl' in h.cache), 'запись сбрасывает кэш');

  // принять: в пожелание автора / в выбранную технологом папку / в «Без папки»; повтор невозможен
  let ap = hp({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: idBorsch }); assert.strictEqual(ap.ok, true); assert.deepStrictEqual(h.drive.items[idBorsch].parents, [dirFirst], 'по умолчанию — папка из пожелания');
  ap = hp({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: idShi, dir: dirSal }); assert.deepStrictEqual(h.drive.items[idShi].parents, [dirSal], 'технолог выбрал другую папку');
  assert.strictEqual(hp({ rid: rid(), op: 'fapprove', code: A, id: idShi }).err, 'nofile');
  const idUp = hp({ rid: rid(), op: 'upload', code: E, by: 'Ира', name: 'Рагу.docx', b64: b64(mkDocx(800, 'rg')), dir: dirFirst }).id;
  ap = hp({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: idUp, dir: '' }); assert.deepStrictEqual(h.drive.items[idUp].parents, [hroot], 'явно «Без папки»');
  // пожелание устарело (папку удалили): файл идёт в «Без папки», а не падает
  const tmp = hp({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'Временная' }); const idT = hp({ rid: rid(), op: 'upload', code: E, by: 'Ира', name: 'Тест.docx', b64: b64(mkDocx(800, 'ts')), dir: tmp.id }).id;
  assert.strictEqual(hp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: tmp.id }).ok, true, 'в папке нет файлов (заявка лежит в «На проверке»)');
  ap = hp({ rid: rid(), op: 'fapprove', code: A, by: 'T', id: idT }); assert.strictEqual(ap.ok, true); assert.deepStrictEqual(h.drive.items[idT].parents, [hroot]);
  assert.strictEqual(hp({ rid: rid(), op: 'fapprove', code: A, by: 'T', id: idUp, dir: 'нет-такой-папки-xxxx' }).err, 'nofile');

  // перенос между папками: одноимённый файл в целевой уходит в корзину; чужие и «На проверке» не переносятся
  const idCz2 = hp({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'Цезарь.docx', b64: b64(mkDocx(950, 'c2')), dir: dirFirst }).id;
  let mv = hp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: idCz2, dir: dirSal }); assert.strictEqual(mv.ok, true); assert.deepStrictEqual(h.drive.items[idCz2].parents, [dirSal]);
  assert.strictEqual(h.drive.items[idCz].trashed, false, 'старый «Цезарь» в целевой папке заменён'); assert.ok(h.drive.items[idCz].name.startsWith('Цезарь (до '), 'и лежит в архиве: ' + h.drive.items[idCz].name);
  mv = hp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: idCz2, dir: dirSal }); assert.strictEqual(mv.same, true, 'повторный перенос в ту же папку ничего не делает');
  mv = hp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: idCz2, dir: '' }); assert.deepStrictEqual(h.drive.items[idCz2].parents, [hroot]);
  assert.strictEqual(hp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: idCz2, dir: 'нет-такой-папки-xxxx' }).err, 'nodir');
  const idPend2 = hp({ rid: rid(), op: 'upload', code: E, by: 'Ира', name: 'Ещё.docx', b64: b64(mkDocx(800, 'es')) }).id;
  assert.strictEqual(hp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: idPend2, dir: dirSal }).err, 'nofile', 'из «На проверке» только через «Принять»');
  const otherF = h.ctx.DriveApp.createFolder('Чужая'); const foreignF = otherF.createFile({ bytes: [80, 75, 3, 4], mime: 'x', name: 'secret.docx' }).getId();
  assert.strictEqual(hp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: foreignF, dir: dirSal }).err, 'nofile');
  assert.strictEqual(hp({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'Чужая' }).ok, true, 'папка с таким именем вне «ТТК калькулятора» не мешает');

  // файлы подпапок читаются и удаляются; чужая подпапка недоступна
  assert.strictEqual(hg({ a: 'file', id: idShi }).ok, true);
  assert.strictEqual(hp({ rid: rid(), op: 'fdelete', code: A, by: 'T', id: idShi }).ok, true); assert.strictEqual(h.drive.items[idShi].trashed, true);
  const innerForeign = otherF.createFolder('вложенная'); const ff2 = innerForeign.createFile({ bytes: [80, 75, 3, 4], mime: 'x', name: 's2.docx' }).getId();
  assert.strictEqual(hg({ a: 'file', id: ff2 }).err, 'nofile');

  // переименование и удаление папки
  assert.strictEqual(hp({ rid: rid(), op: 'drename', code: A, by: 'T', id: dirSal, name: 'Холодные закуски' }).name, 'Холодные закуски');
  assert.strictEqual(h.drive.items[dirSal].name, 'Холодные закуски');
  assert.strictEqual(hp({ rid: rid(), op: 'drename', code: A, by: 'T', id: dirSal, name: 'Первые блюда' }).err, 'taken');
  assert.strictEqual(hp({ rid: rid(), op: 'drename', code: A, by: 'T', id: dirSal, name: 'холодные   ЗАКУСКИ' }).ok, true, 'можно поменять регистр у своей же папки');
  assert.strictEqual(hp({ rid: rid(), op: 'drename', code: A, by: 'T', id: dirSal, name: '' }).err, 'name');
  assert.strictEqual(hp({ rid: rid(), op: 'drename', code: A, by: 'T', id: hpend, name: 'Х' }).err, 'nodir', '«На проверке» не переименовать');
  assert.strictEqual(hp({ rid: rid(), op: 'drename', code: A, by: 'T', id: '', name: 'Х' }).err, 'nodir');
  assert.strictEqual(hp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: dirSal }).err, 'notempty', 'непустую папку не удалить');
  assert.strictEqual(hp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: hpend }).err, 'nodir'); assert.strictEqual(hp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: '' }).err, 'nodir');
  assert.strictEqual(hp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: otherF.getId() }).err, 'nodir', 'чужую папку не удалить');
  const dirV = hg({ a: 'files', fresh: '1' }).dirs.find(d => d.name === 'Вторые блюда').id;
  assert.strictEqual(hp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: dirV }).ok, true); assert.strictEqual(h.drive.items[dirV].trashed, true);
  assert.ok(!hg({ a: 'files' }).dirs.some(d => d.id === dirV), 'удалённая папка пропала из списка (кэш сброшен)');
  // лимит папок
  const h2 = createGas(); vm.runInContext('setup()', h2.ctx);
  for (let i = 0; i < 100; i++) assert.strictEqual(JSON.parse(h2.post({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'П' + i }).text).ok, true);
  assert.strictEqual(JSON.parse(h2.post({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'Лишняя' }).text).err, 'many');
  // журнал: действия с папками записаны
  const acts2 = hg({ a: 'log', n: 200 }).items.map(x => x.action);
  for (const a of ['папка создана', 'папка переименована', 'папка удалена', 'файл перемещён', 'файл принят']) assert.ok(acts2.includes(a), a);
  // 800 файлов: список приходит целиком, кэш не ломается из-за размера (больше 100 КБ в кэш не помещается)
  const h3 = createGas(); vm.runInContext('setup()', h3.ctx);
  const dd1 = JSON.parse(h3.post({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'Много' }).text).id, dd2 = JSON.parse(h3.post({ rid: rid(), op: 'dcreate', code: A, by: 'T', name: 'Ещё много' }).text).id;
  for (let i = 0; i < 400; i++) { h3.dropFileIn(dd1, 'ТТК №' + (i + 1) + ' Блюдо с достаточно длинным названием для проверки размера ответа.docx', mkDocx(300, 'm' + i)); h3.dropFileIn(dd2, 'ТТК №' + (i + 501) + ' Блюдо с достаточно длинным названием для проверки размера ответа.docx', mkDocx(300, 'n' + i)); }
  const big = h3.parseOut(h3.get({ a: 'files', fresh: '1', code: 'adm-5678' })).data; assert.strictEqual(big.files.length, 800); assert.ok(JSON.stringify(big).length > 100000, 'ответ больше лимита кэша: ' + JSON.stringify(big).length);
  assert.ok(!('fl' in h3.cache), 'слишком большой ответ не кэшируется');
  assert.strictEqual(h3.parseOut(h3.get({ a: 'files', code: 'adm-5678' })).data.files.length, 800, 'без кэша список всё равно читается');
  // у старых данных (файл без пожелания в описании) всё работает
  const h4 = createGas(); vm.runInContext('setup()', h4.ctx); const oldF = h4.dropFile('pend', 'Старый.docx', mkDocx(500, 'old'));
  assert.strictEqual(JSON.parse(h4.post({ rid: rid(), op: 'fapprove', code: A, by: 'T', id: oldF }).text).ok, true); assert.deepStrictEqual(h4.drive.items[oldF].parents, [h4.props.folder]);


  // ---------- папки регионов (версия 9) ----------
  const k = createGas(); vm.runInContext('setup()', k.ctx);
  const kg = (p, code) => k.parseOut(k.get(Object.assign({ code: code || 'adm-5678' }, p))).data, kp = b => JSON.parse(k.post(b).text);
  const kroot = k.props.folder, kpend = k.props.folderPend;
  const regFo = id => JSON.parse(k.props.tregs).find(r => r.id === id).fo;
  const vFo = regFo('main'), mFo = regFo('msk');
  assert.deepStrictEqual([vFo, mFo].map(i => k.drive.items[i].name), ['Волгоград', 'Москва']); assert.deepStrictEqual(k.drive.items[vFo].parents, [kroot]);
  vm.runInContext('setup()', k.ctx); assert.strictEqual(Object.values(k.drive.items).filter(x => x.kind === 'folder').length, 4, 'повторный setup ничего не дублирует');
  // rsetup: только технолог; создаёт недостающее, переименовывает, не дублирует; плохие id и пустой список
  assert.strictEqual(kp({ rid: rid(), op: 'rsetup', code: E, by: 'q', regs: [{ id: 'main', name: 'Х' }] }).err, 'admin');
  assert.strictEqual(kp({ rid: rid(), op: 'rsetup', code: A, by: 'T', regs: [] }).err, 'noreg');
  let rs = kp({ rid: rid(), op: 'rsetup', code: A, by: 'T', regs: [{ id: 'main', name: 'Волгоград' }, { id: 'msk', name: 'Москва и область' }, { id: 'spb', name: 'Санкт-Петербург' }, { id: 'bad id!', name: 'Плохой' }, { id: 'x', name: '///' }] });
  assert.strictEqual(rs.ok, true); assert.strictEqual(rs.made, 1); assert.strictEqual(rs.renamed, 1);
  assert.deepStrictEqual(rs.regs.map(r => r.name), ['Волгоград', 'Москва и область', 'Санкт-Петербург']);
  assert.strictEqual(k.drive.items[mFo].name, 'Москва и область', 'папка региона следует за названием');
  rs = kp({ rid: rid(), op: 'rsetup', code: A, by: 'T', regs: [{ id: 'main', name: 'Волгоград' }, { id: 'msk', name: 'Москва и область' }, { id: 'spb', name: 'Санкт-Петербург' }] }); assert.strictEqual(rs.made + rs.renamed, 0, 'повтор: нечего менять');
  assert.strictEqual(Object.values(k.drive.items).filter(x => x.kind === 'folder' && x.parents.includes(kroot)).length, 4);
  // два региона с одним названием не создают одну папку дважды
  rs = kp({ rid: rid(), op: 'rsetup', code: A, by: 'T', regs: [{ id: 'main', name: 'Волгоград' }, { id: 'msk', name: 'Москва и область' }, { id: 'spb', name: 'Санкт-Петербург' }, { id: 'kzn', name: 'москва и область' }] });
  assert.strictEqual(rs.regs.length, 4); assert.notStrictEqual(rs.regs[3].name.toLowerCase(), 'москва и область');
  // одноимённая папка, уже лежавшая в «ТТК калькулятора», становится папкой региона вместе с содержимым
  const omsk = k.ctx.DriveApp.getFolderById(kroot).createFolder('Омск'); const omskFile = omsk.createFile({ bytes: [80, 75, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0], mime: 'x', name: 'Омская.docx' }).getId();
  let KL = kg({ a: 'files', fresh: '1' });
  assert.strictEqual(KL.files.find(x => x.id === omskFile).reg, '', 'до настройки региона файл в «Без региона»'); assert.ok(KL.dirs.some(d => d.name === 'Омск' && d.reg === ''));
  kp({ rid: rid(), op: 'rsetup', code: A, by: 'T', regs: [{ id: 'main', name: 'Волгоград' }, { id: 'msk', name: 'Москва и область' }, { id: 'spb', name: 'Санкт-Петербург' }, { id: 'omsk', name: 'Омск' }] });
  KL = kg({ a: 'files', fresh: '1' }); assert.strictEqual(KL.files.find(x => x.id === omskFile).reg, 'omsk', 'папка стала регионом'); assert.ok(!KL.dirs.some(d => d.name === 'Омск'), 'и больше не числится подпапкой');

  // папки внутри региона: одно и то же название в разных регионах допустимо, в одном — нет
  const vDir = kp({ rid: rid(), op: 'dcreate', code: A, by: 'T', reg: 'main', regName: 'Волгоград', name: 'Первые блюда' }); assert.strictEqual(vDir.ok, true); assert.deepStrictEqual(k.drive.items[vDir.id].parents, [vFo]);
  const mDir = kp({ rid: rid(), op: 'dcreate', code: A, by: 'T', reg: 'msk', name: 'Первые блюда' }); assert.strictEqual(mDir.ok, true); assert.deepStrictEqual(k.drive.items[mDir.id].parents, [mFo]);
  assert.strictEqual(kp({ rid: rid(), op: 'dcreate', code: A, by: 'T', reg: 'main', name: 'первые  БЛЮДА' }).err, 'taken');
  assert.strictEqual(kp({ rid: rid(), op: 'dcreate', code: A, by: 'T', reg: '', name: 'Москва и область' }).err, 'taken', 'без региона нельзя занять название региона');
  assert.strictEqual(kp({ rid: rid(), op: 'dcreate', code: A, by: 'T', reg: 'nope', name: 'Х' }).err, 'noreg', 'неизвестный регион без названия');
  const lazy = kp({ rid: rid(), op: 'dcreate', code: A, by: 'T', reg: 'kzn2', regName: 'Казань', name: 'Салаты' }); assert.strictEqual(lazy.ok, true, 'недостающая папка региона создаётся при записи'); assert.strictEqual(k.drive.items[JSON.parse(k.props.tregs).find(r => r.id === 'kzn2').fo].name, 'Казань');
  KL = kg({ a: 'files', fresh: '1' }); assert.deepStrictEqual(KL.dirs.filter(d => d.name === 'Первые блюда').map(d => d.reg), ['main', 'msk'], 'папки сгруппированы по регионам');

  // технолог кладёт файл сразу в регион и в папку региона
  let up = kp({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'Борщ.docx', b64: b64(mkDocx(900, 'b1')), reg: 'main', dir: vDir.id }); assert.deepStrictEqual(k.drive.items[up.id].parents, [vDir.id]); const fBorsch = up.id;
  up = kp({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'Борщ.docx', b64: b64(mkDocx(950, 'b2')), reg: 'msk', dir: mDir.id }); assert.deepStrictEqual(k.drive.items[up.id].parents, [mDir.id], 'тот же файл в другом регионе — отдельный файл'); const fBorschM = up.id;
  up = kp({ rid: rid(), op: 'upload', code: A, by: 'Технолог', name: 'Котлета.docx', b64: b64(mkDocx(800, 'k1')), reg: 'msk' }); assert.deepStrictEqual(k.drive.items[up.id].parents, [mFo], 'прямо в папку региона'); const fKot = up.id;
  assert.strictEqual(kp({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'z.docx', b64: b64(mkDocx(500)), reg: 'nope' }).err, 'noreg');
  up = kp({ rid: rid(), op: 'upload', code: A, by: 'T', name: 'Новый регион.docx', b64: b64(mkDocx(500, 'nr')), reg: 'ufa', regName: 'Уфа' }); assert.strictEqual(up.ok, true); assert.strictEqual(k.drive.items[k.drive.items[up.id].parents[0]].name, 'Уфа');
  KL = kg({ a: 'files', fresh: '1' });
  const kr = n => KL.files.filter(x => x.name === n).map(x => [x.reg, x.dir, x.kind]);
  assert.deepStrictEqual(kr('Борщ.docx'), [['main', vDir.id, 'main'], ['msk', mDir.id, 'main']]); assert.deepStrictEqual(kr('Котлета.docx'), [['msk', '', 'main']]);
  // редактор: в «На проверке», регион и папка — пожелание
  up = kp({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Щи.docx', b64: b64(mkDocx(700, 'sh')), reg: 'main', dir: vDir.id }); assert.strictEqual(up.kind, 'pend'); const pShi = up.id;
  up = kp({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Рагу.docx', b64: b64(mkDocx(700, 'rg')), reg: 'msk' }); const pRagu = up.id;
  up = kp({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Суп.docx', b64: b64(mkDocx(700, 'sp')), reg: 'spb' }); const pSup = up.id;
  KL = kg({ a: 'files', fresh: '1' });
  const pw = n => { const x = KL.files.find(y => y.name === n); return [x.kind, x.wantReg, x.want]; };
  assert.deepStrictEqual(pw('Щи.docx'), ['pend', 'main', vDir.id]); assert.deepStrictEqual(pw('Рагу.docx'), ['pend', 'msk', '']); assert.deepStrictEqual(pw('Суп.docx'), ['pend', 'spb', '']);
  // принять по пожеланию автора / в выбранное технологом место / без региона
  assert.strictEqual(kp({ rid: rid(), op: 'fapprove', code: A, by: 'T', id: pShi }).ok, true); assert.deepStrictEqual(k.drive.items[pShi].parents, [vDir.id], 'регион и папка из пожелания');
  assert.strictEqual(kp({ rid: rid(), op: 'fapprove', code: A, by: 'T', id: pRagu, reg: 'msk', dir: mDir.id }).ok, true); assert.deepStrictEqual(k.drive.items[pRagu].parents, [mDir.id]);
  assert.strictEqual(kp({ rid: rid(), op: 'fapprove', code: A, by: 'T', id: pSup, reg: '', dir: '' }).ok, true); assert.deepStrictEqual(k.drive.items[pSup].parents, [kroot], 'явно «Без региона»');
  // перенос между регионами; повтор в то же место; в «Без региона»; неизвестная папка
  let mv2 = kp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: fKot, reg: 'main', dir: vDir.id }); assert.strictEqual(mv2.ok, true); assert.deepStrictEqual(k.drive.items[fKot].parents, [vDir.id]);
  assert.strictEqual(kp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: fKot, reg: 'main', dir: vDir.id }).same, true);
  mv2 = kp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: fKot, reg: 'msk', dir: '' }); assert.deepStrictEqual(k.drive.items[fKot].parents, [mFo]);
  mv2 = kp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: fKot, reg: '', dir: '' }); assert.deepStrictEqual(k.drive.items[fKot].parents, [kroot]);
  assert.strictEqual(kp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: fKot, reg: 'main', dir: 'нет-такой-папки-xxxx' }).err, 'nodir');
  mv2 = kp({ rid: rid(), op: 'fmove', code: A, by: 'T', id: fBorsch, reg: 'msk', dir: mDir.id }); assert.strictEqual(mv2.ok, true); assert.ok(!k.drive.items[fBorschM].trashed && /\(до \d{4}/.test(k.drive.items[fBorschM].name), 'одноимённый файл в целевой папке заменён и лежит в архиве');
  // переименовать и удалить папку региона; удалить нельзя саму папку региона
  assert.strictEqual(kp({ rid: rid(), op: 'drename', code: A, by: 'T', id: mDir.id, name: 'Супы' }).ok, true);
  assert.strictEqual(kp({ rid: rid(), op: 'drename', code: A, by: 'T', id: mFo, name: 'Х' }).err, 'nodir', 'папку региона переименовывает только rsetup');
  assert.strictEqual(kp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: mFo }).err, 'nodir', 'папку региона не удалить');
  assert.strictEqual(kp({ rid: rid(), op: 'ddelete', code: A, by: 'T', id: mDir.id }).err, 'notempty');
  // файл из подпапки региона читается, из чужой папки — нет
  assert.strictEqual(kg({ a: 'file', id: fBorsch }).ok, true);
  const alien = k.ctx.DriveApp.createFolder('Чужая'); const alienIn = alien.createFolder('Москва и область').createFile({ bytes: [80, 75, 3, 4], mime: 'x', name: 'a.docx' }).getId();
  assert.strictEqual(kg({ a: 'file', id: alienIn }).err, 'nofile');
  // в журнале есть регионы
  const klog = kg({ a: 'log', n: 200 }).items; assert.ok(klog.some(x => x.action === 'папка создана' && x.kind === 'регион'));

  // права на облако: тер. управляющий — отказ, шеф-повар — только принятые файлы
  const F = 'fin-9012', V = 'view-3456';
  KL = kg({ a: 'files', fresh: '1' }, F); assert.strictEqual(KL.err, 'role', 'тер. управляющему библиотека закрыта');
  assert.strictEqual(kg({ a: 'file', id: fBorsch }, F).err, 'role');
  const pendLeft = kp({ rid: rid(), op: 'upload', code: E, by: 'Иван', name: 'Ждёт.docx', b64: b64(mkDocx(600, 'wt')), reg: 'main' }).id;
  KL = kg({ a: 'files', fresh: '1' }, V); assert.strictEqual(KL.ok, true); assert.ok(KL.files.length > 0 && KL.files.every(x => x.kind === 'main'), 'шеф-повар не видит файлы на проверке');
  assert.deepStrictEqual(KL.regs.map(r => r.id), ['main', 'msk', 'spb', 'kzn', 'omsk', 'kzn2', 'ufa'], 'порядок регионов — как их завёл калькулятор');
  assert.strictEqual(kg({ a: 'file', id: pendLeft }, V).err, 'nofile', 'файл на проверке шеф-повару не отдаётся');
  assert.strictEqual(kg({ a: 'file', id: fBorsch }, V).ok, true);
  assert.strictEqual(kg({ a: 'files', fresh: '1' }, E).files.some(x => x.kind === 'pend'), true, 'редактор видит заявки');
  for (const op of ['upload', 'fmove', 'fapprove', 'dcreate', 'rsetup']) assert.ok(['viewer', 'admin'].includes(kp({ rid: rid(), op, code: V, by: 'q', name: 'a.docx', b64: b64(mkDocx(500)), id: fBorsch, regs: [{ id: 'a', name: 'b' }] }).err), 'шеф-повар: ' + op);
  assert.ok(['admin'].includes(kp({ rid: rid(), op: 'rsetup', code: F, by: 'q', regs: [{ id: 'a', name: 'b' }] }).err), 'управляющий не настраивает папки');
  // кэш не выдаёт заявки шеф-повару даже после запроса технолога
  kg({ a: 'files', fresh: '1' }); KL = kg({ a: 'files' }, V); assert.ok(KL.files.every(x => x.kind === 'main'));

  console.log('GAS Drive tests ok; файлов в Диске:', Object.values(g.drive.items).filter(x => x.kind === 'file').length);
})();
