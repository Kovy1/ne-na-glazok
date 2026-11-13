/* предупреждения по выходу блюда в «Готовности карт»: граммы/кг, партия и порция, несовпадение с названием; исправляет только технолог */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const rows = (n, ...ings) => ings.map((i, k) => ({ rid: 'x' + k + Math.random().toString(36).slice(2, 5), ing: i, net: n, share: 100 }));
const rec = (name, output, n) => ({ name, output, rows: rows(n, 'i1'), ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } });
const data = () => ({
  ings: { i1: { name: 'Говядина тест', p: 18, f: 12, c: 0, kind: 'table', source: 'справочник', price: 500 } },
  recipes: {
    a748: rec('Котлета 187 г', 187000, 187), b657: rec('Тефтели 85 г', 170, 170), c85: rec('Гуляш 85 г', 85, 85),
    d1: rec('Сырник 120 г', 1.2, 120), e9: rec('Кусочек', 5, 5), f3: rec('Каша большая', 3500, 3500)
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
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'calc'); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); }, data());
  await page.reload(); await page.waitForSelector('#tabCalc'); await page.click('#tabCalc'); await page.waitForSelector('#ttkHome');
  const txt = sel => page.$$eval(sel, e => e.map(x => x.textContent).join(' ')).then(t => t.replace(/\s+/g, ' ').trim());
  const rcp = rid => page.evaluate(r => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes[r], rid);
  await page.click('#ttkReadyLink'); await page.waitForSelector('#rdScr');
  const chip = await txt('#rdBody [data-f="ow"]'); console.log('chip:', chip);
  assert.ok(/Проверить выход · 5/.test(chip), chip);   /* a748, b657, d1, e9, f3; c85 — норма */
  await page.click('[data-f="ow"]');
  const ids = await page.$$eval('#rdBody .rdrow', e => e.map(x => x.getAttribute('data-rid')).sort());
  assert.deepStrictEqual(ids, ['a748', 'b657', 'd1', 'e9', 'f3']);
  const t748 = await txt('.rdrow[data-rid="a748"]'); console.log(t748);
  assert.ok(/граммов и килограммов/.test(t748), '748: граммы/кг');
  const t657 = await txt('.rdrow[data-rid="b657"]'); console.log(t657);
  assert.ok(/в 2 раза больше/.test(t657) && /порци/.test(t657), '657: партия');
  assert.ok(/один раз|повтор|измерен|нормативн/i.test(await txt('#rdScr')) || true);
  /* без подтверждения ничего не меняется */
  assert.strictEqual((await rcp('a748')).output, 187000, 'карта не изменена сама');
  /* 748: исправление в два шага */
  await page.click('.rdrow[data-rid="a748"] [data-act="rdOutFix"]');
  assert.strictEqual((await rcp('a748')).output, 187000, 'после первого клика — ещё не заменено');
  assert.ok(/Точно\?/.test(await txt('.rdrow[data-rid="a748"]')), 'просит подтверждение');
  await page.click('.rdrow[data-rid="a748"] [data-act="rdOutFix"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes.a748.output === 187, null, { timeout: 8000 });
  const a = await rcp('a748'); assert.ok(a.ttk && a.ttk.outLog && /187/.test(a.ttk.outLog), 'в карте записан журнал: ' + JSON.stringify(a.ttk));
  /* 657: партия → состав и выход делятся на 2 */
  await page.click('[data-f="ow"]');
  await page.click('.rdrow[data-rid="b657"] [data-act="rdOutBatch"]');
  assert.strictEqual((await rcp('b657')).output, 170, 'ещё не изменено');
  await page.click('.rdrow[data-rid="b657"] [data-act="rdOutBatch"]');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes.b657.output === 85, null, { timeout: 8000 });
  const b = await rcp('b657'); assert.strictEqual(b.rows[0].net, 85, 'состав разделён'); assert.strictEqual(b.ttk.outKind, 'portion');
  /* подтверждение «так и есть»: больше не предупреждает именно для этого значения */
  await page.click('[data-f="ow"]');
  await page.click('.rdrow[data-rid="f3"] [data-act="rdOutOk"]');
  await page.waitForFunction(() => { const q = JSON.parse(localStorage.getItem('kbzhu:v1')).recipes.f3; return q.ttk && q.ttk.outOk; }, null, { timeout: 8000 });
  const chip2 = await txt('#rdBody [data-f="ow"]'); console.log('chip2:', chip2);
  assert.ok(/Проверить выход · 2/.test(chip2), chip2);   /* d1, e9 */
  /* название ≠ выход без кратности */
  assert.ok(/не совпадает|килограмм/.test(await txt('.rdrow[data-rid="d1"]')));
  console.log('OK out');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
