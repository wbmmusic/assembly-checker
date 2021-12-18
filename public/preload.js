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
    invoke: (channel, func) => {
        ipcRenderer.invoke(channel, (event, ...args) => {
            func(event, ...args)
        })
    },
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    join: join
})