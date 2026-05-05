const { SerialPort } = require('serialport')

const tests = [
  { cmd: 'USB SERIAL', expected: [0xC3], timeout: 300 },
  { cmd: 'MAC', expected: [0xFC, 0xC2, 0x3D], timeout: 200 },
  { cmd: 'SX0', expected: [0x00, 0xFF], timeout: 200 },
  { cmd: 'SX1', expected: [0x00, 0xFF], timeout: 200 },
  { cmd: 'TLC0', expected: [0xD2], timeout: 200 },
  { cmd: 'TLC1', expected: [0xD2], timeout: 200 },
  { cmd: 'ADC', expected: [0xFC], timeout: 200 },
  { cmd: 'WIZ', expected: [0x04], timeout: 200 },
  { cmd: 'INITMEMORY', expected: [0xAB], timeout: 100 }
]

const toHex = (arr) => Buffer.from(arr).toString('hex').toUpperCase().match(/.{1,2}/g)?.join(' ') || ''

async function runSingleTest(port, test) {
  const rxChunks = []
  const onData = (d) => rxChunks.push(d)
  port.on('data', onData)

  await new Promise((resolve, reject) => {
    port.write('WBM TEST:' + test.cmd, (err) => (err ? reject(err) : resolve()))
  })

  await new Promise((r) => setTimeout(r, test.timeout))
  port.off('data', onData)

  const rx = Buffer.concat(rxChunks)
  const status = (() => {
    if (rx.length < test.expected.length) return 'TIMEOUT'
    const first = [...rx.subarray(0, test.expected.length)]
    return first.every((b, i) => b === test.expected[i]) ? 'PASS' : 'FAIL'
  })()

  return {
    cmd: test.cmd,
    rxHex: rx.length ? toHex([...rx]) : '(none)',
    expectedHex: toHex(test.expected),
    status
  }
}

async function main() {
  const ports = await SerialPort.list()
  const target =
    ports.find((p) => p.path === 'COM9') ||
    ports.find((p) => p.serialNumber && p.serialNumber.includes('WBM:'))

  if (!target) {
    console.error('No COM9 or WBM device found')
    process.exit(1)
  }

  console.log('Using port:', target.path, target.serialNumber || '')

  const port = new SerialPort({ path: target.path, baudRate: 256000 })

  await new Promise((resolve, reject) => {
    port.once('error', reject)
    port.once('open', resolve)
  })

  await new Promise((r) => setTimeout(r, 100))

  const results = []
  for (const test of tests) {
    try {
      const result = await runSingleTest(port, test)
      results.push(result)
      console.log(`${result.cmd.padEnd(10)} | RX ${result.rxHex.padEnd(20)} | EXP ${result.expectedHex.padEnd(8)} | ${result.status}`)
    } catch (error) {
      results.push({ cmd: test.cmd, rxHex: '(error)', expectedHex: toHex(test.expected), status: 'ERROR' })
      console.log(`${test.cmd.padEnd(10)} | RX (error)             | EXP ${toHex(test.expected).padEnd(8)} | ERROR`)
    }
    await new Promise((r) => setTimeout(r, 40))
  }

  const pass = results.filter((r) => r.status === 'PASS').length
  const fail = results.filter((r) => r.status === 'FAIL').length
  const timeout = results.filter((r) => r.status === 'TIMEOUT').length
  const error = results.filter((r) => r.status === 'ERROR').length
  console.log(`SUMMARY PASS=${pass} FAIL=${fail} TIMEOUT=${timeout} ERROR=${error}`)

  await new Promise((resolve) => port.close(() => resolve()))
}

main().catch((err) => {
  console.error('Serial test failed:', err?.message || err)
  process.exit(1)
})
