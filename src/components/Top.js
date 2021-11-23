import React from 'react'
import Modals from './Modals'
import SelectDevice from './SelectDevice'
import Device from './Device'
import { Route, Routes, useLocation } from 'react-router'


export default function Top() {
    const location = useLocation()
    console.log(location.pathname)
    return (
        <div style={{ height: '100%' }}>
            <Routes>
                <Route path="/device/*" element={<Device />} />
                <Route path="*" element={<SelectDevice />} />
            </Routes>
            <Modals />
        </div>
    )
}

