/* неполная себестоимость: крупная плашка в меню и в карте, «Заполнить цены» ведёт к ценам нужного сырья */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const rows = (...ings) => ings.map((i, k) => ({ rid: 'x' + k + Math.random().toString(36).slice(2, 5), ing: i, net: 100, share: 100 }));
const rec = (name, output, sell, ...ings) => ({ name, output, rows: rows(...ings), sell: { main: sell }, ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } });
const data = () => ({
  ings: {
    i1: { name: 'Говядина тест', p: 18, f: 12, c: 0, kind: 'table', source: 'справочник', price: 500 },
    i2: { name: 'Лук без цены', p: 1, f: 0, c: 9, kind: 'table', source: 'справочник' },
    i3: { name: 'Соль без цены', p: 0, f: 0, c: 0, kind: 'table', source: 'справочник' },
    i4: { name: 'Перец без цены', p: 1, f: 0, c: 5, kind: 'table', source: 'справочник' },
    i5: { name: 'Сахар без цены', p: 0, f: 0, c: 99, kind: 'table', source: 'справочник' }
  },
  recipes: {
    d1: rec('Блюдо полное', 100, 300, 'i1'),
    d2: rec('Блюдо неполное', 150, 250, 'i1', 'i2', 'i3', 'i4'),
    d3: rec('Блюдо с одной дырой', 150, 220, 'i1', 'i5')
  },
  cfg: {}
});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu'); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); }, data());
  await page.reload(); await page.waitForSelector('.mrow[data-rid]');
  const txt = sel => page.$$eval(sel, e => e.map(x => x.textContent).join(' ')).then(t => t.replace(/\s+/g, ' ').trim());

  // 1. меню: общая плашка и плашки у строк
  const top = await txt('.incbig'); console.log('1 top:', top);
  assert.ok(/У 2 блюд себестоимость неполная: не хватает цен 4 ингредиентов/.test(top) && /Сначала заполните цены, потом устанавливайте цену продажи/.test(top), top);
  const r2 = await txt('.mrow[data-rid="d2"] .minc'); console.log('1 row:', r2);
  assert.ok(/Себестоимость неполная: отсутствуют цены 3 ингредиентов/.test(r2) && /Лук без цены, Соль без цены, Перец без цены/.test(r2) && /Заполнить цены/.test(r2), r2);
  assert.ok(/отсутствует цена 1 ингредиента/.test(await txt('.mrow[data-rid="d3"] .minc')), 'единственное число');
  assert.strictEqual(await page.$('.mrow[data-rid="d1"] .minc'), null, 'у полного блюда плашки нет');
  // 2. «Заполнить цены» у блюда: цены только его сырья без цены
  await page.click('.mrow[data-rid="d2"] [data-act="incFill"]'); await page.waitForSelector('.pdish');
  assert.ok(/блюда «Блюдо неполное» без цены: 3/.test(await txt('.pdish')), await txt('.pdish'));
  const names = async () => page.$$eval('#pList .prow .pn b', e => e.map(x => x.textContent).sort());
  assert.deepStrictEqual(await names(), ['Лук без цены', 'Перец без цены', 'Соль без цены']);
  await page.click('.pdish [data-act="pDishOff"]');
  assert.strictEqual((await names()).length, 4, 'после «Показать всё сырьё» остаётся фильтр «Без цены»: 4 позиции (с Сахаром)');
  // 3. цены вписываем: плашка в карте и в меню исчезает
  await page.click('#tabMenu'); await page.waitForSelector('.mrow[data-rid="d2"]');
  await page.click('.incbig [data-act="incFill"]'); await page.waitForSelector('.pdish');
  assert.ok(/блюд с неполной себестоимостью без цены: 4/.test(await txt('.pdish')), await txt('.pdish'));
  for (const nm of ['Лук без цены', 'Соль без цены', 'Перец без цены', 'Сахар без цены']) {
    const row = page.locator('#pList .prow', { hasText: nm }); await row.locator('input[data-act="pPrice"]').fill('50'); await row.locator('input[data-act="pPrice"]').press('Tab');
  }
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('kbzhu:v1')).ings.i5.price === 50, null, { timeout: 8000 });
  await page.click('#tabMenu'); await page.waitForSelector('.mrow[data-rid="d2"]');
  assert.strictEqual(await page.$('.incbar'), null, 'все цены внесены: плашек нет');
  // 4. карта: плашка в результате расчёта
  await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.ings.i2.price = null; delete d.ings.i2.price; delete d.ings.i3.price; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await page.reload(); await page.waitForSelector('.mrow[data-rid="d2"]');
  await page.click('.mrow[data-rid="d2"] [data-act="mOpen"]'); await page.waitForSelector('#resBody .hero');
  const cardBar = await txt('#resBody .incbig'); console.log('4 card:', cardBar);
  assert.ok(/Себестоимость неполная: отсутствуют цены 2 ингредиентов/.test(cardBar) && /Лук без цены, Соль без цены/.test(cardBar), cardBar);
  await page.click('#resBody .incbig [data-act="incFill"]'); await page.waitForSelector('.pdish');
  assert.deepStrictEqual(await names(), ['Лук без цены', 'Соль без цены']);
  assert.deepStrictEqual(errs, [], errs.join('\n'));
  await browser.close(); console.log('PWINC OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
