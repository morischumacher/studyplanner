export default function PlannerNotifications({
    focusPrefillPrompt,
    onApplyFocusPrefill,
    onDismissFocusPrefill,
    shouldOfferInitialBachelorPrefill,
    shouldOfferInitialMasterPrefill,
    programCode,
    bachelorProgramCode,
    selectedFocus,
    onApplyInitialPrefill,
    onDismissInitialPrefill,
    progressMilestoneText,
}) {
    const prefillPromptNode = focusPrefillPrompt ? (
        <div
            style={{
                position: "fixed",
                top: 64,
                right: 12,
                zIndex: 35,
                border: "1px solid #bfdbfe",
                background: "#eff6ff",
                borderRadius: 10,
                padding: 12,
                width: 360,
                display: "grid",
                gap: 8,
            }}
        >
            <div style={{ fontSize: 13, color: "#1e3a8a", fontWeight: 700 }}>
                Focus changed to "{focusPrefillPrompt.focus || "No focus area"}".
            </div>
            <div style={{ fontSize: 12, color: "#1e40af" }}>
                Apply the prebuilt bachelor plan for this focus area?
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button
                    onClick={() => onApplyFocusPrefill(focusPrefillPrompt.focus)}
                    style={{
                        border: "1px solid #60a5fa",
                        background: "#dbeafe",
                        color: "#1e3a8a",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    Apply prebuilt plan
                </button>
                <button
                    onClick={onDismissFocusPrefill}
                    style={{
                        border: "1px solid #93c5fd",
                        background: "#ffffff",
                        color: "#1e3a8a",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Keep current plan
                </button>
            </div>
        </div>
    ) : ((shouldOfferInitialBachelorPrefill || shouldOfferInitialMasterPrefill) ? (
        <div
            style={{
                position: "fixed",
                top: 64,
                right: 12,
                zIndex: 35,
                border: "1px solid #bbf7d0",
                background: "#f0fdf4",
                borderRadius: 10,
                padding: 12,
                width: 360,
                display: "grid",
                gap: 8,
            }}
        >
            <div style={{ fontSize: 13, color: "#14532d", fontWeight: 700 }}>
                {programCode === bachelorProgramCode ? "No bachelor courses are planned yet." : "No master courses are planned yet."}
            </div>
            <div style={{ fontSize: 12, color: "#166534" }}>
                {programCode === bachelorProgramCode
                    ? "Do you want to fill the table with the prebuilt bachelor plan?"
                    : "Do you want to fill the table with the prebuilt master plan?"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
                <button
                    onClick={() => onApplyInitialPrefill(programCode === bachelorProgramCode ? selectedFocus : null)}
                    style={{
                        border: "1px solid #86efac",
                        background: "#dcfce7",
                        color: "#166534",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 700,
                        cursor: "pointer",
                    }}
                >
                    Fill with prebuilt plan
                </button>
                <button
                    onClick={onDismissInitialPrefill}
                    style={{
                        border: "1px solid #86efac",
                        background: "#ffffff",
                        color: "#166534",
                        borderRadius: 8,
                        padding: "6px 10px",
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    Not now
                </button>
            </div>
        </div>
    ) : null);

    const progressMilestoneNode = progressMilestoneText ? (
        <div
            style={{
                position: "fixed",
                top: 64,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 34,
                border: "1px solid #86efac",
                background: "#ecfdf5",
                borderRadius: 10,
                padding: "8px 12px",
                fontSize: 12,
                color: "#166534",
                fontWeight: 700,
                boxShadow: "0 6px 18px rgba(16, 185, 129, 0.25)",
            }}
        >
            {progressMilestoneText}
        </div>
    ) : null;

    return (
        <>
            {prefillPromptNode}
            {progressMilestoneNode}
        </>
    );
}
