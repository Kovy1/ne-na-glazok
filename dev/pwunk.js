/* «КБЖУ не заполнено» отдельно от настоящего нуля: расчёт карты, строки сырья, сверка, раздел VII, список карт, база сырья, CSV */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const data = () => ({
  ings: {
    i1: { name: 'Говядина тест', p: 18, f: 12, c: 0, kind: 'table', source: 'справочник' },
    i2: { name: 'Мука не внесена', p: 0, f: 0, c: 0, kind: 'estimate', source: 'Добавлено из ТТК: значения КБЖУ не заполнены' },
    i3: { name: 'Вода питьевая', p: 0, f: 0, c: 0, kind: 'estimate', source: 'Добавлено из ТТК: значения КБЖУ не заполнены' },
    i4: { name: 'Соль тест', p: 0, f: 0, c: 0, kind: 'table', source: 'справочник' },
    i5: { name: 'Сахар по ориентиру', p: 0, f: 0, c: 99, kind: 'estimate', source: 'ориентир' }
  },
  recipes: {
    t1: { name: 'Блюдо А с мукой', output: 150, rows: [{ rid: 'a1', ing: 'i1', net: 100, share: 100 }, { rid: 'a2', ing: 'i2', net: 50, share: 100 }], ref: { label: 'Исходная ТТК', p: 12, f: 8, c: 15, kcal: 220, tol: 10, basis: '100' } },
    t2: { name: 'Блюдо Б известное', output: 105, rows: [{ rid: 'b1', ing: 'i1', net: 100, share: 100 }, { rid: 'b2', ing: 'i4', net: 5, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } },
    t3: { name: 'Блюдо В с водой', output: 200, rows: [{ rid: 'c1', ing: 'i1', net: 100, share: 100 }, { rid: 'c2', ing: 'i3', net: 100, share: 100 }, { rid: 'c3', ing: 'i5', net: 5, share: 100 }], ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 } }
  },
  cfg: {}
});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ acceptDownloads: true, viewport: { width: 1300, height: 1000 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu'); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); }, data());
  await page.reload(); await page.waitForSelector('.mrow[data-rid]');
  const open = async rid => { await page.click('#tabMenu'); await page.waitForSelector('.mrow[data-rid="' + rid + '"] [data-act="mOpen"]'); await page.click('.mrow[data-rid="' + rid + '"] [data-act="mOpen"]'); await page.waitForSelector('#resBody .hero, #resBody .muted'); };
  const txt = sel => page.$$eval(sel, e => e.map(x => x.textContent).join(' ')).then(t => t.replace(/\s+/g, ' ').trim());

  // 1. карта с сырьём без КБЖУ
  await open('t1');
  let bar = await txt('#resBody .unkbar'); console.log('1 bar:', bar);
  assert.ok(/КБЖУ не заполнено у 1 ингредиента/.test(bar) && /Мука не внесена/.test(bar) && /не менее/.test(bar), bar);
  assert.ok(/^≥/.test(await txt('#resBody .big')), 'ккал помечены «≥»');
  assert.ok((await page.$$eval('#resBody .mv', e => e.map(x => x.textContent))).every(t => /^≥/.test(t.trim())), 'Б, Ж, У помечены «≥»');
  assert.ok(await page.$('#resBody .hero.unkv') && await page.$('#resBody .macros.unkv'));
  const warn = await txt('#resBody .warns'); assert.ok(/КБЖУ не заполнено/.test(warn) && /Ноль настоящий/.test(warn), warn);
  const c2 = await page.$$eval('.row[data-rid="a2"] [data-out="p"],.row[data-rid="a2"] [data-out="f"],.row[data-rid="a2"] [data-out="c"],.row[data-rid="a2"] [data-out="k"]', e => e.map(x => x.textContent.trim()));
  assert.deepStrictEqual(c2, ['—', '—', '—', '—'], 'у сырья без КБЖУ прочерки, не нули: ' + c2);
  const c1 = await page.$$eval('.row[data-rid="a1"] [data-out="p"],.row[data-rid="a1"] [data-out="k"]', e => e.map(x => x.textContent.trim()));
  assert.deepStrictEqual(c1, ['18,0', '180'], 'у заполненного сырья числа: ' + c1);
  assert.ok(await page.$('.row[data-rid="a2"].unk') && !(await page.$('.row[data-rid="a1"].unk')));
  // сверка с исходной ТТК: расчёт неполный
  const ref = await txt('#refTable'); assert.ok(/Расчёт неполный/.test(ref), ref);
  // раздел VII: исходная ТТК, т.к. её значения заполнены
  const vii = await txt('#tVii'); console.log('1 VII:', vii);
  assert.ok(/источник: эталон/.test(vii) && /Б 12,0/.test(vii) && /220,0 ккал/.test(vii), vii);
  const iss = await txt('#ttkIssues'); assert.ok(/раздел VII взят из исходной ТТК/.test(iss) && !/посчитаны как ноль/.test(iss), iss);
  // csv
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="dlRecipe"]')]);
  const csv = fs.readFileSync(await dl.path(), 'utf8');
  assert.ok(/не менее: КБЖУ не заполнено/.test(csv) && /КБЖУ не заполнено у сырья;Мука не внесена/.test(csv.replace(/"/g, '')), csv.slice(0, 900));
  // 2. полностью известная карта: настоящий ноль (соль, справочник) помех не даёт
  await open('t2');
  assert.strictEqual(await page.$('#resBody .unkbar'), null, 'у известной карты плашки нет');
  assert.ok(!/≥/.test(await txt('#resBody .hero')) && !/КБЖУ не заполнено/.test(await txt('#resBody')));
  // 3. карта с «Ориентиром» без нулей (сахар) и сырьём без КБЖУ (вода): сахар — обычный ориентир, вода — не заполнено
  await open('t3');
  const w3 = await txt('#resBody .warns'); assert.ok(/КБЖУ не заполнено/.test(w3) && /Вода питьевая/.test(w3) && /Ориентировочные значения у сырья: Сахар по ориентиру/.test(w3) && !/Ориентировочные значения у сырья:[^.]*Вода/.test(w3), w3);
  assert.ok(/Вода питьевая/.test(await txt('#resBody .unkbar')) && !/Сахар/.test(await txt('#resBody .unkbar')));
  const iss3 = await txt('#ttkIssues'); assert.ok(/КБЖУ не заполнено у сырья: Вода питьевая/.test(iss3) && /значения занижены/.test(iss3), iss3);
  assert.ok(/источник: расчёт/.test(await txt('#tVii')), 'без исходной ТТК раздел VII — расчёт');
  // 4. список сохранённых карт
  await page.click('#tabCalc'); await page.waitForSelector('#ttkHome'); await page.click('#ttkSavedLink'); await page.waitForSelector('#recipeSel');
  const opts = await page.$$eval('#recipeSel option', o => o.map(x => x.textContent.trim()));
  console.log('4 карты:', JSON.stringify(opts));
  assert.ok(opts.filter(t => /КБЖУ не заполнено/.test(t)).length === 2 && !opts.some(t => /известное.*КБЖУ/.test(t)), JSON.stringify(opts));
  // 5. база сырья: фильтр, пустые поля, «Ноль настоящий»
  await page.click('#tabBase'); await page.waitForSelector('#chips');
  const chip = await txt('#chips [data-act="filterUnk"]'); assert.ok(/КБЖУ не заполнено · 2/.test(chip), chip);
  await page.click('#chips [data-act="filterUnk"]');
  let rows = await page.$$eval('#ingList .irow[data-iid]:not(.more)', e => e.map(x => x.getAttribute('data-iid')));
  assert.deepStrictEqual(rows.sort(), ['i2', 'i3'], 'в фильтре только сырьё без КБЖУ (не сахар, не соль)');
  const vals = await page.$$eval('#ingList .irow[data-iid="i2"] input.num[data-act="iP"],#ingList .irow[data-iid="i2"] input.num[data-act="iF"],#ingList .irow[data-iid="i2"] input.num[data-act="iC"]', e => e.map(x => [x.value, x.placeholder]));
  assert.deepStrictEqual(vals, [['', '—'], ['', '—'], ['', '—']], 'поля пустые, а не нули');
  assert.strictEqual(await txt('#ingList .irow[data-iid="i2"] [data-out="k"]'), '—');
  await page.click('#ingList .irow[data-iid="i3"] [data-act="iMore"]'); await page.waitForSelector('#ingList [data-act="iZero"]');
  await page.click('#ingList [data-act="iZero"]');
  await page.waitForFunction(() => /ноль признан настоящим/.test(document.querySelector('#toast').textContent));
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('kbzhu:v1')).ings.i3.kind === 'table', null, { timeout: 8000 });
  const st = await page.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:v1')); return { kind: d.ings.i3.kind, src: d.ings.i3.source }; });
  assert.deepStrictEqual([st.kind, /подтверждено/.test(st.src)], ['table', true], JSON.stringify(st));
  assert.ok(/КБЖУ не заполнено · 1/.test(await txt('#chips')), 'остался один: ' + await txt('#chips'));
  // карта с водой больше не жалуется на воду
  await open('t3');
  const w3b = await txt('#resBody .warns'); assert.ok(!/Вода питьевая/.test(w3b), w3b);
  assert.strictEqual(await page.$('#resBody .unkbar'), null, 'плашки нет: вода признана настоящим нулём');
  // 6. ввод значения в базе снимает пометку
  await page.click('#tabBase'); await page.waitForSelector('#ingList');
  await page.click('#chips [data-act="filterUnk"]');
  await page.fill('#ingList .irow[data-iid="i2"] input[data-act="iP"]', '10');
  await page.waitForFunction(() => !document.querySelector('#ingList .irow[data-iid="i2"].unk'));
  assert.strictEqual(await txt('#ingList .irow[data-iid="i2"] [data-out="k"]'), '40');
  assert.deepStrictEqual(errs, [], errs.join('\n'));
  await browser.close(); console.log('PWUNK OK');
})().catch(e => { console.error('FAIL', e); process.exit(1); });
