CREATE TABLE IF NOT EXISTS app_user (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    username citext UNIQUE NOT NULL,
    password_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;

CREATE TABLE IF NOT EXISTS auth_session (
    token text PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz
);
COMMIT;

CREATE INDEX IF NOT EXISTS idx_auth_session_user_id ON auth_session(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_session_expires_at ON auth_session(expires_at);
COMMIT;

CREATE TABLE IF NOT EXISTS planner_state (
    user_id uuid PRIMARY KEY REFERENCES app_user(id) ON DELETE CASCADE,
    state jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;

INSERT INTO app_user (username, password_hash)
VALUES (
    'test',
    'pbkdf2_sha256$200000$9c8d269bb5ba0722108f119b3cc0051a$51331708cf5b218cc7ec05f3280d6ea586c90f3821acdb45283f443f3d6b1ef6'
)
ON CONFLICT (username) DO NOTHING;
COMMIT;
