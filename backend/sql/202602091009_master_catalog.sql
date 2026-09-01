-- Ensure program exists
BEGIN;
INSERT INTO study_program (code,title,degree_level,language,ects_total,duration_semesters)
VALUES ('066 937','Master Software Engineering','master','en',120,4)
ON CONFLICT (code) DO NOTHING;
COMMIT;


-- === Exam subjects for 066 937 ===
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'AC',  'Algorithms and Complexity' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'AMR', 'Automation Systems and Mobile Robotics' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'DMIS','Data Management and Intelligent Systems' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'DNGC','Distributed and Next Generation Computing' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'HPC', 'High Performance Computing' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'ML',  'Machine Learning' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'SP',  'Security and Privacy' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'SICR','Societal Impact and Critical Reflections' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'SEP', 'Software Engineering and Programming' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'VAR', 'Verification and Automated Reasoning' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'MCS', 'Methods in Computer Science' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'EXT', 'Extension' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'FWTS','Freie Wahlfächer und Transferable Skills' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO exam_subject (program_id, code, name)
SELECT id, 'THESIS','Diplomarbeit' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- === Modules (category restricted to: mandatory | core | elective) ===
-- AC
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Algorithmics',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Research in Algorithmics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Algorithmic Encoding Techniques',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Algorithmic Geometry',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Algorithmic Social Choice',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Algorithms in Graph Theory',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Beyond Exact Algorithms',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Complexity Theory',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Fixed-Parameter Algorithms and Complexity',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Graph Drawing Algorithms',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Heuristic Optimization Techniques',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Mathematical Programming and Optimization in Transport Logistics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Structural Decompositions and Meta Theorems',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Algorithms and Complexity',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- AMR
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Mobile Robotics',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Autonomous Racing Cars',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Information Technology in Automation',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Programming Principles of Mobile Robotics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Automation and Mobile Robotics',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- DMIS
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Database Systems',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Business Intelligence',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Database Theory',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Data Stewardship',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Knowledge Graphs',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Logic-based Artificial Intelligence',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Management of Graph Data',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Problem Solving and Search in AI',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Processing of Declarative Knowledge',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Theory of Graph Data',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Data Management and Intelligent Systems',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- DNGC
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Internet Computing',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Distributed Systems Technologies',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Artifact-based Design',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Hybrid Quantum - Classical Systems',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Internet of Things',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Quantum Computing',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Distributed and Next Generation Computing',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- HPC
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Multiprocessor Programming',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'GPU Computing and Architectures',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Green HPC',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'High Performance Computing',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'HPC for AI',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In High Performance Computing',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- ML
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Machine Learning',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Reinforcement Learning',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Algorithms for Data Science',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Applied Generative AI and LLM-based Systems',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Deep Learning for NLP',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Generative AI',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Machine Learning for Optimization',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Reinforcement Learning',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Theoretical Foundations and Research Topics in ML',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Theoretical Foundations of Deep Learning',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Machine Learning',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- SP
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Cryptography',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Privacy Enhancing Technologies',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Artificial Intelligence for Computer Security',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Cryptocurrencies',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Formal Methods for Security and Privacy',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

INSERT INTO module (program_id,name,ects,category)
SELECT id,'Network Security',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

INSERT INTO module (program_id,name,ects,category)
SELECT id,'Smart Contracts',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Symmetric Cryptography',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'System and Application Security',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Security and Privacy',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- SICR
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Human-Centered AI: from concepts to implementation',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'AI Ethics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Critical Algorithm Studies',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Computer Science Education: Advances in Research and Practice',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Critical Theory of Media and Informatics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

-- 12 ECTS Human-agent Interaction via VU+PR 6 each
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Human-agent Interaction',12,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

INSERT INTO module (program_id,name,ects,category)
SELECT id,'Introduction to Computational Sustainability',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Learning Technologies and Learning Analytics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Responsible Digital Ethics',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Societal Impact and Critical Reflections',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- SEP
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Software Engineering',6,'mandatory' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Software Engineering Project',6,'mandatory' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Logic Programming',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Model Engineering',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'AI Programming',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

-- Efficient Programs 6 ECTS via VU+PR 3 each
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Efficient Programs',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

INSERT INTO module (program_id,name,ects,category)
SELECT id,'Low-Level Programming',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Model Engineering',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Programming Paradigms and Languages',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Type Systems',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Software Engineering and Programming',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- VAR
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Formal Methods in Systems Engineering',6,'core' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Automata and Logic',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Automated Deduction',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Computer-Aided Verification',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Logic and Computability',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Program Analysis',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'SAT Algorithms, Applications and Extensions',6,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Advanced Topics In Verification and Automated Reasoning',3,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- MCS  (mapped to 'elective')
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Seminar in Computer Science',3,'mandatory' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
-- Project 6–12 ECTS modeled as 12 to cover max
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Project in Computer Science',12,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

-- EXT (mapped to 'elective')
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Extension',12,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;

-- FWTS (mapped to 'elective')
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Freie Wahlfächer und Transferable Skills',9,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- THESIS (mapped to 'elective'; mandatory-ness handled via module_grouping)
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Seminar für Diplomand_innen',1.5,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Diplomarbeit',27,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
INSERT INTO module (program_id,name,ects,category)
SELECT id,'Kommissionelle Abschlussprüfung',1.5,'elective' FROM study_program WHERE code='066 937' ON CONFLICT DO NOTHING;
COMMIT;

-- === Courses ===
-- AC
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ALGO','Algorithmics','VU',6,'en'),
                                                       ('ARA','Advanced Research in Algorithmics','VU',6,'en'),
                                                       ('AET','Algorithmic Encoding Techniques','VU',6,'en'),
                                                       ('AGEO','Algorithmic Geometry','VU',6,'en'),
                                                       ('ASOC','Algorithmic Social Choice','VU',6,'en'),
                                                       ('AGT','Algorithms in Graph Theory','VU',6,'en'),
                                                       ('BEA','Beyond Exact Algorithms','VU',6,'en'),
                                                       ('COMPX','Complexity Theory','VU',6,'en'),
                                                       ('FPT','Fixed-Parameter Algorithms and Complexity','VU',6,'en'),
                                                       ('GDA','Graph Drawing Algorithms','VU',6,'en'),
                                                       ('HOT','Heuristic Optimization Techniques','VU',6,'en'),
                                                       ('MPOTL','Mathematical Programming and Optimization in Transport Logistics','VU',6,'en'),
                                                       ('SDMT','Structural Decompositions and Meta Theorems','VU',6,'en'),
                                                       ('ATAC','Advanced Topics In Algorithms and Complexity','SE',3,'en');
COMMIT;

-- AMR
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('MR','Mobile Robotics','VU',6,'en'),
                                                       ('ARC','Autonomous Racing Cars','VU',6,'en'),
                                                       ('ITA','Information Technology in Automation','VU',6,'en'),
                                                       ('PPMR','Programming Principles of Mobile Robotics','VU',6,'en'),
                                                       ('ATAMR','Advanced Topics In Automation and Mobile Robotics','SE',3,'en');
COMMIT;

-- DMIS
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ADS','Advanced Database Systems','VU',6,'en'),
                                                       ('BI','Business Intelligence','VU',6,'en'),
                                                       ('DBT','Database Theory','VU',6,'en'),
                                                       ('DS','Data Stewardship VO','VO',3,'en'),
                                                       ('DSUE','Data Stewardship UE','UE',3,'en'),
                                                       ('KG','Knowledge Graphs','VU',6,'en'),
                                                       ('LBAI','Logic-based Artificial Intelligence','VU',6,'en'),
                                                       ('MGD','Management of Graph Data','VU',6,'en'),
                                                       ('PSAI','Problem Solving and Search in Artificial Intelligence','VU',6,'en'),
                                                       ('PDK','Processing of Declarative Knowledge','VU',6,'en'),
                                                       ('TGD','Theory of Graph Data','VU',6,'en'),
                                                       ('ATDMIS','Advanced Topics In Data Management and Intelligent Systems','SE',3,'en');
COMMIT;

-- DNGC
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('AIC','Advanced Internet Computing','VU',6,'en'),
                                                       ('DST','Distributed Systems Technologies','VU',6,'en'),
                                                       ('ABD','Artifact-based Design','VU',6,'en'),
                                                       ('HQCS','Hybrid Quantum - Classical Systems','VU',6,'en'),
                                                       ('IOT','Internet of Things','VU',6,'en'),
                                                       ('QC','Quantum Computing','VU',6,'en'),
                                                       ('ATDNGC','Advanced Topics In Distributed and Next Generation Computing','SE',3,'en');
COMMIT;

-- HPC
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('AMPP','Advanced Multiprocessor Programming','VU',6,'en'),
                                                       ('GPU','GPU Computing and Architectures','VU',6,'en'),
                                                       ('GHPC','Green HPC','VU',6,'en'),
                                                       ('HPC','High Performance Computing','VU',6,'en'),
                                                       ('HPC4AI','HPC for AI','VU',6,'en'),
                                                       ('ATHPC','Advanced Topics In High Performance Computing','SE',3,'en');
COMMIT;

-- ML
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ML','Machine Learning','VU',6,'en'),
                                                       ('ARL','Advanced Reinforcement Learning','VU',6,'en'),
                                                       ('ADSVU','Algorithms for Data Science','VU',6,'en'),
                                                       ('AGAI','Applied Generative AI and LLM-based Systems','VU',6,'en'),
                                                       ('DLNLP','Deep Learning for Natural Language Processing','VU',6,'en'),
                                                       ('GENAI','Generative AI','VU',6,'en'),
                                                       ('MLO','Machine Learning for Optimization','VU',6,'en'),
                                                       ('RL','Reinforcement Learning','VU',6,'en'),
                                                       ('TFRML','Theoretical Foundations and Research Topics in ML','VU',6,'en'),
                                                       ('TFDL','Theoretical Foundations of Deep Learning','VU',6,'en'),
                                                       ('ATML','Advanced Topics In Machine Learning','SE',3,'en');
COMMIT;

-- SP
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ACR','Advanced Cryptography','VU',6,'en'),
                                                       ('APET','Advanced Privacy Enhancing Technologies','VU',6,'en'),
                                                       ('AICS','Artificial Intelligence for Computer Security','VU',6,'en'),
                                                       ('CRYPTOC','Cryptocurrencies','VU',6,'en'),
                                                       ('FMSP','Formal Methods for Security and Privacy','VU',6,'en'),
                                                       ('NS','Network Security','VU',3,'en'),
                                                       ('NETSECAT','Network Security - Advanced Topics','VU',3,'en'),
                                                       ('SC','Smart Contracts','VU',6,'en'),
                                                       ('SYMCR','Symmetric Cryptography','VU',6,'en'),
                                                       ('SAS','System and Application Security','VU',6,'en'),
                                                       ('ATSP','Advanced Topics In Security and Privacy','SE',3,'en');
COMMIT;

-- SICR
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('HCAI','Advanced Human-Centered AI: from concepts to implementation','VU',6,'en'),
                                                       ('AIE','AI Ethics','VU',6,'en'),
                                                       ('CAS','Critical Algorithm Studies','VU',6,'en'),
                                                       ('CSE','Computer Science Education: Advances in Research and Practice','PR',6,'en'),
                                                       ('CTMI','Critical Theory of Media and Informatics','VU',6,'en'),
                                                       ('HAI','Human-agent Interaction (VU)','VU',6,'en'),
                                                       ('HAIPR','Human-agent Interaction (PR)','PR',6,'en'),
                                                       ('ICS','Introduction to Computational Sustainability','VU',6,'en'),
                                                       ('LTLA','Learning Technologies and Learning Analytics','VU',6,'en'),
                                                       ('RDE','Responsible Digital Ethics','VU',6,'en'),
                                                       ('ATSICR','Advanced Topics In Societal Impact and Critical Reflections','SE',3,'en');
COMMIT;

-- SEP
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('ASE','Advanced Software Engineering','VU',6,'en'),
                                                       ('ASEP','Advanced Software Engineering Project','PR',6,'en'),
                                                       ('ALP','Advanced Logic Programming','VU',6,'en'),
                                                       ('AME','Advanced Model Engineering','VU',6,'en'),
                                                       ('AIP','AI Programming','VU',6,'en'),
                                                       ('EP','Efficient Programs (VU)','VU',3,'en'),
                                                       ('EPPR','Efficient Programs (PR)','PR',3,'en'),
                                                       ('LLP','Low-Level Programming','VU',6,'en'),
                                                       ('ME','Model Engineering','VU',6,'en'),
                                                       ('PPL','Programming Paradigms and Languages','VU',6,'en'),
                                                       ('TS','Type Systems','VU',6,'en'),
                                                       ('ATSEP','Advanced Topics In Software Engineering and Programming','SE',3,'en');
COMMIT;

-- VAR
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('FMSE','Formal Methods in Systems Engineering','VU',6,'en'),
                                                       ('AUTOLOG','Automata and Logic','VU',6,'en'),
                                                       ('ADED','Automated Deduction','VU',6,'en'),
                                                       ('CAV','Computer-Aided Verification','VU',6,'en'),
                                                       ('LAC','Logic and Computability','VU',6,'en'),
                                                       ('PA','Program Analysis','VU',6,'en'),
                                                       ('SATEXT','SAT Algorithms, Applications and Extensions','VU',6,'en'),
                                                       ('ATVAR','Advanced Topics In Verification and Automated Reasoning','SE',3,'en');
COMMIT;

-- MCS / EXT / FWTS / THESIS
INSERT INTO course (code,title,type,ects,language) VALUES
                                                       ('SCS','Seminar in Computer Science','SE',3,'en'),
                                                       ('PRJCS1','Project in Computer Science 1','PR',6,'en'),
                                                       ('PRJCS2','Project in Computer Science 2','PR',6,'en'),
                                                       ('EXTENSION','Extension (Electives)','VU',12,'en'),
                                                       ('FWTSEL','Freie Wahlfächer und Transferable Skills','VU',9,'en'),
                                                       ('SDS','Seminar für Diplomand_innen','SE',1.5,'en'),
                                                       ('MTH','Diplomarbeit','PR',27,'en'),
                                                       ('FOE','Kommissionelle Abschlussprüfung','SE',1.5,'en');
COMMIT;

-- === Link modules to courses ===
-- AC mappings
INSERT INTO module_course (module_id,course_id)
SELECT m.id, c.id
FROM module m
         JOIN course c ON c.code='ALGO'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Algorithmics'
ON CONFLICT DO NOTHING;

INSERT INTO module_course (module_id,course_id)
SELECT m.id, c.id
FROM module m
         JOIN course c ON c.code='ARA'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Research in Algorithmics'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='AET'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Algorithmic Encoding Techniques'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='AGEO'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Algorithmic Geometry'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='ASOC'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Algorithmic Social Choice'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='AGT'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Algorithms in Graph Theory'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='BEA'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Beyond Exact Algorithms'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='COMPX'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Complexity Theory'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='FPT'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Fixed-Parameter Algorithms and Complexity'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='GDA'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Graph Drawing Algorithms'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='HOT'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Heuristic Optimization Techniques'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='MPOTL'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Mathematical Programming and Optimization in Transport Logistics'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='SDMT'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Structural Decompositions and Meta Theorems'
ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id
FROM module m
         JOIN course c ON c.code='ATAC'
         JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Algorithms and Complexity'
ON CONFLICT DO NOTHING;
COMMIT;

-- AMR
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='MR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Mobile Robotics' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ARC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Autonomous Racing Cars' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ITA'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Information Technology in Automation' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='PPMR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Programming Principles of Mobile Robotics' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATAMR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Automation and Mobile Robotics' ON CONFLICT DO NOTHING;
COMMIT;

-- DMIS (Data Stewardship = VO+UE 3+3)
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ADS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Database Systems' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='BI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Business Intelligence' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='DBT'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Database Theory' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('DS','DSUE')
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Data Stewardship' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='KG'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Knowledge Graphs' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='LBAI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Logic-based Artificial Intelligence' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='MGD'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Management of Graph Data' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='PSAI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Problem Solving and Search in AI' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='PDK'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Processing of Declarative Knowledge' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='TGD'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Theory of Graph Data' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATDMIS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Data Management and Intelligent Systems' ON CONFLICT DO NOTHING;
COMMIT;

-- DNGC
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AIC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Internet Computing' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='DST'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Distributed Systems Technologies' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ABD'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Artifact-based Design' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='HQCS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Hybrid Quantum - Classical Systems' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='IOT'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Internet of Things' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='QC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Quantum Computing' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATDNGC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Distributed and Next Generation Computing' ON CONFLICT DO NOTHING;
COMMIT;

-- HPC
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AMPP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Multiprocessor Programming' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='GPU'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='GPU Computing and Architectures' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='GHPC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Green HPC' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='HPC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='High Performance Computing' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='HPC4AI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='HPC for AI' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATHPC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In High Performance Computing' ON CONFLICT DO NOTHING;
COMMIT;

-- ML
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ML'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Machine Learning' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ARL'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Reinforcement Learning' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ADSVU'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Algorithms for Data Science' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AGAI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Applied Generative AI and LLM-based Systems' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='DLNLP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Deep Learning for NLP' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='GENAI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Generative AI' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='MLO'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Machine Learning for Optimization' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='RL'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Reinforcement Learning' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='TFRML'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Theoretical Foundations and Research Topics in ML' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='TFDL'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Theoretical Foundations of Deep Learning' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATML'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Machine Learning' ON CONFLICT DO NOTHING;
COMMIT;

-- SP (incl. split Network Security)
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ACR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Cryptography' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='APET'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Privacy Enhancing Technologies' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AICS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Artificial Intelligence for Computer Security' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='CRYPTOC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Cryptocurrencies' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='FMSP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Formal Methods for Security and Privacy' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('NS','NETSECAT')
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Network Security' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='SC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Smart Contracts' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='SYMCR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Symmetric Cryptography' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='SAS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='System and Application Security' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATSP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Security and Privacy' ON CONFLICT DO NOTHING;
COMMIT;

-- SICR (incl. 12 ECTS HAI via VU+PR)
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='HCAI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Human-Centered AI: from concepts to implementation' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AIE'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='AI Ethics' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='CAS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Critical Algorithm Studies' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='CSE'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Computer Science Education: Advances in Research and Practice' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='CTMI'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Critical Theory of Media and Informatics' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('HAI','HAIPR')
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Human-agent Interaction' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ICS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Introduction to Computational Sustainability' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='LTLA'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Learning Technologies and Learning Analytics' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='RDE'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Responsible Digital Ethics' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATSICR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Societal Impact and Critical Reflections' ON CONFLICT DO NOTHING;
COMMIT;

-- SEP
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ASE'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Software Engineering' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ASEP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Software Engineering Project' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ALP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Logic Programming' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AME'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Model Engineering' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AIP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='AI Programming' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('EP','EPPR')
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Efficient Programs' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='LLP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Low-Level Programming' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ME'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Model Engineering' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='PPL'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Programming Paradigms and Languages' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='TS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Type Systems' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATSEP'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Software Engineering and Programming' ON CONFLICT DO NOTHING;
COMMIT;

-- VAR
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='FMSE'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Formal Methods in Systems Engineering' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='AUTOLOG'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Automata and Logic' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ADED'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Automated Deduction' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='CAV'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Computer-Aided Verification' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='LAC'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Logic and Computability' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='PA'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Program Analysis' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='SATEXT'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='SAT Algorithms, Applications and Extensions' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='ATVAR'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Advanced Topics In Verification and Automated Reasoning' ON CONFLICT DO NOTHING;
COMMIT;

-- MCS
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='SCS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Seminar in Computer Science' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code IN ('PRJCS1','PRJCS2')
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Project in Computer Science' ON CONFLICT DO NOTHING;

-- EXT / FWTS / THESIS
INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='EXTENSION'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Extension' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='FWTSEL'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Freie Wahlfächer und Transferable Skills' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='SDS'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Seminar für Diplomand_innen' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='MTH'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Diplomarbeit' ON CONFLICT DO NOTHING;

INSERT INTO module_course
SELECT m.id,c.id FROM module m JOIN course c ON c.code='FOE'
                               JOIN study_program sp ON sp.id=m.program_id AND sp.code='066 937'
WHERE m.name='Kommissionelle Abschlussprüfung' ON CONFLICT DO NOTHING;
COMMIT;

-- === module_grouping: tie modules to exam subjects (+ => mandatory) ===

-- AC
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name='Algorithmics')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='AC'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Algorithmics','Advanced Research in Algorithmics','Algorithmic Encoding Techniques','Algorithmic Geometry',
                                                            'Algorithmic Social Choice','Algorithms in Graph Theory','Beyond Exact Algorithms','Complexity Theory',
                                                            'Fixed-Parameter Algorithms and Complexity','Graph Drawing Algorithms','Heuristic Optimization Techniques',
                                                            'Mathematical Programming and Optimization in Transport Logistics','Structural Decompositions and Meta Theorems',
                                                            'Advanced Topics In Algorithms and Complexity'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- AMR
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name='Mobile Robotics')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='AMR'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Mobile Robotics','Autonomous Racing Cars','Information Technology in Automation',
                                                            'Programming Principles of Mobile Robotics','Advanced Topics In Automation and Mobile Robotics'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- DMIS
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name='Advanced Database Systems')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='DMIS'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Advanced Database Systems','Business Intelligence','Database Theory','Data Stewardship','Knowledge Graphs',
                                                            'Logic-based Artificial Intelligence','Management of Graph Data','Problem Solving and Search in AI',
                                                            'Processing of Declarative Knowledge','Theory of Graph Data',
                                                            'Advanced Topics In Data Management and Intelligent Systems'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- DNGC
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name IN ('Advanced Internet Computing','Distributed Systems Technologies'))::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='DNGC'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Advanced Internet Computing','Distributed Systems Technologies','Artifact-based Design',
                                                            'Hybrid Quantum - Classical Systems','Internet of Things','Quantum Computing',
                                                            'Advanced Topics In Distributed and Next Generation Computing'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- HPC
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='HPC'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Advanced Multiprocessor Programming','GPU Computing and Architectures','Green HPC',
                                                            'High Performance Computing','HPC for AI','Advanced Topics In High Performance Computing'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- ML
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name='Machine Learning')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='ML'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Machine Learning','Advanced Reinforcement Learning','Algorithms for Data Science',
                                                            'Applied Generative AI and LLM-based Systems','Deep Learning for NLP','Generative AI',
                                                            'Machine Learning for Optimization','Reinforcement Learning',
                                                            'Theoretical Foundations and Research Topics in ML','Theoretical Foundations of Deep Learning',
                                                            'Advanced Topics In Machine Learning'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- SP
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='SP'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Advanced Cryptography','Advanced Privacy Enhancing Technologies','Artificial Intelligence for Computer Security',
                                                            'Cryptocurrencies','Formal Methods for Security and Privacy','Network Security','Smart Contracts',
                                                            'Symmetric Cryptography','System and Application Security','Advanced Topics In Security and Privacy'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- SICR
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='SICR'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Advanced Human-Centered AI: from concepts to implementation','AI Ethics','Critical Algorithm Studies',
                                                            'Computer Science Education: Advances in Research and Practice','Critical Theory of Media and Informatics',
                                                            'Human-agent Interaction','Introduction to Computational Sustainability',
                                                            'Learning Technologies and Learning Analytics','Responsible Digital Ethics',
                                                            'Advanced Topics In Societal Impact and Critical Reflections'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- SEP
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name IN ('Advanced Software Engineering','Advanced Software Engineering Project'))::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='SEP'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Advanced Software Engineering','Advanced Software Engineering Project','Advanced Logic Programming',
                                                            'Advanced Model Engineering','AI Programming','Efficient Programs','Low-Level Programming',
                                                            'Model Engineering','Programming Paradigms and Languages','Type Systems',
                                                            'Advanced Topics In Software Engineering and Programming'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- VAR
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, (m.name='Formal Methods in Systems Engineering')::boolean
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='VAR'
         JOIN module m ON m.program_id=sp.id AND m.name IN (
                                                            'Formal Methods in Systems Engineering','Automata and Logic','Automated Deduction',
                                                            'Computer-Aided Verification','Logic and Computability','Program Analysis',
                                                            'SAT Algorithms, Applications and Extensions','Advanced Topics In Verification and Automated Reasoning'
    ) ON CONFLICT DO NOTHING;
COMMIT;

-- MCS
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='MCS'
         JOIN module m ON m.program_id=sp.id AND m.name IN ('Seminar in Computer Science','Project in Computer Science')
ON CONFLICT DO NOTHING;
COMMIT;

-- EXT
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='EXT'
         JOIN module m ON m.program_id=sp.id AND m.name IN ('Extension') ON CONFLICT DO NOTHING;
COMMIT;

-- FWTS
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, false
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='FWTS'
         JOIN module m ON m.program_id=sp.id AND m.name IN ('Freie Wahlfächer und Transferable Skills')
ON CONFLICT DO NOTHING;
COMMIT;

-- THESIS (mark as mandatory via grouping)
INSERT INTO module_grouping (exam_subject_id,module_id,is_mandatory)
SELECT es.id, m.id, true
FROM exam_subject es
         JOIN study_program sp ON sp.id=es.program_id AND sp.code='066 937' AND es.code='THESIS'
         JOIN module m ON m.program_id=sp.id AND m.name IN ('Seminar für Diplomand_innen','Diplomarbeit','Kommissionelle Abschlussprüfung')
ON CONFLICT DO NOTHING;
COMMIT;
