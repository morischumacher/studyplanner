/**
 * The editable copy of the profile: the drafts both modals bind to, and the
 * saves that put them back on the server.
 *
 * Every field the student types into is held here as its own piece of state
 * rather than read from the mirror, so the mirror only ever moves when a save
 * succeeds. The one place where that matters is the start term: the server
 * locks it after the first save, and the draft has to keep showing the locked
 * value rather than the one the student was in the middle of typing.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import {
    saveCourseTerms,
    savePlannerState,
    saveRecommendationProfile,
    saveStartTerm,
    fetchRecommendations,
} from "../../lib/api.js";
import { normalizeRulecheckCategoryForProgram } from "../../domain/catalogue.ts";
import { BACHELOR_PROGRAM_CODE, PROGRAM_OPTIONS } from "../../domain/programmes.ts";
import type { CoursesBySemester, SemesterLoadLimits } from "../../domain/plan/state.ts";
import type { Catalogue } from "../../domain/types.ts";
import {
    normalizeStartSeason,
    normalizeTermAvailability,
    TERM_BOTH,
    TERM_WINTER,
    type Season,
    type TermAvailability,
} from "../../domain/terms.ts";
import type { ProfileSettings, ProfileSettingsByProgram } from "./useProfileSettings.ts";

/** A catalogue course as the availability table lists it. */
export interface ProfileCourseRow {
    code: string;
    title: string;
    type: string;
    examSubject: string | null;
}

/** The banner the planner shows when a save is refused. */
export interface StickyViolation {
    message: string;
    until: number;
    tone: string;
}

/** The planner snapshot, as far as this module needs to know it. */
export interface PlannerSnapshot {
    selectedFocusByProgram?: Record<string, string>;
    [key: string]: unknown;
}

export interface UseProfileFormInput {
    programCode: string;
    setProgramCode?: ((programCode: string) => void) | undefined;
    catalog: Catalogue | null | undefined;
    termAvailabilityForCode: (courseCode: string) => TermAvailability;
    selectedFocus: string;
    setSelectedFocus?: ((focus: string) => void) | undefined;
    setSelectedFocusForProgram?: ((programCode: string, focus: string) => void) | undefined;
    semesterLoadLimits: SemesterLoadLimits | null | undefined;
    setSemesterLoadLimits?: ((limits: SemesterLoadLimits) => void) | undefined;
    coursesBySemester: CoursesBySemester | null | undefined;
    doneCourseCodes: readonly string[] | null | undefined;
    parkedCourseCodes: readonly string[] | null | undefined;
    buildPersistSnapshot: () => PlannerSnapshot;
    setRecommendations: (recommendations: unknown[]) => void;
    setStickyViolation: (violation: StickyViolation) => void;
    /** True on the first entry after signup, when the setup modal has to open itself. */
    openSignupSetupOnEntry: boolean;
    onSignupSetupPromptConsumed?: (() => void) | undefined;
    profileSettingsForProgram: ProfileSettings;
    setProfileSettingsByProgram: Dispatch<SetStateAction<ProfileSettingsByProgram>>;
    setLockedProgramCode: Dispatch<SetStateAction<string | null>>;
    startTermSeason: Season;
    startTermYear: number;
    isStartTermLocked: boolean;
    isProfileOpen: boolean;
    setIsProfileOpen: Dispatch<SetStateAction<boolean>>;
    setIsSignupSetupOpen: Dispatch<SetStateAction<boolean>>;
}

export interface UseProfileFormResult {
    signupSetupProgramCode: string;
    setSignupSetupProgramCode: Dispatch<SetStateAction<string>>;
    signupSetupStartSeason: Season;
    setSignupSetupStartSeason: Dispatch<SetStateAction<Season>>;
    signupSetupStartYear: number | string;
    setSignupSetupStartYear: Dispatch<SetStateAction<number | string>>;
    signupSetupFocus: string;
    setSignupSetupFocus: Dispatch<SetStateAction<string>>;
    isSavingSignupSetup: boolean;
    saveSignupSetup: () => Promise<void>;
    resetSignupSetupDraft: () => void;
    isCurriculumSettingsOpen: boolean;
    setIsCurriculumSettingsOpen: Dispatch<SetStateAction<boolean>>;
    profileSearch: string;
    setProfileSearch: Dispatch<SetStateAction<string>>;
    filteredCatalogCourseRows: ProfileCourseRow[];
    pendingTermForCode: (courseCode: string) => TermAvailability;
    setPendingTermForCode: (courseCode: string, termAvailability: unknown) => void;
    profileDraftFocus: string;
    setProfileDraftFocus: Dispatch<SetStateAction<string>>;
    profileDraftStartSeason: Season;
    setProfileDraftStartSeason: Dispatch<SetStateAction<Season>>;
    profileDraftStartYear: number | string;
    setProfileDraftStartYear: Dispatch<SetStateAction<number | string>>;
    profileDraftMaxEcts: number | string;
    setProfileDraftMaxEcts: Dispatch<SetStateAction<number | string>>;
    profileDraftRecommendedEcts: number | string;
    setProfileDraftRecommendedEcts: Dispatch<SetStateAction<number | string>>;
    profileDraftMaxWeekHours: number | string;
    setProfileDraftMaxWeekHours: Dispatch<SetStateAction<number | string>>;
    profileDraftRecommendedWeekHours: number | string;
    setProfileDraftRecommendedWeekHours: Dispatch<SetStateAction<number | string>>;
    profileDraftInterests: string;
    setProfileDraftInterests: Dispatch<SetStateAction<string>>;
    profileDraftCareer: string;
    setProfileDraftCareer: Dispatch<SetStateAction<string>>;
    isSavingProfileSettings: boolean;
    saveStartTermSetting: (season: unknown, year: unknown) => Promise<void>;
    savePendingCourseTerms: () => Promise<void>;
    saveProfileChanges: () => Promise<void>;
}

export function useProfileForm({
    programCode,
    setProgramCode,
    catalog,
    termAvailabilityForCode,
    selectedFocus,
    setSelectedFocus,
    setSelectedFocusForProgram,
    semesterLoadLimits,
    setSemesterLoadLimits,
    coursesBySemester,
    doneCourseCodes,
    parkedCourseCodes,
    buildPersistSnapshot,
    setRecommendations,
    setStickyViolation,
    openSignupSetupOnEntry,
    onSignupSetupPromptConsumed,
    profileSettingsForProgram,
    setProfileSettingsByProgram,
    setLockedProgramCode,
    startTermSeason,
    startTermYear,
    isStartTermLocked,
    isProfileOpen,
    setIsProfileOpen,
    setIsSignupSetupOpen,
}: UseProfileFormInput): UseProfileFormResult {
    const [profileSearch, setProfileSearch] = useState("");
    const [signupSetupProgramCode, setSignupSetupProgramCode] = useState(programCode);
    const [signupSetupStartSeason, setSignupSetupStartSeason] = useState<Season>(TERM_WINTER);
    const [signupSetupStartYear, setSignupSetupStartYear] = useState<number | string>(new Date().getFullYear());
    const [signupSetupFocus, setSignupSetupFocus] = useState(selectedFocus || "");
    const [isSavingSignupSetup, setIsSavingSignupSetup] = useState(false);
    const [pendingCourseTermUpdateByCode, setPendingCourseTermUpdateByCode] =
        useState<Record<string, TermAvailability>>({});
    const [isSavingProfileSettings, setIsSavingProfileSettings] = useState(false);
    const [isCurriculumSettingsOpen, setIsCurriculumSettingsOpen] = useState(false);
    const [profileDraftFocus, setProfileDraftFocus] = useState("");
    const [profileDraftStartSeason, setProfileDraftStartSeason] = useState<Season>(TERM_WINTER);
    const [profileDraftStartYear, setProfileDraftStartYear] = useState<number | string>(new Date().getFullYear());
    const [profileDraftMaxEcts, setProfileDraftMaxEcts] = useState<number | string>(42);
    const [profileDraftRecommendedEcts, setProfileDraftRecommendedEcts] = useState<number | string>(30);
    const [profileDraftMaxWeekHours, setProfileDraftMaxWeekHours] = useState<number | string>(50);
    const [profileDraftRecommendedWeekHours, setProfileDraftRecommendedWeekHours] = useState<number | string>(40);
    const [profileDraftInterests, setProfileDraftInterests] = useState("");
    const [profileDraftCareer, setProfileDraftCareer] = useState("");

    useEffect(() => {
        if (!openSignupSetupOnEntry) return;
        const defaultProgram = String(programCode || PROGRAM_OPTIONS?.[0]?.code || "").trim() || "066 937";
        setSignupSetupProgramCode(defaultProgram);
        setSignupSetupStartSeason(TERM_WINTER);
        setSignupSetupStartYear(new Date().getFullYear());
        setSignupSetupFocus(defaultProgram === BACHELOR_PROGRAM_CODE ? (selectedFocus || "") : "");
        setIsSignupSetupOpen(true);
        onSignupSetupPromptConsumed?.();
    }, [
        openSignupSetupOnEntry,
        onSignupSetupPromptConsumed,
        programCode,
        selectedFocus,
    ]);

    // Course term edits that were never saved are dropped when the programme
    // changes or the modal closes. That is deliberate rather than incidental:
    // the edits are keyed by course code against one programme's catalogue, so
    // carrying them across would write a term onto a course from another one.
    useEffect(() => {
        setPendingCourseTermUpdateByCode({});
        setProfileSearch("");
    }, [programCode, isProfileOpen]);

    useEffect(() => {
        if (!isProfileOpen) return;
        setProfileDraftFocus(selectedFocus || "");
        setProfileDraftStartSeason(startTermSeason);
        setProfileDraftStartYear(startTermYear);
        setProfileDraftMaxEcts(Number(semesterLoadLimits?.maxEctsPerSemester ?? 42));
        setProfileDraftRecommendedEcts(Number(semesterLoadLimits?.recommendedEctsPerSemester ?? 30));
        setProfileDraftMaxWeekHours(Number(semesterLoadLimits?.maxWeekHoursPerSemester ?? 50));
        setProfileDraftRecommendedWeekHours(Number(semesterLoadLimits?.recommendedWeekHoursPerSemester ?? 40));
        setProfileDraftInterests(Array.isArray(profileSettingsForProgram?.interests) ? profileSettingsForProgram.interests.join(", ") : "");
        setProfileDraftCareer(profileSettingsForProgram?.careerDirection || "");
    }, [
        isProfileOpen,
        selectedFocus,
        startTermSeason,
        startTermYear,
        semesterLoadLimits?.maxEctsPerSemester,
        semesterLoadLimits?.recommendedEctsPerSemester,
        semesterLoadLimits?.maxWeekHoursPerSemester,
        semesterLoadLimits?.recommendedWeekHoursPerSemester,
        profileSettingsForProgram?.interests,
        profileSettingsForProgram?.careerDirection,
    ]);

    const catalogCourseRows = useMemo<ProfileCourseRow[]>(() => {
        const rows: ProfileCourseRow[] = [];
        const seen = new Set<string>();
        for (const subject of Array.isArray(catalog) ? catalog : []) {
            const subjectName = subject?.pruefungsfach ?? null;
            for (const module of Array.isArray(subject?.modules) ? subject.modules : []) {
                for (const course of Array.isArray(module?.courses) ? module.courses : []) {
                    const code = String(course?.code || "").trim();
                    if (!code || seen.has(code)) continue;
                    seen.add(code);
                    rows.push({
                        code,
                        title: course?.name || code,
                        type: course?.type || "-",
                        examSubject: subjectName,
                    });
                }
            }
        }
        rows.sort((a, b) => a.code.localeCompare(b.code));
        return rows;
    }, [catalog]);

    const filteredCatalogCourseRows = useMemo(() => {
        const needle = String(profileSearch || "").trim().toLowerCase();
        if (!needle) return catalogCourseRows;
        return catalogCourseRows.filter((row) =>
            String(row?.code || "").toLowerCase().includes(needle) ||
            String(row?.title || "").toLowerCase().includes(needle)
        );
    }, [catalogCourseRows, profileSearch]);

    const pendingTermForCode = useCallback((courseCode: string): TermAvailability => {
        const code = String(courseCode || "").trim();
        if (!code) return TERM_BOTH;
        if (pendingCourseTermUpdateByCode?.[code]) {
            return normalizeTermAvailability(pendingCourseTermUpdateByCode[code]);
        }
        return termAvailabilityForCode(code);
    }, [pendingCourseTermUpdateByCode, termAvailabilityForCode]);

    const setPendingTermForCode = useCallback((courseCode: string, termAvailability: unknown) => {
        const code = String(courseCode || "").trim();
        if (!code) return;
        const normalized = normalizeTermAvailability(termAvailability);
        setPendingCourseTermUpdateByCode((prev) => ({
            ...(prev || {}),
            [code]: normalized,
        }));
    }, []);

    const saveStartTermSetting = useCallback(async (season: unknown, year: unknown) => {
        if (isStartTermLocked) return;
        const normalizedSeason = normalizeStartSeason(season);
        const normalizedYear = Number(year) || new Date().getFullYear();
        setIsSavingProfileSettings(true);
        try {
            await saveStartTerm({
                programCode,
                season: normalizedSeason,
                year: normalizedYear,
            });
            setProfileSettingsByProgram((prev) => ({
                ...(prev || {}),
                [programCode]: {
                    ...(prev?.[programCode] || {}),
                    startTerm: { season: normalizedSeason, year: normalizedYear },
                    startTermLocked: true,
                    courseTermOverrides: prev?.[programCode]?.courseTermOverrides || {},
                },
            }));
        } catch (error) {
            console.error("Failed to save start term", error);
            setStickyViolation({
                message: String((error as Error)?.message || "").includes("409")
                    ? "Start semester is locked and cannot be changed anymore."
                    : "Could not save start term settings.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingProfileSettings(false);
        }
    }, [isStartTermLocked, programCode]);

    const saveSignupSetup = useCallback(async () => {
        const selectedProgramCode = String(signupSetupProgramCode || "").trim();
        if (!selectedProgramCode) return;
        const normalizedSeason = normalizeStartSeason(signupSetupStartSeason);
        const normalizedYear = Number(signupSetupStartYear) || new Date().getFullYear();
        setIsSavingSignupSetup(true);
        try {
            await saveStartTerm({
                programCode: selectedProgramCode,
                season: normalizedSeason,
                year: normalizedYear,
            });
            setLockedProgramCode(selectedProgramCode);
            setProgramCode?.(selectedProgramCode);
            if (selectedProgramCode === BACHELOR_PROGRAM_CODE) {
                setSelectedFocusForProgram?.(selectedProgramCode, signupSetupFocus || "");
            } else {
                setSelectedFocusForProgram?.(selectedProgramCode, "");
            }
            setProfileSettingsByProgram((prev) => ({
                ...(prev || {}),
                [selectedProgramCode]: {
                    ...(prev?.[selectedProgramCode] || {}),
                    startTerm: { season: normalizedSeason, year: normalizedYear },
                    startTermLocked: true,
                    courseTermOverrides: prev?.[selectedProgramCode]?.courseTermOverrides || {},
                },
            }));
            // The programme choice is written straight into the snapshot: the
            // planner state that would carry it has not re-rendered yet.
            const snapshot = buildPersistSnapshot();
            const nextSnapshot = {
                ...(snapshot || {}),
                programCode: selectedProgramCode,
                selectedFocusByProgram: {
                    ...((snapshot && snapshot.selectedFocusByProgram) || {}),
                    [selectedProgramCode]: selectedProgramCode === BACHELOR_PROGRAM_CODE ? (signupSetupFocus || "") : "",
                },
            };
            await savePlannerState(nextSnapshot);
            setIsSignupSetupOpen(false);
        } catch (error) {
            console.error("Failed to save signup setup", error);
            setStickyViolation({
                message: String((error as Error)?.message || "").includes("409")
                    ? "Program/start are already locked and cannot be changed."
                    : "Could not save signup setup.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingSignupSetup(false);
        }
    }, [
        buildPersistSnapshot,
        setProgramCode,
        setSelectedFocusForProgram,
        setStickyViolation,
        signupSetupFocus,
        signupSetupProgramCode,
        signupSetupStartSeason,
        signupSetupStartYear,
    ]);

    const resetSignupSetupDraft = useCallback(() => {
        const defaultProgram = String(PROGRAM_OPTIONS?.[0]?.code || "066 937").trim();
        setSignupSetupProgramCode(defaultProgram);
        setSignupSetupStartSeason(TERM_WINTER);
        setSignupSetupStartYear(new Date().getFullYear());
        setSignupSetupFocus("");
    }, []);

    const savePendingCourseTerms = useCallback(async () => {
        const updates = Object.entries(pendingCourseTermUpdateByCode || {})
            .map(([courseCode, termAvailability]) => ({
                courseCode,
                termAvailability: normalizeTermAvailability(termAvailability),
            }))
            .filter((item) => Boolean(item.courseCode));
        if (!updates.length) return;
        setIsSavingProfileSettings(true);
        try {
            await saveCourseTerms({
                programCode,
                updates,
            });
            setProfileSettingsByProgram((prev) => {
                const current = prev?.[programCode] || {};
                const nextOverrides = { ...(current?.courseTermOverrides || {}) };
                for (const update of updates) {
                    nextOverrides[update.courseCode] = update.termAvailability;
                }
                return {
                    ...(prev || {}),
                    [programCode]: {
                        ...current,
                        courseTermOverrides: nextOverrides,
                    },
                };
            });
            setPendingCourseTermUpdateByCode({});
        } catch (error) {
            console.error("Failed to save course term settings", error);
            setStickyViolation({
                message: "Could not save course term settings.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingProfileSettings(false);
        }
    }, [pendingCourseTermUpdateByCode, programCode]);

    const saveProfileChanges = useCallback(async () => {
        if (isSavingProfileSettings) return;
        setIsSavingProfileSettings(true);
        try {
            const normalizedSeason = normalizeStartSeason(profileDraftStartSeason);
            const normalizedYear = Number(profileDraftStartYear) || new Date().getFullYear();
            const shouldSaveStartTerm = !isStartTermLocked;
            if (shouldSaveStartTerm) {
                await saveStartTerm({
                    programCode,
                    season: normalizedSeason,
                    year: normalizedYear,
                });
                setProfileSettingsByProgram((prev) => ({
                    ...(prev || {}),
                    [programCode]: {
                        ...(prev?.[programCode] || {}),
                        startTerm: { season: normalizedSeason, year: normalizedYear },
                        startTermLocked: true,
                        courseTermOverrides: prev?.[programCode]?.courseTermOverrides || {},
                    },
                }));
            }

            const updates = Object.entries(pendingCourseTermUpdateByCode || {})
                .map(([courseCode, termAvailability]) => ({
                    courseCode,
                    termAvailability: normalizeTermAvailability(termAvailability),
                }))
                .filter((item) => Boolean(item.courseCode));
            if (updates.length > 0) {
                await saveCourseTerms({
                    programCode,
                    updates,
                });
                setProfileSettingsByProgram((prev) => {
                    const current = prev?.[programCode] || {};
                    const nextOverrides = { ...(current?.courseTermOverrides || {}) };
                    for (const update of updates) {
                        nextOverrides[update.courseCode] = update.termAvailability;
                    }
                    return {
                        ...(prev || {}),
                        [programCode]: {
                            ...current,
                            courseTermOverrides: nextOverrides,
                        },
                    };
                });
                setPendingCourseTermUpdateByCode({});
            }

            const parsedInterests = profileDraftInterests.split(",").map((i) => i.trim()).filter(Boolean);
            await saveRecommendationProfile({
                programCode,
                interests: parsedInterests,
                careerDirection: profileDraftCareer,
                recommendationToggles: profileSettingsForProgram?.recommendation_toggles || {},
            });
            setProfileSettingsByProgram((prev) => ({
                ...(prev || {}),
                [programCode]: {
                    ...(prev?.[programCode] || {}),
                    interests: parsedInterests,
                    careerDirection: profileDraftCareer,
                },
            }));

            if ((selectedFocus || "") !== (profileDraftFocus || "")) {
                setSelectedFocus?.(profileDraftFocus || "");
            }
            setSemesterLoadLimits?.({
                maxEctsPerSemester: Number(profileDraftMaxEcts) || 42,
                recommendedEctsPerSemester: Number(profileDraftRecommendedEcts) || 30,
                maxWeekHoursPerSemester: Number(profileDraftMaxWeekHours) || 50,
                recommendedWeekHoursPerSemester: Number(profileDraftRecommendedWeekHours) || 40,
            });
            setIsProfileOpen(false);

            // The recommendations that are on screen were built from the
            // interests the student has just replaced.
            const doneSet = new Set(doneCourseCodes || []);
            const allCourses = Object.values(coursesBySemester || {})
                .flat()
                .map((course) => normalizeRulecheckCategoryForProgram(course, programCode));
            const doneCoursesList = allCourses.filter((c) => c?.code && doneSet.has(c.code));
            const plannedCoursesList = allCourses.filter((c) => c?.code && !doneSet.has(c.code));
            const response = await fetchRecommendations({
                programCode,
                plannedCourses: plannedCoursesList,
                doneCourses: doneCoursesList,
                parkedCourses: parkedCourseCodes
            });
            if (response?.ok && response?.recommendations) {
                setRecommendations(response.recommendations);
            } else {
                setRecommendations([]);
            }
        } catch (error) {
            console.error("Failed to save profile settings", error);
            setStickyViolation({
                message: String((error as Error)?.message || "").includes("409")
                    ? "Start semester is locked and cannot be changed anymore."
                    : "Could not save profile settings.",
                until: Date.now() + 4000,
                tone: "error",
            });
        } finally {
            setIsSavingProfileSettings(false);
        }
    }, [
        isSavingProfileSettings,
        isStartTermLocked,
        startTermSeason,
        startTermYear,
        programCode,
        pendingCourseTermUpdateByCode,
        selectedFocus,
        profileDraftFocus,
        profileDraftStartSeason,
        profileDraftStartYear,
        profileDraftMaxEcts,
        profileDraftRecommendedEcts,
        profileDraftMaxWeekHours,
        profileDraftRecommendedWeekHours,
        profileDraftInterests,
        profileDraftCareer,
        profileSettingsForProgram,
        doneCourseCodes,
        coursesBySemester,
        parkedCourseCodes,
        setRecommendations,
        setSemesterLoadLimits,
        setIsProfileOpen,
        setStickyViolation,
        setIsSavingProfileSettings,
        setSelectedFocus,
    ]);

    return {
        signupSetupProgramCode,
        setSignupSetupProgramCode,
        signupSetupStartSeason,
        setSignupSetupStartSeason,
        signupSetupStartYear,
        setSignupSetupStartYear,
        signupSetupFocus,
        setSignupSetupFocus,
        isSavingSignupSetup,
        saveSignupSetup,
        resetSignupSetupDraft,
        isCurriculumSettingsOpen,
        setIsCurriculumSettingsOpen,
        profileSearch,
        setProfileSearch,
        filteredCatalogCourseRows,
        pendingTermForCode,
        setPendingTermForCode,
        profileDraftFocus,
        setProfileDraftFocus,
        profileDraftStartSeason,
        setProfileDraftStartSeason,
        profileDraftStartYear,
        setProfileDraftStartYear,
        profileDraftMaxEcts,
        setProfileDraftMaxEcts,
        profileDraftRecommendedEcts,
        setProfileDraftRecommendedEcts,
        profileDraftMaxWeekHours,
        setProfileDraftMaxWeekHours,
        profileDraftRecommendedWeekHours,
        setProfileDraftRecommendedWeekHours,
        profileDraftInterests,
        setProfileDraftInterests,
        profileDraftCareer,
        setProfileDraftCareer,
        isSavingProfileSettings,
        saveStartTermSetting,
        savePendingCourseTerms,
        saveProfileChanges,
    };
}
