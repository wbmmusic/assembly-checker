import { useEffect } from 'react';
import { useHistory } from 'react-router';
import Top from './components/Top'
import Updates from './Updates';

const { ipcRenderer } = window.require('electron')

function App() {
  const history = useHistory()

  useEffect(() => {
    ipcRenderer.on('message', (e, theMessage) => {
      console.log(theMessage)
    })

    ipcRenderer.on('app_version', (event, arg) => {
      document.title = 'WBM Tek PCB Assembly Checker --- v' + arg.version;
    });

    ipcRenderer.send('reactIsReady')
    history.replace('/')

    return () => {
      ipcRenderer.removeAllListeners('message')
      ipcRenderer.removeAllListeners('app_version')
    }
  }, [])


  return (
    <div>
      <Top />
      <Updates />
    </div>
  );
}

export default App;
