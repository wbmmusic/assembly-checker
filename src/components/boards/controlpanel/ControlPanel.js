import React from 'react'
import theImage from '../images/controlpanel.jpg'

export default function ControlPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor:'pink' }}>
            <div>
            <h3>Control Panel</h3>
            </div>
            <img style={{ height: 'auto', width: '100%' }} src={theImage} alt="control panel pic" />
        </div>
    )
}
