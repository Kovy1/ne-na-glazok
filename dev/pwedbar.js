/* Редактор: предупреждение «правки только на этом устройстве, пока технолог не примет» и ненавязчивое напоминание отправить.
   Данные «ТЕСТ», сервер — имитация Apps Script. */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'out/КБЖУ_калькулятор_автономный.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const seed = () => ({
  ings: {
    i2: { name: 'ТЕСТ Говядина', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'ТЕСТ Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
    i4: { name: 'ТЕСТ Лук', p: 1, f: 0, c: 8, kind: 'table', source: '', price: 25 },
  },
  recipes: { r1: { name: 'ТЕСТ Котлета', output: 150, rows: [{ rid: 'a', ing: 'i2', net: 100, share: 100 }], ref, ttk: { num: '7' }, sell: { main: 300 } } },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const fails = []; const T = async (name, fn) => { try { await fn(); console.log('ok  ', name); } catch (e) { fails.push(name); console.log('FAIL', name, '—', String(e.message).split('\n')[0].slice(0, 300)); } };
  const mk = async (name, data, vp) => {
    const ctx = await browser.newContext({ viewport: vp || { width: 1280, height: 900 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto('file://' + path.resolve(SRC));
    await page.evaluate(d => { localStorage.clear(); localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', 'base'); localStorage.setItem('kbzhu:sync', JSON.stringify({ cfg: { pubDocs: false } })); }, data);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, name, code) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const msg = (page, key, re, t = 60000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const status = page => page.evaluate(() => { const e = document.querySelector('#status'); return { t: e.textContent, short: e.getAttribute('data-short'), hint: e.getAttribute('data-hint') }; });
  const bar = page => page.evaluate(() => { const b = document.querySelector('#edBar'); window.kbzhuEd.update(); return b.hidden ? '' : b.textContent.replace(/\s+/g, ' ').trim(); });
  const edit = async (page, id, v) => { const l = page.locator('.irow[data-iid="' + id + '"] input[data-act="iP"]'); await l.fill(v); await l.press('Tab'); await sleep(900); };

  // технолог публикует базу
  const A = await mk('A', seed());
  await connect(A, 'Технолог', 'adm-5678'); await msg(A, 'pull', /Всё актуально|Получено/);
  await A.click('#sy-pub'); await msg(A, 'send', /Опубликовано/); await sleep(800);
  await T('технолог: плашки редактора нет', async () => assert.strictEqual(await bar(A), ''));

  // редактор
  const E = await mk('E', seed());
  await connect(E, 'Иванов И.', 'ed-1234'); await msg(E, 'pull', /Всё актуально|Получено|Применено|Нашёл/); await sleep(600);
  // правка белка в «Базе сырья»
  await E.click('#tabBase'); await E.waitForSelector('.irow[data-iid="i3"]');
  await edit(E, 'i3', '2.5');
  const s1 = await status(E);
  await T('строка состояния: «Не отправлено: 1», подсказка про устройство и технолога', () => { assert.strictEqual(s1.t, 'Не отправлено: 1'); assert.ok(/только на этом устройстве/.test(s1.hint) && /когда он их примет/.test(s1.hint), s1.hint); });
  const b1 = await bar(E);
  await T('первая правка: объяснение сразу, без ожидания', () => { assert.ok(/Ваши правки пока только на этом устройстве/.test(b1), b1); assert.ok(/появятся, только когда технолог их примет/.test(b1)); assert.ok(/несколько позиций подряд/.test(b1)); });
  await T('плашка не сдвигает страницу (закреплена)', async () => assert.strictEqual(await E.evaluate(() => getComputedStyle(document.querySelector('#edBar')).position), 'fixed'));
  await E.click('[data-act="edIntroOk"]');
  await T('«Понятно»: объяснение больше не показывается', async () => assert.strictEqual(await bar(E), ''));
  // ещё правки подряд: напоминания нет, пока человек правит
  await edit(E, 'i4', '1.5');
  await T('пауза 4 минуты: напоминания ещё нет', async () => { await E.evaluate(() => { window.kbzhuEd.S.edAt = Date.now() - 4 * 60000; }); assert.strictEqual(await bar(E), ''); });
  await E.evaluate(() => { window.kbzhuEd.S.edAt = Date.now(); });
  await T('правки подряд: напоминание не появляется', async () => { assert.strictEqual(await bar(E), ''); assert.strictEqual((await status(E)).t, 'Не отправлено: 2'); });
  // человек остановился, но курсор в поле — тоже не мешаем
  await E.evaluate(I => { window.kbzhuEd.S.edAt = Date.now() - I - 1000; }, await E.evaluate(() => window.kbzhuEd.IDLE));
  await E.focus('.irow[data-iid="i2"] input[data-act="iF"]');
  await T('курсор в поле ввода: напоминание ждёт', async () => assert.strictEqual(await bar(E), ''));
  await E.evaluate(() => document.activeElement.blur());
  const b2 = await bar(E);
  await T('пауза в правках: тихое напоминание «Не отправлено: 2 правки»', () => { assert.ok(/Не отправлено: 2 правки/.test(b2), b2); assert.ok(/только на этом устройстве/.test(b2)); });
  // новая правка, пока напоминание видно: оно остаётся на месте (не мигает)
  await edit(E, 'i2', '19');
  await T('правка при видимом напоминании: оно остаётся, число обновилось', async () => assert.ok(/Не отправлено: 3 правки/.test(await bar(E))));
  await E.click('[data-act="edLater"]');
  await T('«Позже»: напоминание скрыто на 30 минут', async () => { await E.evaluate(I => { window.kbzhuEd.S.edAt = Date.now() - I - 1000; }, await E.evaluate(() => window.kbzhuEd.IDLE)); assert.strictEqual(await bar(E), ''); });
  await E.evaluate(() => { window.kbzhuEd.S.edSnooze = 0; });
  await T('через 30 минут напоминание возвращается', async () => assert.ok(/Не отправлено: 3/.test(await bar(E))));
  // телефон: плашка над нижним меню и без горизонтальной прокрутки
  await E.setViewportSize({ width: 390, height: 844 }); await sleep(200);
  await T('телефон: плашка над нижним меню, без горизонтальной прокрутки', async () => {
    const r = await E.evaluate(() => { const b = document.querySelector('#edBar').getBoundingClientRect(), t = document.querySelector('.tabs').getBoundingClientRect(); return { bb: b.bottom, tt: t.top, over: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
    assert.ok(r.bb <= r.tt + 1, JSON.stringify(r)); assert.ok(r.over <= 1, JSON.stringify(r));
  });
  await E.screenshot({ path: 'out/shot_edbar_phone.png' });
  await E.setViewportSize({ width: 1280, height: 900 });
  await E.screenshot({ path: 'out/shot_edbar.png' });
  // отправка
  await E.click('#edBar [data-act="edGo"]'); await sleep(300);
  await T('«Отправить на проверку» ведёт в «Мои задачи», плашка там не мешает', async () => { assert.strictEqual(await E.getAttribute('#cab .segb[aria-selected="true"]', 'data-s'), 'tasks'); assert.strictEqual(await bar(E), ''); });
  await E.click('#sy-send'); await msg(E, 'send', /Отправлено на проверку технологу/); await sleep(900);
  const s2 = await status(E);
  await T('после отправки: «На проверке: 3», подсказка «пока он не примет — только на этом устройстве»', () => { assert.strictEqual(s2.t, 'На проверке: 3'); assert.strictEqual(s2.short, 'На проверке'); assert.ok(/Пока он не примет, эти правки есть только на этом устройстве/.test(s2.hint), s2.hint); });
  await E.click('#tabBase'); await sleep(300);
  await T('после отправки напоминаний нет', async () => { await E.evaluate(() => { window.kbzhuEd.S.edAt = 0; }); assert.strictEqual(await bar(E), ''); });
  // технолог принимает
  await A.click('#tabSync'); await A.click('[data-act="syRefresh"]');
  await A.waitForFunction(() => /На проверке · 1/.test((document.querySelector('#syPend h2') || {}).textContent || ''), null, { timeout: 20000 });
  await A.click('[data-act="syApprove"]'); await msg(A, 'review', /Принято и опубликовано/);
  await E.click('#tabSync'); await E.click('[data-act="syPull"]'); await msg(E, 'pull', /Всё актуально|Получено|Применено|Нашёл/);
  if (await E.locator('[data-act="syApply"]').count()) { await E.click('[data-act="syApply"]'); await sleep(800); }
  await sleep(600);
  await T('после того, как технолог принял: «Сохранено»', async () => assert.strictEqual((await status(E)).t, 'Сохранено'));
  await T('нет ошибок страниц', () => assert.deepStrictEqual(errs, []));
  await browser.close(); gs.close && gs.close();
  console.log(fails.length ? 'FAILED ' + fails.length : 'ALL PASSED'); process.exit(fails.length ? 1 : 0);
})().catch(e => { console.error('FAIL', e); process.exit(1); });
