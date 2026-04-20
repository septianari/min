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

function getFirefoxUA () {
  const rootUAs = {
    mac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:FXVERSION.0) Gecko/20100101 Firefox/FXVERSION.0',
    windows: 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:FXVERSION.0) Gecko/20100101 Firefox/FXVERSION.0',
    linux: 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:FXVERSION.0) Gecko/20100101 Firefox/FXVERSION.0'
  }

  let rootUA
  if (process.platform === 'win32') {
    rootUA = rootUAs.windows
  } else if (process.platform === 'darwin') {
    rootUA = rootUAs.mac
  } else {
    // 'aix', 'freebsd', 'linux', 'openbsd', 'sunos'
    rootUA = rootUAs.linux
  }

  // Estimate a recent Firefox major version to avoid claiming an unreleased version.
  const fxVersion = 91 + Math.floor((Date.now() - 1628553600000) / (4.1 * 7 * 24 * 60 * 60 * 1000))
  return rootUA.replace(/FXVERSION/g, fxVersion)
}

function enableGoogleUASwitcher (ses) {
  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    if (!hasCustomUserAgent && details.url.includes('google.')) {
      try {
        const url = new URL(details.url)
        if (url.hostname === 'accounts.google.com') {
          // Google sign-in occasionally blocks Chromium/Electron embedded contexts.
          details.requestHeaders['User-Agent'] = getFirefoxUA()
        } else if (url.hostname === 'google.com' || url.hostname.endsWith('.google.com')) {
          details.requestHeaders['User-Agent'] = newUserAgent
        }
      } catch (e) {
        // ignore malformed URLs
      }
    }

    const chromiumVersion = process.versions.chrome.split('.')[0]
    details.requestHeaders['SEC-CH-UA'] = `"Chromium";v="${chromiumVersion}", " Not A;Brand";v="99"`
    details.requestHeaders['SEC-CH-UA-MOBILE'] = '?0'

    callback({ cancel: false, requestHeaders: details.requestHeaders })
  })
}

app.once('ready', function () {
  enableGoogleUASwitcher(session.defaultSession)
})

app.on('session-created', enableGoogleUASwitcher)
