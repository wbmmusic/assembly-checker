const { app, autoUpdater, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
require('update-electron-app')()

const server = 'https://github.com/wbmmusic/assembly-checker.git'
const theUrl = `${server}/update/${process.platform}/${app.getVersion()}`

autoUpdater.setFeedURL({ url: theUrl })

////////////////// App Startup ///////////////////////////////////////////////////////////////////
let win
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

// Create myWindow, load the rest of the app, etc...
app.on('ready', () => {
  //log("-APP IS READY");
  ipcMain.on('reactIsReady', () => {

    console.log('React Is Ready')

    if (app.isPackaged) {
      autoUpdater.checkForUpdates()
      autoUpdater.on('checking-for-update', () => win.webContents.send('message', 'Checking for update'))
      autoUpdater.on('update-available', () => win.webContents.send('message', 'Update Available'))
      autoUpdater.on('update-not-available', () => win.webContents.send('message', 'Update NOT Available'))
      autoUpdater.on('update-downloaded', () => win.webContents.send('message', 'Update Downloaded'))
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