const fs = require('fs')
const archiver = require('archiver')
const builder = require('electron-builder')
const Arch = builder.Arch

const packageFile = require('./../package.json')
const version = packageFile.version

const createPackage = require('./createPackage.js')

async function afterPackageBuilt (packagePath) {
  /* create output directory if it doesn't exist */
  if (!fs.existsSync('dist/app')) {
    fs.mkdirSync('dist/app')
  }

  let archSuffix

  if (packagePath.includes('ia32')) {
    archSuffix = '-ia32'
  } else if (packagePath.includes('arm64')) {
    archSuffix = '-arm64'
  } else {
    archSuffix = ''
  }

  /* create zip files */
  var output = fs.createWriteStream('dist/app/' + 'Min-v' + version + '-windows' + archSuffix + '.zip')
  var archive = archiver('zip', {
    zlib: { level: 9 }
  })
  archive.directory(packagePath, 'Min-v' + version)
  archive.pipe(output)
  await archive.finalize()

  /* create installer */
  const installer = require('electron-installer-windows')

  const options = {
    src: packagePath,
    dest: 'dist/app/min-installer' + archSuffix,
    icon: 'icons/icon256.ico',
    animation: 'icons/windows-installer.gif',
    licenseUrl: 'https://github.com/minbrowser/min/blob/master/LICENSE.txt',
    noMsi: true
  }

  console.log('Creating package (this may take a while)')

  fs.copyFileSync('LICENSE.txt', packagePath + '/LICENSE')

  await installer(options)
    .then(function () {
      fs.renameSync('./dist/app/min-installer' + archSuffix + '/min-' + version + '-setup.exe', './dist/app/min-' + version + archSuffix + '-setup.exe')
    })
    .catch(err => {
      console.error(err, err.stack)
      process.exit(1)
    })
}

async function buildWindows () {
  const electronVersion = require('electron/package.json').version
  const architectures = [Arch.x64]

  // Electron 44 stopped publishing Windows 32-bit binaries.
  if (Number(electronVersion.split('.')[0]) < 44) {
    architectures.push(Arch.ia32)
  } else {
    console.log(`Skipping Windows ia32: Electron ${electronVersion} only supports x64 and arm64.`)
  }
  architectures.push(Arch.arm64)

  // Creating multiple packages simultaneously causes errors in electron-rebuild.
  for (const arch of architectures) {
    const packagePath = await createPackage('win32', { arch })
    await afterPackageBuilt(packagePath)
  }
}

buildWindows().catch(err => {
  console.error('Windows build failed:', err)
  if (err.response && err.response.url) {
    console.error('Failed download URL:', err.response.url)
  }
  process.exitCode = 1
})
