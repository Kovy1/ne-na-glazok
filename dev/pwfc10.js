/* Фудкост: влияние четырёх исправлений на рекомендации, потенциальную экономию и выгрузки плана. Данные «ТЕСТ …», значения посчитаны вручную */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs'), cp = require('child_process');
const SRC = path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html');
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1100 }, acceptDownloads: true })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + SRC); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  await page.selectOption('#fcObj', '__new__'); await page.fill('#fcNewObj', 'ТЕСТ Влияние'); await page.dispatchEvent('#fcNewObj', 'change');
  await page.fill('input[data-act="fcFrom"]', '2026-10-01'); await page.dispatchEvent('input[data-act="fcFrom"]', 'change');
  await page.fill('input[data-act="fcTo"]', '2026-10-31'); await page.dispatchEvent('input[data-act="fcTo"]', 'change');
  await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, O = S.fc.sel.obj, FROM = '2026-10-01', TO = '2026-10-31';
    S.ings.tMeat = { id: 'tMeat', name: 'ТЕСТ Мясо', price: 400 };
    S.ings.tOil = { id: 'tOil', name: 'ТЕСТ Масло', price: 100 };
    S.ings.tMilk = { id: 'tMilk', name: 'ТЕСТ Молоко', price: 60 };
    S.ings.tCarr = { id: 'tCarr', name: 'ТЕСТ Морковь', price: 40 };
    S.recipes.tRagu = { name: 'ТЕСТ Рагу', output: 250, rows: [{ rid: 'a', ing: 'tMeat', net: 100, gross: 120, share: 100 }, { rid: 'c', ing: 'tOil', net: 10, gross: 10, share: 100 }, { rid: 'd', ing: 'tCarr', net: 70, gross: 80, share: 100 }], ref: {}, ttk: {}, op: {} };
    S.recipes.tSoup = { name: 'ТЕСТ Суп', output: 300, rows: [{ rid: 'a', ing: 'tMilk', net: 200, gross: 200, share: 100 }], ref: {}, ttk: {}, op: {} };
    const ops = t => S.fc.ops[t] = S.fc.ops[t] || {};
    let n = 0; const add = (t, o) => { o.obj = O; o.id = 'z' + (++n); o.b = o.b || 'b' + t; ops(t)[o.id] = o; };
    S.fc.batches.bmoves = { id: 'bmoves', type: 'moves', obj: O, objName: 'ТЕСТ Влияние', from: FROM, to: TO, file: 'ТЕСТ', map: { open: 3, tin: 4, tout: 5, ret: 6, close: 7 } };
    add('receipts', { d: '2026-10-05', doc: 'T1', sup: 'ТЕСТ А', nm: 'ТЕСТ Мясо', u: 'кг', q: 20, s: 8400 });
    add('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 5, 'in': 20, ret: 1, tin: 3, tout: 1, close: 8, b: 'bmoves' });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 5, fact: 5 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 8, fact: 7 });
    add('receipts', { d: '2026-10-06', doc: 'T2', sup: 'ТЕСТ Б', nm: 'ТЕСТ Морковь', u: 'кг', q: 10, s: 450 });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Морковь', u: 'кг', book: 2, fact: 2 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Морковь', u: 'кг', book: 3, fact: 3 });
    add('receipts', { d: '2026-10-07', doc: 'T3', sup: 'ТЕСТ А', nm: 'ТЕСТ Масло', u: 'кг', q: 10, s: 450 });
    add('receipts', { d: '2026-10-08', doc: 'T4', sup: 'ТЕСТ Б', nm: 'ТЕСТ Масло', u: 'кг', q: 10 });
    add('receipts', { d: '2026-10-10', doc: 'T6', sup: 'ТЕСТ А', nm: 'ТЕСТ Молоко', u: 'л', q: 10, s: 600 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Рагу', q: 100, s: 30000 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Суп', q: 10, s: 3000 });
    F.cfgSet('thr.unexRub', 1000); F.cfgSet('thr.shortRub', 300);
  });
  const J = (f, a) => page.evaluate(f, a);
  const near = (x, y, m) => assert.ok(x !== null && x !== undefined && Math.abs(x - y) < 0.01, m + ': ' + x + ' ≠ ' + y);
  const fails = []; const T = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '—', String(e.message).split('\n')[0].slice(0, 300)); } };
  const items = () => J(() => { const F = window.kbzhuFc, s = F.S.fc.sel, res = F.calc(s.obj, s.from, s.to); return JSON.parse(JSON.stringify({ it: F.planItems(res), eff: F.effects(F.planItems(res)), res: { dens: res.dens, transMiss: res.transMiss, limits: res.limits, M: res.ings.tMeat, sums: res.sums } })); });
  let X = await items(); const byT = t => X.it.filter(i => i.title.indexOf(t) === 0);
  await T('рекомендации: «Литры без плотности» по молоку, без суммы экономии', () => { const i = byT('Литры без плотности: ТЕСТ Молоко'); assert.strictEqual(i.length, 1); assert.strictEqual(i[0].st, 'hyp'); assert.strictEqual(i[0].eff.rub, null); });
  await T('рекомендации: «Нет перемещений и возвратов» по моркови', () => { const i = byT('Нет перемещений и возвратов: ТЕСТ Морковь'); assert.strictEqual(i.length, 1); assert.strictEqual(i[0].eff.rub, null); });
  await T('рекомендации: необъяснённый расход мяса считается от факта 19 кг (теор. 12 кг → 7 кг × 420 ₽ = 2940 ₽; до исправления было 6 кг и 2520 ₽)', () => { const i = byT('Необъяснённый расход: ТЕСТ Мясо'); assert.strictEqual(i.length, 1); near(i[0].eff.kg, 7, 'кг'); near(i[0].eff.rub, 2940, '₽'); });
  await T('рекомендации: по моркови нет «необъяснённого расхода» (факт не определён — нет и мнимой экономии)', () => assert.strictEqual(byT('Необъяснённый расход: ТЕСТ Морковь').length, 0));
  await T('рекомендации: цена масла ниже базы — гипотеза с пометкой, что 10 кг без суммы не учтены', () => { const i = byT('Цена в базе отличается от закупок: ТЕСТ Масло'); assert.strictEqual(i.length, 1); assert.strictEqual(i[0].st, 'hyp'); assert.ok(/без суммы не учтены/.test(i[0].sit), i[0].sit); });
  await T('экономия: нет эффекта цены у масла (закупки неполные) и нет денег у правил R11/R12', () => { assert.ok(!X.it.some(i => i.eff && i.eff.m === 'price' && /Масло/.test(i.subj)), 'эффект цены масла'); });
  await T('экономия: потенциал включает только подтверждаемые оценки и не зависит от исключённых строк', () => { near(X.eff.pot, 2940, 'потенциал — только необъяснённый расход мяса'); });
  // решение пользователя: принять допущение — молоко входит, рекомендация исчезает, расчёт остаётся неточным
  await J(() => { window.kbzhuFc.S.ings.tMilk.densAsm = 1; });
  X = await items();
  await T('после принятия допущения: правило R11 исчезло, допущение отражено, расчёт не «точный»', () => { assert.strictEqual(byT('Литры без плотности').length, 0); assert.ok(byT('Допущения по единицам: ТЕСТ Молоко').length === 1); });
  await J(() => { const g = window.kbzhuFc.S.ings.tMilk; delete g.densAsm; });
  // выгрузки плана
  await page.click('[data-act="fcView"][data-v="plan"]'); await page.click('[data-act="fcBuild"]'); await page.waitForSelector('.fcm');
  const E = await J(async () => {
    const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to), m = F.planModel(p), td = new TextDecoder(), ab = u => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    const dx = F.planDocx(m), xl = F.planXlsx(m), pdf = F.planPdf(m);
    const x = t => t.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
    const doc = x(td.decode(await F.unzip(ab(dx), 'word/document.xml')));
    let sh = ''; for (const n of [1, 2, 3]) sh += td.decode(await F.unzip(ab(xl), 'xl/worksheets/sheet' + n + '.xml'));
    let b = ''; for (let i = 0; i < pdf.length; i += 8192) b += String.fromCharCode.apply(null, pdf.subarray(i, i + 8192));
    return { doc, sheets: x(sh), pdf: btoa(b), exact: m.exact };
  });
  fs.writeFileSync('/tmp/fc10.pdf', Buffer.from(E.pdf, 'base64'));
  const pdft = cp.execSync('pdftotext -layout /tmp/fc10.pdf -', { encoding: 'utf8' }).replace(/\s+/g, ' ');
  for (const [k, t] of [['Word', E.doc], ['Excel', E.sheets], ['PDF', pdft]]) {
    await T(k + ': литры без плотности названы в ограничениях и в мероприятиях', () => { assert.ok(/Литры без плотности/.test(t) && /не вошли в расчёт/.test(t), 'нет текста'); });
    await T(k + ': неполные поступления (без суммы) названы', () => assert.ok(/без суммы/.test(t) && /стоимость неизвестна и не принята за ноль/.test(t)));
    await T(k + ': факт не определён из-за перемещений и возвратов', () => assert.ok(/перемещени/.test(t) && /Фактический расход не определён/.test(t)));
  }
  await T('выгрузка помечает расчёт как неточный', () => assert.strictEqual(E.exact, false));
  await T('нет ошибок страницы', () => assert.deepStrictEqual(errs, []));
  await browser.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
})();
