/* База сырья: «Цены и динамика» стоит первой, вторая вкладка «КБЖУ и потери»; в строке сырья нормы потерь (х/о, варка, жарка, тушение, запекание),
   раздел, тип данных и источник под «⋯»; новому сырью нормы подставляются по названию */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const seed = () => ({
  ings: {
    i1: { name: 'Говядина лопатка', p: 18.6, f: 14, c: 0, kind: 'table', source: 'Таблица' },
    i2: { name: 'Мука пшеничная', p: 10, f: 1, c: 70, kind: 'estimate', source: '', loss: { cold: 2, boil: null, fry: null, stew: null, bake: null } },
  }, recipes: {}, cfg: {},
});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR/.test(m.text())) errs.push('console: ' + m.text()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:bsub', 'kbzhu'); }, seed());
  await page.reload(); await page.waitForSelector('#view > *');
  const ings = async () => { await sleep(1300); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')).ings); };
  const byName = (o, n) => Object.values(o).find(i => i.name === n);

  // 1. вкладки: «Цены и динамика» первая
  await page.click('#tabBase'); await page.waitForSelector('.subtabs');
  const stabs = await page.$$eval('.subtabs .stab', e => e.map(x => x.textContent.trim()));
  assert.deepStrictEqual(stabs, ['Цены и динамика', 'КБЖУ и потери']);
  assert.strictEqual(await page.getAttribute('.stab[data-k="kbzhu"]', 'aria-selected'), 'true', 'выбранная вкладка помнится');
  await page.click('.stab[data-k="price"]'); await page.waitForSelector('#pChartCard, .prow, .card');
  await page.click('.stab[data-k="kbzhu"]'); await page.waitForSelector('.irow.ihead');
  console.log('1 OK', stabs.join(' | '));

  // 2. шапка: без «Раздел», «Тип данных», «Источник»; есть нормы потерь
  const head = (await page.textContent('.irow.ihead')).replace(/\s+/g, ' ');
  assert.ok(/Х\/о/.test(head) && /Варка/.test(head) && /Жарка/.test(head) && /Тушение/.test(head) && /Запек/.test(head), head);
  assert.ok(!/Раздел|Тип данных|Источник/.test(head), head);
  assert.strictEqual(await page.locator('.irow:not(.ihead) select.kind').count(), 0, 'тип данных в строке не показан');
  assert.strictEqual(await page.locator('.irow:not(.ihead) input.src').count(), 0, 'источник в строке не показан');
  assert.strictEqual(await page.locator('.irow:not(.ihead) input[data-act="iLoss"]').count(), 10, 'у каждого сырья пять полей потерь');
  assert.strictEqual(await page.locator('.irow.est').count(), 1, 'ориентир отмечен в строке');
  console.log('2 OK');

  // 3. правка норм потерь
  const row = n => page.locator('.irow:not(.ihead):not(.more)').filter({ has: page.locator('input.nm[value="' + n + '"]') });
  const lossIn = (n, k) => row(n).locator('input[data-k="' + k + '"]');
  assert.strictEqual(await lossIn('Мука пшеничная', 'cold').inputValue(), '2', 'потери из базы показаны');
  await lossIn('Говядина лопатка', 'cold').fill('3,5'); await lossIn('Говядина лопатка', 'boil').fill('36'); await lossIn('Говядина лопатка', 'fry').fill('33');
  await lossIn('Говядина лопатка', 'stew').fill('38'); await lossIn('Говядина лопатка', 'bake').fill('35');
  let d = await ings(); const g1 = byName(d, 'Говядина лопатка');
  assert.deepStrictEqual(g1.loss, { cold: 3.5, boil: 36, fry: 33, stew: 38, bake: 35 });
  await lossIn('Говядина лопатка', 'fry').fill('150');
  assert.ok(await lossIn('Говядина лопатка', 'fry').evaluate(e => e.classList.contains('invalid')), '150 % не принимается');
  d = await ings(); assert.strictEqual(byName(d, 'Говядина лопатка').loss.fry, 33, 'неверное значение не сохранено');
  await lossIn('Говядина лопатка', 'fry').fill('');
  d = await ings(); assert.strictEqual(byName(d, 'Говядина лопатка').loss.fry, null, 'пусто = нет нормы');
  for (const k of ['cold', 'boil', 'stew', 'bake']) await lossIn('Говядина лопатка', k).fill('');
  d = await ings(); assert.strictEqual(byName(d, 'Говядина лопатка').loss, undefined, 'все поля пусты — потерь у сырья нет');
  console.log('3 OK');

  // 4. «⋯»: раздел, тип данных, источник
  await row('Мука пшеничная').locator('[data-act="iMore"]').click();
  await page.waitForSelector('.irow.more select.kind');
  assert.ok(await page.locator('.irow.more select.icat').count() === 1 && await page.locator('.irow.more input.src').count() === 1);
  await page.fill('.irow.more input.src', 'Этикетка производителя');
  await page.selectOption('.irow.more select.kind', 'table');
  d = await ings(); const m1 = byName(d, 'Мука пшеничная');
  assert.strictEqual(m1.source, 'Этикетка производителя'); assert.strictEqual(m1.kind, 'table');
  await page.click('.irow:not(.more) [data-act="iMore"][aria-expanded="true"]');
  assert.strictEqual(await page.locator('.irow.more').count(), 0, 'свернулось');
  console.log('4 OK');

  // 5. новое сырьё вручную: нормы подставляются по названию, неизвестное остаётся пустым
  await page.click('[data-act="newIng"]'); await page.waitForSelector('.irow input.nm:focus');
  const iid1 = await page.evaluate(() => document.activeElement.closest('.irow').getAttribute('data-iid'));
  await page.keyboard.type('Картофель молодой'); await page.keyboard.press('Tab'); await sleep(400);
  const pot = page.locator('.irow[data-iid="' + iid1 + '"]');
  assert.strictEqual(await pot.locator('input[data-k="cold"]').inputValue(), '25', 'х/о картофеля подставлена');
  assert.strictEqual(await pot.locator('input[data-k="boil"]').inputValue(), '3');
  d = await ings(); const pt = byName(d, 'Картофель молодой'); assert.strictEqual(pt.loss.cold, 25); assert.strictEqual(pt.loss.fry, 30);
  await pot.locator('input[data-k="cold"]').fill('30');            // свою норму можно поправить, подстановка её не трогает
  await page.click('[data-act="newIng"]'); await page.waitForSelector('.irow input.nm:focus');
  await page.keyboard.type('Хлопья особые'); await page.keyboard.press('Tab'); await sleep(400);
  d = await ings(); assert.strictEqual(byName(d, 'Хлопья особые').loss, undefined, 'неизвестному сырью норм не подставляем');
  assert.strictEqual(byName(d, 'Картофель молодой').loss.cold, 30);
  console.log('5 OK');

  // 6. импорт таблицей: новое сырьё без потерь получает нормы по названию, с потерями в колонках — как в файле
  await page.click('[data-act="openImport"]'); await page.waitForSelector('#impText');
  await page.fill('#impText', 'Морковь свежая;1,3;0,1;6,9;Таблица\nСвёкла столовая;1,5;0,1;8,8;Таблица;;Справочник;7;1;2;3;4\nСоль;0;0;0;Таблица');
  await page.click('[data-act="doImport"]'); await sleep(500);
  d = await ings();
  assert.strictEqual(byName(d, 'Морковь свежая').loss.cold, 20, 'х/о моркови по справочнику');
  assert.deepStrictEqual(byName(d, 'Свёкла столовая').loss, { cold: 7, boil: 1, fry: 2, stew: 3, bake: 4 }, 'потери из колонок файла важнее справочника');
  assert.strictEqual(byName(d, 'Соль').loss, undefined);
  console.log('6 OK:', JSON.stringify(byName(d, 'Свёкла столовая').loss));

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
  console.log('PWLOSS OK');
  await browser.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); console.log(errs.join('\n')); process.exit(1); });
