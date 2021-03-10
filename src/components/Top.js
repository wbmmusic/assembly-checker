import React from 'react'
import { Route, Switch, useHistory, useLocation } from 'react-router-dom'
import Modals from './Modals'
import SelectDevice from './SelectDevice'
import Device from './Device'


export default function Top(props) {
    const history = useHistory()
    const location = useLocation()
    console.log('History ->', history.location.pathname)
    console.log('Location ->', location.pathname)

    return (
        <div style={{ height: '100%' }}>
            <Switch>
                <Route path="/" exact component={SelectDevice} />
                <Route path="/device" component={Device} />
            </Switch>
            <Modals />
        </div>
    )
}

