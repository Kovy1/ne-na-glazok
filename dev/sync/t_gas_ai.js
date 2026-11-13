/* Помощник ИИ в скрипте: ключ GigaChat задаёт технолог, запросы идут от технолога и редактора, ключ наружу не отдаётся */
const assert = require('assert'), { createGas } = require('./gasmock');
const rid = () => 'rid-' + Math.random().toString(36).slice(2) + '-abcdef';
const post = (g, o) => g.parseOut(g.post(Object.assign({ rid: rid() }, o))).data;
const get = (g, o) => g.parseOut(g.get(o)).data;
const KEY = 'QWJjZGVmZ2hpamtsbW5vcHFyc3R1dnd4eXowMTIzNDU2Nzg5Og==';
const A = 'adm-5678', E = 'ed-1234', V = 'view-3456', F = 'fin-9012';
(function () {
  let mode = 'ok', oauth = 0, chat = 0;
  const g = createGas({
    lockBusy: false,
    fetch(url, p) {
      if (mode === 'tls' && !(p && p.validateHttpsCertificates === false)) throw new Error('Exception: SSL certificate problem: unable to get local issuer certificate');
      if (/oauth/.test(url)) { oauth++; if (mode === 'badkey') return { code: 401, body: JSON.stringify({ code: 401, message: 'Credentials doesn\'t match db data' }) }; return { code: 200, body: JSON.stringify({ access_token: 'tok' + oauth, expires_at: Date.now() + 1800000 }) }; }
      chat++;
      if (mode === 'pay') return { code: 402, body: '{"message":"Payment Required"}' };
      if (mode === 'rate') return { code: 429, body: '{}' };
      if (mode === 'stale' && /tok1$/.test(p.headers.Authorization)) return { code: 401, body: '{}' };
      if (mode === 'empty') return { code: 200, body: JSON.stringify({ choices: [] }) };
      return { code: 200, body: JSON.stringify({ model: 'GigaChat-2:2.0.28.2', choices: [{ message: { role: 'assistant', content: 'Мясо нарезать кубиками.\nОбжарить.' } }], usage: { total_tokens: 321 } }) };
    }
  });
  const ask = (o) => post(g, Object.assign({ op: 'ai', code: E, system: 'Ты технолог.', user: 'Блюдо: Гуляш' }, o));
  // 1. до настройки
  let p = get(g, { a: 'ping' }); assert.strictEqual(p.v, 30, 'версия скрипта 30'); assert.strictEqual(p.ai, 0); assert.strictEqual(p.aip, 'openrouter', 'по умолчанию OpenRouter');
  let r = ask({}); assert.strictEqual(r.ok, false); assert.strictEqual(r.err, 'aikey');
  assert.strictEqual(g.fetchLog.length, 0, 'без ключа наружу ничего не уходит');
  // 2. роли
  assert.strictEqual(ask({ code: V }).err, 'viewer'); assert.strictEqual(ask({ code: F }).err, 'viewer'); assert.strictEqual(ask({ code: 'bad-code' }).err, 'code');
  r = post(g, { op: 'aikey', code: E, key: KEY }); assert.strictEqual(r.err, 'admin', 'ключ задаёт только технолог');
  r = post(g, { op: 'aikey', code: A, key: 'коротко' }); assert.strictEqual(r.err, 'aikey');
  r = post(g, { op: 'aikey', code: A, prov: 'giga', key: 'Basic ' + KEY + '\n' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.ai.ready, true); assert.strictEqual(r.ai.scope, 'GIGACHAT_API_PERS'); assert.strictEqual(r.ai.model, 'GigaChat-2');
  assert.strictEqual(g.props.gigaAuth, KEY, 'ключ без «Basic» и пробелов');
  assert.strictEqual(get(g, { a: 'ping' }).ai, 1);
  const ia = get(g, { a: 'aiinfo', code: A }), ie = get(g, { a: 'aiinfo', code: E });
  assert.strictEqual(ia.ready, true); assert.strictEqual(ia.scope, 'GIGACHAT_API_PERS'); assert.strictEqual(ie.ready, true); assert.strictEqual(ie.scope, undefined, 'редактору настройки не показываются');
  assert.strictEqual(get(g, { a: 'aiinfo', code: 'x' }).err, 'code');
  // 3. обычный запрос: токен берётся один раз
  r = ask({}); assert.strictEqual(r.ok, true); assert.strictEqual(r.text, 'Мясо нарезать кубиками.\nОбжарить.'); assert.strictEqual(r.tokens, 321);
  const o1 = g.fetchLog[0], c1 = g.fetchLog[1];
  assert.ok(/ngw\.devices\.sberbank\.ru:9443\/api\/v2\/oauth$/.test(o1.url)); assert.strictEqual(o1.params.headers.Authorization, 'Basic ' + KEY); assert.strictEqual(o1.params.payload, 'scope=GIGACHAT_API_PERS'); assert.ok(/^[0-9a-f-]{36}$/.test(o1.params.headers.RqUID));
  assert.ok(/gigachat\.devices\.sberbank\.ru\/api\/v1\/chat\/completions$/.test(c1.url)); assert.strictEqual(c1.params.headers.Authorization, 'Bearer tok1');
  const body = JSON.parse(c1.params.payload); assert.strictEqual(body.model, 'GigaChat-2'); assert.strictEqual(body.messages.length, 2); assert.strictEqual(body.messages[0].role, 'system'); assert.strictEqual(body.messages[1].content, 'Блюдо: Гуляш'); assert.strictEqual(body.temperature, 0.3); assert.strictEqual(body.stream, false);
  ask({}); assert.strictEqual(oauth, 1, 'токен переиспользуется'); assert.strictEqual(chat, 2);
  assert.ok(!JSON.stringify(r).includes(KEY) && !JSON.stringify(ia).includes(KEY), 'ключ наружу не отдаётся');
  r = ask({ temp: 5, max: 99999, user: 'x'.repeat(20000), system: '' }); const b2 = JSON.parse(g.fetchLog[g.fetchLog.length - 1].params.payload);
  assert.strictEqual(b2.temperature, 1); assert.strictEqual(b2.max_tokens, 2000); assert.strictEqual(b2.messages.length, 1); assert.strictEqual(b2.messages[0].content.length, 12000, 'длинный запрос обрезается');
  assert.strictEqual(ask({ user: '   ' }).err, 'ai');
  // 4. технолог тоже может спрашивать; тип доступа и модель
  assert.strictEqual(ask({ code: A }).ok, true);
  r = post(g, { op: 'aikey', code: A, scope: 'GIGACHAT_API_B2B', model: 'GigaChat-2-Pro' }); assert.strictEqual(r.ai.scope, 'GIGACHAT_API_B2B'); assert.strictEqual(r.ai.model, 'GigaChat-2-Pro');
  assert.strictEqual(post(g, { op: 'aikey', code: A, scope: 'EVIL' }).err, 'aikey'); assert.strictEqual(post(g, { op: 'aikey', code: A, model: 'x' }).err, 'aikey');
  const n0 = g.fetchLog.length; ask({});
  assert.strictEqual(g.fetchLog[n0].params.payload, 'scope=GIGACHAT_API_B2B', 'после смены доступа токен берётся заново');
  assert.strictEqual(JSON.parse(g.fetchLog[n0 + 1].params.payload).model, 'GigaChat-2-Pro');
  post(g, { op: 'aikey', code: A, scope: 'GIGACHAT_API_PERS', model: 'GigaChat-2' });
  // 5. ошибки GigaChat понятны
  mode = 'pay'; assert.strictEqual(ask({}).err, 'pay'); mode = 'rate'; assert.strictEqual(ask({}).err, 'rate'); mode = 'empty'; assert.strictEqual(ask({}).err, 'ai');
  mode = 'stale'; g.cache['ai:tok'] = 'tok1'; r = ask({}); assert.strictEqual(r.ok, true, 'устаревший токен заменяется сам'); mode = 'ok';
  mode = 'badkey'; delete g.cache['ai:tok']; r = ask({}); assert.strictEqual(r.err, 'aikey'); assert.ok(/ключ/.test(r.msg)); mode = 'ok';
  // 6. сертификат Сбера: понятная ошибка и явное разрешение технолога
  mode = 'tls'; delete g.cache['ai:tok']; r = ask({}); assert.strictEqual(r.err, 'tls'); assert.ok(/сертификат/.test(r.msg));
  assert.strictEqual(post(g, { op: 'aikey', code: E, lax: true }).err, 'admin');
  assert.strictEqual(post(g, { op: 'aikey', code: A, lax: true }).ai.lax, true);
  r = ask({}); assert.strictEqual(r.ok, true); assert.strictEqual(g.fetchLog[g.fetchLog.length - 1].params.validateHttpsCertificates, false); mode = 'ok';
  assert.strictEqual(post(g, { op: 'aikey', code: A, lax: false }).ai.lax, false);
  // 7. сеть недоступна
  const g2 = createGas({}); post(g2, { op: 'aikey', code: A, key: KEY });
  r = post(g2, { op: 'ai', code: E, user: 'q' }); assert.strictEqual(r.err, 'net'); assert.ok(/Не удалось связаться/.test(r.msg));
  // 8. ИИ не держит таблицу: при занятой блокировке запись отказывает, а ИИ отвечает
  const g3 = createGas({ lockBusy: true, fetch: (u) => /oauth/.test(u) ? { code: 200, body: JSON.stringify({ access_token: 't', expires_at: Date.now() + 1800000 }) } : { code: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) } });
  g3.props.gigaAuth = KEY;
  assert.strictEqual(post(g3, { op: 'propose', code: E, items: [] }).err, 'busy'); assert.strictEqual(post(g3, { op: 'ai', code: E, user: 'q' }).ok, true);
  // 9. повторный запрос с тем же rid не уходит в ИИ второй раз
  const g4 = createGas({ fetch: () => ({ code: 200, body: JSON.stringify({ access_token: 't', expires_at: Date.now() + 1800000, choices: [{ message: { content: 'ok' } }] }) }) }); g4.props.gigaAuth = KEY;
  const same = rid(); post(g4, { op: 'ai', code: E, user: 'q', rid: same }); const n = g4.fetchLog.length; post(g4, { op: 'ai', code: E, user: 'q', rid: same }); assert.strictEqual(g4.fetchLog.length, n, 'повтор не вызывает ИИ');
  // 10. лимит запросов в час
  const g5 = createGas({ fetch: (u) => /oauth/.test(u) ? { code: 200, body: JSON.stringify({ access_token: 't', expires_at: Date.now() + 1800000 }) } : { code: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) } }); g5.props.gigaAuth = KEY;
  let last; for (let i = 0; i < 121; i++) last = post(g5, { op: 'ai', code: E, user: 'q' + i });
  assert.strictEqual(last.err, 'rate'); assert.ok(/час/.test(last.msg));
  // 11. ключ можно убрать
  r = post(g, { op: 'aikey', code: A, clear: true }); assert.strictEqual(r.ai.ready, false); assert.strictEqual(get(g, { a: 'ping' }).ai, 0); assert.strictEqual(ask({}).err, 'aikey');
  // 12. другие сервисы с форматом OpenAI (OpenRouter и др.)
  let mode2 = 'ok', calls = [];
  const FREE = [
    { id: 'a/small:free', name: 'Small', context_length: 8000, pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } },
    { id: 'b/big:free', name: 'Big', context_length: 131000, pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['text'] } },
    { id: 'c/paid', name: 'Paid', context_length: 200000, pricing: { prompt: '0.001', completion: '0.002' } },
    { id: 'd/img:free', name: 'Img', context_length: 4000, pricing: { prompt: '0', completion: '0' }, architecture: { output_modalities: ['image'] } }
  ];
  const g6 = createGas({
    fetch(url, pr) {
      calls.push({ url, pr });
      if (/\/models$/.test(url)) return { code: 200, body: JSON.stringify({ data: FREE }) };
      const b = JSON.parse(pr.payload);
      if (mode2 === 'maxc' && b.max_tokens !== undefined) return { code: 400, body: JSON.stringify({ error: { message: "Unsupported parameter: 'max_tokens' is not supported with this model. Use 'max_completion_tokens' instead." } }) };
      if (mode2 === 'temp' && b.temperature !== undefined) return { code: 400, body: JSON.stringify({ error: { message: 'temperature does not support 0.3 with this model. Only the default (1) value is supported.' } }) };
      if (mode2 === '404') return { code: 404, body: JSON.stringify({ error: { message: 'No endpoints found for x' } }) };
      if (mode2 === '401') return { code: 401, body: JSON.stringify({ error: { message: 'No auth credentials found' } }) };
      if (mode2 === '429') return { code: 429, body: '{}' };
      if (mode2 === '402') return { code: 402, body: '{}' };
      if (mode2 === 'think') return { code: 200, body: JSON.stringify({ model: 'x/y:free', choices: [{ message: { content: '<think>рассуждаю…\nещё</think>\nТушить 40 минут.' } }] }) };
      if (mode2 === 'parts') return { code: 200, body: JSON.stringify({ choices: [{ message: { content: [{ type: 'text', text: 'Часть 1. ' }, { type: 'text', text: 'Часть 2.' }] } }] }) };
      if (mode2 === 'emptyonce') { mode2 = 'ok'; return { code: 200, body: JSON.stringify({ choices: [{ message: { content: '' } }] }) }; }
      if (mode2 === 'empty') return { code: 200, body: JSON.stringify({ choices: [{ message: { content: null, reasoning: 'думаю' } }] }) };
      return { code: 200, body: JSON.stringify({ model: 'meta/llama:free', choices: [{ message: { content: 'Обжарить мясо.' } }], usage: { total_tokens: 77 } }) };
    }
  });
  const ORK = 'sk-or-v1-0123456789abcdef0123456789abcdef';
  const ask6 = (o) => post(g6, Object.assign({ op: 'ai', code: E, system: 'S', user: 'U' }, o));
  let i6 = get(g6, { a: 'aiinfo', code: A }); assert.strictEqual(i6.prov, 'openrouter'); assert.strictEqual(i6.model, 'openrouter/free'); assert.strictEqual(i6.ready, false); assert.strictEqual(i6.keys.openrouter, false);
  assert.strictEqual(ask6({}).err, 'aikey');
  assert.strictEqual(post(g6, { op: 'aikey', code: A, prov: 'nope', key: ORK }).err, 'aikey', 'неизвестный сервис');
  r = post(g6, { op: 'aikey', code: A, key: 'Bearer ' + ORK + ' ' }); assert.strictEqual(r.ok, true); assert.strictEqual(r.ai.ready, true); assert.strictEqual(r.ai.prov, 'openrouter');
  assert.strictEqual(g6.props.aik_openrouter, ORK, 'ключ без «Bearer» и пробелов'); assert.strictEqual(get(g6, { a: 'ping' }).aip, 'openrouter'); assert.strictEqual(get(g6, { a: 'ping' }).ai, 1);
  r = ask6({}); assert.strictEqual(r.ok, true); assert.strictEqual(r.text, 'Обжарить мясо.'); assert.strictEqual(r.tokens, 77); assert.strictEqual(r.prov, 'openrouter');
  assert.strictEqual(calls.length, 1, 'без входа по токену: сразу запрос'); assert.strictEqual(calls[0].url, 'https://openrouter.ai/api/v1/chat/completions'); assert.strictEqual(calls[0].pr.headers.Authorization, 'Bearer ' + ORK);
  assert.strictEqual(JSON.parse(calls[0].pr.payload).model, 'openrouter/free'); assert.ok(!JSON.stringify(r).includes(ORK) && !JSON.stringify(get(g6, { a: 'aiinfo', code: A })).includes(ORK), 'ключ наружу не отдаётся');
  mode2 = 'think'; r = ask6({}); assert.strictEqual(r.text, 'Тушить 40 минут.', 'рассуждения модели убираются');
  mode2 = 'parts'; r = ask6({}); assert.strictEqual(r.text, 'Часть 1. Часть 2.');
  mode2 = 'empty'; calls = []; r = ask6({}); assert.strictEqual(r.err, 'ai'); assert.strictEqual(calls.length, 2, 'пустой ответ: один повтор'); assert.ok(/конкретную модель/.test(r.msg));
  mode2 = 'emptyonce'; calls = []; r = ask6({}); assert.strictEqual(r.ok, true, 'со второй попытки ответ есть'); assert.strictEqual(r.text, 'Обжарить мясо.'); assert.strictEqual(calls.length, 2);
  mode2 = 'maxc'; calls = []; r = ask6({}); assert.strictEqual(r.ok, true); assert.strictEqual(calls.length, 2); { const b = JSON.parse(calls[1].pr.payload); assert.strictEqual(b.max_tokens, undefined); assert.strictEqual(b.max_completion_tokens, 1200); }
  mode2 = 'temp'; calls = []; r = ask6({}); assert.strictEqual(r.ok, true); assert.strictEqual(JSON.parse(calls[1].pr.payload).temperature, undefined, 'модель без temperature: повтор без него');
  mode2 = '404'; r = ask6({}); assert.strictEqual(r.err, 'model'); assert.ok(/openrouter\/free/.test(r.msg));
  mode2 = '401'; r = ask6({}); assert.strictEqual(r.err, 'aikey'); assert.ok(/OpenRouter/.test(r.msg));
  mode2 = '429'; assert.strictEqual(ask6({}).err, 'rate'); mode2 = '402'; assert.strictEqual(ask6({}).err, 'pay'); mode2 = 'ok';
  // выбор модели и список бесплатных
  assert.strictEqual(post(g6, { op: 'aikey', code: A, model: 'bad model!' }).err, 'aikey');
  r = post(g6, { op: 'aikey', code: A, model: 'meta-llama/llama-3.3-70b-instruct:free' }); assert.strictEqual(r.ai.model, 'meta-llama/llama-3.3-70b-instruct:free');
  calls = []; ask6({}); assert.strictEqual(JSON.parse(calls[0].pr.payload).model, 'meta-llama/llama-3.3-70b-instruct:free');
  assert.strictEqual(get(g6, { a: 'aimodels', code: E }).err, 'admin', 'список моделей только технологу');
  calls = []; r = get(g6, { a: 'aimodels', code: A }); assert.strictEqual(r.ok, true); assert.deepStrictEqual(r.models.map(m => m.id), ['b/big:free', 'a/small:free'], 'только бесплатные текстовые, длинный контекст первым');
  get(g6, { a: 'aimodels', code: A }); assert.strictEqual(calls.length, 1, 'список берётся из кэша');
  // переключение сервиса: ключи хранятся по отдельности
  r = post(g6, { op: 'aikey', code: A, prov: 'groq', key: 'gsk_' + 'a'.repeat(40) }); assert.strictEqual(r.ai.prov, 'groq'); assert.strictEqual(r.ai.model, 'llama-3.3-70b-versatile'); assert.strictEqual(r.ai.keys.groq, true); assert.strictEqual(r.ai.keys.openrouter, true);
  calls = []; ask6({}); assert.strictEqual(calls[0].url, 'https://api.groq.com/openai/v1/chat/completions'); assert.strictEqual(calls[0].pr.headers.Authorization, 'Bearer gsk_' + 'a'.repeat(40));
  r = post(g6, { op: 'aikey', code: A, prov: 'openrouter' }); assert.strictEqual(r.ai.prov, 'openrouter'); assert.strictEqual(r.ai.ready, true, 'прежний ключ на месте'); assert.strictEqual(r.ai.model, 'meta-llama/llama-3.3-70b-instruct:free', 'модель у каждого сервиса своя');
  r = post(g6, { op: 'aikey', code: A, prov: 'groq', clear: true }); assert.strictEqual(r.ai.keys.groq, false); assert.strictEqual(r.ai.keys.openrouter, true);
  // свой сервис: только https и не внутренние адреса
  assert.strictEqual(post(g6, { op: 'aikey', code: A, prov: 'custom', url: 'http://api.example.com/v1/chat/completions' }).err, 'aikey');
  assert.strictEqual(post(g6, { op: 'aikey', code: A, prov: 'custom', url: 'https://localhost/v1/chat/completions' }).err, 'aikey');
  assert.strictEqual(post(g6, { op: 'aikey', code: A, prov: 'custom', url: 'https://10.0.0.5/v1' }).err, 'aikey');
  r = post(g6, { op: 'aikey', code: A, prov: 'custom', url: 'https://api.example.com/v1/chat/completions', model: 'my-model' }); assert.strictEqual(r.ai.ready, false, 'без ключа не готов'); assert.strictEqual(r.ai.url, 'https://api.example.com/v1/chat/completions');
  r = post(g6, { op: 'aikey', code: A, prov: 'custom', key: 'k'.repeat(24) }); assert.strictEqual(r.ai.ready, true);
  calls = []; ask6({}); assert.strictEqual(calls[0].url, 'https://api.example.com/v1/chat/completions'); assert.strictEqual(JSON.parse(calls[0].pr.payload).model, 'my-model');
  // ключ GigaChat из версии 17 продолжает работать без выбора сервиса
  const g7 = createGas({ fetch: (u) => /oauth/.test(u) ? { code: 200, body: JSON.stringify({ access_token: 't', expires_at: Date.now() + 1800000 }) } : { code: 200, body: JSON.stringify({ choices: [{ message: { content: 'ok' } }] }) } }); g7.props.gigaAuth = KEY;
  assert.strictEqual(get(g7, { a: 'aiinfo', code: A }).prov, 'giga'); assert.strictEqual(get(g7, { a: 'ping' }).aip, 'giga');
  console.log('PASS ai');
})();
