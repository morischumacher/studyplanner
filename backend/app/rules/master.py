from __future__ import annotations

from typing import Any, List, Dict, Tuple, Optional

from ..curriculum import MASTER, load as load_curriculum
from .payload import resolve_semester_load_limits
from .result import RuleCheckResult

_CURRICULUM = load_curriculum(MASTER)


class RuleChecker:
    """
    Rule engine for TU Wien MSc Software Engineering (120 ECTS).

    Assumptions / conventions (robust to variants):
    - payload contains either:
        * payload["lanes"] = [{"laneIndex": int, "plannedCourses": [...], "doneCourses": [...]}]
      OR top-level planned/done lists with optional per-course laneIndex.
    - each course has: code, ects, category, examSubject (some may be empty for free/diploma items).
    - category is mapped into internal buckets via synonyms (mandatory/core/elective/free/transferable/diploma...).
    - "Wahlmodul" gating: electives of an examSubject that has core modules require all that subject’s core modules.
    """

    # The thresholds the curriculum sets, and the two the application adds.
    # MAX and RECOMMENDED_ECTS_PER_SEMESTER are not curriculum law: they are the
    # plan-sanity limits the planner enforces, one as a rejection and one as a
    # warning. All five are read from the curriculum document.
    TOTAL_ECTS = _CURRICULUM.TOTAL_ECTS
    SUBJECT_MODULES_MIN_ECTS = _CURRICULUM.SUBJECT_MODULES_MIN_ECTS
    TRANSFERABLE_SKILLS_MIN_ECTS = _CURRICULUM.TRANSFERABLE_SKILLS_MIN_ECTS
    MAX_ECTS_PER_SEMESTER = _CURRICULUM.MAX_ECTS_PER_SEMESTER
    RECOMMENDED_ECTS_PER_SEMESTER = _CURRICULUM.RECOMMENDED_ECTS_PER_SEMESTER

    def __init__(self) -> None:
        # The curriculum itself is data, loaded from app/curriculum/master.json.
        # What stays here is the checking, which is the part that is code.
        curriculum = load_curriculum(MASTER)
        self.exam_subjects: set = curriculum.exam_subjects
        self.core_by_exam_subject: Dict[str, Any] = curriculum.core_by_exam_subject
        self.mandatory_modules: Dict[str, Any] = curriculum.mandatory_modules
        self.core_modules: Dict[str, Any] = curriculum.core_modules
        self.variable_modules: Dict[str, Any] = curriculum.variable_modules
        self.advanced_topics_prefixes: tuple = curriculum.advanced_topics_prefixes
        self.prerequisites: Dict[str, Any] = curriculum.prerequisites
        self.category_map: Dict[str, str] = curriculum.category_map
        self.special_category_by_code: Dict[str, str] = curriculum.special_category_by_code
        self.course_alias_to_name: Dict[str, str] = curriculum.course_alias_to_name

    def evaluate(self, payload: dict[str, Any]) -> RuleCheckResult:
        max_ects_per_semester, recommended_ects_per_semester = self._resolve_semester_load_limits(payload)
        lanes = self._extract_lanes(payload)
        parsed, parse_error = self._parse_courses(lanes, payload)
        if parse_error is not None:
            return RuleCheckResult(ok=False, message=parse_error, stats={}, missing=[])

        stats, missing = self._build_dashboard(parsed)
        stats["maxEctsPerSemester"] = round(max_ects_per_semester, 1)
        stats["recommendedEctsPerSemester"] = round(recommended_ects_per_semester, 1)
        normalized_change = self._normalize_change(payload.get("change"))
        if normalized_change:
            stats["last_change"] = normalized_change

        violations: List[str] = []

        dup_msg = self._check_duplicates(parsed)
        if dup_msg:
            violations.append(dup_msg)

        sem_msg, warnings, sem_missing = self._check_semester_load(
            stats,
            max_ects_per_semester,
            recommended_ects_per_semester,
        )
        if sem_msg:
            violations.append(sem_msg)
        if warnings:
            stats.setdefault("warnings", []).extend(warnings)
        if sem_missing:
            for m in sem_missing:
                if m not in missing:
                    missing.append(m)

        mis_msg = self._check_known_module_consistency(parsed)
        if mis_msg:
            violations.append(mis_msg)

        pre_msg = self._check_prerequisites(parsed)
        if pre_msg:
            violations.append(pre_msg)

        sequencing_warnings = self._recommended_sequencing_warnings(parsed)
        if sequencing_warnings:
            stats.setdefault("warnings", []).extend(sequencing_warnings)

        # ✅ NEW: core/elective relationship is missing+warning, not a violation
        core_warnings, core_missing = self._core_dependency_feedback(parsed)
        if core_warnings:
            stats.setdefault("warnings", []).extend(core_warnings)
        if core_missing:
            for m in core_missing:
                if m not in missing:
                    missing.append(m)

        if violations:
            stats["errors"] = violations
            msg = self._make_actionable_message(payload, violations[0])
            return RuleCheckResult(ok=False, message=msg, stats=stats, missing=missing, errors=violations)

        return RuleCheckResult(ok=True, message="accepted", stats=stats, missing=missing, errors=[])

    def _extract_lanes(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        if isinstance(payload.get("lanes"), list):
            return payload["lanes"]
        # Support payload that is already a single lane-like object
        if "laneIndex" in payload and ("plannedCourses" in payload or "doneCourses" in payload):
            return [payload]
        # Support top-level planned/done: group by per-course laneIndex when present.
        if isinstance(payload.get("plannedCourses"), list) or isinstance(payload.get("doneCourses"), list):
            lanes_by_idx: Dict[int, Dict[str, Any]] = {}

            def ensure_lane(idx: int) -> Dict[str, Any]:
                if idx not in lanes_by_idx:
                    lanes_by_idx[idx] = {"laneIndex": idx, "plannedCourses": [], "doneCourses": []}
                return lanes_by_idx[idx]

            for status_key in ("plannedCourses", "doneCourses"):
                for course in (payload.get(status_key) or []):
                    if not isinstance(course, dict):
                        continue
                    idx = course.get("laneIndex", 0)
                    lane_index = idx if isinstance(idx, int) and idx >= 0 else 0
                    ensure_lane(lane_index)[status_key].append(course)

            if not lanes_by_idx:
                return [{"laneIndex": 0, "plannedCourses": [], "doneCourses": []}]

            return [lanes_by_idx[k] for k in sorted(lanes_by_idx.keys())]
        return []

    @staticmethod
    def _norm(s: Any) -> str:
        if s is None:
            return ""
        return str(s).strip()

    @staticmethod
    def _norm_key(s: Any) -> str:
        # normalized key for matching
        return RuleChecker._norm(s).lower()

    @staticmethod
    def _parse_ects(v: Any) -> Optional[float]:
        if v is None:
            return None
        if isinstance(v, (int, float)):
            return float(v)
        s = str(v).strip()
        if not s:
            return None
        # accept German decimal comma
        s = s.replace(",", ".")
        try:
            return float(s)
        except ValueError:
            return None

    def _map_category(self, raw_cat: Any, raw_code: str) -> Optional[str]:
        ck = self._norm_key(raw_code)
        special = self.special_category_by_code.get(ck)
        if special is not None:
            return special

        c = self._norm_key(raw_cat)
        if c in self.category_map:
            return self.category_map[c]

        # try to infer from code if category is messy/missing
        if "transferable" in ck or "soft skills" in ck:
            return "transferable_skills"
        if "freie wahl" in ck or "free choice" in ck:
            return "free"
        if "diplom" in ck or "thesis" in ck or "master thesis" in ck:
            return "diploma_other"
        return None

    def _canonical_rule_name(self, code_or_name: Any) -> str:
        raw = self._norm(code_or_name)
        if not raw:
            return ""
        return self.course_alias_to_name.get(raw, raw)

    def _parse_courses(
        self, lanes: List[Dict[str, Any]], payload: Dict[str, Any]
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        parsed: List[Dict[str, Any]] = []

        if not lanes:
            # empty plan is acceptable; still produce dashboard
            return parsed, None

        for lane in lanes:
            lane_index = lane.get("laneIndex", 0)
            if not isinstance(lane_index, int) or lane_index < 0:
                return [], f"Invalid laneIndex '{lane_index}'. laneIndex must be a non-negative integer."

            for list_name, status in (("doneCourses", "done"), ("plannedCourses", "planned")):
                items = lane.get(list_name, [])
                if items is None:
                    items = []
                if not isinstance(items, list):
                    return [], f"'{list_name}' must be a list."

                for course in items:
                    if not isinstance(course, dict):
                        return [], f"Course entries must be objects; got '{type(course).__name__}'."

                    code = self._norm(course.get("code"))
                    ects = self._parse_ects(course.get("ects"))
                    raw_cat = course.get("category")
                    exam_subject = self._norm(course.get("examSubject"))

                    if not code:
                        return [], "A course is missing 'code'."
                    if ects is None or ects <= 0:
                        return [], f"Course '{code}' has invalid ects '{course.get('ects')}'."
                    if ects > 60:
                        return [], f"Course '{code}' has implausible ects '{ects}'."

                    mapped_cat = self._map_category(raw_cat, code)
                    if mapped_cat is None:
                        return [], f"Course '{code}' has unknown category '{raw_cat}'."

                    # Normalize examSubject key; allow empty for free/diploma items
                    exam_key = self._norm_key(exam_subject)
                    if mapped_cat in {"mandatory", "core", "elective", "extension"}:
                        if not exam_key:
                            return [], f"Course '{code}' must have an examSubject (got empty)."
                        if exam_key not in self.exam_subjects:
                            return [], (
                                f"Course '{code}' has unknown examSubject '{exam_subject}'. "
                                "Use a curriculum exam subject (or use category 'free/transferable' for free-choice items)."
                            )

                    parsed.append(
                        {
                            "code": code,
                            "code_key": self._norm_key(code),
                            "rule_name": self._canonical_rule_name(code),
                            "rule_key": self._norm_key(self._canonical_rule_name(code)),
                            "ects": float(ects),
                            "category_raw": raw_cat,
                            "category": mapped_cat,
                            "examSubject": exam_subject,
                            "examSubject_key": exam_key,
                            "laneIndex": lane_index,
                            "status": status,
                        }
                    )

        # Also tolerate per-course laneIndex if top-level lists were given (rare); ignore if lanes already exist
        # (We keep lane-based as the canonical structure.)

        return parsed, None

    def _build_dashboard(self, courses: List[Dict[str, Any]]) -> Tuple[Dict[str, Any], List[str]]:
        by_cat: Dict[str, float] = {}
        by_exam: Dict[str, float] = {}
        per_sem: Dict[int, float] = {}
        done_ects = 0.0
        planned_ects = 0.0

        def add(d: Dict[str, float], k: str, v: float) -> None:
            d[k] = d.get(k, 0.0) + v

        for c in courses:
            ects = c["ects"]
            cat = c["category"]
            exam = c["examSubject_key"]
            sem = c["laneIndex"]
            status = c["status"]

            add(by_cat, cat, ects)
            if exam:
                add(by_exam, exam, ects)
            per_sem[sem] = per_sem.get(sem, 0.0) + ects

            if status == "done":
                done_ects += ects
            else:
                planned_ects += ects

        # Buckets for the explicit curriculum constraints
        subject_modules_ects = 0.0  # Pflicht/Core/Wahl, excluding free-choice module
        free_module_ects = 0.0
        transferable_ects = 0.0
        diploma_ects = 0.0
        diploma_thesis = 0.0
        diploma_seminar = 0.0
        diploma_defense = 0.0
        diploma_other = 0.0

        for c in courses:
            ects = c["ects"]
            cat = c["category"]
            if cat in {"mandatory", "core", "elective", "extension"}:
                subject_modules_ects += ects
            elif cat in {"free", "transferable_skills"}:
                free_module_ects += ects
                if cat == "transferable_skills":
                    transferable_ects += ects
            elif cat.startswith("diploma_"):
                diploma_ects += ects
                if cat == "diploma_thesis":
                    diploma_thesis += ects
                elif cat == "diploma_seminar":
                    diploma_seminar += ects
                elif cat == "diploma_defense":
                    diploma_defense += ects
                else:
                    diploma_other += ects
            elif cat == "diploma_other":
                diploma_ects += ects
                diploma_other += ects

        total_ects = done_ects + planned_ects

        # Infer diploma components if only a generic diploma item exists (e.g., "Diplomarbeit" 30 ECTS)
        thesis_need = 27.0
        seminar_need = 1.5
        defense_need = 1.5

        remaining_generic = max(0.0, diploma_other)
        thesis_total = diploma_thesis
        seminar_total = diploma_seminar
        defense_total = diploma_defense

        # allocate generic diploma ects to missing components in order (thesis -> seminar -> defense)
        alloc = min(remaining_generic, max(0.0, thesis_need - thesis_total))
        thesis_total += alloc
        remaining_generic -= alloc

        alloc = min(remaining_generic, max(0.0, seminar_need - seminar_total))
        seminar_total += alloc
        remaining_generic -= alloc

        alloc = min(remaining_generic, max(0.0, defense_need - defense_total))
        defense_total += alloc
        remaining_generic -= alloc

        # Missing list
        missing: List[str] = []

        # Mandatory modules presence
        for m in self.mandatory_modules.keys():
            if not any(c.get("rule_key") == self._norm_key(m) for c in courses):
                if m == "Seminar in Computer Science":
                    missing.append("Mandatory: Seminar in Computer Science (min. 3.0 ECTS) is missing.")
                else:
                    missing.append(f"Mandatory: {m} (6.0 ECTS) is missing.")

        # Minimum 81 ECTS in Pflicht/Core/Wahl modules (excluding free-choice module)
        if subject_modules_ects + 1e-9 < self.SUBJECT_MODULES_MIN_ECTS:
            need = self.SUBJECT_MODULES_MIN_ECTS - subject_modules_ects
            missing.append(
                f"At least {self.SUBJECT_MODULES_MIN_ECTS:.1f} ECTS from Pflicht/Core/Wahl modules (excluding Free Choice/TS): need {need:.1f} more."
            )

        # Diploma (30 ECTS total, split as 27 + 1.5 + 1.5)
        if diploma_ects + 1e-9 < 30.0:
            missing.append(f"Diploma requirement: need {30.0 - diploma_ects:.1f} more ECTS in Diplomarbeit (total 30.0).")
        if thesis_total + 1e-9 < thesis_need:
            missing.append(f"Diploma requirement: Master Thesis/Diplomarbeit work needs {thesis_need - thesis_total:.1f} more ECTS (target 27.0).")
        if seminar_total + 1e-9 < seminar_need:
            missing.append(f"Diploma requirement: Seminar for Diploma Students needs {seminar_need - seminar_total:.1f} more ECTS (target 1.5).")
        if defense_total + 1e-9 < defense_need:
            missing.append(f"Diploma requirement: Final oral exam/defense needs {defense_need - defense_total:.1f} more ECTS (target 1.5).")

        # Transferable skills minimum within Free Choice module
        if transferable_ects + 1e-9 < self.TRANSFERABLE_SKILLS_MIN_ECTS:
            missing.append(
                f"Transferable Skills: need {self.TRANSFERABLE_SKILLS_MIN_ECTS - transferable_ects:.1f} more ECTS (minimum {self.TRANSFERABLE_SKILLS_MIN_ECTS:.1f})."
            )

        # Total ECTS to reach 120 (note: curriculum allows >=120, so only missing when below)
        if total_ects + 1e-9 < self.TOTAL_ECTS:
            missing.append(f"Total ECTS: need {self.TOTAL_ECTS - total_ects:.1f} more to reach {self.TOTAL_ECTS:.0f}.")

        # Free-choice ECTS needed to reach 120 once subject modules + diploma are counted
        # Free module can shrink if subject modules exceed 81; but TS min still applies (handled above).
        needed_free = max(0.0, self.TOTAL_ECTS - (subject_modules_ects + diploma_ects))
        if free_module_ects + 1e-9 < needed_free:
            missing.append(f"Free Choice/Transferable Skills module: need {needed_free - free_module_ects:.1f} more ECTS to reach total 120.")

        stats: Dict[str, Any] = {
            "ects": {
                "done": round(done_ects, 1),
                "planned": round(planned_ects, 1),
                "total": round(total_ects, 1),
                "target_total": self.TOTAL_ECTS,
            },
            "buckets": {
                "subject_modules_excl_free": round(subject_modules_ects, 1),
                "free_choice_and_ts": round(free_module_ects, 1),
                "transferable_skills": round(transferable_ects, 1),
                "diploma_total": round(diploma_ects, 1),
                "diploma_thesis_allocated": round(thesis_total, 1),
                "diploma_seminar_allocated": round(seminar_total, 1),
                "diploma_defense_allocated": round(defense_total, 1),
                "needed_free_to_hit_120": round(needed_free, 1),
            },
            "per_semester": {str(k): round(v, 1) for k, v in sorted(per_sem.items())},
            "by_category": {k: round(v, 1) for k, v in sorted(by_cat.items())},
            "by_exam_subject": {k: round(v, 1) for k, v in sorted(by_exam.items())},
        }
        return stats, missing

    @staticmethod
    def _resolve_semester_load_limits(payload: dict[str, Any]) -> Tuple[float, float]:
        return resolve_semester_load_limits(
            payload,
            RuleChecker.MAX_ECTS_PER_SEMESTER,
            RuleChecker.RECOMMENDED_ECTS_PER_SEMESTER,
        )

    def _check_duplicates(self, courses: List[Dict[str, Any]]) -> Optional[str]:
        seen: Dict[str, Dict[str, Any]] = {}
        for c in courses:
            k = c["code_key"]
            if k in seen:
                return (
                    f"Duplicate course detected: '{c['code']}' appears more than once "
                    f"(e.g., in semester {seen[k]['laneIndex'] + 1} and {c['laneIndex'] + 1})."
                )
            seen[k] = c
        return None

    def _check_semester_load(
        self,
        stats: Dict[str, Any],
        max_ects_per_semester: float,
        recommended_ects_per_semester: float,
    ) -> Tuple[Optional[str], List[str], List[str]]:
        warnings: List[str] = []
        missing: List[str] = []
        per_sem = stats.get("per_semester", {})
        hard_error: Optional[str] = None
        for sem_str, ects in per_sem.items():
            try:
                sem_idx = int(sem_str)
            except ValueError:
                continue
            if ects > max_ects_per_semester + 1e-9:
                if hard_error is None:
                    hard_error = (
                        f"Semester {sem_idx + 1} exceeds the maximum allowed planning load of "
                        f"{max_ects_per_semester:.1f} ECTS (currently {ects:.1f})."
                    )
                missing.append(
                    f"Semester load limit exceeded in semester {sem_idx + 1}: {ects:.1f}/{max_ects_per_semester:.1f} ECTS. "
                    f"Reduce by {max(0.0, ects - max_ects_per_semester):.1f} ECTS."
                )
            if ects > recommended_ects_per_semester + 1e-9:
                warnings.append(
                    f"Semester {sem_idx + 1} is heavy: {ects:.1f} ECTS planned/done (recommended ~{recommended_ects_per_semester:.0f})."
                )
        return hard_error, warnings, missing

    def _check_known_module_consistency(self, courses: List[Dict[str, Any]]) -> Optional[str]:
        # If a known mandatory/core module appears with wrong examSubject or ects out of range or wrong category -> reject.
        known = {}
        known.update(self.mandatory_modules)
        known.update(self.core_modules)
        known.update(self.variable_modules)

        for c in courses:
            code = c["code"]
            rule_name = c.get("rule_name") or code
            rule_key = c.get("rule_key") or self._norm_key(rule_name)
            ects = c["ects"]
            cat = c["category"]
            exam_key = c["examSubject_key"]

            # Advanced Topics family: min 3 ECTS
            for prefix in self.advanced_topics_prefixes:
                if self._norm_key(rule_name).startswith(self._norm_key(prefix)):
                    if ects + 1e-9 < 3.0:
                        return f"'{code}' is an Advanced Topics module and must be at least 3.0 ECTS (currently {ects:.1f})."
                    # examSubject should be non-empty, but may be handled in parse; no further check here.
                    break

            # Exact match with known spec?
            spec = known.get(rule_name) or known.get(self._best_known_name(rule_key, known))
            if spec is None:
                # If user marks something as core/mandatory but we don't recognize it, reject as “misattributed category”.
                if cat in {"mandatory", "core"}:
                    return (
                        f"Course '{code}' is marked as '{cat}', but it is not a known {cat} module in this curriculum. "
                        "Fix the category or use an elective/free category."
                    )
                continue

            expected_exam = self._norm_key(spec.get("examSubject", ""))
            if expected_exam and exam_key and expected_exam != exam_key:
                return (
                    f"Course '{code}' is assigned to examSubject '{c['examSubject']}', "
                    f"but it belongs to '{spec['examSubject']}' in the curriculum."
                )

            # ECTS range check
            mn = float(spec.get("ects_min", 0.0))
            mx = float(spec.get("ects_max", 1e9))
            if ects + 1e-9 < mn or ects > mx + 1e-9:
                return f"Course '{code}' has {ects:.1f} ECTS, but the allowed range is {mn:.1f}–{mx:.1f} ECTS."

            # Category consistency for known mandatory/core modules
            expected_kind = spec.get("kind")
            if expected_kind in {"mandatory", "core"}:
                if cat != expected_kind:
                    return f"Course '{code}' must be categorized as '{expected_kind}', not '{cat}'."

        return None

    @staticmethod
    def _best_known_name(code_key: str, known: Dict[str, Dict[str, Any]]) -> Optional[str]:
        # try to match by normalized keys
        for k in known.keys():
            if RuleChecker._norm_key(k) == code_key:
                return k
        return None

    def _check_prerequisites(self, courses: List[Dict[str, Any]]) -> Optional[str]:
        # Build earliest lane index per course code
        lane_of: Dict[str, int] = {}
        for c in courses:
            k = c.get("rule_key") or c["code_key"]
            lane_of[k] = min(lane_of.get(k, c["laneIndex"]), c["laneIndex"])

        def find_lane(name: str) -> Optional[int]:
            canonical = self._canonical_rule_name(name)
            return lane_of.get(self._norm_key(canonical))

        # Check explicit prerequisites (if these items are used)
        for course_name, prereqs in self.prerequisites.items():
            course_lane = find_lane(course_name)
            if course_lane is None:
                continue
            for p in prereqs:
                pre_lane = find_lane(p)
                if pre_lane is None:
                    return f"'{course_name}' requires '{p}' to be in your plan first."
                if pre_lane > course_lane:
                    return (
                        f"'{course_name}' is planned in semester {course_lane + 1}, "
                        f"but its prerequisite '{p}' is in semester {pre_lane + 1}."
                    )

        # Also ensure: if a user takes a known core module and its examSubject electives exist earlier, core should not be later (handled in core gating)
        return None

    def _recommended_sequencing_warnings(self, courses: List[Dict[str, Any]]) -> List[str]:
        warnings: List[str] = []
        lane_of: Dict[str, int] = {}
        for c in courses:
            k = c.get("rule_key") or c["code_key"]
            lane_of[k] = min(lane_of.get(k, c["laneIndex"]), c["laneIndex"])

        ase_key = self._norm_key("Advanced Software Engineering")
        ase_project_key = self._norm_key("Advanced Software Engineering Project")
        ase_lane = lane_of.get(ase_key)
        ase_project_lane = lane_of.get(ase_project_key)
        if ase_project_lane is not None:
            if ase_lane is None:
                warnings.append(
                    "Recommended sequencing: take 'Advanced Software Engineering' together with "
                    "'Advanced Software Engineering Project' (same semester)."
                )
            elif ase_lane != ase_project_lane:
                warnings.append(
                    "Recommended sequencing: place 'Advanced Software Engineering' and "
                    "'Advanced Software Engineering Project' in the same semester."
                )

        return warnings

    def _core_dependency_feedback(self, courses: List[Dict[str, Any]]) -> Tuple[List[str], List[str]]:
        """
        If an examSubject has electives selected, its core modules must ALSO be in the plan
        to satisfy completion rules. Timing does NOT matter for validity, but we warn if
        an elective is scheduled before its core.
        """
        warnings: List[str] = []
        missing: List[str] = []

        courses_by_exam: Dict[str, List[Dict[str, Any]]] = {}
        for c in courses:
            ek = c["examSubject_key"]
            if ek:
                courses_by_exam.setdefault(ek, []).append(c)

        # code_key -> laneIndex (earliest occurrence, any status)
        lane_of: Dict[str, int] = {}
        # code_key -> laneIndex (earliest occurrence, done only)
        done_lane_of: Dict[str, int] = {}
        for c in courses:
            k = c.get("rule_key") or c["code_key"]
            lane_of[k] = min(lane_of.get(k, c["laneIndex"]), c["laneIndex"])
            if c.get("status") == "done":
                done_lane_of[k] = min(done_lane_of.get(k, c["laneIndex"]), c["laneIndex"])

        for exam_key, core_list in self.core_by_exam_subject.items():
            items = courses_by_exam.get(exam_key, [])
            if not items:
                continue

            electives = [c for c in items if c["category"] == "elective"]
            if not electives:
                continue

            # 1) Missing requirement: core must be present somewhere in plan
            missing_cores_in_plan = [core for core in core_list if self._norm_key(core) not in lane_of]
            if missing_cores_in_plan:
                # One consolidated missing message per exam subject
                missing.append(
                    f"Core requirement for '{electives[0]['examSubject']}': add core module(s): {', '.join(missing_cores_in_plan)} "
                    "(required because you selected electives in this exam subject)."
                )
                # Also a warning to make it visible immediately
                warnings.append(
                    f"You selected electives in '{electives[0]['examSubject']}' but core module(s) are not in your plan yet: {', '.join(missing_cores_in_plan)}."
                )
                # Can't do ordering warnings if cores aren't scheduled
                continue

            # 2) Core completion requirement: planned is not enough, core must be done.
            missing_core_completions = [core for core in core_list if self._norm_key(core) not in done_lane_of]
            if missing_core_completions:
                missing.append(
                    f"Core completion requirement for '{electives[0]['examSubject']}': complete core module(s): "
                    f"{', '.join(missing_core_completions)} (planned core alone is not sufficient)."
                )
                warnings.append(
                    f"You selected electives in '{electives[0]['examSubject']}' but required core module(s) are not done yet: "
                    f"{', '.join(missing_core_completions)}."
                )

            # 3) Ordering warning only (not a violation): elective before core
            for e in electives:
                e_lane = e["laneIndex"]
                for core in core_list:
                    c_lane = lane_of[self._norm_key(core)]
                    if c_lane > e_lane:
                        warnings.append(
                            f"Recommended sequencing: take core '{core}' before elective '{e['code']}'. "
                            f"(Core is in semester {c_lane + 1}, elective is in semester {e_lane + 1}.)"
                        )

        return warnings, missing


    def _lane_to_semester_number(self, lane_index: Any) -> Optional[int]:
        if not isinstance(lane_index, int) or lane_index < 0:
            return None
        return lane_index + 1

    def _normalize_change(self, change: Any) -> Optional[Dict[str, Any]]:
        if not isinstance(change, dict):
            return None

        normalized: Dict[str, Any] = {"type": self._norm(change.get("type") or change.get("action"))}

        def norm_items(items: Any) -> List[Dict[str, Any]]:
            if not isinstance(items, list):
                return []
            out: List[Dict[str, Any]] = []
            for item in items:
                if not isinstance(item, dict):
                    continue
                from_lane = item.get("fromLaneIndex")
                to_lane = item.get("toLaneIndex")
                out.append(
                    {
                        "id": self._norm(item.get("id")) or None,
                        "code": self._norm(item.get("code")) or None,
                        "fromLaneIndex": from_lane if isinstance(from_lane, int) else None,
                        "toLaneIndex": to_lane if isinstance(to_lane, int) else None,
                        "fromSemesterNumber": self._lane_to_semester_number(from_lane),
                        "toSemesterNumber": self._lane_to_semester_number(to_lane),
                    }
                )
            return out

        normalized["added"] = norm_items(change.get("added"))
        normalized["removed"] = norm_items(change.get("removed"))
        normalized["moved"] = norm_items(change.get("moved"))

        if change.get("courseCode"):
            lane_index = change.get("laneIndex")
            normalized["courseCode"] = self._norm(change.get("courseCode"))
            normalized["toStatus"] = self._norm(change.get("toStatus"))
            normalized["laneIndex"] = lane_index if isinstance(lane_index, int) else None
            normalized["semesterNumber"] = self._lane_to_semester_number(lane_index)

        return normalized

    def _make_actionable_message(self, payload: Dict[str, Any], base_msg: str) -> str:
        change = payload.get("change")
        if not isinstance(change, dict):
            return base_msg

        action = self._norm(change.get("action") or change.get("type"))
        code = self._norm(change.get("code"))
        semester_hint = ""

        if action == "plan_updated":
            added = change.get("added") if isinstance(change.get("added"), list) else []
            moved = change.get("moved") if isinstance(change.get("moved"), list) else []
            removed = change.get("removed") if isinstance(change.get("removed"), list) else []

            first = None
            if added:
                first = added[0] if isinstance(added[0], dict) else None
                if first:
                    code = self._norm(first.get("code")) or code
                    to_lane = first.get("toLaneIndex")
                    sem_no = self._lane_to_semester_number(to_lane)
                    if sem_no is not None:
                        semester_hint = f" (semester {sem_no})"
            elif moved:
                first = moved[0] if isinstance(moved[0], dict) else None
                if first:
                    code = self._norm(first.get("code")) or code
                    to_lane = first.get("toLaneIndex")
                    sem_no = self._lane_to_semester_number(to_lane)
                    if sem_no is not None:
                        semester_hint = f" (to semester {sem_no})"
            elif removed:
                first = removed[0] if isinstance(removed[0], dict) else None
                if first:
                    code = self._norm(first.get("code")) or code

        if action == "course_status_toggled":
            code = self._norm(change.get("courseCode")) or code
            lane = change.get("laneIndex")
            sem_no = self._lane_to_semester_number(lane)
            if sem_no is not None:
                semester_hint = f" (semester {sem_no})"

        if action and code:
            return f"Rejected {action} '{code}'{semester_hint}: {base_msg}"
        if action:
            return f"Rejected {action}{semester_hint}: {base_msg}"
        return base_msg
