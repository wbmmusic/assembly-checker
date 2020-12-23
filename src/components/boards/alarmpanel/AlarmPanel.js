import React from 'react'
import theImage from '../images/alarmpanel.jpg'

export default function AlarmPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'red' }}>
            <h3>Alarm Panel</h3>
            <img style={{ maxHeight: '100%', maxWidth: '100%' }} src={theImage} alt="alarm panel pic" />
        </div>
    )
}
