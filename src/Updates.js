import React, { useEffect, useState } from 'react'
const { ipcRenderer } = window.require('electron')

export default function Updates() {
    const [show, setShow] = useState(false)
    const [popupContents, setPopupContents] = useState({
        contents: []
    })

    useEffect(() => {
        console.log('Top Of Updates')
        ipcRenderer.on('checkingForUpdates', () => {
            console.log('Checking for updates')
        })

        ipcRenderer.on('updateAvailable', () => {
            console.log('Downloading update')
            let tempPopupContents = { ...popupContents }
            tempPopupContents.contents = (
                <div>
                    A new version is being downloaded
                    <table style={{ width: '100%' }}>
                        <tbody>
                            <tr>
                                <td>
                                    <progress style={{ width: '100%' }} max={100} value="0" />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <button onClick={() => setShow(false)}>close</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )

            setPopupContents(tempPopupContents)
            setShow(true)
        })

        ipcRenderer.on('noUpdate', () => {
            console.log('Up to date')
        })

        ipcRenderer.on('updateDownloaded', (e, releaseInfo) => {
            console.log('Update Downloaded')
            //console.log(releaseInfo)
            let tempPopupContents = { ...popupContents }
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
                                        setShow(false)
                                    }}>Update and restart app now</button>
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            )

            setPopupContents(tempPopupContents)
            setShow(true)
        })

        ipcRenderer.on('updateError', (error) => {
            console.log('Update Error', error,)
        })

        ipcRenderer.on('updateDownloadProgress', (e, progressPercent) => {
            let tempPopupContents = { ...popupContents }
            tempPopupContents.contents = (
                <div>
                    A new version is being downloaded
                    <table style={{ width: '100%' }}>
                        <tbody>
                            <tr>
                                <td>
                                    <progress style={{ width: '100%' }} max="100" value={Math.round(progressPercent).toString()} />
                                </td>
                            </tr>
                            <tr>
                                <td>
                                    <button onClick={() => setShow(false)}>hide</button>
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
            ipcRenderer.removeAllListeners('updateDownloadProgress')
        }
    }, [])

    const makePopup = () => {
        if (show === true) {
            return (
                <div style={{ position: 'fixed', bottom: '10px', right: '10px', backgroundColor: 'white', padding: '10px', boxShadow: '0px 0px 6px 2px', fontSize: '12px' }}>
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
