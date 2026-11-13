/* проверка файлов ТТК на проверке: приём (в том числе с правками), возврат на доработку с комментарием, снятие автором */
const assert = require('assert'), vm = require('vm'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', V = 'view-3456';
let n = 0; const rid = () => 'rid-' + (++n) + '-abcdef';
const mkDocx = (size = 2000, tag = 'x') => { const b = Buffer.alloc(size, 7); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4; b.write(tag, 10); return b; };
const b64 = b => Buffer.from(b).toString('base64');
const g = createGas();
const get = (code, p) => g.parseOut(g.get(Object.assign({ code }, p))).data;
const post = b => JSON.parse(g.post(b).text);
vm.runInContext('setup()', g.ctx);
assert.strictEqual(get(A, { a: 'ping' }).v, 30);

// редактор предлагает два файла
const d1 = mkDocx(3000, 'one'), d2 = mkDocx(2500, 'two');
let r = post({ rid: rid(), op: 'upload', code: E, by: 'Кузя', name: 'ТТК №__ Новое блюдо12.docx', b64: b64(d1) }); assert.ok(r.ok, JSON.stringify(r)); const id1 = r.id;
r = post({ rid: rid(), op: 'upload', code: E, by: 'Кузя', name: 'ТТК №__ Новое блюдо1234.docx', b64: b64(d2) }); const id2 = r.id;
let L = get(A, { a: 'files' }).files.filter(x => x.kind === 'pend');
assert.ok(L.every(x => x.st === '' && x.reply === ''), 'пока без статуса');

// вернуть на доработку: комментарий обязателен, только технолог
assert.strictEqual(post({ rid: rid(), op: 'frework', code: E, by: 'Кузя', id: id1, note: 'нетто' }).err, 'admin');
assert.strictEqual(post({ rid: rid(), op: 'frework', code: A, by: 'Технолог', id: id1, note: '' }).err, 'note', 'без комментария нельзя');
assert.strictEqual(post({ rid: rid(), op: 'frework', code: A, by: 'Технолог', id: id1, note: ' а ' }).err, 'note');
r = post({ rid: rid(), op: 'frework', code: A, by: 'Технолог', id: id1, note: 'Нетто не заполнено, проверьте выход' }); assert.ok(r.ok, JSON.stringify(r));
L = get(A, { a: 'files' }).files.filter(x => x.kind === 'pend');
const f1 = L.find(x => x.id === id1), f2 = L.find(x => x.id === id2);
assert.strictEqual(f1.st, 'rework'); assert.strictEqual(f1.reply, 'Нетто не заполнено, проверьте выход'); assert.strictEqual(f1.reviewer, 'Технолог'); assert.ok(f1.decided > 0);
assert.strictEqual(f2.st, '', 'второй файл не тронут');
assert.strictEqual(get(A, { a: 'file', id: id1 }).ok, true, 'файл на доработке по-прежнему открывается');
// шеф-повар «На проверке» не видит вовсе
assert.strictEqual(get(V, { a: 'files' }).files.filter(x => x.kind === 'pend').length, 0);

// уведомление автору: только его файлы, только возвращённые
let ib = get(E, { a: 'inbox', by: 'Кузя' }); assert.deepStrictEqual(ib.files.map(x => [x.id, x.name, x.reply, x.reviewer]), [[id1, 'ТТК №__ Новое блюдо12.docx', 'Нетто не заполнено, проверьте выход', 'Технолог']]);
assert.deepStrictEqual(get(E, { a: 'inbox', by: 'Мария' }).files, [], 'чужие файлы в уведомления не попадают');
assert.deepStrictEqual(get(V, { a: 'inbox', by: 'Кузя' }).files, []);

// чужой файл снять нельзя, свой можно; шеф-повар не может
assert.strictEqual(post({ rid: rid(), op: 'fwithdraw', code: E, by: 'Мария', id: id2 }).err, 'own');
assert.strictEqual(post({ rid: rid(), op: 'fwithdraw', code: V, by: 'Кузя', id: id2 }).err, 'viewer');

// автор исправил и предложил снова под тем же именем: прежний заменён, статус сброшен
const d1b = mkDocx(3300, 'oneb');
r = post({ rid: rid(), op: 'upload', code: E, by: 'Кузя', name: 'ТТК №__ Новое блюдо12.docx', b64: b64(d1b) }); assert.ok(r.ok); const id1b = r.id; assert.notStrictEqual(id1b, id1);
L = get(A, { a: 'files' }).files.filter(x => x.kind === 'pend'); assert.strictEqual(L.length, 2); assert.ok(L.every(x => x.st === ''), 'после повторной отправки статус сброшен');
assert.deepStrictEqual(get(E, { a: 'inbox', by: 'Кузя' }).files, []);

// принять с правками: в библиотеку попадает версия технолога, присланный файл убирается
const fixed = mkDocx(4100, 'fixed');
assert.strictEqual(post({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: id1b, reg: 'main', dir: '', b64: b64(Buffer.from('не docx, просто текст '.repeat(20))) }).err, 'docx', 'правка должна быть файлом .docx');
r = post({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: id1b, reg: 'main', dir: '', b64: b64(fixed) }); assert.ok(r.ok, JSON.stringify(r)); assert.strictEqual(r.edited, true);
L = get(A, { a: 'files' }).files;
const lib = L.filter(x => x.kind === 'main'); assert.strictEqual(lib.length, 1); assert.strictEqual(lib[0].name, 'ТТК №__ Новое блюдо12.docx'); assert.strictEqual(lib[0].reg, 'main'); assert.strictEqual(lib[0].size, 4100); assert.strictEqual(lib[0].by, 'Кузя', 'автор сохранён');
assert.ok(Buffer.from(get(A, { a: 'file', id: lib[0].id }).b64, 'base64').equals(fixed), 'в библиотеке версия технолога');
assert.strictEqual(L.filter(x => x.kind === 'pend').length, 1, 'присланный файл ушёл из «На проверке»');
assert.strictEqual(g.drive.items[id1b].trashed, true);

// принять как есть (без правок): прежняя логика, байты те же
r = post({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: id2, reg: 'msk', dir: '' }); assert.ok(r.ok); assert.ok(!r.edited);
L = get(A, { a: 'files' }).files; assert.strictEqual(L.filter(x => x.kind === 'pend').length, 0);
const m2 = L.find(x => x.name === 'ТТК №__ Новое блюдо1234.docx'); assert.strictEqual(m2.reg, 'msk'); assert.ok(Buffer.from(get(A, { a: 'file', id: m2.id }).b64, 'base64').equals(d2));
assert.strictEqual(m2.st, '', 'у принятых статуса нет');

// возвращённый файл можно принять, и статус на него не переносится; автор может снять свой файл
r = post({ rid: rid(), op: 'upload', code: E, by: 'Кузя', name: 'Щи.docx', b64: b64(mkDocx(900, 'shi')) }); const id3 = r.id;
assert.ok(post({ rid: rid(), op: 'frework', code: A, by: 'Технолог', id: id3, note: 'Добавьте технологию' }).ok);
assert.ok(post({ rid: rid(), op: 'fwithdraw', code: E, by: 'Кузя', id: id3 }).ok);
assert.strictEqual(get(A, { a: 'files' }).files.filter(x => x.kind === 'pend').length, 0, 'снят автором');
assert.deepStrictEqual(get(E, { a: 'inbox', by: 'Кузя' }).files, []);
r = post({ rid: rid(), op: 'upload', code: E, by: 'Кузя', name: 'Суп.docx', b64: b64(mkDocx(900, 'sup')) }); const id4 = r.id;
post({ rid: rid(), op: 'frework', code: A, by: 'Технолог', id: id4, note: 'Исправьте выход' });
assert.ok(post({ rid: rid(), op: 'fapprove', code: A, by: 'Технолог', id: id4, reg: 'main', dir: '' }).ok);
assert.strictEqual(get(A, { a: 'files' }).files.find(x => x.name === 'Суп.docx').st, '');
assert.deepStrictEqual(get(E, { a: 'inbox', by: 'Кузя' }).files, [], 'принятый файл из уведомлений ушёл');

// отклонение возвращённого файла
r = post({ rid: rid(), op: 'upload', code: E, by: 'Кузя', name: 'Каша.docx', b64: b64(mkDocx(900, 'kas')) }); const id5 = r.id;
post({ rid: rid(), op: 'frework', code: A, by: 'Технолог', id: id5, note: 'Не то блюдо' });
assert.ok(post({ rid: rid(), op: 'freject', code: A, by: 'Технолог', id: id5 }).ok);
assert.deepStrictEqual(get(E, { a: 'inbox', by: 'Кузя' }).files, []);

// журнал
const act = g.rows('Журнал').map(x => x[2]);
['файл предложен', 'файл возвращён на доработку', 'файл принят с правками', 'файл принят', 'файл снят с проверки', 'файл отклонён'].forEach(a => assert.ok(act.indexOf(a) > -1, 'в журнале: ' + a));
console.log('GAS frev ok');
