/* новая ТТК: в строках введено брутто, нетто пусто -> нетто считается по потерям и КБЖУ считается; без нетто и брутто есть понятное предупреждение */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  const REF = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
  await page.evaluate(ref => {
    localStorage.clear();
    localStorage.setItem('kbzhu:v1', JSON.stringify({
      ings: {
        i1: { name: 'Говядина лопатка', p: 20, f: 10, c: 0, kind: 'table', source: '', loss: { cold: 20 } },
        i2: { name: 'Морковь', p: 1.3, f: 0.1, c: 6.9, kind: 'table', source: '' },
      },
      recipes: { r1: { name: 'Новая ТТК', output: 200, rows: [{ rid: 'a', ing: 'i1', net: 0, share: 100 }, { rid: 'b', ing: 'i2', net: 0, share: 100 }], ref, ttk: {} } },
      cfg: {},
    }));
    localStorage.setItem('kbzhu:tab', 'calc'); localStorage.setItem('kbzhu:active', 'r1');
  }, REF);
  await page.reload(); await page.waitForSelector('#rname');
  const warn = () => page.$$eval('#resBody .warns li', e => e.map(x => x.textContent));
  let w = await warn(); console.log('1 warns:', w);
  assert.ok(w.some(x => /Не указано нетто.*: 2\./.test(x)), 'предупреждение про пустое нетто');
  assert.ok(!w.some(x => /Готово/.test(x)), 'и «Готово» не показывается');
  // вводим брутто 1000 у говядины (потери 20 %) -> нетто 800
  const g = page.locator('.trw[data-rid="a"] input[data-act="tGross"]'), n = page.locator('.trw[data-rid="a"] input[data-act="rowNet"]');
  await g.click(); await g.fill('1000'); await sleep(300);
  assert.strictEqual(await n.inputValue(), '800', 'нетто = брутто × (1 − потери)');
  // ширина таблицы КБЖУ: нетто и белки появились
  const rowTxt = (await page.textContent('.row[data-rid="a"]')).replace(/\s+/g, ' '); console.log('строка:', rowTxt);
  assert.ok(/800/.test(rowTxt) && /160/.test(rowTxt), 'в таблице нетто 800 и белков 160 г');
  w = await warn(); assert.ok(w.some(x => /: 1\./.test(x)), 'осталась одна строка без нетто: ' + JSON.stringify(w));
  // брутто изменили: авто-нетто следует
  await g.fill('500'); await sleep(300); assert.strictEqual(await n.inputValue(), '400');
  // нетто вписали руками: за брутто больше не следует
  await n.fill('450'); await sleep(300); await g.fill('600'); await sleep(300);
  assert.strictEqual(await n.inputValue(), '450', 'нетто, введённое руками, не перезаписывается');
  // сырьё без потерь: нетто = брутто
  const g2 = page.locator('.trw[data-rid="b"] input[data-act="tGross"]'), n2 = page.locator('.trw[data-rid="b"] input[data-act="rowNet"]');
  await g2.click(); await g2.fill('300'); await sleep(300);
  assert.strictEqual(await n2.inputValue(), '300');
  w = await warn(); console.log('3 warns:', w); assert.ok(!w.some(x => /Не указано нетто/.test(x)), 'предупреждения больше нет');
  const hero = (await page.textContent('#resBody .hero')).replace(/\s+/g, ' '); console.log('результат:', hero);
  assert.ok(!/^\s*0\s/.test(hero), 'калорийность посчитана');
  // сохранилось в данных
  await sleep(700);
  const db = await page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')));
  assert.deepStrictEqual(db.recipes.r1.rows.map(r => r.net), [450, 300]); assert.strictEqual(db.recipes.r1.rows[0].gross, 600);
  await browser.close();
  if (errs.length) { console.log('ERRORS', errs); process.exit(1); }
  console.log('PWNET OK');
})().catch(e => { console.error(e); process.exit(1); });
