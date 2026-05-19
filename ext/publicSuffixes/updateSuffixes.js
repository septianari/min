/* downloads public list of suffixes maintained by Mozilla and community */
const https = require('https')
const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '/public_suffix_list.json')
const listURL = 'https://publicsuffix.org/list/public_suffix_list.dat'

var listData = ''

https.get(listURL, function (r) {
  r.on('data', (d) => {
    listData += d
  })

  r.on('end', () => {
    var cleanData = []
    for (var line of listData.split('\n')) {
      if (line.length === 0 || line.startsWith('//') || line.startsWith('!') ||
        line.split('.').length > 2
      ) {
        continue
      }
      if (line.startsWith('*.')) {
        line = line.slice(2)
      }
      try {
        line = new URL('http://' + line).hostname
      } catch (e) {}
      cleanData.push(`.${line}`)
    }

    fs.writeFileSync(filePath,
      JSON.stringify(
        cleanData.sort().sort((a, b) => a.length - b.length), null, 2
      ) + '\n')
  })
})
