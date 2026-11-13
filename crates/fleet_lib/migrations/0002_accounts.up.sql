CREATE TYPE org_role AS ENUM ('owner', 'admin', 'member');

CREATE TYPE access_level AS ENUM ('read', 'write', 'admin');

CREATE TABLE users (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    email varchar(320) NOT NULL,
    name varchar(255) NOT NULL,
    password_hash text,
    instance_admin boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX users_email_key ON users (lower(email));

CREATE TABLE user_identities (
    provider varchar(32) NOT NULL,
    subject varchar(255) NOT NULL,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (provider, subject)
);

CREATE INDEX user_identities_user_idx ON user_identities (user_id);

CREATE TABLE sessions (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_seen_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    user_agent text,
    CONSTRAINT sessions_token_hash_key UNIQUE (token_hash)
);

CREATE INDEX sessions_user_idx ON sessions (user_id);

CREATE TABLE password_resets (
    token_hash bytea PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL
);

CREATE INDEX password_resets_user_idx ON password_resets (user_id);

CREATE TABLE instance_setup (
    singleton boolean PRIMARY KEY DEFAULT true,
    token text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT instance_setup_singleton_check CHECK (singleton)
);

CREATE TABLE organizations (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    name varchar(1000) NOT NULL,
    slug varchar(56) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT organizations_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT organizations_slug_reserved_check CHECK (slug NOT IN (
        'admin', 'api', 'assets', 'auth', 'health', 'invite', 'login', 'logout', 'new',
        'profile', 'reset-password', 'settings', 'setup', 'signup'
    )),
    CONSTRAINT organizations_slug_key UNIQUE (slug)
);

CREATE TABLE org_members (
    org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    role org_role NOT NULL DEFAULT 'member',
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (org_id, user_id)
);

CREATE INDEX org_members_user_idx ON org_members (user_id);

CREATE TABLE groups (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name varchar(1000) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT groups_org_id_id_key UNIQUE (org_id, id),
    CONSTRAINT groups_org_name_key UNIQUE (org_id, name)
);

CREATE TABLE group_members (
    org_id uuid NOT NULL,
    group_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (group_id, user_id),
    FOREIGN KEY (org_id, group_id) REFERENCES groups (org_id, id) ON DELETE CASCADE,
    FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id) ON DELETE CASCADE
);

CREATE INDEX group_members_user_idx ON group_members (org_id, user_id);

CREATE TABLE org_invitations (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    email varchar(320) NOT NULL,
    role org_role NOT NULL DEFAULT 'member',
    token_hash bytea NOT NULL,
    invited_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CONSTRAINT org_invitations_token_hash_key UNIQUE (token_hash)
);

CREATE UNIQUE INDEX org_invitations_email_key ON org_invitations (org_id, lower(email));

CREATE TABLE agent_keys (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name varchar(1000) NOT NULL,
    public_key bytea NOT NULL,
    sealed_private_key bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT agent_keys_public_key_length_check CHECK (octet_length(public_key) = 32),
    CONSTRAINT agent_keys_org_id_id_key UNIQUE (org_id, id),
    CONSTRAINT agent_keys_org_name_key UNIQUE (org_id, name)
);

CREATE TABLE fleets (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
    name varchar(1000) NOT NULL,
    slug varchar(56) NOT NULL,
    agent_key_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fleets_slug_format_check CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    CONSTRAINT fleets_slug_reserved_check CHECK (slug NOT IN ('settings', 'new')),
    CONSTRAINT fleets_org_id_id_key UNIQUE (org_id, id),
    CONSTRAINT fleets_org_slug_key UNIQUE (org_id, slug),
    CONSTRAINT fleets_agent_key_fkey FOREIGN KEY (org_id, agent_key_id) REFERENCES agent_keys (org_id, id)
);

CREATE INDEX fleets_agent_key_idx ON fleets (org_id, agent_key_id);

CREATE TABLE fleet_grants (
    id uuid PRIMARY KEY DEFAULT uuidv7(),
    org_id uuid NOT NULL,
    fleet_id uuid NOT NULL,
    user_id uuid,
    group_id uuid,
    level access_level NOT NULL,
    created_by uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT fleet_grants_one_subject_check CHECK ((user_id IS NULL) <> (group_id IS NULL)),
    FOREIGN KEY (org_id, fleet_id) REFERENCES fleets (org_id, id) ON DELETE CASCADE,
    FOREIGN KEY (org_id, user_id) REFERENCES org_members (org_id, user_id) ON DELETE CASCADE,
    FOREIGN KEY (org_id, group_id) REFERENCES groups (org_id, id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX fleet_grants_user_key ON fleet_grants (fleet_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX fleet_grants_group_key ON fleet_grants (fleet_id, group_id) WHERE group_id IS NOT NULL;
CREATE INDEX fleet_grants_user_idx ON fleet_grants (org_id, user_id) WHERE user_id IS NOT NULL;
CREATE INDEX fleet_grants_group_idx ON fleet_grants (org_id, group_id) WHERE group_id IS NOT NULL;
