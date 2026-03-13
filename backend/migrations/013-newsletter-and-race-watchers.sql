-- Migration 013: Newsletter subscribers and race watchers tables

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS race_watchers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    race_id UUID REFERENCES races(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, race_id)
);

CREATE INDEX IF NOT EXISTS idx_race_watchers_user ON race_watchers(user_id);
CREATE INDEX IF NOT EXISTS idx_race_watchers_race ON race_watchers(race_id);
