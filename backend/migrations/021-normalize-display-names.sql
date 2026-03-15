-- Migration 021: Normalize display_name to consistent title case
-- FEC names come as "BALDWIN, TAMMY" — convert to "Baldwin, Tammy"
-- Open States names come as "Tammy Baldwin" — already fine or mixed case
-- INITCAP handles most cases; we fix common patterns like Mc/Mac/O' after

-- Step 1: Convert all-caps names to title case using INITCAP
UPDATE candidate_profiles
SET display_name = INITCAP(display_name),
    updated_at = NOW()
WHERE display_name = UPPER(display_name)
  AND LENGTH(display_name) > 1;

-- Step 2: Fix "Mc" names (INITCAP turns "MCDONALD" into "Mcdonald", should be "McDonald")
UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, '\mMc([a-z])', 'Mc' || UPPER(SUBSTRING(display_name FROM POSITION('Mc' IN display_name) + 2 FOR 1)), 'g'),
    updated_at = NOW()
WHERE display_name ~* '\bMc[a-z]'
  AND display_name !~ '\bMc[A-Z]';

-- Simpler approach for Mc: just do a targeted fix
UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, 'Mc([a-z])', 'Mc' || UPPER('\1'), 'g'),
    updated_at = NOW()
WHERE display_name ~ 'Mc[a-z]';

-- Step 3: Fix "O'" names (INITCAP turns "O'BRIEN" into "O'Brien" which is correct,
-- but "O'brien" should also be "O'Brien")
UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, E'O''([a-z])', E'O''' || UPPER('\1'), 'g'),
    updated_at = NOW()
WHERE display_name ~ E'O''[a-z]';
