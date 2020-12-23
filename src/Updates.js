import React, { useEffect, useState } from 'react'
const { ipcRenderer } = window.require('electron')

export default function Updates() {
    const [popupContents, setPopupContents] = useState('Popup Contents')
    useEffect(() => {
        ipcRenderer.on('checkingForUpdates', () => {
            console.log('Checking for updates')
        })

        ipcRenderer.on('updateAvailable', () => {
            console.log('Downloading update')
            setPopupContents(
                <div>
                    <p>A new version is being downloaded</p>
                    <table>
                        <tbody>
                            <tr>
                                <td>
                                    <button onClick={() => setPopupContents()}>close</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )
        })

        ipcRenderer.on('noUpdate', () => {
            console.log('Up to date')
        })

        ipcRenderer.on('updateDownloaded', (e, releaseNotes, releaseName) => {
            console.log('Update Downloaded', releaseName, releaseNotes)
            setPopupContents(
                <div>
                    <p>New update downloaded</p>
                    <table>
                        <tbody>
                            <tr>
                                <td>
                                    <button onClick={() => setPopupContents()}>Install on exit</button>
                                </td>
                                <td>
                                    <button onClick={() => {
                                        ipcRenderer.send('installUpdate')
                                        setPopupContents()
                                    }}>Install and restart app now</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )
        })

        ipcRenderer.on('updateError', (e, error) => {
            console.log('Update Error', error,)
        })


        return () => {
            ipcRenderer.removeAllListeners('checkingForUpdates')
            ipcRenderer.removeAllListeners('updateAvailable')
            ipcRenderer.removeAllListeners('noUpdate')
            ipcRenderer.removeAllListeners('updateError')
        }
    }, [])

    return (
        <div style={{ position: 'fixed', bottom: '10px', right: '10px', padding: '10px', border: '1px solid black', fontSize: '12px' }}>
            {popupContents}
        </div>
    )
}
