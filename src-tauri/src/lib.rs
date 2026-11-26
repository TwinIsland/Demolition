/// The desktop shell: one window that serves the bundled web build. The game itself needs no
/// native commands, so nothing is exposed to the page beyond Tauri's defaults.
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Demolition window");
}
