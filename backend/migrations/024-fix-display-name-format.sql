-- Fix display names stored in "Lastname, Firstname Middle 'Nickname'" format
-- Reorder to "Firstname Lastname" or "Nickname Lastname" if nickname present

-- Step 1: Handle names with nicknames in single quotes: "Cruz, Rafael Edward 'Ted'" → "Ted Cruz"
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

-- Step 2: Handle remaining "Lastname, Firstname ..." names (no nickname)
-- Only match if comma appears before position 30 (avoids matching suffixes at end of name)
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
  AND display_name NOT LIKE '%''%';  -- Step 1 already handled nickname cases

-- Step 3: Fix Mc/O' casing that INITCAP breaks
UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, 'Mc([a-z])', 'Mc' || UPPER(SUBSTRING(display_name FROM 'Mc([a-z])')), 'g')
WHERE display_name ~ 'Mc[a-z]';

UPDATE candidate_profiles
SET display_name = REGEXP_REPLACE(display_name, 'O''([a-z])', 'O''' || UPPER(SUBSTRING(display_name FROM 'O''([a-z])')), 'g')
WHERE display_name ~ 'O''[a-z]';
