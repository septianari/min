/*
Electron/Chromium is not compiled with "Google Chrome" branding, so
navigator.userAgentData.brands never includes a "Google Chrome" entry -
only "Chromium" (plus the standard GREASE brand). Some Google sign-in flows
treat that as a signal that the browser has been tampered with / isn't a
"real" browser, and respond with "This browser or app may not be secure".

This patches navigator.userAgentData (as seen by page scripts) on Google
domains only, adding a "Google Chrome" brand consistent with the Chromium
version actually in use, so the reported identity looks like standard Chrome.
*/

(function () {
  var hostname = location.hostname
  if (!hostname || (hostname !== 'google.com' && !hostname.endsWith('.google.com'))) {
    return
  }

  var chromeFullVersion = (typeof process !== 'undefined' && process.versions && process.versions.chrome) || ''
  if (!chromeFullVersion) {
    return
  }
  var chromeMajorVersion = chromeFullVersion.split('.')[0]

  electron.webFrame.executeJavaScript(`
    (function () {
      var uaData = navigator.userAgentData
      if (!uaData) {
        return
      }

      var majorVersion = ${JSON.stringify(chromeMajorVersion)}
      var fullVersion = ${JSON.stringify(chromeFullVersion)}

      var originalBrands = uaData.brands || []
      if (originalBrands.some(function (b) { return b.brand === 'Google Chrome' })) {
        return // already present, nothing to do
      }

      var patchedBrands = originalBrands.concat([{ brand: 'Google Chrome', version: majorVersion }])
      var patchedFullVersionList = patchedBrands.map(function (b) {
        return { brand: b.brand, version: (b.brand === 'Google Chrome' || b.brand === 'Chromium') ? fullVersion : b.version }
      })

      var originalGetHighEntropyValues = uaData.getHighEntropyValues ? uaData.getHighEntropyValues.bind(uaData) : null

      var patchedUAData = Object.create(Object.getPrototypeOf(uaData))
      Object.defineProperties(patchedUAData, {
        brands: {
          get: function () { return patchedBrands.slice() },
          enumerable: true
        },
        mobile: {
          get: function () { return uaData.mobile },
          enumerable: true
        },
        platform: {
          get: function () { return uaData.platform },
          enumerable: true
        },
        getHighEntropyValues: {
          value: function (hints) {
            var basePromise = originalGetHighEntropyValues ? originalGetHighEntropyValues(hints) : Promise.resolve({})
            return basePromise.then(function (result) {
              result.brands = patchedBrands.slice()
              if (hints && hints.indexOf('fullVersionList') !== -1) {
                result.fullVersionList = patchedFullVersionList.slice()
              }
              if (hints && hints.indexOf('uaFullVersion') !== -1) {
                result.uaFullVersion = fullVersion
              }
              return result
            })
          }
        },
        toJSON: {
          value: function () {
            return { brands: patchedBrands.slice(), mobile: uaData.mobile, platform: uaData.platform }
          }
        }
      })

      Object.defineProperty(Navigator.prototype, 'userAgentData', {
        get: function () { return patchedUAData },
        configurable: true,
        enumerable: true
      })
    })()
  `)
})()
