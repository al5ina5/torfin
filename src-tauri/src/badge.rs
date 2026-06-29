#[tauri::command]
pub(crate) fn set_dock_badge(label: Option<String>) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        unsafe {
            use objc::{class, msg_send, sel, sel_impl};
            use std::ffi::CString;

            let app: *mut objc::runtime::Object =
                msg_send![class!(NSApplication), sharedApplication];
            let dock_tile: *mut objc::runtime::Object = msg_send![app, dockTile];

            if let Some(text) = label.filter(|value| !value.trim().is_empty()) {
                let c_string = CString::new(text).map_err(|error| error.to_string())?;
                let ns_string: *mut objc::runtime::Object =
                    msg_send![class!(NSString), stringWithUTF8String: c_string.as_ptr()];
                let _: () = msg_send![dock_tile, setBadgeLabel: ns_string];
            } else {
                let _: () =
                    msg_send![dock_tile, setBadgeLabel: std::ptr::null::<objc::runtime::Object>()];
            }
        }
        return Ok(());
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = label;
        Ok(())
    }
}
