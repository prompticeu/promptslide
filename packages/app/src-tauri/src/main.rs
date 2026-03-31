// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::process::Command;
use std::sync::Mutex;
use tauri::Manager;

struct ServerProcess(Mutex<Option<std::process::Child>>);

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(ServerProcess(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();

            // Spawn the promptslide backend (MCP + Vite dev server)
            std::thread::spawn(move || {
                let child = Command::new("node")
                    .args([
                        // Resolve the CLI entry point — assumes promptslide is installed
                        // In dev, we use the workspace symlink
                        "node_modules/.bin/promptslide",
                        "studio",
                        "--mcp",
                        "--transport=http",
                        "--html",
                        "--json",
                    ])
                    .current_dir(
                        dirs::home_dir()
                            .unwrap_or_default()
                            .join(".promptslide")
                            .join("decks"),
                    )
                    .stdout(std::process::Stdio::piped())
                    .stderr(std::process::Stdio::piped())
                    .spawn();

                match child {
                    Ok(mut process) => {
                        // Read stderr to detect when server is ready
                        if let Some(stderr) = process.stderr.take() {
                            use std::io::{BufRead, BufReader};
                            let reader = BufReader::new(stderr);
                            for line in reader.lines() {
                                if let Ok(line) = line {
                                    if line.starts_with("__PROMPTSLIDE_READY__") {
                                        let json_str = &line["__PROMPTSLIDE_READY__".len()..];
                                        if let Ok(info) =
                                            serde_json::from_str::<serde_json::Value>(json_str)
                                        {
                                            if let Some(dev_url) =
                                                info.get("devServer").and_then(|v| v.as_str())
                                            {
                                                // Navigate the main window to the dev server
                                                if let Some(window) =
                                                    handle.get_webview_window("main")
                                                {
                                                    let url: tauri::Url = dev_url.parse().unwrap();
                                                    let _ = window.navigate(url);
                                                }
                                            }
                                        }
                                        break;
                                    }
                                }
                            }
                        }

                        // Store the child process for cleanup
                        if let Ok(mut guard) = handle.state::<ServerProcess>().0.lock() {
                            *guard = Some(process);
                        }
                    }
                    Err(e) => {
                        eprintln!("Failed to start promptslide server: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                // Kill the server process when the window closes
                if let Ok(mut guard) = window.state::<ServerProcess>().0.lock() {
                    if let Some(ref mut child) = *guard {
                        let _ = child.kill();
                    }
                }
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
