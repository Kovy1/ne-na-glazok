/* Декларации: реестр из нескольких деклараций, срок действия, автоотметка новых ТТК, замена проекта на номер; меню с ценами до входа (скрипт 31) и Excel. Данные «ТЕСТ». */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html');
const errs = [];
const REG = ['Реестр, вступительная строка: игнорируется.', '',
  'Декларация: ЕАЭС N RU Д-RU.РА08.В.00001/26', 'Дата регистрации: 22.09.2026', 'Действует по: 21.09.2031',
  'Заявляет, что: Изделия мучные кулинарные в ассортименте. Блины с джемом, Блинчики с мясом. Оладьи со сметаной', '',
  'Декларация: ЕАЭС N RU Д-RU.РА07.В.00002/26', 'Дата регистрации: 28.08.2020', 'Действует по: 27.08.2023',
  'Заявляет, что: Напитки: Компот из сухофруктов, Морс облепиховый', '',
  'Декларация: ЕАЭС N RU Д-RU.РА07.В.00003/26', 'Действует по: 03.09.2029',
  'Заявляет, что: Рыбные кулинарные изделия охлажденные в ассортименте: Котлета рыбная, Минтай, запечённый с маринадом'].join('\n');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const fails = []; const T = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '—', String(e.message).split('\n')[0].slice(0, 300)); } };
  const page = await (await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true })).newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + SRC);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu'); });
  await page.reload(); await page.waitForFunction(() => window.kbzhuDs);
  const J = (f, a) => page.evaluate(f, a);
  await J(() => { const D = window.kbzhuDs, S = D.S; S.recipes = {}; S.dsImp = null; S.ings.tA = { id: 'tA', name: 'ТЕСТ', p: 1, f: 1, c: 1, price: 100 };
    const R = (id, name, ds) => { S.recipes[id] = D.normRecipe({ name, output: 100, rows: [{ ing: 'tA', net: 100 }], sell: { main: 150 }, ds }); };
    R('b1', 'Блинчики с мясом 1/150 г'); R('b2', 'Оладьи со сметаной'); R('k1', 'Компот из сухофруктов'); R('f1', 'Котлета рыбная');
    R('p1', 'Минтай запечённый с маринадом', { main: { g: 'Рыба (проект)', n: '' } });
    R('x1', 'Чай с лимоном'); D.renderAll(); });
  await page.waitForSelector('#mList');
  const P = await J(t => { const D = window.kbzhuDs, ds = D.parseMany(t.split('\n'), 'реестр.txt'); D.addDocs(ds); D.renderAll(); return ds.map(d => ({ num: d.num, v: d.v, r: d.r, n: d.groups.reduce((a, g) => a + g.items.length, 0), title: d.title })); }, REG);
  await T('реестр: три декларации из одного файла, вступление пропущено', () => assert.deepStrictEqual(P.map(x => x.num), ['ЕАЭС N RU Д-RU.РА08.В.00001/26', 'ЕАЭС N RU Д-RU.РА07.В.00002/26', 'ЕАЭС N RU Д-RU.РА07.В.00003/26']));
  await T('реестр: срок действия и дата регистрации', () => { assert.strictEqual(P[0].v, '2031-09-21'); assert.strictEqual(P[0].r, '2026-09-22'); assert.strictEqual(P[2].v, '2029-09-03'); });
  await T('реестр: список без подзаголовка («в ассортименте. Блины …») разобран', () => assert.strictEqual(P[0].n, 3));
  await T('реестр: «Минтай, запечённый …» одна позиция', () => assert.strictEqual(P[2].n, 2));
  await J(() => { window.kbzhuDs.S.mExtra = true; window.kbzhuDs.renderAll(); });
  await page.click('[data-act="dsApply"]');
  const A = await J(() => { const S = window.kbzhuDs.S; return { b1: S.recipes.b1.ds && S.recipes.b1.ds.main, k1: S.recipes.k1.ds && S.recipes.k1.ds.main, p1: S.recipes.p1.ds.main, reg: window.kbzhuDs.regGet('main').length, html: document.querySelector('#mList').innerHTML, chips: document.querySelector('#mChips').textContent }; });
  await T('отметка: номер, срок и дата регистрации в ТТК', () => { assert.strictEqual(A.b1.n, 'ЕАЭС N RU Д-RU.РА08.В.00001/26'); assert.strictEqual(A.b1.v, '2031-09-21'); assert.strictEqual(A.b1.r, '2026-09-22'); });
  await T('проект заменён декларацией с номером («Минтай»)', () => { assert.strictEqual(A.p1.n, 'ЕАЭС N RU Д-RU.РА07.В.00003/26'); });
  await T('истёкшая декларация: значок «ДС истекла», отдельный фильтр, не считается задекларированным', () => { assert.ok(/ДС истекла/.test(A.html)); assert.ok(/Срок декларации истёк · 1/.test(A.chips), A.chips); assert.ok(/Задекларировано · 4/.test(A.chips), A.chips); });
  await T('реестр сохранён на устройстве', () => assert.strictEqual(A.reg, 3));
  // новая ТТК после загрузки деклараций → предложение отметить автоматически
  await J(() => { const D = window.kbzhuDs; D.S.recipes.f2 = D.normRecipe({ name: 'Морс облепиховый 1/200', output: 100, rows: [{ ing: 'tA', net: 100 }], sell: { main: 150 } }); D.S.recipes.b3 = D.normRecipe({ name: 'Блины с джемом', output: 100, rows: [{ ing: 'tA', net: 100 }] }); D.renderAll(); });
  const B = await J(() => ({ bar: (document.querySelector('.dsauto') || {}).textContent || '', auto: window.kbzhuDs.auto('main').map(x => x.id).sort() }));
  await T('новые ТТК: «Отметить по декларациям» предлагает 2 блюда', () => { assert.deepStrictEqual(B.auto, ['b3', 'f2']); assert.ok(/можно отметить 2 блюда/.test(B.bar), B.bar); });
  await page.click('[data-act="dsAutoGo"]');
  const C = await J(() => { const S = window.kbzhuDs.S; return { f2: S.recipes.f2.ds && S.recipes.f2.ds.main.n, b3: S.recipes.b3.ds && S.recipes.b3.ds.main.n, bar: !!document.querySelector('.dsauto'), x1: !!S.recipes.x1.ds }; });
  await T('автоотметка: номера проставлены, плашка исчезла, лишнее не отмечено', () => { assert.strictEqual(C.f2, 'ЕАЭС N RU Д-RU.РА07.В.00002/26'); assert.strictEqual(C.b3, 'ЕАЭС N RU Д-RU.РА08.В.00001/26'); assert.strictEqual(C.bar, false); assert.strictEqual(C.x1, false); });
  const X = await J(() => { const t = window.kbzhuDs.xlsx(), i = t.head.indexOf('Декларация действует по'), j = t.head.indexOf('Декларация о соответствии'), by = {}; t.rows.forEach(r => { by[r[0]] = [r[j], r[i]]; }); return by; });
  await T('Excel меню: срок действия и пометка об истёкшем сроке', () => { assert.deepStrictEqual(X['Котлета рыбная'], ['ЕАЭС N RU Д-RU.РА07.В.00003/26', '03.09.2029']); assert.deepStrictEqual(X['Компот из сухофруктов'], ['ЕАЭС N RU Д-RU.РА07.В.00002/26 (срок истёк)', '27.08.2023']); });
  // шеф-повар без финансов: фильтр по декларациям тоже есть
  await page.close();

  // ===== меню с ценами до входа: скрипт 31 отдаёт отметку
  const gs = await startGas();
  vm.runInContext('setup()', gs.gas.ctx);
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef', by: 'Технолог' }, b)).text);
  const rec = (name, sell, extra) => Object.assign({ name, output: 200, rows: [{ ing: 'i-aaa', in: 'Лук', net: 50, share: 100 }], ref: {}, ttk: {}, sell }, extra || {});
  assert.ok(post({ op: 'publish', code: 'adm-5678', items: [
    { kind: 'ing', sid: 'i-aaa', name: 'Лук', baseRev: 0, json: { name: 'Лук', p: 1, f: 1, c: 1, kind: 'table', source: '', price: 100 } },
    { kind: 'rec', sid: 'r-1', name: 'Суп ТЕСТ', baseRev: 0, json: rec('Суп ТЕСТ', { main: 180, msk: 200 }, { ds: { main: { g: 'Супы', n: 'ЕАЭС N RU Д-RU.ТЕСТ.1/26', v: '2031-08-27' }, 'bad key!': { n: 'x' } } }) },
    { kind: 'rec', sid: 'r-2', name: 'Салат ТЕСТ', baseRev: 0, json: rec('Салат ТЕСТ', { main: 150 }, { ds: { main: { g: 'Салаты', n: 'ЕАЭС N RU Д-RU.ТЕСТ.2/26', v: '2020-01-01' } } }) },
    { kind: 'rec', sid: 'r-3', name: 'Чай ТЕСТ', baseRev: 0, json: rec('Чай ТЕСТ', { main: 40 }) },
  ] }).ok);
  const menu = gs.gas.parseOut(gs.gas.get({ a: 'menu' })).data, by = {}; menu.items.forEach(x => { by[x.n] = x; });
  await T('скрипт 31: в меню без входа у блюда номер и срок декларации по регионам', () => { assert.deepStrictEqual(by['Суп ТЕСТ'].d, { main: { n: 'ЕАЭС N RU Д-RU.ТЕСТ.1/26', v: '2031-08-27' } }); assert.strictEqual(by['Чай ТЕСТ'].d, undefined); });
  await T('скрипт 31: название группы и источник в меню без входа не уходят', () => assert.ok(!JSON.stringify(menu).includes('Супы')));
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, acceptDownloads: true });
  await ctx.addInitScript(u => { window.KBZHU_URL = u; }, gs.url);
  const g = await ctx.newPage(); g.on('pageerror', e => errs.push('G: ' + e.message));
  await g.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await g.goto('file://' + SRC); await g.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'menu'); }); await g.reload();
  await g.waitForSelector('.gmrow', { timeout: 20000 });
  const G = await g.evaluate(() => ({ rows: Array.from(document.querySelectorAll('.gmrow .gmn b')).map(b => b.textContent.replace(/\s+/g, ' ').trim()), chips: (document.querySelector('[data-act="gmF"]') || {}).parentNode ? document.querySelector('[data-act="gmF"]').parentNode.textContent : '' }));
  await T('цены до входа: значки ДС и «ДС истекла»', () => assert.deepStrictEqual(G.rows, ['Салат ТЕСТ ДС истекла', 'Суп ТЕСТ ДС', 'Чай ТЕСТ']));
  await T('цены до входа: фильтры «Задекларировано · 1», «Без декларации · 2»', () => { assert.ok(/Задекларировано · 1/.test(G.chips), G.chips); assert.ok(/Без декларации · 2/.test(G.chips), G.chips); });
  await g.click('[data-act="gmF"][data-f="ds"]');
  await T('цены до входа: фильтр «Задекларировано» оставляет действующие', async () => { const r = await g.$$eval('.gmrow .gmn b', e => e.map(b => b.firstChild.textContent.trim())); assert.deepStrictEqual(r, ['Суп ТЕСТ']); });
  const dlp = g.waitForEvent('download'); await g.click('[data-act="gmXlsx"]'); await g.waitForTimeout(500); const dl = await dlp;
  const xp = '/tmp/pwds2_menu.xlsx'; await dl.saveAs(xp);
  const xs = require('child_process').execSync('unzip -p ' + xp + ' xl/worksheets/sheet1.xml xl/sharedStrings.xml 2>/dev/null || true', { encoding: 'utf8' });
  await T('цены до входа: Excel для меню на доставку — только задекларированные, номер и срок', () => { assert.ok(/Суп ТЕСТ/.test(xs) && /Д-RU\.ТЕСТ\.1\/26/.test(xs) && /27\.08\.2031/.test(xs), xs.slice(0, 300)); assert.ok(!/Чай ТЕСТ/.test(xs)); });
  await T('нет ошибок страницы', () => assert.deepStrictEqual(errs, []));
  await browser.close(); gs.close && gs.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
})();
