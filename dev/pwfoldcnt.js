/* счётчик в «Папки меню» считает как меню: выбранный регион, без архива; остальные — отдельной припиской */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const P = await (await browser.newContext({ viewport: { width: 1100, height: 1000 } })).newPage();
  const errs = []; P.on('pageerror', e => errs.push(e.message));
  await P.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await P.goto('file://' + path.resolve('out/КБЖУ_калькулятор_автономный.html'));
  await P.evaluate(() => {
    localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu');
    const mk = (name, extra) => Object.assign({ name, output: 100, rows: [], kind: 'tk', cat: 'c2' }, extra || {});
    localStorage.setItem('kbzhu:v1', JSON.stringify({ ings: {}, cfg: { menu: { cats: [{ id: 'c1', name: 'Вторые блюда' }, { id: 'c2', name: 'Второе горячее' }] } }, recipes: {
      a: mk('Котлета', { cat: 'c1', arch: true }), b: mk('Гуляш', { cat: 'c1', arch: true }), c: mk('Плов'), d: mk('Рагу') } }));
  });
  await P.reload(); await P.waitForSelector('#mFolders'); await P.evaluate(() => document.querySelector('#mFolders').open = true);
  const rows = await P.$$eval('#mFolders .mfrow', e => e.map(x => x.querySelector('input').value + ' | ' + x.querySelector('.mfcnt').textContent));
  console.log(rows.join('  //  '));
  assert.ok(/Вторые блюда \| блюд: 0 · ещё 2 в архиве/.test(rows[0]));
  assert.strictEqual(rows[1], 'Второе горячее | блюд: 2');
  // объединение: «Второе горячее» (2 блюда) ← «Вторые блюда» (2 в архиве)
  await P.selectOption('[data-act="mMergeFrom"]', 'c1'); await P.waitForSelector('[data-act="mMergeTo"]');
  await P.evaluate(() => document.querySelector('#mFolders').open = true);
  await P.selectOption('[data-act="mMergeTo"]', 'c2');
  await P.click('[data-act="mMergeGo"]'); await P.click('[data-act="mMergeGo"]'); await P.waitForTimeout(500);
  const rows2 = await P.$$eval('#mFolders .mfrow', e => e.map(x => x.querySelector('input').value + ' | ' + x.querySelector('.mfcnt').textContent));
  console.log(rows2.join(' // '));
  assert.deepStrictEqual(rows2, ['Второе горячее | блюд: 2 · ещё 2 в архиве или другом регионе']);
  const cats = await P.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); await P.waitForTimeout(800);
  const d2 = await P.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')));
  assert.ok(Object.values(d2.recipes).every(r => r.cat === 'c2'), 'все блюда в одной папке');
  assert.strictEqual(d2.cfg.menu.cats.length, 1);
  assert.deepStrictEqual(errs, []); console.log('PWFOLDCNT OK'); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
