CREATE TEMP TABLE IF NOT EXISTS _master_term_target (
    code text PRIMARY KEY,
    term_availability term_availability NOT NULL
) ON COMMIT DROP;
TRUNCATE TABLE _master_term_target;

INSERT INTO _master_term_target (code, term_availability)
VALUES
    -- AC
    ('ALGO', 'winter'::term_availability),
    ('ARA', 'summer'::term_availability),
    ('AET', 'winter'::term_availability),
    ('AGEO', 'winter'::term_availability),
    ('ASOC', 'summer'::term_availability),
    ('AGT', 'summer'::term_availability),
    ('BEA', 'winter'::term_availability),
    ('COMPX', 'winter'::term_availability),
    ('FPT', 'winter'::term_availability),
    ('GDA', 'summer'::term_availability),
    ('HOT', 'winter'::term_availability),
    ('MPOTL', 'summer'::term_availability),
    ('SDMT', 'summer'::term_availability),
    ('ATAC', 'both'::term_availability),

    -- AMR
    ('MR', 'summer'::term_availability),
    ('ARC', 'summer'::term_availability),
    ('ITA', 'winter'::term_availability),
    ('PPMR', 'summer'::term_availability),
    ('ATAMR', 'both'::term_availability),

    -- DMIS
    ('ADS', 'summer'::term_availability),
    ('BI', 'winter'::term_availability),
    ('DBT', 'winter'::term_availability),
    ('DS', 'summer'::term_availability),
    ('DSUE', 'summer'::term_availability),
    ('KG', 'summer'::term_availability),
    ('LBAI', 'winter'::term_availability),
    ('MGD', 'summer'::term_availability),
    ('PSAI', 'winter'::term_availability),
    ('PDK', 'winter'::term_availability),
    ('TGD', 'summer'::term_availability),
    ('ATDMIS', 'both'::term_availability),

    -- DNGC
    ('AIC', 'winter'::term_availability),
    ('DST', 'summer'::term_availability),
    ('ABD', 'winter'::term_availability),
    ('HQCS', 'summer'::term_availability),
    ('IOT', 'winter'::term_availability),
    ('QC', 'winter'::term_availability),
    ('ATDNGC', 'both'::term_availability),

    -- HPC
    ('AMPP', 'winter'::term_availability),
    ('GPU', 'summer'::term_availability),
    ('GHPC', 'summer'::term_availability),
    ('HPC', 'summer'::term_availability),
    ('HPC4AI', 'winter'::term_availability),
    ('ATHPC', 'both'::term_availability),

    -- ML
    ('ML', 'winter'::term_availability),
    ('ARL', 'summer'::term_availability),
    ('ADSVU', 'summer'::term_availability),
    ('AGAI', 'winter'::term_availability),
    ('DLNLP', 'summer'::term_availability),
    ('GENAI', 'winter'::term_availability),
    ('MLO', 'summer'::term_availability),
    ('RL', 'summer'::term_availability),
    ('TFRML', 'winter'::term_availability),
    ('TFDL', 'winter'::term_availability),
    ('ATML', 'both'::term_availability),

    -- SP
    ('ACR', 'winter'::term_availability),
    ('APET', 'summer'::term_availability),
    ('AICS', 'winter'::term_availability),
    ('CRYPTOC', 'summer'::term_availability),
    ('FMSP', 'winter'::term_availability),
    ('NS', 'summer'::term_availability),
    ('NETSECAT', 'summer'::term_availability),
    ('SC', 'summer'::term_availability),
    ('SYMCR', 'winter'::term_availability),
    ('SAS', 'winter'::term_availability),
    ('ATSP', 'both'::term_availability),

    -- SICR
    ('HCAI', 'winter'::term_availability),
    ('AIE', 'summer'::term_availability),
    ('CAS', 'winter'::term_availability),
    ('CSE', 'both'::term_availability),
    ('CTMI', 'winter'::term_availability),
    ('HAI', 'winter'::term_availability),
    ('HAIPR', 'summer'::term_availability),
    ('ICS', 'summer'::term_availability),
    ('LTLA', 'winter'::term_availability),
    ('RDE', 'winter'::term_availability),
    ('ATSICR', 'both'::term_availability),

    -- SEP
    ('ASE', 'winter'::term_availability),
    ('ASEP', 'both'::term_availability),
    ('ALP', 'summer'::term_availability),
    ('AME', 'winter'::term_availability),
    ('AIP', 'winter'::term_availability),
    ('EP', 'summer'::term_availability),
    ('EPPR', 'summer'::term_availability),
    ('LLP', 'winter'::term_availability),
    ('ME', 'winter'::term_availability),
    ('PPL', 'summer'::term_availability),
    ('TS', 'summer'::term_availability),
    ('ATSEP', 'both'::term_availability),

    -- VAR
    ('FMSE', 'winter'::term_availability),
    ('AUTOLOG', 'winter'::term_availability),
    ('ADED', 'winter'::term_availability),
    ('CAV', 'winter'::term_availability),
    ('LAC', 'winter'::term_availability),
    ('PA', 'summer'::term_availability),
    ('SATEXT', 'winter'::term_availability),
    ('ATVAR', 'both'::term_availability),

    -- MCS / EXT / FWTS / THESIS
    ('SCS', 'both'::term_availability),
    ('PRJCS1', 'both'::term_availability),
    ('PRJCS2', 'both'::term_availability),
    ('EXTENSION', 'both'::term_availability),
    ('FWTSEL', 'both'::term_availability),
    ('SDS', 'both'::term_availability),
    ('MTH', 'both'::term_availability),
    ('FOE', 'both'::term_availability);

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

-- Clear existing per-user overrides for master so these values act as defaults.
DELETE FROM user_course_term_override
WHERE program_code = '066 937';

-- Ensure catalog API reflects new defaults immediately.
REFRESH MATERIALIZED VIEW v_catalog_json_mat;
COMMIT;
