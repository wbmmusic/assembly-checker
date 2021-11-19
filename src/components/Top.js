import React from 'react'
import { Route, Routes } from 'react-router-dom'
import Modals from './Modals'
import SelectDevice from './SelectDevice'
import Device from './Device'


export default function Top() {

    return (
        <div style={{ height: '100%' }}>
            <Routes>
                <Route path="/device/*" element={<Device />} />
                <Route path="" element={<SelectDevice />} />
            </Routes>
            <Modals />
        </div>
    )
}

