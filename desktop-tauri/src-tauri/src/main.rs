#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io;
use tauri::webview::{
    NewWindowResponse, PermissionKind, PermissionResponse, Webview, WebviewWindowBuilder,
};
use tauri::{AppHandle, Url};

#[cfg(windows)]
use webview2_com::{
    Microsoft::Web::WebView2::Win32::{
        ICoreWebView2_2, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE, COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA,
    },
    WebResourceRequestedEventHandler,
};
#[cfg(windows)]
use windows::{
    core::{HSTRING, Interface, PCWSTR, PWSTR},
    Win32::System::Com::CoTaskMemFree,
};

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
const LEAN_SCRIPT: &str = include_str!("../../lean-mode.js");
const VISUAL_MEDIA_EXTENSIONS: &[&str] = &[
    ".gif", ".gifv", ".mp4", ".m4v", ".mov", ".webm", ".ogv", ".avi", ".mkv",
    ".3gp", ".m3u8", ".mpd",
];
const AUTH_PATHS: &[&str] = &[
    "/login", "/register", "/oauth2", "/verify", "/email-verification",
    "/reset-password", "/logout",
];

fn host_matches(host: &str, domains: &[&str]) -> bool {
    let host = host.to_ascii_lowercase();
    domains.iter().any(|domain| host == *domain || host.ends_with(&format!(".{domain}")))
}

fn is_discord_host(host: &str) -> bool {
    host_matches(host, DISCORD_HOSTS)
}

fn is_auth_path(path: &str) -> bool {
    AUTH_PATHS.iter().any(|prefix| path == *prefix || path.starts_with(&format!("{prefix}/")))
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

fn is_likely_visual_media_asset(raw_url: &str) -> bool {
    let url = match Url::parse(raw_url) {
        Ok(url) => url,
        Err(_) => return false,
    };
    let path = url.path().to_ascii_lowercase();
    VISUAL_MEDIA_EXTENSIONS.iter().any(|extension| path.ends_with(extension))
}

/// Extreme Lite blocks images, but only blocks media when its URL clearly identifies
/// visual content. Unknown media URLs are deliberately allowed to protect voice audio.
fn should_block_resource(is_image: bool, is_media: bool, request_url: &str, current_url: &str) -> bool {
    let active = match Url::parse(current_url) {
        Ok(url) => url,
        Err(_) => return false,
    };
    if active.scheme() != "https"
        || !active.host_str().map(is_discord_host).unwrap_or(false)
        || is_auth_path(active.path())
    {
        return false;
    }

    if is_image {
        return true;
    }
    is_media && is_likely_visual_media_asset(request_url)
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

fn permission_response(webview: Webview<tauri::Wry>, kind: PermissionKind) -> PermissionResponse {
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
        | PermissionKind::Notifications
        | PermissionKind::Autoplay => PermissionResponse::Default,
        PermissionKind::Camera | PermissionKind::DisplayCapture => PermissionResponse::Deny,
        _ => PermissionResponse::Deny,
    }
}

#[cfg(windows)]
unsafe fn take_pwstr_string(value: PWSTR) -> String {
    if value.0.is_null() {
        return String::new();
    }
    let string = value.to_string().unwrap_or_default();
    CoTaskMemFree(Some(value.0 as _));
    string
}

#[cfg(windows)]
fn install_webview2_resource_filter(platform_webview: tauri::webview::PlatformWebview) -> windows::core::Result<()> {
    unsafe {
        let core = platform_webview.controller().CoreWebView2()?;
        let core_v2: ICoreWebView2_2 = core.cast()?;
        let environment = core_v2.Environment()?;
        let image_filter = HSTRING::from("https://*/*");
        let media_filter = HSTRING::from("https://*/*");

        core_v2.AddWebResourceRequestedFilter(
            PCWSTR(image_filter.as_wide().as_ptr()),
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE,
        )?;
        core_v2.AddWebResourceRequestedFilter(
            PCWSTR(media_filter.as_wide().as_ptr()),
            COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA,
        )?;

        let current_core = core.clone();
        let no_content_reason = HSTRING::from("No Content");
        let no_content_headers = HSTRING::from("Content-Length: 0\r\n");
        let handler = WebResourceRequestedEventHandler::create(Box::new(move |_sender, args| unsafe {
            let Some(args) = args else {
                return Ok(());
            };

            let mut resource_context = COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE;
            if args.ResourceContext(&mut resource_context).is_err() {
                return Ok(());
            }
            if resource_context != COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE
                && resource_context != COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA
            {
                return Ok(());
            }

            let request = match args.Request() {
                Ok(request) => request,
                Err(_) => return Ok(()),
            };
            let mut requested_uri = PWSTR::null();
            if request.Uri(&mut requested_uri).is_err() {
                return Ok(());
            }
            let request_url = unsafe { take_pwstr_string(requested_uri) };

            let mut active_uri = PWSTR::null();
            if current_core.Source(&mut active_uri).is_err() {
                return Ok(());
            }
            let current_url = unsafe { take_pwstr_string(active_uri) };

            let is_image = resource_context == COREWEBVIEW2_WEB_RESOURCE_CONTEXT_IMAGE;
            let is_media = resource_context == COREWEBVIEW2_WEB_RESOURCE_CONTEXT_MEDIA;
            if should_block_resource(is_image, is_media, &request_url, &current_url) {
                // WebView2 does not expose a simple Cancel flag here; respond with an
                // empty 204 response so the visual resource body is never downloaded.
                let response = environment.CreateWebResourceResponse(
                    None,
                    204,
                    PCWSTR(no_content_reason.as_wide().as_ptr()),
                    PCWSTR(no_content_headers.as_wide().as_ptr()),
                )?;
                args.SetResponse(&response)?;
            }
            Ok(())
        }));

        let mut token = Default::default();
        core_v2.add_WebResourceRequested(&handler, &mut token)?;
        Ok(())
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

            let main_window = WebviewWindowBuilder::from_config(app.handle(), &config)?
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
                .on_new_window(move |url, _features| {
                    if is_trusted_url(&url) {
                        // Keep WebView2's default popup behavior; constructing a native
                        // child view synchronously here can deadlock on Windows.
                        NewWindowResponse::Allow
                    } else {
                        open_external(&popup_handle, &url);
                        NewWindowResponse::Deny
                    }
                })
                .on_permission_request(permission_response)
                .build()?;

            #[cfg(windows)]
            main_window.with_webview(|platform_webview| {
                if let Err(error) = install_webview2_resource_filter(platform_webview) {
                    eprintln!("SweetCord WebView2 resource filter could not be installed: {error}");
                }
            })?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running SweetCord Tauri preview");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trusted_host_matching_rejects_suffix_spoofing() {
        assert!(host_matches("discord.com", DISCORD_HOSTS));
        assert!(host_matches("cdn.discord.com", DISCORD_HOSTS));
        assert!(!host_matches("evil-discord.com", DISCORD_HOSTS));
        assert!(!host_matches("discord.com.evil.example", DISCORD_HOSTS));
    }

    #[test]
    fn internal_navigation_requires_https_and_an_allowlisted_host() {
        assert!(is_trusted_url(&Url::parse("https://discord.com/app").unwrap()));
        assert!(is_trusted_url(&Url::parse("https://accounts.google.com/").unwrap()));
        assert!(!is_trusted_url(&Url::parse("http://discord.com/app").unwrap()));
        assert!(!is_trusted_url(&Url::parse("https://discord.com.evil.example/").unwrap()));
        assert!(!is_trusted_url(&Url::parse("https://example.com/").unwrap()));
    }

    #[test]
    fn extreme_lite_blocks_images_only_on_discord_app_routes() {
        assert!(should_block_resource(
            true, false, "https://cdn.discordapp.com/avatars/1/x.png",
            "https://discord.com/channels/@me"
        ));
        assert!(!should_block_resource(
            true, false, "https://cdn.discordapp.com/login.png",
            "https://discord.com/login"
        ));
        assert!(!should_block_resource(
            true, false, "https://cdn.discordapp.com/avatars/1/x.png",
            "https://example.com/"
        ));
    }

    #[test]
    fn recognized_video_is_blocked_but_ambiguous_media_is_allowed() {
        assert!(is_likely_visual_media_asset("https://cdn.discordapp.com/clip.mp4?token=abc"));
        assert!(should_block_resource(
            false, true, "https://cdn.discordapp.com/clip.webm",
            "https://discord.com/channels/@me"
        ));
        assert!(!should_block_resource(
            false, true, "https://media.discordapp.net/voice",
            "https://discord.com/channels/@me"
        ));
        assert!(!is_likely_visual_media_asset("https://cdn.discordapp.com/voice.ogg"));
    }
}
