use crate::torbox::extract_info_hash;

static REMOTE_DOWNLOADS: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashMap<String, RemoteDownloadMeta>>,
> = std::sync::OnceLock::new();

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct QBittorrentConfig {
    base_url: String,
    username: String,
    password: String,
    save_path: Option<String>,
    category: Option<String>,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadRequest {
    info_hash: Option<String>,
    magnet_url: Option<String>,
    direct_url: Option<String>,
    name: Option<String>,
    id: Option<String>,
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct DownloadStatus {
    id: String,
    hash: Option<String>,
    name: String,
    progress: f64,
    state: String,
    speed: i64,
    eta: i64,
    size: i64,
    downloaded: i64,
    save_path: Option<String>,
    target_path: Option<String>,
    partial_path: Option<String>,
    status_path: Option<String>,
    complete: bool,
}

#[derive(Clone)]
struct RemoteDownloadMeta {
    host: String,
    username: String,
    password: Option<String>,
    target_path: String,
    partial_path: String,
    status_path: String,
    size_path: String,
    total_size: i64,
    last_downloaded: i64,
    last_seen: std::time::Instant,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteDownloadConfig {
    host: String,
    username: String,
    password: Option<String>,
    save_path: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RemoteDownloadRequest {
    url: String,
    filename: String,
    folder_name: Option<String>,
    id: Option<String>,
}

#[tauri::command]
pub(crate) async fn start_remote_url_download(
    config: RemoteDownloadConfig,
    request: RemoteDownloadRequest,
) -> Result<DownloadStatus, String> {
    tauri::async_runtime::spawn_blocking(move || start_remote_url_download_inner(config, request))
        .await
        .map_err(|error| error.to_string())?
}

fn start_remote_url_download_inner(
    config: RemoteDownloadConfig,
    request: RemoteDownloadRequest,
) -> Result<DownloadStatus, String> {
    let url = normalize_remote_url(&request.url)?;
    let save_path = config.save_path.trim();
    if save_path.is_empty() {
        return Err("Choose the remote folder Jellyfin watches.".to_string());
    }

    let id = request
        .id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("remote-{}", stable_id(&url)));
    let filename = sanitize_filename(&request.filename);
    let target_dir = request
        .folder_name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(sanitize_filename)
        .map(|folder| format!("{}/{}", save_path.trim_end_matches('/'), folder))
        .unwrap_or_else(|| save_path.trim_end_matches('/').to_string());
    let target_path = format!("{target_dir}/{filename}");
    let partial_path = format!("{target_path}.part");
    let status_path = format!("{target_path}.torfin-status");
    let error_path = format!("{target_path}.torfin-error");
    let url_path = format!("{target_path}.torfin-url");
    let size_path = format!("{target_path}.torfin-size");
    let total_size = 0;

    let worker_path = "$HOME/.local/bin/torfin-download";
    let script = format!(
        r#"set -eu
mkdir -p "$HOME/.local/bin" {target_dir}
cat > {worker_path} <<'TORBOX_STREAMDECK_WORKER'
#!/bin/sh
set -u
url_path=$1
partial_path=$2
target_path=$3
status_path=$4
error_path=$5
size_path=$6

download_url=$(cat "$url_path")
if ! command -v wget >/dev/null 2>&1; then
  printf 'error:wget is not installed on the remote machine' > "$status_path"
  exit 127
fi

printf probing > "$status_path"
total_size=$(
  wget --spider --server-response --max-redirect=20 "$download_url" 2>&1 \
    | awk 'BEGIN {{ IGNORECASE=1 }} /Content-Length:/ {{ value=$2 }} END {{ gsub("\r", "", value); print value }}'
)
case "$total_size" in
  ''|*[!0-9]*) total_size=0 ;;
esac
printf '%s' "$total_size" > "$size_path"

printf downloading > "$status_path"
wget -q --show-progress --progress=dot:giga -c -O "$partial_path" "$download_url" >"$error_path" 2>&1
rc=$?
if [ "$rc" -eq 0 ]; then
  mv "$partial_path" "$target_path"
  printf complete > "$status_path"
else
  printf 'error:wget exited %s %s' "$rc" "$(tail -c 700 "$error_path")" > "$status_path"
fi
exit "$rc"
TORBOX_STREAMDECK_WORKER
chmod +x {worker_path}
rm -f {status} {error} {size} {url_path}
printf %s {url} > {url_path}
printf starting > {status}
nohup {worker_path} {url_path} {partial} {target} {status} {error} {size} >/dev/null 2>&1 </dev/null &
"#,
        worker_path = worker_path,
        target_dir = shell_quote(&target_dir),
        status = shell_quote(&status_path),
        error = shell_quote(&error_path),
        size = shell_quote(&size_path),
        url_path = shell_quote(&url_path),
        url = shell_quote(&url),
        partial = shell_quote(&partial_path),
        target = shell_quote(&target_path),
    );
    run_ssh_command(
        &config.host,
        &config.username,
        config.password.as_deref(),
        &script,
    )?;

    let meta = RemoteDownloadMeta {
        host: config.host,
        username: config.username,
        password: config.password,
        target_path,
        partial_path,
        status_path,
        size_path,
        total_size,
        last_downloaded: 0,
        last_seen: std::time::Instant::now(),
    };
    let response_save_path = save_path.to_string();
    let response_target_path = meta.target_path.clone();
    let response_partial_path = meta.partial_path.clone();
    let response_status_path = meta.status_path.clone();
    REMOTE_DOWNLOADS
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|_| "Could not lock remote download state.".to_string())?
        .insert(id.clone(), meta);

    Ok(DownloadStatus {
        id,
        hash: None,
        name: filename,
        progress: 0.0,
        state: "downloading".to_string(),
        speed: 0,
        eta: -1,
        size: total_size,
        downloaded: 0,
        save_path: Some(response_save_path),
        target_path: Some(response_target_path),
        partial_path: Some(response_partial_path),
        status_path: Some(response_status_path),
        complete: false,
    })
}

#[tauri::command]
pub(crate) async fn get_remote_url_download(
    id: String,
    config: Option<RemoteDownloadConfig>,
    status: Option<DownloadStatus>,
) -> Result<DownloadStatus, String> {
    tauri::async_runtime::spawn_blocking(move || get_remote_url_download_inner(id, config, status))
        .await
        .map_err(|error| error.to_string())?
}

fn get_remote_url_download_inner(
    id: String,
    config: Option<RemoteDownloadConfig>,
    status: Option<DownloadStatus>,
) -> Result<DownloadStatus, String> {
    let mut downloads = REMOTE_DOWNLOADS
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|_| "Could not lock remote download state.".to_string())?;
    if !downloads.contains_key(&id) {
        let meta = rehydrate_remote_download(&id, config, status)?;
        downloads.insert(id.clone(), meta);
    }
    let meta = downloads
        .get_mut(&id)
        .ok_or_else(|| "This remote download is not being tracked.".to_string())?;

    let probe = format!(
        "downloaded=0; [ -f {target} ] && downloaded=$(wc -c < {target}); [ -f {partial} ] && downloaded=$(wc -c < {partial}); total=0; [ -f {size_file} ] && total=$(cat {size_file}); status=downloading; [ -f {status_file} ] && status=$(cat {status_file}); printf '%s\\n%s\\n%s' \"$downloaded\" \"$total\" \"$status\"",
        target = shell_quote(&meta.target_path),
        partial = shell_quote(&meta.partial_path),
        size_file = shell_quote(&meta.size_path),
        status_file = shell_quote(&meta.status_path),
    );
    let output = run_ssh_command(&meta.host, &meta.username, meta.password.as_deref(), &probe)?;
    let mut lines = output.lines();
    let downloaded = lines
        .next()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .unwrap_or(0);
    let total_size = lines
        .next()
        .and_then(|value| value.trim().parse::<i64>().ok())
        .filter(|value| *value > 0)
        .unwrap_or(meta.total_size);
    meta.total_size = total_size;
    let raw_state = lines.next().unwrap_or("downloading").trim().to_string();
    let now = std::time::Instant::now();
    let elapsed = now.duration_since(meta.last_seen).as_secs_f64().max(0.001);
    let speed = ((downloaded - meta.last_downloaded).max(0) as f64 / elapsed) as i64;
    meta.last_seen = now;
    meta.last_downloaded = downloaded;

    let complete = raw_state == "complete";
    let state = if complete {
        "complete".to_string()
    } else if raw_state.starts_with("error:") {
        raw_state
    } else {
        "downloading".to_string()
    };
    let progress = if meta.total_size > 0 {
        (downloaded as f64 / meta.total_size as f64).clamp(0.0, 1.0)
    } else if complete {
        1.0
    } else if downloaded > 0 {
        0.01
    } else {
        0.0
    };
    let eta = if speed > 0 && meta.total_size > downloaded {
        (meta.total_size - downloaded) / speed
    } else {
        -1
    };

    Ok(DownloadStatus {
        id,
        hash: None,
        name: std::path::Path::new(&meta.target_path)
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("Download")
            .to_string(),
        progress,
        state,
        speed,
        eta,
        size: meta.total_size,
        downloaded,
        save_path: std::path::Path::new(&meta.target_path)
            .parent()
            .and_then(|value| value.to_str())
            .map(ToString::to_string),
        target_path: Some(meta.target_path.clone()),
        partial_path: Some(meta.partial_path.clone()),
        status_path: Some(meta.status_path.clone()),
        complete,
    })
}

fn rehydrate_remote_download(
    _id: &str,
    config: Option<RemoteDownloadConfig>,
    status: Option<DownloadStatus>,
) -> Result<RemoteDownloadMeta, String> {
    let status = status.ok_or_else(|| "This remote download is not being tracked.".to_string())?;
    let config =
        config.ok_or_else(|| "This remote download needs remote config to resume.".to_string())?;
    let target_path = status
        .target_path
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| "This saved download is missing its remote target path.".to_string())?;
    let partial_path = status
        .partial_path
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{target_path}.part"));
    let status_path = status
        .status_path
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("{target_path}.torfin-status"));

    Ok(RemoteDownloadMeta {
        host: config.host,
        username: config.username,
        password: config.password,
        size_path: format!("{target_path}.torfin-size"),
        target_path,
        partial_path,
        status_path,
        total_size: status.size,
        last_downloaded: status.downloaded,
        last_seen: std::time::Instant::now(),
    })
}

#[tauri::command]
pub(crate) async fn start_qbittorrent_download(
    config: QBittorrentConfig,
    request: DownloadRequest,
) -> Result<DownloadStatus, String> {
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|error| error.to_string())?;
    let base_url = normalized_base_url(&config.base_url)?;
    login_qbittorrent(&client, &base_url, &config).await?;

    let source = torrent_source(&request)?;
    let hash = request
        .info_hash
        .as_deref()
        .map(ToString::to_string)
        .or_else(|| extract_info_hash(&source))
        .map(|hash| hash.to_lowercase());
    let download_id = request
        .id
        .clone()
        .filter(|value| !value.trim().is_empty())
        .or_else(|| hash.clone())
        .unwrap_or_else(|| source.clone());

    let mut form = vec![("urls".to_string(), source)];
    if let Some(save_path) = config
        .save_path
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        form.push(("savepath".to_string(), save_path.trim().to_string()));
    }
    if let Some(category) = config
        .category
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        form.push(("category".to_string(), category.trim().to_string()));
    }
    if let Some(name) = request
        .name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        form.push(("rename".to_string(), name.trim().to_string()));
    }

    let response = client
        .post(format!("{base_url}/api/v2/torrents/add"))
        .form(&form)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if !response.status().is_success() {
        return Err(format!("qBittorrent add failed with {}", response.status()));
    }

    for _ in 0..10 {
        if let Some(status) = find_qbittorrent_torrent(&client, &base_url, &download_id).await? {
            return Ok(status);
        }
        tokio_sleep(std::time::Duration::from_millis(700)).await;
    }

    Ok(DownloadStatus {
        id: download_id.clone(),
        hash,
        name: request.name.unwrap_or(download_id),
        progress: 0.0,
        state: "queued".to_string(),
        speed: 0,
        eta: -1,
        size: 0,
        downloaded: 0,
        save_path: config.save_path,
        target_path: None,
        partial_path: None,
        status_path: None,
        complete: false,
    })
}

#[tauri::command]
pub(crate) async fn get_qbittorrent_download(
    config: QBittorrentConfig,
    id: String,
) -> Result<DownloadStatus, String> {
    let client = reqwest::Client::builder()
        .cookie_store(true)
        .build()
        .map_err(|error| error.to_string())?;
    let base_url = normalized_base_url(&config.base_url)?;
    login_qbittorrent(&client, &base_url, &config).await?;
    find_qbittorrent_torrent(&client, &base_url, &id)
        .await?
        .ok_or_else(|| "qBittorrent does not list this download yet.".to_string())
}

fn normalized_base_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim().trim_end_matches('/');
    if trimmed.is_empty() {
        return Err("Enter a server URL.".to_string());
    }
    let parsed = reqwest::Url::parse(trimmed).map_err(|error| error.to_string())?;
    if parsed.scheme() != "http" && parsed.scheme() != "https" {
        return Err("Server URLs must start with http:// or https://".to_string());
    }
    Ok(trimmed.to_string())
}

fn torrent_source(request: &DownloadRequest) -> Result<String, String> {
    if let Some(magnet) = request
        .magnet_url
        .as_deref()
        .or(request.direct_url.as_deref())
        .filter(|value| value.starts_with("magnet:"))
    {
        return Ok(magnet.to_string());
    }
    if let Some(url) = request
        .direct_url
        .as_deref()
        .filter(|value| value.starts_with("http://") || value.starts_with("https://"))
    {
        return Ok(url.to_string());
    }
    if let Some(hash) = request
        .info_hash
        .as_deref()
        .filter(|value| !value.trim().is_empty())
    {
        return Ok(format!("magnet:?xt=urn:btih:{}", hash.trim()));
    }
    Err("This result does not expose downloadable torrent data.".to_string())
}

fn normalize_remote_url(value: &str) -> Result<String, String> {
    let trimmed = value.trim();
    let cleaned = trimmed
        .chars()
        .filter(|character| !matches!(character, '\r' | '\n' | '\t'))
        .flat_map(|character| match character {
            ' ' => "%20".chars().collect::<Vec<_>>(),
            '"' => "%22".chars().collect::<Vec<_>>(),
            '<' => "%3C".chars().collect::<Vec<_>>(),
            '>' => "%3E".chars().collect::<Vec<_>>(),
            '`' => "%60".chars().collect::<Vec<_>>(),
            '{' => "%7B".chars().collect::<Vec<_>>(),
            '}' => "%7D".chars().collect::<Vec<_>>(),
            '|' => "%7C".chars().collect::<Vec<_>>(),
            '\\' => "%5C".chars().collect::<Vec<_>>(),
            '^' => "%5E".chars().collect::<Vec<_>>(),
            _ => vec![character],
        })
        .collect::<String>();

    if !cleaned.starts_with("http://") && !cleaned.starts_with("https://") {
        return Err("Remote downloads need a resolved HTTP or HTTPS Torbox URL.".to_string());
    }

    reqwest::Url::parse(&cleaned)
        .map(|_| cleaned)
        .map_err(|error| format!("Resolved download URL is not valid: {error}"))
}

fn run_ssh_command(
    host: &str,
    username: &str,
    password: Option<&str>,
    script: &str,
) -> Result<String, String> {
    run_ssh_command_on_port(host, 22, username, password, script)
}

fn run_ssh_command_on_port(
    host: &str,
    port: u16,
    username: &str,
    password: Option<&str>,
    script: &str,
) -> Result<String, String> {
    let host = host.trim();
    let username = username.trim();
    if host.is_empty() || username.is_empty() {
        return Err("Enter the remote SSH host and username.".to_string());
    }

    let destination = format!("{username}@{host}");
    let password = password.filter(|value| !value.is_empty());
    let mut command = if let Some(password) = password {
        let mut command = std::process::Command::new("sshpass");
        command.args(["-p", password, "ssh"]);
        command
    } else {
        std::process::Command::new("ssh")
    };
    let batch_mode = if password.is_some() { "no" } else { "yes" };
    let batch_mode_arg = format!("BatchMode={batch_mode}");

    let mut child = command
        .args([
            "-p",
            &port.to_string(),
            "-o",
            &batch_mode_arg,
            "-o",
            "StrictHostKeyChecking=accept-new",
            "-o",
            "ConnectTimeout=12",
            &destination,
            "sh",
            "-s",
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|error| error.to_string())?;

    if let Some(mut stdin) = child.stdin.take() {
        std::io::Write::write_all(&mut stdin, script.as_bytes())
            .map_err(|error| error.to_string())?;
    }

    let output = child
        .wait_with_output()
        .map_err(|error| error.to_string())?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if stderr.is_empty() {
            format!("SSH command failed with {}", output.status)
        } else {
            stderr
        });
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn shell_quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\"'\"'"))
}

fn sanitize_filename(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| match character {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => ' ',
            character if character.is_control() => ' ',
            character => character,
        })
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if cleaned.is_empty() {
        "Torbox Download.mkv".to_string()
    } else {
        cleaned
    }
}

fn stable_id(value: &str) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for byte in value.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x100000001b3);
    }
    format!("{hash:x}")
}

async fn login_qbittorrent(
    client: &reqwest::Client,
    base_url: &str,
    config: &QBittorrentConfig,
) -> Result<(), String> {
    let response = client
        .post(format!("{base_url}/api/v2/auth/login"))
        .form(&[
            ("username", config.username.trim()),
            ("password", config.password.as_str()),
        ])
        .send()
        .await
        .map_err(|error| error.to_string())?;

    if response.status().is_success() {
        let text = response.text().await.map_err(|error| error.to_string())?;
        if text.trim() == "Ok." {
            return Ok(());
        }
        return Err(format!("qBittorrent rejected login: {text}"));
    }

    Err(format!(
        "qBittorrent login failed with {}",
        response.status()
    ))
}

async fn find_qbittorrent_torrent(
    client: &reqwest::Client,
    base_url: &str,
    id: &str,
) -> Result<Option<DownloadStatus>, String> {
    let body = client
        .get(format!("{base_url}/api/v2/torrents/info"))
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    let needle = id.to_lowercase();
    let Some(item) = body.as_array().and_then(|items| {
        items.iter().find(|item| {
            let hash_matches = item
                .get("hash")
                .and_then(|value| value.as_str())
                .map(|value| value.eq_ignore_ascii_case(id))
                .unwrap_or(false);
            let name_matches = item
                .get("name")
                .and_then(|value| value.as_str())
                .map(|value| value.to_lowercase().contains(&needle))
                .unwrap_or(false);
            let content_matches = item
                .get("content_path")
                .or_else(|| item.get("save_path"))
                .and_then(|value| value.as_str())
                .map(|value| value.to_lowercase().contains(&needle))
                .unwrap_or(false);
            hash_matches || name_matches || content_matches
        })
    }) else {
        return Ok(None);
    };

    let progress = item
        .get("progress")
        .and_then(|value| value.as_f64())
        .unwrap_or(0.0);
    let state = item
        .get("state")
        .and_then(|value| value.as_str())
        .unwrap_or("unknown")
        .to_string();

    Ok(Some(DownloadStatus {
        id: item
            .get("hash")
            .and_then(|value| value.as_str())
            .unwrap_or(id)
            .to_string(),
        hash: item
            .get("hash")
            .and_then(|value| value.as_str())
            .map(ToString::to_string),
        name: item
            .get("name")
            .and_then(|value| value.as_str())
            .unwrap_or(id)
            .to_string(),
        progress,
        state: state.clone(),
        speed: item.get("dlspeed").and_then(json_to_i64).unwrap_or(0),
        eta: item.get("eta").and_then(json_to_i64).unwrap_or(-1),
        size: item.get("size").and_then(json_to_i64).unwrap_or(0),
        downloaded: item.get("downloaded").and_then(json_to_i64).unwrap_or(0),
        save_path: item
            .get("save_path")
            .and_then(|value| value.as_str())
            .map(ToString::to_string),
        target_path: item
            .get("content_path")
            .and_then(|value| value.as_str())
            .map(ToString::to_string),
        partial_path: None,
        status_path: None,
        complete: progress >= 0.999
            || matches!(state.as_str(), "uploading" | "stalledUP" | "queuedUP"),
    }))
}

#[tauri::command]
pub(crate) async fn cancel_remote_url_download(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || cancel_remote_url_download_inner(id))
        .await
        .map_err(|error| error.to_string())?
}

fn cancel_remote_url_download_inner(id: String) -> Result<(), String> {
    let mut downloads = REMOTE_DOWNLOADS
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|_| "Could not lock remote download state.".to_string())?;
    let meta = downloads
        .get(&id)
        .ok_or_else(|| "This remote download is not being tracked.".to_string())?
        .clone();

    let script = format!(
        "pkill -f {partial} 2>/dev/null || true; printf cancelled > {status}",
        partial = shell_quote(&meta.partial_path),
        status = shell_quote(&meta.status_path),
    );
    run_ssh_command(
        &meta.host,
        &meta.username,
        meta.password.as_deref(),
        &script,
    )?;
    downloads.remove(&id);
    Ok(())
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SshTestResult {
    writable: bool,
    has_wget: bool,
    message: String,
}

#[tauri::command]
pub(crate) async fn test_ssh_connection(
    host: String,
    port: Option<u16>,
    username: String,
    password: Option<String>,
    save_path: String,
) -> Result<SshTestResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        test_ssh_connection_inner(host, port.unwrap_or(22), username, password, save_path)
    })
    .await
    .map_err(|error| error.to_string())?
}

fn test_ssh_connection_inner(
    host: String,
    port: u16,
    username: String,
    password: Option<String>,
    save_path: String,
) -> Result<SshTestResult, String> {
    let path = save_path.trim();
    if path.is_empty() {
        return Err("Enter the folder Jellyfin watches.".to_string());
    }
    let script = format!(
        r#"set -eu
path={path}
has_wget=0
writable=0
if command -v wget >/dev/null 2>&1; then has_wget=1; fi
if mkdir -p "$path" 2>/dev/null && [ -w "$path" ]; then writable=1; fi
printf '%s\n%s' "$writable" "$has_wget""#,
        path = shell_quote(path),
    );
    let output = run_ssh_command_on_port(&host, port, &username, password.as_deref(), &script)?;
    let mut lines = output.lines();
    let writable = lines.next().unwrap_or("0") == "1";
    let has_wget = lines.next().unwrap_or("0") == "1";
    let mut parts = vec!["SSH connected".to_string()];
    if writable {
        parts.push(format!("write access to {path}"));
    } else {
        parts.push(format!("cannot write to {path}"));
    }
    if has_wget {
        parts.push("wget found".to_string());
    } else {
        parts.push("wget not installed".to_string());
    }
    Ok(SshTestResult {
        writable,
        has_wget,
        message: parts.join(" · "),
    })
}

static LOCAL_DOWNLOADS: std::sync::OnceLock<
    std::sync::Mutex<std::collections::HashMap<String, LocalDownloadMeta>>,
> = std::sync::OnceLock::new();

#[derive(Clone)]
struct LocalDownloadMeta {
    target_path: String,
    partial_path: String,
    save_path: String,
    total_size: i64,
    last_downloaded: i64,
    last_seen: std::time::Instant,
    complete: bool,
    error: String,
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct LocalDownloadConfig {
    save_path: String,
}

#[tauri::command]
pub(crate) async fn start_local_url_download(
    config: LocalDownloadConfig,
    request: RemoteDownloadRequest,
) -> Result<DownloadStatus, String> {
    tauri::async_runtime::spawn_blocking(move || start_local_url_download_inner(config, request))
        .await
        .map_err(|error| error.to_string())?
}

fn start_local_url_download_inner(
    config: LocalDownloadConfig,
    request: RemoteDownloadRequest,
) -> Result<DownloadStatus, String> {
    let url = normalize_remote_url(&request.url)?;
    let save_path = config.save_path.trim();
    if save_path.is_empty() {
        return Err("Choose a local download folder.".to_string());
    }

    let id = request
        .id
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| format!("local-{}", stable_id(&url)));
    let filename = sanitize_filename(&request.filename);
    let target_dir = request
        .folder_name
        .as_deref()
        .filter(|value| !value.trim().is_empty())
        .map(sanitize_filename)
        .map(|folder| format!("{}/{}", save_path.trim_end_matches('/'), folder))
        .unwrap_or_else(|| save_path.trim_end_matches('/').to_string());
    let target_path = format!("{target_dir}/{filename}");
    let partial_path = format!("{target_path}.part");

    std::fs::create_dir_all(&target_dir).map_err(|error| error.to_string())?;

    if !command_exists("wget") {
        return Err("wget is not installed. Install it with: brew install wget".to_string());
    }

    let mut child = std::process::Command::new("wget")
        .args([
            "-q",
            "--show-progress",
            "--progress=dot:giga",
            "-c",
            "-O",
            &partial_path,
            &url,
        ])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|error| format!("Could not start wget: {error}"))?;

    let id_for_thread = id.clone();
    std::thread::spawn(move || {
        let status = child.wait();
        let downloads = LOCAL_DOWNLOADS
            .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
            .lock()
            .ok();
        if let Some(mut downloads) = downloads {
            if let Some(meta) = downloads.get_mut(&id_for_thread) {
                match status {
                    Ok(exit) if exit.success() => {
                        let _ = std::fs::rename(&meta.partial_path, &meta.target_path);
                        meta.complete = true;
                    }
                    Ok(exit) => {
                        meta.error = format!("wget exited with {exit}");
                    }
                    Err(error) => {
                        meta.error = error.to_string();
                    }
                }
            }
        }
    });

    let meta = LocalDownloadMeta {
        target_path: target_path.clone(),
        partial_path: partial_path.clone(),
        save_path: save_path.to_string(),
        total_size: 0,
        last_downloaded: 0,
        last_seen: std::time::Instant::now(),
        complete: false,
        error: String::new(),
    };
    LOCAL_DOWNLOADS
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|_| "Could not lock local download state.".to_string())?
        .insert(id.clone(), meta);

    Ok(DownloadStatus {
        id,
        hash: None,
        name: filename,
        progress: 0.0,
        state: "downloading".to_string(),
        speed: 0,
        eta: -1,
        size: 0,
        downloaded: 0,
        save_path: Some(save_path.to_string()),
        target_path: Some(target_path),
        partial_path: Some(partial_path),
        status_path: None,
        complete: false,
    })
}

#[tauri::command]
pub(crate) async fn get_local_url_download(id: String) -> Result<DownloadStatus, String> {
    tauri::async_runtime::spawn_blocking(move || get_local_url_download_inner(id))
        .await
        .map_err(|error| error.to_string())?
}

fn get_local_url_download_inner(id: String) -> Result<DownloadStatus, String> {
    let mut downloads = LOCAL_DOWNLOADS
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|_| "Could not lock local download state.".to_string())?;
    let meta = downloads
        .get_mut(&id)
        .ok_or_else(|| "This local download is not being tracked.".to_string())?;

    let downloaded = file_size(&meta.partial_path).max(file_size(&meta.target_path));
    let now = std::time::Instant::now();
    let elapsed = now.duration_since(meta.last_seen).as_secs_f64().max(0.001);
    let speed = if downloaded >= meta.last_downloaded {
        ((downloaded - meta.last_downloaded) as f64 / elapsed) as i64
    } else {
        0
    };
    meta.last_downloaded = downloaded;
    meta.last_seen = now;

    if meta.complete {
        return Ok(DownloadStatus {
            id: id.clone(),
            hash: None,
            name: meta
                .target_path
                .split('/')
                .next_back()
                .unwrap_or("download")
                .to_string(),
            progress: 1.0,
            state: "complete".to_string(),
            speed: 0,
            eta: 0,
            size: downloaded.max(meta.total_size),
            downloaded,
            save_path: Some(meta.save_path.clone()),
            target_path: Some(meta.target_path.clone()),
            partial_path: None,
            status_path: None,
            complete: true,
        });
    }

    if !meta.error.is_empty() {
        return Ok(DownloadStatus {
            id: id.clone(),
            hash: None,
            name: meta
                .target_path
                .split('/')
                .next_back()
                .unwrap_or("download")
                .to_string(),
            progress: 0.0,
            state: format!("error:{}", meta.error),
            speed: 0,
            eta: -1,
            size: meta.total_size,
            downloaded,
            save_path: Some(meta.save_path.clone()),
            target_path: Some(meta.target_path.clone()),
            partial_path: Some(meta.partial_path.clone()),
            status_path: None,
            complete: false,
        });
    }

    let size = meta.total_size.max(downloaded);
    let progress = if size > 0 {
        downloaded as f64 / size as f64
    } else {
        0.0
    };

    Ok(DownloadStatus {
        id,
        hash: None,
        name: meta
            .target_path
            .split('/')
            .next_back()
            .unwrap_or("download")
            .to_string(),
        progress,
        state: "downloading".to_string(),
        speed,
        eta: if speed > 0 && size > downloaded {
            ((size - downloaded) as f64 / speed as f64) as i64
        } else {
            -1
        },
        size,
        downloaded,
        save_path: Some(meta.save_path.clone()),
        target_path: Some(meta.target_path.clone()),
        partial_path: Some(meta.partial_path.clone()),
        status_path: None,
        complete: false,
    })
}

#[tauri::command]
pub(crate) async fn cancel_local_url_download(id: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || cancel_local_url_download_inner(id))
        .await
        .map_err(|error| error.to_string())?
}

fn cancel_local_url_download_inner(id: String) -> Result<(), String> {
    let mut downloads = LOCAL_DOWNLOADS
        .get_or_init(|| std::sync::Mutex::new(std::collections::HashMap::new()))
        .lock()
        .map_err(|_| "Could not lock local download state.".to_string())?;
    let meta = downloads
        .get(&id)
        .ok_or_else(|| "This local download is not being tracked.".to_string())?
        .clone();
    let _ = std::process::Command::new("pkill")
        .args(["-f", &meta.partial_path])
        .status();
    downloads.remove(&id);
    Ok(())
}

fn command_exists(command: &str) -> bool {
    std::process::Command::new("sh")
        .args(["-lc", &format!("command -v {command}")])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .map(|status| status.success())
        .unwrap_or(false)
}

fn file_size(path: &str) -> i64 {
    std::fs::metadata(path)
        .map(|meta| meta.len() as i64)
        .unwrap_or(0)
}

async fn tokio_sleep(duration: std::time::Duration) {
    tauri::async_runtime::spawn_blocking(move || std::thread::sleep(duration))
        .await
        .ok();
}

fn json_to_i64(value: &serde_json::Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|number| i64::try_from(number).ok()))
        .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
}
