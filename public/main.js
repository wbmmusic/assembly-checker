const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, readFileSync } = require('fs')
const { execFileSync, execFile } = require('child_process');
const wbmUsbDevice = require('wbm-usb-device')
const tests = require('./tests')
const wbmVer = require('wbm-version-manager')
wbmVer.setBase('http://versions.wbmtek.com/api')

const { autoUpdater } = require('electron-updater');
const { join } = require('path');

////////////////// App Startup ///////////////////////////////////////////////////////////////////
let win
let listenersApplied = false
let firstReactReady = true


// PATHS to files and folders
let workingDirectory = __dirname
if (app.isPackaged) workingDirectory = path.join(process.resourcesPath, "public")

const pathToJLink = path.join(workingDirectory, "JLink.exe")
const pathToFiles = path.join(app.getPath('userData'), 'data')
const pathToFile = path.join(pathToFiles, 'cmd.jlink')
const pathToDevices = path.join(pathToFiles, 'devices')


const handleLine = async(line) => {
    //console.log("Line Name:", line.name)
    //console.log("Last Mod:", new Date(line.modified).toLocaleDateString())
    //console.log("# of devices:", line.devices.length)

    //console.log(JSON.stringify(line, null, " "))

    await line.devices.reduce(async(acc, element) => {
        await acc

        //console.log("EL", element)

        if (element.name !== "Brain") {

            const pathToDevice = join(pathToDevices, element.path)

            if (!existsSync(pathToDevice)) mkdirSync(pathToDevice)
            let currentFirmware = null

            if (element.current !== '???') {
                currentFirmware = element.firmware.find(fw => fw.version === element.current)
                if (!currentFirmware) throw new Error('ERROR HERE')

                // If a firmware with this name is not already in this devices folder
                if (!existsSync(join(pathToDevice, currentFirmware.name))) {
                    console.log("Current firmware file doesn't exist")

                    // get name of all files in this devices folder
                    const devFolderContents = readdirSync(pathToDevice)

                    // Delete each File In this folder
                    devFolderContents.forEach(file => {
                        unlinkSync(join(pathToDevice, file))
                    })

                    try {
                        // Put New / Current Firmware in folder
                        await wbmVer.downloadFirmware(currentFirmware.id, join(pathToDevice, currentFirmware.name))
                        console.log("Updated Firmware", currentFirmware)
                        win.webContents.send('updatedFirmware', currentFirmware)
                    } catch (error) {
                        console.log(error)
                    }

                }
            }
            //console.log("Device", element.name)
            //console.log("Current FW:", element.current)
            //console.log("Last Mod:", new Date(element.modified).toLocaleDateString())
        }
    }, Promise.resolve([]))

    //space()
}

const checkForUpdates = async() => {
    try {
        let lines = await wbmVer.getLines()
        if (lines === undefined) console.log("LINES IS UNDEFINED")
        let lineID = lines.find(line => line.path === 'iomanager').id
        if (lineID === undefined) console.log("THE LINEID IS UNDEFINED")
        let theLine = await wbmVer.getLine(lineID)
        handleLine(theLine)
    } catch (error) {
        console.log(error)
    }

}

const checkFolderStructure = () => {
    if (!existsSync(path.join('C:', 'ProgramData', 'WBM Tek'))) {
        console.log('Creating WBM Tek folder')
        mkdirSync(path.join('C:', 'ProgramData', 'WBM Tek'))
    }

    if (!existsSync(pathToFiles)) {
        console.log('Creating pcbChecker folder')
        mkdirSync(pathToFiles)
    }

    if (!existsSync(pathToDevices)) {
        console.log('Creating devices folder')
        mkdirSync(pathToDevices)
    }
}
checkFolderStructure()

const getProgrammer = async() => {
    return new Promise((resolve, reject) => {
        const args = [
            '-CommanderScript "' + pathToFile + '"',
            '-ExitOnError 1'
        ]

        let programmer = false

        writeFileSync(pathToFile, 'ShowEmuList USB\r\nexit', 'utf8')

        let child = execFile(pathToJLink, [...args], { shell: true, cwd: workingDirectory })

        child.stdout.on('data', (data) => {
            let theLine = data.toString()
            if (theLine.includes("J-Link[0]:")) {
                programmer = theLine.split(',').find(ln => ln.includes("Serial number:")).split(':')[1].replace(' ', '')
            }
        })

        child.on('close', (code) => {
            if (code === 0 && programmer !== false) {
                resolve(programmer)
            } else {
                reject(programmer)
            }
        })
    })
}

const loadFirmware = (filePath) => {
    win.webContents.send('programming')
    win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

    const args = [
        '-device ATSAMD21G18',
        '-if SWD',
        '-speed 4000',
        '-autoconnect 1',
        '-CommanderScript "' + pathToFile + '"',
        '-ExitOnError 1'
    ]

    win.webContents.send('message', pathToFile)
    let pathToFirmware = filePath
    let pathToBoot = path.join(workingDirectory, "firmware", 'boot.bin')
    let pathToOutput = path.join(pathToFiles, 'output.bin')
    win.webContents.send('message', workingDirectory)

    //console.log('pathToFirm', pathToFirmware)

    const boot = new Buffer.alloc(0x2000, readFileSync(pathToBoot))
    const firm = new Buffer.from(readFileSync(pathToFirmware))

    return new Promise(async(resolve, reject) => {
        let programmerSerial = null
        try {
            programmerSerial = await getProgrammer()
        } catch (error) {
            console.log("NO PROGRAMMER")
            win.webContents.send('programmingComplete')
            reject(["J-Link Programmer not connected"])
            throw error
        }

        win.webContents.send('jLinkProgress', "Programming MCU -- FW: " + path.parse(filePath).name)
        let out = null
        writeFileSync(pathToOutput, Buffer.concat([boot, firm]))
        writeFileSync(pathToFile, 'loadFile "' + pathToOutput + '"\r\nUSB ' + programmerSerial + '\r\nrnh\r\nexit', 'utf8')

        let child = execFile(pathToJLink, [...args], { shell: true, cwd: workingDirectory })

        child.stdout.on('data', (data) => {
            //win.webContents.send('jLinkProgress', data)
            //console.log("HEREXXX", data.toString())
            if (data.toString().includes('Cannot connect to target.')) out = "FAILED: Could not communicate with MicroController"
            else if (
                data.toString().includes('FAILED: Cannot connect to J-Link') ||
                data.toString().includes('ERROR while parsing value for usb')
            ) out = "FAILED: Cannot connect to J-Link Programmer"
            else if (data.toString().includes('Script processing completed.')) out = "Programming Successful"
            else out = data.toString()
        })

        child.on('close', (code) => {

            if (out === "Programming Successful") {
                win.webContents.send('jLinkProgress', out)
                resolve(out)
            } else {
                win.webContents.send('jLinkProgress', out)
                win.webContents.send('programmingComplete')
                reject(out)
            }
        })

        child.on('error', (error) => {
            console.log('Error in J-LINK programming')
            reject(new Error('Error in J-LINK programming'))
        })
    })
}

const waitForDevice = async(device) => {

    let waitFor = ''

    switch (device) {

        case 'cvboard':
            waitFor = 'CV Board'
            break;

        case 'gpiboard':
            waitFor = 'GPI Board'
            break;

        case 'gpoboard':
            waitFor = 'GPO Board'
            break;

        case 'alarmpanel':
            waitFor = 'Alarm Panel'
            break;

        default:
            break;
    }

    return new Promise((resolve, reject) => {
        win.webContents.send('jLinkProgress', "Waiting to detect Device")
        const exit = (passFail) => {
            clearTimeout(waitForDeviceTimer)
            if (passFail === 'fail') reject(['Timed out waiting for device'])
            else resolve(passFail)
        }

        let waitForDeviceTimer = setTimeout(() => exit('fail'), 3000);

        wbmUsbDevice.on('devList', (list) => {
            const devIdx = list.findIndex(dev => dev.Model === waitFor)
            if (devIdx >= 0) exit(list[devIdx].path)
        })

    })
}

const getFwFile = async(folder) => {
    return new Promise((resolve, reject) => {
        let files = readdirSync(join(pathToDevices, folder))
        if (files.length <= 0) {
            console.log('No firmware file found for ' + folder)
            reject(['No firmware file found for ' + folder])
        } else resolve(files[0])
    })

}

const programAndTest = async(folder) => {
    console.log('Program and test', folder)

    let deviceIsOnPort

    try {
        //Get File Name of current firmware for this device
        let file = await getFwFile(folder)

        // Load BootLoader and Testing Firmware
        await loadFirmware(join(pathToDevices, folder, file))
        console.log("Firmware Loaded")

        // Wait for programmed device to be detected
        console.log('Waiting for device to connect')
        deviceIsOnPort = await waitForDevice(folder)
        console.log('Device detected at', deviceIsOnPort)
        win.webContents.send('jLinkProgress', 'Device detected at ' + deviceIsOnPort)

        // Run Tests on device
        console.log("Run Tests")
        win.webContents.send('jLinkProgress', 'TESTING')
        let testResults = await tests.runTests(folder, deviceIsOnPort)
        testResults.forEach(result => {
            console.log(result)
            win.webContents.send('jLinkProgress', result)
        })

        win.webContents.send('passFail', 'pass')
        win.webContents.send('jLinkProgress', '----------------------------')
        win.webContents.send('jLinkProgress', "Ready for delivery!! :)")

        win.webContents.send('programmingComplete')

    } catch (error) {
        console.log(error)
        win.webContents.send('passFail', 'fail')
        error.forEach(msg => win.webContents.send('jLinkProgress', msg))
        win.webContents.send('programmingComplete')
        throw error
    }
}

const chipErase = async() => {
    return new Promise(async(resolve, reject) => {
        let programmerSerial = null
        try {
            programmerSerial = await getProgrammer()
        } catch (error) {
            console.log("NO PROGRAMMER")
            win.webContents.send('programmingComplete')
            reject("J-Link Programmer not connected")
            throw error
        }

        win.webContents.send('chipErasing')
        win.webContents.send('jLinkProgress', "Erasing Chip")
        console.log("Chip Erase")
        win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

        const args = [
            '-device ATSAMD21G18',
            '-if SWD',
            '-speed 4000',
            '-autoconnect 1',
            '-CommanderScript "' + pathToFile + '"',
            '-ExitOnError 1'
        ]

        win.webContents.send('message', pathToFile)
        win.webContents.send('message', workingDirectory)

        writeFileSync(pathToFile, "erase\r\nUSB " + programmerSerial + "rnh\r\nexit", 'utf8')

        console.log("Execute erase command")
        let outErr = 'CHIP ERASE ERROR'
        let child = execFile(pathToJLink, [...args], { shell: true, cwd: workingDirectory })


        child.stdout.on('data', (data) => {
            //win.webContents.send('jLinkProgress', data)
            if (data.toString().includes('Cannot connect to target.')) outErr = "FAILED: Could not communicate with MicroController"
                //console.log("SDATTA", data.toString())
        })

        child.on('close', (code) => {
            console.log("close Erase")
            if (code === 0) {
                resolve('Chip erase complete')
            } else {
                reject(outErr)
            }
            win.webContents.send('chipEraseComplete')
        })
    })
}

function createWindow() {
    // Create the browser window.
    win = new BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, 'preload.js')
        },
        icon: path.join(__dirname, '/favicon.ico'),
        title: 'WBM Tek PCB Assembly Checker --- v' + app.getVersion()
    })

    const startUrl = process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, '/../build/index.html'),
        protocol: 'file:',
        slashes: true
    });
    win.loadURL(startUrl);
    //win.maximize()

    // Emitted when the window is closed.
    win.on('closed', () => win = null)

    win.on('ready-to-show', () => win.show())
}

const createListeners = () => {
    ipcMain.on('installUpdate', () => {
        autoUpdater.quitAndInstall(true, true)
    })

    ipcMain.on('loadFirmware', (e, firmware) => {
        console.log("Load", firmware)
        loadFirmware(firmware)
    })

    ipcMain.on('chipErase', async() => {
        try {
            let result = await chipErase()
            win.webContents.send('jLinkProgress', result)
            win.webContents.send('chipEraseComplete')
        } catch (error) {
            win.webContents.send('jLinkProgress', error)
            win.webContents.send('chipEraseComplete')
        }
    })

    ipcMain.on('programAndTest', (e, folder) => programAndTest(folder))



    win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

    /////// CHECK FOR DRIVER
    const drvChk = path.join('C:', 'Windows', 'System32', 'DriverStore', 'FileRepository', 'jlink.inf_amd64_7c645d531403fb66', 'jlink.inf')
    try {
        if (existsSync(drvChk)) {
            //console.log('File Exists')
            win.webContents.send('message', 'File Exists')
        } else {
            const driver = execFileSync(path.join(workingDirectory, "USBDriver", "InstDrivers.exe"), [], { shell: true }).toString()
            console.log(driver)
            win.webContents.send('message', driver.toString())
        }
    } catch (err) {
        console.error(err)
        win.webContents.send('message', err.toString())
        console.log("In Error")
    }
}

////////  SINGLE INSTANCE //////////
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) app.quit()

app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, we should focus our window.
        if (win) {
            if (win.isMinimized()) win.restore()
            win.focus()
        }
    })
    //////  END SINGLE INSTANCE ////////


// Create myWindow, load the rest of the app, etc...
app.on('ready', () => {

        //log("-APP IS READY");

        ipcMain.on('reactIsReady', () => {
            if (firstReactReady) {
                firstReactReady = false
                console.log('React Is Ready')
                win.webContents.send('message', 'React Is Ready')

                if (listenersApplied === false) {
                    listenersApplied = true
                    createListeners()

                    wbmUsbDevice.startMonitoring()

                    wbmUsbDevice.on('progress', (list) => {
                        console.log('progress', list)
                        win.webContents.send('jLinkProgress', list)
                    })

                    tests.on('message', (message) => win.webContents.send('jLinkProgress', message))
                }

                if (app.isPackaged) {
                    win.webContents.send('message', 'App is packaged')

                    autoUpdater.on('checking-for-update', () => win.webContents.send('checkingForUpdates'))
                    autoUpdater.on('update-available', () => win.webContents.send('updateAvailable'))
                    autoUpdater.on('update-not-available', () => win.webContents.send('noUpdate'))
                    autoUpdater.on('update-downloaded', (e, updateInfo, f, g) => { win.webContents.send('updateDownloaded', e) })
                    autoUpdater.on('download-progress', (e) => { win.webContents.send('updateDownloadProgress', e.percent) })
                    autoUpdater.on('error', (message) => win.webContents.send('updateError', message))


                    // Check for new version of app every 30 minutes
                    setInterval(() => {
                        win.webContents.send('message', 'Interval Check for update')
                        autoUpdater.checkForUpdatesAndNotify()
                    }, 30 * 60 * 1000);

                    // check for new version of app on boot
                    autoUpdater.checkForUpdatesAndNotify()
                }

                checkForUpdates()
            }
        })

        ipcMain.handle('getFw', (e, theBoards) => {
            let boards = theBoards
            const numOfBoards = boards.length

            for (let i = 0; i < numOfBoards; i++) {
                const deviceFiles = readdirSync(join(pathToDevices, boards[i].name))
                const binFile = deviceFiles.filter(file => file.includes('.bin'))
                if (binFile.length === 0) boards[i].ver = "no fw"
                else {
                    let fileName = binFile[0].replace('.bin', '')
                    fileName = fileName.replace(/^(.*)FW/, '')
                    boards[i].ver = fileName
                }
            }
            return boards
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