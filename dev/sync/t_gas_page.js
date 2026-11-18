/* Страница калькулятора по адресу скрипта: загрузка технологом, раздача по адресу без параметров, чужие и «не те» файлы не принимаются */
const assert = require('assert'), { createGas } = require('./gasmock');
const E = 'ed-1234', A = 'adm-5678', F = 'fin-9012';
function mk(opts) {
  const g = createGas(opts || {});
  const get = (code, p) => g.parseOut(g.get(Object.assign(code === null ? {} : { code }, p))).data;
  const post = b => JSON.parse(g.post(Object.assign({ rid: 'rid-' + Math.random().toString(36).slice(2) + '-abcdef' }, b)).text);
  return { g, get, post };
}
const page = (extra = '', mark = true) => '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>ТехнолоGия</title></head><body>' + 'Борщ и ёжики · '.repeat(4000) + '<script>' + (mark ? 'window.KBZHU_' + 'RELEASE=1;' : 'var x=1;') + '</script>' + extra + '</body></html>';
const put = (post, o = {}) => post(Object.assign({ op: 'pagePut', code: A, by: 'Технолог', html: page('<!--v1-->') }, o));
const folder = (g, name) => Object.values(g.drive.items).find(x => x.kind === 'folder' && !x.trashed && x.name === name);
const files = g => Object.values(g.drive.items).filter(x => x.kind === 'file' && !x.trashed && x.name === 'Страница калькулятора.html');

// ---------- до загрузки: заглушка, а не ошибка ----------
{
  const { g, get } = mk();
  assert.strictEqual(get(null, { a: 'ping' }).v, 31, 'версия скрипта 31');
  const o = g.get({});
  assert.strictEqual(o.mime, 'HTML'); assert.ok(/ещё не загружена/.test(o.text), 'заглушка с подсказкой'); assert.strictEqual(o.title, 'ТехнолоGия');
  assert.strictEqual(o.meta.viewport, 'width=device-width, initial-scale=1'); assert.strictEqual(o.xf, 'ALLOWALL');
  assert.strictEqual(get(null, { a: 'pageinfo' }).err, 'code', 'сведения о странице — по коду');
  assert.strictEqual(get(A, { a: 'pageinfo' }).has, false);
  // обычные запросы к данным не затронуты: без кода по-прежнему отказ, с callback — JSONP
  assert.strictEqual(g.parseOut(g.get({ a: 'pull', callback: 'cb' })).data.err, 'code');
  assert.strictEqual(g.parseOut(g.get({ a: 'ping', callback: 'cb' })).cb, 'cb');
}

// ---------- загрузка и раздача ----------
{
  const { g, get, post } = mk();
  let r = put(post); assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.ok(folder(g, 'Страница калькулятора'), 'папка на Диске'); assert.strictEqual(files(g).length, 1);
  assert.ok(!files(g)[0].shared, 'файл на Диске закрыт: отдаёт его только скрипт');
  const o = g.get({}); assert.strictEqual(o.mime, 'HTML'); assert.ok(o.text.includes('<!--v1-->') && o.text.includes('Борщ и ёжики'), 'страница отдаётся целиком, русский текст цел');
  assert.ok(!/ещё не загружена/.test(o.text));
  let i = get(A, { a: 'pageinfo' }); assert.strictEqual(i.has, true); assert.strictEqual(i.by, 'Технолог'); assert.ok(i.size > 50000); assert.ok(Math.abs(i.at - Date.now()) < 60000);
  assert.strictEqual(get(E, { a: 'pageinfo' }).has, true, 'любой код видит, что страница есть');
  // обновление: старый файл в корзине, новая страница отдаётся
  r = put(post, { html: page('<!--v2-->'), by: 'Другой технолог' }); assert.strictEqual(r.ok, true);
  assert.strictEqual(files(g).length, 1); assert.ok(g.get({}).text.includes('<!--v2-->') && !g.get({}).text.includes('<!--v1-->'));
  assert.strictEqual(get(A, { a: 'pageinfo' }).by, 'Другой технолог');
  // файл удалили с Диска вручную: снова заглушка
  files(g).forEach(f => { f.trashed = true; });
  assert.ok(/ещё не загружена/.test(g.get({}).text)); assert.strictEqual(get(A, { a: 'pageinfo' }).has, false);
}

// ---------- файл сборки — фрагмент без <html>, как его делает build.py ----------
{
  const { g, post } = mk();
  const frag = '<title>ТехнолоGия</title>\n<style>body{margin:0}</style>\n<div id="app"></div>\n<script>' + 'window.KBZHU_' + 'RELEASE=1;' + '/* ' + 'Борщ '.repeat(12000) + '*/</script>';
  const r = put(post, { html: frag }); assert.strictEqual(r.ok, true, JSON.stringify(r));
  assert.strictEqual(g.get({}).text, frag, 'фрагмент отдаётся как есть');
}

// ---------- кто и что может загрузить ----------
{
  const { g, get, post } = mk();
  assert.strictEqual(put(post, { code: E }).err, 'admin', 'редактор страницу не загружает');
  assert.strictEqual(put(post, { code: F }).err, 'admin', 'экономист тоже');
  assert.strictEqual(put(post, { code: 'чужой' }).err, 'code');
  assert.strictEqual(put(post, { html: page('', false) }).err, 'release', 'без метки чистой сборки (там могут быть цены) — нельзя');
  assert.ok(/КБЖУ_калькулятор_автономный/.test(put(post, { html: page('', false) }).msg));
  assert.strictEqual(put(post, { html: '<html>коротко</html>' }).err, 'page');
  assert.strictEqual(put(post, { html: 'Привет'.repeat(20000) }).err, 'page', 'не html');
  assert.strictEqual(put(post, { html: 'Привет'.repeat(20000) + '<html></html>' }).err, 'page', 'без программы внутри');
  assert.strictEqual(put(post, { html: page('x'.repeat(6 * 1024 * 1024)) }).err, 'size');
  assert.strictEqual(files(g).length, 0, 'ничего лишнего не записано');
  assert.ok(/ещё не загружена/.test(g.get({}).text));
}

// ---------- Диск не разрешён ----------
{
  const { post } = mk({ noDrive: true });
  const r = put(post); assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'drive', JSON.stringify(r));
}
console.log('GAS page ok');
