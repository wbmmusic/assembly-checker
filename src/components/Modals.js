import React, { Fragment, useEffect, useState } from 'react'
import { Modal, Spinner } from 'react-bootstrap'
const { ipcRenderer } = window.require('electron')

export default function Modals() {
    const defaultModalContents = { show: false }
    const [modalContents, setModalContents] = useState(defaultModalContents)

    useEffect(() => {
        ipcRenderer.on('chipErasing', () => {

            const tempContents = (
                <Fragment>
                    <Modal.Header closeButton>
                        <Modal.Title>Erasing Chip</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Spinner animation="border" size="xl" />
                    </Modal.Body>
                </Fragment>
            )

            setModalContents({
                show: true,
                contents: tempContents
            })
        })

        ipcRenderer.on('programming', () => {

            const tempContents = (
                <Fragment>
                    <Modal.Header closeButton>
                        <Modal.Title>Programming</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>
                        <Spinner animation="border" size="xl" />
                    </Modal.Body>
                </Fragment>
            )

            setModalContents({
                show: true,
                contents: tempContents
            })
        })

        ipcRenderer.on('chipEraseComplete', () => {
            setModalContents(defaultModalContents)
        })

        ipcRenderer.on('programmingComplete', () => {
            setModalContents(defaultModalContents)
        })

        return () => {
            ipcRenderer.removeAllListeners('chipErasing')
            ipcRenderer.removeAllListeners('chipEraseComplete')
            ipcRenderer.removeAllListeners('programming')
            ipcRenderer.removeAllListeners('programmingComplete')
        }
    }, [])

    const handleClose = () => {
        setModalContents(defaultModalContents)
    }

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
    )
}
