let guestPreviewTimer = null
let memoryPreview = null
let activeGuestPreview = null

function isRestrictedChannel (channel) {
  return APP_CONFIG.restrictedChannels.includes(channel?.name)
}

function isChannelVisible (channel) {
  return isLoggedIn || !APP_CONFIG.loginOnlyChannels.includes(channel?.name)
}

function readGuestPreview () {
  let value = memoryPreview
  try { value = JSON.parse(localStorage.getItem(APP_CONFIG.guestPreviewStorageKey)) } catch (error) {}
  if (!value || !Number.isFinite(value.endsAt) || !Number.isFinite(value.availableAt) || value.availableAt <= Date.now()) return null
  return value
}

function saveGuestPreview (value) {
  memoryPreview = value
  try { localStorage.setItem(APP_CONFIG.guestPreviewStorageKey, JSON.stringify(value)) } catch (error) {}
}

function clearGuestPreviewTimer (reset = false) {
  if (reset) activeGuestPreview = null
  clearTimeout(guestPreviewTimer)
  guestPreviewTimer = null
}

function showChannelLogin (message) {
  showTemporaryMessage('', 1)
  document.getElementById('aboutDialog')?.close()
  toggleMenu(true)
  showLoginForm(message)
}

function canPlayChannel (channel) {
  if (!isRestrictedChannel(channel) || isLoggedIn) return true
  if (!isChannelVisible(channel)) { showChannelLogin('Sign in to watch Sky Sport.'); return false }
  const preview = readGuestPreview()
  if (!preview || preview.endsAt > Date.now()) return true
  const minutes = Math.ceil((preview.availableAt - Date.now()) / 60000)
  showChannelLogin('Your preview has ended. Sign in to keep watching, or try another preview in ' + minutes + ' minutes.')
  return false
}

function updateChannelAccess () {
  clearGuestPreviewTimer()
  if (isLoggedIn) activeGuestPreview = null
  if (!activeChannel || !isPlaying || !isRestrictedChannel(activeChannel) || isLoggedIn) return
  if (!isChannelVisible(activeChannel)) {
    stopCurrentPlayer()
    showChannelLogin('Your session has ended. Sign in to keep watching Sky Sport.')
    return
  }
  let preview = activeGuestPreview || readGuestPreview()
  if (!preview) {
    const endsAt = Date.now() + APP_CONFIG.guestPreviewDurationMs
    preview = { endsAt, availableAt: endsAt + APP_CONFIG.guestPreviewCooldownMs }
    saveGuestPreview(preview)
    showTemporaryMessage('Two-minute preview. Sign in for uninterrupted viewing.', 5000)
  }
  activeGuestPreview = preview
  const remaining = preview.endsAt - Date.now()
  if (remaining <= 0) {
    stopCurrentPlayer()
    showChannelLogin('Your two-minute preview has ended. Sign in to keep watching. Guest previews return after 30 minutes.')
    return
  }
  guestPreviewTimer = setTimeout(updateChannelAccess, remaining)
}

function setupChannelAccess () {
  window.addEventListener('storage', event => {
    if (event.key === APP_CONFIG.guestPreviewStorageKey) updateChannelAccess()
    if (event.key === APP_CONFIG.authChangeStorageKey) checkAuthStatus()
  })
}

function notifyAuthChange () {
  try { localStorage.setItem(APP_CONFIG.authChangeStorageKey, String(Date.now())) } catch (error) {}
}
