if (typeof require !== 'undefined') {
  var settings = require('util/settings/settings.js')
}

function enableDarkMode () {
  document.body.classList.add('dark-mode')
  window.isDarkMode = true
  if (settings.get('ultraDarkThemeIsActive')) {
    document.body.classList.add('ultra-dark-mode')
    window.isUltraDarkMode = true
  }
  requestAnimationFrame(function () {
    window.dispatchEvent(new CustomEvent('themechange'))
  })
}

function disableDarkMode () {
  document.body.classList.remove('dark-mode')
  document.body.classList.remove('ultra-dark-mode')
  window.isDarkMode = false
  window.isUltraDarkMode = false
  requestAnimationFrame(function () {
    window.dispatchEvent(new CustomEvent('themechange'))
  })
}

function initialize () {
  function themeChanged (value) {
    if (value === true) {
      enableDarkMode()
    } else {
      disableDarkMode()
    }
  }
  settings.listen('darkThemeIsActive', themeChanged)

  function ultraThemeChanged (value) {
    if (value === true && settings.get('darkThemeIsActive')) {
      document.body.classList.add('ultra-dark-mode')
      window.isUltraDarkMode = true
    } else {
      document.body.classList.remove('ultra-dark-mode')
      window.isUltraDarkMode = false
    }
    window.dispatchEvent(new CustomEvent('themechange'))
  }
  settings.listen('ultraDarkThemeIsActive', ultraThemeChanged)
}

if (typeof module !== 'undefined') {
  module.exports = { initialize }
} else {
  initialize()
}
