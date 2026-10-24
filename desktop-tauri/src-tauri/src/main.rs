#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io;
use std::sync::atomic::{AtomicU64, Ordering};
use tauri::webview::{
    NewWindowResponse, PermissionKind, PermissionResponse, WebviewWindowBuilder,
};
use tauri::{AppHandle, Url, WebviewUrl};

const DISCORD_HOSTS: &[&str] = &[
    "discord.com",
    "discord.gg",
    "discordapp.com",
    "discordapp.net",
];
const IDENTITY_HOSTS: &[&str] = &[
    "accounts.google.com",
    "appleid.apple.com",
    "github.com",
    "id.twitch.tv",
    "login.live.com",
    "login.microsoftonline.com",
    "steamcommunity.com",
    "accounts.spotify.com",
    "epicgames.com",
    "xbox.com",
];
static POPUP_ID: AtomicU64 = AtomicU64::new(1);
const LEAN_SCRIPT: &str = include_str!("../../lean-mode.js");

fn host_matches(host: &str, domains: &[&str]) -> bool {
    let host = host.to_ascii_lowercase();
    domains.iter().any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

fn is_discord_host(host: &str) -> bool {
    host_matches(host, DISCORD_HOSTS)
}

fn is_trusted_url(url: &Url) -> bool {
    if url.scheme() != "https" {
        return false;
    }
    let host = match url.host_str() {
        Some(host) => host,
        None => return false,
    };
    is_discord_host(host) || host_matches(host, IDENTITY_HOSTS)
}

fn open_external(app: &AppHandle, url: &Url) {
    use tauri_plugin_opener::OpenerExt;

    if !matches!(url.scheme(), "https" | "http" | "mailto") {
        return;
    }
    if let Err(error) = app.opener().open_url(url.as_str(), None::<&str>) {
        eprintln!("SweetCord could not open external link: {error}");
    }
}

fn permission_response(webview: &tauri::Webview<tauri::Wry>, kind: PermissionKind) -> PermissionResponse {
    let trusted_origin = webview
        .url()
        .ok()
        .and_then(|url| url.host_str().map(str::to_owned))
        .map(|host| is_discord_host(&host))
        .unwrap_or(false);

    if !trusted_origin {
        return PermissionResponse::Deny;
    }

    match kind {
        PermissionKind::Microphone
        | PermissionKind::Camera
        | PermissionKind::DisplayCapture
        | PermissionKind::Notifications
        | PermissionKind::Autoplay => PermissionResponse::Default,
        _ => PermissionResponse::Deny,
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = app
                .config()
                .app
                .windows
                .iter()
                .find(|window| window.label == "main")
                .cloned()
                .ok_or_else(|| io::Error::new(io::ErrorKind::NotFound, "missing Tauri main-window configuration"))?;

            let navigation_handle = app.handle().clone();
            let popup_handle = app.handle().clone();

            WebviewWindowBuilder::from_config(app.handle(), &config)?
                .background_throttling(true)
                .devtools(cfg!(debug_assertions))
                .initialization_script(LEAN_SCRIPT)
                .on_navigation(move |url| {
                    if is_trusted_url(url) {
                        true
                    } else {
                        open_external(&navigation_handle, url);
                        false
                    }
                })
                .on_new_window(move |url, features| {
                    if !is_trusted_url(&url) {
                        open_external(&popup_handle, &url);
                        return NewWindowResponse::Deny;
                    }

                    let label = format!("trusted-popup-{}", POPUP_ID.fetch_add(1, Ordering::Relaxed));
                    let child_navigation_handle = popup_handle.clone();
                    let child = WebviewWindowBuilder::new(
                        &popup_handle,
                        label,
                        WebviewUrl::External(url.clone()),
                    )
                    .title("SweetCord")
                    .window_features(features)
                    .initialization_script(LEAN_SCRIPT)
                    .on_navigation(move |next_url| {
                        if is_trusted_url(next_url) {
                            true
                        } else {
                            open_external(&child_navigation_handle, next_url);
                            false
                        }
                    })
                    .on_permission_request(permission_response)
                    .build();

                    match child {
                        Ok(window) => NewWindowResponse::Create { window },
                        Err(error) => {
                            eprintln!("SweetCord could not create trusted popup: {error}");
                            NewWindowResponse::Deny
                        }
                    }
                })
                .on_permission_request(permission_response)
                .build()?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SweetCord Tauri preview");
}
