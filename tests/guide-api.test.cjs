const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function app (fetch) {
  const warnings = [];
  const context = vm.createContext({
    Date, AbortController, setTimeout, clearTimeout, fetch,
    console: { log() {}, warn(...args) { warnings.push(args); } },
    buildJsonProxyUrl: url => url,
    buildMpdProxyUrl: url => 'proxy:' + url
  });
  for (const file of ['config.js', 'guide-api.js', 'guide.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js', file), 'utf8'), context);
  }
  vm.runInContext('globalThis.config = APP_CONFIG', context);
  context.config.guideApiBaseUrl = 'https://guide.example/api';
  context.config.additionalApiPlaylists = [];
  context.config.guideApiSummaryPath = ''; 
  context.warnings = warnings;
  return context;
}

const playlist = [
  '#EXTM3U',
  '#EXTINF:-1 tvg-id="mjh-tvnz-1" tvg-chno="1",TVNZ 1',
  '#KODIPROP:inputstream.adaptive.manifest_type=mpd',
  '#KODIPROP:inputstream.adaptive.license_key=https://example.com/license|header=value',
  '#https://example.com/commented-stream',
  'https://example.com/live.mpd',
  '#EXTINF:-1 tvg-id="mjh-discovery-hgtv" tvg-chno="17",HGTV',
  'https://example.com/hgtv.m3u8',
  '#EXTINF:-1 tvg-id="mjh-bravo-plus1" tvg-chno="9",BravoPlus1',
  'https://example.com/bravo.m3u8'
].join('\r\n');

function xmlTime (ms) {
  return new Date(ms).toISOString().replace(/[-:T]/g, '').slice(0, 14) + ' +0000';
}

function programme (channel) {
  return { channel, title: channel + ' now', start: xmlTime(Date.now() - 600000), stop: xmlTime(Date.now() + 600000) };
}

test('XMLTV offsets preserve the correct instant across midnight', () => {
  const api = app();
  const expected = Date.parse('2026-10-19T22:00:00Z') / 1000;
  assert.equal(api.parseGuideApiTime('20261020110000 +1300'), expected);
  assert.equal(api.parseGuideApiTime('20261019180000 -04:00'), expected);
  assert.ok(Number.isNaN(api.parseGuideApiTime('invalid')));
});

test('playlist directives, channel aliases and HGTV guide mapping survive parsing', () => {
  const api = app();
  const channels = api.parseApiPlaylist(playlist);
  assert.equal(channels.length, 3);
  assert.equal(channels[0].streamUrl, 'https://example.com/live.mpd');
  assert.equal(channels[0].manifest, 'mpd');
  assert.equal(channels[0].license_url, 'https://example.com/license');
  assert.equal(channels[1].guideId, 'mjh-sky-hgtv');
  assert.equal(channels[2].name, 'Bravo PLUS 1');
});

test('all data comes from the API and +1 schedules are not shifted again', async () => {
  const urls = [];
  let active = 0;
  let maximum = 0;
  const api = app(async url => {
    urls.push(url);
    if (url.includes('/playlists/')) return { ok: true, text: async () => playlist };
    active++;
    maximum = Math.max(active, maximum);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    const id = decodeURIComponent(url.split('/').pop());
    return { ok: true, json: async () => [programme(id)] };
  });
  const data = await api.fetchGuideData();
  assert.equal(Object.keys(data).length, 6);
  assert.ok(urls.every(url => url.startsWith(api.config.guideApiBaseUrl + '/')));
  assert.ok(maximum <= 4);
  for (const [name, number] of [['TVNZ 1+1', 11], ['TVNZ 2+1', 12], ['DUKE+1', 15]]) {
    const channel = Object.values(data).find(item => item.name === name);
    assert.equal(channel.chno, number);
    assert.equal(api.getCurrentProgramme(channel.programs).title, channel.guideId + ' now');
    assert.equal(api.buildPlayableChannel(channel).streamUrl, api.config.channelUrlOverrides[name].streamUrl);
  }
  assert.equal(api.getCurrentProgramme([[1, 'Finished programme', 2]]), null);
  assert.equal(api.warnings.length, 0);
});

test('one failed schedule keeps the previous API data without hiding other channels', async () => {
  const old = { guideId: 'mjh-tvnz-1', programs: [[1, 'Cached', 2]] };
  const api = app(async url => {
    if (url.includes('/playlists/')) return { ok: true, text: async () => playlist };
    if (url.endsWith('/mjh-tvnz-1')) return { ok: false, status: 503 };
    const id = decodeURIComponent(url.split('/').pop());
    return { ok: true, json: async () => [programme(id)] };
  });
  const data = await api.fetchApiGuideData({ old });
  assert.equal(data['mjh-tvnz-1'].programs, old.programs);
  assert.equal(Object.keys(data).length, 6);
  assert.equal(api.warnings.length, 1);
});


test('sports uses its own playlist and only includes channels 51 to 54', async () => {
  const sports = Array.from({ length: 5 }, (_, i) =>
    '#EXTINF:-1 tvg-id="' + (51 + i) + '" tvg-chno="' + (51 + i) + '",Sport ' + (i + 1) + '\nhttps://example.com/sport' + (i + 1) + '.m3u8'
  ).join('\n');
  const urls = [];
  const api = app(async url => {
    urls.push(url);
    if (url.includes('/playlists/')) return { ok: true, text: async () => url.endsWith('/skysport') ? sports : playlist };
    const id = decodeURIComponent(url.split('/').pop());
    return { ok: true, json: async () => [programme(id)] };
  });
  api.config.additionalApiPlaylists = ['skysport'];
  for (let i = 1; i <= 4; i++) api.config.channelUrlOverrides['Sky Sport ' + i] = { streamUrl: 'https://streams.example/sport' + i + '.m3u8', manifest: 'hls', required: true };
  const data = await api.fetchApiGuideData();
  assert.equal(Object.keys(data).length, 10);
  for (let i = 1; i <= 4; i++) {
    const channel = data[String(50 + i)];
    assert.equal(channel.name, 'Sky Sport ' + i);
    assert.equal(channel.chno, 50 + i);
    assert.equal(channel.playlistId, 'skysport');
    assert.ok(urls.some(url => url.endsWith('/guide/channel-programmes/skysport/' + (50 + i))));
    assert.equal(api.buildPlayableChannel(channel).streamUrl, 'https://streams.example/sport' + i + '.m3u8');
  }
  assert.equal(data['55'], undefined);
});


test('compact schedules use one request per refresh and cache playlist metadata', async () => {
  const calls = [];
  const now = Math.floor(Date.now() / 1000);
  const api = app(async url => {
    calls.push(url);
    if (url.includes('/playlists/')) return { ok: true, text: async () => playlist };
    assert.ok(url.includes('/guide/summary?channels='));
    const ids = new URL(url).searchParams.get('channels').split(',');
    return { ok: true, json: async () => ({ isStale: false, channels: Object.fromEntries(ids.map(id => [id, [
      { start: now - 60, stop: now + 60, title: id + ' current' },
      { start: now + 60, stop: now + 120, title: 'Next' },
      { start: now + 120, stop: now + 180, title: 'Later' }
    ]])) }) };
  });
  api.config.guideApiSummaryPath = 'guide/summary';
  const first = await api.fetchApiGuideData();
  const second = await api.fetchApiGuideData(first);
  assert.equal(calls.length, 3);
  assert.equal(calls.filter(url => url.includes('/playlists/')).length, 1);
  assert.equal(second['mjh-tvnz-1-plus1'].programs[0][0], now - 60);
  assert.equal(api.getProgrammeInfo(second['mjh-tvnz-1-plus1'].programs).nextTitle, 'Next');
  assert.equal(second.incomplete, false);
});

test('an unpublished summary route falls back to the existing API routes', async () => {
  let legacyCalls = 0;
  const api = app(async url => {
    if (url.includes('/playlists/')) return { ok: true, text: async () => playlist };
    if (url.includes('/guide/summary?')) return { ok: false, status: 404 };
    legacyCalls++;
    return { ok: true, json: async () => [programme(url.split('/').pop())] };
  });
  api.config.guideApiSummaryPath = 'guide/summary';
  const result = await api.fetchApiGuideData();
  assert.equal(legacyCalls, 6);
  assert.equal(result.incomplete, false);
});

test('a summary outage keeps cached listings without per-channel request fanout', async () => {
  let fail = false;
  let legacyCalls = 0;
  const api = app(async url => {
    if (url.includes('/playlists/')) return { ok: true, text: async () => playlist };
    if (!url.includes('/guide/summary?')) legacyCalls++;
    if (fail) return { ok: false, status: 503 };
    const ids = new URL(url).searchParams.get('channels').split(',');
    const now = Math.floor(Date.now() / 1000);
    return { ok: true, json: async () => ({ channels: Object.fromEntries(ids.map(id => [id, [{ start: now - 60, stop: now + 60, title: 'Saved' }]])) }) };
  });
  api.config.guideApiSummaryPath = 'guide/summary';
  const first = await api.fetchApiGuideData();
  fail = true;
  const result = await api.fetchApiGuideData(first);
  assert.equal(result['mjh-tvnz-1'].programs, first['mjh-tvnz-1'].programs);
  assert.equal(result.incomplete, true);
  assert.equal(legacyCalls, 0);
});
