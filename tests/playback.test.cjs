const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const read = name => fs.readFileSync(path.join(__dirname, '../js', name), 'utf8');

function bootPlayer () {
  let clock = 0; let next = 0; let disposed = 0;
  const timers = new Map(); const messages = []; const handlers = {};
  const state = { currentTime: 10, paused: false, seeking: false };
  const player = {
    on(event, callback) { handlers[event] = callback; },
    currentTime: () => state.currentTime, paused: () => state.paused, seeking: () => state.seeking,
    src() {}, ready(callback) { callback(); }, play: () => Promise.resolve(),
    isDisposed: () => disposed > 0, dispose() { disposed++; }
  };
  const context = vm.createContext({
    console, isPlaying: false, overlayTimeout: null,
    updateChannelAccess() {}, clearGuestPreviewTimer() {},
    APP_CONFIG: { playbackStartTimeoutMs: 20000, playbackStallTimeoutMs: 60000 },
    document: { documentElement: { classList: { toggle() {} } }, body: { classList: { toggle() {} } }, querySelector: () => null, hidden: false, getElementById: () => ({ replaceChildren() {} }) },
    window: { videojs: () => player }, videojs: () => player,
    setTimeout(callback, delay) { timers.set(++next, { callback, at: clock + delay }); return next; },
    clearTimeout(id) { timers.delete(id); },
    showTemporaryMessage: (...args) => messages.push(args),
    showOverlay() {}, resetOverlayTimeout() {}, stopMpdPlayer() {}
  });
  vm.runInContext(read('player.js') + '\n' + read('hls-player.js') + '\nactiveVideoElement = {};', context);
  return {
    context, state, handlers, messages,
    disposed: () => disposed,
    async start() {
      await context.playHlsChannel({ streamUrl: 'https://example.com/live.m3u8', manifest: 'hls' }, 0);
      handlers.playing(); handlers.timeupdate(); messages.length = 0;
    },
    advance(ms) {
      clock += ms;
      for (const [id, timer] of [...timers]) {
        if (timer.at <= clock && timers.delete(id)) timer.callback();
      }
    }
  };
}

test('HLS stalled events never close a stream whose clock keeps advancing without another playing event', async () => {
  const app = bootPlayer(); await app.start();
  for (let second = 0; second < 120; second++) {
    app.handlers.stalled();
    app.state.currentTime++;
    app.handlers.timeupdate();
    app.advance(1000);
  }
  assert.equal(app.disposed(), 0);
  assert.equal(app.context.isPlaying, true);
  assert.equal(app.messages.length, 0);
});

test('throttled timeupdate events do not warn when the clock has advanced', async () => {
  const app = bootPlayer(); await app.start();
  app.handlers.waiting();
  app.state.currentTime += 60;
  app.advance(60000);
  assert.equal(app.messages.length, 0);
  assert.equal(app.disposed(), 0);
});

test('a real stall waits a minute and shows advice while allowing the same stream to recover', async () => {
  const app = bootPlayer(); await app.start();
  app.handlers.waiting();
  app.advance(20000);
  assert.equal(app.messages.length, 0);
  app.advance(40000);
  assert.match(app.messages[0][0], /Still buffering/);
  assert.equal(app.disposed(), 0);
  app.state.currentTime++;
  app.handlers.timeupdate();
  assert.equal(app.context.isPlaying, true);
  assert.equal(app.disposed(), 0);
});

test('background, paused and seeking playback do not trigger buffering notices', async () => {
  for (const mode of ['hidden', 'paused', 'seeking']) {
    const app = bootPlayer(); await app.start();
    app.handlers.waiting();
    if (mode === 'hidden') app.context.document.hidden = true;
    else app.state[mode] = true;
    app.advance(60000);
    assert.equal(app.messages.length, 0, mode);
    assert.equal(app.disposed(), 0, mode);
  }
});

test('stopping a channel cancels its pending buffering notice and ignores late progress', async () => {
  const app = bootPlayer(); await app.start();
  app.handlers.waiting();
  app.context.stopCurrentPlayer();
  app.advance(60000);
  app.state.currentTime++;
  app.handlers.timeupdate();
  assert.equal(app.context.isPlaying, false);
  assert.equal(app.messages.length, 0);
  assert.equal(app.disposed(), 1);
});

test('fatal playback errors still close the stream and explain the failure', async () => {
  const app = bootPlayer(); await app.start();
  app.handlers.error();
  assert.equal(app.context.isPlaying, false);
  assert.equal(app.disposed(), 1);
  assert.match(app.messages[0][0], /Could not play/);
});
