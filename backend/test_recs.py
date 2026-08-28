import asyncio
import os
import sys

# Setup environment to find 'app'
sys.path.append(os.path.abspath('backend'))

from app.db import get_pool
from app.services.recommender import Recommender

async def main():
    try:
        pool = await get_pool()
        async with pool.acquire() as conn:
            profiles = await conn.fetch("SELECT * FROM user_program_profile")
            print("--- Profiles in DB ---")
            for p in profiles:
                print(f"User: {p['user_id']}, Program: {p['program_code']}, Interests: {p['interests']}, Career: {p['career_direction']}, Toggles: {p['recommendation_toggles']}")
            print("----------------------\n")
            
            # Test the view for Bachelor and Master
            programs = ["066 937", "033 521"]
            for prog in programs:
                # Fetch all candidates directly from DB
                all_candidates_rows = await conn.fetch(
                    """
                    SELECT DISTINCT 
                        c.id, c.code, c.title, c.type, c.ects, c.language, c.term_availability, 
                        c.attributes->'skills' as skills, 
                        c.attributes->>'description' as description,
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
                    prog
                )
                candidates = [dict(r) for r in all_candidates_rows]
                
                print(f"Program {prog} has {len(candidates)} candidates in pool.")
                
                # Check for mock courses:
                mock_codes = {"188.995", "188.923", "193.052", "193.111", "184.735", "183.131", "184.739"}
                found_mocks = [c["code"] for c in candidates if c["code"] in mock_codes]
                print(f"Found mock courses in {prog}: {found_mocks}")
                
                # Test recommender for this program
                for i in range(len(profiles)):
                    p = profiles[i]
                    if p["program_code"] == prog:
                        interests = p["interests"] or []
                        career = p["career_direction"] or ""
                        toggles = p["recommendation_toggles"] or {}
                        
                        from app.rules import BachelorRuleChecker, MasterRuleChecker
                        
                        checker = MasterRuleChecker() if prog == "066 937" else BachelorRuleChecker()
                        rec = Recommender(interests, career, toggles, rule_checker=checker, program_code=prog)
                        res = rec.evaluate([], [], candidates)
                        print(f"Recommendations for user {p['user_id']} ({len(res)} found):")
                        for r in res:
                            print(f"  - [{r['type']}] {r['courseCode']}: {r['courseName']} (Score: {r['score']})")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(main())
