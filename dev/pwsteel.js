/* v94: одна светлая стальная схема — сохранённые тёмная тема и цвет не применяются; корешок с группами и слоганом; шрифт Literata; системная тёмная тема не меняет вид */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'kbzhu.html';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  for (const scheme of ['light', 'dark']) {
    const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme })).newPage();
    page.on('pageerror', e => errs.push(e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto('file://' + path.resolve(SRC));
    await page.evaluate(() => { localStorage.setItem('kbzhu:theme', 'dark'); localStorage.setItem('kbzhu:accent', 'plum'); });
    await page.reload(); await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({ th: document.documentElement.getAttribute('data-theme'), acc: document.documentElement.getAttribute('data-accent'),
      accent: getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(),
      caps: [...document.querySelectorAll('#tabs .navcap')].map(x => x.textContent),
      slogan: (document.querySelector('.rbslogan') || {}).textContent, sloganVis: !!(document.querySelector('.rbslogan') || {}).offsetParent,
      fonts: [...document.querySelectorAll('link[href*="fonts.googleapis"]')].map(l => l.href).join(' '),
      prof: getComputedStyle(document.querySelector('.prof')).display }));
    assert.strictEqual(st.th, 'light', scheme); assert.strictEqual(st.acc, null);
    assert.strictEqual(st.accent.toUpperCase(), '#456F8D');
    assert.deepStrictEqual(st.caps, ['Деньги', 'Документы', 'Дополнительно', 'Служебное']);
    assert.strictEqual(st.slogan, 'У каждой котлеты есть амбиции, финансовые ожидания и право знать себе цену.'); assert.ok(st.sloganVis, 'слоган виден');
    assert.ok(/Literata/.test(st.fonts) && /subset=cyrillic/.test(st.fonts));
    assert.strictEqual(st.prof, 'none', 'выбора цвета и темы нет');
  }
  console.log('OK steel');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
