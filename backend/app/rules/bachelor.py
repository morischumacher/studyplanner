from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Dict, Tuple, Optional, Set
import unicodedata

from ..curriculum import BACHELOR, load as load_curriculum
from .payload import resolve_semester_load_limits
from .result import RuleCheckResult

_CURRICULUM = load_curriculum(BACHELOR)


@dataclass
class _PlanTotals:
    """
    The sums one pass over the courses produces.

    Almost every rule needs a different slice of the same arithmetic, so it is
    computed once and handed around rather than recomputed per rule.

    `validated` is the part of the plan that survived parsing. A course whose
    credits could not be read is reported once and then plays no further part, so
    the rules that run afterwards read it rather than the payload.
    """

    validated: List[Tuple[dict[str, Any], str]] = field(default_factory=list)
    seen: Dict[str, str] = field(default_factory=dict)
    lane_ects: Dict[int, float] = field(default_factory=dict)
    mod_done: Dict[str, float] = field(default_factory=dict)
    mod_planned: Dict[str, float] = field(default_factory=dict)
    mod_all: Dict[str, float] = field(default_factory=dict)
    cat_ects: Dict[str, float] = field(default_factory=dict)
    subj_ects: Dict[str, float] = field(default_factory=dict)
    earliest_lane_for_course: Dict[str, int] = field(default_factory=dict)
    earliest_lane_for_module: Dict[str, int] = field(default_factory=dict)
    per_course_canonical_cat: Dict[str, str] = field(default_factory=dict)
    per_course_module_title: Dict[str, str] = field(default_factory=dict)
    split_module_parts: Dict[str, Set[str]] = field(default_factory=dict)


class RuleChecker:
    """
    Compliance checking for the TU Wien bachelor programme in Informatics.

    Three things about this curriculum shape the checks below.

    The introductory phase, StEOP, is a gate rather than a requirement: until it
    is complete, only a limited amount of other work may be taken. It is measured
    twice, once over completed courses to decide whether the gate has opened, and
    once over completed and planned together to show progress.

    A focus area is optional. Choosing one adds requirements without removing
    any, and students name theirs inconsistently, so it is matched through a
    table of aliases rather than by exact title.

    Several modules are split into parts that come in variants. A plan may take
    any one variant, and mixing parts from two variants of the same module is
    rejected.
    """

    # The thresholds the curriculum sets, and the two the application adds.
    # MAX and RECOMMENDED_ECTS_PER_SEMESTER are not curriculum law: they are the
    # plan-sanity limits the planner enforces, one as a rejection and one as a
    # warning. All nine are read from the curriculum document.
    TOTAL_ECTS = _CURRICULUM.TOTAL_ECTS
    MIN_NARROW_ELECTIVE_MODULES = _CURRICULUM.MIN_NARROW_ELECTIVE_MODULES
    TRANSFERABLE_SKILLS_MIN_ECTS = _CURRICULUM.TRANSFERABLE_SKILLS_MIN_ECTS
    TRANSFERABLE_SKILLS_MAX_ECTS = _CURRICULUM.TRANSFERABLE_SKILLS_MAX_ECTS
    BACHELORARBEIT_ECTS = _CURRICULUM.BACHELORARBEIT_ECTS
    MAX_ECTS_PER_SEMESTER = _CURRICULUM.MAX_ECTS_PER_SEMESTER
    RECOMMENDED_ECTS_PER_SEMESTER = _CURRICULUM.RECOMMENDED_ECTS_PER_SEMESTER
    STEOP_POOL_MIN_ECTS = _CURRICULUM.STEOP_POOL_MIN_ECTS
    MAX_NON_STEOP_ECTS_BEFORE_STEOP = _CURRICULUM.MAX_NON_STEOP_ECTS_BEFORE_STEOP

    # Which of the compulsory introductory-phase courses the plan has to carry.
    # The wording each one is reported as is prose and stays below.
    _STEOP_MANDATORY_MISSING = {
        "eidi1": "StEOP Pflicht-LV fehlt: Einführung in die Programmierung 1 (5.5 ECTS)",
        "ma": "StEOP Pflicht-LV fehlt: Mathematisches Arbeiten 1 (2.0 ECTS)",
        "ori": "StEOP Pflicht-LV fehlt: Orientierung Informatik und Wirtschaftsinformatik (1.0 ECTS)",
    }

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

    @staticmethod
    def _resolve_semester_load_limits(payload: dict[str, Any]) -> Tuple[float, float]:
        return resolve_semester_load_limits(
            payload,
            RuleChecker.MAX_ECTS_PER_SEMESTER,
            RuleChecker.RECOMMENDED_ECTS_PER_SEMESTER,
        )

    def __init__(self) -> None:
        # The curriculum itself is data, loaded from app/curriculum/bachelor.json.
        # What stays here is the checking, which is the part that is code.
        curriculum = load_curriculum(BACHELOR)
        self.program_code: str = curriculum.program_code
        self.exam_subject_aliases: Dict[str, str] = curriculum.exam_subject_aliases
        self.modules: Dict[str, Dict[str, Any]] = curriculum.modules
        self.course_to_module: Dict[str, str] = curriculum.course_to_module
        self.steop_mandatory_lv_keys: Dict[str, str] = curriculum.steop_mandatory_lv_keys
        self.steop_mandatory_tags: List[str] = curriculum.steop_mandatory_tags
        self.steop_pool_keys: set = curriculum.steop_pool_keys
        self.allowed_before_steop_extra: set = curriculum.allowed_before_steop_extra
        self.focuses: Dict[str, Any] = curriculum.focuses
        self.focus_aliases: Dict[str, str] = curriculum.focus_aliases
        self.soft_prereqs: List[Any] = curriculum.soft_prereqs
        self.split_variant_module_keys: set = curriculum.split_variant_module_keys

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

        # FWTS accepts both free-choice and transferable-skills tagging.
        # Keep explicit transferable_skills assignments, and also treat
        # legacy FWTS payload categories (e.g. "elective") as transferable
        # so existing plans are counted correctly for the TS minimum.
        if kind == "fwts":
            if incoming in ("free", "transferable_skills"):
                return incoming
            return "transferable_skills"

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

    def _steop_mandatory_tag(self, course: dict[str, Any]) -> Optional[str]:
        """Which of the three compulsory StEOP courses this is, recognised by its own code or title.

        Deliberately not resolved through the module mapping: the StEOP names
        individual courses, not whole modules.
        """
        k = self._norm(self._course_code(course))
        if k in (self._norm("Einführung in die Programmierung 1"), self._norm("EIDI1"), self._norm("EIDI1-VU")):
            return "eidi1"
        if k in (self._norm("Mathematisches Arbeiten"), self._norm("Mathematisches Arbeiten für Informatik und Wirtschaftsinformatik 1"), self._norm("MA"), self._norm("MA-VU")):
            return "ma"
        if k in (self._norm("Orientierung Informatik und Wirtschaftsinformatik"), self._norm("OIW"), self._norm("ORI-VU")):
            return "ori"
        return None

    def _is_steop_pool_item(self, course: dict[str, Any]) -> bool:
        code_k = self._norm(self._course_code(course))
        mod_k = self._norm(self._infer_module_title(course))
        return (code_k in self.steop_pool_keys) or (mod_k in self.steop_pool_keys)

    def _is_steop_any_item(self, course: dict[str, Any]) -> bool:
        if self._steop_mandatory_tag(course) is not None:
            return True
        return self._is_steop_pool_item(course)

    def _is_fwts_like(self, canonical_cat: str, module_title: str) -> bool:
        if canonical_cat in ("free", "transferable_skills"):
            return True
        return self._norm(module_title) == self._norm("Freie Wahlfächer und Transferable Skills")

    def _variant_part_for_course(self, course: dict[str, Any]) -> Optional[str]:
        code_key = self._norm(self._course_code(course))
        name_key = self._norm(course.get("name") or course.get("title") or "")
        merged = f"{code_key} {name_key}".strip()
        if " vu " in f" {merged} " or code_key.endswith(" vu") or "-vu" in code_key:
            return "vu"
        if " vo " in f" {merged} " or code_key.endswith(" vo") or "-vo" in code_key:
            return "vo"
        if " ue " in f" {merged} " or code_key.endswith(" ue") or "-ue" in code_key:
            return "ue"
        return None

    def _steop_snapshot(self, courses: List[Tuple[dict[str, Any], str]]) -> Dict[str, Any]:
        """How far the given courses take the student through the StEOP."""
        tags: Set[str] = set()
        pool_ects = 0.0

        for c, _status in courses:
            tag = self._steop_mandatory_tag(c)
            if tag:
                tags.add(tag)
            if self._is_steop_pool_item(c):
                pool_ects += self._to_float(c.get("ects"))

        mandatory_ok = set(self.steop_mandatory_tags).issubset(tags)
        pool_ok = pool_ects >= self.STEOP_POOL_MIN_ECTS - 1e-6

        return {
            "mandatoryPresent": sorted(list(tags)),
            "poolEcts": round(pool_ects, 2),
            "mandatoryOk": mandatory_ok,
            "poolOk": pool_ok,
            "isComplete": bool(mandatory_ok and pool_ok),
        }

    def _required_ects_for_module(self, module_key: str) -> Optional[float]:
        """How many ECTS a module needs before it counts as complete."""
        m = self.modules.get(module_key)
        if not m:
            return None
        return float(m["min_ects"] if m["min_ects"] is not None else m["ects"])

    def _module_is_complete(self, mod_all: Dict[str, float], module_key: str) -> bool:
        """Has the plan booked enough ECTS on this module?"""
        req = self._required_ects_for_module(module_key)
        if req is None:
            return False
        return mod_all.get(module_key, 0.0) >= req - 1e-6

    def _title_is_complete(self, mod_all: Dict[str, float], title: str) -> bool:
        """Same question as _module_is_complete, but asked by module title."""
        return self._module_is_complete(mod_all, self._norm(title))

    def _collect_plan_totals(
        self,
        items: List[Tuple[dict[str, Any], str]],
        warnings: List[str],
        errors: List[str],
    ) -> _PlanTotals:
        """Sum the plan up per lane, module, category and exam subject in one pass.

        A course that fails validation is reported and then skipped, so a broken
        entry never contributes ECTS to any of the totals.
        """
        totals = _PlanTotals()

        for course, status in items:
            code = self._course_code(course)
            if not code:
                errors.append("rejected: a course is missing 'code'")
                continue

            code_key = self._norm(code)
            if code_key in totals.seen:
                errors.append(f"rejected: duplicate course '{code}' (already present as '{totals.seen[code_key]}').")
            else:
                totals.seen[code_key] = code

            try:
                ects = self._to_float(course.get("ects"))
            except Exception:
                errors.append(f"rejected: invalid ects for '{code}'")
                continue

            if ects <= 0 or ects > 60:
                errors.append(f"rejected: implausible ects={ects} for '{code}'")
                continue

            totals.validated.append((course, status))

            li = self._lane_index_of(course, fallback=0)
            totals.lane_ects[li] = totals.lane_ects.get(li, 0.0) + ects

            module_title = self._infer_module_title(course)
            module_key = self._norm(module_title)
            totals.per_course_module_title[code_key] = module_title
            if module_key in self.split_variant_module_keys:
                part = self._variant_part_for_course(course)
                if part:
                    if module_key not in totals.split_module_parts:
                        totals.split_module_parts[module_key] = set()
                    totals.split_module_parts[module_key].add(part)

            canonical_cat = self._canonical_category(course, module_title, warnings)
            totals.per_course_canonical_cat[code_key] = canonical_cat
            totals.cat_ects[canonical_cat] = totals.cat_ects.get(canonical_cat, 0.0) + ects

            raw_subj = course.get("examSubject") or ""
            subj = self._canonical_exam_subject(raw_subj)
            subj_key = self._norm(subj) or "(none)"
            totals.subj_ects[subj_key] = totals.subj_ects.get(subj_key, 0.0) + ects

            if status == "done":
                totals.mod_done[module_key] = totals.mod_done.get(module_key, 0.0) + ects
            else:
                totals.mod_planned[module_key] = totals.mod_planned.get(module_key, 0.0) + ects
            totals.mod_all[module_key] = totals.mod_all.get(module_key, 0.0) + ects

            if code_key not in totals.earliest_lane_for_course or li < totals.earliest_lane_for_course[code_key]:
                totals.earliest_lane_for_course[code_key] = li
            if module_key not in totals.earliest_lane_for_module or li < totals.earliest_lane_for_module[module_key]:
                totals.earliest_lane_for_module[module_key] = li

        return totals

    def _check_semester_load(
        self,
        totals: _PlanTotals,
        max_ects_per_semester: float,
        recommended_ects_per_semester: float,
        warnings: List[str],
        errors: List[str],
        missing: List[str],
    ) -> None:
        """Is any semester too full? Above the recommendation we warn, above the maximum we reject.

        Skipped once the plan already has errors, because the totals of a plan we
        could not fully parse would produce misleading load figures.
        """
        if errors:
            return

        for li, s in totals.lane_ects.items():
            if s > recommended_ects_per_semester + 1e-6:
                warnings.append(
                    f"Semester {li + 1} is heavy: {s:.1f} ECTS planned/done (recommended ~{recommended_ects_per_semester:.1f})."
                )
            if s > max_ects_per_semester + 1e-6:
                missing.append(
                    f"Semester load limit exceeded in semester {li + 1}: {s:.1f}/{max_ects_per_semester:.1f} ECTS. "
                    f"Reduce by {max(0.0, s - max_ects_per_semester):.1f} ECTS."
                )
                errors.append(f"rejected: semester {li+1} exceeds max load ({s:.1f} ECTS > {max_ects_per_semester:.1f}).")

    def _check_variant_mixing(self, totals: _PlanTotals, errors: List[str]) -> None:
        """Some modules are offered either as one VU or as a VO plus a UE, and the two forms cannot be combined."""
        for module_key, parts in totals.split_module_parts.items():
            if "vu" in parts and ("vo" in parts or "ue" in parts):
                module_title = self.modules.get(module_key, {}).get("title") or module_key
                errors.append(
                    f"rejected: {module_title} mixes variants. Use either VU or VO+UE, not both."
                )

    def _steop_missing(self, steop_plan: Dict[str, Any]) -> List[str]:
        """Which parts of the StEOP the plan still does not cover, mandatory LVs first, then the pool gap."""
        if steop_plan["isComplete"]:
            return []

        missing: List[str] = []
        present = set(steop_plan["mandatoryPresent"])

        for tag in self.steop_mandatory_tags:
            if tag not in present:
                missing.append(self._STEOP_MANDATORY_MISSING[tag])

        # The pool is a free choice, so we can only name the gap and the menu.
        pool_missing = max(0.0, self.STEOP_POOL_MIN_ECTS - float(steop_plan["poolEcts"]))
        if pool_missing > 1e-6:
            missing.append(
                f"StEOP Pool: {pool_missing:.1f} ECTS fehlen (mind. {self.STEOP_POOL_MIN_ECTS:.0f} ECTS aus: Algebra & Diskrete Mathematik, Analysis, Denkweisen der Informatik, Grundzüge digitaler Systeme)."
            )

        return missing

    @staticmethod
    def _group_by_lane(items: List[Tuple[dict[str, Any], str]]) -> Dict[int, List[dict[str, Any]]]:
        by_lane: Dict[int, List[dict[str, Any]]] = {}
        for c, _ in items:
            li = RuleChecker._lane_index_of(c, 0)
            by_lane.setdefault(li, []).append(c)
        return by_lane

    def _steop_completion_lane(self, items_done: List[Tuple[dict[str, Any], str]]) -> Optional[int]:
        """In which semester the completed courses first satisfy the StEOP, or None if they never do."""
        if not items_done:
            return None

        by_lane_done = self._group_by_lane(items_done)
        tags: Set[str] = set()
        pool_ects = 0.0
        for li in sorted(by_lane_done.keys()):
            for c in by_lane_done[li]:
                tag = self._steop_mandatory_tag(c)
                if tag:
                    tags.add(tag)
                if self._is_steop_pool_item(c):
                    pool_ects += self._to_float(c.get("ects"))

            if set(self.steop_mandatory_tags).issubset(tags) and pool_ects >= self.STEOP_POOL_MIN_ECTS - 1e-6:
                return li

        return None

    def _check_pre_steop_courses(
        self,
        items_done: List[Tuple[dict[str, Any], str]],
        steop_complete_lane_done: Optional[int],
        warnings: List[str],
        errors: List[str],
    ) -> float:
        """Until the StEOP is passed, only so many ECTS outside it may be completed, and only from a permitted list.

        Returns the non-StEOP ECTS completed before that point, which the dashboard also reports.
        """
        non_steop_ects_before = 0.0
        illegal_non_steop: List[str] = []

        if items_done:
            by_lane_done = self._group_by_lane(items_done)

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

                    # The incoming category may disagree with the curriculum, so judge on the canonical one.
                    canonical_cat = self._canonical_category(c, module_title, warnings)

                    if (code_k not in self.allowed_before_steop_extra) and (not self._is_fwts_like(canonical_cat, module_title)):
                        illegal_non_steop.append(f"{self._course_code(c)} (Semester {li+1})")

        if non_steop_ects_before > self.MAX_NON_STEOP_ECTS_BEFORE_STEOP + 1e-6:
            errors.append(
                f"rejected: before completing StEOP, {non_steop_ects_before:.1f} ECTS outside StEOP are DONE "
                f"(max {self.MAX_NON_STEOP_ECTS_BEFORE_STEOP:.0f})."
            )
        if illegal_non_steop:
            errors.append(
                "rejected: before completing StEOP you marked DONE courses that are not allowed: "
                + ", ".join(illegal_non_steop)
            )

        return non_steop_ects_before

    def _check_thesis_gating(
        self,
        items_done: List[Tuple[dict[str, Any], str]],
        steop_complete_lane_done: Optional[int],
        errors: List[str],
    ) -> None:
        """The Bachelorarbeit may not be finished before the StEOP is. Merely planning it early is fine."""
        thesis_done_lane: Optional[int] = None
        for c, _ in items_done:
            mod_title = self._infer_module_title(c)
            if self._norm(mod_title) == self._norm("Bachelorarbeit") or self._norm(self._course_code(c)) in (self._norm("BA"), self._norm("WA"), self._norm("BA-PR"), self._norm("WISS-SE")):
                li = self._lane_index_of(c, 0)
                thesis_done_lane = li if thesis_done_lane is None else min(thesis_done_lane, li)

        if thesis_done_lane is not None:
            if steop_complete_lane_done is None:
                errors.append("rejected: Bachelorarbeit is DONE, but StEOP is not completed (DONE) yet.")
            elif thesis_done_lane < steop_complete_lane_done:
                errors.append("rejected: Bachelorarbeit is DONE before StEOP completion.")

    def _recommended_sequencing_warnings(self, totals: _PlanTotals) -> List[str]:
        """Where the plan puts a course before the one usually taken first. Advisory only, never a rejection."""
        warnings: List[str] = []

        for prereq, target in self.soft_prereqs:
            prereq_k = self._norm(prereq)
            target_k = self._norm(target)

            prereq_lane = totals.earliest_lane_for_course.get(prereq_k)
            if prereq_lane is None:
                prereq_lane = totals.earliest_lane_for_module.get(prereq_k)

            target_lane = totals.earliest_lane_for_course.get(target_k)
            if target_lane is None:
                target_lane = totals.earliest_lane_for_module.get(target_k)

            if prereq_lane is not None and target_lane is not None and target_lane < prereq_lane:
                warnings.append(
                    f"Reihenfolge-Hinweis: '{target}' ist vor '{prereq}' geplant. Das ist erlaubt, aber normalerweise wird '{prereq}' davor empfohlen."
                )

        return warnings

    def _apply_transferable_skills_cap(
        self,
        items: List[Tuple[dict[str, Any], str]],
        totals: _PlanTotals,
        warnings: List[str],
    ) -> float:
        """Trim the Transferable Skills that exceed the creditable maximum and return the ECTS that still count.

        Anything above the cap stays in the plan but earns nothing, so it is removed
        from the category, from the FWTS module and from the overall total.
        """
        ts_ects = totals.cat_ects.get("transferable_skills", 0.0)
        ts_done = sum(self._to_float(c.get("ects")) for c, status in items if status == "done" and totals.per_course_canonical_cat.get(self._norm(self._course_code(c))) == "transferable_skills")
        excess_ts = max(0.0, ts_ects - self.TRANSFERABLE_SKILLS_MAX_ECTS)

        if "transferable_skills" in totals.cat_ects:
            totals.cat_ects["transferable_skills"] = min(self.TRANSFERABLE_SKILLS_MAX_ECTS, ts_ects)

        fwts_key = self._norm("Freie Wahlfächer und Transferable Skills")
        if fwts_key in totals.mod_all:
            totals.mod_all[fwts_key] = max(0.0, totals.mod_all[fwts_key] - excess_ts)

        # Completed courses fill the cap first, so only what is left over is taken off the planned side.
        done_excess = max(0.0, ts_done - self.TRANSFERABLE_SKILLS_MAX_ECTS)
        planned_excess = excess_ts - done_excess

        if fwts_key in totals.mod_done:
            totals.mod_done[fwts_key] = max(0.0, totals.mod_done[fwts_key] - done_excess)
        if fwts_key in totals.mod_planned:
            totals.mod_planned[fwts_key] = max(0.0, totals.mod_planned[fwts_key] - planned_excess)

        total_ects = sum(self._to_float(c.get("ects")) for c, _ in items) - excess_ts

        if ts_ects > self.TRANSFERABLE_SKILLS_MAX_ECTS + 1e-6:
            warnings.append(
                f"Transferable Skills: maximal {self.TRANSFERABLE_SKILLS_MAX_ECTS:.1f} ECTS anrechenbar "
                f"(aktuell {ts_ects:.1f} ECTS geplant/done, {excess_ts:.1f} ECTS werden nicht angerechnet)."
            )

        return total_ects

    def _collect_missing_requirements(
        self,
        totals: _PlanTotals,
        total_ects: float,
        missing: List[str],
    ) -> Tuple[List[str], List[str]]:
        """What the degree still requires: compulsory modules, thesis, narrow electives, Transferable Skills and the total.

        Also returns the completed and the available narrow elective modules, which the dashboard reports.
        """
        for mk, m in self.modules.items():
            if m["kind"] == "mandatory":
                req = self._required_ects_for_module(mk) or 0.0
                have = totals.mod_all.get(mk, 0.0)
                if have + 1e-6 < req:
                    missing.append(f"Pflichtmodul fehlt: {m['title']} ({req - have:.1f} ECTS)")

        thesis_key = self._norm("Bachelorarbeit")
        thesis_have = totals.mod_all.get(thesis_key, 0.0)
        if thesis_have + 1e-6 < self.BACHELORARBEIT_ECTS:
            missing.append(f"Bachelorarbeit fehlt: {self.BACHELORARBEIT_ECTS - thesis_have:.1f} ECTS")

        narrow_completed: List[str] = []
        narrow_all: List[str] = []
        for mk, m in self.modules.items():
            if m["kind"] == "narrow_elective":
                narrow_all.append(m["title"])
                if self._module_is_complete(totals.mod_all, mk):
                    narrow_completed.append(m["title"])

        if len(narrow_completed) < self.MIN_NARROW_ELECTIVE_MODULES:
            missing.append(
                f"Wahlmodule der engen Wahl (+): mindestens {self.MIN_NARROW_ELECTIVE_MODULES} Module nötig, aktuell {len(narrow_completed)}."
            )

        ts_ects = totals.cat_ects.get("transferable_skills", 0.0)
        if ts_ects + 1e-6 < self.TRANSFERABLE_SKILLS_MIN_ECTS:
            missing.append(f"Transferable Skills: mindestens {self.TRANSFERABLE_SKILLS_MIN_ECTS:.1f} ECTS nötig (aktuell {ts_ects:.1f}).")

        if total_ects + 1e-6 < self.TOTAL_ECTS:
            missing.append(f"Gesamtumfang: {self.TOTAL_ECTS - total_ects:.1f} ECTS fehlen bis {self.TOTAL_ECTS:.0f}.")

        return narrow_completed, narrow_all

    def _resolve_focus_key(self, payload: dict[str, Any]) -> str:
        """Which Vertiefung the payload selected, as a curriculum key. Empty when none was chosen."""
        focus_raw = payload.get("selectedFocus") or payload.get("vertiefung")
        focus_key_in = self._norm(focus_raw) if focus_raw else ""
        return self.focus_aliases.get(focus_key_in, focus_key_in)

    def _build_focus_progress(
        self,
        payload: dict[str, Any],
        focus_key: str,
        totals: _PlanTotals,
        warnings: List[str],
    ) -> Tuple[Dict[str, Any], List[str]]:
        """How far the plan has come towards the selected Vertiefung, as a checklist plus its open items.

        A Vertiefung asks for some modules outright and for a number of modules out
        of one or more lists, so the checklist mixes both kinds of entry.
        """
        focus_raw = payload.get("selectedFocus") or payload.get("vertiefung")
        focus_stats: Dict[str, Any] = {"selected": focus_raw, "recognized": False}
        focus_missing: List[str] = []

        if not focus_key:
            return focus_stats, focus_missing

        f = self.focuses.get(focus_key)
        if not f:
            warnings.append(f"Vertiefung-Hinweis: selectedFocus '{focus_raw}' ist unbekannt (nicht in der curricularen Liste/Aliases).")
            return focus_stats, focus_missing

        focus_stats["recognized"] = True
        focus_stats["canonicalName"] = self.modules.get(focus_key, {}).get("title") or None

        completed_modules: Set[str] = set()
        for mk, m in self.modules.items():
            if self._module_is_complete(totals.mod_all, mk):
                completed_modules.add(self._norm(m["title"]))

        def count_completed(from_list: List[str]) -> int:
            return sum(1 for t in from_list if self._norm(t) in completed_modules)

        focus_checklist: List[Dict[str, Any]] = []

        req_list = f.get("required", [])
        for t in req_list:
            done = self._norm(t) in completed_modules
            focus_checklist.append({
                "label": t,
                "done": done,
                "kind": "required",
            })
            if self._norm(t) not in completed_modules:
                focus_missing.append(f"Vertiefung: Pflichtmodul fehlt: {t}")

        if "choose" in f:
            choose = f["choose"]
            choose_from = choose.get("from", [])
            for t in choose_from:
                done = self._norm(t) in completed_modules
                focus_checklist.append({
                    "label": t,
                    "done": done,
                    "kind": "choose",
                })
            got = count_completed(choose["from"])
            need = int(choose["min"])
            if got < need:
                focus_missing.append(f"Vertiefung: es fehlen {need - got} weitere Module aus der Vertiefungsliste.")
            focus_stats["choose"] = {
                "min": need,
                "done": got,
                "total": len(choose_from),
            }

        if "choose_groups" in f:
            choose_groups_stats: List[Dict[str, Any]] = []
            for grp in f["choose_groups"]:
                grp_from = grp.get("from", [])
                group_label = ", ".join(grp_from)
                for t in grp_from:
                    done = self._norm(t) in completed_modules
                    focus_checklist.append({
                        "label": t,
                        "done": done,
                        "kind": "choose_group",
                        "group": group_label,
                    })
                got = count_completed(grp["from"])
                need = int(grp["min"])
                if got < need:
                    focus_missing.append(f"Vertiefung: es fehlen {need - got} Module aus der Gruppe: {', '.join(grp['from'])}")
                choose_groups_stats.append({
                    "label": group_label,
                    "min": need,
                    "done": got,
                    "total": len(grp_from),
                })
            focus_stats["chooseGroups"] = choose_groups_stats

        focus_stats["missingCount"] = len(focus_missing)
        focus_stats["missing"] = focus_missing[:]
        focus_stats["checklist"] = focus_checklist
        focus_stats["checklistDoneCount"] = sum(1 for item in focus_checklist if item.get("done"))
        focus_stats["checklistTotalCount"] = len(focus_checklist)

        return focus_stats, focus_missing

    def _focus_missing_requirements(
        self,
        payload: dict[str, Any],
        focus_key: str,
        totals: _PlanTotals,
    ) -> List[str]:
        """The same open Vertiefung items again, phrased for the missing-requirements list.

        These lines name the Vertiefung and spell out the modules still on offer,
        which the compact checklist wording does not.
        """
        f = self.focuses.get(focus_key)
        if not f:
            return []

        focus_name = (payload.get("selectedFocus") or payload.get("vertiefung") or "").strip() or "Vertiefung"
        lines: List[str] = []

        def remaining_list(from_list: List[str]) -> List[str]:
            return [t for t in from_list if not self._title_is_complete(totals.mod_all, t)]

        for t in f.get("required", []):
            if not self._title_is_complete(totals.mod_all, t):
                lines.append(f"Vertiefung ({focus_name}): Pflichtmodul fehlt: {t}")

        if "choose" in f:
            choose = f["choose"]
            need = int(choose["min"])
            rem = remaining_list(choose["from"])
            got = len(choose["from"]) - len(rem)
            if got < need:
                lines.append(
                    f"Vertiefung ({focus_name}): es fehlen {need - got} Module aus: {', '.join(rem)}"
                )

        for grp in f.get("choose_groups", []):
            need = int(grp["min"])
            rem = remaining_list(grp["from"])
            got = len(grp["from"]) - len(rem)
            if got < need:
                lines.append(
                    f"Vertiefung ({focus_name}): es fehlen {need - got} Module aus: {', '.join(rem)}"
                )

        return lines

    def _build_steop_stats(
        self,
        steop_done: Dict[str, Any],
        steop_plan: Dict[str, Any],
        steop_complete_lane_done: Optional[int],
        non_steop_ects_before: float,
    ) -> Dict[str, Any]:
        """The StEOP section of the dashboard: what is actually passed, and what the plan will amount to."""
        return {
            "done": {
                "completeLaneIndex": steop_complete_lane_done,
                **steop_done,
                "nonSteopEctsBeforeCompletion": round(non_steop_ects_before, 2),
                "maxNonSteopBeforeCompletion": self.MAX_NON_STEOP_ECTS_BEFORE_STEOP,
            },
            "planned": steop_plan,
        }

    def _build_dashboard(
        self,
        totals: _PlanTotals,
        total_ects: float,
        max_ects_per_semester: float,
        recommended_ects_per_semester: float,
        narrow_completed: List[str],
        narrow_all: List[str],
        steop_stats: Dict[str, Any],
        focus_stats: Dict[str, Any],
        warnings: List[str],
        errors: List[str],
    ) -> Dict[str, Any]:
        """Everything the front end shows about the plan, gathered into one dictionary."""
        subj_pretty: Dict[str, float] = {}
        for k, v in totals.subj_ects.items():
            subj_pretty[k.title() if k not in ("(none)",) else k] = round(v, 2)

        module_progress: List[Dict[str, Any]] = []
        for mk, m in sorted(self.modules.items(), key=lambda kv: kv[1]["title"]):
            req = self._required_ects_for_module(mk)
            have = totals.mod_all.get(mk, 0.0)
            module_progress.append({
                "title": m["title"],
                "kind": m["kind"],
                "requiredEcts": req,
                "haveEcts": round(have, 2),
                "complete": (req is not None and have >= req - 1e-6),
            })

        return {
            "programCode": self.program_code,
            "totalEcts": round(total_ects, 2),
            "ectsMissingTo180": round(max(0.0, self.TOTAL_ECTS - total_ects), 2),
            "ectsPerSemester": {str(k): round(v, 2) for k, v in sorted(totals.lane_ects.items())},
            "recommendedEctsPerSemester": recommended_ects_per_semester,
            "maxEctsPerSemester": max_ects_per_semester,
            "ectsByCategory": {k: round(v, 2) for k, v in sorted(totals.cat_ects.items())},
            "ectsByExamSubject": subj_pretty,
            "narrowElectives": {
                "requiredCount": self.MIN_NARROW_ELECTIVE_MODULES,
                "completedCount": len(narrow_completed),
                "completed": narrow_completed,
                "allOptionsCount": len(narrow_all),
            },
            "steop": steop_stats,
            "focus": focus_stats,
            "moduleProgress": module_progress,
            "warnings": warnings,
            "errors": errors,
        }

    @staticmethod
    def _rejection_message(payload: dict[str, Any], errors: List[str]) -> str:
        """The first error, named after the edit that triggered it so the user knows what to undo."""
        change = payload.get("change") or {}
        ccode = change.get("courseCode")
        ctype = change.get("type")
        if ccode:
            return f"rejected: cannot apply change ({ctype}) for '{ccode}': {errors[0].replace('rejected: ', '')}"
        return errors[0]

    def _wrong_program_result(self, payload: dict[str, Any]) -> Optional[RuleCheckResult]:
        """Refuse a payload from another degree programme, since none of our rules would apply to it."""
        program = str(payload.get("programCode") or "").strip()
        if program and program != self.program_code:
            return RuleCheckResult(
                ok=False,
                message=f"rejected: RuleChecker is for program {self.program_code}, but payload has {program}",
                stats={"programCode": program, "expectedProgramCode": self.program_code},
                missing=[],
            )
        return None

    def evaluate(self, payload: dict[str, Any]) -> RuleCheckResult:
        wrong_program = self._wrong_program_result(payload)
        if wrong_program is not None:
            return wrong_program

        max_ects_per_semester, recommended_ects_per_semester = self._resolve_semester_load_limits(payload)
        warnings: List[str] = []
        errors: List[str] = []
        missing: List[str] = []

        items = self._extract_courses(payload)
        if not items:
            # Continue with empty items so dashboard sections (StEOP, narrow electives, etc.)
            # are still fully populated on initial load.
            warnings.append("No courses in plan.")

        totals = self._collect_plan_totals(items, warnings, errors)

        self._check_semester_load(
            totals,
            max_ects_per_semester,
            recommended_ects_per_semester,
            warnings,
            errors,
            missing,
        )
        self._check_variant_mixing(totals, errors)

        # The done-only snapshot gates later courses; done+planned drives the UI progress.
        counted = totals.validated
        items_done = [(c, s) for (c, s) in counted if s == "done"]
        steop_done = self._steop_snapshot(items_done)
        steop_plan = self._steop_snapshot(counted)

        missing.extend(self._steop_missing(steop_plan))

        steop_complete_lane_done = self._steop_completion_lane(items_done)

        non_steop_ects_before = self._check_pre_steop_courses(items_done, steop_complete_lane_done, warnings, errors)
        self._check_thesis_gating(items_done, steop_complete_lane_done, errors)

        warnings.extend(self._recommended_sequencing_warnings(totals))

        total_ects = self._apply_transferable_skills_cap(counted, totals, warnings)

        narrow_completed, narrow_all = self._collect_missing_requirements(totals, total_ects, missing)

        focus_key = self._resolve_focus_key(payload)
        focus_stats, focus_missing = self._build_focus_progress(payload, focus_key, totals, warnings)

        if payload.get("validateFocusAsStrict") and focus_stats.get("recognized") and focus_missing:
            errors.append("rejected: selected focus requirements are not satisfied (strict focus validation enabled).")

        if focus_stats.get("recognized"):
            missing.extend(self._focus_missing_requirements(payload, focus_key, totals))

        stats = self._build_dashboard(
            totals,
            total_ects,
            max_ects_per_semester,
            recommended_ects_per_semester,
            narrow_completed,
            narrow_all,
            self._build_steop_stats(steop_done, steop_plan, steop_complete_lane_done, non_steop_ects_before),
            focus_stats,
            warnings,
            errors,
        )

        if errors:
            return RuleCheckResult(
                ok=False,
                message=self._rejection_message(payload, errors),
                stats=stats,
                missing=missing,
                errors=errors,
            )

        return RuleCheckResult(ok=True, message="accepted", stats=stats, missing=missing, errors=[])
