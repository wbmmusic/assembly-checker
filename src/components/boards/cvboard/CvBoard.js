import React from 'react'
const path = require('path')

export default function CvBoard() {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            <h3>CV Board</h3>
            <img style={{ height: 'auto', width: '100%' }} src={path.join('images', 'cvboard.jpg')} alt="control panel pic" />
        </div >
    )
}
