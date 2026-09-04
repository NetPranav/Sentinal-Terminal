<div align="center">

# ⚡ Sentinel Terminal v2.0

**The Autonomous AI-Native Terminal with Self-Evolving Reinforcement Learning (SERL), Self-Healing Execution, and 100% Offline Inference.**

<br>

[![Release](https://img.shields.io/badge/Release-v2.0.0%20Production-00D8A6?style=for-the-badge&logo=github&logoColor=white)](https://github.com/NetPranav/Sentinal-Terminal/releases/tag/v2.0.0)
[![Automated Tests](https://img.shields.io/badge/Tests-983%20Passing%20%7C%20155%20Suites-7B61FF?style=for-the-badge&logo=vitest&logoColor=white)](https://github.com/NetPranav/Sentinal-Terminal/actions)
[![Tool Ecosystem](https://img.shields.io/badge/Tool%20Ecosystem-101%20Canonical%20Tools-00B4D8?style=for-the-badge&logo=codewars&logoColor=white)](tools/)
[![AI Engine](https://img.shields.io/badge/AI%20Engine-100%25%20Offline%20Local%20(Metal%2Fllama.cpp)-FF6B6B?style=for-the-badge&logo=openai&logoColor=white)](https://github.com/NetPranav/Sentinal-Terminal)
[![Platform](https://img.shields.io/badge/Platform-macOS%20%7C%20Linux%20%7C%20Windows-1F222E?style=for-the-badge&logo=apple&logoColor=white)](docs/CROSS_PLATFORM_SHARING.md)
[![License](https://img.shields.io/badge/License-MIT-F5A623?style=for-the-badge)](LICENSE)

<br>

<p align="center">
  <a href="#-what-is-sentinel-terminal"><b>What is Sentinel?</b></a> •
  <a href="#-what-we-developed-ourselves-core-innovations"><b>What We Developed</b></a> •
  <a href="#-technologies-and-libraries-used"><b>Tech Stack</b></a> •
  <a href="#-complete-features--command-reference"><b>Features & Commands</b></a> •
  <a href="#-architecture--data-flow"><b>Architecture</b></a> •
  <a href="#-download--installation"><b>Download v2.0</b></a> •
  <a href="#-fine-tuning--self-improvement"><b>LoRA Fine-Tuning</b></a>
</p>

</div>

---

## 🌟 What is Sentinel Terminal?

**Sentinel Terminal** bridges the gap between traditional raw UNIX shell performance and autonomous desktop agent orchestration. Built from the ground up on **Tauri v2**, **Rust**, **React 19**, and **xterm.js**, Sentinel delivers instantaneous sub-millisecond PTY shell responsiveness while letting you automate complex, multi-step desktop and system tasks using natural language.

Sentinel operates on a dual-mode interaction model:
1. **Raw Native Shell (Zero Latency)**: Type regular commands (`ls -la`, `git status`, `cargo build`, `npm run dev`) and Sentinel executes directly inside an ultra-fast Rust-backed pseudo-terminal (PTY) with zero overhead.
2. **Autonomous AI Copilot (`>`)**: Prefix any command or instruction with **`>`** to invoke the autonomous Sentinel Agent Loop. Sentinel interprets your intent, searches system indexes, inspects active processes, controls network interfaces, and repairs execution errors autonomously.

### 🔒 100% Offline & Zero-Cloud Guarantee
- **Zero Cloud Data Transmission**: All prompts, command lines, system telemetry, and credentials remain strictly on your local machine.
- **Zero API Latency & Rate Limits**: Powered by embedded llama.cpp with Apple Silicon Metal acceleration, Ollama, or local GGUF models.
- **Zero-Trust Security Engine**: Proactive shell AST inspection blocks destructive commands (`rm -rf /`, fork bombs, unauthorized system file writes) before execution.

---

## 🧠 What We Developed Ourselves (Core Innovations)

Unlike basic AI terminal wrappers that simply pipe prompts to cloud APIs, Sentinel contains a suite of custom-engineered subsystems designed for real-world terminal autonomy:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                SENTINEL SERL ARCHITECTURE                              │
├──────────────────────────────┬──────────────────────────┬──────────────────────────────┤
│      TIER 1: AGENT LOOP      │   TIER 2: SELF-HEALING   │     TIER 3 & 4: EVOLUTION    │
├──────────────────────────────┼──────────────────────────┼──────────────────────────────┤
│ • GBNF Constrained Grammar   │ • Stderr Feedback Loop   │ • Speculative Shadow-PTY     │
│ • Decoupled Refusal Catch    │ • 3-Strike Remediation   │ • On-Device DPO Engine       │
│ • Referential Multi-Turn     │ • AST Shell Command Guard│ • Reflexion Self-Critique    │
│ • Dynamic Tool Pruner        │ • Physical Action Prompt │ • Episodic Memory (Cosine)   │
│ • Fast-Path Offline Engine   │ • 101 Canonical Tools    │ • TLDR Ground-Truth Recipes  │
└──────────────────────────────┴──────────────────────────┴──────────────────────────────┘
```

### 1. Decoupled Refusal Interception & Anti-Refusal Enforcer
Cloud and open-weights models are alignment-trained to decline system access (*"I'm sorry, as an AI language model I don't have access to your operating system or network..."*).
- **Unconditional Interception**: Sentinel intercepts all conversational refusal patterns (`isConversationalRefusal`) regardless of single-turn syntax.
- **Terminal Execution Re-Prompting**: Re-prompts the model with strict terminal authority instructions (`SYSTEM ENFORCEMENT`), forcing real command generation.
- **Refusal Sanitization**: Converts stubborn refusals into concrete macOS/Linux terminal solutions (e.g. automatic DHCP lease renewal instead of apologetic evasions).
- **Multi-Turn Referential Context Resolution**: Automatically carries over preceding conversational context into referential follow-ups (e.g., *"still somehow that you can try right now"* inherits the preceding *"change the ip address without vpn"*).

### 2. Autonomous Self-Healing Diagnostics Engine
- **Stderr & Exit Code Feedback Loop**: Captures non-zero exit codes and error output, automatically diagnosing failure categories (syntax errors, missing binaries, permission issues, or physical device disconnection).
- **3-Strike Autonomous Auto-Remediation**: Iteratively generates alternative syntaxes and corrected parameters.
- **Physical Action Detection**: Identifies when a command failure requires physical hardware intervention (e.g., plugging in a cable or toggling a hardware switch) and prompts the user accordingly.

### 3. Speculative Shadow-PTY Simulation Engine ("Minority Report for the Shell")
- **Sub-Millisecond Candidate Rollout**: Evaluates $K=3$ candidate execution commands in an ephemeral, memory-isolated sandbox before touching your active terminal.
- **Cross-Platform Auto-Translation**: Automatically detects and translates platform command mismatches on the fly:
  - Linux `fuser 3000/tcp` $\to$ macOS `lsof -iTCP:3000 -sTCP:LISTEN -P -n`
  - Linux `ip addr` $\to$ macOS `ifconfig` / `networksetup`
  - GNU `sed -i` $\to$ macOS BSD `sed -i ''`
  - GNU `grep -P` $\to$ macOS BSD `grep -E`
  - Linux `killall <name>` $\to$ macOS `pkill -i -f "<name>"`
- **Non-Destructive Sandbox Verification**: Pure read-only commands execute in a 1500ms safety subshell to guarantee zero side effects.

### 4. Autonomous DAG Repair Graph Planner
- **Multi-Step Failure Recovery**: When a compound workflow fails midway, Sentinel constructs a directed acyclic graph (DAG) of repair tasks.
- **Automated Rollback Checkpoints**: Creates pre-execution file and state snapshots, enabling safe rollbacks if a repair attempt fails.

### 5. On-Device DPO Preference Engine & Reflexion Self-Critique
- **Automated Direct Preference Optimization (DPO)**: When a command fails and is subsequently self-healed, Sentinel captures the failed command as `rejected` and the working solution as `chosen`, saving preference pairs to `sentinel_dpo_dataset.jsonl`.
- **Reflexion Engine**: Stores self-critique traces and performance logs so Sentinel learns from mistakes across sessions.

### 6. Episodic & Working Memory Engine
- **Semantic Vector Cosine Similarity**: Embeds user requests and indexes successful workflows. When you ask a similar query later, Sentinel retrieves the exact working command pattern with zero model latency.

### 7. Offline TLDR Ground-Truth Recipe Knowledge Engine
- **Instant Offline Execution**: Built-in repository of verified command-line recipes. Queries with high confidence bypass LLM inference entirely and execute instantly.

### 8. Native macOS Spotlight & Process Management
- **Spotlight Index Search**: Replaces slow recursive `find /` scans with native macOS Spotlight (`mdfind "kMDItemFSName == '*<target>*'c"`), searching millions of files in under 50ms.
- **3-Tier Termination Driver**: Graceful termination via AppleScript (`osascript`) $\to$ `killall` $\to$ `pkill -9 -i -f`.
- **Conditional Killing**: Handles natural language queries like `"if any app named music is running then close it"` without triggering error states if the application is not running.

### 9. Google Colab Fine-Tuning & Model Training Pipeline
- **Turnkey Training Package**: Complete automated export (`export_colab_training_package.ts`) producing ChatML-formatted datasets (`sentinel_sft_dataset.jsonl` and `sentinel_dpo_dataset.jsonl`).
- **Free T4 Colab Notebook**: [`notebooks/sentinel_colab_finetuning.ipynb`](notebooks/sentinel_colab_finetuning.ipynb) uses Unsloth 4-bit QLoRA on Qwen 2.5 Coder to train custom LoRA adapters and merge them into quantized GGUF format ready for Sentinel.
- **Standalone Training Script**: [`scripts/train_colab_standalone.py`](scripts/train_colab_standalone.py) for headless GPU training.

---

## 🛠️ Technologies and Libraries Used

| Subsystem | Technologies & Dependencies | Purpose |
| :--- | :--- | :--- |
| **Desktop Runtime** | **Tauri v2**, **Rust** (2021 edition) | Lightweight native host (~15MB bundle), native OS bridges, high performance |
| **Frontend Framework** | **React 19**, **TypeScript 5.8**, **Vite 7** | Component state management, rapid HMR development, production bundling |
| **Terminal Core** | **@xterm/xterm v6**, **@xterm/addon-fit**, **@xterm/addon-webgl** | Hardware-accelerated GPU terminal rendering, responsive resizing |
| **PTY Layer** | **portable-pty**, **tokio**, **parking_lot** | Native OS pseudo-terminal session management (macOS, Windows ConPTY, Linux) |
| **Local AI Inference** | **llama.cpp** (Metal acceleration), **Ollama API**, **GBNF Grammars** | 100% offline LLM inference, constrained JSON grammar execution |
| **Security & AST** | Custom Shell AST Parser, **Zod 4.4**, Policy Engine | Command sanitization, Zero-Trust whitelisting, destructive execution guards |
| **LoRA Fine-Tuning** | **Unsloth**, **PyTorch**, **Transformers**, **TRL (DPO)** | Efficient 4-bit QLoRA training on NVIDIA GPUs, GGUF export |
| **Testing & Quality** | **Vitest 4.1**, Node.js Test Harness | 983 automated unit, integration, and security tests across 155 test suites |

---

## ⚡ Complete Features & Command Reference

Simply type regular commands for direct PTY execution, or prefix with **`>`** for autonomous AI orchestration:

### 🚀 Developer & Workspace Launchers
| Natural Language Command (`>`) | Action Taken |
| :--- | :--- |
| `>open this folder in vs code` | Resolves target to `.` and launches **Visual Studio Code** |
| `>open current project in cursor` | Launches **Cursor AI** with active workspace directory |
| `>open this folder inside antigravity` | Launches **Antigravity IDE** with current project path |
| `>open in xcode` / `>open in android studio` | Opens native mobile development suites |
| `>scaffold nextjs react fullstack project` | Generates boilerplate directory structure and installs dependencies |

### 🌐 Network & Wireless Management
| Natural Language Command (`>`) | Action Taken |
| :--- | :--- |
| `>what is my ip` / `>check my ip address` | Displays both local network IP (`ipconfig`) and public IP (`api.ipify.org`) |
| `>change ip without vpn` / `>renew ip` | Renews local DHCP lease from router (`sudo ipconfig set en0 DHCP`) |
| `>what port is free for my new web project` | Discovers available, unoccupied TCP development ports |
| `>what is using port 3000` | Inspects active listening ports and maps PID to process name |
| `>scan available wifi networks` | Scans visible wireless SSIDs and signal strengths |
| `>turn on/off wifi` / `>turn on/off bluetooth` | Natively toggles wireless hardware power state |
| `>show all bluetooth devices` | Lists discoverable and paired Bluetooth peripherals |

### 💻 System Diagnostics & Process Control
| Natural Language Command (`>`) | Action Taken |
| :--- | :--- |
| `>which process is using the most cpu` | Lists top processes sorted by CPU utilization |
| `>top ram` / `>which app is using the most memory` | Lists top memory-consuming processes |
| `>check battery health and cycle count` | Displays battery percentage, power source, and health state |
| `>check available disk space` | Analyzes volume storage and free space |
| `>tell me is there any application named music` | Directly inspects GUI applications and reports active status |
| `>kill the Music application` | Cleanly terminates target application via 3-tier fallback driver |
| `>if any app named music is running then close it` | Conditional termination without throwing error if application is absent |

### 🔍 Search & Filesystem Administration
| Natural Language Command (`>`) | Action Taken |
| :--- | :--- |
| `>find all frontend folders in my system` | Fast Spotlight search across macOS via `mdfind` in <50ms |
| `>find all files named .env` | Searches for configuration files excluding `node_modules` and `.git` |
| `>take me to downloads` / `>go home` | Automatically navigates terminal working directory |
| `>check git status and branches` | Inspects working tree status and active branches |
| `>recent commits` / `>show git log` | Formats commit history cleanly inside the terminal |

---

## 🏗️ Architecture & Data Flow

```mermaid
sequenceDiagram
    autonumber
    actor User as Developer
    participant UI as React 19 UI (xterm.js WebGL)
    participant Rust as Tauri v2 Rust PTY Backend
    participant Loop as AgentLoop & Dynamic Tool Pruner
    participant SERL as SERL Engine (Shadow-PTY & Refusal Interceptor)
    participant LLM as Local LLM (llama.cpp Metal / Ollama)
    participant Driver as 101 Native Capability Drivers

    alt Standard Command
        User->>UI: ls -la, git push, cargo test
        UI->>Rust: Raw PTY Stream
        Rust-->>UI: Sub-millisecond stdout
    else Autonomous AI Instruction ('>')
        User->>UI: > renew my ip and check ports
        UI->>Loop: User Goal & Context
        Loop->>SERL: Check Fast-Path & Offline TLDR Recipe
        opt TLDR / Fast Path Match
            SERL-->>Driver: Instant Verified Command
        end
        Loop->>LLM: GBNF Constrained Action Prompt
        LLM-->>Loop: {"action": "execute", "command": "..."}
        opt Model Canned Refusal Detected
            Loop->>SERL: Intercept Refusal & Enforce Authority
            SERL-->>LLM: Refusal Rejected Re-prompt
        end
        Loop->>SERL: Speculative Shadow-PTY Simulation
        SERL->>SERL: Validate Syntax & Safety Sandbox (K=3)
        SERL->>Driver: Execute Safe Command
        Driver-->>Rust: Run via /bin/zsh
        alt Non-Zero Exit Code (Failure)
            Rust-->>Loop: Stderr Feedback Loop
            Loop->>SERL: Self-Healing 3-Strike Auto-Remediation
            SERL-->>Driver: Corrected Command Execution
        else Success
            Rust-->>UI: Output Formatted with convertEol Normalization
            Loop->>SERL: Record DPO (chosen/rejected) & Episodic Memory
        end
    end
```

---

## 📥 Download & Installation

### Version 2.0.0 Production Release

<div align="center">
  <table>
    <thead>
      <tr>
        <th align="center" width="280">🍏 macOS (Apple Silicon & Intel)</th>
        <th align="center" width="280">🐧 Linux (x86_64 / ARM64)</th>
        <th align="center" width="280">🪟 Windows (10 / 11)</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td align="center">
          <br>
          <b><a href="https://github.com/NetPranav/Sentinal-Terminal/releases/download/v2.0.0/Sentinel_Terminal_v2.0.0_macOS.dmg">📦 Download macOS .DMG</a></b><br>
          <i>Universal Binary (v2.0.0)</i><br>
          <a href="https://github.com/NetPranav/Sentinal-Terminal/releases/download/v2.0.0/Sentinel_Terminal_v2.0.0_macOS.zip">Download .ZIP Archive</a><br><br>
        </td>
        <td align="center">
          <br>
          <b><a href="https://github.com/NetPranav/Sentinal-Terminal/tree/linux">🐧 Linux Branch Active</a></b><br>
          <i>Debian / Arch / AppImage</i><br><br>
        </td>
        <td align="center">
          <br>
          <b><a href="https://github.com/NetPranav/Sentinal-Terminal/tree/windows">🪟 Windows Branch Active</a></b><br>
          <i>ConPTY / WinRT Driver</i><br><br>
        </td>
      </tr>
    </tbody>
  </table>
</div>

### Installing on macOS:
1. Download **[`Sentinel_Terminal_v2.0.0_macOS.dmg`](https://github.com/NetPranav/Sentinal-Terminal/releases/download/v2.0.0/Sentinel_Terminal_v2.0.0_macOS.dmg)**.
2. Open the `.dmg` and drag **Sentinel Terminal.app** to your `/Applications` directory.
3. Launch Sentinel Terminal and begin orchestrating your desktop with `>`!

---

## 🧪 Testing & Verification

Sentinel is rigorously tested across all system capabilities with **983 automated unit, integration, and security tests** passing across **155 test suites**:

```bash
# Run the complete test suite
npm test

# Run core AgentLoop & SERL test suites
npx vitest run src/ai/agent/AgentLoop.test.ts

# Run shell AST security guard tests
npx vitest run src/domain/security/ShellCommandGuard.test.ts

# Run repair planner tests
npx vitest run src/repair/__tests__/RepairPlanner.test.ts
```

---

## 🎯 Fine-Tuning & Self-Improvement

Sentinel can continuously self-improve using your real terminal interactions:

1. **Generate Dataset Package**:
   ```bash
   npx tsx scripts/export_colab_training_package.ts
   ```
   Generates `training_export/sentinel_sft_dataset.jsonl`, `sentinel_dpo_dataset.jsonl`, and `sentinel_training_package.zip`.

2. **Train on Google Colab (Free T4 GPU)**:
   - Open [`notebooks/sentinel_colab_finetuning.ipynb`](notebooks/sentinel_colab_finetuning.ipynb) in Google Colab.
   - Upload your training package and run all cells.
   - Automatically fine-tunes with Unsloth 4-bit QLoRA and exports quantized GGUF models.

3. **Deploy Trained Model**:
   - Place the exported `sentinel_colab_lora.gguf` into `~/.sentinel/models/` to run your customized model offline with full Metal acceleration.

---

## 📜 License

Sentinel Terminal is open-source software licensed under the **[MIT License](LICENSE)**.

<div align="center">
  <br>
  <b>Built with visual excellence, mathematical rigor, and engineering passion. If Sentinel elevates your workflow, consider starring ⭐️ our repository!</b>
</div>
