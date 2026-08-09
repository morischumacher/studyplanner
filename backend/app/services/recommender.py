from typing import List, Dict, Any, Set
import hashlib
import json
import random
import re

# Mock Knowledge Graph for the Thesis Prototype
# In a real system, these would be queried from the database or an external graph service.
MOCK_COURSE_TAGS = {
    # Some master level computer science courses
    "188.995": {"software engineering", "architecture", "web"},
    "188.923": {"web", "frontend", "react"},
    "193.052": {"machine learning", "data science", "ai"},
    "193.111": {"ai", "neural networks", "deep learning"},
    "184.735": {"security", "cryptography", "systems"},
    "183.131": {"data science", "statistics", "data engineering"},
    "184.739": {"security", "web security", "testing"},
}

MOCK_SEQUENCES = {
    # If key is planned/done, recommend values
    "188.995": ["188.923"],
    "193.052": ["193.111"],
    "184.735": ["184.739"],
}

MOCK_DEPENDENCIES = {
    # Hard prerequisite: to take key, recommend taking values first
    "193.111": ["193.052"],
    "184.739": ["184.735"],
}

MOCK_CO_OCCURRENCES = {
    "188.995": {"188.923": 73, "184.735": 45},
    "193.052": {"183.131": 82, "193.111": 65},
}

MOCK_PRIOR_USERS = {}

def get_mock_prior_users(program_code: str, all_candidate_codes: List[Dict[str, Any]]) -> List[Set[str]]:
    if not program_code:
        return []
    if program_code not in MOCK_PRIOR_USERS:
        codes = list({c["code"] for c in all_candidate_codes if c.get("code")})
        if not codes:
            MOCK_PRIOR_USERS[program_code] = []
            return []
            
        # Seed the random generator deterministically using the program_code
        # This guarantees the same synthetic users are always generated across server restarts
        seed_int = int(hashlib.md5(program_code.encode('utf-8')).hexdigest(), 16) % 10000000
        prng = random.Random(seed_int)
        
        users = []
        # Create a few clusters of courses (e.g., specific tracks/specializations)
        num_clusters = 5
        clusters = []
        for _ in range(num_clusters):
            cluster_size = min(15, len(codes))
            clusters.append(set(prng.sample(codes, cluster_size)))
            
        for _ in range(50):
            # Select a base track cluster
            base_cluster = prng.choice(clusters)
            # Pick a subset of courses from this track
            user_courses = set(prng.sample(list(base_cluster), prng.randint(5, len(base_cluster))))
            # Add some completely random electives to represent generic coursework
            num_random = prng.randint(5, 15)
            user_courses.update(prng.sample(codes, min(num_random, len(codes))))
            users.append(user_courses)
            
        MOCK_PRIOR_USERS[program_code] = users
    return MOCK_PRIOR_USERS[program_code]


class Recommender:
    def __init__(self, interests: List[str], career_direction: str, toggles: dict, rule_checker: Any = None, program_code: str = None):
        self.interests = set(i.lower().strip() for i in interests if i.strip())
        self.career_direction = (career_direction or "").lower().strip()
        self.rule_checker = rule_checker
        self.program_code = program_code
        
        # Ensure toggles is a dict (asyncpg sometimes returns it as a string if codecs aren't ready)
        if isinstance(toggles, str):
            try:
                self.toggles = json.loads(toggles)
            except Exception:
                self.toggles = {}
        else:
            self.toggles = toggles or {}

    def _jaccard(self, set1: Set[str], set2: Set[str]) -> float:
        if not set1 and not set2:
            return 0.0
        return len(set1.intersection(set2)) / len(set1.union(set2))

    def evaluate(self, planned_courses: List[Dict[str, Any]], done_courses: List[Dict[str, Any]], all_candidate_codes: List[Dict[str, Any]], parked_courses: List[str] = None) -> List[Dict[str, Any]]:
        recommendations = []
        planned_codes = {str(c.get("code")) for c in planned_courses if c.get("code")}
        done_codes = {str(c.get("code")) for c in done_courses if c.get("code")}
        parked_codes = {str(c) for c in (parked_courses or []) if c}
        already_in_plan = planned_codes.union(done_codes).union(parked_codes)
        
        candidates = [c for c in all_candidate_codes if c.get("code") and c["code"] not in already_in_plan]

        if not candidates:
            return []

        def _get_metadata(c_dict: dict) -> dict:
            c_code = c_dict.get("code")
            c_name = c_dict.get("title") or c_dict.get("name") or c_code or ""
            
            # Extract content from the DB dict (JSON array of strings)
            content = c_dict.get("content") or []
            
            if not content and c_code in MOCK_COURSE_TAGS:
                content = list(MOCK_COURSE_TAGS[c_code])
                
            # Content phrases as direct semantic markers
            content_phrases = {str(s).lower().strip() for s in content if str(s).strip()}
            
            # Extract individual keywords from content phrases
            content_keywords = set()
            for phrase in content_phrases:
                words = set(re.findall(r'\b[A-Za-zÄÖÜäöüß]{2,}\b', phrase.lower()))
                content_keywords.update(words)
                
            if not content_keywords:
                # Fallback purely to title words if no content exists
                words = set(re.findall(r'\b\w+\b', c_name.lower()))
                content_keywords = {w for w in words if len(w) > 3}
                
            title_words = set(w.lower() for w in re.findall(r'\b[A-Za-zÄÖÜäöüß]{2,}\b', c_name))
            
            # Combine all keywords for broader matching
            all_keywords = content_keywords.union(title_words)

            return {
                "skills": content_keywords, # Map content_keywords to skills for backward compatibility
                "desc_words": content_keywords, # Map to desc_words for career matching logic
                "raw_desc": (c_name + " " + " ".join(content)).lower(),
                "keywords": all_keywords,
                "similar_courses": c_dict.get("similar_courses") or []
            }

        # Collect user history for similarity
        user_history_courses = []
        for course in all_candidate_codes:
            code = course.get("code")
            if code in already_in_plan:
                title = course.get("title") or course.get("name") or code
                user_history_courses.append({
                    "code": code,
                    "title": title,
                    "meta": _get_metadata(course)
                })

        seen_recs = set()

        def add_rec(code: str, rec_type: str, score: float, evidence: str, course_name: str = "", ects: float = None, category: str = None, exam_subject: str = None, course_type: str = None):
            if code in seen_recs:
                return
            
            # Simple Variant Filtering: If a course with the same base name is already recommended or in plan, skip
            # (e.g., skip "Analysis (UE)" if "Analysis (VO)" is already there)
            base_name = str(course_name).split('(')[0].split(' -')[0].strip().lower()
            if not base_name: 
                base_name = str(code).lower()

            # Check existing recommendations
            for r in recommendations:
                r_base = str(r["courseName"]).split('(')[0].split(' -')[0].strip().lower()
                if not r_base: r_base = str(r["courseCode"]).lower()
                if base_name == r_base:
                    return

            # Check history (planned/done)
            for h_dict in (planned_courses + done_courses):
                h_title = h_dict.get("title") or h_dict.get("name") or h_dict.get("code") or ""
                h_base = str(h_title).split('(')[0].split(' -')[0].strip().lower()
                if base_name == h_base:
                    return

            seen_recs.add(code)
            recommendations.append({
                "id": f"rec_{code}_{rec_type}",
                "courseCode": code,
                "courseName": course_name, 
                "type": rec_type,
                "score": score,
                "evidence": evidence,
                "ects": ects,
                "category": category,
                "examSubject": exam_subject,
                "courseType": course_type
            })

        # Precompute Peer (Other Students) recommendations if active
        peer_scores = {}
        if self.toggles.get("peer", True) and self.program_code:
            prior_users = get_mock_prior_users(self.program_code, all_candidate_codes)
            if prior_users:
                # Calculate the Jaccard similarity or raw overlap with each prior user
                user_matches = []
                for idx, pu_courses in enumerate(prior_users):
                    overlap = len(pu_courses.intersection(already_in_plan))
                    if overlap > 0:
                        user_matches.append((overlap, pu_courses))
                
                if user_matches:
                    # Sort prior users by highest overlap (nearest neighbors)
                    user_matches.sort(key=lambda x: x[0], reverse=True)
                    # Take the top K similar users (e.g. top 10)
                    neighbors = user_matches[:10]
                    total_overlap = sum(w for w, _ in neighbors)
                    
                    # Accumulate weighted recommendations
                    candidate_cf_scores = {}
                    for weight, pu_courses in neighbors:
                        # Recommend courses that prior users took which the current user is missing
                        for p_code in pu_courses:
                            if p_code not in already_in_plan:
                                candidate_cf_scores[p_code] = candidate_cf_scores.get(p_code, 0) + weight
                    
                    # Normalize scores and store them
                    if total_overlap > 0:
                        for p_code, raw_score in candidate_cf_scores.items():
                            norm_score = raw_score / total_overlap
                            peer_scores[p_code] = {
                                "score": 0.4 + (norm_score * 0.5),
                                "percentage": int(norm_score * 100),
                                "is_cold_start": False
                            }
                else:
                    # Cold start fallback: recommend most popular courses overall
                    popularity = {}
                    for pu_courses in prior_users:
                        for p_code in pu_courses:
                            if p_code not in already_in_plan:
                                popularity[p_code] = popularity.get(p_code, 0) + 1
                    if popularity:
                        max_pop = max(popularity.values())
                        for p_code, count in popularity.items():
                            peer_scores[p_code] = {
                                "score": 0.3 + ((count / max_pop) * 0.5),
                                "percentage": int((count / len(prior_users)) * 100),
                                "is_cold_start": True
                            }

        for candidate in candidates:
            code = candidate["code"]
            name = candidate.get("title") or candidate.get("name") or code
            
            meta = _get_metadata(candidate)
            
            # 1. Interest Match
            if self.toggles.get("interest", True) and self.interests:
                # Direct match in skills or phrases
                matched_skills = meta["skills"].intersection(self.interests)
                matched_desc = {i for i in self.interests if i in meta["raw_desc"]}
                
                # Keyword-based match fallback for multi-word interests
                keyword_matches = set()
                for interest in self.interests:
                    interest_words = {w for w in re.findall(r'\b\w+\b', interest) if len(w) > 3}
                    if interest_words:
                        overlap = interest_words.intersection(meta["keywords"])
                        if len(overlap) >= len(interest_words) * 0.5: # 50% of interest words found
                            keyword_matches.add(interest)

                if matched_skills or matched_desc or keyword_matches:
                    all_matches = matched_skills.union(matched_desc).union(keyword_matches)
                    
                    # Weight skills highest
                    score = (len(matched_skills) * 1.5 + len(matched_desc) * 0.8 + len(keyword_matches) * 0.4) / max(1, len(self.interests))
                    score = min(1.0, max(0.4, score))
                    
                    evidence_parts = []
                    if matched_skills: 
                        evidence_parts.append(f"focuses on {', '.join(list(matched_skills)[:3])}")
                    elif matched_desc or keyword_matches:
                        evidence_parts.append(f"covers topics related to {', '.join(list(all_matches)[:2])}")
                    
                    evidence = f"Matches your interests: " + " and ".join(evidence_parts)
                    add_rec(code, "interest", score, evidence, name, 
                            ects=candidate.get("ects"), 
                            category=candidate.get("category"), 
                            exam_subject=candidate.get("exam_subject"), 
                            course_type=candidate.get("type"))

            # 2. Predefined Similarity (Based on provided mappings in DB)
            if self.toggles.get("similarity", True) and user_history_courses:
                # Check if any course the user has taken/planned lists this candidate as similar
                for hc in user_history_courses:
                    predefined_sims = hc["meta"].get("similar_courses") or []
                    
                    for sim_entry in predefined_sims:
                        if sim_entry["code"] == code:
                            # Higher score for explicit expert-curated similarity
                            score = 0.85 
                            evidence = f"similar to {hc['title']} ({sim_entry['evidence']})"
                            add_rec(code, "similarity", score, evidence, name,
                                    ects=candidate.get("ects"), 
                                    category=candidate.get("category"), 
                                    exam_subject=candidate.get("exam_subject"), 
                                    course_type=candidate.get("type"))
                            break # Found a match for this candidate from this history item


            # 3. Dependency / Sequence
            if self.toggles.get("sequence", True):
                # Is this a hard prerequisite for something planned?
                for planned in planned_codes:
                    if planned in MOCK_DEPENDENCIES and code in MOCK_DEPENDENCIES[planned]:
                        add_rec(code, "sequence", 0.9, f"prerequisite of planned course {planned}", name,
                                ects=candidate.get("ects"), 
                                category=candidate.get("category"), 
                                exam_subject=candidate.get("exam_subject"), 
                                course_type=candidate.get("type"))
                
                # Is it a sequence successor of something done?
                for done in done_codes:
                    if done in MOCK_SEQUENCES and code in MOCK_SEQUENCES[done]:
                        add_rec(code, "sequence", 0.8, f"commonly taken after completed course {done}", name,
                                ects=candidate.get("ects"), 
                                category=candidate.get("category"), 
                                exam_subject=candidate.get("exam_subject"), 
                                course_type=candidate.get("type"))

            # 4. Based on completed (Behavioral Co-occurrence)
            if self.toggles.get("completed", True):
                for done in done_codes:
                    if done in MOCK_CO_OCCURRENCES and code in MOCK_CO_OCCURRENCES[done]:
                        freq = MOCK_CO_OCCURRENCES[done][code]
                        add_rec(code, "completed", freq / 100.0, f"{freq}% of students who completed {done} also took this", name,
                                ects=candidate.get("ects"), 
                                category=candidate.get("category"), 
                                exam_subject=candidate.get("exam_subject"), 
                                course_type=candidate.get("type"))

            # 5. Internship Lens (Career Goals)
            if self.toggles.get("internship", True) and self.career_direction:
                # Dynamic career match based on semantic skills & description
                career_words = {w for w in re.findall(r'\b\w+\b', self.career_direction.lower()) if len(w) > 2}
                
                career_skill_overlap = meta["skills"].intersection(career_words)
                career_desc_overlap = meta["desc_words"].intersection(career_words)
                
                if career_skill_overlap or career_desc_overlap:
                    score = min(0.9, (len(career_skill_overlap) * 2 + len(career_desc_overlap)) / max(1, len(career_words)))
                    score = max(0.4, score)
                    
                    evidence_parts = []
                    if career_skill_overlap: evidence_parts.append(f"{', '.join(career_skill_overlap)}")
                    elif career_desc_overlap: evidence_parts.append(f"{', '.join(career_desc_overlap)}")
                    
                    add_rec(code, "internship", score, f"develops skills for {self.career_direction} ({', '.join(evidence_parts)})", name,
                            ects=candidate.get("ects"), 
                            category=candidate.get("category"), 
                            exam_subject=candidate.get("exam_subject"), 
                            course_type=candidate.get("type"))
            
            # 6. Peer / Other Students Collaborative Filtering
            if self.toggles.get("peer", True) and code in peer_scores:
                cf_data = peer_scores[code]
                percentage = cf_data["percentage"]
                if cf_data.get("is_cold_start", False):
                    evidence = f"Popular choice: {percentage}% of prior students took this course."
                else:
                    evidence = f"Recommended by peers: {percentage}% of students with a similar plan chose this."
                
                add_rec(code, "peer", cf_data["score"], evidence, name,
                        ects=candidate.get("ects"), 
                        category=candidate.get("category"), 
                        exam_subject=candidate.get("exam_subject"), 
                        course_type=candidate.get("type"))
        
        # 6. Filter by rule consistency if checker available
        if self.rule_checker and recommendations:
            # Sort by score first so we rule-check the best ones
            recommendations.sort(key=lambda x: x["score"], reverse=True)
            
            # Pre-calculate base violations to see what's already broken
            base_errors = []
            base_warnings = []
            try:
                base_res = self.rule_checker.evaluate({
                    "plannedCourses": planned_courses,
                    "doneCourses": done_courses
                })
                base_errors = base_res.errors or []
                base_warnings = base_res.stats.get("warnings", [])
            except:
                pass

            final_filtered = []
            # Optimization: only check top 100 logical matches
            to_check = recommendations[:100]
            
            # Map candidate codes to their metadata for rule check
            candidate_meta_map = {}
            for c in candidates:
                cc = c["code"]
                if cc not in candidate_meta_map:
                    candidate_meta_map[cc] = []
                candidate_meta_map[cc].append(c)
            
            for rec in to_check:
                candidate_variants = candidate_meta_map.get(rec["courseCode"], [])
                if not candidate_variants:
                    final_filtered.append(rec)
                    continue
                
                # Try each variant
                is_any_variant_ok = False
                for candidate_data in candidate_variants:
                    mock_course = {
                        "code": candidate_data.get("code"),
                        "name": candidate_data.get("title") or candidate_data.get("name"),
                        "ects": candidate_data.get("ects"),
                        "category": candidate_data.get("category") or candidate_data.get("type"),
                        "examSubject": candidate_data.get("exam_subject") or candidate_data.get("examSubject") or "",
                        "laneIndex": 99
                    }
                    
                    try:
                        res = self.rule_checker.evaluate({
                            "plannedCourses": planned_courses + [mock_course],
                            "doneCourses": done_courses
                        })
                        
                        if res.ok:
                            is_any_variant_ok = True
                            break
                        else:
                            new_errors = [e for e in (res.errors or []) if e not in base_errors]
                            new_warnings = [w for w in (res.stats.get("warnings", []) or []) if w not in base_warnings]
                            
                            if not new_errors and not new_warnings:
                                is_any_variant_ok = True
                                break
                    except:
                        is_any_variant_ok = True
                        break
                
                if is_any_variant_ok:
                    final_filtered.append(rec)
                
                if len(final_filtered) >= 15:
                    break
            
            return final_filtered

        # Sort by score descending
        recommendations.sort(key=lambda x: x["score"], reverse=True)
        # Return top N
        return recommendations[:15]
