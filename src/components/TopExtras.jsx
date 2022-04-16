import { Alert, Snackbar, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import Modals from "./Modals";

export const TopExtras = () => {
  const [open, setOpen] = useState(false);
  const [updatedFirmwares, setUpdatedFirmwares] = useState([]);

  const handleClose = () => setOpen(false);

  const msgs = [
    "This Is A Test Message",
    "This Is A Test Message 2",
    "This Is A Test Message 3",
    "This Is A Test Message 4",
  ];

  const action = (
    <Stack spacing={1}>
      {msgs.map((msg, i) => (
        <Alert key={"msg" + i} onClose={handleClose} severity="success">
          <Typography variant="body2">{msg}</Typography>
        </Alert>
      ))}
    </Stack>
  );

  useEffect(() => {
    window.api.receive("updatedFirmware", (event, arg) => {
      console.log("Updated Firmware", arg);
      setUpdatedFirmwares([...updatedFirmwares, arg]);
    });

    return () => {
      window.api.removeAllListeners("updatedFirmware");
    };
  }, []);

  return (
    <>
      <Modals />
      <Snackbar
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        open={open}
        //autoHideDuration={10000}
        onClose={handleClose}
        action={action}
      />
    </>
  );
};
