# Sentinel Terminal — Core Engineering Roadmap & Issue Tracker

This document tracks critical core issues, bugs, and security vulnerabilities identified in Sentinel Terminal that must be resolved directly within the repository.

---

## 🚀 Next-Gen Autonomous Planning & Self-Healing Architecture Epics

### 🔷 Epic 1: Autonomous Error Recovery & "Awaiting Physical Confirmation"
- [x] **1.1 Error Diagnostics Engine**: Implement `ErrorDiagnosticsEngine.ts` classifying terminal stderr / non-zero exit codes into `SOFTWARE_RECOVERABLE` vs `PHYSICAL_ACTION_REQUIRED`.
- [x] **1.2 In-Loop Remediation Sub-Phases**: Auto-inject corrective sub-phases in `AdaptivePlanEngine` (e.g. `Phase 2.1: Terminate process on port 3000`) and retry up to 3 times.
- [x] **1.3 Human-in-the-Loop State Machine**: Implement `AWAITING_PHYSICAL_ACTION` state prompting user for physical actions (plug USB, power on device) and pausing until confirmed.

### 🔷 Epic 2: Probe & Disambiguate Discovery Engine
- [x] **2.1 Project Discovery Engine**: Implement deep workspace scanner for ROS 1/2 (`package.xml`), Node (`package.json`), Python, Rust (`Cargo.toml`), and Docker.
- [x] **2.2 Interactive Disambiguation Menu**: Render selection choices when multiple candidates match a natural language command (`>run my gazebo`).
- [x] **2.3 Contextual Workspace Sourcing**: Automatically `cd` to target workspace and execute environment sourcing (`source setup.bash`, `conda activate`) before launching.

### 🔷 Epic 3: System Services & Dotfile "Rice" Orchestration
- [x] **3.1 Unified `system.service` Driver**: Support for Linux `systemctl [--user]`, macOS `launchctl`, and Windows Service Manager.
- [x] **3.2 Dotfile & Rice Configuration Manager**: Safe dotfile editor with AST/regex parsers for `.bashrc`, `.zshrc`, `~/.config/hypr/`, `~/.config/i3/`, `~/.config/alacritty/`.
- [x] **3.3 Startup Service Automation**: Natural language intent routing (e.g. `>enable bluetooth on startup`, `>disable auto-launch of gazebo`).

### 🔷 Epic 4: Small-Model Cognitive Supercharger
- [x] **4.1 Dynamic Domain Tool Pruning**: Classify user intent domain and dynamically load only 4–6 relevant tools into local LLM context.
- [x] **4.2 Two-Tier Reasoning Pipeline**: Split semantic understanding from deterministic DAG task decomposition.
- [x] **4.3 Zero-Hallucination Schema Enforcement**: Validate LLM parameter JSON against schemas and auto-repair types/aliases before invocation.

### 🔷 Epic 5: Production-Grade Addictive Terminal Enhancements
- [x] **5.1 Passive PTY Output Stream Observer**: Real-time terminal stderr and non-zero exit code monitoring with 1-click `[Tab]` auto-remediation chip.
- [x] **5.2 Predictive Ghost-Text from Demonstration & Workspace Context**: Sub-5ms auto-suggest powered by `DemonstrationLearningEngine` and `ProjectDiscoveryEngine`.
- [x] **5.3 Crash-Proof Session & Workspace State Serialization**: Multi-tab and split-pane layout auto-save and restore (`~/.sentinel/sessions/last_session.json`).
- [x] **5.4 Keyboard-First Ergonomics**: Zero-mouse modal navigation (`[Enter]`/`[y]` to approve, `[Esc]`/`[n]` to cancel, global summon toggle).

---

## 📋 Core Issues Checklist

### ⏳ Pending Issues (Sequenced by Priority)
- [x] **Priority 1 [P0 — Critical] — [GitHub #2](https://github.com/NetPranav/Sentinal-Terminal/issues/2) — Issue 9**: Compound shell command chaining (`&&`, `;`, `||`) bypasses `ShellCommandGuard` risk analysis
- [x] **Priority 2 [P0 — Critical] — [GitHub #3](https://github.com/NetPranav/Sentinal-Terminal/issues/3) — Issue 11**: `PolicyEngine.protect-system-dirs` fails to block deletion of subdirectories and files within protected system paths
- [x] **Priority 3 [P1 — High] — [GitHub #4](https://github.com/NetPranav/Sentinal-Terminal/issues/4) — Issue 10**: `GitCapability` and `ShellSDKCapability` drop process working directory context (`cwd`), breaking repository-relative operations
- [x] **Priority 4 [P2 — Medium] — [GitHub #5](https://github.com/NetPranav/Sentinal-Terminal/issues/5) — Issue 12**: `FilesystemSDKCapability` invokes redundant shell child processes (`sh -c 'echo $HOME'`) on every tilde path expansion
- [x] **Priority 5 [P3 — Low] — [GitHub #6](https://github.com/NetPranav/Sentinal-Terminal/issues/6) — Issue 8**: Bluetooth device connection fails when natural language queries include peripheral category nouns (e.g., "headphone")

### ✅ Resolved Issues Archive
- [x] **Issue 1**: `browser.navigate` ignores target application and drops `-a <browser>` in macOS `open` command
- [x] **Issue 2**: `application.update` fails on macOS Homebrew casks due to unnormalized app names (e.g., `brew upgrade Brave Browser`)
- [x] **Issue 3**: `ExecutionEngine` permission category fallback grants `ReadFiles` to package installation, git, docker, and ssh
- [x] **Issue 4**: `BluetoothCapability` fails on stock macOS systems when Homebrew `blueutil` binary is missing
- [x] **Issue 5**: Fast-Path Engine lacks URL and Web navigation patterns, forcing 2–5s LLM inference latency
- [x] **Issue 6**: Incomplete tool artifacts: `application.update`, `developer.scaffold`, and `system.lock` miss `knowledge.json`, `examples.json`, and `tests.json`
- [x] **Issue 7**: `system.lock` is classified as `SAFE` with `confirmationRequired: false`
- [x] **Issue 13**: `ToolExecutor` lacks execution timeout enforcement, risking indefinite UI freeze on interactive or hanging CLI commands

---

## 🔍 Detailed Issue Breakdown

### 🟢 Issue 1: `browser.navigate` ignores target application and drops `-a <browser>` in macOS `open` command
- **Status**: ✅ **RESOLVED**
- **Severity**: High
- **Component**: Browser Driver & Schemas
- **Affected Files**:
  - `src/sdk/capabilities/drivers/BrowserCapability.ts`
  - `tools/browser/navigate/tool.json`
  - `tools/browser/navigate/workflow.json`
  - `tools/browser/navigate/knowledge.json`
  - `docs/TEST_CASES.md`
- **Problem**: When users issue commands like `open youtube.com in safari` or `open github.com in chrome`, the driver only executes `open "<url>"` without the `-a <browser>` argument. The requested application was ignored and always opened in the system default browser.
- **Resolution**:
  1. Added `appName` and `browser` optional parameters to `tools/browser/navigate/tool.json`.
  2. Updated `BrowserCapability.ts` to resolve browser aliases (via `AppAliasRegistry`) and execute `open -a "<browser>" "<url>"` .
  3. Added unit tests in `CapabilitySDK.test.ts` verifying targeted browser dispatch.

---

### 🟢 Issue 2: `application.update` fails on macOS Homebrew casks due to unnormalized app names
- **Status**: ✅ **RESOLVED**
- **Severity**: High
- **Component**: Application Lifecycle / Homebrew Integration
- **Affected Files**:
  - `src/sdk/capabilities/drivers/ApplicationCapability.ts`
  - `src/domain/capabilities/AppAliasRegistry.ts`
- **Problem**: In `ApplicationCapability.ts`, `op === 'update'` was omitted from alias resolution. When passed an app like `"Brave Browser"`, it ran `brew upgrade "Brave Browser"`. Homebrew treats this as formulas named `Brave` and `Browser`, throwing `Error: No available formula or cask with the name "Brave"`. GUI applications are casks and require lowercase kebab-cased names (e.g., `brew upgrade --cask brave-browser`).
- **Resolution**:
  1. Added `defaultCasks` mapping and `resolvePackage(appNameOrAlias)` method to `AppAliasRegistry.ts` to map application names and aliases to Homebrew formula/cask identifiers with automatic kebab-case heuristic fallbacks.
  2. Included `op === 'update'`, `op === 'install'`, and `op === 'uninstall'` in alias and cask resolution in `ApplicationCapability.ts`.
  3. Added `--cask` flag targeting and automatic formula/cask fallback retry in `ApplicationCapability.ts`.
  4. Added exclusions for macOS built-in system applications (e.g. Safari, Finder, System Settings) with clear user guidance.
  5. Added comprehensive unit tests in `CapabilitySDK.test.ts` verifying package resolution, cask command construction, and system app exclusions.

---

### 🟢 Issue 3: `ExecutionEngine` permission category fallback grants `ReadFiles` to package installation, git, docker, and ssh
- **Status**: ✅ **RESOLVED**
- **Severity**: Critical (Security Vulnerability)
- **Component**: Security & Permission Enforcement
- **Affected Files**:
  - `src/domain/security/ExecutionEngine.ts`
  - `src/domain/security/PermissionManager.ts`
  - `src/domain/security/SecurityEngine.ts`
  - `src/domain/security/Security.test.ts`
- **Problem**: `ExecutionEngine.execute()` fell back to `permCategory = 'ReadFiles'` for any capability not explicitly matched in its `if/else` chain. Capabilities like `application.install`, `application.uninstall`, `application.update`, `git.*`, `docker.*`, and `developer.ssh` were treated as read-only file queries. Under restrictive profiles (`ReadOnly`, `SafeMode`, `Guest`), destructive commands (e.g. `docker rm`, `git push --force`, `brew install`) were incorrectly classified under `ReadFiles` (which is `AlwaysAllow` in `ReadOnly` and `SafeMode`), bypassing prompts and security barriers.
- **Resolution**:
  1. Implemented `ExecutionEngine.resolvePermissionCategory(capabilityId)` to explicitly categorize every capability domain into its designated `PermissionCategory` (`ShellExecution`, `Git`, `Docker`, `SSH`, `Network`, `Clipboard`, `EnvironmentVariables`, `SystemSettings`, `ProcessManagement`, `DeleteFiles`, `RenameFiles`, `WriteFiles`, `ReadFiles`).
  2. Updated `PermissionManager.ts` profile definitions to comprehensively enforce permissions for all categories across `Developer`, `Administrator`, `ReadOnly`, `SafeMode`, and `Guest` profiles (e.g. `Git`, `Docker`, `SSH`, and `ShellExecution` are strictly `AlwaysDeny` in `ReadOnly` and `Guest`, and `AskEveryTime` in `SafeMode`).
  3. Updated `SecurityEngine.ts` risk analysis to classify state-altering `Git`, `Docker`, `SSH`, and package lifecycle capabilities as `SENSITIVE` rather than `SAFE`, ensuring interactive user authorization is always triggered under `SafeMode`.
  4. Replaced hardcoded `filesystem.admin` in `ExecutionPreviewPlan.permissionsRequired` with the accurately resolved `permCategory`.
  5. Added comprehensive test coverage in `Security.test.ts` verifying category resolution, profile-based denials, and interactive preview plans.

---

### 🟢 Issue 4: `BluetoothCapability` fails on stock macOS systems when Homebrew `blueutil` binary is missing
- **Status**: ✅ **RESOLVED**
- **Severity**: High
- **Component**: Network / Bluetooth Driver
- **Affected Files**:
  - `src/sdk/capabilities/drivers/BluetoothCapability.ts`
  - `src/sdk/__tests__/CapabilitySDK.test.ts`
- **Problem**: Stock macOS does not bundle `blueutil`. When `network.bluetooth.on`, `network.bluetooth.off`, or `network.bluetooth.connect` are invoked without `blueutil` pre-installed via Homebrew (or if launched in GUI mode where Homebrew paths are missing from `$PATH`), the driver failed with an unhandled error: `Ensure blueutil is installed (brew install blueutil)`.
- **Resolution**:
  1. Implemented multi-path dynamic resolution in `resolveBlueutilBinary()` checking standard PATH, Apple Silicon Homebrew (`/opt/homebrew/bin/blueutil`), Intel Homebrew (`/usr/local/bin/blueutil`), and sbin paths.
  2. Implemented native AppleScript Control Center toggle fallback (`toggleBluetoothAppleScript`) for radio power toggling without external CLI dependencies.
  3. Added graceful fallback to `open -g x-apple.systempreferences:com.apple.BluetoothSettings` when programmatic CLI control is unavailable, providing the user with immediate GUI access and clear installation instructions.
  4. Added `installBlueutil()` helper to automate 1-click installation of `blueutil` via Homebrew when desired.
  5. Added unit tests in `CapabilitySDK.test.ts` verifying fallback behavior when `blueutil` is absent.

---

### 🟢 Issue 5: Fast-Path Engine lacks URL and Web navigation patterns, forcing 2–5s LLM inference latency
- **Status**: ✅ **RESOLVED**
- **Severity**: Medium
- **Component**: AI Fast-Path Engine
- **Affected Files**:
  - `src/ai/agent/AgentLoop.ts`
  - `src/ai/agent/AgentLoop.test.ts`
- **Problem**: `AgentLoop.ts` provided deterministic fast-paths for filesystem, battery, and process commands, but lacked comprehensive fast-path regexes for bare URLs (`github.com`, `https://news.ycombinator.com`), natural language browse commands (`browse to docs.rs`), and web search shortcuts (`google <query>`, `youtube <query>`, `search github for <query>`). These were routed through LLM inference, incurring 2–5s latency.
- **Resolution**:
  1. Expanded `FAST_PATHS` in `AgentLoop.ts` to recognize full-range standard TLDs (`com`, `org`, `io`, `dev`, `rs`, `sh`, `tech`, `site`, `space`, `online`, etc.).
  2. Added fast-path support for bare URLs without leading verbs (`github.com`, `https://...`).
  3. Added fast-path matchers for `browse to <url>`, `browse <url>`, and `go to <url>`.
  4. Added dedicated web search fast paths directly executing `browser.search` (`google <q>`, `youtube <q>`, `github <q>`, `search the web for <q>`).
  5. Added comprehensive test coverage in `AgentLoop.test.ts`.

---

### 🟢 Issue 6: Incomplete tool artifacts: `application.update`, `developer.scaffold`, and `system.lock` miss `knowledge.json`, `examples.json`, and `tests.json`
- **Status**: ✅ **RESOLVED**
- **Severity**: Medium
- **Component**: Tool Registry & Schemas
- **Affected Files**:
  - `tools/application/update/` (`knowledge.json`, `examples.json`, `tests.json`)
  - `tools/developer/scaffold/` (`knowledge.json`, `examples.json`, `tests.json`)
  - `tools/system/lock/` (`knowledge.json`, `examples.json`, `tests.json`)
  - `src/tools/loader/ToolLoader.ts`
- **Problem**: Sentinel requires 5 coordinated JSON artifacts per tool directory. These three tools only provided `tool.json` and `workflow.json`. `ToolLoader.ts` output schema warnings at startup, and the Intent Engine was unable to perform synonym matching, entity extraction hints, or automated dataset generation.
- **Resolution**:
  1. Authored complete, schema-compliant `knowledge.json`, `examples.json`, and `tests.json` for `application.update`.
  2. Authored complete, schema-compliant `knowledge.json`, `examples.json`, and `tests.json` for `developer.scaffold`.
  3. Authored complete, schema-compliant `knowledge.json`, `examples.json`, and `tests.json` for `system.lock`.
  4. Verified with `ToolLoader` and test suite: all 101 registered tools now load with 0 schema warnings and 0 failures.

---

### 🟢 Issue 7: `system.lock` is classified as `SAFE` with `confirmationRequired: false`
- **Status**: ✅ **RESOLVED**
- **Severity**: Medium
- **Component**: System Security & UX
- **Affected Files**:
  - `tools/system/lock/tool.json`
  - `src/domain/security/SecurityEngine.ts`
  - `src/domain/security/Security.test.ts`
- **Problem**: `system.lock` immediately locks the operating system screen (`pmset displaysleepnow`). Because its risk was previously marked as `SAFE` with `confirmationRequired: false`, an ambiguous natural language command or automated agent loop could abruptly lock the user out of their session without warning.
- **Resolution**:
  1. Updated `tools/system/lock/tool.json` to assign `securityRisk: "MEDIUM"` and set `confirmationRequired: true`.
  2. Added `SystemSettings` to `requiredPermissions` in `tools/system/lock/tool.json`.
  3. Updated `SecurityEngine.ts` `calculateRisk` to classify `system.lock` and screen lock operations as `SENSITIVE` (risk score 65) requiring explicit user consent (`requiresConsent: true`).
  4. Updated `SecurityEngine.ts` `analyzeCommand` to detect raw shell screen-locking invocations (`pmset displaysleepnow`, `LockWorkStation`, `lock-session`) and enforce user consent.
  5. Added unit tests in `Security.test.ts` verifying risk level classification and consent enforcement.

---

### 🟢 Issue 13: `ToolExecutor` lacks execution timeout enforcement, risking indefinite UI freeze on interactive or hanging CLI commands
- **Status**: ✅ **RESOLVED**
- **Severity**: High (System Reliability)
- **Component**: Agent Loop / Execution Engine
- **Affected Files**:
  - `src/ai/agent/ToolExecutor.ts`
  - `src/domain/security/ExecutionEngine.ts`
  - `src/sdk/capabilities/CapabilitySDK.ts`
  - `src/ai/agent/ToolExecutor.test.ts`
- **Problem**: `ToolExecutor.execute()` awaited `this.executionEngine.execute()` indefinitely without a timeout guard. If a capability triggered an interactive prompt (e.g. Git waiting for SSH credentials, an unbuffered CLI asking for confirmation, or an unresponsive network probe), the entire AgentLoop and terminal interface froze permanently with no timeout or cancellation hook.
- **Resolution**:
  1. Added `timeoutMs` to `ExecutionContext` handling in `BaseCapabilityDriver.execute()` in `CapabilitySDK.ts`, automatically canceling running drivers if time expires.
  2. Added `timeoutMs?: number` to `ExecutionOptions` in `ExecutionEngine.ts` and forwarded it to `sdkDriver.execute()`.
  3. Implemented `Promise.race` timeout guard in `ToolExecutor.execute()` with `ToolExecutor.DEFAULT_TIMEOUT_MS = 30000` (30 seconds default), catching timeouts and triggering `driver.cancel()`.
  4. Added unit test in `ToolExecutor.test.ts` confirming timeout enforcement and driver cancellation when execution exceeds timeout limit.

---

## ⏳ Priority-Ranked Pending Issues Queue

### 🔴 Priority 1 [P0 — Critical]: Issue 9 — Compound shell command chaining (`&&`, `;`, `||`) bypasses `ShellCommandGuard` risk analysis
- **Status**: ⏳ Pending
- **Priority**: P0 (Immediate Execution)
- **Severity**: Critical (CVSS ~8.5 — Security Filter Bypass)
- **Component**: Security Guard / Shell PTY Interceptor
- **Affected Files**:
  - `src/domain/security/ShellCommandGuard.ts`
  - `src/domain/security/ShellCommandGuard.test.ts`
- **Problem**:
  `ShellCommandGuard.evaluate()` splits raw user command lines on whitespace and only passes `parts[0]` (the first binary token) to `securityEngine.analyzeCommand(binary, args)`. Chained shell commands such as:
  ```bash
  echo "done" && rm -rf ~
  ls; kill -9 1
  true || sudo rm -rf /
  ```
  evaluate only the leading harmless command (`echo`, `ls`, `true`), returning a `SAFE` classification. Destructive secondary commands execute without risk elevation, password prompts, or interactive consent.
- **Proposed Solution**:
  1. Implement lexical command tokenizer in `ShellCommandGuard.ts` splitting compound pipelines on unquoted separators (`;`, `&&`, `||`, `|`, `&`).
  2. Recursively analyze every sub-command through `SecurityEngine.analyzeCommand()`.
  3. Aggregate the maximum risk score across all sub-commands so that if any command is dangerous, the entire pipeline requires interactive approval.
  4. Add automated test cases covering compound command injections.

---

### 🔴 Priority 2 [P0 — Critical]: Issue 11 — `PolicyEngine.protect-system-dirs` fails to block deletion of subdirectories and files within protected system paths
- **Status**: ⏳ Pending
- **Priority**: P0 (Immediate Execution)
- **Severity**: Critical (CVSS ~8.0 — System Integrity Violation)
- **Component**: Policy Engine
- **Affected Files**:
  - `src/domain/security/PolicyEngine.ts`
  - `src/domain/security/Security.test.ts`
- **Problem**:
  The `protect-system-dirs` rule in `PolicyEngine.ts` checks `protectedRoots.includes(normalized)`. It only matches exact root directory strings (`/System`, `/etc`, `/usr`), but does not match nested child paths (e.g. `/etc/hosts`, `/System/Library/CoreServices`, `/usr/bin/python`, `/var/log`).
  Executing `filesystem.delete` on `/etc/hosts` or `/System/Library` evaluates to `Allow` instead of `Deny`.
- **Proposed Solution**:
  1. In `PolicyEngine.ts`, verify whether `normalized === root || normalized.startsWith(root + '/')` for all protected system roots.
  2. Normalize dot-segments (`../`) before checking to prevent directory traversal bypasses (e.g., `/Users/foo/../../etc/hosts`).
  3. Add automated tests in `Security.test.ts` asserting that nested system file deletions are strictly denied.

---

### 🔴 Priority 3 [P1 — High]: Issue 10 — `GitCapability` and `ShellSDKCapability` drop process working directory context (`cwd`), breaking repository-relative operations
- **Status**: ⏳ Pending
- **Priority**: P1 (High)
- **Severity**: High (Core Functional Defect)
- **Component**: Capability SDK / Process Execution
- **Affected Files**:
  - `src/sdk/capabilities/drivers/GitCapability.ts`
  - `src/sdk/capabilities/drivers/ShellSDKCapability.ts`
  - `src/domain/security/ExecutionEngine.ts`
- **Problem**:
  When a user changes directory (e.g. `cd /path/to/repo`) and runs git tools (`git.status`, `git.commit`, `git.log`, `git.branch`), `GitCapability` calls `invoke('execute_command', { command: 'git', args })` without passing `cwd: input.directory || _context?.cwd`. `ShellSDKCapability` similarly omits fallback to `_context?.cwd`.
  Commands execute in the application's root launch directory rather than the active workspace, failing git operations with `fatal: not a git repository`.
- **Proposed Solution**:
  1. Update `GitCapability.ts` to pass `cwd: input.directory || _context?.cwd` on all git invocations and rollbacks.
  2. Update `ShellSDKCapability.ts` to fallback to `_context?.cwd` when `input.cwd` is omitted.
  3. Add unit tests asserting working directory propagation across Git and Shell drivers.

---

### 🔴 Priority 4 [P2 — Medium]: Issue 12 — `FilesystemSDKCapability` invokes redundant shell child processes (`sh -c 'echo $HOME'`) on every tilde path expansion
- **Status**: ⏳ Pending
- **Priority**: P2 (Medium)
- **Severity**: Medium (Performance & Sandbox Fragility)
- **Component**: Filesystem Driver
- **Affected Files**:
  - `src/sdk/capabilities/drivers/FilesystemSDKCapability.ts`
- **Problem**:
  In `FilesystemSDKCapability.ts` (lines 224, 242), resolving paths with `~/` spawns a child shell process `invoke('execute_command', { command: 'sh', args: ['-c', 'echo $HOME'] })` on every single file copy, move, and duplicate operation.
  Spawning child processes introduces 20–50ms latency per file operation and fails in restricted sandbox environments where `/bin/sh` cannot be invoked.
- **Proposed Solution**:
  1. Cache user home directory resolution once or resolve via platform environment variables (`process.env.HOME` or `process.env.USERPROFILE`).
  2. Centralize tilde expansion into a reusable helper method without repeated shell process invocations.

---

### 🔴 Priority 5 [P3 — Low]: Issue 8 — Bluetooth device connection fails when natural language queries include peripheral category nouns (e.g., "headphone")
- **Status**: ⏳ Pending
- **Priority**: P3 (Low)
- **Severity**: Low (NLP String Matching)
- **Component**: NLP / Bluetooth Fuzzy Matching
- **Affected Files**:
  - `src/sdk/capabilities/drivers/BluetoothCapability.ts`
- **Problem**:
  When a user commands `connect soundcore space one headphone`, the extracted device entity is `"soundcore space one headphone"`. Substring matching fails against paired devices like `"Soundcore Space One"` because the device name does not contain the word `"headphone"`. If Levenshtein distance exceeds the tolerance, connection aborts.
- **Proposed Solution**:
  1. Sanitize peripheral entity strings by stripping common accessory nouns (`headphone`, `headphones`, `earbuds`, `buds`, `headset`, `speaker`, `mouse`, `keyboard`).
  2. Check bidirectional substring containment (`devName.includes(target) || target.includes(devName)`) before fuzzy Levenshtein matching.

