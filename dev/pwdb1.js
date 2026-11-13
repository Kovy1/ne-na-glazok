const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path'); const assert = require('assert');
const sleep = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  const page = await ctx.newPage(); const errs = [];
  page.on('pageerror', e => errs.push(e.message));
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // страница без встроенной базы, но с имитацией хранилища claude.ai
  const html = require('fs').readFileSync('kbzhu.html', 'utf8');
  const seed = JSON.parse(require('fs').readFileSync('out/КБЖУ_калькулятор_автономный.html', 'utf8').match(/window\.KBZHU_SEED=(\{.*?\});(?:window\.KBZHU_\w+=[^;]*;)*<\/script>/s)[1]);
  const find = re => Object.keys(seed.ings).find(k => re.test(seed.ings[k].name));
  const rec = (name, spec, num, sell) => ({ name, output: 100, rows: spec.map(([re, net], i) => ({ rid: 'r' + i, ing: find(re), net, share: 100 })), ref: { label: '', p: null, f: null, c: null, kcal: null, tol: 10 }, ttk: { num }, sell: { main: sell } });
  const store = { ingredients: {}, recipes: {
    a: rec('Котлета мясная 1/100 гр.', [[/^Фарш говяжий/, 90]], '14', 120),
    b: rec('Гречка отварная 1/150', [[/^Крупа гречневая/, 60]], '77', 40),
    c: rec('Салат Витаминный 1/100', [[/^Капуста свежая/, 70]], '33', 45) },
    settings: { abc: { a: 70, b: 90, period: 'Октябрь 2026' }, regions: { list: [{ id: 'main', name: 'Основной' }, { id: 'msk', name: 'Москва' }] } } };
  Object.keys(seed.ings).forEach(k => store.ingredients[k] = seed.ings[k]);
  await page.addInitScript(({ store }) => {
    const listeners = {}; window.__store = store; window.__writes = [];
    const snap = (c, type, ids) => ({ metadata: { fromCache: false }, docChanges: () => ids.map(id => ({ type, doc: { id, data: () => JSON.parse(JSON.stringify(store[c][id])) } })) });
    const db = {
      collection: c => ({ onSnapshot: (cb) => { (listeners[c] = listeners[c] || []).push(cb); setTimeout(() => cb(snap(c, 'added', Object.keys(store[c] || {}))), 10); } }),
      doc: key => { const [c, id] = key.split('/'); return { set: d => { store[c] = store[c] || {}; store[c][id] = JSON.parse(JSON.stringify(d)); window.__writes.push(key); return Promise.resolve(); }, delete: () => { delete store[c][id]; return Promise.resolve(); } }; }
    };
    window.claude = { use: n => Promise.resolve(n === 'db' ? db : n === 'user' ? { can: () => Promise.resolve(true) } : { save: () => Promise.resolve() }) };
    localStorage.setItem('kbzhu:tab', 'abc');
  }, { store });
  await page.goto('file://' + path.resolve('kbzhu.html'));
  await page.waitForSelector('#abSalesCard');
  assert.strictEqual(await page.inputValue('[data-act="abPeriod"]'), 'Октябрь 2026');
  assert.strictEqual(await page.inputValue('[data-act="abA"]'), '70');
  assert.strictEqual(await page.inputValue('[data-act="abB"]'), '90');
  // вставка продаж, загрузка, запись в хранилище
  await page.fill('#abText', 'Котлета мясная;300\nГречка отварная;200\nСалат Витаминный 100');
  await page.click('[data-act="aParse"]'); await page.waitForSelector('#salesCard');
  await page.click('[data-act="aApply"]'); await page.waitForSelector('#abSum .atiles');
  await sleep(1200);
  console.log('writes', JSON.stringify(await page.evaluate(() => window.__writes)));
  const q = await page.evaluate(() => Object.fromEntries(Object.entries(window.__store.recipes).map(([k, r]) => [k, r.qty])));
  console.log('qty in store', JSON.stringify(q));
  assert.deepStrictEqual(q, { a: { main: 300 }, b: { main: 200 }, c: { main: 100 } });
  // классы при A=70, B=90: Котлета 36000, Гречка 8000, Салат 4500 -> 74,2 % -> A, 91,8 % -> B?? считаем в тесте
  const rows = await page.$$eval('#abList .arow:not(.ahead)', rs => rs.map(r => r.querySelector('.an b').textContent.split(' ')[0] + ':' + r.querySelector('.abadge').textContent));
  console.log('rows', rows.join(' '));
  // период и границы пишутся в settings/abc
  await page.fill('[data-act="abPeriod"]', 'Ноябрь 2026'); await page.fill('[data-act="abA"]', '60'); await sleep(1000);
  console.log('settings/abc', JSON.stringify(await page.evaluate(() => window.__store.settings.abc)));
  assert.deepStrictEqual(await page.evaluate(() => window.__store.settings.abc), { a: 60, b: 90, period: 'Ноябрь 2026' });
  // ввод вручную → запись только изменённого блюда
  await page.evaluate(() => { window.__writes.length = 0; });
  await page.click('#abManual summary'); await page.fill('.srow[data-rid="b"] input', '250'); await sleep(1000);
  console.log('writes after manual', JSON.stringify(await page.evaluate(() => window.__writes)));
  assert.deepStrictEqual(await page.evaluate(() => window.__writes), ['recipes/b']);
  // псевдоним: «запомнить название» сохраняется в блюде
  await page.click('#abPaste summary'); await page.fill('#abText', 'Котлетка домашняя;77'); await page.click('[data-act="aParse"]'); await page.waitForSelector('#salesCard');
  const how = await page.$$eval('#salesCard .tstat', e => e.map(x => x.textContent)); console.log('котлетка:', how.join(','));
  await page.selectOption('#salesCard select[data-act="salesRec"]', 'a');
  assert.ok(await page.$eval('#salesCard [data-act="salesRem"]', e => e.checked));
  await page.uncheck('#salesCard [data-act="salesClear"]'); await page.click('[data-act="aApply"]'); await sleep(1000);
  const al = await page.evaluate(() => [window.__store.recipes.a.aliases, window.__store.recipes.a.qty, window.__store.recipes.b.qty]);
  console.log('alias/qty', JSON.stringify(al)); assert.deepStrictEqual(al[0], ['котлетка домашняя']); assert.deepStrictEqual(al[1], { main: 77 }); assert.deepStrictEqual(al[2], { main: 250 });
  // в следующий раз название узнаётся само
  await page.click('[data-act="aApply"]').catch(()=>{}); await sleep(300);
  if (!(await page.$eval('#abPaste', d => d.open))) await page.click('#abPaste summary');
  await page.fill('#abText', 'Котлетка домашняя;90'); await page.click('[data-act="aParse"]'); await page.waitForSelector('#salesCard');
  console.log('второй раз:', (await page.$$eval('#salesCard .tstat', e => e.map(x => x.textContent))).join(','));
  await page.click('[data-act="aCancel"]');
  console.log('ERR', errs); assert.deepStrictEqual(errs.filter(e => !/Failed to load/.test(e)), []);
  await browser.close(); console.log('DB MODE OK');
})().catch(e => { console.error('FAIL', e.message); process.exit(1); });
