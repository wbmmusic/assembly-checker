const { contextBridge, ipcRenderer } = require('electron')
const { join } = require('path')

contextBridge.exposeInMainWorld(
    'api', {
    send: (channel, data) => {
        ipcRenderer.send(channel, data)
    },
    receive: (channel, func) => {
        ipcRenderer.on(channel, (event, ...args) => {
            //console.log(channel, args)
            func(event, ...args)
        })
    },
    invoke: (a, b) => ipcRenderer.invoke(a, b),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    join: join
})