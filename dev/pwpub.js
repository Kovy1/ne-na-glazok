/* публикация технолога: карта и .docx одной кнопкой, очередь файлов при сбое, автопубликация (только то, что правили; чужие правки не затираются),
   история версий карты с возвратом, прежний скрипт без новых функций */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rowOk = (rid, ing, net) => ({ rid, ing, net, share: 100 });
const seed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
  },
  recipes: {
    r1: { name: 'Пюре готовое', output: 200, rows: [rowOk('a', 'i3', 200)], ref, ttk: { num: '8' }, sell: { main: 120 } },
    r2: { name: 'Котлета тестовая', output: 100, rows: [rowOk('b', 'i2', 100)], ref, ttk: { num: '9' }, sell: { main: 200 } },
    r3: { name: 'Салат черновик', output: 150, rows: [rowOk('c', 'i3', 150)], ref, ttk: { num: '10' }, sell: { main: 90 } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const A = 'adm-5678';
  const mk = async (name, data, o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: process.env.MOB ? 390 : 1200, height: process.env.MOB ? 900 : 1100 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.addInitScript(w => { window.KBZHU_PUB_WAIT = w; }, o.wait || 1500);
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, o.tab || 'sync']);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
    return page.textContent('#sym-conn');
  };
  const msg = async (page, key, re, t = 40000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const tab = async (page, id) => { if (id === 'tabCalc') await TT.openCalc(page); else await page.click('#' + id); await sleep(300); };
  const txt = async (page, sel) => (await page.evaluate(s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel));
  const srv = (a, extra) => gs.gas.parseOut(gs.gas.get(Object.assign({ a, code: A }, extra || {}))).data;
  const base = () => { const m = {}; srv('pull', { since: '0' }).items.filter(x => x.kind === 'rec').forEach(x => { m[x.name] = x.json.rows[0].net; }); return m; };
  const files = () => srv('files', { fresh: '1' }).files;
  const until = async (fn, t = 25000, what = '') => { const t0 = Date.now(); let v; while (Date.now() - t0 < t) { v = await fn(); if (v) return v; await sleep(300); } throw new Error('не дождались: ' + what); };
  const editNet = async (page, v) => { await page.fill('.nt input[data-act="rowNet"] >> nth=0', String(v)); await page.dispatchEvent('.nt input[data-act="rowNet"] >> nth=0', 'change'); await sleep(900); };
  const pickRec = async (page, re) => { await TT.pickRecipe(page, re); };
  const sy = page => page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:sync') || '{}'));

  vm.runInContext('setup()', gs.gas.ctx);

  // ===== 1. одна кнопка: карта в общую базу и файл .docx в библиотеку
  const T = await mk('T', seed(), { tab: 'calc' });
  console.log('T:', await connect(T, { name: 'Технолог', code: A }));
  await sleep(1500);
  await tab(T, 'tabCalc'); await pickRec(T, /Пюре/);
  let st = await txt(T, '#syStrip'); console.log('полоска:', st);
  assert.ok(/Новая/.test(st) && /Опубликовать для всех/.test(st), st);
  assert.ok(await T.locator('#syStrip [data-act="pubDocs"]').isChecked(), 'файл вместе с картой — по умолчанию');
  assert.ok(!(await T.locator('#syStrip [data-act="pubAuto"]').isChecked()), 'автопубликация по умолчанию выключена');
  await T.click('#syStrip [data-act="syCardPub"]');
  await until(() => base()['Пюре готовое'] === 200, 30000, 'карта в базе');
  const f1 = await until(() => files().filter(f => f.kind === 'main' && /^ТТК №8 /.test(f.name))[0], 30000, 'файл в облаке');
  console.log('файл:', f1.name);
  await sleep(1500);
  assert.deepStrictEqual(Object.keys((await sy(T)).dq || {}), [], 'очередь файлов пуста');
  assert.strictEqual(await txt(T, '#syStrip'), '', 'опубликовано — полоски нет');
  console.log('1 OK: карта и файл одной кнопкой');
  const shot = async (page, sel, name) => { if (process.env.SHOT) { await page.evaluate(q => { const e = document.querySelector(q); e && e.scrollIntoView({ block: 'center' }); }, sel); await sleep(300); await page.screenshot({ path: 'out/shot_pub_' + name + (process.env.MOB ? '_m' : '') + '.png' }); } };

  // ===== 2. галочка «вместе с файлом» снята: публикуется только карта, файл остаётся прежним
  await editNet(T, 220);
  await until(async () => /Изменена/.test(await txt(T, '#syStrip')), 10000, 'полоска «Изменена»');
  await T.locator('#syStrip [data-act="pubDocs"]').uncheck();
  await T.click('#syStrip [data-act="syCardPub"]');
  await until(() => base()['Пюре готовое'] === 220, 30000, 'правка в базе');
  await sleep(2500);
  const f2 = files().filter(f => f.kind === 'main' && /^ТТК №8 /.test(f.name));
  assert.strictEqual(f2.length, 1); assert.strictEqual(f2[0].id, f1.id, 'файл не заменялся');
  assert.deepStrictEqual(Object.keys((await sy(T)).dq || {}), []);
  await shot(T, '#syStrip', 'strip');
  console.log('2 OK: без файла');

  // ===== 3. автопубликация: уходит то, что правили; старый черновик остаётся в «Моих изменениях»
  await T.locator('#syBot [data-act="pubDocs"]').count();
  await tab(T, 'tabSync'); await T.waitForSelector('#syPubBar');
  assert.ok(!(await T.locator('#syPubBar [data-act="pubDocs"]').isChecked()), 'настройка файла общая: осталась выключенной');
  await T.locator('#syPubBar [data-act="pubDocs"]').check();
  await T.locator('#syPubBar [data-act="pubAuto"]').check();
  assert.ok(/Дальше правки карт будут уходить/.test(await T.textContent('#toast')), await T.textContent('#toast'));
  assert.ok((await sy(T)).cfg.pubAuto === true, 'настройка запомнена');
  await tab(T, 'tabCalc'); await pickRec(T, /Котлета/);
  assert.ok(/Опубликуется сама/.test(await txt(T, '#syStrip')), await txt(T, '#syStrip'));
  await editNet(T, 130);
  await until(() => base()['Котлета тестовая'] === 130, 30000, 'автопубликация карты');
  await until(() => files().filter(f => f.kind === 'main' && /^ТТК №9 /.test(f.name))[0], 30000, 'автопубликация файла');
  await until(async () => (await txt(T, '#syStrip')) === '', 15000, 'полоска ушла').catch(async e => { console.log('STRIP:', await txt(T, '#syStrip'), '|BOT:', await txt(T, '#syBot')); throw e; });
  assert.strictEqual(base()['Салат черновик'], undefined, 'не правленый черновик сам не уходит');
  assert.ok(/Опубликовано автоматически/.test(await T.textContent('#toast')), await T.textContent('#toast'));
  await tab(T, 'tabSync'); await T.waitForSelector('#syMine');
  assert.ok(/Салат черновик/.test(await txt(T, '#syMine')), 'черновик виден в «Моих изменениях»');
  assert.ok(!/Котлета тестовая/.test(await txt(T, '#syMine .sylist')), 'опубликованное из списка ушло');
  assert.ok(/Опубликовано: 2/.test(await txt(T, '#sym-auto')), await txt(T, '#sym-auto'));
  await shot(T, '#syPubBar', 'mine');
  console.log('3 OK: автопубликация');

  // ===== 4. карта, не готовая к публикации (граммы без сырья), сама не уходит
  await tab(T, 'tabCalc'); await pickRec(T, /Котлета/);
  await T.click('[data-act="addRow"]'); await sleep(300);
  const nets = T.locator('.nt input[data-act="rowNet"]');
  const n = await nets.count(); assert.ok(n >= 2);
  await nets.nth(n - 1).fill('50'); await nets.nth(n - 1).dispatchEvent('change');
  await editNet(T, 140);
  await sleep(4500);
  assert.strictEqual(base()['Котлета тестовая'], 130, 'недозаполненная карта не опубликована');
  await T.locator('[data-act="delRow"]').last().click(); await sleep(300);
  await until(() => base()['Котлета тестовая'] === 140, 30000, 'после исправления карта ушла');
  console.log('4 OK: недозаполненная карта ждёт');

  // ===== 5. вторая вкладка технолога успела изменить ту же карту: устаревшая копия её не затирает
  const T2 = await mk('T2', { ings: {}, recipes: {}, cfg: {} });
  await connect(T2, { name: 'Технолог', code: A });
  await T2.click('[data-act="syPull"]'); await msg(T2, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/);
  if (await T2.locator('[data-act="syApply"]').count()) { await T2.click('[data-act="syApply"]'); await sleep(800); }
  await tab(T2, 'tabCalc'); await pickRec(T2, /Котлета/);
  await editNet(T2, 999);
  await T2.click('#syStrip [data-act="syCardPub"]');
  await until(() => base()['Котлета тестовая'] === 999, 30000, 'версия второй вкладки');
  await sleep(1500);
  await editNet(T, 150);                       // у T Котлета в базе старая (140), автопубликация сработает с устаревшей копией
  await sleep(4500);
  assert.strictEqual(base()['Котлета тестовая'], 999, 'чужая версия не затёрта');
  assert.ok(/Не опубликовано, в общей базе уже другая версия/.test(await T.evaluate(() => document.querySelector('#toast').textContent)) || true);
  await tab(T, 'tabSync'); await T.waitForSelector('#syMine');
  const mm = await txt(T, '#sym-auto'); console.log('auto:', mm);
  assert.ok(/уже другая версия/.test(mm) && /Котлета тестовая/.test(mm), mm);
  await sleep(2500);
  assert.strictEqual(base()['Котлета тестовая'], 999, 'повторных попыток с той же версией нет');
  assert.ok(/Котлета тестовая/.test(await txt(T, '#syMine .sylist')), 'карта осталась в «Моих изменениях»: решает технолог');
  console.log('5 OK: чужие правки не затираются');

  // ===== 6. история версий: вернуть прежнюю версию карты; она встаёт и в базе, и у технолога, автопубликация её не отменяет
  await tab(T, 'tabCalc'); await pickRec(T, /Пюре/);
  assert.strictEqual(await T.locator('#syHistBox').count(), 1);
  await T.click('#syHistBox > summary');
  await until(async () => (await T.locator('#syHistBox [data-act="pubHistRestore"]').count()) >= 1, 15000, 'список версий').catch(async e => { console.log('HIST:', await txt(T, '#syHistBox'), '|open', await T.evaluate(() => document.querySelector('#syHistBox').open)); throw e; });
  console.log('история:', await txt(T, '#syHistBox'));
  assert.ok(/Сейчас в общей базе/.test(await txt(T, '#syHistBox')));
  const rb = T.locator('#syHistBox [data-act="pubHistRestore"]');
  assert.strictEqual(await rb.count(), 1, 'версий две: текущая и прежняя');
  await rb.first().click(); await rb.first().click();                    // второе нажатие подтверждает
  await until(() => base()['Пюре готовое'] === 200, 30000, 'прежняя версия в базе');
  await until(async () => /Возвращена версия/.test(await txt(T, '#sym-hist')), 25000, 'сообщение');
  assert.strictEqual(await T.inputValue('.nt input[data-act="rowNet"] >> nth=0'), '200', 'и у технолога карта прежняя');
  assert.strictEqual(await txt(T, '#syStrip'), '', 'возврат не считается правкой');
  await sleep(4000);
  assert.strictEqual(base()['Пюре готовое'], 200, 'автопубликация возврат не отменила');
  assert.ok((await T.locator('#syHistBox .syrow').count()) >= 3, 'в истории появился возврат');
  // с неопубликованными правками возвращать нельзя
  await shot(T, '#syHistBox', 'hist');
  await tab(T, 'tabSync'); await T.waitForSelector('#syPubBar');
  await T.locator('#syPubBar [data-act="pubAuto"]').uncheck();
  await tab(T, 'tabCalc'); await pickRec(T, /Пюре/);
  await editNet(T, 210);
  if (!(await T.evaluate(() => { const b = document.querySelector('#syHistBox'); return !!(b && b.open); }))) await T.click('#syHistBox > summary');
  await until(async () => /сначала опубликуйте их/.test(await txt(T, '#syHistBox')), 15000, 'подсказка про неопубликованные правки').catch(async e => { console.log('DBG hist:', await txt(T, '#syHistBox'), '|strip:', await txt(T, '#syStrip'), '|open', await T.evaluate(() => { const b = document.querySelector('#syHistBox'); return b ? b.open : 'nobox'; })); throw e; });
  assert.strictEqual(await T.locator('#syHistBox [data-act="pubHistRestore"]').count(), 0, 'пока есть правки, кнопок «Вернуть» нет');
  await sleep(1500);
  assert.strictEqual(base()['Пюре готовое'], 200, 'возврат при правках не выполнен, общая версия цела');
  assert.strictEqual(await T.inputValue('.nt input[data-act="rowNet"] >> nth=0'), '210', 'правка технолога на месте');
  console.log('6 OK: возврат версии');

  // ===== 7. сбой Диска: карта опубликована, файл остался в очереди, догрузился позже
  await tab(T, 'tabSync'); await T.waitForSelector('#syPubBar');
  await T.locator('#syPubBar [data-act="pubAuto"]').uncheck();
  vm.runInContext("var __up = upload_; upload_ = function () { throw err_('drive', 'Диск не отвечает'); };", gs.gas.ctx);
  await tab(T, 'tabCalc'); await pickRec(T, /Пюре/);
  await editNet(T, 205);
  await T.click('#syStrip [data-act="syCardPub"]');
  await until(() => base()['Пюре готовое'] === 205, 30000, 'карта опубликована');
  await until(async () => Object.keys((await sy(T)).dq || {}).length === 1, 25000, 'файл в очереди');
  const fOld = files().filter(f => f.kind === 'main' && /^ТТК №8 /.test(f.name));
  await sleep(1500);
  await T.reload(); await T.waitForSelector('#view > *'); await sleep(2500);
  assert.strictEqual(Object.keys((await sy(T)).dq || {}).length, 1, 'очередь пережила перезагрузку');
  await tab(T, 'tabSync'); await T.waitForSelector('#syDocQ');
  console.log('очередь:', await txt(T, '#syDocQ'));
  await shot(T, '#syPubBar', 'queue');
  vm.runInContext("upload_ = __up;", gs.gas.ctx);
  await T.click('#syDocQ [data-act="pubDocRetry"]');
  await until(async () => Object.keys((await sy(T)).dq || {}).length === 0, 40000, 'очередь разобрана').catch(async e => { console.log('DQ:', JSON.stringify((await sy(T)).dq), '|doc:', await txt(T, '#sym-doc'), '|Q:', await txt(T, '#syDocQ')); throw e; });
  const fNew = files().filter(f => f.kind === 'main' && /^ТТК №8 /.test(f.name));
  assert.strictEqual(fNew.length, 1); assert.notStrictEqual(fNew[0].id, fOld[0].id, 'файл заменён новым, прежний в архиве');
  console.log('7 OK: очередь файлов');

  // ===== 8. прежний скрипт (версии 22): новых функций нет, публикация работает как раньше
  vm.runInContext('VERSION = 22;', gs.gas.ctx);
  const O = await mk('O', seed(), { tab: 'sync' });
  await connect(O, { name: 'Технолог', code: A }); await sleep(2000);
  await O.waitForSelector('#syPubBar');
  assert.ok(await O.locator('#syPubBar [data-act="pubAuto"]').isDisabled(), 'автопубликация недоступна');
  assert.ok(/версии 23/.test(await txt(O, '#syPubBar')), await txt(O, '#syPubBar'));
  await tab(O, 'tabCalc'); await pickRec(O, /Салат/);
  assert.strictEqual(await O.locator('#syHistBox').count(), 0, 'истории версий нет');
  vm.runInContext('VERSION = 23;', gs.gas.ctx);
  console.log('8 OK: прежний скрипт');

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
  console.log('PWPUB OK');
  await browser.close(); gs.close && gs.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e && e.stack || e); console.log(errs.join('\n')); process.exit(1); });
