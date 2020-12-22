import React from 'react'
import controlPanelPic from './controlpanel.jpg'

export default function ControlPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <h3>Control Panel</h3>
            <img style={{ height: 'auto', width: '100%' }} src={controlPanelPic} alt="control panel pic" />
        </div>
    )
}
