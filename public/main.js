const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const { execFileSync, execFile } = require('child_process');
const wbmUsbDevice = require('wbm-usb-device')
const tests = require('./tests')

const { autoUpdater } = require('electron-updater');

////////////////// App Startup ///////////////////////////////////////////////////////////////////
let win

let listenersApplied = false

let upStuff = [__dirname]
if (app.isPackaged) {
  upStuff = [process.resourcesPath, "public"]
}

let workingDirectory = path.join(...upStuff)
let pathToJLink = path.join(workingDirectory, "JLink.exe")
let pathToFiles = path.join('C:', 'ProgramData', 'WBM Tek', 'pcbChecker')
let pathToFile = path.join(pathToFiles, 'cmd.jlink')


if (!fs.existsSync(path.join('C:', 'ProgramData', 'WBM Tek'))) {
  console.log('Creating WBM Tek folder')
  fs.mkdirSync(path.join('C:', 'ProgramData', 'WBM Tek'))
}

if (!fs.existsSync(pathToFiles)) {
  console.log('Creating pcbChecker folder')
  fs.mkdirSync(pathToFiles)
}

////////  SINGLE INSTANCE //////////
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
}

app.on('second-instance', (event, commandLine, workingDirectory) => {
  // Someone tried to run a second instance, we should focus our window.
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})
//////  END SINGLE INSTANCE ////////

function createWindow() {
  // Create the browser window.
  win = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, '/favicon.ico')
  })

  const startUrl = process.env.ELECTRON_START_URL || url.format({
    pathname: path.join(__dirname, '/../build/index.html'),
    protocol: 'file:',
    slashes: true
  });
  win.loadURL(startUrl);
  //win.maximize()

  // Emitted when the window is closed.
  win.on('closed', () => {
    win = null
  })
}

const createListeners = () => {

  const loadFirmware = (fileName) => {
    win.webContents.send('programming')
    console.log(__dirname)
    win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

    const args = [
      '-device ATSAMD21G18',
      '-if SWD',
      '-speed 4000',
      '-autoconnect 1',
      '-CommanderScript "' + path.join(pathToFiles, 'cmd.jlink') + '"',
      '-ExitOnError 1'
    ]

    win.webContents.send('message', pathToFile)
    let pathToFirmware = path.join(...upStuff, "firmware", fileName)
    let pathToBoot = path.join(...upStuff, "firmware", 'boot.bin')
    let pathToOutput = path.join(pathToFiles, 'output.bin')
    win.webContents.send('message', workingDirectory)

    console.log('pathToFirm', pathToFirmware)

    const boot = new Buffer.alloc(0x2000, fs.readFileSync(pathToBoot))
    const firm = new Buffer.from(fs.readFileSync(pathToFirmware))

    return new Promise((resolve, reject) => {
      fs.writeFileSync(pathToOutput, Buffer.concat([boot, firm]))
      fs.writeFileSync(pathToFile, 'loadFile "' + pathToOutput + '"\r\nrnh\r\nexit', 'utf8')

      let child = execFile(pathToJLink, [...args], { shell: true, cwd: workingDirectory })

      child.stdout.on('data', (data) => win.webContents.send('jLinkProgress', data))

      child.on('close', (code) => {
        console.log('PROGRAMMING DONE!')
        win.webContents.send('programmingComplete')
        resolve()
      })

      child.on('error', (error) => reject(error.message))
    })
  }

  const waitForDevice = (device) => {

    let waitFor = ''

    switch (device) {
      case 'cvboard':
        waitFor = 'CV Board'
        break;

      default:
        break;
    }

    return new Promise((resolve, reject) => {
      const exit = (passFail) => {
        clearTimeout(waitForDeviceTimer)
        if (passFail === 'fail') reject()
        else resolve(passFail)
      }

      let waitForDeviceTimer = setTimeout(() => {
        exit('fail')
      }, 3000);

      wbmUsbDevice.on('devList', (list) => {
        let devIdx = list.findIndex(dev => dev.Model === waitFor)

        if (devIdx >= 0) exit(list[devIdx].path)
      })

    })
  }

  const chipErase = () => {
    win.webContents.send('chipErasing')
    console.log(__dirname)
    win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

    const args = [
      '-device ATSAMD21G18',
      '-if SWD',
      '-speed 4000',
      '-autoconnect 1',
      '-CommanderScript "' + path.join(pathToFiles, 'cmd.jlink') + '"',
      '-ExitOnError 1'
    ]

    win.webContents.send('message', pathToFile)
    win.webContents.send('message', workingDirectory)

    fs.writeFileSync(pathToFile, "erase\r\nrnh\r\nexit", 'utf8')

    let child = execFile(pathToJLink, [...args], { shell: true, cwd: workingDirectory })

    child.stdout.on('data', (data) => win.webContents.send('jLinkProgress', data))

    child.on('close', (code) => {
      console.log('CHIP ERASE DONE!')
      win.webContents.send('chipEraseComplete')
    })

    //fs.unlinkSync(pathToFile)

  }

  ipcMain.on('installUpdate', () => {
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.on('loadFirmware', (e, firmware) => {
    console.log("Load", firmware)
    loadFirmware(firmware)
  })

  ipcMain.on('chipErase', () => {
    console.log("Backend Chip Erase")
    chipErase()
  })

  ipcMain.on('programAndTest', async (e, folder) => {
    console.log('Program and test', folder)

    // Load BootLoader and Testing Firmware
    const program = await loadFirmware('cvSlowBlink_x2000.bin')
    console.log('Programming Complete.  Waiting for device to connect')

    // Wait for programmed device to be detected
    const deviceIsOnPort = await waitForDevice(folder)
    console.log('The Device was found at', deviceIsOnPort)

    // Run Tests on device
    let testResult = await tests.runTests(folder, deviceIsOnPort)
    console.log(testResult)

    // Load Release Firmware
    console.log('Load Release Firmware')
    let pathToTheFirmware = path.join(...upStuff, 'boardfiles', folder, 'release.bin')
    wbmUsbDevice.uploadFirmware({ comPort: deviceIsOnPort, firm: pathToTheFirmware })
  })

  win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

  /////// CHECK FOR DRIVER
  const drvChk = path.join('C:', 'Windows', 'System32', 'DriverStore', 'FileRepository', 'jlink.inf_amd64_7c645d531403fb66', 'jlink.inf')
  try {
    if (fs.existsSync(drvChk)) {
      console.log('File Exists')
      win.webContents.send('message', 'File Exists')
    } else {
      const driver = execFileSync(path.join(...upStuff, "USBDriver", "InstDrivers.exe"), [], { shell: true }).toString()
      console.log(driver)
      win.webContents.send('message', driver.toString())
    }
  } catch (err) {
    console.error(err)
    win.webContents.send('message', err.toString())
    console.log("In Error")
  }
}


// Create myWindow, load the rest of the app, etc...
app.on('ready', () => {

  //log("-APP IS READY");
  ipcMain.on('reactIsReady', () => {

    if (listenersApplied === false) {
      listenersApplied = true
      createListeners()


      wbmUsbDevice.startMonitoring()

      wbmUsbDevice.on('devList', (list) => {
        console.log('------>>>>> GOT DEV LIST', list)
      })

      wbmUsbDevice.on('progress', (list) => {
        console.log('progress', list)
      })

    }

    console.log('React Is Ready')
    win.webContents.send('message', 'React Is Ready')
    win.webContents.send('message', app.getAppPath())
    win.webContents.send('app_version', { version: app.getVersion() });

    if (app.isPackaged) {
      win.webContents.send('message', 'App is packaged')

      autoUpdater.on('checking-for-update', () => win.webContents.send('checkingForUpdates'))
      autoUpdater.on('update-available', () => win.webContents.send('updateAvailable'))
      autoUpdater.on('update-not-available', () => win.webContents.send('noUpdate'))
      autoUpdater.on('update-downloaded', (e, updateInfo, f, g) => { win.webContents.send('updateDownloaded', e) })
      autoUpdater.on('download-progress', (e) => { win.webContents.send('updateDownloadProgress', e.percent) })
      autoUpdater.on('error', (message) => win.webContents.send('updateError', message))


      setInterval(() => {
        win.webContents.send('message', 'Interval Check for update')
        autoUpdater.checkForUpdatesAndNotify()
      }, 600000);

      autoUpdater.checkForUpdatesAndNotify()
    }

  })

  createWindow()

})
///////////////////////

// Quit when all windows are closed.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (win === null) {
    createWindow()
  }
})

////////////////// END App Startup ///////////////////////////////////////////////////////////////