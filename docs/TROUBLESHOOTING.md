# Sentinel Terminal Troubleshooting & Maintenance Guide

Encountering an unexpected behavior while utilizing Sentinel? Follow these simple resolution steps to maintain peak operational performance for both your shell sessions and local AI engine.

---

## 🤖 Local AI Runtime Connectivity

### AI Planner Reports "Connection Error" or Inactivity
If natural language commands (such as `"open youtube.com in safari"`) result in a backend connection error or slow timeout:
1. **Verify Ollama Service**: Confirm that your local Ollama desktop engine is running in the background. You can start Ollama directly from your applications folder or verify from a terminal tab by typing:
   ```bash
   ollama serve
   ```
2. **Confirm AI Model Presence**: Guarantee that the optimal lightweight model has been pulled to your machine:
   ```bash
   ollama list
   # If missing, pull instantly:
   ollama pull qwen2.5:1.5b
   ```
3. **Check AI Engine Settings**: Open the system top menu bar under **`Personalization ➔ AI Engine & Model Settings...`** to confirm the correct endpoint port (`http://localhost:11434`) and model selection are enabled.

---

## ⌨️ Shell Input & Keyboard Behaviors

### Backspace Key Acting Like Spacebar in Custom zsh Profiles
When launching packaged macOS desktop apps directly from Finder, system environment variables vary from developer command-line shells. Sentinel handles this natively by injecting `TERM=xterm-256color`, `COLORTERM=truecolor`, and `LANG=en_US.UTF-8` automatically.
- **Resolution**: Ensure you are running the latest official application build of **`Sentinel Terminal.app`**. If you maintain customized `.zshrc` bindkeys, ensure standard backward character deletion mappings are preserved:
  ```bash
  bindkey '^?' backward-delete-char
  ```

### CLI Command "Not Found" for Ollama, Brew, or Node in Standalone App
- **Automatic Path Enrichment**: Sentinel automatically incorporates standard macOS distribution directories into your application session (including `/opt/homebrew/bin`, `/usr/local/bin`, and system directories). If you rely on custom installation pathways (such as `.nvm` or `.pyenv`), confirm they are exported directly within your `.zshenv` or `.zprofile` initialization scripts.

---

## 🍎 macOS Permissions & Application Control

### "Operation Not Permitted" When Killing Processes or Launching Web Apps
When executing conversational automation (such as `"stop chrome"` or `"open google.com in chrome"`):
- **Desktop Launcher Privileges**: On initial launch, macOS may prompt you for confirmation to automate application switching or execute Launch Services. Select **Allow** in your macOS dialog prompt to guarantee uninterrupted conversational execution.
- **Security Guardrails**: If Sentinel blocks a requested filesystem cleanup operation, inspect the interactive terminal notification. Destructive operations require confirming administrative risk credentials to prevent unintentional system loss.
