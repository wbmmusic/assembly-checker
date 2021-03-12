import React from 'react'
import { Button, Navbar } from 'react-bootstrap'
import { useHistory } from 'react-router'
const path = require('path')

export default function SelectDevice() {
    const history = useHistory()

    let boards = [
        'alarmpanel',
        'controlpanel',
        'cvboard',
        'gpiboard',
        'gpoboard',
        'midiboard',
        'serialboard'
    ]

    const makeBoardName = (board) => {
        switch (board) {
            case 'alarmpanel':
                return 'Alarm Panel'

            case 'controlpanel':
                return 'Control Panel'

            case 'cvboard':
                return 'CV Board'

            case 'gpiboard':
                return 'GPI Board'

            case 'gpoboard':
                return 'GPO Board'

            case 'lampboard':
                return 'Lamp Board'

            case 'midiboard':
                return 'MIDI Board'

            case 'serialboard':
                return 'Serial Board'

            default:
                break;
        }
    }

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column', overflow: 'hidden', textAlign: 'center' }}>
            <Navbar bg="light" expand="lg">
                <Navbar.Brand href="#home">Select Board</Navbar.Brand>
            </Navbar>
            <div style={{ height: '100%', overflowY: 'auto' }}>
                <div>
                    <Button onClick={() => console.log(history.location.pathname)} >Print Location</Button>
                </div>
                {
                    boards.map(board => (
                        <div
                            key={board}
                            style={{ display: 'inline-block', cursor: 'pointer', margin: '3px' }}
                            onClick={() => history.replace({
                                pathname: '/device/' + board,
                                state: {
                                    boardName: makeBoardName(board),
                                    folder: board
                                }
                            })}
                        >
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                overflow: 'hidden',
                                backgroundColor: 'rgb(80,80,80)',
                                padding: '5px',
                                width: '250px',
                                height: '250px',
                                borderRadius: '10px'
                            }}>
                                <div style={{ backgroundColor: 'lightGrey', padding: '3px', borderRadius: '5px' }}><b>{makeBoardName(board)}</b></div>
                                <div style={{ display: 'flex', justifyContent: 'center', overflow: 'hidden', height: '100%', alignItems: 'center' }}>
                                    <img style={{ display: 'block', maxWidth: '100%', maxHeight: '100%' }} src={path.join('boardfiles', board, 'render.png')} alt="devicePic" />
                                </div>
                            </div>
                        </div>
                    ))
                }
            </div>
        </div>
    )
}
