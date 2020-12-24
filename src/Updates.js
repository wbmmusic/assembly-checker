import React, { useEffect, useState } from 'react'
const { ipcRenderer } = window.require('electron')

export default function Updates() {
    const [popupContents, setPopupContents] = useState({
        show: false,
        progress: 0,
        contents: []
    })

    const hidePopup = () => {
        let tempPopupContents = { ...popupContents }
        tempPopupContents.show = false
        setPopupContents(tempPopupContents)
    }
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
                                    <progress style={{ width: '100%' }} max="100" value={popupContents.progress} />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <button onClick={() => hidePopup()}>close</button>
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
                                    <button onClick={() => setPopupContents()}>Update on exit</button>
                                </td>
                                <td>
                                    <button onClick={() => {
                                        ipcRenderer.send('installUpdate')
                                        hidePopup()
                                    }}>Update and restart app now</button>
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

        ipcRenderer.on('updateDownloadProgress', (e, progressPercent) => {
            console.log('Downloaded', progressPercent + '%')
            let tempPopupContents = { ...popupContents }
            tempPopupContents.progress = progressPercent
            setPopupContents(tempPopupContents)
        })


        return () => {
            ipcRenderer.removeAllListeners('checkingForUpdates')
            ipcRenderer.removeAllListeners('updateAvailable')
            ipcRenderer.removeAllListeners('noUpdate')
            ipcRenderer.removeAllListeners('updateError')
            ipcRenderer.removeAllListeners('updateDownloaded')
        }
    }, [])

    const makePopup = () => {
        if (popupContents !== null) {
            return (
                <div style={{ position: 'fixed', bottom: '10px', right: '10px', padding: '10px', boxShadow: '2px, 2px, 3px, 3px', fontSize: '12px' }}>
                    {popupContents.contents}
                </div>
            )
        }
    }

    return (
        makePopup()
    )
}
