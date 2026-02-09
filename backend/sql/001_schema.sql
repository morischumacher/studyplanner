CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "citext";
COMMIT;

CREATE TABLE IF NOT EXISTS study_program (
                                             id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                                             code text UNIQUE,
                                             title text NOT NULL,
                                             degree_level text CHECK (degree_level IN ('bachelor','master','phd','other')) NOT NULL,
                                             language text,
                                             ects_total numeric(5,1),
                                             duration_semesters int,
                                             effective_from date,
                                             effective_to date,
                                             attributes jsonb DEFAULT '{}'
);
COMMIT;


CREATE TABLE IF NOT EXISTS exam_subject (
                                            id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                                            program_id uuid NOT NULL REFERENCES study_program(id),
                                            code text,
                                            name text NOT NULL,
                                            attributes jsonb DEFAULT '{}'
);
COMMIT;


CREATE TYPE module_category AS ENUM ('mandatory', 'core', 'elective');
CREATE TABLE IF NOT EXISTS module (
                                      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      program_id uuid NOT NULL REFERENCES study_program(id),
                                      name text NOT NULL,
                                      ects numeric(5,1) NOT NULL,
                                      category module_category,
                                      description text,
                                      attributes jsonb DEFAULT '{}'
);
COMMIT;

CREATE TABLE IF NOT EXISTS course (
                                      id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
                                      code text,
                                      title text NOT NULL,
                                      type text,
                                      ects numeric(5,1),
                                      language text,
                                      attributes jsonb DEFAULT '{}'
);
COMMIT;

CREATE TABLE IF NOT EXISTS module_course (
                                             module_id uuid NOT NULL REFERENCES module(id) ON DELETE CASCADE,
                                             course_id uuid NOT NULL REFERENCES course(id) ON DELETE CASCADE,
                                             is_core_to_module boolean DEFAULT true,
                                             PRIMARY KEY (module_id, course_id)
);
COMMIT;

CREATE TABLE IF NOT EXISTS module_grouping (
                                               exam_subject_id uuid NOT NULL REFERENCES exam_subject(id) ON DELETE CASCADE,
                                               module_id uuid NOT NULL REFERENCES module(id) ON DELETE CASCADE,
                                               is_mandatory boolean DEFAULT false,
                                               PRIMARY KEY (exam_subject_id, module_id)
);
COMMIT;


-- exam_subject
CREATE INDEX IF NOT EXISTS idx_exam_subject_program
    ON exam_subject(program_id);

-- module
CREATE INDEX IF NOT EXISTS idx_module_program
    ON module(program_id);

-- module_grouping
CREATE INDEX IF NOT EXISTS idx_module_grouping_exam_subject
    ON module_grouping(exam_subject_id);
CREATE INDEX IF NOT EXISTS idx_module_grouping_module
    ON module_grouping(module_id);

-- module_course
CREATE INDEX IF NOT EXISTS idx_module_course_module
    ON module_course(module_id);
CREATE INDEX IF NOT EXISTS idx_module_course_course
    ON module_course(course_id);
COMMIT;