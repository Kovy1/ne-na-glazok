/* Фудкост: снимок исходных данных версии, зафиксированная версия и текущее выполнение, изменение цен и ТТК после построения,
   выгрузки Word/Excel/PDF по выбранному режиму, резервная копия и восстановление. ЯВНО ТЕСТОВЫЕ данные «ТЕСТ …». */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), fs = require('fs'), cp = require('child_process');
const errs = [];
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const SRC = 'file://' + path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html');
  async function mkPage() {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 1100 }, acceptDownloads: true }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' / ')));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(SRC); await page.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'fc'); });
    await page.reload(); await page.waitForSelector('#fcObj'); return page;
  }
  const page = await mkPage();
  await page.selectOption('#fcObj', '__new__'); await page.fill('#fcNewObj', 'ТЕСТ Версии'); await page.dispatchEvent('#fcNewObj', 'change');
  await page.fill('input[data-act="fcFrom"]', '2026-10-01'); await page.dispatchEvent('input[data-act="fcFrom"]', 'change');
  await page.fill('input[data-act="fcTo"]', '2026-10-31'); await page.dispatchEvent('input[data-act="fcTo"]', 'change');
  await page.evaluate(() => {
    const F = window.kbzhuFc, S = F.S, O = S.fc.sel.obj, FROM = '2026-10-01', TO = '2026-10-31';
    S.ings.tMeat = { id: 'tMeat', name: 'ТЕСТ Мясо', price: 400 };
    S.recipes.tRagu = { name: 'ТЕСТ Рагу', output: 250, rows: [{ rid: 'a', ing: 'tMeat', net: 100, gross: 120, share: 100 }], ref: {}, ttk: {}, op: {} };
    ['receipts', 'moves', 'revision', 'sales', 'writeoff'].forEach(t => { S.fc.ops[t] = S.fc.ops[t] || {}; S.fc.batches['b' + t] = { id: 'b' + t, type: t, reg: 'main', obj: O, objName: 'ТЕСТ Версии', from: FROM, to: TO, file: 'ТЕСТ ' + t, at: Date.now(), fp: 'fp' + t, n: 1, add: 1, dup: 0, skipped: 0, ctrl: {}, issues: [], dates: {}, map: {} }; });
    let n = 0; const add = (t, o) => { o.obj = O; o.id = 'x' + (++n); o.b = 'b' + t; S.fc.ops[t][o.id] = o; };
    add('receipts', { d: '2026-10-05', doc: 'T1', sup: 'ТЕСТ А', nm: 'ТЕСТ Мясо', u: 'кг', q: 20, s: 8400 });
    add('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 5, 'in': 20, out: 17, close: 8 });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 5, fact: 5 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 8, fact: 7 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Рагу', q: 100, s: 30000 });
    add('writeoff', { d: '2026-10-12', nm: 'ТЕСТ Мясо', u: 'кг', q: 1, reason: 'порча', k: 'w' });
    F.cfgSet('thr.unexRub', 1000); F.cfgSet('thr.shortRub', 300); F.cfgSet('thr.woQty', 1);
  });
  await page.click('[data-act="fcView"][data-v="plan"]'); await page.click('[data-act="fcBuild"]'); await page.waitForSelector('.fcm');
  const J = (f, a) => page.evaluate(f, a);
  const plan = () => J(() => { const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to); return JSON.parse(JSON.stringify(p)); });
  const model = (vn, mode) => J(([vn, mode]) => { const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to); return JSON.parse(JSON.stringify(F.planModel(p, vn, mode))); }, [vn, mode]);
  let P = await plan(); assert.strictEqual(P.versions.length, 1);
  const v1 = P.versions[0];
  assert.ok(v1.snapInfo && v1.snapInfo.n.ops === 6 && v1.snapInfo.n.recs === 1 && v1.snapInfo.n.ings === 1 && v1.snapInfo.n.batches === 5, 'снимок версии: ' + JSON.stringify(v1.snapInfo));
  assert.ok(/не подтверждённым состоянием прошлого периода|не считать подтверждённым|нельзя считать подтверждённым/.test(v1.snapWarn), 'предупреждение об историческом статусе цен и ТТК');
  assert.ok(v1.stFix && Object.keys(v1.stFix).length === v1.items.length, 'состояние на момент фиксации записано для каждого мероприятия');
  const snap1 = await J(() => window.kbzhuFc.snapGet(Object.keys(window.kbzhuFc.S.fc.plans)[0], 1).then(s => JSON.parse(JSON.stringify(s))));
  assert.strictEqual(snap1.ings.tMeat.price, 400); assert.strictEqual(snap1.recs.tRagu.rows[0].net, 100); assert.strictEqual(snap1.algo, v1.algo); assert.deepStrictEqual(Object.keys(snap1.ops).sort(), ['moves', 'receipts', 'revision', 'sales', 'writeoff']);
  assert.strictEqual(snap1.ops.receipts.length, 1); assert.strictEqual(snap1.cfg.thr.unexRub, 1000, 'пороги в снимке');
  let ver = await J(() => window.kbzhuFc.snapVerify(window.kbzhuFc.planOf(window.kbzhuFc.S.fc.sel.obj, '2026-10-01', '2026-10-31'), 1)); assert.strictEqual(ver.ok, true, JSON.stringify(ver));

  // ---------- зафиксированная версия не меняется при правках выполнения ----------
  const Mfix0 = await model(1, 'fixed'); assert.strictEqual(Mfix0.mode, 'fixed');
  const mids = Mfix0.items.map(i => i.id), mA = mids[0], mB = mids[1];
  await J(([a, b]) => { const F = window.kbzhuFc; F.mark(a, 'Назначен: Тестов', s => { s.asg = { t: 'manual', name: 'ТЕСТ Тестов' }; }); F.mark(a, 'Срок', s => { s.due = '2026-12-05'; }); F.mark(a, 'Статус: В работе', s => { s.st = 'work'; }); F.mark(b, '', s => { s.cm.push({ at: '2026-11-13', by: 'ТЕСТ', t: 'ТЕСТ комментарий' }); }); }, [mA, mB]);
  const Mfix1 = await model(1, 'fixed'), Mcur1 = await model(1, 'current');
  const strip = m => JSON.stringify(m.items.map(i => [i.id, i.asg, i.due, i.st, i.cm, i.hist]));
  assert.strictEqual(strip(Mfix1), strip(Mfix0), 'зафиксированная версия 1 не изменилась после правок ответственных, сроков, статусов и комментариев');
  assert.notStrictEqual(strip(Mcur1), strip(Mfix0)); assert.ok(Mcur1.items.find(i => i.id === mA).asg === 'ТЕСТ Тестов (участник вне приложения, доступа не имеет)' && Mcur1.items.find(i => i.id === mA).st === 'В работе');
  assert.strictEqual(Mfix1.stDate, Mfix0.stDate); assert.ok(Mfix1.modeTxt.indexOf('Зафиксированная версия') === 0 && /Дальнейшие изменения выполнения в этот документ не входят/.test(Mfix1.modeTxt));
  assert.ok(/С текущим состоянием выполнения/.test(Mcur1.modeTxt) && Mcur1.mode === 'current');

  // ---------- цены и ТТК изменены после построения плана ----------
  await J(() => { const S = window.kbzhuFc.S; S.ings.tMeat.price = 450; S.recipes.tRagu.rows[0].net = 110; });
  await page.click('[data-act="fcView"][data-v="an"]'); await page.click('[data-act="fcView"][data-v="plan"]');
  assert.ok(/Данные или настройки изменились после построения этой версии/.test(await page.textContent('.fcplan')), 'изменение цен и ТТК замечено');
  P = await plan(); assert.strictEqual(P.versions.length, 1, 'версия сама не пересоздаётся');
  const Mafter = await model(1, 'fixed'); assert.strictEqual(JSON.stringify(Mafter.metrics), JSON.stringify(Mfix0.metrics), 'показатели версии 1 не изменились от новых цен и ТТК');
  ver = await J(() => window.kbzhuFc.snapVerify(window.kbzhuFc.planOf(window.kbzhuFc.S.fc.sel.obj, '2026-10-01', '2026-10-31'), 1)); assert.strictEqual(ver.ok, true, 'расчёт по снимку воспроизводится и после изменения базы: ' + JSON.stringify(ver));
  const live = await J(() => { const F = window.kbzhuFc, s = F.S.fc.sel, res = F.calc(s.obj, s.from, s.to); return F.fp(res).fp; }); assert.notStrictEqual(live, v1.fp, 'расчёт по текущей базе уже другой');
  await page.click('[data-act="fcBuild"]'); await page.waitForFunction(() => document.querySelector('.fcplan select[data-act="fcVer"]').options.length === 2);
  P = await plan(); assert.strictEqual(P.versions.length, 2, 'пересчёт — отдельное действие, создана версия 2');
  const v2 = P.versions[1]; assert.ok(v2.diff.some(x => /изменились цены/.test(x)) && v2.diff.some(x => /ТТК/.test(x)), 'причина новой версии объяснена: ' + v2.diff.join(' / '));
  const snap1b = await J(() => window.kbzhuFc.snapGet(Object.keys(window.kbzhuFc.S.fc.plans)[0], 1).then(s => JSON.parse(JSON.stringify(s)))), snap2 = await J(() => window.kbzhuFc.snapGet(Object.keys(window.kbzhuFc.S.fc.plans)[0], 2).then(s => JSON.parse(JSON.stringify(s))));
  assert.strictEqual(snap1b.ings.tMeat.price, 400, 'снимок версии 1 остался прежним'); assert.strictEqual(snap2.ings.tMeat.price, 450); assert.strictEqual(snap2.recs.tRagu.rows[0].net, 110);
  assert.strictEqual(strip(await model(1, 'fixed')), strip(Mfix0), 'версия 1 после построения версии 2 осталась прежней');
  assert.ok(Object.keys(P.versions[1].stFix).includes(mA) && P.versions[1].stFix[mA].asg && P.versions[1].stFix[mA].asg.name === 'ТЕСТ Тестов', 'ручное назначение и история сохранены при пересчёте и записаны в версию 2');
  assert.ok(P.state[mA].hist.length >= 3, 'история изменений сохранена при пересчёте');
  assert.ok(!P.versions[0].stFix[mA].asg, 'в версии 1 назначения на момент фиксации не было');

  // ---------- выбор режима при скачивании ----------
  await page.selectOption('.fcplan select[data-act="fcVer"]', '1');
  assert.ok(/состояние мероприятий на момент её фиксации/.test(await page.textContent('.fcplan')), 'прежняя версия на экране показана в зафиксированном виде');
  await page.click('[data-act="fcDl"]');
  assert.ok(await page.isChecked('input[name="fcMode"][value="fixed"]'), 'для прежней версии по умолчанию «Зафиксированная версия»');
  assert.ok(/Зафиксированная версия/.test(await page.textContent('.fcmode')) && /С текущим состоянием выполнения/.test(await page.textContent('.fcmode')), 'выбор режима понятен');
  const exp = async (vn, mode) => J(async ([vn, mode]) => {
    const F = window.kbzhuFc, s = F.S.fc.sel, p = F.planOf(s.obj, s.from, s.to), m = F.planModel(p, vn, mode), td = new TextDecoder(), ab = u => u.buffer.slice(u.byteOffset, u.byteOffset + u.byteLength);
    const dx = F.planDocx(m), xl = F.planXlsx(m), pdf = F.planPdf(m);
    const x = t => t.replace(/<[^>]+>/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/\s+/g, ' ');
    const doc = x(td.decode(await F.unzip(ab(dx), 'word/document.xml')));
    let sh = ''; for (const n of [1, 2, 3]) sh += td.decode(await F.unzip(ab(xl), 'xl/worksheets/sheet' + n + '.xml'));
    let b = ''; for (let i = 0; i < pdf.length; i += 8192) b += String.fromCharCode.apply(null, pdf.subarray(i, i + 8192));
    return { doc, sheets: x(sh), pdf: btoa(b), asg: m.items.map(i => i.asg), st: m.items.map(i => i.st), mode: m.mode, modeName: m.modeName, stDate: m.stDate };
  }, [vn, mode]);
  const wr = (b64, f) => { fs.writeFileSync(f, Buffer.from(b64, 'base64')); return cp.execSync('pdftotext -layout ' + f + ' -', { encoding: 'utf8' }).replace(/\s+/g, ' '); };
  for (const [vn, mode, want] of [[1, 'fixed', 'Зафиксированная версия'], [1, 'current', 'С текущим состоянием выполнения'], [2, 'current', 'С текущим состоянием выполнения'], [2, 'fixed', 'Зафиксированная версия']]) {
    const e = await exp(vn, mode), m = await model(vn, mode);
    assert.strictEqual(e.mode, mode); assert.strictEqual(e.modeName, want);
    for (const [k, t] of [['Word', e.doc], ['Excel', e.sheets]]) {
      assert.ok(t.includes(want), vn + '/' + mode + ' ' + k + ': режим указан'); assert.ok(t.includes('на дату построения версии'), k + ': ограничение исторических данных названо в документе'); assert.ok(t.includes(e.stDate), k + ': дата состояния указана');
      m.items.forEach(i => { assert.ok(t.includes(i.asg.replace(/&/g, '&amp;')) || t.includes(i.asg), vn + '/' + mode + ' ' + k + ': исполнитель «' + i.asg + '» совпадает с выбранной версией'); assert.ok(t.includes(i.st), k + ': статус'); });
    }
    const f = '/tmp/fc_' + vn + '_' + mode + '.pdf', txt = wr(e.pdf, f); assert.ok(txt.includes('на дату построения версии'), 'PDF: ограничение исторических данных названо');
    assert.ok(txt.includes(want) && txt.includes(e.stDate), 'PDF: режим и дата состояния');
    m.items.forEach(i => { assert.ok(txt.includes(i.title.slice(0, 25)), 'PDF содержит мероприятие «' + i.title + '»'); });
    assert.ok(/ТЕСТ Версии/.test(txt) && /Стр\. 1 из/.test(txt), 'PDF: объект и колонтитул');
    const chk = cp.spawnSync('qpdf', ['--check', f], { encoding: 'utf8' }); assert.strictEqual(chk.status, 0, 'PDF структурно корректен: ' + chk.stdout + chk.stderr);
    assert.strictEqual(fs.readFileSync(f).slice(0, 5).toString(), '%PDF-');
    if (vn === 1 && mode === 'fixed') { assert.ok(m.items.every(i => i.asg === 'Ответственный не назначен'), 'в зафиксированной версии 1 никто не назначен'); assert.ok(/Ответственный не назначен/.test(txt)); }
    if (vn === 1 && mode === 'current') { assert.ok(txt.includes('ТЕСТ Тестов') && txt.includes('В работе'), 'в режиме «с текущим состоянием» видны текущие назначение и статус'); }
  }
  // файл PDF по кнопке: скачивание
  await J(() => { const o = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { window.__lastDl = this.download; return o.apply(this, arguments); }; });
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('[data-act="fcDlPdf"]')]);
  const pf = '/tmp/fc_btn.pdf'; await dl.saveAs(pf); const dn = await J(() => window.__lastDl); assert.ok(/\.pdf$/.test(dn) && /зафиксированная/.test(dn) && /версия 1/.test(dn), 'имя файла: ' + dn);
  assert.strictEqual(cp.spawnSync('qpdf', ['--check', pf]).status, 0);

  // ---------- резервная копия и восстановление ----------
  const bk = await J(() => window.kbzhuFc.backup());
  const B1 = JSON.parse(bk); assert.strictEqual(B1.app, 'kbzhu-fc-backup'); assert.strictEqual(Object.keys(B1.snaps).length, 2, 'в копии снимки обеих версий');
  assert.ok(B1.check, 'контрольная сумма');
  const page2 = await mkPage();
  let rs = await page2.evaluate(async t => { const r = await window.kbzhuFc.restore(t); return JSON.parse(JSON.stringify(r)); }, bk);
  assert.strictEqual(rs.ok, true, JSON.stringify(rs)); assert.strictEqual(rs.rep.plans, 1); assert.strictEqual(rs.rep.versions, 2); assert.strictEqual(rs.rep.batches, 5); assert.strictEqual(rs.rep.snaps, 2);
  const Q = await page2.evaluate(() => { const F = window.kbzhuFc, S = F.S, pl = Object.values(S.fc.plans)[0]; return { vers: pl.versions.map(v => v.fp), st: JSON.parse(JSON.stringify(pl.state)), ops: Object.values(S.fc.ops).reduce((a, o) => a + Object.keys(o).length, 0), batches: Object.keys(S.fc.batches).length, map: Object.keys(S.fc.map).length, thr: S.fc.cfg.thr && S.fc.cfg.thr.unexRub }; });
  assert.deepStrictEqual(Q.vers, P.versions.map(v => v.fp), 'версии восстановлены'); assert.deepStrictEqual(Q.st[mA].asg, P.state[mA].asg); assert.strictEqual(Q.st[mA].st, 'work'); assert.strictEqual(Q.st[mB].cm.length, 1, 'комментарии восстановлены');
  assert.strictEqual(Q.ops, 6); assert.strictEqual(Q.batches, 5); assert.strictEqual(Q.thr, 1000, 'настройки восстановлены');
  // снимок восстановлен и воспроизводит расчёт без исходной базы (в новом профиле цен и ТТК нет)
  const rv = await page2.evaluate(async () => { const F = window.kbzhuFc, pl = Object.values(F.S.fc.plans)[0]; return [await F.snapVerify(pl, 1), await F.snapVerify(pl, 2), !!F.S.ings.tMeat]; });
  assert.strictEqual(rv[0].ok, true, JSON.stringify(rv[0])); assert.strictEqual(rv[1].ok, true, JSON.stringify(rv[1])); assert.strictEqual(rv[2], false, 'в новом профиле общей базы нет: расчёт идёт из снимка');
  rs = await page2.evaluate(async t => JSON.parse(JSON.stringify(await window.kbzhuFc.restore(t))), bk);
  assert.deepStrictEqual([rs.rep.plans, rs.rep.versions, rs.rep.batches, rs.rep.ops, rs.rep.measures], [0, 0, 0, 0, 0], 'повторное восстановление ничего не дублирует');
  const tampered = bk.replace('ТЕСТ Тестов', 'ТЕСТ Взлом');
  rs = await page2.evaluate(async t => JSON.parse(JSON.stringify(await window.kbzhuFc.restore(t))), tampered); assert.strictEqual(rs.ok, false); assert.ok(/повреждён|контрольная/.test(rs.msg), rs.msg);
  rs = await page2.evaluate(async () => JSON.parse(JSON.stringify(await window.kbzhuFc.restore('{"a":1}')))); assert.strictEqual(rs.ok, false);
  rs = await page2.evaluate(async () => JSON.parse(JSON.stringify(await window.kbzhuFc.restore('не json')))); assert.strictEqual(rs.ok, false);
  // восстановленные данные пережили перезагрузку страницы (запись на устройство завершена)
  await page2.reload(); await page2.waitForSelector('#fcObj'); await page2.waitForFunction(() => window.kbzhuFc.S.fc.ld);
  assert.strictEqual(await page2.evaluate(() => Object.keys(window.kbzhuFc.S.fc.plans).length), 1);
  assert.strictEqual(await page2.evaluate(() => window.kbzhuFc.snapGet(Object.keys(window.kbzhuFc.S.fc.plans)[0], 2).then(s => !!s)), true, 'снимок версии на устройстве после перезагрузки');

  assert.deepStrictEqual(errs, []);
  console.log('OK fc7'); await browser.close();
})().catch(e => { console.error('FAIL', e.message, errs); process.exit(1); });
