const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const fs = require('fs')
const { execFileSync } = require('child_process');


const { autoUpdater } = require('electron-updater');

////////////////// App Startup ///////////////////////////////////////////////////////////////////
let win

let listenersApplied = false

let upStuff = [__dirname]
if (app.isPackaged) {
  upStuff = [process.resourcesPath, "public"]
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

    console.log(__dirname)
    win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

    const args = [
      '-device ATSAMD21G18',
      '-if SWD',
      '-speed 4000',
      '-autoconnect 1',
      '-CommanderScript ' + path.join(...upStuff, 'temp', 'cmd.jlink'),
      '-ExitOnError 1',
      '-NoGui 1'
    ]

    let pathToFile = path.join(...upStuff, 'temp', 'cmd.jlink')
    win.webContents.send('message', pathToFile)
    let pathToFirmware = path.join(...upStuff, "firmware", fileName)
    let pathToJlink = path.join(...upStuff, "JLink.exe")
    let workingDirectory = path.join(...upStuff)
    win.webContents.send('message', workingDirectory)
    fs.writeFileSync(pathToFile, "loadFile " + pathToFirmware + "\r\nrnh\r\nexit", 'utf8')

    let fun = execFileSync(pathToJlink, [...args], { shell: true, cwd: workingDirectory }).toString()
    win.webContents.send('message', fun)
    //fs.unlinkSync(pathToFile)
    console.log('DONE!')
  }

  ipcMain.on('installUpdate', () => {
    autoUpdater.quitAndInstall(true, true)
  })

  ipcMain.on('loadFirmware', (e, firmware) => {
    console.log("Load", firmware)
    loadFirmware(firmware)
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
      autoUpdater.on('update-downloaded', (e, updateInfo, f, g) => {
        win.webContents.send('updateDownloaded', updateInfo)
        win.webContents.send('message', updateInfo)
      })
      autoUpdater.on('download-progress', (e) => {
        win.webContents.send('message', 'Download Progress')
        win.webContents.send('message', e.percent)
      })

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