# Sentinel Terminal User Guide

Welcome to **Sentinel**, an AI-native workspace designed to modernize how you interact with your machine. Whether you are navigating complex filesystem architectures, managing background system processes, or running traditional software engineering utilities, Sentinel provides an intelligent, seamless computing interface.

---

## 🚀 Launching Sentinel

When you open Sentinel Terminal, you are greeted with a fast, hardware-accelerated command line environment powered by native system APIs and an offline artificial intelligence engine.

1. **Open the Application**: Double-click **`Sentinel Terminal.app`** from your macOS Applications folder, Dock, or desktop workspace.
2. **AI Initialization**: Sentinel automatically connects to your local Ollama runtime behind the scenes. You never need to configure complex API keys or external developer cloud services.
3. **Interactive Prompt**: Start typing immediately in standard command syntax or express instructions using conversation.

---

## 🗣️ Conversational Intelligence vs. Standard Shell Commands

Sentinel features an embedded **AI Intent & Planning Engine** that interprets conversational commands without disrupting standard utilities. To ensure zero ambiguity between ordinary Unix command syntax and automated AI assistance, Sentinel uses an explicit **`>`** trigger prefix.

### Standard Command Execution
Execute industry-standard utilities without friction or delay. Standard commands without the `>` prefix run directly as sub-millisecond shell commands:
```bash
git pull origin main
docker ps -a
cd ~/Projects && ls -lh
```

### Natural Language & AI Workflows (`>`)
To summon AI assistance, simply start your line with the **`>`** prompt symbol. Sentinel instantly translates your conversational intent into secure operating system capability workflows:
- **Direct Workspace Navigation**: 
  - `>take me to Downloads folder` ➔ Automatically moves your active terminal prompt to `~/Downloads`.
  - `>take me home` / `>go back` ➔ Instantly updates your current working directory.
- **Application & Desktop Management**:
  - `>tell me all the running applications` ➔ Lists running desktop GUI applications (e.g. Sentinel Terminal, Chrome, Safari, Preview) cleanly without OS background daemons.
  - `>open youtube.com in safari` or `>open workspace in cursor` ➔ Launches native applications and IDEs directly.
- **Process & Daemon Control**:
  - `>stop chrome` or `>kill antigravity` ➔ Safely targets and halts active application processes and background threads.
- **System, Hardware & Network Diagnostics**:
  - `>check gpu status and vram` / `>what ports are open` / `>scan available wifi networks` ➔ Executes instantaneous hardware and connectivity evaluations.

---

## 🪟 Multi-Pane Workspace & Window Management

Sentinel empowers multithreaded workflows through intuitive workspace splitting:
- **Vertical & Horizontal Splits**: Organize complex engineering environments by slicing terminal views into parallel split panes.
- **Independent Session Persistence**: Each pane maintains its own isolated directory path, scrollback history, and dedicated AI execution context.
- **System Top Menu Bar Access**: Utilize your native desktop menu bar under **Personalization** to open new tabs, customize appearance, or tweak local AI models on the fly.

---

## 💡 Next Steps
- Explore full capability breakdowns in the **[Features Overview](file:///docs/FEATURES.md)**.
- Master efficient interaction with **[Keyboard Shortcuts](file:///docs/KEYBOARD_SHORTCUTS.md)**.
- Discover visual personalization in our **[Theme & Appearance Guide](file:///docs/THEMES.md)**.
