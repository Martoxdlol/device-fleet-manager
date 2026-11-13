use thiserror::Error;

#[derive(Debug, Error)]
pub enum RepoError {
    #[error("database error: {0}")]
    Database(#[from] sqlx::Error),
}

pub type RepoResult<T> = Result<T, RepoError>;
