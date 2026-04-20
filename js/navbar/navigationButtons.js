const webviews = require('webviews.js')

var navigationButtons = {
  tabsList: document.getElementById('tabs-inner'),
  container: document.getElementById('toolbar-navigation-buttons'),
  backButton: document.getElementById('back-button'),
  forwardButton: document.getElementById('forward-button'),
  update: function () {
    if (!tabs.get(tabs.getSelected()).url) {
      navigationButtons.backButton.disabled = true
      navigationButtons.forwardButton.disabled = true
      return
    }
    webviews.getNavigationHistory(tabs.getSelected()).then(function (navHistory) {
      if (!navHistory || !navHistory.entries) {
        navigationButtons.backButton.disabled = true
        navigationButtons.forwardButton.disabled = true
        navigationButtons.container.classList.remove('can-go-forward')
        return
      }

      const canGoBack = navHistory.activeIndex > 0
      const canGoForward = navHistory.activeIndex < navHistory.entries.length - 1

      navigationButtons.backButton.disabled = !canGoBack
      navigationButtons.forwardButton.disabled = !canGoForward

      if (canGoForward) {
        navigationButtons.container.classList.add('can-go-forward')
      } else {
        navigationButtons.container.classList.remove('can-go-forward')
      }
    }).catch(function () {
      navigationButtons.backButton.disabled = true
      navigationButtons.forwardButton.disabled = true
      navigationButtons.container.classList.remove('can-go-forward')
    })
  },
  initialize: function () {
    navigationButtons.container.hidden = false

    navigationButtons.backButton.addEventListener('click', function (e) {
      webviews.goBackIgnoringRedirects(tabs.getSelected())
    })

    navigationButtons.forwardButton.addEventListener('click', function () {
      webviews.callAsync(tabs.getSelected(), 'navigationHistory.goForward')
    })

    navigationButtons.container.addEventListener('mouseenter', function () {
      /*
      Prevent scrollbars from showing up when hovering the navigation buttons, if one isn't already shown
      This also works around a chromium bug where a flickering scrollbar is shown during the expanding animation:
      https://github.com/minbrowser/min/pull/1665#issuecomment-868551126
      */
      if (navigationButtons.tabsList.scrollWidth <= navigationButtons.tabsList.clientWidth) {
        navigationButtons.tabsList.classList.add('disable-scroll')
      }
    })

    navigationButtons.container.addEventListener('mouseleave', function () {
      navigationButtons.tabsList.classList.remove('disable-scroll')
    })

    tasks.on('tab-selected', this.update)
    webviews.bindEvent('did-navigate', this.update)
    webviews.bindEvent('did-navigate-in-page', this.update)
  }
}

module.exports = navigationButtons
