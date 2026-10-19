/*
Shows a Helium-style glowing loading line along the bottom edge of the navbar
(just below the address bar / tab strip) while the selected tab is loading.
*/

// reading a layout property forces the browser to apply pending style changes
function forceReflow (element) {
  element.getBoundingClientRect()
}

const progressBar = {
  container: null,
  bar: null,
  progress: 0,
  running: false,
  loadingTabs: {}, // tabId: true while that tab is loading
  crawlInterval: null,
  hideTimeout: null,

  create: function () {
    const container = document.createElement('div')
    container.id = 'loading-progress-bar'
    container.hidden = true

    const bar = document.createElement('div')
    bar.className = 'loading-progress-bar-fill'
    container.appendChild(bar)

    progressBar.container = container
    progressBar.bar = bar

    return container
  },

  // called when a tab starts or stops loading
  setLoading: function (tabId, isLoading) {
    if (isLoading) {
      progressBar.loadingTabs[tabId] = true
    } else {
      delete progressBar.loadingTabs[tabId]
    }
    progressBar.update()
  },

  // decides whether the bar should be running based on the selected tab
  update: function () {
    if (!progressBar.container) {
      return
    }

    if (progressBar.loadingTabs[tabs.getSelected()]) {
      progressBar.start()
    } else {
      progressBar.finish()
    }
  },

  start: function () {
    if (!progressBar.container) {
      return
    }

    clearTimeout(progressBar.hideTimeout)
    progressBar.hideTimeout = null

    if (progressBar.running) {
      return
    }

    progressBar.running = true
    progressBar.container.hidden = false

    // reset the bar instantly so a new load never animates backwards
    progressBar.bar.style.transition = 'none'
    progressBar.progress = 0.08
    progressBar.render()
    forceReflow(progressBar.bar)
    progressBar.bar.style.transition = ''

    progressBar.crawlInterval = setInterval(function () {
      // ease towards 90% and never quite reach it while the page is still loading
      const remaining = 0.9 - progressBar.progress
      progressBar.progress += Math.max(remaining * 0.05, 0.0015)
      if (progressBar.progress > 0.9) {
        progressBar.progress = 0.9
      }
      progressBar.render()
    }, 250)
  },

  finish: function () {
    if (!progressBar.container) {
      return
    }

    clearInterval(progressBar.crawlInterval)
    progressBar.crawlInterval = null

    if (!progressBar.running) {
      progressBar.container.hidden = true
      return
    }

    progressBar.running = false
    progressBar.progress = 1
    progressBar.render()

    clearTimeout(progressBar.hideTimeout)
    progressBar.hideTimeout = setTimeout(function () {
      if (progressBar.running) {
        return
      }
      progressBar.container.hidden = true
      progressBar.progress = 0
      progressBar.render()
    }, 400)
  },

  render: function () {
    progressBar.bar.style.width = (progressBar.progress * 100) + '%'
  }
}

module.exports = progressBar
