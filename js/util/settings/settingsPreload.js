window.addEventListener('message', function (e) {
  if (!e.origin.startsWith('min://')) {
    return
  }

  if (e.data && e.data.message && e.data.message === 'getSettingsData') {
    ipc.send('getSettingsData')
  }

  if (e.data && e.data.message && e.data.message === 'setSetting') {
    ipc.send('setSetting', { key: e.data.key, value: e.data.value })
  }

  if (e.data && e.data.message && e.data.message === 'clearBrowsingData') {
    ipc.invoke('clearAllHistoryData', e.data.options).then(function () {
      window.postMessage({ message: 'clearBrowsingDataComplete' }, window.location.toString())
    }).catch(function (err) {
      window.postMessage({ message: 'clearBrowsingDataError', error: err.message }, window.location.toString())
    })
  }
})

ipc.on('receiveSettingsData', function (e, data) {
  if (window.location.toString().startsWith('min://')) { // probably redundant, but might as well check
    window.postMessage({ message: 'receiveSettingsData', settings: data }, window.location.toString())
  }
})
