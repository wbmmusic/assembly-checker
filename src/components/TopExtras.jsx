import ClearAllIcon from "@mui/icons-material/ClearAll";
import { Alert, Button, Snackbar, Stack, Typography } from "@mui/material";
import { useEffect, useState } from "react";
import Modals from "./Modals";

export const TopExtras = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);

  const handleClose = not => window.api.send("clearNotification", not);

  const handleClearAll = () => window.api.send("clearAllNotifications");

  const clearAll = () => {
    if (notifications.length > 1) {
      return (
        <Button
          startIcon={<ClearAllIcon />}
          onClick={handleClearAll}
          variant="contained"
          size="small"
        >
          Clear All notifications
        </Button>
      );
    }
  };

  const action = (
    <Stack spacing={1}>
      {clearAll()}
      {notifications.map((not, i) => (
        <Alert
          key={"notification" + i}
          onClose={() => handleClose(not)}
          severity="success"
        >
          <Typography variant="body2">{not.message}</Typography>
        </Alert>
      ))}
    </Stack>
  );

  useEffect(() => {
    window.api.receive("notifications", (e, data) => {
      console.log("Notifications", data);
      setNotifications(data);
      setOpen(true);
    });

    return () => {
      window.api.removeAllListeners("notifications");
    };
  }, []);

  useEffect(() => {
    if (notifications.length === 0) setOpen(false);
  }, [notifications]);

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
