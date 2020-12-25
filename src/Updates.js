import React, { useEffect, useState } from 'react'
const { ipcRenderer } = window.require('electron')

export default function Updates() {
    const [popupContents, setPopupContents] = useState({
        show: false,
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
            let tempPopupContents = { ...popupContents }
            tempPopupContents.show = true
            tempPopupContents.contents = (
                <div>
                    A new version is being downloaded
                    <table style={{ width: '100%' }}>
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

            setPopupContents(tempPopupContents)
        })

        ipcRenderer.on('noUpdate', () => {
            console.log('Up to date')
        })

        ipcRenderer.on('updateDownloaded', (e, releaseInfo) => {
            console.log('Update Downloaded')
            //console.log(releaseInfo)
            let tempPopupContents = { ...popupContents }
            tempPopupContents.show = true
            tempPopupContents.contents = (
                <div>
                    <p>New update {"v" + releaseInfo.version} downloaded</p>
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

            setPopupContents(tempPopupContents)
        })

        ipcRenderer.on('updateError', (error) => {
            console.log('Update Error', error,)
        })

        ipcRenderer.on('updateDownloadProgress', (e, progressPercent) => {
            console.log('Downloaded Progress')
            console.log(progressPercent)
            let tempPopupContents = { ...popupContents }
            tempPopupContents.contents = (
                <div>
                    A new version is being downloaded
                    <table style={{ width: '100%' }}>
                        <tbody>
                            <tr>
                                <td>
                                    <progress style={{ width: '100%' }} max="100" value={progressPercent} />
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
        if (popupContents.show === true) {
            return (
                <div style={{ position: 'fixed', bottom: '10px', right: '10px', padding: '10px', boxShadow: '3px 3px 3px', fontSize: '12px' }}>
                    {popupContents.contents}
                </div>
            )
        } else {
            return <div></div>
        }
    }

    return (
        makePopup()
    )
}
