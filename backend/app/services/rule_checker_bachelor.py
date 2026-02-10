from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Dict, Tuple, Optional, Set
import unicodedata


@dataclass
class RuleCheckResult:
    ok: bool = True
    message: str = "accepted"
    stats: Dict[str, Any] = field(default_factory=dict)
    missing: List[str] = field(default_factory=list)


class RuleChecker:
    """
    Rule engine for TU Wien Bachelorstudium Informatik (180 ECTS) based on the provided text.

    Key fixes vs your version:
      - StEOP: compute BOTH done-based completion (for gating) and planned+done progress (for UI),
              and identify mandatory StEOP LVs by LV title/code (not by module mapping).
      - Focus: robust recognition via aliases (ai/ml/cyber/se/hcc/vc/...) + normalization.
      - Soft prereqs: fix lane=0 bug (0 is falsy).
      - Pre-StEOP extra: use canonical category (not just incoming) so FWTS/TS are handled correctly.
    """

    TOTAL_ECTS = 180.0
    MIN_NARROW_ELECTIVE_MODULES = 7
    TRANSFERABLE_SKILLS_MIN_ECTS = 6.0
    BACHELORARBEIT_ECTS = 13.0

    MAX_ECTS_PER_SEMESTER = 42.0
    RECOMMENDED_ECTS_PER_SEMESTER = 30.0

    # ----------------------------
    # Helpers: normalization/parsing
    # ----------------------------
    @staticmethod
    def _norm(text: Optional[str]) -> str:
        if not text:
            return ""
        t = unicodedata.normalize("NFKD", str(text))
        t = "".join(ch for ch in t if not unicodedata.combining(ch))
        t = t.lower().strip()
        out = []
        for ch in t:
            if ch.isalnum() or ch.isspace():
                out.append(ch)
            else:
                out.append(" ")
        return " ".join("".join(out).split())

    @staticmethod
    def _to_float(x: Any) -> float:
        if x is None:
            raise ValueError("ects is missing")
        if isinstance(x, (int, float)):
            return float(x)
        s = str(x).strip().replace(",", ".")
        return float(s)

    @staticmethod
    def _lane_index_of(course: dict[str, Any], fallback: int = 0) -> int:
        li = course.get("laneIndex", fallback)
        try:
            return int(li)
        except Exception:
            return fallback

    @staticmethod
    def _course_code(course: dict[str, Any]) -> str:
        return str(course.get("code") or course.get("name") or "").strip()

    # ----------------------------
    # Init curriculum model
    # ----------------------------
    def __init__(self) -> None:
        self.program_code = "033 521"

        self.exam_subject_aliases: Dict[str, str] = {
            "ap": "algorithmen und programmierung",
            "cs": "computersysteme",
            "cgvc": "computergraphik und visual computing",
            "hcc": "human centered computing",
            "ie": "information engineering",
            "log": "logik",
            "mi": "medizinische informatik",
            "sec": "security",
            "stw": "strukturwissenschaften",
            "se": "software engineering",
            "ti": "theoretische informatik",
            "fwts": "freie wahlfacher und transferable skills",
            "thesis": "bachelorarbeit",
        }

        self.modules: Dict[str, Dict[str, Any]] = {}

        def add_module(
            title: str,
            ects: float,
            kind: str,
            exam_subject: Optional[str] = None,
            min_ects: Optional[float] = None,
        ) -> None:
            key = self._norm(title)
            self.modules[key] = {
                "title": title,
                "ects": float(ects),
                "min_ects": float(min_ects) if min_ects is not None else None,
                "kind": kind,
                "examSubject": exam_subject,
            }

        # Pflichtmodule
        add_module("Algorithmen und Datenstrukturen", 8.0, "mandatory", "Algorithmen und Programmierung")
        add_module("Einführung in die Programmierung", 9.5, "mandatory", "Algorithmen und Programmierung")
        add_module("Programmierparadigmen", 6.0, "mandatory", "Algorithmen und Programmierung")
        add_module("Grundzüge digitaler Systeme", 6.0, "mandatory", "Computersysteme")
        add_module("Denkweisen der Informatik", 6.5, "mandatory", "Human-Centered Computing")
        add_module("Datenbanksysteme", 6.0, "mandatory", "Information Engineering")
        add_module("Einführung in Security", 6.0, "mandatory", "Security")
        add_module("Algebra und Diskrete Mathematik", 9.0, "mandatory", "Strukturwissenschaften")
        add_module("Analysis", 6.0, "mandatory", "Strukturwissenschaften")
        add_module("Mathematisches Arbeiten", 2.0, "mandatory", "Strukturwissenschaften")
        add_module("Statistik und Wahrscheinlichkeitstheorie", 6.0, "mandatory", "Strukturwissenschaften")
        add_module("Theoretische Informatik", 6.0, "mandatory", "Theoretische Informatik")

        add_module("Bachelorarbeit", 13.0, "thesis", "Bachelorarbeit")
        add_module("Freie Wahlfächer und Transferable Skills", 18.0, "fwts", "Freie Wahlfächer und Transferable Skills")

        # Wahlmodule der engen Wahl (+)
        narrow = [
            ("Betriebssysteme", 6.0, "Computersysteme"),
            ("Computersysteme", 6.0, "Computersysteme"),
            ("Einführung in Visual Computing", 6.0, "Computergraphik und Visual Computing"),
            ("Interface und Interaction Design", 6.0, "Human-Centered Computing"),
            ("Einführung in Artificial Intelligence", 6.0, "Logik"),
            ("Logic and Reasoning in Computer Science", 6.0, "Logik"),
            ("Daten- und Informatikrecht", 6.0, "Security"),
            ("Software Engineering", 6.0, "Software Engineering"),
            ("Software Engineering Projekt", 6.0, "Software Engineering"),
            ("Verteilte Systeme", 6.0, "Software Engineering"),
        ]
        for t, e, es in narrow:
            add_module(t, e, "narrow_elective", es)

        # Broad electives needed for focus rules (default 6 unless specified)
        broad_for_focus = [
            "Einführung in Machine Learning",
            "Attacks and Defenses in Computer Security",
            "Foundations of System and Application Security",
            "Privacy-Enhancing Technologies",
            "Programm- und Systemverifikation",
            "Software-Qualitätssicherung",
            "Argumentieren und Beweisen",
            "Deklaratives Problemlösen",
            "Eﬀiziente Algorithmen",
            "Effiziente Algorithmen",  # accept spelled-out ligature variant
            "Introduction to Cryptography",
            "Einführung in Quantencomputing",
            "Logik für Wissensrepräsentation",
            "Logik und Grundlagen der Mathematik",
            "Multimedia",
            "Programmiertechniken für Visual Computing",
            "Grundlagen der Computergraphik",
            "Grundlagen der Computer Vision",
            "Grundlagen der Visualisierung",
            "Semistrukturierte Daten",
            "Übersetzerbau",
            "Usability Engineering and Mobile Interaction",
            "Web Engineering",
            "Parallel Computing",
            "Einführung in wissensbasierte Systeme",
            "Einführung in Information Retrieval",
            "Menschzentrierte Künstliche Intelligenz",
            "Sozio-technische Systeme",
            "Access Computing",
            "Design und Fertigung",
            "Human Augmentation",
            "Methods for Data Generation and Analytics in Medicine and Life Sciences",
            "Bio-Medical Visualization and Visual Analytics",
            "Design und Entwicklung von Anwendungen im Gesundheitswesen",
            "Informationssysteme des Gesundheitswesens",
            "Datenanalyse",
            "Methoden der Angewandten Statistik",
            "Computational Statistics",
            "Multivariate Statistik",
            "Numerical Computation",
        ]
        for t in broad_for_focus:
            if self._norm(t) == self._norm("Computational Statistics"):
                add_module("Computational Statistics", 6.0, "broad_elective", "Strukturwissenschaften", min_ects=6.0)
            else:
                add_module(t, 6.0, "broad_elective", None)

        # Special ECTS cases
        add_module("Zuverlässige Echtzeitsysteme", 5.0, "broad_elective", "Computersysteme", min_ects=5.0)

        # ----------------------------
        # Course-to-module mapping
        # ----------------------------
        self.course_to_module: Dict[str, str] = {}

        def map_course_to_module(course_title_or_code: str, module_title: str) -> None:
            self.course_to_module[self._norm(course_title_or_code)] = module_title
        def map_codes(module_title: str, *codes: str) -> None:
            for code in codes:
                map_course_to_module(code, module_title)

        # EIDI split
        map_course_to_module("Einführung in die Programmierung 1", "Einführung in die Programmierung")
        map_course_to_module("Einführung in die Programmierung 2", "Einführung in die Programmierung")
        map_course_to_module("EIDI1-VU", "Einführung in die Programmierung")
        map_course_to_module("EIDI2-VU", "Einführung in die Programmierung")

        # Orientation: keep module mapping for ECTS, BUT StEOP checks it by course code/title.
        map_course_to_module("Orientierung Informatik und Wirtschaftsinformatik", "Denkweisen der Informatik")
        map_course_to_module("ORI-VU", "Denkweisen der Informatik")
        map_course_to_module("DWI-VU", "Denkweisen der Informatik")

        # Algebra/Analysis variants
        for c in ["ADM-VO", "ADM-UE", "ADM-VU"]:
            map_course_to_module(c, "Algebra und Diskrete Mathematik")
        for c in ["ANL-VO", "ANL-UE", "ANL-VU"]:
            map_course_to_module(c, "Analysis")
        for c in ["SWT-VO", "SWT-UE", "SWT-VU"]:
            map_course_to_module(c, "Statistik und Wahrscheinlichkeitstheorie")

        # Thesis split
        map_course_to_module("BA-PR", "Bachelorarbeit")
        map_course_to_module("WISS-SE", "Bachelorarbeit")
        map_course_to_module("Bachelorarbeit für Informatik und Wirtschaftsinformatik", "Bachelorarbeit")
        map_course_to_module("Wissenschaftliches Arbeiten", "Bachelorarbeit")

        # DB course-code mapping (from 003_bachelorcatalog.sql) to keep code usage consistent
        map_codes("Effiziente Algorithmen", "EA-VU")
        map_codes("Funktionale Programmierung", "FP-VU")
        map_codes("Logikprogrammierung und Constraints", "LPC-VU")
        map_codes("Abstrakte Maschinen", "AM-VU")
        map_codes("Parallel Computing", "PC-VU")
        map_codes("Übersetzerbau", "UB-VU")
        map_codes("Zuverlässige Echtzeitsysteme", "RTS-VO", "DSYS-VU")
        map_codes("Audio and Video Production", "AVP-VU")
        map_codes("Computermusik", "CMUS-VU")
        map_codes("Creative Media Production", "CMP-VU")
        map_codes("Grundlagen der Computergraphik", "GCG-VU")
        map_codes("Grundlagen der Computer Vision", "GCV-VU")
        map_codes("Grundlagen der Visualisierung", "GVIS-VU")
        map_codes("Multimedia", "MM-VU")
        map_codes("Programmiertechniken für Visual Computing", "PTVC-PR")
        map_codes("Access Computing", "ACC-VU")
        map_codes("Design und Fertigung", "DUF-VU")
        map_codes("Menschzentrierte Künstliche Intelligenz", "MKAI-VU")
        map_codes("Sozio-technische Systeme", "STS-VU")
        map_codes("Usability Engineering and Mobile Interaction", "UEMI-VU")
        map_codes("Einführung in wissensbasierte Systeme", "EWS-VU")
        map_codes("Einführung in Information Retrieval", "IR-VU")
        map_codes("Semistrukturierte Daten", "SSD-VU")
        map_codes("Web Engineering", "WEBE-VU")
        map_codes("Argumentieren und Beweisen", "AUB-VU")
        map_codes("Deklaratives Problemlösen", "DPR-VU")
        map_codes("Einführung in Machine Learning", "EML-VU")
        map_codes("Logik und Grundlagen der Mathematik", "LGM-VO", "LGM-UE")
        map_codes("Logik für Wissensrepräsentation", "LWR-VU")
        map_codes("Bio-Medical Visualization and Visual Analytics", "BMVVA-VU")
        map_codes("Design und Entwicklung von Anwendungen im Gesundheitswesen", "DEAG-VU")
        map_codes("Human Augmentation", "HAUG-VU")
        map_codes("Informationssysteme des Gesundheitswesens", "ISG-VU")
        map_codes("Methods for Data Generation and Analytics in Medicine and Life Sciences", "MDGAM-VU")
        map_codes("Attacks and Defenses in Computer Security", "ADCS-UE")
        map_codes("Foundations of System and Application Security", "FSAS-VU")
        map_codes("Privacy-Enhancing Technologies", "PET-VU")
        map_codes("Computational Statistics", "CSTAT-VU", "SCOMP-VU", "SIM-VU")
        map_codes("Datenanalyse", "DA-VU")
        map_codes("Methoden der Angewandten Statistik", "MAS-VO", "MAS-UE")
        map_codes("Multivariate Statistik", "MVS-VO", "MVS-UE")
        map_codes("Numerical Computation", "NUMC-VU")
        map_codes("Programm- und Systemverifikation", "PSV-VU")
        map_codes("Software-Qualitätssicherung", "SQS-VU")
        map_codes("Introduction to Cryptography", "ITC-VU")
        map_codes("Einführung in Quantencomputing", "EQC-VU")

        # ----------------------------
        # StEOP definition (LV-level!)
        # ----------------------------
        # Mandatory StEOP LVs:
        self.steop_mandatory_lv_keys: Dict[str, float] = {
            self._norm("Einführung in die Programmierung 1"): 5.5,
            self._norm("EIDI1-VU"): 5.5,
            self._norm("Mathematisches Arbeiten für Informatik und Wirtschaftsinformatik 1"): 2.0,
            self._norm("Mathematisches Arbeiten"): 2.0,
            self._norm("MA-VU"): 2.0,
            self._norm("Orientierung Informatik und Wirtschaftsinformatik"): 1.0,
            self._norm("ORI-VU"): 1.0,
        }

        # Pool LVs / modules (>= 8 ECTS)
        self.steop_pool_keys: Set[str] = {
            self._norm("Algebra und Diskrete Mathematik"),
            self._norm("Analysis"),
            self._norm("Denkweisen der Informatik"),
            self._norm("Grundzüge digitaler Systeme"),
            # allow LV codes
            self._norm("ADM-VO"), self._norm("ADM-UE"), self._norm("ADM-VU"),
            self._norm("ANL-VO"), self._norm("ANL-UE"), self._norm("ANL-VU"),
            self._norm("DWI-VU"),
            self._norm("GDS-VU"),
        }

        # Allowed extra BEFORE StEOP completion (§7) – besides FWTS
        self.allowed_before_steop_extra: Set[str] = {
            self._norm("Algorithmen und Datenstrukturen"),
            self._norm("Datenbanksysteme"),
            self._norm("Daten- und Informatikrecht"),
            self._norm("Einführung in die Programmierung 2"),
            self._norm("Einführung in Visual Computing"),
            # DB-ish codes
            self._norm("AD-VU"),
            self._norm("DBS-VU"),
            self._norm("DIR-VU"),
            self._norm("EIDI2-VU"),
            self._norm("EVC-VU"),
        }

        # ----------------------------
        # Focus (Vertiefung) definitions
        # ----------------------------
        self.focuses: Dict[str, Dict[str, Any]] = {
            self._norm("Artificial Intelligence und Machine Learning"): {
                "required": ["Einführung in Artificial Intelligence", "Einführung in Machine Learning"],
                "choose": {"min": 4, "from": [
                    "Datenanalyse", "Deklaratives Problemlösen", "Effiziente Algorithmen",
                    "Einführung in Information Retrieval", "Einführung in wissensbasierte Systeme",
                    "Logikprogrammierung und Constraints", "Menschzentrierte Künstliche Intelligenz",
                    "Methoden der Angewandten Statistik", "Grundlagen der Visualisierung",
                ]},
            },
            self._norm("Cybersecurity"): {
                "choose_groups": [
                    {"min": 2, "from": ["Betriebssysteme", "Einführung in Artificial Intelligence", "Logic and Reasoning in Computer Science", "Verteilte Systeme"]},
                    {"min": 4, "from": ["Attacks and Defenses in Computer Security", "Foundations of System and Application Security",
                                        "Introduction to Cryptography", "Privacy-Enhancing Technologies", "Programm- und Systemverifikation"]},
                ]
            },
            self._norm("Digital Health"): {
                "required": ["Daten- und Informatikrecht", "Einführung in Visual Computing", "Interface und Interaction Design", "Software Engineering",
                             "Methods for Data Generation and Analytics in Medicine and Life Sciences"],
                "choose": {"min": 4, "from": [
                    "Bio-Medical Visualization and Visual Analytics", "Datenanalyse", "Design und Fertigung",
                    "Design und Entwicklung von Anwendungen im Gesundheitswesen", "Einführung in Machine Learning",
                    "Grundlagen der Computer Vision", "Human Augmentation", "Informationssysteme des Gesundheitswesens",
                    "Privacy-Enhancing Technologies", "Sozio-technische Systeme", "Grundlagen der Visualisierung",
                ]},
            },
            self._norm("Human-Centered Computing"): {
                "required": ["Einführung in Visual Computing", "Interface und Interaction Design", "Software Engineering"],
                "choose": {"min": 4, "from": [
                    "Access Computing", "Daten- und Informatikrecht", "Design und Fertigung",
                    "Human Augmentation", "Menschzentrierte Künstliche Intelligenz", "Sozio-technische Systeme",
                ]},
            },
            self._norm("Software Engineering"): {
                "required": ["Interface und Interaction Design", "Software Engineering", "Software Engineering Projekt", "Verteilte Systeme", "Software-Qualitätssicherung"],
                "choose": {"min": 4, "from": [
                    "Einführung in wissensbasierte Systeme", "Funktionale Programmierung", "Logikprogrammierung und Constraints",
                    "Parallel Computing", "Programm- und Systemverifikation", "Semistrukturierte Daten", "Übersetzerbau",
                    "Usability Engineering and Mobile Interaction", "Web Engineering",
                ]},
            },
            self._norm("Theoretische Informatik und Logik"): {
                "required": ["Logic and Reasoning in Computer Science"],
                "choose": {"min": 5, "from": [
                    "Argumentieren und Beweisen", "Deklaratives Problemlösen", "Effiziente Algorithmen",
                    "Introduction to Cryptography", "Einführung in Quantencomputing", "Logik für Wissensrepräsentation",
                    "Logik und Grundlagen der Mathematik", "Programm- und Systemverifikation",
                ]},
            },
            self._norm("Visual Computing"): {
                "required": ["Einführung in Visual Computing", "Software Engineering", "Grundlagen der Computergraphik", "Grundlagen der Computer Vision"],
                "choose": {"min": 3, "from": ["Multimedia", "Programmiertechniken für Visual Computing", "Grundlagen der Visualisierung"]},
            },
        }

        # Focus aliases (robust UI input)
        self.focus_aliases: Dict[str, str] = {
            self._norm("ai"): self._norm("Artificial Intelligence und Machine Learning"),
            self._norm("ml"): self._norm("Artificial Intelligence und Machine Learning"),
            self._norm("aiml"): self._norm("Artificial Intelligence und Machine Learning"),
            self._norm("ai ml"): self._norm("Artificial Intelligence und Machine Learning"),
            self._norm("artificial intelligence"): self._norm("Artificial Intelligence und Machine Learning"),
            self._norm("machine learning"): self._norm("Artificial Intelligence und Machine Learning"),

            self._norm("cyber"): self._norm("Cybersecurity"),
            self._norm("security"): self._norm("Cybersecurity"),
            self._norm("cybersecurity"): self._norm("Cybersecurity"),

            self._norm("digital health"): self._norm("Digital Health"),
            self._norm("dh"): self._norm("Digital Health"),

            self._norm("hcc"): self._norm("Human-Centered Computing"),
            self._norm("human centered computing"): self._norm("Human-Centered Computing"),
            self._norm("human-centered computing"): self._norm("Human-Centered Computing"),

            self._norm("se"): self._norm("Software Engineering"),
            self._norm("software engineering"): self._norm("Software Engineering"),

            self._norm("til"): self._norm("Theoretische Informatik und Logik"),
            self._norm("theory"): self._norm("Theoretische Informatik und Logik"),
            self._norm("theoretische informatik"): self._norm("Theoretische Informatik und Logik"),
            self._norm("logik"): self._norm("Theoretische Informatik und Logik"),

            self._norm("vc"): self._norm("Visual Computing"),
            self._norm("visual computing"): self._norm("Visual Computing"),
        }

        # Soft prerequisite suggestions (warnings only)
        self.soft_prereqs: List[Tuple[str, str]] = [
            ("Einführung in die Programmierung 1", "Einführung in die Programmierung 2"),
            ("Software Engineering", "Software Engineering Projekt"),
        ]

    # ----------------------------
    # Internal: canonicalization
    # ----------------------------
    def _canonical_exam_subject(self, raw: Optional[str]) -> str:
        s = self._norm(raw)
        if s in self.exam_subject_aliases:
            return self.exam_subject_aliases[s].title()
        return (raw or "").strip()

    def _infer_module_title(self, course: dict[str, Any]) -> str:
        mod = course.get("module")
        if isinstance(mod, dict) and mod.get("title"):
            return str(mod["title"]).strip()

        code = self._course_code(course)
        k = self._norm(code)
        if k in self.course_to_module:
            return self.course_to_module[k]

        # Fallback: many catalog courses use short LV codes (e.g. MDGAM-VU),
        # while focus rules are module-title based. Use course name/title to
        # recover the module title if available.
        name = str(course.get("name") or course.get("title") or "").strip()
        if name:
            nk = self._norm(name)
            if nk in self.course_to_module:
                return self.course_to_module[nk]
            if nk in self.modules:
                return name

        return code

    def _canonical_kind_for_module(self, module_title: str) -> Optional[str]:
        k = self._norm(module_title)
        m = self.modules.get(k)
        return m["kind"] if m else None

    def _map_incoming_category(self, cat: Optional[str]) -> str:
        c = self._norm(cat)
        if c in ("mandatory", "pflicht", "pflichtfach"):
            return "mandatory"
        if c in ("core", "narrow", "narrow elective", "narrow_elective", "enge wahl", "wahlmodul der engen wahl"):
            return "narrow_elective"
        if c in ("elective", "broad", "broad elective", "broad_elective", "breite wahl", "wahlmodul der breiten wahl"):
            return "broad_elective"
        if c in ("free", "fwts", "freie wahl", "freie wahlfacher"):
            return "free"
        if c in ("transferable_skills", "transferable skills", "ts"):
            return "transferable_skills"
        if c in ("bachelor_thesis", "thesis", "bachelorarbeit"):
            return "thesis"
        if c in ("steop_mandatory", "steop"):
            return "steop_mandatory"
        if c in ("steop_pool",):
            return "steop_pool"
        return "free"

    def _canonical_category(self, course: dict[str, Any], module_title: str, warnings: List[str]) -> str:
        incoming = self._map_incoming_category(course.get("category"))
        kind = self._canonical_kind_for_module(module_title)

        if kind is None:
            return incoming

        expected = {
            "mandatory": "mandatory",
            "narrow_elective": "narrow_elective",
            "broad_elective": "broad_elective",
            "fwts": "free",
            "thesis": "thesis",
        }.get(kind, incoming)

        if incoming != expected:
            code = self._course_code(course)
            warnings.append(
                f"Kategorie-Hinweis: '{code}' wurde als '{incoming}' geliefert, gehört aber curricular zu '{expected}' (Modul: {module_title})."
            )
        return expected

    # ----------------------------
    # Parsing input payload
    # ----------------------------
    def _extract_courses(self, payload: dict[str, Any]) -> List[Tuple[dict[str, Any], str]]:
        out: List[Tuple[dict[str, Any], str]] = []
        if isinstance(payload.get("lanes"), list):
            for lane in payload["lanes"]:
                planned = lane.get("plannedCourses") or []
                done = lane.get("doneCourses") or []
                for c in planned:
                    out.append((c, "planned"))
                for c in done:
                    out.append((c, "done"))
            return out

        for c in (payload.get("plannedCourses") or []):
            out.append((c, "planned"))
        for c in (payload.get("doneCourses") or []):
            out.append((c, "done"))
        return out

    # ----------------------------
    # StEOP helpers (LV-level)
    # ----------------------------
    def _steop_mandatory_tag(self, course: dict[str, Any]) -> Optional[str]:
        """
        Identify the 3 mandatory StEOP LVs by LV code/title (not module mapping).
        """
        k = self._norm(self._course_code(course))
        if k in (self._norm("Einführung in die Programmierung 1"), self._norm("EIDI1-VU")):
            return "eidi1"
        if k in (self._norm("Mathematisches Arbeiten"), self._norm("Mathematisches Arbeiten für Informatik und Wirtschaftsinformatik 1"), self._norm("MA-VU")):
            return "ma"
        if k in (self._norm("Orientierung Informatik und Wirtschaftsinformatik"), self._norm("ORI-VU")):
            return "ori"
        return None

    def _is_steop_pool_item(self, course: dict[str, Any]) -> bool:
        code_k = self._norm(self._course_code(course))
        mod_k = self._norm(self._infer_module_title(course))
        return (code_k in self.steop_pool_keys) or (mod_k in self.steop_pool_keys)

    def _is_steop_any_item(self, course: dict[str, Any]) -> bool:
        # mandatory LVs OR pool
        if self._steop_mandatory_tag(course) is not None:
            return True
        return self._is_steop_pool_item(course)

    def _is_fwts_like(self, canonical_cat: str, module_title: str) -> bool:
        if canonical_cat in ("free", "transferable_skills"):
            return True
        return self._norm(module_title) == self._norm("Freie Wahlfächer und Transferable Skills")

    # ----------------------------
    # Evaluate
    # ----------------------------
    def evaluate(self, payload: dict[str, Any]) -> RuleCheckResult:
        warnings: List[str] = []
        errors: List[str] = []
        missing: List[str] = []

        program = str(payload.get("programCode") or "").strip()
        if program and program != self.program_code:
            return RuleCheckResult(
                ok=False,
                message=f"rejected: RuleChecker is for program {self.program_code}, but payload has {program}",
                stats={"programCode": program, "expectedProgramCode": self.program_code},
                missing=[],
            )

        items = self._extract_courses(payload)
        if not items:
            # Continue with empty items so dashboard sections (StEOP, narrow electives, etc.)
            # are still fully populated on initial load.
            warnings.append("No courses in plan.")

        seen: Dict[str, str] = {}
        lane_ects: Dict[int, float] = {}

        mod_done: Dict[str, float] = {}
        mod_planned: Dict[str, float] = {}
        mod_all: Dict[str, float] = {}

        cat_ects: Dict[str, float] = {}
        subj_ects: Dict[str, float] = {}

        earliest_lane_for_course: Dict[str, int] = {}
        earliest_lane_for_module: Dict[str, int] = {}

        # Store per-course canonical category (used later for StEOP pre-check)
        per_course_canonical_cat: Dict[str, str] = {}
        per_course_module_title: Dict[str, str] = {}

        # Parse all courses
        for course, status in items:
            code = self._course_code(course)
            if not code:
                errors.append("rejected: a course is missing 'code'")
                continue

            code_key = self._norm(code)
            if code_key in seen:
                errors.append(f"rejected: duplicate course '{code}' (already present as '{seen[code_key]}').")
            else:
                seen[code_key] = code

            try:
                ects = self._to_float(course.get("ects"))
            except Exception:
                errors.append(f"rejected: invalid ects for '{code}'")
                continue

            if ects <= 0 or ects > 60:
                errors.append(f"rejected: implausible ects={ects} for '{code}'")
                continue

            li = self._lane_index_of(course, fallback=0)
            lane_ects[li] = lane_ects.get(li, 0.0) + ects

            module_title = self._infer_module_title(course)
            module_key = self._norm(module_title)
            per_course_module_title[code_key] = module_title

            canonical_cat = self._canonical_category(course, module_title, warnings)
            per_course_canonical_cat[code_key] = canonical_cat
            cat_ects[canonical_cat] = cat_ects.get(canonical_cat, 0.0) + ects

            raw_subj = course.get("examSubject") or ""
            subj = self._canonical_exam_subject(raw_subj)
            subj_key = self._norm(subj) or "(none)"
            subj_ects[subj_key] = subj_ects.get(subj_key, 0.0) + ects

            if status == "done":
                mod_done[module_key] = mod_done.get(module_key, 0.0) + ects
            else:
                mod_planned[module_key] = mod_planned.get(module_key, 0.0) + ects
            mod_all[module_key] = mod_all.get(module_key, 0.0) + ects

            # earliest lane tracking (for warnings)
            if code_key not in earliest_lane_for_course or li < earliest_lane_for_course[code_key]:
                earliest_lane_for_course[code_key] = li
            if module_key not in earliest_lane_for_module or li < earliest_lane_for_module[module_key]:
                earliest_lane_for_module[module_key] = li

        # Per-semester overload check (hard)
        if not errors:
            for li, s in lane_ects.items():
                if s > self.MAX_ECTS_PER_SEMESTER + 1e-6:
                    errors.append(f"rejected: semester {li+1} exceeds max load ({s:.1f} ECTS > {self.MAX_ECTS_PER_SEMESTER:.1f}).")

        # -----------------------------------------
        # StEOP: compute DONE (for gating) AND DONE+PLANNED (for progress)
        # -----------------------------------------
        def compute_steop(courses: List[Tuple[dict[str, Any], str]]) -> Dict[str, Any]:
            tags: Set[str] = set()
            pool_ects = 0.0

            for c, _status in courses:
                tag = self._steop_mandatory_tag(c)
                if tag:
                    tags.add(tag)
                if self._is_steop_pool_item(c):
                    pool_ects += self._to_float(c.get("ects"))

            mandatory_ok = {"eidi1", "ma", "ori"}.issubset(tags)
            pool_ok = pool_ects >= 8.0 - 1e-6

            return {
                "mandatoryPresent": sorted(list(tags)),
                "poolEcts": round(pool_ects, 2),
                "mandatoryOk": mandatory_ok,
                "poolOk": pool_ok,
                "isComplete": bool(mandatory_ok and pool_ok),
            }

        items_done = [(c, s) for (c, s) in items if s == "done"]
        steop_done = compute_steop(items_done)
        steop_plan = compute_steop(items)  # done + planned

        # --- Add StEOP missing items to RuleCheckResult.missing (only if missed) ---
        if not steop_plan["isComplete"]:
            present = set(steop_plan["mandatoryPresent"])

            if "eidi1" not in present:
                missing.append("StEOP Pflicht-LV fehlt: Einführung in die Programmierung 1 (5.5 ECTS)")
            if "ma" not in present:
                missing.append("StEOP Pflicht-LV fehlt: Mathematisches Arbeiten 1 (2.0 ECTS)")
            if "ori" not in present:
                missing.append("StEOP Pflicht-LV fehlt: Orientierung Informatik und Wirtschaftsinformatik (1.0 ECTS)")

            # Pool (>= 8 ECTS) — cannot know “which” exact LVs you want, so report the ECTS gap + pool menu.
            pool_missing = max(0.0, 8.0 - float(steop_plan["poolEcts"]))
            if pool_missing > 1e-6:
                missing.append(
                    f"StEOP Pool: {pool_missing:.1f} ECTS fehlen (mind. 8 ECTS aus: Algebra & Diskrete Mathematik, Analysis, Denkweisen der Informatik, Grundzüge digitaler Systeme)."
                )

        # Determine completion lane index for DONE StEOP (earliest lane where done completeness holds)
        steop_complete_lane_done: Optional[int] = None
        if items_done:
            # accumulate by lane
            by_lane_done: Dict[int, List[dict[str, Any]]] = {}
            for c, _ in items_done:
                li = self._lane_index_of(c, 0)
                by_lane_done.setdefault(li, []).append(c)

            tags: Set[str] = set()
            pool_ects = 0.0
            for li in sorted(by_lane_done.keys()):
                for c in by_lane_done[li]:
                    tag = self._steop_mandatory_tag(c)
                    if tag:
                        tags.add(tag)
                    if self._is_steop_pool_item(c):
                        pool_ects += self._to_float(c.get("ects"))

                if {"eidi1", "ma", "ori"}.issubset(tags) and pool_ects >= 8.0 - 1e-6:
                    steop_complete_lane_done = li
                    break

        # -----------------------------------------
        # Pre-StEOP rule: before DONE StEOP completion:
        #   - max 22 ECTS outside StEOP (DONE)
        #   - only allowed extra list + FWTS/TS
        # -----------------------------------------
        non_steop_ects_before = 0.0
        illegal_non_steop: List[str] = []

        if items_done:
            # group done by lane for correct "before completion" semantics
            by_lane_done: Dict[int, List[dict[str, Any]]] = {}
            for c, _ in items_done:
                li = self._lane_index_of(c, 0)
                by_lane_done.setdefault(li, []).append(c)

            for li in sorted(by_lane_done.keys()):
                if steop_complete_lane_done is not None and li >= steop_complete_lane_done:
                    break
                for c in by_lane_done[li]:
                    if self._is_steop_any_item(c):
                        continue

                    ects = self._to_float(c.get("ects"))
                    non_steop_ects_before += ects

                    code_k = self._norm(self._course_code(c))
                    module_title = self._infer_module_title(c)

                    # Use canonical category (not incoming)
                    canonical_cat = self._canonical_category(c, module_title, warnings)

                    if (code_k not in self.allowed_before_steop_extra) and (not self._is_fwts_like(canonical_cat, module_title)):
                        illegal_non_steop.append(f"{self._course_code(c)} (Semester {li+1})")

        if non_steop_ects_before > 22.0 + 1e-6:
            errors.append(
                f"rejected: before completing StEOP, {non_steop_ects_before:.1f} ECTS outside StEOP are DONE (max 22)."
            )
        if illegal_non_steop:
            errors.append(
                "rejected: before completing StEOP you marked DONE courses that are not allowed: "
                + ", ".join(illegal_non_steop)
            )

        # -----------------------------------------
        # Bachelorarbeit gating: ONLY if thesis is DONE
        # -----------------------------------------
        thesis_done_lane: Optional[int] = None
        if items_done:
            for c, _ in items_done:
                mod_title = self._infer_module_title(c)
                if self._norm(mod_title) == self._norm("Bachelorarbeit") or self._norm(self._course_code(c)) in (self._norm("BA-PR"), self._norm("WISS-SE")):
                    li = self._lane_index_of(c, 0)
                    thesis_done_lane = li if thesis_done_lane is None else min(thesis_done_lane, li)

        if thesis_done_lane is not None:
            if steop_complete_lane_done is None:
                errors.append("rejected: Bachelorarbeit is DONE, but StEOP is not completed (DONE) yet.")
            elif thesis_done_lane < steop_complete_lane_done:
                errors.append("rejected: Bachelorarbeit is DONE before StEOP completion.")

        # -----------------------------------------
        # Soft order warnings (fix lane=0 bug)
        # -----------------------------------------
        for prereq, target in self.soft_prereqs:
            prereq_k = self._norm(prereq)
            target_k = self._norm(target)

            prereq_lane = earliest_lane_for_course.get(prereq_k)
            if prereq_lane is None:
                prereq_lane = earliest_lane_for_module.get(prereq_k)

            target_lane = earliest_lane_for_course.get(target_k)
            if target_lane is None:
                target_lane = earliest_lane_for_module.get(target_k)

            if prereq_lane is not None and target_lane is not None and target_lane < prereq_lane:
                warnings.append(
                    f"Reihenfolge-Hinweis: '{target}' ist vor '{prereq}' geplant. Das ist erlaubt, aber normalerweise wird '{prereq}' davor empfohlen."
                )

        # ----------------------------
        # Dashboard + missing requirements
        # ----------------------------
        total_ects = sum(self._to_float(c.get("ects")) for c, _ in items)

        def required_ects_for_module(module_key: str) -> Optional[float]:
            m = self.modules.get(module_key)
            if not m:
                return None
            return float(m["min_ects"] if m["min_ects"] is not None else m["ects"])

        def module_is_complete(module_key: str) -> bool:
            req = required_ects_for_module(module_key)
            if req is None:
                return False
            return mod_all.get(module_key, 0.0) >= req - 1e-6
        
        def module_kind(title: str) -> Optional[str]:
            m = self.modules.get(self._norm(title))
            return m["kind"] if m else None

        def is_complete_title(title: str) -> bool:
            return module_is_complete(self._norm(title))

        # Pflichtmodule missing
        for mk, m in self.modules.items():
            if m["kind"] == "mandatory":
                req = required_ects_for_module(mk) or 0.0
                have = mod_all.get(mk, 0.0)
                if have + 1e-6 < req:
                    missing.append(f"Pflichtmodul fehlt: {m['title']} ({req - have:.1f} ECTS)")

        # Bachelorarbeit missing
        thesis_key = self._norm("Bachelorarbeit")
        thesis_have = mod_all.get(thesis_key, 0.0)
        if thesis_have + 1e-6 < self.BACHELORARBEIT_ECTS:
            missing.append(f"Bachelorarbeit fehlt: {self.BACHELORARBEIT_ECTS - thesis_have:.1f} ECTS")

        # Narrow elective count
        narrow_completed: List[str] = []
        narrow_all: List[str] = []
        for mk, m in self.modules.items():
            if m["kind"] == "narrow_elective":
                narrow_all.append(m["title"])
                if module_is_complete(mk):
                    narrow_completed.append(m["title"])

        if len(narrow_completed) < self.MIN_NARROW_ELECTIVE_MODULES:
            missing.append(
                f"Wahlmodule der engen Wahl (+): mindestens {self.MIN_NARROW_ELECTIVE_MODULES} Module nötig, aktuell {len(narrow_completed)}."
            )

        # Transferable Skills minimum
        ts_ects = cat_ects.get("transferable_skills", 0.0)
        if ts_ects + 1e-6 < self.TRANSFERABLE_SKILLS_MIN_ECTS:
            missing.append(f"Transferable Skills: mindestens {self.TRANSFERABLE_SKILLS_MIN_ECTS:.1f} ECTS nötig (aktuell {ts_ects:.1f}).")

        # Total ECTS
        if total_ects + 1e-6 < self.TOTAL_ECTS:
            missing.append(f"Gesamtumfang: {self.TOTAL_ECTS - total_ects:.1f} ECTS fehlen bis {self.TOTAL_ECTS:.0f}.")

        # ----------------------------
        # Focus / Vertiefung progress (robust)
        # ----------------------------
        focus_raw = payload.get("selectedFocus") or payload.get("vertiefung")
        focus_key_in = self._norm(focus_raw) if focus_raw else ""
        focus_key = self.focus_aliases.get(focus_key_in, focus_key_in)

        focus_stats: Dict[str, Any] = {"selected": focus_raw, "recognized": False}
        focus_missing: List[str] = []

        if focus_key:
            f = self.focuses.get(focus_key)
            if f:
                focus_stats["recognized"] = True
                focus_stats["canonicalName"] = self.modules.get(focus_key, {}).get("title") or None

                completed_modules: Set[str] = set()
                for mk, m in self.modules.items():
                    if module_is_complete(mk):
                        completed_modules.add(self._norm(m["title"]))

                def count_completed(from_list: List[str]) -> int:
                    return sum(1 for t in from_list if self._norm(t) in completed_modules)

                req_list = f.get("required", [])
                for t in req_list:
                    if self._norm(t) not in completed_modules:
                        focus_missing.append(f"Vertiefung: Pflichtmodul fehlt: {t}")

                if "choose" in f:
                    choose = f["choose"]
                    got = count_completed(choose["from"])
                    need = int(choose["min"])
                    if got < need:
                        focus_missing.append(f"Vertiefung: es fehlen {need - got} weitere Module aus der Vertiefungsliste.")

                if "choose_groups" in f:
                    for grp in f["choose_groups"]:
                        got = count_completed(grp["from"])
                        need = int(grp["min"])
                        if got < need:
                            focus_missing.append(f"Vertiefung: es fehlen {need - got} Module aus der Gruppe: {', '.join(grp['from'])}")

                focus_stats["missingCount"] = len(focus_missing)
                focus_stats["missing"] = focus_missing[:]
            else:
                warnings.append(f"Vertiefung-Hinweis: selectedFocus '{focus_raw}' ist unbekannt (nicht in der curricularen Liste/Aliases).")

        if payload.get("validateFocusAsStrict") and focus_stats.get("recognized") and focus_missing:
            errors.append("rejected: selected focus requirements are not satisfied (strict focus validation enabled).")


        # --- Add ALL focus missing requirements into RuleCheckResult.missing (only if missed) ---
        if focus_stats.get("recognized"):
            f = self.focuses.get(focus_key)
            if f:
                focus_name = (payload.get("selectedFocus") or payload.get("vertiefung") or "").strip() or "Vertiefung"

                focus_missing_lines: List[str] = []

                def remaining_list(from_list: List[str]) -> List[str]:
                    return [t for t in from_list if not is_complete_title(t)]

                # (A) Required modules (must-have)
                for t in f.get("required", []):
                    if not is_complete_title(t):
                        focus_missing_lines.append(f"Vertiefung ({focus_name}): Pflichtmodul fehlt: {t}")

                # (B) Single choose block (pick N from list)
                if "choose" in f:
                    choose = f["choose"]
                    need = int(choose["min"])
                    rem = remaining_list(choose["from"])
                    got = len(choose["from"]) - len(rem)
                    if got < need:
                        # show exactly how many still needed, and the remaining options
                        focus_missing_lines.append(
                            f"Vertiefung ({focus_name}): es fehlen {need - got} Module aus: {', '.join(rem)}"
                        )

                # (C) Multiple choose groups (pick N from each group)
                for grp in f.get("choose_groups", []):
                    need = int(grp["min"])
                    rem = remaining_list(grp["from"])
                    got = len(grp["from"]) - len(rem)
                    if got < need:
                        focus_missing_lines.append(
                            f"Vertiefung ({focus_name}): es fehlen {need - got} Module aus: {', '.join(rem)}"
                        )

                # Only add to missing[] if there is something missing
                missing.extend(focus_missing_lines)


        # ----------------------------
        # Build stats
        # ----------------------------
        subj_pretty: Dict[str, float] = {}
        for k, v in subj_ects.items():
            subj_pretty[k.title() if k not in ("(none)",) else k] = round(v, 2)

        module_progress: List[Dict[str, Any]] = []
        for mk, m in sorted(self.modules.items(), key=lambda kv: kv[1]["title"]):
            req = required_ects_for_module(mk)
            have = mod_all.get(mk, 0.0)
            module_progress.append({
                "title": m["title"],
                "kind": m["kind"],
                "requiredEcts": req,
                "haveEcts": round(have, 2),
                "complete": (req is not None and have >= req - 1e-6),
            })

        stats: Dict[str, Any] = {
            "programCode": self.program_code,
            "totalEcts": round(total_ects, 2),
            "ectsMissingTo180": round(max(0.0, self.TOTAL_ECTS - total_ects), 2),
            "ectsPerSemester": {str(k): round(v, 2) for k, v in sorted(lane_ects.items())},
            "recommendedEctsPerSemester": self.RECOMMENDED_ECTS_PER_SEMESTER,
            "maxEctsPerSemester": self.MAX_ECTS_PER_SEMESTER,
            "ectsByCategory": {k: round(v, 2) for k, v in sorted(cat_ects.items())},
            "ectsByExamSubject": subj_pretty,
            "narrowElectives": {
                "requiredCount": self.MIN_NARROW_ELECTIVE_MODULES,
                "completedCount": len(narrow_completed),
                "completed": narrow_completed,
                "allOptionsCount": len(narrow_all),
            },
            "steop": {
                "done": {
                    "completeLaneIndex": steop_complete_lane_done,
                    **steop_done,
                    "nonSteopEctsBeforeCompletion": round(non_steop_ects_before, 2),
                    "maxNonSteopBeforeCompletion": 22.0,
                },
                "planned": steop_plan,  # UI progress (done+planned)
            },
            "focus": focus_stats,
            "moduleProgress": module_progress,
            "warnings": warnings,
        }

        # ----------------------------
        # Final decision
        # ----------------------------
        if errors:
            change = payload.get("change") or {}
            ccode = change.get("courseCode")
            ctype = change.get("type")
            if ccode:
                msg = f"rejected: cannot apply change ({ctype}) for '{ccode}': {errors[0].replace('rejected: ', '')}"
            else:
                msg = errors[0]
            return RuleCheckResult(ok=False, message=msg, stats=stats, missing=missing)

        return RuleCheckResult(ok=True, message="accepted", stats=stats, missing=missing)
