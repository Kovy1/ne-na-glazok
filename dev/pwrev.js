/* v26: справочники и ревизии в интерфейсе: юрлицо и точка, ревизия с пропуском/нулём/недостачей/излишком, неизвестная цена,
   сохранение и повторное открытие, завершение, неизменность завершённого отчёта, импорт CSV, XLSX */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm'), fs = require('fs');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
(async () => {
  const gs = await startGas({ rs: { editor: ['main'], finance: ['msk'], viewer: ['main', 'msk'], audit: ['main'] } });
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC), A = 'adm-5678', E = 'ed-1234', V = 'view-3456';
  vm.runInContext('setup()', gs.gas.ctx);
  const seed = { ings: {
    i1: { name: 'Лук репчатый', p: 1.4, f: 0.1, c: 8.2, kind: 'table', source: '', price: 40, priceUnit: 'kg' },
    i2: { name: 'Морковь', p: 1.3, f: 0.1, c: 6.9, kind: 'table', source: '', price: 30, priceUnit: 'kg' },
    i3: { name: 'Яйцо куриное', p: 12.7, f: 11.5, c: 0.7, kind: 'table', source: '', price: 120, priceUnit: 'pack', packG: 600 },
  }, recipes: {}, cfg: {} };
  const mk = async (name, w = 1200) => {
    const ctx = await browser.newContext({ viewport: { width: w, height: 900 }, acceptDownloads: true }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message + ' ' + String(e.stack || '').slice(0, 400)));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(s => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); localStorage.setItem('kbzhu:v1', JSON.stringify(s)); }, seed);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено|не подходит|Не удалось/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const T = await mk('T'); await connect(T, { name: 'Технолог', code: A });

  // 1. справочник: юрлицо и точка
  await T.click('#tabDir'); await T.waitForSelector('#drView');
  await T.click('[data-act="drSub"][data-sub="le"]'); await T.click('[data-act="drNew"]'); await T.waitForSelector('#drEd');
  await T.fill('#drEd [data-k="name"]', 'Ромашка'); await T.fill('#drEd [data-k="org"]', 'ООО «Ромашка»'); await T.fill('#drEd [data-k="headName"]', 'Иванов И.И.');
  await T.fill('#drEd [data-k="inn"]', '123'); await T.click('[data-act="drSave"]');
  await T.waitForFunction(() => /ИНН: 10 цифр/.test(document.querySelector('#drEd')?.textContent || ''));
  await T.fill('#drEd [data-k="inn"]', '3444123456'); await T.fill('#drEd [data-k="kpp"]', '344401001'); await T.click('[data-act="drSave"]');
  await T.waitForFunction(() => !document.querySelector('#drEd') && /Ромашка/.test(document.querySelector('#drTbl')?.textContent || ''));
  await T.click('[data-act="drSub"][data-sub="pt"]'); await T.click('[data-act="drNew"]'); await T.waitForSelector('#drEd');
  await T.fill('#drEd [data-k="name"]', 'Столовая Центр'); await T.fill('#drEd [data-k="address"]', 'пр. Ленина, 1');
  await T.selectOption('#drEd select[data-k="region"]', 'main');
  await T.selectOption('#drEd select[data-k="le"]', { label: 'Ромашка — ООО «Ромашка»' });
  await T.click('[data-act="drSave"]');
  await T.waitForFunction(() => !document.querySelector('#drEd') && /Столовая Центр/.test(document.querySelector('#drTbl')?.textContent || ''));
  console.log('1 OK: юрлицо и точка созданы');

  // 2. новая ревизия: строки из базы и вручную, ввод факта с клавиатуры
  await T.click('#tabRev'); await T.waitForSelector('#revView');
  await T.click('[data-act="revNew"]'); await T.waitForSelector('#revEd');
  assert.ok(await T.isDisabled('[data-act="revFinish"]'), 'завершить нельзя без точки и строк');
  await T.selectOption('#revEd select[data-k="point"]', { label: 'Столовая Центр' });
  const addIng = async (q) => { await T.fill('#rev-add', q); await T.click('#revRes [data-act="revAddIng"]'); };
  await addIng('лук'); await addIng('морк'); await addIng('яйц');
  await T.fill('#rev-add', 'Соль'); await T.click('#revRes [data-act="revAddFree"]');
  await T.fill('#rev-add', 'Укроп'); await T.click('#revRes [data-act="revAddFree"]');
  assert.strictEqual(await T.locator('#revBody tr').count(), 5);
  // яйцо: единица «уп» и цена за упаковку пересчитаны из базы: 120 ₽ за упаковку 600 г = 200 ₽/кг; 600 г = 0,6 кг → 120 ₽/уп
  const eggU = await T.inputValue('#revBody tr:nth-child(3) select'); const eggP = await T.inputValue('#revBody tr:nth-child(3) [data-act="revP"]');
  assert.strictEqual(eggU, 'уп'); assert.strictEqual(eggP, '120');
  const setRow = async (i, b, f, p) => {
    const tr = '#revBody tr:nth-child(' + i + ')';
    await T.fill(tr + ' [data-act="revB"]', b); if (f !== null) await T.fill(tr + ' [data-act="revF"]', f); if (p !== null) await T.fill(tr + ' [data-act="revP"]', p);
  };
  await setRow(1, '10', '8', null);         // лук: недостача 2 × 40 = 80
  await setRow(2, '5', '7,5', null);        // морковь: излишек 2,5 × 30 = 75
  await setRow(3, '10', '10', null);        // яйцо: совпало
  await setRow(4, '3', '0', '20');          // соль: факт ноль — недостача 60
  await setRow(5, '1', null, null);         // укроп: факт не введён, цена неизвестна
  // пока есть непосчитанная — завершить нельзя, причина названа
  assert.ok(await T.isDisabled('[data-act="revFinish"]'));
  assert.ok(/не введён факт \(ноль, если сырья нет\): №5 «Укроп»/.test(await T.textContent('#revWhy')), await T.textContent('#revWhy'));
  let tot = (await T.textContent('#revTot')).replace(/\s+/g, ' ');
  assert.ok(/4 из 5 посчитано/.test(tot) && /не посчитано: 1/.test(tot), tot);
  assert.ok(/Недостача: 2 поз\. на -?−?140,00/.test(tot.replace('−', '-')) || /Недостача: 2 поз\. на (−|-)140,00/.test(tot), tot);
  assert.ok(/Излишек: 1 поз\. на \+75,00/.test(tot), tot);
  // пустой факт — не ноль: строка показана как «Не посчитано»
  assert.ok(/Не посчитано/.test(await T.textContent('#revBody tr:nth-child(5)')));
  // Enter в поле факта переходит к следующей строке
  await T.focus('#revBody tr:nth-child(1) .factin'); await T.keyboard.press('Enter');
  assert.strictEqual(await T.evaluate(() => document.activeElement.closest('tr').getAttribute('data-i')), '1', 'Enter → следующая строка');
  console.log('2 OK: ввод, итоги, клавиатура');

  // 3. автосохранение черновика, перезагрузка, повторное открытие
  await T.waitForFunction(() => /Черновик сохранён/.test(document.querySelector('#revSave')?.textContent || ''), null, { timeout: 15000 });
  const numTxt = await T.textContent('#revEd h2'); assert.ok(/MAIN-\d{4}-001/.test(numTxt), numTxt);
  await T.reload(); await T.waitForSelector('#view > *'); await T.click('#tabRev'); await T.waitForSelector('#revList');
  assert.ok(/Черновик/.test(await T.textContent('#revList')));
  await T.click('#revList [data-act="revOpen"]'); await T.waitForSelector('#revBody');
  assert.strictEqual(await T.locator('#revBody tr').count(), 5);
  assert.strictEqual(await T.inputValue('#revBody tr:nth-child(4) [data-act="revF"]'), '0', 'ноль сохранён как ноль');
  assert.strictEqual(await T.inputValue('#revBody tr:nth-child(5) [data-act="revF"]'), '', 'пустой факт остался пустым');
  assert.strictEqual(await T.inputValue('#revBody tr:nth-child(5) [data-act="revP"]'), '', 'неизвестная цена осталась неизвестной');
  console.log('3 OK: черновик сохранён и открыт заново');

  // 4. завершение
  await T.fill('#revBody tr:nth-child(5) [data-act="revF"]', '1,5'); await T.fill('#revBody tr:nth-child(5) [data-act="revP"]', '100');
  await T.waitForFunction(() => !document.querySelector('[data-act="revFinish"]').disabled);
  await T.click('[data-act="revFinish"]'); await T.waitForSelector('[data-act="revFinishYes"]'); await T.click('[data-act="revFinishYes"]');
  await T.waitForFunction(() => /Завершена/.test(document.querySelector('#revEd .tstat')?.textContent || '') && document.querySelector('.rvmeta'), null, { timeout: 15000 });
  const meta = (await T.textContent('.rvmeta')).replace(/\s+/g, ' ');
  assert.ok(/Ромашка/.test(meta) && /3444123456/.test(meta) && /Столовая Центр/.test(meta) && /Волгоград/.test(meta), meta);
  assert.strictEqual(await T.locator('#revBody input').count(), 0, 'завершённая ревизия не редактируется');
  const totDone = (await T.textContent('#revTot')).replace(/\s+/g, ' ');
  console.log('4 OK: завершена;', totDone.slice(0, 160));

  // 5. XLSX
  await T.evaluate(() => { window.__dn = []; const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { window.__dn.push(this.download); return o.apply(this, arguments); }; });
  const [dl] = await Promise.all([T.waitForEvent('download'), T.click('[data-act="revXlsx"]')]);
  const dn = await T.evaluate(() => window.__dn[0]); assert.ok(/^Ревизия MAIN-\d{4}-001 Столовая Центр.*\.xlsx$/.test(dn), 'имя файла: ' + dn);
  const xp = path.join(__dirname, 'out', 'rev_test.xlsx'); fs.mkdirSync(path.dirname(xp), { recursive: true }); await dl.saveAs(xp);
  console.log('имя:', JSON.stringify(dl.suggestedFilename()));
  console.log('5 OK: XLSX', dl.suggestedFilename(), fs.statSync(xp).size, 'байт');

  // 6. справочник и цены меняются — завершённый отчёт прежний
  await T.click('[data-act="revBack"]'); await T.click('#tabDir'); await T.waitForSelector('#drView');
  await T.click('[data-act="drSub"][data-sub="le"]'); await T.click('#drTbl [data-act="drEdit"]'); await T.waitForSelector('#drEd');
  await T.fill('#drEd [data-k="org"]', 'ООО «Новое имя»'); await T.fill('#drEd [data-k="headName"]', 'Другой Д.Д.'); await T.click('[data-act="drSave"]');
  await T.waitForFunction(() => !document.querySelector('#drEd'));
  await T.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); d.ings.i1.price = 999; localStorage.setItem('kbzhu:v1', JSON.stringify(d)); });
  await T.click('#tabRev'); await T.waitForSelector('#revList'); await T.click('#revList [data-act="revOpen"]'); await T.waitForSelector('.rvmeta');
  const meta2 = (await T.textContent('.rvmeta')).replace(/\s+/g, ' ');
  assert.ok(/ООО «Ромашка»/.test(meta2) && !/Новое имя/.test(meta2) , 'реквизиты в отчёте прежние: ' + meta2);
  assert.strictEqual((await T.textContent('#revBody tr:nth-child(1) td:nth-child(6)')).trim(), '40', 'учётная цена в завершённой ревизии не изменилась');
  assert.strictEqual((await T.textContent('#revTot')).replace(/\s+/g, ' '), totDone, 'итоги прежние');
  console.log('6 OK: завершённая ревизия не изменилась');


  // 8. пустой учётный остаток не равен нулю; одно правило округления на экране, в XLSX и в печати
  await T.click('[data-act="revBack"]'); await T.waitForSelector('#revList');
  await T.click('[data-act="revNew"]'); await T.waitForSelector('#revEd');
  await T.selectOption('#revEd select[data-k="point"]', { label: 'Столовая Центр' });
  await T.fill('#revEd [data-k="resp"]', 'Сидоров С.С.');
  const addFree = async (n) => { await T.fill('#rev-add', n); await T.click('#revRes [data-act="revAddFree"]'); };
  await addFree('Сахар');
  const rowSet = async (i, b, f, p) => { const tr = '#revBody tr:nth-child(' + i + ')'; if (b !== null) await T.fill(tr + ' [data-act="revB"]', b); await T.fill(tr + ' [data-act="revF"]', f); await T.fill(tr + ' [data-act="revP"]', p); };
  await rowSet(1, null, '5', '100');
  const sugar = (await T.textContent('#revBody tr:nth-child(1)')).replace(/\s+/g, ' ');
  assert.ok(/Нет остатка/.test(sugar), sugar);
  assert.strictEqual((await T.textContent('#revBody tr:nth-child(1) .rs')).trim(), '—', 'сумма не определена');
  assert.strictEqual((await T.textContent('#revBody tr:nth-child(1) .rd')).trim(), '—', 'разница не определена');
  let t8 = (await T.textContent('#revTot')).replace(/\s+/g, ' ');
  assert.ok(!/500/.test(t8) && /Излишек: 0 поз\./.test(t8) && /Без остатка: 1/.test(t8), t8);
  assert.ok(await T.isDisabled('[data-act="revFinish"]'));
  assert.ok(/не указан учётный остаток \(ноль, если на учёте пусто\): №1 «Сахар»/.test(await T.textContent('#revWhy')), await T.textContent('#revWhy'));
  await T.fill('#revBody tr:nth-child(1) [data-act="revB"]', '0');
  t8 = (await T.textContent('#revTot')).replace(/\s+/g, ' ');
  assert.ok(/Излишек: 1 поз\. на \+500,00/.test(t8), 'явный ноль допустим: ' + t8);
  // три строки по 0,333 × 1: каждая 0,33, итог 0,99
  await T.click('#revBody tr:nth-child(1) [data-act="revDelLine"]');
  for (const n of ['Альфа', 'Бета', 'Гамма']) await addFree(n);
  for (let i = 1; i <= 3; i++) await rowSet(i, '0', '0,333', '1');
  t8 = (await T.textContent('#revTot')).replace(/\s+/g, ' ');
  assert.ok(/Излишек: 3 поз\. на \+0,99/.test(t8) && /Итого: \+0,99/.test(t8), t8);
  assert.strictEqual((await T.textContent('#revBody tr:nth-child(2) .rs')).trim(), '+0,33');
  await T.click('[data-act="revFinish"]'); await T.waitForSelector('[data-act="revFinishYes"]'); await T.click('[data-act="revFinishYes"]');
  await T.waitForFunction(() => /Завершена/.test(document.querySelector('#revEd .tstat')?.textContent || '') && document.querySelector('.rvmeta'), null, { timeout: 15000 });
  assert.ok(/Итого: \+0,99/.test((await T.textContent('#revTot')).replace(/\s+/g, ' ')), 'после завершения те же итоги');
  const [dl2] = await Promise.all([T.waitForEvent('download'), T.click('[data-act="revXlsx"]')]);
  const xp2 = path.join(__dirname, 'out', 'rev_test2.xlsx'); await dl2.saveAs(xp2);
  const xml = require('child_process').execFileSync('python3', ['-c', 'import zipfile,sys;z=zipfile.ZipFile(sys.argv[1]);print("".join(z.read(n).decode("utf8") for n in z.namelist() if n.startswith("xl/worksheets/") or n.endswith("sharedStrings.xml")))', xp2]).toString();
  assert.ok(/>0\.99</.test(xml) && !/>1\.00?</.test(xml.replace(/<c [^>]*t="s"[^>]*>/g, '')), 'в XLSX итог 0,99');
  assert.ok((xml.match(/>0\.33</g) || []).length >= 3, 'в XLSX суммы строк 0,33');
  await T.click('[data-act="revPrint"]');
  const pr = (await T.evaluate(() => document.getElementById('rvPrintRoot') ? document.getElementById('rvPrintRoot').textContent : '')).replace(/\s+/g, ' ');
  assert.ok(/Излишек/.test(pr) && /\+0,99/.test(pr) && /Сидоров С\.С\./.test(pr) && /Новое имя/.test(pr) && /пр\. Ленина, 1/.test(pr) && /Волгоград/.test(pr), pr.slice(0, 600));
  console.log('8 OK: пустой остаток ≠ 0; 3×0,333 = 0,99 на экране, в XLSX и в печати');

  // 7. другой регион и другие права
  const M = await mk('M'); await connect(M, { name: 'Кто-то', code: V });          // шеф-повар: только чтение
  await M.click('#tabRev'); await M.waitForSelector('#revList');
  assert.strictEqual(await M.locator('[data-act="revNew"]').count(), 0, 'у шеф-повара нет кнопки новой ревизии');
  assert.ok(/MAIN-\d{4}-001/.test(await M.textContent('#revList')), 'читать может');
  const Ed = await mk('Ed'); await connect(Ed, { name: 'Иван', code: E });
  await Ed.click('#tabDir'); await Ed.waitForSelector('#drView');
  assert.strictEqual(await Ed.locator('[data-act="drSub"][data-sub="le"]').count(), 1);
  await Ed.click('[data-act="drSub"][data-sub="le"]');
  assert.strictEqual(await Ed.locator('[data-act="drNew"]').count(), 0, 'юрлица добавляет только технолог');
  console.log('7 OK: права');

  await browser.close(); gs.close();
  if (errs.length) { console.log(errs.join('\n')); process.exit(1); }
  console.log('OK');
})().catch(e => { console.error(e); process.exit(1); });
