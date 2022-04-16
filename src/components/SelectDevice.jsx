import { AppBar, Box, Toolbar, Typography } from "@mui/material";
import React from "react";
import { useNavigate } from "react-router";
const join = window.api.join;

export default function SelectDevice() {
  const navigate = useNavigate();

  console.log("Selected Device");

  let boards = [
    "alarmpanel",
    "controlpanel",
    "cvboard",
    "gpiboard",
    "gpoboard",
    "midiboard",
    "serialboard",
  ];

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
        <Toolbar>
          <Box>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              Select Board
            </Typography>
          </Box>
        </Toolbar>
      </AppBar>
      <div style={{ height: "100%", overflowY: "auto" }}>
        {boards.map(board => (
          <div
            key={board}
            style={{
              display: "inline-block",
              cursor: "pointer",
              margin: "3px",
            }}
            onClick={() =>
              navigate("/device/" + board, {
                replace: true,
                state: { boardName: makeBoardName(board), folder: board },
              })
            }
          >
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
                <Typography variant="h6">{makeBoardName(board)}</Typography>
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
                  src={join("boardfiles", board, "render.png")}
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
