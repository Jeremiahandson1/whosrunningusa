-- Migration 046: dedupe candidate_education and committee_memberships and
-- give them real unique keys.
--
-- Same silent-duplicate family as compliance_records (040) and
-- vote_explanations (043): candidate_education is written with a bare
-- ON CONFLICT DO NOTHING but had no unique index to conflict against, and
-- sync-committees.js inserted with no conflict clause at all — so both
-- tables grew duplicates on every sync run (education was 60% duplicate
-- rows; profiles showed every degree twice).

SET statement_timeout = '600s';

-- Dedupe education (keep the earliest row of each logical entry)
DELETE FROM candidate_education ce
 USING candidate_education ce2
 WHERE ce.id <> ce2.id
   AND ce.candidate_id = ce2.candidate_id
   AND ce.institution_name = ce2.institution_name
   AND COALESCE(ce.degree, '') = COALESCE(ce2.degree, '')
   AND COALESCE(ce.field_of_study, '') = COALESCE(ce2.field_of_study, '')
   AND COALESCE(ce.graduation_year, 0) = COALESCE(ce2.graduation_year, 0)
   AND (ce.created_at > ce2.created_at
        OR (ce.created_at = ce2.created_at AND ce.id::text > ce2.id::text));

CREATE UNIQUE INDEX IF NOT EXISTS uq_candidate_education_entry
  ON candidate_education (candidate_id, institution_name,
      COALESCE(degree, ''), COALESCE(field_of_study, ''), COALESCE(graduation_year, 0));

-- Dedupe committee memberships (keep the earliest row per candidate+committee)
DELETE FROM committee_memberships cm
 USING committee_memberships cm2
 WHERE cm.id <> cm2.id
   AND cm.candidate_id = cm2.candidate_id
   AND cm.committee_id = cm2.committee_id
   AND (cm.created_at > cm2.created_at
        OR (cm.created_at = cm2.created_at AND cm.id::text > cm2.id::text));

CREATE UNIQUE INDEX IF NOT EXISTS uq_committee_memberships_entry
  ON committee_memberships (candidate_id, committee_id);
