mod pty;
mod process_cmds;

#[cfg(target_os = "macos")]
fn request_bluetooth_permission() {
    use objc::{class, msg_send, sel, sel_impl};
    use std::os::raw::c_void;

    unsafe {
        // Force link CoreBluetooth framework
        #[link(name = "CoreBluetooth", kind = "framework")]
        extern "C" {}

        let manager_class = class!(CBCentralManager);
        let alloc: *mut objc::runtime::Object = msg_send![manager_class, alloc];
        let nil: *mut c_void = std::ptr::null_mut();
        // Initialize to trigger the permission prompt
        let _: *mut objc::runtime::Object = msg_send![
            alloc,
            initWithDelegate: nil
            queue: nil
            options: nil
        ];
    }
}

#[cfg(not(target_os = "macos"))]
fn request_bluetooth_permission() {}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            request_bluetooth_permission();

            // Spawn Embedded LLM Sidecar
            use tauri::Manager;
            
            // Find the llama-server binary — it's placed next to our main executable by Tauri
            let exe_dir = std::env::current_exe()
                .ok()
                .and_then(|p| p.parent().map(|d| d.to_path_buf()));
            
            if let Some(exe_dir) = exe_dir {
                // Model is in the resources directory
                let model_path = if let Ok(resource_dir) = app.path().resource_dir() {
                    resource_dir.join("resources/models/model.gguf")
                } else {
                    exe_dir.join("resources/models/model.gguf")
                };
                
                // Try multiple possible locations for the llama-server binary
                let mut possible_paths = vec![
                    exe_dir.join("llama-server"),                    // dev mode: target/debug/llama-server
                    exe_dir.join("../MacOS/llama-server"),           // bundled .app: Contents/MacOS/llama-server
                    std::path::PathBuf::from("/usr/bin/llama-server"),
                    std::path::PathBuf::from("/usr/local/bin/llama-server"),
                ];
                if let Ok(home) = std::env::var("HOME") {
                    possible_paths.push(std::path::PathBuf::from(format!("{}/.local/bin/llama-server", home)));
                }
                
                let binary_path = possible_paths.iter().find(|p| p.exists());
                
                match binary_path {
                    Some(bin_path) => {
                        let model_str = model_path.to_string_lossy().into_owned();
                        let bin_str = bin_path.to_string_lossy().into_owned();
                        println!("Starting llama-server: {} with model: {}", bin_str, model_str);
                        // Get CPU thread count for optimal threading
                        let n_threads = std::thread::available_parallelism()
                            .map(|n| n.get())
                            .unwrap_or(4)
                            .to_string();
                        
                        #[allow(unused_mut)]
                        let mut args = vec![
                            "--port".to_string(), "8847".to_string(),
                            "-m".to_string(), model_str,
                            "-t".to_string(), n_threads,
                            "--flash-attn".to_string(),
                            "-b".to_string(), "2048".to_string(),
                            "-c".to_string(), "4096".to_string(),
                            "--no-warmup".to_string(),
                        ];
                        #[cfg(target_os = "macos")]
                        {
                            args.push("-ngl".to_string());
                            args.push("99".to_string());
                        }
                        
                        match std::process::Command::new(bin_path)
                            .args(&args)
                            .stdout(std::process::Stdio::null())
                            .stderr(std::process::Stdio::null())
                            .spawn()
                        {
                            Ok(child) => println!("Successfully spawned llama-server (pid: {})", child.id()),
                            Err(e) => eprintln!("Failed to spawn llama-server: {}", e),
                        }
                    },
                    None => {
                        println!("llama-server binary not bundled; using Ollama / local API runtime fallback.");
                    }
                }
            }
            
            {
                use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem};
                use tauri::Emitter;

                let handle = app.handle();

                // 1. File Submenu
                let new_tab_item = MenuItem::with_id(handle, "new-tab", "New Terminal Tab", true, Some("CmdOrCtrl+T"))?;
                let close_tab_item = MenuItem::with_id(handle, "close-tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;
                let file_menu = Submenu::with_items(handle, "File", true, &[
                    &new_tab_item,
                    &close_tab_item,
                ])?;

                // 2. Personalization & Settings Submenu
                let theme_item = MenuItem::with_id(handle, "open-theme", "Appearance & Color Themes...", true, None::<&str>)?;
                let ai_item = MenuItem::with_id(handle, "open-ai-settings", "AI Engine & Model Settings...", true, None::<&str>)?;
                let personalize_menu = Submenu::with_items(handle, "Personalization", true, &[
                    &theme_item,
                    &ai_item,
                ])?;

                // 3. Edit Submenu
                let edit_menu = Submenu::with_items(handle, "Edit", true, &[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ])?;

                // 4. View / Window
                let window_menu = Submenu::with_items(handle, "Window", true, &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::fullscreen(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ])?;

                #[cfg(target_os = "macos")]
                let app_menu = Submenu::with_items(handle, "Sentinel Terminal", true, &[
                    &PredefinedMenuItem::about(handle, None, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::services(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::hide(handle, None)?,
                    &PredefinedMenuItem::hide_others(handle, None)?,
                    &PredefinedMenuItem::show_all(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::quit(handle, None)?,
                ])?;

                #[cfg(target_os = "macos")]
                let menu = Menu::with_items(handle, &[
                    &app_menu,
                    &personalize_menu,
                    &file_menu,
                    &edit_menu,
                    &window_menu,
                ])?;

                #[cfg(not(target_os = "macos"))]
                let menu = Menu::with_items(handle, &[
                    &file_menu,
                    &personalize_menu,
                    &edit_menu,
                    &window_menu,
                ])?;

                let _ = app.set_menu(menu);

                app.on_menu_event(|app_handle, event| {
                    match event.id().as_ref() {
                        "open-theme" => {
                            let _ = app_handle.emit("menu-event", "open-theme");
                        },
                        "open-ai-settings" => {
                            let _ = app_handle.emit("menu-event", "open-ai-settings");
                        },
                        "new-tab" => {
                            let _ = app_handle.emit("menu-event", "new-tab");
                        },
                        "close-tab" => {
                            let _ = app_handle.emit("menu-event", "close-tab");
                        },
                        _ => {}
                    }
                });
            }
            Ok(())
        })
        .manage(pty::PtyState::default())
        .manage(process_cmds::SystemState(std::sync::Mutex::new(sysinfo::System::new())))
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            pty::spawn_pty,
            pty::write_pty,
            pty::resize_pty,
            pty::kill_pty,
            process_cmds::list_processes,
            process_cmds::kill_process,
            process_cmds::get_system_stats,
            process_cmds::execute_command,
            process_cmds::get_launch_args
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app_handle, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                use tauri::Emitter;
                let url_strings: Vec<String> = urls.into_iter().map(|u| u.to_string()).collect();
                let _ = _app_handle.emit("sentinel-url", url_strings);
            }
        });
}
