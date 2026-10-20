let activeVideoElement = null
let activeChannel = null
let playbackGeneration = 0
let playbackStartTimer = null
let playbackStallTimer = null
let lastPlaybackTime = null
const playerScripts = new Map()

function loadPlayerScript (url, available) {
  if (available()) return Promise.resolve()
  if (playerScripts.has(url)) return playerScripts.get(url)
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = url
    script.onload = () => available() ? resolve() : reject(new Error('Player library unavailable'))
    script.onerror = () => reject(new Error('Player library could not load'))
    document.head.appendChild(script)
  }).catch(error => { playerScripts.delete(url); throw error })
  playerScripts.set(url, promise)
  return promise
}

function isCurrentPlayback (generation) {
  return generation === playbackGeneration && activeVideoElement !== null
}

function setupPlaybackActivity () {
  const host = document.getElementById('playerHost')
  if (!host) return
  for (const event of ['mousemove', 'click', 'wheel', 'touchstart', 'touchend']) {
    host.addEventListener(event, handlePlaybackActivity, { passive: true })
  }
}

function setPlaybackAppearance (active) {
  document.documentElement.classList.toggle('playback-active', active)
  document.body.classList.toggle('playback-active', active)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', active ? '#000000' : '#EE1F27')
}

function playbackStarted (generation) {
  if (!isCurrentPlayback(generation)) return
  clearTimeout(playbackStartTimer)
  clearTimeout(playbackStallTimer)
  playbackStartTimer = null
  playbackStallTimer = null
  const wasPlaying = isPlaying
  isPlaying = true
  if (!wasPlaying) {
    showTemporaryMessage('', 1)
    showOverlay()
    resetOverlayTimeout(1000)
    updateChannelAccess()
  }
}

function playbackProgress (generation, currentTime) {
  if (!isCurrentPlayback(generation) || !Number.isFinite(currentTime)) return
  const progressed = lastPlaybackTime !== null && currentTime !== lastPlaybackTime
  lastPlaybackTime = currentTime
  if (progressed) playbackStarted(generation)
}

function watchPlaybackStall (generation, readState) {
  if (!isCurrentPlayback(generation) || !isPlaying || playbackStallTimer) return
  const initialTime = readState().currentTime
  playbackStallTimer = setTimeout(() => {
    playbackStallTimer = null
    if (!isCurrentPlayback(generation) || document.hidden) return
    const state = readState()
    if (state.paused || state.seeking || state.currentTime !== initialTime) return
    // Buffering events are advisory: let the player recover without closing the stream.
    showTemporaryMessage('Still buffering. You can reselect the channel if it does not recover.', 7000, true)
  }, APP_CONFIG.playbackStallTimeoutMs)
}

function playbackFailed (generation, message = 'Could not play this channel. Please try again.') {
  if (!isCurrentPlayback(generation)) return
  stopCurrentPlayer()
  showTemporaryMessage(message, 7000, true)
}

async function playChannel (channel) {
  if (!canPlayChannel(channel)) return
  stopCurrentPlayer()
  const host = document.getElementById('playerHost')
  if (!host) return
  if (!channel.streamUrl || !['hls', 'mpd', 'ts'].includes(channel.manifest)) {
    showTemporaryMessage('This stream format is not supported.', 5000, true)
    return
  }
  const generation = playbackGeneration
  const video = document.createElement('video')
  video.id = channel.manifest === 'mpd' ? 'dashVideo' : 'videoScreen'
  video.preload = 'auto'
  video.playsInline = true
  video.autoplay = true
  if (channel.manifest !== 'mpd') video.className = 'video-js vjs-default-skin'
  host.appendChild(video)
  activeVideoElement = video
  activeChannel = channel
  setPlaybackAppearance(true)
  showOverlay()
  showTemporaryMessage('Loading ' + channel.name + '…', 0)
  playbackStartTimer = setTimeout(() => playbackFailed(generation, 'This channel took too long to start. Please try again.'), APP_CONFIG.playbackStartTimeoutMs)
  try {
    if (channel.manifest === 'mpd') await playMpdChannel(channel, generation)
    else await playHlsChannel(channel, generation)
  } catch (error) {
    console.warn('Playback failed for ' + channel.name + ':', error)
    playbackFailed(generation)
  }
}

function stopCurrentPlayer () {
  clearGuestPreviewTimer(true)
  playbackGeneration++
  clearTimeout(playbackStartTimer)
  clearTimeout(playbackStallTimer)
  clearTimeout(overlayTimeout)
  playbackStartTimer = null
  playbackStallTimer = null
  isPlaying = false
  lastPlaybackTime = null
  stopHlsPlayer()
  stopMpdPlayer()
  const host = document.getElementById('playerHost')
  if (host) host.replaceChildren()
  activeVideoElement = null
  activeChannel = null
  setPlaybackAppearance(false)
  showOverlay()
}

function stopPlaying () {
  stopCurrentPlayer()
  showTemporaryMessage('', 1)
}
