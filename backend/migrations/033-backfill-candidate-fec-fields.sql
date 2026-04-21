-- Backfill fec_state / fec_office_type / office_level on existing candidate
-- profiles that were ingested without the structured fields (e.g. from the
-- unitedstates/congress-legislators dataset). Derives from official_title.
--
-- Safe to re-run: only updates rows where the target column is currently NULL.

-- 1) fec_state from the state name embedded in official_title
WITH state_map(name, abbr) AS (
  VALUES
    ('Alabama','AL'),('Alaska','AK'),('Arizona','AZ'),('Arkansas','AR'),
    ('California','CA'),('Colorado','CO'),('Connecticut','CT'),('Delaware','DE'),
    ('Florida','FL'),('Georgia','GA'),('Hawaii','HI'),('Idaho','ID'),
    ('Illinois','IL'),('Indiana','IN'),('Iowa','IA'),('Kansas','KS'),
    ('Kentucky','KY'),('Louisiana','LA'),('Maine','ME'),('Maryland','MD'),
    ('Massachusetts','MA'),('Michigan','MI'),('Minnesota','MN'),('Mississippi','MS'),
    ('Missouri','MO'),('Montana','MT'),('Nebraska','NE'),('Nevada','NV'),
    ('New Hampshire','NH'),('New Jersey','NJ'),('New Mexico','NM'),('New York','NY'),
    ('North Carolina','NC'),('North Dakota','ND'),('Ohio','OH'),('Oklahoma','OK'),
    ('Oregon','OR'),('Pennsylvania','PA'),('Rhode Island','RI'),('South Carolina','SC'),
    ('South Dakota','SD'),('Tennessee','TN'),('Texas','TX'),('Utah','UT'),
    ('Vermont','VT'),('Virginia','VA'),('Washington','WA'),('West Virginia','WV'),
    ('Wisconsin','WI'),('Wyoming','WY'),('District of Columbia','DC')
)
UPDATE candidate_profiles cp
SET fec_state = sm.abbr
FROM state_map sm
WHERE cp.fec_state IS NULL
  AND cp.official_title IS NOT NULL
  AND cp.official_title ILIKE '%' || sm.name || '%';

-- 2) fec_office_type from office title keywords
UPDATE candidate_profiles
SET fec_office_type = CASE
  WHEN official_title ILIKE '%U.S. Representative%' OR official_title ILIKE '%House Representative%' THEN 'H'
  WHEN official_title ILIKE '%U.S. Senator%' OR official_title ILIKE '%U.S. Senate%' THEN 'S'
  WHEN official_title ILIKE '%President of the United States%' THEN 'P'
  ELSE fec_office_type
END
WHERE fec_office_type IS NULL AND official_title IS NOT NULL;

-- 3) fec_district from "District NN" in the title (House only)
UPDATE candidate_profiles
SET fec_district = LPAD((regexp_match(official_title, 'District\s+(\d+)'))[1], 2, '0')
WHERE fec_district IS NULL
  AND fec_office_type = 'H'
  AND official_title ~ 'District\s+\d+';
