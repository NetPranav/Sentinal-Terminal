# Turn Bluetooth On (network.bluetooth.on)

Enables Bluetooth power on the local operating system.

## Platform Implementation
- **macOS**: Utilizes `blueutil -p 1`. Requires homebrew package `blueutil` installed.
- **Linux**: Utilizes `bluetoothctl power on`.

## Security Risk
- **Level**: LOW
- **Permissions**: ShellExecution
