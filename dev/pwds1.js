/* Декларации о соответствии: разбор .docx и списка, сопоставление с ТТК, отметка в меню, фильтр, Excel, общая база.
   Данные синтетические («ТЕСТ»), кроме необязательной проверки на настоящих файлах: node pwds1.js <сборка> <папка с .docx>. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs');
const SRC = path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html'), REAL = process.argv[3] || '';
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 } })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + SRC);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu'); });
  await page.reload(); await page.waitForFunction(() => window.kbzhuDs && document.querySelector('#app, main, body'));
  const fails = []; const T = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '—', String(e.message).split('\n')[0].slice(0, 300)); } };
  const J = (f, a) => page.evaluate(f, a);
  await J(() => { const D = window.kbzhuDs; window.S = D.S; window.normRecipe = D.normRecipe; window.renderAll = D.renderAll; window.zipStore = D.zipStore; window.dsDocxParas = D.docxParas; window.dsParse = D.parse; window.dsAddDocs = D.addDocs; window.menuXlsxTable = D.xlsx; window.syCtx = D.ctx; window.syRecShared = D.shared; window.syRecToLocal = D.toLocal; window.syDiffItems = (k, a, b) => D.diff(k, a, b); window.regionName = null; });
  await J(() => {
    S.recipes = {}; S.dsImp = null;
    S.ings.tA = { id: 'tA', name: 'ТЕСТ сырьё', p: 10, f: 5, c: 5, price: 100 };
    const R = (id, name, num, extra) => { S.recipes[id] = Object.assign(normRecipe({ name, output: 100, rows: [{ ing: 'tA', net: 100 }], ttk: num ? { num } : {} }), extra || {}); };
    R('r1', 'Котлета мясная 1/100 г (ТТК №14)', '14');
    R('r2', 'Суп Кудрявый с курочкой 250/10 гр.', '362');
    R('r3', 'Котлета свиная рубленая', '');
    R('r4', 'Салат Оливье', '');
    R('r5', 'Пирожок печеный с вишней', '524');
    R('r6', 'Пицца по-домашнему', '27');
    R('r7', 'Компот из сухофруктов', '');
    R('r8', 'Голубцы с мясом и рисом', '');
    R('r9', 'Окрошка с ветчиной', '', { reg: 'msk' });
    renderAll();
  });
  await page.waitForSelector('#mList');
  // синтетический .docx в формате проекта декларации
  const parsed = await J(async () => {
    const paras = ['ЕВРАЗИЙСКИЙ ЭКОНОМИЧЕСКИЙ СОЮЗ', 'Заявитель: ТЕСТ', 'Заявляет, что: Первые обеденные блюда в ассортименте. Горячие супы: Суп кудрявый с курочкой, Борщ постный. Холодные супы: Окрошка с ветчиной',
      'Изготовитель: ТЕСТ', 'Регистрационный номер декларации о соответствии: ЕАЭС N RU Д-RU.РА01.В.ХХХХХХХХ',
      'Изделия кулинарные мясные рубленые формованные: Котлета мясная, Котлета свиная рубленная.', 'Изделия кулинарные мясосодержащие рубленые формованные: ',
      'Голубцы с мясом и рисом, Тефтели тестовые (убрать, так как название не соответствует)', 'Салаты с добавлением мяса: Салат «Оливье», Картофель, запеченный с паприкой',
      'Сроки годности при температуре 4±2°С: салаты – 12 часов'];
    const x = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    const xml = '<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + paras.map(p => '<w:p><w:r><w:t xml:space="preserve">' + x(p) + '</w:t></w:r></w:p>').join('') + '</w:body></w:document>';
    const zip = zipStore([{ name: 'word/document.xml', data: new TextEncoder().encode(xml) }]);
    const u8 = zip instanceof Uint8Array ? zip : new Uint8Array(zip);
    const ps = await dsDocxParas(u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength));
    const d = dsParse(ps, 'ТЕСТ декларация.docx');
    dsAddDocs([d]); renderAll();
    return { d, rows: S.dsImp.rows.map(r => ({ nm: r.nm, how: r.m.how, pick: r.pick, on: r.on, why: r.m.why || '' })) };
  });
  const row = nm => parsed.rows.find(r => r.nm === nm) || {};
  await T('docx: группы «Горячие супы», «Холодные супы» и группы приложения', () => { const g = parsed.d.groups.map(x => x.g); assert.deepStrictEqual(g, ['Горячие супы', 'Холодные супы', 'Изделия кулинарные мясные рубленые формованные', 'Изделия кулинарные мясосодержащие рубленые формованные', 'Салаты с добавлением мяса']); });
  await T('docx: номер-заглушка ХХХ не принят за номер', () => assert.strictEqual(parsed.d.num, ''));
  await T('docx: позиция с пометкой «убрать» не взята и названа', () => { assert.ok(!parsed.rows.some(r => /Тефтели/.test(r.nm))); assert.ok(parsed.d.notes.some(n => /Тефтели тестовые/.test(n))); });
  await T('docx: название с запятой не разорвано', () => assert.ok(parsed.rows.some(r => r.nm === 'Картофель, запеченный с паприкой')));
  await T('docx: строка «Сроки годности» не стала группой', () => assert.ok(!parsed.d.groups.some(g => /Сроки/.test(g.g))));
  await T('сопоставление: масса и № ТТК в названии карты не мешают (exact)', () => { assert.strictEqual(row('Котлета мясная').how, 'exact'); assert.strictEqual(row('Котлета мясная').pick, 'r1'); assert.strictEqual(row('Суп кудрявый с курочкой').how, 'exact'); });
  await T('сопоставление: кавычки «» не мешают', () => assert.strictEqual(row('Салат «Оливье»').pick, 'r4'));
  await T('сопоставление: «рубленная/рубленая» — почти совпадает, отмечено', () => { const r = row('Котлета свиная рубленная'); assert.strictEqual(r.how, 'close'); assert.strictEqual(r.on, true); });
  await T('сопоставление: блюдо другого региона не подбирается (Окрошка в Москве)', () => assert.strictEqual(row('Окрошка с ветчиной').how, 'none'));
  await T('сопоставление: нет в меню — «Борщ постный»', () => { assert.strictEqual(row('Борщ постный').how, 'none'); assert.strictEqual(row('Борщ постный').on, false); });
  // вставка списка из 1С (выпечка) через интерфейс
  await J(() => { S.mExtra = true; renderAll(); });
  await page.click('[data-act="dsPasteOpen"]');
  await page.fill('#dsText', '173 СО Пирожок печеный с вишней 45г ТТК №524\n181 СО Пицца по-домашнему 110г ТТК № 26\n186 СО Сосиска в тесте 85г ТТК 690');
  await page.fill('#dsTextG', 'ТЕСТ Выпечка'); await page.fill('#dsTextN', 'ЕАЭС N RU Д-RU.ТЕСТ.В.00001/26');
  await page.click('[data-act="dsPasteGo"]');
  const P2 = await J(() => S.dsImp.rows.filter(r => r.di === 1).map(r => ({ nm: r.nm, ttk: r.ttk, how: r.m.how, pick: r.pick, on: r.on, why: r.m.why || '' })));
  await T('список 1С: «СО», масса и № ТТК убраны из названия', () => assert.deepStrictEqual(P2.map(r => r.nm + '#' + r.ttk), ['Пирожок печеный с вишней#524', 'Пицца по-домашнему#26', 'Сосиска в тесте#690']));
  await T('список 1С: совпал № ТТК и название — отмечено', () => { assert.strictEqual(P2[0].how, 'exact'); assert.strictEqual(P2[0].on, true); });
  await T('список 1С: № ТТК не совпал — не отмечено, причина показана', () => { assert.strictEqual(P2[1].how, 'fuzzy'); assert.strictEqual(P2[1].on, false); assert.ok(/26.*27/.test(P2[1].why), P2[1].why); });
  // применение
  await page.click('[data-act="dsApply"]');
  const A = await J(() => ({ r1: S.recipes.r1.ds, r3: S.recipes.r3.ds, r5: S.recipes.r5.ds, r6: S.recipes.r6.ds || null, r7: S.recipes.r7.ds || null, badges: document.querySelectorAll('#mList .dsb').length, chips: document.querySelector('#mChips').textContent }));
  await T('отметка: группа и пустой номер (проект) у котлеты', () => { assert.strictEqual(A.r1.main.g, 'Изделия кулинарные мясные рубленые формованные'); assert.strictEqual(A.r1.main.n, ''); assert.strictEqual(A.r1.main.src, 'ТЕСТ декларация.docx'); });
  await T('отметка: номер из вставки у пирожка', () => assert.strictEqual(A.r5.main.n, 'ЕАЭС N RU Д-RU.ТЕСТ.В.00001/26'));
  await T('отметка: без подтверждения (пицца, № не совпал) и не задекларированное — без отметки', () => { assert.strictEqual(A.r6, null); assert.strictEqual(A.r7, null); });
  await T('меню: значки ДС у 6 блюд (котлеты 2, суп, оливье, голубцы, пирожок)', () => assert.strictEqual(A.badges, 6));
  await T('меню: фильтры «Задекларировано · 6» и «Без декларации · 2»', () => { assert.ok(/Задекларировано · 6/.test(A.chips), A.chips); assert.ok(/Без декларации · 2/.test(A.chips), A.chips); });
  await page.click('[data-act="mFlt"][data-f="nods"]');
  await T('фильтр «Без декларации»: пицца и компот', async () => { const n = await J(() => Array.from(document.querySelectorAll('#mList .mrow .mn b')).map(b => b.textContent).sort()); assert.deepStrictEqual(n, ['Компот из сухофруктов', 'Пицца по-домашнему']); });
  await page.click('[data-act="mFlt"][data-f="all"]');
  const X = await J(() => { const t = menuXlsxTable(), i = t.head.indexOf('Декларация о соответствии'), by = {}; t.rows.forEach(r => { by[r[0]] = r[i]; }); return { i, by }; });
  await T('Excel меню: колонка «Декларация о соответствии»', () => { assert.ok(X.i > 0); assert.strictEqual(X.by['Котлета мясная 1/100 г (ТТК №14)'], 'да, номер не указан'); assert.strictEqual(X.by['Пирожок печеный с вишней'], 'ЕАЭС N RU Д-RU.ТЕСТ.В.00001/26'); assert.strictEqual(X.by['Компот из сухофруктов'], ''); });
  const Y = await J(() => { const ctx = syCtx(), sh = syRecShared(ctx, 'r1'), loc = syRecToLocal(ctx, JSON.parse(JSON.stringify(sh))), old = JSON.parse(JSON.stringify(sh)); delete old.ds; return { sh: sh.ds, loc: loc.ds || (loc.r && loc.r.ds) || null, diff: syDiffItems('rec', old, sh).map(x => x.l + ' ' + (x.a || '') + ' → ' + (x.b || '')), plain: syRecShared(ctx, 'r7').ds }; });
  await T('общая база: отметка уходит вместе с ТТК и возвращается при загрузке', () => { assert.ok(Y.sh && Y.sh.main && Y.sh.main.g); assert.ok(Y.loc && Y.loc.main, JSON.stringify(Y.loc)); });
  await T('общая база: у неотмеченных ТТК поля нет (без лишних изменений)', () => assert.strictEqual(Y.plain, undefined));
  await T('«Что изменилось»: строка про декларацию', () => assert.ok(Y.diff.some(s => /^декларация \(/.test(s)), JSON.stringify(Y.diff)));
  // другой регион
  await T('Москва: значков нет, фильтров нет', async () => { const r = await J(() => { S.region = 'msk'; renderAll(); const o = { b: document.querySelectorAll('#mList .dsb').length, c: document.querySelector('#mChips').textContent }; S.region = 'main'; renderAll(); return o; }); assert.strictEqual(r.b, 0); assert.ok(!/Задекларировано/.test(r.c)); });
  // снятие группы
  await J(() => { S.dsOpen = true; S.mExtra = true; renderAll(); });
  await page.evaluate(() => { document.querySelectorAll('#dsPanel details.dsg').forEach(d => d.open = true); });
  await page.click('[data-act="dsOffG"][data-g="Изделия кулинарные мясные рубленые формованные"]');
  await T('снятие отметок группы', async () => { const r = await J(() => [!!S.recipes.r1.ds, !!S.recipes.r3.ds, !!S.recipes.r5.ds, document.querySelectorAll('#mList .dsb').length]); assert.deepStrictEqual(r, [false, false, true, 4]); });
  // шеф-повар (только чтение): значок виден, кнопок управления нет
  await T('только чтение: управления нет, значки видны', async () => { const r = await J(() => { S.readOnly = true; renderAll(); const o = { pick: !!document.querySelector('[data-act="dsPick"]'), off: !!document.querySelector('[data-act="dsOff"]'), b: document.querySelectorAll('#mList .dsb').length }; S.readOnly = false; renderAll(); return o; }); assert.deepStrictEqual(r, { pick: false, off: false, b: 4 }); });
  await T('сохранение: отметка переживает перезагрузку', async () => { await page.waitForTimeout(1500); await page.reload(); await page.waitForFunction(() => window.kbzhuDs && window.kbzhuDs.S.loaded && window.kbzhuDs.S.loaded.recipes); const r = await J(() => (window.kbzhuDs.S.recipes.r5 || {}).ds && window.kbzhuDs.S.recipes.r5.ds.main.n); assert.strictEqual(r, 'ЕАЭС N RU Д-RU.ТЕСТ.В.00001/26'); });
  if (REAL) {
    const files = fs.readdirSync(REAL).filter(f => /\.docx$/i.test(f));
    const res = [];
    for (const f of files) { const b64 = fs.readFileSync(path.join(REAL, f)).toString('base64'); res.push(await J(async ([b64, f]) => { const D = window.kbzhuDs, u = Uint8Array.from(atob(b64), c => c.charCodeAt(0)); const d = D.parse(await D.docxParas(u.buffer), f); return { f, n: d.groups.reduce((a, g) => a + g.items.length, 0), g: d.groups.length, notes: d.notes.length }; }, [b64, f])); }
    console.log('настоящие файлы:', JSON.stringify(res));
  }
  await T('нет ошибок страницы', () => assert.deepStrictEqual(errs, []));
  await browser.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
})();
