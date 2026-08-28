ALTER TABLE user_program_profile
    ADD COLUMN IF NOT EXISTS interests text[] DEFAULT '{}'::text[],
    ADD COLUMN IF NOT EXISTS career_direction text,
    ADD COLUMN IF NOT EXISTS recommendation_toggles jsonb DEFAULT '{"interest": true, "similarity": true, "sequence": true, "completed": true, "internship": true}'::jsonb;
COMMIT;
