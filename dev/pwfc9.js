/* Фудкост: независимая проверка 5f91b83 — четыре замечания. ЯВНО ТЕСТОВЫЕ данные «ТЕСТ …»; значения посчитаны вручную */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1100 } })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  const R = await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, O = 'oTEST9', FROM = '2026-10-01', TO = '2026-10-31', strip = r => JSON.parse(JSON.stringify(r));
    S.ings.tMeat = { id: 'tMeat', name: 'ТЕСТ Мясо', price: 400 };
    S.ings.tCarr = { id: 'tCarr', name: 'ТЕСТ Морковь', price: 40 };
    S.ings.tOil = { id: 'tOil', name: 'ТЕСТ Масло', price: 100 };
    S.ings.tMilk = { id: 'tMilk', name: 'ТЕСТ Молоко', price: 60 };
    S.recipes.tRagu = { name: 'ТЕСТ Рагу', output: 250, rows: [{ rid: 'a', ing: 'tMeat', net: 100, gross: 120, share: 100 }, { rid: 'b', ing: 'tCarr', net: 70, gross: 80, share: 100 }, { rid: 'c', ing: 'tOil', net: 10, gross: 10, share: 100 }], ref: {}, ttk: {}, op: {} };
    S.recipes.tSoup = { name: 'ТЕСТ Суп', output: 300, rows: [{ rid: 'a', ing: 'tMilk', net: 200, gross: 200, share: 100 }], ref: {}, ttk: {}, op: {} };
    const ops = t => S.fc.ops[t] = S.fc.ops[t] || {};
    let n = 0; const add = (t, o) => { o.obj = O; o.id = 'y' + (++n); o.b = o.b || 'b' + t; ops(t)[o.id] = o; };
    S.fc.batches.bmoves = { id: 'bmoves', type: 'moves', obj: O, objName: 'ТЕСТ', from: FROM, to: TO, file: 'ТЕСТ', map: { open: 3, tin: 4, tout: 5, ret: 6, close: 7 } };
    add('receipts', { d: '2026-10-05', doc: 'T1', sup: 'ТЕСТ А', nm: 'ТЕСТ Мясо', u: 'кг', q: 20, s: 8400 });
    add('receipts', { d: '2026-10-12', doc: 'Перемещение товаров 5', sup: 'ТЕСТ склад', nm: 'ТЕСТ Мясо', u: 'кг', q: 3, s: 0 });
    add('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 5, 'in': 20, ret: 1, tin: 3, tout: 1, close: 8, b: 'bmoves' });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 5, fact: 5 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 8, fact: 7 });
    // морковь: ревизии и поступления есть, движения по ней нет
    add('receipts', { d: '2026-10-06', doc: 'T2', sup: 'ТЕСТ Б', nm: 'ТЕСТ Морковь', u: 'кг', q: 10, s: 450 });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Морковь', u: 'кг', book: 2, fact: 2 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Морковь', u: 'кг', book: 3, fact: 3 });
    // масло: 10 кг с суммой 450 (45 ₽/кг) и 10 кг без суммы; ещё строка с суммой без количества
    add('receipts', { d: '2026-10-07', doc: 'T3', sup: 'ТЕСТ А', nm: 'ТЕСТ Масло', u: 'кг', q: 10, s: 450 });
    add('receipts', { d: '2026-10-08', doc: 'T4', sup: 'ТЕСТ Б', nm: 'ТЕСТ Масло', u: 'кг', q: 10 });
    add('receipts', { d: '2026-10-09', doc: 'T5', sup: 'ТЕСТ Б', nm: 'ТЕСТ Масло', u: 'кг', s: 999 });
    // молоко в литрах без плотности
    add('receipts', { d: '2026-10-10', doc: 'T6', sup: 'ТЕСТ А', nm: 'ТЕСТ Молоко', u: 'л', q: 10, s: 600 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Рагу', q: 100, s: 30000 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Суп', q: 10, s: 3000 });
    const out = {};
    out.a = strip(F.calc(O, FROM, TO));
    out.aRet = strip(F.calc(O, FROM, TO, Object.assign({}, F.cfgDef, { retOut: false })));
    S.fc.batches.bmoves.map = { open: 3, close: 7 };
    out.aNoCols = strip(F.calc(O, FROM, TO));
    out.aNoColsOk = strip(F.calc(O, FROM, TO, Object.assign({}, F.cfgDef, { noTrans: true })));
    S.fc.batches.bmoves.map = { open: 3, tin: 4, tout: 5, ret: 6, close: 7 };
    S.fc.batches.bmoves.to = '2026-10-15';
    out.aCover = strip(F.calc(O, FROM, TO));
    S.fc.batches.bmoves.to = TO;
    // плотность / допущение
    S.ings.tMilk.densAsm = 1; out.cAsm = strip(F.calc(O, FROM, TO));
    delete S.ings.tMilk.densAsm; S.ings.tMilk.dens = 1.03; out.cDens = strip(F.calc(O, FROM, TO));
    // кеш названий блюд
    out.d = {};
    out.d.before = F.match('r', 'ТЕСТ Рагу', '').how;
    S.recipes.tRagu.name = 'ТЕСТ Новое рагу';
    out.d.oldAfter = F.match('r', 'ТЕСТ Рагу', '').how; out.d.newAfter = F.match('r', 'ТЕСТ Новое рагу', '');
    S.recipes.tRagu.aliases = ['ТЕСТ Рагу']; out.d.aliasAfter = F.match('r', 'ТЕСТ Рагу', '').how;
    delete S.recipes.tSoup; S.recipes.tSoup2 = { name: 'ТЕСТ Суп', output: 300, rows: [], ref: {}, ttk: {}, op: {} };
    try { out.d.swap = F.match('r', 'ТЕСТ Суп', '').id; } catch (e) { out.d.swap = 'исключение: ' + e.message; }
    return out;
  });
  const near = (x, y, m) => assert.ok(x !== null && x !== undefined && Math.abs(x - y) < 1e-6, m + ': ' + x + ' ≠ ' + y);
  const fails = []; const T = (name, fn) => { try { fn(); console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '—', e.message.split('\n')[0]); } };
  const M = R.a.ings.tMeat, C = R.a.ings.tCarr, Oi = R.a.ings.tOil;
  /* 1. баланс */
  T('1 факт мяса = 5 + 20 + 3 − 1 − 1 − 7 = 19 (перемещения и возврат учтены)', () => near(M.actual, 19, 'actual'));
  T('1 учёт мяса = 5 + 20 − 1 + 3 − 1 − 8 = 18; факт − учёт = недостача 1 кг', () => { near(M.book, 18, 'book'); near(M.actual - M.book, 1, 'diff'); });
  T('1 возврат покупателя (retOut=false): факт = 5 + 20 + 3 − 1 + 1 − 7 = 21', () => near(R.aRet.ings.tMeat.actual, 21, 'actual'));
  T('1 поступления не задвоены: приход берётся из «Поступлений», не из «Движения»', () => near(M.rec.kg, 20, 'rec'));
  T('1 нет движения по позиции → факт не определён (не считается без перемещений)', () => { assert.strictEqual(C.actual, null); assert.ok(/перемещени/.test(C.actualNote || ''), 'причина названа: ' + C.actualNote); });
  T('1 движение не покрывает период → факт не определён', () => assert.strictEqual(R.aCover.ings.tMeat.actual, null));
  T('1 в отчёте нет колонок перемещений → факт не определён, причина названа', () => { const x = R.aNoCols.ings.tMeat; assert.strictEqual(x.actual, null); assert.ok(/нет колонок/.test(x.actualNote), x.actualNote); near(x.actualWithout, 18, 'без перемещений'); });
  T('1 документ «перемещение» в поступлениях не задваивается: приход 20, перемещение 3 учтено один раз', () => { near(R.a.ings.tMeat.rec.kg, 20, 'rec.kg'); near(R.a.ings.tMeat.rec.xfer, 3, 'xfer'); });
  T('1 колонок нет, перемещение пришло документом: оно учтено, ноль по остальным (5 + 20 + 3 − 7 = 21)', () => { const x = R.aNoColsOk.ings.tMeat; near(x.actual, 21, 'actual'); assert.ok(/по подтверждению пользователя/.test(x.actualNote)); });
  T('1 причина попала в ограничения и в «точность»', () => { assert.ok(R.a.limits.some(x => /перемещени/.test(x) && /Морковь/.test(x)), R.a.limits.join(' | ')); assert.ok(R.a.exactWhy.some(x => /перемещени/.test(x))); });
  T('1 неопределённый факт не даёт необъяснённого отклонения', () => assert.strictEqual(C.unexpl, null));
  /* 2. закупка без суммы */
  T('2 цена масла = 450 ÷ 10 = 45 ₽/кг, а не 450 ÷ 20', () => near(Oi.actPriceRaw, 45, 'actPriceRaw'));
  T('2 неполнота показана: 10 кг без суммы и строка без количества', () => { assert.ok(Oi.rec.partial, 'partial'); near(Oi.rec.kgNoSum, 10, 'kgNoSum'); assert.strictEqual(Oi.rec.nNoQty, 1); assert.ok(R.a.limits.some(x => /без суммы/.test(x) && /Масло/.test(x)), 'в ограничениях'); });
  T('2 цена поставщика не занижена (ТЕСТ Б не имеет известной цены)', () => { const b = Oi.rec.sup['ТЕСТ Б']; assert.ok(!b || b.sum === 0 || b.kgS === 0 || !(b.sum / b.kg > 0), JSON.stringify(b)); });
  T('2 эффект цены не считается как подтверждённый при неполных закупках', () => assert.strictEqual(Oi.priceEff, undefined));
  T('2 расчёт помечен как неточный', () => assert.strictEqual(R.a.exact, false));
  /* 3. литры без плотности */
  const Mk = R.a.ings.tMilk;
  T('3 литры без плотности и без допущения: строка вне расчёта', () => { assert.ok(!Mk || !(Mk.rec.kg > 0), 'rec.kg=' + (Mk && Mk.rec.kg)); });
  T('3 список «нужна плотность» содержит молоко', () => { assert.ok(R.a.dens && R.a.dens.tMilk && R.a.dens.tMilk.n === 1, JSON.stringify(R.a.dens)); });
  T('3 осознанное допущение 1 л = 1 кг: 10 кг, помечено как допущение', () => { const m = R.cAsm.ings.tMilk; near(m.rec.kg, 10, 'kg'); assert.ok(Object.keys(m.flags).length, 'флаг допущения'); });
  T('3 плотность 1,03: 10,3 кг', () => near(R.cDens.ings.tMilk.rec.kg, 10.3, 'kg'));
  T('3 с плотностью допущений нет', () => assert.strictEqual(Object.keys(R.cDens.ings.tMilk.flags).length, 0));
  /* 4. кеш названий */
  T('4 до переименования блюдо найдено', () => assert.strictEqual(R.d.before, 'exact'));
  T('4 после переименования старое название не сопоставляется', () => assert.strictEqual(R.d.oldAfter, 'none'));
  T('4 новое название сопоставляется', () => { assert.strictEqual(R.d.newAfter.how, 'exact'); assert.strictEqual(R.d.newAfter.id, 'tRagu'); });
  T('4 старое название как псевдоним работает', () => assert.strictEqual(R.d.aliasAfter, 'alias'));
  T('4 замена ТТК при том же числе рецептов', () => assert.strictEqual(R.d.swap, 'tSoup2'));
  T('нет ошибок страницы', () => assert.deepStrictEqual(errs, []));
  await browser.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED');
  process.exit(fails.length ? 1 : 0);
})();
