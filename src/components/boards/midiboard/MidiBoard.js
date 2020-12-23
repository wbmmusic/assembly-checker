import React from 'react'

export default function MidiBoard() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <h3>MIDI Board</h3>
            <img style={{ maxHeight: '100%', maxWidth: '100%' }} src={'images/midiboard.jpg'} alt="alarm panel pic" />
        </div>
    )
}
