import React, { useEffect, useState } from "react";
import {
    hexToRgba,
    MODULE_GROUP_COLOR_ALPHA,
} from "../utils/examSubjectColors.js";
import {
    combinedCardShadow,
    layeredTypeShadow,
    mapTypeForProgram,
    stateVisualByStatus,
} from "../utils/courseVisuals.js";

/** Sidebar — catalog + drag sources */
export default function Sidebar({
    catalog,
    loading,
    error,
    expandedSet,
    togglePf,
    onDragStart,
    subjectColors,
    programCode,
    onProgramChange,
    programOptions,
    selectedFocus,
    setSelectedFocus,
    bachelorProgramCode,
    bachelorFocusOptions,
    getCourseStatus,
    onAddCourseToPlan,
    onAddModuleToPlan,
    onToggleCourseDone,
    onToggleModuleDone,
    onRemoveCourseFromPlan,
    onRemoveModuleFromPlan,
    semesterOptions,
}) {
    const [menuState, setMenuState] = useState({ key: null, view: "root" });
    const [plusRevealCount, setPlusRevealCount] = useState(0);
    const semesters = Array.isArray(semesterOptions) ? semesterOptions : [];

    const openMenu = (key) => {
        setPlusRevealCount(0);
        setMenuState({ key, view: "root" });
    };
    const closeMenu = () => {
        setPlusRevealCount(0);
        setMenuState({ key: null, view: "root" });
    };
    const gotoSemesters = (key) => {
        setPlusRevealCount(0);
        setMenuState({ key, view: "semesters" });
    };
    const semesterButtonLabel = (semester) => (semester?.isPlus ? `+ ${semester.title}` : semester?.title);
    const baseSemesters = semesters.filter((s) => !s?.isPlus);
    const plusSemesters = semesters.filter((s) => s?.isPlus);
    const visibleSemesters = [...baseSemesters, ...plusSemesters.slice(0, plusRevealCount)];
    const canRevealMoreSemesters = plusRevealCount < plusSemesters.length;
    useEffect(() => {
        if (!menuState?.key) return;
        const isInsideOpenMenuContext = (node) => {
            let current = node;
            while (current && current !== document.body) {
                if (typeof current.getAttribute === "function") {
                    const key = current.getAttribute("data-sidebar-menu-key");
                    if (key && key === menuState.key) return true;
                }
                current = current.parentElement;
            }
            return false;
        };
        const onPointerDown = (event) => {
            if (isInsideOpenMenuContext(event?.target)) return;
            closeMenu();
        };
        document.addEventListener("mousedown", onPointerDown);
        return () => document.removeEventListener("mousedown", onPointerDown);
    }, [menuState?.key]);

    const statusLabel = (status) => {
        if (status === "done") return "done";
        if (status === "in_plan") return "planned";
        return "not planned";
    };

    const statusStyle = (status) => {
        if (status === "done") return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
        if (status === "in_plan") return { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" };
        return { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" };
    };

    const moduleStatus = (codes) => {
        if (!codes.length) return "todo";
        const statuses = codes.map((code) => getCourseStatus?.(code) ?? "todo");
        if (statuses.every((s) => s === "done")) return "done";
        if (statuses.some((s) => s === "in_plan" || s === "done")) return "in_plan";
        return "todo";
    };

    const isBlockedStatus = (status) => status === "done" || status === "in_plan";
    const modulePriority = (mod) => {
        const raw = String(mod?.category ?? "").trim().toLowerCase();
        const isMandatory =
            Boolean(mod?.is_mandatory) ||
            raw === "mandatory" ||
            raw === "pflicht" ||
            raw === "required";
        if (isMandatory) return 0;
        const isCore =
            raw === "core" ||
            raw === "narrow_elective" ||
            raw === "narrow" ||
            raw === "enge wahl";
        if (isCore) return 1;
        return 2;
    };
    return (
        <aside
            style={{
                width: 280,
                background: "#fff",
                borderRight: "1px solid #e5e7eb",
                padding: 16,
                overflow: "auto",
            }}
        >
            <div style={{ fontSize: 18, fontWeight: 600 }}>Course Catalog</div>
            <div
                style={{
                    display: "grid",
                    gap: 8,
                    margin: "10px 0 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: 10,
                    background: "#f9fafb",
                    padding: 10,
                    width: "100%",
                    boxSizing: "border-box",
                }}
            >
                <div style={{ display: "grid", gap: 6 }}>
                    <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Study Program</label>
                    <select
                        value={programCode}
                        onChange={(e) => onProgramChange?.(e.target.value)}
                        style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "8px 10px",
                            background: "#fff",
                            fontSize: 14,
                            width: "100%",
                            maxWidth: "100%",
                            minWidth: 0,
                            boxSizing: "border-box",
                            display: "block",
                        }}
                    >
                        {(programOptions || []).map((opt) => (
                            <option key={opt.code} value={opt.code}>
                                {opt.label} ({opt.code})
                            </option>
                        ))}
                    </select>
                </div>
                {programCode === bachelorProgramCode && (
                    <div style={{ display: "grid", gap: 6 }}>
                        <label style={{ fontSize: 12, color: "#6b7280", fontWeight: 600 }}>Focus Area (Bachelor)</label>
                        <select
                            value={selectedFocus || ""}
                            onChange={(e) => setSelectedFocus?.(e.target.value)}
                            style={{
                                border: "1px solid #d1d5db",
                                borderRadius: 8,
                                padding: "8px 10px",
                                background: "#fff",
                                fontSize: 13,
                                width: "100%",
                                maxWidth: "100%",
                                minWidth: 0,
                                boxSizing: "border-box",
                                display: "block",
                            }}
                        >
                            <option value="">Select focus area</option>
                            {(bachelorFocusOptions || []).map((focus) => (
                                <option key={focus} value={focus}>
                                    {focus}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
            <p style={{ fontSize: 14, color: "#6b7280" }}>
                Drag a course or a multi-course module into any semester lane.
            </p>

            {!(Array.isArray(catalog) && catalog.length > 0) && (
                <div style={{ fontSize: 14, color: "#6b7280", margin: "8px 0 12px" }}>
                    {loading ? "Lade Katalog ..." : (error ? `Fehler beim Laden: ${error}` : "Kein Katalog gefunden.")}
                </div>
            )}

            <div style={{ display: "grid", gap: 10 }}>
                {(Array.isArray(catalog) ? catalog : []).map((pf, pfIdx) => {
                    const pfName = pf.pruefungsfach ?? `Prüfungsfach ${pfIdx + 1}`;
                    const modules = (Array.isArray(pf.modules) ? pf.modules : [])
                        .slice()
                        .sort((a, b) => {
                            const pa = modulePriority(a);
                            const pb = modulePriority(b);
                            if (pa !== pb) return pa - pb;
                            const an = String(a?.name ?? "").toLowerCase();
                            const bn = String(b?.name ?? "").toLowerCase();
                            return an.localeCompare(bn);
                        });
                    const isOpen = expandedSet.has(pfName);
                    const subjectColor = subjectColors?.[pfName] ?? "#2563eb";
                    const subjectSoft = hexToRgba(subjectColor, 0.22);
                    const moduleColor = hexToRgba(subjectColor, MODULE_GROUP_COLOR_ALPHA);

                    return (
                        <div
                            key={`pf-${pfIdx}`}
                            style={{
                                border: `2px solid ${subjectColor}`,
                                borderRadius: 12,
                                background: "#fff",
                                overflow: "visible",
                            }}
                        >
                            {/* Header */}
                            <button
                                onClick={() => togglePf(pfName)}
                                style={{
                                    width: "100%",
                                    textAlign: "left",
                                    padding: "10px 12px",
                                    background: subjectColor,
                                    border: "none",
                                    borderBottom: `1px solid ${subjectColor}`,
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    cursor: "pointer",
                                    borderTopLeftRadius: 10,
                                    borderTopRightRadius: 10,
                                    borderBottomLeftRadius: isOpen ? 0 : 10,
                                    borderBottomRightRadius: isOpen ? 0 : 10,
                                }}
                                aria-expanded={isOpen}
                            >
                <span
                    aria-hidden
                    style={{
                        display: "inline-block",
                        transform: `rotate(${isOpen ? 90 : 0}deg)`,
                        transition: "transform 0.15s ease",
                        color: "#ffffff",
                        fontWeight: 700,
                    }}
                >
                  ▶
                </span>
                                <span style={{ fontWeight: 700, color: "#ffffff" }}>{pfName}</span>
                                <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
                  {modules.length} Module
                </span>
                            </button>

                            {/* Body */}
                            {isOpen && (
                                <div style={{ padding: "8px 10px 12px 10px", display: "grid", gap: 8, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                                    {modules.map((mod, modIdx) => {
                                        const courses = Array.isArray(mod.courses) ? mod.courses : [];
                                        const moduleCodeFallback = String(mod?.code || `MOD-${pfIdx + 1}-${modIdx + 1}`);
                                        const moduleEctsFallback = Number(mod?.ects);
                                        const resolvedModuleEcts = Number.isFinite(moduleEctsFallback) && moduleEctsFallback > 0 ? moduleEctsFallback : 1;

                                        // Case A: module without child courses (e.g. Transferable Skills)
                                        if (courses.length === 0) {
                                            const standaloneLabel = String(mod?.name || "").toLowerCase();
                                            const standaloneCategory = String(mod?.category || "").toLowerCase();
                                            const isTransferableStandalone =
                                                standaloneCategory.includes("transferable") ||
                                                standaloneCategory.includes("ts") ||
                                                standaloneLabel.includes("transferable");
                                            const plannedEntryEcts = isTransferableStandalone ? 9 : resolvedModuleEcts;
                                            const standaloneStatus = getCourseStatus?.(moduleCodeFallback) ?? "todo";
                                            const style = statusStyle(standaloneStatus);
                                            const typeMeta = mapTypeForProgram(mod?.category, programCode);
                                            const stateMeta = stateVisualByStatus(standaloneStatus);
                                            const typeShadow = layeredTypeShadow(subjectColor, typeMeta.layers, stateMeta.background || "transparent");
                                            const menuKey = `module-standalone-${pfIdx}-${moduleCodeFallback}-${modIdx}`;
                                            const standalonePayload = {
                                                kind: "module_standalone",
                                                code: moduleCodeFallback,
                                                name: mod?.name || moduleCodeFallback,
                                                ects: plannedEntryEcts,
                                                category: mod?.category ?? "transferable_skills",
                                                subjectColor,
                                                moduleMeta: {
                                                    id: `module-standalone-${moduleCodeFallback}`,
                                                    title: mod?.name || moduleCodeFallback,
                                                    examSubject: pfName,
                                                    category: mod?.category ?? "transferable_skills",
                                                    subjectColor,
                                                    code: mod?.code ?? moduleCodeFallback,
                                                    ects: resolvedModuleEcts,
                                                },
                                            };
                                            return (
                                                <div
                                                    key={menuKey}
                                                    data-sidebar-menu-key={menuKey}
                                                    draggable={standaloneStatus === "todo"}
                                                    onDragStart={(e) => {
                                                        if (standaloneStatus !== "todo") return;
                                                        onDragStart(e, standalonePayload);
                                                    }}
                                                    title="Drag into the graph"
                                                    style={{
                                                        textAlign: "left",
                                                        border: `1px solid ${stateMeta.borderColor || subjectColor}`,
                                                        borderRadius: 12,
                                                        background: stateMeta.background,
                                                        boxShadow: combinedCardShadow(typeShadow, stateMeta.extraShadow),
                                                        padding: "12px 12px",
                                                        cursor: standaloneStatus === "todo" ? "grab" : "default",
                                                        opacity: stateMeta.opacity,
                                                        display: "grid",
                                                        gap: 8,
                                                        position: "relative",
                                                        zIndex: menuState.key === menuKey ? 20 : 1,
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        minWidth: 0,
                                                        overflow: "visible",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                        <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                                            {moduleCodeFallback}
                                                        </div>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                            {(standaloneStatus === "in_plan" || standaloneStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleCourseDone?.(moduleCodeFallback, standaloneStatus !== "done");
                                                                    }}
                                                                    style={{ border: `1px solid ${standaloneStatus === "done" ? "#9ca3af" : subjectColor}`, background: standaloneStatus === "done" ? "#10b981" : hexToRgba(subjectColor, 0.08), color: standaloneStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (menuState.key === menuKey) closeMenu();
                                                                    else openMenu(menuKey);
                                                                }}
                                                                style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                            >
                                                                ...
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {menuState.key === menuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 2000 }}>
                                                            {menuState.view === "root" && standaloneStatus === "todo" && (
                                                                <button onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                            )}
                                                            {menuState.view === "root" && (standaloneStatus === "in_plan" || standaloneStatus === "done") && (
                                                                <button onClick={(e) => { e.stopPropagation(); onRemoveCourseFromPlan?.(moduleCodeFallback); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                            )}
                                                            {menuState.view === "semesters" && (
                                                                <>
                                                                    {visibleSemesters.map((semester) => (
                                                                        <button key={semester.id} onClick={(e) => { e.stopPropagation(); onAddCourseToPlan?.(standalonePayload, semester.id - 1, { allowDirectLaneSelection: true }); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{semesterButtonLabel(semester)}</button>
                                                                    ))}
                                                                    {canRevealMoreSemesters && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                            style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                        >
                                                                            + Add next semester
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); openMenu(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: standaloneStatus === "done" ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{mod.name}</div>
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                                                        <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{plannedEntryEcts ? `${plannedEntryEcts} ECTS` : "-"}</span>
                                                        <span style={{ color: "#6b7280", fontWeight: 700, flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeMeta.label}</span>
                                                        <span style={{ color: style.color, fontWeight: 700, whiteSpace: "nowrap" }}>{statusLabel(standaloneStatus)}</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Case B: single course → drag that one (use the course's code!)
                                        if (courses.length === 1) {
                                            const course = courses[0] ?? {};
                                            const courseStatus = getCourseStatus?.(course.code ?? mod.code) ?? "todo";
                                            const style = statusStyle(courseStatus);
                                            const blocked = isBlockedStatus(courseStatus);
                                            const typeMeta = mapTypeForProgram(mod?.category, programCode);
                                            const stateMeta = stateVisualByStatus(courseStatus);
                                            const typeShadow = layeredTypeShadow(subjectColor, typeMeta.layers, stateMeta.background || "transparent");
                                            const menuKey = `single-${pfIdx}-${mod.code || course.code || modIdx}`;
                                            return (
                                                <div
                                                    key={menuKey}
                                                    data-sidebar-menu-key={menuKey}
                                                    draggable={courseStatus === "todo"}
                                                    onDragStart={(e) => {
                                                        if (courseStatus !== "todo") return;
                                                        onDragStart(e, {
                                                            kind: "course",
                                                            code: course.code ?? mod.code,
                                                            name: course.name ?? mod.name,
                                                            ects: course.ects ?? mod.ects ?? null,
                                                            category: mod?.category ?? null,
                                                            subjectColor,
                                                        });
                                                    }}
                                                    title="Drag into the graph"
                                                    style={{
                                                        textAlign: "left",
                                                        border: `1px solid ${stateMeta.borderColor || subjectColor}`,
                                                        borderRadius: 12,
                                                        background: stateMeta.background,
                                                        boxShadow: combinedCardShadow(typeShadow, stateMeta.extraShadow),
                                                        padding: "12px 12px",
                                                        cursor: courseStatus === "todo" ? "grab" : "default",
                                                        opacity: stateMeta.opacity,
                                                        display: "grid",
                                                        gap: 8,
                                                        position: "relative",
                                                        zIndex: menuState.key === menuKey ? 20 : 1,
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        minWidth: 0,
                                                        overflow: "visible",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                        <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                                                            {course.code ?? mod.code}
                                                        </div>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                            {(courseStatus === "in_plan" || courseStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleCourseDone?.(course.code ?? mod.code, courseStatus !== "done");
                                                                    }}
                                                                    style={{ border: `1px solid ${courseStatus === "done" ? "#9ca3af" : subjectColor}`, background: courseStatus === "done" ? "#10b981" : hexToRgba(subjectColor, 0.08), color: courseStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (menuState.key === menuKey) closeMenu();
                                                                    else openMenu(menuKey);
                                                                }}
                                                                style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                            >
                                                                ...
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {menuState.key === menuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 2000 }}>
                                                            {menuState.view === "root" && courseStatus === "todo" && (
                                                                <button onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                            )}
                                                            {menuState.view === "root" && (courseStatus === "in_plan" || courseStatus === "done") && (
                                                                <button onClick={(e) => { e.stopPropagation(); onRemoveCourseFromPlan?.(course.code ?? mod.code); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                            )}
                                                            {menuState.view === "semesters" && (
                                                                <>
                                                                    {visibleSemesters.map((semester) => (
                                                                        <button key={semester.id} onClick={(e) => { e.stopPropagation(); onAddCourseToPlan?.({ code: course.code ?? mod.code, name: course.name ?? mod.name, ects: course.ects ?? mod.ects ?? null, category: mod?.category ?? null, subjectColor }, semester.id - 1, { allowDirectLaneSelection: true }); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{semesterButtonLabel(semester)}</button>
                                                                    ))}
                                                                    {canRevealMoreSemesters && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                            style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                        >
                                                                            + Add next semester
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); openMenu(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: courseStatus === "done" ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{course.name ?? mod.name}</div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            gap: 8,
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{(course.ects ?? mod.ects) ? `${course.ects ?? mod.ects} ECTS` : "-"}</span>
                                                        <span style={{ color: "#6b7280", fontWeight: 700, flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{typeMeta.label}</span>
                                                        <span style={{ color: style.color, fontWeight: 700, whiteSpace: "nowrap" }}>{statusLabel(courseStatus)}</span>
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Case C: multiple courses → one draggable for the whole module + individual draggables
                                        const modulePayload = {
                                            kind: "module",
                                            code: mod.code,
                                            name: mod.name,
                                            category: mod?.category ?? null,
                                            subjectColor,
                                            courses: courses.map((c) => ({ code: c.code, name: c.name, ects: c.ects ?? null })),
                                        };
                                        const groupStatus = moduleStatus(courses.map((c) => c?.code).filter(Boolean));
                                        const groupVisualStatus = groupStatus === "done" ? "done" : "todo";
                                        const groupStyle = statusStyle(groupStatus);
                                        const groupTypeMeta = mapTypeForProgram(mod?.category, programCode);
                                        const groupStateMeta = stateVisualByStatus(groupVisualStatus);
                                        const groupTypeShadow = layeredTypeShadow(subjectColor, groupTypeMeta.layers, groupStateMeta.background || "transparent");
                                        const groupBorderColor = groupStateMeta.borderColor || subjectColor;
                                        const isGroupDone = groupStatus === "done";
                                        const moduleMenuKey = `module-${pfIdx}-${mod.code || modIdx}`;
                                        const moduleBlocked = courses
                                            .map((c) => getCourseStatus?.(c?.code) ?? "todo")
                                            .some((s) => isBlockedStatus(s));

                                        return (
                                            <div
                                                key={`pf${pfIdx}-${mod.code || modIdx}`}
                                                data-sidebar-menu-key={moduleMenuKey}
                                                style={{
                                                    border: `2px solid ${groupBorderColor}`,
                                                    borderRadius: 12,
                                                    background: "#fff",
                                                    overflow: "visible",
                                                    position: "relative",
                                                    zIndex: menuState.key === moduleMenuKey ? 15 : 1,
                                                }}
                                            >
                                                <div
                                                    draggable={groupStatus === "todo" && !moduleBlocked}
                                                    onDragStart={(e) => {
                                                        if (groupStatus !== "todo" || moduleBlocked) return;
                                                        onDragStart(e, modulePayload);
                                                    }}
                                                    title="Drag the whole module"
                                                    style={{
                                                        width: "100%",
                                                        textAlign: "left",
                                                        border: "none",
                                                        borderBottom: `2px solid ${groupBorderColor}`,
                                                        background: groupVisualStatus === "todo" ? moduleColor : groupStateMeta.background,
                                                        boxShadow: combinedCardShadow(groupTypeShadow, groupStateMeta.extraShadow),
                                                        padding: 12,
                                                        display: "grid",
                                                        gap: 8,
                                                        cursor: groupStatus === "todo" && !moduleBlocked ? "grab" : "default",
                                                        opacity: moduleBlocked ? 0.85 : groupStateMeta.opacity,
                                                        position: "relative",
                                                        boxSizing: "border-box",
                                                        minWidth: 0,
                                                        overflow: "visible",
                                                        borderTopLeftRadius: 10,
                                                        borderTopRightRadius: 10,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                        <div style={{ fontSize: 11, color: isGroupDone ? "#9ca3af" : "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{mod.code}</div>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                            {(groupStatus === "in_plan" || groupStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleModuleDone?.(courses.map((c) => c?.code).filter(Boolean), groupStatus !== "done");
                                                                    }}
                                                                    style={{ border: `1px solid ${groupStatus === "done" ? "#9ca3af" : subjectColor}`, background: groupStatus === "done" ? "#10b981" : hexToRgba(subjectColor, 0.08), color: groupStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    if (menuState.key === moduleMenuKey) closeMenu();
                                                                    else openMenu(moduleMenuKey);
                                                                }}
                                                                style={{ border: `1px solid ${isGroupDone ? "#9ca3af" : subjectColor}`, background: "#fff", color: isGroupDone ? "#6b7280" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                            >
                                                                ...
                                                            </button>
                                                        </div>
                                                    </div>
                                                    {menuState.key === moduleMenuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 2000 }}>
                                                            {menuState.view === "root" && groupStatus === "todo" && (
                                                                <button onClick={(e) => { e.stopPropagation(); gotoSemesters(moduleMenuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                            )}
                                                            {menuState.view === "root" && (groupStatus === "in_plan" || groupStatus === "done") && (
                                                                <button onClick={(e) => { e.stopPropagation(); onRemoveModuleFromPlan?.(modulePayload); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                            )}
                                                            {menuState.view === "semesters" && (
                                                                <>
                                                                    {visibleSemesters.map((semester) => (
                                                                        <button key={semester.id} onClick={(e) => { e.stopPropagation(); onAddModuleToPlan?.(modulePayload, semester.id - 1, { allowDirectLaneSelection: true }); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{semesterButtonLabel(semester)}</button>
                                                                    ))}
                                                                    {canRevealMoreSemesters && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                            style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                        >
                                                                            + Add next semester
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); openMenu(moduleMenuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: isGroupDone ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                                        {mod.name}
                                                    </div>
                                                    <div style={{ color: isGroupDone ? "#9ca3af" : "#6b7280", fontSize: 12 }}>
                                                        {courses.length} Kurse
                                                    </div>
                                                    <div
                                                        style={{
                                                            display: "flex",
                                                            alignItems: "center",
                                                            justifyContent: "space-between",
                                                            gap: 8,
                                                            fontSize: 11,
                                                        }}
                                                    >
                                                        <span style={{ color: isGroupDone ? "#9ca3af" : "#6b7280", whiteSpace: "nowrap" }}>{mod.ects ? `${mod.ects} ECTS` : "-"}</span>
                                                        <span style={{ color: isGroupDone ? "#9ca3af" : "#6b7280", fontWeight: 700, flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{groupTypeMeta.label}</span>
                                                        <span style={{ color: groupStyle.color, fontWeight: 700, whiteSpace: "nowrap" }}>{statusLabel(groupStatus)}</span>
                                                    </div>
                                                </div>

                                                <div style={{ padding: 8, display: "grid", gap: 8 }}>
                                                    {courses.map((course, idx) => {
                                                        const courseStatus = getCourseStatus?.(course?.code ?? mod.code) ?? "todo";
                                                        const courseStyle = statusStyle(courseStatus);
                                                        const childTypeMeta = mapTypeForProgram(mod?.category, programCode);
                                                        const childStateMeta = stateVisualByStatus(courseStatus);
                                                        const childBackground = childStateMeta.background;
                                                        const childTypeShadow = layeredTypeShadow(subjectColor, childTypeMeta.layers, childStateMeta.background || "transparent");
                                                        const menuKey = `child-${pfIdx}-${mod.code}-${idx}`;
                                                        return (
                                                            <div
                                                                key={`pf${pfIdx}-${mod.code}-${idx}`}
                                                                data-sidebar-menu-key={menuKey}
                                                                title="Course in module"
                                                                style={{
                                                                    textAlign: "left",
                                                                    border: `1px solid ${childStateMeta.borderColor || subjectColor}`,
                                                                    borderRadius: 10,
                                                                    background: childBackground,
                                                                    boxShadow: combinedCardShadow(childTypeShadow, childStateMeta.extraShadow),
                                                                    padding: "10px 10px",
                                                                    opacity: childStateMeta.opacity,
                                                                    display: "grid",
                                                                    gap: 8,
                                                                    position: "relative",
                                                                    zIndex: menuState.key === menuKey ? 20 : 1,
                                                                    width: "100%",
                                                                    boxSizing: "border-box",
                                                                    minWidth: 0,
                                                                    overflow: "visible",
                                                                }}
                                                            >
                                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                                    <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>{course?.code ?? mod.code}</div>
                                                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                                                        {(courseStatus === "in_plan" || courseStatus === "done") && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onToggleModuleDone?.(courses.map((c) => c?.code).filter(Boolean), courseStatus !== "done");
                                                                                }}
                                                                                style={{ border: `1px solid ${courseStatus === "done" ? "#9ca3af" : subjectColor}`, background: courseStatus === "done" ? "#10b981" : hexToRgba(subjectColor, 0.08), color: courseStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                            >
                                                                                ✓
                                                                            </button>
                                                                        )}
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (menuState.key === menuKey) closeMenu();
                                                                                else openMenu(menuKey);
                                                                            }}
                                                                            style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                        >
                                                                            ...
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                {menuState.key === menuKey && (
                                                                    <div style={{ position: "absolute", top: 34, right: -8, width: 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 2000 }}>
                                                                        {menuState.view === "root" && courseStatus === "todo" && (
                                                                            <button onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                                        )}
                                                                        {menuState.view === "root" && (courseStatus === "in_plan" || courseStatus === "done") && (
                                                                            <button onClick={(e) => { e.stopPropagation(); onRemoveModuleFromPlan?.(modulePayload); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                                        )}
                                                                        {menuState.view === "semesters" && (
                                                                            <>
                                                                                {visibleSemesters.map((semester) => (
                                                                                    <button key={semester.id} onClick={(e) => { e.stopPropagation(); onAddModuleToPlan?.(modulePayload, semester.id - 1, { allowDirectLaneSelection: true }); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>{semesterButtonLabel(semester)}</button>
                                                                                ))}
                                                                                {canRevealMoreSemesters && (
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                                        style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                                    >
                                                                                        + Add next semester
                                                                                    </button>
                                                                                )}
                                                                                <button onClick={(e) => { e.stopPropagation(); openMenu(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                )}
                                                                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: courseStatus === "done" ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{course?.name ?? mod.name}</div>
                                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, fontSize: 11 }}>
                                                                    <span style={{ color: "#6b7280", whiteSpace: "nowrap" }}>{typeof course?.ects === "number" ? `${course?.ects} ECTS` : (course?.ects || "-")}</span>
                                                                    <span style={{ color: "#6b7280", fontWeight: 700, flex: 1, minWidth: 0, textAlign: "center", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{childTypeMeta.label}</span>
                                                                    <span style={{ color: courseStyle.color, fontWeight: 700, whiteSpace: "nowrap" }}>{statusLabel(courseStatus)}</span>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
