import { Box, LinearProgress, Modal, Typography } from "@mui/material";
import { useEffect, useState } from "react";

const defaultModalContents = { show: false };

const modalStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: 400,
  bgcolor: "background.paper",
  border: "2px solid #000",
  boxShadow: 24,
  p: 4,
};

export default function Modals() {
  const [modalContents, setModalContents] = useState(defaultModalContents);

  useEffect(() => {
    window.api.receive("chipErasing", () => {
      const tempContents = (
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Erasing Chip
          </Typography>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            <LinearProgress color="error" />
          </Typography>
        </Box>
      );

      setModalContents({
        show: true,
        contents: tempContents,
      });
    });

    window.api.receive("programming", () => {
      const tempContents = (
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Programming and Testing
          </Typography>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            <LinearProgress />
          </Typography>
        </Box>
      );

      setModalContents({
        show: true,
        contents: tempContents,
      });
    });

    window.api.receive("chipEraseComplete", () => {
      setModalContents(defaultModalContents);
    });

    window.api.receive("programmingComplete", () => {
      setModalContents(defaultModalContents);
    });

    return () => {
      window.api.removeAllListeners("chipErasing");
      window.api.removeAllListeners("chipEraseComplete");
      window.api.removeAllListeners("programming");
      window.api.removeAllListeners("programmingComplete");
    };
  }, []);

  const handleClose = () => {
    setModalContents(defaultModalContents);
  };

  return (
    <div>
      <Modal open={modalContents.show} onClose={handleClose}>
        {modalContents.contents ? modalContents.contents : <></>}
      </Modal>
    </div>
  );
}
