import React, { Fragment, useState } from 'react'
import { Route, Switch, useHistory } from 'react-router-dom'
import ControlPanel from './boards/ControlPanel'
import AlarmPanel from './boards/alarmpanel/AlarmPanel'
import CvBoard from './boards/CvBoard'
import GpiBoard from './boards/GpiBoard'
import GpoBoard from './boards/GpoBoard'
import MidiBoard from './boards/MidiBoard'
import SerialBoard from './boards/SerialBoard'
import { Button } from 'react-bootstrap'
const { ipcRenderer } = window.require('electron')

export default function Top(props) {
    const [buttonDisable, setButtonDisable] = useState(true)
    const history = useHistory()

    const boards = [
        "---",
        "Control Panel",
        "Alarm Panel",
        "CV Board",
        "GPI Board",
        "GPO Board",
        "MIDI Board",
        "Serial Board"
    ]

    const setBoard = (board) => {
        switch (board) {
            case 'Control Panel':
                setButtonDisable(false)
                history.replace('/controlpanel')
                break;

            case 'Alarm Panel':
                setButtonDisable(false)
                history.replace('/alarmpanel')
                break;

            case 'CV Board':
                setButtonDisable(false)
                history.replace('/cvboard')
                break;

            case 'GPI Board':
                setButtonDisable(false)
                history.replace('/gpiboard')
                break;

            case 'GPO Board':
                setButtonDisable(false)
                history.replace('/gpoboard')
                break;

            case 'MIDI Board':
                setButtonDisable(false)
                history.replace('/midiboard')
                break;

            case 'Serial Board':
                setButtonDisable(false)
                history.replace('/serialboard')
                break;

            default:
                setButtonDisable(true)
                history.replace('/')
                break;
        }
    }

    const program = () => {
        console.log('Program')
    }

    const chipErase = () => {
        console.log('Chip Erase')
    }

    return (
        <Fragment>
            <div style={{ padding: '10px', borderBottom: '1px solid lightGrey', width: '100%' }}>
                <table>
                    <tbody>
                        <tr>
                            <td><b>Board:</b></td>
                            <td>
                                <select onChange={(e) => setBoard(e.target.value)}>
                                    {boards.map((brd, idx) => <option key={'brdOption' + idx}>{brd}</option>)}
                                </select>
                            </td>
                            <td style={buttonStyle} onClick={program} ><Button size="sm" variant="outline-primary" disabled={buttonDisable} >Program</Button></td>
                            <td style={buttonStyle} onClick={chipErase} ><Button size="sm" variant="outline-danger" disabled={buttonDisable} >Chip Erase</Button></td>
                            <td style={buttonStyle} onClick={() => ipcRenderer.send('loadFirmware', 'blinkSlow.bin')} ><Button size="sm" variant="outline-success">Slow</Button></td>
                            <td style={buttonStyle} onClick={() => ipcRenderer.send('loadFirmware', 'blinkFast.bin')} ><Button size="sm" variant="outline-success">Fast</Button></td>
                        </tr>
                        <tr>
                            <td colSpan="3" style={{ fontSize: '12px' }} >The File Name</td>
                            <td style={{ fontSize: '12px' }} >{props.msgs}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '10px', maxHeight: '100%', overflow: 'hidden' }}>
                SWITCH
            </div>
        </Fragment >
    )
}

const buttonStyle = {
    paddingLeft: '10px'
}