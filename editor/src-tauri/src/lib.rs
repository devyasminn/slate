use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    Manager, RunEvent, WindowEvent,
};

mod lifecycle;
use lifecycle::{shutdown_server, ServerState};

mod profile_files;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            profile_files::open_profile_file,
            profile_files::save_profile_file
        ])
        .manage(Mutex::new(ServerState::default()))
        .setup(|app| {
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show_i = MenuItem::with_id(app, "show", "Open Slate Editor", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let app_handle = app.handle().clone();
            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |_tray, event| match event.id.as_ref() {
                    "quit" => {
                        println!("[App] Quit requested from tray");
                        let state = app_handle.state::<Mutex<ServerState>>();
                        shutdown_server(&state);
                        app_handle.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app_handle.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| match event {
                    TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } => {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    _ => {}
                })
                .build(app)?;

            let state = app.state::<Mutex<ServerState>>();
            let result = state
                .lock()
                .map_err(|_| "Server state lock poisoned")?
                .start(app.handle());
            if let Err(error) = result {
                shutdown_server(&state);
                return Err(error.into());
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| match event {
            RunEvent::WindowEvent {
                label,
                event: WindowEvent::CloseRequested { api, .. },
                ..
            } => {
                if label == "main" {
                    if let Some(window) = app.get_webview_window("main") {
                        let _ = window.hide();
                    }
                    api.prevent_close();
                }
            }
            RunEvent::Exit => {
                println!("[App] App exiting, stopping Slate server...");
                let state = app.state::<Mutex<ServerState>>();
                shutdown_server(&state);
            }
            _ => {}
        });
}
