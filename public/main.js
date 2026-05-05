const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const url = require('url')
const { existsSync, mkdirSync, readdirSync, unlinkSync, writeFileSync, readFileSync } = require('fs')
const { execFile, execSync } = require('child_process');
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
const activeJLinkProcesses = new Map()
let firmwareCatalogByDevice = {}
let firmwareCatalogUpdatedAt = null
const JLINK_SOFT_KILL_GRACE_MS = 500
const JLINK_KILL_TIMEOUT_MS = 2500
const SHUTDOWN_FORCE_EXIT_MS = 5000

const truncateForLog = (text = '', max = 300) => {
    const clean = String(text || '').replace(/\s+/g, ' ').trim()
    if (clean.length <= max) return clean
    return `${clean.slice(0, max)}...`
}

const trackJLinkChild = (child, context) => {
    const meta = {
        context,
        startedAt: Date.now(),
        pid: child?.pid || null,
        killRequested: false
    }
    activeJLinkProcesses.set(child, meta)
    bootLog(`[JLink:${context}] Started pid=${meta.pid || 'unknown'} active=${activeJLinkProcesses.size}`)

    child.once('exit', (code, signal) => {
        bootLog(`[JLink:${context}] Exit pid=${meta.pid || 'unknown'} code=${String(code)} signal=${String(signal)}`)
    })

    child.once('error', (error) => {
        bootLog(`[JLink:${context}] Child error pid=${meta.pid || 'unknown'} message=${truncateForLog(error?.message || error)}`)
    })

    return meta
}

const untrackJLinkChild = (child, reason) => {
    const meta = activeJLinkProcesses.get(child)
    if (!meta) return
    const durationMs = Date.now() - meta.startedAt
    bootLog(`[JLink:${meta.context}] Removed pid=${meta.pid || 'unknown'} reason=${reason} duration=${durationMs}ms active=${Math.max(activeJLinkProcesses.size - 1, 0)}`)
    activeJLinkProcesses.delete(child)
}

const terminateTrackedJLinkChild = async (child) => {
    const meta = activeJLinkProcesses.get(child) || { context: 'unknown', pid: child?.pid || null }
    meta.killRequested = true

    let settled = false
    const settle = (result) => {
        if (settled) return
        settled = true
        untrackJLinkChild(child, result)
    }

    const waitForExit = new Promise((resolve) => {
        const onExit = (code, signal) => {
            settle(`exit:${String(code)}:${String(signal)}`)
            resolve({ status: 'exit', code, signal })
        }
        const onError = (error) => {
            settle(`error:${truncateForLog(error?.message || error, 100)}`)
            resolve({ status: 'error', error })
        }
        child.once('exit', onExit)
        child.once('error', onError)
    })

    const hardKillTimer = setTimeout(() => {
        try {
            if (meta.pid) {
                bootLog(`[JLink:${meta.context}] Hard-kill requested pid=${meta.pid}`)
                execSync(`taskkill /PID ${meta.pid} /F /T`, { stdio: 'ignore' })
            } else {
                child.kill('SIGKILL')
            }
        } catch (error) {
            bootLog(`[JLink:${meta.context}] Hard-kill failed pid=${meta.pid || 'unknown'} message=${truncateForLog(error?.message || error)}`)
        }
    }, JLINK_SOFT_KILL_GRACE_MS)

    try {
        bootLog(`[JLink:${meta.context}] Soft-stop requested pid=${meta.pid || 'unknown'}`)
        child.kill()
    } catch (error) {
        bootLog(`[JLink:${meta.context}] Soft-stop failed pid=${meta.pid || 'unknown'} message=${truncateForLog(error?.message || error)}`)
    }

    const outcome = await Promise.race([
        waitForExit,
        new Promise((resolve) => {
            setTimeout(() => {
                settle('timeout')
                resolve({ status: 'timeout' })
            }, JLINK_KILL_TIMEOUT_MS)
        })
    ])

    clearTimeout(hardKillTimer)

    if (outcome.status === 'timeout' && meta.pid) {
        try {
            bootLog(`[JLink:${meta.context}] Timeout fallback kill pid=${meta.pid}`)
            execSync(`taskkill /PID ${meta.pid} /F /T`, { stdio: 'ignore' })
        } catch (error) {
            bootLog(`[JLink:${meta.context}] Timeout fallback failed pid=${meta.pid} message=${truncateForLog(error?.message || error)}`)
        }
    }

    return { context: meta.context, pid: meta.pid, outcome: outcome.status }
}


// PATHS to files and folders
let workingDirectory = __dirname
if (app.isPackaged) workingDirectory = path.join(process.resourcesPath, "public")

const pathToJLink = path.join(workingDirectory, "JLink.exe")
const pathToFiles = path.join(app.getPath('userData'), 'data')
const pathToFile = path.join(pathToFiles, 'cmd.jlink')
const pathToDevices = path.join(pathToFiles, 'devices')

let notifications = []

const sendToRenderer = (channel, ...args) => {
    if (!win || win.isDestroyed() || !win.webContents || win.webContents.isDestroyed()) {
        bootLog(`[IPC] Skipped renderer send channel=${channel} (window unavailable)`)
        return false
    }
    win.webContents.send(channel, ...args)
    return true
}


const addNotification = (data) => {
    notifications.push(data)
    sendToRenderer('notifications', notifications)
}

const clearAllNotifications = () => {
    notifications = []
    sendToRenderer('notifications', notifications)
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
        sendToRenderer('jLinkProgress', `Downloading firmware ${version}`)
        await downloadFirmware(target.id, outputPath)
        sendToRenderer('jLinkProgress', `Downloaded firmware ${version}`)
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
                        sendToRenderer('updatedFirmware', currentFirmware)
                        sendToRenderer('refreshFW', currentFirmware)
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
            '-CommanderScript',
            pathToFile,
            '-ExitOnError',
            '1'
        ]

        let programmer = false
        let settled = false

        const settle = (resolver, value, child, reason) => {
            if (settled) return
            settled = true
            untrackJLinkChild(child, reason)
            resolver(value)
        }

        writeFileSync(pathToFile, 'ShowEmuList USB\r\nexit', 'utf8')

        let child = execFile(pathToJLink, [...args], { cwd: workingDirectory })
        trackJLinkChild(child, 'getProgrammer')

        child.stdout.on('data', (data) => {
            let theLine = data.toString()
            if (theLine.includes("J-Link[0]:")) {
                programmer = theLine.split(',').find(ln => ln.includes("Serial number:")).split(':')[1].replace(' ', '')
            }
        })

        child.on('close', (code) => {
            if (code === 0 && programmer !== false) {
                settle(resolve, programmer, child, `close:${String(code)}`)
            } else {
                settle(reject, programmer, child, `close:${String(code)}`)
            }
        })

        child.on('error', (error) => {
            const message = 'Failed to launch J-Link process: ' + (error?.message || error)
            settle(reject, new Error(message), child, 'error')
        })
    })
}

/**
 * Loads and programs firmware to the connected device using J-Link.
 * Combines bootloader and firmware, writes to device, and reports progress via IPC.
 * @param {string} filePath - Path to firmware file to program.
 */
const loadFirmware = (filePath) => {
    sendToRenderer('programming')
    sendToRenderer('message', "Packaged resource path" + process.resourcesPath)

    const args = [
        '-device',
        'ATSAMD21G18',
        '-if',
        'SWD',
        '-speed',
        '4000',
        '-autoconnect',
        '1',
        '-CommanderScript',
        pathToFile,
        '-ExitOnError',
        '1'
    ]

    sendToRenderer('message', pathToFile)
    let pathToFirmware = filePath
    let pathToBoot = path.join(workingDirectory, "firmware", 'boot.bin')
    let pathToOutput = path.join(pathToFiles, 'output.bin')
    sendToRenderer('message', workingDirectory)

    //console.log('pathToFirm', pathToFirmware)

    const boot = new Buffer.alloc(0x8000, readFileSync(pathToBoot))
    const firm = new Buffer.alloc(0x38000, readFileSync(pathToFirmware))
    firm[firm.length - 1] = 255;
    firm[firm.length - 2] = 0;

    return new Promise(async (resolve, reject) => {
        let programmerSerial = null
        let settled = false

        const settle = (resolver, value, reason, child) => {
            if (settled) return
            settled = true
            if (child) {
                untrackJLinkChild(child, reason)
            }
            resolver(value)
        }

        try {
            programmerSerial = await getProgrammer()
        } catch (error) {
            console.log("NO PROGRAMMER")
            sendToRenderer('programmingComplete')
            settle(reject, ["J-Link Programmer not connected"], 'programmer-missing')
            return
        }

        sendToRenderer('jLinkProgress', "Programming MCU -- FW: " + path.parse(filePath).name)
        writeFileSync(pathToOutput, Buffer.concat([boot, firm]))
        writeFileSync(pathToFile, 'loadFile "' + pathToOutput + '"\r\nUSB ' + programmerSerial + '\r\nrnh\r\nexit', 'utf8')

        let child = execFile(pathToJLink, [...args], { cwd: workingDirectory })
        trackJLinkChild(child, 'loadFirmware')

        let sawScriptComplete = false
        let failureReason = null
        let stdoutLog = ''
        let stderrLog = ''

        child.stdout.on('data', (data) => {
            const text = data.toString()
            stdoutLog += text
            if (text.includes('Cannot connect to target.')) {
                failureReason = 'FAILED: Could not communicate with MicroController'
            } else if (
                text.includes('FAILED: Cannot connect to J-Link') ||
                text.includes('ERROR while parsing value for usb')
            ) {
                failureReason = 'FAILED: Cannot connect to J-Link Programmer'
            }
            if (text.includes('Script processing completed.')) {
                sawScriptComplete = true
            }
        })

        child.stderr.on('data', (data) => {
            stderrLog += data.toString()
        })

        child.on('close', (code) => {
            if (code === 0 && sawScriptComplete && !failureReason) {
                sendToRenderer('jLinkProgress', 'Programming Successful')
                settle(resolve, 'Programming Successful', `close:${String(code)}`, child)
            } else {
                const exitText = typeof code === 'number'
                    ? `FAILED: J-Link exited with code ${code}`
                    : 'FAILED: J-Link terminated unexpectedly'
                const detail = failureReason || exitText
                const lastOutput = (stdoutLog + '\n' + stderrLog).trim().split(/\r?\n/).slice(-3).join(' | ')
                const failMsg = lastOutput ? `${detail} | ${lastOutput}` : detail
                sendToRenderer('jLinkProgress', failMsg)
                sendToRenderer('programmingComplete')
                settle(reject, failMsg, `close:${String(code)}`, child)
            }
        })

        child.on('error', (error) => {
            sendToRenderer('programmingComplete')
            settle(reject, new Error('Error in J-LINK programming: ' + (error?.message || error)), 'error', child)
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
        sendToRenderer('jLinkProgress', "Waiting to detect Device")

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

        // Wait for programmed device to be detected (retry up to 3 times — some boards
        // e.g. control panel take longer for the CDC stack to come up after a flash)
        console.log('Waiting for device to connect')
        const maxWaitAttempts = 3
        for (let waitAttempt = 1; waitAttempt <= maxWaitAttempts; waitAttempt++) {
            try {
                deviceIsOnPort = await waitForDevice(folder)
                break
            } catch (e) {
                if (waitAttempt === maxWaitAttempts) throw e
                console.log(`waitForDevice attempt ${waitAttempt} timed out, retrying...`)
                sendToRenderer('jLinkProgress', `Waiting to detect Device (attempt ${waitAttempt + 1})`)
            }
        }
        console.log('Device detected at', deviceIsOnPort)
        sendToRenderer('jLinkProgress', 'Device detected at ' + deviceIsOnPort)

        // Run Tests on device
        console.log("Run Tests")
        sendToRenderer('jLinkProgress', 'TESTING')
        let testResults = await tests.runTests(folder, skipInitMemory, deviceIsOnPort)
        testResults.forEach(result => {
            console.log(result)
            sendToRenderer('jLinkProgress', result)
        })

        sendToRenderer('passFail', 'pass')
        sendToRenderer('jLinkProgress', '----------------------------')
        sendToRenderer('jLinkProgress', "Ready for delivery!! :)")
        sendToRenderer('programmingComplete')

    } catch (error) {
        console.log(error)
        sendToRenderer('passFail', 'fail')
        const messages = Array.isArray(error)
            ? error
            : [error?.message || String(error)]
        messages.forEach(msg => sendToRenderer('jLinkProgress', msg))
        sendToRenderer('programmingComplete')
        throw error
    }
}

const chipErase = async () => {
    return new Promise(async (resolve, reject) => {
        let programmerSerial = null
        let settled = false

        const settle = (resolver, value, reason, child) => {
            if (settled) return
            settled = true
            if (child) {
                untrackJLinkChild(child, reason)
            }
            resolver(value)
        }

        try {
            programmerSerial = await getProgrammer()
        } catch (error) {
            console.log("NO PROGRAMMER")
            sendToRenderer('programmingComplete')
            settle(reject, "J-Link Programmer not connected", 'programmer-missing')
            return
        }

        sendToRenderer('chipErasing')
        sendToRenderer('jLinkProgress', "Erasing Chip")
        console.log("Chip Erase")
        sendToRenderer('message', "Packaged resource path" + process.resourcesPath)

        const args = [
            '-device',
            'ATSAMD21G18',
            '-if',
            'SWD',
            '-speed',
            '4000',
            '-autoconnect',
            '1',
            '-CommanderScript',
            pathToFile,
            '-ExitOnError',
            '1'
        ]

        sendToRenderer('message', pathToFile)
        sendToRenderer('message', workingDirectory)

        writeFileSync(pathToFile, "erase\r\nUSB " + programmerSerial + "\r\nrnh\r\nexit", 'utf8')

        console.log("Execute erase command")
        let outErr = 'CHIP ERASE ERROR'
        let stderrLog = ''
        let child = execFile(pathToJLink, [...args], { cwd: workingDirectory })
        trackJLinkChild(child, 'chipErase')

        child.stdout.on('data', (data) => {
            //sendToRenderer('jLinkProgress', data)
            if (data.toString().includes('Cannot connect to target.')) outErr = "FAILED: Could not communicate with MicroController"
            //console.log("SDATTA", data.toString())
        })

        child.stderr.on('data', (data) => {
            stderrLog += data.toString()
        })

        child.on('close', (code) => {
            console.log("close Erase")
            if (code === 0 && !stderrLog.toLowerCase().includes('error')) {
                settle(resolve, 'Chip erase complete', `close:${String(code)}`, child)
            } else {
                const detail = typeof code === 'number' ? `${outErr} (exit code ${code})` : outErr
                const stderrTail = stderrLog.trim().split(/\r?\n/).slice(-2).join(' | ')
                const failMsg = stderrTail ? `${detail} | ${stderrTail}` : detail
                console.log("ERROR CODE", code)
                settle(reject, failMsg, `close:${String(code)}`, child)
            }
            sendToRenderer('chipEraseComplete')
        })

        child.on('error', (error) => {
            const failMsg = 'FAILED: Unable to start J-Link erase process: ' + (error?.message || error)
            sendToRenderer('chipEraseComplete')
            settle(reject, failMsg, 'error', child)
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

const shutdownApp = async () => {
    if (shuttingDown) {
        bootLog('Shutdown already in progress, ignoring duplicate call')
        return
    }
    shuttingDown = true
    bootLog('Shutdown started')

    const forceExitTimer = setTimeout(() => {
        bootLog('Shutdown timeout reached, forcing process exit')
        process.exit(0)
    }, SHUTDOWN_FORCE_EXIT_MS)

    const trackedChildren = [...activeJLinkProcesses.keys()]
    if (trackedChildren.length > 0) {
        bootLog(`Terminating ${trackedChildren.length} tracked J-Link process(es)`) 
        const outcomes = await Promise.all(trackedChildren.map((child) => terminateTrackedJLinkChild(child)))
        const summary = outcomes.map((item) => `${item.context}:${item.pid || 'unknown'}=${item.outcome}`).join(', ')
        bootLog(`Tracked J-Link termination completed: ${summary}`)
    } else {
        bootLog('No tracked J-Link processes to terminate')
    }

    try {
        const tests = require('./tests')
        if (typeof tests.closePort === 'function') {
            await Promise.race([
                tests.closePort().catch(() => { }),
                new Promise((resolve) => setTimeout(resolve, 800))
            ])
            bootLog('Serial port close requested')
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

    clearTimeout(forceExitTimer)
    bootLog('Exiting app')
    app.exit(0)
}

const checkAndInstallDriverAsync = () => {
    const drvChk = path.join('C:', 'Windows', 'System32', 'DriverStore', 'FileRepository', 'jlink.inf_amd64_7c645d531403fb66', 'jlink.inf')

    if (existsSync(drvChk)) {
        sendToRenderer('message', 'File Exists')
        bootLog('J-Link driver already installed')
        return
    }

    bootLog('J-Link driver missing; starting async driver install')
    execFile(path.join(workingDirectory, 'USBDriver', 'InstDrivers.exe'), [], {}, (error, stdout, stderr) => {
        if (error) {
            console.error(error)
            sendToRenderer('message', error.toString())
            if (stderr) sendToRenderer('message', stderr.toString())
            bootLog(`Driver install failed: ${error.message}`)
            return
        }

        if (stdout) {
            console.log(stdout)
            sendToRenderer('message', stdout.toString())
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
        loadFirmware(firmware).catch((error) => {
            const errorMessage = error?.message || String(error)
            sendToRenderer('jLinkProgress', errorMessage)
            sendToRenderer('programmingComplete')
            console.error('loadFirmware failed:', error)
        })
    })

    ipcMain.on('chipErase', async () => {
        try {
            let result = await chipErase()
            sendToRenderer('jLinkProgress', result)
            sendToRenderer('chipEraseComplete')
        } catch (error) {
            sendToRenderer('jLinkProgress', error)
            sendToRenderer('chipEraseComplete')
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
            sendToRenderer('jLinkProgress', 'No board selected for programming')
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
                sendToRenderer('jLinkProgress', errorMessage)
                sendToRenderer('programmingComplete')
                sendToRenderer('passFail', 'fail')
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

    sendToRenderer('message', "Packaged resource path" + process.resourcesPath)

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
            sendToRenderer('message', 'React Is Ready')


            if (listenersApplied === false) {
                listenersApplied = true
                createListeners()
                bootLog('Main IPC listeners created')

                wbmUsbDevice.startMonitoring()
                bootLog('USB monitoring started')

                wbmUsbDevice.on('progress', (list) => {
                    console.log('progress', list)
                    sendToRenderer('jLinkProgress', list)
                })

                tests.on('message', (message) => sendToRenderer('jLinkProgress', message))
            }

            if (app.isPackaged) {
                sendToRenderer('message', 'App is packaged')

                autoUpdater.on('checking-for-update', () => sendToRenderer('checkingForUpdates'))
                autoUpdater.on('update-available', () => sendToRenderer('updateAvailable'))
                autoUpdater.on('update-not-available', () => sendToRenderer('noUpdate'))
                autoUpdater.on('update-downloaded', (e, updateInfo, f, g) => { sendToRenderer('updateDownloaded', e) })
                autoUpdater.on('download-progress', (e) => { sendToRenderer('updateDownloadProgress', e.percent) })
                autoUpdater.on('error', (e, message) => {
                    console.log("updateError", e, message)
                    sendToRenderer('updateError', message)
                })


                // Check for new version of app every 30 minutes
                updateCheckInterval = setInterval(() => {
                    sendToRenderer('message', 'Interval Check for update')
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
        sendToRenderer('notifications', notifications)
    })

    ipcMain.on('clearAllNotifications', () => {
        clearAllNotifications()
    })

    createWindow()
})
///////////////////////

// Quit when all windows are closed.
app.on('window-all-closed', () => {
    shutdownApp().catch((error) => {
        bootLog(`Shutdown failed: ${truncateForLog(error?.message || error)}`)
        process.exit(1)
    })
})



app.on('activate', () => {
    if (win === null) {
        createWindow()
    }
})

////////////////// END App Startup ///////////////////////////////////////////////////////////////
