/* Фудкост: расчёт, граничные случаи. ЯВНО ТЕСТОВЫЕ данные «ТЕСТ …», ручные контрольные значения в комментариях */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const near = (x, y, m) => assert.ok(Math.abs(x - y) < 1e-6, m + ': ' + x + ' ≠ ' + y);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1100 } })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  const R = await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, FROM = '2026-10-01', TO = '2026-10-31', out = {};
    S.ings.tM = { id: 'tM', name: 'ТЕСТ Мясо', price: 400 }; S.ings.tC = { id: 'tC', name: 'ТЕСТ Морковь', price: 40 }; S.ings.tN = { id: 'tN', name: 'ТЕСТ Без цены' };
    S.recipes.tSauce = { name: 'ТЕСТ Соус', output: 1000, pf: true, rows: [{ rid: 's1', ing: 'tC', net: 1000, gross: 1000, share: 100 }], ref: {}, ttk: {}, op: {} };
    S.recipes.tDish = { name: 'ТЕСТ Блюдо', output: 300, rows: [{ rid: 'd1', pf: 'tSauce', ing: '', net: 200, share: 100 }, { rid: 'd2', ing: 'tM', net: 100, gross: 100, share: 100 }], ref: {}, ttk: {}, op: {} };
    S.recipes.tBad = { name: 'ТЕСТ Неполное', output: 200, rows: [{ rid: 'b1', ing: 'tN', net: 100, gross: 100, share: 100 }], ref: {}, ttk: {}, op: {} };
    const mk = O => { let n = 0; return (t, o) => { o.obj = O; o.id = O + (++n); o.b = o.b || ('b' + t + O); (S.fc.ops[t] = S.fc.ops[t] || {})[o.id] = o; }; };
    const OA = F.slug('ТЕСТ А'), OB = F.slug('ТЕСТ Б'), A = mk(OA), B = mk(OB);
    // объект A: полуфабрикат; возвраты в продажах; продажа в кг
    A('sales', { d: '2026-10-05', nm: 'ТЕСТ Блюдо', q: 100, ret: 5, s: 20000 });            // 95 порций
    A('sales', { d: '2026-10-06', nm: 'ТЕСТ Блюдо', u: 'кг', q: 3, s: 900 });                // 3 кг / 0,3 = 10 порций
    A('receipts', { d: '2026-10-02', nm: 'ТЕСТ Мясо', u: 'кг', q: 10, s: 4400, sup: 'ТЕСТ' }); // 440 ₽/кг с НДС
    A('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 2, 'in': 10, ret: 1, tin: 3, tout: 1, out: 13, close: 0, b: 'bmovesA' });
    S.fc.batches.bmovesA = { id: 'bmovesA', type: 'moves', obj: OA, objName: 'ТЕСТ А', from: FROM, to: TO, file: 'ТЕСТ', map: { open: 3, tin: 4, tout: 5, ret: 6, close: 7 } };
    const r1 = F.calc(OA, FROM, TO);
    out.carrot = r1.ings.tC.th.kg; out.meatTh = r1.ings.tM.th.kg; out.sold = r1.dishes.tDish.sold;
    out.bookOut = r1.ings.tM.book; out.verOut = r1.ings.tM.mv.verified;
    // направление возвратов
    const cfgIn = JSON.parse(JSON.stringify(r1.cfg)); cfgIn.retOut = false; const r2 = F.calc(OA, FROM, TO, cfgIn);
    out.bookIn = r2.ings.tM.book; out.verIn = r2.ings.tM.mv.verified;
    // НДС: закупки с НДС, выручка без НДС. Единая ставка — только при подтверждении, ставка/сумма строки — точно
    const rop = Object.values(S.fc.ops.receipts).filter(o => o.obj === OA)[0];
    const cfgV = JSON.parse(JSON.stringify(r1.cfg)); cfgV.vatP = 'with'; cfgV.vatS = 'without';
    const rv0 = F.calc(OA, FROM, TO, cfgV);                                                  // строка без ставки, приближение не подтверждено
    out.v0 = { price: rv0.ings.tM.actPrice, ok: rv0.basis.ok, none: rv0.vat.none, why: rv0.exactWhy.join(';'), txt: rv0.basis.txt };
    const cfgA = Object.assign({}, cfgV, { vatApprox: true }); const rv1 = F.calc(OA, FROM, TO, cfgA); // подтверждённое приближение
    out.v1 = { price: rv1.ings.tM.actPrice, raw: rv1.ings.tM.actPriceRaw, ok: rv1.basis.ok, approx: rv1.vat.approx, why: rv1.exactWhy.join(';') };
    rop.vr = 20; const rv2 = F.calc(OA, FROM, TO, cfgV);                                     // ставка строки 20 %, единая 10 % не применяется
    out.v2 = { price: rv2.ings.tM.actPrice, ok: rv2.basis.ok, rate: rv2.vat.rate, why: rv2.exactWhy.join(';') };
    delete rop.vr; rop.vv = 400; const rv3 = F.calc(OA, FROM, TO, cfgV);                     // сумма НДС строки 400 из 4400
    out.v3 = { price: rv3.ings.tM.actPrice, ok: rv3.basis.ok, amt: rv3.vat.amt };
    delete rop.vv; const cfgS = Object.assign({}, r1.cfg, { vatP: 'with', vatS: 'with' }); const rv4 = F.calc(OA, FROM, TO, cfgS);
    out.v4 = { price: rv4.ings.tM.actPrice, ok: rv4.basis.ok };
    out.noVatWhy = r1.exactWhy.join(';');
    // неполная ТТК и цена неизвестна → не ноль
    A('sales', { d: '2026-10-07', nm: 'ТЕСТ Неполное', q: 10, s: 1000 });
    const r3 = F.calc(OA, FROM, TO);
    out.incomplete = r3.thIncomplete.length; out.exact3 = r3.exact; out.noPriceRub = r3.ings.tN ? r3.ings.tN.price : 'нет'; out.limit3 = r3.limits.join(' | ');
    const thM = r3.metrics.find(m => m.id === 'th'); out.thNote = thM.note;
    // объект B: фактический расход есть, вторая цена; сеть
    B('sales', { d: '2026-10-05', nm: 'ТЕСТ Блюдо', q: 50, s: 10000 });
    B('receipts', { d: '2026-10-02', nm: 'ТЕСТ Мясо', u: 'кг', q: 10, s: 4000, sup: 'ТЕСТ' });
    B('receipts', { d: '2026-10-02', nm: 'ТЕСТ Морковь', u: 'кг', q: 10, s: 400, sup: 'ТЕСТ' });
    S.fc.batches.bmovesB = { id: 'bmovesB', type: 'moves', obj: OB, objName: 'ТЕСТ Б', from: FROM, to: TO, file: 'ТЕСТ', map: { open: 3, tin: 4, tout: 5, ret: 6, close: 7 } };
    B('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 1, 'in': 10, tin: 0, tout: 0, ret: 0, close: 4, b: 'bmovesB' });
    B('moves', { nm: 'ТЕСТ Морковь', u: 'кг', open: 0, 'in': 10, tin: 0, tout: 0, ret: 0, close: 2, b: 'bmovesB' });
    B('revision', { d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 1, fact: 1 }); B('revision', { d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 4, fact: 4 });
    B('revision', { d: '2026-10-01', nm: 'ТЕСТ Морковь', u: 'кг', book: 0, fact: 0 }); B('revision', { d: '2026-10-31', nm: 'ТЕСТ Морковь', u: 'кг', book: 2, fact: 2 });
    S.fc.sel.objs = ['ТЕСТ А', 'ТЕСТ Б']; S.fc.sel.obj = OA; S.fc.sel.objName = 'ТЕСТ А'; S.fc.sel.from = FROM; S.fc.sel.to = TO; out.OA = OA; out.OB = OB;
    return { out, ids: ['A', 'B'] };
  });
  const o = R.out;
  near(o.carrot, 95 * 0 + 105 * 0.2, 'полуфабрикат: морковь в соусе считается один раз (105 порций × 0,2 кг)');
  near(o.sold, 105, 'продано 100−5 возврат + 3 кг/0,3 = 105 порций');
  near(o.meatTh, 105 * 0.1, 'мясо 10,5 кг');
  near(o.bookOut, 2 + 10 - 1 + 3 - 1 - 0, 'учёт: 2 + 10 − возврат 1 + перемещ. вход 3 − перемещ. выход 1 − 0 = 13');
  assert.strictEqual(o.verOut, true, 'баланс сошёлся с расходом отчёта 13');
  near(o.bookIn, 2 + 10 + 1 + 3 - 1, 'возврат от покупателя прибавляется: 15'); assert.strictEqual(o.verIn, false, 'при другой трактовке возвратов баланс не сходится — это видно');
  assert.strictEqual(o.v0.none, 1); near(o.v0.price, 440, 'без ставки и без подтверждения строка не приведена'); assert.strictEqual(o.v0.ok, false); assert.ok(/не приведена/.test(o.v0.why), 'неприведённая строка названа: ' + o.v0.why); assert.ok(/подтвердите приближение/.test(o.v0.txt));
  assert.strictEqual(o.v1.approx, 1); near(o.v1.price, 440 / 1.1, 'единая ставка по подтверждению'); near(o.v1.raw, 440, 'исходная цена закупки сохранена'); assert.strictEqual(o.v1.ok, false, 'приближение не считается точным'); assert.ok(/приближение/.test(o.v1.why), o.v1.why);
  assert.strictEqual(o.v2.rate, 1); near(o.v2.price, 440 / 1.2, 'ставка строки 20 % вместо единой 10 %'); assert.strictEqual(o.v2.ok, true); assert.ok(!/НДС/.test(o.v2.why), 'точное приведение: ограничения нет: ' + o.v2.why);
  assert.strictEqual(o.v3.amt, 1); near(o.v3.price, 400, 'сумма НДС строки: (4400 − 400) / 10'); assert.strictEqual(o.v3.ok, true);
  near(o.v4.price, 440, 'одна основа — приведение не нужно'); assert.strictEqual(o.v4.ok, true);
  assert.ok(/НДС/.test(o.noVatWhy), 'основа не задана → названо');
  assert.strictEqual(o.incomplete, 1); assert.strictEqual(o.exact3, false); assert.ok(/ТЕСТ Неполное/.test(o.limit3), 'неполная ТТК названа в ограничениях: ' + o.limit3);
  assert.ok(/Неполный/.test(o.thNote), 'показатель помечен неполным');
  // сеть
  const nw = await page.evaluate(() => { const F = window.kbzhuFc; return JSON.parse(JSON.stringify(F.network('2026-10-01', '2026-10-31'))); });
  console.log(JSON.stringify(nw).slice(0, 700));
  const A_ = nw.rows.find(r => r.obj === R.out.OA), B_ = nw.rows.find(r => r.obj === R.out.OB);
  assert.ok(A_ && B_, 'оба объекта в сети');
  // факт только у B: сеть по факту = только B, A назван исключённым
  assert.ok(nw.excluded.some(x => /фактического расхода/.test(x.why)), 'объект без факта назван в исключённых');
  near(B_.act, 2800 + 320, 'факт B: мясо 1+10−4=7 кг×400 и морковь 0+10−2=8 кг×40'); near(nw.fcAct, 3120 / 10000 * 100, 'фудкост сети по факту — из сумм (сопоставим один объект)');
  const thSum = A_.th + B_.th, revSum = A_.rev + B_.rev;
  near(nw.fcRec, thSum / revSum * 100, 'доля по рецептуре сети = Σзатрат ÷ Σвыручки, а не среднее процентов');
  assert.ok(Math.abs(nw.fcRec - (A_.fcRec + B_.fcRec) / 2) > 1e-6 || A_.fcRec === B_.fcRec, 'не среднее процентов');
  // экран: таблица сети
  await page.click('[data-act="fcView"][data-v="an"]');
  const txt = (await page.textContent('.fcan')).replace(/\s+/g, ' ');
  assert.ok(/Сеть за период/.test(txt) && /проценты объектов не усредняются/.test(txt), 'на экране есть сеть');
  assert.deepStrictEqual(errs, []);
  console.log('OK fc4'); await browser.close();
})().catch(e => { console.error('FAIL', e.message, errs); process.exit(1); });
