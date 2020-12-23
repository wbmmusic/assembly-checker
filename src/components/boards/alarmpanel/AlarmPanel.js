import React from 'react'
const path = require('path')

export default function AlarmPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'red' }}>
            <h3>Alarm Panel</h3>
            <img style={{ maxHeight: '100%', maxWidth: '100%' }} src={path.join('images', 'alarmpanel.jpg')} alt="alarm panel pic" />
        </div>
    )
}
