
# PCB Assembly Checker

## Overview
PCB Assembly Checker is a React + Electron desktop application for programming and testing PAM system PCBs in a manufacturing environment. It automates firmware programming, device detection, and board-level testing to ensure quality control before deployment.

## Workflow
1. **Plug in device**: Operator connects a PCB to the workstation via USB/Serial.
2. **Program and test**: The app programs the device firmware using J-Link, then runs automated tests for the selected board type.
3. **Result reporting**: Pass/fail status and detailed test results are displayed in the UI. All steps are automated; no manual test steps are required.

## Main Modules
- **Electron Main Process (`public/main.js`)**: Handles window creation, device communication, firmware programming, test orchestration, and IPC between backend and frontend.
- **Preload Script (`public/preload.js`)**: Exposes safe APIs to the frontend via Electron contextBridge for IPC.
- **React Frontend (`src/`)**: UI for device selection, test status, and progress display. Key components:
	- `App.jsx`: Entry point, waits for backend readiness.
	- `Device.jsx`: Manages device programming and test status.
	- `SelectDevice.jsx`: Board selection and firmware version display.
	- `Modals.jsx`: Progress and status dialogs.
	- `Updates.jsx`: Handles update notifications.
	- `TopExtras.jsx`: Notification and firmware update alerts.
- **Test Logic (`public/tests.js`)**: Defines automated test sequences for each board type and runs tests via serial communication.

## Developer Notes
- All device programming and testing is fully automated once a device is connected and a board type is selected.
- The app is designed for use in PCB assembly shops; advanced options are not exposed to end-users.
- Only one device should be connected at a time; multiple device support is not implemented.
- Failure modes (e.g., device not found, firmware mismatch, test failure) should be handled and reported in the UI.
- Board-specific test sequences and firmware handling are defined in `tests.js` and main process logic.
- USB drivers and board documentation are included for reliable operation and reference.

## Development
- Dev runtime now uses `electron-vite` (renderer dev server defaults to `http://localhost:5173`).
- Run the app in development mode:
	- `pnpm dev`
- Build app bundles (main, preload, renderer):
	- `pnpm build`
- Package installer artifacts with electron-builder:
	- `pnpm package`

## Environment Variables
- Keep local API credentials in `.env` on your machine.
- Use `.env.example` as the template for local setup.
- Typical keys used by the main process:
	- `WBM_API_TOKEN`
	- `WBM_API_ORIGIN` or `WBM_SERVER_URL`
	- `WBM_USERNAME` and `WBM_PASSWORD` (legacy fallback)

## Dependencies
- React
- Electron
- Material-UI
- SerialPort
- electron-updater
- wbm-usb-device
- wbm-version-manager