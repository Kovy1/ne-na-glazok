/* v27: первое подключение: встроенная база без цен не конфликтует с общей; настоящие правки не теряются; конфликт показывается панелью без «моё» по умолчанию */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html'; const errs = [];
(async () => {
  const gs = await startGas({});
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678', E = 'ed-1234';
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef', by: 'Технолог' }, b)).text);
  vm.runInContext('setup()', gs.gas.ctx);
  const ing = (name, o) => Object.assign({ name, p: 1, f: 1, c: 1, kind: 'table', source: '' }, o);
  assert.ok(post({ op: 'publish', code: A, items: [
    { kind: 'ing', sid: 'i-a', name: 'Масло', baseRev: 0, json: ing('Масло', { p: 0.5, f: 82, c: 0.8, price: 120, priceUnit: 'kg' }) },
    { kind: 'ing', sid: 'i-b', name: 'Мука', baseRev: 0, json: ing('Мука', { p: 10, f: 1, c: 70, price: 50, priceUnit: 'kg' }) },
    { kind: 'ing', sid: 'i-c', name: 'Сахар', baseRev: 0, json: ing('Сахар', { p: 0, f: 0, c: 99.8, price: 60, priceUnit: 'kg' }) },
  ] }).ok);
  // встроенная база: те же названия, цен нет (как в готовом файле)
  const SEED = { ings: { s1: ing('Масло', { p: 0.5, f: 82, c: 0.8 }), s2: ing('Мука', { p: 10, f: 1, c: 70 }), s3: ing('Сахар', { p: 0, f: 0, c: 99.8 }) }, recipes: {}, cfg: {} };
  const mk = async (name, local) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
    await ctx.addInitScript(seed => { Object.defineProperty(window, 'KBZHU_SEED', { get() { return seed; }, set() { } }); }, SEED);
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(l => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); if (l) localStorage.setItem('kbzhu:v1', JSON.stringify(l)); }, local || null);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, code) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', 'Технолог'); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено|не подходит|Не удалось/.test(e.textContent); }, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
  };
  const ings = p => p.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')).ings);
  const byName = (o, n) => Object.values(o).find(x => x.name === n);

  // 1. чистый браузер → вход: цены пришли сами, конфликтов и «моих изменений» нет
  const P = await mk('P'); await connect(P, A);
  const i1 = await ings(P);
  console.log('1 цены после входа:', JSON.stringify(['Масло', 'Мука', 'Сахар'].map(n => byName(i1, n) && byName(i1, n).price)));
  const txt = await P.evaluate(() => document.body.innerText);
  console.log('1 панель конфликтов:', /Оставить моё|Конфликт|Отличается от вашего/.test(txt), '| «Мои изменения»:', (/Мои изменения · (\d+)/.exec(txt) || [])[1]);
  assert.deepStrictEqual(['Масло', 'Мука', 'Сахар'].map(n => byName(i1, n).price), [120, 50, 60], 'цены общей базы применены');
  assert.ok(!/Оставить моё|Отличается от вашего/.test(txt), 'ложного конфликта нет');
  assert.strictEqual((/Мои изменения · (\d+)/.exec(txt) || [])[1], '0', 'встроенная база не считается правкой');
  console.log('1 OK');

  // 2. реальные локальные правки при первом входе: другое поле — объединяется и уходит в «Мои изменения»; то же поле — конфликт, без выбора по умолчанию
  const local = { ings: {
    s1: ing('Масло', { p: 0.5, f: 82, c: 0.8, priceSrc: 'моя накладная' }),                   // правил поле, которое в общей не менялось
    s2: ing('Мука', { p: 10, f: 1, c: 70, price: 77, priceUnit: 'kg' }),                      // своя цена против общей 50
    s3: ing('Сахар', { p: 0, f: 0, c: 99.8 }) }, recipes: {}, cfg: {} };
  const Q = await mk('Q', local); await connect(Q, A);
  const i2 = await ings(Q);
  assert.strictEqual(byName(i2, 'Масло').price, 120, 'общая цена применена к записи с моей правкой в другом поле');
  assert.strictEqual(byName(i2, 'Масло').priceSrc, 'моя накладная', 'моя правка в другом поле сохранена');
  assert.strictEqual(byName(i2, 'Сахар').price, 60, 'нетронутая стартовая запись обновилась');
  assert.strictEqual(byName(i2, 'Мука').price, 77, 'до решения по конфликту моё значение не затёрто');
  const t2 = await Q.evaluate(() => document.body.innerText);
  assert.strictEqual(await Q.locator('.sybd').count(), 0, 'после автозагрузки панель сама не открывается и ничего не перекрывает');
  assert.ok(/Нужно решение: конфликтов 1/.test(await Q.textContent('#syPull')), 'компактная строка о конфликте');
  await Q.click('[data-act="syCmpOpen"]'); await Q.waitForSelector('#syPlan.drawer');
  assert.ok(/Мои изменения · 1\b/.test(t2) && /Мука/.test(await Q.textContent('#syPull')), 'в панели конфликт по муке, в «Моих изменениях» — масло: ' + (/Мои изменения · (\d+)/.exec(t2) || [])[1]);
  assert.strictEqual(await Q.locator('#syPull select[data-act="syChoose"]').inputValue(), '', 'выбор по умолчанию не сделан');
  assert.ok(await Q.isDisabled('#syPull [data-act="syApply"]'), 'пока не выбрано, применить нельзя');
  assert.strictEqual(await Q.locator('#syPull [data-act="syChooseAll"][data-v="local"]').count(), 0, 'массового «Оставить моё» нет');
  await Q.selectOption('#syPull select[data-act="syChoose"]', 'remote');
  await Q.click('#syPull [data-act="syApply"]'); await Q.waitForTimeout(800);
  assert.strictEqual(byName(await ings(Q), 'Мука').price, 50, 'выбрано общее');
  console.log('2 OK: объединение по полям, конфликт без значения по умолчанию, резервная копия');
  const bak = await Q.evaluate(() => new Promise(r => { const rq = indexedDB.open('kbzhu-park', 1); rq.onsuccess = () => { const g = rq.result.transaction('kv').objectStore('kv').getAll(); g.onsuccess = () => r(g.result.filter(x => /^pre:/.test(x.k)).length); }; }));
  assert.ok(bak >= 1, 'копия правок сохранена на устройстве');

  // 3. второй пользователь: серверное обновление приходит, разные правки одного поля = конфликт
  assert.ok(post({ op: 'publish', code: A, items: [{ kind: 'ing', sid: 'i-c', name: 'Сахар', baseRev: 1, json: ing('Сахар', { p: 0, f: 0, c: 99.8, price: 65, priceUnit: 'kg' }) }] }).ok, 'сервер обновил');
  await Q.click('#tabSync'); await Q.click('[data-act="syPull"]'); await Q.waitForTimeout(1500);
  if (await Q.locator('#syPull [data-act="syApply"]').count()) { await Q.click('#syPull [data-act="syApply"]'); await Q.waitForTimeout(800); }   // ручное получение показывает список для подтверждения
  assert.strictEqual(byName(await ings(Q), 'Сахар').price, 65, 'обновление сервера пришло второму пользователю');
  // Q правит цену сахара у себя, сервер — по-другому
  await Q.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); Object.values(d.ings).find(x => x.name === 'Сахар').price = 70; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await Q.reload(); await Q.waitForSelector('#view > *'); await Q.waitForTimeout(800);
  assert.ok(post({ op: 'publish', code: A, items: [{ kind: 'ing', sid: 'i-c', name: 'Сахар', baseRev: 2, json: ing('Сахар', { p: 0, f: 0, c: 99.8, price: 68, priceUnit: 'kg' }) }] }).ok);
  await Q.click('#tabSync'); await Q.click('[data-act="syPull"]'); await Q.waitForTimeout(1500);
  const tc = await Q.textContent('#syPull');
  assert.ok(/Сахар/.test(tc) && /Конфликт/.test(tc), 'настоящий конфликт по одному полю: ' + tc.slice(0, 200));
  assert.strictEqual(byName(await ings(Q), 'Сахар').price, 70, 'моё не затёрто до решения');
  await Q.click('#syPlan .sdhead [data-act="syCmpClose"]'); assert.strictEqual(await Q.locator('.sybd').count(), 0, 'панель сворачивается, страница снова доступна');
  console.log('3 OK: серверное обновление и настоящий конфликт');

  // 4. потеря связи: кэш цел, состояние «нет связи», повтор
  gs.setMode('down');
  await Q.click('[data-act="syPull"]'); await Q.waitForTimeout(2500);
  assert.strictEqual(byName(await ings(Q), 'Масло').price, 120, 'кэш остался');
  gs.setMode('ok');
  await Q.click('[data-act="syPull"]'); await Q.waitForTimeout(2000);
  console.log('4 OK: потеря связи не трогает кэш');
  assert.deepStrictEqual(errs, []); console.log('OK'); await browser.close(); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
