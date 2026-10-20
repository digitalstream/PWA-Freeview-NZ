let apiPlaylistCache = null

// Guide API adapter: playlist metadata, stream directives and programme schedules.
async function requestGuideApi (path, format = 'json') {
  if (!APP_CONFIG.guideApiBaseUrl) throw new Error('Guide API configuration is missing; set it in js/config.local.js.')
  const url = APP_CONFIG.guideApiBaseUrl.replace(/\/$/, '') + '/' + path
  // The guide API allows the Freeview origin through its CORS policy.
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 20000)
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      signal: controller.signal
    })
    if (!response.ok) {
      const error = new Error('Guide API HTTP ' + response.status)
      error.status = response.status
      throw error
    }
    return format === 'text' ? await response.text() : await response.json()
  } finally {
    clearTimeout(timeout)
  }
}

function parseGuideApiTime (value) {
  const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s+([+-])(\d{2}):?(\d{2})$/.exec(value || '')
  if (!match) return NaN
  const [, year, month, day, hour, minute, second, sign, offsetHour, offsetMinute] = match
  const utc = Date.UTC(+year, +month - 1, +day, +hour, +minute, +second) / 1000
  const offset = (+offsetHour * 60 + +offsetMinute) * 60
  return utc - (sign === '+' ? offset : -offset)
}

function parseApiPlaylist (text, playlistId = APP_CONFIG.guideApiPlaylist) {
  const channels = []
  let channel = null
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (line.startsWith('#EXTINF:')) {
      const attributes = Object.fromEntries(
        Array.from(line.matchAll(/([\w-]+)="([^"]*)"/g), match => [match[1], match[2]])
      )
      const playlistName = line.slice(line.lastIndexOf(',') + 1).trim()
      const name = APP_CONFIG.channelNameAliases?.[playlistName] || playlistName
      channel = {
        name,
        playlistId,
        guideId: APP_CONFIG.channelGuideIdOverrides?.[name] || attributes['tvg-id'],
        chno: APP_CONFIG.channelNumberOverrides?.[name] ?? (attributes['tvg-chno'] ? Number(attributes['tvg-chno']) : undefined),
        logo: attributes['tvg-logo'] || '',
        programs: []
      }
    } else if (channel && line.startsWith('#KODIPROP:inputstream.adaptive.manifest_type=')) {
      channel.manifest = line.slice(line.indexOf('=') + 1)
    } else if (channel && line.startsWith('#KODIPROP:inputstream.adaptive.license_key=')) {
      channel.license_url = line.slice(line.indexOf('=') + 1).split('|')[0]
    } else if (channel && line && !line.startsWith('#')) {
      channel.streamUrl = line.split('|')[0]
      channel.manifest = channel.manifest || (/\.mpd(?:[?#]|$)/i.test(channel.streamUrl) ? 'mpd' : 'hls')
      if (channel.guideId && APP_CONFIG.freeviewChannels.includes(channel.name)) channels.push(channel)
      channel = null
    }
  }
  return channels
}

function convertApiProgrammes (programmes) {
  if (!Array.isArray(programmes)) throw new Error('Invalid guide API schedule')
  return programmes.map(programme => [
    typeof programme.start === 'number' ? programme.start : parseGuideApiTime(programme.start),
    programme.title || 'Unknown Programme',
    typeof programme.stop === 'number' ? programme.stop : parseGuideApiTime(programme.stop)
  ]).filter(([start, , stop]) => Number.isFinite(start) && Number.isFinite(stop) && stop > start)
    .sort((a, b) => a[0] - b[0])
}

async function getApiChannels (previousData) {
  if (apiPlaylistCache && apiPlaylistCache.expiresAt > Date.now()) {
    return { channels: apiPlaylistCache.channels.map(channel => ({ ...channel, programs: [] })), sourceFailed: false }
  }
  let sourceFailed = false
  const ids = [APP_CONFIG.guideApiPlaylist, ...(APP_CONFIG.additionalApiPlaylists || [])]
  const lists = await Promise.all(ids.map(async id => {
    try {
      return parseApiPlaylist(await requestGuideApi('playlists/' + encodeURIComponent(id), 'text'), id)
    } catch (error) {
      sourceFailed = true
      const saved = Object.values(previousData || {}).filter(channel => (channel.playlistId || APP_CONFIG.guideApiPlaylist) === id)
      if (id === APP_CONFIG.guideApiPlaylist && !saved.length) throw error
      return saved.map(channel => ({ ...channel }))
    }
  }))
  const channels = lists.flat()
  if (!channels.length) throw new Error('The API playlists contain no matching channels')
  Object.entries(APP_CONFIG.additionalChannels || {}).forEach(([name, config]) => {
    if (!APP_CONFIG.freeviewChannels.includes(name)) return
    let channel = channels.find(item => item.guideId === config.guideId || item.name === name)
    if (!channel) { channel = { name, programs: [] }; channels.push(channel) }
    Object.assign(channel, { name, guideId: config.guideId, chno: config.chno })
    const source = channels.find(item => item.name === config.logoSource)
    channel.logo = APP_CONFIG.channelLogoOverrides[config.logoSource] || source?.logo || channel.logo || ''
  })
  if (!sourceFailed) {
    apiPlaylistCache = {
      expiresAt: Date.now() + (APP_CONFIG.playlistFetchIntervalMs || 30 * 60 * 1000),
      channels: channels.map(({ programs, scheduleError, ...channel }) => channel)
    }
  }
  return { channels, sourceFailed }
}

function previousApiPrograms (data, id) {
  return (data?.[id] || Object.values(data || {}).find(channel => channel.guideId === id))?.programs || []
}

async function fetchLegacySchedules (channels, previousData) {
  let nextIndex = 0
  const workers = Array.from({ length: Math.min(4, channels.length) }, async () => {
    while (nextIndex < channels.length) {
      const channel = channels[nextIndex++]
      try {
        channel.programs = convertApiProgrammes(await requestGuideApi(
          'guide/channel-programmes/' + encodeURIComponent(channel.playlistId || APP_CONFIG.guideApiPlaylist) + '/' + encodeURIComponent(channel.guideId)
        ))
        channel.scheduleError = false
      } catch (error) {
        channel.programs = previousApiPrograms(previousData, channel.guideId)
        channel.scheduleError = true
        console.warn('Schedule unavailable for ' + channel.name + ':', error)
      }
    }
  })
  await Promise.all(workers)
}

async function fetchApiGuideData (previousData) {
  const { channels, sourceFailed } = await getApiChannels(previousData)
  let stale = false
  if (APP_CONFIG.guideApiSummaryPath) {
    try {
      const ids = [...new Set(channels.map(channel => channel.guideId))]
      const summary = await requestGuideApi(APP_CONFIG.guideApiSummaryPath + '?channels=' + encodeURIComponent(ids.join(',')))
      if (!summary.channels || typeof summary.channels !== 'object' || Array.isArray(summary.channels)) throw new Error('Invalid guide summary')
      const programmes = channels.map(channel => convertApiProgrammes(summary.channels[channel.guideId] || []))
      channels.forEach((channel, index) => { channel.programs = programmes[index]; channel.scheduleError = false })
      stale = summary.isStale === true
    } catch (error) {
      // Keep old deployments working until the new API route is published.
      if (error.status === 404 || error.status === 405) await fetchLegacySchedules(channels, previousData)
      else {
        channels.forEach(channel => {
          channel.programs = previousApiPrograms(previousData, channel.guideId)
          channel.scheduleError = true
        })
      }
    }
  } else await fetchLegacySchedules(channels, previousData)
  const data = Object.fromEntries(channels.map(channel => [channel.guideId, channel]))
  Object.defineProperty(data, 'incomplete', { value: sourceFailed || stale || channels.some(channel => channel.scheduleError), enumerable: false })
  return data
}
