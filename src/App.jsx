import { CssBaseline } from "@mui/material";
import { useEffect } from "react";
import Top from "./components/Top";
import Updates from "./Updates";

function App() {
  useEffect(() => {
    window.api.receive("message", (e, theMessage) => {
      console.log(theMessage);
    });

    window.api.send("reactIsReady");

    return () => {
      window.api.removeAllListeners("message");
    };
  }, []);

  return (
    <div
      style={{
        borderTop: "1px solid lightGrey",
        overflow: "hidden",
        height: "100vh",
      }}
    >
      <CssBaseline />
      <Top />
      <Updates />
    </div>
  );
}

export default App;
