# Sentinel Terminal Frequently Asked Questions (FAQ)

Find answers to common user questions regarding Sentinel's local AI features, privacy guardrails, system interactions, and general usage.

---

## 🔒 Privacy & Local AI

### Does Sentinel send my code, commands, or private data to the cloud?
**No.** Sentinel is engineered as an offline-first solution. All natural language parsing, command translation, and intentional workflow reasoning take place locally on your computer via your native hardware and localized Ollama runtime. Zero telemetry, keystrokes, or filesystem paths ever transmit to external cloud services or public LLM endpoints.

### Why does Sentinel recommend the Qwen 2.5 local AI model?
Sentinel pairs with lightweight, hyper-optimized models such as **Qwen 2.5:1.5b**. This configuration achieves near-instantaneous inference responsiveness (typically under a few hundred milliseconds), minimal RAM footprint, and superior command syntax comprehension—all while operating entirely offline on standard laptop hardware or Apple Silicon processors.

### What happens if I disconnect from the internet?
Sentinel retains full conversational AI capabilities without an internet connection. Because your language model runs on localized machine resources, feature workflows—including directory navigation, file pattern hunting, process termination, and interactive shell scripting—continue operating at peak performance anywhere you work.

---

## 💻 Terminal Compatibility & Performance

### Can I still run traditional terminal utilities and shell scripts?
**Absolutely.** Sentinel acts as a high-performance native terminal emulator utilizing hardware-accelerated WebGL rendering and native pseudo-terminal (PTY) communication. Tools such as `vim`, `nano`, `tmux`, `git`, `docker`, and SSH work exactly as they do in classic command prompt environments.

### How does Sentinel distinguish between conversational AI commands and normal UNIX syntax?
Sentinel applies real-time evaluation heuristics. Standard system commands (`cd`, `git status`, `ls -lah`, `npm test`) bypass language interpretation completely for direct execution in your active shell. Natural language expressions (`"take me to downloads folder"`, `"open youtube.com in safari"`, or `"stop chrome"`) automatically route to Sentinel's AI Intent Engine for smart execution and prompt synchronization.

---

## 🛡️ Safety & Security Controls

### What happens if I ask Sentinel to delete important files or run a risky operation?
Sentinel incorporates a proactive **Zero-Trust Security Engine**. Every automated workflow receives a real-time danger and risk score. If a proposed action involves destructive file operations or administrative modifications, Sentinel immediately intercepts the workflow and presents an interactive authorization dialog requiring your explicit verification before execution can continue.

### Can Sentinel safely stop stuck desktop applications and background processes?
**Yes.** When you issue natural language instructions like `"kill antigravity"` or `"stop chrome"`, Sentinel executes verified OS cleanup capabilities that sweep both the main application process and any lingering helper threads or orphan background services, keeping your system memory clean and responsive.
