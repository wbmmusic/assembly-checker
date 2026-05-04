let { SerialPort } = require('serialport')
let { ByteLengthParser } = require('@serialport/parser-byte-length')
const EventEmitter = require('events')
const myEmitter = new EventEmitter();

let port = null

const isBenignPortError = (error) => {
    const msg = (error?.message || String(error || '')).toLowerCase()
    return msg.includes('operation aborted') ||
        msg.includes('port is closing') ||
        msg.includes('cannot write to closed port')
}

const closePortSafe = () => {
    return new Promise((resolve) => {
        if (!port || !port.isOpen) {
            resolve()
            return
        }
        port.close((err) => {
            if (err && !isBenignPortError(err)) {
                console.log('Serial close error:', err?.message || err)
            }
            resolve()
        })
    })
}

const macTest = {
    cmd: 'MAC',
    expectedChars: [0xFC, 0xC2, 0x3D]
}

const usbTest = {
    cmd: 'USB SERIAL',
    expectedChars: [0xC3],
    time: 1200
}

const sx0Test = {
    cmd: 'SX0',
    expectedChars: [0x00, 0xFF]
}

const sx1Test = {
    cmd: 'SX1',
    expectedChars: [0x00, 0xFF]
}

const tlc0Test = {
    cmd: 'TLC0',
    expectedChars: [0xD2]
}

const tlc1Test = {
    cmd: 'TLC1',
    expectedChars: [0xD2]
}

const adcTest = {
    cmd: 'ADC',
    expectedChars: [0xfc]
}

const wizTest = {
    cmd: 'WIZ',
    expectedChars: [0x04] ////////////////////////// should be 0x04
}

const initMemory = {
    cmd: 'INITMEMORY',
    expectedChars: [0xAB],
    time: 100
}

const cvBoardTests = { automated: [usbTest, macTest, wizTest, initMemory] }
const gpoBoardTests = { automated: [usbTest, macTest, sx0Test, wizTest, initMemory] }
const gpiBoardTests = { automated: [usbTest, macTest, sx0Test, wizTest, initMemory] }
const midiBoardTests = { automated: [usbTest, macTest, wizTest, initMemory] }
const serialBoardTests = { automated: [usbTest, macTest, wizTest, initMemory] }
const controlPanelTests = { automated: [usbTest, macTest, sx0Test, sx1Test, tlc0Test, tlc1Test, adcTest, wizTest, initMemory] }
const alarmPanelTests = { automated: [usbTest, macTest, sx0Test, wizTest, initMemory] }

/**
 * Runs a single automated test command on the connected device via serial port.
 * Sends command, waits for response, checks expected bytes, and resolves with result.
 * @param {Object} test - Test definition with command, timeout, and expected response bytes.
 * @returns {Promise<string>} Test result string.
 */
const automatedTest = ({ cmd, time = 20, expectedChars }) => {
    const parser = port.pipe(new ByteLengthParser({ length: expectedChars.length }))

    return new Promise((resolve) => {
        let done = false

        const exitTest = (msg) => {
            if (done) return
            done = true
            clearTimeout(testTimer)
            parser.removeAllListeners()
            port.unpipe(parser)
            resolve(msg)
        }

        const testTimer = setTimeout(() => {
            exitTest(`> FAILED ->  ${cmd} --> Timeout`)
        }, time)

        parser.on('data', function (data) {
            if (expectedChars.every((val, i) => val === data[i])) {
                exitTest(`> PASSED ${cmd}`)
            } else {
                let out = []
                data.forEach(byte => {
                    let text = byte.toString(16).toUpperCase()
                    if (text.length === 1) text = '0' + text
                    out.push(text)
                })
                exitTest(`> FAILED -> ${cmd} --> Result = ` + out)
            }
        })

        port.write('WBM TEST:' + cmd, (err) => {
            if (err) {
                if (isBenignPortError(err)) {
                    exitTest(`> FAILED ->  ${cmd} --> Timeout`)
                } else {
                    exitTest(`> FAILED ->  ${cmd} --> Write Error`)
                }
            }
        })
    })
}

/**
 * Runs all automated tests for a board, optionally skipping INITMEMORY.
 * Aggregates results and throws on first failure.
 * @param {Array<Object>} tests - List of test definitions.
 * @param {boolean} skipInit - Whether to skip INITMEMORY test.
 * @returns {Promise<Array<string>>} Array of test result strings.
 */
const runAutomatedTests = async (tests, skipInit) => {
    const results = []

    await tests.reduce(async (acc, test) => {
        await acc
        if (skipInit && test.cmd === "INITMEMORY") {
            console.log("Skipping Init Memory")
        } else {
            const result = await automatedTest(test)
            if (result.includes('FAIL')) {
                results.push(result)
                throw new Error(JSON.stringify({ data: results }))
            }
            results.push(result)
        }

    }, Promise.resolve([]))

    return results
}

/**
 * Runs the full test sequence for a board, timing execution and aggregating results.
 * @param {Object} board - Board test definition object.
 * @param {boolean} skipInit - Whether to skip INITMEMORY test.
 * @returns {Promise<Array<string>>} Array of test result strings.
 */
const runTests = async (board, skipInit) => {

    return new Promise(async (resolve, reject) => {
        try {
            let startTime = Date.now()
            const autTestResults = await runAutomatedTests(board.automated, skipInit)
            //autTestResults.forEach(result => console.log(result))
            const now = (Date.now() - startTime).toString() + 'ms'
            console.log('Automated test duration: ' + now)
            //autTestResults.push('Automated test duration: ' + now)
            await closePortSafe()
            resolve(autTestResults)
        } catch (error) {
            await closePortSafe()
            try {
                reject(JSON.parse(error.message).data)
            } catch {
                reject([error?.message || String(error)])
            }
        }
    })


}

const startTest = async (testListObj, skipInit, preferredPath) => {
    return new Promise((resolve, reject) => {
        const maxAttempts = 12
        const retryDelayMs = 250
        const isControlPanel = testListObj === controlPanelTests
        let attempts = 0

        const openPortAndRun = (path, portAttempt = 0) => {
            console.log("Testing device at", path, portAttempt > 0 ? `(port retry ${portAttempt})` : '')
            port = new SerialPort({ path, baudRate: 256000 })

            port.on('error', (err) => {
                if (isBenignPortError(err)) {
                    return
                }
                console.log('Serial port error:', err?.message || err)
                // Port open failed (e.g. "File not found" — device still re-enumerating after flash).
                // Fall back to the scan-and-retry loop so we keep trying until the COM port is stable.
                closePortSafe().then(() => {
                    attempts += 1
                    if (attempts < maxAttempts) {
                        setTimeout(tryFindAndStart, retryDelayMs)
                    } else {
                        reject('Device port could not be opened after ' + maxAttempts + ' attempts')
                    }
                })
            })

            port.on('open', async () => {
                // Longer settle on retries — firmware CDC stack may not be ready yet after fresh flash
                const settleMs = portAttempt === 0 ? (isControlPanel ? 1700 : 1200) : 1500
                await new Promise(r => setTimeout(r, settleMs))
                try {
                    let results = await runTests(testListObj, skipInit)
                    resolve(results)
                } catch (error) {
                    // If every failure is a Timeout, the CDC stack wasn't ready — reopen port to re-trigger DTR
                    const allTimeouts = Array.isArray(error) && error.every(e => typeof e === 'string' && e.includes('Timeout'))
                    if (allTimeouts && portAttempt < 3) {
                        console.log(`Port retry ${portAttempt + 1}: closing port and re-triggering DTR`)
                        closePortSafe().then(() => setTimeout(() => openPortAndRun(path, portAttempt + 1), 500))
                    } else {
                        reject([...error, "FAILED TESTS"])
                    }
                }
            })
        }

        const tryFindAndStart = () => {
            SerialPort.list().then((ports) => {
                // Prefer a known-good COM path from reconnect detection first.
                if (preferredPath) {
                    const byPath = ports.find((p) => p.path === preferredPath)
                    if (byPath) {
                        openPortAndRun(byPath.path)
                        return
                    }
                }

                let goodPorts = []
                ports.forEach((portInfo) => {
                    if (portInfo.serialNumber && portInfo.serialNumber.includes('WBM:')) {
                        goodPorts.push(portInfo)
                    }
                })

                if (goodPorts.length === 1) {
                    openPortAndRun(goodPorts[0].path)
                    return
                }

                attempts += 1
                if (attempts < maxAttempts) {
                    setTimeout(tryFindAndStart, retryDelayMs)
                    return
                }

                if (goodPorts.length < 1) reject('Didn\'t find a device')
                else if (goodPorts.length > 1) reject('Found more than one WBM device')
                else reject('Unknown error detecting device')
            }).catch((error) => {
                console.log("ERROR XXX", error)
                reject(error?.message || 'Error listing serial ports')
            })
        }

        tryFindAndStart()
    })
}

const configureAndStartTest = async (board, skipInit, preferredPath) => {
    return new Promise(async (resolve, reject) => {
        const mapToTests = () => {
            switch (board) {
                case 'cvboard':
                    return cvBoardTests

                case 'gpoboard':
                    return gpoBoardTests

                case 'gpiboard':
                    return gpiBoardTests

                case 'midiboard':
                    return midiBoardTests

                case 'serialboard':
                    return serialBoardTests

                case 'controlpanel':
                    return controlPanelTests

                case 'alarmpanel':
                    return alarmPanelTests

                default:
                    return 'XXX'
            }
        }

        let target = mapToTests()

        try {
            if (target !== 'XXX') {
                let results = await startTest(target, skipInit, preferredPath)
                resolve(results)
            } else reject(['No Device'])
        } catch (error) {
            reject(error)
        }

        port = null
    })

}

module.exports = myEmitter
module.exports.runTests = configureAndStartTest
module.exports.closePort = closePortSafe