DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'term_availability') THEN
        CREATE TYPE term_availability AS ENUM ('winter', 'summer', 'both');
    END IF;
END $$;
COMMIT;

ALTER TABLE course
    ADD COLUMN IF NOT EXISTS term_availability term_availability NOT NULL DEFAULT 'both';
COMMIT;

CREATE TABLE IF NOT EXISTS user_program_profile (
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    program_code text NOT NULL,
    start_term_season term_availability NOT NULL DEFAULT 'winter',
    start_term_year int NOT NULL CHECK (start_term_year >= 1900 AND start_term_year <= 2600),
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, program_code)
);
COMMIT;

CREATE TABLE IF NOT EXISTS user_course_term_override (
    user_id uuid NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    program_code text NOT NULL,
    course_code text NOT NULL,
    term_availability term_availability NOT NULL DEFAULT 'both',
    updated_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, program_code, course_code)
);
COMMIT;

CREATE INDEX IF NOT EXISTS idx_user_course_term_override_user_program
    ON user_course_term_override(user_id, program_code);
COMMIT;
