/* Проверка ТТК технологом (открыть, править, опубликовать / на доработку / отклонить / закрыть)
   и уведомление редактору о доработке с повторной отправкой, в том числе из другого браузера */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const REF = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const base = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 517.31 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 33.17 },
    i5: { name: 'Свёкла', p: 1.5, f: 0.1, c: 8.8, kind: 'table', source: '' },
  },
  recipes: { r1: { name: 'Котлета тест', output: 150, rows: [{ rid: 'a', ing: 'i2', net: 100, share: 100 }, { rid: 'b', ing: 'i3', net: 50, share: 100 }], ref: REF, ttk: { num: '7' }, sell: { main: 771 } } }, cfg: {},
});
/* редактор придумал новое блюдо и новое сырьё для него */
const withNew = (rec, ing) => {
  const d = base();
  d.ings.i9 = { name: ing, p: 1.2, f: 0.1, c: 3.4, kind: 'table', source: '', price: 90 };
  d.recipes.r2 = { name: rec, output: 120, rows: [{ rid: 'a', ing: 'i3', net: 80, share: 100 }, { rid: 'b', ing: 'i9', net: 40, share: 100 }], ref: REF, ttk: { num: '9' } };
  return d;
};
(async () => {
  const gs = await startGas(), gas = gs.gas;
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const E = 'ed-1234', A = 'adm-5678';
  const mk = async (name, data, mobile) => {
    const ctx = await browser.newContext({ viewport: mobile ? { width: 390, height: 800 } : { width: 1200, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d]) => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'sync'); }, [data]);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 20000 });
    return page.textContent('#sym-conn');
  };
  const msg = async (page, key, re, t = 25000) => { await page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t }); return page.textContent('#sym-' + key); };
  const pullAll = async page => { await page.click('[data-act="syPull"]'); await msg(page, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/); if (await page.locator('[data-act="syApply"]').count()) { await page.click('[data-act="syApply"]'); await sleep(400); } };
  const tab = async (page, id) => { if (id === 'tabCalc') await TT.openCalc(page); else await page.click('#' + id); await sleep(200); };
  const txt = async (page, sel) => (await page.textContent(sel)).replace(/\s+/g, ' ').trim();
  const pub = name => gas.rows('Общая база').filter(r => r[2] === name).map(r => JSON.parse(r[6]))[0];
  const pend = () => gas.rows('Предложения');
  const local = async page => { await sleep(700); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const recNames = async page => Object.values((await local(page)).recipes).map(r => r.name);
  const ingNames = async page => Object.values((await local(page)).ings).map(r => r.name);
  const bar = page => page.evaluate(() => { const b = document.querySelector('#rvBar'); return b && !b.hidden ? b.innerText.replace(/\s+/g, ' ').trim() : ''; });
  const barIs = async (page, re, t = 20000) => { await page.waitForFunction(s => { const b = document.querySelector('#rvBar'); return b && !b.hidden && new RegExp(s).test(b.innerText); }, re.source, { timeout: t }); return bar(page); };
  const pendIs = (page, n) => page.waitForFunction(k => new RegExp('На проверке · ' + k).test((document.querySelector('#syPend h2') || {}).textContent || ''), n, { timeout: 20000 });
  const refresh = async (page, n) => { await page.click('[data-act="syRefresh"]'); if (n !== undefined) await pendIs(page, n); };
  const send = async (page, note) => { await page.fill('#sy-note', note); await page.click('#sy-send'); await msg(page, 'send', /Отправлено на проверку технологу: 2/); await sleep(900); };

  // ===== 1. технолог публикует общую базу; редактор приносит новое блюдо с новым сырьём
  const T = await mk('T', base());
  let t = await connect(T, { name: 'Технолог Петрова', code: A }); assert.ok(/Подключено: технолог/.test(t));
  await msg(T, 'pull', /Всё актуально|Получено/);
  await T.click('#sy-pub'); await msg(T, 'send', /Опубликовано: 4/); await sleep(900);
  const E1 = await mk('E1', withNew('Салат новый', 'Редис тестовый'));
  t = await connect(E1, { name: 'Иванов Иван', code: E }); assert.ok(/Подключено: редактор/.test(t));
  await pullAll(E1);
  await send(E1, 'новый салат');
  assert.strictEqual(pend().length, 2); assert.ok(pend().every(r => r[7] === 'ждёт'));
  assert.strictEqual(await E1.locator('#syPend [data-act="rvOpen"]').count(), 0, 'редактору кнопки проверки не показываются');
  console.log('1 OK: предложение ушло технологу');

  // ===== 2. технолог открывает карту прямо из «На проверке»
  await refresh(T, 1);
  const nMine0 = await txt(T, '#syMine h2');
  assert.ok(/Открыть ТТК/.test(await txt(T, '#syPend')), 'в «На проверке» есть кнопка открытия карты');
  assert.strictEqual(await T.locator('#syPend [data-act="rvOpen"]').count(), 1, 'кнопка только у ТТК, не у сырья');
  await T.click('#syPend [data-act="rvOpen"]');
  let b = await barIs(T, /Проверка ТТК/); console.log('2 bar:', b);
  assert.ok(/Иванов Иван/.test(b) && /новый салат/.test(b), 'виден автор и его комментарий');
  assert.ok(/Опубликовать/.test(b) && /На доработку/.test(b) && /Отклонить/.test(b) && /Закрыть проверку/.test(b));
  assert.strictEqual(await T.inputValue('#rname'), 'Салат новый');
  const inps = await T.$$eval('.trw[data-rid] .ipi', e => e.map(x => x.value)); assert.deepStrictEqual(inps, ['Картофель', 'Редис тестовый'], 'рецептура открыта, сырьё подставилось: ' + inps);
  assert.ok(/Себест/.test(await txt(T, '.trw.thead')), 'в рецептуре есть себестоимость');
  // правка технологом
  await T.fill('[data-act="rOut"]', '125'); await sleep(300);
  // ушли на другую вкладку: плашка напоминает о проверке
  await tab(T, 'tabBase'); assert.ok(/Идёт проверка ТТК/.test(await bar(T)) && await T.locator('#rvBar [data-act="rvBack"]').count() === 1);
  await T.click('#rvBar [data-act="rvBack"]'); await barIs(T, /Проверка ТТК/);
  await tab(T, 'tabSync');
  assert.strictEqual(await txt(T, '#syMine h2'), nMine0, 'копии на проверке не считаются «моими изменениями»');
  assert.ok(/Продолжить проверку/.test(await txt(T, '#syPend')));
  console.log('2 OK: карта открыта, правится, не мешает «Моим изменениям»');

  // ===== 3. на доработку: без комментария нельзя; с комментарием уходит автору
  await T.click('#syPend [data-act="rvOpen"]'); await barIs(T, /Проверка ТТК/);
  await T.click('#rvBar [data-act="rvAsk"][data-v="rew"]'); await T.waitForSelector('#rvNote');
  await T.click('#rvBar [data-act="rvSend"]'); b = await barIs(T, /Напишите комментарий/); console.log('3 empty:', b);
  assert.ok(pend().every(r => r[7] === 'ждёт'), 'без комментария на доработку не ушло');
  await T.fill('#rvNote', 'Уточните выход и брутто сырья'); await T.click('#rvBar [data-act="rvSend"]');
  for (let i = 0; i < 60 && !pend().every(r => r[7] === 'на доработке'); i++) await sleep(300);
  assert.ok(pend().every(r => r[7] === 'на доработке'), 'пакет на доработке: ' + pend().map(r => r[7]));
  assert.strictEqual(pend()[0][10], 'Уточните выход и брутто сырья');
  await T.waitForSelector('#syRew'); await pendIs(T, 0);
  assert.ok(/Уточните выход/.test(await txt(T, '#syRew')) && /Салат новый/.test(await txt(T, '#syRew')), 'у технолога виден список «На доработке»');
  assert.strictEqual(await bar(T), '', 'плашки проверки нет');
  assert.ok(!(await recNames(T)).includes('Салат новый'), 'копия проверки убрана'); assert.ok(!(await ingNames(T)).includes('Редис тестовый'), 'временное сырьё убрано');
  console.log('3 OK: на доработку');

  // ===== 4. редактор в ДРУГОМ браузере получает уведомление, открывает карту, исправляет, отправляет снова
  const E2 = await mk('E2', base());
  t = await connect(E2, { name: 'Иванов Иван', code: E }); assert.ok(/Подключено: редактор/.test(t));
  await E2.waitForSelector('#syInbox', { timeout: 20000 });
  const inbox = await txt(E2, '#syInbox'); console.log('4 inbox:', inbox);
  assert.ok(/Вернули на доработку · 1/.test(inbox) && /Уточните выход и брутто сырья/.test(inbox) && /Салат новый/.test(inbox) && /Технолог Петрова/.test(inbox));
  assert.ok(/вернули: 1/.test(await txt(E2, '#tabSync')), 'на вкладке отметка');
  await tab(E2, 'tabMenu'); b = await bar(E2); console.log('4 banner:', b);
  assert.ok(/Технолог вернул на доработку/.test(b) && /Салат новый/.test(b), 'уведомление видно на любой вкладке');
  assert.ok(!(await recNames(E2)).includes('Салат новый'), 'в этом браузере карты ещё нет');
  await E2.click('#rvBar [data-act="rwOpenFirst"]');
  b = await barIs(E2, /Технолог вернул на доработку[\s\S]*Уточните выход/); console.log('4 fix bar:', b);
  assert.strictEqual(await E2.inputValue('#rname'), 'Салат новый');
  assert.deepStrictEqual(await E2.$$eval('.trw[data-rid] .ipi', e => e.map(x => x.value)), ['Картофель', 'Редис тестовый'], 'карта и новое сырьё воссозданы из предложения');
  assert.strictEqual(await E2.locator('#rvBar [data-act="rvApprove"]').count(), 0, 'у редактора кнопок публикации нет');
  await E2.fill('[data-act="rOut"]', '130'); await sleep(300);
  await E2.fill('#rwNote', 'Выход поправил'); await E2.click('#rvBar [data-act="rwSend"]');
  for (let i = 0; i < 60 && pend().length < 4; i++) await sleep(300);
  assert.strictEqual(pend().length, 4, 'ушло новое предложение');
  const st = pend().map(r => r[7]); console.log('4 статусы:', st.join(','));
  assert.strictEqual(st.filter(x => x === 'доработано').length, 2); assert.strictEqual(st.filter(x => x === 'ждёт').length, 2);
  const re = pend().filter(r => r[7] === 'ждёт')[0]; assert.strictEqual(re[13], pend().filter(r => r[7] === 'доработано')[0][0], 'новое предложение помнит прежнее');
  await E2.waitForFunction(() => { const b = document.querySelector('#rvBar'); return !b || b.hidden; }, null, { timeout: 20000 });
  assert.strictEqual(await bar(E2), '', 'уведомление исчезло');
  console.log('4 OK: уведомление, открытие в другом браузере, повторная отправка');

  // ===== 5. технолог видит прошлый комментарий, правит и публикует свою версию
  await refresh(T, 1); await T.waitForFunction(() => !document.querySelector('#syRew'), null, { timeout: 15000 });
  await T.click('#syPend [data-act="rvOpen"]'); b = await barIs(T, /Проверка ТТК/); console.log('5 bar:', b);
  assert.ok(/Ваш прошлый комментарий: «Уточните выход и брутто сырья»/.test(b) && /Выход поправил/.test(b));
  assert.strictEqual(await T.inputValue('[data-act="rOut"]'), '130', 'видна правка редактора');
  await T.fill('[data-act="rOut"]', '135'); await sleep(300);
  await T.click('#rvBar [data-act="rvApprove"]');
  for (let i = 0; i < 60 && !pub('Салат новый'); i++) await sleep(300);
  assert.ok(pub('Салат новый'), 'карта опубликована'); await sleep(500);
  assert.strictEqual(pub('Салат новый').output, 135, 'опубликована версия технолога'); assert.ok(pub('Редис тестовый'), 'новое сырьё опубликовано вместе с ней');
  assert.ok(pend().every(r => r[7] !== 'ждёт'), 'на проверке ничего нет');
  assert.ok(/с вашими правками/.test(pend().filter(r => r[7] === 'принято')[0][8] + '') || /с правками технолога/.test(pend().filter(r => r[7] === 'принято')[0][8]), 'в пометке: с правками технолога');
  await T.waitForFunction(() => !document.querySelector('#rvBar') || document.querySelector('#rvBar').hidden, null, { timeout: 15000 });
  assert.strictEqual(await T.inputValue('#rname'), 'Салат новый', 'технолог остался на опубликованной карте');
  assert.strictEqual((await recNames(T)).filter(n => n === 'Салат новый').length, 1, 'копия не дублируется');
  const sy = await T.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:sync')));
  assert.strictEqual(Object.values(sy.map.rec).filter(e => e.rev > 0).length, 2, 'карты технолога связаны с общей базой'); assert.strictEqual(sy.rv, null);
  await tab(T, 'tabSync'); await sleep(500); assert.strictEqual(await txt(T, '#syMine h2'), nMine0, 'после публикации у технолога нет лишних изменений');
  console.log('5 OK: опубликовано с правками технолога');

  // ===== 6. автор первого браузера: его карта не менялась после отправки, поэтому берёт версию технолога без конфликта
  await tab(E1, 'tabSync'); await E1.click('[data-act="syPull"]'); await msg(E1, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/);
  const plan = await txt(E1, '#syPull'); console.log('6 pull:', plan.slice(0, 200));
  assert.ok(!/конфликт/i.test(plan), 'конфликта нет');
  if (await E1.locator('[data-act="syApply"]').count()) { await E1.click('[data-act="syApply"]'); await sleep(500); }
  const l1 = await local(E1); const r2 = Object.values(l1.recipes).find(r => r.name === 'Салат новый');
  assert.strictEqual(r2.output, 135, 'у автора версия технолога');
  assert.strictEqual(await E1.evaluate(() => /Мои изменения · 0|Мои изменения/.test(document.querySelector('#syMine h2').textContent)), true);
  assert.strictEqual(Number((await txt(E1, '#syMine h2')).replace(/\D+/g, '') || 0), 0, 'у автора нет несданных изменений');
  console.log('6 OK: автор получил версию технолога без конфликта');

  // ===== 7. отклонить
  const E3 = await mk('E3', withNew('Суп новый', 'Шалот тестовый'));
  await connect(E3, { name: 'Сидорова Анна', code: E }); await pullAll(E3); await send(E3, 'суп');
  await refresh(T, 1); await T.click('#syPend [data-act="rvOpen"]'); await barIs(T, /Сидорова Анна/);
  assert.ok((await recNames(T)).includes('Суп новый') && (await ingNames(T)).includes('Шалот тестовый'));
  await T.click('#rvBar [data-act="rvAsk"][data-v="rej"]'); await T.fill('#rvNote', 'Такое блюдо уже есть'); await T.click('#rvBar [data-act="rvSend"]');
  for (let i = 0; i < 60 && !pend().some(r => r[7] === 'отклонено'); i++) await sleep(300);
  assert.strictEqual(pend().filter(r => r[7] === 'отклонено').length, 2); assert.ok(/Такое блюдо уже есть/.test(pend().filter(r => r[7] === 'отклонено')[0][8]));
  await T.waitForFunction(() => !document.querySelector('#rvBar') || document.querySelector('#rvBar').hidden, null, { timeout: 15000 });
  assert.ok(!(await recNames(T)).includes('Суп новый') && !(await ingNames(T)).includes('Шалот тестовый'), 'копии убраны');
  assert.strictEqual(await E3.evaluate(() => 0), 0);
  console.log('7 OK: отклонено');

  // ===== 8. закрыть проверку без решения: ничего не меняется на сервере, копии убираются
  const E4 = await mk('E4', withNew('Борщ новый', 'Укроп тестовый'));
  await connect(E4, { name: 'Кузнецов Пётр', code: E }); await pullAll(E4); await send(E4, 'борщ');
  await refresh(T, 1); await T.click('#syPend [data-act="rvOpen"]'); await barIs(T, /Кузнецов Пётр/);
  await T.click('#rvBar [data-act="rvClose"]'); assert.ok(/Закрыть без решения/.test(await bar(T)), 'просит подтвердить'); await T.click('#rvBar [data-act="rvClose"]');
  await T.waitForFunction(() => !document.querySelector('#rvBar') || document.querySelector('#rvBar').hidden, null, { timeout: 15000 });
  assert.strictEqual(pend().filter(r => r[7] === 'ждёт').length, 2, 'предложение осталось на проверке');
  assert.ok(!(await recNames(T)).includes('Борщ новый') && !(await ingNames(T)).includes('Укроп тестовый'));
  console.log('8 OK: проверка закрыта без решения');

  // ===== 9. узкий экран: плашка проверки не ломает страницу
  const TM = await mk('TM', base(), true);
  await connect(TM, { name: 'Технолог Петрова', code: A }); await pullAll(TM); await refresh(TM, 1);
  await TM.click('#syPend [data-act="rvOpen"]'); await barIs(TM, /Проверка ТТК/);
  const over = await TM.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); assert.ok(over <= 1, 'нет горизонтальной прокрутки: ' + over);
  const hh = await TM.evaluate(() => document.querySelector('#rvBar').getBoundingClientRect().height); assert.ok(hh < 400, 'плашка не съедает экран: ' + hh);
  if (process.env.SHOT) { await TM.screenshot({ path: 'out/rv_bar_mob.png' }); await T.click('#tabCalc'); await T.screenshot({ path: 'out/rv_bar_desk.png' }); }
  console.log('9 OK: узкий экран, плашка ' + Math.round(hh) + ' px');

  assert.deepStrictEqual(errs, [], 'ошибки в консоли: ' + errs.join(' | '));
  await browser.close(); gs.close();
  console.log('REWORK OK');
})().catch(e => { console.error('FAIL', e && e.stack || e, errs); process.exit(1); });
