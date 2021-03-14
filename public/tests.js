let SerialPort = require('serialport')
let ByteLength = require('@serialport/parser-byte-length')

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
        /*
        {
            cmd: 'TLC0',
            expectedChars: [0xd2, 0xd4]
        },
        {
            cmd: 'TLC1',
            expectedChars: [0xd2, 0xd4]
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
            cmd: 'ADC',
            expectedChars: [0x08]
        }
        */
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
            //console.log(data)
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
    console.log('>>>>>> FINISHED TESTS <<<<<<')
    port.close()
}

const startTest = (board, thePort) => {
    let testListObj = {}
    switch (board) {

        case 'cvboard':
            testListObj = cvBoardTests
            break;

        default:
            break;
    }

    return new Promise((resolve, reject) => {
        port = new SerialPort(thePort)

        ///////   Test Sequence
        port.on('open', async () => {
            port.on('close', () => {
                resolve('Passed Tests')
            })

            runTests(testListObj)
        })
    })
}

exports.runTests = startTest