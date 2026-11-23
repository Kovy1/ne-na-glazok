/* Чтение .xls: настоящий Excel 97–2003 (большой файл с CONTINUE, маленький в мини-потоке, формулы), HTML и XML 2003 под именем .xls,
   переименованный .xlsx; загрузка поступлений .xls в «Фудкост» через интерфейс. Файлы — синтетические, fixtures/xls. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html'), FX = path.resolve('fixtures/xls');
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + SRC);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  const fails = []; const T = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '—', String(e.message).split('\n')[0].slice(0, 300)); } };
  const rows = f => page.evaluate(b64 => { const u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); try { return window.kbzhuXls.rows(u.buffer); } catch (e) { return { err: e.message }; } }, fs.readFileSync(path.join(FX, f)).toString('base64'));
  const big = await rows('big_biff8.xls');
  await T('Excel 97–2003: 1504 строки, первый лист, кириллица и «ё»', () => { assert.strictEqual(big.length, 1504); assert.deepStrictEqual(big[0], ['Дата', 'Номенклатура', 'Ед.', 'Количество', 'Сумма', 'Итог']); assert.strictEqual(big[2][1], 'Лук репчатый «Ялтинский» ё'); });
  await T('даты по формату ячейки → дд.мм.гггг', () => { assert.strictEqual(big[1][0], '05.10.2026'); assert.strictEqual(big[1503][0], '01.11.2026'); });
  await T('числа: дробные, отрицательные, мелкие', () => { assert.deepStrictEqual(big[1].slice(3, 5), ['12.5', '562.5']); assert.deepStrictEqual(big[3].slice(3, 5), ['-2', '0.01']); });
  await T('формулы: берётся сохранённый результат (число, логическое)', () => { assert.strictEqual(big[1][5], '7031.25'); assert.strictEqual(big[2][5], 'ИСТИНА'); });
  await T('длинный список строк с продолжениями (CONTINUE) не ломается', () => assert.strictEqual(big[1503][1], 'Позиция длинная номер 1499 — проверка разбиения строк ЁЖЗ'));
  await T('второй лист не попадает', () => assert.ok(!JSON.stringify(big).includes('не этот лист')));
  const sm = await rows('small_ministream.xls');
  await T('маленький файл (мини-поток), текст формулы без результата остаётся текстом', () => { assert.deepStrictEqual(sm[0], ['Название', 'Кол', 'Цена', 'Итог', 'Текст']); assert.strictEqual(sm[1][2], '3.5'); });
  const ht = await rows('html1251.xls');
  await T('HTML-таблица под именем .xls в кодировке 1251 (как сохраняет 1С)', () => { assert.deepStrictEqual(ht[1], ['Номенклатура', 'Ед.', 'Количество', 'Сумма']); assert.deepStrictEqual(ht[2], ['Морковь свежая', 'кг', '12,5', '562,50']); assert.deepStrictEqual(ht[0], ['Поступление товаров за период', '']); });
  const xm = await rows('xml2003.xls');
  await T('XML 2003 под именем .xls: пропуски колонок и даты', () => { assert.deepStrictEqual(xm[0], ['Дата', 'Номенклатура', '', 'Количество']); assert.deepStrictEqual(xm[1], ['05.10.2026', 'Морковь', '', '12.5']); });
  const rn = await rows('renamed_xlsx.xls');
  await T('переименованный .xlsx: понятное сообщение', () => assert.ok(/переименуйте его в \.xlsx/.test(rn.err || ''), JSON.stringify(rn)));
  // загрузка поступлений .xls через интерфейс фудкоста
  await page.selectOption('#fcObj', '__new__'); await page.fill('#fcNewObj', 'ТЕСТ Объект'); await page.dispatchEvent('#fcNewObj', 'change');
  await page.fill('input[data-act="fcFrom"]', '2026-10-01'); await page.dispatchEvent('input[data-act="fcFrom"]', 'change');
  await page.fill('input[data-act="fcTo"]', '2026-10-31'); await page.dispatchEvent('input[data-act="fcTo"]', 'change');
  const acc = await page.getAttribute('#fcFile', 'accept');
  await T('окно выбора файла показывает .xls', () => assert.ok(/\.xls,/.test(acc), acc));
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('[data-act="fcPick"][data-t="receipts"]')]);
  await fc.setFiles(path.join(FX, 'receipts.xls'));
  await page.waitForSelector('#fcImp', { timeout: 10000 });
  const imp = (await page.textContent('#fcImp')).replace(/\s+/g, ' ');
  await T('«Фудкост» → Поступления: файл .xls открылся, 2 строки распознаны', () => { assert.ok(/receipts\.xls/.test(imp), imp.slice(0, 200)); assert.ok(/ТЕСТ Морковь/.test(imp) && /ТЕСТ Лук/.test(imp), imp.slice(0, 400)); });
  await T('нет ошибок страницы', () => assert.deepStrictEqual(errs, []));
  await browser.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
})();
