# ⚡ Sentinel Terminal
### The Next-Generation Intelligent Native Terminal & AI Operating Workspace

<div align="center">

![Version](https://img.shields.io/badge/version-0.1.0--alpha-00D8A6?style=for-the-badge&logo=appveyor)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-1F222E?style=for-the-badge&logo=apple)
![AI Engine](https://img.shields.io/badge/AI%20Engine-Qwen%202.5%20(1.5B%20Local)-7B61FF?style=for-the-badge&logo=openai)
![Tech Stack](https://img.shields.io/badge/Built_With-Tauri_v2%20%7C%20React%2019%20%7C%20Rust-FF6B6B?style=for-the-badge&logo=rust)
![License](https://img.shields.io/badge/license-MIT-00B4D8?style=for-the-badge)

**Transform your desktop command-line into a proactive, natural language autonomous agent workspace.**  
*Powered by localized LLMs, native macOS/Linux Launch Services, and an enterprise-grade capability execution engine.*

---

<!-- ========================================================================================= -->
<!-- 🎬 DEMONSTRATION VIDEO PLACEHOLDER #1: HERO OVERVIEW DEMO                                -->
<!-- Add your 60-second Loom/GIF/Video showing Natural Language AI execution in the terminal -->
<!-- Example: ![Sentinel Demo Overview](./docs/images/hero-demo.gif)                      -->
<!-- ========================================================================================= -->

<br>

<p align="center">
  <b>[ 🎥 Insert Main Hero Demonstration GIF / Video Here: e.g. <code>./docs/images/sentinel-demo-hero.gif</code> ]</b>
</p>
<p align="center">
  <i>Watch Sentinel seamlessly switch between interactive zsh commands and natural language AI task workflows without missing a beat.</i>
</p>

</div>

---

## 🌟 Why Sentinel Terminal?

Traditional terminal emulators require memorizing arcane flags, repetitive file navigation syntax, and complex networking utilities. **Sentinel Terminal** redefines developer productivity by embedding a **privacy-first local AI engine** directly into a blazing-fast native PTY shell.

Whether you are navigating deep directory trees, inspecting active system processes, controlling desktop applications, or searching the filesystem, simply state what you need in plain English—or drop right back into standard bash/zsh syntax whenever you want.

### ✨ Highlights at a Glance
- 🧠 **100% Offline Local AI Runtime**: Harnesses lightweight, hyper-optimized models (**Qwen 2.5 1.5B via Ollama & Apple Metal CoreML Engine**) running locally with zero latency, zero API costs, and absolute data privacy.
- 🚀 **Native PTY Integration**: Built on **Tauri v2 (Rust)** and **xterm.js WebGL rendering**, offering sub-millisecond character input responsiveness and 100% compatibility with interactive tooling (`vim`, `tmux`, `git`, `docker`).
- 🪟 **Modern Glassmorphism Workspace**: Sleek dark aesthetics, subtle background transparency, intelligent multi-pane vertical/horizontal splits, and dynamic directory-aware hierarchy bottom bars with real-time system clock displays.
- 🛡️ **Zero-Trust Security Engine**: Proactive danger classification and automated administrative guards protect against destructive commands (e.g., stopping unauthorized `rm -rf`, risk scoring every automated execution).
- 🧩 **Extensible OS Capability SDK**: Features a built-in **AI Operating Knowledge Base** of 97+ native execution drivers spanning filesystem management, window control, port listening, bluetooth/Wi-Fi toggling, and multi-app process termination.

---

<!-- ========================================================================================= -->
<!-- 📸 SCREENSHOT SHOWCASE #1: UI & MULTI-PANE WORKSPACE                                    -->
<!-- Replace placeholder below with your high-res screenshot of split screens and glass theme  -->
<!-- ========================================================================================= -->

<div align="center">
  <br>
  <b>[ 📸 Insert Screenshot of Multi-Pane Split Screen Workspace Here: e.g. <code>./docs/images/split-screen-workspace.png</code> ]</b>
  <p><i>Effortlessly divide your workflow with Vertical & Horizontal split screens—each maintaining independent directory history and AI context.</i></p>
  <br>
</div>

---

## 📖 For End Users: Complete Usage & Feature Guide

### 🛠️ Installation & Prerequisites

To unlock full local AI features and native shell capabilities, ensure your system meets the following requirements:

1. **Operating System**: macOS (Intel or Apple Silicon M1/M2/M3/M4 recommended), Linux, or Windows.
2. **Local AI Provider**: Install **[Ollama](https://ollama.ai)** and pull the optimized lightweight model:
   ```bash
   ollama pull qwen2.5:1.5b
   ```
3. **Node.js & Rust** (For building & launching from source):
   ```bash
   # Install dependencies and start Sentinel Terminal in development mode
   npm install
   npm run tauri dev
   ```

---

### 🗣️ Conversational Interaction vs. Standard Shell

Sentinel continuously evaluates input streams. If you enter a traditional UNIX command (`cd`, `ls`, `git pull`, `npm test`), it executes directly in the native PTY zsh instance instantly. When you express an instruction in natural language, Sentinel's **AI Intent & Planning Engine** seamlessly intercepts the request, maps entities, and executes verified OS capability workflows.

#### 1. 📂 Conversational Filesystem Navigation & Search
Never struggle to remember where a file or folder is located:
- **Move around intuitively**: 
  - `"take me to Downloads folder"` ➔ Translates and navigates your terminal session to `~/Downloads`.
  - `"go back"` / `"take me home"` ➔ Effortlessly changes active hierarchy.
- **Semantic File Hunting**:
  - `"tell me all the png files in the Downloads folder"` ➔ Spawns a recursive file search driver, indexing matches in real-time.
  - `"where did you create AAAAAA folder"` ➔ Instantly locates directories across your workspace and OS user folders.

#### 2. 🚀 Application Taming & Web Launching
Control desktop apps and web workflows directly from your keyboard:
- **Open Websites & Files in Specific Apps**:
  - `"open youtube.com in safari"` ➔ Automatically normalizes the secure HTTPS scheme and executes Launch Services (`open -a Safari https://youtube.com`).
  - `"open google.com in chrome"` / `"launch reddit using firefox"`.
- **Comprehensive Process & App Termination**:
  - `"kill antigravity"` / `"stop chrome"` / `"entirely stop all the process of safari"` ➔ Emits comprehensive process clean-up commands (`pkill -9 -f`), instantly halting every background service thread and helper worker.

#### 3. ⚙️ Deep System & Network OS Controls
- **Hardware & Port Querying**:
  - `"check battery status"` / `"turn my bluetooth on"` / `"show active listening ports"`.

---

<!-- ========================================================================================= -->
<!-- 🎬 DEMONSTRATION VIDEO PLACEHOLDER #2: CONVERSATIONAL AGENT IN ACTION                    -->
<!-- Insert a short video/gif demonstrating an app opening ("open youtube.com in safari")     -->
<!-- or stopping a process ("stop chrome") directly from the command line.                    -->
<!-- ========================================================================================= -->

<div align="center">
  <br>
  <b>[ 🎥 Insert Application Launching & Process Killing Demo Here: e.g. <code>./docs/images/app-management-demo.gif</code> ]</b>
  <p><i>Automated parameter extraction passing targeted web domains directly into macOS apps and killing stubborn background daemons.</i></p>
  <br>
</div>

---

## 🏗️ For Contributors & Developers: Architecture & System Overview

Sentinel Terminal is engineered with strict separation of concerns, combining frontend web technologies with high-performance native systems programming and deterministic agentic execution pipelines.

### 🏛️ High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        PRESENTATION & UI LAYER (React 19 + Vite)                     │
│  ├── TerminalView.tsx (xterm.js + WebGL, NL Intercept, Pane Routing)                 │
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
│  ├── pty.rs (Sub-process spawning, interactive zsh/bash pseudo-terminal multiplexer) │
│  ├── ApplicationCapability.ts (macOS Launch Services, pkill -f, ps window mgmt)     │
│  └── System/Filesystem/Network SDK Drivers (Native sysinfo, socket binds, trash API)  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

### 🔧 Core Engine Modules Deep Dive

#### 1. The Capability SDK & Tool Registry (`src/sdk/` & `src/tools/`)
Unlike simple script wrappers, Sentinel utilizes an object-oriented capability pattern. Every OS functionality is defined as a concrete driver extending `BaseCapabilityDriver`:
- **Central Tool Registry**: Over **97 pre-configured capabilities** in structured JSON metadata (`tools/system/*`, `tools/application/*`, `tools/network/*`, etc.) validated at boot via **Zod**.
- **Deterministic Rollbacks**: Executing mutating operations (e.g., launching an app or installing a package) embeds a rollback payload in the execution result, allowing automated state recovery if downstream tasks fail.
- **Full Process Elimination (`-f`)**: Our process control drivers (`SystemSDKCapability.ts`, `ApplicationCapability.ts`) implement full command-line signature parsing (`pkill -9 -i -f`) to ensure child tasks and worker daemons are cleanly eliminated.

#### 2. Local AI Intent Engine (`src/ai/intent/`)
- **Entity Extraction**: `EntityExtractor.ts` employs tiered regex heuristics combined with conversational noise reduction (stripping words like *all*, *the*, *active*, *process of*, *my*) to isolate pure target names, web URLs, file paths, and network IP/Ports.
- **Workflow Planner**: Translates single utterances into sequenced execution graphs. For example: *"Open Chrome. Go to YouTube. Search for AI"* compiles into a verified 3-step execution pipeline (`application.open` ➔ `browser.navigate` ➔ `browser.search`).

#### 3. Security Engine & Audit Logging (`src/domain/security/`)
- **Risk Assessment Pipeline**: Every compiled task is scored (from 0 to 100). Safe reads execute immediately; destructive deletions (`filesystem.delete` or administrative system overrides) force interactive user confirmation modals.
- **Audit Trails**: Every executed capability, parameter set, risk score, and timing metric is logged to immutable JSONL audit files under `.system_generated/logs/`.

---

<!-- ========================================================================================= -->
<!-- 📸 SCREENSHOT SHOWCASE #2: SECURITY ENGINE & DEVELOPER LOGS                               -->
<!-- Insert a screenshot showing the terminal executing complex multi-step workflows or        -->
<!-- triggering an admin security Risk Assessment prompt.                                    -->
<!-- ========================================================================================= -->

<div align="center">
  <br>
  <b>[ 📸 Insert Screenshot of AI Planner & Security Confirmation Prompt Here: e.g. <code>./docs/images/security-engine-prompt.png</code> ]</b>
  <p><i>The Security Engine actively intercepting a destructive file operation and requiring explicit authorization.</i></p>
  <br>
</div>

---

## 💻 Developer Workflow & Testing Setup

We welcome bug reports, feature implementations, capability drivers, and UI refinements! Here is how to get your local environment ready for contribution:

### 1. Build & Test Commands
We utilize Vite, Vitest, TypeScript 5, and Tauri v2 Cargo build pipelines.

| Command | Description |
| :--- | :--- |
| `npm run tauri dev` | Starts the native application with hot module reloading (HMR) enabled for UI and OS integrations. |
| `npm test` or `npx vitest run` | Runs our extensive automated verification suite (69+ tests covering security, capabilities, and AI routing). |
| `npm run build` | Compiles strict TypeScript definitions and produces optimized production application packages. |
| `cargo build --manifest-path src-tauri/Cargo.toml` | Directly builds the underlying Rust backend binaries. |

### 2. Running the Unit Test Suite
Before opening a Pull Request, ensure that all tests pass cleanly:
```bash
npx vitest run
```
Our test suite validates:
- **Zod Schema Integrity**: Validates every single loaded capability and workflow definition in the registry.
- **Intent Engine Accuracy**: Asserts that conversational commands (*"kill antigravity"*, *"open youtube.com in safari"*, *"turn bluetooth on"*) map to correct driver IDs and entities without regression.
- **Security Guardrails**: Confirms that high-risk filesystem operations trigger proper authorization blocks and dry-run simulations.

---

## 🤝 How to Contribute a New Custom OS Capability

Want to teach Sentinel Terminal a brand new OS trick (e.g., controlling Spotify, managing Docker containers, or interacting with AWS)? Follow this 3-step pattern:

1. **Create the Tool Definition Schema**: Add a new JSON file under `tools/<domain>/<action>/tool.json`:
   ```json
   {
     "id": "media.spotify.play",
     "name": "Play Spotify Track",
     "desc": "Starts playback of a specific track or playlist on Spotify.",
     "category": "Media",
     "risk": "LOW",
     "params": [
       { "name": "query", "type": "string", "desc": "Song or artist name", "required": true }
     ],
     "aliases": ["play music", "play song", "start spotify"],
     "sampleInput": "play song Bohemian Rhapsody on spotify"
   }
   ```
2. **Implement the Concrete Execution Driver**: Create or extend a driver in `src/sdk/capabilities/drivers/` inheriting from `BaseCapabilityDriver`, utilizing `@tauri-apps/api/core` invoke hooks to execute native system commands.
3. **Register & Test**: Register your driver inside `CapabilityRegistrySDK.ts` and add an assertion to `IntentEngine.test.ts` to ensure natural language requests seamlessly hit your new endpoint!

---

## 📜 License & Community

Distributed under the MIT License. See `LICENSE` for details.

*Built with passion by developers, for developers. If Sentinel Terminal empowers your workflow, consider leaving a ⭐️ on GitHub!*
