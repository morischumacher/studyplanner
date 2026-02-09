DROP MATERIALIZED VIEW IF EXISTS v_catalog_json_mat;

CREATE MATERIALIZED VIEW v_catalog_json_mat AS
WITH courses AS (
    SELECT
        mc.module_id,
        jsonb_agg(
                jsonb_build_object(
                        'course_id',         c.id,
                        'code',              c.code,
                        'title',             c.title,
                        'ects',              c.ects,
                        'type',              c.type,
                        'language',          c.language,
                        'is_core_to_module', mc.is_core_to_module,
                        'tags',              ARRAY_REMOVE(ARRAY[c.type, c.language], NULL)
                )
                ORDER BY c.code NULLS LAST, c.title
        ) AS courses_json
    FROM module_course mc
             JOIN course c ON c.id = mc.course_id
    GROUP BY mc.module_id
),
     modules AS (
         SELECT
             mg.exam_subject_id,
             m.program_id,
             jsonb_agg(
                     jsonb_build_object(
                             'module_id',                 m.id,
                             'name',                      m.name,
                             'ects',                      m.ects,
                             'category',                  m.category,           -- enum -> text in JSON
                             'is_mandatory',              mg.is_mandatory,
                             'module_exam_subject',       es.name,              -- << add subject name
                             'module_exam_subject_code',  es.code,              -- (optional) add subject code
                             'courses',                   COALESCE(c.courses_json, '[]'::jsonb)
                     )
                     ORDER BY m.name
             ) AS modules_json
         FROM module_grouping mg
                  JOIN module m        ON m.id  = mg.module_id
                  JOIN exam_subject es ON es.id = mg.exam_subject_id
                  LEFT JOIN courses c  ON c.module_id = m.id
         GROUP BY mg.exam_subject_id, m.program_id
     ),
    subjects AS (
    SELECT
    es.program_id,
    sp.code AS program_code,
    jsonb_agg(
    jsonb_build_object(
    'exam_subject_id',   es.id,
    'exam_subject',      es.name,
    'exam_subject_code', es.code,
    'modules',           COALESCE(mod.modules_json, '[]'::jsonb)
    )
    ORDER BY es.code NULLS LAST, es.name
    ) AS catalog
    FROM exam_subject es
    JOIN study_program sp ON sp.id = es.program_id
    LEFT JOIN modules mod ON mod.exam_subject_id = es.id
    GROUP BY es.program_id, sp.code
    )
SELECT program_id, program_code, catalog
FROM subjects;

-- For REFRESH CONCURRENTLY:
CREATE UNIQUE INDEX IF NOT EXISTS idx_v_catalog_json_mat_program
ON v_catalog_json_mat (program_id);
