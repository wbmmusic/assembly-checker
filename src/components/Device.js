import React, { useEffect, useRef, useState } from 'react'
import { Button, Navbar } from 'react-bootstrap'
import { useLocation, useNavigate } from 'react-router'
const { ipcRenderer } = window.require('electron')
const path = require('path')

export default function Device() {
    const navigate = useNavigate()
    const location = useLocation()
    const [termText, setTermText] = useState([])
    const termRef = useRef(null)

    console.log("DEVICE")
    console.log(location)

    const program = () => {
        console.log('Program')
        setTermText([])
        ipcRenderer.send('programAndTest', location.state.folder)
    }

    const chipErase = () => {
        console.log('Top Chip Erase')
        setTermText([])
        ipcRenderer.send('chipErase')
    }

    useEffect(() => {
        ipcRenderer.on('jLinkProgress', (e, theMessage) => {
            console.log('JLINK-->>', theMessage)
            setTermText((oldTerm) => ([...oldTerm, theMessage.split('\r\n')]))
        })
        return () => {
            ipcRenderer.removeAllListeners('jLinkProgress')
        }
    }, [])

    // Keep div scrolled to bottom
    useEffect(() => {
        termRef.current.scrollTop = termRef.current.scrollHeight;
    }, [termText])

    return (
        <div style={{ height: '100vh', width: '100vw' }}>
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'hidden' }}>
                <Navbar bg="light" expand="lg">
                    <Navbar.Brand style={{ marginLeft: '8px' }}>{location.state.boardName}</Navbar.Brand>
                    <Button style={{ marginRight: '8px' }} size="sm" variant="outline-primary" onClick={() => navigate('/', { replace: true })} >Back To Boards</Button>
                </Navbar>
                <div style={{ padding: '0px 10px 10px 10px', height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <div>
                        <table style={{ width: '100%' }} cellSpacing="0" cellPadding="0">
                            <tbody>
                                <tr>
                                    <td style={{ borderRight: '1px solid lightGrey', width: '1px', padding: '5px' }}>
                                        <img style={{ maxWidth: '300px', maxHeight: '200px' }} src={path.join('boardfiles', location.state.folder, 'render.png')} alt="brdImage" />
                                    </td>
                                    <td>
                                        <table>
                                            <tbody>
                                                <tr>
                                                    <td style={buttonStyle} onClick={program} ><Button size="sm" variant="outline-primary"  >Program and Test</Button></td>
                                                </tr>
                                                <tr>
                                                    <td style={buttonStyle} onClick={chipErase} ><Button size="sm" variant="outline-danger"  >Chip Erase</Button></td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div
                        ref={termRef}
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            padding: '10px',
                            width: '100%',
                            height: '100%',
                            border: '1px solid lightGrey',
                            overflowY: 'auto',
                            fontSize: '12px'
                        }}
                    >
                        {
                            termText.map((line, idx) => (<div key={'line' + idx}>{line}</div>))
                        }
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