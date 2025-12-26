use aes_gcm::{
    aead::{Aead, KeyInit, OsRng},
    Aes256Gcm, Nonce,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use rand::RngCore;

// 32-byte encryption key (256 bits for AES-256)
// In production, this should be stored more securely (e.g., OS Keychain, environment variable)
const ENCRYPTION_KEY: &[u8; 32] = b"TauriAppSecureKey2024SecretK!@#$";

/// Encrypts a plaintext password using AES-256-GCM.
/// Returns a Base64-encoded string containing the nonce (12 bytes) + ciphertext.
pub fn encrypt_password(plaintext: &str) -> Result<String, String> {
    if plaintext.is_empty() {
        return Ok(String::new());
    }

    let cipher = Aes256Gcm::new_from_slice(ENCRYPTION_KEY)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    // Generate a random 12-byte nonce
    let mut nonce_bytes = [0u8; 12];
    OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    // Encrypt the plaintext
    let ciphertext = cipher
        .encrypt(nonce, plaintext.as_bytes())
        .map_err(|e| format!("Encryption failed: {}", e))?;

    // Combine nonce + ciphertext and encode as Base64
    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(BASE64.encode(&combined))
}

/// Decrypts a Base64-encoded ciphertext (nonce + encrypted data) back to plaintext.
pub fn decrypt_password(ciphertext_b64: &str) -> Result<String, String> {
    if ciphertext_b64.is_empty() {
        return Ok(String::new());
    }

    let combined = BASE64
        .decode(ciphertext_b64)
        .map_err(|e| format!("Base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("Invalid ciphertext: too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(ENCRYPTION_KEY)
        .map_err(|e| format!("Failed to create cipher: {}", e))?;

    let plaintext_bytes = cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("Decryption failed: {}", e))?;

    String::from_utf8(plaintext_bytes).map_err(|e| format!("UTF-8 decode failed: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt_roundtrip() {
        let original = "my_secret_password_123!";
        let encrypted = encrypt_password(original).expect("Encryption should succeed");
        
        // Encrypted should be different from original
        assert_ne!(encrypted, original);
        
        // Decryption should return the original
        let decrypted = decrypt_password(&encrypted).expect("Decryption should succeed");
        assert_eq!(decrypted, original);
    }

    #[test]
    fn test_empty_password() {
        let encrypted = encrypt_password("").expect("Should handle empty");
        assert_eq!(encrypted, "");
        
        let decrypted = decrypt_password("").expect("Should handle empty");
        assert_eq!(decrypted, "");
    }

    #[test]
    fn test_unicode_password() {
        let original = "密码测试 Пароль 🔐";
        let encrypted = encrypt_password(original).expect("Should handle unicode");
        let decrypted = decrypt_password(&encrypted).expect("Should decrypt unicode");
        assert_eq!(decrypted, original);
    }
}
