/* допущение «1 л = 1 кг» видно в себестоимости карты */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  const d = { ings: { i1: { name: 'Масло тест', p: 0, f: 99, c: 0, kind: 'table', source: 'справочник', price: 180, densAsm: 1 }, i2: { name: 'Мука тест', p: 10, f: 1, c: 70, kind: 'table', source: 'справочник', price: 40 } },
    recipes: { r1: { name: 'Блюдо 100 г', output: 100, rows: [{ rid: 'a1', ing: 'i1', net: 10, share: 100 }, { rid: 'a2', ing: 'i2', net: 90, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } },
               r2: { name: 'Без допущения 100 г', output: 100, rows: [{ rid: 'b1', ing: 'i2', net: 100, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } } }, cfg: {} };
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'calc'); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:active', 'r1'); }, d);
  const openCard=async rid=>{await page.click('#tabMenu'); await page.waitForSelector('.mrow[data-rid]'); await page.click('.mrow[data-rid="'+rid+'"] [data-act="mOpen"]'); await page.waitForSelector('#resBody');};
  await page.reload(); await openCard('r1');
  await page.waitForFunction(() => /1 л = 1 кг/.test(document.body.innerText), null, { timeout: 8000 });
  const t = await page.evaluate(() => document.body.innerText);
  assert.ok(/Допущение «1 л = 1 кг» принято для цены сырья: Масло тест/.test(t), 'есть пометка у карты с допущением');
  await page.reload(); await openCard('r2'); await page.waitForTimeout(500);
  assert.ok(!/Допущение «1 л = 1 кг»/.test(await page.evaluate(() => document.body.innerText)), 'у другой карты пометки нет');
  console.log('OK dens2');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
