/*
Wraps APIs that are only available in the main process in IPC messages, so that the BrowserWindow can use them
*/

ipc.handle('startFileDrag', function (e, path) {
  app.getFileIcon(path, {}).then(function (icon) {
    e.sender.startDrag({
      file: path,
      icon: icon
    })
  })
})

function showFocusModeDialog1() {
  dialog.showMessageBox({
    type: 'info',
    buttons: [l('closeDialog')],
    message: l('isFocusMode'),
    detail: l('focusModeExplanation1') + ' ' + l('focusModeExplanation2')
  })
}

function showFocusModeDialog2() {
  dialog.showMessageBox({
    type: 'info',
    buttons: [l('closeDialog')],
    message: l('isFocusMode'),
    detail: l('focusModeExplanation2')
  })
}

ipc.handle('showFocusModeDialog2', showFocusModeDialog2)

ipc.handle('showOpenDialog', async function (e, options) {
  const result = await dialog.showOpenDialog(windows.windowFromContents(e.sender).win, options)
  return result.filePaths
})

ipc.handle('showSaveDialog', async function (e, options) {
  const result = await dialog.showSaveDialog(windows.windowFromContents(e.sender).win, options)
  return result.filePath
})

ipc.handle('addWordToSpellCheckerDictionary', function (e, word) {
  session.fromPartition('persist:webcontent').addWordToSpellCheckerDictionary(word)
})

const defaultClearBrowsingDataOptions = {
  history: true,
  cookies: true,
  siteData: true,
  cache: true
}

function normalizeClearBrowsingDataOptions (options) {
  if (!options) {
    return defaultClearBrowsingDataOptions
  }

  return {
    history: options.history !== false,
    cookies: options.cookies !== false,
    siteData: options.siteData !== false,
    cache: options.cache !== false
  }
}

function getStorageTypesToClear (options, isDefaultSession) {
  const storages = []

  if (options.cookies) {
    storages.push('cookies')
  }

  if (options.siteData) {
    storages.push('filesystem', 'localstorage', 'websql', 'serviceworkers', 'cachestorage')

    if (!isDefaultSession) {
      storages.push('indexdb')
    }
  }

  if (options.cache) {
    storages.push('shadercache')
  }

  return storages
}

function clearStorageData (options) {
  options = normalizeClearBrowsingDataOptions(options)

  const webContentStorages = getStorageTypesToClear(options, false)
  const defaultSessionStorages = getStorageTypesToClear(options, true)

  let clearPromise = Promise.resolve()

  if (webContentStorages.length > 0) {
    clearPromise = clearPromise.then(function () {
      return session.fromPartition('persist:webcontent').clearStorageData({ storages: webContentStorages })
    })
  }

  return clearPromise
  /* It's important not to delete data from file:// from the default partition, since that would also remove internal browser data (such as bookmarks). However, HTTP data does need to be cleared, as there can be leftover data from loading external resources in the browser UI */
    .then(function () {
      if (defaultSessionStorages.length === 0) {
        return null
      }

      return session.defaultSession.clearStorageData({ origin: 'http://', storages: defaultSessionStorages })
    })
    .then(function () {
      if (defaultSessionStorages.length === 0) {
        return null
      }

      return session.defaultSession.clearStorageData({ origin: 'https://', storages: defaultSessionStorages })
    })
    .then(function () {
      if (!options.cache) {
        return null
      }

      return session.fromPartition('persist:webcontent').clearCache()
    })
    .then(function () {
      if (!options.cache) {
        return null
      }

      return session.fromPartition('persist:webcontent').clearHostResolverCache()
    })
    .then(function () {
      if (!options.cache) {
        return null
      }

      return session.fromPartition('persist:webcontent').clearAuthCache()
    })
    .then(function () {
      if (!options.cache) {
        return null
      }

      return session.defaultSession.clearCache()
    })
    .then(function () {
      if (!options.cache) {
        return null
      }

      return session.defaultSession.clearHostResolverCache()
    })
    .then(function () {
      if (!options.cache) {
        return null
      }

      return session.defaultSession.clearAuthCache()
    })
}

function whenPlacesWindowReady () {
  if (!placesWindow || placesWindow.isDestroyed()) {
    return Promise.resolve()
  }

  if (placesWindow.webContents.isLoadingMainFrame()) {
    return new Promise(function (resolve) {
      placesWindow.webContents.once('did-finish-load', resolve)
    })
  }

  return Promise.resolve()
}

async function clearAllHistoryData (options) {
  options = normalizeClearBrowsingDataOptions(options)

  await whenPlacesWindowReady()

  if (options.history && placesWindow && !placesWindow.isDestroyed()) {
    await placesWindow.webContents.executeJavaScript('window.clearAllHistoryData()', true)
  }

  if (options.cookies || options.siteData || options.cache) {
    await clearStorageData(options)
  }
}

ipc.handle('clearStorageData', function (e, options) {
  return clearStorageData(options)
})

ipc.handle('clearAllHistoryData', function (e, options) {
  return clearAllHistoryData(options)
})

/* window actions */

ipc.handle('minimize', function (e) {
  windows.windowFromContents(e.sender).win.minimize()
  // workaround for https://github.com/minbrowser/min/issues/1662
  e.sender.send('minimize')
})

ipc.handle('maximize', function (e) {
  windows.windowFromContents(e.sender).win.maximize()
  // workaround for https://github.com/minbrowser/min/issues/1662
  e.sender.send('maximize')
})

ipc.handle('unmaximize', function (e) {
  windows.windowFromContents(e.sender).win.unmaximize()
  // workaround for https://github.com/minbrowser/min/issues/1662
  e.sender.send('unmaximize')
})

ipc.handle('close', function (e) {
  windows.windowFromContents(e.sender).win.close()
})

ipc.handle('setFullScreen', function (e, fullScreen) {
  windows.windowFromContents(e.sender).win.setFullScreen(e, fullScreen)
})

//workaround for https://github.com/electron/electron/issues/38540
ipc.handle('showItemInFolder', function (e, path) {
  shell.showItemInFolder(path)
})

ipc.on('newWindow', function (e, customArgs) {
  createWindow(customArgs)
})
