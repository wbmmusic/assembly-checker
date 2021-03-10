import React from 'react'
import { Route, Switch } from 'react-router-dom'
import Modals from './Modals'
import SelectDevice from './SelectDevice'
import Device from './Device'


export default function Top(props) {



    return (
        <div style={{ height: '100%' }}>
            <Switch>
                <Route path="./" exact component={SelectDevice} />
                <Route path="/device" component={Device} />
            </Switch>
            <Modals />
        </div>
    )
}

