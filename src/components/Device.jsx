import React, { useCallback, useEffect, useRef, useState } from "react";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { useLocation, useNavigate } from "react-router";
import {
  AppBar,
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";

const join = window.api.join;
const LOCAL_FIRMWARE_OPTION = "__LOCAL_FIRMWARE__";

export default function Device() {
  const navigate = useNavigate();
  const location = useLocation();
  const [termText, setTermText] = useState([]);
  const termRef = useRef(null);
  const [passFail, setPassFail] = useState(null);
  const [ver, setVer] = useState("");
  const [versionOptions, setVersionOptions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [uiMessage, setUiMessage] = useState("");

  const program = async () => {
    setPassFail(null);
    setTermText([]);
    setUiMessage("");

    if (selectedVersion === LOCAL_FIRMWARE_OPTION) {
      try {
        const result = await window.api.invoke("chooseLocalFirmware");
        if (result?.canceled) {
          setUiMessage("Local firmware selection cancelled.");
          return;
        }

        window.api.send("programAndTestSelection", {
          folder: location.state.folder,
          type: "local",
          filePath: result.filePath,
        });
      } catch (error) {
        setUiMessage(error?.message || "Unable to choose local firmware file.");
      }
      return;
    }

    window.api.send("programAndTestSelection", {
      folder: location.state.folder,
      type: "version",
      version: selectedVersion || ver,
    });
  };

  const makeTerminalBack = () => {
    if (passFail === "pass") return "lightGreen";
    if (passFail === "fail") return "salmon";
    return;
  };

  const showIcon = () => {
    if (passFail === "pass") {
      return (
        <Stack direction="row" sx={{ alignItems: "center", color: "lightGreen" }}>
          <Typography variant="h3">PASS</Typography>
          <CheckCircleOutlinedIcon sx={{ fontSize: "74px" }} />
        </Stack>
      );
    }

    if (passFail === "fail") {
      return (
        <Stack direction="row" sx={{ alignItems: "center", color: "red" }}>
          <Typography variant="h3">FAIL</Typography>
          <ErrorOutlinedIcon sx={{ fontSize: "74px" }} />
        </Stack>
      );
    }

    return null;
  };

  const chipErase = () => {
    setPassFail(null);
    setTermText([]);
    window.api.send("chipErase");
  };

  const getVersions = useCallback(() => {
    window.api
      .invoke("getFwVersions", location.state.folder)
      .then(res => {
        const nextOptions = Array.isArray(res?.options) ? res.options : [];
        const currentVersion = res?.currentVersion || "no fw";
        setVersionOptions(nextOptions);
        setVer(currentVersion);
        setSelectedVersion(currentVersion);
      })
      .catch(error => {
        setUiMessage(error?.message || "Unable to load firmware versions.");
      });
  }, [location.state.folder]);

  useEffect(() => {
    getVersions();

    window.api.receive("jLinkProgress", (e, theMessage) => {
      setTermText(oldTerm => [...oldTerm, theMessage.split("\r\n")]);
    });

    window.api.receive("passFail", (e, result) => setPassFail(result));
    window.api.receive("refreshFW", () => getVersions());

    return () => {
      window.api.removeAllListeners("jLinkProgress");
      window.api.removeAllListeners("passFail");
      window.api.removeAllListeners("refreshFW");
    };
  }, [getVersions]);

  useEffect(() => {
    if (termRef.current) {
      termRef.current.scrollTop = termRef.current.scrollHeight;
    }
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
        <AppBar position="static">
          <Toolbar variant="dense">
            <Typography variant="h6" component="div">
              {location.state.boardName}
            </Typography>
            <FormControl
              size="small"
              sx={{
                marginLeft: "15px",
                minWidth: "260px",
                backgroundColor: "white",
                borderRadius: "4px",
              }}
            >
              <Select
                value={selectedVersion}
                onChange={event => setSelectedVersion(event.target.value)}
                displayEmpty
              >
                {versionOptions.map(option => (
                  <MenuItem key={option.version} value={option.version}>
                    {option.version}
                  </MenuItem>
                ))}
                <MenuItem value={LOCAL_FIRMWARE_OPTION}>
                  Local firmware file...
                </MenuItem>
              </Select>
            </FormControl>
            <Typography
              component="div"
              variant="body2"
              sx={{ flexGrow: 1, marginLeft: "12px" }}
            >
              {selectedVersion === LOCAL_FIRMWARE_OPTION
                ? "Using local firmware file"
                : `Current: ${ver}`}
            </Typography>
            <Button
              sx={{ mr: 1 }}
              size="small"
              color="inherit"
              onClick={() => navigate("/", { replace: true })}
              startIcon={<ArrowBackIcon color="inherit" />}
            >
              Back To Boards
            </Button>
          </Toolbar>
        </AppBar>

        <div
          style={{
            padding: "0px 10px 10px 10px",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {uiMessage ? (
            <Typography color="error" sx={{ margin: "6px 0px" }}>
              {uiMessage}
            </Typography>
          ) : null}
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
                            <Button size="small" variant="contained">
                              Program and Test
                            </Button>
                          </td>
                        </tr>
                        <tr>
                          <td style={buttonStyle} onClick={chipErase}>
                            <Button
                              size="small"
                              variant="contained"
                              color="error"
                            >
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
