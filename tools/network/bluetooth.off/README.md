# Turn Bluetooth Off (network.bluetooth.off)

Disables Bluetooth power on the local operating system.

## Platform Implementation
- **macOS**: Utilizes `blueutil -p 0`. Requires homebrew package `blueutil` installed.
- **Linux**: Utilizes `bluetoothctl power off`.

## Security Risk
- **Level**: LOW
- **Permissions**: ShellExecution
