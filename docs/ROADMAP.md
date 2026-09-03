# Sentinel Terminal — Product & Intelligence Roadmap

This roadmap articulates Sentinel's evolution from a fast, local command executor into an **autonomous, self-healing, and context-discovering terminal operating system**.

---

## 🧭 Core Architectural Epochs

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Epoch 1: Autonomous Error Recovery & Human-in-the-Loop Confirmation       │
│  - Stop copy-pasting terminal errors to web AIs                             │
│  - Auto-diagnose stderr & non-zero exit codes                              │
│  - Self-healing sub-phases for software errors (free ports, clear locks)   │
│  - "Awaiting Physical Action" state machine (power on device, plug USB)    │
├─────────────────────────────────────────────────────────────────────────────┤
│  Epoch 2: Deep Environment & Workspace Discovery ("Probe & Disambiguate")  │
│  - Stop blind command execution                                            │
│  - Autonomous scan for ROS workspaces, launch files, and package manifests │
│  - Interactive numbered menus for multiple matches ("Which Gazebo setup?")  │
│  - Automatic environment sourcing (`source setup.bash`, `conda activate`)  │
├─────────────────────────────────────────────────────────────────────────────┤
│  Epoch 3: System Services & Dotfile "Rice" Orchestration                   │
│  - Native `system.service` for systemd user services, launchctl, & WinSC   │
│  - Safe dotfile config patcher (`config.patch`) with automatic rollback    │
│  - Toggle startup nodes and desktop environment configurations cleanly      │
├─────────────────────────────────────────────────────────────────────────────┤
│  Epoch 4: Small-Model Cognitive Supercharger                               │
│  - Dynamic Domain Tool Pruning (inject only 4-6 tools per prompt)          │
│  - Two-tier semantic routing: enables 1.5B/3B/7B models to rival 70B+ LLMs  │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📅 Detailed Phase Breakdown

### 🔷 Phase 1: Autonomous Error Triage & "Awaiting Physical Confirmation"
- **Goal**: Free users from the endless cycle of error-copying on Windows, Linux, and macOS.
- **Key Deliverables**:
  - `ErrorDiagnosticsEngine`: Classifies failures into `SOFTWARE_RECOVERABLE` vs `PHYSICAL_ACTION_REQUIRED`.
  - Self-Healing Plan Expansion: Injects dynamic sub-phases (e.g., `Phase 2.1: Terminate process on port 3000`) and retries.
  - Interactive Confirmation State: When hardware/physical interaction is needed, pauses execution with a clean prompt (*"Please plug in USB / power on device and type 'done'"*) and resumes seamlessly upon confirmation.

### 🔷 Phase 2: Probe & Disambiguate Discovery Engine
- **Goal**: Intelligent exploration for complex developer environments (Ubuntu robotics, ROS 1/ROS 2, monorepos).
- **Key Deliverables**:
  - `ProjectDiscoveryEngine`: Deep search for `package.xml`, `*.launch.py`, `Cargo.toml`, `docker-compose.yml`.
  - Interactive Selection Pills: Prompts user when multiple project workspaces match a generic command (`>run my gazebo`).
  - Automatic Environment Preparation: Changes working directory, executes environment source scripts, and launches target processes.

### 🔷 Phase 3: System Services & Dotfile Management
- **Goal**: Effortless configuration and startup daemon control (Arch Linux rice, macOS launchd, Windows services).
- **Key Deliverables**:
  - `system.service` Capability Driver: Unified interface for `systemctl --user`, `launchctl`, and Windows Service Manager.
  - `config.patch` Safe Mutation: Atomic edits to `~/.config/` with pre-modification `.bak` snapshots and syntax validation.

### 🔷 Phase 4: Small-Model Cognitive Supercharger
- **Goal**: Enable lightweight offline models (1.5B–7B) to reason with the deterministic reliability of frontier models.
- **Key Deliverables**:
  - Dynamic Tool Pruning: Classifies prompt domain and loads only the 4–6 relevant tool schemas instead of 100+.
  - Two-Tier Intent Architecture: Separates semantic understanding from deterministic task graph execution.

---

## 🔗 Technical Specifications
- Detailed architecture and interface definitions are documented in [Intelligent Planner Architecture](INTELLIGENT_PLANNER_ARCHITECTURE.md).
- Active issues and pending work items are tracked in the [Engineering Roadmap Checklist](TODO.md).
