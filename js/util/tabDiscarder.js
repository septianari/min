const webviews = require('webviews.js')
const settings = require('util/settings/settings.js')

const tabDiscarder = {
  discardTimeout: 20 * 60 * 1000, // 20 minutes default
  minTabCount: 3, // Don't discard if there are few tabs
  checkInterval: 60 * 1000, // Check every minute

  initialize: function () {
    setInterval(() => {
      if (settings.get('enableTabDiscarding') !== false) {
        tabDiscarder.checkAndDiscard()
      }
    }, tabDiscarder.checkInterval)
  },

  checkAndDiscard: function () {
    const timeout = settings.get('tabDiscardTimeout') || tabDiscarder.discardTimeout
    const now = Date.now()
    const allTasks = tasks.get()

    allTasks.forEach(task => {
      const tabList = task.tabs
      const selectedTabId = tabList.getSelected()

      // Only consider discarding if we have enough tabs
      if (tabList.count() <= tabDiscarder.minTabCount) {
        return
      }

      tabList.forEach(tab => {
        // Don't discard the selected tab, tabs with audio, or tabs that already don't have webContents
        if (tab.id === selectedTabId || tab.hasAudio || !tab.hasWebContents || !tab.url) {
          return
        }

        // Don't discard internal pages as they are usually light and might have state we don't save
        if (tab.url.startsWith('min://')) {
          return
        }

        if (now - tab.lastActivity > timeout) {
          console.log('Discarding tab', tab.id, tab.url)
          webviews.destroy(tab.id)
        }
      })
    })
  }
}

module.exports = tabDiscarder
