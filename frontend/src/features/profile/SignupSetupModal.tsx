/**
 * The modal a student meets once, on the first entry after signing up.
 *
 * It is presentational: the programme and the start term it collects are
 * locked by the server the moment they are saved, so the component never
 * decides anything on its own, not even whether the fields are still editable.
 */

import {
    laneSeason,
    normalizeStartSeason,
    TERM_SUMMER,
    TERM_WINTER,
    type Season,
} from "../../domain/terms.ts";
import { BACHELOR_FOCUS_OPTIONS, BACHELOR_PROGRAM_CODE, PROGRAM_OPTIONS } from "../../domain/programmes.ts";

export interface SignupSetupModalProps {
    open: boolean;
    username?: string | undefined;
    programCode: string;
    onProgramCodeChange: (programCode: string) => void;
    focus: string;
    onFocusChange: (focus: string) => void;
    startSeason: Season;
    onStartSeasonChange: (season: Season) => void;
    startYear: number | string;
    onStartYearChange: (year: string) => void;
    isSaving: boolean;
    onReset: () => void;
    onSave: () => void;
}

export default function SignupSetupModal({
    open,
    username,
    programCode,
    onProgramCodeChange,
    focus,
    onFocusChange,
    startSeason,
    onStartSeasonChange,
    startYear,
    onStartYearChange,
    isSaving,
    onReset,
    onSave,
}: SignupSetupModalProps) {
    if (!open) return null;

    return (
        <div
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 45,
                background: "rgba(15, 23, 42, 0.32)",
                display: "grid",
                placeItems: "center",
                padding: 16,
            }}
        >
            <div
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
                <div style={{ fontSize: 14, color: "#111827", fontWeight: 700 }}>Complete Signup Setup</div>
                <div style={{ fontSize: 13, color: "#111827" }}>
                    Name: <strong>{username || "user"}</strong>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Study Program</label>
                    <select
                        value={programCode}
                        onChange={(e) => onProgramCodeChange(e.target.value)}
                        disabled={isSaving}
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
                        {(PROGRAM_OPTIONS || []).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                                {opt.label} ({opt.code})
                            </option>
                        ))}
                    </select>
                </div>
                {programCode === BACHELOR_PROGRAM_CODE && (
                    <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Focus Area</label>
                        <select
                            value={focus || ""}
                            onChange={(e) => onFocusChange(e.target.value)}
                            disabled={isSaving}
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
                <div style={{ display: "grid", gap: 8, borderTop: "1px solid #e5e7eb", paddingTop: 8 }}>
                    <div style={{ fontSize: 11, color: "#6b7280", fontWeight: 700 }}>Start Semester</div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
                        <select
                            value={startSeason}
                            onChange={(e) => onStartSeasonChange(normalizeStartSeason(e.target.value))}
                            disabled={isSaving}
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
                            <option value={TERM_WINTER}>Winter</option>
                            <option value={TERM_SUMMER}>Summer</option>
                        </select>
                        <input
                            type="number"
                            min={1900}
                            max={2600}
                            value={startYear ?? ""}
                            onChange={(e) => onStartYearChange(e.target.value)}
                            disabled={isSaving}
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
                        <div style={{ alignSelf: "center", fontSize: 12, color: "#6b7280", whiteSpace: "nowrap" }}>
                            S1: {laneSeason(startSeason, 0)}
                        </div>
                    </div>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                    <button
                        type="button"
                        onClick={onReset}
                        disabled={isSaving}
                        style={{
                            border: "1px solid #d1d5db",
                            background: "#ffffff",
                            color: "#111827",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: "pointer",
                        }}
                    >
                        Reset
                    </button>
                    <button
                        type="button"
                        onClick={onSave}
                        disabled={isSaving}
                        style={{
                            border: "1px solid #1d4ed8",
                            background: isSaving ? "#93c5fd" : "#2563eb",
                            color: "#ffffff",
                            borderRadius: 8,
                            padding: "8px 10px",
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
