/* Фудкост: НДС по строкам и группы эффектов. Данные — явно тестовые «ТЕСТ …», контрольные значения посчитаны вручную в комментариях. */
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
    const F = window.kbzhuFc, out = {};
    const it = (id, subj, eff) => ({ id, subj, title: subj + ' ' + id, eff: Object.assign({ k: 'pot' }, eff) });
    // 1. Два мероприятия об одной потере: необъяснённый расход 1000 (10 кг) и недостача 400 (4 кг) — один объём, итог 1000, не 1400
    out.same = F.effects([it('a1', 'А', { m: 'loss', ing: 'A', kg: 10, rub: 1000 }), it('a2', 'А', { m: 'loss', ing: 'A', kg: 4, rub: 400 })]);
    // 2. Один объём сырья: потеря 1000 (10 кг), списания 200 (2 кг), цена 500 при закупке 100 кг.
    //    Пересечение: (10 + 2) / 100 × 500 = 60 → 1000 + 200 + 500 − 60 = 1640
    out.raw = F.effects([it('l', 'А', { m: 'loss', ing: 'A', kg: 10, rub: 1000 }), it('w', 'А', { m: 'wo', ing: 'A', kg: 2, rub: 200 }), it('p', 'А', { m: 'price', ing: 'A', kb: 100, rub: 500 })]);
    // 3. Независимые: потери разного сырья не сливаются в одну группу — 1000 + 700
    out.indep = F.effects([it('a', 'А', { m: 'loss', ing: 'A', kg: 10, rub: 1000 }), it('b', 'Б', { m: 'loss', ing: 'B', kg: 7, rub: 700 })]);
    // 4. Блюдо: списанные порции 100 (10 порций) и избыточная доля сырья 600 (снижение себестоимости 5 ₽ на порцию):
    //    разные порции, складываются; пересечение 10 × 5 = 50 → 650, а не наибольшее 600
    out.dish = F.effects([it('w', 'Д', { m: 'dwo', dish: 'D', ings: [], ik: {}, pw: 10, rub: 100 }), it('s', 'Д', { m: 'dshare', dish: 'D', ings: [], dc: 5, rub: 600 })]);
    // 5. Списанные порции блюда и цена сырья блюда: в 10 списанных порциях 0,1 кг/порц. сырья А = 1 кг; цена 500 при закупке 100 кг:
    //    пересечение 1 / 100 × 500 = 5 → 100 + 500 − 5 = 595
    out.dwoPrice = F.effects([it('w', 'Д', { m: 'dwo', dish: 'D', ings: ['A'], ik: { A: 0.1 }, pw: 10, rub: 100 }), it('p', 'А', { m: 'price', ing: 'A', kb: 100, rub: 500 })]);
    // 6. Доля сырья блюда и цена его сырья: пересечение определить нельзя — итог не обещается, оценки отдельно.
    //    Потеря другого сырья (300) остаётся в определяемой части
    out.undet = F.effects([it('s', 'Д', { m: 'dshare', dish: 'D', ings: ['A'], dc: 5, rub: 600 }), it('p', 'А', { m: 'price', ing: 'A', kb: 100, rub: 500 }), it('x', 'Б', { m: 'loss', ing: 'B', kg: 3, rub: 300 })]);
    // 7. Рост цены и разброс поставщиков — две оценки одной цены: берётся наибольшая
    out.price2 = F.effects([it('p1', 'А', { m: 'price', ing: 'A', kb: 100, rub: 500 }), it('p2', 'А', { m: 'price', ing: 'A', kb: 100, rub: 200 })]);
    // 8. Пересечение не выше самой экономии: потеря больше закупки → итог не уходит ниже нуля
    out.floor = F.effects([it('l', 'А', { m: 'loss', ing: 'A', kg: 500, rub: 10 }), it('p', 'А', { m: 'price', ing: 'A', kb: 100, rub: 5 })]);
    return JSON.parse(JSON.stringify(out));
  });
  near(R.same.pot, 1000, 'одна потеря'); assert.strictEqual(R.same.groups, 1); assert.strictEqual(R.same.partial, false);
  near(R.raw.pot, 1640, 'один объём сырья: пересечение потери и цены вычтено'); assert.ok(/пересечение потери и цены/.test(R.raw.groupsInfo[0].how), R.raw.groupsInfo[0].how);
  near(R.indep.pot, 1700, 'независимые мероприятия складываются'); assert.strictEqual(R.indep.groups, 2);
  near(R.dish.pot, 650, 'списанные и проданные порции — разные объёмы'); assert.ok(/пересечение списанных порций/.test(R.dish.groupsInfo[0].how));
  near(R.dwoPrice.pot, 595, 'пересечение списанных порций и цены сырья');
  near(R.undet.pot, 300, 'неопределяемая группа в итог не входит'); assert.strictEqual(R.undet.partial, true); assert.strictEqual(R.undet.und.length, 1);
  assert.deepStrictEqual(R.undet.und[0].est.map(x => x.rub).sort((a, b) => a - b), [500, 600], 'отдельные оценки показаны'); assert.ok(/не обещается/.test(R.undet.note), R.undet.note);
  assert.ok(R.undet.groupsInfo.some(g => !g.det && g.tot === null), 'группа без итога помечена');
  near(R.price2.pot, 500, 'одна цена — наибольшая оценка');
  assert.ok(R.floor.pot >= 0, 'итог не отрицательный: ' + R.floor.pot);
  console.log('effects OK');

  // НДС в сопоставлении цен поставщиков: у X 110 ₽/кг с НДС 10 % (без НДС 100), у Y 120 ₽/кг с НДС 20 % (без НДС 100)
  const V = await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, FROM = '2026-10-01', TO = '2026-10-31', out = {};
    S.ings.vM = { id: 'vM', name: 'ТЕСТ Мука', price: 100 };
    const O = F.slug('ТЕСТ В'); let n = 0;
    const A = (t, o) => { o.obj = O; o.id = O + (++n); o.b = 'bv' + t; (S.fc.ops[t] = S.fc.ops[t] || {})[o.id] = o; };
    A('receipts', { d: '2026-10-02', nm: 'ТЕСТ Мука', u: 'кг', q: 100, s: 11000, sup: 'ТЕСТ X', vr: 10 });
    A('receipts', { d: '2026-10-03', nm: 'ТЕСТ Мука', u: 'кг', q: 100, s: 12000, sup: 'ТЕСТ Y', vr: 20 });
    A('sales', { d: '2026-10-05', nm: 'ТЕСТ Мука', q: 1, s: 100 });
    const cfg = JSON.parse(JSON.stringify(F.cfgDef)); cfg.vatP = 'with'; cfg.vatS = 'without'; cfg.thr.supSpread = 5;
    const res = F.calc(O, FROM, TO, cfg);
    const rows = res.ings.vM.rec.rows;
    out.pn = rows.map(r => r.pn); out.pk = rows.map(r => r.pk); out.pkB = rows.map(r => r.pkB);
    out.vat = res.vat; out.price = res.ings.vM.actPrice;
    const rl = F.rules(res); out.r5 = rl.filter(f => f.rule === 'R5').length;
    // без ставок строк (цены с НДС): разница между поставщиками может быть вызвана НДС — гипотеза, не факт
    rows.forEach(r => { delete r.pn; }); Object.values(S.fc.ops.receipts).filter(o => o.obj === O).forEach(o => { delete o.vr; });
    const res2 = F.calc(O, FROM, TO, cfg); const rl2 = F.rules(res2).filter(f => f.rule === 'R5');
    out.r5b = rl2.map(f => f.st); out.r5note = rl2.map(f => f.eff.note).join('|');
    return JSON.parse(JSON.stringify(out));
  });
  near(V.pn[0], 100, 'цена без НДС X'); near(V.pn[1], 100, 'цена без НДС Y'); near(V.price, 100, 'закупка приведена по ставкам строк: (11000/1.1 + 12000/1.2) / 200');
  assert.strictEqual(V.vat.rate, 2); assert.strictEqual(V.vat.none, 0); assert.strictEqual(V.r5, 0, 'при равных ценах без НДС разброса поставщиков нет');
  assert.deepStrictEqual(V.r5b, ['hyp'], 'ставки неизвестны, цены с НДС → разброс только гипотеза: ' + V.r5b);
  assert.ok(/НДС/.test(V.r5note), V.r5note);
  console.log('vat compare OK');
  assert.deepStrictEqual(errs, [], errs.join('\n'));
  await browser.close(); console.log('OK fc8');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
