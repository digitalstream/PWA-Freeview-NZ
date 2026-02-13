// app.js - FINAL, STRICTLY CLEANED VERSION

// --- Constants ---
// Check if we are running on localhost
const isLocalhost = window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost';

const EPG_URL_ORIGINAL = 'https://i.mjh.nz/nz/tv.json'
const EPG_URL = 'json-proxy.ashx?url=' + encodeURIComponent(EPG_URL_ORIGINAL)
const current_EPG_URL = isLocalhost ? EPG_URL_ORIGINAL : EPG_URL
const LOGIN_ENDPOINT = 'login.ashx'
const UI_UPDATE_INTERVAL = 60 * 1000 // 60 seconds in milliseconds
const DATA_FETCH_INTERVAL = 4 * 60 * 60 * 1000 // 4 hours in milliseconds
const OVERLAY_TIMEOUT_DURATION = 5000 // 5 seconds in milliseconds
const MAX_MOBILE_BITRATE = 1500000
const MAX_DESKTOP_BITRATE = 3500000
const FROZEN_STREAM_TIMEOUT = 20000 // 20 seconds in milliseconds


// --- Global Variables ---
let cachedData = null
let player = null
let isPlaying = false
let overlayTimeout
let overlayOpen = true
let menuOpen = false
let streamHealthCheckInterval
var videoElement = document.getElementById('videoScreen')

// *** NEW ***: Authentication State
let isLoggedIn = false
const AUTH_STORAGE_KEY = 'isLoggedIn'

// List of channels to display
const freeviewChannels = [
  'TVNZ 1',
  'TVNZ 2',
  'Three',
  'ThreePlus1',
  'HGTV',
  'eden',
  'eden+1',
  'Bravo',
  'Bravo PLUS 1',
  'Sky Open',
  'Sky Open+1',
  'RUSH',
  'DUKE',
  'MovieSphere',
  'Warner Bros TV Motorheads',
  'Warner Bros TV True Crime',
  'Warner Bros TV House Hunters',
  'Warner Bros TV Paranormal',
  'Redbull TV',
  'ThreeNow Sport 1',
  'ThreeNow Sport 2',
  'Trackside 1',
  'Trackside 2',
  'Trackside Premier',
  'CH200',
  'Parliament TV',
  'Channel News Asia (CNA)',
  'Al Jazeera',
  'CNN Headlines',
  'JuiceX',
  'JuiceTV',
  'BBC News',
  'The Box',
  'Melo',
  'The Groats',
  'Big Rig',
  'Te Reo',
  'Whakaata Māori'
]

// *** NEW ***: Define channels requiring the recursive proxy (Sky Open only)
const PROXY_REQUIRED_CHANNELS = [
  
]

// --- Screen/Device Detection ---
var isSmallScreen = window.innerWidth < 768
var isTouchDevice = navigator.maxTouchPoints > 0 || 'ontouchstart' in window
var isAndroid =
  isTouchDevice && /android/i.test(navigator.userAgent.toLowerCase())

// --- FUNCTION DEFINITIONS (Start) ---

// *** NEW/MODIFIED ***: Navigation Panel Setup (Dynamically renders content)
function setupNavPanel (view = 'navigate') {
  const navContent = document.getElementById('navContent')
  if (!navContent) return

  document.getElementById('navTitle').textContent =
    view === 'navigate' ? 'Navigate' : 'About'

  let content = ''

  if (view === 'about') {
    content = `
        <h2>📺 NZ FREEVIEW LIVE TV </h2><h3>A Robust Cross-Platform Application</h3>
        <p>This project is a high-performance <strong>Progressive Web App (PWA)</strong> built to deliver a reliable, native-like live television experience across all devices. It showcases full-stack proficiency, focusing on front-end user experience, resilient video delivery, and back-end data automation.</p>
        <h3>1. The User Experience & Front End Mastery</h3>
        <p><em>(Built with <strong>HTML5</strong>, <strong>CSS3</strong>, and <strong>Vanilla JavaScript</strong>)</em></p>
        <ul>
            <li><strong>Intelligent Streaming (ABR):</strong> Utilizes the industry-standard <strong>Video.js</strong> player for <strong>HTTP Live Streaming (HLS)</strong>. Critical <strong>Adaptive Bitrate (ABR) Control</strong> automatically optimizes quality based on device: high-quality for Desktops, and capped-quality for Mobile to conserve data and prevent rebuffering.</li>
            <li><strong>Persistent & Predictable UX:</strong> Employs browser <strong><code>localStorage</code></strong> to recall the user's last volume and mute state between sessions, ensuring a consistent and personalized experience.</li>
            <li><strong>Dynamic Program Guide (EPG):</strong> The app asynchronously fetches and caches external <strong>JSON data</strong> to build the entire Electronic Program Guide (EPG) on the fly. An internal timer handles frequent (60-second) UI updates, ensuring program titles are always current.</li>
            <li><strong>Cross-Platform Compatibility:</strong> Specific JavaScript logic ensures optimal behavior across environments, tailoring controls for touch-screen devices and utilizing native HLS decoding where available.</li>
        </ul>
        <h3>2. Core Architecture & Reliability (The PWA Advantage)</h3>
        <ul>
            <li><strong>Native-Like Performance (PWA):</strong> Uses a dedicated <strong>Service Worker</strong> (<code>service-worker.js</code>) to cache all static assets. This PWA architecture enables <strong>instant loading</strong> from the cache and provides an <strong>installable</strong>, native-like experience.</li>
            <li><strong>Robust Stream Health Monitoring:</strong> An internal JavaScript interval actively monitors playback. If the stream stalls or freezes (i.e., no progress is made within a set timeout), the system automatically detects the failure, stops playback, and alerts the user, preventing a frustrating silent freeze.</li>
        </ul>
        <h3>3. Back-End & Data Automation (The Engine)</h3>
        <ul>
            <li><strong>Secure Hosting Environment:</strong> Application hosted on a professionally configured <strong>IIS 10 Server</strong>, providing a secure, scalable foundation with SSL/HTTPS setup.</li>
            <li><strong>User Authentication:</strong> Application uses .ashx endpoints for user authentication, ensuring secure access to proxied streams and data. </li>
            <li><strong>Recursive Proxies:</strong> Application uses powerful recursive .ashx proxies for 'difficult' channels. Only available to logged in users.</li>
            <li><strong>Data Pipeline & Parsing:</strong> Extensive competence in <strong>XML and JSON file parsing and creation</strong> is used to normalize, transform, and prepare raw data feeds into the structured EPG format required for front-end consumption.</li>
            <li><strong>PowerShell Automation:</strong> Critical back-end tasks are managed by <strong>PowerShell automation scripts</strong> for scheduled operations, including: fetching external data, parsing the raw XML/JSON, and maintaining server health to ensure continuous, accurate service.</li>
        </ul>
        <hr>
        <p>This detailed overview serves as a comprehensive technical and architectural summary for portfolio review.</p>
         <button onclick="toggleMenu(true)" class="btn btn-primary btn-lg" style="width: 50%; margin-top: 15px; margin-left: 25%;">CLOSE</button>
    `
  } else {
    // NAVIGATE view (Login/Logout + About button)
    const loginButtonText = isLoggedIn ? 'Logout' : 'Login'
    const logoutAction = isLoggedIn ? 'handleLogout()' : 'openLogin()'

    content = `
        <h3 style="max-width: 500px; width: 100%; height: 50px; margin: auto; display: block;>User Status: ${
          isLoggedIn ? 'Authenticated' : 'Guest'
        }</h3>
        <ps tyle="max-width: 500px; width: 100%; height: 50px; margin: auto; display: block;>Select an action below:</p>
        
        <!-- Login/Logout Button -->
        <button onclick="${logoutAction}" 
             style="max-width: 500px; width: 100%; height: 50px; margin: auto; display: block; background-color: ${
               isLoggedIn ? '#EE1F27' : '#3498db'
             }; color: white; border: none; border-radius: 5px; cursor: pointer;">
            ${loginButtonText}
        </button>

        <!-- Login Form (Only visible if NOT logged in) -->
        ${
          !isLoggedIn
            ? `
            <div id="loginFormSection" style="max-width: 500px;border: 1px solid #333; padding: 15px; border-radius: 5px;   margin: auto;">
                <h4>Quick Login</h4>
                <div class="form-group">
                    <input type="text" id="loginUsername" class="form-control form-control-sm" placeholder="Username" value="" style="padding: 20px;">
                </div>
                <div class="form-group" style="margin-bottom: 5px;">
                    <input type="password" id="loginPassword" class="form-control form-control-sm" placeholder="Password" value="" style="padding: 20px;">
                </div>
                <button onclick="handleLogin()" class="btn btn-primary" style="width: 100%; margin-top: 10px;padding: 10px">Sign In</button>
                <button onclick="continueAsGuest()" class="btn btn-secondary" style="width: 100%; margin-top: 15px;padding:10px;">Continue as Guest</button>

                
            </div>
        `
            : ''
        }

        <!-- About Button (Only visible when in Navigate view) -->
        <button onclick="setupNavPanel('about')" 
            class="btn btn-primary"
    style="max-width: 500px; width: 100%; border: 1px solid #333; padding: 10px; border-radius: 5px; margin:0 auto; display: block;">
            About this App
        </button>
        
        <hr style="border-color: #333;">
        <p style="font-size: 0.8em; text-align: center; color: #999;">PWA Powered by BetterMediaHub</p>
    `
  }

  navContent.innerHTML = content
}

// *** NEW ***: Authentication Functions
function checkAuthStatus () {
  const storedStatus = localStorage.getItem(AUTH_STORAGE_KEY)
  isLoggedIn = storedStatus === 'true'
  console.log(`Initial Auth Status: Logged In = ${isLoggedIn}`)
  setupNavPanel()
}

function openLogin () {
  if (menuOpen) {
    setupNavPanel('navigate')
  } else {
    toggleMenu(true)
  }
}

function handleLogin () {
  const username = document.getElementById('loginUsername').value.trim()
  const password = document.getElementById('loginPassword').value.trim()

  if (!username || !password) {
    showTemporaryMessage('Please enter both username and password.', 3000, true)
    return
  }

  fetch(
    `${LOGIN_ENDPOINT}?username=${encodeURIComponent(
      username
    )}&password=${encodeURIComponent(password)}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'text/plain' }
    }
  )
    .then(response => {
      if (response.ok) {
        isLoggedIn = true
        localStorage.setItem(AUTH_STORAGE_KEY, 'true')
        showTemporaryMessage('Login successful! Proxy channels unlocked.', 4000)

        toggleMenu(false)
        fetchAndUpdateCache()
      } else if (response.status === 401) {
        showTemporaryMessage('Login failed: Invalid credentials.', 4000, true)
      } else {
        showTemporaryMessage(
          `Server Error ${response.status}: Could not connect to login service.`,
          5000,
          true
        )
      }
    })
    .catch(error => {
      console.error('Network error during login:', error)
      showTemporaryMessage(
        'Network error communicating with login server.',
        5000,
        true
      )
    })
}

function continueAsGuest () {
  isLoggedIn = false
  localStorage.setItem(AUTH_STORAGE_KEY, 'false')
  showTemporaryMessage(
    'Continuing as Guest. Access to premium streams is restricted.',
    4000
  )

  toggleMenu(false)
  buildPage(cachedData)
}

function handleLogout () {
  fetch('logout.ashx', { method: 'POST' }).catch(() =>
    console.log("Couldn't hit logout.ashx, proceeding with client-side logout.")
  )

  isLoggedIn = false
  localStorage.setItem(AUTH_STORAGE_KEY, 'false')
  showTemporaryMessage(
    'You have been logged out. Returning to Guest mode.',
    3000
  )

  toggleMenu(false)
  fetchAndUpdateCache()
  buildPage(cachedData)
}

// *** MODIFIED ***: Menu/Panel Toggling
function toggleMenu (forceState) {
  const navElement = document.getElementById('navPanel')
  const overlayElement = document.getElementById('overlay')

  if (!navElement || !overlayElement) return

  const shouldBeOpen = typeof forceState === 'boolean' ? forceState : !menuOpen

  if (shouldBeOpen) {
    navElement.style.display = 'block'
    menuOpen = true
    overlayElement.classList.add('hidden')
    overlayOpen = false
    setupNavPanel('navigate') // Open to the default navigate view
  } else {
    navElement.style.display = 'none'
    menuOpen = false
    if (isPlaying) {
      showOverlay()
      resetOverlayTimeout()
    } else {
      showOverlay()
    }
  }
}

function showTemporaryMessage (message, duration, isWarning = false) {
  const messageEl = document.getElementById('temporaryMessage')
  if (!messageEl) return

  messageEl.textContent = message
  messageEl.className = isWarning ? 'visible warning' : 'visible'

  clearTimeout(messageEl._timeout)
  messageEl._timeout = setTimeout(() => {
    messageEl.className = ''
    messageEl.textContent = ''
  }, duration)
}

// --- EPG UI Update Function ---
function updateDisplayFromCache () {
  console.log('Updating display from cached guide info...')
  if (cachedData) {
    buildPage(cachedData)
  } else {
    console.warn('Cannot update display, cached data not available yet.')
  }
}

// --- EPG Data Fetching and Caching ---
function fetchAndUpdateCache () {
  const cacheBuster = `?t=${Date.now()}`
  console.log(`Fetching and caching guide data from: ${current_EPG_URL}${cacheBuster}`)

  fetch(current_EPG_URL + cacheBuster, { cache: 'no-store' })
    .then(response => {
      if (!response.ok)
        throw new Error(`HTTP error fetching EPG! status: ${response.status}`)
      return response.json()
    })
    .then(data => {
      console.log('Guide data cache updated successfully.')
      cachedData = data
      buildPage(cachedData)
    })
    .catch(error => {
      console.error('Error fetching/caching guide data:', error)
    })
}

// *** HELPER FUNCTIONS ***
function updateIsSmallScreen () {
  isSmallScreen = window.innerWidth < 768
}

function resetOverlayTimeout () {
  if (!isPlaying) return
  clearTimeout(overlayTimeout)
  overlayTimeout = setTimeout(() => {
    if (isPlaying && overlayOpen) {
      hideOverlay()
    }
  }, OVERLAY_TIMEOUT_DURATION)
}

function showOverlay () {
  var overlayElement = document.getElementById('overlay')
  if (!overlayElement) return

  overlayElement.classList.remove('hidden')

  console.log('Overlay shown')
  overlayOpen = true

  if (isPlaying) {
    document.getElementById('stopButton').style.display = 'block'
  }

  var closeButtons = document.querySelectorAll('.closeButton')
  closeButtons.forEach(
    button =>
      (button.style.display = isAndroid && isSmallScreen ? 'block' : 'none')
  )
}

function hideOverlay () {
  var overlayElement = document.getElementById('overlay')
  if (!overlayElement) return

  if (menuOpen) return true

  if (!overlayOpen) return

  overlayElement.classList.add('hidden')

  console.log('Overlay hidden')
  overlayOpen = false
  clearTimeout(overlayTimeout)

  document.getElementById('stopButton').style.display = 'none'
}

// --- BUILD PAGE FUNCTION (FIXED CLICK HANDLER) ---
function buildPage (data) {
  if (typeof data !== 'object' || data === null) {
    console.warn(
      'BuildPage called with invalid or null data. Cannot build guide.'
    )
    if (document.getElementById('channelInfo')) {
      document.getElementById('channelInfo').innerHTML =
        '<p style="text-align: center; padding: 50px;">Guide data unavailable...</p>'
    }
    return
  }

  const currentTime = Math.floor(Date.now() / 1000)
  const channelsWithChno = []
  const channelsWithoutChno = []
  const channelInfo = document.getElementById('channelInfo')

  if (!channelInfo) {
    console.error(
      "Fatal Error: Channel info container '#channelInfo' not found in HTML!"
    )
    return
  }
  channelInfo.innerHTML = '' // Clear previous content

  for (const key in data) {
    if (data.hasOwnProperty(key) && data[key].programs) {
      let { chno, name, mjh_master } = data[key]

      if (!freeviewChannels.includes(name)) continue

      // --- LOGIC ---
      // 1. Get the stream URL and logo.
      let streamUrl = mjh_master || data[key].streams?.hls?.url
      let logo = data[key].logo
      let proxiedUrl = streamUrl // Default: Use the direct URL if it exists

      const requiresProxy = PROXY_REQUIRED_CHANNELS.includes(name)

      // *** NEW AUTHENTICATION GATE ***
      if (requiresProxy && !isLoggedIn) {
        console.log(
          `Skipping channel "${name}" because the user is not logged in.`
        )
        continue // Skip to the next channel key
      }
      // *** END AUTHENTICATION GATE ***

      // 3. Handle specific OVERRIDES (Logo/chno/Stream URL).
      switch (name) {
        case 'TVNZ 1':
          logo = 'images/tvnz1a.png'
          break
        case 'TVNZ 2':
          logo = 'images/tvnz2a.png'
          break
        case 'DUKE':
          logo = 'images/tvnzduke1.png'
          break
        case 'eden':
          logo = 'images/eden.png'
          break
        case 'RUSH':
          logo = 'images/rush.png'
          break
        case 'MovieSphere':
          chno = 7
          break
        case 'TAB Trackside 1':
          name = 'Trackside 1'
          logo = 'images/ts1.png'
          break
        case 'TAB Trackside 2':
          name = 'Trackside 2'
          logo = 'images/ts2.png'
          break
        case 'Bravo':
          logo = 'images/bravo.png'
          break
        case 'Bravo PLUS 1':
          logo = 'images/bravoplus1.png'
          break
        case 'eden+1':
          chno = 17
          break
        case 'Three':
          logo = 'images/three.png'
          break
        case 'Sky Open':
          logo = 'images/skyopen.png'
          break
        case 'Sky Open+1':
          logo = 'images/skyopenplus1.png'
          break
      }

      // 4. Final check.
      if (!proxiedUrl) {
        console.warn(`Skipping channel "${name}" due to missing stream URL.`)
        continue
      }

      const programs = data[key].programs

      for (let i = 0; i < programs.length; i++) {
        const programTime = programs[i][0]

        if (
          programTime <= currentTime &&
          (i === programs.length - 1 ||
            (programs[i + 1] && programs[i + 1][0] > currentTime))
        ) {
          const programTitle = programs[i][1]
          const nextProgram = programs[i + 1]?.[1] || 'No upcoming program'
          const nextProgram2 = programs[i + 2]?.[1] || 'No upcoming program'
          const programStartTime = new Date(
            programTime * 1000
          ).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })

          let timeRemaining = 'No Schedule',
            timeRemaining2 = 'No Schedule'
          if (programs[i + 1]?.[0]) {
            let rm1 = Math.floor((programs[i + 1][0] - currentTime) / 60)
            if (rm1 < 0) rm1 = 0
            timeRemaining =
              rm1 === 0
                ? 'In < 1 min'
                : rm1 === 1
                ? 'In 1 min'
                : `In ${rm1} mins`
          }
          if (programs[i + 2]?.[0]) {
            let rm2 = Math.floor((programs[i + 2][0] - currentTime) / 60)
            if (rm2 < 0) rm2 = 0
            timeRemaining2 =
              rm2 === 0
                ? 'In < 1 min'
                : rm2 === 1
                ? 'In 1 min'
                : `In ${rm2} mins`
          }

          const channelDiv = document.createElement('div')
          channelDiv.classList.add('channelDiv')

          // *** FINAL, SIMPLEST, ROBUST CLICK HANDLER ***
          channelDiv.onclick = function () {
            // Capture the URL and Name attached to this element
            const urlToPlay = this.dataset.streamUrl
            const nameToPlay = this.dataset.channelName

            if (menuOpen) {
              toggleMenu(false)
            }

            if (
              urlToPlay &&
              typeof urlToPlay === 'string' &&
              urlToPlay.trim() !== ''
            ) {
              startStream(urlToPlay, nameToPlay) // Direct call to global function
            } else {
              console.error(
                `Invalid stream URL for channel "${nameToPlay}":`,
                urlToPlay
              )
              alert(`Stream URL is not available for ${nameToPlay}.`)
              showOverlay()
            }
          }

          // Store data directly on the element
          channelDiv.dataset.streamUrl = proxiedUrl
          channelDiv.dataset.channelName = name
          // *** END CLICK HANDLER ***

          const displayChno =
            chno ||
            200 + channelsWithChno.length + channelsWithoutChno.length + 1

          channelDiv.innerHTML = `
                        <div class="channel-number-container"><div class="start-time">${programStartTime}</div><div class="channel-number">${displayChno}</div></div>
                        <div class="program-content"><div class="program-title">${programTitle}</div><div class="upcoming-programs-wrapper"><div class="next-program"><span class="end-time">${timeRemaining}: </span>${nextProgram}</div><div class="next-program2"><span class="end-time">${timeRemaining2}: </span>${nextProgram2}</div></div></div>
                        <div class="program-image"><img src="${logo}" alt="${name} logo" loading="lazy"/></div>`

          if (chno) channelsWithChno.push({ chno, channelDiv })
          else channelsWithoutChno.push({ chno: displayChno, channelDiv })

          break
        }
      }
    }
  }

  channelsWithChno.sort((a, b) => a.chno - b.chno)
  channelsWithChno.forEach(ch => channelInfo.appendChild(ch.channelDiv))
  channelsWithoutChno.sort((a, b) => a.chno - b.chno)
  channelsWithoutChno.forEach(ch => channelInfo.appendChild(ch.channelDiv))
}
// --- BUILD PAGE FUNCTION (End) ---

// *** MODIFIED / NEW FUNCTIONS (Rest of app.js) ***

function handleLogout () {
  fetch('logout.ashx', { method: 'POST' }).catch(() =>
    console.log("Couldn't hit logout.ashx, proceeding with client-side logout.")
  )

  isLoggedIn = false
  localStorage.setItem(AUTH_STORAGE_KEY, 'false')
  showTemporaryMessage(
    'You have been logged out. Returning to Guest mode.',
    3000
  )

  toggleMenu(false)
  fetchAndUpdateCache()
  buildPage(cachedData)
}

// --- REST OF ORIGINAL CODE (MUST BE PRESENT) ---

// *** ORIGINAL ***: Helper Functions (Kept as they were)
function saveVolume () {
  if (player && !player.isDisposed()) {
    localStorage.setItem('playerVolume', player.volume())
    localStorage.setItem('playerMuted', player.muted())
  }
}
function loadVolume () {
  const savedVolume = localStorage.getItem('playerVolume')
  const savedMuted = localStorage.getItem('playerMuted')
  if (savedVolume !== null) {
    player.volume(parseFloat(savedVolume))
  }
  if (savedMuted !== null) {
    player.muted(savedMuted === 'true')
  }
}

function startStreamHealthCheck () {
  let lastTime = 0
  let timeFrozen = 0
  const CHECK_INTERVAL = 1000

  clearInterval(streamHealthCheckInterval)

  streamHealthCheckInterval = setInterval(() => {
    if (!player || player.paused() || player.ended() || player.isDisposed()) {
      clearInterval(streamHealthCheckInterval)
      return
    }

    const currentTime = player.currentTime()

    if (currentTime === lastTime) {
      timeFrozen += CHECK_INTERVAL
      if (timeFrozen >= FROZEN_STREAM_TIMEOUT) {
        console.warn('Stream frozen for too long! Attempting to restart.')
        showTemporaryMessage('Stream seems frozen. Restarting...', 5000, true)
        stopPlaying()
        clearInterval(streamHealthCheckInterval)
      }
    } else {
      timeFrozen = 0
      lastTime = currentTime
    }
  }, CHECK_INTERVAL)
}

function startStream (url, name) {
  clearInterval(streamHealthCheckInterval)
  isPlaying = true

  console.log(`Attempting to start stream for: ${name} - URL: ${url}`)

  const spinner = document.getElementById('loadingSpinner')
  if (spinner) {
    spinner.style.display = 'block'
  }

  if (!videoElement) {
    videoElement = document.getElementById('videoScreen')
    if (!videoElement) {
      console.error('Video element #videoScreen not found!')
      alert('Player error: Could not find video element.')
      if (spinner) spinner.style.display = 'none'
      return
    }
  }

  function disableSubtitlesAndCaptions (videoHtmlElement) {
    if (!videoHtmlElement || !videoHtmlElement.textTracks) return

    for (let i = 0; i < videoHtmlElement.textTracks.length; i++) {
      const track = videoHtmlElement.textTracks[i]
      if (track.kind === 'subtitles' || track.kind === 'captions') {
        track.mode = 'disabled'
      }
    }
  }

  if (!player || player.isDisposed()) {
    console.log('Initializing Video.js player with HLS options')
    if (player && !player.isDisposed()) player.dispose()

    player = videojs(videoElement, {
      controls: true,
      autoplay: false,
      preload: 'auto',
      fluid: true,
      liveui: true,
      textTrackDisplay: false,
      html5: {
        nativeTextTracks: false,
        hls: {
          enableCEA708Captions: false,
          enableWebVTT: false,
          smoothQualityChange: true,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 5
        }
      }
    })

    player.on('volumechange', saveVolume)

    player.on('error', function () {
      const error = player.error()
      console.error('Video.js Error:', error)

      clearInterval(streamHealthCheckInterval)

      if (spinner) spinner.style.display = 'none'
      alert(`Failed to load stream for ${name}.`)

      if (!overlayOpen) {
        showOverlay()
      }
      stopPlaying()
    })

    player.on('loadeddata', function () {
      if (spinner) spinner.style.display = 'none'
      console.log('Video.js event: loadeddata (Spinner hidden)')
    })

    player.on('play', function () {
      console.log('Video.js event: play')
      isPlaying = true
      document.getElementById('stopButton').style.display = 'block'

      startStreamHealthCheck()

      if (spinner) spinner.style.display = 'none'
      clearTimeout(overlayTimeout)
    })

    player.on('pause', function () {
      console.log('Video.js event: pause')
      isPlaying = false
      clearTimeout(overlayTimeout)
      clearInterval(streamHealthCheckInterval)
    })

    player.on('ended', function () {
      console.log('Video.js event: ended')
      isPlaying = false
      stopPlaying()
    })

    player.tech_.on('bandwidthupdate', function (event) {
      if (
        event.rebuffering ||
        event.bitrate < (player.tech_.vhs.bandwidth || 0)
      ) {
        showTemporaryMessage('Network issue: Adjusting quality...', 3000)
      }
    })

    player.ready(loadVolume)
  }

  const videoHtmlElement = videoElement.querySelector('video')

  if (videoHtmlElement && videoHtmlElement.textTracks) {
    videoHtmlElement.textTracks.addEventListener('addtrack', function () {
      disableSubtitlesAndCaptions(videoHtmlElement)
    })
  }

  console.log(`Setting source for Video.js: ${url}`)
  player.src({ src: url, type: 'application/x-mpegURL' })

  player.ready(function () {
    disableSubtitlesAndCaptions(videoHtmlElement)

    if (player.qualityLevels) {
      const qualityLevels = player.qualityLevels()

      const maxAllowedBitrate = isSmallScreen
        ? MAX_MOBILE_BITRATE
        : MAX_DESKTOP_BITRATE

      console.log(
        `Quality Control: isSmallScreen=${isSmallScreen}. Max Bitrate Set to ${
          maxAllowedBitrate / 1000
        } kbps.`
      )

      qualityLevels.on('addqualitylevel', function (event) {
        const qualityLevel = event.qualityLevel
        if (qualityLevel.bitrate > maxAllowedBitrate) {
          qualityLevel.enabled = false
        } else {
          qualityLevel.enabled = true
        }
      })

      if (player.tech_ && player.tech_.hls) {
        player.tech_.hls.selectPlaylist()
      }
    }

    var promise = player.play()
    if (promise !== undefined) {
      promise.catch(error => {
        if (error.name !== 'AbortError') {
          console.warn(`Playback prevented for ${name}:`, error)
          isPlaying = false

          if (spinner) spinner.style.display = 'none'
          alert(`Failed to load stream for ${name}.`)

          if (!overlayOpen) {
            showOverlay()
          }
        }
      })
    }
    setTimeout(hideOverlay, 50)
  })
}
function stopPlaying () {
  console.log('Stopping playback')
  clearInterval(streamHealthCheckInterval)

  if (player && !player.isDisposed()) {
    player.pause()
    player.reset()
    saveVolume()
    console.log('Video.js player reset.')
  }
  isPlaying = false
  document.getElementById('stopButton').style.display = 'none'
  if (!overlayOpen) {
    showOverlay()
  }
  clearTimeout(overlayTimeout)
}

// --- INITIALIZATION AND EXECUTION BLOCKS (Start) ---

var checkPlayingTimer = setInterval(function () {
  if (!isPlaying) {
    document.getElementById('overlay').classList.remove('hidden')
    document.getElementById('stopButton').style.display = 'none'
  }
}, 2000)

document.addEventListener('DOMContentLoaded', function () {
  if (!videoElement) {
    console.error('Video element #videoScreen not found!')
    return
  }

  // *** NEW ***: Check stored authentication status immediately
  checkAuthStatus()

  console.log('Performing initial guide fetch...')
  const initialCacheBuster = `?t=${Date.now()}`

  

  fetch(current_EPG_URL + initialCacheBuster, { cache: 'no-store' })
    .then(response => {
      if (!response.ok)
        throw new Error(`Initial EPG fetch failed! status: ${response.status}`)
      return response.json()
    })
    .then(data => {
      console.log('Initial guide data fetched successfully.')
      cachedData = data
      // *** MODIFIED ***: Initial buildPage now uses the auth state
      buildPage(cachedData)

      console.log(
        `Starting ${UI_UPDATE_INTERVAL / 1000}-second display update interval.`
      )
      setInterval(updateDisplayFromCache, UI_UPDATE_INTERVAL)

      console.log(
        `Starting ${
          DATA_FETCH_INTERVAL / (60 * 60 * 1000)
        }-hour data fetch interval.`
      )
      setInterval(fetchAndUpdateCache, DATA_FETCH_INTERVAL)
    })
    .catch(error => {
      console.error('FATAL: Initial EPG fetch failed:', error)
      if (document.getElementById('channelInfo')) {
        document.getElementById(
          'channelInfo'
        ).innerHTML = `<p style="text-align: center; padding: 50px;">Error loading initial guide. Please check connection and refresh.</p>`
      }
    })

  // *** FIX 2: Explicitly use window for the most robust fullscreen click detection ***
  const activityTarget = window

  function handleActivityForOverlay () {
    if (isPlaying) {
      showOverlay()
      resetOverlayTimeout()
    }
  }

  // MODIFIED: Only track mousemove/click if the menu is NOT open
  activityTarget.addEventListener('mousemove', () => {
    if (!menuOpen) handleActivityForOverlay()
  })
  activityTarget.addEventListener('wheel', () => {
    if (!menuOpen) handleActivityForOverlay()
  })
  activityTarget.addEventListener(
    'click',
    () => {
      if (!menuOpen) handleActivityForOverlay()
    },
    {
      passive: true
    }
  )
  activityTarget.addEventListener(
    'touchstart',
    () => {
      if (!menuOpen) handleActivityForOverlay()
    },
    {
      passive: true
    }
  )
})

// Service Worker registration
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('js/service-worker.js')
      .then(reg =>
        console.log('ServiceWorker registered successfully scope:', reg.scope)
      )
      .catch(err => console.error('ServiceWorker registration failed:', err))
  })
}
// --- INITIALIZATION AND EXECUTION BLOCKS (End) ---
