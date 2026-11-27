/* до входа по коду: только «Меню» с ценами продажи и «Вход»; после входа — обычные вкладки; «Служебное» свёрнуто */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const E = 'ed-1234', A = 'adm-5678';
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef', by: 'Технолог' }, b)).text);
  vm.runInContext('setup()', gs.gas.ctx);
  const ing = (name, o) => Object.assign({ name, p: 1, f: 1, c: 1, kind: 'table', source: '' }, o);
  const rec = (name, output, sell, extra) => Object.assign({ name, output, rows: [{ ing: 'i-aaa', in: 'Лук', net: 50, share: 100 }], ref: {}, ttk: {}, sell }, extra || {});
  assert.ok(post({ op: 'publish', code: A, items: [
    { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 0, json: ing('Лук', { price: 130, priceUnit: 'kg', packG: 1000 }) },
    { kind: 'rec', sid: 'r-111', name: 'Суп с луком', baseRev: 0, json: rec('Суп с луком', 250, { main: 180, msk: 210 }, { ttk: { num: '15' } }) },
    { kind: 'rec', sid: 'r-222', name: 'Борщ', baseRev: 0, json: rec('Борщ', 300, { main: 150 }) },
    { kind: 'rec', sid: 'r-333', name: 'Салат московский', baseRev: 0, json: rec('Салат московский', 120, { msk: 99.5 }, { reg: 'msk' }) },
    { kind: 'rec', sid: 'r-444', name: 'Нерассчитанное', baseRev: 0, json: rec('Нерассчитанное', 100, {}) },
  ] }).ok);
  assert.ok(post({ op: 'layPut', code: A, cats: [{ n: 'Первые блюда', r: ['r-111', 'r-222'] }] }).ok);

  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await ctx.addInitScript(u => { window.KBZHU_URL = u; }, gs.url);
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('G: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push('G console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto(url);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'calc'); });
  await page.reload(); await page.waitForSelector('#view > *');
  const visTabs = () => page.$$eval('#tabs .tab', e => e.filter(b => !b.hidden && getComputedStyle(b).display !== 'none').map(b => b.textContent.trim()));
  const txt = async sel => (await page.evaluate(s => { const e = document.querySelector(s); return e && !e.hidden && getComputedStyle(e).display !== 'none' ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel));

  // ===== 1. гость: две вкладки; меню с ценами продажи; ничего про себестоимость и сырьё
  await page.waitForSelector('.gmrow', { timeout: 20000 });
  console.log('вкладки:', (await visTabs()).join(' | '));
  assert.deepStrictEqual(await visTabs(), ['Меню', 'Вход']);
  assert.strictEqual(await txt('#status'), '', 'статуса сохранения у гостя нет');
  assert.strictEqual(await txt('#regionBox'), '', 'выбор региона в шапке скрыт (он в самом меню)');
  assert.strictEqual(await txt('#bkBar'), '');
  const body = await txt('#view'); console.log('меню:', body.slice(0, 400));
  assert.ok(/Суп с луком/.test(body) && /180/.test(body) && /Борщ/.test(body) && /150/.test(body));
  assert.ok(/Первые блюда/.test(body), 'папка меню');
  assert.ok(!/Салат московский/.test(body) && !/Нерассчитанное/.test(body), 'блюдо другого региона и без цены не показываются');
  assert.ok(!/себестоим|Лук|130|ABC|База сырья/i.test(body.replace('Суп с луком', '')), 'нет сырья и закупочных цен');
  // регион
  await page.selectOption('[data-act="gmReg"]', 'msk'); await sleep(400);
  let b2 = await txt('#view'); console.log('Москва:', b2.slice(0, 300));
  assert.ok(/Салат московский/.test(b2) && /99,5/.test(b2) && /210/.test(b2) && !/Борщ/.test(b2));
  await page.selectOption('[data-act="gmReg"]', 'main'); await sleep(300);
  // поиск
  await page.fill('#gmsearch', 'борщ'); await sleep(300);
  b2 = await txt('#gmList'); assert.ok(/Борщ/.test(b2) && !/Суп с луком/.test(b2), b2);
  await page.fill('#gmsearch', '15'); await sleep(300);
  assert.ok(/Суп с луком/.test(await txt('#gmList')), 'поиск по номеру ТТК');
  await page.fill('#gmsearch', ''); await sleep(200);
  if (process.env.SHOT) await page.screenshot({ path: 'out/gate_guest.png' });
  // гость не может открыть закрытые разделы
  await page.evaluate(() => localStorage.setItem('kbzhu:tab', 'abc')); await page.reload(); await page.waitForSelector('.gmrow');
  assert.deepStrictEqual(await visTabs(), ['Меню', 'Вход']); assert.ok(/Суп с луком/.test(await txt('#view')), 'запомненная закрытая вкладка заменена меню');
  console.log('1 OK');

  // ===== 2. «Вход»: только форма входа; после входа обычные вкладки
  await page.click('[data-act="gmLogin"]'); await page.waitForSelector('#syConn');
  const conn = await txt('#syConn'); console.log('Вход:', conn.slice(0, 300));
  assert.ok(/^Вход/.test(conn) && /Без входа доступно только меню/.test(conn));
  assert.strictEqual(await page.locator('#syHow').count(), 0, 'настройки скрипта у гостя нет');
  await page.fill('#sy-name', 'Кузя'); await page.fill('#sy-code', E);
  await page.click('[data-act="syConnect"]');
  await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено/.test(e.textContent); }, null, { timeout: 30000 });
  await sleep(800);
  const tabs = await visTabs(); console.log('после входа:', tabs.join(' | '));
  assert.ok(tabs.includes('ТТК и калькуляции') && tabs.some(t => /^Сырьё и КБЖУ/.test(t)) && tabs.includes('Личный кабинет') && !tabs.includes('Вход'), tabs.join('|'));
  // «Служебное» свёрнуто
  await page.waitForSelector('#sySvc');
  assert.strictEqual(await page.$eval('#sySvc', e => e.open), false, 'служебные блоки свёрнуты');
  assert.ok(/Служебное/.test(await page.textContent('#sySvc > summary')));
  assert.strictEqual(await page.locator('#sySvc #bkBox').count(), 1); assert.strictEqual(await page.locator('#sySvc #pfBox').count(), 1);
  assert.strictEqual(await page.locator('#bkBox').isVisible(), false, 'копия на Диске не мозолит глаза');
  await page.click('#sySvc > summary'); await sleep(300);
  assert.strictEqual(await page.locator('#bkBox').isVisible(), true, 'по клику раскрывается');
  console.log('2 OK');

  // ===== 3. отключился — снова гость
  await page.click('#syConn [data-act="syDisconnect"]'); await sleep(200); await page.click('#syConn [data-act="syDisconnect"]'); await sleep(900);
  console.log('после выхода:', (await visTabs()).join(' | '));
  assert.deepStrictEqual(await visTabs(), ['Меню', 'Вход']);
  console.log('3 OK');

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
  console.log('PWGATE OK');
  await browser.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); console.log(errs.join('\n')); process.exit(1); });
