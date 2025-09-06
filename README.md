# PCB Assembly Checker

React + Electron desktop application used during manufacturing for programming and testing PAM system PCBs. This production tool provides comprehensive PCB programming, automated testing, and quality control validation before deployment.

## Key Features

- **PCB Programming**: J-Link integration for firmware programming with bootloader support during manufacturing
- **Automated Testing**: Comprehensive automated test sequences for 7 different PAM board types
- **Serial Communication**: SerialPort integration for device communication and testing validation
- **Component Testing**: Tests USB serial, MAC, network (WIZ), memory, shift registers, TLC drivers, ADC functionality
- **Multi-Board Support**: Supports CV, GPO, GPI, MIDI, Serial, Control Panel, and Alarm Panel boards
- **USB Driver Integration**: Includes USB drivers for reliable device recognition and communication
- **Board Documentation**: Integrated board files, images, and specifications for assembly reference
- **Quality Control**: Pass/fail validation with detailed test results and comprehensive error reporting
- **Manufacturing Tool**: Production-ready tool designed specifically for PCB assembly and quality control
- **Auto-Update**: Electron auto-updater for maintaining production tool versions

## Architecture

Electron application with React frontend, serial communication, and J-Link programming integration designed for manufacturing and assembly processes.

## Production Usage

Used during PAM system manufacturing to program firmware and validate board functionality, ensuring quality control and proper operation before deployment to customers.

## Dependencies

- React
- Electron
- Material-UI
- SerialPort
- electron-updater
- wbm-usb-device
- wbm-version-manager