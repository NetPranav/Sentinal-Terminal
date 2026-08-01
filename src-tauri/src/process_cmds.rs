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

#[tauri::command]
pub fn execute_command(command: String, args: Vec<String>) -> Result<CommandOutput, String> {
    let output = std::process::Command::new(&command)
        .args(&args)
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

