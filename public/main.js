const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const url = require('url')
const { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, readFileSync } = require('fs')
const { execFile } = require('child_process');
const wbmUsbDevice = require('wbm-usb-device')
const tests = require('./tests')
const { setBase, setAuth, setToken, downloadFirmware, getLines, getLine } = require('@wbm-tek/version-manager')
const bootLog = (message) => {
    console.log(`[${new Date().toISOString()}] ${message}`)
}

const apiOrigin = (process.env.WBM_API_ORIGIN || process.env.WBM_SERVER_URL || 'https://api.wbmtek.com')
    .replace(/\/$/, '')
    .replace(/\/api$/, '')
setBase(apiOrigin)
if (process.env.WBM_API_TOKEN) {
    setToken(process.env.WBM_API_TOKEN)
    bootLog('Version manager auth: using WBM_API_TOKEN')
} else if (process.env.WBM_USERNAME && process.env.WBM_PASSWORD) {
    setAuth(process.env.WBM_USERNAME, process.env.WBM_PASSWORD)
    bootLog('Version manager auth: using username/password')
} else {
    bootLog('Version manager auth: no credentials configured')
}

const { autoUpdater } = require('electron-updater');
const { join } = require('path');

////////////////// App Startup ///////////////////////////////////////////////////////////////////
let win
let listenersApplied = false
let firstReactReady = true

let skipInitMemory = false
let updateCheckInterval = null
let fwCheckInterval = null
let shuttingDown = false
const activeJLinkProcesses = new Set()
let firmwareCatalogByDevice = {}
let firmwareCatalogUpdatedAt = null


// PATHS to files and folders
let workingDirectory = __dirname
if (app.isPackaged) workingDirectory = path.join(process.resourcesPath, "public")

const pathToJLink = path.join(workingDirectory, "JLink.exe")
const pathToFiles = path.join(app.getPath('userData'), 'data')
const pathToFile = path.join(pathToFiles, 'cmd.jlink')
const pathToDevices = path.join(pathToFiles, 'devices')

let notifications = []


const addNotification = (data) => {
    notifications.push(data)
    win.webContents.send('notifications', notifications)
}

const clearAllNotifications = () => {
    notifications = []
    win.webContents.send('notifications', notifications)
}

const extractVersionFromFirmwareName = (fileName = '') => {
    const withoutExt = fileName.replace(/\.bin$/i, '')
    const parsed = withoutExt.replace(/^(.*)FW/i, '')
    return parsed || withoutExt
}

const getLocalFirmwareEntries = (folder) => {
    const folderPath = join(pathToDevices, folder)
    if (!existsSync(folderPath)) return []

    return readdirSync(folderPath)
        .filter((file) => file.toLowerCase().endsWith('.bin'))
        .map((file) => ({
            name: file,
            version: extractVersionFromFirmwareName(file),
            isLocal: true,
            localPath: join(folderPath, file)
        }))
}

const updateFirmwareCatalogCache = (line) => {
    if (!line || !Array.isArray(line.devices)) return

    const nextCatalog = {}
    line.devices.forEach((device) => {
        if (!device || device.name === 'Brain' || !device.path) return
        const apiFirmware = Array.isArray(device.firmware) ? device.firmware : []
        nextCatalog[device.path] = {
            current: device.current,
            versions: apiFirmware.map((fw) => ({
                id: fw.id,
                name: fw.name,
                version: fw.version,
                isLocal: existsSync(join(pathToDevices, device.path, fw.name))
            }))
        }
    })

    firmwareCatalogByDevice = nextCatalog
    firmwareCatalogUpdatedAt = Date.now()
    bootLog(`Firmware catalog cache updated for ${Object.keys(nextCatalog).length} device(s)`)
}

const getFirmwareOptionsForDevice = (folder) => {
    const cached = firmwareCatalogByDevice[folder] || { current: '???', versions: [] }
    const localEntries = getLocalFirmwareEntries(folder)
    const optionsByVersion = new Map()

    cached.versions.forEach((entry) => {
        optionsByVersion.set(entry.version, {
            version: entry.version,
            id: entry.id,
            name: entry.name,
            isLocal: existsSync(join(pathToDevices, folder, entry.name))
        })
    })

    localEntries.forEach((entry) => {
        if (optionsByVersion.has(entry.version)) {
            const existing = optionsByVersion.get(entry.version)
            existing.isLocal = true
            existing.localPath = existing.localPath || entry.localPath
            optionsByVersion.set(entry.version, existing)
        } else {
            optionsByVersion.set(entry.version, {
                version: entry.version,
                name: entry.name,
                isLocal: true,
                localPath: entry.localPath
            })
        }
    })

    const options = [...optionsByVersion.values()].sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }))
    const fallbackCurrent = options.length > 0 ? options[0].version : 'no fw'
    const currentVersion = cached.current && cached.current !== '???' ? cached.current : fallbackCurrent

    return {
        folder,
        currentVersion,
        options,
        updatedAt: firmwareCatalogUpdatedAt
    }
}

const ensureFirmwarePathForVersion = async (folder, version) => {
    const localEntries = getLocalFirmwareEntries(folder)
    const localMatch = localEntries.find((entry) => entry.version === version)
    if (localMatch) return localMatch.localPath

    const cached = firmwareCatalogByDevice[folder]
    if (!cached || !Array.isArray(cached.versions)) {
        throw new Error(`No firmware metadata available for ${folder}`)
    }

    const target = cached.versions.find((entry) => entry.version === version)
    if (!target) {
        throw new Error(`Firmware version ${version} not found for ${folder}`)
    }

    const outputPath = join(pathToDevices, folder, target.name)
    if (!existsSync(outputPath)) {
        win.webContents.send('jLinkProgress', `Downloading firmware ${version}`)
        await downloadFirmware(target.id, outputPath)
        win.webContents.send('jLinkProgress', `Downloaded firmware ${version}`)
        target.isLocal = true
    }

    return outputPath
}

/**
 * Handles a line object representing a production line and its devices.
 * For each device, ensures the correct firmware is present in the device folder.
 * Downloads and updates firmware files as needed.
 * @param {Object} line - Line object containing devices and metadata.
 */
const handleLine = async (line) => {
    //console.log("Line Name:", line.name)
    //console.log("Last Mod:", new Date(line.modified).toLocaleDateString())
    //console.log("# of devices:", line.devices.length)

    //console.log(JSON.stringify(line, null, " "))

    await line.devices.reduce(async (acc, element) => {
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
                        await downloadFirmware(currentFirmware.id, join(pathToDevice, currentFirmware.name))
                        console.log("Updated Firmware", currentFirmware)
                        addNotification({ type: "fw updated", message: element.name + " FW updated to " + currentFirmware.version })
                        win.webContents.send('updatedFirmware', currentFirmware)
                        win.webContents.send('refreshFW', currentFirmware)
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

const checkForFwUpdates = async () => {
    const startTime = Date.now()
    bootLog('Firmware update check started')
    try {
        let lines = await getLines()
        if (lines === undefined) console.log("LINES IS UNDEFINED")
        let lineID = lines.find(line => line.path === 'iomanager').id
        if (lineID === undefined) console.log("THE LINEID IS UNDEFINED")
        let theLine = await getLine(lineID)
        updateFirmwareCatalogCache(theLine)
        await handleLine(theLine)
        bootLog(`Firmware update check completed in ${Date.now() - startTime}ms`)
    } catch (error) {
        console.log(error)
        bootLog(`Firmware update check failed in ${Date.now() - startTime}ms`)
    }

}

/**
 * Ensures required folders for the application exist on disk.
 * Creates WBM Tek, pcbChecker, and devices folders if missing.
 */
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

/**
 * Detects and returns the serial number of the connected J-Link programmer.
 * Uses JLink.exe to query available programmers via USB.
 * @returns {Promise<string>} Serial number of programmer, or rejects if not found.
 */
const getProgrammer = async () => {
    return new Promise((resolve, reject) => {
        const args = [
            '-CommanderScript "' + pathToFile + '"',
            '-ExitOnError 1'
        ]

        let programmer = false

        writeFileSync(pathToFile, 'ShowEmuList USB\r\nexit', 'utf8')

        let child = execFile(pathToJLink, [...args], { shell: true, cwd: workingDirectory })
        activeJLinkProcesses.add(child)

        child.stdout.on('data', (data) => {
            let theLine = data.toString()
            if (theLine.includes("J-Link[0]:")) {
                programmer = theLine.split(',').find(ln => ln.includes("Serial number:")).split(':')[1].replace(' ', '')
            }
        })

        child.on('close', (code) => {
            activeJLinkProcesses.delete(child)
            if (code === 0 && programmer !== false) {
                resolve(programmer)
            } else {
                reject(programmer)
            }
        })
    })
}

/**
 * Loads and programs firmware to the connected device using J-Link.
 * Combines bootloader and firmware, writes to device, and reports progress via IPC.
 * @param {string} filePath - Path to firmware file to program.
 */
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

    const boot = new Buffer.alloc(0x8000, readFileSync(pathToBoot))
    const firm = new Buffer.alloc(0x38000, readFileSync(pathToFirmware))
    firm[firm.length - 1] = 255;
    firm[firm.length - 2] = 0;

    return new Promise(async (resolve, reject) => {
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
        activeJLinkProcesses.add(child)

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
            activeJLinkProcesses.delete(child)
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
            activeJLinkProcesses.delete(child)
            console.log('Error in J-LINK programming')
            reject(new Error('Error in J-LINK programming'))
        })
    })
}

const waitForDevice = async (device) => {

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

        case 'midiboard':
            waitFor = 'MIDI Board'
            break;

        case 'serialboard':
            waitFor = 'Serial Board'
            break;

        case 'controlpanel':
            waitFor = 'Control Panel'
            break;

        default:
            break;
    }

    const findDevicePath = (list) => {
        if (!Array.isArray(list)) return null
        const dev = list.find((d) => {
            const model = (d?.Model || '').toString().trim().toLowerCase()
            return model === waitFor.toLowerCase()
        })
        return dev?.path || null
    }

    return new Promise((resolve, reject) => {
        win.webContents.send('jLinkProgress', "Waiting to detect Device")

        let settled = false
        const onDevList = (list) => {
            const path = findDevicePath(list)
            if (path) exit(path)
        }

        const exit = (passFail) => {
            if (settled) return
            settled = true
            clearTimeout(waitForDeviceTimer)
            wbmUsbDevice.removeListener('devList', onDevList)
            if (passFail === 'fail') reject(['Timed out waiting for device'])
            else resolve(passFail)
        }

        let waitForDeviceTimer = setTimeout(() => exit('fail'), 10000);
        wbmUsbDevice.on('devList', onDevList)

        // Resolve immediately if monitor already has the target device (no new attach event required).
        const existingPath = findDevicePath(wbmUsbDevice.wbmDevices)
        if (existingPath) exit(existingPath)
    })
}

/**
 * Retrieves the firmware file name for a given device folder.
 * @param {string} folder - Device folder name.
 * @returns {Promise<string>} Resolves with firmware file name, or rejects if not found.
 */
const getFwFile = async (folder) => {
    return new Promise((resolve, reject) => {
        let files = readdirSync(join(pathToDevices, folder))
        if (files.length <= 0) {
            console.log('No firmware file found for ' + folder)
            reject(['No firmware file found for ' + folder])
        } else resolve(files[0])
    })

}

/**
 * Orchestrates the full workflow for programming and testing a device.
 * Loads firmware, waits for device connection, runs automated tests, and reports results.
 * @param {string} folder - Device folder name.
 */
const programAndTest = async (folder, firmwarePath = null) => {
    console.log('Program and test', folder)

    let deviceIsOnPort

    try {
        let selectedFirmwarePath = firmwarePath
        if (!selectedFirmwarePath) {
            // Get file name of current firmware for this device
            let file = await getFwFile(folder)
            selectedFirmwarePath = join(pathToDevices, folder, file)
        }

        // Load BootLoader and testing firmware
        await loadFirmware(selectedFirmwarePath)
        console.log("Firmware Loaded")

        // Wait for programmed device to be detected
        console.log('Waiting for device to connect')
        deviceIsOnPort = await waitForDevice(folder)
        console.log('Device detected at', deviceIsOnPort)
        win.webContents.send('jLinkProgress', 'Device detected at ' + deviceIsOnPort)

        // Run Tests on device
        console.log("Run Tests")
        win.webContents.send('jLinkProgress', 'TESTING')
        let testResults = await tests.runTests(folder, skipInitMemory, deviceIsOnPort)
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
        const messages = Array.isArray(error)
            ? error
            : [error?.message || String(error)]
        messages.forEach(msg => win.webContents.send('jLinkProgress', msg))
        win.webContents.send('programmingComplete')
        throw error
    }
}

const chipErase = async () => {
    return new Promise(async (resolve, reject) => {
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
        activeJLinkProcesses.add(child)

        child.stdout.on('data', (data) => {
            //win.webContents.send('jLinkProgress', data)
            if (data.toString().includes('Cannot connect to target.')) outErr = "FAILED: Could not communicate with MicroController"
            //console.log("SDATTA", data.toString())
        })

        child.on('close', (code) => {
            activeJLinkProcesses.delete(child)
            console.log("close Erase")
            if (code === 0) {
                resolve('Chip erase complete')
            } else {
                console.log("ERROR CODE", code)
                reject(outErr)
            }
            win.webContents.send('chipEraseComplete')
        })
    })
}

function createWindow() {
    bootLog('Creating BrowserWindow')
    // Create the browser window.
    win = new BrowserWindow({
        width: 900,
        height: 700,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
            preload: join(__dirname, 'preload.js'),
            sandbox: false
        },
        icon: path.join(__dirname, '/favicon.ico'),
        title: 'WBM Tek PCB Assembly Checker --- v' + app.getVersion()
    })

    const startUrl = process.env.ELECTRON_RENDERER_URL || process.env.ELECTRON_START_URL || url.format({
        pathname: path.join(__dirname, '/../build/index.html'),
        protocol: 'file:',
        slashes: true
    });
    bootLog(`Loading renderer URL: ${startUrl}`)
    win.loadURL(startUrl);
    //win.maximize()

    // Emitted when the window is closed.
    win.on('closed', () => win = null)
    win.on('close', () => bootLog('Window close requested'))

    win.on('ready-to-show', () => {
        bootLog('Window ready-to-show')
        win.show()
    })
}

const shutdownApp = () => {
    if (shuttingDown) return
    shuttingDown = true
    bootLog('Shutdown started')

    if (activeJLinkProcesses.size > 0) {
        bootLog(`Killing ${activeJLinkProcesses.size} active JLink process(es)`)
        for (const jlinkChild of activeJLinkProcesses) {
            try {
                jlinkChild.kill()
                if (jlinkChild.pid) {
                    require('child_process').execSync(`taskkill /PID ${jlinkChild.pid} /F /T`, { stdio: 'ignore' })
                }
            } catch (e) { /* already exited */ }
        }
        activeJLinkProcesses.clear()
    }

    try {
        const tests = require('./tests')
        if (typeof tests.closePort === 'function') {
            tests.closePort().catch(() => {})
            bootLog('Serial port closed')
        }
    } catch (e) { /* tests not loaded */ }

    if (updateCheckInterval) {
        clearInterval(updateCheckInterval)
        updateCheckInterval = null
    }
    if (fwCheckInterval) {
        clearInterval(fwCheckInterval)
        fwCheckInterval = null
    }

    if (typeof wbmUsbDevice.stopMonitoring === 'function') {
        try {
            wbmUsbDevice.stopMonitoring()
            bootLog('USB monitoring stopped')
        } catch (error) {
            bootLog(`Failed to stop USB monitoring: ${error.message}`)
        }
    } else {
        bootLog('stopMonitoring not available on this wbm-usb-device version')
    }

    const forceExitTimer = setTimeout(() => {
        bootLog('Shutdown timeout reached, forcing process exit')
        process.exit(0)
    }, 3000)

    clearTimeout(forceExitTimer)
    bootLog('Exiting app')
    app.exit(0)
}

const checkAndInstallDriverAsync = () => {
    const drvChk = path.join('C:', 'Windows', 'System32', 'DriverStore', 'FileRepository', 'jlink.inf_amd64_7c645d531403fb66', 'jlink.inf')

    if (existsSync(drvChk)) {
        win.webContents.send('message', 'File Exists')
        bootLog('J-Link driver already installed')
        return
    }

    bootLog('J-Link driver missing; starting async driver install')
    execFile(path.join(workingDirectory, 'USBDriver', 'InstDrivers.exe'), [], { shell: true }, (error, stdout, stderr) => {
        if (error) {
            console.error(error)
            win.webContents.send('message', error.toString())
            if (stderr) win.webContents.send('message', stderr.toString())
            bootLog(`Driver install failed: ${error.message}`)
            return
        }

        if (stdout) {
            console.log(stdout)
            win.webContents.send('message', stdout.toString())
        }
        bootLog('Driver install completed')
    })
}

const createListeners = () => {
    ipcMain.on('installUpdate', () => {
        autoUpdater.quitAndInstall(true, true)
    })

    ipcMain.on('loadFirmware', (e, firmware) => {
        console.log("Load", firmware)
        loadFirmware(firmware)
    })

    ipcMain.on('chipErase', async () => {
        try {
            let result = await chipErase()
            win.webContents.send('jLinkProgress', result)
            win.webContents.send('chipEraseComplete')
        } catch (error) {
            win.webContents.send('jLinkProgress', error)
            win.webContents.send('chipEraseComplete')
        }
    })

    ipcMain.on('programAndTest', (e, folder) => {
        programAndTest(folder).catch((error) => {
            console.error('programAndTest failed:', error)
        })
    })

    ipcMain.on('programAndTestSelection', (e, payload) => {
        const folder = payload?.folder
        if (!folder) {
            win.webContents.send('jLinkProgress', 'No board selected for programming')
            return
        }

        const runWithSelection = async () => {
            if (payload?.type === 'local') {
                if (!payload.filePath || !existsSync(payload.filePath)) {
                    throw new Error('Selected local firmware file was not found')
                }
                return payload.filePath
            }

            if (payload?.type === 'version' && payload.version) {
                return ensureFirmwarePathForVersion(folder, payload.version)
            }

            return null
        }

        runWithSelection()
            .then((firmwarePath) => programAndTest(folder, firmwarePath))
            .catch((error) => {
                const errorMessage = error?.message || String(error)
                win.webContents.send('jLinkProgress', errorMessage)
                win.webContents.send('programmingComplete')
                win.webContents.send('passFail', 'fail')
                console.error('programAndTestSelection failed:', error)
            })
    })

    ipcMain.handle('chooseLocalFirmware', async () => {
        const result = await dialog.showOpenDialog(win, {
            title: 'Choose Local Firmware',
            properties: ['openFile'],
            filters: [{ name: 'Firmware', extensions: ['bin'] }]
        })

        if (result.canceled || result.filePaths.length === 0) {
            return { canceled: true }
        }

        return { canceled: false, filePath: result.filePaths[0] }
    })

    ipcMain.handle('getInitMemory', () => skipInitMemory)

    ipcMain.handle('setInitMemory', (event, value) => {
        skipInitMemory = !!value
        return skipInitMemory
    })

    ipcMain.handle('toggleInitMemory', () => {
        skipInitMemory = !skipInitMemory
        return skipInitMemory
    })

    win.webContents.send('message', "Packaged resource path" + process.resourcesPath)

    setTimeout(checkAndInstallDriverAsync, 0)
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
    bootLog('App ready event fired')

    //log("-APP IS READY");

    ipcMain.on('reactIsReady', () => {
        if (firstReactReady) {
            firstReactReady = false
            bootLog('React is ready (first event)')
            win.webContents.send('message', 'React Is Ready')


            if (listenersApplied === false) {
                listenersApplied = true
                createListeners()
                bootLog('Main IPC listeners created')

                wbmUsbDevice.startMonitoring()
                bootLog('USB monitoring started')

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
                autoUpdater.on('error', (e, message) => {
                    console.log("updateError", e, message)
                    win.webContents.send('updateError', message)
                })


                // Check for new version of app every 30 minutes
                updateCheckInterval = setInterval(() => {
                    win.webContents.send('message', 'Interval Check for update')
                    autoUpdater.checkForUpdatesAndNotify()
                }, 30 * 60 * 1000);

                // Defer first update check so UI can stabilize before network work.
                setTimeout(() => {
                    bootLog('Starting deferred updater check')
                    autoUpdater.checkForUpdatesAndNotify()
                }, 5000)
            }

            // Defer initial firmware check so first paint and IPC wiring finish first.
            setTimeout(() => {
                checkForFwUpdates()
            }, 2000)
            fwCheckInterval = setInterval(() => {
                checkForFwUpdates()
            }, 10 * 60 * 1000);
            bootLog('Firmware update interval started (10 minutes)')
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

    ipcMain.handle('getFwVersions', (e, folder) => {
        return getFirmwareOptionsForDevice(folder)
    })

    ipcMain.on('checkForNewFW', () => checkForFwUpdates())

    ipcMain.on('clearNotification', (e, not) => {
        console.log("Clear Notification", not)
        notifications = notifications.filter(notification => JSON.stringify(notification) !== JSON.stringify(not))
        win.webContents.send('notifications', notifications)
    })

    ipcMain.on('clearAllNotifications', () => {
        clearAllNotifications()
    })

    createWindow()
})
///////////////////////

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    shutdownApp()
})



app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})

////////////////// END App Startup ///////////////////////////////////////////////////////////////