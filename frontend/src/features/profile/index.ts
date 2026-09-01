/**
 * The profile feature: the student's programme, start term, course term
 * overrides and recommendation preferences, together with the two modals that
 * edit them.
 *
 * The two hooks are meant to be called in this order. The form reads the
 * mirror the settings hook holds, and seeds its drafts from it whenever a
 * modal opens.
 */

export { default as ProfileModal } from "./ProfileModal.tsx";
export type { ProfileModalProps } from "./ProfileModal.tsx";
export { default as SignupSetupModal } from "./SignupSetupModal.tsx";
export type { SignupSetupModalProps } from "./SignupSetupModal.tsx";
export { useProfileForm } from "./useProfileForm.ts";
export type {
    PlannerSnapshot,
    ProfileCourseRow,
    StickyViolation,
    UseProfileFormInput,
    UseProfileFormResult,
} from "./useProfileForm.ts";
export { useProfileSettings } from "./useProfileSettings.ts";
export type {
    ProfileSettings,
    ProfileSettingsByProgram,
    StartTerm,
    UseProfileSettingsInput,
    UseProfileSettingsResult,
} from "./useProfileSettings.ts";
