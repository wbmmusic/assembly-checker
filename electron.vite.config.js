const { defineConfig } = require('electron-vite')
const react = require('@vitejs/plugin-react')
const path = require('path')

module.exports = defineConfig({
    main: {
        build: {
            outDir: 'build',
            emptyOutDir: false,
            lib: {
                entry: path.resolve(__dirname, 'public/main.js'),
                formats: ['cjs'],
                fileName: () => 'main.js'
            },
            rollupOptions: {
                external: [
                    'electron',
                    'serialport',
                    'wbm-usb-device',
                    '@wbm-tek/version-manager',
                    'electron-updater'
                ]
            }
        }
    },
    preload: {
        build: {
            outDir: 'build',
            emptyOutDir: false,
            lib: {
                entry: path.resolve(__dirname, 'public/preload.js'),
                formats: ['cjs'],
                fileName: () => 'preload.js'
            },
            rollupOptions: {
                external: ['electron', 'path']
            }
        }
    },
    renderer: {
        root: '.',
        build: {
            outDir: 'build',
            emptyOutDir: false,
            rollupOptions: {
                input: {
                    app: path.resolve(__dirname, 'index.html')
                }
            }
        },
        plugins: [react()]
    }
})
