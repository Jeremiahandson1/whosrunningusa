-- Migration 032: Widget System
-- Embeddable widget API keys, analytics tracking, and ROI entity data

-- =========================================================================
-- Widget API Keys — for white-label and tracking
-- =========================================================================

CREATE TABLE IF NOT EXISTS widget_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_hash VARCHAR(128) UNIQUE NOT NULL,
    key_prefix VARCHAR(12) NOT NULL,
    organization_name VARCHAR(300) NOT NULL,
    is_white_label BOOLEAN DEFAULT FALSE,
    domain_allowlist TEXT[],
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wak_prefix ON widget_api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_wak_active ON widget_api_keys(is_active) WHERE is_active = TRUE;

-- =========================================================================
-- Widget Analytics — embed tracking without user data
-- =========================================================================

CREATE TABLE IF NOT EXISTS widget_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_type VARCHAR(50) NOT NULL,
    host_domain VARCHAR(500) NOT NULL,
    event_type VARCHAR(20) CHECK (event_type IN ('embed', 'interaction', 'click', 'error')) NOT NULL,
    event_data JSONB DEFAULT '{}',
    api_key_id UUID REFERENCES widget_api_keys(id) ON DELETE SET NULL,
    ip_hash VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_widget_type ON widget_analytics(widget_type);
CREATE INDEX IF NOT EXISTS idx_wa_host_domain ON widget_analytics(host_domain);
CREATE INDEX IF NOT EXISTS idx_wa_created ON widget_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_wa_event_type ON widget_analytics(event_type);

-- =========================================================================
-- Political ROI Entities — for ROI Calculator widget
-- =========================================================================

CREATE TABLE IF NOT EXISTS political_roi_entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_slug VARCHAR(200) UNIQUE NOT NULL,
    entity_name VARCHAR(500) NOT NULL,
    entity_type VARCHAR(30) CHECK (entity_type IN ('corporation', 'industry', 'pac', 'individual', 'union')) NOT NULL,
    total_political_spend DECIMAL(16,2) DEFAULT 0,
    total_policy_return DECIMAL(16,2) DEFAULT 0,
    roi_ratio DECIMAL(10,2),
    cycle_year INTEGER,
    top_politicians JSONB DEFAULT '[]',
    top_contracts JSONB DEFAULT '[]',
    methodology_note TEXT,
    source_urls TEXT[],
    last_computed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roi_slug ON political_roi_entities(entity_slug);
CREATE INDEX IF NOT EXISTS idx_roi_type ON political_roi_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_roi_ratio ON political_roi_entities(roi_ratio DESC);
CREATE INDEX IF NOT EXISTS idx_roi_cycle ON political_roi_entities(cycle_year);
