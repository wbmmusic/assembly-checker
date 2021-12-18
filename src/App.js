import { useEffect } from 'react';
import Top from './components/Top'
import Updates from './Updates';

function App() {
  useEffect(() => {
    window.api.receive('message', (e, theMessage) => {
      console.log(theMessage)
    })

    window.api.receive('app_version', (event, arg) => {
      document.title = 'WBM Tek PCB Assembly Checker --- v' + arg.version;
    });

    window.api.send('reactIsReady')

    return () => {
      window.api.removeAllListeners('message')
      window.api.removeAllListeners('app_version')
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
