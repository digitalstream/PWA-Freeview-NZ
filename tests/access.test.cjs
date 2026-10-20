const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');

function bootAccess (storage = new Map(), initialNow = 1000000) {
  let now = initialNow; let next = 0; let stops = 0;
  const timers = new Map(); const prompts = []; const events = {};
  const context = vm.createContext({
    Date: { now: () => now }, console, isPlaying: false, isLoggedIn: false, activeChannel: null,
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key,value) => storage.set(key,value) },
    document: { getElementById: () => null },
    window: { addEventListener: (name,callback) => { events[name] = callback; } },
    setTimeout(callback,delay) { timers.set(++next,{ callback, at: now + delay }); return next; },
    clearTimeout(id) { timers.delete(id); },
    showTemporaryMessage() {}, toggleMenu() {}, showLoginForm: text => prompts.push(text), checkAuthStatus() {},
    stopCurrentPlayer() { stops++; context.isPlaying = false; context.activeChannel = null; context.clearGuestPreviewTimer(true); }
  });
  vm.runInContext(read('config.js') + '\n' + read('access.js'), context);
  return { context, timers, storage, prompts, events, stops: () => stops,
    play(name) { const channel = {name}; if (!context.canPlayChannel(channel)) return false; context.activeChannel = channel; context.isPlaying = true; context.updateChannelAccess(); return true; },
    advance(ms) { now += ms; for (const [id,timer] of [...timers]) if (timer.at <= now && timers.delete(id)) timer.callback(); }
  };
}

test('guests see ordinary and TVNZ channels while sports are hidden and cannot play', () => {
  const app = bootAccess();
  assert.equal(app.context.isChannelVisible({name:'TVNZ 1'}),true);
  assert.equal(app.context.isChannelVisible({name:'Three'}),true);
  for (let sport = 1; sport <= 4; sport++) {
    assert.equal(app.context.isChannelVisible({name:'Sky Sport ' + sport}),false);
    assert.equal(app.play('Sky Sport ' + sport),false);
  }
  assert.equal(app.timers.size,0);
  assert.equal(app.storage.size,0);
});

test('ordinary channels never consume a guest preview', () => {
  const app = bootAccess(); app.play('Three'); app.advance(3600000);
  assert.equal(app.stops(),0);
  assert.equal(app.storage.size,0);
});

test('TVNZ preview ends after two minutes and blocks every TVNZ variant for thirty minutes', () => {
  const app = bootAccess(); app.play('TVNZ 1');
  app.advance(119999); assert.equal(app.stops(),0);
  app.advance(1); assert.equal(app.stops(),1); assert.match(app.prompts.at(-1),/preview has ended/);
  for (const name of ['TVNZ 1','TVNZ 2','DUKE','TVNZ 1+1','TVNZ 2+1','DUKE+1']) assert.equal(app.play(name),false,name);
  assert.equal(app.play('Three'),true);
  app.advance(30 * 60000 - 1); assert.equal(app.play('TVNZ 2'),false);
  app.advance(1); assert.equal(app.play('TVNZ 2'),true);
});

test('switching channels and refreshing preserve the remaining preview time', () => {
  const app = bootAccess(); app.play('TVNZ 1'); app.advance(60000);
  app.context.clearGuestPreviewTimer(true); app.play('DUKE+1');
  const refreshed = bootAccess(app.storage,1060000);
  refreshed.play('TVNZ 2');
  refreshed.advance(59999); assert.equal(refreshed.stops(),0);
  refreshed.advance(1); assert.equal(refreshed.stops(),1);
  assert.equal(refreshed.play('DUKE'),false);
  const blockedRefresh = bootAccess(app.storage,1120000);
  assert.equal(blockedRefresh.play('TVNZ 1+1'),false);
});

test('signing in cancels the preview stop, reveals sports and preserves the guest cooldown', () => {
  const app = bootAccess(); app.play('TVNZ 1'); app.advance(60000);
  app.context.isLoggedIn = true; app.context.updateChannelAccess();
  app.advance(60000); assert.equal(app.stops(),0);
  assert.equal(app.context.isChannelVisible({name:'Sky Sport 1'}),true);
  assert.equal(app.play('Sky Sport 1'),true);
  app.advance(60000); assert.equal(app.stops(),0);
  app.context.isLoggedIn = false; app.context.updateChannelAccess();
  assert.equal(app.stops(),1); assert.equal(app.play('TVNZ 1'),false);
});

test('a delayed background timer still ends an expired preview after the cooldown has elapsed', () => {
  const app = bootAccess(); app.play('TVNZ 1');
  app.advance(40 * 60000);
  assert.equal(app.stops(),1);
});

test('storage being unavailable does not break the preview timer', () => {
  const app = bootAccess();
  app.context.localStorage.getItem = () => { throw Error('unavailable'); };
  app.context.localStorage.setItem = () => { throw Error('unavailable'); };
  app.play('TVNZ 1'); app.advance(120000);
  assert.equal(app.stops(),1);
  assert.equal(app.play('TVNZ 2'),false);
});
