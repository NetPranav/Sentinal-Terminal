#[cfg(target_os = "macos")]
mod pty;

#[cfg(target_os = "windows")]
#[path = "pty_windows.rs"]
mod pty;
mod process_cmds;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{Menu, Submenu, MenuItem, PredefinedMenuItem};
                use tauri::Emitter;

                let handle = app.handle();

                // 1. App Submenu
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

                // 2. Personalization & Settings Submenu (in the native top menu bar)
                let theme_item = MenuItem::with_id(handle, "open-theme", "Appearance & Color Themes...", true, None::<&str>)?;
                let ai_item = MenuItem::with_id(handle, "open-ai-settings", "AI Engine & Model Settings...", true, None::<&str>)?;
                let personalize_menu = Submenu::with_items(handle, "Personalization", true, &[
                    &theme_item,
                    &ai_item,
                ])?;

                // 3. File Submenu
                let new_tab_item = MenuItem::with_id(handle, "new-tab", "New Terminal Tab", true, Some("CmdOrCtrl+T"))?;
                let close_tab_item = MenuItem::with_id(handle, "close-tab", "Close Tab", true, Some("CmdOrCtrl+W"))?;
                let file_menu = Submenu::with_items(handle, "File", true, &[
                    &new_tab_item,
                    &close_tab_item,
                ])?;

                // 4. Edit Submenu
                let edit_menu = Submenu::with_items(handle, "Edit", true, &[
                    &PredefinedMenuItem::undo(handle, None)?,
                    &PredefinedMenuItem::redo(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::cut(handle, None)?,
                    &PredefinedMenuItem::copy(handle, None)?,
                    &PredefinedMenuItem::paste(handle, None)?,
                    &PredefinedMenuItem::select_all(handle, None)?,
                ])?;

                // 5. View / Window
                let window_menu = Submenu::with_items(handle, "Window", true, &[
                    &PredefinedMenuItem::minimize(handle, None)?,
                    &PredefinedMenuItem::fullscreen(handle, None)?,
                    &PredefinedMenuItem::separator(handle)?,
                    &PredefinedMenuItem::close_window(handle, None)?,
                ])?;

                let menu = Menu::with_items(handle, &[
                    &app_menu,
                    &personalize_menu,
                    &file_menu,
                    &edit_menu,
                    &window_menu,
                ])?;

                app.set_menu(menu)?;

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
