use argon2::Argon2;
use argon2::password_hash::phc::PasswordHash;
use argon2::password_hash::{PasswordHasher, PasswordVerifier};
use base64::Engine;
use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use sha2::{Digest, Sha256};
use time::Duration;

pub const SESSION_IDLE: Duration = Duration::days(30);
pub const INVITATION_TTL: Duration = Duration::days(14);
pub const PASSWORD_RESET_TTL: Duration = Duration::days(2);
pub const MIN_PASSWORD_LEN: usize = 10;
pub const MAX_PASSWORD_LEN: usize = 1024;

pub fn random_bytes<const N: usize>() -> [u8; N] {
    let mut bytes = [0u8; N];
    getrandom::fill(&mut bytes).expect("the operating system provides randomness");
    bytes
}

pub fn random_token() -> String {
    URL_SAFE_NO_PAD.encode(random_bytes::<32>())
}

pub fn hash(token: &str) -> Vec<u8> {
    Sha256::digest(token.as_bytes()).to_vec()
}

pub fn hash_password(password: &str) -> String {
    Argon2::default()
        .hash_password(password.as_bytes())
        .expect("argon2 hashes any password with default parameters")
        .to_string()
}

pub fn verify_password(password: &str, phc: &str) -> bool {
    PasswordHash::new(phc).is_ok_and(|parsed| {
        Argon2::default()
            .verify_password(password.as_bytes(), &parsed)
            .is_ok()
    })
}

pub fn is_password_hash(phc: &str) -> bool {
    PasswordHash::new(phc).is_ok_and(|parsed| parsed.algorithm.as_str().starts_with("argon2"))
}

pub fn dummy_verify(password: &str) {
    static DUMMY: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let phc = DUMMY.get_or_init(|| hash_password("not a real password"));
    let _ = verify_password(password, phc);
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn passwords_verify_only_against_their_own_hash() {
        let phc = hash_password("correct horse battery staple");
        assert!(is_password_hash(&phc));
        assert!(verify_password("correct horse battery staple", &phc));
        assert!(!verify_password("correct horse battery stable", &phc));
        assert!(!verify_password("anything", "not a hash"));
    }

    #[test]
    fn tokens_are_random_and_hash_to_32_bytes() {
        let (a, b) = (random_token(), random_token());
        assert_ne!(a, b);
        assert_eq!(a.len(), 43);
        assert_eq!(hash(&a).len(), 32);
        assert_eq!(hash(&a), hash(&a));
    }
}
