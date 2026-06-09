import React, { useState, useEffect, useRef } from "react";

const TOUR_STEPS = [
    {
        index: 0,
        view: "table",
        targetId: "course-catalog-sidebar",
        title: "1. Explore the Curriculum",
        content: "Welcome to your Study Planner! Let's start by looking at all available courses. Explore subjects, modules, and stand-alone courses inside the Course Catalog sidebar.",
        placement: "right"
    },
    {
        index: 1,
        view: "table",
        targetId: "parking-stage-lane",
        title: "2. Shortlist Courses",
        content: "Found a course you like? Drag it into the Parking Stage to shortlist it. This lets you collect interesting courses before deciding which semester to take them.",
        placement: "right"
    },
    {
        index: 2,
        view: "table",
        targetId: "semester-lane-1",
        title: "3. Plan Semesters",
        content: "Drag courses from the catalog or Parking Stage into a specific Semester Lane. The app automatically calculates semester workload and checks curriculum rules in real time.",
        placement: "bottom"
    },
    {
        index: 3,
        view: "table",
        targetId: ".study-planner-course-card",
        title: "4. Course Card Controls",
        content: "Each card in your plan has actions: Click 'i' for details (to edit notes, estimated hours, and grades), click the Checkmark to mark it done, or click '×' to remove it.",
        placement: "right"
    },
    {
        index: 4,
        view: "table",
        targetId: "#table-semantics-edit-btn",
        title: "5. Layout Semantics & Sorting",
        content: "Click 'Edit' on this bottom pill to define the vertical ordering meaning (e.g. sort courses inside semester lanes Alphabetically or by ECTS weight dynamically).",
        placement: "top"
    },
    {
        index: 5,
        view: "table",
        targetId: "#open-recommendations-btn",
        title: "6. Recommendations (Show Panel)",
        content: "Click the Recommendations button here to toggle the smart course suggestions panel.",
        placement: "bottom"
    },
    {
        index: 6,
        view: "table",
        targetId: "#recommendation-panel-container",
        title: "7. Evidenced Recommendations",
        content: "The Recommendations Panel is now open! Based on your plan and career interests, it suggests rule-compliant courses, complete with explanations of why each suggestion is recommended.",
        placement: "right"
    },
    {
        index: 7,
        view: "table",
        targetId: "#open-dashboard-btn",
        title: "8. Dashboard (Open Panel)",
        content: "Click the Dashboard button here to toggle your progress stats panel.",
        placement: "bottom"
    },
    {
        index: 8,
        view: "table",
        targetId: "#planner-dashboard-container",
        title: "9. Dashboard & Rulechecking",
        content: "The Dashboard is now open! Monitor your credit progress. Use the 'Planned' and 'Done' tabs to check off specific curriculum requirements as you progress.",
        placement: "left"
    },
    {
        index: 9,
        view: "table",
        targetId: "#open-profile-btn",
        title: "10. Profile Settings (Open Modal)",
        content: "Click the Profile button in the top-right header to configure your program settings.",
        placement: "bottom-left"
    },
    {
        index: 10,
        view: "table",
        targetId: "#profile-modal-container",
        title: "11. Profile Settings",
        content: "The Profile modal is now open! Configure your academic program, specialization focus, start term, ECTS/workload limits, and enter career interests to refine your recommendations. You can also click the 'Course availability' button at the top to override which terms (Winter, Summer, or Both) specific courses are offered in.",
        placement: "right"
    },
    {
        index: 11,
        view: "table",
        targetId: ".react-flow__controls",
        title: "12. Canvas Navigation",
        content: "Use the controls in the bottom-left corner to zoom in/out, fit to view, toggle selection mode, or open the visual color legend. Pro Tip: You can also select multiple courses by holding Shift and dragging a selection box with your left mouse button.",
        placement: "right"
    },
    {
        index: 12,
        view: "table",
        targetId: "#toggle-view-mode-btn",
        title: "13. Switch to Graph View",
        content: "Now let's switch to the Graph View to see a visual map of the curriculum's structure.",
        placement: "right"
    },
    {
        index: 13,
        view: "graph",
        targetId: "#graph-flow-container",
        title: "14. What is this view for?",
        content: "Welcome to the Graph View! This view maps the hierarchical layout of your curriculum. You can click on any subject or module node (marked with a ▶ or ▼) to expand or collapse its children to explore the structures.",
        placement: "center"
    },
    {
        index: 14,
        view: "graph",
        targetId: "#graph-filters-panel",
        title: "15. Graph Filters & Search",
        content: "Use this panel to filter nodes by obligation type, course type, progress status, term availability, or ECTS weight bounds, and search for specific courses.",
        placement: "right"
    },
    {
        index: 15,
        view: "graph",
        targetId: "#graph-interaction-instructions",
        title: "16. Align, Expand & Collapse",
        content: "Use these controls to adjust the layout: 'Align' resets the node positions, 'Expand' opens all subjects and module groups, and 'Collapse' folds them to tidy up your view.",
        placement: "bottom-left"
    },
    {
        index: 16,
        view: "graph",
        targetId: "#open-tour-btn",
        title: "17. Repeat Anytime",
        content: "You're all set! If you ever need a refresher, just click the Help button here to repeat the tour at any time.",
        placement: "bottom-left"
    }
];

export default function OnboardingTour({ activeStep, setActiveStep, viewMode, setViewMode, disableGraphView = false, username, onClose }) {
    const [coords, setCoords] = useState(null);
    const [tooltipHeight, setTooltipHeight] = useState(160);
    const updateTimerRef = useRef(null);
    const tooltipRef = useRef(null);

    const steps = React.useMemo(() => {
        if (disableGraphView) {
            const tableSteps = TOUR_STEPS.filter(
                (step) => step.view === "table" && step.targetId !== "#toggle-view-mode-btn"
            );
            const mapped = tableSteps.map((step, idx) => ({
                ...step,
                index: idx
            }));
            mapped.push({
                index: mapped.length,
                view: "table",
                targetId: "#open-tour-btn",
                title: `${mapped.length + 1}. Repeat Anytime`,
                content: "You're all set! If you ever need a refresher, just click the Help button here to repeat the tour at any time.",
                placement: "bottom-left"
            });
            return mapped;
        }
        return TOUR_STEPS;
    }, [disableGraphView]);

    const stepData = steps[activeStep];

    const recalculatePosition = () => {
        if (!stepData) return;

        if (tooltipRef.current) {
            const h = tooltipRef.current.offsetHeight;
            if (h > 0 && h !== tooltipHeight) {
                setTooltipHeight(h);
            }
        }

        if (stepData.placement === "center") {
            setCoords({
                top: window.innerHeight / 2,
                left: window.innerWidth / 2,
                width: 0,
                height: 0,
                isCenter: true
            });
            return;
        }

        const el = (stepData.targetId.startsWith(".") || stepData.targetId.startsWith("#"))
            ? document.querySelector(stepData.targetId)
            : document.getElementById(stepData.targetId);
        if (!el) {
            // Target not found on page, retry soon
            return;
        }

        const rect = el.getBoundingClientRect();
        setCoords({
            top: rect.top + window.scrollY,
            left: rect.left + window.scrollX,
            width: rect.width,
            height: rect.height,
            isCenter: false
        });
    };

    useEffect(() => {
        if (tooltipRef.current) {
            const h = tooltipRef.current.offsetHeight;
            if (h > 0) {
                setTooltipHeight(h);
            }
        }
    }, [activeStep]);

    useEffect(() => {
        recalculatePosition();
        window.addEventListener("resize", recalculatePosition);
        window.addEventListener("scroll", recalculatePosition);

        // Periodically check in case sidebar opens or DOM updates
        updateTimerRef.current = setInterval(recalculatePosition, 300);

        return () => {
            window.removeEventListener("resize", recalculatePosition);
            window.removeEventListener("scroll", recalculatePosition);
            if (updateTimerRef.current) clearInterval(updateTimerRef.current);
        };
    }, [activeStep, stepData, tooltipHeight]);

    // Automatically transition viewMode if step view differs
    useEffect(() => {
        if (stepData && stepData.view !== viewMode) {
            setViewMode(stepData.view);
        }
    }, [activeStep, stepData, viewMode, setViewMode]);

    if (!stepData || !coords) return null;

    const handleNext = () => {
        if (activeStep < steps.length - 1) {
            setActiveStep(activeStep + 1);
        } else {
            handleComplete();
        }
    };

    const handleBack = () => {
        if (activeStep > 0) {
            setActiveStep(activeStep - 1);
        }
    };

    const handleSkip = () => {
        handleComplete();
    };

    const handleComplete = () => {
        const completedKey = username ? "study-planner-tour-completed-" + username : "study-planner-tour-completed";
        localStorage.setItem(completedKey, "true");
        onClose();
    };

    // Calculate tooltip bubble styling based on placement
    const getTooltipStyle = () => {
        const gap = 12;
        const width = 340;
        const style = {
            position: "fixed",
            zIndex: 999999,
            width: width,
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(16px)",
            border: "1px solid rgba(79, 70, 229, 0.2)",
            boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04), 0 0 0 1px rgba(79, 70, 229, 0.05)",
            borderRadius: 16,
            padding: 20,
            display: "grid",
            gap: 12,
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
            boxSizing: "border-box"
        };

        if (coords.isCenter) {
            style.top = "50%";
            style.left = "50%";
            style.transform = "translate(-50%, -50%)";
            return style;
        }

        switch (stepData.placement) {
            case "right":
                style.top = coords.top + coords.height / 2 - tooltipHeight / 2;
                style.left = coords.left + coords.width + gap;
                break;
            case "bottom-left":
                style.top = coords.top + coords.height + gap;
                style.left = coords.left;
                break;
            case "bottom":
                style.top = coords.top + coords.height + gap;
                style.left = coords.left + coords.width / 2 - width / 2;
                break;
            case "left":
                style.top = coords.top + coords.height / 2 - tooltipHeight / 2;
                style.left = coords.left - width - gap;
                break;
            case "top":
            default:
                style.top = coords.top - tooltipHeight - gap;
                style.left = coords.left + coords.width / 2 - width / 2;
                break;
        }

        // Clamp to screen bounds
        style.top = Math.max(16, Math.min(window.innerHeight - tooltipHeight - 16, style.top));
        style.left = Math.max(16, Math.min(window.innerWidth - width - 16, style.left));

        return style;
    };

    return (
        <>
            {/* Overlay Mask */}
            <div
                style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(15, 23, 42, 0.25)",
                    zIndex: 999997,
                    pointerEvents: "auto"
                }}
                onClick={handleSkip}
            />

            {/* Target Element Highlighter Cutout */}
            {!coords.isCenter && (
                <div
                    style={{
                        position: "fixed",
                        top: coords.top - 6,
                        left: coords.left - 6,
                        width: coords.width + 12,
                        height: coords.height + 12,
                        borderRadius: 8,
                        boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.45)",
                        border: "2px solid #4f46e5",
                        zIndex: 999998,
                        pointerEvents: "none",
                        transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)"
                    }}
                >
                    {/* Animated Pulsing Ring */}
                    <div
                        style={{
                            position: "absolute",
                            inset: -8,
                            borderRadius: 12,
                            border: "3px solid rgba(79, 70, 229, 0.4)",
                            animation: "onboarding-pulse 2s infinite"
                        }}
                    />
                    <style>{`
                        @keyframes onboarding-pulse {
                            0% { transform: scale(0.95); opacity: 1; }
                            100% { transform: scale(1.15); opacity: 0; }
                        }
                    `}</style>
                </div>
            )}

            {/* Floating Tooltip Bubble */}
            <div ref={tooltipRef} style={getTooltipStyle()}>
                <div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#4f46e5", marginBottom: 4 }}>
                        {stepData.title}
                    </div>
                    <div style={{ fontSize: 13, color: "#4b5563", lineHeight: 1.5 }}>
                        {stepData.content}
                    </div>
                </div>

                {/* Progress Indicators */}
                <div style={{ display: "flex", gap: 4, justifyContent: "center", width: "100%" }}>
                    {steps.map((step) => (
                        <div
                            key={step.index}
                            style={{
                                flex: 1,
                                height: 4,
                                borderRadius: 99,
                                background: step.index === activeStep ? "#4f46e5" : "#e5e7eb",
                                transition: "background 0.2s"
                            }}
                        />
                    ))}
                </div>

                {/* Control Actions */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                    <button
                        onClick={handleSkip}
                        style={{
                            background: "none",
                            border: "none",
                            padding: "6px 0",
                            fontSize: 12,
                            color: "#9ca3af",
                            fontWeight: 600,
                            cursor: "pointer"
                        }}
                    >
                        Skip
                    </button>
                    <div style={{ display: "flex", gap: 8 }}>
                        {activeStep > 0 && (
                            <button
                                onClick={handleBack}
                                style={{
                                    border: "1px solid #d1d5db",
                                    background: "#ffffff",
                                    borderRadius: 8,
                                    padding: "6px 12px",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    color: "#4b5563",
                                    cursor: "pointer"
                                }}
                            >
                                Back
                            </button>
                        )}
                        <button
                            onClick={handleNext}
                            style={{
                                background: "#4f46e5",
                                color: "#ffffff",
                                border: "none",
                                borderRadius: 8,
                                padding: "6px 16px",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                boxShadow: "0 2px 4px rgba(79, 70, 229, 0.2)"
                            }}
                        >
                            {activeStep === steps.length - 1 ? "Finish" : "Next"}
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
}
