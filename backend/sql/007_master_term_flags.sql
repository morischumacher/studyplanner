CREATE TEMP TABLE IF NOT EXISTS _master_term_target (
    code text PRIMARY KEY,
    term_availability term_availability NOT NULL
) ON COMMIT DROP;
TRUNCATE TABLE _master_term_target;

INSERT INTO _master_term_target (code, term_availability)
VALUES
        -- AC
        ('Algorithmics', 'winter'::term_availability),
        ('ARA-VU', 'summer'::term_availability),
        ('AET-VU', 'winter'::term_availability),
        ('AGEO-VU', 'winter'::term_availability),
        ('ASOC-VU', 'summer'::term_availability),
        ('AGT-VU', 'summer'::term_availability),
        ('BEA-VU', 'winter'::term_availability),
        ('COMPX-VU', 'winter'::term_availability),
        ('FPT-VU', 'winter'::term_availability),
        ('GDA-VU', 'summer'::term_availability),
        ('HOT-VU', 'winter'::term_availability),
        ('MPOTL-VU', 'summer'::term_availability),
        ('SDMT-VU', 'summer'::term_availability),
        ('Advanced Topics In Algorithms and Complexity', 'both'::term_availability),

        -- AMR
        ('Mobile Robotics', 'summer'::term_availability),
        ('ARC-VU', 'summer'::term_availability),
        ('ITA-VU', 'winter'::term_availability),
        ('PPMR-VU', 'summer'::term_availability),
        ('Advanced Topics In Automation and Mobile Robotics', 'both'::term_availability),

        -- DMIS
        ('Advanced Database Systems', 'summer'::term_availability),
        ('BI-VU', 'winter'::term_availability),
        ('DBT-VU', 'winter'::term_availability),
        ('DS-VO', 'summer'::term_availability),
        ('DS-UE', 'summer'::term_availability),
        ('KG-VU', 'summer'::term_availability),
        ('LBAI-VU', 'winter'::term_availability),
        ('MGD-VU', 'summer'::term_availability),
        ('PSAI-VU', 'winter'::term_availability),
        ('PDK-VU', 'winter'::term_availability),
        ('TGD-VU', 'summer'::term_availability),
        ('Advanced Topics In Data Management and Intelligent Systems', 'both'::term_availability),

        -- DNGC
        ('Advanced Internet Computing', 'winter'::term_availability),
        ('Distributed Systems Technologies', 'summer'::term_availability),
        ('ABD-VU', 'winter'::term_availability),
        ('HQCS-VU', 'summer'::term_availability),
        ('IOT-VU', 'winter'::term_availability),
        ('QC-VU', 'winter'::term_availability),
        ('Advanced Topics In Distributed and Next Generation Computing', 'both'::term_availability),

        -- HPC
        ('AMPP-VU', 'winter'::term_availability),
        ('GPU-VU', 'summer'::term_availability),
        ('GHPC-VU', 'summer'::term_availability),
        ('HPC-VU', 'summer'::term_availability),
        ('HPC4AI-VU', 'winter'::term_availability),
        ('Advanced Topics In High Performance Computing', 'both'::term_availability),

        -- ML
        ('Machine Learning', 'winter'::term_availability),
        ('ARL-VU', 'summer'::term_availability),
        ('ADS-VU', 'summer'::term_availability),
        ('AGAI-VU', 'winter'::term_availability),
        ('DLNLP-VU', 'summer'::term_availability),
        ('GENAI-VU', 'winter'::term_availability),
        ('MLO-VU', 'summer'::term_availability),
        ('RL-VU', 'summer'::term_availability),
        ('TFR-ML-VU', 'winter'::term_availability),
        ('TFDL-VU', 'winter'::term_availability),
        ('Advanced Topics In Machine Learning', 'both'::term_availability),

        -- SP
        ('ACR-VU', 'winter'::term_availability),
        ('APET-VU', 'summer'::term_availability),
        ('AICS-VU', 'winter'::term_availability),
        ('CRYPTOC-VU', 'summer'::term_availability),
        ('FM-SP-VU', 'winter'::term_availability),
        ('Network Security', 'summer'::term_availability),
        ('NETSEC-AT-VU', 'summer'::term_availability),
        ('SC-VU', 'summer'::term_availability),
        ('SYMCR-VU', 'winter'::term_availability),
        ('SAS-VU', 'winter'::term_availability),
        ('Advanced Topics In Security and Privacy', 'both'::term_availability),

        -- SICR
        ('HCAI-VU', 'winter'::term_availability),
        ('AIE-VU', 'summer'::term_availability),
        ('CAS-VU', 'winter'::term_availability),
        ('CSE-PR', 'both'::term_availability),
        ('CTMI-VU', 'winter'::term_availability),
        ('HAI-VU', 'winter'::term_availability),
        ('HAI-PR', 'summer'::term_availability),
        ('ICS-VU', 'summer'::term_availability),
        ('LTLA-VU', 'winter'::term_availability),
        ('RDE-VU', 'winter'::term_availability),
        ('Advanced Topics In Societal Impact and Critical Reflections', 'both'::term_availability),

        -- SEP
        ('Advanced Software Engineering', 'winter'::term_availability),
        ('Advanced Software Engineering Project', 'both'::term_availability),
        ('ALP-VU', 'summer'::term_availability),
        ('AME-VU', 'winter'::term_availability),
        ('AIP-VU', 'winter'::term_availability),
        ('EP-VU', 'summer'::term_availability),
        ('EP-PR', 'summer'::term_availability),
        ('LLP-VU', 'winter'::term_availability),
        ('ME-VU', 'winter'::term_availability),
        ('PPL-VU', 'summer'::term_availability),
        ('TS-VU', 'summer'::term_availability),
        ('Advanced Topics In Software Engineering and Programming', 'both'::term_availability),

        -- VAR
        ('Formal Methods in Systems Engineering', 'winter'::term_availability),
        ('AUTOLOG-VU', 'winter'::term_availability),
        ('ADED-VU', 'winter'::term_availability),
        ('CAV-VU', 'winter'::term_availability),
        ('LAC-VU', 'winter'::term_availability),
        ('PA-VU', 'summer'::term_availability),
        ('SATEXT-VU', 'winter'::term_availability),
        ('Advanced Topics In Verification and Automated Reasoning', 'both'::term_availability),

        -- MCS / EXT / FWTS / THESIS
        ('Seminar in Computer Science', 'both'::term_availability),
        ('Project in Computer Science', 'both'::term_availability),
        ('PRJ-CS-2', 'both'::term_availability),
        ('Extension', 'both'::term_availability),
        ('FWTS-EL', 'both'::term_availability),
        ('Seminar for Diploma Students', 'both'::term_availability),
        ('Master Thesis', 'both'::term_availability),
        ('Final Oral Exam / Defense', 'both'::term_availability);

UPDATE course c
SET term_availability = t.term_availability
FROM _master_term_target t
WHERE c.code = t.code
  AND EXISTS (
    SELECT 1
    FROM module_course mc
        JOIN module m ON m.id = mc.module_id
        JOIN study_program sp ON sp.id = m.program_id
    WHERE mc.course_id = c.id
      AND sp.code = '066 937'
);

-- Any master course not explicitly listed above defaults to "both".
UPDATE course c
SET term_availability = 'both'::term_availability
WHERE EXISTS (
    SELECT 1
    FROM module_course mc
        JOIN module m ON m.id = mc.module_id
        JOIN study_program sp ON sp.id = m.program_id
    WHERE mc.course_id = c.id
      AND sp.code = '066 937'
)
AND NOT EXISTS (
    SELECT 1
    FROM _master_term_target t
    WHERE t.code = c.code
);

-- Clear existing per-user overrides for master so these values act as defaults.
DELETE FROM user_course_term_override
WHERE program_code = '066 937';

-- Ensure catalog API reflects new defaults immediately.
REFRESH MATERIALIZED VIEW v_catalog_json_mat;
COMMIT;
