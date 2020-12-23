import React from 'react'
const path = require("path")

export default function GpiBoard() {
    return (
        <div style={{ textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div style={{ textAlign: 'left' }}>
                <h3>GPI Board</h3>
            </div>
            <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ maxHeight: '100%', maxWidth: '100%' }}>
                    <img style={{ maxHeight: '100%', maxWidth: '100%' }} src={path.join('images', 'gpiboard.jpg')} alt="control panel pic" />
                </div>
            </div>
        </div>
    )
}
