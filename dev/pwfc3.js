/* Фудкост: правила, план, версии, назначения, выгрузки. ЯВНО ТЕСТОВЫЕ данные «ТЕСТ …»; контрольные суммы посчитаны вручную */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const near = (x, y, m) => assert.ok(Math.abs(x - y) < 0.011, m + ': ' + x + ' ≠ ' + y);
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1100 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack||'').split('\n').slice(0,4).join(' / ')));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.goto('file://' + path.resolve(SRC));
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
  await page.reload(); await page.waitForSelector('#fcObj');
  await page.selectOption('#fcObj', '__new__'); await page.fill('#fcNewObj', 'ТЕСТ Столовая 2'); await page.dispatchEvent('#fcNewObj', 'change');
  await page.waitForFunction(() => /ТЕСТ Столовая 2/.test(document.querySelector('#fcObj').selectedOptions[0].textContent));
  await page.fill('input[data-act="fcFrom"]', '2026-10-01'); await page.dispatchEvent('input[data-act="fcFrom"]', 'change');
  await page.fill('input[data-act="fcTo"]', '2026-10-31'); await page.dispatchEvent('input[data-act="fcTo"]', 'change');
  await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, O = S.fc.sel.obj, FROM = '2026-10-01', TO = '2026-10-31';
    S.ings.tMeat = { id: 'tMeat', name: 'ТЕСТ Мясо', price: 400 };
    S.ings.tCarr = { id: 'tCarr', name: 'ТЕСТ Морковь', price: 40 };
    S.recipes.tRagu = { name: 'ТЕСТ Рагу', output: 250, rows: [{ rid: 'a', ing: 'tMeat', net: 100, gross: 120, share: 100 }, { rid: 'b', ing: 'tCarr', net: 70, gross: 80, share: 100 }], ref: {}, ttk: {}, op: {} };
    const ops = t => S.fc.ops[t] = S.fc.ops[t] || {};
    let n = 0; const add = (t, o) => { o.obj = O; o.id = 'x' + (++n); o.b = o.b || 'b' + t; ops(t)[o.id] = o; };
    S.fc.batches.bmoves = { id: 'bmoves', type: 'moves', obj: O, objName: 'ТЕСТ', from: FROM, to: TO, file: 'ТЕСТ', map: { open: 3, tin: 4, tout: 5, ret: 6, close: 7 } };
    add('receipts', { d: '2026-10-05', doc: 'T1', sup: 'ТЕСТ А', nm: 'ТЕСТ Мясо', u: 'кг', q: 20, s: 8400 });
    add('receipts', { d: '2026-10-06', doc: 'T2', sup: 'ТЕСТ Б', nm: 'ТЕСТ Морковь', u: 'кг', q: 10, s: 450 });
    add('receipts', { d: '2026-10-20', doc: 'T4', sup: 'ТЕСТ А', nm: 'ТЕСТ Морковь', u: 'кг', q: 10, s: 600 });
    add('receipts', { d: '2026-10-07', doc: 'T3', sup: 'ТЕСТ Б', nm: 'ТЕСТ Неизвестное', u: 'кг', q: 3, s: 99 });
    add('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 5, 'in': 20, out: 17, close: 8, b: 'bmoves' });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 5, fact: 5 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 8, fact: 7 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Рагу', q: 100, s: 30000 });
    add('writeoff', { d: '2026-10-12', nm: 'ТЕСТ Мясо', u: 'кг', q: 1, reason: 'порча', k: 'w' });
    add('writeoff', { d: '2026-10-13', nm: 'ТЕСТ Мясо', u: 'кг', q: 0.5, reason: 'питание персонала', k: 'i' });
    add('writeoff', { d: '2026-10-14', nm: 'ТЕСТ Рагу', u: 'шт', q: 2, reason: 'брак', k: 'w' });
    F.cfgSet('thr.unexRub', 1000); F.cfgSet('thr.shortRub', 300); F.cfgSet('thr.woQty', 1); F.cfgSet('thr.woPct', 1); F.cfgSet('thr.rawShare', 15);
  });
  await page.click('[data-act="fcView"][data-v="an"]');
  let t = (await page.textContent('.fcan')).replace(/\s+/g, ' ');
  assert.ok(/Итоги приблизительные/.test(t) && /основа НДС не задана/.test(t) && /Теоретический расход сырья/.test(t), 'анализ показывает ограничения: ' + t.slice(0, 300));
  await page.click('.fcmet button[data-id="act"]');
  t = (await page.textContent('.fcan')).replace(/\s+/g, ' ');
  assert.ok(/Формула:/.test(t) && /Ревизия, 01\.10\.2026/.test(t), 'показатель раскрывается до формулы и строк документов');
  await page.click('[data-act="fcView"][data-v="plan"]');
  await page.click('[data-act="fcBuild"]');
  await page.waitForSelector('.fcm');
  const model = () => page.evaluate(() => { const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to); return JSON.parse(JSON.stringify(F.planModel(p))); });
  let M = await model();
  const titles = M.items.map(i => i.title);
  console.log(titles.join(' | '));
  ['Необъяснённый расход: ТЕСТ Мясо', 'Недостача по ревизии: ТЕСТ Мясо', 'Высокие списания готового блюда: ТЕСТ Рагу', 'Высокая доля сырья в блюде: ТЕСТ Рагу', 'Рост закупочной цены: ТЕСТ Морковь', 'Разброс цен поставщиков: ТЕСТ Морковь', 'Несопоставленные позиции отчётов', 'Не задана основа НДС закупок и выручки'].forEach(x => assert.ok(titles.includes(x), 'есть мероприятие «' + x + '»'));
  // Мясо: потеря 1789,2 (необъяснённый расход и недостача — один объём, берётся наибольшая); Рагу: списанные порции 102,4 складываются с остальным;
  // «доля сырья Рагу» (620) и «цена моркови» (150) затрагивают один объём сырья: отдельные оценки, в итог не входят
  near(M.eff.pot, 1789.2 + 102.4, 'потенциал: определяемая часть без связной группы «блюдо × цена сырья»');
  assert.strictEqual(M.eff.groups, 2); assert.strictEqual(M.eff.partial, true); assert.strictEqual(M.eff.und.length, 1);
  assert.deepStrictEqual(M.eff.und[0].est.map(x => x.rub).sort((a, b) => a - b), [150, 620], 'отдельные оценки названы');
  assert.ok(/не обещается/.test(M.eff.note), M.eff.note);
  const ru = M.items.find(i => /Необъяснённый расход/.test(i.title));
  assert.strictEqual(ru.asg, 'Ответственный не назначен', 'исполнитель автоматически не назначается');
  assert.strictEqual(ru.basis, 'Подтверждённый факт');
  assert.ok(M.items.some(i => i.hyp && i.basis === 'Гипотеза'), 'есть гипотезы, и они так названы');
  assert.ok(M.items.every(i => i.role && ['технолог', 'управляющий', 'закупки', 'шеф-повар', 'бухгалтер'].includes(i.role)), 'предлагается только роль');
  assert.ok(M.items.every(i => !/виновн/i.test(JSON.stringify(i)) ), 'нет выводов о виновности');
  assert.ok(/согласова/.test(M.items.find(i => /Высокая доля сырья/.test(i.title)).act), 'изменение рецептуры только по согласованию технолога');
  // порядок: по баллам убывает
  assert.deepStrictEqual(M.items.map(i => i.id), (await page.evaluate(() => { const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to); return p.versions[0].items.map(i => i.id); })));
  // воспроизводимость: те же данные, другой порядок хранения, повторное построение
  const same = await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, s = S.fc.sel, a = JSON.stringify(F.planOf(s.obj, s.from, s.to).versions[0].items), fpa = F.fp(F.calc(s.obj, s.from, s.to)).fp;
    Object.keys(S.fc.ops).forEach(k => { const o = S.fc.ops[k], m = {}; Object.keys(o).reverse().forEach(x => m[x] = o[x]); S.fc.ops[k] = m; });
    const r = F.planBuild(s.obj, s.from, s.to);
    return { created: r.created, same: a === JSON.stringify(F.planOf(s.obj, s.from, s.to).versions[0].items), fp: fpa === F.fp(F.calc(s.obj, s.from, s.to)).fp, n: r.plan.versions.length };
  });
  assert.deepStrictEqual(same, { created: false, same: true, fp: true, n: 1 }, 'те же данные → та же сохранённая версия');
  // назначения, срок, статус, комментарий
  const mid = ru.id, card = '#m-' + mid;
  await page.selectOption(card + ' select[data-act="fcAsg"]', '__man__');
  await page.fill('#fcManName', 'ТЕСТ Иванов (бухгалтерия)'); await page.click(card + ' [data-act="fcAsgMan"]');
  await page.fill(card + ' input[data-act="fcDue"]', '2026-12-15'); await page.dispatchEvent(card + ' input[data-act="fcDue"]', 'change');
  await page.selectOption(card + ' select[data-act="fcSt"]', 'work');
  await page.fill('#fcCm-' + mid, 'ТЕСТ комментарий: проверить перемещения'); await page.click(card + ' [data-act="fcCm"]');
  M = await model(); let it = M.items.find(i => i.id === mid);
  assert.ok(/ТЕСТ Иванов \(бухгалтерия\) \(участник вне приложения, доступа не имеет\)/.test(it.asg) && /15\.12\.2026 \(выбран пользователем\)/.test(it.due) && it.st === 'В работе' && it.cm.length === 1 && it.hist.length >= 3);
  // открытие в другой день: срок не сдвигается
  const dueSug0 = M.items.find(i => i.id !== mid && /предложен/.test(i.due)).due;
  await page.evaluate(() => { const D = Date, off = 40 * 86400000; window.Date = class extends D { constructor(...a) { if (a.length) super(...a); else super(D.now() + off); } static now() { return D.now() + off; } }; });
  await page.click('[data-act="fcView"][data-v="an"]'); await page.click('[data-act="fcView"][data-v="plan"]');
  M = await model(); assert.strictEqual(M.items.find(i => i.id !== mid && /предложен/.test(i.due)).due, dueSug0, 'срок не сдвинулся при открытии в другой день');
  assert.ok(!(await page.evaluate(() => { const F = window.kbzhuFc, s = F.S.fc.sel; return F.planBuild(s.obj, s.from, s.to).created; })), 'открытие в другой день не создаёт версию');
  await page.evaluate(() => { window.Date = Object.getPrototypeOf(window.Date); });
  if (process.env.SHOT) { await page.screenshot({ path: 'shot_plan.png', fullPage: true }); await page.click('[data-act="fcView"][data-v="an"]'); await page.screenshot({ path: 'shot_an.png', fullPage: true }); await page.setViewportSize({ width: 390, height: 900 }); await page.screenshot({ path: 'shot_an_m.png', fullPage: true }); const ov = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); console.log('overflow-x mobile an:', ov); await page.click('[data-act="fcView"][data-v="plan"]'); await page.screenshot({ path: 'shot_plan_m.png', fullPage: true }); console.log('overflow-x mobile plan:', await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)); await page.setViewportSize({ width: 1300, height: 1100 }); }
  // выгрузки совпадают с планом на экране
  const ex = await page.evaluate(async () => {
    const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to), m = F.planModel(p);
    const dx = F.planDocx(m), xl = F.planXlsx(m), td = new TextDecoder();
    const doc = td.decode(await F.unzip(dx.buffer ? dx.buffer.slice(dx.byteOffset, dx.byteOffset + dx.byteLength) : dx, 'word/document.xml'));
    const xb = xl.buffer.slice(xl.byteOffset, xl.byteOffset + xl.byteLength); let sh = ''; for (const n of [1, 2, 3]) sh += td.decode(await F.unzip(xb, 'xl/worksheets/sheet' + n + '.xml'));
    const st = td.decode(await F.unzip(xl.buffer.slice(xl.byteOffset, xl.byteOffset + xl.byteLength), 'xl/styles.xml'));
    const x = s => s.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
    const pr = document.createElement('div'); pr.innerHTML = F.planPrintHtml(m);
    const screen = document.querySelector('.fcplan').innerText.replace(/\s+/g, ' ');
    return { doc: x(doc), xls: x(sh), styles: st.indexOf('wrapText') > -1, pdf: pr.innerText.replace(/\s+/g, ' '), screen, wrapCells: (sh.match(/ s="9"/g) || []).length, tblW: (doc.match(/<w:tblW w:w="(\d+)"/g) || []).map(a => +a.match(/\d+/)[0]), m };
  });
  const flat = s => s.replace(/ /g, ' ').replace(/\s+/g, ' ');
  const M2 = ex.m;
  const must = [M2.obj, M2.period, M2.verTxt, M2.fp];
  M2.items.forEach(i => { must.push(i.title, i.pri, i.asg, i.due, i.st, i.eff, i.basis, i.crit, i.check, i.act, ...i.ev.map(e => e.split(' (расчёт')[0])); });
  M2.metrics.forEach(m => must.push(m.l, m.v));
  for (const [name, txt] of [['Word', ex.doc], ['Excel', ex.xls], ['PDF', ex.pdf], ['экран', ex.screen]]) {
    const T = flat(txt); const miss = must.filter(x => !T.includes(flat(String(x).replace(/\n/g, ' ')))).slice(0, 5);
    assert.deepStrictEqual(miss, [], name + ' не содержит: ' + miss.join(' || '));
  }
  assert.ok(ex.styles && ex.wrapCells > 20, 'в Excel текст переносится по словам, не обрезается');
  assert.ok(ex.tblW.every(w => w <= 10466), 'таблицы Word помещаются в ширину страницы');
  assert.ok(/Гипотеза/.test(ex.doc) && /Гипотеза/.test(ex.xls) && /Гипотеза/.test(ex.pdf), 'гипотезы отмечены во всех форматах');
  assert.ok(/расчётная оценка|Потенциальная экономия — расчётная/.test(ex.doc) && /расчётная оценка/.test(ex.xls) || /Потенциальная экономия/.test(ex.xls), 'расчётный характер экономии указан');
  // новая версия: изменили данные → назначения сохраняются, различия объяснены
  await page.evaluate(() => { const F = window.kbzhuFc, S = F.S, O = S.fc.sel.obj; S.fc.ops.writeoff.xNEW = { id: 'xNEW', b: 'bwriteoff', obj: O, d: '2026-10-20', nm: 'ТЕСТ Рагу', u: 'шт', q: 2, reason: 'брак', k: 'w' }; });
  await page.click('[data-act="fcView"][data-v="an"]'); await page.click('[data-act="fcView"][data-v="plan"]');
  assert.ok(/Данные или настройки изменились/.test(await page.textContent('.fcplan')), 'об изменении данных сказано, план сам не пересобрался');
  assert.strictEqual((await model()).vers, 1);
  await page.click('.fcplan [data-act="fcBuild"]'); await page.waitForSelector('.fcm');
  M = await model(); assert.strictEqual(M.vers, 2); assert.strictEqual(M.ver, 2);
  it = M.items.find(i => i.id === mid);
  assert.ok(/ТЕСТ Иванов/.test(it.asg) && /15\.12\.2026/.test(it.due) && it.st === 'В работе' && it.cm.length === 1, 'исполнитель, срок, статус и комментарий сохранились после пересчёта');
  assert.ok(M.diff.some(x => /изменились данные отчётов/.test(x)) && M.diff.some(x => /Изменено: Высокие списания готового блюда/.test(x)), 'различия версий объяснены: ' + M.diff.join(' | '));
  // старая версия остаётся доступной без пересчёта
  await page.selectOption('select[data-act="fcVer"]', '1');
  assert.ok(/Открыта прежняя версия/.test(await page.textContent('.fcplan')));
  // неактуальное мероприятие: убрали списание блюда → «Больше не выявляется»
  await page.evaluate(() => { const F = window.kbzhuFc, S = F.S; delete S.fc.ops.writeoff.xNEW; Object.keys(S.fc.ops.writeoff).forEach(k => { if (S.fc.ops.writeoff[k].nm === 'ТЕСТ Рагу') delete S.fc.ops.writeoff[k]; }); });
  await page.selectOption('select[data-act="fcVer"]', '2');
  await page.click('[data-act="fcView"][data-v="an"]'); await page.click('[data-act="fcView"][data-v="plan"]'); await page.click('.fcplan [data-act="fcBuild"]'); await page.waitForSelector('.fcm');
  M = await model(); assert.strictEqual(M.vers, 3);
  assert.ok(M.stale.some(x => /Высокие списания готового блюда/.test(x.title)), 'неактуальное мероприятие предложено закрыть или архивировать');
  await page.click('.fcm.stale [data-act="fcArch"]');
  M = await model(); assert.ok(!M.stale.length);
  const hist = await page.evaluate(() => { const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to); return Object.values(p.state).filter(x => x.st === 'arch').map(x => x.hist.map(h => h.t)); });
  assert.ok(hist.length === 1 && hist[0].some(x => /архив/.test(x)), 'история сохранена');
  // сохранность после перезагрузки страницы
  await page.evaluate(() => window.kbzhuFcSaved()); 
  const before = JSON.stringify(await model());
  await page.reload(); await page.waitForSelector('#fcObj'); await page.evaluate(() => window.kbzhuFc.S.fc.ld || new Promise(r => setTimeout(r, 500)));
  await page.waitForFunction(() => window.kbzhuFc.S.fc.ld);
  const after = await page.evaluate(() => { const F = window.kbzhuFc, S = F.S, ids = Object.keys(S.fc.plans); return ids.length === 1 ? JSON.stringify(F.planModel(S.fc.plans[ids[0]])) : 'plans=' + ids.length; });
  assert.strictEqual(after, before, 'план после перезагрузки тот же');
  assert.deepStrictEqual(errs, []);
  console.log('OK fc3'); await browser.close();
})().catch(e => { console.error('FAIL', e.message, errs); process.exit(1); });
