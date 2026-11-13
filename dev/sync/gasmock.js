/* Имитация среды Apps Script: настоящий Code.gs выполняется в песочнице с заменой SpreadsheetApp, ContentService и др. */
const vm = require('vm'), fs = require('fs'), path = require('path');
function createGas(opts = {}) {
  const src = fs.readFileSync(path.join(__dirname, opts.file || 'Code.gs'), 'utf8')
    .replace("'ЗАМЕНИТЕ-код-редактора'", JSON.stringify(opts.editor || 'ed-1234'))
    .replace("'ЗАМЕНИТЕ-код-технолога'", JSON.stringify(opts.admin || 'adm-5678'))
    .replace("'ЗАМЕНИТЕ-код-управляющего'", opts.finance === null ? "'ЗАМЕНИТЕ-код-управляющего'" : JSON.stringify(opts.finance || 'fin-9012'))
    .replace("'ЗАМЕНИТЕ-код-шеф-повара'", opts.view === null ? "'ЗАМЕНИТЕ-код-шеф-повара'" : JSON.stringify(opts.view || 'view-3456'))
    .replace("'ЗАМЕНИТЕ-код-аудита'", opts.audit === null ? "'ЗАМЕНИТЕ-код-аудита'" : JSON.stringify(opts.audit || 'aud-7788'))
    .replace(/var EXEC_RE = .*;/, opts.strictExec ? '$&' : 'var EXEC_RE = /^https?:\\/\\/(?:script\\.google\\.com|127\\.0\\.0\\.1:\\d+)\\/.*\\/?exec$/;');
  const sheets = {}; const props = {}; const cache = {}; const fetchLog = []; let lockHeld = false;
  /* общим кодам по умолчанию назначены все регионы (так прежние тесты не меняются); opts.rs === null — регионы не назначены, как после обновления скрипта */
  if (opts.rs !== null) props.rs = JSON.stringify(opts.rs || (() => { const a = ['main', 'msk', 'r2', 'spb', 'ufa', 'kzn', 'kzn2', 'omsk']; return { editor: a, finance: a, viewer: a, audit: a }; })());
  const CELL_LIMIT = 50000;
  function mkSheet(name) {
    const sh = { name, rows: [], maxRows: 1000, maxCols: 26, frozen: 0, fmt: [], bold: [], widths: {} };
    const api = {
      appendRow(r) { sh.rows.push(r.slice()); },
      setFrozenRows(n) { sh.frozen = n; },
      deleteRow(r) { sh.rows.splice(r - 1, 1); },
      getName() { return sh.name; }, setName(n) { sh.name = String(n); return api; },
      clear() { sh.rows = []; sh.fmt = []; sh.bold = []; return api; },
      getLastRow() { let n = sh.rows.length; while (n > 0 && sh.rows[n - 1].every(v => v === '' || v === undefined)) n--; return n; },
      getMaxRows() { return sh.maxRows; },
      getMaxColumns() { return sh.maxCols; },
      insertRowsAfter(pos, n) { sh.maxRows += n; },
      insertColumnsAfter(pos, n) { sh.maxCols += n; },
      setColumnWidth(c, w) { if (!(c >= 1 && c <= sh.maxCols)) throw new Error('Столбец вне листа'); sh.widths[c] = w; },
      getRange(r, c, nr, nc) {
        nr = nr || 1; nc = nc || 1;
        if (r + nr - 1 > sh.maxRows) throw new Error('Диапазон выходит за границы листа: ' + (r + nr - 1) + ' > ' + sh.maxRows);
        if (c + nc - 1 > sh.maxCols) throw new Error('Диапазон выходит за границы листа: столбец ' + (c + nc - 1) + ' > ' + sh.maxCols);
        return {
          getValues() { const out = []; for (let i = 0; i < nr; i++) { const row = []; for (let j = 0; j < nc; j++) { const v = (sh.rows[r - 1 + i] || [])[c - 1 + j]; row.push(v === undefined ? '' : v); } out.push(row); } return out; },
          setValues(vals) {
            if (vals.length !== nr || vals.some(v => v.length !== nc)) throw new Error('Размер данных не совпадает с диапазоном');
            vals.forEach((rowv, i) => { const rr = (sh.rows[r - 1 + i] = sh.rows[r - 1 + i] || []); rowv.forEach((v, j) => { if (typeof v === 'string' && v.length > CELL_LIMIT) throw new Error('Ячейка длиннее 50000 символов'); rr[c - 1 + j] = v; }); });
            for (let i = 0; i < sh.rows.length; i++) sh.rows[i] = sh.rows[i] || [];
          },
          clearContent() { for (let i = 0; i < nr; i++) { const row = sh.rows[r - 1 + i]; if (row) for (let j = 0; j < nc; j++) if (c - 1 + j < row.length) row[c - 1 + j] = ''; } return this; },
          setNumberFormat(f) { sh.fmt.push({ r, c, nr, nc, f }); return this; },
          setFontWeight(w) { sh.bold.push({ r, c, nr, nc, w }); return this; }, setFontSize() { return this; }, setBackground() { return this; }
        };
      }
    };
    api._sh = sh;
    return api;
  }
  const ss = { getSheetByName(n) { return sheets[n] || null; }, insertSheet(n) { sheets[n] = mkSheet(n); return sheets[n]; } };
  /* Google Диск: папки и файлы с идентификаторами, родителями, корзиной */
  const drive = { items: {}, seq: 0, root: [] };
  const toSigned = buf => Array.from(buf).map(b => (b > 127 ? b - 256 : b));
  const noDriveErr = fn => new Error('Exception: You do not have permission to call DriveApp.' + fn + '. Required permissions: https://www.googleapis.com/auth/drive');
  const iter = arr => { let i = 0; return { hasNext: () => i < arr.length, next: () => arr[i++] }; };
  function mkItem(kind, name, parents) {
    const id = 'drv' + String(++drive.seq).padStart(4, '0') + 'AbCdEfGhIj';
    return (drive.items[id] = { id, kind, name, parents: parents.slice(), trashed: false, bytes: Buffer.alloc(0), desc: '', updated: Date.now() + drive.seq });
  }
  function folderObj(it) {
    const o = {
      getId: () => it.id, getName: () => it.name, getUrl: () => 'https://drive.google.com/drive/folders/' + it.id,
      isTrashed: () => it.trashed, setTrashed(t) { it.trashed = !!t; return o; },
      createFolder(n) { if (opts.noDrive) throw noDriveErr('createFolder'); return folderObj(mkItem('folder', n, [it.id])); },
      createFile(blob) {
        if (opts.noDrive) throw noDriveErr('createFile');
        if (!blob || !blob.bytes) throw new Error('Аргумент должен быть Blob');
        const f = mkItem('file', blob.name, [it.id]); f.bytes = Buffer.from(blob.bytes.map(b => b & 255)); f.mime = blob.mime; return fileObj(f);
      },
      getFiles: () => iter(Object.values(drive.items).filter(x => x.kind === 'file' && !x.trashed && x.parents.includes(it.id)).map(fileObj)),
      getFilesByName: n => iter(Object.values(drive.items).filter(x => x.kind === 'file' && !x.trashed && x.name === n && x.parents.includes(it.id)).map(fileObj)),
      getFolders: () => iter(Object.values(drive.items).filter(x => x.kind === 'folder' && !x.trashed && x.parents.includes(it.id)).map(folderObj)),
      getParents: () => iter(it.parents.map(id => folderObj(drive.items[id]))),
      setName(n) { it.name = String(n); return o; }
    };
    return o;
  }
  function fileObj(it) {
    const o = {
      getId: () => it.id, getName: () => it.name, getSize: () => it.bytes.length, getLastUpdated: () => new Date(it.updated),
      getDescription: () => it.desc, setDescription(d) { it.desc = String(d); return o; }, setName(n) { it.name = String(n); it.updated = Date.now(); return o; },
      isTrashed: () => it.trashed, setTrashed(t) { it.trashed = !!t; return o; },
      getParents: () => iter(it.parents.map(id => folderObj(drive.items[id]))),
      getBlob: () => ({ getBytes: () => toSigned(it.bytes), getDataAsString: () => Buffer.from(it.bytes).toString('utf8') }),
      moveTo(fo) { it.parents = [fo.getId()]; it.updated = Date.now(); return o; },
      setSharing(access, perm) { if (opts.noShare) throw new Error('Exception: Access denied: DriveApp.'); it.shared = [access, perm]; return o; }
    };
    return o;
  }
  /* маленькие таблицы, созданные скриптом (файл с адресом): читаются страницей через gviz, поэтому тесты берут их строки из books */
  const books = {};
  function bookApi(b) {
    const o = {
      getId: () => b.id, getName: () => b.name, getUrl: () => 'https://docs.google.com/spreadsheets/d/' + b.id + '/edit',
      rename(n) { b.name = String(n); b.item.name = String(n); return o; },
      getSheets: () => b.sheets.slice(),
      getSheetByName: n => b.sheets.find(x => x.getName() === n) || null,
      insertSheet(n) {
        if (b.sheets.some(x => x.getName() === n)) throw new Error('Лист с таким названием уже есть: ' + n);
        const sh = mkSheet(n); b.sheets.push(sh); return sh;
      },
      deleteSheet(sh) {
        if (b.sheets.length < 2) throw new Error('Нельзя удалить единственный лист');
        const i = b.sheets.indexOf(sh); if (i < 0) throw new Error('Листа нет в этой книге'); b.sheets.splice(i, 1);
      }
    };
    return o;
  }
  function mkBook(name) {
    if (opts.noDrive) throw noDriveErr('SpreadsheetApp.create');
    const it = mkItem('file', name, []); const sh = mkSheet(opts.defaultSheet || name);
    const b = { id: it.id, name, item: it, sheet: sh, sheets: [sh] };
    books[it.id] = b;
    return bookApi(b);
  }
  const ctx = {
    DriveApp: {
      Access: { ANYONE_WITH_LINK: 'ANYONE_WITH_LINK', ANYONE: 'ANYONE', PRIVATE: 'PRIVATE' }, Permission: { VIEW: 'VIEW', EDIT: 'EDIT', NONE: 'NONE' },
      createFolder(n) { if (opts.noDrive) throw noDriveErr('createFolder'); return folderObj(mkItem('folder', n, [])); },
      getFolderById(id) { if (opts.noDrive) throw noDriveErr('getFolderById'); const it = drive.items[id]; if (!it || it.kind !== 'folder') throw new Error('Exception: Unexpected error while getting the method or property getFolderById on object DriveApp.'); return folderObj(it); },
      getFileById(id) { if (opts.noDrive) throw noDriveErr('getFileById'); const it = drive.items[id]; if (!it || it.kind !== 'file') throw new Error('Exception: Unexpected error while getting the method or property getFileById on object DriveApp.'); return fileObj(it); }
    },
    SpreadsheetApp: { getActiveSpreadsheet() { return ss; }, create: mkBook, openById(id) { if (opts.noDrive) throw noDriveErr('SpreadsheetApp.openById'); const b = books[id]; if (!b) throw new Error('Exception: Unexpected error while getting the method or property openById on object SpreadsheetApp.'); return bookApi(b); } },
    Session: { getScriptTimeZone: () => 'Europe/Moscow' },
    UrlFetchApp: { fetch(url, params) { fetchLog.push({ url, params }); if (!opts.fetch) throw new Error('Exception: Address unavailable: ' + url); const r = opts.fetch(url, params, fetchLog); return { getResponseCode: () => r.code, getContentText: () => r.body }; } },
    ContentService: { MimeType: { JAVASCRIPT: 'JS', JSON: 'JSON' }, createTextOutput(t) { return { text: t, mime: 'TEXT', setMimeType(m) { this.mime = m; return this; } }; } },
    LockService: { getScriptLock() { return { waitLock() { if (opts.lockBusy) throw new Error('timeout'); if (lockHeld) throw new Error('timeout'); lockHeld = true; }, releaseLock() { lockHeld = false; } }; } },
    CacheService: { getScriptCache() { return { get: k => (k in cache ? cache[k] : null), put(k, v) { if (String(v).length > 100000) throw new Error('Слишком большое значение'); cache[k] = v; }, remove(k) { delete cache[k]; },
      getAll(ks) { const o = {}; ks.forEach(k => { if (k in cache) o[k] = cache[k]; }); return o; },
      putAll(o) { Object.keys(o).forEach(k => { if (String(o[k]).length > 100000) throw new Error('Слишком большое значение'); cache[k] = o[k]; }); },
      removeAll(ks) { ks.forEach(k => { delete cache[k]; }); } }; } },
    PropertiesService: { getScriptProperties() { return { getProperty: k => (k in props ? props[k] : null), setProperty(k, v) { props[k] = String(v); }, deleteProperty(k) { delete props[k]; } }; } },
    Utilities: {
      getUuid() { return require('crypto').randomUUID(); },
      DigestAlgorithm: { SHA_256: 'SHA_256' }, Charset: { UTF_8: 'UTF_8' },
      computeDigest(alg, s) { return toSigned(require('crypto').createHash('sha256').update(String(s), 'utf8').digest()); },
      base64Decode(t) { t = String(t); if (/[^A-Za-z0-9+\/=_-]/.test(t)) throw new Error('Exception: Invalid argument: base64'); return toSigned(Buffer.from(t, 'base64')); },
      base64Encode(b) { return Buffer.from(Array.from(b).map(x => x & 255)).toString('base64'); },
      newBlob(bytes, mime, name) { return { bytes: typeof bytes === 'string' ? Array.from(Buffer.from(bytes, 'utf8')) : Array.from(bytes), mime, name }; },
      formatDate(d, tz, f) { const p = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(opts.now ? new Date(opts.now()) : d).split('-'); return f.replace('yyyy', p[0]).replace('MM', p[1]).replace('dd', p[2]); }
    },
    HtmlService: { XFrameOptionsMode: { ALLOWALL: 'ALLOWALL', DEFAULT: 'DEFAULT' }, createHtmlOutput(h) { const o = { mime: 'HTML', text: String(h), title: '', meta: {}, setTitle(t) { o.title = t; return o; }, addMetaTag(k, v) { o.meta[k] = v; return o; }, setXFrameOptionsMode(m) { o.xf = m; return o; } }; return o; } },
    Logger: { log() {} }, console
  };
  vm.createContext(ctx); vm.runInContext(src, ctx);
  const parseOut = o => { if (o.mime === 'JS') { const m = o.text.match(/^([\w$.]+)\(([\s\S]*)\);$/); return { cb: m[1], data: JSON.parse(m[2]) }; } return { data: JSON.parse(o.text) }; };
  const regFo = id => { const r = JSON.parse(props.tregs || '[]').find(x => x.id === id); return r && r.fo; };
  return {
    sheets, props, cache, ctx, drive, books, opts, fetchLog,
    /* папка региона калькулятора (id региона -> id папки на «Диске») */
    regFolder(id) { return regFo(id); },
    /* файл, положенный в папку вручную (перетаскиванием), без описания */
    dropFile(where, name, bytes) {
      const fid = where === 'pend' ? props.folderPend : (String(where).startsWith('reg:') ? regFo(where.slice(4)) : props.folder), f = mkItem('file', name, [fid]); f.bytes = Buffer.from(bytes); return f.id;
    },
    driveFiles(where) {
      const fid = where === 'pend' ? props.folderPend : (where === 'main' ? props.folder : (String(where).startsWith('reg:') ? regFo(where.slice(4)) : where));
      return Object.values(drive.items).filter(x => x.kind === 'file' && x.parents.includes(fid)).map(x => ({ id: x.id, name: x.name, trashed: x.trashed, size: x.bytes.length, desc: x.desc }));
    },
    /* файл в произвольную папку (по идентификатору) */
    dropFileIn(folderId, name, bytes) { const f = mkItem('file', name, [folderId]); f.bytes = Buffer.from(bytes); return f.id; },
    get(params) { return vm.runInContext('doGet', ctx)({ parameter: params }); },
    post(body) { return vm.runInContext('doPost', ctx)({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }); },
    parseOut,
    rows(name) { const s = sheets[name]; return s ? s._sh.rows.slice(1).filter(r => r.length && r.some(v => v !== '' && v !== undefined)) : []; }
  };
}
module.exports = { createGas };
