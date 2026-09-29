//! Windows DPAPI (Data Protection API) für Credential-Schutz.
//!
//! Verwendet `CryptProtectData` / `CryptUnprotectData` über FFI.
//! Der Schlüssel wird vom OS verwaltet (User-Profil / Machine-Kontext),
//! keine Passwort-basierte Ableitung nötig — sicherer als PBKDF2 für lokale Apps.

#[cfg(windows)]
mod imp {
    use std::ffi::c_void;
    use std::ptr;

    // Windows Crypto API Konstanten
    const CRYPTPROTECT_UI_FORBIDDEN: u32 = 0x1;

    #[repr(C)]
    struct DataBlob {
        cb_data: u32,
        pb_data: *mut u8,
    }

    #[link(name = "crypt32")]
    extern "system" {
        fn CryptProtectData(
            p_data_in: *const DataBlob,
            sz_data_descr: *const u16,
            p_optional_entropy: *const DataBlob,
            pv_reserved: *const c_void,
            p_prompt_struct: *const c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;

        fn CryptUnprotectData(
            p_data_in: *const DataBlob,
            ppsz_data_descr: *mut *mut u16,
            p_optional_entropy: *const DataBlob,
            pv_reserved: *const c_void,
            p_prompt_struct: *const c_void,
            dw_flags: u32,
            p_data_out: *mut DataBlob,
        ) -> i32;

        fn LocalFree(h_mem: *mut c_void) -> *mut c_void;
    }

    fn to_wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    fn blob_from_vec(data: &[u8]) -> DataBlob {
        DataBlob {
            cb_data: data.len() as u32,
            pb_data: data.as_ptr() as *mut u8,
        }
    }

    fn blob_to_vec(blob: DataBlob) -> Vec<u8> {
        let slice = unsafe { std::slice::from_raw_parts(blob.pb_data, blob.cb_data as usize) };
        let vec = slice.to_vec();
        unsafe { LocalFree(blob.pb_data as *mut c_void) };
        vec
    }

    /// Verschlüsselt Daten mit DPAPI (Current User Scope).
    /// Gibt Base64-kodierten Ciphertext zurück.
    pub fn dpapi_protect(data: &[u8], entropy: Option<&[u8]>) -> Result<String, String> {
        let blob_in = blob_from_vec(data);
        let mut blob_out = DataBlob { cb_data: 0, pb_data: ptr::null_mut() };
        let descr = to_wide("AI Writer Studio Credentials");
        let entropy_blob = entropy.map(blob_from_vec);
        let entropy_ptr = entropy_blob.as_ref().map_or(ptr::null(), |b| b as *const DataBlob);

        let ok = unsafe {
            CryptProtectData(
                &blob_in,
                descr.as_ptr(),
                entropy_ptr,
                ptr::null(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut blob_out,
            )
        };

        if ok == 0 {
            return Err("CryptProtectData fehlgeschlagen".into());
        }
        let out = blob_to_vec(blob_out);
        use base64::Engine;
        Ok(base64::engine::general_purpose::STANDARD.encode(out))
    }

    /// Entschlüsselt Daten mit DPAPI.
    pub fn dpapi_unprotect(ciphertext_b64: &str, entropy: Option<&[u8]>) -> Result<Vec<u8>, String> {
        use base64::Engine;
        let ciphertext = base64::engine::general_purpose::STANDARD.decode(ciphertext_b64)
            .map_err(|e| format!("Base64-Decode fehlgeschlagen: {e}"))?;
        let blob_in = blob_from_vec(&ciphertext);
        let mut blob_out = DataBlob { cb_data: 0, pb_data: ptr::null_mut() };
        let mut descr_ptr: *mut u16 = ptr::null_mut();
        let entropy_blob = entropy.map(blob_from_vec);
        let entropy_ptr = entropy_blob.as_ref().map_or(ptr::null(), |b| b as *const DataBlob);

        let ok = unsafe {
            CryptUnprotectData(
                &blob_in,
                &mut descr_ptr,
                entropy_ptr,
                ptr::null(),
                ptr::null(),
                CRYPTPROTECT_UI_FORBIDDEN,
                &mut blob_out,
            )
        };

        if ok == 0 {
            return Err("CryptUnprotectData fehlgeschlagen (falscher User/Maschine oder Daten korrupt)".into());
        }
        let out = blob_to_vec(blob_out);
        if !descr_ptr.is_null() {
            unsafe { LocalFree(descr_ptr as *mut c_void) };
        }
        Ok(out)
    }
}

#[cfg(not(windows))]
mod imp {
    pub fn dpapi_protect(_data: &[u8], _entropy: Option<&[u8]>) -> Result<String, String> {
        Err("DPAPI nur auf Windows verfügbar".into())
    }
    pub fn dpapi_unprotect(_ciphertext_b64: &str, _entropy: Option<&[u8]>) -> Result<Vec<u8>, String> {
        Err("DPAPI nur auf Windows verfügbar".into())
    }
}

/// Verschlüsselt Daten mit Windows DPAPI (User-Scope).
/// `entropy` ist optionaler zusätzlicher Geheimwert (z.B. App-spezifisch).
/// Rückgabe: Base64-String.
#[tauri::command]
pub async fn dpapi_protect(data: String, entropy: Option<String>) -> Result<String, String> {
    let entropy_bytes = entropy.map(|s| s.into_bytes());
    imp::dpapi_protect(data.as_bytes(), entropy_bytes.as_deref())
}

/// Entschlüsselt Daten mit Windows DPAPI.
/// `entropy` muss derselbe Wert sein wie beim Verschlüsseln.
/// Rückgabe: Klartext-String (UTF-8).
#[tauri::command]
pub async fn dpapi_unprotect(ciphertext_b64: String, entropy: Option<String>) -> Result<String, String> {
    let entropy_bytes = entropy.map(|s| s.into_bytes());
    let plain = imp::dpapi_unprotect(&ciphertext_b64, entropy_bytes.as_deref())?;
    String::from_utf8(plain).map_err(|e| format!("UTF-8-Decode fehlgeschlagen: {e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    #[cfg(windows)]
    fn dpapi_roundtrip() {
        let plaintext = "test-secret-123";
        let entropy = Some(b"app-specific-entropy".as_slice());
        let cipher = imp::dpapi_protect(plaintext.as_bytes(), entropy).expect("protect failed");
        let decrypted = imp::dpapi_unprotect(&cipher, entropy).expect("unprotect failed");
        assert_eq!(String::from_utf8(decrypted).unwrap(), plaintext);
    }

    #[test]
    #[cfg(windows)]
    fn dpapi_wrong_entropy_fails() {
        let plaintext = "test-secret";
        let cipher = imp::dpapi_protect(plaintext.as_bytes(), Some(b"entropy1")).unwrap();
        let result = imp::dpapi_unprotect(&cipher, Some(b"entropy2"));
        assert!(result.is_err());
    }
}