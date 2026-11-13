/* удаления: технолог удаляет сырьё и ТТК и публикует -> у редактора и шеф-повара они исчезают; у технолога не возвращаются;
   редактор предлагает удаление -> технолог принимает -> исчезает у всех; возврат через журнал */
const { chromium } = require(process.env.PW_MODULE || 'playwright');
const TT = require('./tt');
const path = require('path'), assert = require('assert');
const { startGas } = require('./sync/gasserver');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SRC = process.argv[2] || 'kbzhu.html';
const errs = [];
const REF = { label: '', p: null, f: null, c: null, kcal: null, tol: 10, basis: '100' };
const rowOk = (rid, ing, net) => ({ rid, ing, net, share: 100 });
const seed = () => ({
  ings: {
    i2: { name: 'Говядина облачная', p: 18, f: 12, c: 0, kind: 'table', source: '', price: 500 },
    i3: { name: 'Картофель', p: 2, f: 0.4, c: 16, kind: 'table', source: '', price: 30 },
    i5: { name: 'Свёкла', p: 1.5, f: 0.1, c: 8.8, kind: 'table', source: '' },
    i6: { name: 'Лук репчатый', p: 1.4, f: 0, c: 10, kind: 'table', source: '' },
    i7: { name: 'Соль', p: 0, f: 0, c: 0, kind: 'table', source: '' },
  },
  recipes: {
    r1: { name: 'Котлета тест', output: 150, rows: [rowOk('a', 'i2', 100), rowOk('b', 'i3', 50)], ref: REF, ttk: {}, sell: { main: 120 } },
    r2: { name: 'Пюре тест', output: 200, rows: [rowOk('c', 'i3', 180)], ref: REF, ttk: {}, sell: { main: 60 } },
    r3: { name: 'Щи тест', output: 300, rows: [rowOk('d', 'i6', 80)], ref: REF, ttk: {}, sell: { main: 90 } },
  },
  cfg: {},
});
(async () => {
  const gs = await startGas();
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const url = 'file://' + path.resolve(SRC);
  const mk = async (name, data, tab = 'sync') => {
    const ctx = await browser.newContext({ viewport: { width: 1250, height: 1000 } }); const page = await ctx.newPage();
    page.on('pageerror', e => { if (!/Unexpected token '<'/.test(e.message)) errs.push(name + ': ' + e.message); });
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|CORS|net::ERR|Refused to execute/.test(m.text())) errs.push(name + ' console: ' + m.text()); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url);
    await page.evaluate(([d, tab]) => { localStorage.clear(); if (d) localStorage.setItem('kbzhu:v1', JSON.stringify(d)); localStorage.setItem('kbzhu:tab', tab); }, [data, tab]);
    await page.reload(); await page.waitForSelector('#view > *');
    return page;
  };
  const connect = async (page, name, code) => {
    await page.click('#tabSync'); await page.waitForSelector('#syConn');
    await page.fill('#sy-url', gs.url); await page.fill('#sy-name', name); await page.fill('#sy-code', code);
    await page.click('[data-act="syConnect"]');
    await page.waitForFunction(() => { const e = document.querySelector('#sym-conn'); return e && !e.hidden && !/Проверяю|Читаю/.test(e.textContent); }, null, { timeout: 30000 });
  };
  const msg = async (page, key, re, t = 40000) => page.waitForFunction(([k, s]) => { const e = document.querySelector('#sym-' + k); return e && !e.hidden && new RegExp(s).test(e.textContent); }, [key, re.source], { timeout: t });
  const pullAll = async page => { await msg(page, 'pull', /Всё актуально|Получено|Применено|Нашёл изменения/); if (await page.locator('[data-act="syApply"]').count()) { await page.click('[data-act="syApply"]'); await sleep(600); } };
  const DB = async page => { await sleep(800); return page.evaluate(() => JSON.parse(localStorage.getItem('kbzhu:v1'))); };
  const names = d => [Object.values(d.ings).map(x => x.name).sort(), Object.values(d.recipes).map(x => x.name).sort()];
  const dead = () => gs.gas.rows('Общая база').filter(r => String(r[6]) === '{"_del":1}').map(r => String(r[2])).sort();

  // ===== 1. технолог публикует, редактор и шеф-повар получают
  const T = await mk('T', seed());
  await connect(T, 'Технолог', 'adm-5678'); await msg(T, 'pull', /Всё актуально|Получено/);
  await T.click('#sy-pub'); await msg(T, 'send', /Опубликовано: 8/); await sleep(1000);
  const E = await mk('E', { ings: {}, recipes: {}, cfg: {} });
  await connect(E, 'Мария', 'ed-1234'); await pullAll(E);
  const C = await mk('C', { ings: {}, recipes: {}, cfg: {} });
  await connect(C, 'Шеф', 'view-3456'); await pullAll(C);
  console.log('E:', JSON.stringify(names(await DB(E)))); assert.strictEqual(Object.keys((await DB(E)).ings).length, 5);
  assert.strictEqual(Object.keys((await DB(C)).recipes).length, 3);
  console.log('1 OK: все получили базу');

  // ===== 2. технолог удаляет «Щи тест» и «Лук репчатый» (в одном пакете), «Пюре тест» и «Свёкла»
  await TT.openCalc(T); await sleep(300);
  for (const nm of ['Щи тест', 'Пюре тест']) {
    await TT.pickRecipe(T, nm); await sleep(300);
    await TT.more(T, 'delRecipe'); await TT.more(T, 'delRecipe'); await sleep(500);
  }
  await T.click('#tabBase'); await sleep(300);
  for (const id of ['i6', 'i5']) {
    const row = T.locator('.irow[data-iid="' + id + '"]'); await row.locator('[data-act="delIng"]').click(); await row.locator('[data-act="delIng"]').click(); await sleep(400);
  }
  await T.click('#tabSync'); await T.waitForSelector('#syMine'); await sleep(800);
  assert.ok(/Мои изменения · 4/.test(await T.textContent('#syMine h2')), await T.textContent('#syMine h2'));
  const mine = await T.$$eval('#syMine .syrow', e => e.map(x => x.textContent.replace(/\s+/g, ' ').trim())); console.log(mine.join('\n'));
  assert.ok(mine.length === 4 && mine.every(x => /Удалено/.test(x)) && mine.some(x => /Свёкла/.test(x)) && mine.some(x => /Щи тест/.test(x)));
  assert.ok(/Опубликовать сразу: 4/.test(await T.textContent('#sy-pub')));
  await T.click('#sy-pub'); await msg(T, 'send', /Опубликовано: 4/); await sleep(1500);
  console.log('метки в базе:', dead().join(', '));
  assert.deepStrictEqual(dead(), ['Лук репчатый', 'Пюре тест', 'Свёкла', 'Щи тест']);
  await T.waitForFunction(() => /Мои изменения · 0/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 15000 });
  console.log('2 OK: удаления опубликованы');

  // ===== 3. у технолога удалённое не возвращается ни после «Получить обновления», ни после обновления страницы
  await T.click('[data-act="syPull"]'); await sleep(2500);
  let dt = await DB(T); console.log('T:', JSON.stringify(names(dt)));
  assert.deepStrictEqual(names(dt), [['Говядина облачная', 'Картофель', 'Соль'], ['Котлета тест']]);
  await T.reload(); await T.waitForSelector('#view > *'); await sleep(3500);
  dt = await DB(T); assert.deepStrictEqual(names(dt), [['Говядина облачная', 'Картофель', 'Соль'], ['Котлета тест']], 'после обновления страницы удалённое не вернулось');
  // и если эти позиции кто-то изменит в общей базе, они тоже не вернутся (сбрасываем версию, будто технолог ничего не получал)
  await T.evaluate(() => { const d = JSON.parse(localStorage.getItem('kbzhu:sync')); d.cfg.rev = 0; localStorage.setItem('kbzhu:sync', JSON.stringify(d)); });
  await T.reload(); await T.waitForSelector('#view > *'); await sleep(3500);
  assert.deepStrictEqual(names(await DB(T)), [['Говядина облачная', 'Картофель', 'Соль'], ['Котлета тест']], 'и при полном получении');
  console.log('3 OK: у технолога не возвращается');

  // ===== 4. редактор получает: список «Удалено», после «Применить» позиций нет
  await E.click('#tabSync'); await E.click('[data-act="syPull"]');
  const want = JSON.stringify([['Говядина облачная', 'Картофель', 'Соль'], ['Котлета тест']]);
  for (let i = 0, t0 = Date.now(); Date.now() - t0 < 20000; i++) { if (JSON.stringify(names(await DB(E))) === want) break; await sleep(500); }
  assert.strictEqual(await E.locator('[data-act="syApply"]').count(), 0, 'у редактора список «Применить» не показывается: удаления применены сразу');
  assert.strictEqual(await E.locator('#upBar [data-act="hdBack"]').count(), 0, 'своих правок не было: кнопки «Продолжить работу» нет');
  let de = await DB(E); assert.deepStrictEqual(names(de), [['Говядина облачная', 'Картофель', 'Соль'], ['Котлета тест']]);
  assert.ok(/Мои изменения · 0/.test(await E.textContent('#syMine h2')), 'у редактора ничего не висит в «Моих изменениях»');
  console.log('4 OK: редактор получил удаления');

  // шеф-повар получает сам при открытии страницы
  await C.reload(); await C.waitForSelector('#view > *'); await sleep(4000);
  assert.deepStrictEqual(names(await DB(C)), [['Говядина облачная', 'Картофель', 'Соль'], ['Котлета тест']]);
  console.log('5 OK: шеф-повар получил при открытии');

  // ===== 6. редактор удаляет «Соль» и отправляет на проверку; технолог принимает
  await E.click('#tabBase'); await sleep(300);
  const saltId = Object.entries((await DB(E)).ings).find(([id, x]) => x.name === 'Соль')[0];
  const rs = E.locator('.irow[data-iid="' + saltId + '"]'); await rs.locator('[data-act="delIng"]').click(); await rs.locator('[data-act="delIng"]').click(); await sleep(400);
  await E.click('#tabSync'); await E.waitForSelector('#syMine'); await sleep(600);
  assert.ok(/Мои изменения · 1/.test(await E.textContent('#syMine h2')));
  await E.fill('#sy-note', 'Соль не нужна'); await E.click('#sy-send'); await msg(E, 'send', /Отправлено на проверку технологу: 1/);
  assert.ok(/Соль/.test(await E.textContent('#syMine')) && /Удалено/.test(await E.textContent('#syMine')), 'удаление остаётся в списке, пока не принято');
  assert.strictEqual((await DB(E)).ings[saltId], undefined, 'у редактора соль удалена и не возвращается');
  await T.click('#tabSync'); await T.click('[data-act="syRefresh"]');
  await T.waitForFunction(() => /На проверке · 1/.test(document.querySelector('#syPend h2').textContent), null, { timeout: 20000 });
  const pb = (await T.textContent('#syPend')).replace(/\s+/g, ' '); console.log('T на проверке:', pb.slice(0, 200));
  assert.ok(/Соль/.test(pb) && /удаление из общей базы/.test(pb));
  assert.strictEqual(await T.locator('#syPend [data-act="rvOpen"]').count(), 0);
  await T.click('[data-act="syApprove"]'); await msg(T, 'review', /Принято и опубликовано/);
  await T.waitForFunction(() => /На проверке · 0/.test(document.querySelector('#syPend h2').textContent), null, { timeout: 20000 });
  assert.ok(dead().includes('Соль'));
  await sleep(2500);
  assert.deepStrictEqual(names(await DB(T)), [['Говядина облачная', 'Картофель'], ['Котлета тест']], 'у технолога соль тоже убралась (принятое удаление)');
  await E.click('[data-act="syPull"]'); await sleep(2500);
  await E.waitForFunction(() => /Мои изменения · 0/.test(document.querySelector('#syMine h2').textContent), null, { timeout: 15000 });
  console.log('6 OK: предложение удалить принято');

  // ===== 7. возврат через журнал: у технолога и у редактора «Свёкла» снова есть
  await T.click('[data-act="syRefresh"]'); await sleep(1500);
  await T.evaluate(() => document.querySelectorAll('#syLog details').forEach(d => { d.open = true; }));
  const back = T.locator('#syLog .syrow:has-text("Свёкла") [data-act="syRevert"]').first();
  await back.waitFor({ timeout: 15000 }); await back.click(); await msg(T, 'review', /Прежнее значение возвращено/);
  await sleep(2500);
  assert.ok(names(await DB(T))[0].includes('Свёкла'), 'у технолога вернулась');
  await E.click('[data-act="syPull"]'); await sleep(1500); if (await E.locator('[data-act="syApply"]').count()) { await E.click('[data-act="syApply"]'); await sleep(800); }
  assert.ok(names(await DB(E))[0].includes('Свёкла'), 'у редактора вернулась');
  console.log('7 OK: возврат через журнал');

  await browser.close(); gs.close && gs.close();
  if (errs.length) { console.log('ERRORS:', errs); process.exit(1); }
  console.log('PWDEL OK'); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
