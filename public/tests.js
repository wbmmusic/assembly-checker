let SerialPort = require('serialport')
let ByteLength = require('@serialport/parser-byte-length')
const EventEmitter = require('events')
const myEmitter = new EventEmitter();

let port = null

// TEST OBJECTS
const cvBoardTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const gpoBoardTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'SX0',
            expectedChars: [0x00, 0xFF]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const gpiBoardTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'SX0',
            expectedChars: [0x00, 0xFF]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const midiBoardTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const serialBoardTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const controlPanelTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'SX0',
            expectedChars: [0x00, 0xFF]
        },
        {
            cmd: 'SX1',
            expectedChars: [0x00, 0xFF]
        },
        {
            cmd: 'TLC0',
            expectedChars: [0xD2]
        },
        {
            cmd: 'TLC1',
            expectedChars: [0xd2]
        },
        {
            cmd: 'ADC',
            expectedChars: [0xfc]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const alarmPanelTests = {
    automated: [
        {
            cmd: 'USB SERIAL',
            expectedChars: [0xC3]
        },
        {
            cmd: 'MAC',
            expectedChars: [0xFC, 0xC2, 0x3D]
        },
        {
            cmd: 'SX0',
            expectedChars: [0x00, 0xFF]
        },
        {
            cmd: 'WIZ',
            expectedChars: [0x04]
        },
        {
            cmd: 'INITMEMORY',
            expectedChars: [0xAB],
            time: 100
        }
    ]
}

const automatedTest = async ({ cmd, time = 20, expectedChars }) => {
    const parser = port.pipe(new ByteLength({ length: expectedChars.length }))
    port.write('WBM TEST:' + cmd)

    return new Promise((resolve, reject) => {
        let testTimer = setTimeout(() => {
            exitTest('FAILED -> Timeout')
        }, time);

        const exitTest = (msg) => {
            port.unpipe()
            clearTimeout(testTimer)
            resolve(`${msg} ${cmd}`)
        }

        parser.on('data', function (data) {
            console.log(data)
            if (expectedChars.every((val, i) => val === data[i])) {
                exitTest('PASSED')
            } else {
                exitTest('FAILED -> Data')
            }
        })
    })
}

const runAutomatedTests = async (tests) => {
    const results = []

    await tests.reduce(async (acc, test) => {
        await acc
        const result = await automatedTest(test)
        if (result.includes('FAIL')) {
            throw new Error(result)
        }
        results.push(result)
    }, Promise.resolve([]))

    return results
}

const runTests = async (board) => {
    console.log('>>>>>> STARTING TESTS <<<<<<')
    let startTime = Date.now()
    const autTestResults = await runAutomatedTests(board.automated)
    autTestResults.forEach(result => console.log(result))
    console.log('Automated test duration:', (Date.now() - startTime).toString() + 'ms')
    port.close()
    console.log('>>>>>> FINISHED TESTS <<<<<<')
}

const startTest = (testListObj) => {
    SerialPort.list().then((ports) => {
        //console.log(ports)
        let goodPorts = []
        ports.forEach(port => {
            if (port.serialNumber.includes('WBM:')) goodPorts.push(port)
        })

        if (goodPorts.length === 1) {
            console.log("Found device at", goodPorts[0].path)
            port = new SerialPort(goodPorts[0].path)

            ///////   Test Sequence
            port.on('open', () => {
                runTests(testListObj)
            })
        }
        else if (goodPorts.length < 1) console.log('Didn\'t find a device')
        else if (goodPorts.length > 1) console.log('Found more than one WBM device')
        else console.log('Unknown error detecting device')
    })
}

const configureAndStartTest = (board) => {
    switch (board) {
        case 'cvboard':
            startTest(cvBoardTests)
            break;

        case 'gpoboard':
            startTest(gpoBoardTests)
            break;

        case 'gpiboard':
            startTest(gpiBoardTests)
            break;

        case 'midiboard':
            startTest(midiBoardTests)
            break;

        case 'serialboard':
            startTest(serialBoardTests)
            break;

        case 'controlpanel':
            startTest(controlPanelTests)
            break;

        case 'alarmpanel':
            startTest(alarmPanelTests)
            break;

        default:
            break;
    }
    port = null
}

module.exports = myEmitter
module.exports.runTests = configureAndStartTest