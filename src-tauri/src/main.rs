// Keeps a console window from opening next to the game on Windows release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    demolition_lib::run();
}
