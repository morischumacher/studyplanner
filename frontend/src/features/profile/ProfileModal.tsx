/**
 * The profile modal: the student's own settings, plus the course availability
 * table hidden behind them.
 *
 * The two halves share one Save button, which is why the table is a panel of
 * this modal rather than a modal of its own: a term changed in the table is
 * only written when the profile is saved.
 */

import type { ProfileCourseRow } from "./useProfileForm.ts";
import {
    laneSeason,
    normalizeStartSeason,
    TERM_BOTH,
    TERM_SUMMER,
    TERM_WINTER,
    type Season,
    type TermAvailability,
} from "../../domain/terms.ts";
import { BACHELOR_FOCUS_OPTIONS, BACHELOR_PROGRAM_CODE, PROGRAM_OPTIONS } from "../../domain/programmes.ts";

export interface ProfileModalProps {
    open: boolean;
    username?: string | undefined;
    onClose: () => void;
    isCurriculumSettingsOpen: boolean;
    onToggleCurriculumSettings: () => void;
    disableGraphView: boolean;
    onDisableGraphViewChange: (disabled: boolean) => void;
    programCode: string;
    onProgramCodeChange: (programCode: string) => void;
    isProgramLocked: boolean;
    focus: string;
    onFocusChange: (focus: string) => void;
    startSeason: Season;
    onStartSeasonChange: (season: Season) => void;
    startYear: number | string;
    onStartYearChange: (year: string) => void;
    isStartTermLocked: boolean;
    interests: string;
    onInterestsChange: (interests: string) => void;
    career: string;
    onCareerChange: (career: string) => void;
    search: string;
    onSearchChange: (search: string) => void;
    courseRows: readonly ProfileCourseRow[];
    termForCode: (courseCode: string) => TermAvailability;
    onTermChange: (courseCode: string, termAvailability: string) => void;
    maxEcts: number | string;
    onMaxEctsChange: (value: string) => void;
    maxWeekHours: number | string;
    onMaxWeekHoursChange: (value: string) => void;
    recommendedEcts: number | string;
    onRecommendedEctsChange: (value: string) => void;
    recommendedWeekHours: number | string;
    onRecommendedWeekHoursChange: (value: string) => void;
    isSaving: boolean;
    onSave: () => void;
}

export default function ProfileModal({
    open,
    username,
    onClose,
    isCurriculumSettingsOpen,
    onToggleCurriculumSettings,
    disableGraphView,
    onDisableGraphViewChange,
    programCode,
    onProgramCodeChange,
    isProgramLocked,
    focus,
    onFocusChange,
    startSeason,
    onStartSeasonChange,
    startYear,
    onStartYearChange,
    isStartTermLocked,
    interests,
    onInterestsChange,
    career,
    onCareerChange,
    search,
    onSearchChange,
    courseRows,
    termForCode,
    onTermChange,
    maxEcts,
    onMaxEctsChange,
    maxWeekHours,
    onMaxWeekHoursChange,
    recommendedEcts,
    onRecommendedEctsChange,
    recommendedWeekHours,
    onRecommendedWeekHoursChange,
    isSaving,
    onSave,
}: ProfileModalProps) {
    if (!open) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 40,
                background: "rgba(15, 23, 42, 0.32)",
                display: "grid",
                placeItems: "center",
                padding: 16,
            }}
        >
            <div
                id="profile-modal-container"
                style={{
                    width: 420,
                    maxWidth: "100%",
                    border: "1px solid #d1d5db",
                    background: "#ffffff",
                    borderRadius: 10,
                    padding: 12,
                    display: "grid",
                    gap: 10,
                    boxShadow: "0 20px 42px rgba(15, 23, 42, 0.2)",
                }}
            >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>Profile</div>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                        <button
                            onClick={onToggleCurriculumSettings}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "6px 10px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                            }}
                        >
                            Course availability
                        </button>
                        <button
                            onClick={onClose}
                            title="Close"
                            aria-label="Close"
                            style={{
                                border: "1px solid #fca5a5",
                                background: "#fef2f2",
                                color: "#b91c1c",
                                borderRadius: 8,
                                fontSize: 12,
                                width: 24,
                                height: 22,
                                lineHeight: 1,
                                cursor: "pointer",
                                fontWeight: 700,
                            }}
                        >
                            ×
                        </button>
                    </div>
                </div>
                {!isCurriculumSettingsOpen && (
                    <div style={{ fontSize: 13, color: "#111827" }}>
                        Name: <strong>{username || "user"}</strong>
                    </div>
                )}
                {!isCurriculumSettingsOpen && (
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, cursor: "pointer", userSelect: "none", marginTop: 4 }}>
                        <input
                            type="checkbox"
                            checked={disableGraphView}
                            onChange={(e) => onDisableGraphViewChange(e.target.checked)}
                            style={{ cursor: "pointer", width: 16, height: 16 }}
                        />
                        Disable Graph View (User Study Persona 1)
                    </label>
                )}
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Study Program</label>
                    <select
                        value={programCode}
                        onChange={(e) => onProgramCodeChange(e.target.value)}
                        disabled={isProgramLocked}
                        style={{
                            border: "1px solid #d1d5db",
                            background: isProgramLocked ? "#f3f4f6" : "#ffffff",
                            color: isProgramLocked ? "#6b7280" : "#111827",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontWeight: 600,
                            width: "100%",
                            boxSizing: "border-box",
                            cursor: isProgramLocked ? "not-allowed" : "default",
                        }}
                    >
                        {(PROGRAM_OPTIONS || []).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                                {opt.label} ({opt.code})
                            </option>
                        ))}
                    </select>
                    {isProgramLocked && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                            Study program is locked after signup setup.
                        </div>
                    )}
                    </div>
                )}
                {!isCurriculumSettingsOpen && programCode === BACHELOR_PROGRAM_CODE && (
                    <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Focus Area</label>
                        <select
                            value={focus || ""}
                            onChange={(e) => onFocusChange(e.target.value)}
                            style={{
                                border: "1px solid #d1d5db",
                                background: "#ffffff",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                            }}
                        >
                            <option value="">Select focus area</option>
                            {(BACHELOR_FOCUS_OPTIONS || []).map((option) => (
                                <option key={option} value={option}>
                                    {option}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Start Semester</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                        <select
                            value={startSeason}
                            onChange={(e) => onStartSeasonChange(normalizeStartSeason(e.target.value))}
                            disabled={isSaving || isStartTermLocked}
                            style={{
                                border: "1px solid #d1d5db",
                                background: (isSaving || isStartTermLocked) ? "#f3f4f6" : "#ffffff",
                                color: (isSaving || isStartTermLocked) ? "#6b7280" : "#111827",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                                cursor: (isSaving || isStartTermLocked) ? "not-allowed" : "default",
                            }}
                        >
                            <option value={TERM_WINTER}>Winter</option>
                            <option value={TERM_SUMMER}>Summer</option>
                        </select>
                        <input
                            type="number"
                            min={1900}
                            max={2600}
                            value={startYear ?? ""}
                            onChange={(e) => onStartYearChange(e.target.value)}
                            disabled={isSaving || isStartTermLocked}
                            style={{
                                border: "1px solid #d1d5db",
                                background: (isSaving || isStartTermLocked) ? "#f3f4f6" : "#ffffff",
                                color: (isSaving || isStartTermLocked) ? "#6b7280" : "#111827",
                                borderRadius: 8,
                                padding: "8px 10px",
                                fontWeight: 600,
                                width: "100%",
                                boxSizing: "border-box",
                                cursor: (isSaving || isStartTermLocked) ? "not-allowed" : "default",
                            }}
                        />
                        <div style={{ alignSelf: "center", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                            S1: {laneSeason(startSeason, 0)}
                        </div>
                    </div>
                    {isStartTermLocked && (
                        <div style={{ fontSize: 11, color: "#6b7280" }}>
                            Start semester is locked after initial setup.
                        </div>
                    )}
                    </div>
                )}
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Recommendation Preferences</div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#374151" }}>Interests (comma separated)</label>
                            <input
                                type="text"
                                value={interests}
                                placeholder="e.g. machine learning, react, robotics"
                                onChange={(e) => onInterestsChange(e.target.value)}
                                disabled={isSaving}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: isSaving ? "#f3f4f6" : "#ffffff",
                                    color: isSaving ? "#6b7280" : "#111827",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#374151" }}>Career Direction / Internship Target</label>
                            <input
                                type="text"
                                value={career}
                                placeholder="e.g. Data Scientist, Security Analyst"
                                onChange={(e) => onCareerChange(e.target.value)}
                                disabled={isSaving}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: isSaving ? "#f3f4f6" : "#ffffff",
                                    color: isSaving ? "#6b7280" : "#111827",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                    </div>
                )}
                <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    {isCurriculumSettingsOpen && (
                        <>
                            <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Course Semester Availability</div>
                            <input
                                type="text"
                                placeholder="Search by code/title..."
                                value={search}
                                onChange={(e) => onSearchChange(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontSize: 12,
                                }}
                            />
                            <div style={{ maxHeight: 220, overflow: "auto", border: "1px solid #e5e7eb", borderRadius: 8 }}>
                                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                                    <thead>
                                        <tr style={{ background: "#f9fafb" }}>
                                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>Title</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>Type</th>
                                            <th style={{ textAlign: "left", padding: "6px 8px", borderBottom: "1px solid #e5e7eb" }}>Term</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {courseRows.map((row) => (
                                            <tr key={`profile-course-${row.code}`}>
                                                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                                                    <div style={{ color: "#6b7280" }}>{row.title}</div>
                                                </td>
                                                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6", color: "#6b7280", whiteSpace: "nowrap" }}>
                                                    {row.type || "-"}
                                                </td>
                                                <td style={{ padding: "6px 8px", borderBottom: "1px solid #f3f4f6" }}>
                                                    <select
                                                        value={termForCode(row.code)}
                                                        onChange={(e) => onTermChange(row.code, e.target.value)}
                                                        style={{
                                                            border: "1px solid #d1d5db",
                                                            borderRadius: 6,
                                                            padding: "4px 6px",
                                                            background: "#ffffff",
                                                        }}
                                                    >
                                                        <option value={TERM_BOTH}>Both</option>
                                                        <option value={TERM_WINTER}>Winter</option>
                                                        <option value={TERM_SUMMER}>Summer</option>
                                                    </select>
                                                </td>
                                            </tr>
                                        ))}
                                        {courseRows.length === 0 && (
                                            <tr>
                                                <td colSpan={3} style={{ padding: "8px", color: "#6b7280" }}>No courses found.</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </div>
                {!isCurriculumSettingsOpen && (
                    <div style={{ display: "grid", gap: 8 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Max ECTS / semester</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={maxEcts ?? ""}
                                onChange={(e) => onMaxEctsChange(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Max Week-Hours / semester</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={maxWeekHours ?? ""}
                                onChange={(e) => onMaxWeekHoursChange(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Recommended ECTS</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={recommendedEcts ?? ""}
                                onChange={(e) => onRecommendedEctsChange(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                        <div style={{ display: "grid", gap: 4 }}>
                            <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Recommended Week-Hours</label>
                            <input
                                type="number"
                                min={1}
                                step={0.5}
                                value={recommendedWeekHours ?? ""}
                                onChange={(e) => onRecommendedWeekHoursChange(e.target.value)}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "8px 10px",
                                    fontWeight: 600,
                                    width: "100%",
                                    boxSizing: "border-box",
                                }}
                            />
                        </div>
                    </div>
                    </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <button
                        onClick={onSave}
                        disabled={isSaving}
                        style={{
                            border: "1px solid #15803d",
                            background: isSaving ? "#86efac" : "#16a34a",
                            color: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 12px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        {isSaving ? "Saving..." : "Save"}
                    </button>
                </div>
            </div>
        </div>
    );
}
