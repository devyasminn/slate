use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent, WindowEvent,
};
use tauri_plugin_shell::{process::CommandChild, ShellExt};

struct ServerState {
    child: Option<CommandChild>,
}

#[derive(serde::Deserialize)]
struct HealthResponse {
    #[allow(dead_code)]
    status: String,
    app: String,
    owner: String,
    env: String,
    pid: u32,
}

fn check_health() -> Option<HealthResponse> {
    ureq::get("http://127.0.0.1:8000/health")
        .timeout(Duration::from_millis(500))
        .call()
        .ok()
        .and_then(|resp| resp.into_json::<HealthResponse>().ok())
}

fn kill_zombie(pid: u32) -> bool {
    println!("[Lifecycle] Killing zombie server PID {}", pid);
    std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

fn wait_for_port_free(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if check_health().is_none() {
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn wait_for_server_ready(timeout: Duration) -> bool {
    let start = Instant::now();
    while start.elapsed() < timeout {
        if check_health().is_some() {
            return true;
        }
        thread::sleep(Duration::from_millis(200));
    }
    false
}

fn spawn_server(app: &AppHandle) -> Result<CommandChild, String> {
    let sidecar = app
        .shell()
        .sidecar("slate-server")
        .map_err(|e| format!("Failed to create sidecar command: {}", e))?
        .env("SLATE_OWNER", "tauri")
        .env("SLATE_ENV", "prod");

    let (_, child) = sidecar
        .spawn()
        .map_err(|e| format!("Failed to spawn sidecar: {}", e))?;

    Ok(child)
}

fn kill_sidecar_tree(child: CommandChild) {
    let pid = child.pid();
    println!("[Lifecycle] Force killing sidecar tree for PID {}", pid);
    let _ = std::process::Command::new("taskkill")
        .args(["/T", "/F", "/PID", &pid.to_string()])
        .status();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(Mutex::new(ServerState { child: None }))
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
                        if let Ok(mut guard) = state.lock() {
                            if let Some(child) = guard.child.take() {
                                kill_sidecar_tree(child);
                            }
                        }
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

            match check_health() {
                None => {
                    println!("[Lifecycle] Port 8000 unresponsive or invalid fingerprint. Checking for legacy processes...");
                    if std::net::TcpStream::connect_timeout(
                        &"127.0.0.1:8000".parse().unwrap(),
                        Duration::from_millis(100),
                    )
                    .is_ok()
                    {
                        println!("[Lifecycle] Port 8000 occupied by unknown/legacy process. Please close any old slate-server instances.");
                        return Err("Port 8000 is occupied. Close old server instances first.".into());
                    }
                    println!("[Lifecycle] Port 8000 free, spawning sidecar...");
                }
                Some(health) => {
                    if health.app != "slate-server" {
                        return Err("Port 8000 is in use by another application.".into());
                    }
                    if health.owner != "tauri" || health.env != "prod" {
                        return Err(format!(
                            "A {}/{} Slate server is running. Close it before opening the editor.",
                            health.owner, health.env
                        )
                        .into());
                    }
                    println!(
                        "[Lifecycle] Detected zombie tauri/prod server (PID {})",
                        health.pid
                    );
                    if !kill_zombie(health.pid) {
                        return Err("Failed to terminate zombie server.".into());
                    }
                    if !wait_for_port_free(Duration::from_secs(2)) {
                        return Err("Could not free port 8000 after killing zombie.".into());
                    }
                    println!("[Lifecycle] Port freed, spawning new sidecar...");
                }
            }

            let child = spawn_server(app.handle())?;
            let state = app.state::<Mutex<ServerState>>();
            if let Ok(mut guard) = state.lock() {
                guard.child = Some(child);
            }

            if wait_for_server_ready(Duration::from_secs(10)) {
                println!("[Lifecycle] Server ready");
            } else {
                eprintln!("[Lifecycle] Server failed to start within timeout");
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
                println!("[App] App exiting, killing sidecar...");
                let state = app.state::<Mutex<ServerState>>();
                if let Ok(mut guard) = state.lock() {
                    if let Some(child) = guard.child.take() {
                        kill_sidecar_tree(child);
                    }
                };
            }
            _ => {}
        });
}
