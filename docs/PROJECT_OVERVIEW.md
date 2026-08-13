# Sentinel Terminal: Project Overview & Architecture

## Project Summary
**Sentinel Terminal** is an AI-native smart terminal built to combine traditional shell workflows with natural language desktop automation. It runs entirely offline via local models.

## Technology Stack
- **Frontend**: React 19, Vite, TypeScript
- **Terminal Emulator**: xterm.js (with WebGL and Fit addons)
- **Backend**: Tauri v2, Rust
- **PTY Engine**: `portable-pty`
- **Validation**: Zod

## Core Architecture
Sentinel Terminal operates on a decoupled architecture bridging the frontend to native OS APIs:
1. **Rust Backend (`src-tauri/`)**: Handles the raw PTY (Pseudo-Terminal) process spawning, terminal resizing, and macOS native menus (like the Menu bar). 
2. **AI Tool Registry (`tools/`)**: Contains over 97 JSON-defined operational schemas (e.g., `cpu`, `ram`, `wifi`, `filesystem`). Each tool dictates its supported platforms (e.g., `["macos"]`).
3. **Capability SDK (`src/sdk/`)**: TypeScript drivers that map the JSON tool definitions to actual operating system commands. For example, `BluetoothCapability.ts` calls `blueutil` on macOS, and `WifiCapability.ts` uses the `airport` utility.
4. **World Model & State**: Tracks the current filesystem state, mounted volumes, and running processes.

## Current Development Goal: The Windows Port
The application was originally developed exclusively for macOS (Apple Silicon & Intel). The current primary objective is to **port the application to Windows** without breaking the existing macOS functionality.

**Approach**:
- We are using strict **Conditional Compilation** in Rust (`#[cfg(target_os = "windows")]` vs `#[cfg(target_os = "macos")]`).
- We are implementing **Platform-Specific Capability Drivers** in the frontend SDK (e.g., routing to PowerShell `Get-NetAdapter` when on Windows, while preserving `airport` on macOS).

*For the complete porting plan, see `WINDOWS_PORT_TRACKER.md`.*
