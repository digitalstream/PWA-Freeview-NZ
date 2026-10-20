let mpdPlayer = null

async function playMpdChannel (channel, generation) {
  await loadPlayerScript('https://cdn.dashjs.org/latest/dash.all.min.js', () => Boolean(window.dashjs))
  if (!isCurrentPlayback(generation)) return
  const player = dashjs.MediaPlayer().create()
  mpdPlayer = player
  player.on(dashjs.MediaPlayer.events.ERROR, event => {
    if (event.error?.fatal !== false) playbackFailed(generation)
  })
  player.on(dashjs.MediaPlayer.events.PLAYBACK_PLAYING, () => playbackStarted(generation))
  const video = activeVideoElement
  const readState = () => ({ currentTime: video.currentTime, paused: video.paused, seeking: video.seeking })
  video.addEventListener('timeupdate', () => playbackProgress(generation, video.currentTime))
  player.on(dashjs.MediaPlayer.events.PLAYBACK_WAITING, () => watchPlaybackStall(generation, readState))
  if (channel.licenseUrl) {
    player.setProtectionData({ 'com.widevine.alpha': { serverURL: buildLicenseProxyUrl(channel.licenseUrl), httpRequestHeaders: { 'X-Freeview-Request': '1' } } })
  }
  player.updateSettings({
    streaming: {
      delay: { liveDelay: 20 },
      buffer: { bufferTimeAtTopQuality: 20, bufferToKeep: 30 },
      gaps: { jumpGaps: true, jumpLargeGaps: true },
      text: { defaultEnabled: false }
    }
  })
  player.initialize(activeVideoElement, channel.streamUrl, true)
}

function stopMpdPlayer () {
  const player = mpdPlayer
  mpdPlayer = null
  if (player) player.reset()
}
