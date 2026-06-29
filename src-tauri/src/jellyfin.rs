#[derive(serde::Serialize)]
pub(crate) struct JellyfinInfo {
    name: String,
    version: String,
}

#[derive(serde::Serialize)]
pub(crate) struct JellyfinLibraryMatch {
    #[serde(rename = "itemId")]
    item_id: String,
    name: String,
    path: Option<String>,
    #[serde(rename = "qualityLabel")]
    quality_label: Option<String>,
    width: Option<i64>,
    height: Option<i64>,
}

#[derive(serde::Serialize)]
pub(crate) struct JellyfinSeasonEpisode {
    episode: i32,
    #[serde(rename = "match")]
    matched: JellyfinLibraryMatch,
}

#[tauri::command]
pub(crate) async fn lookup_jellyfin_season_episodes(
    base_url: String,
    api_key: String,
    imdb_id: String,
    season: i32,
) -> Result<Vec<JellyfinSeasonEpisode>, String> {
    let base_url = normalized_base_url(&base_url)?;
    let client = reqwest::Client::new();
    let token = api_key.trim();
    let provider = format!("imdb.{}", imdb_id.trim());

    let series_url = format!(
        "{base_url}/Items?Recursive=true&IncludeItemTypes=Series&AnyProviderIdEquals={provider}&Fields=ProviderIds",
    );
    let series_body = client
        .get(&series_url)
        .header("X-Emby-Token", token)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;
    let series_id = series_body
        .get("Items")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .and_then(|item| item.get("Id"))
        .and_then(|value| value.as_str());
    let Some(series_id) = series_id else {
        return Ok(Vec::new());
    };

    let episode_url = format!(
        "{base_url}/Shows/{series_id}/Episodes?Season={season}&Fields=Path,MediaSources,IndexNumber"
    );
    let episode_body = client
        .get(&episode_url)
        .header("X-Emby-Token", token)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    let items = episode_body
        .get("Items")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(items
        .into_iter()
        .filter_map(|item| {
            let episode = item.get("IndexNumber").and_then(|value| value.as_i64())? as i32;
            Some(JellyfinSeasonEpisode {
                episode,
                matched: item_to_match(&item),
            })
        })
        .collect())
}

#[derive(serde::Serialize)]
pub(crate) struct JellyfinFavoriteItem {
    id: String,
    #[serde(rename = "type")]
    content_type: String,
    name: String,
    #[serde(rename = "releaseInfo", skip_serializing_if = "Option::is_none")]
    release_info: Option<String>,
}

#[tauri::command]
pub(crate) async fn fetch_jellyfin_favorites(
    base_url: String,
    api_key: String,
) -> Result<Vec<JellyfinFavoriteItem>, String> {
    let base_url = normalized_base_url(&base_url)?;
    let client = reqwest::Client::new();
    let body = client
        .get(format!(
            "{base_url}/Users/Me/Items?Recursive=true&IncludeItemTypes=Movie,Series&Filters=IsFavorite&Fields=ProviderIds,Name,Type,ProductionYear"
        ))
        .header("X-Emby-Token", api_key.trim())
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    let items = body
        .get("Items")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    Ok(items
        .into_iter()
        .filter_map(|item| {
            let imdb_id = item
                .get("ProviderIds")
                .and_then(|value| value.get("imdb").or_else(|| value.get("Imdb")))
                .and_then(|value| value.as_str())?;
            let content_type = if item.get("Type").and_then(|value| value.as_str()) == Some("Series") {
                "series"
            } else {
                "movie"
            };
            Some(JellyfinFavoriteItem {
                id: imdb_id.to_string(),
                content_type: content_type.to_string(),
                name: item
                    .get("Name")
                    .and_then(|value| value.as_str())
                    .unwrap_or("Unknown")
                    .to_string(),
                release_info: item
                    .get("ProductionYear")
                    .and_then(|value| value.as_i64())
                    .map(|year| year.to_string()),
            })
        })
        .collect())
}

#[tauri::command]
pub(crate) async fn lookup_jellyfin_library(
    base_url: String,
    api_key: String,
    imdb_id: String,
    content_type: String,
    season: Option<i32>,
    episode: Option<i32>,
) -> Result<Option<JellyfinLibraryMatch>, String> {
    let base_url = normalized_base_url(&base_url)?;
    let client = reqwest::Client::new();
    let token = api_key.trim();
    let provider = format!("imdb.{}", imdb_id.trim());

    if content_type == "series" {
        if let (Some(season), Some(episode)) = (season, episode) {
            let series_url = format!(
                "{base_url}/Items?Recursive=true&IncludeItemTypes=Series&AnyProviderIdEquals={provider}&Fields=ProviderIds",
            );
            let series_body = client
                .get(&series_url)
                .header("X-Emby-Token", token)
                .send()
                .await
                .map_err(|error| error.to_string())?
                .error_for_status()
                .map_err(|error| error.to_string())?
                .json::<serde_json::Value>()
                .await
                .map_err(|error| error.to_string())?;
            let series_id = series_body
                .get("Items")
                .and_then(|value| value.as_array())
                .and_then(|items| items.first())
                .and_then(|item| item.get("Id"))
                .and_then(|value| value.as_str());
            let Some(series_id) = series_id else {
                return Ok(None);
            };

            let episode_url = format!(
                "{base_url}/Shows/{series_id}/Episodes?Season={season}&Fields=Path,MediaSources&UserId="
            );
            let episode_body = client
                .get(&episode_url)
                .header("X-Emby-Token", token)
                .send()
                .await
                .map_err(|error| error.to_string())?
                .error_for_status()
                .map_err(|error| error.to_string())?
                .json::<serde_json::Value>()
                .await
                .map_err(|error| error.to_string())?;

            let matched = episode_body
                .get("Items")
                .and_then(|value| value.as_array())
                .and_then(|items| {
                    items.iter().find(|item| {
                        item.get("IndexNumber").and_then(|value| value.as_i64())
                            == Some(episode as i64)
                    })
                });

            return Ok(matched.map(item_to_match));
        }

        let series_url = format!(
            "{base_url}/Items?Recursive=true&IncludeItemTypes=Series&AnyProviderIdEquals={provider}&Fields=Path",
        );
        let body = client
            .get(&series_url)
            .header("X-Emby-Token", token)
            .send()
            .await
            .map_err(|error| error.to_string())?
            .error_for_status()
            .map_err(|error| error.to_string())?
            .json::<serde_json::Value>()
            .await
            .map_err(|error| error.to_string())?;
        return Ok(body
            .get("Items")
            .and_then(|value| value.as_array())
            .and_then(|items| items.first())
            .map(item_to_match));
    }

    let movie_url = format!(
        "{base_url}/Items?Recursive=true&IncludeItemTypes=Movie&AnyProviderIdEquals={provider}&Fields=Path,MediaSources",
    );
    let body = client
        .get(&movie_url)
        .header("X-Emby-Token", token)
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    Ok(body
        .get("Items")
        .and_then(|value| value.as_array())
        .and_then(|items| items.first())
        .map(item_to_match))
}

fn item_to_match(item: &serde_json::Value) -> JellyfinLibraryMatch {
    let (width, height) = video_dimensions(item);
    JellyfinLibraryMatch {
        item_id: item
            .get("Id")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        name: item
            .get("Name")
            .and_then(|value| value.as_str())
            .unwrap_or("Library item")
            .to_string(),
        path: item
            .get("Path")
            .and_then(|value| value.as_str())
            .map(ToString::to_string),
        quality_label: height.map(|value| {
            if value >= 2160 {
                "4K".to_string()
            } else {
                format!("{value}p")
            }
        }),
        width,
        height,
    }
}

fn video_dimensions(item: &serde_json::Value) -> (Option<i64>, Option<i64>) {
    let streams = item
        .get("MediaSources")
        .and_then(|value| value.as_array())
        .and_then(|sources| sources.first())
        .and_then(|source| source.get("MediaStreams"))
        .and_then(|value| value.as_array());

    if let Some(streams) = streams {
        for stream in streams {
            if stream.get("Type").and_then(|value| value.as_str()) == Some("Video") {
                return (
                    stream.get("Width").and_then(|value| value.as_i64()),
                    stream.get("Height").and_then(|value| value.as_i64()),
                );
            }
        }
    }
    (None, None)
}

#[tauri::command]
pub(crate) async fn test_jellyfin(
    base_url: String,
    api_key: String,
) -> Result<JellyfinInfo, String> {
    let base_url = normalized_base_url(&base_url)?;
    let body = reqwest::Client::new()
        .get(format!("{base_url}/System/Info"))
        .header("X-Emby-Token", api_key.trim())
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    Ok(JellyfinInfo {
        name: body
            .get("ServerName")
            .and_then(|value| value.as_str())
            .unwrap_or("Jellyfin")
            .to_string(),
        version: body
            .get("Version")
            .and_then(|value| value.as_str())
            .unwrap_or("unknown")
            .to_string(),
    })
}

#[tauri::command]
pub(crate) async fn authenticate_jellyfin(
    base_url: String,
    username: String,
    password: String,
) -> Result<String, String> {
    let base_url = normalized_base_url(&base_url)?;
    let body = serde_json::json!({
        "Username": username,
        "Pw": password,
    });
    let response = reqwest::Client::new()
        .post(format!("{base_url}/Users/AuthenticateByName"))
        .header(
            "Authorization",
            r#"MediaBrowser Client="Torfin", Device="Desktop", DeviceId="torfin", Version="1.0.0-beta""#,
        )
        .json(&body)
        .send()
        .await
        .map_err(|error| error.to_string())?;

    let status = response.status();
    let body = json_response(response, "Jellyfin auth").await?;
    if !status.is_success() {
        return Err(
            body_detail(&body).unwrap_or_else(|| format!("Jellyfin login failed with {status}"))
        );
    }

    body.get("AccessToken")
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
        .ok_or_else(|| "Jellyfin did not return an access token.".to_string())
}

#[derive(serde::Serialize)]
pub(crate) struct JellyfinImportMatch {
    #[serde(rename = "itemId")]
    item_id: String,
    path: Option<String>,
}

#[tauri::command]
pub(crate) async fn verify_jellyfin_import(
    base_url: String,
    api_key: String,
    target_path: String,
    path_map_from: Option<String>,
    path_map_to: Option<String>,
) -> Result<Option<JellyfinImportMatch>, String> {
    let base_url = normalized_base_url(&base_url)?;
    let target_path = target_path.trim();
    if target_path.is_empty() {
        return Ok(None);
    }

    let mapped_path = map_jellyfin_path(
        target_path,
        path_map_from.as_deref(),
        path_map_to.as_deref(),
    );
    let client = reqwest::Client::new();
    let body = client
        .get(format!(
            "{base_url}/Items?Recursive=true&IncludeItemTypes=Movie,Episode&Fields=Path&Limit=10000"
        ))
        .header("X-Emby-Token", api_key.trim())
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?
        .json::<serde_json::Value>()
        .await
        .map_err(|error| error.to_string())?;

    let items = body
        .get("Items")
        .and_then(|value| value.as_array())
        .cloned()
        .unwrap_or_default();

    let basename = std::path::Path::new(target_path)
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("");

    for item in &items {
        let Some(path) = item.get("Path").and_then(|value| value.as_str()) else {
            continue;
        };
        if path == mapped_path || path == target_path {
            return Ok(Some(import_match_from_item(item)));
        }
    }

    if !basename.is_empty() {
        for item in &items {
            let Some(path) = item.get("Path").and_then(|value| value.as_str()) else {
                continue;
            };
            if path.ends_with(&format!("/{basename}")) || path.ends_with(basename) {
                return Ok(Some(import_match_from_item(item)));
            }
        }
    }

    Ok(None)
}

fn import_match_from_item(item: &serde_json::Value) -> JellyfinImportMatch {
    JellyfinImportMatch {
        item_id: item
            .get("Id")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        path: item
            .get("Path")
            .and_then(|value| value.as_str())
            .map(ToString::to_string),
    }
}

fn map_jellyfin_path(target: &str, from: Option<&str>, to: Option<&str>) -> String {
    let target = normalize_path(target);
    let Some(from) = from.filter(|value| !value.trim().is_empty()) else {
        return target;
    };
    let Some(to) = to.filter(|value| !value.trim().is_empty()) else {
        return target;
    };
    let from = normalize_path(from);
    let to = normalize_path(to);
    if target == from {
        return to;
    }
    if target.starts_with(&format!("{from}/")) {
        return format!("{}{}", to, &target[from.len()..]);
    }
    target
}

fn normalize_path(value: &str) -> String {
    value.trim().replace('\\', "/").trim_end_matches('/').to_string()
}

#[tauri::command]
pub(crate) async fn refresh_jellyfin_library(
    base_url: String,
    api_key: String,
) -> Result<(), String> {
    let base_url = normalized_base_url(&base_url)?;
    reqwest::Client::new()
        .post(format!("{base_url}/Library/Refresh"))
        .header("X-Emby-Token", api_key.trim())
        .send()
        .await
        .map_err(|error| error.to_string())?
        .error_for_status()
        .map_err(|error| error.to_string())?;
    Ok(())
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

fn body_detail(body: &serde_json::Value) -> Option<String> {
    body.get("detail")
        .or_else(|| body.get("error"))
        .or_else(|| body.get("message"))
        .or_else(|| body.get("msg"))
        .and_then(|value| value.as_str())
        .map(ToString::to_string)
}
