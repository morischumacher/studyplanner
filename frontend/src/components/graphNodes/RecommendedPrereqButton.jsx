import React from "react";

/**
 * Reveals one node's expected prior knowledge.
 *
 * The curriculum states expected knowledge per module, so there are as many of
 * these relations as there are modules that declare any. Drawing them all at once
 * would bury the containment tree the graph is for, so each node reveals its own
 * and the reader assembles the picture they actually want. The button appears
 * only on a node that has something to reveal: an inert control on every card
 * would say the opposite of what is true.
 */
export default function RecommendedPrereqButton({ nodeId, data, accentColor = "#4338ca" }) {
    const count = Number(data?.recommendedPrereqCount ?? 0);
    const onToggle = data?.onToggleRecommendedPrereqs;
    if (!count || typeof onToggle !== "function") return null;

    const isOn = Boolean(data?.showsRecommendedPrereqs);
    const label = `${isOn ? "Hide" : "Show"} expected knowledge (${count})`;

    return (
        <button
            onClick={(e) => {
                e.stopPropagation();
                onToggle(nodeId);
            }}
            title={label}
            aria-label={label}
            aria-pressed={isOn}
            data-testid="recommended-prereq-toggle"
            style={{
                border: `1px solid ${accentColor}`,
                background: isOn ? accentColor : "#ffffff",
                color: isOn ? "#ffffff" : accentColor,
                borderRadius: 6,
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.4,
                padding: "1px 6px",
                cursor: "pointer",
            }}
        >
            ⇠{count}
        </button>
    );
}
