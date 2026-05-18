from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from ..deps import require_current_user
from ..db import get_pool
from ..services.recommender import Recommender
from ..services.rule_checker_master import RuleChecker as MasterRuleChecker
from ..services.rule_checker_bachelor import RuleChecker as BachelorRuleChecker

router = APIRouter()

class RecommendationsPayload(BaseModel):
    programCode: str = Field(...)
    plannedCourses: list[dict[str, Any]] = Field(default_factory=list)
    doneCourses: list[dict[str, Any]] = Field(default_factory=list)
    parkedCourses: list[str] = Field(default_factory=list)
    # the frontend has the full catalog in memory, we can just pass all course codes down
    # or the backend can fetch them. To keep it simple, we use the catalog view.

@router.post("/recommendations")
async def get_recommendations(payload: RecommendationsPayload, user=Depends(require_current_user)):
    program_code = (payload.programCode or "").strip().replace(" ", "")
    
    # 1. Fetch user profile (interests, career_direction, toggles)
    pool = await get_pool()
    async with pool.acquire() as conn:
        profile_row = await conn.fetchrow(
            """
            SELECT interests, career_direction, recommendation_toggles
            FROM user_program_profile
            WHERE user_id = $1 AND program_code = $2
            """,
            user["sub"],
            payload.programCode
        )
        
        # 2. Fetch all unique courses for this program directly as candidates
        # This replaces the giant catalog view flattening to avoid JSONB size limits
        candidates_rows = await conn.fetch(
            """
            SELECT DISTINCT 
                c.id, c.code, c.title, c.type, c.ects, c.language, c.term_availability, 
                c.attributes->'content' as content,
                c.attributes->'similar_courses' as similar_courses,
                m.category,
                es.name as exam_subject
            FROM course c
            JOIN module_course mc ON mc.course_id = c.id
            JOIN module m ON m.id = mc.module_id
            JOIN study_program sp ON sp.id = m.program_id
            LEFT JOIN module_grouping mg ON mg.module_id = m.id
            LEFT JOIN exam_subject es ON es.id = mg.exam_subject_id
            WHERE sp.code = $1
            """,
            payload.programCode
        )
        all_candidates = [dict(r) for r in candidates_rows]

    interests = []
    career_direction = ""
    toggles = {"interest": True, "similarity": True, "sequence": True, "completed": True, "internship": True, "peer": True}
    
    if profile_row:
        interests = profile_row["interests"] or []
        career_direction = profile_row["career_direction"] or ""
        toggles = profile_row["recommendation_toggles"] if profile_row["recommendation_toggles"] is not None else toggles

    # 3. Instantiate Checker & Recommender
    def select_checker(p_code: str):
        normalized = p_code.strip().replace(" ", "")
        if normalized == "066937": return MasterRuleChecker()
        if normalized == "033521": return BachelorRuleChecker()
        return MasterRuleChecker()

    rule_checker = select_checker(payload.programCode)
    recommender = Recommender(interests, career_direction, toggles, rule_checker=rule_checker, program_code=payload.programCode)
    
    print(f"DEBUG RECS: program={payload.programCode}, interests={len(interests)}, candidates={len(all_candidates)}")
    
    # 4. Evaluate recommendations
    recommendations = recommender.evaluate(payload.plannedCourses, payload.doneCourses, all_candidates, payload.parkedCourses)

    print(f"DEBUG RECS: generated {len(recommendations)} recommendations after rule-filtering")

    return {"ok": True, "recommendations": recommendations}
