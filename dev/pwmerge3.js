/* объединение сырья без КБЖУ, заведённого при загрузке карт: подсказки, карты переходят на выбранное сырьё, синоним запоминается,
   лишнее удаляется у всех, цена переносится, без подсказки и без выбора позиции не трогаются */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const SRCX = 'Добавлено из ТТК (загрузка из облака): значения КБЖУ не заполнены';
const T_ = (name, p, f, c, extra) => Object.assign({ name, p, f, c, kind: 'table', source: '' }, extra || {});
const N_ = (name, extra) => Object.assign({ name, p: 0, f: 0, c: 0, kind: 'estimate', source: SRCX }, extra || {});
const row = (rid, ing, net, tname) => ({ rid, ing, net, share: 100, tname });
const seed = () => ({
  ings: {
    m1: T_('Масло подсолнечное', 0, 99.9, 0, { price: 120 }), f1: T_('Филе куриное грудка', 23, 1.9, 0, { price: 400 }), l1: T_('Лук репчатый', 1.4, 0.1, 8),
    n1: N_('Масло подсолнечное раф дез'), n2: N_('Масло подсолнечное для смазки листов', { price: 99 }), n3: N_('Филе куриное зам.'),
    n4: N_('Перец черный молотый'), n5: N_('Шея говяжья зам. вариант 3'), n6: N_('Шея говяжья зам. вариант 5'),
    w1: T_('Вода питьевая', 0, 0, 0),
  },
  recipes: {
    r1: { name: 'Котлета', output: 100, rows: [row('a', 'l1', 20, 'Лук'), row('b', 'n1', 5, 'Масло подсолнечное раф дез'), row('c', 'n3', 50, 'Филе куриное зам.'), row('d', 'n5', 40, 'Шея говяжья зам. вариант 3'), row('e', 'n4', 1, 'Перец')], ref, ttk: { num: '1' }, sell: { main: 150 } },
    r2: { name: 'Тефтели', output: 100, rows: [row('a', 'l1', 10, 'Лук'), row('b', 'n2', 3, 'Масло для смазки листов'), row('c', 'n6', 30, 'Шея говяжья зам. вариант 5'), row('d', 'n3', 20, 'Филе куриное зам.')], ref, ttk: { num: '2' }, sell: { main: 120 } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678';
  const srv = (a, extra) => gs.gas.parseOut(gs.gas.get(Object.assign({ a, code: A }, extra || {}))).data;
  const live = () => { const it = srv('pull', { since: '0' }).items; return { ing: it.filter(x => x.kind === 'ing' && !(x.json && x.json._del)), rec: it.filter(x => x.kind === 'rec' && !(x.json && x.json._del)), del: it.filter(x => x.json && x.json._del) }; };
  const mk = async (name, data) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { pubDocs: false } })); }, data);
    await page.reload(); await page.waitForSelector('#syConn');
    return page;
  };
  const connect = async page => {
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', 'Технолог'); await page.fill('#sy-code', A); await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
    await sleep(1500);
  };
  const txt = (page, sel) => page.evaluate(s => { const e = document.querySelector(s); return e ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel);
  const until = async (fn, t = 40000, what = '') => { const t0 = Date.now(); let v; while (Date.now() - t0 < t) { v = await fn(); if (v) return v; await sleep(300); } throw new Error('не дождались: ' + what); };
  const DB = page => page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')));
  vm.runInContext('setup()', gs.gas.ctx);

  // ===== 1. публикуем исходное состояние, открываем «База сырья»
  const T = await mk('T', seed());
  await connect(T);
  await T.click('#sy-pub'); await until(async () => /Опубликовано: /.test(await txt(T, '#sym-send')), 40000, 'публикация исходного');
  assert.strictEqual(live().ing.length, 10); assert.strictEqual(live().rec.length, 2);
  await T.click('#tabBase'); await T.waitForSelector('#mgBox');
  assert.ok(/Сырьё без КБЖУ из загрузки карт · 6/.test(await txt(T, '#mgBox > summary')), await txt(T, '#mgBox > summary'));
  await T.click('#mgBox > summary');
  await T.waitForSelector('#mgBox [data-act="mgBest"]');
  let box = await txt(T, '#mgBox'); console.log('блок:', box.slice(0, 900));
  assert.ok(/Применить: 0/.test(box), 'по умолчанию ничего не выбрано');
  assert.ok(/Объединить с «Масло подсолнечное»/.test(box) && /Объединить с «Филе куриное грудка»/.test(box), 'подсказки из базы');
  assert.ok(/Дубль: «Шея говяжья зам\. вариант/.test(box), 'одинаковые позиции из загрузки подсказываются друг другу');
  assert.ok(/похожего в базе нет/.test(box), 'для «Перец чёрный» подсказки нет, он остаётся');
  if (process.env.SHOT) await T.locator('#mgBox').screenshot({ path: 'out/shot_mg_list.png' });

  // ===== 2. подставить подсказки и объединить (два нажатия)
  await T.click('#mgBox [data-act="mgBest"]');
  const k = await txt(T, '#mgBox [data-act="mgGo"]'); console.log('кнопка:', k);
  assert.ok(/Применить: 4/.test(k), 'четыре позиции получили подсказку; перец и «Шея …3» (она остаётся) без неё: ' + k);
  await T.click('#mgBox [data-act="mgGo"]'); assert.ok(/Нажмите ещё раз: применить 4/.test(await txt(T, '#mgBox [data-act="mgGo"]'))); await T.click('#mgBox [data-act="mgGo"]');
  await until(async () => /Объединено: 4/.test(await txt(T, '#sym-mg')), 40000, 'объединение').catch(async e => { console.log('MG:', await txt(T, '#mgBox')); throw e; });
  console.log('итог:', await txt(T, '#sym-mg'));
  const db = await DB(T);
  const names = Object.values(db.ings).map(x => x.name).sort();
  console.log('сырьё:', names.join(' | '));
  assert.deepStrictEqual(names, ['Вода питьевая', 'Лук репчатый', 'Масло подсолнечное', 'Перец черный молотый', 'Филе куриное грудка', 'Шея говяжья зам. вариант 3']);
  const ingName = id => db.ings[id].name;
  assert.deepStrictEqual(db.recipes.r1.rows.map(r => ingName(r.ing)), ['Лук репчатый', 'Масло подсолнечное', 'Филе куриное грудка', 'Шея говяжья зам. вариант 3', 'Перец черный молотый']);
  assert.deepStrictEqual(db.recipes.r2.rows.map(r => ingName(r.ing)), ['Лук репчатый', 'Масло подсолнечное', 'Шея говяжья зам. вариант 3', 'Филе куриное грудка']);
  assert.strictEqual(db.recipes.r1.rows[1].tname, 'Масло подсолнечное раф дез', 'название из карты остаётся в строке');
  const oil = db.ings.m1, fil = db.ings.f1;
  assert.ok(oil.aliases.includes('масло подсолнечное раф дез') && oil.aliases.includes('масло подсолнечное для смазки листов'), 'синонимы запомнены: ' + JSON.stringify(oil.aliases));
  assert.ok(fil.aliases.includes('филе куриное зам'), 'синоним: ' + JSON.stringify(fil.aliases));
  assert.strictEqual(oil.price, 120, 'у принимающего своя цена, чужая не затёрла');

  // ===== 3. общая база: карты на новом сырье, лишнее удалено, принимающее с синонимами
  const L = live();
  console.log('в общей базе: сырья', L.ing.length, 'удалено', L.del.length);
  assert.strictEqual(L.ing.length, 6); assert.strictEqual(L.del.length, 4, 'четыре лишние позиции удалены');
  const sidName = {}; L.ing.forEach(x => { sidName[x.sid] = x.name; });
  const r1 = L.rec.find(x => x.name === 'Котлета').json;
  assert.ok(r1.rows.every(r => sidName[r.ing]), 'карта не ссылается на удалённое сырьё'); assert.deepStrictEqual(r1.rows.map(r => sidName[r.ing]), ['Лук репчатый', 'Масло подсолнечное', 'Филе куриное грудка', 'Шея говяжья зам. вариант 3', 'Перец черный молотый']);
  assert.ok(L.ing.find(x => x.name === 'Масло подсолнечное').json.aliases.includes('масло подсолнечное раф дез'), 'синоним ушёл всем');
  assert.strictEqual(await txt(T, '#syStrip'), '');
  assert.strictEqual(await T.locator('#mgBox').count(), 1, 'остались «Перец черный молотый» и «Шея…3»'); assert.ok(/· 2/.test(await txt(T, '#mgBox > summary')));
  if (process.env.SHOT) await T.locator('#mgBox').screenshot({ path: 'out/shot_mg_done.png' });
  console.log('1-3 OK: подсказки, объединение, общая база');

  // ===== 3б. «Не считать» в общей базе: строка остаётся в карте без сырья, позиция удаляется у всех
  await T.evaluate(() => { const r = [...document.querySelectorAll('#mgBox .syrow')].find(x => x.querySelector('b').textContent === 'Перец черный молотый'); const s = r.querySelector('[data-act="mgPick"]'); s.value = '__skip__'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.ok(/Применить: 1/.test(await txt(T, '#mgBox [data-act="mgGo"]')));
  await T.click('#mgBox [data-act="mgGo"]'); await T.click('#mgBox [data-act="mgGo"]');
  await until(async () => /Не считается: 1\. Карт обновлено: 1/.test(await txt(T, '#sym-mg')), 40000, 'пропуск в общей базе');
  await sleep(1500);
  const L2 = live(); assert.strictEqual(L2.ing.length, 5, 'перец удалён из общей базы'); assert.ok(!L2.ing.some(x => x.name === 'Перец черный молотый'));
  const r1b = L2.rec.find(x => x.name === 'Котлета').json, pr = r1b.rows[r1b.rows.length - 1];
  console.log('строка перца в общей базе:', JSON.stringify(pr));
  assert.ok(pr.skip === true && !pr.ing && /Перец/.test(pr.tname || pr['in'] || ''), 'строка без сырья и не считается');
  assert.strictEqual(await txt(T, '#syStrip'), '');
  console.log('3б OK: «Не считать» уходит всем');

  // ===== 4. без подключения к общей базе: то же самое локально
  const P = await mk('P', seed());
  await P.click('#tabBase'); await P.waitForSelector('#mgBox'); await P.click('#mgBox > summary');
  await P.click('#mgBox [data-act="mgBest"]'); await P.click('#mgBox [data-act="mgGo"]'); await P.click('#mgBox [data-act="mgGo"]');
  await until(async () => /Объединено: 4/.test(await txt(P, '#sym-mg')), 15000, 'локальное объединение');
  await sleep(1500); const pdb = await DB(P); assert.strictEqual(Object.keys(pdb.ings).length, 6);
  assert.deepStrictEqual(pdb.recipes.r2.rows.map(r => pdb.ings[r.ing].name), ['Лук репчатый', 'Масло подсолнечное', 'Шея говяжья зам. вариант 3', 'Филе куриное грудка']);
  console.log('4 OK: локально');

  // ===== 5. ручной выбор из всей базы сырья: подсказок нет или они не те (как «Филе куриное нарезное зам.» → «Филе куриное ЦБ»)
  const seed5 = () => ({
    ings: {
      g1: T_('Филе куриное ЦБ', 23, 1.9, 0, { price: 300 }), g2: T_('Филе куриное с сыром 90г', 20, 9, 1), l1: T_('Лук репчатый', 1.4, 0.1, 8),
      n1: N_('Куриное мясо нарезное зам.'), n2: N_('Филе куриное нарезное зам.'), n3: N_('Филе куриное нарезное охл.'),
    },
    recipes: { r1: { name: 'Рагу', output: 100, rows: [row('a', 'l1', 20, 'Лук'), row('b', 'n1', 50, 'Куриное мясо нарезное зам.'), row('c', 'n2', 30, 'Филе куриное нарезное зам.')], ref }, r2: { name: 'Жаркое', output: 100, rows: [row('a', 'n3', 40, 'Филе куриное нарезное охл.')], ref } },
    cfg: {},
  });
  const M5 = await mk('M5', seed5());
  await M5.click('#tabBase'); await M5.waitForSelector('#mgBox'); await M5.click('#mgBox > summary'); await M5.waitForSelector('#mgBox [data-act="mgFind"]');
  assert.strictEqual(await M5.locator('#mgBox [data-act="mgFind"]').count(), 3, 'поле поиска есть у каждой позиции');
  assert.strictEqual(await M5.locator('#mgDl option').count(), 6, 'в списке подсказок вся база сырья');
  const optsOf = async nm => M5.evaluate(n => { const rows = [...document.querySelectorAll('#mgBox .syrow')]; const r = rows.find(x => x.querySelector('b').textContent === n); const sel = r.querySelector('select'); return sel ? [...sel.options].map(o => o.textContent) : null; }, nm);
  console.log('варианты «Филе куриное нарезное зам.»:', JSON.stringify(await optsOf('Филе куриное нарезное зам.')));
  assert.ok((await optsOf('Филе куриное нарезное зам.')).some(o => /Филе куриное ЦБ/.test(o)), 'даже слабое совпадение видно в списке');
  assert.ok((await optsOf('Куриное мясо нарезное зам.')).every(o => !/\((5\d|6\d|7\d|8\d|9\d|100) %\)/.test(o)), 'для «Куриное мясо» только слабая подсказка (ниже 50 %), сама не подставится');
  await M5.click('#mgBox [data-act="mgBest"]');
  assert.ok(/Применить: [12]\b/.test(await txt(M5, '#mgBox [data-act="mgGo"]')), 'подставились только сильные подсказки: ' + await txt(M5, '#mgBox [data-act="mgGo"]'));
  await M5.click('#mgBox [data-act="mgClear"]');
  const find = async (nm, text) => { const h = await M5.evaluateHandle(n => { const rows = [...document.querySelectorAll('#mgBox .syrow')]; return rows.find(x => x.querySelector('b').textContent === n).querySelector('[data-act="mgFind"]'); }, nm); const el = h.asElement(); await el.fill(text); await el.dispatchEvent('change'); await sleep(200); };
  // непонятное название не принимается
  await find('Куриное мясо нарезное зам.', 'такого нет совсем');
  assert.ok(/Применить: 0/.test(await txt(M5, '#mgBox [data-act="mgGo"]')), 'выбор не появился');
  // выбор вне подсказок: появляется отдельным пунктом «выбрано вами»; потом его можно сменить
  await find('Куриное мясо нарезное зам.', 'Филе куриное с сыром 90г');
  assert.ok((await optsOf('Куриное мясо нарезное зам.')).some(o => /Объединить с «Филе куриное с сыром 90г» \(выбрано вами\)/.test(o)), JSON.stringify(await optsOf('Куриное мясо нарезное зам.')));
  // неточный ввод: подходит единственная позиция
  await find('Куриное мясо нарезное зам.', 'филе куриное цб');
  assert.ok(/Применить: 1/.test(await txt(M5, '#mgBox [data-act="mgGo"]')), await txt(M5, '#mgBox [data-act="mgGo"]'));
  assert.ok(await M5.evaluate(() => { const r = [...document.querySelectorAll('#mgBox .syrow')].find(x => x.querySelector('b').textContent === 'Куриное мясо нарезное зам.'); const s = r.querySelector('select'); return /Филе куриное ЦБ/.test(s.options[s.selectedIndex].textContent) && !/сыром/.test(s.options[s.selectedIndex].textContent); }), 'выбрано «Филе куриное ЦБ»');
  // вторая позиция — в «Филе куриное нарезное охл.» (позиция из загрузки, цель тоже может быть из загрузки)
  await find('Филе куриное нарезное охл.', 'Филе куриное нарезное зам.');
  assert.ok(/Применить: 2/.test(await txt(M5, '#mgBox [data-act="mgGo"]')));
  // «Филе куриное нарезное зам.» — тому, кого выбрали из базы
  await find('Филе куриное нарезное зам.', 'Филе куриное ЦБ');
  assert.ok(/Применить: 3/.test(await txt(M5, '#mgBox [data-act="mgGo"]')));
  if (process.env.SHOT) await M5.locator('#mgBox').screenshot({ path: 'out/shot_mg_find.png' });
  await M5.click('#mgBox [data-act="mgGo"]'); await M5.click('#mgBox [data-act="mgGo"]');
  await until(async () => /Объединено: 3\. Карт обновлено: 2/.test(await txt(M5, '#toast')), 15000, 'ручное объединение');
  await sleep(1500); const d5 = await DB(M5);
  assert.deepStrictEqual(Object.values(d5.ings).map(x => x.name).sort(), ['Лук репчатый', 'Филе куриное ЦБ', 'Филе куриное с сыром 90г']);
  assert.deepStrictEqual(d5.recipes.r1.rows.map(r => d5.ings[r.ing].name), ['Лук репчатый', 'Филе куриное ЦБ', 'Филе куриное ЦБ']);
  assert.deepStrictEqual(d5.recipes.r2.rows.map(r => d5.ings[r.ing].name), ['Филе куриное ЦБ'], 'цепочка: охл. → зам. → ЦБ');
  assert.ok(['куриное мясо нарезное зам', 'филе куриное нарезное зам', 'филе куриное нарезное охл'].every(a => d5.ings.g1.aliases.includes(a)), JSON.stringify(d5.ings.g1.aliases));
  assert.strictEqual(await M5.locator('#mgBox').count(), 0, 'лишнего сырья не осталось, блок скрыт');
  if (process.env.SHOT) { /* снимок делается до объединения в отдельном прогоне */ }
  console.log('5 OK: ручной выбор из всей базы, цепочка, синонимы');

  // ===== 6. «в картах: N» показывает карты и открывает их; «Не считать» оставляет строку в карте без расчёта
  const seed6 = () => ({
    ings: { l1: T_('Лук репчатый', 1.4, 0.1, 8, { price: 40 }), n1: N_('Тесто'), n2: N_('Тесто дрожжевое'), n3: N_('Перец черный молотый') },
    recipes: {
      r1: { name: 'Пирожок с луком', output: 100, rows: [row('a', 'l1', 20, 'Лук'), row('b', 'n1', 100, 'Тесто'), row('c', 'n3', 1, 'Перец черный молотый')], ref },
      r2: { name: 'Расстегай', output: 100, rows: [row('a', 'l1', 10, 'Лук'), row('b', 'n1', 50, 'Тесто')], ref },
      r3: { name: 'Булочка', output: 100, rows: [row('a', 'n2', 30, 'Тесто дрожжевое')], ref },
    },
    cfg: {},
  });
  const S6 = await mk('S6', seed6());
  await S6.click('#tabBase'); await S6.waitForSelector('#mgBox'); await S6.click('#mgBox > summary'); await S6.waitForSelector('#mgBox [data-act="mgCards"]');
  const rowOf = nm => S6.evaluateHandle(n => [...document.querySelectorAll('#mgBox .syrow')].find(x => x.querySelector('b').textContent === n), nm).then(h => h.asElement());
  const tr = await rowOf('Тесто');
  assert.strictEqual(await tr.$$eval('.mgcards', e => e.length), 0, 'список карт свёрнут');
  await (await tr.$('[data-act="mgCards"]')).click();
  const lst = await (await rowOf('Тесто')).$$eval('.mgcards [data-act="mgOpen"]', e => e.map(x => x.textContent));
  console.log('карты с «Тесто»:', JSON.stringify(lst));
  assert.deepStrictEqual(lst, ['Пирожок с луком', 'Расстегай']);
  assert.ok(/нетто 100 г/.test(await txt(S6, '#mgBox .mgcards')), 'видно массу в карте');
  if (process.env.SHOT) await S6.locator('#mgBox').screenshot({ path: 'out/shot_mg_cards.png' });
  await (await (await rowOf('Тесто')).$('[data-act="mgOpen"]')).click();
  await until(async () => (await S6.evaluate(() => localStorage.getItem('kbzhu:active'))) === 'r1', 8000, 'карта открылась');
  assert.ok(await S6.evaluate(() => !document.querySelector('#mgBox')), 'ушли из «Базы сырья» в карту');
  await S6.click('#tabBase'); await S6.waitForSelector('#mgBox'); await sleep(300);
  assert.ok(await S6.evaluate(() => !!document.querySelector('#mgBox .mgcards')), 'после возврата список карт и раскрытый блок на месте');
  assert.strictEqual(await (await rowOf('Тесто')).$eval('[data-act="mgPick"]', e => [...e.options].some(o => o.value === '__skip__')), true);
  await (await (await rowOf('Тесто')).$('[data-act="mgPick"]')).selectOption('__skip__');
  const dupOpt = await (await rowOf('Тесто дрожжевое')).$$eval('[data-act="mgPick"] option', e => e.map(o => [o.value, o.textContent]));
  console.log('варианты «Тесто дрожжевое»:', JSON.stringify(dupOpt.map(o => o[1])));
  const dupVal = (dupOpt.find(o => /Дубль: «Тесто»/.test(o[1])) || [])[0]; assert.ok(dupVal, 'дубль «Тесто» предложен');
  await (await (await rowOf('Тесто дрожжевое')).$('[data-act="mgPick"]')).selectOption(dupVal);
  assert.ok(/Применить: 2/.test(await txt(S6, '#mgBox [data-act="mgGo"]')), await txt(S6, '#mgBox [data-act="mgGo"]'));
  await S6.click('#mgBox [data-act="mgGo"]'); await S6.click('#mgBox [data-act="mgGo"]');
  await until(async () => /Не считается: 2\. Карт обновлено: 3/.test(await txt(S6, '#toast')), 15000, 'пропуск строк');
  await sleep(1500); const d6 = await DB(S6);
  assert.deepStrictEqual(Object.values(d6.ings).map(x => x.name).sort(), ['Лук репчатый', 'Перец черный молотый'], 'позиции «Тесто…» удалены');
  const rb = d6.recipes.r1.rows[1]; assert.strictEqual(rb.ing, ''); assert.strictEqual(rb.skip, true); assert.strictEqual(rb.tname, 'Тесто'); assert.strictEqual(rb.net, 100, 'масса в карте осталась');
  assert.strictEqual(d6.recipes.r3.rows[0].skip, true, 'то, что было дублем «Теста», тоже не считается');
  assert.strictEqual(d6.recipes.r3.rows[0].tname, 'Тесто дрожжевое');
  assert.strictEqual(d6.recipes.r1.rows[0].ing, 'l1');
  console.log('6 OK: список карт, переход в карту, «Не считать»');

  assert.deepStrictEqual(errs, [], errs.join('\n'));
  console.log('PWMERGE3 OK');
  await browser.close(); process.exit(0);
})().catch(e => { console.log('FAIL', e); process.exit(1); });
