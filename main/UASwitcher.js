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
    Switching only some requests to a Firefox UA (while still sending
    Chromium Client Hints headers below) produces mixed signals that
    Google's sign-in security checks flag as a spoofed browser, causing
    "This browser or app may not be secure" sign-in failures.
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

    const chromiumVersion = process.versions.chrome.split('.')[0]
    // Include a "Google Chrome" brand alongside "Chromium" - Electron/Chromium
    // doesn't report this brand by default, and some Google sign-in checks
    // treat its absence as a sign of a non-standard/tampered browser.
    details.requestHeaders['SEC-CH-UA'] = `"Not/A)Brand";v="99", "Chromium";v="${chromiumVersion}", "Google Chrome";v="${chromiumVersion}"`
    details.requestHeaders['SEC-CH-UA-MOBILE'] = '?0'

    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })
}

app.once('ready', function () {
  enableGoogleUASwitcher(session.defaultSession)
})

app.on('session-created', enableGoogleUASwitcher)
