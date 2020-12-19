import { useEffect } from 'react';
import './App.css';
import Top from './components/Top'

const { ipcRenderer } = window.require('electron')

function App() {

  useEffect(() => {
    ipcRenderer.send('reactIsReady')

    ipcRenderer.on('message', (theMessage) => console.log(theMessage))

    return () => {
      //cleanup
    }
  }, [])


  return (
    <div>
      <Top />
    </div>
  );
}

export default App;
