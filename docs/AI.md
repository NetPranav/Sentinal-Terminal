# Sentinel Terminal — Local AI Cognitive Architecture

Sentinel brings native desktop computing and offline artificial intelligence together. Unlike cloud-based assistants that transmit sensitive code, environment credentials, and terminal buffers to external servers, Sentinel operates an in-app embedded Large Language Model engine directly on local machine hardware with zero external dependencies.

---

## 1. Embedded In-App Inference Engine

### A. Zero-Ollama Embedded Server
- **Native llama-server Integration**: Sentinel bundles an embedded, standalone `llama-server` binary natively managed by Tauri's Rust backend (`src-tauri/src/embedded_server.rs`).
- **Zero External Dependencies**: Users do not need to install, run, or configure Ollama or any external daemon. Sentinel handles process spawning, port discovery (defaulting to `8080` with automatic port-conflict incrementing), health polling, and clean child-process termination on application exit.
- **Auto-Start on Application Launch**: When Sentinel opens, the embedded inference engine automatically initializes in the background. Live engine status is reflected on the bottom bar (`StatusBar.tsx`).
- **Optional External Ollama Fallback**: For users with pre-existing Ollama models or remote inference servers, Sentinel retains a high-performance `OllamaProvider.ts` with instant toggle capability in the AI Settings drawer.

### B. Bundled Model Profile: Qwen 2.5 Coder 3B GGUF
- **Target Model**: `Qwen2.5-Coder-3B-Instruct` quantized in 4-bit / 8-bit GGUF format.
- **Hardware Acceleration**: Automatically compiles with and utilizes GPU acceleration backends (**Vulkan** on Linux, **CUDA** on NVIDIA, and **Metal** on Apple Silicon).
- **Graceful CPU Degradation**: If GPU VRAM is exhausted or hardware acceleration is unavailable, Sentinel seamlessly falls back to CPU thread layers without crashing or throwing unhandled errors.

### C. GBNF Grammar-Constrained Sampling
- **Deterministic Tool Calling**: Raw LLM output is constrained through Backus-Naur Form (GBNF) grammar schemas managed by `GbnfGrammarManager.ts`.
- **Zero Parse Failures**: The model is mathematically forbidden from emitting malformed JSON, unclosed quotes, or illegal tool signatures. Every token sampled adheres to Sentinel's strictly validated tool schema.
- **Unconstrained Fallback**: If an unsupported grammar rule or sampler initialization error occurs, `EmbeddedProvider.ts` automatically falls back to unconstrained JSON completion.

---

## 2. Real-Time Prompt Progress & Latency Estimation

### A. Prompt Lifecycle & Bottom Bar Indicator
Whenever a natural language prompt is executed (e.g. `> write a python script...` or auto-heal remediation):
- **Dynamic Progress Crawling**: `PromptProgressManager.ts` tracks the live execution lifecycle:
  - `Thinking...` (30%)
  - `Planning...` (50%)
  - `Running: <tool/command>` (75%)
  - `Executing...` (82%)
  - `Verifying...` (92%)
  - `Done` (100%)
- **Hardware-Adaptive Time Estimation**: Employs an exponential moving average (EMA) of inference latency that automatically calibrates remaining time countdowns (`~1.8s`) based on user hardware speed (GPU vs. CPU mode).
- **Sleek Micro-Progress Bar**: Rendered in the bottom `StatusBar.tsx` with high-contrast monochrome percentages and a smooth 36px progress track.

---

## 3. Cognitive Architecture & Multi-Domain Tool Routing

Small local models often hallucinate or struggle when exposed to dozens of complex tools simultaneously. Sentinel overcomes this through a multi-pillar cognitive pipeline:

### A. Dynamic Domain Tool Pruning
Instead of saturating context with 100+ raw tool specifications:
1. Sentinel's lightweight classifier determines the intent domain among 9 specialized functional domains:
   - *Domain 1: System Diagnostics & Hardware Monitoring*
   - *Domain 2: Process Management & Resource Optimization*
   - *Domain 3: Network Diagnostics, Ports & Connections*
   - *Domain 4: Filesystem, Directory Navigation & Search*
   - *Domain 5: Git & Developer Lifecycle Workflows*
   - *Domain 6: Linux Daemons & Systemd Services*
   - *Domain 7: Desktop Applications & UI Automation*
   - *Domain 8: Linux Dotfiles & Rice Management (Hyprland)*
   - *Domain 9: Multi-Stage Composite Workflows*
2. Only the **4 to 6 tools relevant to the classified domain** are injected into the active context window.
3. This eliminates context clutter, prevents argument hallucination, and enables a 3B model to execute with the accuracy of frontier models.

### B. "Probe Before You Leap" Discovery Engine
When target files, robotics nodes, or build targets are not in the current directory (`>run my gazebo`, `>start robotics node`):
- Executes a **Discovery Probe** across development workspaces (scanning for `package.xml`, `*.launch.py`, `Cargo.toml`, `docker-compose.yml`).
- If multiple candidates exist, presents an interactive disambiguation menu so the user can select their target with 1 keystroke.

### C. In-Loop Self-Healing & Failure Classification
When an automated command fails:
- **Failure Classification**: `FailureClassifier.ts` analyzes `stderr`, exit codes, and output patterns to distinguish between missing binaries, incorrect flags, environment misconfigurations, and physical device disconnections.
- **Automated Sub-Phases**: Sentinel injects dynamic remediation steps (e.g. `Phase 2.1: Terminate process on port 3000`) and automatically retries.
- **Physical Action Confirmation**: If human intervention is required (e.g., plugging in a USB drive or powering on hardware), Sentinel enters `AwaitingPhysicalConfirmation`, prompts the user, and resumes upon confirmation.

---

## 4. Continuous Learning & Memory Engines

### A. Episodic Memory Engine (`EpisodicMemoryEngine.ts`)
- Stores execution trajectories, intent embeddings, and user corrections in localized storage (`~/.sentinel/memory/`).
- Future prompts matching past goals query episodic memory to replay proven command patterns instantaneously.

### B. Demonstration Learning Engine (`DemonstrationLearningEngine.ts`)
- If an AI prompt fails or is unresolved, and the user manually executes the correct terminal command within 3 minutes, Sentinel automatically links the user's command to the goal.
- Generates verified pattern templates in `~/.sentinel/learned_patterns.json` so the AI remembers the exact solution next time.

### C. Sentinel SERL Coordinator (`SentinelSerlCoordinator.ts`)
- Implements Self-Evolving Reinforcement Learning (SERL).
- Logs successful command executions into instruction-tuning datasets:
  - **SFT Dataset**: Supervised fine-tuning pairs (`sentinel_sft_dataset.jsonl`).
  - **DPO Dataset**: Direct preference optimization pairs (`sentinel_dpo_dataset.jsonl`).
- Enables localized LoRA fine-tuning tailored to the user's specific developer environment and aliases.

### D. Session Undo Log & Destructive Rollback (`UndoLog.ts`)
- Records reversible operations (file creations, package installations, branch switches).
- Users can inspect recent actions by asking `>what did you just do` and trigger deterministic rollback via `>undo last step`.

---

## 5. Security & Guardrails

- **Categorical Policy Engine**: Categorizes actions into `SAFE`, `CONFIRMATION_REQUIRED`, `ADMIN_REQUIRED`, and `BLOCKED` (replacing scalar risk scores).
- **Asynchronous Consent Queue**: High-risk operations (e.g., `rm -rf`, disk formatting, service kills) are routed through a non-blocking UI confirmation modal before execution.
- **AST Shell Validation**: All model-generated shell commands are parsed by `ShellAstParser.ts` prior to execution to catch hidden subshells, command injection, or obfuscated payloads (`eval`, `base64 -d | bash`).
- **Secret Redaction**: Redacts API keys, tokens, and passwords prior to writing traces to disk or terminal logs.
