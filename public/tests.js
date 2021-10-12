let SerialPort = require('serialport')
let ByteLength = require('@serialport/parser-byte-length')
const EventEmitter = require('events')
const myEmitter = new EventEmitter();

let port = null

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

const runAutomatedTests = async (tests) => {
    const results = []

    await tests.reduce(async (acc, test) => {
        await acc
        const result = await automatedTest(test)
        if (result.includes('FAIL')) {
            results.push(result)
            throw new Error(JSON.stringify({ data: results }))
        }
        results.push(result)
    }, Promise.resolve([]))

    return results
}

const runTests = async (board) => {

    return new Promise(async (resolve, reject) => {
        try {
            let startTime = Date.now()
            const autTestResults = await runAutomatedTests(board.automated)
            //autTestResults.forEach(result => console.log(result))
            const now = (Date.now() - startTime).toString() + 'ms'
            console.log('Automated test duration: ' + now)
            //autTestResults.push('Automated test duration: ' + now)
            port.close()
            resolve(autTestResults)
        } catch (error) {
            port.close()
            reject(JSON.parse(error.message).data)
        }
    })


}

const startTest = async (testListObj) => {
    return new Promise((resolve, reject) => {
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
                port.on('open', async () => {
                    try {
                        let results = await runTests(testListObj)
                        resolve(results)
                    } catch (error) {
                        reject([...error, "FAILED TESTS"])
                    }
                })
            }
            else if (goodPorts.length < 1) reject('Didn\'t find a device')
            else if (goodPorts.length > 1) reject('Found more than one WBM device')
            else reject('Unknown error detecting device')
        })
    })
}

const configureAndStartTest = async (board) => {
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
                let results = await startTest(target)
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