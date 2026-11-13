const { chromium } = require('playwright'); const path = require('path'); const assert = require('assert');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.addInitScript(() => {
    const docs = {};
    const col = (n) => ({ get: async () => ({ docs: Object.entries(docs[n] || {}).map(([id, d]) => ({ id, data: () => d })) }), onSnapshot: (cb) => { cb({ docs: [] }); return () => {}; }, doc: (id) => ({ get: async () => ({ exists: false, data: () => null }), set: async () => {}, update: async () => {}, delete: async () => {}, onSnapshot: (cb) => { cb({ exists: false, data: () => null }); return () => {}; } }) });
    const db = { collection: col, doc: () => ({ get: async () => ({ exists: false, data: () => null }), set: async () => {}, onSnapshot: (cb) => { cb({ exists: false, data: () => null }); return () => {}; } }) };
    window.claude = { use: n => Promise.resolve(n === 'db' ? db : n === 'user' ? { can: () => Promise.resolve(true), id: () => Promise.resolve('u1') } : { save: () => Promise.resolve() }) };
  });
  await page.goto('file://' + path.resolve('kbzhu.html'));
  await page.waitForTimeout(1500);
  const info = await page.evaluate(() => { const b = document.getElementById('tabSync'); return { exists: !!b, hidden: b ? (b.hidden || getComputedStyle(b).display === 'none') : null }; });
  console.log('DB mode tabSync', JSON.stringify(info));
  assert.ok(info.exists && info.hidden);
  await browser.close(); console.log('DBSYNC OK');
})().catch(e => { console.error(e); process.exit(1); });
