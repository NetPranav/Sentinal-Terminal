# system.info

## Purpose
Displays detailed system information including hardware model, OS version, CPU, and memory.

## Workflow
- macOS: `system_profiler SPSoftwareDataType SPHardwareDataType`
- Linux: `hostnamectl`

## Permissions
- `ShellExecution`

## Limitations
- Windows not yet supported
- Does not show real-time resource usage (use a process/monitor tool for that)
