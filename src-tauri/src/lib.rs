mod badge;
mod downloads;
mod jellyfin;
mod secrets;
mod torbox;
mod transcode;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            badge::set_dock_badge,
            torbox::fetch_json,
            torbox::get_torbox_account,
            torbox::resolve_torbox_stream,
            transcode::inspect_media,
            transcode::start_hls_transcode,
            downloads::cancel_remote_url_download,
            downloads::start_qbittorrent_download,
            downloads::get_qbittorrent_download,
            downloads::start_remote_url_download,
            downloads::get_remote_url_download,
            downloads::test_ssh_connection,
            downloads::start_local_url_download,
            downloads::get_local_url_download,
            downloads::cancel_local_url_download,
            jellyfin::lookup_jellyfin_library,
            jellyfin::test_jellyfin,
            jellyfin::authenticate_jellyfin,
            jellyfin::refresh_jellyfin_library,
            jellyfin::verify_jellyfin_import,
            secrets::get_secret,
            secrets::set_secret,
            secrets::delete_secret
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
