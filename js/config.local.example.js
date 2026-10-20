// Copy to config.local.js and supply your own endpoints.
Object.assign(APP_CONFIG, {
  "guideApiBaseUrl": "https://guide.example/api",
  "channelUrlOverrides": {
    "Sky Sport 1": {
      "streamUrl": "https://streams.example/sky-sport-1/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "Sky Sport 2": {
      "streamUrl": "https://streams.example/sky-sport-2/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "Sky Sport 3": {
      "streamUrl": "https://streams.example/sky-sport-3/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "Sky Sport 4": {
      "streamUrl": "https://streams.example/sky-sport-4/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 1+1": {
      "streamUrl": "https://streams.example/tvnz-1-1/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 2+1": {
      "streamUrl": "https://streams.example/tvnz-2-1/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "DUKE+1": {
      "streamUrl": "https://streams.example/duke-1/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 1": {
      "streamUrl": "https://streams.example/tvnz-1/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "TVNZ 2": {
      "streamUrl": "https://streams.example/tvnz-2/live.m3u8",
      "manifest": "hls",
      "required": true
    },
    "DUKE": {
      "streamUrl": "https://streams.example/duke/live.m3u8",
      "manifest": "hls",
      "required": true
    }
  }
})
