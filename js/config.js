const APP_CONFIG = {
  guideApiBaseUrl: '',
  guideApiPlaylist: 'freeview',
  guideApiSummaryPath: 'guide/summary',
  playlistFetchIntervalMs: 30 * 60 * 1000,
  additionalApiPlaylists: ['skysport'],

  loginEndpoint: 'login.ashx',
  logoutEndpoint: 'logout.ashx',
  authStatusEndpoint: 'auth-status.ashx',
  authChangeStorageKey: 'freeviewAuthChanged',
  restrictedChannels: ['TVNZ 1', 'TVNZ 2', 'DUKE', 'TVNZ 1+1', 'TVNZ 2+1', 'DUKE+1', 'Sky Sport 1', 'Sky Sport 2', 'Sky Sport 3', 'Sky Sport 4'],
  loginOnlyChannels: ['Sky Sport 1', 'Sky Sport 2', 'Sky Sport 3', 'Sky Sport 4'],
  guestPreviewStorageKey: 'freeviewGuestPreview',
  guestPreviewDurationMs: 2 * 60 * 1000,
  guestPreviewCooldownMs: 30 * 60 * 1000,

  uiUpdateIntervalMs: 60 * 1000,
  dataFetchIntervalMs: 60 * 1000,
  overlayTimeoutMs: 5000,

  guideRetryIntervalMs: 5000,
  guideMaxRetryIntervalMs: 60000,
  playbackStartTimeoutMs: 20000,
  playbackStallTimeoutMs: 60000,

  freeviewChannels: [
    'TVNZ 1',
    'TVNZ 1+1',
    'TVNZ 2',
    'TVNZ 2+1',
    'DUKE',
    'DUKE+1',
    'Three',
    'ThreePlus1',
    'HGTV',
    'eden',
    'Bravo',
    'Bravo PLUS 1',
    'Sky Open',
    'RUSH',
    'Te Reo',
    'Whakaata Māori',
    'Sky Sport 1',
    'Sky Sport 2',
    'Sky Sport 3',
    'Sky Sport 4'
  ],

  // Match playlist labels and guide IDs explicitly where the API sources differ.
  channelNameAliases: {
    'BravoPlus1': 'Bravo PLUS 1',
    'Sport 1': 'Sky Sport 1',
    'Sport 2': 'Sky Sport 2',
    'Sport 3': 'Sky Sport 3',
    'Sport 4': 'Sky Sport 4'
  },
  channelNumberOverrides: {
    'Sky Sport 1': 51,
    'Sky Sport 2': 52,
    'Sky Sport 3': 53,
    'Sky Sport 4': 54
  },
  channelGuideIdOverrides: {
    'HGTV': 'mjh-sky-hgtv'
  },
  // These have local stream overrides and their own schedules in the guide API.
  additionalChannels: {
    'TVNZ 1+1': { guideId: 'mjh-tvnz-1-plus1', chno: 11, logoSource: 'TVNZ 1' },
    'TVNZ 2+1': { guideId: 'mjh-tvnz-2-plus1', chno: 12, logoSource: 'TVNZ 2' },
    'DUKE+1': { guideId: 'mjh-tvnz-duke-plus1', chno: 15, logoSource: 'DUKE' }
  },

  channelLogoOverrides: {
    'TVNZ 1': 'images/tvnz1a.png',
    'TVNZ 1+1': 'images/tvnz1plus1.png',
    'TVNZ 2': 'images/tvnz2a.png',
    'TVNZ 2+1': 'images/tvnz2plus1.png',
    'DUKE': 'images/tvnzduke1.png',
    'DUKE+1': 'images/tvnzdukeplus1.png',
    'eden': 'images/eden.png',
    'RUSH': 'images/rush.png',
    'Bravo': 'images/bravo.png',
    'Three': 'images/three.png',
    'Bravo PLUS 1': 'images/bravoplus1.png',
    'Sky Open': 'images/skyopen.png'
  },

  // Private endpoints are supplied by the ignored config.local.js file.
  channelUrlOverrides: {
    "Sky Sport 1": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "Sky Sport 2": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "Sky Sport 3": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "Sky Sport 4": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 1+1": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 2+1": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "DUKE+1": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 1": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 2": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    },
    "DUKE": {
      "streamUrl": "",
      "manifest": "hls",
      "required": true
    }
  }
}
