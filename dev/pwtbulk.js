/* массовое обновление разделов ТТК региона: предпросмотр, применение, исключение, поиск/замена, добавление пунктов, отмена */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rec = (name, num, ttk, extra = {}) => Object.assign({ name: name + ' (ТТК №' + num + ')', output: 100, rows: [{ rid: 'a', ing: 'i1', net: 100, share: 100 }], ref, ttk: Object.assign({ num: String(num) }, ttk) }, extra);
const data = () => ({
  ings: { i1: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 } },
  recipes: {
    r1: rec('Пюре', 1, { s54: 'старое хранение', t42: 'Сварить.\nПротереть.' }),
    r2: rec('Суп', 2, { t42: 'Сварить бульон.' }),
    r3: rec('Котлета', 3, { t42: 'Обжарить.\nЗапечь.' }),
    r4: rec('Архивное', 4, { t42: 'Запечь.' }, { arch: true }),
  }, cfg: {},
});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } }); const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html'));
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'menu'); }, data());
  await page.reload(); await page.waitForSelector('.mrow[data-rid]');
  const stored = async () => { await sleep(1200); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes); };
  const prev = () => page.textContent('#tbPrev').then(t => t.replace(/\s+/g, ' ').trim());
  const go = async label => { await page.click('#tbPrev [data-act="tbGo"]'); await page.click('#tbPrev [data-act="tbGo"]'); await sleep(300); };
  await page.evaluate(() => { document.getElementById('mExtra').open = true; });
  await page.click('#tbBox > summary'); await page.waitForSelector('#tbBox textarea');

  // 1. замена хранения целиком во всех ТТК региона (архив не трогаем)
  await page.selectOption('#tbBox select[data-k="k"]', 's54');
  assert.ok(/Введите текст/.test(await prev()));
  await page.fill('#tbBox textarea', 'Хранить при +2…+6 °С не более 36 часов.');
  assert.ok(/Изменится: 3 из 3/.test(await prev()), await prev());
  await go();
  let s = await stored();
  for (const k of ['r1', 'r2', 'r3']) assert.strictEqual(s[k].ttk.s54, 'Хранить при +2…+6 °С не более 36 часов.', k);
  assert.ok(!('s54' in s.r4.ttk), 'архив не тронут');
  console.log('1 OK: замена целиком, архив не тронут');

  // 2. отмена: прежнее значение вернулось, а там где было «по умолчанию» — снова по умолчанию
  await page.click('#tbPrev [data-act="tbUndo"]'); await page.click('#tbPrev [data-act="tbUndo"]'); await sleep(300);
  s = await stored();
  assert.strictEqual(s.r1.ttk.s54, 'старое хранение'); assert.ok(!('s54' in s.r2.ttk) && !('s54' in s.r3.ttk), 'своё значение убрано');
  console.log('2 OK: отмена');

  // 3. исключение отдельной ТТК
  await page.fill('#tbBox textarea', 'Новое хранение.');
  await page.evaluate(() => { const c = document.querySelector('#tbPrev input[data-id="r2"]'); c.checked = false; c.dispatchEvent(new Event('change', { bubbles: true })); });
  assert.ok(/Изменится: 2 из 3/.test(await prev()) && /снято вручную: 1/.test(await prev()), await prev());
  await go(); s = await stored();
  assert.strictEqual(s.r1.ttk.s54, 'Новое хранение.'); assert.ok(!('s54' in s.r2.ttk), 'снятая не изменена');
  console.log('3 OK: исключение');

  // 4. технология: заменить фрагмент
  await page.selectOption('#tbBox select[data-k="k"]', 't42'); await page.selectOption('#tbBox select[data-k="mode"]', 'find');
  await page.fill('#tbBox input[data-k="find"]', 'Запечь'); await page.fill('#tbBox input[data-k="repl"]', 'Запечь 20 минут при 180 °С');
  assert.ok(/Изменится: 1 из 3/.test(await prev()) && /фрагмент не найден/.test(await prev()), await prev());
  await go(); s = await stored();
  assert.strictEqual(s.r3.ttk.t42, 'Обжарить.\nЗапечь 20 минут при 180 °С.');
  console.log('4 OK: замена фрагмента');

  // 5. технология: добавить новые пункты; повтор не дублирует
  await page.selectOption('#tbBox select[data-k="mode"]', 'add');
  await page.fill('#tbBox textarea', 'Охладить в шоковой заморозке.\nУпаковать и промаркировать.');
  assert.ok(/Изменится: 3 из 3/.test(await prev()), await prev());
  await go(); s = await stored();
  for (const k of ['r1', 'r2', 'r3']) assert.ok(/Охладить в шоковой заморозке\.\nУпаковать и промаркировать\.$/.test(s[k].ttk.t42), k + ': ' + s[k].ttk.t42);
  assert.ok(s.r1.ttk.t42.startsWith('Сварить.\nПротереть.\n'), 'прежние пункты на месте');
  assert.ok(/Изменится: 0 из 3/.test(await prev()) && /уже так/.test(await prev()), 'повтор не дублирует: ' + await prev());
  console.log('5 OK: добавление пунктов без дублей');

  // 6. включая архив
  await page.click('#tbBox input[data-k="arch"]');
  assert.ok(/Изменится: 1 из 4/.test(await prev()), await prev());
  console.log('6 OK: архив по галочке');

  await page.screenshot({ path: 'out/shot_tbulk.png' });
  assert.deepStrictEqual(errs, [], errs.join('; '));
  console.log('PWTBULK OK'); await browser.close();
})().catch(e => { console.error('FAIL', e); process.exit(1); });
