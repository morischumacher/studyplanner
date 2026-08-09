import { useState } from "react";
import { TERM_WINTER } from "../utils/semesters.js";

/**
 * Editable draft state for the profile-settings form.
 *
 * Extracted verbatim from App.jsx as part of an incremental decomposition of
 * that component. The individual fields, their defaults, and their setters are
 * unchanged; the hook simply groups this cohesive slice of UI state so the main
 * component no longer declares it inline. Behaviour is identical: each field is
 * a plain useState, returned under its original name so existing call sites
 * continue to work without modification.
 */
export function useProfileDraftForm() {
    const [profileDraftFocus, setProfileDraftFocus] = useState("");
    const [profileDraftStartSeason, setProfileDraftStartSeason] = useState(TERM_WINTER);
    const [profileDraftStartYear, setProfileDraftStartYear] = useState(new Date().getFullYear());
    const [profileDraftMaxEcts, setProfileDraftMaxEcts] = useState(42);
    const [profileDraftRecommendedEcts, setProfileDraftRecommendedEcts] = useState(30);
    const [profileDraftMaxWeekHours, setProfileDraftMaxWeekHours] = useState(50);
    const [profileDraftRecommendedWeekHours, setProfileDraftRecommendedWeekHours] = useState(40);
    const [profileDraftInterests, setProfileDraftInterests] = useState("");
    const [profileDraftCareer, setProfileDraftCareer] = useState("");

    return {
        profileDraftFocus, setProfileDraftFocus,
        profileDraftStartSeason, setProfileDraftStartSeason,
        profileDraftStartYear, setProfileDraftStartYear,
        profileDraftMaxEcts, setProfileDraftMaxEcts,
        profileDraftRecommendedEcts, setProfileDraftRecommendedEcts,
        profileDraftMaxWeekHours, setProfileDraftMaxWeekHours,
        profileDraftRecommendedWeekHours, setProfileDraftRecommendedWeekHours,
        profileDraftInterests, setProfileDraftInterests,
        profileDraftCareer, setProfileDraftCareer,
    };
}
