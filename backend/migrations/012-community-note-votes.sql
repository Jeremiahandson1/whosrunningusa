-- Community note votes table for tracking who voted on community notes
CREATE TABLE IF NOT EXISTS community_note_votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    note_id UUID REFERENCES community_notes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    vote VARCHAR(20) NOT NULL CHECK (vote IN ('helpful', 'not_helpful')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(note_id, user_id)
);
