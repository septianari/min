/* global db performance searchPlaces fullTextPlacesSearch */

const { ipcRenderer } = require('electron')

const spacesRegex = /[+\s._/-]+/g // things that could be considered spaces

function calculateHistoryScore (item) { // item.boost - how much the score should be multiplied by. Example - 0.05
  let fs = item.lastVisit * (1 + 0.036 * Math.sqrt(item.visitCount))

  // bonus for short url's
  if (item.url.length < 20) {
    fs += (30 - item.url.length) * 2500
  }

  if (item.boost) {
    fs += fs * item.boost
  }

  return fs
}

const oneDayInMS = 24 * 60 * 60 * 1000 // one day in milliseconds

// the oldest an item can be to remain in the database
const maxItemAge = oneDayInMS * 42

function cleanupHistoryDatabase () { // removes old history entries
  db.places.where('lastVisit').below(Date.now() - maxItemAge).and(function (item) {
    return item.isBookmarked === false
  }).delete()
}

setTimeout(cleanupHistoryDatabase, 20000) // don't run immediately on startup, since is might slow down searchbar search.
setInterval(cleanupHistoryDatabase, 60 * 60 * 1000)

// cache history in memory for faster searching. This actually takes up very little space, so we can cache everything.

let historyInMemoryCache = []
let historyMap = new Map()
let doneLoadingHistoryCache = false
let historyLoadedPromise = null

function addToHistoryCache (item) {
  if (item.isBookmarked) {
    tagIndex.addPage(item)
  }
  delete item.pageHTML
  delete item.searchIndex

  item.searchTextCache = getSearchTextCache(item)

  historyInMemoryCache.push(item)
  historyMap.set(item.url, item)
}

function addOrUpdateHistoryCache (item) {
  delete item.pageHTML
  delete item.searchIndex

  item.searchTextCache = getSearchTextCache(item)

  let oldItem = historyMap.get(item.url)

  if (oldItem) {
    const index = historyInMemoryCache.indexOf(oldItem)
    historyInMemoryCache[index] = item
  } else {
    historyInMemoryCache.push(item)
  }
  historyMap.set(item.url, item)

  if (oldItem) {
    tagIndex.onChange(oldItem, item)
  }
}

function removeFromHistoryCache (url) {
  const item = historyMap.get(url)
  if (item) {
    tagIndex.removePage(item)
    const index = historyInMemoryCache.indexOf(item)
    if (index > -1) {
      historyInMemoryCache.splice(index, 1)
    }
    historyMap.delete(url)
  }
}

function loadHistoryInMemory () {
  historyInMemoryCache = []
  historyMap = new Map()
  doneLoadingHistoryCache = false

  historyLoadedPromise = db.places.orderBy('visitCount').reverse().each(function (item) {
    addToHistoryCache(item)
  }).then(function () {
    // if we have enough matches during the search, we exit. In order for this to work, frequently visited sites have to come first in the cache.
    historyInMemoryCache.sort(function (a, b) {
      return calculateHistoryScore(a) - calculateHistoryScore(b)
    })

    doneLoadingHistoryCache = true
  })
}

loadHistoryInMemory()

async function clearAllHistoryData () {
  await db.places.filter(function (item) {
    return item.isBookmarked === false
  }).delete()

  await loadHistoryInMemory()
}

window.clearAllHistoryData = clearAllHistoryData

function handleRequest (data, cb) {
  const action = data.action
  const pageData = data.pageData
  const flags = data.flags || {}
  const searchText = data.text && data.text.toLowerCase()
  const callbackId = data.callbackId
  const options = data.options

  if (action === 'getPlace') {
    historyLoadedPromise.then(function () {
      const item = historyMap.get(pageData.url)
      cb({
        result: item || null,
        callbackId: callbackId
      })
    })
  }

  if (action === 'getAllPlaces') {
    historyLoadedPromise.then(function () {
      cb({
        result: historyInMemoryCache,
        callbackId: callbackId
      })
    })
  }

  if (action === 'updatePlace') {
    db.transaction('rw', db.places, function () {
      db.places.where('url').equals(pageData.url).first(function (item) {
        var isNewItem = false
        if (!item) {
          isNewItem = true
          item = {
            url: pageData.url,
            title: pageData.url,
            color: null,
            visitCount: 0,
            lastVisit: Date.now(),
            pageHTML: '',
            extractedText: pageData.extractedText,
            searchIndex: [],
            isBookmarked: false,
            tags: [],
            metadata: {}
          }
        }
        for (const key in pageData) {
          if (key === 'extractedText') {
            item.searchIndex = tokenize(pageData.extractedText)
            item.extractedText = pageData.extractedText
          } else if (key === 'tags') {
          // ensure tags are never saved with spaces in them
            item.tags = pageData.tags.map(t => t.replace(/\s/g, '-'))
          } else {
            item[key] = pageData[key]
          }
        }

        if (flags.isNewVisit) {
          item.visitCount++
          item.lastVisit = Date.now()
        }

        db.places.put(item)
        if (isNewItem) {
          addToHistoryCache(item)
        } else {
          addOrUpdateHistoryCache(item)
        }
        cb({
          result: null,
          callbackId: callbackId
        })
      }).catch(function (err) {
        console.warn('failed to update history.')
        console.warn('page url was: ' + pageData.url)
        console.error(err)
        cb({
          result: null,
          callbackId: callbackId
        })
      })
    })
  }

  if (action === 'deleteHistory') {
    db.places.where('url').equals(pageData.url).delete()

    removeFromHistoryCache(pageData.url)
  }

  if (action === 'deleteAllHistory') {
    clearAllHistoryData()
  }

  if (action === 'getSuggestedTags') {
    historyLoadedPromise.then(function () {
      const item = historyMap.get(pageData.url)
      if (!item) {
        return cb({
          result: [],
          callbackId: callbackId
        })
      }
      cb({
        result: tagIndex.getSuggestedTags(item),
        callbackId: callbackId
      })
    })
  }

  if (action === 'getAllTagsRanked') {
    historyLoadedPromise.then(function () {
      const item = historyMap.get(pageData.url)
      if (!item) {
        return cb({
          result: [],
          callbackId: callbackId
        })
      }
      cb({
        result: tagIndex.getAllTagsRanked(item),
        callbackId: callbackId
      })
    })
  }

  if (action === 'getSuggestedItemsForTags') {
    cb({
      result: tagIndex.getSuggestedItemsForTags(pageData.tags),
      callbackId: callbackId
    })
  }

  if (action === 'autocompleteTags') {
    cb({
      result: tagIndex.autocompleteTags(pageData.tags),
      callbackId: callbackId
    })
  }

  if (action === 'searchPlaces') { // do a history search
    historyLoadedPromise.then(function () {
      searchPlaces(searchText, function (matches) {
        cb({
          result: matches,
          callbackId: callbackId
        })
      }, options)
    })
  }

  if (action === 'searchPlacesFullText') {
    historyLoadedPromise.then(function () {
      fullTextPlacesSearch(searchText, function (matches) {
        matches.sort(function (a, b) {
          return calculateHistoryScore(b) - calculateHistoryScore(a)
        })

        cb({
          result: matches.slice(0, 100),
          callbackId: callbackId
        })
      })
    })
  }

  if (action === 'getPlaceSuggestions') {
    historyLoadedPromise.then(function () {
      const cTime = Date.now()

      let results = historyInMemoryCache.slice().filter(i => cTime - i.lastVisit < 604800000)

      for (let i = 0; i < results.length; i++) {
        results[i].hScore = calculateHistoryScore(results[i])
      }

      results = results.sort(function (a, b) {
        return b.hScore - a.hScore
      })

      cb({
        result: results.slice(0, 100),
        callbackId: callbackId
      })
    })
  }
}

ipcRenderer.on('places-connect', function (e) {
  e.ports[0].addEventListener('message', function (e2) {
    const data = e2.data

    try {
      handleRequest(data, function (res) {
        e.ports[0].postMessage(res)
      })
    } catch (e) {
      console.warn(e)
      e.ports[0].postMessage({
        result: null,
        callbackId: data.callbackId
      })
    }
  })
  e.ports[0].start()
})

ipcRenderer.send('places-setup-ready')
