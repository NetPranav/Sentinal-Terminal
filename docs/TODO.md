# Sentinel Terminal — Product Roadmap & Engineering Master Tracker

Sentinel Terminal is a high-performance, AI-native terminal emulator designed for mission-critical software engineering, robotics development (ROS/ROS 2), system administration, and modern full-stack workflows.

---

## 🏆 Master Roadmap Status by Tier (Active Focus)

| Tier | Focus Area | Status | Key Deliverables |
|---|---|---|---|
| **Tier 1** | **Shell-Native Autonomous Execution Engine** | 🟢 **COMPLETED** | Replaces brittle 101-tool JSON schema architecture with direct Shell (`zsh`/`bash`/`powershell`) CLI generation. Sandboxed via `SecurityEngine` & `PolicyEngine`. |
| **Tier 2** | **Autonomous Self-Healing & Refusal Interception** | 🟢 **COMPLETED** | Intercepts LLM conversational refusals (*"I don't have access"*), feeds command stderr/exit codes back into AI loop for up to 3 self-healing retries. |
| **Tier 3** | **Continuous On-Device Learning & LoRA Fine-Tuning** | 🟡 **NEXT UP** | Dynamic Episodic Memory (0ms in-context conditioning) + automatic ShareGPT dataset export for Qwen 2.5 Coder 3B LoRA fine-tuning. |

---

## 🐚 Tier 1: Shell-Native Autonomous Execution Engine

Transition Sentinel Terminal from fragile tool calling to native shell execution aligned with Qwen 2.5 Coder's pre-trained weights:

- [x] **1.1 Native Shell System Prompt Contract**
  - *Target*: `src/ai/agent/SystemPrompt.ts`
  - *Goal*: Remove 101 custom JSON tool schemas. Instruct the model as an active terminal copilot with full command generation authority.
  - *Format*: `{"action": "execute", "command": "<cli_command>", "explanation": "<1-line summary>"}` or `{"action": "done", "summary": "<response>"}`.
- [x] **1.2 Direct PTY Shell Execution Pipeline**
  - *Target*: `src/ai/agent/AgentLoop.ts`, `src/sdk/capabilities/drivers/ShellSDKCapability.ts`
  - *Goal*: Run commands directly via `/bin/zsh -lc` (macOS), `/bin/bash` (Linux), and `powershell` (Windows) with real environment variable and alias awareness.
- [x] **1.3 Security & Permission Guardrails**
  - *Target*: `src/domain/security/SecurityEngine.ts`, `src/domain/security/PolicyEngine.ts`
  - *Goal*: Zero-friction execution for read-only / diagnostic commands (`ls`, `mdfind`, `lsof`, `git status`, `networksetup`), while requiring 1-click user confirmation with 1-line explanation for sensitive/destructive commands (`rm`, `kill`, `sudo`).
- [x] **1.4 Direct Output Streaming to Terminal**
  - *Target*: `src/presentation/TerminalView.tsx`, `src/presentation/OutputFormatter.ts`
  - *Goal*: Real command stdout/stderr rendered cleanly without fake tool wrapper badges.

---

## 🔄 Tier 2: Autonomous Self-Healing & Refusal Interception

Ensure Sentinel never gets stuck on canned model refusals or broken command syntax:

- [x] **2.1 Conversational Refusal Interceptor**
  - *Target*: `src/ai/agent/AgentLoop.ts`
  - *Goal*: Detect and intercept LLM canned refusals (*"I don't have access to your file system"*, *"I cannot assist with that"*), reject the response, and re-prompt the model to generate the actionable terminal command.
- [x] **2.2 Stderr & Non-Zero Exit Code Feedback Loop**
  - *Target*: `src/ai/agent/AgentLoop.ts`
  - *Goal*: When a shell command fails (exit code != 0 or stderr), feed the exact error back into the AI context:
    *"Command '<cmd>' failed with code <code>: <stderr>. Analyze the failure and output a corrected command."*
- [x] **2.3 Three-Strike Autonomous Auto-Remediation**
  - *Target*: `src/ai/agent/AgentLoop.ts`
  - *Goal*: Allow up to 3 automatic correction attempts before halting and prompting the user for manual demonstration.
- [x] **2.4 Deterministic Execution Fallback**
  - *Target*: `src/ai/agent/AgentLoop.ts`
  - *Goal*: If LLM fails across 3 attempts, run deterministic OS probe as safety net.

---

## 🧠 Tier 3: Continuous On-Device Learning & LoRA Fine-Tuning

Make Sentinel adapt to the user's specific system, workflows, and style over time:

- [ ] **3.1 Dynamic Episodic Memory Engine (Instant 0ms Recall)**
  - *Target*: `src/domain/learning/EpisodicMemoryEngine.ts`
  - *Goal*: Persist user demonstrations to `~/.sentinel/memory/learned_demonstrations.json`.
  - *Features*: Semantic & token-similarity retriever that fetches top matching demonstrations and injects them directly into the system prompt's dynamic context window.
- [ ] **3.2 Persistent Demonstration Capture in Terminal**
  - *Target*: `src/presentation/TerminalView.tsx`
  - *Goal*: Fix `lastUnresolvedGoalRef` tracking so it stays active whenever a command is unresolved. When the user types the working command in their terminal, Sentinel captures `(goal, command, cwd, os)` instantly.
- [ ] **3.3 Continuous ShareGPT / Alpaca Dataset Generation**
  - *Target*: `src/domain/learning/EpisodicMemoryEngine.ts`
  - *Goal*: Automatically append every successful self-healing and demonstrated workflow to `~/.sentinel/training/sentinel_shell_dataset.jsonl`.
- [ ] **3.4 One-Click LoRA Fine-Tuning Pipeline**
  - *Target*: `scripts/finetune_sentinel_lora.py`
  - *Goal*: Standalone fine-tuning script supporting Unsloth / PEFT to train lightweight LoRA adapter (`~/.sentinel/models/sentinel_custom_lora.bin`) and auto-load via `llama-server --lora`.

---

## 🏛️ Completed Foundation (Archived Milestone)
- ✅ Core Reliability, Security & Sandbox Fortification (749/749 tests green).
- ✅ Visual Auto-Remediation Toast HUD, Workspace Quick-Switcher (`Cmd+O`), Port & Process Manager (`Cmd+Shift+P`), Frecency History (`Ctrl+R`) (754/754 tests green).
- ✅ Plugin Marketplace runtime, cryptographic tamper-evident audit logs, remote SSH session multiplexer (765/765 tests green).
