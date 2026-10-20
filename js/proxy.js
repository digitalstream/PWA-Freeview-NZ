function buildMpdProxyUrl (url) {
  return new URL('mpd-proxy.ashx?url=' + encodeURIComponent(url), window.location.href).href
}

function buildLicenseProxyUrl (url) {
  return new URL('license-proxy.ashx?url=' + encodeURIComponent(url), window.location.href).href
}
