use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use thiserror::Error;
use uuid::Uuid;
use x25519_dalek::{PublicKey, StaticSecret};

use crate::auth::random_bytes;

const NONCE_LEN: usize = 12;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum KeyError {
    #[error("the master key must be standard base64 of exactly 32 bytes")]
    MasterKeyFormat,
    #[error("a sealed agent key could not be opened with this master key")]
    Unseal,
}

impl KeyError {
    pub fn as_str(&self) -> &'static str {
        match self {
            KeyError::MasterKeyFormat => "must be standard base64 of exactly 32 bytes",
            KeyError::Unseal => "does not open the sealed agent keys",
        }
    }
}

#[derive(Clone)]
pub struct MasterKey(Aes256Gcm);

impl std::fmt::Debug for MasterKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("MasterKey([REDACTED])")
    }
}

pub struct GeneratedKey {
    pub public_key: [u8; 32],
    pub sealed_private_key: Vec<u8>,
}

impl MasterKey {
    pub fn parse(raw: &str) -> Result<Self, KeyError> {
        let bytes = STANDARD
            .decode(raw.trim())
            .map_err(|_| KeyError::MasterKeyFormat)?;
        if bytes.len() != 32 {
            return Err(KeyError::MasterKeyFormat);
        }
        Aes256Gcm::new_from_slice(&bytes)
            .map(Self)
            .map_err(|_| KeyError::MasterKeyFormat)
    }

    pub fn generate_agent_key(&self, key_id: Uuid) -> GeneratedKey {
        let secret = StaticSecret::from(random_bytes::<32>());
        let public_key = PublicKey::from(&secret).to_bytes();
        GeneratedKey {
            public_key,
            sealed_private_key: self.seal(key_id.as_bytes(), secret.as_bytes()),
        }
    }

    pub fn open_agent_key(&self, key_id: Uuid, sealed: &[u8]) -> Result<StaticSecret, KeyError> {
        let bytes = self.open(key_id.as_bytes(), sealed)?;
        let bytes: [u8; 32] = bytes.try_into().map_err(|_| KeyError::Unseal)?;
        Ok(StaticSecret::from(bytes))
    }

    pub fn seal(&self, label: &[u8], plaintext: &[u8]) -> Vec<u8> {
        let nonce_bytes = random_bytes::<NONCE_LEN>();
        let nonce = Nonce::try_from(&nonce_bytes[..]).expect("the nonce has the cipher's length");
        let ciphertext = self
            .0
            .encrypt(
                &nonce,
                Payload {
                    msg: plaintext,
                    aad: label,
                },
            )
            .expect("AES-GCM seals a 32 byte key");
        let mut sealed = nonce_bytes.to_vec();
        sealed.extend_from_slice(&ciphertext);
        sealed
    }

    pub fn open(&self, label: &[u8], sealed: &[u8]) -> Result<Vec<u8>, KeyError> {
        if sealed.len() <= NONCE_LEN {
            return Err(KeyError::Unseal);
        }
        let (nonce_bytes, ciphertext) = sealed.split_at(NONCE_LEN);
        let nonce = Nonce::try_from(nonce_bytes).map_err(|_| KeyError::Unseal)?;
        self.0
            .decrypt(
                &nonce,
                Payload {
                    msg: ciphertext,
                    aad: label,
                },
            )
            .map_err(|_| KeyError::Unseal)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn master() -> MasterKey {
        MasterKey::parse(&STANDARD.encode(random_bytes::<32>())).unwrap()
    }

    #[test]
    fn sealed_keys_open_only_with_their_master_key_and_id() {
        let master = master();
        let id = Uuid::now_v7();
        let key = master.generate_agent_key(id);
        let opened = master.open_agent_key(id, &key.sealed_private_key).unwrap();
        assert_eq!(PublicKey::from(&opened).to_bytes(), key.public_key);
        assert!(
            master
                .open_agent_key(Uuid::now_v7(), &key.sealed_private_key)
                .is_err()
        );
        assert!(
            super::tests::master()
                .open_agent_key(id, &key.sealed_private_key)
                .is_err()
        );
    }

    #[test]
    fn master_keys_must_be_32_bytes_of_base64() {
        assert_eq!(
            MasterKey::parse("short").unwrap_err(),
            KeyError::MasterKeyFormat
        );
        assert!(MasterKey::parse(&STANDARD.encode([7u8; 31])).is_err());
        assert!(MasterKey::parse(&STANDARD.encode([7u8; 32])).is_ok());
    }
}
