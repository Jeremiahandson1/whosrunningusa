-- Migration 041: re-normalize "Lastname, Firstname" display names.
--
-- Migration 024 did this once, but sync-congress-gov.js kept writing
-- congress.gov's raw "Last, First" member name on every nightly run,
-- silently undoing it (the sync now formats names before writing — this
-- migration converges what's already stored). Also handles double-quoted
-- nicknames ('Johnson, Henry C. "Hank"' → 'Hank Johnson'), which 024's
-- single-quote pattern missed.

-- Step 0: double-quoted nicknames
UPDATE candidate_profiles
SET display_name = INITCAP(
  TRIM(
    SUBSTRING(
      SUBSTRING(display_name FROM POSITION(',' IN display_name) + 1)
      FROM '"([^"]+)"'
    )
  )
) || ' ' || INITCAP(TRIM(SUBSTRING(display_name FROM 1 FOR POSITION(',' IN display_name) - 1)))
WHERE display_name ~ '^[^,]+, .*"[^"]+"';

-- Step 1: single-quoted nicknames: "Cruz, Rafael Edward 'Ted'" → "Ted Cruz"
UPDATE candidate_profiles
SET display_name = INITCAP(
  TRIM(
    SUBSTRING(
      SUBSTRING(display_name FROM POSITION(',' IN display_name) + 1)
      FROM '''([^'']+)'''
    )
  )
) || ' ' || INITCAP(TRIM(SUBSTRING(display_name FROM 1 FOR POSITION(',' IN display_name) - 1)))
WHERE display_name ~ '^[^,]+, .+''[^'']+''';

-- Step 2: remaining "Lastname, Firstname ..." names (no nickname)
UPDATE candidate_profiles
SET display_name = INITCAP(
  TRIM(
    SPLIT_PART(
      TRIM(SUBSTRING(display_name FROM POSITION(',' IN display_name) + 1)),
      ' ', 1
    )
  )
) || ' ' || INITCAP(TRIM(SUBSTRING(display_name FROM 1 FOR POSITION(',' IN display_name) - 1)))
WHERE display_name LIKE '%,%'
  AND POSITION(',' IN display_name) <= 30
  AND display_name NOT LIKE '%''%';

-- Step 3: fix Mc/O' casing that INITCAP breaks
UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, 'Mc([a-z])', 'Mc' || UPPER(SUBSTRING(display_name FROM 'Mc([a-z])')), 'g')
WHERE display_name ~ 'Mc[a-z]';

UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, 'O''([a-z])', 'O''' || UPPER(SUBSTRING(display_name FROM 'O''([a-z])')), 'g')
WHERE display_name ~ 'O''[a-z]';
