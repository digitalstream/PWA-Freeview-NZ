const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');

function bootApp (fetchGuideData) {
  const timers = new Map(); let next = 0; const statuses = [];
  const context = vm.createContext({
    console: { warn() {} }, cachedGuideData: null,
    APP_CONFIG: { guideRetryIntervalMs: 5, guideMaxRetryIntervalMs: 60, dataFetchIntervalMs: 400, uiUpdateIntervalMs: 60 },
    fetchGuideData, renderGuide() {},
    setTimeout(callback, delay) { timers.set(++next, { callback, delay }); return next; },
    clearTimeout(id) { timers.delete(id); },
    document: { addEventListener() {} }
  });
  vm.runInContext(read('app.js'), context);
  context.setGuideStatus = (...args) => statuses.push(args);
  return { context, timers, statuses };
}

test('initial failure schedules retries and a later success returns to normal refresh', async () => {
  let calls = 0;
  const { context, timers, statuses } = bootApp(async () => { if (++calls === 1) throw Error('offline'); return {}; });
  await context.updateGuide();
  assert.equal([...timers.values()][0].delay, 5);
  assert.ok(statuses.some(([text]) => text.includes('Could not load')));
  await [...timers.values()][0].callback();
  assert.equal(calls, 2);
  assert.equal([...timers.values()][0].delay, 400);
});

test('overlapping retries share one request and incomplete data retries early', async () => {
  let resolve;
  const { context, timers } = bootApp(() => new Promise(done => { resolve = done; }));
  const first = context.updateGuide();
  assert.equal(context.updateGuide(), first);
  resolve({ a: { scheduleError: true } });
  await first;
  assert.equal([...timers.values()][0].delay, 5);
});

test('schedule gaps still show upcoming titles and countdowns', () => {
  const context = vm.createContext({ Date, Map });
  vm.runInContext(read('guide.js'), context);
  const now = Math.floor(Date.now() / 1000);
  const info = context.getProgrammeInfo([[now + 300, 'Next programme', now + 900], [now + 900, 'Later programme', now + 1800]]);
  assert.equal(info.currentTitle, 'No programme currently scheduled');
  assert.equal(info.nextTitle, 'Next programme');
  assert.equal(info.laterTitle, 'Later programme');
  assert.equal(info.timeRemaining, 'In 5 mins');
});

test('login sends credentials only in the POST body and preserves password whitespace', async () => {
  let request;
  const elements = {
    loginUsername: { value: ' person ' }, loginPassword: { value: ' pass word ' },
    loginError: { textContent: '', isConnected: true }, signInButton: { isConnected: true }
  };
  const context = vm.createContext({
    AbortController, URLSearchParams, setTimeout, clearTimeout,
    cachedGuideData: null, updateChannelAccess() {}, notifyAuthChange() {},
    APP_CONFIG: { loginEndpoint: 'login.ashx' },
    document: { getElementById: id => elements[id], querySelector: () => null },
    fetch: async (url, options) => { request = { url, options }; return { ok: true, json: async () => ({ isLoggedIn: true }) }; }
  });
  vm.runInContext(read('auth.js'), context);
  context.setupNavPanel = () => {};
  await context.handleLogin();
  assert.equal(vm.runInContext('isLoggedIn', context), true);
  assert.equal(elements.loginError.textContent, '');
  assert.equal(request.url, 'login.ashx');
  assert.equal(request.options.method, 'POST');
  assert.equal(new URLSearchParams(request.options.body).get('password'), ' pass word ');
  assert.equal(request.options.headers['X-Freeview-Request'], '1');
});

test('failed logout does not falsely mark an authenticated session signed out', async () => {
  const messages = [];
  const context = vm.createContext({
    AbortController, setTimeout, clearTimeout,
    APP_CONFIG: { logoutEndpoint: 'logout.ashx' },
    showTemporaryMessage: text => messages.push(text),
    fetch: async () => { throw Error('offline'); }
  });
  vm.runInContext(read('auth.js') + '\nisLoggedIn = true;', context);
  await context.handleLogout();
  assert.equal(vm.runInContext('isLoggedIn', context), true);
  assert.ok(messages[0].includes('Could not confirm'));
});


test('session expiry applies access rules and refreshes channel visibility', async () => {
  let accessChecks = 0; let renders = 0;
  const context = vm.createContext({
    AbortController, setTimeout, clearTimeout, cachedGuideData: {}, menuOpen: false,
    APP_CONFIG: { authStatusEndpoint: 'auth-status.ashx' },
    updateChannelAccess() { accessChecks++; }, renderGuide() { renders++; },
    fetch: async () => ({ ok: true, json: async () => ({ isLoggedIn: false }) })
  });
  vm.runInContext(read('auth.js') + '\nisLoggedIn = true;', context);
  await context.checkAuthStatus();
  assert.equal(vm.runInContext('isLoggedIn',context),false);
  assert.equal(accessChecks,1); assert.equal(renders,1);
});

test('a temporary session-status outage does not sign out a viewer or stop playback', async () => {
  let accessChecks = 0;
  const context = vm.createContext({
    AbortController, setTimeout, clearTimeout,
    APP_CONFIG: { authStatusEndpoint: 'auth-status.ashx' },
    updateChannelAccess() { accessChecks++; },
    fetch: async () => { throw Error('offline'); }
  });
  vm.runInContext(read('auth.js') + '\nisLoggedIn = true;',context);
  assert.equal(await context.checkAuthStatus(),true);
  assert.equal(accessChecks,0);
});

test('successful logout stops a restricted stream and removes sports immediately', async () => {
  let stopped = 0; let rendered = 0;
  const context = vm.createContext({
    AbortController, setTimeout, clearTimeout, cachedGuideData: {}, activeChannel: {name:'Sky Sport 1'},
    APP_CONFIG: { logoutEndpoint: 'logout.ashx' },
    fetch: async () => ({ ok: true, json: async () => ({ isLoggedIn: false }) }),
    isRestrictedChannel: () => true, stopCurrentPlayer() { stopped++; },
    updateChannelAccess() {}, renderGuide() { rendered++; }, notifyAuthChange() {}, toggleMenu() {}, showTemporaryMessage() {}
  });
  vm.runInContext(read('auth.js') + '\nisLoggedIn = true;',context);
  await context.handleLogout();
  assert.equal(vm.runInContext('isLoggedIn',context),false);
  assert.equal(stopped,1); assert.equal(rendered,1);
});
