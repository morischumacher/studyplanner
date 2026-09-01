/**
 * The thin bar under each of the two headline figures.
 *
 * The percentage is clamped here rather than by the caller, because the same
 * bar is fed both a share of a target and a share that can overshoot it.
 */

export interface KpiProgressBarProps {
    pct: number;
    color: string;
}

export default function KpiProgressBar({ pct, color }: KpiProgressBarProps) {
    return (
        <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: "#e5e7eb", overflow: "hidden" }}>
            <div style={{ width: `${Math.max(0, Math.min(100, Number(pct) || 0))}%`, height: "100%", background: color }} />
        </div>
    );
}
