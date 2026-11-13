ALTER TABLE user_identities ADD COLUMN email varchar(320);

CREATE UNIQUE INDEX user_identities_user_provider_key ON user_identities (user_id, provider);
