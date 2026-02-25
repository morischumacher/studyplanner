CREATE TEMP TABLE IF NOT EXISTS _bachelor_term_target (
    code text PRIMARY KEY,
    term_availability term_availability NOT NULL
) ON COMMIT DROP;
TRUNCATE TABLE _bachelor_term_target;

INSERT INTO _bachelor_term_target (code, term_availability)
VALUES
    -- Intro / foundations
    ('AD', 'winter'::term_availability),
    ('EIDI1', 'both'::term_availability),
    ('DI', 'both'::term_availability),
    ('OIW', 'winter'::term_availability),
    ('MA', 'winter'::term_availability),
    ('EIDI2', 'summer'::term_availability),
    ('PPAR', 'summer'::term_availability),
    ('SE', 'summer'::term_availability),
    ('SEP', 'summer'::term_availability),
    ('SQS', 'summer'::term_availability),
    ('FP', 'winter'::term_availability),
    ('LPC', 'both'::term_availability),
    ('UB', 'summer'::term_availability),
    ('PSV', 'winter'::term_availability),
    ('GGDS', 'winter'::term_availability),
    ('BS', 'summer'::term_availability),
    ('CS', 'winter'::term_availability),
    ('AM', 'winter'::term_availability),
    ('PC', 'winter'::term_availability),
    ('RTS', 'winter'::term_availability),
    ('DSYS', 'summer'::term_availability),
    ('VS', 'summer'::term_availability),
    ('EHVC', 'winter'::term_availability),
    ('AVP', 'summer'::term_availability),
    ('CMUS', 'winter'::term_availability),
    ('CMP', 'winter'::term_availability),
    ('GCG', 'summer'::term_availability),
    ('GCV', 'summer'::term_availability),
    ('GVIS', 'summer'::term_availability),
    ('MM', 'summer'::term_availability),
    ('PTVC', 'winter'::term_availability),
    ('IID', 'summer'::term_availability),
    ('ACC', 'summer'::term_availability),
    ('DUF', 'winter'::term_availability),
    ('MKAI', 'summer'::term_availability),
    ('STS', 'both'::term_availability),
    ('UEMI', 'summer'::term_availability),
    ('DBS', 'winter'::term_availability),
    ('EWS', 'summer'::term_availability),
    ('IR', 'summer'::term_availability),
    ('SSD', 'summer'::term_availability),
    ('WEBE', 'summer'::term_availability),
    ('EHAI', 'winter'::term_availability),
    ('LRCS', 'winter'::term_availability),
    ('AUB', 'summer'::term_availability),
    ('DPR', 'summer'::term_availability),
    ('EML', 'both'::term_availability),
    ('LWR', 'summer'::term_availability),
    ('LGM', 'summer'::term_availability),
    ('LGMUE', 'summer'::term_availability),
    ('TI', 'summer'::term_availability),
    ('BMVVA', 'summer'::term_availability),
    ('DEAG', 'winter'::term_availability),
    ('HAUG', 'summer'::term_availability),
    ('ISG', 'winter'::term_availability),
    ('MDGAM', 'summer'::term_availability),
    ('EHS', 'both'::term_availability),
    ('DIR', 'both'::term_availability),
    ('ADCS', 'summer'::term_availability),
    ('FSAS', 'winter'::term_availability),
    ('PET', 'summer'::term_availability),
    ('ITC', 'winter'::term_availability),
    ('ADM', 'summer'::term_availability),
    ('ADMUE', 'summer'::term_availability),
    ('ADMVU', 'summer'::term_availability),
    ('ANL', 'summer'::term_availability),
    ('ANLUE', 'summer'::term_availability),
    ('ANLVU', 'summer'::term_availability),
    ('SWT', 'winter'::term_availability),
    ('SWTUE', 'winter'::term_availability),
    ('SWTVU', 'winter'::term_availability),
    ('CSTAT', 'winter'::term_availability),
    ('SCOMP', 'winter'::term_availability),
    ('SIM', 'winter'::term_availability),
    ('DA', 'summer'::term_availability),
    ('MAS', 'summer'::term_availability),
    ('MASUE', 'summer'::term_availability),
    ('MVS', 'winter'::term_availability),
    ('MVSUE', 'winter'::term_availability),
    ('NUMC', 'summer'::term_availability),
    ('EA', 'summer'::term_availability),
    ('EQC', 'winter'::term_availability),
    ('BA', 'both'::term_availability),
    ('WA', 'both'::term_availability);

UPDATE course c
SET term_availability = t.term_availability
FROM _bachelor_term_target t
WHERE c.code = t.code
  AND EXISTS (
    SELECT 1
    FROM module_course mc
    JOIN module m ON m.id = mc.module_id
    JOIN study_program sp ON sp.id = m.program_id
    WHERE mc.course_id = c.id
      AND sp.code = '033 521'
);

-- Clear existing per-user overrides for bachelor so these values act as defaults.
DELETE FROM user_course_term_override
WHERE program_code = '033 521';

REFRESH MATERIALIZED VIEW v_catalog_json_mat;
COMMIT;
