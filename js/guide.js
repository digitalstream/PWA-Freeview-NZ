let cachedGuideData = null
const guideRows = new Map()

async function fetchGuideData () {
  const data = await fetchApiGuideData(cachedGuideData)
  cachedGuideData = data
  console.log('Guide loaded from API:', Object.keys(data).length, 'channels')
  return data
}

function setGuideText (element, text) {
  const value = String(text ?? '')
  if (element.textContent !== value) element.textContent = value
}

function createGuideElement (tag, className, parent) {
  const element = document.createElement(tag)
  element.className = className
  if (parent) parent.appendChild(element)
  return element
}

function createGuideRow () {
  const row = createGuideElement('div', 'channelDiv')
  row.tabIndex = 0
  row.setAttribute('role', 'button')
  const number = createGuideElement('div', 'channel-number-container', row)
  const start = createGuideElement('div', 'start-time', number)
  const channelNumber = createGuideElement('div', 'channel-number', number)
  const content = createGuideElement('div', 'program-content', row)
  const title = createGuideElement('div', 'program-title', content)
  const upcoming = createGuideElement('div', 'upcoming-programs-wrapper', content)
  const next = createGuideElement('div', 'next-program', upcoming)
  const nextTime = createGuideElement('span', 'end-time', next)
  const nextTitle = createGuideElement('span', 'upcoming-title', next)
  const later = createGuideElement('div', 'next-program2', upcoming)
  const laterTime = createGuideElement('span', 'end-time', later)
  const laterTitle = createGuideElement('span', 'upcoming-title', later)
  const image = createGuideElement('div', 'program-image', row)
  const logo = document.createElement('img')
  logo.loading = 'lazy'
  image.appendChild(logo)
  row.parts = { start, channelNumber, title, nextTime, nextTitle, laterTime, laterTitle, logo }
  row.addEventListener('click', () => {
    const channel = buildPlayableChannel(row.channel)
    if (channel.streamUrl) playChannel(channel)
    else showTemporaryMessage(channel.name + ' stream is not available yet.', 5000, true)
  })
  row.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      row.click()
    }
  })
  return row
}

function updateGuideRow (row) {
  const info = getProgrammeInfo(row.channel.programs)
  const parts = row.parts
  setGuideText(parts.start, info.startTime)
  setGuideText(parts.title, info.currentTitle)
  row.classList.toggle('restricted-channel', isRestrictedChannel(row.channel))
  row.classList.toggle('guest-channel', isRestrictedChannel(row.channel) && !isLoggedIn)
  setGuideText(parts.nextTime, info.timeRemaining)
  setGuideText(parts.nextTitle, info.nextTitle)
  setGuideText(parts.laterTime, info.laterTimeRemaining)
  setGuideText(parts.laterTitle, info.laterTitle)
}

function renderGuide (data) {
  const container = document.getElementById('channelInfo')
  if (!container) return
  const selected = new Set(APP_CONFIG.freeviewChannels)
  let fallback = 200
  const channels = Object.values(data).filter(channel => selected.has(channel.name) && isChannelVisible(channel)).map(channel => ({
    channel,
    number: Number.isFinite(Number(channel.chno)) && Number(channel.chno) > 0 ? Number(channel.chno) : ++fallback
  })).sort((a, b) => a.number - b.number)
  const present = new Set(channels.map(({ channel }) => channel.guideId || channel.name))
  for (const [id, row] of guideRows) {
    if (!present.has(id)) { row.remove(); guideRows.delete(id) }
  }
  channels.forEach(({ channel, number }, index) => {
    const id = channel.guideId || channel.name
    let row = guideRows.get(id)
    if (!row) { row = createGuideRow(); guideRows.set(id, row) }
    row.channel = channel
    row.setAttribute('aria-label', channel.name)
    if (isRestrictedChannel(channel) && !isLoggedIn) row.setAttribute('aria-description', 'Two-minute guest preview. Sign in for uninterrupted viewing.')
    else row.removeAttribute('aria-description')
    setGuideText(row.parts.channelNumber, number)
    const logo = getChannelLogo(channel)
    if (row.parts.logo.getAttribute('src') !== logo) row.parts.logo.setAttribute('src', logo)
    row.parts.logo.alt = channel.name + ' logo'
    updateGuideRow(row)
    if (container.children[index] !== row) container.insertBefore(row, container.children[index] || null)
  })
  console.log('Guide rendered:', channels.length, 'channels')
}

function refreshGuide () {
  for (const row of guideRows.values()) updateGuideRow(row)
}

function getCurrentProgramme (programs, currentTime = Math.floor(Date.now() / 1000)) {
  if (!Array.isArray(programs)) return null
  const index = programs.findIndex((programme, i) => {
    const stop = programme[2] ?? programs[i + 1]?.[0]
    return programme[0] <= currentTime && (stop == null || stop > currentTime)
  })
  return index < 0 ? null : { index, title: programs[index][1] || 'Unknown Programme', startTime: programs[index][0] }
}

function programmeCountdown (programme, now) {
  if (!programme) return ''
  const seconds = Math.max(0, programme[0] - now)
  if (seconds < 60) return 'In < 1 min'
  const minutes = Math.ceil(seconds / 60)
  return minutes === 1 ? 'In 1 min' : 'In ' + minutes + ' mins'
}

function getProgrammeInfo (programs) {
  const list = Array.isArray(programs) ? programs : []
  const now = Math.floor(Date.now() / 1000)
  const current = getCurrentProgramme(list, now)
  const nextIndex = current ? current.index + 1 : list.findIndex(programme => programme[0] > now)
  const next = nextIndex >= 0 ? list[nextIndex] : null
  const later = nextIndex >= 0 ? list[nextIndex + 1] : null
  return {
    currentTitle: current?.title || (next ? 'No programme currently scheduled' : 'No schedule available'),
    startTime: current ? new Date(current.startTime * 1000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '',
    nextTitle: next?.[1] || (current ? 'No upcoming programme' : ''),
    laterTitle: later?.[1] || '',
    timeRemaining: programmeCountdown(next, now),
    laterTimeRemaining: programmeCountdown(later, now)
  }
}

function getChannelLogo (channel) {
  return APP_CONFIG.channelLogoOverrides[channel.name] || channel.logo || ''
}

function buildPlayableChannel (channel) {
  const override = APP_CONFIG.channelUrlOverrides?.[channel.name]
  if (override && (override.streamUrl || override.required)) {
    return { name: channel.name, streamUrl: override.streamUrl, manifest: override.manifest || 'hls', licenseUrl: '' }
  }
  const manifest = channel.manifest || 'hls'
  return {
    name: channel.name,
    streamUrl: manifest === 'mpd' ? buildMpdProxyUrl(channel.streamUrl) : channel.streamUrl || '',
    manifest,
    licenseUrl: channel.license_url || ''
  }
}
