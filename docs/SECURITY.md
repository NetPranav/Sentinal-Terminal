# Sentinel Terminal — Security & Safeguards Guide

Allowing an autonomous AI agent to interact with your operating system requires absolute trust, verifiable boundaries, and zero-leakage guarantees. Sentinel implements a comprehensive **Zero-Trust Security Engine** engineered to protect your local environment from accidental destruction, privilege escalation, and prompt injection attacks.

---

## 1. Categorical Policy Engine

Sentinel evaluates all proposed tool actions against a categorical safety policy (replacing legacy scalar 0–100 risk scoring):

| Policy Tier | Behavior | Example Operations |
| :--- | :--- | :--- |
| **`SAFE`** | Executes immediately without interruption | Reading system diagnostics, listing files, checking network connections, inspecting ports |
| **`CONFIRMATION_REQUIRED`** | Pauses execution and requires explicit interactive user confirmation | Modifying configuration files, creating directories, terminating user applications, running build scripts |
| **`ADMIN_REQUIRED`** | Strictly requires user confirmation and root/sudo password authentication | Installing systemd daemons, modifying `/etc/`, altering network interfaces, kernel driver actions |
| **`BLOCKED`** | Hard-blocked; cannot be executed under any circumstances | Obfuscated dynamic execution (`eval`, `base64 -d \| bash`), fork-bombs, direct drive wipes (`dd if=/dev/zero of=/dev/sd*`) |

---

## 2. Asynchronous Non-Blocking Consent Queue (`ConsentQueue.ts`)

- **Tab-Scoped Approvals**: When a tool action requires authorization, the request is dispatched to an asynchronous consent queue tagged with the initiating session/tab ID.
- **Non-Blocking UI**: Background terminal processes continue operating while the security modal awaits user decision.
- **Detailed Action Preview**: The authorization modal presents a transparent diff of proposed shell commands, targeted filesystem paths, and potential system impacts before the user clicks **Approve** or **Deny**.

---

## 3. AST Shell Validation (`ShellAstParser.ts`)

- **Pre-Execution Syntax Analysis**: Model-generated shell commands are parsed by a dedicated Abstract Syntax Tree (AST) engine prior to execution.
- **Subshell & Obfuscation Detection**: Automatically flags hidden command chaining, subshell injection (`` `...` ``, `$(...)`), and pipe-to-interpreter patterns (`curl ... | bash`).
- **Path Confinement**: Ensures file mutations stay confined to authorized workspace directories.

---

## 4. Prompt Injection Defense & Data Protection

- **Delimited Tool Observations**: Tool outputs fed back into the LLM context window are strictly wrapped in distinct XML-style boundary delimiters (`<tool_output>...</tool_output>`). This prevents untrusted external data (such as malicious README files or web scrape contents) from hijacking model instructions.
- **Automated Secret Redaction (`SecretRedactor.ts`)**: Scans all command arguments, environment outputs, and execution logs for API keys, AWS credentials, private SSH keys, and password patterns, replacing them with `[REDACTED]` before writing to disk.
- **Local Sovereignty**: All reasoning occurs within the local embedded `llama-server` in machine RAM. Zero keystrokes, source code snippets, or environment variables ever leave your machine.

---

## 5. Session Undo Log & Destructive Rollback (`UndoLog.ts`)

- **Transactional Action Tracking**: Reversible actions (file edits, branch creation, package installations) are recorded in an in-memory session undo log.
- **Action Inspection**: Ask `>what did you just do` at any time to receive a transparent summary of recently performed modifications.
- **One-Command Rollback**: Ask `>undo last step` to trigger deterministic compensation actions (restoring pre-modification `.bak` file snapshots, reverting git stashes, or untrashing deleted files).

---

## 6. Immutable Audit Trails & Benchmark Isolation

- **Production Audit Logging**: Every capability invocation, parameter payload, policy tier evaluation, and completion timestamp is recorded to `~/.sentinel/audit.jsonl`.
- **Benchmark Isolation**: Test harnesses and automated benchmarks write exclusively to isolated logs (`~/.sentinel/audit.benchmark.jsonl`), ensuring production development records remain unpolluted.
- **Binary & Model Integrity**: Downloads for embedded binaries (`llama-server`) and GGUF models are verified against SHA-256 cryptographic checksums before loading into memory.
