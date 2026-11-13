/* «Обзор»: показатели из реальных данных, «Нет данных» без продаж, таблицы под графиками, телефон */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SEED = (withSales) => {
  const ing = (name, p, f, c, price) => ({ name, p, f, c, kind: 'estimate', price, priceUnit: 'kg' });
  const mk = (name, out, rows, sell, qty, cat) => { const r = { name, output: out, rows, kind: 'tk' }; if (sell) r.sell = { main: sell }; if (withSales && qty) r.qty = { main: qty }; if (cat) r.cat = cat; return r; };
  return { ings: { i1: ing('Говядина', 18, 15, 0, 600), i2: ing('Картофель', 2, 0.4, 16, 40), i3: ing('Мука', 10, 1, 70, 50), i4: ing('Молоко', 3, 3, 5, 80), i5: ing('Курица', 20, 8, 0, 300) },
    cfg: { menu: { cats: [{ id: 'k1', name: 'Горячее' }, { id: 'k2', name: 'Выпечка' }, { id: 'k3', name: 'Гарниры' }] } },
    recipes: {
      a: mk('Котлета мясная', 100, [{ ing: 'i1', net: 90, share: 100 }], 120, 500, 'k1'),
      b: mk('Курица запечённая', 150, [{ ing: 'i5', net: 140, share: 100 }], 160, 300, 'k1'),
      c: mk('Картофель отварной', 150, [{ ing: 'i2', net: 150, share: 100 }], 45, 700, 'k3'),
      d: mk('Блинчики', 110, [{ ing: 'i3', net: 45, share: 100 }, { ing: 'i4', net: 92, share: 100 }], 70, 200, 'k2'),
      e: mk('Новое блюдо без выхода', 0, [], null, 0, null) } };
};
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const mk = async (vp, withSales) => {
    const P = await (await browser.newContext({ viewport: vp })).newPage();
    P.errs = []; P.on('pageerror', e => P.errs.push(e.message));
    await P.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await P.goto('file://' + path.resolve('out/КБЖУ_калькулятор_автономный.html'));
    const data = SEED(withSales);
    await P.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); }, data);
    return P;
  };
  // 1. с продажами
  let P = await mk({ width: 1440, height: 1000 }, true);
  await P.reload(); await P.waitForSelector('.hm');
  let t = (await P.textContent('.hm')).replace(/\s+/g, ' ');
  console.log(t.slice(0, 700));
  assert.ok(/Выручка.*₽/.test(t) && /Фудкост\d/.test(t.replace(/\s/g,''))||/Фудкост/.test(t) && /Состав продаж/.test(t) && /ABC-анализ меню/.test(t));
  assert.ok(/Горячее — \d+ %/.test(t) && /Таблица/.test(t) && /Источник: ТТК и цены региона/.test(t)||/Как считаются показатели/.test(t));
  const rev = 500 * 120 + 300 * 160 + 700 * 45 + 200 * 70; // 60000+48000+31500+14000
  assert.ok(new RegExp(String(rev).replace(/(\d)(?=(\d{3})+$)/, '$1.?')).test(t.replace(/ /g, ' ').replace(/ /g, '')) || t.replace(/\D/g, '').includes(String(rev)), 'выручка ' + rev);
  assert.ok(/ТТК без выхода порции/.test(t), 'внимание: без выхода');
  await P.screenshot({ path: 'out/home_desktop.png', fullPage: true });
  // кнопка внимания ведёт в меню
  await P.click('.hmatt button >> nth=0'); await P.waitForSelector('.mrow, .card.empty'); assert.ok(await P.evaluate(() => /menu|Меню/.test(document.querySelector('.tab[aria-selected="true"]').textContent)));
  assert.deepStrictEqual(P.errs, []);
  // 2. без продаж
  P = await mk({ width: 390, height: 844 }, false);
  await P.reload(); await P.waitForSelector('.hm');
  t = (await P.textContent('.hm')).replace(/\s+/g, ' ');
  assert.ok(/Нет данных/.test(t) && !/Горячее — /.test(t), 'без продаж: Нет данных, без выдуманных цифр');
  await P.screenshot({ path: 'out/home_mobile.png', fullPage: true });
  assert.deepStrictEqual(P.errs, []);
  console.log('PWHOME OK'); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
