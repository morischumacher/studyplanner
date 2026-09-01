/**
 * The student's stored profile, mirrored from the server one programme at a time.
 *
 * The mirror is a map keyed by programme code rather than a single record,
 * because the planner switches programme without unmounting and a programme
 * already fetched has to keep answering for its start term while the fetch for
 * the next one is still in flight. Nothing derived from it is memoised: a
 * programme with no entry yet reads as a fresh empty object on every render,
 * and the callbacks downstream are rebuilt just as often, so memoising here
 * would quietly change how often the rest of the planner reacts.
 */

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

import { fetchProfileSettings } from "../../lib/api.js";
import {
    normalizeStartSeason,
    normalizeTermAvailability,
    TERM_WINTER,
    type Season,
    type TermAvailability,
} from "../../domain/terms.ts";

/** The semester a student began a programme in. */
export interface StartTerm {
    season: Season;
    year: number;
}

/**
 * One programme's profile. Every field is optional because the mirror is
 * written in pieces: a save updates only the part it saved, and the entry for
 * a programme can exist before its fetch has answered.
 */
export interface ProfileSettings {
    startTerm?: StartTerm | null;
    startTermLocked?: boolean;
    courseTermOverrides?: Record<string, TermAvailability>;
    interests?: string[];
    careerDirection?: string;
    /** The backend's own name, read under it throughout the planner. */
    recommendation_toggles?: Record<string, boolean>;
}

export type ProfileSettingsByProgram = Record<string, ProfileSettings>;

export interface UseProfileSettingsInput {
    programCode: string;
    setProgramCode?: ((programCode: string) => void) | undefined;
}

export interface UseProfileSettingsResult {
    isProfileOpen: boolean;
    setIsProfileOpen: Dispatch<SetStateAction<boolean>>;
    isSignupSetupOpen: boolean;
    setIsSignupSetupOpen: Dispatch<SetStateAction<boolean>>;
    profileSettingsByProgram: ProfileSettingsByProgram;
    setProfileSettingsByProgram: Dispatch<SetStateAction<ProfileSettingsByProgram>>;
    profileSettingsForProgram: ProfileSettings;
    lockedProgramCode: string | null;
    setLockedProgramCode: Dispatch<SetStateAction<string | null>>;
    startTermSeason: Season;
    startTermYear: number;
    isStartTermLocked: boolean;
    isProgramLocked: boolean;
    courseTermOverrides: Record<string, TermAvailability>;
}

export function useProfileSettings({
    programCode,
    setProgramCode,
}: UseProfileSettingsInput): UseProfileSettingsResult {
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isSignupSetupOpen, setIsSignupSetupOpen] = useState(false);
    const [profileSettingsByProgram, setProfileSettingsByProgram] = useState<ProfileSettingsByProgram>({});
    const [lockedProgramCode, setLockedProgramCode] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const payload = await fetchProfileSettings(programCode);
                if (cancelled) return;
                const startTerm: StartTerm | null = payload?.start_term && typeof payload.start_term === "object"
                    ? {
                        season: normalizeStartSeason(payload.start_term.season),
                        year: Number(payload.start_term.year) || new Date().getFullYear(),
                    }
                    : null;
                const overridesRaw =
                    payload?.course_term_overrides && typeof payload.course_term_overrides === "object"
                        ? payload.course_term_overrides
                        : {};
                const normalizedOverrides: Record<string, TermAvailability> = Object.fromEntries(
                    Object.entries(overridesRaw)
                        .map(([code, term]): [string, TermAvailability] => [
                            String(code || "").trim(),
                            normalizeTermAvailability(term),
                        ])
                        .filter(([code]) => Boolean(code))
                );
                const nextLockedProgramCode = String(payload?.locked_program_code || "").trim() || null;
                setLockedProgramCode(nextLockedProgramCode);
                // The locked programme is the one the student settled on at
                // signup, so it wins over whatever the planner was showing.
                if (nextLockedProgramCode && nextLockedProgramCode !== programCode) {
                    setProgramCode?.(nextLockedProgramCode);
                }
                setProfileSettingsByProgram((prev) => ({
                    ...(prev || {}),
                    [programCode]: {
                        startTerm,
                        startTermLocked: Boolean(payload?.start_term_locked ?? startTerm),
                        courseTermOverrides: normalizedOverrides,
                        interests: payload?.interests || [],
                        careerDirection: payload?.career_direction || "",
                        recommendation_toggles: payload?.recommendation_toggles || {},
                    },
                }));
            } catch (error) {
                if (cancelled) return;
                console.error("Failed to load profile settings", error);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [programCode]);

    const profileSettingsForProgram: ProfileSettings = profileSettingsByProgram?.[programCode] ?? {};
    const startTermSeason = normalizeStartSeason(profileSettingsForProgram?.startTerm?.season ?? TERM_WINTER);
    const startTermYear = Number(profileSettingsForProgram?.startTerm?.year) || new Date().getFullYear();
    const isStartTermLocked = Boolean(profileSettingsForProgram?.startTermLocked);
    const isProgramLocked = Boolean(String(lockedProgramCode || "").trim());
    const courseTermOverrides = profileSettingsForProgram?.courseTermOverrides ?? {};

    return {
        isProfileOpen,
        setIsProfileOpen,
        isSignupSetupOpen,
        setIsSignupSetupOpen,
        profileSettingsByProgram,
        setProfileSettingsByProgram,
        profileSettingsForProgram,
        lockedProgramCode,
        setLockedProgramCode,
        startTermSeason,
        startTermYear,
        isStartTermLocked,
        isProgramLocked,
        courseTermOverrides,
    };
}
