BEGIN;

-- Ensure program exists
INSERT INTO study_program (code,title,degree_level,language,ects_total,duration_semesters)
VALUES ('033 521','Bachelor Informatics','bachelor','de',180,6)
    ON CONFLICT (code) DO NOTHING;

-- === Exam subjects ===
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'AP',  'Algorithmen und Programmierung' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'CS',  'Computersysteme' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'CGVC','Computergraphik und Visual Computing' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'HCC', 'Human-Centered Computing' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'IE',  'Information Engineering' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'LOG', 'Logik' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'MI',  'Medizinische Informatik' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'SEC', 'Security' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'STW', 'Strukturwissenschaften' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'SE',  'Software Engineering' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'TI',  'Theoretische Informatik' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'FWTS','Freie Wahlfächer und Transferable Skills' FROM sp ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO exam_subject (program_id, code, name)
SELECT sp.id, 'THESIS','Bachelorarbeit' FROM sp ON CONFLICT DO NOTHING;

COMMIT;

-- === Modules & Courses ===
-- Helper: insert a module by name/ects/category for 033 521
-- Note: Adjust categories if you prefer to mark mandatory via grouping only.
-- AP
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Algorithmen und Datenstrukturen',8,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
    ('AD-VU','Algorithmen und Datenstrukturen','VU',8,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Einführung in die Programmierung',9.5,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
('EIDI1-VU','Einführung in die Programmierung 1','VU',5.5,'de')
                                                        ,('EIDI2-VU','Einführung in die Programmierung 2','VU',4.0,'de')
    ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Programmierparadigmen',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
    ('PP-VU','Programmierparadigmen','VU',6,'de') ON CONFLICT DO NOTHING;

-- starred electives in AP
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Effiziente Algorithmen',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('EA-VU','Effiziente Algorithmen','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Funktionale Programmierung',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('FP-VU','Funktionale Programmierung','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Logikprogrammierung und Constraints',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('LPC-VU','Logikprogrammierung und Constraints','VU',6,'de') ON CONFLICT DO NOTHING;

-- CS
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Grundzüge digitaler Systeme',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('GDS-VU','Grundzüge digitaler Systeme','VU',6,'de') ON CONFLICT DO NOTHING;

-- core (+)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Betriebssysteme',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('OS-VU','Betriebssysteme','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Computersysteme',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('CSYS-VU','Computersysteme','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives (*)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Abstrakte Maschinen',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('AM-VU','Abstrakte Maschinen','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Parallel Computing',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('PC-VU','Parallel Computing','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Übersetzerbau',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('UB-VU','Übersetzerbau','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Zuverlässige Echtzeitsysteme',5,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
('RTS-VO','Echtzeitsysteme','VO',2,'de')
                                                        ,('DSYS-VU','Dependable Systems','VU',3,'de') ON CONFLICT DO NOTHING;

-- CGVC (one core + many electives)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Einführung in Visual Computing',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('EVC-VU','Einführung in Visual Computing','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Audio and Video Production',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('AVP-VU','Audio and Video Production','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Computermusik',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('CMUS-VU','Computermusik','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Creative Media Production',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('CMP-VU','Creative Media Production','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Grundlagen der Computergraphik',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('GCG-VU','Grundlagen der Computergraphik','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Grundlagen der Computer Vision',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('GCV-VU','Grundlagen der Computer Vision','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Grundlagen der Visualisierung',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('GVIS-VU','Grundlagen der Visualisierung','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Multimedia',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('MM-VU','Multimedia','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Programmiertechniken für Visual Computing',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('PTVC-PR','Programmiertechniken für Visual Computing','PR',6,'de') ON CONFLICT DO NOTHING;

-- HCC
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Denkweisen der Informatik',6.5,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('DWI-VU','Denkweisen der Informatik','VU',5.5,'de'),
                                                       ('ORI-VU','Orientierung Informatik und Wirtschaftsinformatik','VU',1.0,'de') ON CONFLICT DO NOTHING;

-- core
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Interface und Interaction Design',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('IID-VU','Interface und Interaction Design','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Access Computing',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('ACC-VU','Access Computing','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Design und Fertigung',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('DUF-VU','Design und Fertigung','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Menschzentrierte Künstliche Intelligenz',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('MKAI-VU','Menschzentrierte Künstliche Intelligenz','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Sozio-technische Systeme',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('STS-VU','Sozio-technische Systeme','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Usability Engineering and Mobile Interaction',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('UEMI-VU','Usability Engineering and Mobile Interaction','VU',6,'de') ON CONFLICT DO NOTHING;

-- IE
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Datenbanksysteme',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('DBS-VU','Datenbanksysteme','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Einführung in wissensbasierte Systeme',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('EWS-VU','Einführung in wissensbasierte Systeme','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Einführung in Information Retrieval',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('IR-VU','Einführung in Information Retrieval','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Semistrukturierte Daten',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('SSD-VU','Semistrukturierte Daten','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Web Engineering',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('WEBE-VU','Web Engineering','VU',6,'de') ON CONFLICT DO NOTHING;

-- LOG (two core + electives, plus split VO/UE module)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Einführung in Artificial Intelligence',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('EAI-VU','Einführung in Artificial Intelligence','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Logic and Reasoning in Computer Science',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('LRCS-VU','Logic and Reasoning in Computer Science','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives in LOG
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Argumentieren und Beweisen',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('AUB-VU','Argumentieren und Beweisen','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Deklaratives Problemlösen',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('DPR-VU','Deklaratives Problemlösen','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Einführung in Machine Learning',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('EML-VU','Einführung in Machine Learning','VU',6,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Logik für Wissensrepräsentation',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('LWR-VU','Logik für Wissensrepräsentation','VU',6,'de') ON CONFLICT DO NOTHING;

-- split VO/UE
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Logik und Grundlagen der Mathematik',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('LGM-VO','Logik und Grundlagen der Mathematik (VO)','VO',4.5,'de'),
                                                       ('LGM-UE','Logik und Grundlagen der Mathematik (UE)','UE',1.5,'de') ON CONFLICT DO NOTHING;

-- MI (all electives per list)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Bio-Medical Visualization and Visual Analytics',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('BMVVA-VU','Bio-Medical Visualization and Visual Analytics','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Design und Entwicklung von Anwendungen im Gesundheitswesen',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('DEAG-VU','Design und Entwicklung von Anwendungen im Gesundheitswesen','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Human Augmentation',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('HAUG-VU','Human Augmentation','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Informationssysteme des Gesundheitswesens',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('ISG-VU','Informationssysteme des Gesundheitswesens','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Methods for Data Generation and Analytics in Medicine and Life Sciences',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('MDGAM-VU','Methods for Data Generation and Analytics in Medicine and Life Sciences','VU',6,'de') ON CONFLICT DO NOTHING;

-- SEC
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Einführung in Security',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('ESEC-VU','Einführung in Security','VU',6,'de') ON CONFLICT DO NOTHING;

-- core
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Daten- und Informatikrecht',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('DIR-VU','Daten- und Informatikrecht','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Attacks and Defenses in Computer Security',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('ADCS-UE','Attacks and Defenses in Computer Security','UE',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Foundations of System and Application Security',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('FSAS-VU','Foundations of System and Application Security','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category) SELECT sp.id,'Privacy-Enhancing Technologies',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('PET-VU','Privacy-Enhancing Technologies','VU',6,'de') ON CONFLICT DO NOTHING;

-- STW  (math modules, some with multiple sub-courses)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Algebra und Diskrete Mathematik',9,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ADM-VO','Algebra und Diskrete Mathematik (VO)','VO',4.0,'de'),
                                                       ('ADM-UE','Algebra und Diskrete Mathematik (UE)','UE',5.0,'de'),
                                                       ('ADM-VU','Algebra und Diskrete Mathematik (VU)','VU',9.0,'de')
    ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Analysis',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ANL-VO','Analysis (VO)','VO',2.0,'de'),
                                                       ('ANL-UE','Analysis (UE)','UE',4.0,'de'),
                                                       ('ANL-VU','Analysis (VU)','VU',6.0,'de')
    ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Mathematisches Arbeiten',2,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('MA-VU','Mathematisches Arbeiten','VU',2.0,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Statistik und Wahrscheinlichkeitstheorie',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('SWT-VO','Statistik und Wahrscheinlichkeitstheorie (VO)','VO',3.0,'de'),
                                                       ('SWT-UE','Statistik und Wahrscheinlichkeitstheorie (UE)','UE',3.0,'de'),
                                                       ('SWT-VU','Statistik und Wahrscheinlichkeitstheorie (VU)','VU',6.0,'de')
    ON CONFLICT DO NOTHING;

-- electives in STW
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Computational Statistics',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('CSTAT-VU','Computerstatistik','VU',4.5,'de'),
                                                       ('SCOMP-VU','Statistical Computing','VU',3.0,'de'),
                                                       ('SIM-VU','Statistische Simulation und computerintensive Methoden','VU',3.0,'de')
    ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Datenanalyse',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('DA-VU','Datenanalyse','VU',6.0,'de') ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Methoden der Angewandten Statistik',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('MAS-VO','Methoden der Angewandten Statistik (VO)','VO',4.5,'de'),
                                                       ('MAS-UE','Methoden der Angewandten Statistik (UE)','UE',1.5,'de')
    ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Multivariate Statistik',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('MVS-VO','Multivariate Statistik (VO)','VO',4.5,'de'),
                                                       ('MVS-UE','Multivariate Statistik (UE)','UE',1.5,'de')
    ON CONFLICT DO NOTHING;

WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Numerical Computation',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('NUMC-VU','Numerical Computation','VU',6.0,'de') ON CONFLICT DO NOTHING;

-- SE
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Software Engineering',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('SE-VU','Software Engineering','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Software Engineering Projekt',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('SEP-PR','Software Engineering Projekt','PR',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Verteilte Systeme',6,'core' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('VS-VU','Verteilte Systeme','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Programm- und Systemverifikation',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('PSV-VU','Programm- und Systemverifikation','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Software-Qualitätssicherung',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('SQS-VU','Software-Qualitätssicherung','VU',6,'de') ON CONFLICT DO NOTHING;

-- TI
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Theoretische Informatik',6,'mandatory' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('TI-VU','Theoretische Informatik','VU',6,'de') ON CONFLICT DO NOTHING;

-- electives
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Introduction to Cryptography',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('ITC-VU','Introduction to Cryptography','VU',6,'de') ON CONFLICT DO NOTHING;
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Einführung in Quantencomputing',6,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES ('EQC-VU','Einführung in Quantencomputing','VU',6,'de') ON CONFLICT DO NOTHING;

-- FWTS (single module)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Freie Wahlfächer und Transferable Skills',18,'elective' FROM sp ON CONFLICT DO NOTHING;

-- THESIS (Bachelorarbeit)
WITH sp AS (SELECT id FROM study_program WHERE code='033 521')
INSERT INTO module (program_id,name,ects,category)
SELECT sp.id,'Bachelorarbeit',13,'elective' FROM sp ON CONFLICT DO NOTHING;
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('BA-PR','Bachelorarbeit für Informatik und Wirtschaftsinformatik','PR',10,'de'),
                                                       ('WISS-SE','Wissenschaftliches Arbeiten','SE',3,'de') ON CONFLICT DO NOTHING;

COMMIT;

-- === Module-Course linking ===
-- For each module created above, link all courses that share its semantic code.

-- AP
INSERT INTO module_course (module_id,course_id)
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AD-VU'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Algorithmen und Datenstrukturen' ON CONFLICT DO NOTHING;

INSERT INTO module_course (module_id,course_id)
SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('EIDI1-VU','EIDI2-VU')
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in die Programmierung' ON CONFLICT DO NOTHING;

INSERT INTO module_course (module_id,course_id)
SELECT m.id,c.id FROM module m JOIN course c ON c.code='PP-VU'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Programmierparadigmen' ON CONFLICT DO NOTHING;

INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='EA-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Effiziente Algorithmen' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='FP-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Funktionale Programmierung' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='LPC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Logikprogrammierung und Constraints' ON CONFLICT DO NOTHING;

-- CS
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='GDS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Grundzüge digitaler Systeme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='OS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Betriebssysteme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='CSYS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Computersysteme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='AM-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Abstrakte Maschinen' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='PC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Parallel Computing' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='UB-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Übersetzerbau' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('RTS-VO','DSYS-VU')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Zuverlässige Echtzeitsysteme' ON CONFLICT DO NOTHING;

-- CGVC
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='EVC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in Visual Computing' ON CONFLICT DO NOTHING;

INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='AVP-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Audio and Video Production' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='CMUS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Computermusik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='CMP-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Creative Media Production' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='GCG-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Grundlagen der Computergraphik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='GCV-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Grundlagen der Computer Vision' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='GVIS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Grundlagen der Visualisierung' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='MM-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Multimedia' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='PTVC-PR'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Programmiertechniken für Visual Computing' ON CONFLICT DO NOTHING;

-- HCC
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('DWI-VU','ORI-VU')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Denkweisen der Informatik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='IID-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Interface und Interaction Design' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='ACC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Access Computing' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='DUF-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Design und Fertigung' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='MKAI-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Menschzentrierte Künstliche Intelligenz' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='STS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Sozio-technische Systeme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='UEMI-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Usability Engineering and Mobile Interaction' ON CONFLICT DO NOTHING;

-- IE
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='DBS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Datenbanksysteme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='EWS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in wissensbasierte Systeme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='IR-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in Information Retrieval' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='SSD-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Semistrukturierte Daten' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='WEBE-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Web Engineering' ON CONFLICT DO NOTHING;

-- LOG
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='EAI-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in Artificial Intelligence' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='LRCS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Logic and Reasoning in Computer Science' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='AUB-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Argumentieren und Beweisen' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='DPR-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Deklaratives Problemlösen' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='EML-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in Machine Learning' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('LGM-VO','LGM-UE')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Logik und Grundlagen der Mathematik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='LWR-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Logik für Wissensrepräsentation' ON CONFLICT DO NOTHING;

-- MI
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='BMVVA-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Bio-Medical Visualization and Visual Analytics' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='DEAG-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Design und Entwicklung von Anwendungen im Gesundheitswesen' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='HAUG-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Human Augmentation' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='ISG-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Informationssysteme des Gesundheitswesens' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='MDGAM-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Methods for Data Generation and Analytics in Medicine and Life Sciences' ON CONFLICT DO NOTHING;

-- SEC
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='ESEC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in Security' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='DIR-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Daten- und Informatikrecht' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='ADCS-UE'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Attacks and Defenses in Computer Security' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='FSAS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Foundations of System and Application Security' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='PET-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Privacy-Enhancing Technologies' ON CONFLICT DO NOTHING;

-- STW
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('ADM-VO','ADM-UE','ADM-VU')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Algebra und Diskrete Mathematik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('ANL-VO','ANL-UE','ANL-VU')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Analysis' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='MA-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Mathematisches Arbeiten' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('SWT-VO','SWT-UE','SWT-VU')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Statistik und Wahrscheinlichkeitstheorie' ON CONFLICT DO NOTHING;

INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('CSTAT-VU','SCOMP-VU','SIM-VU')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Computational Statistics' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='DA-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Datenanalyse' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('MAS-VO','MAS-UE')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Methoden der Angewandten Statistik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('MVS-VO','MVS-UE')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Multivariate Statistik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='NUMC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Numerical Computation' ON CONFLICT DO NOTHING;

-- SE
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='SE-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Software Engineering' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='SEP-PR'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Software Engineering Projekt' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='VS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Verteilte Systeme' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='PSV-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Programm- und Systemverifikation' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='SQS-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Software-Qualitätssicherung' ON CONFLICT DO NOTHING;

-- TI
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='TI-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Theoretische Informatik' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='ITC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Introduction to Cryptography' ON CONFLICT DO NOTHING;
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code='EQC-VU'
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Einführung in Quantencomputing' ON CONFLICT DO NOTHING;

-- FWTS / THESIS
-- FWTS has no specific courses defined (choose from university-wide catalog), so we skip course linking.
INSERT INTO module_course SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('BA-PR','WISS-SE')
                                                         JOIN study_program sp ON sp.id=m.program_id AND sp.code='033 521' WHERE m.name='Bachelorarbeit' ON CONFLICT DO NOTHING;

COMMIT;

-- === module_grouping: connect modules to exam subjects, flag mandatory ones ===
-- AP
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name IN ('Algorithmen und Datenstrukturen','Einführung in die Programmierung','Programmierparadigmen'))::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='AP'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Algorithmen und Datenstrukturen','Einführung in die Programmierung','Programmierparadigmen',
                                                            'Effiziente Algorithmen','Funktionale Programmierung','Logikprogrammierung und Constraints'
    ) ON CONFLICT DO NOTHING;

-- CS
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name='Grundzüge digitaler Systeme')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='CS'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Grundzüge digitaler Systeme','Betriebssysteme','Computersysteme','Abstrakte Maschinen','Parallel Computing','Übersetzerbau','Zuverlässige Echtzeitsysteme'
    ) ON CONFLICT DO NOTHING;

-- CGVC
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='CGVC'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Einführung in Visual Computing','Audio and Video Production','Computermusik','Creative Media Production',
                                                            'Grundlagen der Computergraphik','Grundlagen der Computer Vision','Grundlagen der Visualisierung',
                                                            'Multimedia','Programmiertechniken für Visual Computing'
    ) ON CONFLICT DO NOTHING;

-- HCC
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name='Denkweisen der Informatik')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='HCC'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Denkweisen der Informatik','Interface und Interaction Design','Access Computing','Design und Fertigung',
                                                            'Menschzentrierte Künstliche Intelligenz','Sozio-technische Systeme','Usability Engineering and Mobile Interaction'
    ) ON CONFLICT DO NOTHING;

-- IE
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name='Datenbanksysteme')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='IE'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Datenbanksysteme','Einführung in wissensbasierte Systeme','Einführung in Information Retrieval','Semistrukturierte Daten','Web Engineering'
    ) ON CONFLICT DO NOTHING;

-- LOG
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name IN ('Einführung in Artificial Intelligence','Logic and Reasoning in Computer Science'))::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='LOG'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Einführung in Artificial Intelligence','Logic and Reasoning in Computer Science',
                                                            'Argumentieren und Beweisen','Deklaratives Problemlösen','Einführung in Machine Learning',
                                                            'Logik für Wissensrepräsentation','Logik und Grundlagen der Mathematik'
    ) ON CONFLICT DO NOTHING;

-- MI
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='MI'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Bio-Medical Visualization and Visual Analytics','Design und Entwicklung von Anwendungen im Gesundheitswesen',
                                                            'Human Augmentation','Informationssysteme des Gesundheitswesens','Methods for Data Generation and Analytics in Medicine and Life Sciences'
    ) ON CONFLICT DO NOTHING;

-- SEC
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name='Einführung in Security')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='SEC'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Einführung in Security','Daten- und Informatikrecht','Attacks and Defenses in Computer Security','Foundations of System and Application Security','Privacy-Enhancing Technologies'
    ) ON CONFLICT DO NOTHING;

-- STW
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name IN ('Algebra und Diskrete Mathematik','Analysis','Mathematisches Arbeiten','Statistik und Wahrscheinlichkeitstheorie'))::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='STW'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Algebra und Diskrete Mathematik','Analysis','Mathematisches Arbeiten','Statistik und Wahrscheinlichkeitstheorie',
                                                            'Computational Statistics','Datenanalyse','Methoden der Angewandten Statistik','Multivariate Statistik','Numerical Computation'
    ) ON CONFLICT DO NOTHING;

-- SE
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name IN ('Software Engineering','Software Engineering Projekt','Verteilte Systeme'))::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='SE'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Software Engineering','Software Engineering Projekt','Verteilte Systeme',
                                                            'Programm- und Systemverifikation','Software-Qualitätssicherung'
    ) ON CONFLICT DO NOTHING;

-- TI
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,(m.name='Theoretische Informatik')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='TI'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Theoretische Informatik','Introduction to Cryptography','Einführung in Quantencomputing'
    ) ON CONFLICT DO NOTHING;

-- FWTS
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='FWTS'
         JOIN module m ON m.program_id=sp.id AND m.name IN ('Freie Wahlfächer und Transferable Skills') ON CONFLICT DO NOTHING;

-- THESIS
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id,m.id,true
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='033 521' AND es.code='THESIS'
         JOIN module m ON m.program_id=sp.id AND m.name IN ('Bachelorarbeit') ON CONFLICT DO NOTHING;

COMMIT;
