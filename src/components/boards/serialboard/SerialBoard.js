import React from 'react'
const path = require('path')

export default function SerialBoard() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <h3>Serial Board</h3>
            <img style={{ maxHeight: '100%', maxWidth: '100%' }} src={path.join('images', 'serialboard.jpg')} alt="alarm panel pic" />
        </div>
    )
}
