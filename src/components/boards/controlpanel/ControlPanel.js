import React from 'react'
const path = require("path")

export default function ControlPanel() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: 'pink' }}>
            <div>
                <h3>Control Panel</h3>
            </div>
            <img style={{ height: 'auto', width: '100%' }} src={path.join('images', 'controlpanel.jpg')} alt="control panel pic" />
        </div>
    )
}
