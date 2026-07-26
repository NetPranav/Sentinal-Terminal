# Sentinel System & Technical Architecture

Sentinel Terminal implements a highly decoupled architecture designed to unify presentation layer speed, asynchronous AI reasoning pipelines, and low-level native systems programming.

---

## 🏛️ High-Level System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION & UI LAYER (React 19 + Vite)                     │
│  ├── TerminalView.tsx (xterm.js + WebGL, Conversational NL Intercept, Pane Routing)  │
│  ├── StatusBar.tsx (Dynamic Directory-Aware Hierarchy, Time, Security Profile)       │
│  └── ThemeManager.ts (Vanilla CSS tokens, Glassmorphism, Minimal Classic Palette)    │
└───────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │ Tauri IPC Bridge (Rust JSON Events)
┌───────────────────────────────────────────▼──────────────────────────────────────────┐
│                         AI INTENT & WORKFLOW RUNTIME (TypeScript/ESM)                │
│  ├── ModelManager.ts (LLM Selection, Apple Silicon CoreML adaptation, qwen2.5:1.5b)  │
│  ├── IntentEngine.ts & EntityExtractor.ts (NL Processing, URL/App/Process Clean-up)   │
│  ├── Planner.ts & PlanValidator.ts (Multi-Step Workflows, Zod Validation, Rollbacks) │
│  └── SecurityEngine.ts & AuditLogger.ts (Risk Scoring, Admin Auth Guards, JSONL Logs)│
└───────────────────────────────────────────┬──────────────────────────────────────────┘
                                            │ Capability SDK Drivers & Registry
┌───────────────────────────────────────────▼──────────────────────────────────────────┐
│                         NATIVE TAURI RUST BACKEND & OS EXECUTION                     │
│  ├── pty.rs (Sub-process spawning, interactive zsh/bash pseudo-terminal multiplexed) │
│  ├── ApplicationCapability.ts (macOS Launch Services, pkill -f, window management)  │
│  └── System/Filesystem/Network SDK Drivers (Native sysinfo, socket binds, trash API)  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔧 Core Architectural Layers

### 1. Presentation & Renderer Layer (`src/presentation/` & `src/ui/`)
- **`TerminalView.tsx`**: Integrates `@xterm/xterm` paired with the WebGL hardware renderer (`@xterm/addon-webgl`). Responsible for capturing keystrokes, rendering terminal output buffers, and running initial heuristic evaluations to intercept conversational navigation requests before standard PTY forwarding.
- **`App.tsx`**: Governs application window state, native macOS top screen menu bar listeners (`@tauri-apps/api/event`), theme toggles, and recursive split screen layout trees (`PaneNode`, `TerminalPane`, and `SplitNode`).

### 2. Domain & Autonomous Execution Layer (`src/domain/` & `src/ai/`)
- **`SessionManager.ts`**: Coordinates communication across the Tauri IPC boundary. Maintains persistent output ring-buffers for every active tab and split pane, ensuring session state persists seamlessly across layout adjustments.
- **`AgentRuntime.ts`**: The core execution engine responsible for translating multi-step AI plans into verified OS capability invocations, managing error repair loops, and automatically synchronizing terminal directory navigation (`cd <path>`) straight into active shell prompts upon workflow completion.
- **`SecurityEngine.ts` & `PermissionManager.ts`**: A zero-trust firewall enforcing risk score profiling (0–100) before any system mutating capability executes, intercepting destructive file tasks (`rm -rf`) with authorization barriers and writing immutable JSONL audit records.

### 3. Capability Knowledge Base & Concrete SDK Drivers (`src/tools/` & `src/sdk/`)
- **Tool Registry**: Maintains over **97 operational tool specifications** structured as static JSON files under `tools/<domain>/<action>/tool.json`, validated against strict **Zod** schema definitions at system boot.
- **Concrete Execution Drivers**: Organized under `src/sdk/capabilities/drivers/`, these drivers extend `BaseCapabilityDriver` to convert structured workflow invocations into low-level operating system commands (such as invoking macOS Launch Services or executing exhaustive process elimination via `pkill -9 -i -f`).

### 4. Native Rust Pseudo-Terminal Engine (`src-tauri/src/`)
- **`pty.rs`**: Built on `portable-pty`, managing multi-threaded reading and writing across isolated interactive shell sessions (`/bin/zsh` or `powershell.exe`).
- **Interactive Environmental Enforcement**: When running as a packaged desktop `.app` bundle, `pty.rs` directly injects `TERM=xterm-256color`, `COLORTERM=truecolor`, and extended path directories (`/opt/homebrew/bin`) to ensure full line editing discipline, responsive **Backspace** functionality, and comprehensive CLI execution without relying on initial developer shells.
