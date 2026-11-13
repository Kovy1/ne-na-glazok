/* Файл с адресом подключения: технолог подключается по адресу /exec, остальные — по ссылке на файл или вообще без адреса; смена адреса подтягивается сама */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
(async () => {
  const gs = await startGas(); vm.runInContext('setup()', gs.gas.ctx);
  const servers = [gs];
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  let gvizHits = 0, hdrGuess = false;
  const mk = async (name, { ptr, bakedUrl } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    /* таблица Google (gviz, JSONP): отдаём строки файла, который создал скрипт */
    await page.route(/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/gviz\/tq/, route => {
      const u = decodeURIComponent(route.request().url()), id = /\/d\/([\w-]+)\//.exec(u)[1], h = /responseHandler:([\w$.]+)/.exec(u)[1];
      const b = gs.gas.books[id]; gvizHits++;
      if (!b) return route.fulfill({ status: 404, body: 'nf' });
      const rows = b._rows || b.sheet._sh.rows.filter(r => r.length && r[0] !== undefined && r[0] !== '');
      let cols, data;
      if (hdrGuess && rows.length) { cols = [{ id: 'A', label: String(rows[0][0]), type: 'string' }]; data = rows.slice(1).map(r => ({ c: [{ v: r[0] }] })); }
      else { cols = [{ id: 'A', label: '', type: 'string' }]; data = rows.map(r => ({ c: [{ v: r[0] }] })); }
      route.fulfill({ contentType: 'text/javascript', body: '/*O_o*/\n' + h + '(' + JSON.stringify({ version: '0.6', reqId: '0', status: 'ok', table: { cols, rows: data } }) + ');' });
    });
    await page.addInitScript(([p, u]) => { try { if (p) window.KBZHU_PTR = p; if (u) window.KBZHU_URL = u; } catch (e) {} }, [ptr || '', bakedUrl || '']);
    await page.goto(url);
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); });
    await page.reload(); await page.waitForSelector('#syConn');
    return page;
  };
  const msg = p => p.textContent('#sym-conn').then(t => t.trim());
  const cfgOf = p => p.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:sync')).cfg);
  const connect = async (page, { addr, name, code }) => {
    if (await page.$('#sy-url')) await page.fill('#sy-url', addr || ''); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 25000 });
    await sleep(300);
  };

  // 1. технолог подключается по адресу /exec: скрипт создаёт файл с адресом
  const A = await mk('admin');
  await connect(A, { addr: gs.url, name: 'Технолог', code: 'adm-5678' });
  console.log('1 msg:', await msg(A));
  assert.ok(/Подключено: технолог/.test(await msg(A)), 'технолог подключён');
  const books = Object.values(gs.gas.books); assert.strictEqual(books.length, 1);
  assert.strictEqual(books[0].sheet._sh.rows[0][0], gs.url, 'в файле адрес скрипта');
  assert.deepStrictEqual(books[0].item.shared, ['ANYONE_WITH_LINK', 'VIEW']);
  const box = await A.$('.cabseg[data-seg="prof"] .ptrbox'); assert.ok(box, 'блок «Файл подключения» виден технологу');
  const ptrLink = await A.$eval('.cabseg[data-seg="prof"] .ptrbox a', a => a.href);
  assert.ok(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[\w-]+\/edit$/.test(ptrLink), ptrLink);
  assert.strictEqual((await cfgOf(A)).ptr, ptrLink);
  assert.strictEqual(await A.$eval('#sy-url', e => e.value), ptrLink, 'в поле теперь постоянная ссылка на файл');
  console.log('1 OK: файл создан, адрес записан, доступ по ссылке');

  // 2. сотрудник: ссылка на файл вместо адреса
  const B = await mk('staff');
  await connect(B, { addr: ptrLink, name: 'Сотрудник Первый', code: 'ed-1234' });
  console.log('2 msg:', await msg(B));
  assert.ok(/Подключено: редактор/.test(await msg(B)));
  let cb = await cfgOf(B); assert.strictEqual(cb.url, gs.url); assert.strictEqual(cb.ptr, ptrLink); assert.strictEqual(cb.role, 'editor');
  assert.ok(await B.$('text=Адрес скрипта берётся из файла подключения'), 'подсказка редактору');
  assert.ok(!(await B.$('.ptrbox')), 'редактору блок технолога не показывается');
  console.log('2 OK: по ссылке на файл подключились без адреса скрипта');

  // 3. Google иногда принимает первую строку за шапку: адрес всё равно находится
  hdrGuess = true;
  const B2 = await mk('staff-hdr');
  await connect(B2, { addr: ptrLink + '?usp=sharing', name: 'Сотрудник Второй', code: 'ed-1234' });
  assert.ok(/Подключено: редактор/.test(await msg(B2)), await msg(B2));
  hdrGuess = false;
  console.log('3 OK: адрес находится и при шапке из первой строки, и в ссылке с ?usp=sharing');

  // 4. файл подключения вшит в сам файл калькулятора: сотруднику нужны только ФИО и код
  const C = await mk('baked', { ptr: ptrLink });
  assert.strictEqual(await C.$('#sy-url'), null, 'поля адреса нет: он вшит в файл');
  await connect(C, { addr: '', name: 'Сотрудник Третий', code: 'ed-1234' });
  console.log('4 msg:', await msg(C));
  assert.ok(/Подключено: редактор/.test(await msg(C)));
  assert.strictEqual((await cfgOf(C)).url, gs.url);
  console.log('4 OK: с вшитой ссылкой адрес не нужен вообще');

  // 4б. в файл вшит только адрес скрипта (файла подключения ещё нет): тоже достаточно ФИО и кода, а потом ссылка на файл запоминается сама
  const C2 = await mk('baked-url', { bakedUrl: gs.url });
  assert.strictEqual(await C2.$('#sy-url'), null, 'поля адреса нет: он вшит в файл');
  await connect(C2, { addr: '', name: 'Сотрудник Четвёртый', code: 'ed-1234' });
  assert.ok(/Подключено: редактор/.test(await msg(C2)), await msg(C2));
  assert.strictEqual((await cfgOf(C2)).url, gs.url); assert.strictEqual((await cfgOf(C2)).ptr, ptrLink, 'ссылка на файл подключения запомнилась');
  console.log('4б OK: с вшитым адресом скрипта достаточно ФИО и кода');

  // 5. неверные ввод: мусор, файл без адреса, неизвестный файл
  const D = await mk('bad');
  await connect(D, { addr: 'привет', name: 'Х', code: 'ed-1234' });
  assert.ok(/Вставьте адрес/.test(await msg(D)), await msg(D));
  await connect(D, { addr: 'https://docs.google.com/spreadsheets/d/neizvestnyyfajl123456/edit', name: 'Х', code: 'ed-1234' });
  console.log('5 msg:', await msg(D));
  assert.ok(/файл подключения/i.test(await msg(D)), 'сообщение про файл подключения');
  const saveRows = books[0]._rows; books[0]._rows = [['Пока пусто']];
  await connect(D, { addr: ptrLink, name: 'Х', code: 'ed-1234' });
  assert.ok(/нет адреса скрипта/.test(await msg(D)), await msg(D)); books[0]._rows = saveRows;
  await connect(D, { addr: ptrLink, name: 'Х', code: 'не-тот-код' });
  assert.ok(/Код не подходит/.test(await msg(D)), await msg(D));
  console.log('5 OK: понятные сообщения при ошибках');

  // 5б. файл подключения в памяти не читается (на телефоне Google закрыт сетью или таблица недоступна), а адрес скрипта вшит: подключение идёт по нему
  const F = await mk('fallback', { bakedUrl: gs.url });
  await F.evaluate(() => localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { url: '', ptr: 'https://docs.google.com/spreadsheets/d/neizvestnyyfajl123456/edit', name: '', code: '', auto: true, rev: 0, role: '' }, map: { ing: {}, rec: {} } })));
  await F.reload(); await F.waitForSelector('#syConn');
  await connect(F, { addr: '', name: 'Телефон', code: 'ed-1234' });
  console.log('5б msg:', await msg(F));
  assert.ok(/Подключено: редактор/.test(await msg(F)), await msg(F));
  assert.strictEqual((await cfgOf(F)).url, gs.url);
  console.log('5б OK: файл подключения не прочитался — подключились по известному адресу скрипта');

  // 6. технолог развернул скрипт заново: новый адрес; он подключается с ним, файл обновляется
  const gs2 = await startGas({ gasInstance: gs.gas }); servers.push(gs2);
  await connect(A, { addr: gs2.url, name: 'Технолог', code: 'adm-5678' });
  assert.ok(/Подключено: технолог/.test(await msg(A)), await msg(A));
  assert.strictEqual(Object.values(gs.gas.books).filter(b => /^https?:\/\//.test(String(((b.sheet && b.sheet._sh && b.sheet._sh.rows[0]) || [])[0]))).length, 1, 'файл подключения тот же (файлы цен — отдельно)');
  assert.strictEqual(books[0].sheet._sh.rows[0][0], gs2.url, 'в файле новый адрес');
  const before = await B.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:sync')));
  // старое развёртывание отключено; сотрудник открывает калькулятор — адрес берётся из файла сам
  await gs.close();
  await B.reload(); await B.waitForSelector('#syConn');
  await B.waitForFunction(u => JSON.parse(localStorage.getItem('kbzhu:sync')).cfg.url === u, gs2.url, { timeout: 20000 });
  const after = await B.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:sync')));
  assert.strictEqual(after.cfg.mapUrl, before.cfg.mapUrl, 'связи с общей базой не сброшены');
  assert.strictEqual(after.cfg.role, 'editor');
  console.log('6 OK: после смены адреса сотрудник подхватил новый сам');

  // 7. адрес сменился при открытой странице: первый же запрос не проходит, адрес перечитывается из файла и запрос повторяется
  const gs3 = await startGas({ gasInstance: gs.gas }); servers.push(gs3);
  await connect(A, { addr: gs3.url, name: 'Технолог', code: 'adm-5678' });
  assert.strictEqual(books[0].sheet._sh.rows[0][0], gs3.url);
  await gs2.close();
  await C.click('[data-act="syRefresh"]').catch(async () => { await C.click('text=Обновить'); });
  await C.waitForFunction(u => JSON.parse(localStorage.getItem('kbzhu:sync')).cfg.url === u, gs3.url, { timeout: 30000 });
  await sleep(1500);
  assert.ok(!/Не получилось|Браузер не получил/.test(await C.textContent('#view')), 'ошибки нет, запрос повторился на новом адресе');
  console.log('7 OK: на лету подхватил новый адрес');

  // 8. «Отключить» оставляет ссылку на файл: повторное подключение без адреса
  await C.click('[data-act="syDisconnect"]'); await C.click('[data-act="syDisconnect"]'); await sleep(400);
  const dc = await cfgOf(C); assert.strictEqual(dc.url, ''); assert.strictEqual(dc.ptr, ptrLink);
  await connect(C, { addr: '', name: 'Сотрудник Третий', code: 'ed-1234' });
  assert.ok(/Подключено: редактор/.test(await msg(C)), await msg(C));
  console.log('8 OK: после отключения достаточно ФИО и кода');

  console.log('gviz hits', gvizHits, 'ERR', errs);
  assert.deepStrictEqual(errs, []);
  await browser.close(); servers.forEach(s => s.close());
  console.log('PWPTR OK');
})().catch(e => { console.log('FAIL', e.message, '\nERR', errs); process.exit(1); });
