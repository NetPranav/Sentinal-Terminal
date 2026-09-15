# Sentinel Terminal — Troubleshooting & Diagnostics Guide

Encountering an unexpected behavior in Sentinel? Follow these step-by-step diagnostic and resolution procedures for the embedded AI engine, terminal PTY, and Linux desktop integration.

---

## 1. Embedded AI Inference Engine Diagnostics

### A. AI Status Shows "AI: Off" in Bottom Status Bar
If the status indicator displays `AI: Off`:
1. **Check AI Settings**: Click the `AI: Off` button or open AI Settings via the Command Palette (`Ctrl+Shift+P`).
2. **Start Engine Manually**: In the AI Settings drawer, click **Start Engine**. Sentinel will spawn `llama-server` on the next available port.
3. **Check Port Availability**: The embedded server defaults to port `8080`. If another process occupies port 8080, Sentinel automatically increments to `8081`, `8082`, etc. Verify running status via:
   ```bash
   curl http://localhost:8080/health
   # or
   curl http://localhost:8081/health
   ```
4. **Inspect Lingering Processes**: If an unexpected crash left an orphan process running, terminate it cleanly:
   ```bash
   pkill -f llama-server
   ```

### B. Slow AI Inference or GPU VRAM Exhaustion
- **VRAM Exhaustion**: If running alongside heavy 3D rendering (e.g. Gazebo or Blender), your GPU may run out of memory for the 3B model.
- **CPU Fallback**: In the AI Settings drawer, toggle **CPU Fallback Mode**. Sentinel will offload model computation layers to your host CPU threads, ensuring uninterrupted inference.

### C. GBNF Grammar Initialization Errors
- **Error Code 400 (`failed to parse grammar`)**: Older `llama-server` builds forbid underscores in rule names (e.g. `action_done`). Sentinel's `GbnfGrammarManager.ts` automatically sanitizes rule identifiers to hyphen-case (`action-done`).
- If an unhandled grammar parse error occurs, `EmbeddedProvider.ts` automatically falls back to unconstrained JSON completion.

---

## 2. Shell Input, PTY & Keyboard Behaviors

### A. `Ctrl+Shift+P` vs. `Ctrl+Alt+P` Conflict
- **Command Palette**: Bound to **`Ctrl + Shift + P`** (or `Cmd + Shift + P`).
- **Listening Ports Drawer**: Bound to **`Ctrl + Alt + P`** (or `Ctrl + Option + P`).
- If a shortcut does not trigger, open **`[F1 help]`** in the status bar to verify active keybindings.

### B. `Ctrl+R` History Search Interception
- Sentinel intercepts `Ctrl+R` in the terminal to display an interactive, visual fuzzy history search modal.
- If raw bash reverse-search (`(reverse-i-search)`) appears instead, ensure your terminal is running Sentinel version 5.0+ where keydown events are captured prior to PTY byte transmission.

### C. Fullscreen Interactive Programs (`vim`, `nano`, `htop`, `tmux`)
- Sentinel's PTY state tracker detects the alternate screen buffer (`\x1b[?1049h`) and automatically suspends ghost-text autocompletions and output observers, preventing cursor jumping or display glitches during interactive editing.

---

## 3. Linux Desktop & Wayland Integration

### A. Virtual Keyboard & Mouse Automation (`ydotoold`)
- For desktop application automation under Wayland / Hyprland, Sentinel interfaces with `ydotoold`.
- If automation commands fail with `cannot open /dev/uinput`:
  1. Add your user to the `input` group:
     ```bash
     sudo usermod -aG input $USER
     ```
  2. Ensure the `ydotool` systemd user daemon is active:
     ```bash
     systemctl --user enable --now ydotool
     ```

### B. Missing Binaries in Standalone App
- Sentinel automatically incorporates standard paths into session environments (`/usr/local/bin`, `~/.cargo/bin`, `~/.local/bin`, `/opt/homebrew/bin`).
- If custom toolchains (e.g. `nvm`, `pyenv`, `asdf`) are not found, ensure their exports are present in `~/.bashrc` or `~/.zshrc`.
