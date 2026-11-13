use sqlx::PgPool;

#[derive(Clone)]
pub struct AppContext {
    pub db: PgPool,
}

impl AppContext {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }
}
