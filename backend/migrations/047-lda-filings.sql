-- Senate LDA (Lobbying Disclosure Act) filings, synced for foreign-linked
-- clients. Provides disclosed lobbying dollar amounts that FARA's API lacks;
-- the influence chain reads SUM(income/expenses) by client_country_code.
CREATE TABLE IF NOT EXISTS lda_filings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filing_uuid VARCHAR(50) UNIQUE NOT NULL,
    filing_type VARCHAR(10),
    filing_year INTEGER NOT NULL,
    filing_period VARCHAR(20),
    registrant_name VARCHAR(500),
    client_name VARCHAR(500),
    client_country VARCHAR(100),
    client_country_code VARCHAR(3),
    income DECIMAL(14,2),
    expenses DECIMAL(14,2),
    source_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lda_country ON lda_filings(client_country_code);
CREATE INDEX IF NOT EXISTS idx_lda_year ON lda_filings(filing_year);
