use std::process::Child;
use std::sync::Mutex;
use std::thread;
use std::time::{Duration, Instant};

use tauri::AppHandle;
use tauri_plugin_shell::ShellExt;
use uuid::Uuid;

#[derive(Default)]
pub struct ServerState {
    child: Option<Child>,
    identity: Option<Identity>,
}

struct Identity {
    instance: String,
    token: String,
    environment: String,
    qa_session: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: String,
    app: String,
    owner: String,
    env: String,
    #[serde(default)]
    instance_id: String,
    #[serde(default)]
    qa_session: String,
}

impl Identity {
    fn new() -> Result<Self, String> {
        let qa_build = env!("SLATE_BUILD_ENV") == "qa";
        let qa_env = std::env::var("SLATE_ENV")
            .unwrap_or_default()
            .trim()
            .eq_ignore_ascii_case("qa");
        let qa_session = std::env::var("SLATE_QA_SESSION").unwrap_or_default();
        if qa_build != qa_env || (!qa_build && !qa_session.is_empty()) {
            return Err(
                "QA requires its dedicated build and launch environment. Use npm run editor:qa."
                    .into(),
            );
        }
        if qa_build {
            Uuid::parse_str(&qa_session).map_err(|_| "Missing QA session UUID")?;
            let data = std::env::var("SLATE_DATA_DIR").map_err(|_| "Missing QA data directory")?;
            if !std::path::Path::new(&data).is_absolute() {
                return Err("QA requires an absolute data directory".into());
            }
        }
        Ok(Self {
            instance: Uuid::new_v4().to_string(),
            token: Uuid::new_v4().to_string(),
            environment: if qa_build { "qa" } else { "prod" }.into(),
            qa_session,
        })
    }

    fn owns(&self, health: &HealthResponse) -> bool {
        health.status == "ok"
            && health.app == "slate-server"
            && health.owner == "tauri"
            && health.env == self.environment
            && health.instance_id == self.instance
            && health.qa_session == self.qa_session
    }
}

pub fn ensure_port_free() -> Result<(), String> {
    std::net::TcpListener::bind("127.0.0.1:8000")
        .map(|_| ())
        .map_err(|_| "Port 8000 is occupied. Close the existing application yourself; Slate will not stop or reuse it.".into())
}

impl ServerState {
    pub fn start(&mut self, app: &AppHandle) -> Result<(), String> {
        let identity = Identity::new()?;
        ensure_port_free()?;
        let sidecar = app
            .shell()
            .sidecar("slate-server")
            .map_err(|error| format!("Failed to create sidecar: {error}"))?
            .env("SLATE_OWNER", "tauri")
            .env("SLATE_ENV", &identity.environment)
            .env("SLATE_INSTANCE_ID", &identity.instance)
            .env("SLATE_LIFECYCLE_TOKEN", &identity.token)
            .env("SLATE_PARENT_PID", std::process::id().to_string());
        // Keep the OS child handle, never a PID obtained from /health.
        let mut command: std::process::Command = sidecar.into();
        command
            .stdin(std::process::Stdio::null())
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null());
        self.child = Some(
            command
                .spawn()
                .map_err(|error| format!("Failed to spawn sidecar: {error}"))?,
        );
        self.identity = Some(identity);
        let deadline = Instant::now() + Duration::from_secs(30);
        while Instant::now() < deadline {
            if let Some(status) = self
                .child
                .as_mut()
                .unwrap()
                .try_wait()
                .map_err(|e| e.to_string())?
            {
                return Err(format!(
                    "Slate sidecar exited ({status}). Check QA configuration and port 8000."
                ));
            }
            if let Ok(response) = ureq::get("http://127.0.0.1:8000/health")
                .timeout(Duration::from_millis(500))
                .call()
            {
                if let Ok(health) = response.into_json::<HealthResponse>() {
                    if self.identity.as_ref().unwrap().owns(&health) {
                        return Ok(());
                    }
                    return Err(
                        "Port 8000 answered with another server's identity; refusing to reuse it."
                            .into(),
                    );
                }
            }
            thread::sleep(Duration::from_millis(200));
        }
        Err("Slate sidecar did not become ready within 30 seconds".into())
    }

    fn stop(&mut self) {
        if let Some(mut child) = self.child.take() {
            if let Some(identity) = self.identity.take() {
                // A private, per-launch capability authorizes graceful shutdown even if
                // another process has since taken the port. The token is never in /health.
                let _ = ureq::post("http://127.0.0.1:8000/api/lifecycle/shutdown")
                    .set("x-slate-lifecycle-token", &identity.token)
                    .timeout(Duration::from_secs(1))
                    .call();
            }
            let deadline = Instant::now() + Duration::from_secs(3);
            while Instant::now() < deadline {
                if matches!(child.try_wait(), Ok(Some(_))) {
                    return;
                }
                thread::sleep(Duration::from_millis(100));
            }
            let _ = child.kill();
            let _ = child.wait();
            // The Python owner watcher also exits the onefile worker when this editor exits.
        }
    }
}

impl Drop for ServerState {
    fn drop(&mut self) {
        self.stop();
    }
}

pub fn shutdown_server(state: &Mutex<ServerState>) {
    if let Ok(mut guard) = state.lock() {
        guard.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn health_identity_cannot_adopt_personal_or_previous_session_servers() {
        let identity = Identity {
            instance: "this-launch".into(),
            token: "private".into(),
            environment: "qa".into(),
            qa_session: "this-session".into(),
        };
        let mut health = HealthResponse {
            status: "ok".into(),
            app: "slate-server".into(),
            owner: "tauri".into(),
            env: "prod".into(),
            instance_id: "".into(),
            qa_session: "".into(),
        };
        assert!(!identity.owns(&health));
        health.env = "qa".into();
        health.qa_session = "previous-session".into();
        health.instance_id = "previous-launch".into();
        assert!(!identity.owns(&health));
        health.qa_session = identity.qa_session.clone();
        health.instance_id = identity.instance.clone();
        assert!(identity.owns(&health));
        health.owner = "standalone".into();
        assert!(!identity.owns(&health));
    }

    #[test]
    fn occupied_port_is_refused_without_contacting_its_process() {
        // Use the real startup guard only if the port can be safely reserved by this test.
        if let Ok(_listener) = std::net::TcpListener::bind("127.0.0.1:8000") {
            assert!(ensure_port_free().unwrap_err().contains("occupied"));
        }
    }
}
