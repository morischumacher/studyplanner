import json
import re

BACHELOR_SYLLABUS = "/tmp/bachelor_syl.txt"
MASTER_SYLLABUS = "/tmp/master_syl.txt"

# German stopwords to filter out from topic phrases
DE_STOPWORDS = {
    "und", "oder", "der", "die", "das", "ein", "eine", "einen", "einem",
    "eines", "den", "dem", "des", "sich", "von", "auf", "mit", "bei",
    "nach", "für", "aus", "als", "an", "zu", "in", "im", "ist", "sind",
    "wird", "werden", "kann", "können", "wird", "haben", "hatte", "sein",
    "nicht", "auch", "wie", "durch", "über", "unter", "sowie", "dabei",
    "dabei", "hierbei", "dazu", "hier", "wird", "diese", "dieser",
    "verschiedene", "verschiedenen", "grundlegende", "grundlegenden",
    "sowie", "werden", "werden", "their", "this", "that", "they", "them",
    "these", "those", "from", "with", "will", "able", "have", "been",
    "which", "about", "using", "after", "upon", "further", "students",
    "course", "module", "discuss", "apply", "identify", "describe",
    "explain", "understand", "learn", "knowledge", "skills", "area",
    "topics", "context", "issues", "problems", "successful", "completion",
    "following", "modules", "lectures", "taught", "prerequisites",
}


def clean_phrase(phrase: str) -> str:
    """Strip bullet markers, trailing punctuation and extra whitespace."""
    phrase = re.sub(r'^[•\-\*\d+\.\s]+', '', phrase)  # strip leading bullets/numbers
    phrase = phrase.rstrip(';,.')
    phrase = re.sub(r'\s+', ' ', phrase)
    return phrase.strip()


def is_useful_phrase(phrase: str) -> bool:
    """Filter out phrases that are too short, too long, or only stopwords."""
    if not phrase or len(phrase) < 4 or len(phrase) > 100:
        return False
    words = re.findall(r'\b[a-zA-ZÄÖÜäöüß]+\b', phrase.lower())
    meaningful = [w for w in words if w not in DE_STOPWORDS and len(w) > 2]
    return len(meaningful) >= 1


def parse_syllabus(filepath: str) -> dict:
    with open(filepath, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    modules = {}
    current_module = None
    capture_mode = None          # 'description' | 'fachkompetenzen' | 'inhalt' | None
    section_sections = {
        "Fachkompetenzen:",
        "Überfachliche Kompetenzen:",
        "Erwartete Vorkenntnisse:",
        "Angewendete Lehr- und Lernformen",
        "Lehrveranstaltungen des Moduls:",
    }

    for i, raw in enumerate(lines):
        line = raw.strip()

        if not line:
            continue

        # ── Detect module boundary ──────────────────────────────────────────
        if line.startswith("Regelarbeitsaufwand:"):
            j = i - 1
            while j >= 0 and not lines[j].strip():
                j -= 1
            if j >= 0:
                raw_title = lines[j].strip()
                # Strip leading page-number / ECTS fractions that can appear
                raw_title = re.sub(r'^\d+\s*$', '', raw_title)          # pure page number
                raw_title = re.sub(r'^\d+[.,]\d+.*?\s', '', raw_title)  # "6,0/4,0 VU …"
                current_module = raw_title.strip()
                if current_module:
                    modules[current_module] = {
                        "description": "",
                        "topics": [],        # full phrase skills from Inhalt
                        "competences": [],   # full phrase skills from Fachkompetenzen
                    }
            capture_mode = None
            continue

        if not current_module:
            continue

        # ── Section markers ─────────────────────────────────────────────────
        if line.startswith("Lernergebnisse:"):
            capture_mode = "description"
            tail = line.replace("Lernergebnisse:", "").strip()
            if tail:
                modules[current_module]["description"] += tail + " "
            continue

        if line.startswith("Fachkompetenzen:"):
            capture_mode = "fachkompetenzen"
            tail = line.replace("Fachkompetenzen:", "").strip()
            if tail:
                phrase = clean_phrase(tail)
                if is_useful_phrase(phrase):
                    modules[current_module]["competences"].append(phrase)
            continue

        if line.startswith("Inhalt:"):
            capture_mode = "inhalt"
            tail = line.replace("Inhalt:", "").strip()
            if tail:
                phrase = clean_phrase(tail)
                if is_useful_phrase(phrase):
                    modules[current_module]["topics"].append(phrase)
            continue

        # Any other section header resets capture
        if any(line.startswith(s) for s in section_sections):
            capture_mode = None
            continue

        # ── Capture body lines ───────────────────────────────────────────────
        if capture_mode == "description":
            modules[current_module]["description"] += line + " "

        elif capture_mode in ("fachkompetenzen", "inhalt"):
            target_list = "competences" if capture_mode == "fachkompetenzen" else "topics"

            # Is this a continuation of the previous bullet (no leading bullet marker)?
            is_bullet = bool(re.match(r'^[•\-\*]', line)) or bool(re.match(r'^\d+[\.\)]', line))

            phrase = clean_phrase(line)
            if not phrase:
                continue

            if is_bullet:
                # New bullet → new phrase
                if is_useful_phrase(phrase):
                    modules[current_module][target_list].append(phrase)
            else:
                # Continuation line: only merge if previous was a bullet AND merged result is short
                lst = modules[current_module][target_list]
                if lst and len(lst[-1]) + len(phrase) + 1 <= 100:
                    merged = lst[-1] + " " + phrase
                    lst[-1] = merged.rstrip(';,.')
                # If it would be too long, just skip continuation lines (they are usually prose)

    # ── Compile final result ─────────────────────────────────────────────────
    result = {}
    for mod, data in modules.items():
        if not mod:
            continue

        # Merge topics + competences into a deduplicated skills list
        all_skills_raw = data["topics"] + data["competences"]

        # Lowercase + deduplicate while preserving order
        seen = set()
        skills = []
        for s in all_skills_raw:
            key = s.lower()
            if key not in seen and is_useful_phrase(s):
                seen.add(key)
                skills.append(s)

        # Keep top 30 (topics first, then competences)
        skills = skills[:30]

        desc = data["description"].strip()
        result[mod] = {
            "title": mod,
            "description": desc,
            "skills": skills,
        }

    return result


def generate_sql_migration():
    print("Parsing bachelor syllabus …")
    bach = parse_syllabus(BACHELOR_SYLLABUS)
    print(f"  → {len(bach)} modules found")

    print("Parsing master syllabus …")
    mast = parse_syllabus(MASTER_SYLLABUS)
    print(f"  → {len(mast)} modules found")

    all_syllabi = {**bach, **mast}
    print(f"Total: {len(all_syllabi)} unique modules")

    # Quick quality sanity check
    sample = list(all_syllabi.items())[:2]
    for title, meta in sample:
        print(f"\n  [{title}]")
        print(f"    skills: {meta['skills'][:5]}")
        print(f"    desc  : {meta['description'][:120]}")

    sql_path = "/app/sql/010_course_metadata.sql"

    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- Auto-generated migration: course semantic metadata (skills + descriptions)\n")
        f.write("-- Re-run update_metadata.py to regenerate from the original syllabus text files.\n\n")

        written = 0
        for title, meta in all_syllabi.items():
            # Strip null bytes from all strings — Postgres rejects \u0000 in JSON/text
            clean_skills = [s.replace('\x00', '') for s in meta["skills"]]
            skills_json = json.dumps(clean_skills, ensure_ascii=False).replace('\x00', '')
            clean_desc  = meta["description"].replace('\x00', '').replace("'", "''")
            clean_title = title.replace('\x00', '').replace("'", "''")

            f.write(
                f"UPDATE course\n"
                f"SET attributes = COALESCE(attributes, '{{}}'::jsonb)\n"
                f"             || jsonb_build_object(\n"
                f"                  'skills',      '{skills_json}'::jsonb,\n"
                f"                  'description', '{clean_desc}'::text\n"
                f"                )\n"
                f"WHERE title ILIKE '{clean_title}%';\n\n"
            )
            written += 1

        f.write("\n-- Refresh the materialized view so the API picks up updated metadata immediately\n")
        f.write("REFRESH MATERIALIZED VIEW v_catalog_json_mat;\n")

    print(f"\nGenerated {written} UPDATE statements → {sql_path}")


if __name__ == "__main__":
    generate_sql_migration()
