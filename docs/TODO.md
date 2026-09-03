# Sentinel Terminal — Product Roadmap & Engineering Master Tracker

Sentinel Terminal is a high-performance, AI-native terminal emulator designed for mission-critical software engineering, robotics development (ROS/ROS 2), system administration, and modern full-stack workflows.

---

## 🏆 Master Roadmap Status by Tier

| Tier | Focus Area | Status | Key Deliverables |
|---|---|---|---|
| **Tier 1** | **Core Reliability, Security & Sandbox Fortification** | ✅ **100% COMPLETE** | Compound shell tokenizer, child-path protection, `cwd` propagation, cached path expansion, peripheral sanitization (749/749 tests green). |
| **Tier 2** | **Addictive Next-Gen Product Pillars & Power-User Tools** | ✅ **100% COMPLETE** | Visual Auto-Remediation Toast HUD, Workspace Quick-Switcher (`Cmd+O`), Port & Process Manager (`Cmd+Shift+P`), Frecency History (`Ctrl+R`) (754/754 tests green). |
| **Tier 3** | **Enterprise Security, Collaboration & Extensibility** | ⚪ **PLANNED** | Plugin Marketplace runtime, cryptographic tamper-evident audit logs, remote SSH session multiplexer. |

---

## 🛡️ Tier 1: Core Reliability, Security & Sandbox Fortification (COMPLETED)

All critical P0–P3 core vulnerabilities and sandboxing issues have been resolved, covered with automated regression tests, and verified:

- [x] **1.1 Compound Shell Command Chaining Risk Guard (Issue 9 / GitHub #2 - P0)**
  - *Target*: `src/domain/security/ShellCommandGuard.ts`
  - *Fix*: Implemented quote-aware lexical tokenizer splitting compound operators (`&&`, `;`, `||`, `|`, `&`) while respecting single/double quotes and escapes. Aggregates maximum risk score across all sub-commands, preventing hidden destructive execution.
- [x] **1.2 Protected Path & Child Deletion Prevention (Issue 11 / GitHub #3 - P0)**
  - *Target*: `src/domain/security/PolicyEngine.ts`
  - *Fix*: Added dot-segment path traversal normalization (`../`) and child-path matching (`normalized.startsWith(root + '/')`), blocking deletion of `/etc/hosts`, `/System/Library`, or directory traversal escapes.
- [x] **1.3 Working Directory (`cwd`) Context Propagation (Issue 10 / GitHub #4 - P1)**
  - *Target*: `src/sdk/capabilities/drivers/GitCapability.ts`, `src/sdk/capabilities/drivers/ShellSDKCapability.ts`
  - *Fix*: Propagated `cwd: input.directory || _context?.cwd` to Tauri native process backend across execution and rollback actions.
- [x] **1.4 Filesystem Tilde Expansion Optimization (Issue 12 / GitHub #5 - P2)**
  - *Target*: `src/sdk/capabilities/drivers/FilesystemSDKCapability.ts`
  - *Fix*: Replaced repeated `sh -c 'echo $HOME'` process spawning with static cached `getHomeDir()` and `expandTilde()` helpers (<0.01ms resolution).
- [x] **1.5 Bluetooth Peripheral Noun Sanitization (Issue 8 / GitHub #6 - P3)**
  - *Target*: `src/sdk/capabilities/drivers/BluetoothCapability.ts`
  - *Fix*: Stripped accessory nouns (`headphone`, `earbuds`, `speaker`, `mouse`) from device queries and enabled bidirectional substring matching against paired devices.
- [x] **1.6 Generative Shell Fallback with 1-Line Explanation & Consent Guardrails**
  - *Target*: `tools/shell/execute/tool.json`, `ShellSDKCapability.ts`, `SecurityEngine.ts`
  - *Fix*: AI provides plain English explanation of unmapped commands; flagged as `SENSITIVE` requiring explicit 1-click user approval.
- [x] **1.7 Autonomous Demonstration & Pattern Learning Engine**
  - *Target*: `src/domain/learning/DemonstrationLearningEngine.ts`, `AgentLoop.ts`
  - *Fix*: Learns from manual terminal fixes after unresolved AI goals, extracts dynamic token templates, and persists patterns to `~/.sentinel/learned_patterns.json`.

---

## ⚡ Tier 2: Addictive Next-Gen Product Pillars & Power-User Tools (COMPLETED)

High-impact features that transform Sentinel from a terminal into an indispensable daily driver:

### 🔷 Pillar 2.1: Visual Auto-Remediation Toast & Action Banner (HUD)
- [x] **2.1.1 Floating Error Remediation Banner Component**: Render a sleek glassmorphism HUD chip above the active terminal pane when `PtyOutputObserver` detects an error (e.g., `EADDRINUSE`, `.git/index.lock`, missing modules).
- [x] **2.1.2 One-Click & Hotkey Execution**: Click the banner or press `[Tab]` to trigger autonomous self-healing without retyping.
- [x] **2.1.3 Banner Dismissal & Auto-Expiry**: Smooth fade-out animations on dismiss (`[Esc]`) or 2-minute inactivity.

### 🔷 Pillar 2.2: Workspace Quick-Switcher & Fuzzy Navigator (`Cmd+O` / `Ctrl+O`)
- [x] **2.2.1 Workspace Scanner & Indexer**: Leverage `ProjectDiscoveryEngine` and `WorkspaceRegistry` to discover ROS 1/2 workspaces, Node.js packages, Python venvs, Rust crates, and Docker stacks in `~` and custom search roots.
- [x] **2.2.2 Fast Fuzzy Search Modal**: Sub-5ms modal popup with tech-stack badges (`📦 ROS2`, `⚛️ Next.js`, `🐍 Python`, `🦀 Rust`).
- [x] **2.2.3 One-Touch Context Switch**: Press `[Enter]` to navigate current pane or `[Cmd+Enter]` to open in a new tab/split with automatic environment sourcing (`source setup.bash`, `source venv/bin/activate`).

### 🔷 Pillar 2.3: Visual Process Monitor & Active Port Manager Drawer (`Cmd+Shift+P`)
- [x] **2.3.1 Active Port & Zombie Process Inspector**: Native background query listing listening TCP/UDP ports (3000, 5173, 8080, 8000, etc.), PID, process name, and memory footprint via `ProcessPortManager`.
- [x] **2.3.2 One-Click "Free Port" Action**: Instant process termination button connected directly to `system.kill_process` driver.
- [x] **2.3.3 Live Refresh Drawer**: Slide-over drawer with real-time process monitoring and filterable search.

### 🔷 Pillar 2.4: Frecency-Ranked History Search Popup (`Ctrl+R`)
- [x] **2.4.1 Frecency History Database**: Weight command history by both execution frequency and recency.
- [x] **2.4.2 Interactive Fuzzy Popup**: Overlay showing matched historical commands, working directory context, and timestamp.
- [x] **2.4.3 Seamless Shell Insertion**: Instant insertion into current prompt with arrow-key navigation.

---

## 🏢 Tier 3: Enterprise Security, Collaboration & Extensibility (BACKLOG)

- [ ] **3.1 Plugin Marketplace & Hot-Reloading SDK**: Dynamic runtime for loading third-party capability drivers without recompiling.
- [ ] **3.2 Cryptographic Tamper-Evident Audit Logger**: Export signed JSONL execution trails for enterprise compliance (SOC 2, ISO 27001).
- [ ] **3.3 Remote SSH Multiplexer & Dotfile Rice Sync**: Sync custom keybindings, learned workflows, and shell aliases across macOS, Ubuntu, and Arch Linux.

---

## 📋 Comprehensive Issue & Epic Archive

### Core Architectural Epics (All Complete)
- [x] **Epic 1: Autonomous Error Recovery & "Awaiting Physical Confirmation"**
  - [x] `ErrorDiagnosticsEngine.ts`: Classify errors into `SOFTWARE_RECOVERABLE` vs `PHYSICAL_ACTION_REQUIRED`.
  - [x] In-loop remediation sub-phases in `AdaptivePlanEngine`.
  - [x] `AWAITING_PHYSICAL_ACTION` pause state with physical prompts.
- [x] **Epic 2: Probe & Disambiguate Discovery Engine**
  - [x] `ProjectDiscoveryEngine.ts`: Scan ROS 1/2, Node, Python, Rust, Docker.
  - [x] Interactive disambiguation selection menu for ambiguous project targets.
  - [x] Automatic contextual workspace sourcing (`source setup.bash`, `cd <project>`).
- [x] **Epic 3: System Services & Dotfile "Rice" Orchestration**
  - [x] Unified `system.service` driver (`systemctl`, `launchctl`, Windows Service Manager).
  - [x] `DotfileManager.ts`: AST/regex-safe dotfile editor for `.zshrc`, `.bashrc`, `hyprland.conf`, `i3.conf`.
  - [x] Startup service natural language automation.
- [x] **Epic 4: Small-Model Cognitive Supercharger**
  - [x] `DynamicToolPruner.ts`: Classify user intent domain and dynamically load only 4–6 relevant tools into LLM context.
  - [x] Two-tier reasoning pipeline separating semantic understanding from DAG decomposition.
  - [x] `ToolParameterValidator.ts`: Zero-hallucination schema enforcement with type auto-coercion.
- [x] **Epic 5: Production-Grade Addictive Terminal Enhancements**
  - [x] `PtyOutputObserver.ts`: Real-time stderr & exit code monitor with 1-click `[Tab]` auto-remediation.
  - [x] `DemonstrationProvider.ts` & `WorkspaceContextProvider.ts`: Sub-5ms ghost-text completions.
  - [x] `SessionPersistenceEngine.ts`: Crash-proof multi-tab and split-pane layout auto-save and restore.
  - [x] Keyboard-first ergonomics: Zero-mouse security modal navigation (`[Enter]`/`[y]`, `[Esc]`/`[n]`).

### Resolved Bug Tracker Archive
- [x] **Issue 1**: `browser.navigate` ignores target application and drops `-a <browser>` in macOS `open` command.
- [x] **Issue 2**: `application.update` fails on macOS Homebrew casks due to unnormalized app names.
- [x] **Issue 3**: `ExecutionEngine` permission category fallback grants `ReadFiles` to package installation, git, docker, ssh.
- [x] **Issue 4**: `BluetoothCapability` fails on stock macOS systems when Homebrew `blueutil` binary is missing.
- [x] **Issue 5**: Fast-Path Engine lacks URL and Web navigation patterns, forcing 2–5s LLM inference latency.
- [x] **Issue 6**: Incomplete tool artifacts: `application.update`, `developer.scaffold`, and `system.lock` missing `knowledge.json`, `examples.json`, `tests.json`.
- [x] **Issue 7**: `system.lock` classified as `SAFE` with `confirmationRequired: false`.
- [x] **Issue 8 (GitHub #6)**: Bluetooth device connection fails when queries include peripheral category nouns.
- [x] **Issue 9 (GitHub #2)**: Compound shell command chaining (`&&`, `;`, `||`) bypasses `ShellCommandGuard` risk analysis.
- [x] **Issue 10 (GitHub #4)**: `GitCapability` and `ShellSDKCapability` drop process working directory context (`cwd`).
- [x] **Issue 11 (GitHub #3)**: `PolicyEngine.protect-system-dirs` fails to block deletion of subdirectories and files within protected system paths.
- [x] **Issue 12 (GitHub #5)**: `FilesystemSDKCapability` invokes redundant shell child processes (`sh -c 'echo $HOME'`) on every tilde path expansion.
- [x] **Issue 13**: `ToolExecutor` lacks execution timeout enforcement, risking indefinite UI freeze on interactive or hanging CLI commands.

---
*Last Updated: September 4, 2026 — 754 Tests Passing (100% Green across 134 Test Files)*
