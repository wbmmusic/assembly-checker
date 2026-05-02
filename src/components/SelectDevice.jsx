import WarningIcon from "@mui/icons-material/Warning";
import {
  AppBar,
  Box,
  Button,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
const join = window.api.join;

const initialBoards = [
  { name: "alarmpanel", ver: "" },
  { name: "controlpanel", ver: "" },
  { name: "cvboard", ver: "" },
  { name: "gpiboard", ver: "" },
  { name: "gpoboard", ver: "" },
  { name: "midiboard", ver: "" },
  { name: "serialboard", ver: "" },
];

export default function SelectDevice() {
  const navigate = useNavigate();
  const [boards, setBoards] = useState(initialBoards);
  const [skipInitMemory, setSkipInitMemory] = useState(false);

  const boardNames = useMemo(
    () => ({
      alarmpanel: "Alarm Panel",
      controlpanel: "Control Panel",
      cvboard: "CV Board",
      gpiboard: "GPI Board",
      gpoboard: "GPO Board",
      lampboard: "Lamp Board",
      midiboard: "MIDI Board",
      serialboard: "Serial Board",
    }),
    []
  );

  const getVersions = useCallback(() => {
    window.api
      .invoke("getFw", initialBoards)
      .then(res => setBoards(res))
      .catch(err => console.log(err));
  }, []);

  const handleCheckForNewFirmwares = () => {
    window.api.send("checkForNewFW");
  };

  const handleToggleInitMemory = () => {
    window.api.invoke("toggleInitMemory").then(res => {
      setSkipInitMemory(res);
      localStorage.setItem("skipInitMemory", res ? "true" : "false");
    });
  };

  useEffect(() => {
    getVersions();
    window.api.receive("updatedFirmware", () => getVersions());
    window.api.receive("refreshFW", () => getVersions());
    const stored = localStorage.getItem("skipInitMemory") === "true";
    window.api.invoke("setInitMemory", stored).then(res => setSkipInitMemory(res));

    return () => {
      window.api.removeAllListeners("updatedFirmware");
      window.api.removeAllListeners("refreshFW");
    };
  }, [getVersions]);

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
          <Stack
            direction="row"
            spacing={1}
            sx={{ justifyContent: "flex-end", width: "100%" }}
          >
            <Tooltip
              title={
                skipInitMemory
                  ? "Memory will be preserved (no INITMEMORY command)"
                  : "Memory will be initialized on test (default IPs etc will be reset)"
              }
            >
              <Button
                variant={skipInitMemory ? "outlined" : "contained"}
                size="small"
                color={skipInitMemory ? "inherit" : "error"}
                onClick={handleToggleInitMemory}
                startIcon={skipInitMemory ? null : <WarningIcon />}
              >
                {skipInitMemory ? "Preserve Memory" : "Init Memory"}
              </Button>
            </Tooltip>
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
                  boardName: boardNames[board.name] || board.name,
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
              sx={{
                height: 250,
                width: 250,
                p: 1,
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
                  {boardNames[board.name] || board.name}
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
