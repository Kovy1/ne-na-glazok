/* единый путь: правка → «Отправить на проверку» с карточки (только эта ТТК) → плашка у технолога → публикация (меню + файл в облаке) / отказ с причиной;
   плашка «Есть обновления» у остальных */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert'), vm = require('vm');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const ref = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rowOk = (rid, ing, net) => ({ rid, ing, net, share: 100 });
const seed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
  },
  recipes: {
    r1: { name: 'Пюре готовое', output: 200, rows: [rowOk('a', 'i3', 200)], ref, ttk: { num: '8' }, sell: { main: 120 } },
    r2: { name: 'Котлета тестовая', output: 100, rows: [rowOk('b', 'i2', 100)], ref, ttk: { num: '9' }, sell: { main: 200 } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const E = 'ed-1234', A = 'adm-5678';
  const mk = async (name, data, o = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 1100 } }); const page = await ctx.newPage();
    page.on('pageerror', e => errs.push(name + ': ' + e.message));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, o.tab || 'sync']);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, { name, code }) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
    return page.textContent('#sym-conn');
  };
  const msg = async (page, key, re, t = 40000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const tab = async (page, id) => { if (id === 'tabCalc') await TT.openCalc(page); else await page.click('#' + id); await sleep(300); };
  const txt = async (page, sel) => (await page.evaluate(s => { const e = document.querySelector(s); return e && !e.hidden ? e.textContent.replace(/\s+/g, ' ').trim() : ''; }, sel));
  const waitTxt = async (page, sel, re, t = 25000) => { const t0 = Date.now(); let b = ''; while (Date.now() - t0 < t) { b = await txt(page, sel); if (re.test(b)) return b; await sleep(400); } throw new Error('нет ' + re + ' в ' + sel + ': «' + b + '»'); };
  const db = async page => { await sleep(900); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const pickRec = async (page, re) => { await TT.pickRecipe(page, re); };
  const pullAll = async page => { await page.click('[data-act="syPull"]'); await msg(page, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/); if (await page.locator('[data-act="syApply"]').count()) { await page.click('[data-act="syApply"]'); await sleep(500); } };
  const srv = (a, extra) => gs.gas.parseOut(gs.gas.get(Object.assign({ a, code: A }, extra || {}))).data;
  const editNet = async (page, v) => { await page.fill('.nt input[data-act="rowNet"] >> nth=0', String(v)); await page.dispatchEvent('.nt input[data-act="rowNet"] >> nth=0', 'change'); await sleep(900); };

  vm.runInContext('setup()', gs.gas.ctx);

  // ===== 1. технолог: с карточки публикуется только эта ТТК; вторая — из «Моих изменений» кнопкой в строке
  const T = await mk('T', seed(), { tab: 'calc' });
  console.log('T:', await connect(T, { name: 'Технолог', code: A }));
  await sleep(1500);
  await tab(T, 'tabCalc'); await pickRec(T, /Пюре/);
  let st = await txt(T, '#syStrip'); console.log('T полоска:', st);
  assert.ok(/Новая/.test(st) && /Опубликовать для всех/.test(st), st);
  assert.strictEqual(await T.locator('#syBot [data-act="syCardPub"]').count(), 1, 'внизу карточки тоже кнопка');
  assert.strictEqual(await T.locator('[data-act="syFSave"]').count(), 1, 'у технолога остаётся «Сохранить файл в облако»');
  assert.ok(/Сохранить файл в облако/.test(await T.textContent('[data-act="syFSave"]')));
  await T.fill('#sy-cnote', 'Первая версия'); await T.dispatchEvent('#sy-cnote', 'input');
  await T.click('#syStrip [data-act="syCardPub"]');
  await msg(T, 'csend', /Опубликовано: 2/, 30000).catch(async () => { console.log('csend:', await txt(T, '#sym-csend')); });
  await sleep(1500);
  let pub = srv('pull', { since: '0' }).items.filter(x => x.kind === 'rec').map(x => x.name);
  console.log('в базе:', pub.join(','));
  assert.deepStrictEqual(pub, ['Пюре готовое'], 'опубликована только выбранная ТТК');
  assert.strictEqual(await txt(T, '#syStrip'), '', 'после публикации полоска исчезла');
  assert.ok(/совпадает с общей базой/.test(await txt(T, '#syBot')), await txt(T, '#syBot'));
  await tab(T, 'tabSync'); await T.waitForSelector('#syMine');
  const row2 = T.locator('#syMine .syrow', { hasText: 'Котлета тестовая' });
  assert.strictEqual(await row2.locator('[data-act="syOne"]').count(), 1, 'в строке есть кнопка');
  assert.ok(/Опубликовать/.test(await row2.locator('[data-act="syOne"]').textContent()));
  await row2.locator('[data-act="syOne"]').click();
  await msg(T, 'send', /Опубликовано: /, 30000); await sleep(1200);
  pub = srv('pull', { since: '0' }).items.filter(x => x.kind === 'rec').map(x => x.name).sort();
  assert.deepStrictEqual(pub, ['Котлета тестовая', 'Пюре готовое']);
  console.log('1 OK');

  // ===== 2. редактор: получил общее; правит две ТТК; с карточки уходит только одна
  const Ed = await mk('E', { ings: {}, recipes: {}, cfg: {} });
  console.log('E:', await connect(Ed, { name: 'Кузя', code: E }));
  await pullAll(Ed); await sleep(500);
  await tab(Ed, 'tabCalc'); await pickRec(Ed, /Пюре/);
  assert.strictEqual(await txt(Ed, '#syStrip'), '', 'пока правок нет — полоски нет');
  assert.ok(/совпадает с общей базой/.test(await txt(Ed, '#syBot')));
  await editNet(Ed, 250);
  st = await txt(Ed, '#syStrip'); console.log('E полоска:', st);
  assert.ok(/Изменена/.test(st) && /Отправить на проверку/.test(st) && !/Опубликовать/.test(st), st);
  if (process.env.SHOT) await Ed.screenshot({ path: 'out/send_card.png' });
  assert.strictEqual(await Ed.locator('[data-act="syFSave"]').count(), 0, 'редактору «Предложить в облако» больше нет');
  assert.ok(!/Предложить в облако/.test(await Ed.textContent('body')));
  assert.ok(/Отправить на проверку/.test(await Ed.textContent('#syBot')));
  await pickRec(Ed, /Котлета/); await editNet(Ed, 130);
  await pickRec(Ed, /Пюре/);
  await Ed.fill('#sy-cnote', 'Больше картофеля'); await Ed.dispatchEvent('#sy-cnote', 'input');
  await Ed.click('#syBot [data-act="syCardSend"]');
  await waitTxt(Ed, '#syStrip', /На проверке/, 30000);
  let pend = srv('pending').batches; console.log('на проверке:', JSON.stringify(pend.map(b => [b.by, b.note, b.items.map(i => i.name)])));
  assert.strictEqual(pend.length, 1); assert.deepStrictEqual(pend[0].items.map(i => i.name), ['Пюре готовое'], 'ушла только эта ТТК');
  assert.strictEqual(pend[0].note, 'Больше картофеля');
  assert.ok(/Отправлено на проверку технологу/.test(await txt(Ed, '#syBot')), await txt(Ed, '#syBot'));
  if (process.env.SHOT) await Ed.screenshot({ path: 'out/send_card2.png' });
  if (process.env.SHOT) await Ed.evaluate(() => document.querySelector('#secDl').scrollIntoView()), await sleep(300), await Ed.screenshot({ path: 'out/send_bot.png' });
  // «Мои изменения»: отправленная помечена, вторая отправляется кнопкой в строке
  await tab(Ed, 'tabSync'); await Ed.waitForSelector('#syMine');
  const rp = Ed.locator('#syMine .syrow', { hasText: 'Пюре готовое' }), rk = Ed.locator('#syMine .syrow', { hasText: 'Котлета тестовая' });
  assert.ok(/На проверке/.test(await rp.textContent()) && await rp.locator('[data-act="syOne"]').count() === 0);
  assert.ok(/Отправить/.test(await rk.locator('[data-act="syOne"]').textContent()));
  console.log('MINE:', (await Ed.$$eval('#syMine .syrow', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim()))).join(' || '));
  assert.ok(/Отправить на проверку: 1/.test(await Ed.textContent('#sy-send')), await Ed.textContent('#sy-send'));
  await rk.locator('[data-act="syOne"]').click();
  await msg(Ed, 'send', /Отправлено на проверку технологу: 1/, 30000); await sleep(1200);
  pend = srv('pending').batches; assert.strictEqual(pend.length, 2);
  console.log('2 OK');

  // ===== 3. технолог: плашка «Ждут проверки» сама, «Открыть проверку», публикация с файлом в облаке
  await T.reload(); await T.waitForSelector('#view > *');
  let ub = await waitTxt(T, '#upBar', /Ждут проверки: 2/, 20000); console.log('T плашка:', ub);
  assert.ok(/Смотреть изменения/.test(ub));
  if (process.env.SHOT) await T.screenshot({ path: 'out/send_tbar.png' });
  await T.click('#upBar [data-act="upReview"]');
  // кнопка плашки ведёт на страницу изменений, подсвеченную и с подробным «было → стало»; карту открывает кнопка в строке
  await T.waitForSelector('#syPend .sybatch.hl', { timeout: 20000 });
  assert.ok(await T.evaluate(() => document.querySelector('#tabSync').getAttribute('aria-selected') === 'true'), 'открылась вкладка с изменениями');
  assert.ok(await T.locator('#syPend .sydf').count() >= 1, 'подробный список изменений');
  console.log('T страница изменений:', (await txt(T, '#syPend')).slice(0, 300));
  await T.locator('#syPend [data-act="rvOpen"]').first().click();
  let rb = await waitTxt(T, '#rvBar', /Проверка ТТК/, 20000); console.log('T проверка:', rb);
  assert.ok(/Положить ТТК \(\.docx\) в «ТТК в облаке»/.test(rb), 'галочка про файл');
  const who = await T.inputValue('#rname'); console.log('открыто:', who);
  await T.click('#rvBar [data-act="rvApprove"]');
  await waitTxt(T, '#upBar', /Ждут проверки: 1/, 25000);
  await sleep(1500);
  const files = srv('files', { fresh: '1' }).files; console.log('файлы:', files.map(f => f.name + ':' + f.kind).join(', '));
  const lib = files.filter(f => f.kind === 'main'); assert.ok(lib.some(f => /^ТТК №(8|9) /.test(f.name)), 'ТТК лежит в облаке');
  const net = srv('pull', { since: '0' }).items.find(x => x.name === who || /Пюре/.test(x.name));
  assert.ok(net, 'в базе есть ТТК');
  console.log('3 OK');

  // ===== 4. отказ с причиной
  await T.click('#upBar [data-act="upReview"]'); await T.waitForSelector('#syPend [data-act="rvOpen"]', { timeout: 20000 });
  await T.locator('#syPend [data-act="rvOpen"]').first().click(); await waitTxt(T, '#rvBar', /Проверка ТТК/, 20000);
  await T.click('#rvBar [data-act="rvAsk"][data-v="rej"]'); await T.fill('#rvNote', 'Дубль, такая карта уже есть'); await T.click('#rvBar [data-act="rvSend"]');
  await sleep(2500);
  assert.ok(!/Ждут проверки/.test(await txt(T, '#upBar')), 'проверять больше нечего: ' + await txt(T, '#upBar'));
  console.log('4 OK');

  // ===== 5. редактор: «Есть обновления» → одна кнопка → получено; видит принятое и причину отказа
  await Ed.reload(); await Ed.waitForSelector('#view > *');
  await sleep(3000); assert.ok(!/Есть обновления/.test(await txt(Ed, '#upBar')), 'плашки нет: общее применяется само');
  const rej = await waitTxt(Ed, '#rvBar', /Технолог отклонил/, 25000); console.log('E уведомление:', rej);
  assert.ok(/Дубль, такая карта уже есть/.test(rej));
  await sleep(800);
  assert.ok(!/Есть обновления/.test(await txt(Ed, '#upBar')), 'после обновления плашка ушла: ' + await txt(Ed, '#upBar'));
  await tab(Ed, 'tabCalc'); await pickRec(Ed, /Котлета/);
  st = await txt(Ed, '#syStrip'); console.log('E полоска отклонённой:', st);
  assert.ok(/Отклонено/.test(st) && /Дубль, такая карта уже есть/.test(st), st);
  await pickRec(Ed, /Пюре/);
  assert.strictEqual(await txt(Ed, '#syStrip'), '', 'принятая ТТК совпадает с общей базой');
  await pickRec(Ed, /Котлета/);
  await Ed.click('#syStrip [data-act="rwDrop"]'); await sleep(2500);
  st = await txt(Ed, '#syStrip'); console.log('E после «Понятно»:', st);
  assert.ok(/Изменена|Новая/.test(st) && /Отправить на проверку/.test(st) && !/Отклонено/.test(st), st);
  assert.ok(!/Технолог отклонил/.test(await txt(Ed, '#rvBar')));
  console.log('5 OK');

  if (errs.length) { console.log('ERRORS:\n' + errs.join('\n')); process.exit(1); }
  console.log('PWSEND OK');
  await browser.close(); gs.close && gs.close(); process.exit(0);
})().catch(e => { console.error('FAIL', e); console.log(errs.join('\n')); process.exit(1); });
