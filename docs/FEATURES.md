# Sentinel Terminal — Features Overview

Sentinel is an autonomous, AI-native terminal engineered for modern developers, power users, and robotics engineers. Combining high-performance WebGL terminal emulation with an embedded offline AI reasoning engine, Sentinel eliminates manual syntax lookup, streamlines multi-task execution, and automates multi-stage workflows.

---

## 1. Embedded Local AI & Natural Language Navigation

- **Zero-Ollama Embedded Engine**: Bundles an embedded `llama-server` binary running `Qwen 2.5 Coder 3B GGUF` locally. Zero cloud subscriptions, zero external daemons, and zero private code transmission.
- **Natural Language Execution (`>`)**: Prefix any instruction with `>` to summon the local AI agent:
  - `> take me to my rust project` ➔ Resolves directory and automatically navigates.
  - `> find all docker volumes created this week` ➔ Scans and formats volume listings.
  - `> write a python script in /tmp/netmon.py that monitors network speeds, then test run it` ➔ Executes multi-step generation, permission setting, and execution.
- **Real-Time Prompt Progress Bar**: The bottom status bar features a live progress indicator displaying completion percentage (e.g. `45%`), active stage label (`Thinking...`, `Planning...`, `Running: ...`, `Verifying...`), remaining time countdown (`~1.8s`), and a sleek 36px micro-progress track.
- **In-Loop Auto-Heal**: When commands fail, Sentinel analyzes `stderr` and offers instant remediation pills. Press `Tab` or type `>fix` / `>heal` to automatically diagnose and recover (e.g., terminating conflicting processes on occupied ports).
- **Session Undo Log & Rollback**: Ask `>what did you just do` to inspect the action log, or `>undo last step` to roll back destructive filesystem or git operations.

---

## 2. Multi-Stage Workflows & Macro Recording Engine

- **Natural Language Workflow Recording**: Save repeatable multi-step procedures directly from conversational commands:
  ```bash
  > build frontend, compile cargo backend, and start local services :: save as workflow full-build
  ```
- **Deterministic 1-Word Replay**: Replay recorded workflows with zero AI latency or token cost:
  ```bash
  run workflow full-build
  ```
- **Workflow & Macro Drawer (`WorkflowManagerDrawer.tsx`)**:
  - Inspect saved workflows, parameter interpolation (`{{target}}`), execution histories, and step-by-step stdout/stderr outputs.
  - Replay individual steps, test workflows deterministically, and export workflow definitions to disk (`~/.sentinel/workflows/`).

---

## 3. High-Performance Terminal & Split Panes

- **Hardware-Accelerated WebGL Rendering**: Powered by `@xterm/xterm` with `@xterm/addon-webgl` for sub-millisecond input response, smooth scrolling, and zero character lag.
- **Infinite Split Pane Layouts**:
  - Vertical split (`Ctrl+Shift+D` / `Cmd+D`) and Horizontal split (`Ctrl+Shift+H` / `Cmd+Shift+D`).
  - Interactive split dividers with 8px grab hitboxes and active full-window dragging overlays.
  - Independent session persistence: Each pane preserves isolated PTY buffers, current working directories, and process states.
- **Tab Management & Renaming**:
  - Double-click any tab pill to rename it with custom labels. Custom names persist across app reloads.
  - Direct tab navigation shortcuts (`Ctrl+1` through `Ctrl+9`, `Ctrl+T` new tab, `Ctrl+W` close tab).

---

## 4. Developer Productivity Overlays

- **Global Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)**: Fast, unified launcher to search tools, trigger capabilities, and execute workflows without leaving the keyboard.
- **Listening Ports & Process Inspector (`Ctrl+Alt+P`)**:
  - Real-time display of all listening TCP/UDP ports, bound addresses, process names, and PIDs.
  - One-click process termination and port freeing.
- **Fuzzy Command History Search (`Ctrl+R`)**:
  - Intercepts raw shell reverse-search to provide an interactive, visual fuzzy search modal across entire command histories.
- **Workspace & Project Switcher (`Ctrl+O`)**:
  - Automatically scans active directories for Git repositories, Node.js packages, Rust crates, Python environments, and ROS2 workspaces.
  - Instant one-click folder navigation with repository branch status badges.
- **Terminal Search Bar Overlay (`Ctrl+F`)**:
  - Floating search bar with real-time match counter (`3 of 12`), previous/next navigation, and shortcut toggles for **Case Sensitivity (`Alt+C`)**, **Whole Word (`Alt+W`)**, and **Regex Mode (`Alt+R`)**.

---

## 5. UI Ergonomics & Pure Grayscale Aesthetic

- **Matte Grayscale Design System**:
  - Elimination of oversaturated neon glows and distracting colors in favor of high-contrast monochrome elegance.
  - Deep obsidian backgrounds (`#0A0A0C`), subtle hairline borders (`rgba(255, 255, 255, 0.08)`), and crisp white typographic hierarchy.
  - Cross-referenced in detail in [`docs/ui.md`](file:///docs/ui.md).
- **Zen Mode vs. Visual Mode (`Ctrl+Shift+Z`)**:
  - **Zen Mode**: Distraction-free terminal view hiding auxiliary badges and buttons.
  - **Visual Mode**: Displays graphical buttons in the status bar for Projects, Ports, and Workflows.
- **Hardware Telemetry**: Persistent bottom status bar monitors real-time CPU utilization (%), RAM consumption (MB/GB), 24h clock, UTF-8 status, and `[F1 help]`.

---

## 6. Zero-Trust Security & Safe Execution Sandboxing

- **Categorical Policy Engine**: Classifies operations into `SAFE`, `CONFIRMATION_REQUIRED`, `ADMIN_REQUIRED`, and `BLOCKED` categories.
- **Non-Blocking Consent Queue**: Displays clear, interactive security modals for destructive commands before execution can proceed.
- **AST Shell Verification (`ShellAstParser.ts`)**: Parses all generated shell commands through an abstract syntax tree validator to block obfuscated attacks (`eval`, `base64 -d | bash`).
- **Secret Redaction**: Automatically sanitizes API tokens, SSH keys, and passwords before persisting logs or displaying output.
