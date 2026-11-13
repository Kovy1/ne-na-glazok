/* экран «Готовность карт»: нет выхода / нет закупочных цен / КБЖУ не заполнено / готово к проверке; масса из названия — по подтверждению */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const rows = (...ings) => ings.map((i, k) => ({ rid: 'x' + k + Math.random().toString(36).slice(2, 5), ing: i, net: 100, share: 100 }));
const rec = (name, output, ...ings) => ({ name, output, rows: rows(...ings), ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } });
const data = () => ({
  ings: {
    i1: { name: 'Говядина тест', p: 18, f: 12, c: 0, kind: 'table', source: 'справочник', price: 500 },
    i2: { name: 'Мука не внесена', p: 0, f: 0, c: 0, kind: 'estimate', source: 'Добавлено из ТТК', price: 40 },
    i3: { name: 'Огурец без цены', p: 1, f: 0, c: 3, kind: 'table', source: 'справочник' },
    i4: { name: 'Перец без цены', p: 1, f: 0, c: 5, kind: 'table', source: 'справочник' }
  },
  recipes: {
    r1: rec('Булгур с овощами 250 гр', 0, 'i1'), r2: rec('Куриный шницель 120 г', 0, 'i1'), r3: rec('Борщ 250/30 г', 0, 'i1'),
    r4: rec('Пюре 1/150гр', 0, 'i1'), r5: rec('Суп без массы', 0, 'i1'),
    r6: rec('Готовое блюдо', 200, 'i1'), r7: rec('Блюдо без цен', 100, 'i1', 'i3', 'i4'), r8: rec('Блюдо с мукой', 100, 'i1', 'i2'),
    r9: { name: 'Блюдо пустое', output: 100, rows: [], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } }
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
  const stored = rid => page.evaluate(r => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes[r].output, rid);
  const storedIs = async (rid, v) => { await page.waitForFunction(([r, v]) => JSON.parse(localStorage.getItem('kbzhu:v1')).recipes[r].output === v, [rid, v], { timeout: 8000 }); };
  const ids = () => page.$$eval('#rdBody .rdrow', e => e.map(x => x.getAttribute('data-rid')));
  const chip = k => txt('#rdBody [data-f="' + k + '"]');

  // 1. ссылка на стартовом экране и сам экран
  const link = await txt('#ttkReadyLink'); console.log('1:', link); assert.ok(/Готовность карт · не готовы: 8/.test(link), link);
  await page.click('#ttkReadyLink'); await page.waitForSelector('#rdScr');
  const lead = await txt('.rdlead'); assert.ok(/Готовы к проверке: 1 из 9/.test(lead), lead);
  assert.deepStrictEqual([await chip(''), await chip('out'), await chip('price'), await chip('kbzhu'), await chip('err'), await chip('ready')],
    ['Все · 9', 'Нет выхода · 5', 'Нет закупочных цен · 1', 'КБЖУ не заполнено · 1', 'Состав с ошибками · 1', 'Готово к проверке · 1']);
  // 2. нет выхода: предложения из названия
  await page.click('[data-f="out"]');
  assert.deepStrictEqual((await ids()).sort(), ['r1', 'r2', 'r3', 'r4', 'r5']);
  const btn = async rid => (await txt('.rdrow[data-rid="' + rid + '"] [data-act="rdAcc"]'));
  assert.strictEqual(await btn('r1'), 'Принять 250 г'); assert.strictEqual(await btn('r2'), 'Принять 120 г');
  assert.strictEqual(await btn('r3'), 'Принять 280 г'); assert.ok(/250 \+ 30/.test(await txt('.rdrow[data-rid="r3"]')), 'части суммы показаны');
  assert.strictEqual(await btn('r4'), 'Принять 150 г'); assert.strictEqual(await btn('r5'), '', 'без массы в названии предложения нет');
  assert.ok(/выход не указан/.test(await txt('.rdrow[data-rid="r1"] small')));
  // 3. принять одно
  await page.click('.rdrow[data-rid="r1"] [data-act="rdAcc"]');
  await page.waitForFunction(() => !document.querySelector('.rdrow[data-rid="r1"]'));
  await storedIs('r1', 250); assert.strictEqual(await chip('out'), 'Нет выхода · 4');
  // 4. принять все: сначала подтверждение, отмена ничего не меняет
  await page.click('[data-act="rdAccAll"]'); await page.waitForSelector('[data-act="rdAccGo"]');
  assert.ok(/у 3 карт/.test(await txt('.rdbar')) || /Записать выход у 3/.test(await txt('.rdbar')), await txt('.rdbar'));
  await page.click('[data-act="rdAccNo"]'); await page.waitForSelector('[data-act="rdAccAll"]');
  assert.strictEqual(await stored('r2'), 0, 'после отмены выход не записан');
  await page.click('[data-act="rdAccAll"]'); await page.click('[data-act="rdAccGo"]');
  await page.waitForFunction(() => /Выход записан у 3 карт/.test(document.querySelector('#toast').textContent));
  await storedIs('r2', 120); await storedIs('r3', 280); await storedIs('r4', 150); assert.strictEqual(await stored('r5'), 0);
  assert.deepStrictEqual(await ids(), ['r5']); assert.strictEqual(await page.$('[data-act="rdAccAll"]'), null, 'предложений больше нет');
  // 5. вручную
  await page.fill('.rdrow[data-rid="r5"] input[data-act="rdOut"]', '300'); await page.press('.rdrow[data-rid="r5"] input[data-act="rdOut"]', 'Enter');
  await page.waitForFunction(() => !document.querySelector('.rdrow[data-rid="r5"]'));
  await storedIs('r5', 300);
  // 6. готовность: цены, КБЖУ, ошибки
  assert.strictEqual(await chip('ready'), 'Готово к проверке · 6', await chip('ready'));
  await page.click('[data-f="price"]'); assert.deepStrictEqual(await ids(), ['r7']);
  const pr = await txt('.rdrow[data-rid="r7"]'); assert.ok(/Нет закупочных цен: 2/.test(pr) && /Огурец без цены/.test(pr) && /Перец без цены/.test(pr), pr);
  await page.click('[data-f="kbzhu"]'); assert.deepStrictEqual(await ids(), ['r8']);
  assert.ok(/КБЖУ не заполнено: 1/.test(await txt('.rdrow[data-rid="r8"]')) && /Мука не внесена/.test(await txt('.rdrow[data-rid="r8"]')));
  await page.click('[data-f="err"]'); assert.deepStrictEqual(await ids(), ['r9']); assert.ok(/в составе нет сырья/.test(await txt('.rdrow[data-rid="r9"]')));
  await page.click('[data-f="ready"]'); assert.deepStrictEqual((await ids()).sort(), ['r1', 'r2', 'r3', 'r4', 'r5', 'r6']);
  assert.ok((await page.$$eval('#rdBody .rdrow', e => e.every(x => /Готово к проверке/.test(x.textContent)))));
  // 7. поиск
  await page.click('[data-f=""]'); await page.fill('input[data-act="rdQ"]', 'шниц'); await page.waitForFunction(() => document.querySelectorAll('#rdBody .rdrow').length === 1);
  assert.deepStrictEqual(await ids(), ['r2']); assert.ok(await page.$('input[data-act="rdQ"]:focus'), 'фокус остался в поиске');
  await page.fill('input[data-act="rdQ"]', '');
  // 8. открыть карту
  await page.click('.rdrow[data-rid="r8"] [data-act="rdOpen"]'); await page.waitForSelector('.ttkcols');
  assert.strictEqual(await page.evaluate(() => localStorage.getItem('kbzhu:active')), 'r8');
  // 9. назад к ТТК и счётчик на ссылке
  await page.click('#ttkBack'); await page.waitForSelector('#ttkHome');
  const link2 = await txt('#ttkReadyLink'); assert.ok(/не готовы: 3/.test(link2), link2);
  assert.deepStrictEqual(errs, [], errs.join('\n'));
  await browser.close(); console.log('PWREADY OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
