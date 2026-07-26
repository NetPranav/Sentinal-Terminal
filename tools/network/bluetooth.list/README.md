# network.bluetooth.list

## Purpose
Lists all Bluetooth devices visible to the system, including paired, connected, and nearby discoverable devices.

## Workflow
1. Runs `system_profiler SPBluetoothDataType` on macOS
2. Runs `bluetoothctl devices` on Linux
3. Returns raw output from the system command

## Permissions
- `ShellExecution` — required to invoke the system profiler command

## Limitations
- Windows is not yet supported
- Cannot initiate pairing or connections (use `network.bluetooth.pair` when available)
- Discovery of nearby devices depends on the Bluetooth hardware state

## Examples
- "Show me all bluetooth devices"
- "What bluetooth devices are connected?"
- "Are my AirPods connected?"
- "Scan for bluetooth"

## Edge Cases
- If Bluetooth is disabled, `system_profiler` still returns the Bluetooth section but shows "State: Off"
- If no devices are paired, the output will show an empty device list
