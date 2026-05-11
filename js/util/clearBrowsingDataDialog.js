const { ipcRenderer } = require('electron')

function showClearBrowsingDataDialog () {
  const result = ipcRenderer.sendSync('prompt', {
    text: l('settingsBrowsingDataDescription'),
    values: [
      { label: l('settingsBrowsingDataHistory'), id: 'history', type: 'checkbox', checked: true },
      { label: l('settingsBrowsingDataCookies'), id: 'cookies', type: 'checkbox', checked: true },
      { label: l('settingsBrowsingDataSiteData'), id: 'siteData', type: 'checkbox', checked: true },
      { label: l('settingsBrowsingDataCache'), id: 'cache', type: 'checkbox', checked: true }
    ],
    ok: l('settingsBrowsingDataClearButton'),
    cancel: l('dialogSkipButton'),
    width: 460,
    height: 270
  })

  if (!result) {
    return null
  }

  if (!Object.keys(result).some(function (key) {
    return result[key]
  })) {
    return null
  }

  return result
}

module.exports = showClearBrowsingDataDialog
