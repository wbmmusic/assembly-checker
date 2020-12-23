import React, { Fragment, useState } from 'react'
import { Route, Switch, useHistory } from 'react-router-dom'
import ControlPanel from './boards/controlpanel/ControlPanel'
import AlarmPanel from './boards/alarmpanel/AlarmPanel'
import CvBoard from './boards/cvboard/CvBoard'
import GpiBoard from './boards/gpiboard/GpiBoard'
import GpoBoard from './boards/gpoboard/GpoBoard'
import MidiBoard from './boards/midiboard/MidiBoard'
import SerialBoard from './boards/serialboard/SerialBoard'
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
                        </tr>
                    </tbody>
                </table>
            </div>
            <div style={{ padding: '10px', height: '100%', overflow: 'hidden' }}>
                    <Switch>
                        <Route exact path="/controlpanel" component={ControlPanel} />
                        <Route exact path="/alarmpanel" component={AlarmPanel} />
                        <Route exact path="/cvboard" component={CvBoard} />
                        <Route exact path="/gpiboard" component={GpiBoard} />
                        <Route exact path="/gpoboard" component={GpoBoard} />
                        <Route exact path="/midiboard" component={MidiBoard} />
                        <Route exact path="/serialboard" component={SerialBoard} />
                        <Route path="/"><div style={{ textAlign: 'center' }}><b>No board selected</b></div></Route>
                    </Switch>
            </div>
        </Fragment >
    )
}

const buttonStyle = {
    paddingLeft: '10px'
}