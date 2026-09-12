# Sentinel Terminal: Master Technical Roadmap & Capability Inventory

> **Document Version:** 3.0.0 (Linux Edition)  
> **Target OS:** Linux (Arch Linux, Hyprland, Wayland, X11, Systemd)  
> **Status:** Active Production Development  
> **Repository:** `NetPranav/Sentinal-Terminal` (Branch: `linux`)  

---

## Table of Contents
1. [Executive Summary](#1-executive-summary)
2. [What Has Been Done So Far (Completed Work)](#2-what-has-been-done-so-far-completed-work)
3. [Complete Capability Inventory (What This Codebase Can Do)](#3-complete-capability-inventory-what-this-codebase-can-do)
4. [What Needs to Be Done (Future Roadmap)](#4-what-needs-to-be-done-future-roadmap)
   - [Milestone 1: Linux Desktop & System UI Automation](#milestone-1-linux-desktop--system-ui-automation)
   - [Milestone 2: Multi-Stage Workflow & Macro Recording Engine](#milestone-2-multi-stage-workflow--macro-recording-engine)
   - [Milestone 3: Automated Evaluation & Prompt Benchmark Harness](#milestone-3-automated-evaluation--prompt-benchmark-harness)
   - [Milestone 4: Terminal Ecosystem & Wayland Rice Integration](#milestone-4-terminal-ecosystem--wayland-rice-integration)
5. [Master Domain Benchmark: Detailed Prompts, Verification & Fix Harness](#5-master-domain-benchmark-detailed-prompts-verification--fix-harness)
   - [Domain 1: System Diagnostics & Hardware Monitoring](#domain-1-system-diagnostics--hardware-monitoring)
   - [Domain 2: Process Management & Resource Optimization](#domain-2-process-management--resource-optimization)
   - [Domain 3: Network Diagnostics, Ports & Connections](#domain-3-network-diagnostics-ports--connections)
   - [Domain 4: Filesystem, Directory Navigation & File Search](#domain-4-filesystem-directory-navigation--file-search)
   - [Domain 5: Git & Developer Lifecycle Workflows](#domain-5-git--developer-lifecycle-workflows)
   - [Domain 6: Linux Daemons & Systemd Services](#domain-6-linux-daemons--systemd-services)
   - [Domain 7: Desktop Applications & UI Automation](#domain-7-desktop-applications--ui-automation)
   - [Domain 8: Linux Dotfiles & Rice Management (Hyprland / Waybar)](#domain-8-linux-dotfiles--rice-management-hyprland--waybar)
   - [Domain 9: Multi-Stage Composite Workflows](#domain-9-multi-stage-composite-workflows)
6. [Implementation Phases & Execution Timeline](#6-implementation-phases--execution-timeline)

---

## 1. Executive Summary

Sentinel Terminal is an autonomous, AI-native terminal copilot engineered for Linux developers and power users. Unlike traditional command-line LLM wrappers that merely print shell snippets for the user to copy-paste, Sentinel possesses **direct execution privileges, real-time feedback loops, self-healing retries, dry-run safety sandboxes, multi-phase planning, and continuous learning**.

This document provides a comprehensive historical record of all completed architectural milestones, an exhaustive inventory of existing capabilities, an actionable blueprint for upcoming high-impact features (System UI Automation and Multi-Stage Workflows), and a rigorous benchmark harness containing over 115 domain-classified prompts.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             SENTINEL ARCHITECTURE                                │
├──────────────────────────┬────────────────────────────┬──────────────────────────┤
│    Presentation Layer    │     AI & Agent Engine      │  Capabilities & Drivers  │
│  • xterm.js (WebGL PTY)  │  • ReAct Agent Loop        │  • Native Linux Sysfs    │
│  • ANSI OutputFormatter  │  • Standalone llama-server │  • Systemd Service Mgr   │
│  • Dropdown Action Plans │  • Reasoning Extraction    │  • Security Risk Engine  │
│  • Rice Personalization  │  • Self-Healing Retries    │  • Workflow IR Engine    │
└──────────────────────────┴────────────────────────────┴──────────────────────────┘
```

---

## 2. What Has Been Done So Far (Completed Work)

### A. Pure Linux Native Modernization
- **Hardcoded macOS Eradication**: Removed legacy assumptions of Darwin/macOS (`/bin/zsh`, `mdfind`, `pmset`, `system_profiler`, `networksetup`, `osascript`).
- **Dynamic Linux Shell Execution**: Configured `ShellSDKCapability.ts` and `ShellAdapter.ts` to detect Linux dynamically, invoking `/bin/bash` with `['-c', commandLine]` while properly escaping subshells and pipes.
- **Native Hardware Probing**:
  - **Storage**: Replaced mock `APFS` 512GB data with live `df -h -P -x tmpfs -x devtmpfs -x squashfs -x efivarfs` queries parsing real physical mount points (`/`, `/boot`, `/mnt/windows`).
  - **RAM**: Replaced hardcoded Apple M3 Pro 18GB data with live `free -m` queries parsing total, used, free, available RAM, and swap partition utilization.
  - **Battery**: Direct hardware inspection via Linux sysfs `/sys/class/power_supply/BAT*/capacity` and `status`, with fallback to `upower -i` and AC desktop detection.
  - **CPU & Kernel**: Real system introspection via `uname -srm`, `/etc/os-release`, `lscpu`, and `uptime -p`.
  - **Process Sorting**: Native `ps -eo pid,pcpu,pmem,comm --sort=-pcpu` for CPU and `--sort=-pmem` for memory.

### B. Dual-Engine AI Architecture (No Ollama Requirement)
- **Standalone Embedded Engine (`llama-server`)**:
  - Implemented dynamic Linux binary discovery across `/usr/lib/ollama/llama-server`, `/usr/bin/llama-server`, `/usr/local/bin/llama-server`, and `~/.local/bin/llama-server`.
  - Automated local GGUF discovery across `~/.sentinel/models/`, `~/.ollama/models/blobs/`, and `/var/lib/ollama/blobs/`.
  - Fixed `--flash-attn auto` invocation in `embedded_server.rs` ensuring zero-argument crashes on Linux x86_64.
- **Ollama Reasoning Model Support (`qwen3:4b` / DeepSeek-R1)**:
  - Added token capture from `data.thinking` in `OllamaProvider.ts` when models output thinking tokens without immediate standard text.
  - Passed `think: false` for standard fast commands to eliminate redundant CPU computation.
  - Increased `maxTokens` from 256 to 1024 to prevent answer truncation during complex reasoning.

### C. Security Sandbox & Permission Optimization
- **Zero-Latency Linux Inspection**:
  - Expanded `safeCommands` in `SecurityEngine.ts` to include standard Linux read-only diagnostics: `free`, `ip`, `ss`, `ping`, `lscpu`, `acpi`, `upower`, `nmcli`, `lsblk`, `timedatectl`, `resolvectl`, `sensors`, `hostnamectl`, `inxi`, `lsusb`, `lspci`, and `arch`.
  - Resolved the 5-minute (300,000ms) consent modal timeout that previously blocked automated commands in the terminal buffer.
- **Risk Scoring & AST Parsing**:
  - Implemented `ShellAstParser.ts` to detect subshells, command chaining (`&&`, `;`, `|`), and high-risk patterns (`rm -rf`, `mkfs`, `dd`, `chmod 777`).

### D. Presentation & Output Formatting (Option 4 Singular Process Card)
- **Structured ANSI Formatting**:
  - Transformed raw JSON dumps (`activeProcesses: [...]`, `volumes: [...]`) into human-readable ANSI terminal blocks.
- **Singular vs. Plural Query Resolution**:
  - Singular requests (e.g. `>which process is using the most cpu`, `>which process is using the most memory`) render as a dedicated highlight card:
    ```text
    ▶ Top Process (sorted by CPU): llama-server  (PID:52374 | CPU: 196% | RAM: 19.9%)
    ```
  - Plural requests (e.g. `>list running processes`) render the full 15-process diagnostic overview.
- **Context-Aware Terminal Streamer**:
  - Updated `TerminalView.tsx` to forward the current `aiGoal` to `formatDataOutput`, enabling adaptive UI layout changes based on user intent.

### E. AI Prompt Tuning & Few-Shot Grounding
- **Linux Few-Shot Examples**:
  - Grounded `SystemPrompt.ts` with native Linux patterns (`ip -br addr`, `ss -tulpn`, `ps -eo ... | head -n 2`, `free -h`, `df -h .`).
- **Greeting & Refusal Interceptors**:
  - Intercepts canned chatbot refusals ("As an AI language model...") and enforces terminal execution authority.
  - Intercepts generic greetings returned on actionable queries and activates automatic deterministic fallbacks.

---

## 3. Complete Capability Inventory (What This Codebase Can Do)

Sentinel's codebase is composed of six deep subsystems:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               CAPABILITY INVENTORY                              │
├──────────────────────┬─────────────────────────────┬────────────────────────────┤
│ 1. Terminal & Shell  │ 2. Diagnostics & Hardware   │ 3. Networking & Ports      │
│ • xterm.js WebGL     │ • CPU / RAM real metrics    │ • ss / lsof port inspect   │
│ • Linux bash PTY     │ • Storage mounts via df     │ • Free port discovery      │
│ • Multi-tab & Splits │ • Battery status via sysfs  │ • Local/WAN IP discovery   │
│ • Output observer    │ • Top CPU/RAM processes     │ • Wi-Fi scan via nmcli     │
├──────────────────────┼─────────────────────────────┼────────────────────────────┤
│ 4. AI & Autonomous  │ 5. Security & Safety        │ 6. Rice & Workflow Engine  │
│ • Embedded llama.cpp │ • AST command parsing       │ • Hyprland/Waybar config   │
│ • Ollama provider    │ • Risk scoring (0–100)      │ • Multi-stage workflow IR  │
│ • Self-healing retry │ • Dangerous command blocker │ • Episodic memory (~/.sent)│
│ • GBNF JSON grammar  │ • Read-only fast pass       │ • Human teach (/learn)     │
└──────────────────────┴─────────────────────────────┴────────────────────────────┘
```

### 1. Terminal & Shell Core
- **Interactive PTY Session Manager**: Native Rust pseudo-terminal (`pty.rs`) running bash, fish, or zsh with full ANSI color support, resize events, and clean process lifecycle management.
- **Split Terminals & Tabs**: Supports side-by-side vertical/horizontal terminal splits, independent working directories, and tabbed workspaces.
- **Shadow PTY Simulator (`ShadowPtySimulator.ts`)**: Runs commands in an invisible background PTY to verify success, exit codes, and output before modifying the user's active terminal.
- **Real-Time Output Observer (`PtyOutputObserver.ts`)**: Monitors command output in real time to diagnose build failures, missing packages, and runtime errors, offering instant `>fix` / `>heal` remediation.

### 2. Autonomous AI Agent Core
- **Dual Execution Engine**:
  - **Standalone Embedded AI**: Boots `llama-server` on localhost with zero external dependencies, downloading and loading GGUF models directly.
  - **Ollama Client**: High-speed connection to local Ollama server supporting Qwen, DeepSeek, and Llama families.
- **ReAct Execution Loop**: Reason $\rightarrow$ Act $\rightarrow$ Observe loop executing native capability tools or arbitrary shell commands.
- **Self-Healing Diagnostics**: When a command exits with a non-zero code or error, Sentinel automatically captures stderr, feeds it back to the AI, and executes a diagnosed alternative (up to 3 retries).
- **Adaptive Plan Engine (`AdaptivePlanEngine.ts`)**: Automatically activates for complex, multi-stage goals, breaking them into hierarchical phases with progress tracking in a dropdown overlay.
- **Activation Steering & GBNF Grammar**: Employs logit biasing to suppress conversational refusals and GBNF grammar decoding to guarantee strict JSON output.

### 3. Native Operating System & Hardware Monitoring
- **CPU & Load**: Live core counts, processor model, and 1/5/15-minute load averages.
- **Memory & Swap**: Precise RAM allocations, cache/buffer sizes, available memory, and swap utilization.
- **Disk & Mounts**: Physical disk partitions, mount locations, filesystem types, and percentage space used.
- **Battery & Power**: Charge percentage, charging state (Charging/Discharging/AC), power supply adapter name.
- **System Uptime & OS Version**: Formatted human-readable uptime (`uptime -p`) and distribution release details (`/etc/os-release`).
- **Process Inspection & Termination**:
  - Top processes sorted by CPU or memory.
  - Singular top process highlight cards.
  - Termination by process name (`pkill`), PID (`kill -9`), or port number (`lsof -ti :<port> | xargs kill -9`).

### 4. Networking & Connectivity
- **Port Auditing**: Audits active TCP/UDP listening ports, mapping port numbers directly to owning process names and PIDs.
- **Free Port Discovery**: Scans and returns available unallocated ports for web servers, dev servers (Vite, Next.js), and database bindings.
- **IP Address Discovery**: Instant extraction of local network interface IP (`ip -br addr`) and WAN public IP (`api.ipify.org`).
- **Wi-Fi & Bluetooth**: Lists available wireless SSIDs via `nmcli`, scans Bluetooth devices via `bluetoothctl`, and toggles adapter power states.

### 5. Developer & Rice Automation
- **Git Workflows**: Native repository status, branch listings, log history, and staged diff summaries.
- **Linux Rice & Dotfiles (`DotfileManager.ts`, `DotfileSyncEngine.ts`)**:
  - Inspects and modifies configuration files for Hyprland (`hyprland.conf`), Waybar, Kitty, Alacritty, Tmux, Rofi, and Neovim.
  - Toggles autostart applications in Hyprland (`exec-once`).
- **Systemd Daemon Control**: Queries status, starts, stops, restarts, enables, and disables systemd services for both system and `--user` scopes.
- **Demonstration & Continuous Learning (`DemonstrationLearningEngine.ts`, `EpisodicMemoryEngine.ts`)**:
  - `/learn <trigger> -> <command>` records custom workflows into `~/.sentinel/learned_patterns.json`.
  - Automatically records human demonstrations when the AI fails and the user demonstrates the correct command.
  - Episodic memory retrieves similar past successful actions and injects them as dynamic few-shots into new prompts.

---

## 4. What Needs to Be Done (Future Roadmap)

### Milestone 1: Linux Desktop & System UI Automation

Transform Sentinel from a terminal copilot into an autonomous Linux desktop copilot capable of controlling desktop windows, GUI apps, mouse/keyboard inputs, and taking visual screenshots on Wayland (Hyprland) and X11.

#### Key Architectural Components:
1. **Desktop Window Controller (`DesktopWindowCapability.ts`)**:
   - **Hyprland Native**: Direct integration with `hyprctl` socket:
     - `hyprctl dispatch focuswindow <class|title>`
     - `hyprctl dispatch movetoworkspace <id>`
     - `hyprctl dispatch togglefloating`
     - `hyprctl dispatch killactive`
     - `hyprctl clients -j` (parse active desktop windows, positions, and workspaces into JSON).
   - **X11 Fallback**: Support `wmctrl` and `xdotool` for window manipulation.
2. **Synthetic Input Automation (`DesktopInputCapability.ts`)**:
   - Synthetic keystroke typing, key combinations (e.g. `Ctrl+Shift+T`, `Alt+Tab`, `Super+Q`).
   - Coordinate mouse clicking and scrolling via `ydotool` / `wtype` (Wayland) and `xdotool` (X11).
3. **Visual Desktop Inspection (`ScreenCaptureCapability.ts`)**:
   - Capture desktop or region screenshots via `grim` + `slurp` on Wayland and `scrot` on X11.
   - Feed cropped screenshots to local multimodal vision models (e.g. `qwen2.5-vl:3b` / `minicpm-v`) to enable visual UI automation (e.g. "click the blue Submit button on the screen").
4. **App Window Placement & Tiling Presets**:
   - Commands like `>snap browser left and terminal right` or `>move spotify to workspace 4`.

---

### Milestone 2: Multi-Stage Workflow & Macro Recording Engine

Enable users to execute very long, multistage prompts, record the resulting execution trajectory as a named workflow, and repeat the entire workflow on demand using only the given name.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           WORKFLOW LIFECYCLE FLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│  1. Long Multistage Prompt                                                      │
│     "deploy staging: build frontend, package container, push to registry,       │
│      run migration, and verify health check on port 8080"                       │
│                                      │                                          │
│                                      ▼                                          │
│  2. AI Adaptive Plan & Autonomous Step Execution                                │
│     Phase 1: npm run build ──► Phase 2: docker build ──► Phase 3: health check  │
│                                      │                                          │
│                                      ▼                                          │
│  3. Workflow Persistence                                                        │
│     User: >save workflow deploy-staging                                         │
│     Saves parameterized DAG to ~/.sentinel/workflows/deploy-staging.json        │
│                                      │                                          │
│                                      ▼                                          │
│  4. Instant 1-Word Replay                                                       │
│     User: >run workflow deploy-staging (or >deploy staging)                     │
│     Executes all stages deterministically with live status updates              │
└─────────────────────────────────────────────────────────────────────────────────┘
```

#### Key Architectural Components:
1. **Multistage Prompt Decomposer**:
   - Takes long composite requests with multiple conjunctions ("first..., then..., after that...").
   - Builds a formal directed acyclic graph (DAG) using the existing `src/workflows/engine/WorkflowIRCompiler.ts`.
2. **Interactive Workflow Recorder**:
   - Command: `>save workflow <name>` or `/workflow save <name> [description]`.
   - Captures all executed steps, parameters, working directories, and validation checks from the recent session into a reusable `UserWorkflow` JSON artifact in `~/.sentinel/workflows/`.
3. **Deterministic Fast-Replay Engine**:
   - Command: `>run workflow <name>` or `/<name>`.
   - Executes the compiled nodes directly without requiring LLM re-inference, ensuring instant execution and zero token cost.
4. **Parameter Overrides & Environment Injection**:
   - Ability to run: `>run workflow deploy-staging --port=9000 --tag=v2.0`.
5. **Workflow Management UI**:
   - Visual Workflow Drawer in the Sentinel UI allowing users to view, edit, reorder, delete, and trigger saved workflows.

---

### Milestone 3: Automated Evaluation & Prompt Benchmark Harness

A self-verifying test harness that executes an extensive suite of domain-specific prompts, captures outputs, validates correctness against strict test oracles, and triggers self-correction when anomalies are detected.

#### Key Architectural Components:
1. **Benchmark Runner Script (`scripts/benchmark_prompts.ts`)**:
   - Automates programmatic submission of test prompts to `AgentLoop.run()`.
   - Records:
     - Prompt text & domain classification.
     - Model used (`qwen3:4b`, `qwen2.5-coder:3b`, etc.).
     - Tool called (`shell.execute`, `system.*`, `network.*`).
     - Command line generated.
     - Raw stdout/stderr and execution exit code.
     - Final formatted ANSI output string.
     - End-to-end execution latency.
2. **Automated Verification Oracles**:
   - **No Error Oracles**: Asserts absence of `os error 2`, `/bin/zsh`, `command not found`, `permission denied`.
   - **No Platform Mismatch Oracles**: Asserts absence of `APFS`, `Darwin`, `Apple M3`.
   - **Formatting Oracles**: Asserts presence of clean ANSI styling and absence of raw unformatted JSON dumps.
   - **Singular Precision Oracles**: For singular queries, asserts that exactly 1 item is returned rather than a multi-row table.
3. **Self-Correction & Automated Patching Loop**:
   - When a benchmark test fails, the harness classifies the failure:
     - `PROMPT_FAILURE`: LLM chose the wrong tool or bad syntax $\rightarrow$ appends few-shot exemplar.
     - `DRIVER_FAILURE`: Capability failed to parse Linux sysfs/command $\rightarrow$ generates patch in driver.
     - `FORMATTER_FAILURE`: Output displayed raw JSON or bad formatting $\rightarrow$ adjusts presentation logic.
   - Automatically reruns the failed prompt after applying the fix to confirm resolution.
4. **Continuous Quality Dashboard (`benchmark_report.json` / Markdown summary)**.

---

### Milestone 4: Terminal Ecosystem & Wayland Rice Integration

- **Interactive Rice Studio**: Graphical theme, color palette, and blur compositor controls for Hyprland/Wayland directly within the Sentinel sidebar.
- **Terminal Buffer Search & Regex Filtering**: In-buffer regex search (`Ctrl+Shift+F`) inside xterm.js.
- **Session Persistence & Workspace Restoration**: Restores open tabs, split panes, and active directories across app restarts (`~/.sentinel/sessions/last_session.json`).

---

## 5. Master Domain Benchmark: Detailed Prompts, Verification & Fix Harness

The following 115+ prompts are categorized across 9 critical functional domains. They form the automated evaluation suite for validating Sentinel on Linux.

### Domain 1: System Diagnostics & Hardware Monitoring
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 1.1 | `>system info` | `system.info` / `uname -srm` | OS Name, Kernel, Arch, CPU Model, Cores, Uptime | Contains `Linux`, valid kernel version, CPU cores count; no macOS/Darwin |
| 1.2 | `>check memory usage` | `system.ram` / `free -h` | Formatted RAM usage (used, total, available, swap) | RAM values in MB/GB; available RAM displayed cleanly |
| 1.3 | `>check storage` | `system.storage` / `df -h -P` | Storage Mounts list with total, free, and % used | Real Linux mounts (`/`); no APFS references |
| 1.4 | `>check available disk space` | `system.storage` / `df -h .` | Free space on current mount point | Shows current directory mount space |
| 1.5 | `>check battery status` | `system.battery` / sysfs BAT | Battery percentage & charging state (or AC Power) | Valid percentage integer (0–100%) or AC Desktop message |
| 1.6 | `>what is my battery level` | `system.battery` / sysfs BAT | Single battery percentage card | Formatted battery card with icon |
| 1.7 | `>system uptime` | `system.uptime` / `uptime -p` | Formatted uptime duration | Starts with `up ` (e.g. `up 3 hours, 12 minutes`) |
| 1.8 | `>cpu info` | `system.cpu` / `lscpu` | Processor model, architecture, cores, load averages | Valid Linux processor name (Intel/AMD/ARM) |
| 1.9 | `>check cpu load` | `lscpu` / `cat /proc/loadavg` | 1, 5, and 15-minute load averages | Three floating point numbers |
| 1.10 | `>check swap usage` | `free -h` / `swapon --show` | Swap total, used, and free | Displays swap size or swap disabled status |
| 1.11 | `>hardware specs` | `system.info` | Aggregated hardware summary card | OS, CPU, RAM, and storage overview |
| 1.12 | `>check disk usage of current folder` | `du -sh .` | Human-readable size of current directory | Number followed by K/M/G (e.g. `245M .`) |
| 1.13 | `>check disk space on root partition` | `df -h /` | Root partition total, used, and available space | Mount point is `/` |
| 1.14 | `>check system architecture` | `uname -m` | System architecture (e.g. `x86_64`) | Single string `x86_64`, `aarch64`, etc. |
| 1.15 | `>display linux kernel version` | `uname -r` | Exact Linux kernel version string | Kernel version matching `uname -r` |

---

### Domain 2: Process Management & Resource Optimization
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 2.1 | `>which process is using the most cpu` | `system.processes` (singular) | Single process card: Name, PID, CPU%, RAM% | **Exactly 1 process** displayed; includes CPU% and PID |
| 2.2 | `>which process is using the most memory` | `system.processes` (singular) | Single process card: Name, PID, RAM%, CPU% | **Exactly 1 process** displayed; sorted by RAM% |
| 2.3 | `>top cpu process` | `system.processes` (singular) | Top process card | Singular highlight card |
| 2.4 | `>top ram process` | `system.processes` (singular) | Top RAM process card | Singular highlight card |
| 2.5 | `>list running processes` | `system.processes` (batch) | List of top 10–15 processes | Clean table/list with PIDs, names, CPU%, and RAM% |
| 2.6 | `>show top 5 processes by cpu` | `ps -eo pid,pcpu,comm --sort=-pcpu \| head -6` | Top 5 CPU processes | Exactly 5 process rows |
| 2.7 | `>show top 5 processes by memory` | `ps -eo pid,pmem,comm --sort=-pmem \| head -6` | Top 5 memory processes | Exactly 5 process rows |
| 2.8 | `>is spotify running` | `pgrep -i -l spotify` / `ps` | Process name & PID if active, or "Not running" | Accurate boolean detection of process presence |
| 2.9 | `>is node running` | `pgrep -i -l node` | Active Node.js PIDs or clean negative message | Accurate identification of node threads |
| 2.10 | `>kill process named test-app` | `system.kill_process` / `pkill` | Termination confirmation with process name | Successfully attempts `pkill -9 -i -f test-app` |
| 2.11 | `>kill process with pid 99999` | `system.kill_process` / `kill` | Failure report (no process found) or terminated | Handles non-existent PID gracefully without crash |
| 2.12 | `>kill process on port 3000` | `system.kill_process` (port) | Terminates PID occupying port 3000 | Resolves port to PID and sends SIGKILL |
| 2.13 | `>show process tree` | `pstree` / `ps axjf` | Hierarchical process tree output | Formatted process tree hierarchy |
| 2.14 | `>count total running processes` | `ps -e \| wc -l` | Integer count of running processes | Valid number |
| 2.15 | `>find pid of hyprland` | `pidof Hyprland \|\| pgrep -x Hyprland` | PID of active window manager | Valid integer PID |

---

### Domain 3: Network Diagnostics, Ports & Connections
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 3.1 | `>tell me all running ports` | `network.ports` / `ss -tulpn` | List of active listening ports & processes | Lists port numbers with TCP/UDP protocol |
| 3.2 | `>check open ports` | `network.ports` | Clean listening ports overview | Clean port numbers without terminal garbling |
| 3.3 | `>check if port 8080 is in use` | `network.ports({ port: 8080 })` | Boolean status of port 8080 + owner process | Identifies if port is free or occupied |
| 3.4 | `>is port 3000 open` | `network.ports({ port: 3000 })` | Port 3000 status | Specific status report for port 3000 |
| 3.5 | `>find a free port` | `network.ports({ findFree: true })` | Discovered available port number | Returns valid unallocated port (e.g. 3001, 8081) |
| 3.6 | `>find 3 available ports` | `network.ports` | List of 3 free port numbers | Returns 3 distinct available ports |
| 3.7 | `>check my ip address` | `ip -br addr` / `hostname -I` | Local interface IPs and WAN public IP | Valid IPv4 format (`192.168.x.x` or similar) |
| 3.8 | `>what is my local ip` | `ip -br addr show` | Local network IP addresses per adapter | Identifies `wlan0`, `eth0`, or `enp*` |
| 3.9 | `>what is my public ip` | `curl -s https://api.ipify.org` | WAN external public IP address | Valid public IP format |
| 3.10 | `>ping google.com` | `network.ping` / `ping -c 3` | Ping latency stats (avg, min, max ms) | 3 packets transmitted, avg RTT calculated |
| 3.11 | `>test internet connection` | `ping -c 2 1.1.1.1` | Connectivity confirmation | Success status indicator |
| 3.12 | `>scan wifi networks` | `network.wifi.scan` / `nmcli dev wifi` | List of SSIDs, signal strengths, security | Formatted network list with signal bars |
| 3.13 | `>turn on wifi` | `network.wifi.on` / `nmcli r wifi on` | Wi-Fi adapter enabled confirmation | Wi-Fi radio set to enabled |
| 3.14 | `>turn off wifi` | `network.wifi.off` / `nmcli r wifi off` | Wi-Fi adapter disabled confirmation | Wi-Fi radio set to disabled |
| 3.15 | `>list bluetooth devices` | `network.bluetooth.list` | Paired and available Bluetooth devices | Device names and MAC addresses |

---

### Domain 4: Filesystem, Directory Navigation & File Search
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 4.1 | `>find all python files in this directory` | `find . -name "*.py"` | List of `.py` file paths | Files end with `.py`; path is relative or absolute |
| 4.2 | `>find all typescript files` | `find . -name "*.ts" -not -path "*/node_modules/*"` | List of `.ts` files, excluding node_modules | No `node_modules` pollution in results |
| 4.3 | `>find files named package.json` | `find . -name "package.json"` | Paths to package.json files | Exact match on filename |
| 4.4 | `>search for frontend in folders` | `find . -type d -iname "*frontend*"` | Matching directory paths | Results are directories only |
| 4.5 | `>list files in current directory` | `filesystem.list` / `ls -la` | Directory contents with permissions & sizes | Proper file permissions, sizes, and names |
| 4.6 | `>show hidden files` | `ls -ld .*` | Dotfiles in current directory | Only files starting with `.` |
| 4.7 | `>navigate to home` | `filesystem.navigate({ path: "~" })` | Directory changed to `~` | Current working directory updates to `/home/<user>` |
| 4.8 | `>go back one directory` | `cd ..` | Directory changed to `..` | PWD moves up one level |
| 4.9 | `>find files larger than 100MB` | `find . -type f -size +100M` | Large files with sizes | Files exceeding 100 megabytes |
| 4.10 | `>search text "OllamaProvider" in src` | `grep -rn "OllamaProvider" src/` | Matching filenames and line numbers | Lines containing exact search query |
| 4.11 | `>count lines of code in src directory` | `find src -name "*.ts" \| xargs wc -l` | Total lines count | Valid numerical total |
| 4.12 | `>show top 5 largest files in this folder` | `du -ah . \| sort -rh \| head -5` | 5 largest files with human sizes | Sorted in descending size order |
| 4.13 | `>check if file README.md exists` | `test -f README.md && echo "Exists"` | Existence confirmation | Boolean verification |
| 4.14 | `>create temporary test folder` | `mkdir -p ./tmp_test` | Folder creation confirmation | Folder created on disk |
| 4.15 | `>delete temporary test folder` | `rm -rf ./tmp_test` | Folder deletion confirmation | Folder removed cleanly |

---

### Domain 5: Git & Developer Lifecycle Workflows
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 5.1 | `>check git status` | `git.status` / `git status --short` | Clean or modified working tree status | Formatted branch and file status |
| 5.2 | `>check git branches` | `git branch -a` | Active branch highlighted with `*`, remotes | Correct current branch indicated |
| 5.3 | `>recent git commits` | `git.log` / `git log --oneline -5` | Last 5 commits with hashes and titles | Exactly 5 one-line commit logs |
| 5.4 | `>show git diff summary` | `git diff --stat` | Files modified and lines added/deleted | Stat summary format |
| 5.5 | `>who committed last` | `git log -1 --format="%an <%ae> - %s"` | Author name, email, and commit message | Extracted author details |
| 5.6 | `>show git remotes` | `git remote -v` | Fetch and push remote URLs | Origin remote displayed |
| 5.7 | `>check git stash list` | `git stash list` | Stashed changes or "No stashes" | Accurate stash stack report |
| 5.8 | `>create new git branch feature-test` | `git checkout -b feature-test` | Branch created confirmation | Switched to new branch |
| 5.9 | `>switch back to branch linux` | `git checkout linux` | Switched branch confirmation | Active branch is `linux` |
| 5.10 | `>delete test branch feature-test` | `git branch -D feature-test` | Branch deleted confirmation | Branch removed from local refs |
| 5.11 | `>show unpushed commits` | `git log @{u}..HEAD --oneline` | Commits ahead of upstream | Accurate ahead/behind count |
| 5.12 | `>run unit tests` | `npm test` / `npx vitest run` | Test suite execution summary | Reports test pass/fail counts |
| 5.13 | `>run linter` | `npm run lint` / `npx eslint .` | Lint report or clean status | Executes project linter |
| 5.14 | `>check node version` | `node -v` | Installed Node.js version | Version string matching `v*.*.*` |
| 5.15 | `>check npm dependencies outdated` | `npm outdated` | List of outdated dependencies | Clean dependency table |

---

### Domain 6: Linux Daemons & Systemd Services
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 6.1 | `>check status of bluetooth service` | `systemctl status bluetooth` | Service active/inactive status, PID, logs | Accurate service state parsing |
| 6.2 | `>check status of NetworkManager` | `systemctl status NetworkManager` | NetworkManager active/running status | Correct daemon state |
| 6.3 | `>is docker daemon running` | `systemctl is-active docker` | "active" or "inactive" status | Boolean running detection |
| 6.4 | `>list failed systemd services` | `systemctl --failed` | Any crashed or failed units | Accurate failed unit reporting |
| 6.5 | `>list active user services` | `systemctl --user list-units --type=service` | User-scoped services list | Targets `--user` scope |
| 6.6 | `>restart NetworkManager service` | `sudo systemctl restart NetworkManager` | SENSITIVE prompt / confirmation | Security engine prompts for consent |
| 6.7 | `>check systemd journal errors for today` | `journalctl -p 3 -xb` | High priority errors from current boot | Filters by priority 3 (errors) |
| 6.8 | `>check ssh service status` | `systemctl status sshd \|\| status ssh` | SSH server active status | Correct SSH daemon check |
| 6.9 | `>check cron or timer services` | `systemctl list-timers` | Active systemd timer schedules | Formatted timers list |
| 6.10 | `>reload systemd daemon` | `sudo systemctl daemon-reload` | Reload confirmation | Security verification |

---

### Domain 7: Desktop Applications & UI Automation
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 7.1 | `>open visual studio code` | `application.open` / `code .` | Launch confirmation for VS Code | Resolves application binary |
| 7.2 | `>open google chrome` | `application.open` / `google-chrome` | Launch confirmation for Chrome | Resolves web browser binary |
| 7.3 | `>open terminal settings` | `open settings drawer` | Personalization drawer opens in UI | Internal UI event emitted |
| 7.4 | `>search google for tauri linux guide` | `browser.search` | Opens default browser with query URL | Launches `xdg-open` with encoded URL |
| 7.5 | `>navigate to github.com` | `browser.navigate` | Opens browser to `https://github.com` | Valid URL opened in default browser |
| 7.6 | `>list active desktop windows` | `hyprctl clients -j` (Hyprland) | Window titles, classes, workspaces | JSON/formatted window list |
| 7.7 | `>focus window firefox` | `hyprctl dispatch focuswindow firefox` | Focus window confirmation | Dispatches focus event |
| 7.8 | `>move current window to workspace 2` | `hyprctl dispatch movetoworkspace 2` | Window move confirmation | Dispatches workspace change |
| 7.9 | `>take desktop screenshot` | `grim ~/screenshot.png` | Screenshot file saved confirmation | Creates PNG image on disk |
| 7.10 | `>toggle window floating` | `hyprctl dispatch togglefloating` | Window state toggled | Dispatches floating toggle |
| 7.11 | `>lock screen` | `loginctl lock-session` | Screen lock confirmation | Dispatches lock command |
| 7.12 | `>close active window` | `hyprctl dispatch killactive` | Window closed confirmation | Dispatches killactive command |

---

### Domain 8: Linux Dotfiles & Rice Management (Hyprland / Waybar)
| # | Prompt | Target Tool / Command | Expected Output Structure | Verification Criteria |
|---|---|---|---|---|
| 8.1 | `>show my hyprland autostart apps` | `cat ~/.config/hypr/hyprland.conf \| grep exec-once` | List of autostart programs | Accurate extraction of `exec-once` lines |
| 8.2 | `>enable autostart for waybar` | `dotfile.enable` | `exec-once = waybar` verified in config | Config updated or confirmed present |
| 8.3 | `>disable autostart for waybar` | `dotfile.disable` | Commented out in `hyprland.conf` | Prepended with `#` comment |
| 8.4 | `>check my waybar config file` | `filesystem.read(~/.config/waybar/config)` | File contents or status | Reads JSON/CSS configuration |
| 8.5 | `>check kitty terminal config` | `cat ~/.config/kitty/kitty.conf` | Kitty configuration lines | Extracts font, color, padding settings |
| 8.6 | `>backup my dotfiles` | `tar -czf ~/.config_backup.tar.gz ~/.config` | Backup archive creation confirmation | Tarball generated in user home |
| 8.7 | `>reload hyprland config` | `hyprctl reload` | Hyprland reload confirmation | Reload exit code 0 |
| 8.8 | `>check active hyprland monitors` | `hyprctl monitors -j` | Monitor names, resolutions, refresh rates | Formatted display metrics |
| 8.9 | `>switch terminal color theme` | UI Theme Dispatcher | Terminal color scheme updates | Emits theme change event |
| 8.10 | `>show rofi configuration` | `cat ~/.config/rofi/config.rasi` | Rofi theme and layout settings | Rasi config output |

---

### Domain 9: Multi-Stage Composite Workflows
| # | Prompt | Stages / Execution Flow | Expected Output Structure |
|---|---|---|---|
| 9.1 | `>clean project: remove node_modules, reinstall dependencies, and verify tests pass` | 1. `rm -rf node_modules package-lock.json`<br>2. `npm install`<br>3. `npm test` | Stage-by-stage execution with phase checklist and final pass confirmation. |
| 9.2 | `>git sync: stash changes, pull latest linux branch, pop stash, and show status` | 1. `git stash`<br>2. `git pull origin linux`<br>3. `git stash pop`<br>4. `git status` | Clean multi-step git sync pipeline with conflict detection. |
| 9.3 | `>docker clean: stop all containers, prune unused volumes, and show remaining images` | 1. `docker stop $(docker ps -aq)`<br>2. `docker volume prune -f`<br>3. `docker images` | Container stop status, reclaimed space report, remaining images list. |
| 9.4 | `>prepare release: check clean git status, run linter, run tests, and build production bundle` | 1. `git status --porcelain`<br>2. `npm run lint`<br>3. `npm test`<br>4. `npm run build` | Multi-phase release verification gate confirming zero errors before build. |
| 9.5 | `>system health audit: check cpu, memory, disk, failed services, and battery` | 1. `lscpu`<br>2. `free -h`<br>3. `df -h /`<br>4. `systemctl --failed`<br>5. sysfs battery | Unified executive health card summarizing all 5 hardware metrics. |
| 9.6 | `>save workflow release-gate` | Macro Engine | Saves pipeline 9.4 as `release-gate.json` in `~/.sentinel/workflows/`. |
| 9.7 | `>run workflow release-gate` | Macro Replay Engine | Executes pipeline 9.4 with zero LLM inference tokens. |
| 9.8 | `>dev environment boot: check port 3000, kill if in use, launch vite, and open browser` | 1. Port 3000 check<br>2. Port release<br>3. `npm run dev`<br>4. `browser.navigate` | Development server boot orchestration. |
| 9.9 | `>backup database and prune old archives older than 7 days` | 1. `pg_dump / sqlite3 backup`<br>2. `find /backups -mtime +7 -delete` | Backup created with timestamp and old archives pruned. |
| 9.10 | `>audit listening ports and terminate unauthorized processes` | 1. `ss -tulpn`<br>2. Filter unauthorized ports<br>3. Kill matching PIDs | Security compliance audit report and remediation log. |

---

## 6. Implementation Phases & Execution Timeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                               EXECUTION TIMELINE                                │
├─────────────────┬───────────────────────────────────────────────────────────────┤
│ Phase 1         │ Linux UI & Desktop Automation                                 │
│ (Next Milestone)│ • Hyprland hyprctl client and window dispatcher               │
│                 │ • Wayland wtype / ydotool synthetic keyboard & mouse driver   │
│                 │ • Grim/Slurp visual screenshot capture capability             │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ Phase 2         │ Multi-Stage Workflow & Macro Engine                           │
│                 │ • Long prompt decomposition into DAG workflow                 │
│                 │ • >save workflow <name> persistence to ~/.sentinel/workflows/ │
│                 │ • Deterministic >run workflow <name> fast replay runner       │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ Phase 3         │ Automated Evaluation & Prompt Benchmark Harness               │
│                 │ • Benchmark test harness script executing 115+ prompts        │
│                 │ • Strict verification oracles and automated failure triage    │
│                 │ • Self-healing driver and prompt patch generator              │
├─────────────────┼───────────────────────────────────────────────────────────────┤
│ Phase 4         │ Production Hardening & Release                                │
│                 │ • Offline packaging for Arch Linux (AUR PKGBUILD)             │
│                 │ • Performance optimization on low-power Intel/AMD CPUs        │
└─────────────────┴───────────────────────────────────────────────────────────────┘
```

---
*Maintained by Antigravity AI & Sentinel Terminal Development Team.*
