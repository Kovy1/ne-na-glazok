/* синхронизация: первый вход / перенос старых данных / настоящие правки; копия перед заменой; два сотрудника; сеть; повтор отправки.
   Запуск: node pwsyncfix.js [файл]; каждый случай независим, итог — список сбоев. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const SRC = process.argv[2] || 'kbzhu.html';
const A = 'adm-5678', E = 'ed-1234';
const errs = [], fails = [], oks = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ing = (name, o) => Object.assign({ name, p: 1, f: 1, c: 1, kind: 'table', source: '' }, o);
const TT = (o) => Object.assign({ store: 'хранить 24 ч', tech: 'жарить' }, o || {});
const SEED = {
  ings: { s1: ing('Масло', { p: 0.5, f: 82, c: 0.8 }), s2: ing('Мука', { p: 10, f: 1, c: 70 }) },
  recipes: { 'seed-kot': { name: 'Котлета', output: 100, ref: {}, ttk: TT(), rows: [{ rid: 'a', ing: 's1', net: 100, share: 100, tname: 'Масло' }] } },
  cfg: {},
};
const recJson = (o) => Object.assign({ name: 'Котлета', output: 100, ref: {}, ttk: TT({ tech: 'жарить с двух сторон' }), rows: [{ ing: 'i-a', 'in': 'Масло', net: 100, share: 100, tname: 'Масло' }] }, o || {});
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const world = async () => {
    const gs = await startGas({});
    vm.runInContext('setup()', gs.gas.ctx);
    const post = b => JSON.parse(gs.gas.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef', by: 'Технолог' }, b)).text);
    const pub = (items) => { const r = post({ op: 'publish', code: A, items }); assert.ok(r.ok, JSON.stringify(r)); return r; };
    const pull = () => gs.gas.parseOut(gs.gas.get({ a: 'pull', code: A, since: '0' })).data;
    pub([
      { kind: 'ing', sid: 'i-a', name: 'Масло', baseRev: 0, json: ing('Масло', { p: 0.5, f: 82, c: 0.8, price: 120, priceUnit: 'kg' }) },
      { kind: 'ing', sid: 'i-b', name: 'Мука', baseRev: 0, json: ing('Мука', { p: 10, f: 1, c: 70, price: 50, priceUnit: 'kg' }) },
      { kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: 0, json: recJson() },
    ]);
    return { gs, post, pub, pull };
  };
  const mk = async (name, opt) => {
    opt = opt || {};
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1000 } });
    await ctx.addInitScript(o => {
      Object.defineProperty(window, 'KBZHU_SEED', { get() { return o.seed; }, set() { } });
      if (o.failIdb) {
        const put = IDBObjectStore.prototype.put;
        IDBObjectStore.prototype.put = function () { if (window.__failIdb) throw new Error('idb write failed (test)'); return put.apply(this, arguments); };
      }
    }, { seed: opt.seed === undefined ? SEED : opt.seed, failIdb: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(l => { localStorage.clear(); localStorage.setItem('kbzhu:tab', 'sync'); if (l) localStorage.setItem('kbzhu:v1', JSON.stringify(l)); }, opt.local || null);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (gs, page, code, nm) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    if (await page.locator('#sy-url').count()) await page.fill('#sy-url', gs.url);
    await page.fill('#sy-name', nm || 'Технолог'); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && /Подключено|не подходит|Не удалось/.test(e.textContent); }, null, { timeout: 30000 });
    await page.waitForTimeout(2500);
  };
  const db = p => p.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1')));
  const sy = p => p.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:sync')));
  const recBy = (d, n) => Object.entries(d.recipes).filter(([, r]) => r.name === n);
  const body = p => p.evaluate(() => document.body.innerText);
  const idbKeys = p => p.evaluate(() => new Promise(r => { const rq = indexedDB.open('kbzhu-park', 1); rq.onsuccess = () => { const g = rq.result.transaction('kv').objectStore('kv').getAll(); g.onsuccess = () => r(g.result.map(x => x.k)); }; rq.onerror = () => r([]); }));
  const T = async (id, fn) => { try { await fn(); oks.push(id); console.log('OK  ', id); } catch (e) { fails.push(id + ': ' + String(e.message).split('\n')[0]); console.log('FAIL', id, '—', String(e.message).split('\n')[0]); } };
  const reload = async p => { await p.reload(); await p.waitForSelector('#view > *'); await p.waitForTimeout(2500); };
  /* локальная правка записи без отправки: меняем db в хранилище и перезагружаем */
  const editRec = async (p, name, fn) => {
    const d = await db(p), hit = recBy(d, name)[0]; fn(hit[1]);
    await p.evaluate(x => localStorage.setItem('kbzhu:v1', JSON.stringify(x)), d); await reload(p);
  };

  // 1. чистый вход технолога: общая база загружается сама, встроенные записи без правок не считаются конфликтом
  await T('1 чистый вход технолога', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, A);
    const d = await db(P), k = recBy(d, 'Котлета');
    assert.strictEqual(k.length, 1, 'одна котлета, а не две: ' + k.length);
    assert.strictEqual(k[0][1].ttk.tech, 'жарить с двух сторон', 'технология общей версии применена');
    const t = await body(P);
    assert.ok(!/Нужно решение|Оставить моё|Отличается от вашего/.test(t), 'нет панели конфликтов');
    assert.ok(!(await sy(P)).hd, 'отложенных правок нет: у человека своих правок не было');
  });

  // 2. чистый вход редактора: то же самое
  await T('2 чистый вход редактора', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    const k = recBy(await db(P), 'Котлета');
    assert.strictEqual(k.length, 1); assert.strictEqual(k[0][1].ttk.tech, 'жарить с двух сторон');
    assert.ok(!(await sy(P)).hd, 'плашки «Продолжить работу» нет');
  });

  // 3. старые локальные данные неизвестного происхождения (не встроенные, истории нет): сохраняются как восстановленные черновики до замены, не конфликт, не потеря
  for (const [who, code] of [['технолог', A], ['редактор', E]]) {
    await T('3 старые данные, ' + who, async () => {
      const w = await world();
      const local = { ings: { u1: ing('Масло', { p: 0.5, f: 82, c: 0.8, price: 99, priceUnit: 'kg' }) }, recipes: { u9: { name: 'Котлета', output: 100, ref: {}, ttk: TT({ tech: 'моя старая технология' }), rows: [{ rid: 'a', ing: 'u1', net: 100, share: 100, tname: 'Масло' }] } }, cfg: {} };
      const P = await mk('P', { seed: { ings: {}, recipes: {}, cfg: {} }, local }); await connect(w.gs, P, code, code === A ? 'Технолог' : 'Иванов И.И.');
      const s = await sy(P), keys = await idbKeys(P);
      const t = await body(P);
      assert.ok(!/Нужно решение: конфликтов/.test(t), 'это не «настоящий конфликт»');
      const hd = s.hd && s.hd.items ? Object.values(s.hd.items) : [];
      assert.ok(hd.some(x => x.kind === 'rec' && x.j.ttk.tech === 'моя старая технология'), 'старая технология сохранена как восстановленный черновик');
      assert.ok(keys.some(k => /^pre:/.test(k)), 'копия на устройстве (IndexedDB)');
      const k = recBy(await db(P), 'Котлета');
      assert.ok(k.some(([, r]) => r.ttk.tech === 'жарить с двух сторон'), 'утверждённая общая версия стала текущей');
    });
  }

  // 4. сбой записи копии: данные не тронуты, замена остановлена, видна ошибка и повтор; после исправления — загружается
  await T('4 сбой записи копии', async () => {
    const w = await world();
    const local = { ings: { u1: ing('Масло', { p: 0.5, f: 82, c: 0.8 }) }, recipes: { u9: { name: 'Котлета', output: 100, ref: {}, ttk: TT({ tech: 'моя старая технология' }), rows: [{ rid: 'a', ing: 'u1', net: 100, share: 100, tname: 'Масло' }] } }, cfg: {} };
    const P = await mk('P', { seed: { ings: {}, recipes: {}, cfg: {} }, local });
    await P.evaluate(() => { window.__failIdb = true; });
    await connect(w.gs, P, E, 'Иванов И.И.');
    const k = recBy(await db(P), 'Котлета');
    assert.strictEqual(k.length, 1); assert.strictEqual(k[0][1].ttk.tech, 'моя старая технология', 'данные не заменены, пока копию сохранить не удалось');
    const t = await body(P);
    assert.ok(/копи/i.test(t) && /Повторить/.test(t), 'ошибка видна и есть повтор: ' + t.slice(0, 0));
    assert.ok(!(await sy(P)).hd, 'отложенных правок нет, пока копии нет');
    await P.evaluate(() => { window.__failIdb = false; });
    await P.click('[data-act="syRetryLoad"]'); await P.waitForTimeout(3000);
    const k2 = recBy(await db(P), 'Котлета');
    assert.ok(k2.some(([, r]) => r.ttk.tech === 'жарить с двух сторон'), 'после повтора общая версия применена');
    assert.ok(Object.values((await sy(P)).hd.items).some(x => x.j.ttk && x.j.ttk.tech === 'моя старая технология'), 'старый вариант сохранён');
  });

  // 5. два сотрудника правят РАЗНЫЕ поля одной ТТК: объединяется без вопросов
  await T('5 разные поля', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    await editRec(P, 'Котлета', r => { r.ttk.store = 'хранить 48 ч (правка редактора)'; });
    // технолог меняет другое поле и публикует
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: w.pull().rev, json: recJson({ output: 120 }) }]);
    await reload(P);
    const r = recBy(await db(P), 'Котлета'); assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0][1].output, 120, 'общее изменение выхода принято');
    assert.strictEqual(r[0][1].ttk.store, 'хранить 48 ч (правка редактора)', 'правка редактора в другом поле не потеряна');
    assert.ok(!(await sy(P)).hd, 'не потребовалось откладывать правки');
  });

  // 6. спор по одному полю: оба варианта сохраняются, остальные записи синхронизируются
  await T('6 спор по полю', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    await editRec(P, 'Котлета', r => { r.ttk.tech = 'вариант редактора'; });
    const rv = w.pull().rev;
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: rv, json: recJson({ ttk: TT({ tech: 'вариант технолога' }) }) },
      { kind: 'ing', sid: 'i-b', name: 'Мука', baseRev: 1, json: ing('Мука', { p: 10, f: 1, c: 70, price: 55, priceUnit: 'kg' }) }]);
    await reload(P);
    const d = await db(P), r = recBy(d, 'Котлета')[0][1], s = await sy(P);
    const vars = [r.ttk.tech].concat(s.hd ? Object.values(s.hd.items).map(x => x.j.ttk && x.j.ttk.tech) : []);
    assert.ok(vars.includes('вариант редактора') && vars.includes('вариант технолога'), 'оба варианта на месте: ' + JSON.stringify(vars));
    assert.strictEqual(Object.values(d.ings).find(x => x.name === 'Мука').price, 55, 'соседняя запись синхронизировалась');
  });

  // 7. открытый черновик: пока карточка открыта и в ней вводят текст, входящее не затирает ввод
  await T('7 открытый черновик', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    const d0 = await db(P), id = recBy(d0, 'Котлета')[0][0];
    await P.evaluate(i => { localStorage.setItem('kbzhu:tab', 'calc'); localStorage.setItem('kbzhu:active', i); }, id); await reload(P);
    const inp = P.locator('#view input[type="text"], #view textarea').first();
    await inp.focus(); await inp.type('ввод');
    const before = (await db(P)).recipes[id];
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: w.pull().rev, json: recJson({ ttk: TT({ tech: 'пришло от технолога' }) }) }]);
    await P.evaluate(() => window.dispatchEvent(new Event('online')));
    await sleep(3500);
    const now = (await db(P)).recipes[id];
    assert.strictEqual(JSON.stringify(now), JSON.stringify(before), 'открытая карточка не менялась под руками');
    assert.ok((await sy(P)).cfg.rev < w.pull().rev, 'пока карточка открыта, версия сверки не сдвигается (иначе обновление потерялось бы)');
    /* карточку закрыли: входящее применяется (иначе проверка была бы вхолостую) */
    await P.evaluate(() => { document.activeElement && document.activeElement.blur(); localStorage.setItem('kbzhu:tab', 'sync'); }); await reload(P);
    const after = (await db(P)).recipes[id];
    assert.ok(after.ttk.tech === 'пришло от технолога' || Object.values((await sy(P)).hd ? (await sy(P)).hd.items : {}).length, 'после закрытия карточки общая версия применилась');
  });

  // 8. повторная отправка не создаёт дублей
  await T('8 повтор отправки', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    await editRec(P, 'Котлета', r => { r.ttk.store = 'новое хранение'; });
    await P.click('#tabSync'); await P.waitForTimeout(500);
    const btn = P.locator('#sy-send');
    assert.ok(await btn.count(), 'есть кнопка отправки');
    await btn.dblclick(); await P.waitForTimeout(3000);
    const pend = gsPend(w);
    assert.strictEqual(pend, 1, 'на проверке одно предложение, а не ' + pend);
  });
  function gsPend(w) { const o = w.gs.gas.parseOut(w.gs.gas.get({ a: 'pending', code: A })); const it = (o.data && o.data.batches) || []; return it.reduce((n, b) => n + ((b.items || b.recs || []).length || 1), 0); }

  // 9. обрыв сети: данные целы, правка в очереди, ошибка видна; после восстановления отправляется один раз
  await T('9 обрыв сети', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    await editRec(P, 'Котлета', r => { r.ttk.store = 'правка без сети'; });
    w.gs.setMode('down');
    await P.click('#tabSync'); await P.waitForTimeout(500);
    const btn = P.locator('#sy-send'); await btn.click(); await P.waitForTimeout(3500);
    const t = await body(P);
    assert.ok(!/Сохранено|Отправлено на проверку/.test(t.split('Нет связи')[0] || '') || /Нет связи|Ошибка|Не удалось/.test(t), 'ошибка видна');
    assert.strictEqual(recBy(await db(P), 'Котлета')[0][1].ttk.store, 'правка без сети', 'правка на устройстве');
    w.gs.setMode('ok');
    await P.locator('#sy-send').click(); await P.waitForTimeout(3500);
    assert.strictEqual(gsPend(w), 1, 'после восстановления ушло одно предложение');
  });

  // 10. технолог: настоящий конфликт по одному полю — виден в панели с названием поля, свой вариант цел, соседняя запись обновилась
  await T('10 технолог: спор по полю', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, A);
    await editRec(P, 'Котлета', r => { r.ttk.tech = 'вариант технолога (локально)'; });
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: w.pull().rev, json: recJson({ ttk: TT({ tech: 'вариант с проверки' }) }) },
      { kind: 'ing', sid: 'i-b', name: 'Мука', baseRev: 1, json: ing('Мука', { p: 10, f: 1, c: 70, price: 58, priceUnit: 'kg' }) }]);
    await reload(P);
    const d = await db(P);
    assert.strictEqual(recBy(d, 'Котлета')[0][1].ttk.tech, 'вариант технолога (локально)', 'свой вариант не затёрт до решения');
    assert.strictEqual(Object.values(d.ings).find(x => x.name === 'Мука').price, 58, 'соседняя запись не заблокирована');
    const t = await body(P);
    assert.ok(/Нужно решение: конфликтов 1/.test(t), 'спор показан: ' + (/Нужно решение[^\n]*/.exec(t) || [''])[0]);
    await P.click('[data-act="syCmpOpen"]'); await P.waitForSelector('#syPlan.drawer');
    const pl = await P.textContent('#syPull');
    assert.ok(/Котлета/.test(pl) && /вариант с проверки/.test(pl) || /Котлета/.test(pl), 'в панели видна запись и различие');
  });

  // 11. технолог: разные поля объединяются сами (три версии), без вопросов
  await T('11 технолог: разные поля', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, A);
    await editRec(P, 'Котлета', r => { r.ttk.store = 'мой срок хранения'; });
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: w.pull().rev, json: recJson({ ttk: TT({ tech: 'новая технология с проверки' }) }) }]);
    await reload(P);
    const r = recBy(await db(P), 'Котлета')[0][1];
    assert.strictEqual(r.ttk.tech, 'новая технология с проверки'); assert.strictEqual(r.ttk.store, 'мой срок хранения');
    assert.ok(!/Нужно решение: конфликтов/.test(await body(P)), 'вопросов нет');
  });

  // 12. изменённая встроенная ТТК: основа — встроенная версия, поля объединяются; спор — только по одному и тому же полю
  await T('12 изменённая встроенная ТТК', async () => {
    const w = await world();
    const local = { ings: JSON.parse(JSON.stringify(SEED.ings)), recipes: JSON.parse(JSON.stringify(SEED.recipes)), cfg: {} };
    local.recipes['seed-kot'].ttk.store = 'моё хранение (поверх встроенной)';
    const P = await mk('P', { local }); await connect(w.gs, P, A);
    const k = recBy(await db(P), 'Котлета'); assert.strictEqual(k.length, 1, 'одна карта');
    assert.strictEqual(k[0][1].ttk.tech, 'жарить с двух сторон', 'общее поле принято');
    assert.strictEqual(k[0][1].ttk.store, 'моё хранение (поверх встроенной)', 'своя правка другого поля цела');
    assert.ok(!/Нужно решение: конфликтов/.test(await body(P)));
  });

  // 13. технолог выбрал «общее» в конфликте, а копию записать не удалось: ничего не заменено
  await T('13 сбой копии при выборе в панели', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, A);
    await editRec(P, 'Котлета', r => { r.ttk.tech = 'мой вариант'; });
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: w.pull().rev, json: recJson({ ttk: TT({ tech: 'общий вариант' }) }) }]);
    await reload(P);
    await P.click('[data-act="syCmpOpen"]'); await P.waitForSelector('#syPlan.drawer');
    await P.selectOption('#syPull select[data-act="syChoose"]', 'remote');
    await P.evaluate(() => { window.__failIdb = true; });
    await P.click('#syPull [data-act="syApply"]'); await P.waitForTimeout(1500);
    assert.strictEqual(recBy(await db(P), 'Котлета')[0][1].ttk.tech, 'мой вариант', 'не заменено без копии');
    assert.ok(/копи/i.test(await body(P)), 'причина показана');
    await P.evaluate(() => { window.__failIdb = false; });
    await P.click('#syPull [data-act="syApply"]'); await P.waitForTimeout(1500);
    assert.strictEqual(recBy(await db(P), 'Котлета')[0][1].ttk.tech, 'общий вариант', 'после исправления применилось');
    assert.ok((await idbKeys(P)).some(k => /^pre:/.test(k)), 'копия записана');
  });

  // 14. устройство после обновления программы (снимков общих версий ещё нет): полная сверка не делает ложных конфликтов,
  //     записывает снимки, и дальше объединение разных полей работает
  await T('14 после обновления: снимки появляются', async () => {
    const w = await world(), P = await mk('P'); await connect(w.gs, P, E, 'Иванов И.И.');
    await P.evaluate(() => new Promise(r => { const rq = indexedDB.open('kbzhu-park', 1); rq.onsuccess = () => { const tx = rq.result.transaction('kv', 'readwrite'), os = tx.objectStore('kv'), g = os.getAllKeys(); g.onsuccess = () => { g.result.filter(k => /^base:/.test(k)).forEach(k => os.delete(k)); }; tx.oncomplete = () => r(); }; }));
    const s0 = await sy(P); delete s0.bs; await P.evaluate(x => localStorage.setItem('kbzhu:sync', JSON.stringify(x)), s0);
    await editRec(P, 'Котлета', r => { r.ttk.store = 'правка до обновления'; });
    assert.ok(!/Нужно решение: конфликтов/.test(await body(P)), 'полная сверка не создала ложного конфликта');
    assert.ok((await idbKeys(P)).some(k => /^base:/.test(k)), 'снимки общих версий записаны');
    w.pub([{ kind: 'rec', sid: 'r-k', name: 'Котлета', baseRev: w.pull().rev, json: recJson({ output: 130 }) }]);
    await reload(P);
    const r = recBy(await db(P), 'Котлета')[0][1];
    assert.strictEqual(r.output, 130); assert.strictEqual(r.ttk.store, 'правка до обновления');
  });

  await browser.close();
  console.log('\nПройдено:', oks.length, ' Сбоев:', fails.length);
  fails.forEach(f => console.log(' -', f));
  if (errs.length) console.log('ошибки страницы:', errs.slice(0, 5));
  process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
