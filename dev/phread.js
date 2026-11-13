/* тесты: записи истории цен лежат в IndexedDB (kbzhu-ph), а не в блоке localStorage */
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function all(page) {
  return page.evaluate(() => new Promise(res => {
    let rq; try { rq = indexedDB.open('kbzhu-ph', 1); } catch (e) { res({}); return; }
    rq.onerror = () => res({});
    rq.onupgradeneeded = () => { try { rq.transaction.abort(); } catch (e) {} };
    rq.onsuccess = () => {
      const db = rq.result;
      try {
        const tx = db.transaction('ph'), g = tx.objectStore('ph').getAll();
        tx.oncomplete = () => { const o = {}; g.result.forEach(r => { o[r.id] = r.rec; }); db.close(); res(o); };
        tx.onerror = () => { db.close(); res({}); };
      } catch (e) { db.close(); res({}); }
    };
  }));
}
/* ждать, пока записи в хранилище не удовлетворят условию (запись идёт с задержкой 400 мс) */
async function wait(page, pred, ms = 8000) {
  const t0 = Date.now(); let m = await all(page);
  while (!pred(m) && Date.now() - t0 < ms) { await sleep(150); m = await all(page); }
  return m;
}
/* записи из блока localStorage (старое хранение) */
async function blob(page) {
  return page.evaluate(() => { const o = {}, c = (JSON.parse(localStorage.getItem('kbzhu:v1')) || {}).cfg || {}; Object.keys(c).forEach(k => { if (/^ph_/.test(k)) o[k] = c[k]; }); return o; });
}
module.exports = { all, wait, blob };
