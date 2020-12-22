import { useEffect, useState } from 'react';
import Top from './components/Top'

const { ipcRenderer } = window.require('electron')

function App() {
  const [state, setState] = useState([])


  useEffect(() => {
    ipcRenderer.on('message', (e, theMessage) => {
      console.log(theMessage)
      setState(theMessage, ...state)
    })

    ipcRenderer.on('app_version', (event, arg) => {
      document.title = 'WBM Tek PCB Assembly Checker --- v' + arg.version;
    });


    ipcRenderer.send('reactIsReady')

    return () => {
      ipcRenderer.removeAllListeners('message')
      ipcRenderer.removeAllListeners('app_version')
    }
  }, [])


  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', minWidth: '100vw', minHeight: '100vh', overflow: 'hidden' }}>
      <Top msgs={''} />
      <div style={{ height: '100%', overflowY: 'auto' }}>
        {state}
      </div>

    </div>
  );
}

export default App;
