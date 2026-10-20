let hlsPlayer = null

async function playHlsChannel (channel, generation) {
  await loadPlayerScript('https://vjs.zencdn.net/8.10.0/video.min.js', () => Boolean(window.videojs))
  if (!isCurrentPlayback(generation)) return
  const player = videojs(activeVideoElement, {
    controls: false,
    autoplay: true,
    preload: 'auto',
    liveui: true,
    fill: true
  })
  hlsPlayer = player
  const readState = () => ({ currentTime: player.currentTime(), paused: player.paused(), seeking: player.seeking() })
  player.on('playing', () => playbackStarted(generation))
  player.on('timeupdate', () => playbackProgress(generation, player.currentTime()))
  player.on('waiting', () => watchPlaybackStall(generation, readState))
  player.on('stalled', () => watchPlaybackStall(generation, readState))
  player.on('error', () => playbackFailed(generation))
  player.src({
    src: channel.streamUrl,
    type: channel.manifest === 'ts' ? 'video/mp2t' : 'application/x-mpegURL'
  })
  player.ready(() => {
    if (!isCurrentPlayback(generation) || player.isDisposed()) return
    const promise = player.play()
    if (promise) promise.catch(() => playbackFailed(generation, 'Playback could not start. Select the channel to try again.'))
  })
}

function stopHlsPlayer () {
  const player = hlsPlayer
  hlsPlayer = null
  if (player && !player.isDisposed()) player.dispose()
}
