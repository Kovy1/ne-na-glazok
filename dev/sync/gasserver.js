/* HTTP-обёртка над настоящим Code.gs (на имитации среды Apps Script): ведёт себя как веб-приложение Google — GET и POST отвечают переадресацией, CORS-заголовков нет */
const http = require('http'), { createGas } = require('./gasmock');
function startGas(opts = {}) {
  const gas = opts.gasInstance || createGas(opts), store = {}; let n = 0, mode = 'ok';
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    if (u.pathname === '/echo') { const o = store[u.searchParams.get('id')]; if (!o) { res.writeHead(404); return res.end(); } res.writeHead(200, { 'Content-Type': o.mime === 'JS' ? 'text/javascript; charset=utf-8' : (o.mime === 'HTML' ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8') }); return res.end(o.text); }
    if (u.pathname !== '/exec') { res.writeHead(404); return res.end(); }
    const go = out => { const id = String(++n); store[id] = out; res.writeHead(302, { Location: '/echo?id=' + id }); res.end(); };
    if (mode === 'down') { req.destroy(); return; }
    if (mode === 'login' && req.method === 'GET') { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end('<!doctype html><html><body>Sign in</body></html>'); }
    if (req.method === 'GET') { const parameter = {}; u.searchParams.forEach((v, k) => parameter[k] = v); return setTimeout(() => go(gas.get(parameter)), opts.delay || 0); }
    const chunks = []; req.on('data', c => chunks.push(c)); req.on('end', () => { const body = Buffer.concat(chunks).toString('utf8'); setTimeout(() => { go(gas.post(body)); }, opts.delay || 0); });
  });
  return new Promise(r => server.listen(0, '127.0.0.1', () => r({ url: 'http://127.0.0.1:' + server.address().port + '/exec', gas, setMode(m) { mode = m; }, close() { server.close(); } })));
}
module.exports = { startGas };
