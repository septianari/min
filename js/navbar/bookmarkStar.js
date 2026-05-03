const places = require('places/places.js')
const bookmarkEditor = require('searchbar/bookmarkEditor.js')
const searchbar = require('searchbar/searchbar.js')
const searchbarPlugins = require('searchbar/searchbarPlugins.js')
const urlParser = require('util/urlParser.js')

const bookmarkStar = {
  create: function () {
    const star = document.createElement('button')
    star.className = 'tab-editor-button bookmarks-button i carbon:star'
    star.setAttribute('aria-pressed', false)
    star.setAttribute('title', l('addBookmark'))
    star.setAttribute('aria-label', l('addBookmark'))

    star.addEventListener('click', function (e) {
      bookmarkStar.onClick(star)
    })

    return star
  },
  onClick: function (star) {
    var tabId = star.getAttribute('data-tab')
    const currentTab = tabs.get(tabId)

    if (!currentTab) {
      return
    }

    const currentURL = urlParser.removeTextFragment(urlParser.getSourceURL(currentTab.url))

    searchbarPlugins.clearAll()

    places.updateItem(currentURL, {
      isBookmarked: true,
      title: currentTab.title // if this page is open in a private tab, the title may not be saved already, so it needs to be included here
    })
    .then(function () {
      star.classList.remove('carbon:star')
      star.classList.add('carbon:star-filled')
      star.setAttribute('aria-pressed', true)

      var editorInsertionPoint = document.createElement('div')
      searchbarPlugins.getContainer('simpleBookmarkTagInput').appendChild(editorInsertionPoint)
      bookmarkEditor.show(currentURL, editorInsertionPoint, function (newBookmark) {
        if (!newBookmark) {
          // bookmark was deleted
          star.classList.add('carbon:star')
          star.classList.remove('carbon:star-filled')
          star.setAttribute('aria-pressed', false)
          searchbar.showResults('')
          searchbar.associatedInput.focus()
        }
      }, { simplified: true, autoFocus: true })
    })
    .catch(function (err) {
      console.error(err)
    })
  },
  update: function (tabId, star) {
    star.setAttribute('data-tab', tabId)
    const tab = tabs.get(tabId)
    const currentURL = tab ? urlParser.removeTextFragment(urlParser.getSourceURL(tab.url)) : null

    if (!currentURL) { // no url, can't be bookmarked
      star.hidden = true
    } else {
      star.hidden = false
    }

    // check if the page is bookmarked or not, and update the star to match

    if (currentURL) {
      places.getItem(currentURL).then(function (item) {
        if (item && item.isBookmarked) {
          star.classList.remove('carbon:star')
          star.classList.add('carbon:star-filled')
          star.setAttribute('aria-pressed', true)
        } else {
          star.classList.add('carbon:star')
          star.classList.remove('carbon:star-filled')
          star.setAttribute('aria-pressed', false)
        }
      })
    }
  }
}

searchbarPlugins.register('simpleBookmarkTagInput', {
  index: 0
})

module.exports = bookmarkStar
