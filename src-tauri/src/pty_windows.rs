use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::io::{Read, Write};
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Serialize, Clone)]
pub struct PtyOutputEvent {
    pub session_id: String,
    pub data: Vec<u8>,
}

pub struct PtySession {
    master: Box<dyn portable_pty::MasterPty + Send>,
    writer: Box<dyn std::io::Write + Send>,
}

pub struct PtyState {
    pub sessions: Arc<Mutex<HashMap<String, PtySession>>>,
}

impl Default for PtyState {
    fn default() -> Self {
        Self {
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

#[tauri::command]
pub fn spawn_pty(
    app_handle: AppHandle,
    state: State<'_, PtyState>,
    rows: u16,
    cols: u16,
    shell: Option<String>,
    cwd: Option<String>,
    login_shell: Option<bool>,
    args: Option<Vec<String>>,
    env: Option<HashMap<String, String>>,
) -> Result<String, String> {
    let pty_system = NativePtySystem::default();

    let pair = pty_system.openpty(PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    }).map_err(|e| e.to_string())?;

    #[cfg(target_os = "windows")]
    let default_shell = "powershell.exe".to_string();
    #[cfg(not(target_os = "windows"))]
    let default_shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    let target_shell = shell.filter(|s| !s.trim().is_empty()).unwrap_or(default_shell);
    let mut cmd = CommandBuilder::new(&target_shell);

    if login_shell == Some(true) && !target_shell.contains("pwsh") && !target_shell.contains("powershell") {
        cmd.arg("-l");
    }

    if let Some(extra_args) = args {
        for arg in extra_args {
            cmd.arg(arg);
        }
    }

    if let Some(dir) = cwd.filter(|d| !d.trim().is_empty()) {
        cmd.cwd(dir);
    }

    // Enforce standard macOS terminal emulator variables
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    cmd.env("TERM_PROGRAM", "Sentinel Terminal");
    cmd.env("TERM_PROGRAM_VERSION", "0.1.0");
    cmd.env("SENTINEL_TERMINAL", "1");
    cmd.env("LANG", "en_US.UTF-8");
    cmd.env("LC_ALL", "en_US.UTF-8");

    if let Some(custom_env) = env {
        for (k, v) in custom_env {
            cmd.env(k, v);
        }
    }

    // PATH is inherited automatically on Windows

    let _child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;
    
    drop(pair.slave);
    
    let session_id = Uuid::new_v4().to_string();
    let session_id_clone = session_id.clone();
    
    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    
    let app_handle_clone = app_handle.clone();
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let _ = app_handle_clone.emit("pty-output", PtyOutputEvent {
                        session_id: session_id_clone.clone(),
                        data: buf[..n].to_vec(),
                    });
                }
                Err(_) => break, // Error or closed
            }
        }
        let _ = app_handle_clone.emit("pty-exit", session_id_clone.clone());
    });

    state.sessions.lock().unwrap().insert(session_id.clone(), PtySession {
        master: pair.master,
        writer,
    });

    Ok(session_id)
}

#[tauri::command]
pub fn write_pty(
    state: State<'_, PtyState>,
    session_id: String,
    data: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get_mut(&session_id) {
        session.writer.write_all(data.as_bytes()).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}

#[tauri::command]
pub fn resize_pty(
    state: State<'_, PtyState>,
    session_id: String,
    rows: u16,
    cols: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock().unwrap();
    if let Some(session) = sessions.get(&session_id) {
        session.master.resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        }).map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}

#[tauri::command]
pub fn kill_pty(
    state: State<'_, PtyState>,
    session_id: String,
) -> Result<(), String> {
    let mut sessions = state.sessions.lock().unwrap();
    if sessions.remove(&session_id).is_some() {
        Ok(())
    } else {
        Err("Session not found".to_string())
    }
}
