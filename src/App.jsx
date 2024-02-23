import { CssBaseline } from "@mui/material";
import { useEffect, useState } from "react";
import Top from "./components/Top";
import Updates from "./Updates";

function App() {
  const [reactIsReady, setReactIsReady] = useState(false);
  useEffect(() => {
    window.api.receive("message", (e, theMessage) => {
      console.log(theMessage);

      if (theMessage === "React Is Ready") setReactIsReady(true);
    });
    window.api.send("reactIsReady"); //

    return () => {
      window.api.removeAllListeners("message");
    };
  }, []);

  if (!reactIsReady) return <></>;

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
