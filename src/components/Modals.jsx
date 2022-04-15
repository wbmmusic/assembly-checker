import React, { Fragment, useEffect, useState } from "react";
import { Modal, Spinner } from "react-bootstrap";

export default function Modals() {
  const defaultModalContents = { show: false };
  const [modalContents, setModalContents] = useState(defaultModalContents);

  useEffect(() => {
    window.api.receive("chipErasing", () => {
      const tempContents = (
        <Fragment>
          <Modal.Header>
            <Modal.Title>Erasing Chip</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Spinner animation="border" size="xl" />
          </Modal.Body>
        </Fragment>
      );

      setModalContents({
        show: true,
        contents: tempContents,
      });
    });

    window.api.receive("programming", () => {
      const tempContents = (
        <Fragment>
          <Modal.Header>
            <Modal.Title>Programming and Testing</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Spinner animation="border" size="xl" />
          </Modal.Body>
        </Fragment>
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
      <Modal
        show={modalContents.show}
        onHide={handleClose}
        backdrop="static"
        keyboard={false}
      >
        {modalContents.contents}
      </Modal>
    </div>
  );
}
