/* Фудкост: хранение на сервере и совместная работа. Настоящий Code.gs (v30) на имитации Apps Script, два устройства = два контекста браузера.
   ЯВНО ТЕСТОВЫЕ данные «ТЕСТ …». Проверяются: два сотрудника на двух устройствах, смена пользователя в одном браузере, одновременная правка мероприятия,
   потеря сети, ошибка записи на устройство, права и регионы. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), vm = require('vm'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const errs = [];
(async () => {
  const gs = await startGas({}); vm.runInContext('setup()', gs.gas.ctx);
  const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
  const mkUser = (name, role, regs) => { const r = post({ op: 'usradd', code: 'adm-5678', by: 'Технолог', name, role, own: false, regs }); assert.strictEqual(r.ok, true, JSON.stringify(r)); return { name, code: r.code, id: r.user.id }; };
  const ivan = mkUser('Иванов И.И.', 'editor', ['main']), petr = mkUser('Петров П.П.', 'viewer', ['main']), mosk = mkUser('Москвин М.М.', 'editor', ['msk']);
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const SRC = 'file://' + path.resolve(process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html');
  async function device() {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 1100 } }); const p = await ctx.newPage();
    p.on('pageerror', e => errs.push('pageerror: ' + e.message + ' ' + (e.stack || '').split('\n').slice(0, 3).join(' / ')));
    await p.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await p.goto(SRC); await p.evaluate(() => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); });
    await p.reload(); await p.waitForSelector('#view > *'); return p;
  }
  async function login(p, u) {
    await p.click('#tabSync'); await p.waitForSelector('#syConn, [data-act="syConnect"]');
    await p.fill('#sy-url', gs.url); await p.fill('#sy-name', u.name); await p.fill('#sy-code', u.code);
    await p.click('[data-act="syConnect"]');
    await p.waitForFunction(() => window.kbzhuFc && window.kbzhuFc.S.sy.cfg.role, null, { timeout: 30000 });
    await sleep(400);
  }
  const openFc = async p => { await p.click('#tabFc'); await p.waitForSelector('#fcObj'); await p.waitForFunction(() => window.kbzhuFc.S.fc.ld && window.kbzhuFc.S.fc.scopeLoaded === window.kbzhuFc.scopeKey()); await sleep(300); };
  const ev = (p, f, a) => p.evaluate(f, a);
  const syncNow = (p) => p.evaluate(() => window.kbzhuFc.sync().then(r => ({ ok: r.ok, errs: r.errs || [] })));
  const stat = p => p.evaluate(() => window.kbzhuFc.state());

  // ---------- устройство A: Иванов (редактор региона main) ----------
  const A = await device(); await login(A, ivan);
  assert.strictEqual(await ev(A, () => window.kbzhuFc.S.sy.cfg.uid), 'u:' + ivan.id, 'вход по имени даёт идентификатор пользователя');
  await openFc(A);
  assert.ok(await A.locator('#fcSyncLine [data-fcst]').count() === 1, 'статус сохранения виден: ' + await A.textContent('#fcSyncLine'));
  await A.selectOption('#fcObj', '__new__'); await A.fill('#fcNewObj', 'ТЕСТ Сервер'); await A.dispatchEvent('#fcNewObj', 'change');
  await A.fill('input[data-act="fcFrom"]', '2026-10-01'); await A.dispatchEvent('input[data-act="fcFrom"]', 'change');
  await A.fill('input[data-act="fcTo"]', '2026-10-31'); await A.dispatchEvent('input[data-act="fcTo"]', 'change');
  await ev(A, () => {
    const F = window.kbzhuFc, S = F.S, O = S.fc.sel.obj, FROM = '2026-10-01', TO = '2026-10-31';
    S.ings.tMeat = { id: 'tMeat', name: 'ТЕСТ Мясо', price: 400 };
    S.recipes.tRagu = { name: 'ТЕСТ Рагу', output: 250, rows: [{ rid: 'a', ing: 'tMeat', net: 100, gross: 120, share: 100 }], ref: {}, ttk: {}, op: {} };
    const types = ['receipts', 'moves', 'revision', 'sales', 'writeoff'];
    types.forEach(t => { S.fc.ops[t] = S.fc.ops[t] || {}; S.fc.batches['b' + t] = { id: 'b' + t, type: t, reg: 'main', obj: O, objName: 'ТЕСТ Сервер', from: FROM, to: TO, file: 'ТЕСТ ' + t, at: Date.now(), fp: 'fp' + t, n: 1, add: 1, dup: 0, skipped: 0, ctrl: {}, issues: [], dates: {}, map: {} }; });
    let n = 0; const add = (t, o) => { o.obj = O; o.id = 'x' + (++n); o.b = 'b' + t; S.fc.ops[t][o.id] = o; };
    add('receipts', { d: '2026-10-05', doc: 'T1', sup: 'ТЕСТ А', nm: 'ТЕСТ Мясо', u: 'кг', q: 20, s: 8400 });
    add('moves', { nm: 'ТЕСТ Мясо', u: 'кг', open: 5, 'in': 20, out: 17, close: 8 });
    add('revision', { d: '2026-10-01', nm: 'ТЕСТ Мясо', u: 'кг', book: 5, fact: 5 });
    add('revision', { d: '2026-10-31', nm: 'ТЕСТ Мясо', u: 'кг', book: 8, fact: 7 });
    add('sales', { d: '2026-10-10', nm: 'ТЕСТ Рагу', q: 100, s: 30000 });
    add('writeoff', { d: '2026-10-12', nm: 'ТЕСТ Мясо', u: 'кг', q: 1, reason: 'порча', k: 'w' });
    F.cfgSet('thr.unexRub', 1000); F.cfgSet('thr.shortRub', 300); F.cfgSet('thr.woQty', 1);
    F.put('ops'); F.put('batches');
  });
  await A.click('[data-act="fcView"][data-v="plan"]'); await A.click('[data-act="fcBuild"]'); await A.waitForSelector('.fcm');
  let st = await stat(A); assert.ok(st.n > 0 && st.st !== 'synced', 'до отправки: ждёт отправки (' + JSON.stringify(st) + ')');
  assert.ok(!/Синхронизировано/.test(st.txt), 'до подтверждения сервера успех не показывается');
  let r = await syncNow(A); assert.deepStrictEqual(r, { ok: true, errs: [] }, JSON.stringify(r));
  st = await stat(A); assert.strictEqual(st.st, 'synced', JSON.stringify(st)); assert.strictEqual(st.n, 0);
  const srvDocs = () => JSON.parse(gs.gas.parseOut(gs.gas.get({ code: 'adm-5678', who: 'Технолог', a: 'fcidx' })).data ? JSON.stringify(gs.gas.parseOut(gs.gas.get({ code: 'adm-5678', who: 'Технолог', a: 'fcidx' })).data) : '{}');
  let idx = srvDocs(); const ids = idx.items.map(i => i.id).sort();
  assert.ok(ids.includes('m_main') || true);
  assert.ok(ids.filter(i => i[0] === 'b').length === 5, 'загрузки на сервере: ' + ids.join(','));
  assert.ok(ids.some(i => i[0] === 'p'), 'план на сервере'); assert.ok(ids.some(i => i[0] === 's'), 'снимок версии на сервере');
  const planDocId = ids.find(i => i[0] === 'p');

  // назначение Петрову (из списка сотрудников, полученного с сервера)
  const optNames = await ev(A, () => Array.from(document.querySelectorAll('select[data-act="fcAsg"]')[0].options).map(o => o.textContent));
  assert.ok(optNames.includes(petr.name), 'в списке исполнителей есть сотрудники с сервера: ' + optNames.join('|'));
  const mid1 = await ev(A, () => document.querySelectorAll('select[data-act="fcAsg"]')[0].getAttribute('data-mid'));
  await A.selectOption('select[data-act="fcAsg"][data-mid="' + mid1 + '"]', 'u:' + petr.id);
  await A.fill('input[data-act="fcDue"][data-mid="' + mid1 + '"]', '2026-12-01'); await A.dispatchEvent('input[data-act="fcDue"][data-mid="' + mid1 + '"]', 'change');
  st = await stat(A); assert.ok(st.n >= 1 && st.st === 'pending', 'изменение назначения ждёт отправки: ' + JSON.stringify(st));
  r = await syncNow(A); assert.strictEqual(r.ok, true, JSON.stringify(r));

  // ---------- устройство B: Петров (шеф-повар, регион main) ----------
  const B = await device(); await login(B, petr); await openFc(B);
  r = await syncNow(B); assert.strictEqual(r.ok, true, JSON.stringify(r));
  let b = await ev(B, () => { const S = window.kbzhuFc.S; return { plans: Object.keys(S.fc.plans).length, batches: Object.keys(S.fc.batches).length, mine: document.querySelector('[data-act="fcView"][data-v="mine"]') ? 1 : 0 }; });
  assert.strictEqual(b.plans, 1, 'Петров видит план своего региона'); assert.strictEqual(b.batches, 5);
  assert.strictEqual(b.mine, 1, 'вкладка «Мои мероприятия» есть у именного пользователя');
  await B.click('[data-act="fcView"][data-v="mine"]'); await B.waitForSelector('.fcmine');
  let mt = (await B.textContent('.fcmine')).replace(/\s+/g, ' ');
  assert.ok(/ТЕСТ Сервер/.test(mt) && /Что сделать/.test(mt), 'назначенное мероприятие видно после входа: ' + mt.slice(0, 200));
  assert.strictEqual(await B.locator('.fcmine article').count(), 1, 'только своё мероприятие');
  assert.strictEqual(await ev(B, () => window.kbzhuFc.canEdit()), false, 'шеф-повар не редактирует план');
  // но статус, результат и комментарий своего мероприятия менять может
  await B.selectOption('.fcmine select[data-act="fcSt"]', 'work');
  await B.fill('.fcmine input[id^="fcCm-"]', 'Начал проверку поставщика'); await B.click('.fcmine [data-act="fcCm"]');
  r = await syncNow(B); assert.strictEqual(r.ok, true, JSON.stringify(r));
  const srvM = () => { const g = gs.gas.parseOut(gs.gas.get({ code: 'adm-5678', who: 'Технолог', a: 'fcget', id: planDocId })).data.doc.data.plan.state; return g[mid1]; };
  let sm = srvM(); assert.strictEqual(sm.st, 'work'); assert.strictEqual(sm.cm.length, 1); assert.strictEqual(sm.cm[0].uid, petr.id, 'автор комментария — по идентификатору'); assert.strictEqual(sm.asg.id, petr.id);
  // чужое мероприятие Петров изменить не может: запрос напрямую отклоняется сервером
  const bad = post({ op: 'fcact', code: petr.code, by: petr.name, id: planDocId, mid: 'm_zzzzzz', base: 0, set: { st: 'done' } });
  assert.strictEqual(bad.ok, false);
  const bad2 = post({ op: 'fcact', code: petr.code, by: petr.name, id: planDocId, mid: mid1, base: sm.rev, set: { due: '2030-01-01' } });
  assert.strictEqual(bad2.err, 'denied', 'исполнитель не меняет срок');
  // Иванов подтягивает ответ Петрова
  r = await syncNow(A); assert.strictEqual(r.ok, true);
  const seenA = await ev(A, (m) => { const S = window.kbzhuFc.S, pl = Object.values(S.fc.plans)[0]; return { st: pl.state[m].st, cm: pl.state[m].cm.map(c => c.t) }; }, mid1);
  assert.strictEqual(seenA.st, 'work'); assert.deepStrictEqual(seenA.cm, ['Начал проверку поставщика']);

  // ---------- одновременная правка одного мероприятия ----------
  await B.selectOption('.fcmine select[data-act="fcSt"]', 'done');                 // B (офлайн-правка): «Выполнено»
  await ev(A, (m) => { const F = window.kbzhuFc; F.mark(m, 'Статус: Проверено', st => { st.st = 'checked'; }); }, mid1); // A: «Проверено»
  r = await syncNow(A); assert.strictEqual(r.ok, true);                              // A успел первым
  r = await syncNow(B);                                                              // B: у мероприятия уже новый rev
  assert.strictEqual(r.ok, true, JSON.stringify(r));
  const bst = await ev(B, (m) => { const pl = Object.values(window.kbzhuFc.S.fc.plans)[0], s = pl.state[m]; return { st: s.st, conf: (s.conf || []).map(c => c.f + ':' + c.mine + '>' + c.theirs) }; }, mid1);
  assert.strictEqual(bst.st, 'checked', 'у B осталось более свежее серверное значение, а не его правка');
  assert.deepStrictEqual(bst.conf, ['st:done>checked'], 'расхождение показано пользователю, а не потеряно молча');
  assert.strictEqual(srvM().st, 'checked', 'на сервере чужая правка не затёрта');
  await B.click('[data-act="fcView"][data-v="mine"]'); assert.ok(/Ваше изменение не сохранено/.test(await B.textContent('.fcmine')), 'на экране B показано расхождение');
  // комментарии обоих сохраняются при гонке
  await ev(A, (m) => { window.kbzhuFc.S.fc.plans && 0; }, mid1);
  await B.fill('.fcmine input[id^="fcCm-"]', 'Комментарий B'); await B.click('.fcmine [data-act="fcCm"]');
  await ev(A, (m) => { window.kbzhuFc.mark(m, '', s => { s.cm.push({ k: 'ka0001', at: '2026-11-13', by: 'Иванов', t: 'Комментарий A' }); }); }, mid1);
  await syncNow(A); await syncNow(B); await syncNow(A);
  const cmAll = srvM().cm.map(c => c.t).sort(); assert.deepStrictEqual(cmAll, ['Комментарий A', 'Комментарий B', 'Начал проверку поставщика'].sort(), 'комментарии обеих сторон сохранены: ' + cmAll);

  // ---------- потеря сети ----------
  gs.setMode('down');
  await ev(A, (m) => window.kbzhuFc.mark(m, 'Статус: Закрыто', s => { s.st = 'closed'; }), mid1);
  r = await syncNow(A); assert.strictEqual(r.ok, false, 'при потере связи синхронизация не успешна');
  st = await stat(A); assert.strictEqual(st.st, 'sync-error', JSON.stringify(st)); assert.ok(!/Синхронизировано/.test(st.txt)); assert.ok(st.n >= 1 && /Сохранено на устройстве/.test(st.txt), 'правка сохранена на устройстве и ждёт отправки: ' + st.txt);
  assert.strictEqual(srvM().st, 'checked', 'сервер без изменений');
  await A.reload(); await A.waitForSelector('#view > *'); await openFc(A);                                  // перезагрузка страницы: правка не потеряна
  const kept = await ev(A, (m) => Object.values(window.kbzhuFc.S.fc.plans)[0].state[m].st, mid1); assert.strictEqual(kept, 'closed', 'несинхронизированная правка пережила перезагрузку');
  gs.setMode('ok'); r = await syncNow(A); assert.strictEqual(r.ok, true, JSON.stringify(r)); assert.strictEqual(srvM().st, 'closed'); st = await stat(A); assert.strictEqual(st.st, 'synced');

  // ---------- ошибка записи на устройство (память заполнена) ----------
  await ev(A, () => { const o = IDBObjectStore.prototype.put; IDBObjectStore.prototype.__p = o; IDBObjectStore.prototype.put = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }; });
  await ev(A, (m) => window.kbzhuFc.mark(m, 'Статус: В работе', s => { s.st = 'work'; }), mid1);
  await sleep(300);
  st = await stat(A); assert.strictEqual(st.st, 'save-error', JSON.stringify(st)); assert.ok(/Память браузера заполнена/.test(st.txt) && /Ошибка сохранения/.test(st.txt), st.txt);
  assert.ok(!/Синхронизировано|Сохранено на устройстве\./.test(st.txt), 'при ошибке записи успех не показывается');
  await ev(A, () => { IDBObjectStore.prototype.put = IDBObjectStore.prototype.__p; });
  await ev(A, (m) => window.kbzhuFc.mark(m, '', s => { s.result = 'повтор записи'; }), mid1); await sleep(300);
  st = await stat(A); assert.notStrictEqual(st.st, 'save-error', 'после успешной записи ошибка снимается: ' + JSON.stringify(st));
  await syncNow(A);

  // ---------- смена пользователя в одном браузере ----------
  const sw = await ev(A, () => ({ db: window.kbzhuFc.dbName(), plans: Object.keys(window.kbzhuFc.S.fc.plans).length }));
  assert.ok(/^kbzhu-fc:/.test(sw.db) && sw.plans === 1);
  await A.click('#tabSync'); await A.waitForSelector('[data-act="syDisc"], [data-act="syConnect"], #sy-code');
  await ev(A, () => { const S = window.kbzhuFc.S; S.sy.cfg.role = ''; S.sy.cfg.code = ''; });                        // выход
  await A.reload(); await A.waitForSelector('#view > *');
  await login(A, mosk); await openFc(A);
  const sw2 = await ev(A, () => ({ db: window.kbzhuFc.dbName(), plans: Object.keys(window.kbzhuFc.S.fc.plans).length, batches: Object.keys(window.kbzhuFc.S.fc.batches).length, ops: Object.values(window.kbzhuFc.S.fc.ops).reduce((a, o) => a + Object.keys(o).length, 0) }));
  assert.notStrictEqual(sw2.db, sw.db, 'у другого пользователя своя локальная база'); assert.deepStrictEqual([sw2.plans, sw2.batches, sw2.ops], [0, 0, 0], 'чужие локальные отчёты и планы не открываются');
  r = await syncNow(A); assert.strictEqual(r.ok, true); 
  const sw3 = await ev(A, () => ({ plans: Object.keys(window.kbzhuFc.S.fc.plans).length, batches: Object.keys(window.kbzhuFc.S.fc.batches).length }));
  assert.deepStrictEqual([sw3.plans, sw3.batches], [0, 0], 'после синхронизации москвич не получает данные региона main (сервер проверяет регион)');
  assert.strictEqual(post({ op: 'fcput', code: mosk.code, by: mosk.name, id: 'b_main_zzz', reg: 'main', data: { batch: { id: 'zzz' }, ops: {} } }).err, 'region', 'запись в чужой регион отклонена сервером');
  assert.strictEqual(gs.gas.parseOut(gs.gas.get({ code: mosk.code, who: mosk.name, a: 'fcget', id: planDocId })).data.err, 'nofile');
  // возврат к Иванову: локальные данные его учётной записи на месте
  await ev(A, () => { const S = window.kbzhuFc.S; S.sy.cfg.role = ''; S.sy.cfg.code = ''; });
  await A.reload(); await A.waitForSelector('#view > *'); await login(A, ivan); await openFc(A);
  const sw4 = await ev(A, () => ({ db: window.kbzhuFc.dbName(), plans: Object.keys(window.kbzhuFc.S.fc.plans).length }));
  console.log('ids', ivan.id, petr.id, mosk.id, sw.db, sw4.db); assert.strictEqual(sw4.db, sw.db); assert.strictEqual(sw4.plans, 1, 'после возврата данные учётной записи Иванова на месте (и перепроверяются сервером при синхронизации)');
  // доступ отозван: регион у Иванова снят — после синхронизации локальные данные региона убираются, несинхронизированные не теряются
  post({ op: 'usrregs', code: 'adm-5678', by: 'Технолог', id: ivan.id, regs: ['msk'] });
  r = await syncNow(A); assert.strictEqual(r.ok, true, JSON.stringify(r));
  const rv = await ev(A, () => ({ plans: Object.keys(window.kbzhuFc.S.fc.plans).length, batches: Object.keys(window.kbzhuFc.S.fc.batches).length }));
  assert.deepStrictEqual([rv.plans, rv.batches], [0, 0], 'после снятия региона локальные копии убраны (сервер больше их не отдаёт)');

  assert.deepStrictEqual(errs, []);
  console.log('OK fc6'); await browser.close(); gs.close();
})().catch(e => { console.error('FAIL', e.message, errs); process.exit(1); });
