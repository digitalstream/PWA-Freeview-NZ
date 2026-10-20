let isLoggedIn = false
let navView = 'navigate'

async function authRequest (endpoint, options = {}) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)
  try {
    const response = await fetch(endpoint, {
      ...options,
      credentials: 'same-origin',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'X-Freeview-Request': '1', ...options.headers }
    })
    const body = await response.json()
    if (!response.ok) throw new Error(body.error || 'The request could not be completed.')
    return body
  } finally { clearTimeout(timeout) }
}

async function checkAuthStatus () {
  // Discard the old browser flag; the server session is the source of truth.
  try { localStorage.removeItem('isLoggedIn') } catch (error) {}
  try {
    const result = await authRequest(APP_CONFIG.authStatusEndpoint)
    const changed = isLoggedIn !== (result.isLoggedIn === true)
    isLoggedIn = result.isLoggedIn === true
    updateChannelAccess()
    if (changed && cachedGuideData) renderGuide(cachedGuideData)
    if (changed && menuOpen && navView === 'navigate') setupNavPanel()
  } catch (error) {
    // A network failure does not establish that the server session ended.
  }
  return isLoggedIn
}

function setupNavPanel () {
  const title = document.getElementById('navTitle')
  const content = document.getElementById('navContent')
  if (!title || !content) return
  navView = 'navigate'
  title.textContent = 'Menu'
  content.innerHTML = `
    <section class="nav-section">
      <p class="section-label">YOUR ACCOUNT</p>
      <div class="account-card"><span class="account-symbol" aria-hidden="true"><i class="fa fa-user"></i></span><div><h3>${isLoggedIn ? 'Signed in' : 'Watching as a guest'}</h3><p>${isLoggedIn ? 'Enjoy uninterrupted viewing.' : 'Sign in for unrestricted viewing.'}</p></div></div>
      <button type="button" class="nav-button" onclick="${isLoggedIn ? 'handleLogout()' : 'showLoginForm()'}">${isLoggedIn ? 'Sign out' : 'Sign in'}</button>
      ${isLoggedIn ? '' : '<p class="nav-hint">Preview channels share a two-minute guest window.</p>'}
    </section>
    <section class="nav-section nav-links"><button type="button" class="nav-link" onclick="showAbout()"><span>About NZ Freeview</span><span aria-hidden="true">&#8250;</span></button><a class="nav-link" href="https://bettermediahub.com/" target="_blank" rel="noopener"><span>Better Media Hub</span><span aria-hidden="true">&#8599;</span></a></section>
  `
}

function showLoginForm (message = '') {
  const content = document.getElementById('navContent')
  if (!content) return
  navView = 'login'
  document.getElementById('navTitle').textContent = 'Sign in'
  content.innerHTML = `
    <section class="nav-section">
      <p id="loginNotice" class="login-notice" hidden></p>
      <h3>Welcome back</h3><p class="nav-hint">Sign in with your Better Media Hub account. You’ll stay signed in on this device for 30 days, unless you sign out.</p>
      <form id="loginForm">
        <label class="nav-label" for="loginUsername">Username</label>
        <input type="text" id="loginUsername" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" class="nav-input" required />
        <label class="nav-label" for="loginPassword">Password</label>
        <input type="password" id="loginPassword" name="password" autocomplete="current-password" class="nav-input" required />
        <p id="loginError" role="alert"></p>
        <button type="submit" id="signInButton" class="nav-button">Sign in</button>
      </form>
      <button type="button" class="nav-button secondary" id="loginBackButton">Back to menu</button>
    </section>
  `
  const notice = document.getElementById('loginNotice')
  notice.textContent = message
  notice.hidden = !message
  document.getElementById('loginForm').addEventListener('submit', event => { event.preventDefault(); handleLogin() })
  document.getElementById('loginBackButton').addEventListener('click', () => { setupNavPanel(); document.querySelector('#navContent button')?.focus() })
  document.getElementById('loginUsername').focus({ preventScroll: true })
}

async function handleLogin () {
  const username = document.getElementById('loginUsername')?.value.trim()
  const password = document.getElementById('loginPassword')?.value
  const errorElement = document.getElementById('loginError')
  const button = document.getElementById('signInButton')
  if (errorElement) errorElement.textContent = ''
  if (!username || !password) {
    if (errorElement) errorElement.textContent = 'Please enter both username and password.'
    return
  }
  if (button) button.disabled = true
  try {
    const result = await authRequest(APP_CONFIG.loginEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
      body: new URLSearchParams({ username, password }).toString()
    })
    if (!result.isLoggedIn) throw new Error('Login failed.')
    isLoggedIn = true
    updateChannelAccess()
    if (cachedGuideData) renderGuide(cachedGuideData)
    notifyAuthChange()
    setupNavPanel()
    document.querySelector('#navContent button')?.focus()
  } catch (error) {
    if (errorElement?.isConnected) errorElement.textContent = error.name === 'AbortError' ? 'Sign-in timed out. Please try again.' : error.message
  } finally {
    if (button?.isConnected) button.disabled = false
  }
}

async function handleLogout () {
  try {
    await authRequest(APP_CONFIG.logoutEndpoint, { method: 'POST' })
    isLoggedIn = false
    if (activeChannel && isRestrictedChannel(activeChannel)) stopCurrentPlayer()
    updateChannelAccess()
    if (cachedGuideData) renderGuide(cachedGuideData)
    notifyAuthChange()
    toggleMenu(false)
    showTemporaryMessage('Signed out.')
  } catch (error) {
    showTemporaryMessage('Could not confirm sign-out. Please try again.', 6000, true)
  }
}
