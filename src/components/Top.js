import React from 'react'
import { Route, Switch, useHistory } from 'react-router-dom'
import ControlPanel from './boards/ControlPanel'
import AlarmPanel from './boards/AlarmPanel'
import CvBoard from './boards/CvBoard'
import GpiBoard from './boards/GpiBoard'
import GpoBoard from './boards/GpoBoard'
import MidiBoard from './boards/MidiBoard'
import SerialBoard from './boards/SerialBoard'

export default function Top(props) {
    const history = useHistory()

    const setBoard = (board) => {
        switch (board) {
            case 'Control Panel':
                history.replace('/controlpanel')
                break;

            case 'Alarm Panel':
                history.replace('/alarmpanel')
                break;

            case 'CV Board':
                history.replace('/cvboard')
                break;

            case 'GPI Board':
                history.replace('/gpiboard')
                break;

            case 'GPO Board':
                history.replace('/gpoboard')
                break;

            case 'MIDI Board':
                history.replace('/midiboard')
                break;

            case 'Serial Board':
                history.replace('/serialboard')
                break;

            default:
                history.replace('/')
                break;
        }
    }

    return (
        <div>
            <div style={{ padding: '10px' }}>
                {'Board: '}
                <select onChange={(e) => setBoard(e.target.value)}>
                    <option>---</option>
                    <option>Control Panel</option>
                    <option>Alarm Panel</option>
                    <option>CV Board</option>
                    <option>GPI Board</option>
                    <option>GPO Board</option>
                    <option>MIDI Board</option>
                    <option>Serial Board</option>
                </select>
            </div>
            <hr />
            <div style={{ padding: '10px' }}>
            
                <Switch>
                    <Route exact path="/controlpanel" component={ControlPanel} />
                    <Route exact path="/alarmpanel" component={AlarmPanel} />
                    <Route exact path="/cvboard" component={CvBoard} />
                    <Route exact path="/gpiboard" component={GpiBoard} />
                    <Route exact path="/gpoboard" component={GpoBoard} />
                    <Route exact path="/midiboard" component={MidiBoard} />
                    <Route exact path="/serialboard" component={SerialBoard} />
                    <Route path="/"><b>No board selected</b>{props.msgs}</Route>
                </Switch>
                
            </div>
        </div>
    )
}
