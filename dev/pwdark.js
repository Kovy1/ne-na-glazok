const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 }, colorScheme: 'dark' });
  const page = await ctx.newPage();
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve('out/КБЖУ_калькулятор_автономный.html'));
  await page.waitForSelector('#view .card, #view .mrow');
  await page.evaluate(() => {
    const s = JSON.parse(JSON.stringify(window.KBZHU_SEED));
    const find = re => Object.keys(s.ings).find(k => re.test(s.ings[k].name));
    const names = ['Фарш говяжий', 'Говядина лопатка', 'Крупа гречневая', 'Макароны \\(рожки', 'Капуста свежая', 'Морковь', 'Сыр Российск', 'Масло сладко', 'Картофель свежий', 'Окорочок', 'Свекла', 'Лук репчатый свежий', 'Сахар-песок', 'Молоко питьевое'];
    s.recipes = {};
    for (let i = 0; i < 40; i++) {
      const n1 = names[i % names.length], n2 = names[(i * 3 + 1) % names.length];
      s.recipes['r' + i] = { name: 'Блюдо ' + (i + 1) + ' ' + n1.split(' ')[0], output: 100, rows: [{ rid: 'a' + i, ing: find(new RegExp('^' + n1)), net: 60 + i, share: 100 }, { rid: 'b' + i, ing: find(new RegExp('^' + n2)), net: 20, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 }, ttk: { num: String(100 + i) }, sell: { main: 60 + (i * 7) % 90 }, qty: { main: Math.round(600 / (i + 1) ** 1.1) + 1 } };
    }
    localStorage.setItem('kbzhu:v1', JSON.stringify(s)); localStorage.setItem('kbzhu:tab', 'abc');
  });
  await page.reload(); await page.waitForSelector('#abChart svg');
  await page.evaluate(() => document.querySelector('#abRes').scrollIntoView());
  const b = await page.$eval('#abChart svg', e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, h: r.height }; });
  await page.mouse.move(b.x + 120, b.y + b.h / 2); await new Promise(r => setTimeout(r, 150));
  await page.screenshot({ path: 'out/shot_abc_dark.png' });
  console.log('paths', await page.$$eval('#abChart svg path', p => p.length));
  await browser.close();
})();
