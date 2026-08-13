# Sentinel Terminal: Windows Port Tracker

This document tracks the progress of porting Sentinel Terminal to Windows natively, ensuring that all macOS functionality remains completely intact via conditional compilation and runtime checks.

## Phase 1: Rust Backend Compatibility (`src-tauri/`)
- [ ] **Path Overrides:** Update `pty.rs` to conditionalize macOS specific `PATH` overrides (`/opt/homebrew/bin`) using `#[cfg(target_os = "macos")]`.
- [ ] **Shell Spawning:** Verify `pty.rs` correctly defaults to `powershell.exe` (or `pwsh`) on Windows.
- [ ] **Native Menus:** Update `lib.rs` to conditionally compile the macOS native `Menu` building code so it does not crash Tauri on Windows.

## Phase 2: AI Tool Registry Updates (`tools/`)
- [ ] **Schema Updates:** Write and execute a script to iterate over all 96 `tool.json` schemas in the `tools/` directory.
- [ ] **Platform Addition:** Automatically append `"windows"` to the `supportedPlatforms` array for every applicable capability.

## Phase 3: Frontend Capability SDK Refactor (`src/sdk/`)
- [ ] **Wi-Fi Module:** Refactor `WifiCapability.ts` to detect Windows and execute `netsh wlan` instead of `airport`.
- [ ] **System Diagnostics:** Refactor `SystemCapability.ts` to execute `systeminfo` and `Get-WmiObject` instead of `system_profiler`.
- [ ] **Process Management:** Refactor `ProcessCapability.ts` to use `Get-Process` instead of `ps`.
- [ ] **Bluetooth Control:** Refactor `BluetoothCapability.ts` to bypass or use basic PowerShell bluetooth commands instead of `blueutil`.
- [ ] **Permissions Engine:** Update `PermissionManager.ts` remedy hints to direct users to Windows Settings appropriately.

## Phase 4: UI & Theme Adjustments (`src/ui/`)
- [ ] **Font Fallbacks:** Update `ThemeManager.ts` to provide a fallback font family (like `Segoe UI`) when macOS's `-apple-system` is unavailable.
- [ ] **Window Decorators:** Verify custom window decorators (min/max/close buttons) are functioning correctly and styled appropriately on Windows.

## Phase 5: Verification & Testing
- [ ] **Local Build:** Build the application locally on Windows using `npm run build:app`.
- [ ] **PTY Terminal Validation:** Test standard PTY shell input inside the React frontend.
- [ ] **Natural Language Execution:** Verify natural language AI commands correctly route to Windows native commands.
