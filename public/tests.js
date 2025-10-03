let { SerialPort } = require('serialport')
let { ByteLengthParser } = require('@serialport/parser-byte-length')
const EventEmitter = require('events')
const myEmitter = new EventEmitter();

let port = null

const macTest = {
    cmd: 'MAC',
    expectedChars: [0xFC, 0xC2, 0x3D]
}

const usbTest = {
    cmd: 'USB SERIAL',
    expectedChars: [0xC3]
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
const automatedTest = async ({ cmd, time = 20, expectedChars }) => {
    const parser = port.pipe(new ByteLengthParser({ length: expectedChars.length }))
    port.write('WBM TEST:' + cmd)

    return new Promise((resolve, reject) => {
        let testTimer = setTimeout(() => {
            exitTest(`> FAILED ->  ${cmd} --> Timeout`)
        }, time);

        const exitTest = (msg) => {
            port.unpipe()
            clearTimeout(testTimer)
            resolve(msg)
        }

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
            port.close()
            resolve(autTestResults)
        } catch (error) {
            console.log(error)
            port.close()
            reject(JSON.parse(error.message).data)
        }
    })


}

const startTest = async (testListObj, skipInit) => {
    return new Promise((resolve, reject) => {
        SerialPort.list().then((ports) => {
            //console.log(ports)
            let goodPorts = []
            ports.forEach(port => {
                if (port.serialNumber) {
                    if (port.serialNumber.includes('WBM:')) goodPorts.push(port)
                }
            })

            if (goodPorts.length === 1) {
                console.log("Testing device at", goodPorts[0].path)
                port = new SerialPort({ path: goodPorts[0].path, baudRate: 256000 })

                ///////   Test Sequence
                port.on('open', async () => {
                    try {
                        let results = await runTests(testListObj, skipInit)
                        resolve(results)
                    } catch (error) {
                        reject([...error, "FAILED TESTS"])
                    }
                })
            } else if (goodPorts.length < 1) reject('Didn\'t find a device')
            else if (goodPorts.length > 1) reject('Found more than one WBM device')
            else reject('Unknown error detecting device')
        }).catch(error => console.log("ERROR XXX", error))
    })
}

const configureAndStartTest = async (board, skipInit) => {
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
                let results = await startTest(target, skipInit)
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