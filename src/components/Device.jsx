import React, { useEffect, useRef, useState } from "react";
import { Button, Navbar } from "react-bootstrap";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useLocation, useNavigate } from "react-router";
import { Typography } from "@mui/material";
const join = window.api.join;

export default function Device() {
  const navigate = useNavigate();
  const location = useLocation();
  const [termText, setTermText] = useState([]);
  const termRef = useRef(null);
  const [passFail, setPassFail] = useState(null);

  console.log("DEVICE");
  console.log(location);

  const program = () => {
    console.log("Program");
    setPassFail(null);
    setTermText([]);
    window.api.send("programAndTest", location.state.folder);
  };

  const makeTerminalBack = () => {
    if (passFail === "pass") return "lightGreen";
    else if (passFail === "fail") return "salmon";
    return;
  };

  const showIcon = () => {
    if (passFail === "pass") {
      return (
        <div
          style={{ display: "flex", alignItems: "center", color: "limeGreen" }}
        >
          <Typography variant="h3">PASS</Typography>
          <CheckCircleOutlineIcon style={{ fontSize: "74px" }} />
        </div>
      );
    } else if (passFail === "fail") {
      return (
        <div style={{ display: "flex", alignItems: "center", color: "red" }}>
          <Typography variant="h3">FAIL</Typography>
          <ErrorOutlineIcon style={{ fontSize: "74px" }} />
        </div>
      );
    }
  };

  const chipErase = () => {
    console.log("Top Chip Erase");
    setPassFail(null);
    setTermText([]);
    window.api.send("chipErase");
  };

  useEffect(() => {
    window.api.receive("jLinkProgress", (e, theMessage) => {
      console.log("JLINK-->>", theMessage);
      setTermText(oldTerm => [...oldTerm, theMessage.split("\r\n")]);
    });

    window.api.receive("passFail", (e, result) => setPassFail(result));

    return () => {
      window.api.removeAllListeners("jLinkProgress");
      window.api.removeAllListeners("passFail");
    };
  }, []);

  // Keep div scrolled to bottom
  useEffect(() => {
    termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [termText]);

  return (
    <div style={{ height: "100vh", width: "100vw" }}>
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflowY: "hidden",
        }}
      >
        <Navbar bg="light" expand="lg">
          <Navbar.Brand style={{ marginLeft: "8px" }}>
            {location.state.boardName}
          </Navbar.Brand>
          <Button
            style={{ marginRight: "8px" }}
            size="sm"
            variant="outline-primary"
            onClick={() => navigate("/", { replace: true })}
          >
            Back To Boards
          </Button>
        </Navbar>
        <div
          style={{
            padding: "0px 10px 10px 10px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          <div>
            <table style={{ width: "100%" }} cellSpacing="0" cellPadding="0">
              <tbody>
                <tr>
                  <td
                    style={{
                      borderRight: "1px solid lightGrey",
                      width: "1px",
                      padding: "5px",
                    }}
                  >
                    <img
                      style={{ maxWidth: "300px", maxHeight: "200px" }}
                      src={join(
                        "boardfiles",
                        location.state.folder,
                        "render.png"
                      )}
                      alt="brdImage"
                    />
                  </td>
                  <td>
                    <table>
                      <tbody>
                        <tr>
                          <td style={buttonStyle} onClick={program}>
                            <Button size="sm" variant="outline-primary">
                              Program and Test
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td style={buttonStyle} onClick={chipErase}>
                            <Button size="sm" variant="outline-danger">
                              Chip Erase
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                  <td
                    style={{
                      textAlign: "center",
                      width: "1%",
                    }}
                  >
                    {showIcon()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div
            ref={termRef}
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              padding: "10px",
              width: "100%",
              height: "100%",
              border: "1px solid lightGrey",
              overflowY: "auto",
              fontSize: "12px",
              background: makeTerminalBack(),
            }}
          >
            {termText.map((line, idx) => (
              <div key={"line" + idx}>{line}</div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const buttonStyle = {
  paddingLeft: "10px",
  whiteSpace: "noWrap",
};
