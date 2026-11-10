use std::{fs::File, io::Read};

use tauri::WebviewWindow;
use tauri_plugin_dialog::DialogExt;

// Keep in sync with the portable profile limit on the server.
const MAX_PROFILE_BYTES: usize = 1024 * 1024;

#[tauri::command]
pub async fn open_profile_file(window: WebviewWindow) -> Result<Option<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = window
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Import Profile")
            .add_filter("Slate profile JSON", &["json"])
            .blocking_pick_file()
        else {
            return Ok(None);
        };

        let path = file.into_path().map_err(|error| error.to_string())?;
        let mut bytes = Vec::new();
        File::open(path)
            .and_then(|file| {
                file.take((MAX_PROFILE_BYTES + 1) as u64)
                    .read_to_end(&mut bytes)
            })
            .map_err(|error| format!("Could not read the profile file. {error}"))?;
        if bytes.len() > MAX_PROFILE_BYTES {
            return Err("Slate profile files must be 1 MiB or smaller.".into());
        }
        String::from_utf8(bytes)
            .map(Some)
            .map_err(|_| "Choose a UTF-8 Slate profile JSON file.".into())
    })
    .await
    .map_err(|error| format!("Could not open the profile file. {error}"))?
}

#[tauri::command]
pub async fn save_profile_file(
    window: WebviewWindow,
    suggested_name: String,
    contents: String,
) -> Result<bool, String> {
    if contents.len() > MAX_PROFILE_BYTES {
        return Err("Slate profile files must be 1 MiB or smaller.".into());
    }
    tauri::async_runtime::spawn_blocking(move || {
        let Some(file) = window
            .dialog()
            .file()
            .set_parent(&window)
            .set_title("Export Profile")
            .set_file_name(suggested_name)
            .add_filter("Slate profile JSON", &["json"])
            .blocking_save_file()
        else {
            return Ok(false);
        };

        let path = file.into_path().map_err(|error| error.to_string())?;
        std::fs::write(path, contents)
            .map_err(|error| format!("Could not save the profile file. {error}"))?;
        Ok(true)
    })
    .await
    .map_err(|error| format!("Could not save the profile file. {error}"))?
}
