import React from 'react'
import { Button } from 'react-bootstrap'
import { useHistory } from 'react-router'
const { ipcRenderer } = window.require('electron')
const path = require('path')

export default function Device() {
    const history = useHistory()

    console.log(history.location.state)


    const program = () => {
        console.log('Program')
    }

    const chipErase = () => {
        console.log('Top Chip Erase')
        ipcRenderer.send('chipErase')
    }

    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
                <div style={{ padding: '10px', borderBottom: '1px solid lightGrey' }}>
                    <table style={{ width: '100%' }}>
                        <tbody>
                            <tr>
                                <td style={{ whiteSpace: 'nowrap' }}><b>{history.location.state.boardName}</b></td>
                                <td style={{ ...buttonStyle, textAlign: 'right', width: '100%' }} onClick={() => history.replace('/')} ><Button size="sm" variant="primary">Back To Devices</Button></td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                <div style={{ padding: '10px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div>
                        <table style={{ width: '100%' }} cellSpacing="0" cellPadding="0">
                            <tbody>
                                <tr>
                                    <td style={{ borderRight: '1px solid lightGrey', width: '1px', padding: '5px' }}>
                                        <img style={{ maxWidth: '300px', maxHeight: '200px' }} src={path.join('boardfiles', history.location.state.folder, 'render.png')} alt="brdImage" />
                                    </td>
                                    <td>
                                        <table>
                                            <tbody>
                                                <tr>
                                                    <td style={buttonStyle} onClick={program} ><Button size="sm" variant="outline-primary"  >Program</Button></td>
                                                    <td style={buttonStyle} onClick={chipErase} ><Button size="sm" variant="outline-danger"  >Chip Erase</Button></td>
                                                    <td style={buttonStyle} onClick={() => ipcRenderer.send('loadFirmware', 'fwTest.bin')} ><Button size="sm" variant="outline-success">Good</Button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div style={{ height: '100%' }}>
                        <div style={{ padding: '10px', width: '100%', height: '100%', border: '1px solid lightGrey' }}>
                            Terminal
                    </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

const buttonStyle = {
    paddingLeft: '10px',
    whiteSpace: 'noWrap'
}