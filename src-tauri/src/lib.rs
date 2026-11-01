use std::fs;
use std::path::PathBuf;

use tauri::menu::{CheckMenuItemBuilder, MenuBuilder, SubmenuBuilder};
use tauri::{Manager, Wry};
use tauri_plugin_window_state::StateFlags;

const ALWAYS_ON_TOP_ID: &str = "always-on-top";
const PREFS_FILE: &str = "prefs.json";

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct Prefs {
    #[serde(default = "default_always_on_top")]
    always_on_top: bool,
}

fn default_always_on_top() -> bool {
    true
}

fn prefs_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(PREFS_FILE))
}

fn load_prefs(app: &tauri::AppHandle) -> Prefs {
    let Some(path) = prefs_path(app) else {
        return Prefs {
            always_on_top: true,
        };
    };
    fs::read_to_string(path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or(Prefs {
            always_on_top: true,
        })
}

fn save_prefs(app: &tauri::AppHandle, prefs: &Prefs) {
    let Some(path) = prefs_path(app) else {
        return;
    };
    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string_pretty(prefs) {
        let _ = fs::write(path, json);
    }
}

fn apply_always_on_top(app: &tauri::AppHandle, enabled: bool) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_always_on_top(enabled);
    }
    save_prefs(
        app,
        &Prefs {
            always_on_top: enabled,
        },
    );
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        // Remember window size, position and maximized state between launches
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        )
        .setup(|app| {
            let prefs = load_prefs(app.handle());

            // First submenu becomes the app menu on macOS (About / Quit / Hide).
            let app_menu = SubmenuBuilder::new(app, "Nook Clock")
                .about(None)
                .separator()
                .hide()
                .hide_others()
                .show_all()
                .separator()
                .quit()
                .build()?;

            let edit_menu = SubmenuBuilder::new(app, "Edit")
                .undo()
                .redo()
                .separator()
                .cut()
                .copy()
                .paste()
                .select_all()
                .build()?;

            let always_on_top = CheckMenuItemBuilder::with_id(ALWAYS_ON_TOP_ID, "Always on Top")
                .checked(prefs.always_on_top)
                .accelerator("CmdOrCtrl+Shift+T")
                .build(app)?;

            let view_menu = SubmenuBuilder::new(app, "View")
                .item(&always_on_top)
                .build()?;

            let window_menu = SubmenuBuilder::new(app, "Window")
                .minimize()
                .maximize()
                .separator()
                .fullscreen()
                .build()?;

            let menu = MenuBuilder::new(app)
                .items(&[&app_menu, &edit_menu, &view_menu, &window_menu])
                .build()?;
            app.set_menu(menu)?;

            apply_always_on_top(app.handle(), prefs.always_on_top);

            // Keep a handle so the menu event can read the check state.
            app.manage(always_on_top);

            Ok(())
        })
        .on_menu_event(|app, event| {
            if event.id().as_ref() != ALWAYS_ON_TOP_ID {
                return;
            }
            let item = app.state::<tauri::menu::CheckMenuItem<Wry>>();
            let enabled = item.is_checked().unwrap_or(true);
            apply_always_on_top(app, enabled);
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
