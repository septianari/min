/*
Real Google Chrome exposes a few extra properties on `window.chrome` that
plain Chromium (and therefore Electron) does not implement:
`chrome.loadTimes`, `chrome.csi`, and `chrome.app`. Various bot/automation
detection scripts - including some of Google's own sign-in risk checks -
treat the absence of these as a signal that the browser isn't genuine
Chrome, contributing to "This browser or app may not be secure" errors.

This patches `window.chrome` on Google domains to include them, matching
the shape real Chrome provides. Electron injects its own minimal
`chrome.runtime` shim via a separate internal script that can run after
this preload's initial pass, so the patch is (re-)applied a few times
during the page's early lifecycle to make sure it "wins".
*/

(function () {
  var hostname = location.hostname
  if (!hostname || (hostname !== 'google.com' && !hostname.endsWith('.google.com'))) {
    return
  }

  electron.webFrame.executeJavaScript(`
    (function () {
      function applyPatch() {
        try {
          var existing = window.chrome || {}

          var loadTimes = (typeof existing.loadTimes === 'function') ? existing.loadTimes : function () {
            var now = Date.now() / 1000
            return {
              commitLoadTime: now,
              connectionInfo: 'h2',
              finishDocumentLoadTime: now,
              finishLoadTime: now,
              firstPaintAfterLoadTime: 0,
              firstPaintTime: now,
              navigationType: 'Other',
              npnNegotiatedProtocol: 'h2',
              requestTime: now,
              startLoadTime: now,
              wasAlternateProtocolAvailable: false,
              wasFetchedViaSpdy: true,
              wasNpnNegotiated: true
            }
          }

          var csi = (typeof existing.csi === 'function') ? existing.csi : function () {
            return {
              onloadT: Date.now(),
              pageT: performance.now(),
              startE: Date.now(),
              tran: 15
            }
          }

          var app = existing.app || {
            isInstalled: false,
            InstallState: { DISABLED: 'disabled', INSTALLED: 'installed', NOT_INSTALLED: 'not_installed' },
            RunningState: { CANNOT_RUN: 'cannot_run', READY_TO_RUN: 'ready_to_run', RUNNING: 'running' },
            getDetails: function () { return null },
            getIsInstalled: function () { return false },
            runningState: function () { return 'cannot_run' }
          }

          if (existing.loadTimes === loadTimes && existing.csi === csi && existing.app === app) {
            return // already patched, nothing changed
          }

          var patchedChrome = {}
          Object.keys(existing).forEach(function (key) {
            patchedChrome[key] = existing[key]
          })
          patchedChrome.loadTimes = loadTimes
          patchedChrome.csi = csi
          patchedChrome.app = app

          Object.defineProperty(window, 'chrome', {
            value: patchedChrome,
            writable: true,
            configurable: true,
            enumerable: true
          })
        } catch (e) {
          // some environments may prevent redefining window.chrome - ignore
        }
      }

      applyPatch()

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', applyPatch)
      } else {
        applyPatch()
      }

      setTimeout(applyPatch, 0)
      setTimeout(applyPatch, 50)
      setTimeout(applyPatch, 300)
      setTimeout(applyPatch, 1000)
    })()
  `)
})()
