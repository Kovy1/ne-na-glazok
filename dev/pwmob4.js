const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve('out/КБЖУ_калькулятор_автономный.html'));
  await page.waitForSelector('#view .card, #view .mrow');
  await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(window.KBZHU_SEED));
    const find = re => Object.keys(s.ings).find(k => re.test(s.ings[k].name));
    const mk = (name, out, spec, num, sell) => ({ name, output: out, rows: spec.map(([re, net, gross], i) => ({ rid: 'r' + i, ing: find(re) || '', net, share: 100, gross })), ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 }, ttk: { num }, sell });
    s.recipes = { pasta: mk('Макароны запечённые 1/150', 150, [[/^Макарон/, 38.5, 38.5], [/^Сливки 22/, 20, 20], [/^Сыр Российск/, 10.6, 10.6], [/^Соль/, 1, 1]], '21', { main: 55 }), salt: mk('Салат с очень длинным названием для проверки переноса строки 1/200', 200, [[/^Соль/, 5, 5], [/^Шея говяжья/, 50, 50]], '22') };
    localStorage.setItem('kbzhu:v1', JSON.stringify(s)); localStorage.setItem('kbzhu:tab', 'menu');
  });
  await page.reload(); await page.waitForSelector('.mrow[data-rid]');
  console.log('overflow', await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth));
  await page.evaluate(() => document.querySelector('#mList').scrollIntoView()); await page.screenshot({ path: 'out/shot_menu_mob.png' });
  console.log('ERR', errs);
  await browser.close();
})();
