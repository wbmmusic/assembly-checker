import { useEffect, useState } from 'react';
import './App.css';
import Top from './components/Top'

const { ipcRenderer } = window.require('electron')

function App() {
  const [state, setstate] = useState([])


  useEffect(() => {
    ipcRenderer.on('message', (e, theMessage) => {
      console.log(theMessage)
      setstate(theMessage, ...state)
    })

    ipcRenderer.on('app_version', (event, arg) => {
      ipcRenderer.removeAllListeners('app_version');
      document.title = 'WBM Tek PCB Assembly Checker --- v' + arg.version;
    });


    ipcRenderer.send('reactIsReady')

    return () => {
      ipcRenderer.removeListener('reactIsReady')
    }
  }, [])


  return (
    <div>
      <Top msgs={state} />
    </div>
  );
}

export default App;
