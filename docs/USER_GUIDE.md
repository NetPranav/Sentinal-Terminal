# Sentinel Terminal — User Guide

Welcome to **Sentinel**, an AI-native desktop terminal engineered to modernize how developers and power users interact with their machines. Whether managing system daemons, navigating complex multi-repo projects, inspecting open ports, or recording automated multi-step workflows, Sentinel provides a unified, intelligent workspace.

---

## 1. Launching Sentinel

1. **Start the Application**:
   - **Linux**: Launch `sentinel` from your application launcher (Rofi, Wofi, GNOME, KDE) or run `sentinel` from your CLI.
   - **macOS**: Open `Sentinel Terminal.app` from your Applications folder.
   - **Windows**: Launch Sentinel from the Start menu or desktop shortcut.
2. **Automatic Engine Boot**:
   - Sentinel automatically launches the embedded `llama-server` in the background.
   - Look at the bottom status bar: `● AI: Ready` indicates the embedded `Qwen 2.5 Coder 3B GGUF` model is loaded and ready for immediate inference with zero external configuration.
3. **Interactive Workspace**: You can start typing standard shell commands immediately or summon the AI assistant.

---

## 2. Standard Shell Commands vs. AI Prompts (`>`)

Sentinel cleanly separates raw shell execution from AI assistance:

### A. Standard Shell Execution
Standard commands run directly through your native PTY (`/bin/bash` or `/bin/zsh`) with sub-millisecond execution:
```bash
git status
docker compose ps
npm run build
```

### B. Natural Language Execution (`>`)
Prefix any instruction with **`>`** to invoke Sentinel's local reasoning agent:
```bash
> show me all docker containers using more than 500MB of RAM
> find files modified in the last 24 hours in src/
> write a python script in /tmp/netmon.py that monitors network throughput and run it
```

### C. Reading the Live Progress Bar
Whenever a `>` prompt runs, the bottom bar's AI status indicator expands into a live progress pill:
- **Status Dot**: Sky-blue pulsing dot while running, turning green on completion (`✓ Done`).
- **Percentage**: Real-time completion progress (e.g. `45%`).
- **Stage Label**: Displays the active lifecycle step (`Thinking...`, `Planning...`, `Running: git status...`, `Verifying...`).
- **Remaining Time**: Dynamic countdown estimate based on hardware inference speed (e.g. `~1.8s`).
- **Micro-Progress Bar**: 36px wide track illustrating progress.
- **Hover Tooltip**: Hovering over the progress pill shows the full prompt goal, stage details, elapsed seconds, and estimated time remaining.

---

## 3. Self-Healing & Error Remediation

When a command fails (e.g., port already in use, missing directory, process conflict):
1. **Auto-Heal Notification**: Sentinel detects the non-zero exit code and error signature in `stderr`.
2. **One-Key Remediation**: An auto-heal remediation pill appears. Press **`Tab`** to immediately execute the suggested fix (e.g., freeing the occupied port or creating missing directories).
3. **Manual Trigger**: You can also type **`>fix`** or **`>heal`** at any time to diagnose and resolve the last terminal error.

---

## 4. Multi-Stage Workflows & Macro Recording

Automate repetitive developer procedures into reusable 1-word macros:

### A. Recording While Executing
Combine execution with workflow recording using the `:: save as workflow <name>` directive:
```bash
> clean build cache, run cargo test, and package release :: save as workflow release-prep
```
Sentinel executes the tasks, verifies each step's exit code, and writes the structured workflow to `~/.sentinel/workflows/release-prep.json`.

### B. Replaying Workflows
Execute recorded workflows anytime with zero AI latency:
```bash
run workflow release-prep
```

### C. Workflow Manager Drawer
Click **Workflows** in the status bar (in Visual Mode) to inspect saved workflows, replay individual steps, customize parameters, or view execution logs.

---

## 5. Developer Modals & Quick Launchers

- **Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`)**: Search capabilities, run tools, or jump to settings without touching the mouse.
- **Listening Ports & Process Inspector (`Ctrl+Alt+P`)**: View all active listening TCP/UDP ports, bound addresses, and process IDs. Terminate stuck servers with 1 click.
- **Workspace Switcher (`Ctrl+O`)**: Instantly index and jump between Git repositories, Rust crates, Node.js packages, and ROS2 workspaces.
- **Fuzzy History Search (`Ctrl+R`)**: Search your entire bash/zsh command history with interactive fuzzy matching and instant execution.
- **Terminal Search Overlay (`Ctrl+F`)**: Search terminal scrollback buffers with **Case Sensitive (`Alt+C`)**, **Whole Word (`Alt+W`)**, and **Regex (`Alt+R`)** toggles.
- **Keyboard Shortcuts & Help (`F1`)**: View the complete reference of keybindings and application controls.

---

## 6. Multi-Pane Workspaces & Zen Mode

- **Split Panes**: Split vertically (`Ctrl+Shift+D`) or horizontally (`Ctrl+Shift+H`). Adjust ratios by dragging the divider bar.
- **Tab Customization**: Double-click any tab pill to assign custom labels that persist across app reloads.
- **Zen Mode vs. Visual Mode (`Ctrl+Shift+Z`)**:
  - **Zen Mode**: Hides all status bar buttons and auxiliary badges for distraction-free coding.
  - **Visual Mode**: Displays quick action buttons for Projects, Ports, and Workflows.
