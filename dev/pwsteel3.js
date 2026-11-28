/* этап 3 оформления: «Цены и динамика» в корешке, «Сырьё и КБЖУ» с ценой и источником под названием, подписи групп без пунктов скрыты, вход — карточка со слоганом, телефон */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const SRC = process.argv[2] || 'kbzhu.html';
const D = fs.readFileSync(path.join(__dirname, 'fixtures/steel/demo.json'), 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(D => { localStorage.clear(); const d = JSON.parse(D); delete d.ings.g10.price; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'menu'); }, D);
  await page.reload(); await page.waitForSelector('.mrow');
  const ok = await page.$('[data-rel="ok"]'); if (ok) await ok.click();
  await page.click('#tabPx'); await page.waitForSelector('.ptitle');
  assert.strictEqual(await page.textContent('.ptitle'), 'Цены и динамика');
  assert.strictEqual(await page.getAttribute('#tabPx', 'aria-selected'), 'true'); assert.strictEqual(await page.getAttribute('#tabBase', 'aria-selected'), 'false');
  await page.click('#tabBase'); await page.waitForSelector('#ingList');
  assert.strictEqual(await page.textContent('.ptitle'), 'Сырьё и КБЖУ');
  assert.strictEqual(await page.getAttribute('#tabBase', 'aria-selected'), 'true'); assert.strictEqual(await page.getAttribute('#tabPx', 'aria-selected'), 'false');
  assert.ok(/11 позиций, у 1 нет цены/.test(await page.textContent('.psum')));
  const meta = await page.textContent('.irow[data-iid="g8"] .imeta');
  assert.ok(/690,00 ₽\/кг/.test(meta) && /справочник/.test(meta), 'цена и источник под названием: ' + meta);
  await page.click('[data-act="filterKnp"]');
  assert.deepStrictEqual(await page.$$eval('#ingList .irow[data-iid]', a => a.map(x => x.getAttribute('data-iid'))), ['g10'], 'фильтр «Нет цены»');
  // гость: подписи групп без пунктов скрыты, вход — карточка со слоганом
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript(() => { window.KBZHU_RELEASE = 1; window.KBZHU_URL = 'https://script.google.com/macros/s/TEST/exec'; });
  const g = await ctx.newPage(); g.on('pageerror', e => errs.push(e.message));
  await g.route(/script\.google\.com|fonts\./, r => r.abort());
  await g.goto('file://' + path.resolve(SRC)); await g.waitForTimeout(1500);
  const caps = await g.$$eval('#tabs .navcap', a => a.filter(x => !x.hidden).map(x => x.textContent));
  assert.deepStrictEqual(caps, ['Деньги', 'Служебное'], 'у гостя только группы с пунктами: ' + caps);
  await g.click('text=Войти по коду'); await g.waitForSelector('#syConn.loginc');
  assert.ok(/право знать себе цену/.test(await g.textContent('#syConn .lgslogan')));
  // телефон: статус коротко, главная кнопка меню закреплена снизу
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => document.querySelector('#tabMenu').click()); await page.waitForSelector('.pmain');
  assert.strictEqual(await page.$eval('.pmain', e => getComputedStyle(e).position), 'fixed');
  assert.strictEqual(await page.$eval('#status', e => getComputedStyle(e).fontSize), '0px');
  for (const t of ['#tabPx', '#tabBase']) {
    await page.evaluate(id => document.querySelector(id).click(), t); await page.waitForTimeout(300);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth) <= 1, t + ': без горизонтальной прокрутки');
  }
  console.log('OK steel3');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
