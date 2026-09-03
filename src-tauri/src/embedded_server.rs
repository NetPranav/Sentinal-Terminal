use std::sync::Mutex;
use std::process::{Child, Command, Stdio};
use std::path::PathBuf;
use serde::Serialize;

pub struct EmbeddedLlmState {
    pub process: Mutex<Option<Child>>,
    pub active_model: Mutex<Option<String>>,
    pub port: u16,
}

impl Default for EmbeddedLlmState {
    fn default() -> Self {
        Self {
            process: Mutex::new(None),
            active_model: Mutex::new(None),
            port: 8847,
        }
    }
}

#[derive(Serialize)]
pub struct EmbeddedLlmStatus {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub active_model: Option<String>,
    pub port: u16,
}

fn get_home_dir() -> Option<PathBuf> {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .ok()
        .map(PathBuf::from)
}

fn find_llama_server_binary() -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(home) = get_home_dir() {
        candidates.push(home.join(".sentinel").join("bin").join("llama-server"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("llama-server"));
            candidates.push(parent.join("../MacOS/llama-server"));
        }
    }

    candidates.push(PathBuf::from("/opt/homebrew/bin/llama-server"));
    candidates.push(PathBuf::from("/usr/local/bin/llama-server"));

    candidates.into_iter().find(|p| p.exists() && p.is_file())
}

fn find_model_file(preferred: Option<String>) -> Option<PathBuf> {
    if let Some(ref path) = preferred {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    let mut candidates = Vec::new();

    if let Some(home) = get_home_dir() {
        let models_dir = home.join(".sentinel").join("models");
        // Check primary Qwen 2.5 3B model
        candidates.push(models_dir.join("qwen2.5-coder-3b-instruct-q4_k_m.gguf"));
        candidates.push(models_dir.join("model.gguf"));

        // Or search models_dir for any .gguf file
        if let Ok(entries) = std::fs::read_dir(&models_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().map_or(false, |ext| ext == "gguf") {
                    candidates.push(path);
                }
            }
        }
    }

    candidates.into_iter().find(|p| p.exists() && p.is_file())
}

#[tauri::command]
pub fn start_embedded_llm(
    state: tauri::State<'_, EmbeddedLlmState>,
    model_path: Option<String>,
) -> Result<bool, String> {
    let bin_path = find_llama_server_binary().ok_or_else(|| {
        "llama-server binary not found in ~/.sentinel/bin, app bundle, or /opt/homebrew/bin".to_string()
    })?;

    let model_file = find_model_file(model_path).ok_or_else(|| {
        "No GGUF model file found. Download Qwen2.5-Coder-3B into ~/.sentinel/models/".to_string()
    })?;

    let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;

    // Stop existing process if already running
    if let Some(mut child) = proc_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    let n_threads = std::thread::available_parallelism()
        .map(|n| n.get())
        .unwrap_or(4)
        .to_string();

    let model_str = model_file.to_string_lossy().into_owned();
    let port_str = state.port.to_string();

    let child = Command::new(&bin_path)
        .args([
            "--port", &port_str,
            "-m", &model_str,
            "-ngl", "99",       // Offload layers to Metal GPU on macOS
            "-t", &n_threads,
            "--flash-attn",
            "-b", "2048",
            "-c", "4096",
            "--no-warmup",
        ])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to spawn llama-server at {}: {}", bin_path.display(), e))?;

    let mut model_guard = state.active_model.lock().map_err(|e| e.to_string())?;
    *model_guard = Some(model_str);
    *proc_guard = Some(child);

    Ok(true)
}

#[tauri::command]
pub fn stop_embedded_llm(state: tauri::State<'_, EmbeddedLlmState>) -> Result<bool, String> {
    let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;
    if let Some(mut child) = proc_guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }

    let mut model_guard = state.active_model.lock().map_err(|e| e.to_string())?;
    *model_guard = None;

    Ok(true)
}

#[tauri::command]
pub fn get_embedded_llm_status(
    state: tauri::State<'_, EmbeddedLlmState>,
) -> Result<EmbeddedLlmStatus, String> {
    let mut proc_guard = state.process.lock().map_err(|e| e.to_string())?;
    let model_guard = state.active_model.lock().map_err(|e| e.to_string())?;

    let is_running = if let Some(ref mut child) = *proc_guard {
        match child.try_wait() {
            Ok(None) => true,
            _ => {
                *proc_guard = None;
                false
            }
        }
    } else {
        false
    };

    let pid = if is_running {
        proc_guard.as_ref().map(|c| c.id())
    } else {
        None
    };

    Ok(EmbeddedLlmStatus {
        is_running,
        pid,
        active_model: model_guard.clone(),
        port: state.port,
    })
}
