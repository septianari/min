/* Use the same user agent as Chrome to improve site compatibility and increase fingerprinting resistance
see https://github.com/minbrowser/min/issues/657 for more information */

const defaultUserAgent = app.userAgentFallback
let hasCustomUserAgent = false
let newUserAgent

if (settings.get('customUserAgent')) {
  newUserAgent = settings.get('customUserAgent')
  hasCustomUserAgent = true
} else {
  newUserAgent = defaultUserAgent.replace(/Min\/\S+\s/, '').replace(/Electron\/\S+\s/, '').replace(process.versions.chrome, process.versions.chrome.split('.').map((v, idx) => (idx === 0) ? v : '0').join('.'))
}
app.userAgentFallback = newUserAgent

function enableGoogleUASwitcher (ses) {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    /*
    Keep a consistent Chromium-like fingerprint on Google domains.
    Switching only some requests to Firefox UA can produce mixed signals.
    */
    if (!hasCustomUserAgent && details.url.includes('google.')) {
      try {
        const url = new URL(details.url)
        if (url.hostname === 'google.com' || url.hostname.endsWith('.google.com')) {
          details.requestHeaders['User-Agent'] = newUserAgent
        }
      } catch (e) {
        // ignore malformed URLs
      }
    }

    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })
}

app.once('ready', function () {
  enableGoogleUASwitcher(session.defaultSession)
})

app.on('session-created', enableGoogleUASwitcher)
