const currrentDownloadItems = {}

ipc.on('cancelDownload', function (e, path) {
  if (currrentDownloadItems[path]) {
    currrentDownloadItems[path].cancel()
  }
})

function isAttachment (header) {
  return /^\s*attache*?ment/i.test(header)
}

function getHeaderValues (headers, headerName) {
  const key = Object.keys(headers).find(k => k.toLowerCase() === headerName.toLowerCase())
  return key ? headers[key] : undefined
}

function getHeaderString (headerValue) {
  if (Array.isArray(headerValue)) {
    return headerValue.join('; ')
  }
  return headerValue || ''
}

function getLikelyAttachmentExtension (url, contentDispositionHeader) {
  function getFileExtension (value) {
    const idx = value.lastIndexOf('.')
    if (idx < 0) {
      return ''
    }
    return value.slice(idx).toLowerCase()
  }

  const disposition = getHeaderString(contentDispositionHeader).toLowerCase()

  const filenameMatch = disposition.match(/filename\*?=(?:utf-8''|")?([^\";]+)/i)
  if (filenameMatch && filenameMatch[1]) {
    const filename = filenameMatch[1].replace(/"/g, '')
    const cleanFilename = filename.split('?')[0].split('#')[0]
    const filenameExt = getFileExtension(cleanFilename)
    if (filenameExt) {
      return filenameExt
    }
  }

  try {
    const pathname = new URL(url).pathname.toLowerCase()
    const cleanPathname = pathname.split('?')[0].split('#')[0]
    return getFileExtension(cleanPathname)
  } catch (e) {
    return ''
  }
}

function isLikelyHTMLAttachment (details, typeHeader, contentDispositionHeader) {
  if (!isAttachment(contentDispositionHeader)) {
    return false
  }

  const extension = getLikelyAttachmentExtension(details.url, contentDispositionHeader)
  const htmlExtensions = ['.htm', '.html', '.mht', '.mhtml']

  if (htmlExtensions.includes(extension)) {
    return true
  }

  // Some servers send HTML reports with a generic filename but still mark text/html.
  return Array.isArray(typeHeader) && typeHeader.some(t => t.includes('text/html'))
}

function isLikelyPDFAttachment (details, typeHeader, contentDispositionHeader) {
  if (Array.isArray(typeHeader) && typeHeader.some(t => t.includes('application/pdf'))) {
    return true
  }

  const extension = getLikelyAttachmentExtension(details.url, contentDispositionHeader)
  return extension === '.pdf'
}

function isReportEndpointURL (url) {
  try {
    const parsed = new URL(url)
    return /\/webservice\/report\b/i.test(parsed.pathname)
  } catch (e) {
    return false
  }
}

function isInlineHTMLReportDownload (item) {
  const filename = (item.getFilename() || '').toLowerCase()
  const url = (item.getURL() || '').toLowerCase()
  const mimeType = (item.getMimeType ? item.getMimeType() : '').toLowerCase()
  const contentDisposition = (item.getContentDisposition ? item.getContentDisposition() : '').toLowerCase()

  const hasHTMLExtension = /\.(html?|mhtml?)$/.test(filename)
  const hasHTMLMimeType = mimeType.includes('text/html') || mimeType.includes('application/xhtml+xml') || mimeType.includes('multipart/related')
  const attachmentWithHTML = contentDisposition.includes('attachment') && (hasHTMLExtension || hasHTMLMimeType || contentDisposition.includes('.htm'))

  if (isReportEndpointURL(url)) {
    // Report endpoints should stay on HTTP origin; avoid file:// fallback.
    return false
  }

  return attachmentWithHTML
}

function sanitizeFilenameForWindows (filename) {
  return filename.replace(/[<>:"/\\|?*\u0000-\u001F]/g, '_')
}

function downloadHandler (event, item, webContents) {
  let sourceWindow = windows.windowFromContents(webContents)?.win
  if (!sourceWindow) {
    sourceWindow = windows.getCurrent()
  }

  if (isInlineHTMLReportDownload(item)) {
    const inlineReportDirectory = path.join(app.getPath('temp'), 'min-inline-report')

    try {
      fs.mkdirSync(inlineReportDirectory, { recursive: true })
    } catch (e) {}

    let targetFilename = item.getFilename() || 'report.htm'
    if (!/\.(html?|mhtml?)$/i.test(targetFilename)) {
      targetFilename = targetFilename + '.htm'
    }

    targetFilename = sanitizeFilenameForWindows(targetFilename)

    const savePath = path.join(inlineReportDirectory, Date.now() + '-' + Math.round(Math.random() * 100000) + '-' + targetFilename)

    item.setSavePath(savePath)

    item.once('done', function (e, state) {
      if (state !== 'completed') {
        return
      }

      const fileURL = 'file://' + savePath.replace(/\\/g, '/')

      if (webContents && !webContents.isDestroyed()) {
        webContents.loadURL(fileURL).catch(function (err) {
          console.warn('unable to open inline report', err)
          sendIPCToWindow(sourceWindow, 'addTab', { url: fileURL })
        })
      } else {
        sendIPCToWindow(sourceWindow, 'addTab', { url: fileURL })
      }
    })

    return true
  }

  var savePathFilename

  // send info to download manager
  sendIPCToWindow(sourceWindow, 'download-info', {
    path: item.getSavePath(),
    name: item.getFilename(),
    status: 'progressing',
    size: { received: 0, total: item.getTotalBytes() }
  })

  item.on('updated', function (e, state) {
    if (!savePathFilename) {
      savePathFilename = path.basename(item.getSavePath())
    }

    if (item.getSavePath()) {
      currrentDownloadItems[item.getSavePath()] = item
    }

    sendIPCToWindow(sourceWindow, 'download-info', {
      path: item.getSavePath(),
      name: savePathFilename,
      status: state,
      size: { received: item.getReceivedBytes(), total: item.getTotalBytes() }
    })
  })

  item.once('done', function (e, state) {
    delete currrentDownloadItems[item.getSavePath()]
    sendIPCToWindow(sourceWindow, 'download-info', {
      path: item.getSavePath(),
      name: savePathFilename,
      status: state,
      size: { received: item.getTotalBytes(), total: item.getTotalBytes() }
    })
  })
  return true
}

function listenForDownloadHeaders (ses) {
  ses.webRequest.onHeadersReceived(function (details, callback) {
    if (details.responseHeaders && isReportEndpointURL(details.url)) {
      const typeHeader = getHeaderValues(details.responseHeaders, 'content-type')
      const contentDispositionHeader = getHeaderValues(details.responseHeaders, 'content-disposition')
      const filteredHeaders = Object.fromEntries(
        Object.entries(details.responseHeaders).filter(([key]) => key.toLowerCase() !== 'content-disposition')
      )
      callback({ responseHeaders: filteredHeaders })
      return
    }

    if (details.resourceType === 'mainFrame' && details.responseHeaders) {
      let sourceWindow
      if (details.webContents) {
        sourceWindow = windows.windowFromContents(details.webContents)?.win
      }
      if (!sourceWindow) {
        sourceWindow = windows.getCurrent()
      }

      // workaround for https://github.com/electron/electron/issues/24334
      var typeHeader = getHeaderValues(details.responseHeaders, 'content-type')
      var contentDispositionHeader = getHeaderValues(details.responseHeaders, 'content-disposition')
      var attachment = isAttachment(contentDispositionHeader)

      if (isLikelyHTMLAttachment(details, typeHeader, contentDispositionHeader)) {
        // Some sites force HTML reports to download; allow rendering directly in the tab.
        const filteredHeaders = Object.fromEntries(
          Object.entries(details.responseHeaders).filter(([key]) => key.toLowerCase() !== 'content-disposition')
        )

        callback({ responseHeaders: filteredHeaders })
        return
      }

      const isPDFResponse = typeHeader instanceof Array && typeHeader.filter(t => t.includes('application/pdf')).length > 0
      const isLocalFile = details.url.startsWith('file://')

      // Local PDFs should stay on file:// so Chromium can open them directly in the tab.
      if (isPDFResponse && !attachment && !isLocalFile && !isReportEndpointURL(details.url)) {
      // open in PDF viewer instead
        callback({ cancel: false })
        sendIPCToWindow(sourceWindow, 'openPDF', {
          url: details.url,
          tabId: null
        })
        return
      }

      // whether this is a file being viewed in-browser or a page
      // Needed to save files correctly: https://github.com/minbrowser/min/issues/1717
      // It doesn't make much sense to have this here, but only one onHeadersReceived instance can be created per session
      const isFileView = typeHeader instanceof Array && !typeHeader.some(t => t.includes('text/html'))

      sendIPCToWindow(sourceWindow, 'set-file-view', {
        url: details.url,
        isFileView
      })
    }

    /*
    SECURITY POLICY EXCEPTION:
    reader and PDF internal pages get universal access to web resources
    Note: we can't limit to the URL in the query string, because there could be redirects
    */
    if (details.webContents && (details.webContents.getURL().startsWith('min://app/pages/pdfViewer') || details.webContents.getURL().startsWith('min://app/reader/') || details.webContents.getURL() === 'min://app/index.html')) {
      const filteredHeaders = Object.fromEntries(
        Object.entries(details.responseHeaders).filter(([key, val]) => key.toLowerCase() !== 'access-control-allow-origin' && key.toLowerCase() !== 'access-control-allow-credentials')
      )

      callback({
        responseHeaders: {
          ...filteredHeaders,
          'Access-Control-Allow-Origin': 'min://app',
          'Access-Control-Allow-Credentials': 'true'
        }
      })
      return
    }

    callback({ cancel: false })
  })
}

app.once('ready', function () {
  session.defaultSession.on('will-download', downloadHandler)
  listenForDownloadHeaders(session.defaultSession)
})

app.on('session-created', function (session) {
  session.on('will-download', downloadHandler)
  listenForDownloadHeaders(session)
})
