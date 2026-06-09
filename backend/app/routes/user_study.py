import os
import json
from datetime import datetime
from typing import Any
from fastapi import APIRouter, HTTPException, status

router = APIRouter(tags=["user-study"])

# Directory to save the study results
RESULTS_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "study_results")
)

@router.post("/study-results", status_code=status.HTTP_201_CREATED)
async def save_study_results(payload: dict[str, Any]):
    try:
        # Create directory if it does not exist
        os.makedirs(RESULTS_DIR, exist_ok=True)
        
        # Extract participant code
        demographics = payload.get("demographics", {})
        participant_id = demographics.get("participantId", "unknown").strip()
        if not participant_id:
            participant_id = "unknown"
            
        # Clean participant ID for filename
        clean_id = "".join(c for c in participant_id if c.isalnum() or c in ("-", "_")).rstrip()
        if not clean_id:
            clean_id = "unknown"
            
        # Create dynamic filename with timestamp
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"study-results_{clean_id}_{timestamp}.json"
        filepath = os.path.join(RESULTS_DIR, filename)
        
        # Save payload as pretty-printed JSON
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(payload, f, indent=2, ensure_ascii=False)
            
        print(f"[User Study] Saved results for participant '{clean_id}' to: {filepath}")
        return {"ok": True, "filename": filename}
        
    except Exception as e:
        print(f"[User Study] Error saving study results: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save results: {str(e)}"
        )
