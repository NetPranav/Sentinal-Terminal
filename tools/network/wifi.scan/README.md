# network.wifi.scan

## Purpose
Scans for all available WiFi networks and displays their SSID, signal strength, security type, and channel.

## Workflow
1. On macOS: runs the `airport -s` command via the Apple80211 framework
2. On Linux: runs `nmcli device wifi list`

## Permissions
- `ShellExecution`

## Limitations
- Windows not yet supported
- Cannot connect to networks (use `network.wifi.connect` when available)
- Requires WiFi hardware to be enabled

## Examples
- "Show me all the wifi available"
- "List wifi networks"
- "Scan for wireless"

## Edge Cases
- If WiFi is disabled, the command may return an error or empty output
- Hidden networks may not appear in scan results
