const { chromium } = require(process.env.PW_MODULE || 'playwright');
const path = require('path');
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined, args: ['--no-sandbox'] });
  for (const f of process.argv.slice(2)) {
    const ctx = await browser.newContext({ viewport: { width: 1100, height: 1000 } });
    const page = await ctx.newPage();
    await page.addInitScript(() => { try { localStorage.setItem('kbzhu:tab', 'calc'); } catch (e) {} });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto('file://' + path.resolve('out/КБЖУ_калькулятор_автономный.html'));
    await page.waitForSelector('#ttkFile', { state: 'attached' });
    await page.setInputFiles('#ttkFile', f);
    await page.waitForSelector('#ttkCard');
    await page.click('[data-act="ttkCreate"], [data-act="ttkCreateNew"]');
    await page.waitForTimeout(500);
    const r = await page.evaluate(() => {
      const d = JSON.parse(localStorage.getItem('kbzhu:v1') || '{}');
      const out = [];
      Object.keys(d.recipes || {}).forEach(id => { const rc = d.recipes[id]; if (rc.ttk && Object.keys(rc.ttk).length) out.push({ name: rc.name, ttk: rc.ttk }); });
      return out;
    });
    console.log('=====', f);
    r.forEach(x => { console.log(x.name); Object.keys(x.ttk).forEach(k => console.log('  ', k, '=', JSON.stringify(String(x.ttk[k])).slice(0, 110))); });
    await ctx.close();
  }
  await browser.close();
})();
