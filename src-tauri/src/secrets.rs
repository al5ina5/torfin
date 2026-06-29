const SERVICE_NAME: &str = "com.torbox.streamdeck";

#[tauri::command]
pub(crate) fn get_secret(key: String) -> Result<Option<String>, String> {
    let normalized = normalize_secret_key(&key)?;
    let entry =
        keyring::Entry::new(SERVICE_NAME, normalized.as_str()).map_err(map_keyring_error)?;
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(error) => {
            if matches!(error, keyring::Error::NoEntry) {
                Ok(None)
            } else {
                Err(map_keyring_error(error))
            }
        }
    }
}

#[tauri::command]
pub(crate) fn set_secret(key: String, value: String) -> Result<(), String> {
    let normalized = normalize_secret_key(&key)?;
    if value.trim().is_empty() {
        return Err("Secret value cannot be empty.".to_string());
    }
    let entry =
        keyring::Entry::new(SERVICE_NAME, normalized.as_str()).map_err(map_keyring_error)?;
    entry.set_password(&value).map_err(map_keyring_error)
}

#[tauri::command]
pub(crate) fn delete_secret(key: String) -> Result<(), String> {
    let normalized = normalize_secret_key(&key)?;
    let entry =
        keyring::Entry::new(SERVICE_NAME, normalized.as_str()).map_err(map_keyring_error)?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(error) => {
            if matches!(error, keyring::Error::NoEntry) {
                Ok(())
            } else {
                Err(map_keyring_error(error))
            }
        }
    }
}

fn normalize_secret_key(key: &str) -> Result<String, String> {
    let normalized = key.trim().to_lowercase();
    match normalized.as_str() {
        "torbox_api_key" | "jellyfin_api_key" | "ssh_password" => Ok(normalized),
        _ => Err("Unsupported secret key.".to_string()),
    }
}

fn map_keyring_error(error: keyring::Error) -> String {
    error.to_string()
}
