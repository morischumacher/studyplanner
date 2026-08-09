import { useState, useRef } from "react";

/**
 * State and refs for the planner's transient feedback banners: the sticky
 * rule-violation notice and the progress-milestone toast, plus the refs used to
 * debounce milestone and rule-success notifications.
 *
 * Extracted verbatim from App.jsx as part of the incremental decomposition of
 * that component. Only the state and refs are relocated; the effects that drive
 * these banners remain in App for now, since they depend on derived KPI and
 * rule-check state. Every value is returned under its original name so existing
 * call sites and effect dependencies are unchanged. Behaviour is identical.
 */
export function useTransientFeedback() {
    const [stickyViolation, setStickyViolation] = useState({ message: "", until: 0, tone: "" });
    const [progressMilestone, setProgressMilestone] = useState({ text: "", until: 0 });
    const progressMilestoneRef = useRef({ programCode: null, pct: 0 });
    const successFeedbackSignatureRef = useRef("");

    return {
        stickyViolation, setStickyViolation,
        progressMilestone, setProgressMilestone,
        progressMilestoneRef,
        successFeedbackSignatureRef,
    };
}
