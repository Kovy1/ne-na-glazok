/* Разбор колонок «Ставка НДС» / «Сумма НДС» в отчёте «Поступления» (синтетический файл, не выгрузка 1С) */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext()).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  const R = await page.evaluate(() => {
    const F = window.kbzhuFc;
    const rows = [['Дата', 'Документ', 'Поставщик', 'Номенклатура', 'Ед. изм.', 'Количество', 'Сумма', 'Ставка НДС', 'Сумма НДС'],
      ['02.10.2026', 'Н1', 'ТЕСТ', 'ТЕСТ Мука', 'кг', '10', '1100', '10%', ''],
      ['03.10.2026', 'Н2', 'ТЕСТ', 'ТЕСТ Мука', 'кг', '10', '1200', '', '200'],
      ['04.10.2026', 'Н3', 'ТЕСТ', 'ТЕСТ Мука', 'кг', '10', '1000', 'без НДС', ''],
      ['05.10.2026', 'Н4', 'ТЕСТ', 'ТЕСТ Мука', 'кг', '10', '1000', '', ''],
      ['06.10.2026', 'Н5', 'ТЕСТ', 'ТЕСТ Мука', 'кг', '10', '1000', '120%', '']];
    const d = F.detect('receipts', rows), p = F.parse('receipts', rows, d.hdr, d.map, { obj: 'x', from: '2026-10-01', to: '2026-10-31' });
    return JSON.parse(JSON.stringify({ map: d.map, ops: p.ops.map(o => ({ d: o.d, s: o.s, vr: o.vr, vv: o.vv })), skipped: p.skipped }));
  });
  assert.ok(R.map.vr > -1 && R.map.vv > -1 && R.map.s > -1 && R.map.vr !== R.map.s && R.map.vv !== R.map.s, 'колонки распознаны раздельно: ' + JSON.stringify(R.map));
  assert.strictEqual(R.ops.length, 4, 'ставка 120 % — строка отклонена с причиной');
  assert.strictEqual(R.ops[0].vr, 10); assert.strictEqual(R.ops[1].vv, 200); assert.strictEqual(R.ops[2].vr, 0); assert.strictEqual(R.ops[3].vr, undefined);
  assert.ok(R.skipped.some(x => /Ставка НДС/.test(x.why)), JSON.stringify(R.skipped));
  assert.ok(await page.$('#fcFmtNote'), 'статус «форматы рабочих отчётов не проверены» виден на экране загрузки');
  assert.ok(/не проверены/.test(await page.$eval('#fcFmtNote', e => e.textContent)));
  assert.deepStrictEqual(errs, []);
  await browser.close(); console.log('OK fc8b');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
