# Sentinel Terminal — Resolved Issues Log (FIXED.md)

This document tracks verified resolutions, architectural implementations, touched components, and testing validations for core issues resolved in Sentinel Terminal.

---

## Table of Contents
1. [Issue 1: Cloud API "Test Connection" Transient Failures](#issue-1-cloud-api-test-connection-transient-failures)
2. [Issue 3: Persistent Execution Plan HUD Notification Overlay](#issue-3-persistent-execution-plan-hud-notification-overlay)
3. [Issue 8: Clipboard Paste Failure on Prompt Entry (Ctrl+Shift+V / Ctrl+V)](#issue-8-clipboard-paste-failure-on-prompt-entry-ctrlshiftv--ctrlv)

---

## Issue 1: Cloud API "Test Connection" Transient Failures

### 1.1 Problem Statement
When configuring cloud AI providers (OpenAI, Groq, Anthropic, DeepSeek, OpenRouter, or Custom endpoints) in Settings and clicking **"Test Connection"**, the initial probe frequently failed with a red error badge for the first 2-3 attempts before succeeding on subsequent tries.

This behavior created user friction and confusion, falsely signaling that entered API keys, base URLs, or proxy routes were invalid.

### 1.2 Resolution Status
- **Status:** Resolved & Verified
- **Commit:** `5daff74` (`fix(cloud-provider): resolve transient connection test failures with auto-retry and endpoint normalization`)
- **Validation:** 100% test pass rate across unit test suite ([`CloudApiProvider.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ai/provider/CloudApiProvider.test.ts)) and full workspace build.

### 1.3 Technical Root Causes
1. **Zero-Retry Single-Shot Network Probe:**
   - In [`CloudApiProvider.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ai/provider/CloudApiProvider.ts), `testConnection()` originally performed a single, un-retried HTTP POST request.
   - Initial connections to cloud endpoints encounter cold TCP/TLS handshakes, DNS resolution latency, proxy route establishment, or transient server-side cold starts (e.g. Groq/OpenRouter rate limiter spikes, 429 concurrency blips, 502/503/504 gateway timeouts).
   - Any single transient error immediately surfaced as a failure in the UI. When the user re-clicked the button after several seconds, the socket and TLS session were warmed, leading to delayed success.
2. **Missing Request Timeout Budget:**
   - Initial HTTP fetch lacked an explicit `AbortSignal.timeout(...)`. When socket contention occurred, requests could stall or abort abruptly with an uncaught `TypeError: Failed to fetch`.
3. **Endpoint URL Normalization Defects:**
   - If a user entered standard provider base URLs such as `https://api.openai.com` or `https://api.deepseek.com` without `/v1`, `normalizeEndpointUrl()` incorrectly produced `https://api.openai.com/chat/completions` (omitting `/v1/`), returning HTTP 404 until manually corrected.
4. **Dynamic Import Latency in Tauri HTTP Client:**
   - Dynamic `await import('@tauri-apps/plugin-http')` on initial call had IPC registration delay in WebKit GTK environments.
5. **Reasoning Model Payload Incompatibility:**
   - Next-generation reasoning models (`o1`, `o3-mini`) reject traditional `max_tokens` parameters, returning HTTP 400 when tested against chat completion schemas.

### 1.4 Implemented Architecture & Remediation
1. **Automated Retry Loop with Progressive Backoff:**
   - [`CloudApiProvider.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ai/provider/CloudApiProvider.ts) implements an automated 3-attempt retry loop with progressive backoff delays (350ms, 700ms) for transient network dropouts, 429 rate limits, and 5xx gateway errors.
2. **Immediate Fast Abort for Authentication Failures:**
   - HTTP 401 Unauthorized and HTTP 403 Forbidden errors bypass retries and abort immediately, avoiding artificial delays when an API key is genuinely invalid.
3. **Strict 8-Second Timeout Budget per Attempt:**
   - Enforced an 8,000ms `AbortController` timeout budget per probe attempt to prevent hanging requests.
4. **Comprehensive Provider Endpoint Normalization:**
   - Extended `normalizeEndpointUrl()` to handle bare root domains and canonical paths for:
     - OpenAI (`api.openai.com` -> `/v1/chat/completions`)
     - Groq (`api.groq.com`, `api.groq.com/openai` -> `/v1/chat/completions`)
     - OpenRouter (`openrouter.ai`, `openrouter.ai/api` -> `/v1/chat/completions`)
     - Anthropic (`api.anthropic.com` -> `/v1/messages`)
     - DeepSeek (`api.deepseek.com` -> `/v1/chat/completions`)
5. **Reasoning Model Payload Adaptation:**
   - Detects reasoning models (`o1`, `o3-mini`) and swaps `max_tokens` for `max_completion_tokens: 16`, with graceful fallback probe to `/models` if chat completions fail.
6. **Cached Dynamic Module Resolution:**
   - Cached `@tauri-apps/plugin-http` import to eliminate IPC module loading latency on repeated calls.
7. **UI Visual Feedback:**
   - Added rotating spinner indicator and "Verifying Connection..." state in [`AiSettingsPage.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ui/components/AiSettingsPage.tsx).

### 1.5 Touched Components & Files
- [`src/ai/provider/CloudApiProvider.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ai/provider/CloudApiProvider.ts): Retry engine, backoff scheduler, endpoint normalizer, and reasoning payload handler.
- [`src/ui/components/AiSettingsPage.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ui/components/AiSettingsPage.tsx): Connection testing state and visual spinner.
- [`src/App.css`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/App.css): Spinner animation keyframes adhering to grayscale aesthetics.
- [`src/ai/provider/CloudApiProvider.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ai/provider/CloudApiProvider.test.ts): Unit test coverage for retry behavior, 401 fast abort, timeout handling, and URL normalization.

---

## Issue 3: Persistent Execution Plan HUD Notification Overlay

### 3.1 Problem Statement
When a multi-step workflow execution failed (or completed), a floating HUD card remained anchored in the top-right corner of the terminal window indefinitely.

The card:
1. Did not auto-dismiss or vanish after an execution timeout.
2. Lacked a manual close/dismiss button (`X`).
3. Lacked user configuration options in Settings to adjust timing or disable floating notifications.
4. Used saturated purple colors (`#d8b4fe`, `rgba(192, 132, 252, 0.28)`), in direct violation of the project's matte dark / grayscale aesthetic rules.

### 3.2 Resolution Status
- **Status:** Resolved & Verified
- **Commit:** `8613aca` (`fix(presentation): resolve persistent execution plan HUD overlay with auto-dismiss, manual close, and user duration settings`)
- **Validation:** 100% test pass rate across unit test suite ([`SettingsCenter.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ui/__tests__/SettingsCenter.test.ts)) and full workspace build.

### 3.3 Technical Root Causes
1. **Unconditional State Persistence on Error:**
   - In [`TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx), when an `error` event was emitted by the agent loop, `PromptProgressManager.getInstance().completePrompt(false, event.message)` was executed, but `setLatestPlan(null)` was never invoked. The plan state variable remained set indefinitely.
2. **Missing Manual Dismiss Action:**
   - The native `<details>` card had no close action. Clicking the summary merely toggled accordion collapse, leaving the header permanently anchored across terminal output.
3. **Absence of Auto-Dismiss Timer:**
   - There was no `setTimeout` mechanism to clear `latestPlan` after a completion or failure event.
4. **Missing User Preferences:**
   - No setting existed in `localStorage` or Settings Center to control notification durations (5s, 8s, 15s, persistent, or disabled).
5. **Violation of Grayscale Aesthetic Standards:**
   - Saturated purple accent colors conflicted with AGENTS.md Rule 3.

### 3.4 Implemented Architecture & Remediation
1. **Manual Dismiss and Header Collapse Actions:**
   - Replaced `<details>` element with a structured HUD card component in [`TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx).
   - Added a dedicated monochrome `X` dismiss button that immediately unmounts the card and clears pending dismiss timers.
   - Added a `ChevronUp` / `ChevronDown` button to toggle collapsing the phase breakdown while keeping the header visible.
2. **Configurable Auto-Dismiss with Hover Pausing:**
   - Added `schedulePlanDismiss()` and `clearPlanDismissTimer()` in [`TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx).
   - Automatically schedules auto-dismiss upon plan completion or error according to user preferences (default: 8 seconds).
   - Added `onMouseEnter` / `onMouseLeave` handlers: hovering over the card pauses auto-dismissal so users can inspect phase outputs or error logs; moving the mouse away resumes the countdown.
3. **Settings Center Preferences:**
   - Added dedicated "Workflow Execution Plan HUD & Notifications" configuration card in [`AiSettingsPage.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ui/components/AiSettingsPage.tsx) under the **General** tab.
   - Added toggle to enable/disable HUD overlay (`sentinel_hud_plan_enabled`).
   - Added duration selector (`5s`, `8s (Default)`, `15s`, `Persistent / Manual Close Only`) backed by `sentinel_hud_plan_duration`.
   - Dispatches `sentinel:hud-settings-changed` CustomEvents so all open terminal panes update dynamically without reload.
4. **Strict Grayscale & No-Emoji Standards:**
   - Redesigned the card using the matte dark grayscale palette (`rgba(12, 13, 18, 0.96)`, 12%-25% white borders, pure white and muted white typography).
   - Standardized typographical status indicators (`✓` Completed, `✗` Failed, `▸` Running, `⊘` Skipped, `○` Pending). Zero emojis.

### 3.5 Touched Components & Files
- [`src/presentation/TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx): Floating HUD overlay component, manual dismiss `X`, collapse toggle, hover-pause auto-dismiss timer, and settings event listener.
- [`src/ui/components/AiSettingsPage.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ui/components/AiSettingsPage.tsx): Workflow Execution Plan HUD & Notifications settings section under General tab.
- [`src/ui/__tests__/SettingsCenter.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/ui/__tests__/SettingsCenter.test.ts): Unit tests verifying HUD preference persistence and custom event dispatching.

---

## Issue 8: Clipboard Paste Failure on Prompt Entry (Ctrl+Shift+V / Ctrl+V)

### 8.1 Problem Statement
When typing an AI prompt starting with `>` (or entering any shell command) in the terminal and attempting to paste text (such as an instruction, code snippet, or multiline prompt) using `Ctrl+Shift+V` or `Ctrl+V`, nothing was pasted into the terminal buffer. The keystroke was swallowed silently without error feedback or output.

### 8.2 Resolution Status
- **Status:** Resolved & Verified
- **Commit:** `224a50e` (`fix(terminal): resolve clipboard paste failure on prompt entry with native clipboard integration and ref sync`)
- **Validation:** 100% test pass rate across unit test suite ([`src/utils/__tests__/clipboard.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/utils/__tests__/clipboard.test.ts)), full test suite (192 test files, 1,374 tests), and production bundle build.

### 8.3 Technical Root Causes
1. **Stale Closure Bug on `sessionId` in `attachCustomKeyEventHandler`:**
   - In [`TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx), `term.attachCustomKeyEventHandler` was registered on initial component mount inside `useEffect(() => { ... }, [])`.
   - It closed over `sessionId` from the component scope, which initialized as `initialSessionId` (`undefined`).
   - When asynchronous PTY session initialization created `currentSessionId`, the `attachCustomKeyEventHandler` closure retained `sessionId === undefined`.
   - Consequently, `if (text && sessionId)` continuously evaluated to `false`, and `SessionManager.getInstance().write(sessionId, text)` was never invoked.
2. **Key Event Cancellation Swallowing Fallbacks:**
   - The key event handler returned `false` unconditionally for `Ctrl+V` and `Ctrl+Shift+V`, which instructed xterm.js to halt event propagation and suppress all default terminal paste mechanisms. Because the custom handler dropped the text due to the stale `sessionId`, the paste action was swallowed silently.
3. **Linux WebKitGTK Clipboard Permission Restraints:**
   - The handler called `navigator.clipboard.readText()`. In Linux desktop WebKitGTK / Wayland environments, this Web API frequently rejects with `NotAllowedError` or returns empty strings when called from a keyboard hook without an active DOM text selection.
   - The app already had `@tauri-apps/plugin-clipboard-manager` installed and registered in Rust, but it was not being utilized by the terminal view.
4. **Multiline Prompt Early Shell Execution:**
   - When pasting multiline text into an AI prompt starting with `>`, raw newlines could cause shells without bracketed paste to execute partial command fragments prematurely.

### 8.4 Implemented Architecture & Remediation
1. **Unified Clipboard Utility Module:**
   - Created [`src/utils/clipboard.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/utils/clipboard.ts) providing `readClipboardText()` and `writeClipboardText()`.
   - Directly leverages Tauri's native desktop clipboard plugin (`@tauri-apps/plugin-clipboard-manager`) to read system clipboards via `wl-clipboard` / `x11-clipboard` on Linux, completely bypassing WebKitGTK permission constraints.
   - Gracefully falls back to `navigator.clipboard` for web preview and testing environments.
2. **Mutable Session Ref Synchronization:**
   - Introduced `sessionIdRef = useRef<string | undefined>(initialSessionId)` in [`TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx).
   - Synchronized `sessionIdRef.current` immediately during `initSession()` upon session creation and whenever props update.
   - Wrapped paste execution in `handlePasteRef.current()` so key handlers always resolve the active PTY session without stale closure traps.
3. **Comprehensive Linux & Universal Shortcut Support:**
   - Extended key event interception to support `Ctrl+Shift+V`, `Ctrl+V`, `Cmd+V`, and standard Linux `Shift+Insert`.
   - Extended copy interception to support `Ctrl+Shift+C`, `Ctrl+C` (when selection exists), and `Ctrl+Insert`.
   - Updated the right-click context menu handler to use the same unified `handlePaste()` and `handleCopy()` logic.
4. **Bracketed Paste and AI Prompt Formatting:**
   - Implemented `formatTerminalPastePayload()` to wrap payloads in `\x1b[200~` ... `\x1b[201~` when the terminal mode indicates active bracketed paste.
   - For environments where bracketed paste is inactive and the user is drafting an AI prompt (`>`), automatically flattens internal line breaks into clean spaces to protect against premature shell execution of partial commands.
5. **Automated Unit Testing:**
   - Created test suite [`src/utils/__tests__/clipboard.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/utils/__tests__/clipboard.test.ts) covering formatting, bracketed paste wrapping, multiline flattening, and web API fallbacks.

### 8.5 Touched Components & Files
- [`src/utils/clipboard.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/utils/clipboard.ts): Unified clipboard read/write engine and terminal paste payload formatter.
- [`src/utils/__tests__/clipboard.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/utils/__tests__/clipboard.test.ts): Unit tests for clipboard utilities.
- [`src/presentation/TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx): Replaced stale closure paste with ref-synchronized handler, integrated native clipboard reading, expanded Linux shortcut support (`Shift+Insert`, `Ctrl+Insert`), and unified context menu handling.

---

## Issue 9: Arrow Key In-Buffer Line Navigation vs. History Ingestion in Long Prompts

### 9.1 Problem Statement
When a user drafts or edits a multi-step prompt (e.g. `> Create a temporary testing workspace...`) that wraps across multiple terminal rows, or navigates horizontally within a prompt or command using the Left/Right arrow keys, pressing the Up Arrow (`↑`) key previously sent `\x1b[A` directly to the underlying PTY. GNU Readline in Bash/Zsh interprets `\x1b[A` as `previous-history`, obliterating the drafted prompt and replacing it with the last run command from shell history (e.g., `git status` or `ls`).

### 9.2 Resolution Status
- **Status:** Resolved & Verified
- **Validation:** 100% test pass rate across unit test suite ([`src/domain/terminal/PromptNavigationEngine.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/domain/terminal/PromptNavigationEngine.test.ts) - 12/12 tests), full project test suite (193 test files, 1,386 tests), and production bundle build (`npm run build`).

### 9.3 Technical Root Causes
1. **GNU Readline Single-Line Buffer Ingestion Model:**
   - GNU Readline and standard shell line editors operate on logical command strings rather than terminal-aware 2D grid coordinates.
   - When a long command or prompt wraps across multiple physical terminal rows, Readline treats `\x1b[A` strictly as `previous-history`. It possesses no native concept that pressing Up Arrow from row 2 or 3 of a wrapped line should visually move the cursor up to the row above.
2. **Direct Unchecked Forwarding of Arrow Escape Sequences:**
   - In `TerminalView.tsx`, `term.onData` forwarded all unhandled keystrokes directly to `SessionManager.write(sessionId, data)`.
   - When Up or Down arrow was pressed during prompt drafting or in-line editing, the escape codes `\x1b[A` and `\x1b[B` were dispatched directly to the PTY, wiping user-composed prompts without warning.
3. **Absence of In-Line Horizontal Navigation State Tracking:**
   - The terminal had no tracking mechanism to detect whether the user had intentionally moved their cursor backward into a command using Left Arrow (`ArrowLeft`) to inspect or modify arguments.
   - Pressing Up Arrow while positioned in the middle of a command invariably destroyed the command buffer instead of navigating within the text.

### 9.4 Implemented Architecture & Remediation
1. **Behavioral Navigation Model (`PromptNavigationEngine.ts`):**
   - **Rule 1 (History by Default):** By default and on single-line commands, Up and Down arrow keys pass directly to GNU Readline / shell history without interception.
   - **Rule 2 (In-Command Horizontal Navigation):** Left and Right arrow keys navigate horizontally within the active command/prompt string.
   - **Rule 3 (Right-Arrow-Triggered In-Buffer Line Navigation):**
     - To move through lines in a multi-row prompt, the user uses the Right Arrow key once to move the cursor ahead of the last character (last non-whitespace symbol, number, or alphabet).
     - **Ahead of Last Character (`cursorX > lastCharCol` on `endRow` with `hasPressedRightArrow`):** Up and Down arrow move up and down between the visual lines of the prompt (`\x1b[D`.repeat(cols) for line-up, `\x1b[C`.repeat(cols) for line-down), maintaining line navigation mode.
     - **On or Behind Last Character (`cursorX <= lastCharCol`):** Up and Down arrow navigate through previous commands and prompts.
     - **Ahead or On First Character (`cursorX <= firstCharCol` on `startRow`):** Up and Down arrow navigate through previous commands and prompts.
     - **Boundary Transition:** When moving up reaches the top row of the prompt, Up arrow transitions back to shell history to cycle previous commands.
2. **Terminal Key Handler Integration (`TerminalView.tsx`):**
   - `ArrowRight` sets `hasPressedRightArrowRef.current = true`.
   - `ArrowLeft` navigates within the command and immediately resets `hasPressedRightArrowRef.current = false` and `isLineNavigatingRef.current = false`, ensuring on-or-behind-character cursor positions cycle shell history.
   - `Enter`, `Ctrl+C` (`\x03`), `Ctrl+U`, and normal history cycling reset navigation flags.
   - Alternate screen buffer (vim, nano, htop, less) automatically bypasses interception.
3. **Comprehensive Automated Test Suite (`PromptNavigationEngine.test.ts`):**
   - 12 comprehensive unit tests validating single-line history pass-through, empty prompt pass-through, alternate buffer bypass, multi-row behind/on last character history pass-through, ahead/on first character history pass-through, right-arrow ahead-of-last-char line navigation, top-line history switch, and bottom-line history switch. All 12 tests pass.

### 9.5 Touched Components & Files
- [`src/domain/terminal/PromptNavigationEngine.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/domain/terminal/PromptNavigationEngine.ts): Smart prompt boundary detection, first/last character column resolution, and navigation evaluation.
- [`src/domain/terminal/PromptNavigationEngine.test.ts`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/domain/terminal/PromptNavigationEngine.test.ts): Unit tests covering all behavioral rules.
- [`src/presentation/TerminalView.tsx`](file:///home/overxpowered/padhai_in_linux/Projects/sentinal/src/presentation/TerminalView.tsx): Integrated `hasPressedRightArrowRef`, `isLineNavigatingRef`, key event hooks, and alternate buffer guards.
