/* сверка цен при загрузке закупок 1С: лук за 1000 ₽ не загружается без подтверждения; ошибочную закупку можно исключить; на экране подтверждения видны все позиции */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const WH = 'Столовая 1';
const R = (...a) => a;
const rows = [
  R('Параметры:', '', 'Дата С: 01.09.2026'), R('', '', 'Дата по: 30.09.2026'),
  R('Номенклатура', '', '', 'Единица измерения'),
  R('Период', '', '', 'Склад', '', 'Партнер', 'Количество', 'Цена'),
  R('Лук репчатый', '', '', 'кг'),
  R('04.09.2026 7:00:00', '', '', WH, '', 'Овощи ООО', '10', '1000'),
  R('Морковь', '', '', 'кг'),
  R('04.09.2026 7:00:00', '', '', WH, '', 'Овощи ООО', '20', '42'),
  R('11.09.2026 7:00:00', '', '', WH, '', 'Овощи ООО', '20', '44'),
  R('18.09.2026 7:00:00', '', '', WH, '', 'Овощи ООО', '2', '430'),
  R('Свекла', '', '', 'кг'),
  R('04.09.2026 7:00:00', '', '', WH, '', 'Овощи ООО', '10', '35'),
  R('Капуста', '', '', 'кг'),
  R('04.09.2026 7:00:00', '', '', WH, '', 'Овощи ООО', '10', '30'),
];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  const ing = (name, price) => ({ name, p: 1, f: 0, c: 8, kind: 'table', source: 'справочник', price });
  const d = { ings: { i1: ing('Лук репчатый', 40), i2: ing('Морковь', 45), i3: ing('Свекла', 35), i4: ing('Капуста', 28) }, recipes: {}, cfg: {} };
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:whatsnew', '999'); }, d);
  await page.reload();
  await page.waitForFunction(() => window.kbzhuC1);
  await page.evaluate(rows => { kbzhuC1.start(kbzhuC1.parse(rows), 'тест.xlsx'); }, rows);
  await page.waitForSelector('#c1Card');
  const rowSt = async nm => page.evaluate(nm => { const S = kbzhuC1.S; const i = S.c1.parsed.items.findIndex(x => x.name === nm); return kbzhuC1.row(S.c1.items[i]).st; }, nm);
  assert.strictEqual(await rowSt('Лук репчатый'), 'price', 'лук 1000 ₽ при цене в базе 40 ждёт проверки');
  assert.strictEqual(await rowSt('Морковь'), 'price', 'морковь с одной закупкой по 430 ждёт проверки');
  assert.strictEqual(await rowSt('Свекла'), 'ok');
  let t = await page.innerText('#c1Card');
  assert.ok(/Проверьте цену/.test(t) && /выше цены в базе в 25,0 раза/.test(t), 'причина видна: ' + t.slice(t.indexOf('Проверьте цену'), t.indexOf('Проверьте цену')+500));
  assert.ok(/закупки по разной цене/.test(t), 'разброс закупок виден');
  // строка-выброс у моркови отмечена и может быть исключена
  const mi = await page.evaluate(() => kbzhuC1.S.c1.parsed.items.findIndex(x => x.name === 'Морковь'));
  const bad = await page.$$eval('.c1row[data-i="' + mi + '"] .c1l.bad', a => a.length);
  assert.strictEqual(bad, 1, 'выделена одна ошибочная закупка');
  await page.click('.c1row[data-i="' + mi + '"] .c1l.bad input[data-act="c1Drop"]');
  assert.strictEqual(await rowSt('Морковь'), 'ok', 'после исключения закупки цена моркови в норме');
  // лук: подтверждаем цену явно
  const li = await page.evaluate(() => kbzhuC1.S.c1.parsed.items.findIndex(x => x.name === 'Лук репчатый'));
  await page.click('.c1row[data-i="' + li + '"] [data-act="c1PriceOk"]');
  assert.strictEqual(await rowSt('Лук репчатый'), 'ok');
  // правило цены меняет значение → подтверждение снимается только если цена изменилась (здесь одна закупка — не меняется)
  await page.click('[data-act="c1Review"]');
  await page.waitForSelector('#c1Conf');
  t = await page.innerText('#c1Conf');
  for (const n of ['Лук репчатый', 'Морковь', 'Свекла', 'Капуста']) assert.ok(t.includes(n), 'в сверке есть ' + n);
  assert.ok(/без изменений/.test(t), 'позиции без изменений тоже в списке');
  assert.strictEqual(await page.$$eval('#c1Conf .c1cr.big', a => a.length), 1, 'скачок лука выделен');
  await page.click('[data-act="c1Apply"]');
  await page.waitForTimeout(300);
  const pr = await page.evaluate(() => ({ l: kbzhuC1.ppk('i1'), m: kbzhuC1.ppk('i2') }));
  assert.strictEqual(Math.round(pr.l), 1000);
  assert.strictEqual(Math.round(pr.m), 43, 'морковь без исключённой закупки: ' + pr.m);
  console.log('OK c1chk');
  if (errs.length) { console.log(errs); process.exit(1); }
  await browser.close();
})();
