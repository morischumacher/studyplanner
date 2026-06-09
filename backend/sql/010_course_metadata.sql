-- Full bachelor syllabus migration: "Inhalt" metadata only
-- Total Courses: 70

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["reale Maschinen, Prozesssorarchitekturen", "Interpretationstechniken (threaded code), Implementierung von Forth", "Pascal P4 Maschine", "Java Virtuelle Machine (just-in-time Übersetzung), Microsoft Intermediate Language", "Registermaschinen und die DalvikVM", "syntaxgesteuerte Editoren und Baummaschinen", "Prologmaschinen (WAM, VAM)", "funktionale Maschinen (Lamda Kalkül, SECD Maschine)"]'::jsonb
)
WHERE title ILIKE 'Abstrakte Maschinen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Theorien und Ansätze zum Technologiezugang (Geschlecht, Klasse, Behinderung, Health Care)", "Methoden und Konzepte von Access Computing", "Im Alltag unterstützende Technologien", "Aktuelle wissenschaftliche Arbeiten und Empfehlungen", "Bewertung technologischer Einrichtungen (VR, AR, Wearables, Spiele)", "Selbstermächtigung und Effizienzerhöhung"]'::jsonb
)
WHERE title ILIKE 'Access Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Elementare Logik und Beweistechniken", "Mengenlehre, Funktionen und Relationen", "Induktionsprinzip und rekursive Definitionen", "Grundlagen der Kombinatorik und Rekursionen", "Graphentheorie und Graph-Algorithmen", "Algebraische Strukturen (Gruppen, Ringe, Körper)", "Lineare Algebra (Matrizen, Eigenwerte)", "Algebraische Codierungstheorie"]'::jsonb
)
WHERE title ILIKE 'Algebra und Diskrete Mathematik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Prinzipien der Algorithmenanalyse", "Asymptotische Schranken", "Fundamentale Datenstrukturen (Listen, Graphen, Suchbäume)", "Algorithmische Prinzipien (Greedy, Divide-and-Conquer, Dynamische Programmierung, Hashing)", "Problemlösungsstrategien und Optimierung", "NP-Vollständigkeit und Polynomialzeitreduktionen"]'::jsonb
)
WHERE title ILIKE 'Algorithmen und Datenstrukturen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Folgen, Reihen und Funktionen", "Elementare Funktionen (Exponentialfunktion, Logarithmus)", "Grenzwerte, Nullstellen und Stetigkeit", "Differentialrechnung in einer Variablen", "Integralrechnung in einer Variablen", "Elementare Differentialgleichungen", "Differentialrechnung in mehreren Variablen", "Computer-Numerik und Fehlerfortpflanzung"]'::jsonb
)
WHERE title ILIKE 'Analysis%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Aufgaben eines Beweises", "Einfache Beweistechniken für logische Aussagen", "Zusammenhang zum Kalkül des natürlichen Schliessens", "Induktionsarten (mathematische, starke, strukturelle, Noethersche)", "Strukturierung von Induktionsbeweisen"]'::jsonb
)
WHERE title ILIKE 'Argumentieren und Beweisen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Binary exploitation", "Reverse engineering", "Web Security", "Kryptographie", "Netzwerk Security", "Forensik", "Security und Protection", "Mobile Security", "Fuzzing", "Security-Fehlkonfiguration"]'::jsonb
)
WHERE title ILIKE 'Attacks and Defenses in Computer Security%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Basic audio theory", "Audio hardware (microphones, interfaces)", "Recording techniques", "Introduction to the DAW", "Audio editing and mixing", "Video planning and pre-production", "Shot composition", "Video recording techniques", "Basic storytelling", "Lighting and Color Correction"]'::jsonb
)
WHERE title ILIKE 'Audio and Video Production%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Seminar Wissenschaftliches Arbeiten (Methoden, Wissenschaftsbetrieb)", "Themenspezifische Recherche", "Projekt Bachelorarbeit", "Schriftliche Abschlussarbeit"]'::jsonb
)
WHERE title ILIKE 'Bachelorarbeit%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Architektur von Computersystemen", "Grundkonzepte Betriebssysteme", "Prozesse, Threads und Scheduling", "Prozesssynchronisation und Deadlock", "Speicherverwaltung", "Ein/Ausgabe und Disk Management", "Security und Protection", "Systemprogrammierung in C (Parameter, Sockets, fork, exec)"]'::jsonb
)
WHERE title ILIKE 'Betriebssysteme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Grundlagen der biomedizinischen Visualisierung und Visual Analytics", "Taxonomien, Modelle und Informationsdesign", "Biomedizinische Datenvorverarbeitung", "Visualisierung volumetrischer und abstrakter Daten", "Visual Analytics für heterogene Mengen", "Interaktionstechniken", "Evaluierungsmethoden"]'::jsonb
)
WHERE title ILIKE 'Bio-Medical Visualization and Visual Analytics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Exploration statistischer Daten", "Vergleich von Statistiksoftware (SPSS, SAS, R)", "Programmierung in R", "Varianzanalyse, Regression und Simulation", "MCMC Methoden und Resamplingverfahren (Bootstrap, Jackknife)"]'::jsonb
)
WHERE title ILIKE 'Computational Statistics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Technische Musikgeschichte", "Klangphänomenologie und assoziatives Hören", "Entwicklung elektronischer Musikinstrumente", "Aufbau eines Audiosettings (DAW, MIDI)", "Field Recording", "Modulationssynthese", "FFT Analyse und Granularsynthese", "Physikalische Modelle"]'::jsonb
)
WHERE title ILIKE 'Computermusik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Aufbau und Funktionsweise von Prozessorelementen", "Pipelining und Speicherhierarchien", "Sekundärspeicher und Peripheriegeräte", "Multiprozessoren und Cluster", "Ziele von Computernetzen", "Protokollschichten und Dienstmodelle", "Internet-basierende Protokolle", "Netzwerkmanagement"]'::jsonb
)
WHERE title ILIKE 'Computersysteme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Video-Sektion: Scriptwriting, Storytelling, Composition", "Audio-Sektion: Preproduction, Recording, Soundtracks, Sound Effects"]'::jsonb
)
WHERE title ILIKE 'Creative Media Production%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Stichprobendesign und Datenerhebung", "Explorative Datenanalyse", "Parametrische/nichtparametrische Verfahren", "Lineare Modelle", "Multivariate Methoden", "Zeitreihenanalyse", "Programmierung in R"]'::jsonb
)
WHERE title ILIKE 'Datenanalyse%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Datenbankentwurf (ER/EER-Diagramme)", "Relationales Datenmodell", "Normalformen", "Anfragesprachen (Algebra, Kalkül, SQL)", "Schachtelung und Rekursion in SQL", "Anfrageoptimierung", "Transaktionen und Fehlerbehandlung"]'::jsonb
)
WHERE title ILIKE 'Datenbanksysteme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Grundlagen Staat und nationales Recht", "Internationales und EU-Recht", "Regulierung von IT durch Recht", "Grundrechte und Datenschutzrecht", "Softwarelizenzierung (OSS)", "Materielles Internetrecht"]'::jsonb
)
WHERE title ILIKE 'Daten- und Informatikrecht%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Entscheidungsprozeduren (SAT und QSAT Solver)", "Normalformtransformationen", "Problemlösen mittels SAT/QSAT", "Semantiken der Logikprogrammierung", "Antwortmengenprogrammierung (ASP)"]'::jsonb
)
WHERE title ILIKE 'Deklaratives Problemlösen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Vorwissenschaftliche und naturwissenschaftliche Denkweisen", "Mathematisches Denken (Rekursion, Induktion)", "Computational Thinking und Berechenbarkeit", "Design Thinking", "Kreativität und kritisches Denken (Bias)", "Ethik und Verantwortung", "Geschichte der Informatik", "Informatik und Gesellschaft"]'::jsonb
)
WHERE title ILIKE 'Denkweisen der Informatik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Designansätze und Denkschulen", "Design Thinking Methoden", "Fertigung und Fertigungsprozesse", "Werkzeuge der digitalen Fertigung"]'::jsonb
)
WHERE title ILIKE 'Design und Fertigung%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["HCI Aspekte im Gesundheitswesen", "Anforderungsanalyse (Requirements Engineering)", "Prototyping und Evaluation", "Mobile Basics (p pervasive/sensor-basiert)", "Telemedizin, Telecare und Ambient Assisted Living", "Standards im Gesundheitswesen"]'::jsonb
)
WHERE title ILIKE 'Design und Entwicklung von Anwendungen im Gesundheitswesen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Algorithmenkomplexität und O-Notation", "Graphentheorie", "Matroide und Greedy-Algorithmen", "Approximierbarkeit", "Stringalgorithmen", "Schedulingalgorithmen", "Algorithmen für große Datenmengen und AI"]'::jsonb
)
WHERE title ILIKE 'Effiziente Algorithmen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Geschichte der AI", "Intelligente Agenten", "Suchverfahren", "Constraint Satisfaction Probleme (CSP)", "Wissensrepräsentation und Planen", "Maschinelles Lernen (Neuronale Netze, Deep Learning)", "Entscheidungstheorie", "Philosophische und ethische Aspekte"]'::jsonb
)
WHERE title ILIKE 'Einführung in Artificial Intelligence%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Prozedurale Programmierkonzepte", "Entwicklungsmethoden (Abstraktion, Debugging)", "Rekursion", "Datenabstraktion", "Rekursive Datenstrukturen (Listen, Bäume)", "Grundlegende Algorithmen (Sortieren, Suchen)", "Exception-Handling"]'::jsonb
)
WHERE title ILIKE 'Einführung in die Programmierung%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Sprachverarbeitung (Tokenization, Stemming)", "Sprachmodelle", "Inverted Index", "Suche, Scoring und Ranking", "Evaluierungsmetriken (MAP, NDCG)", "Websuche und PageRank", "Multimodale Suche"]'::jsonb
)
WHERE title ILIKE 'Einführung in Information Retrieval%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Geschichte und Taxonomie", "Fehlerschranken, Datenaufbereitung und Evaluierung", "Regelbasierte Klassifikation", "Clustering und Dimensionsreduktion", "Kernmethoden und Ensembles", "Deep Learning", "Reinforcement Learning"]'::jsonb
)
WHERE title ILIKE 'Einführung in Machine Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Mathematische Grundlagen (Hilbertraum, unitäre Operatoren)", "Grundprinzipien der Quantenmechanik", "Quantengatter und Schaltkreise", "Algorithmen (Deutsch, Grover, Periode)", "Hardware für Quantum Computing"]'::jsonb
)
WHERE title ILIKE 'Einführung in Quantencomputing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Sicherheitsprinzipien (CIA)", "Authentifikation", "Systemsicherheit (Overflows, ASLR)", "Websicherheit (Injection, XSS, CSRF)", "Informationsfluss", "Kryptographie und Netzwerkprotokolle (TLS)"]'::jsonb
)
WHERE title ILIKE 'Einführung in Security%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Digitale Bilder und Bildoperationen", "Segmentierung und Bewegungserkennung", "Kodierung und Komprimierung (JPEG, MPEG)", "Hardware und Sensoren", "Rendering Pipeline", "Licht und Schattierung", "Ray-Tracing", "Computational Photography"]'::jsonb
)
WHERE title ILIKE 'Einführung in Visual Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Prädikatenlogik als Spezifikationssprache", "Description Logik und Ontologien", "Nichtmonotones Schließen", "Answer-Set Programmierung", "Probabilistische Verfahren", "Entwicklung wissensbasierter Systeme"]'::jsonb
)
WHERE title ILIKE 'Einführung in wissensbasierte Systeme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Betriebssystemsicherheit", "Mobile Plattformarchitekturen", "Netzwerksicherheit", "Intrusion Detection", "Secure Software Development", "Web Application Security", "Risikomanagement"]'::jsonb
)
WHERE title ILIKE 'Foundations of System and Application Security%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Abhängig von den gewählten Lehrveranstaltungen"]'::jsonb
)
WHERE title ILIKE 'Freie Wahlfächer und Transferable Skills%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Typische Konzepte (Funktionen höherer Ordnung, Polymorphie)", "Auswertungsordnungen (fleissig vs. faul)", "Datenstrukturen und Typprüfung", "Lambda-Kalkül"]'::jsonb
)
WHERE title ILIKE 'Funktionale Programmierung%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Höhere graphische Programmierung", "Modellierungstechniken", "Komplexe Datenstrukturen", "Abtastung und Rekonstruktion", "Texturierung", "Digital Fabrication", "Visualisierung"]'::jsonb
)
WHERE title ILIKE 'Grundlagen der Computergraphik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Texture, Scenes, und Context", "Lokale & Multiskala Repräsentationen", "Scene Recognition und SIFT", "Support Vector Machines", "Deep Learning und CNNs", "Unsupervised methods (SOM)"]'::jsonb
)
WHERE title ILIKE 'Grundlagen der Computer Vision%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Begriffsabklärung und Historie", "Taxonomien und Informationsdesign", "Wissenschaftliche Visualisierung", "Visual Analytics", "Interaktionstechniken", "Evaluierungsmethoden"]'::jsonb
)
WHERE title ILIKE 'Grundlagen der Visualisierung%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Zahlendarstellung und Gleitkommaarithmetik", "Informations- und Codierungstheorie", "Aussagenlogik und Boolesche Algebra", "Prädikatenlogik", "Endliche Automaten (Moore, Mealy)", "Reguläre Ausdrücke und Grammatiken", "Schaltnetze und Petri-Netze"]'::jsonb
)
WHERE title ILIKE 'Grundzüge digitaler Systeme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Historischer Abriss der menschlichen Optimierung", "Automation vs. Augmentation", "Menschmodelle (Psychologie, Neurowissenschaften)", "Human Factors Engineering", "Wearables und Exoskelette", "Brain-Computer Interfaces"]'::jsonb
)
WHERE title ILIKE 'Human Augmentation%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Einführung in eHealth", "Aufbau von Informationssystemen", "Interoperabilität und Kommunikation", "Medizinische Dokumentation", "Standards (HL7, DICOM, IHE, SNOMED CT)", "Security-Aspekte im Gesundheitswesen"]'::jsonb
)
WHERE title ILIKE 'Informationssysteme des Gesundheitswesens%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Planung und Gestaltung von Benutzerschnittstellen", "Grundlagen von User Interface Design", "Designkonzepte und Gestaltungsprinzipien", "Prozesse für Interaction Design", "Trends und neue Interfaces"]'::jsonb
)
WHERE title ILIKE 'Interface und Interaction Design%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Information-theoretic security", "Computational security", "Symmetric encryption", "Message authentication codes", "Hash functions", "Public-key encryption", "Digital signatures"]'::jsonb
)
WHERE title ILIKE 'Introduction to Cryptography%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Formalisierung mit Logik", "Aussagenlogik und Beweissysteme", "SAT-Solving und DPLL", "Resolutionsverfahren", "Binäre Entscheidungsdiagramme (BDDs)", "Satisfiability Modulo Theory (SMT)"]'::jsonb
)
WHERE title ILIKE 'Logic and Reasoning in Computer Science%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Klassische Logik zur Wissensrepräsentation", "Nichtmonotones Schließen", "Parakonsistente Logiken", "Wissensrevision (Belief Revision)", "Modallogik"]'::jsonb
)
WHERE title ILIKE 'Logik für Wissensrepräsentation%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Deklarative Programmierparadigmen", "Deklarative Diagnose", "Termination", "Grammatiken", "Constraints", "Programmieren höherer Ordnung", "Pure I/O"]'::jsonb
)
WHERE title ILIKE 'Logikprogrammierung und Constraints%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Naive Mengenlehre", "Aussagen- und Prädikatenlogik erster Stufe", "Resolutionsmethode", "Modelltheorie (Vollständigkeit, Kompaktheit)", "Berechenbarkeitstheorie", "ZFC-Axiome"]'::jsonb
)
WHERE title ILIKE 'Logik und Grundlagen der Mathematik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Aussagen- und Prädikatenlogik", "Begriffe von Definition und Beweis", "Mengennotation", "Gleichungen und Ungleichungen", "Induktionsbeweise"]'::jsonb
)
WHERE title ILIKE 'Mathematisches Arbeiten%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Prinzipien, Herausforderungen und Probleme der Mensch-KI-Interaktion"]'::jsonb
)
WHERE title ILIKE 'Menschzentrierte Künstliche Intelligenz%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Design of Experiments", "Kategorielle Datenanalyse (Kontingenztafeln, logistische Regression)", "Survival Analysis (Hazard-Modelle, Cox-Regression)"]'::jsonb
)
WHERE title ILIKE 'Methoden der Angewandten Statistik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Anatomie, Physiologie und Pathologie", "Chemie der Biomoleküle", "Generierung biomedizinischer Daten (Biosignale, med. Bilder)", "Methoden der Datenanalyse (Bioanalytik, CV, ML)", "Evaluierungsmethoden"]'::jsonb
)
WHERE title ILIKE 'Methods for Data Generation and Analytics in Medicine and Life Sciences%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Clusteranalyse", "Hauptkomponenten- und Faktorenanalyse", "Diskriminanzanalyse", "Regressionsmodelle"]'::jsonb
)
WHERE title ILIKE 'Multivariate Statistik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Repräsentation zeitabhängiger Medien", "Hören und Psychoakustik", "Sehen und Psychovision", "Streaming", "Audio- und Video-Kompression (MP3, AAC, MPEG-4)", "Klassifikation und Retrieval von Mediendaten"]'::jsonb
)
WHERE title ILIKE 'Multimedia%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Fehlerbegriffe (Datenfehler, Rundung)", "Kondition mathematischer Probleme", "Lineare/nichtlineare Gleichungssysteme", "Interpolation und Approximation", "Integration und Differentialgleichungen", "MATLAB Standardsoftware"]'::jsonb
)
WHERE title ILIKE 'Numerical Computation%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Komplexität und Speed-up", "Parallelrechnerarchitekturen", "Algorithmische Muster (Stencil, Sortieren)", "Synchronisationsprobleme", "Daten- und Aufgaben-Parallelität", "OpenMP, Cilk und MPI"]'::jsonb
)
WHERE title ILIKE 'Parallel Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Systeme für Online-Anonymität (Remailer, Darknets)", "Tor (Onion Routing)", "Internetzensur", "Transport Layer Security (TLS, PKI)", "Secure Messaging (PGP, OTR, Signal)", "Web Privacy (Tracking, Fingerprinting)"]'::jsonb
)
WHERE title ILIKE 'Privacy-Enhancing Technologies%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Modellierung und Spezifikation (Logik, Automaten, Assertions)", "Verifikationswerkzeuge (Model Checker, Statische Analyse)", "Zertifizierung und Industriestandards"]'::jsonb
)
WHERE title ILIKE 'Programm- und Systemverifikation%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Überblick über Paradigmen (objektorientiert, funktional, nebenläufig)", "Modularisierungseinheiten", "Parametrisierung", "Typisierung", "Exceptions", "Threads und Synchronisation", "Entwurfsmuster"]'::jsonb
)
WHERE title ILIKE 'Programmierparadigmen%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Konzeption und Entwurf (Storyboard)", "Entwickeln einer 3D Engine", "Modellierung von Szenen und Animation"]'::jsonb
)
WHERE title ILIKE 'Programmiertechniken für Visual Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Grundlagen semi- und schwach-strukturierter Daten", "Markup-Sprachen (XML)", "Graph-basierte Daten (RDF)", "Schemasprachen", "Abfragesprachen"]'::jsonb
)
WHERE title ILIKE 'Semistrukturierte Daten%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Wechselwirkung Technik und Gesellschaft", "Bias in technologischer Gestaltung", "Auswirkungen auf Minderheiten", "Überwachungs/Kontrollgesellschaft", "Technikfolgenabschätzung", "Sozio-technische Analysen"]'::jsonb
)
WHERE title ILIKE 'Sozio-technische Systeme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Grundlagen des Software Engineerings", "Vorgehensmodelle, Prozesse und Rollen", "Anforderungsanalyse, Entwurf, Testen", "Modellierung (UML)", "Qualitätssicherung", "Projektmanagement"]'::jsonb
)
WHERE title ILIKE 'Software Engineering%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Anwenden agiler Vorgehensmodelle", "Modellbildung in der Softwaretechnik", "Planung und Dokumentation", "Lösen von Problemen im Team", "Präsentation von Ergebnissen"]'::jsonb
)
WHERE title ILIKE 'Software Engineering Projekt%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Grundlagen der Qualitätssicherung", "Qualitätskontrolle (Reviews, Inspektionen)", "Dynamische/Organisatorische QS", "QS-Standards", "Test-Driven Development", "Testautomatisierung"]'::jsonb
)
WHERE title ILIKE 'Software-Qualitätssicherung%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Beschreibende Statistik", "Wahrscheinlichkeitstheorie", "Informationstheorie", "Zufallsvariablen und Verteilungen", "Schätzungen und Hypothesentests", "Regression und Korrelation"]'::jsonb
)
WHERE title ILIKE 'Statistik und Wahrscheinlichkeitstheorie%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Automatentheorie (Turing-Maschinen, Kellerautomaten)", "Formale Sprachen (regulär, kontextfrei)", "Berechenbarkeit und Unentscheidbarkeit", "NP-Vollständigkeit", "Programmiersprachen-Semantik"]'::jsonb
)
WHERE title ILIKE 'Theoretische Informatik%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Struktur von Übersetzern", "Lexikalische Analyse", "Syntax-Analyse", "Syntaxgesteuerte Übersetzung", "Codeerzeugung", "Optimierungen", "Laufzeitsysteme"]'::jsonb
)
WHERE title ILIKE 'Übersetzerbau%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Konzept, Gestaltung und Evaluation", "Human Centered Design Prozess", "Mobile Interaction Research", "Quality of Experience", "Cognitive User Interfaces", "Spatial Interaction"]'::jsonb
)
WHERE title ILIKE 'Usability Engineering and Mobile Interaction%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Übersicht, Grundlagen und Modelle", "Prozesse und Kommunikation", "Benennung", "Fehlertoleranz", "Synchronisierung", "Konsistenz und Replikation", "Verteilte Dateisysteme", "Sicherheit"]'::jsonb
)
WHERE title ILIKE 'Verteilte Systeme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Architekturelle Grundlagen des WWW (Protokolle, Server)", "Markup- und Stylesheet Sprachen", "Interaktive Web-Anwendungen", "Web Services", "Barrierefreie Entwicklung", "Entwurfsmuster"]'::jsonb
)
WHERE title ILIKE 'Web Engineering%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Zuverlässigkeit, Verfügbarkeit, MTTF", "Quantitative Analysen (Markov-Prozesse)", "Fehlertoleranz (Redundanz, Voting)", "Echtzeitscheduling und -kommunikation", "Uhrensynchronisation", "Echtzeitbetriebsysteme"]'::jsonb
)
WHERE title ILIKE 'Zuverlässige Echtzeitsysteme%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Provable security, the random-oracle model", "elliptic-curve-based cryptography", "zero-knowledge and succinct proof systems", "secure multi-party computation", "post-quantum (lattice-based) cryptography"]'::jsonb
)
WHERE title ILIKE 'Advanced Cryptography%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Advanced features and extensions of relational data management", "Introduction to distributed data processing techniques (MapReduce and Spark)", "Basic principles of various NoSQL systems"]'::jsonb
)
WHERE title ILIKE 'Advanced Database Systems%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Basics of AI systems (supervised, unsupervised, reinforcement learning)", "Recommender systems: definitions, collaborative filtering, similarity measures", "Natural language processing: syntax, semantics, tokenization, stemming", "Gesture recognition: sequence classification, Markov property, video-based pose detection", "Adaptive user interfaces", "Explainable AI: interpretability, LIME, SHAP"]'::jsonb
)
WHERE title ILIKE 'Advanced Human-Centered AI%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Service-oriented Computing and SOA", "Cloud, edge and fog computing", "Microservices to serverless computing", "Internet of Things: Architectures and technologies", "IoT-Cloud Continuum", "Edge computing and AI/ML at the edge"]'::jsonb
)
WHERE title ILIKE 'Advanced Internet Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["All solutions predicates", "Meta programming", "Higher-order programming", "Lambda expressions", "Reification", "Meta interpreters", "Program transformations"]'::jsonb
)
WHERE title ILIKE 'Advanced Logic Programming%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Ontology-driven conceptual modeling", "Multi-level modeling", "Langium", "Language Server Protocol (LSP) and GLSP", "Web modeling and visualization", "Development of plugins for LSP ecosystems (Theia, VS Code)"]'::jsonb
)
WHERE title ILIKE 'Advanced Model Engineering%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Synchronization and coordination problems for shared-memory multiprocessors", "Memory models and behavior", "Lock-based, lock- and wait-free algorithms", "Lock-free algorithms and data structures", "Work-stealing schedulers"]'::jsonb
)
WHERE title ILIKE 'Advanced Multiprocessor Programming%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of algorithms and complexity (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Algorithms and Complexity%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of automation and mobile robotics (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Automation and Mobile Robotics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of data management and intelligent systems (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Data Management and Intelligent Systems%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of distributed and next generation computing (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Distributed and Next Generation Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of high performance computing (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In High Performance Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of machine learning (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Machine Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of security and privacy (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Security and Privacy%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of societal impact and critical reflections (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Societal Impact and Critical Reflections%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of software engineering and programming (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Software Engineering and Programming%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Selected areas of verification and automated reasoning (topics vary from term to term)"]'::jsonb
)
WHERE title ILIKE 'Advanced Topics In Verification and Automated Reasoning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Confidentiality concepts", "Secret sharing", "Differential privacy", "Secure multi-party computation", "Machine learning and privacy"]'::jsonb
)
WHERE title ILIKE 'Advanced Privacy Enhancing Technologies%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Distributional reinforcement learning", "Distributional deep reinforcement learning", "Convergence proofs in reinforcement learning"]'::jsonb
)
WHERE title ILIKE 'Advanced Reinforcement Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Research-oriented work in algorithmics", "Computational social choice", "Algorithmic game theory", "Computational geometry", "Graph algorithms", "Approximation techniques", "Resource allocation and fair division"]'::jsonb
)
WHERE title ILIKE 'Advanced Research in Algorithmics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Static program-analysis (deductive verification, symbolic execution)", "Dynamic program-analysis (greybox/blackbox fuzzing)", "Specification-inference", "Program-synthesis", "Reliability in smart contracts and ML models"]'::jsonb
)
WHERE title ILIKE 'Advanced Software Engineering';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Engineering large software systems", "Value-based Software Engineering", "System size and complexity", "Architecture styles (component-based)", "Continuous integration and testing", "Software engineering for mobile devices"]'::jsonb
)
WHERE title ILIKE 'Advanced Software Engineering Project%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Ethical challenges in AI (disinformation, sustainability, privacy)", "AI alignment and human-in-the-loop", "Ethical theories (utilitarianism, virtue ethics, feminist ethics)"]'::jsonb
)
WHERE title ILIKE 'AI Ethics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Fundamental concepts of AI programming", "Programming paradigms for AI systems", "AI for code", "Representation and inference", "Probabilistic and differentiable programming"]'::jsonb
)
WHERE title ILIKE 'AI Programming%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Encoding strategies (eager vs lazy)", "Local consistency and propagation", "Symmetry-breaking techniques", "Correctness certification", "Incremental and parallel solving"]'::jsonb
)
WHERE title ILIKE 'Algorithmic Encoding Techniques%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Convex hulls and polygon triangulations", "Orthogonal range searching and point location", "Voronoi diagrams and Delaunay triangulations", "Point-line duality", "Shortest paths and robot motion planning"]'::jsonb
)
WHERE title ILIKE 'Algorithmic Geometry%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Aggregating preferences and voting", "Preference domain restrictions", "Matching under preferences", "Algorithmic mechanism design", "Fair allocation of resources (cake cutting)"]'::jsonb
)
WHERE title ILIKE 'Algorithmic Social Choice%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Advanced algorithmic methods and complexity analysis", "Graph theory and structural decompositions", "Mathematical optimization and linear programming", "Geometric algorithms, approximation, and randomization"]'::jsonb
)
WHERE title ILIKE 'Algorithmics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Graph mining and sublinear-time estimation", "Similarity and nearest neighbor search (min-hash, LSH)", "Streaming algorithms", "Clustering (k-Means++)", "Dimensionality reduction", "Matrix factorizations"]'::jsonb
)
WHERE title ILIKE 'Algorithms for Data Science%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Matching algorithms and theory", "Planarity testing and algorithms for planar graphs", "Graph width measures", "Algorithms for sparse graph classes"]'::jsonb
)
WHERE title ILIKE 'Algorithms in Graph Theory%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Modern Generative AI Architectures (Transformers, Diffusion)", "Model optimization (distillation, fine-tuning)", "Agentic behavior and tool use", "Transparency and safety measures", "Applied LLM cases (legal documents, text assessment)"]'::jsonb
)
WHERE title ILIKE 'Applied Generative AI%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["History and vision of Ubiquitous Computing", "Context-aware computing", "Sensing principles and context detection", "Location technologies and privacy", "IoT business models", "Digital fabrication technologies"]'::jsonb
)
WHERE title ILIKE 'Artifact-based Design%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Features and representation learning for security", "Attack detection via anomaly/classification", "Malware analysis and clustering", "Attacks against learning-based systems", "Explainable AI in security"]'::jsonb
)
WHERE title ILIKE 'Artificial Intelligence for Computer Security%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Finite automata and regular languages", "Propositional and MSO logic", "Algebraic structures in automata theory", "Automata for infinite behaviors", "Applications in verification and synthesis"]'::jsonb
)
WHERE title ILIKE 'Automata and Logic%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Resolution and superposition calculi", "Unification algorithms", "Redundancy checking and saturation-based search", "Recent advancements in theorem proving"]'::jsonb
)
WHERE title ILIKE 'Automated Deduction%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Robot Operating System (ROS) and F1/10 hardware", "LiDAR sensing and rigid body transformations", "Reference tracking and PID control", "Localisation and SLAM", "Planning (Pure pursuit, RRT, MPC)", "Vision and Neural network auto-pilots"]'::jsonb
)
WHERE title ILIKE 'Autonomous Racing Cars%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Randomized and approximation algorithms", "Monte Carlo methods and Markov chains", "Greedy algorithms and LP relaxation", "Hardness of approximation"]'::jsonb
)
WHERE title ILIKE 'Beyond Exact Algorithms%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Data warehouse architecture", "Logical and multidimensional data modeling (Star, Snowflake, OLAP)", "CRISP-DM process", "Regulatory requirements (EU AI Act)", "Bias mitigation in analytics"]'::jsonb
)
WHERE title ILIKE 'Business Intelligence%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Deterministic and non-deterministic complexity classes (L, NL, P, NP, PH, PSPACE, EXPTIME)", "Parallelizable problems", "Complexity analysis of real-world problems"]'::jsonb
)
WHERE title ILIKE 'Complexity Theory%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Modeling systems using transition relations and automata", "Temporal logic specification", "Model checking algorithms (explicit-state, symbolic, bounded)", "IC3 and interpolation"]'::jsonb
)
WHERE title ILIKE 'Computer-Aided Verification%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Didactic research and practice in CS education", "Designing educational interventions (AI, Security, Logic)", "Inquiry-based and constructionist learning"]'::jsonb
)
WHERE title ILIKE 'Computer Science Education%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Ethical and social dynamics of algorithmic systems", "Bias, fairness, and accountability", "Mitigating misinformation and online harassment", "Ethical and legal frameworks"]'::jsonb
)
WHERE title ILIKE 'Critical Algorithm Studies%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Epistemologies in computer science", "Critical theories and power axes (gender, class, race)", "Societal effects of technologies", "Practical reflexive practice"]'::jsonb
)
WHERE title ILIKE 'Critical Theory of Media and Informatics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Blockchain foundations and consensus (PoW, PoS)", "Bitcoin specifics", "Economics of blockchains", "Layer-2 technologies (Lightning Network)", "Sharding and privacy"]'::jsonb
)
WHERE title ILIKE 'Cryptocurrencies%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Research data lifecycle and management plans", "FAIR principles and licensing", "Persistent identifiers", "Digital preservation (ISO OAIS)", "Trusted research environments"]'::jsonb
)
WHERE title ILIKE 'Data Stewardship%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Foundations of data management", "Relational query languages", "Datalog and Codds Theorem", "Complexity of query evaluation", "Worst-case optimal joins"]'::jsonb
)
WHERE title ILIKE 'Database Theory%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Neural networks for NLP via PyTorch", "Word vectors and Transformers", "Sequence-to-sequence models and translation", "Natural language generation and prompting", "Explainability in NLP"]'::jsonb
)
WHERE title ILIKE 'Deep Learning for Natural Language Processing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Client-server and n-tier systems", "SQL abstraction and NoSQL models", "Web frameworks and API integration", "Container technologies (Docker)", "Middleware (Aspect/Message-oriented)", "Microservices"]'::jsonb
)
WHERE title ILIKE 'Distributed Systems Technologies%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Resource consumption (run-time, memory, power)", "Methodology for achieving efficiency", "Compiler roles", "Latency vs. throughput", "Code transformations for efficiency"]'::jsonb
)
WHERE title ILIKE 'Efficient Programs%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Content depends on the chosen courses from other Master curricula"]'::jsonb
)
WHERE title ILIKE 'Extension%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Parameterized complexity and tractability", "Kernelization and color coding", "Bounded search trees", "Lower bounds (Weft-hierarchy, XP)"]'::jsonb
)
WHERE title ILIKE 'Fixed-Parameter Algorithms and Complexity%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Foundations of theorem proving", "Type theory for security", "Verification of software and cryptographic protocols", "Formal models for Blockchains and ML"]'::jsonb
)
WHERE title ILIKE 'Formal Methods for Security and Privacy%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["SAT and SMT solving", "Temporal logics and bounded model checking", "Hoare logic and weakest precondition", "Interval analysis and pointer semantics"]'::jsonb
)
WHERE title ILIKE 'Formal Methods in Systems Engineering%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Content depends on the chosen courses from Transferable Skills catalogs"]'::jsonb
)
WHERE title ILIKE 'Freie Wahlfächer und Transferable Skills%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Theory of LLMs: tokenization, embedding, Transformers", "Training: pre-training, RLHF", "Practice: RAG and prompting", "Beyond text: Multimodal AI and Knowledge Graphs", "Ethical frameworks"]'::jsonb
)
WHERE title ILIKE 'Generative AI%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["GPU Architectures and CUDA Programming", "GPU Memories and Access Patterns", "Parallel patterns", "Thrust Library", "CUDA application profiling and streaming"]'::jsonb
)
WHERE title ILIKE 'GPU Computing and Architectures%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Graph layout for restricted classes (trees, planar)", "Optimization goals and aesthetic metrics", "General purpose force-directed algorithms", "Heuristics for NP-hard drawing problems"]'::jsonb
)
WHERE title ILIKE 'Graph Drawing Algorithms%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Anatomy of HPC infrastructure", "Sustainability KPIs (PUE, CUE, ERF)", "Carbon footprint of workloads (LLMs, Federated Learning)", "Workload-shifting techniques"]'::jsonb
)
WHERE title ILIKE 'Green HPC%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Construction heuristics and local search", "Metaheuristics (Simulated Annealing, Tabu Search, Evolutionary Algorithms)", "Hybrid and ML-based optimization", "Parallelization"]'::jsonb
)
WHERE title ILIKE 'Heuristic Optimization Techniques%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Characteristics of High-Performance Computers", "Performance assessment of parallel programs", "Advanced MPI and OpenMP features", "Communication operation algorithms"]'::jsonb
)
WHERE title ILIKE 'High Performance Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Scaling AI in HPC", "Accuracy-performance tradeoffs", "Dynamic workload optimization", "Hardware heterogeneity (FPGAs, TPUs)", "Distributed model training"]'::jsonb
)
WHERE title ILIKE 'HPC for AI%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Embodiment, trust, and authenticity in HAI", "Multimodal communication", "Human centered interaction design", "Evaluation methods (usability, acceptance)", "Application contexts (healthcare, service)"]'::jsonb
)
WHERE title ILIKE 'Human-agent Interaction%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Concepts of Hybrid Classical-Quantum Systems", "Quantum circuit programming (Qiskit)", "Variational Quantum Algorithms", "HPC connection to Quantum"]'::jsonb
)
WHERE title ILIKE 'Hybrid Quantum - Classical Systems%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Structure of distributed automation systems", "Communication protocols and middlewares", "Industrial Internet of Things (IIoT)", "Information models for system integration", "Machine-to-machine communication"]'::jsonb
)
WHERE title ILIKE 'Information Technology in Automation%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Smart Things as Cyber-Physical Systems", "RFID and Wireless Sensor Networks (ZigBee, BLE)", "IoT protocols (MQTT, REST, CoAP)", "Fog and Edge Computing", "IoT Security and Privacy"]'::jsonb
)
WHERE title ILIKE 'Internet of Things%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Impact of AI on sustainability", "Energy challenges of LLMs", "AI for climate change issues", "Sustainable ICT system design"]'::jsonb
)
WHERE title ILIKE 'Introduction to Computational Sustainability%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Knowledge graph embeddings", "Logical knowledge in KGs", "Graph Neural Networks and Transformers", "Scalable reasoning", "KG lifecycle and real-world applications"]'::jsonb
)
WHERE title ILIKE 'Knowledge Graphs%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Learning theories and environments", "Emerging technologies (AI, XR, Gamification)", "Learning Analytics methods and infrastructures", "Ethics and diversity in education"]'::jsonb
)
WHERE title ILIKE 'Learning Technologies and Learning Analytics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Advanced classical first-order logic", "Proof systems (soundness/completeness)", "Modal, temporal, and epistemic logics", "Models of computation and the Church-Turing thesis", "Decidability and incompleteness"]'::jsonb
)
WHERE title ILIKE 'Logic and Computability%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Knowledge representation languages", "Description logics and ontological reasoning", "Nonmonotonic reasoning foundations", "Answer-set programming", "Logics with uncertainty", "Rule learning"]'::jsonb
)
WHERE title ILIKE 'Logic-based Artificial Intelligence%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Memory organization and safety", "Programming in Forth and Rust", "Low-level debugging tools", "Operating systems and runtime systems interface"]'::jsonb
)
WHERE title ILIKE 'Low-Level Programming%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Machine learning theory and fundamental concepts", "Supervised techniques and Deep Learning", "Clustering and Reinforcement Learning", "Data preprocessing and feature selection", "Automated ML"]'::jsonb
)
WHERE title ILIKE 'Machine Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Combinatorial optimization problems", "End-to-end learning for optimization", "Deep Learning and GNNs for optimization", "Reinforcement Learning for optimization", "LLMs for optimization"]'::jsonb
)
WHERE title ILIKE 'Machine Learning for Optimization%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Graph data models and schema languages", "Query formulation and optimization", "Graph data quality and shape constraints", "Provenance and traceability", "Dynamic updates and versioning"]'::jsonb
)
WHERE title ILIKE 'Management of Graph Data%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Foundations of linear and integer linear programming (ILP)", "ILP solving techniques (branch-and-cut, branch-and-price)", "Decomposition methods", "Logistics problems (TSP, VRP, Pick-up and Delivery)"]'::jsonb
)
WHERE title ILIKE 'Mathematical Programming and Optimization in Transport Logistics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Behaviour-Based Robotics", "Sensor and Motion Models", "Mapping and Map Representation", "Self-localization and SLAM (Fast-SLAM, Graph-based)", "Path Planning and Multi-Robot-Planning"]'::jsonb
)
WHERE title ILIKE 'Mobile Robotics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Metamodeling and OCL", "Textual and Graphical Modeling Languages", "Model Transformations (ATL)", "Code Generation", "Model management (versioning, evolution)"]'::jsonb
)
WHERE title ILIKE 'Model Engineering%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Network security concepts and anomaly detection", "Cryptographic methods (RSA, ECC, Diffie-Hellman)", "IPv6 and routing security", "Network steganography (covert channels)", "Secure group communication"]'::jsonb
)
WHERE title ILIKE 'Network Security%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Solving problems by searching", "Constraint satisfaction and MiniZinc", "Problem structure and structural decomposition", "Automated algorithm selection", "AI-based scheduling and planning"]'::jsonb
)
WHERE title ILIKE 'Problem Solving and Search in Artificial Intelligence%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Datalog and extensions", "Answer-set programming", "Description logics and ontologies", "Reasoning computational aspects", "Contextual reasoning"]'::jsonb
)
WHERE title ILIKE 'Processing of Declarative Knowledge%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Static analyses (control/data flow)", "Abstract interpretation and lattice-based reasoning", "Program semantics", "Type systems correctness", "Applications in optimization and verification"]'::jsonb
)
WHERE title ILIKE 'Program Analysis%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Design space of programming languages", "Implementation techniques (interpreters)", "Programming paradigms (strengths/pitfalls)", "Abstraction types and combined paradigm use"]'::jsonb
)
WHERE title ILIKE 'Programming Paradigms and Languages%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Algorithms for self-driving cars, drones, and rescue robots", "Software architectures and frameworks", "Simulation", "Cognitive Robotics and AI", "Cyber-physical systems"]'::jsonb
)
WHERE title ILIKE 'Programming Principles of Mobile Robotics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Scientific analysis, design, and implementation", "Scientific documentation and justification", "Model building and abstraction", "Solving practical problems from research"]'::jsonb
)
WHERE title ILIKE 'Project in Computer Science%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Quantum mechanics principles for computing", "Quantum gates and circuits", "Basic and advanced algorithms", "Complexity classes", "Information theory and teleportation"]'::jsonb
)
WHERE title ILIKE 'Quantum Computing%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Markov decision processes", "Dynamic programming", "Monte-Carlo and Temporal-difference learning (Q-learning)", "Policy-gradient methods", "Deep Reinforcement Learning applications"]'::jsonb
)
WHERE title ILIKE 'Reinforcement Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Digital rights, trust, and accountability", "Ethical design methodologies", "Regulatory landscapes", "Case studies on AI bias and privacy", "Practitioner roles and responsibilities"]'::jsonb
)
WHERE title ILIKE 'Responsible Digital Ethics%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Algorithms and data structures of SAT solvers", "Formula simplification", "CDCL(T) SMT solvers", "MaxSAT solving techniques", "QBF solvers", "SAT-based reasoning applications"]'::jsonb
)
WHERE title ILIKE 'SAT Algorithms%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Literature research in Computer Science", "Categorization and taxonomies of scientific papers", "Summarizing and presenting research results"]'::jsonb
)
WHERE title ILIKE 'Seminar in Computer Science%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Programming techniques for the blockchain paradigm", "Protocols and interfaces for decentralized systems", "Smart contract vulnerabilities and mitigation", "Automated analysis tools"]'::jsonb
)
WHERE title ILIKE 'Smart Contracts%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Graph width parameters (tree-width and generalizations)", "Algorithmic meta-theorems", "Applications to propositional model counting and Bayesian Networks", "Well-behaved graph classes"]'::jsonb
)
WHERE title ILIKE 'Structural Decompositions and Meta Theorems%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Pseudorandom functions and permutations", "Tweakable block ciphers and compression functions", "Secure modes (AE, hashing, key derivation)", "Lightweight cryptographic designs", "Applications in TLS and Blockchains"]'::jsonb
)
WHERE title ILIKE 'Symmetric Cryptography%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Security of mobile and software systems", "Secure development best practices", "Web and networked systems security", "Reverse engineering", "Side-channel analysis", "Risk and threat modelling"]'::jsonb
)
WHERE title ILIKE 'System and Application Security%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Empirical risk minimisation", "PAC learning and VC dimension", "Kernel-based learning and SVMs", "Least squares regression", "Theoretical properties of deep networks and GNNs"]'::jsonb
)
WHERE title ILIKE 'Theoretical Foundations and Research Topics in Machine Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Deep network architectures and convolutional structures", "Dictionary learning and energy decay", "Optimization algorithms and loss landscape topology", "The scattering transform", "Autoencoders, GANs, and adversarial examples", "Physics-informed neural networks"]'::jsonb
)
WHERE title ILIKE 'Theoretical Foundations of Deep Learning%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Finite state automata models (words, trees)", "Navigational query languages", "Data and combined complexity", "Description logics for graph-structured data modelling", "Constraint languages"]'::jsonb
)
WHERE title ILIKE 'Theory of Graph Data%';

UPDATE course
SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object(
  'content', '["Untyped vs typed Lambda-calculus", "Theorem proving and type checking connections", "Type inference in functional languages", "Subtyping and substitutability principle", "Practical aspects in imperative and OO programming", "Advanced type system features"]'::jsonb
)
WHERE title ILIKE 'Type Systems%';