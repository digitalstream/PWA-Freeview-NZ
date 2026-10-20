const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function worker (fetch, caches) {
  const handlers = {};
  const context = vm.createContext({ URL, Response, fetch, caches,
    self: { location: { origin: 'https://freeview.bettermediahub.com' }, addEventListener: (name, callback) => { handlers[name] = callback; } }
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../service-worker.js'), 'utf8'), context);
  return request => {
    let promise;
    handlers.fetch({ request, respondWith: value => { promise = value; } });
    return promise;
  };
}

test('static assets revalidate and can fall back to the last good response', async () => {
  let online = true; let cached; let fetchOptions;
  const handle = worker(async (request, options) => {
    fetchOptions = options;
    if (!online) throw Error('offline');
    return new Response('new stylesheet');
  }, { open: async () => ({ put: async (request, response) => { cached = response; }, match: async () => cached?.clone() }) });
  const request = { method: 'GET', url: 'https://freeview.bettermediahub.com/styles.css', mode: 'cors' };
  assert.equal(await (await handle(request)).text(), 'new stylesheet');
  assert.equal(fetchOptions.cache, 'no-cache');
  online = false;
  assert.equal(await (await handle(request)).text(), 'new stylesheet');
});

test('video, API, authentication and POST requests bypass the static cache', () => {
  const handle = worker(() => { throw Error('Must not intercept'); }, {});
  for (const [method, url] of [
    ['GET', 'https://guide.example/api/guide/channels'],
    ['GET', 'https://freeview.bettermediahub.com/auth-status.ashx'],
    ['POST', 'https://freeview.bettermediahub.com/login.ashx'],
    ['GET', 'https://freeview.bettermediahub.com/video/live.m3u8'],
    ['GET', 'https://freeview.bettermediahub.com/App_Data/backup.js']
  ]) assert.equal(handle({ method, url, mode: 'cors' }), undefined);
});

test('cache storage being unavailable does not block online assets', async () => {
  const handle = worker(async () => new Response('online script'), { open: async () => { throw Error('cache disabled'); } });
  const result = await handle({ method: 'GET', url: 'https://freeview.bettermediahub.com/js/app.js', mode: 'cors' });
  assert.equal(await result.text(), 'online script');
});


test('offline plus unavailable cache returns a clear 503 response', async () => {
  const handle = worker(async () => { throw Error('offline'); }, { open: async () => { throw Error('cache disabled'); } });
  const response = await handle({ method: 'GET', url: 'https://freeview.bettermediahub.com/js/app.js', mode: 'cors' });
  assert.equal(response.status, 503);
});
