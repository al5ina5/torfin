static ACTIVE_TRANSCODER: std::sync::OnceLock<std::sync::Mutex<Option<std::process::Child>>> =
    std::sync::OnceLock::new();

const PROXY_USER_AGENT: &str = "Torfin/1.0.0-beta";
const TRANSCODE_ATTEMPTS: usize = 3;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaTrack {
    index: i64,
    kind: String,
    label: String,
    language: Option<String>,
    codec: Option<String>,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MediaInfo {
    duration: Option<f64>,
    format_name: Option<String>,
    video_codec: Option<String>,
    audio_codecs: Vec<String>,
    audio_tracks: Vec<MediaTrack>,
    subtitle_tracks: Vec<MediaTrack>,
}

#[tauri::command]
pub(crate) async fn start_hls_transcode(
    url: String,
    audio_stream_index: Option<i64>,
    subtitle_stream_index: Option<i64>,
) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        start_hls_transcode_inner(url, audio_stream_index, subtitle_stream_index)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn start_hls_transcode_inner(
    url: String,
    audio_stream_index: Option<i64>,
    subtitle_stream_index: Option<i64>,
) -> Result<String, String> {
    let mut last_error = None;
    for attempt in 1..=TRANSCODE_ATTEMPTS {
        match start_hls_transcode_attempt(&url, audio_stream_index, subtitle_stream_index) {
            Ok(result) => return Ok(result),
            Err(error) => {
                let retriable = is_retriable_transcode_error(&error);
                last_error = Some(error);
                if !retriable || attempt == TRANSCODE_ATTEMPTS {
                    break;
                }
                std::thread::sleep(std::time::Duration::from_millis((attempt as u64) * 1000));
            }
        }
    }

    Err(last_error.unwrap_or_else(|| "Could not start transcoded playback.".to_string()))
}

fn start_hls_transcode_attempt(
    url: &str,
    audio_stream_index: Option<i64>,
    subtitle_stream_index: Option<i64>,
) -> Result<String, String> {
    stop_active_transcoder();

    let ffmpeg = find_ffmpeg().ok_or_else(|| {
        "Install ffmpeg to play this video type. Homebrew: brew install ffmpeg".to_string()
    })?;
    let source = reqwest::Url::parse(url).map_err(|error| error.to_string())?;

    if source.scheme() != "https" && source.scheme() != "http" && source.scheme() != "file" {
        return Err("Only HTTP, HTTPS, and file URLs can be transcoded.".to_string());
    }

    let session_dir = std::env::temp_dir().join(format!(
        "torfin-hls-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis()
    ));
    std::fs::create_dir_all(&session_dir).map_err(|error| error.to_string())?;

    let playlist = session_dir.join("playlist.m3u8");
    let first_segment = session_dir.join("segment_00000.ts");
    let segment_pattern = session_dir.join("segment_%05d.ts");
    let stderr_log = session_dir.join("ffmpeg.log");
    let stderr_file = std::fs::File::create(&stderr_log).map_err(|error| error.to_string())?;
    let server_url = start_hls_file_server(session_dir.clone())?;

    let input_url = url.to_string();

    let mut command = std::process::Command::new(ffmpeg);
    let mut args = vec![
        "-hide_banner".to_string(),
        "-loglevel".to_string(),
        "level+warning".to_string(),
        "-nostdin".to_string(),
    ];

    if source.scheme() == "http" || source.scheme() == "https" {
        args.extend(ffmpeg_http_input_args());
    }

    args.extend([
        "-probesize".to_string(),
        "10000000".to_string(),
        "-analyzeduration".to_string(),
        "10000000".to_string(),
        "-fflags".to_string(),
        "+genpts+discardcorrupt".to_string(),
        "-i".to_string(),
        input_url,
        "-map".to_string(),
        "0:v:0".to_string(),
    ]);

    let selected_audio = audio_stream_index
        .map(|index| format!("0:{index}"))
        .unwrap_or_else(|| "0:a:0?".to_string());
    args.extend(["-map".to_string(), selected_audio]);

    if let Some(subtitle_index) = subtitle_stream_index {
        args.extend(["-map".to_string(), format!("0:{subtitle_index}")]);
    } else {
        args.push("-sn".to_string());
    }

    args.extend([
        "-dn".to_string(),
        "-max_muxing_queue_size".to_string(),
        "1024".to_string(),
        "-c:v".to_string(),
        "libx264".to_string(),
        "-preset".to_string(),
        "ultrafast".to_string(),
        "-crf".to_string(),
        "24".to_string(),
        "-pix_fmt".to_string(),
        "yuv420p".to_string(),
        "-c:a".to_string(),
        "aac".to_string(),
        "-b:a".to_string(),
        "160k".to_string(),
        "-ac".to_string(),
        "2".to_string(),
    ]);

    if subtitle_stream_index.is_some() {
        args.extend(["-c:s".to_string(), "webvtt".to_string()]);
    }

    args.extend([
        "-f".to_string(),
        "hls".to_string(),
        "-hls_time".to_string(),
        "2".to_string(),
        "-hls_init_time".to_string(),
        "1".to_string(),
        "-hls_list_size".to_string(),
        "0".to_string(),
        "-hls_playlist_type".to_string(),
        "vod".to_string(),
        "-hls_flags".to_string(),
        "independent_segments".to_string(),
        "-hls_segment_filename".to_string(),
        segment_pattern
            .to_str()
            .ok_or_else(|| "Invalid segment path.".to_string())?
            .to_string(),
        playlist
            .to_str()
            .ok_or_else(|| "Invalid playlist path.".to_string())?
            .to_string(),
    ]);

    command.args(args);

    let child = command
        .stderr(stderr_file)
        .spawn()
        .map_err(|error| error.to_string())?;
    *ACTIVE_TRANSCODER
        .get_or_init(|| std::sync::Mutex::new(None))
        .lock()
        .map_err(|_| "Could not lock transcoder state.".to_string())? = Some(child);

    let wait_result = {
        let active = ACTIVE_TRANSCODER
            .get()
            .ok_or_else(|| "Transcoder state is unavailable.".to_string())?;
        let mut guard = active
            .lock()
            .map_err(|_| "Could not lock transcoder state.".to_string())?;
        let child = guard
            .as_mut()
            .ok_or_else(|| "Transcoder process is unavailable.".to_string())?;
        wait_for_playlist(&playlist, &first_segment, &stderr_log, child)
    };
    if wait_result.is_err() {
        stop_active_transcoder();
    }
    wait_result?;
    Ok(format!("{server_url}/playlist.m3u8"))
}

#[tauri::command]
pub(crate) async fn inspect_media(url: String) -> Result<MediaInfo, String> {
    tauri::async_runtime::spawn_blocking(move || inspect_media_inner(url))
        .await
        .map_err(|error| error.to_string())?
}

fn inspect_media_inner(url: String) -> Result<MediaInfo, String> {
    let ffprobe = find_ffprobe().ok_or_else(|| {
        "Install ffmpeg to inspect tracks. Homebrew: brew install ffmpeg".to_string()
    })?;
    let source = reqwest::Url::parse(&url).map_err(|error| error.to_string())?;

    if source.scheme() != "https" && source.scheme() != "http" && source.scheme() != "file" {
        return Err("Only HTTP, HTTPS, and file URLs can be inspected.".to_string());
    }

    let mut args = vec![
        "-v".to_string(),
        "error".to_string(),
        "-print_format".to_string(),
        "json".to_string(),
        "-show_entries".to_string(),
        "format=duration,format_name:stream=index,codec_type,codec_name:stream_tags=language,title".to_string(),
    ];

    if source.scheme() == "http" || source.scheme() == "https" {
        args.extend(ffmpeg_http_input_args());
    }

    args.extend(["-i".to_string(), source.to_string()]);

    let output = std::process::Command::new(ffprobe)
        .args(args)
        .output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).trim().to_string());
    }

    let body: serde_json::Value =
        serde_json::from_slice(&output.stdout).map_err(|error| error.to_string())?;
    let duration = body
        .get("format")
        .and_then(|format| format.get("duration"))
        .and_then(|value| value.as_str())
        .and_then(|value| value.parse::<f64>().ok())
        .filter(|value| value.is_finite() && *value > 0.0);
    let format_name = body
        .get("format")
        .and_then(|format| format.get("format_name"))
        .and_then(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .map(ToString::to_string);

    let mut video_codec = None;
    let mut audio_codecs = Vec::new();
    let mut audio_tracks = Vec::new();
    let mut subtitle_tracks = Vec::new();

    if let Some(streams) = body.get("streams").and_then(|value| value.as_array()) {
        for stream in streams {
            let Some(index) = stream.get("index").and_then(json_to_i64) else {
                continue;
            };
            let codec_type = stream
                .get("codec_type")
                .and_then(|value| value.as_str())
                .unwrap_or("");
            if codec_type != "video" && codec_type != "audio" && codec_type != "subtitle" {
                continue;
            }

            let codec = stream
                .get("codec_name")
                .and_then(|value| value.as_str())
                .map(ToString::to_string);
            if codec_type == "video" {
                if video_codec.is_none() {
                    video_codec = codec;
                }
                continue;
            }
            let tags = stream.get("tags").unwrap_or(&serde_json::Value::Null);
            let language = tags
                .get("language")
                .and_then(|value| value.as_str())
                .filter(|value| !value.trim().is_empty())
                .map(ToString::to_string);
            let title = tags
                .get("title")
                .and_then(|value| value.as_str())
                .filter(|value| !value.trim().is_empty());
            let fallback = if codec_type == "audio" {
                format!("Audio {}", audio_tracks.len() + 1)
            } else {
                format!("Subtitles {}", subtitle_tracks.len() + 1)
            };
            let label = title
                .map(ToString::to_string)
                .or_else(|| language.clone())
                .unwrap_or(fallback);
            let track = MediaTrack {
                index,
                kind: codec_type.to_string(),
                label,
                language,
                codec,
            };

            if codec_type == "audio" {
                if let Some(codec) = track.codec.as_deref() {
                    if !audio_codecs.iter().any(|value| value == codec) {
                        audio_codecs.push(codec.to_string());
                    }
                }
                audio_tracks.push(track);
            } else {
                subtitle_tracks.push(track);
            }
        }
    }

    Ok(MediaInfo {
        duration,
        format_name,
        video_codec,
        audio_codecs,
        audio_tracks,
        subtitle_tracks,
    })
}

fn stop_active_transcoder() {
    let Some(active) = ACTIVE_TRANSCODER.get() else {
        return;
    };

    if let Ok(mut child) = active.lock() {
        if let Some(mut process) = child.take() {
            let _ = process.kill();
            let _ = process.wait();
        }
    }
}

fn find_ffmpeg() -> Option<std::path::PathBuf> {
    [
        "/opt/homebrew/bin/ffmpeg",
        "/usr/local/bin/ffmpeg",
        "/usr/bin/ffmpeg",
        "ffmpeg",
    ]
    .iter()
    .map(std::path::PathBuf::from)
    .find(|path| {
        if path.is_absolute() {
            path.exists()
        } else {
            std::process::Command::new(path)
                .arg("-version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
    })
}

fn find_ffprobe() -> Option<std::path::PathBuf> {
    [
        "/opt/homebrew/bin/ffprobe",
        "/usr/local/bin/ffprobe",
        "/usr/bin/ffprobe",
        "ffprobe",
    ]
    .iter()
    .map(std::path::PathBuf::from)
    .find(|path| {
        if path.is_absolute() {
            path.exists()
        } else {
            std::process::Command::new(path)
                .arg("-version")
                .output()
                .map(|output| output.status.success())
                .unwrap_or(false)
        }
    })
}

fn start_hls_file_server(root: std::path::PathBuf) -> Result<String, String> {
    let server = tiny_http::Server::http("127.0.0.1:0")
        .map_err(|error| format!("HLS server failed: {error}"))?;
    let address = match server.server_addr() {
        tiny_http::ListenAddr::IP(address) => format!("http://{}", address),
        other => return Err(format!("Unsupported HLS server address: {other:?}")),
    };

    std::thread::spawn(move || {
        for request in server.incoming_requests() {
            let request_path = request
                .url()
                .trim_start_matches('/')
                .split('?')
                .next()
                .unwrap_or("");
            let request_path = if request_path.is_empty() {
                "playlist.m3u8"
            } else {
                request_path
            };

            if request_path.contains("..") {
                let _ = request.respond(tiny_http::Response::empty(403));
                continue;
            }

            let file_path = root.join(request_path);
            let Ok(file) = std::fs::File::open(&file_path) else {
                let _ = request.respond(tiny_http::Response::empty(404));
                continue;
            };

            let content_type = if request_path.ends_with(".m3u8") {
                "application/vnd.apple.mpegurl"
            } else if request_path.ends_with(".ts") {
                "video/mp2t"
            } else {
                "application/octet-stream"
            };

            let response = tiny_http::Response::from_file(file)
                .with_header(tiny_http::Header::from_bytes("Content-Type", content_type).unwrap())
                .with_header(
                    tiny_http::Header::from_bytes("Access-Control-Allow-Origin", "*").unwrap(),
                );
            let _ = request.respond(response);
        }
    });

    Ok(address)
}

fn ffmpeg_http_input_args() -> Vec<String> {
    [
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_on_network_error",
        "1",
        "-reconnect_on_http_error",
        "403,404,429,500,502,503,504",
        "-reconnect_delay_max",
        "10",
        "-multiple_requests",
        "1",
        "-seekable",
        "0",
        "-timeout",
        "30000000",
        "-rw_timeout",
        "30000000",
        "-user_agent",
        PROXY_USER_AGENT,
    ]
    .into_iter()
    .map(ToString::to_string)
    .collect()
}

fn is_retriable_transcode_error(error: &str) -> bool {
    error.contains("FFmpeg exited before the stream was ready")
        || error.contains("did not produce a playable stream in time")
        || error.contains("Error opening input")
        || error.contains("Connection reset")
        || error.contains("HTTP error")
}

fn is_playlist_ready(playlist: &std::path::Path, first_segment: &std::path::Path) -> bool {
    if let Ok(contents) = std::fs::read_to_string(playlist) {
        if contents.contains("#EXTINF") {
            return true;
        }
    }
    first_segment.exists()
}

fn ffmpeg_stderr_details(stderr_log: &std::path::Path) -> String {
    std::fs::read_to_string(stderr_log)
        .ok()
        .map(|text| {
            text.lines()
                .rev()
                .take(8)
                .collect::<Vec<_>>()
                .into_iter()
                .rev()
                .collect::<Vec<_>>()
                .join("\n")
        })
        .filter(|text| !text.trim().is_empty())
        .unwrap_or_else(|| "No ffmpeg output was captured.".to_string())
}

fn wait_for_playlist(
    playlist: &std::path::Path,
    first_segment: &std::path::Path,
    stderr_log: &std::path::Path,
    child: &mut std::process::Child,
) -> Result<(), String> {
    for _ in 0..480 {
        if let Ok(Some(status)) = child.try_wait() {
            if is_playlist_ready(playlist, first_segment) {
                return Ok(());
            }
            return Err(format!(
                "FFmpeg exited before the stream was ready (code {}).\n{}",
                status.code().unwrap_or(-1),
                ffmpeg_stderr_details(stderr_log)
            ));
        }

        if is_playlist_ready(playlist, first_segment) {
            return Ok(());
        }

        std::thread::sleep(std::time::Duration::from_millis(250));
    }

    Err(format!(
        "The transcoder did not produce a playable stream in time.\n{}",
        ffmpeg_stderr_details(stderr_log)
    ))
}

fn json_to_i64(value: &serde_json::Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|number| i64::try_from(number).ok()))
        .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
}
