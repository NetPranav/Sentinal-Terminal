use sysinfo::{System, Signal, ProcessesToUpdate};
use serde::Serialize;
use std::sync::Mutex;

pub struct SystemState(pub Mutex<System>);

#[derive(Serialize)]
pub struct SystemStats {
    pub memory_used: u64,
    pub cpu_usage: f32,
}

#[tauri::command]
pub fn get_system_stats(state: tauri::State<'_, SystemState>) -> SystemStats {
    let mut sys = state.0.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();
    
    SystemStats {
        memory_used: sys.used_memory() / 1048576, // MB
        cpu_usage: sys.global_cpu_usage(),
    }
}

#[derive(Serialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory: u64,
    pub cpu: f32,
    pub cmd: Vec<String>,
}

#[tauri::command]
pub fn list_processes() -> Result<Vec<ProcessInfo>, String> {
    let mut sys = System::new_all();
    sys.refresh_all();
    
    let mut processes = Vec::new();
    for (pid, process) in sys.processes() {
        processes.push(ProcessInfo {
            pid: pid.as_u32(),
            name: process.name().to_string_lossy().into_owned(),
            memory: process.memory(),
            cpu: process.cpu_usage(),
            cmd: process.cmd().iter().map(|s| s.to_string_lossy().into_owned()).collect(),
        });
    }
    
    // Optional: Sort by CPU or memory
    processes.sort_by(|a, b| b.memory.cmp(&a.memory));
    
    Ok(processes)
}

#[tauri::command]
pub fn kill_process(pid: u32) -> Result<bool, String> {
    let mut sys = System::new();
    sys.refresh_processes(ProcessesToUpdate::All, true);
    
    if let Some(process) = sys.process(sysinfo::Pid::from_u32(pid)) {
        Ok(process.kill_with(Signal::Kill).unwrap_or(process.kill()))
    } else {
        Err("Process not found".to_string())
    }
}

#[derive(Serialize)]
pub struct CommandOutput {
    pub stdout: String,
    pub stderr: String,
    pub code: i32,
}

pub fn expand_tilde(path: &str) -> std::path::PathBuf {
    if path == "~" {
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            return std::path::PathBuf::from(home);
        }
    } else if let Some(rest) = path.strip_prefix("~/").or_else(|| path.strip_prefix("~\\")) {
        if let Ok(home) = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")) {
            return std::path::PathBuf::from(home).join(rest);
        }
    }
    std::path::PathBuf::from(path)
}

#[tauri::command]
pub async fn execute_command(command: String, args: Vec<String>, cwd: Option<String>) -> Result<CommandOutput, String> {
    let mut process = std::process::Command::new(&command);
    process.args(&args);

    let target_dir = cwd
        .filter(|path| !path.trim().is_empty())
        .map(|path| expand_tilde(&path))
        .and_then(|p| if p.is_dir() { Some(p) } else { None })
        .or_else(|| {
            std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .ok()
                .map(std::path::PathBuf::from)
                .filter(|p| p.is_dir())
        });

    if let Some(directory) = target_dir {
        process.current_dir(directory);
    }

    let output = process
        .output()
        .map_err(|e| format!("Failed to execute {}: {}", command, e))?;

    Ok(CommandOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        code: output.status.code().unwrap_or(-1),
    })
}

#[tauri::command]
pub fn get_launch_args() -> Vec<String> {
    std::env::args().collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_expand_tilde() {
        let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap();
        let expanded = expand_tilde("~");
        assert_eq!(expanded.to_str().unwrap(), home);

        let expanded_sub = expand_tilde("~/test_dir");
        assert_eq!(expanded_sub.to_str().unwrap(), format!("{}/test_dir", home));

        let regular = expand_tilde("/tmp");
        assert_eq!(regular.to_str().unwrap(), "/tmp");
    }
}
