let menuOpen = false
let isPlaying = false
let overlayTimeout = null
let guideRefreshTimer = null
let guideRequest = null
let guideRetryDelay = APP_CONFIG.guideRetryIntervalMs

function showTemporaryMessage (text, duration = 5000, warning = false) {
  const element = document.getElementById('temporaryMessage')
  if (!element) return
  element.textContent = text
  element.className = warning ? 'visible warning' : 'visible'
  clearTimeout(element._timeout)
  if (duration > 0) element._timeout = setTimeout(() => { element.className = '' }, duration)
}

function setGuideStatus (text = '', retry = false) {
  const status = document.getElementById('guideStatus')
  if (!status) return
  status.hidden = !text
  document.getElementById('guideStatusText').textContent = text
  document.getElementById('retryGuideButton').hidden = !retry
}

function updateGuide () {
  if (guideRequest) return guideRequest
  clearTimeout(guideRefreshTimer)
  if (!cachedGuideData) setGuideStatus('Loading channels…')
  guideRequest = (async () => {
    let nextDelay = APP_CONFIG.dataFetchIntervalMs
    try {
      const data = await fetchGuideData()
      renderGuide(data)
      const incomplete = data.incomplete || Object.values(data).some(channel => channel.scheduleError)
      if (incomplete) {
        setGuideStatus('Some listings could not be updated. Retrying shortly.', true)
        nextDelay = guideRetryDelay
        guideRetryDelay = Math.min(guideRetryDelay * 2, APP_CONFIG.guideMaxRetryIntervalMs)
      } else {
        setGuideStatus()
        guideRetryDelay = APP_CONFIG.guideRetryIntervalMs
      }
    } catch (error) {
      console.warn('Guide update failed:', error)
      setGuideStatus(cachedGuideData
        ? 'Showing saved listings. Connection failed; retrying shortly.'
        : 'Could not load channels. Retrying shortly.', true)
      nextDelay = guideRetryDelay
      guideRetryDelay = Math.min(guideRetryDelay * 2, APP_CONFIG.guideMaxRetryIntervalMs)
    } finally {
      guideRequest = null
      guideRefreshTimer = setTimeout(updateGuide, nextDelay)
    }
  })()
  return guideRequest
}

function retryGuide () {
  guideRetryDelay = APP_CONFIG.guideRetryIntervalMs
  return updateGuide()
}

document.addEventListener('DOMContentLoaded', () => {
  checkAuthStatus()
  setupPlaybackActivity()
  setupChannelAccess()
  setupPanels()
  setInterval(checkAuthStatus, 60000)
  setInterval(refreshGuide, APP_CONFIG.uiUpdateIntervalMs)
  updateGuide()
  window.addEventListener('online', retryGuide)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshGuide()
      updateChannelAccess()
      checkAuthStatus()
      if (document.getElementById('guideStatus')?.hidden === false) retryGuide()
    }
  })
})

function hideOverlay () {
  if (!isPlaying || menuOpen) return
  const overlay = document.getElementById('overlay')
  overlay?.classList.add('hidden')
  if (overlay) overlay.inert = true
}

function showOverlay () {
  if (menuOpen) return
  const overlay = document.getElementById('overlay')
  overlay?.classList.remove('hidden')
  if (overlay) overlay.inert = false
  const stopButton = document.getElementById('stopButton')
  if (stopButton) stopButton.style.display = activeVideoElement ? 'block' : 'none'
}

function resetOverlayTimeout (delay = APP_CONFIG.overlayTimeoutMs) {
  clearTimeout(overlayTimeout)
  if (isPlaying && !menuOpen) overlayTimeout = setTimeout(hideOverlay, delay)
}

function handlePlaybackActivity () {
  if (!isPlaying || menuOpen) return
  showOverlay()
  resetOverlayTimeout()
}
