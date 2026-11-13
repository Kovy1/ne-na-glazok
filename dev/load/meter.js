/* Измеритель: настоящий Code.gs на имитации Apps Script, каждое обращение к Таблице, Диску, свойствам и кэшу считается.
   Результат — профиль операций: сколько вызовов и какого объёма делает каждая операция (это измерено).
   Стоимость вызова в миллисекундах (COST) — допущение: в песочнице к Google ходить нельзя, поэтому время считается моделью. */
const { createGas } = require('../sync/gasmock');
const vm = require('vm');

/* миллисекунды на один вызов; kb — на каждый килобайт передаваемых данных; cell — на ячейку диапазона */
const COST = {
  meta: 25,                              // getSheetByName, getLastRow, getMaxRows…
  rangeRead: { base: 90, cell: 0.04, kb: 0.6 },
  rangeWrite: { base: 150, cell: 0.06, kb: 1.0 },
  append: { base: 120, kb: 1.0 },
  fmt: 60,                               // setNumberFormat и т.п.
  propGet: 8, propSet: 25,
  cacheGet: 10, cachePut: 15, cacheKb: 0.1,
  driveMeta: 60,                         // getName, isTrashed, getParents…
  driveOpen: 170,                        // getFileById / getFolderById
  driveList: 120, driveListItem: 40,     // getFiles/getFolders и шаг по списку
  driveCreate: { base: 400, kb: 1.5 },
  driveRead: { base: 150, kb: 1.0 }
};

function meterGas(gas) {
  const tot = { ms: 0, calls: 0, cellsRead: 0, kbRead: 0, cellsWritten: 0, kbWritten: 0, driveCalls: 0, byKind: {} };
  const add = (kind, ms, extra) => { tot.ms += ms; tot.calls++; tot.byKind[kind] = (tot.byKind[kind] || 0) + 1; if (extra) Object.assign(tot, Object.fromEntries(Object.entries(extra).map(([k, v]) => [k, (tot[k] || 0) + v]))); };
  const kbOf = vals => { let n = 0; for (const r of vals) for (const v of r) n += typeof v === 'string' ? v.length : 8; return n / 1024; };
  const ctx = gas.ctx;
  /* таблицы */
  const ss = ctx.SpreadsheetApp.getActiveSpreadsheet();
  const origGet = ss.getSheetByName.bind(ss), origIns = ss.insertSheet.bind(ss);
  const wrapSheet = sh => {
    if (!sh || sh.__m) return sh;
    const w = Object.create(sh); w.__m = true;
    w.getLastRow = () => { add('meta', COST.meta); return sh.getLastRow(); };
    w.getMaxRows = () => { add('meta', COST.meta); return sh.getMaxRows(); };
    w.appendRow = r => { const kb = r.reduce((s, v) => s + (typeof v === 'string' ? v.length : 8), 0) / 1024; add('append', COST.append.base + kb * COST.append.kb, { kbWritten: kb }); return sh.appendRow(r); };
    w.getRange = (...a) => {
      const rg = sh.getRange(...a); const nr = a[2] || 1, nc = a[3] || 1;
      return {
        getValues() { const v = rg.getValues(); const kb = kbOf(v); add('rangeRead', COST.rangeRead.base + nr * nc * COST.rangeRead.cell + kb * COST.rangeRead.kb, { cellsRead: nr * nc, kbRead: kb }); return v; },
        setValues(v) { const kb = kbOf(v); add('rangeWrite', COST.rangeWrite.base + nr * nc * COST.rangeWrite.cell + kb * COST.rangeWrite.kb, { cellsWritten: nr * nc, kbWritten: kb }); return rg.setValues(v); },
        setNumberFormat(f) { add('fmt', COST.fmt); rg.setNumberFormat(f); return this; },
        setFontWeight(f) { add('fmt', COST.fmt); rg.setFontWeight(f); return this; },
        setFontSize() { return this; }, setBackground() { return this; }
      };
    };
    w.insertRowsAfter = (p, n) => { add('fmt', COST.fmt * 3); return sh.insertRowsAfter(p, n); };
    return w;
  };
  ss.getSheetByName = n => { add('meta', COST.meta); return wrapSheet(origGet(n)); };
  ss.insertSheet = n => { add('fmt', COST.fmt * 4); return wrapSheet(origIns(n)); };
  /* свойства и кэш */
  const PS = ctx.PropertiesService, getP = PS.getScriptProperties.bind(PS);
  PS.getScriptProperties = () => { const p = getP(); return { getProperty: k => { add('propGet', COST.propGet); return p.getProperty(k); }, setProperty: (k, v) => { add('propSet', COST.propSet); return p.setProperty(k, v); }, deleteProperty: k => { add('propSet', COST.propSet); return p.deleteProperty(k); } }; };
  const CS = ctx.CacheService, getC = CS.getScriptCache.bind(CS);
  CS.getScriptCache = () => { const c = getC(); return { get: k => { const v = c.get(k); add('cacheGet', COST.cacheGet + (v ? v.length / 1024 * COST.cacheKb : 0)); return v; }, put: (k, v) => { add('cachePut', COST.cachePut + String(v).length / 1024 * COST.cacheKb); return c.put(k, v); }, remove: k => { add('cachePut', COST.cachePut); return c.remove(k); } }; };
  /* Диск: каждая обращение к файлу и папке */
  const D = ctx.DriveApp;
  const wrapFile = f => { if (!f || f.__m) return f; const w = Object.create(f); w.__m = true;
    ['getName', 'getSize', 'getLastUpdated', 'getDescription', 'isTrashed', 'getId'].forEach(k => { w[k] = (...a) => { add('driveMeta', k === 'getId' ? 0 : COST.driveMeta, { driveCalls: k === 'getId' ? 0 : 1 }); return f[k](...a); }; });
    ['setName', 'setDescription', 'setTrashed', 'setSharing', 'moveTo'].forEach(k => { w[k] = (...a) => { add('driveMeta', COST.driveMeta * 2, { driveCalls: 1 }); f[k](...a); return w; }; });
    w.getParents = () => { add('driveMeta', COST.driveMeta, { driveCalls: 1 }); return f.getParents(); };
    w.getBlob = () => { const b = f.getBlob(); return { getBytes: () => { const x = b.getBytes(); const kb = x.length / 1024; add('driveRead', COST.driveRead.base + kb * COST.driveRead.kb, { driveCalls: 1, kbRead: kb }); return x; }, getDataAsString: () => { const x = b.getDataAsString(); const kb = x.length / 1024; add('driveRead', COST.driveRead.base + kb * COST.driveRead.kb, { driveCalls: 1, kbRead: kb }); return x; } }; };
    return w; };
  const wrapIter = it => ({ hasNext: () => it.hasNext(), next: () => { add('driveListItem', COST.driveListItem, { driveCalls: 1 }); return wrapFile2(it.next()); } });
  const wrapFile2 = x => (x && x.getFiles ? wrapFolder(x) : wrapFile(x));
  const wrapFolder = f => { if (!f || f.__m) return f; const w = Object.create(f); w.__m = true;
    ['getFiles', 'getFolders', 'getFilesByName', 'getParents'].forEach(k => { w[k] = (...a) => { add('driveList', COST.driveList, { driveCalls: 1 }); return wrapIter(f[k](...a)); }; });
    ['getName', 'getId', 'isTrashed', 'getUrl'].forEach(k => { w[k] = (...a) => { add('driveMeta', k === 'getId' ? 0 : COST.driveMeta, { driveCalls: k === 'getId' ? 0 : 1 }); return f[k](...a); }; });
    w.createFolder = n => { add('driveCreate', COST.driveCreate.base, { driveCalls: 1 }); return wrapFolder(f.createFolder(n)); };
    w.createFile = b => { const kb = (b.bytes ? b.bytes.length : 0) / 1024; add('driveCreate', COST.driveCreate.base + kb * COST.driveCreate.kb, { driveCalls: 1, kbWritten: kb }); return wrapFile(f.createFile(b)); };
    w.setName = n => { add('driveMeta', COST.driveMeta * 2, { driveCalls: 1 }); f.setName(n); return w; };
    w.setTrashed = t => { add('driveMeta', COST.driveMeta * 2, { driveCalls: 1 }); f.setTrashed(t); return w; };
    return w; };
  const gF = D.getFileById.bind(D), gD = D.getFolderById.bind(D), cF = D.createFolder.bind(D);
  D.getFileById = id => { add('driveOpen', COST.driveOpen, { driveCalls: 1 }); return wrapFile(gF(id)); };
  D.getFolderById = id => { add('driveOpen', COST.driveOpen, { driveCalls: 1 }); return wrapFolder(gD(id)); };
  D.createFolder = n => { add('driveCreate', COST.driveCreate.base, { driveCalls: 1 }); return wrapFolder(cF(n)); };
  return {
    reset() { Object.keys(tot).forEach(k => { tot[k] = k === 'byKind' ? {} : 0; }); },
    snap() { return JSON.parse(JSON.stringify(tot)); }
  };
}

/* ---- наполнение: реальными операциями скрипта, как это делает технолог ---- */
let seq = 0;
const rid = () => 'm' + (++seq) + Math.random().toString(36).slice(2, 8);
function mkIng(i, region) { return { name: 'Сырьё ' + i, p: 10 + (i % 9), f: 1 + (i % 7), c: 2 + (i % 13), kind: 'table', source: 'ТХС', price: 40 + i % 300, priceUnit: 'kg', packG: 1000, priceSrc: '1С', px: { main: { price: 40 + i % 300, at: 1790000000000 }, msk: { price: 55 + i % 300, at: 1790000000000 } }, loss: { cold: 12, heat: 18 }, note: 'x'.repeat(60) }; }
function mkRec(i, ings, ttkKb) {
  const rows = []; for (let k = 0; k < 10; k++) rows.push({ rid: 'r' + k, ing: ings[(i * 7 + k * 3) % ings.length], net: 20 + k * 11, share: 100, note: '' });
  const sec = n => ({ title: 'Раздел ' + n, text: ('Технология приготовления: подготовить сырьё, соблюдая нормы закладки; ').repeat(Math.max(1, Math.round(ttkKb * 1024 / 5 / 70))) });
  return { name: 'Блюдо ' + i, output: 100 + i % 200, rows, ref: { label: '', p: null, f: null, c: null }, sell: { main: 90 + i % 60, msk: 120 + i % 60 }, reg: i % 3 === 0 ? 'msk' : 'main', ttk: { org: 'ООО «Кредо»', head: 'Директор', headName: 'Масычев А. Ю.', date: '«1» сентября 2026г.', num: String(i), sections: [sec(1), sec(2), sec(3), sec(4), sec(5)] } };
}
/* nIng, nRec — размер общей базы; nPend — сколько строк в журнале предложений (история копится, её никто не чистит) */
function seeded({ nIng, nRec, nPend, ttkKb = 3.5, aged = false }) {
  const gas = createGas({ now: undefined });
  const A = 'adm-5678', E = 'ed-1234';
  gas.ctx && vm.runInContext('setup()', gas.ctx);
  const ids = []; const items = [];
  for (let i = 0; i < nIng; i++) { ids.push('i-' + i); items.push({ kind: 'ing', sid: 'i-' + i, name: 'Сырьё ' + i, json: mkIng(i) }); }
  for (let i = 0; i < nRec; i++) items.push({ kind: 'rec', sid: 'r-' + i, name: 'Блюдо ' + i, json: mkRec(i, ids, ttkKb) });
  for (let k = 0; k < items.length; k += 80) {
    const r = gas.parseOut(gas.post({ rid: rid(), op: 'publish', code: A, by: 'Технолог', items: items.slice(k, k + 80) })).data; if (!r.ok) throw new Error('publish: ' + JSON.stringify(r));
  }
  /* история предложений: пачки по 2 позиции от разных редакторов; половина принята технологом */
  const batches = [];
  for (let k = 0; k < nPend; k += 2) {
    const j = k % Math.max(1, nRec);
    const r = gas.parseOut(gas.post({ rid: rid(), op: 'propose', code: E, by: 'Редактор ' + (k % 5), note: 'правка', items: [{ kind: 'rec', sid: 'r-' + j, name: 'Блюдо ' + j, base: 1, json: mkRec(j + 1000, ids, ttkKb) }, { kind: 'ing', sid: 'i-' + (j % nIng), name: 'Сырьё ' + (j % nIng), base: 1, json: mkIng(j) }] })).data;
    if (!r.ok) throw new Error('propose: ' + JSON.stringify(r)); batches.push(r.batch);
  }
  /* как в жизни: почти вся история уже принята технологом, на проверке только последние пачки */
  const keep = new Set(batches.slice(-3)), pend = gas.sheets['Предложения']._sh.rows;
  for (let i = 1; i < pend.length; i++) if (pend[i] && pend[i][0] && !keep.has(pend[i][0])) { pend[i][7] = 'принято'; pend[i][8] = (pend[i][8] || '') + ' | принял: Технолог'; pend[i][11] = new Date(); pend[i][12] = 'Технолог'; }
  /* aged: история старая (месяцы назад); скрипт с чисткой журнала (v20) убирает её в архив при первом принятии */
  if (aged) {
    const old = new Date(Date.now() - 60 * 86400000);
    for (let i = 1; i < pend.length; i++) if (pend[i] && pend[i][0] && !keep.has(pend[i][0])) { pend[i][6] = old; pend[i][11] = old; }
    const last = batches[batches.length - 1];
    if (last) gas.parseOut(gas.post({ rid: rid(), op: 'approve', code: A, by: 'Технолог', batch: last, note: 'ок' }));
  }
  return { gas, A, E, ids, batches };
}

module.exports = { COST, meterGas, seeded, rid, mkIng, mkRec };
