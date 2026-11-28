/* этап 2 оформления: калькуляция — вкладка карты (раздела ОП-1 в меню нет), «⋯» в строке меню, обзор: деньги выше КБЖУ */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const SRC = process.argv[2] || 'kbzhu.html';
const D = fs.readFileSync(path.join(__dirname, 'fixtures/steel/demo.json'), 'utf8');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const errs = [];
  const page = await (await browser.newContext({ viewport: { width: 1440, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(D => { localStorage.clear(); localStorage.setItem('kbzhu:v1', D); localStorage.setItem('kbzhu:tab', 'home'); }, D);
  await page.reload(); await page.waitForSelector('.hm');
  const ok = await page.$('[data-rel="ok"]'); if (ok) await ok.click();
  // обзор
  assert.strictEqual(await page.isVisible('#tabOp1'), false, 'отдельного раздела ОП-1 нет');
  let t = await page.innerText('#view');
  for (const s of ['Обзор', 'Выручка', 'Фудкост', 'Маржа', 'Потери на цене', 'Где теряются деньги', 'Блюда, которые забирают маржу', 'Дополнительно: КБЖУ и декларации', 'на расчёт денег не влияет']) assert.ok(t.includes(s), 'на обзоре: ' + s);
  assert.ok(t.indexOf('Где теряются деньги') < t.indexOf('Дополнительно: КБЖУ'), 'КБЖУ ниже денег');
  assert.ok(/Средняя маржа 77,8/.test(t.replace(/\s+/g, ' ')), 'сводка текстом: ' + t.slice(0, 300));
  assert.strictEqual(await page.locator('.hlow tbody tr').count(), 3, 'три блюда с ценой');
  assert.ok(/Солянка/.test(await page.textContent('.hlow tbody tr:first-child')), 'первой — самая низкая маржа');
  // меню: «⋯» → калькуляция
  await page.click('#tabMenu'); await page.waitForSelector('.mrow.mcols');
  await page.click('.mrow[data-rid="r2"] .mmore summary');
  await page.click('.mrow[data-rid="r1"] .mmore summary');
  assert.strictEqual(await page.locator('details.mmore[open]').count(), 1, 'открыт один «⋯»');
  const items = await page.$$eval('.mrow[data-rid="r1"] .mpop .mpi span', a => a.map(x => x.textContent));
  assert.deepStrictEqual(items, ['Калькуляция · 1 порция', 'Карта ТТК', 'КБЖУ и сверка', 'Просмотр', 'Скачать .docx', 'В архив']);
  await page.click('.mrow[data-rid="r1"] [data-act="mCalc"]');
  await page.waitForSelector('#cpCalc:not([hidden]) .ctbl');
  t = (await page.textContent('#cpCalc')).replace(/\s+/g, ' ');
  assert.ok(/Себестоимость порции ?9,33/.test(t), 'себестоимость порции: ' + t.slice(0, 400));
  assert.ok(/Маржа ?84,5/.test(t) && /Структура себестоимости/.test(t) && /Калькуляционная карточка ОП-1/.test(t));
  await page.click('[data-act="calcN"][data-n="100"]');
  t = (await page.textContent('#cpCalc')).replace(/\s+/g, ' ');
  assert.ok(/Себестоимость 100 блюд ?932,92/.test(t), '100 блюд: ' + t.slice(0, 200));
  assert.ok(await page.isVisible('#opTot'), 'реквизиты и итоги ОП-1 на вкладке');
  // вкладки карты
  assert.ok(/ТТК №28 · выход 250 г/.test(await page.innerText('.cmeta')));
  await page.click('[data-act="cardTab"][data-t="kbzhu"]'); await page.waitForSelector('#cpKbzhu:not([hidden]) #resBody');
  await page.click('[data-act="cardTab"][data-t="card"]'); await page.waitForSelector('#cpCard:not([hidden]) #rname');
  // старая ссылка на раздел ОП-1 ведёт во вкладку карты
  await page.evaluate(() => { localStorage.setItem('kbzhu:tab', 'op1'); }); await page.reload(); await page.waitForTimeout(800);
  assert.ok(await page.isVisible('#cpCalc .calcsum'), 'kbzhu:tab=op1 открывает калькуляцию в карте');
  // телефон: нет горизонтальной прокрутки
  await page.setViewportSize({ width: 390, height: 844 });
  for (const tab of ['#tabHome', '#tabMenu']) {
    await page.evaluate(id => document.querySelector(id).click(), tab); await page.waitForTimeout(400);
    const over = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.ok(over <= 1, tab + ': горизонтальная прокрутка ' + over);
  }
  console.log('OK steel2');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
