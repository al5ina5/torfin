use std::path::PathBuf;
use std::process::{Command, Stdio};

const USER_AGENT: &str = "Torfin/1.0.0-beta";

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct NativePlayerResult {
    player: String,
    mode: String,
}

#[tauri::command]
pub(crate) fn supports_native_player() -> bool {
    cfg!(target_os = "macos")
}

#[tauri::command]
pub(crate) fn open_native_player(url: String, title: Option<String>) -> Result<NativePlayerResult, String> {
    #[cfg(target_os = "macos")]
    {
        let label = title
            .filter(|value| !value.trim().is_empty())
            .unwrap_or_else(|| "Torfin".to_string());
        open_native_player_macos(&url, &label)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = url;
        let _ = title;
        Err("Native player is only available in the macOS desktop app.".to_string())
    }
}

#[cfg(target_os = "macos")]
fn open_native_player_macos(url: &str, title: &str) -> Result<NativePlayerResult, String> {
    if url.starts_with("http://") || url.starts_with("https://") {
        if let Ok(result) = open_avplayer_window(url, title) {
            return Ok(result);
        }
    }

    launch_external_player(url, title)
}

#[cfg(target_os = "macos")]
fn launch_external_player(url: &str, title: &str) -> Result<NativePlayerResult, String> {
    for candidate in external_player_candidates() {
        if try_launch_external(&candidate, url, title).is_ok() {
            return Ok(NativePlayerResult {
                player: candidate.label.to_string(),
                mode: "external".to_string(),
            });
        }
    }

    Err(
        "No native player found. Install IINA (https://iina.io) or run: brew install mpv"
            .to_string(),
    )
}

#[cfg(target_os = "macos")]
struct ExternalPlayer {
    command: PathBuf,
    label: &'static str,
    build_args: fn(&str, &str) -> Vec<String>,
}

#[cfg(target_os = "macos")]
fn external_player_candidates() -> Vec<ExternalPlayer> {
    let mut players = Vec::new();

    if let Some(path) = find_in_path("mpv") {
        players.push(ExternalPlayer {
            command: path,
            label: "mpv",
            build_args: |url, title| {
                vec![
                    "--force-window=immediate".to_string(),
                    format!("--title={title}"),
                    format!("--user-agent={USER_AGENT}"),
                    url.to_string(),
                ]
            },
        });
    }

    let iina = PathBuf::from("/Applications/IINA.app/Contents/MacOS/iina-cli");
    if iina.is_file() {
        players.push(ExternalPlayer {
            command: iina,
            label: "IINA",
            build_args: |url, title| {
                vec![
                    "--mpv-force-media-title".to_string(),
                    title.to_string(),
                    format!("--mpv-user-agent={USER_AGENT}"),
                    url.to_string(),
                ]
            },
        });
    }

    let vlc = PathBuf::from("/Applications/VLC.app/Contents/MacOS/VLC");
    if vlc.is_file() {
        players.push(ExternalPlayer {
            command: vlc,
            label: "VLC",
            build_args: |url, title| {
                vec![
                    "--meta-title".to_string(),
                    title.to_string(),
                    format!("--http-user-agent={USER_AGENT}"),
                    url.to_string(),
                ]
            },
        });
    }

    players
}

#[cfg(target_os = "macos")]
fn find_in_path(command: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    std::env::split_paths(&path_var).find_map(|dir| {
        let candidate = dir.join(command);
        if candidate.is_file() {
            Some(candidate)
        } else {
            None
        }
    })
}

#[cfg(target_os = "macos")]
fn try_launch_external(player: &ExternalPlayer, url: &str, title: &str) -> Result<(), String> {
    let args = (player.build_args)(url, title);
    Command::new(&player.command)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not launch {}: {error}", player.label))?;
    Ok(())
}

#[repr(C)]
struct CGPoint {
    x: f64,
    y: f64,
}

#[repr(C)]
struct CGSize {
    width: f64,
    height: f64,
}

#[repr(C)]
struct CGRect {
    origin: CGPoint,
    size: CGSize,
}

#[cfg(target_os = "macos")]
fn open_avplayer_window(url: &str, title: &str) -> Result<NativePlayerResult, String> {
    if !should_try_avplayer(url) {
        return Err("AVPlayer is not preferred for this format.".to_string());
    }

    unsafe {
        use objc::{class, msg_send, sel, sel_impl};
        use std::ffi::CString;

        let c_url = CString::new(url).map_err(|error| error.to_string())?;
        let c_title = CString::new(title).map_err(|error| error.to_string())?;

        let ns_url_string: *mut objc::runtime::Object =
            msg_send![class!(NSString), stringWithUTF8String: c_url.as_ptr()];
        if ns_url_string.is_null() {
            return Err("Invalid playback URL.".to_string());
        }

        let ns_url: *mut objc::runtime::Object =
            msg_send![class!(NSURL), URLWithString: ns_url_string];
        if ns_url.is_null() {
            return Err("AVPlayer could not open this URL.".to_string());
        }

        let asset: *mut objc::runtime::Object =
            msg_send![class!(AVURLAsset), URLAssetWithURL: ns_url options: std::ptr::null::<objc::runtime::Object>()];
        let item: *mut objc::runtime::Object =
            msg_send![class!(AVPlayerItem), playerItemWithAsset: asset];
        let player: *mut objc::runtime::Object =
            msg_send![class!(AVPlayer), playerWithPlayerItem: item];

        let player_view: *mut objc::runtime::Object = msg_send![class!(AVPlayerView), new];
        let _: () = msg_send![player_view, setPlayer: player];
        // AVPlayerViewControlsStyleInline
        let _: () = msg_send![player_view, setControlsStyle: 1_i64];

        let frame = CGRect {
            origin: CGPoint { x: 0.0, y: 0.0 },
            size: CGSize {
                width: 960.0,
                height: 540.0,
            },
        };

        let window: *mut objc::runtime::Object = msg_send![class!(NSWindow), alloc];
        // NSTitledWindowMask | NSClosableWindowMask | NSMiniaturizableWindowMask | NSResizableWindowMask
        let window: *mut objc::runtime::Object =
            msg_send![window, initWithContentRect: frame styleMask: 15_u64 backing: 2_i64 defer: false];
        let title_string: *mut objc::runtime::Object =
            msg_send![class!(NSString), stringWithUTF8String: c_title.as_ptr()];
        let _: () = msg_send![window, setTitle: title_string];
        let _: () = msg_send![window, setContentView: player_view];
        let _: () = msg_send![window, center];
        let _: () = msg_send![window, makeKeyAndOrderFront: std::ptr::null::<objc::runtime::Object>()];
        let _: () = msg_send![player, play];

        retain_native_window(window);
    }

    Ok(NativePlayerResult {
        player: "AVPlayer".to_string(),
        mode: "window".to_string(),
    })
}

#[cfg(target_os = "macos")]
fn should_try_avplayer(url: &str) -> bool {
    let lower = url.to_lowercase();
    lower.contains(".m3u8")
        || lower.contains(".mp4")
        || lower.contains(".m4v")
        || lower.contains(".mov")
}

#[cfg(target_os = "macos")]
fn retain_native_window(window: *mut objc::runtime::Object) {
    use std::sync::Mutex;

    static WINDOWS: std::sync::OnceLock<Mutex<Vec<u64>>> = std::sync::OnceLock::new();
    let windows = WINDOWS.get_or_init(|| Mutex::new(Vec::new()));
    if let Ok(mut guard) = windows.lock() {
        guard.push(window as u64);
    }
}
