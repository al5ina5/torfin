const ALLOWED_FETCH_HOSTS: &[&str] = &[
    "v3-cinemeta.strem.io",
    "torrentio.strem.fun",
    "comet.elfhosted.com",
    "mediafusion.elfhosted.com",
    "api.torbox.app",
];

fn is_allowed_fetch_host(hostname: &str) -> bool {
    let host = hostname.to_ascii_lowercase();
    if host == "strem.io" || host.ends_with(".strem.io") {
        return true;
    }
    ALLOWED_FETCH_HOSTS.contains(&host.as_str())
}

#[tauri::command]
pub(crate) async fn fetch_json(url: String) -> Result<serde_json::Value, String> {
    let parsed = reqwest::Url::parse(&url).map_err(|error| error.to_string())?;

    if parsed.scheme() != "https" && parsed.scheme() != "http" {
        return Err("Only HTTP and HTTPS URLs are supported".into());
    }
    let Some(hostname) = parsed.host_str() else {
        return Err("URL host is required".into());
    };
    if !is_allowed_fetch_host(hostname) {
        return Err(format!(
            "Host {hostname} is not in the JSON fetch allowlist."
        ));
    }

    let response = reqwest::Client::new()
        .get(parsed)
        .header(reqwest::header::ACCEPT, "application/json")
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    if !status.is_success() {
        return Err(format!("Request failed with {}", status));
    }

    response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())
}

#[tauri::command]
pub(crate) async fn resolve_torbox_stream(
    token: String,
    info_hash: Option<String>,
    file_idx: Option<i64>,
    filename: Option<String>,
    direct_url: Option<String>,
) -> Result<String, String> {
    if let Some(url) = direct_url.as_deref() {
        if url.starts_with("http://") || url.starts_with("https://") {
            return Ok(url.to_string());
        }
    }

    let hash = info_hash
        .or_else(|| direct_url.as_deref().and_then(extract_info_hash))
        .ok_or_else(|| "This stream does not expose an info hash or playable URL.".to_string())?;

    let client = reqwest::Client::new();
    let token = token.trim().to_string();
    if token.is_empty() {
        return Err("Add your Torbox API key before streaming Torbox results.".into());
    }

    let torrent_id = match find_torrent_by_hash(&client, &token, &hash).await? {
        Some(id) => id,
        None => create_torrent(&client, &token, &hash, filename.as_deref()).await?,
    };

    let torrent = get_torrent(&client, &token, torrent_id).await?;
    let file_id = choose_file_id(&torrent, file_idx, filename.as_deref()).unwrap_or(0);
    request_download_link(&client, &token, torrent_id, file_id).await
}

pub(crate) fn extract_info_hash(value: &str) -> Option<String> {
    let lower = value.to_lowercase();
    let marker = "btih:";
    let start = lower.find(marker)? + marker.len();
    let rest = &value[start..];
    let hash = rest.split(['&', '?', '/']).next()?.trim();

    if hash.is_empty() {
        None
    } else {
        Some(hash.to_string())
    }
}

async fn find_torrent_by_hash(
    client: &reqwest::Client,
    token: &str,
    info_hash: &str,
) -> Result<Option<i64>, String> {
    let response = client
        .get("https://api.torbox.app/v1/api/torrents/mylist")
        .bearer_auth(token)
        .query(&[("bypass_cache", "true"), ("limit", "1000")])
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let body = json_response(response, "Torbox torrent details").await?;
    let Some(items) = body.get("data").and_then(|data| data.as_array()) else {
        return Ok(None);
    };

    let needle = info_hash.to_lowercase();
    Ok(items.iter().find_map(|item| {
        let hash = item
            .get("hash")
            .or_else(|| item.get("info_hash"))
            .and_then(|value| value.as_str())?
            .to_lowercase();

        if hash == needle {
            numeric_id(item)
        } else {
            None
        }
    }))
}

async fn create_torrent(
    client: &reqwest::Client,
    token: &str,
    info_hash: &str,
    name: Option<&str>,
) -> Result<i64, String> {
    let magnet = format!("magnet:?xt=urn:btih:{info_hash}");
    let mut form = reqwest::multipart::Form::new()
        .text("magnet", magnet)
        .text("seed", "1")
        .text("allow_zip", "false")
        .text("as_queued", "false");

    if let Some(name) = name {
        form = form.text("name", name.to_string());
    }

    let response = client
        .post("https://api.torbox.app/v1/api/torrents/createtorrent")
        .bearer_auth(token)
        .multipart(form)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = json_response(response, "Torbox download request").await?;

    if !status.is_success() || body.get("success").and_then(|value| value.as_bool()) == Some(false)
    {
        return Err(body_detail(&body)
            .unwrap_or_else(|| format!("Torbox create torrent failed with {status}")));
    }

    body.get("data")
        .and_then(|data| data.get("torrent_id").or_else(|| data.get("id")))
        .and_then(json_to_i64)
        .or_else(|| body.get("torrent_id").and_then(json_to_i64))
        .or_else(|| body.get("id").and_then(json_to_i64))
        .ok_or_else(|| "Torbox did not return a torrent ID.".to_string())
}

async fn json_response(
    response: reqwest::Response,
    context: &str,
) -> Result<serde_json::Value, String> {
    let status = response.status();
    let text = response.text().await.map_err(|error| error.to_string())?;
    serde_json::from_str::<serde_json::Value>(&text).map_err(|error| {
        let preview = text.chars().take(500).collect::<String>();
        if preview.trim().is_empty() {
            format!("{context} returned {status} with an empty body")
        } else {
            format!("{context} returned {status} with invalid JSON: {error}. Body: {preview}")
        }
    })
}

async fn get_torrent(
    client: &reqwest::Client,
    token: &str,
    torrent_id: i64,
) -> Result<serde_json::Value, String> {
    let response = client
        .get("https://api.torbox.app/v1/api/torrents/mylist")
        .bearer_auth(token)
        .query(&[
            ("id", torrent_id.to_string()),
            ("bypass_cache", "true".to_string()),
        ])
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let body = json_response(response, "Torbox torrent details").await?;

    body.get("data").cloned().ok_or_else(|| {
        body_detail(&body).unwrap_or_else(|| "Torbox torrent details were unavailable.".to_string())
    })
}

fn choose_file_id(
    torrent: &serde_json::Value,
    file_idx: Option<i64>,
    filename: Option<&str>,
) -> Option<i64> {
    let files = torrent.get("files")?.as_array()?;

    if let Some(filename) = filename {
        let needle = filename.to_lowercase();
        if let Some(file) = files.iter().find(|file| {
            file.get("name")
                .or_else(|| file.get("short_name"))
                .and_then(|value| value.as_str())
                .map(|name| {
                    needle.contains(&name.to_lowercase()) || name.to_lowercase().contains(&needle)
                })
                .unwrap_or(false)
        }) {
            return numeric_id(file);
        }
    }

    if let Some(index) = file_idx.and_then(|value| usize::try_from(value).ok()) {
        if let Some(file) = files.get(index) {
            if let Some(id) = numeric_id(file) {
                return Some(id);
            }
        }
    }

    files
        .iter()
        .filter(|file| {
            file.get("name")
                .or_else(|| file.get("short_name"))
                .and_then(|value| value.as_str())
                .map(is_webkit_playable_filename)
                .unwrap_or(false)
        })
        .max_by_key(|file| {
            file.get("size")
                .or_else(|| file.get("bytes"))
                .and_then(json_to_i64)
                .unwrap_or(0)
        })
        .and_then(numeric_id)
        .or_else(|| {
            files
                .iter()
                .filter(|file| {
                    file.get("name")
                        .or_else(|| file.get("short_name"))
                        .and_then(|value| value.as_str())
                        .map(is_video_filename)
                        .unwrap_or(false)
                })
                .max_by_key(|file| {
                    file.get("size")
                        .or_else(|| file.get("bytes"))
                        .and_then(json_to_i64)
                        .unwrap_or(0)
                })
                .and_then(numeric_id)
        })
        .or_else(|| files.first().and_then(numeric_id))
}

async fn request_download_link(
    client: &reqwest::Client,
    token: &str,
    torrent_id: i64,
    file_id: i64,
) -> Result<String, String> {
    let response = client
        .get("https://api.torbox.app/v1/api/torrents/requestdl")
        .query(&[
            ("token", token.to_string()),
            ("torrent_id", torrent_id.to_string()),
            ("file_id", file_id.to_string()),
            ("zip_link", "false".to_string()),
            ("redirect", "false".to_string()),
            ("append_name", "false".to_string()),
        ])
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    if !status.is_success() || body.get("success").and_then(|value| value.as_bool()) == Some(false)
    {
        return Err(body_detail(&body)
            .unwrap_or_else(|| format!("Torbox download request failed with {status}")));
    }

    extract_download_url(&body)
        .ok_or_else(|| format!("Torbox did not return a playable download URL: {body}"))
}

fn extract_download_url(body: &serde_json::Value) -> Option<String> {
    [
        body.get("data"),
        body.get("download_url"),
        body.get("downloadUrl"),
        body.get("url"),
        body.get("link"),
    ]
    .into_iter()
    .flatten()
    .find_map(extract_download_url_from_value)
}

fn extract_download_url_from_value(value: &serde_json::Value) -> Option<String> {
    if let Some(url) = value
        .as_str()
        .filter(|url| url.starts_with("http://") || url.starts_with("https://"))
    {
        return Some(url.to_string());
    }

    [
        "download_url",
        "downloadUrl",
        "url",
        "link",
        "direct_link",
        "directLink",
    ]
    .into_iter()
    .find_map(|key| {
        value
            .get(key)
            .and_then(|child| child.as_str())
            .filter(|url| url.starts_with("http://") || url.starts_with("https://"))
            .map(ToString::to_string)
    })
}

fn numeric_id(value: &serde_json::Value) -> Option<i64> {
    value
        .get("id")
        .or_else(|| value.get("file_id"))
        .or_else(|| value.get("torrent_id"))
        .and_then(json_to_i64)
}

fn json_to_i64(value: &serde_json::Value) -> Option<i64> {
    value
        .as_i64()
        .or_else(|| value.as_u64().and_then(|number| i64::try_from(number).ok()))
        .or_else(|| value.as_str().and_then(|text| text.parse::<i64>().ok()))
}

fn is_video_filename(name: &str) -> bool {
    let lower = name.to_lowercase();
    [".mp4", ".mkv", ".webm", ".mov", ".m4v", ".avi"]
        .iter()
        .any(|extension| lower.ends_with(extension))
}

fn is_webkit_playable_filename(name: &str) -> bool {
    let lower = name.to_lowercase();
    [".mp4", ".m4v", ".mov", ".m3u8"]
        .iter()
        .any(|extension| lower.ends_with(extension))
}

fn body_detail(body: &serde_json::Value) -> Option<String> {
    body.get("detail")
        .or_else(|| body.get("error"))
        .or_else(|| body.get("message"))
        .or_else(|| body.get("msg"))
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct TorboxAccountSummary {
    email: Option<String>,
    plan: Option<String>,
    plan_id: Option<i64>,
    premium: bool,
    expires_at: Option<String>,
    total_torrents: usize,
    active_torrents: usize,
    cached_torrents: usize,
}

fn plan_label(plan_id: i64) -> String {
    match plan_id {
        0 => "Free".to_string(),
        1 => "Essential".to_string(),
        2 => "Pro".to_string(),
        3 => "Standard".to_string(),
        _ => format!("Plan {plan_id}"),
    }
}

fn string_field(body: &serde_json::Value, keys: &[&str]) -> Option<String> {
    keys.iter().find_map(|key| {
        body.get(*key)
            .and_then(|value| value.as_str())
            .map(ToString::to_string)
    })
}

fn number_field(body: &serde_json::Value, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| body.get(*key).and_then(|value| value.as_i64()))
}

#[tauri::command]
pub(crate) async fn get_torbox_account(api_key: String) -> Result<TorboxAccountSummary, String> {
    let token = api_key.trim();
    if token.is_empty() {
        return Err("Add your Torbox API key to load account details.".into());
    }

    let client = reqwest::Client::new();
    let user_response = client
        .get("https://api.torbox.app/v1/api/user/me")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let user_status = user_response.status();
    let user_body = user_response
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;
    if !user_status.is_success() {
        return Err(body_detail(&user_body)
            .unwrap_or_else(|| format!("Torbox account lookup failed with {user_status}")));
    }

    let user = user_body.get("data").unwrap_or(&user_body);
    let plan_id = number_field(user, &["plan", "plan_id", "planId"]);
    let premium = user
        .get("premium")
        .or_else(|| user.get("is_premium"))
        .and_then(|value| value.as_bool())
        .unwrap_or(plan_id.unwrap_or(0) > 0);

    let torrent_response = client
        .get("https://api.torbox.app/v1/api/torrents/mylist")
        .header("Authorization", format!("Bearer {token}"))
        .send()
        .await
        .map_err(|error| error.to_string())?;
    let torrent_body = torrent_response
        .json::<serde_json::Value>()
        .await
        .unwrap_or(serde_json::json!([]));
    let torrents = torrent_body
        .get("data")
        .and_then(|value| value.as_array())
        .cloned()
        .or_else(|| torrent_body.as_array().cloned())
        .unwrap_or_default();

    let mut active_torrents = 0usize;
    let mut cached_torrents = 0usize;
    for entry in &torrents {
        let state = entry
            .get("download_state")
            .or_else(|| entry.get("state"))
            .and_then(|value| value.as_str())
            .unwrap_or("")
            .to_ascii_lowercase();
        if state.contains("cached")
            || entry.get("cached").and_then(|value| value.as_bool()) == Some(true)
        {
            cached_torrents += 1;
        }
        if !state.is_empty()
            && !["completed", "complete", "cached", "error"]
                .iter()
                .any(|item| state.contains(item))
        {
            active_torrents += 1;
        }
    }

    Ok(TorboxAccountSummary {
        email: string_field(user, &["email", "user_email"]),
        plan: string_field(user, &["plan_name", "planName"]).or(plan_id.map(plan_label)),
        plan_id,
        premium,
        expires_at: string_field(user, &["premium_expires_at", "expires_at", "expiration"]),
        total_torrents: torrents.len(),
        active_torrents,
        cached_torrents,
    })
}
