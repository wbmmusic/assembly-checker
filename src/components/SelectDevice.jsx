import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router";
const join = window.api.join;

export default function SelectDevice() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState([
    { name: "alarmpanel", ver: "" },
    { name: "controlpanel", ver: "" },
    { name: "cvboard", ver: "" },
    { name: "gpiboard", ver: "" },
    { name: "gpoboard", ver: "" },
    { name: "midiboard", ver: "" },
    { name: "serialboard", ver: "" },
  ]);

  console.log("Selected Device");

  const makeBoardName = board => {
    switch (board) {
      case "alarmpanel":
        return "Alarm Panel";

      case "controlpanel":
        return "Control Panel";

      case "cvboard":
        return "CV Board";

      case "gpiboard":
        return "GPI Board";

      case "gpoboard":
        return "GPO Board";

      case "lampboard":
        return "Lamp Board";

      case "midiboard":
        return "MIDI Board";

      case "serialboard":
        return "Serial Board";

      default:
        break;
    }
  };

  const getVersions = () => {
    window.api.ipcRenderer
      .invoke("getFw", boards)
      .then(res => setBoards(res))
      .catch(err => console.log(err));
  };

  const handleCheckForNewFirmwares = () => {
    window.api.send("checkForNewFW");
  };

  useEffect(() => {
    getVersions();
    window.api.receive("updatedFirmware", () => getVersions());
    window.api.receive("refreshFW", () => getVersions());
    return () => {
      window.api.removeAllListeners("updatedFirmware");
      window.api.removeAllListeners("refreshFW");
    };
  }, []);

  return (
    <div
      style={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        textAlign: "center",
      }}
    >
      <AppBar position="static">
        <Toolbar variant="dense">
          <Box>
            <Typography
              variant="h6"
              component="div"
              sx={{ flexGrow: 1, whiteSpace: "nowrap" }}
            >
              Select Board
            </Typography>
          </Box>
          <Stack justifyContent="right" direction="row" width="100%">
            <Button
              variant="outlined"
              size="small"
              color="inherit"
              onClick={handleCheckForNewFirmwares}
            >
              Check for new firmwares
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>
      <div style={{ height: "100%", overflowY: "auto" }}>
        {boards.map(board => (
          <div
            key={board.name}
            style={{
              display: "inline-block",
              cursor: "pointer",
              margin: "3px",
              position: "relative",
            }}
            onClick={() =>
              navigate("/device/" + board.name, {
                replace: true,
                state: {
                  boardName: makeBoardName(board.name),
                  folder: board.name,
                },
              })
            }
          >
            <div
              style={{
                position: "absolute",
                bottom: "0px",
                right: "7px",
                color: "lightGrey",
              }}
            >
              <Typography variant="body2">{board.ver}</Typography>
            </div>
            <Box
              height={250}
              width={250}
              p={1}
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "rgb(80,80,80)",
                borderRadius: "10px",
              }}
            >
              <Box
                sx={{
                  backgroundColor: "lightGrey",
                  padding: "3px",
                  borderRadius: "5px",
                }}
              >
                <Typography variant="h6">
                  {makeBoardName(board.name)}
                </Typography>
              </Box>
              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  overflow: "hidden",
                  height: "100%",
                  alignItems: "center",
                }}
              >
                <img
                  style={{
                    display: "block",
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                  src={join("boardfiles", board.name, "render.png")}
                  alt="devicePic"
                />
              </div>
            </Box>
          </div>
        ))}
      </div>
    </div>
  );
}
