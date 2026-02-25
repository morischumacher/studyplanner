CREATE TEMP TABLE IF NOT EXISTS _bachelor_term_target (
    code text PRIMARY KEY,
    term_availability term_availability NOT NULL
) ON COMMIT DROP;
TRUNCATE TABLE _bachelor_term_target;

INSERT INTO _bachelor_term_target (code, term_availability)
VALUES
    -- Intro / foundations
    ('Algorithmen und Datenstrukturen', 'winter'::term_availability),
    ('Einführung in die Programmierung 1', 'both'::term_availability),
    ('Denkweisen der Informatik', 'both'::term_availability),
    ('Orientierung Informatik und Wirtschaftsinformatik', 'winter'::term_availability),
    ('Mathematisches Arbeiten', 'winter'::term_availability),
    ('Einführung in die Programmierung 2', 'summer'::term_availability),
    ('Programmierparadigmen', 'summer'::term_availability),
    ('Software Engineering', 'summer'::term_availability),
    ('Software Engineering Projekt', 'summer'::term_availability),
    ('SQS-VU', 'summer'::term_availability),
    ('FP-VU', 'winter'::term_availability),
    ('LPC-VU', 'both'::term_availability),
    ('UB-VU', 'summer'::term_availability),
    ('PSV-VU', 'winter'::term_availability),
    ('Grundzüge digitaler Systeme', 'winter'::term_availability),
    ('Betriebssysteme', 'summer'::term_availability),
    ('Computersysteme', 'winter'::term_availability),
    ('AM-VU', 'winter'::term_availability),
    ('PC-VU', 'winter'::term_availability),
    ('RTS-VO', 'winter'::term_availability),
    ('DSYS-VU', 'summer'::term_availability),
    ('Verteilte Systeme', 'summer'::term_availability),
    ('Einführung in Visual Computing', 'winter'::term_availability),
    ('AVP-VU', 'summer'::term_availability),
    ('CMUS-VU', 'winter'::term_availability),
    ('CMP-VU', 'winter'::term_availability),
    ('GCG-VU', 'summer'::term_availability),
    ('GCV-VU', 'summer'::term_availability),
    ('GVIS-VU', 'summer'::term_availability),
    ('MM-VU', 'summer'::term_availability),
    ('PTVC-PR', 'winter'::term_availability),
    ('Interface und Interaction Design', 'summer'::term_availability),
    ('ACC-VU', 'summer'::term_availability),
    ('DUF-VU', 'winter'::term_availability),
    ('MKAI-VU', 'summer'::term_availability),
    ('STS-VU', 'both'::term_availability),
    ('UEMI-VU', 'summer'::term_availability),
    ('Datenbanksysteme', 'winter'::term_availability),
    ('EWS-VU', 'summer'::term_availability),
    ('IR-VU', 'summer'::term_availability),
    ('SSD-VU', 'summer'::term_availability),
    ('WEBE-VU', 'summer'::term_availability),
    ('Einführung in Artificial Intelligence', 'winter'::term_availability),
    ('Logic and Reasoning in Computer Science', 'winter'::term_availability),
    ('AUB-VU', 'summer'::term_availability),
    ('DPR-VU', 'summer'::term_availability),
    ('EML-VU', 'both'::term_availability),
    ('LWR-VU', 'summer'::term_availability),
    ('LGM-VO', 'summer'::term_availability),
    ('LGM-UE', 'summer'::term_availability),
    ('Theoretische Informatik', 'summer'::term_availability),
    ('BMVVA-VU', 'summer'::term_availability),
    ('DEAG-VU', 'winter'::term_availability),
    ('HAUG-VU', 'summer'::term_availability),
    ('ISG-VU', 'winter'::term_availability),
    ('MDGAM-VU', 'summer'::term_availability),
    ('Einführung in Security', 'both'::term_availability),
    ('Daten- und Informatikrecht', 'both'::term_availability),
    ('ADCS-UE', 'summer'::term_availability),
    ('FSAS-VU', 'winter'::term_availability),
    ('PET-VU', 'summer'::term_availability),
    ('ITC-VU', 'winter'::term_availability),
    ('Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik', 'summer'::term_availability),
    ('Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (UE)', 'summer'::term_availability),
    ('Algebra und Diskrete Mathematik für Informatik und Wirtschaftsinformatik (VU)', 'summer'::term_availability),
    ('Analysis für Informatik und Wirtschaftsinformatik', 'summer'::term_availability),
    ('Analysis für Informatik und Wirtschaftsinformatik (UE)', 'summer'::term_availability),
    ('Analysis für Informatik und Wirtschaftsinformatik (VU)', 'summer'::term_availability),
    ('SWT-VO', 'winter'::term_availability),
    ('SWT-UE', 'winter'::term_availability),
    ('Statistik und Wahrscheinlichkeitstheorie', 'winter'::term_availability),
    ('CSTAT-VU', 'winter'::term_availability),
    ('SCOMP-VU', 'winter'::term_availability),
    ('SIM-VU', 'winter'::term_availability),
    ('DA-VU', 'summer'::term_availability),
    ('MAS-VO', 'summer'::term_availability),
    ('MAS-UE', 'summer'::term_availability),
    ('MVS-VO', 'winter'::term_availability),
    ('MVS-UE', 'winter'::term_availability),
    ('NUMC-VU', 'summer'::term_availability),
    ('EA-VU', 'summer'::term_availability),
    ('EQC-VU', 'winter'::term_availability),
    ('Bachelorarbeit', 'both'::term_availability),
    ('Wissenschaftliches Arbeiten', 'both'::term_availability);

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

-- Any bachelor course not explicitly listed above defaults to "both".
UPDATE course c
SET term_availability = 'both'::term_availability
WHERE EXISTS (
    SELECT 1
    FROM module_course mc
        JOIN module m ON m.id = mc.module_id
        JOIN study_program sp ON sp.id = m.program_id
    WHERE mc.course_id = c.id
      AND sp.code = '033 521'
)
AND NOT EXISTS (
    SELECT 1
    FROM _bachelor_term_target t
    WHERE t.code = c.code
);

-- Clear existing per-user overrides for bachelor so these values act as defaults.
DELETE FROM user_course_term_override
WHERE program_code = '033 521';

REFRESH MATERIALIZED VIEW v_catalog_json_mat;
COMMIT;
