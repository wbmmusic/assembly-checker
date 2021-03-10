import React from 'react'
import { Route, Switch, useHistory } from 'react-router-dom'
import Modals from './Modals'
import SelectDevice from './SelectDevice'
import Device from './Device'


export default function Top(props) {
    const history = useHistory()
    console.log('LOACTION ->', history.location.pathname)

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

