# Sentinel Terminal — Local AI Cognitive Architecture

Sentinel brings native desktop computing and offline artificial intelligence together. Instead of requiring subscription APIs or transmitting sensitive project code across external internet servers, Sentinel natively coordinates an offline Large Language Model engine operating directly on your computer hardware.

---

## 🚀 Privacy-First Offline Processing

### Zero-Data Leakage Architecture
Traditional developer AI assistants transmit command terminal history, environment secrets, and private repository architecture over remote API endpoints. Sentinel flips this paradigm completely:
- **Local Inference**: All intelligence reasoning executes entirely inside your localized desktop memory footprint.
- **Strict Network Isolation**: Whether you are traveling without internet access or operating in secure, air-gapped corporate development environments, your terminal AI continues functioning at full capability without external connectivity.

---

## ⚡ Accelerated Hardware Optimization

Sentinel works alongside modern runtime infrastructure (including **Ollama**) to deliver near-instantaneous command processing:
- **Apple Silicon & CoreML Adaptations**: Takes full advantage of unified memory architectures (M1, M2, M3, and M4 chips) using dedicated GPU/NPU Metal hardware pipelines for sub-second responses.
- **Lightweight Intelligence Models**: By utilizing optimized architectural profiles like **Qwen 2.5 (1.5B / 3B / 7B)**, Sentinel delivers high-precision shell navigation translations and operating system automation without slowing down your machine or eating into compiling CPU resources.

---

## 🧠 Cognitive Architecture: How Small Models Punch Above Their Weight

Small local models often hallucinate or fail when presented with dozens of tool schemas at once. Sentinel solves this through a **Three-Pillar Cognitive Architecture**:

### 1. Dynamic Domain Tool Pruning (Laser-Focused Context)
Instead of dumping 100+ raw tool definitions into a small model's prompt:
1. Sentinel's lightweight classifier determines the intent domain (`DevOps`, `SystemServices`, `Filesystem`, `Hardware`, `AppControl`).
2. Only the **4 to 6 tools relevant to that domain** are dynamically injected into the context window.
3. This eliminates context clutter, prevents argument hallucination, and enables a 3B model to execute with the precision of a 70B frontier model.

### 2. "Probe Before You Leap" Discovery Engine
When a user asks for a target not in the current directory (`>run my gazebo`, `>start robotics node`):
- Sentinel does not blindly guess or fail with `command not found`.
- It executes a **Discovery Probe** across development workspaces (scanning for `package.xml`, `launch.py`, `docker-compose.yml`, `Cargo.toml`).
- If multiple candidates exist, it pauses and presents an **Interactive Disambiguation Menu** so the user can select their target with 1 keystroke.

### 3. In-Loop Error Self-Healing & Physical Action Pausing
When a command fails:
- **Software Errors**: Sentinel inspects `stderr` and exit codes, formulates a corrective sub-phase (e.g. `Phase 2.1: Free port 3000`), and retries automatically.
- **Physical Action Required**: If the error requires human intervention (`device offline`, `insert USB`, `power on hardware`), Sentinel enters the **`AwaitingPhysicalConfirmation`** state, prompts the user clearly, and resumes execution the moment confirmation is provided.

---

## ⚙️ Customizing AI Engine Settings

Adjust AI behavior directly from your macOS system screen header:
1. Click **`Personalization ➔ AI Engine & Model Settings...`** in your top monitor menu bar.
2. Select your preferred local model profile, adjust responsiveness thresholds, or switch underlying localized host endpoints effortlessly.
