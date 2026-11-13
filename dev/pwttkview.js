/* просмотр ТТК: окно, пересчёт на порции, Esc, возврат фокуса, мобильный полный экран */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const mk = async vp => {
    const P = await (await browser.newContext({ viewport: vp })).newPage();
    P.errs = []; P.on('pageerror', e => P.errs.push(e.message));
    await P.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await P.goto('file://' + path.resolve('out/КБЖУ_калькулятор_автономный.html'));
    await P.evaluate(() => {
      localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu');
      localStorage.setItem('kbzhu:v1', JSON.stringify({ ings: {
        i1: { name: 'Мука пшеничная', p: 10, f: 1, c: 70, kind: 'estimate' }, i2: { name: 'Молоко', p: 3, f: 3, c: 5, kind: 'estimate' } },
        recipes: { r1: { name: 'Блинчики (ТТК №656)', output: 110, rows: [{ ing: 'i1', net: 45.8, share: 100 }, { ing: 'i2', net: 92.4, share: 100 }], kind: 'tk',
          ttk: { t42: '1. Замесить тесто.\n2. Выпечь блины.', s54: '24 часа при +4°C' } },
          r2: { name: 'Пустая карта', output: 100, rows: [], kind: 'tk' } } }));
    });
    await P.reload(); await P.waitForSelector('[data-act="mView"]'); return P;
  };
  let P = await mk({ width: 1200, height: 900 });
  const btn = P.locator('[data-act="mView"]').first();
  await btn.focus(); await btn.click();
  await P.waitForSelector('#ttkViewBox');
  let t = (await P.textContent('#ttkViewBox')).replace(/\s+/g, ' ');
  console.log(t.slice(0, 380));
  assert.ok(/Мука пшеничная.*45,8 г/.test(t) && /Выпечь блины/.test(t) && /24 часа/.test(t) && /Пищевая ценность/.test(t));
  assert.ok(!/Предварительная подготовка/.test(t), 'нет пустых разделов');
  await P.fill('#tvN', '10');
  t = (await P.textContent('#ttkViewBox')).replace(/\s+/g, ' ');
  assert.ok(/458 г/.test(t) && /924 г/.test(t) && /Пересчёт только для просмотра/.test(t), 'на 10 порций: 458 г и 924 г');
  await P.fill('#tvN', '100'); t = (await P.textContent('#ttkViewBox')).replace(/\s+/g, ' ');
  assert.ok(/4,58 кг/.test(t) && /9,24 кг/.test(t), 'на 100: кг');
  const stored = await P.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes.r1.rows[0].net);
  assert.strictEqual(stored, 45.8, 'рецептура не изменилась');
  await P.screenshot({ path: 'out/tv_desktop.png' });
  await P.keyboard.press('Escape'); await P.waitForFunction(() => !document.getElementById('ttkView'));
  assert.ok(await P.evaluate(() => document.activeElement && document.activeElement.getAttribute('data-act') === 'mView'), 'фокус вернулся на кнопку');
  // пустая карта: ничего не выдумывает
  await P.locator('[data-act="mView"]').nth(1).click(); await P.waitForSelector('#ttkViewBox');
  t = (await P.textContent('#ttkViewBox')).replace(/\s+/g, ' ');
  assert.ok(/Технология в карте не заполнена|КБЖУ/.test(t)); await P.click('[data-tv="close"]');
  assert.deepStrictEqual(P.errs, []);
  // телефон
  P = await mk({ width: 390, height: 800 });
  await P.locator('[data-act="mView"]').first().click(); await P.waitForSelector('#ttkViewBox');
  const bb = await P.$eval('#ttkViewBox', e => { const r = e.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; });
  console.log('телефон', bb); assert.ok(bb[0] >= 388 && bb[1] >= 798, 'полный экран');
  await P.screenshot({ path: 'out/tv_mobile.png' });
  assert.deepStrictEqual(P.errs, []);
  console.log('PWTTKVIEW OK'); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
