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
    renderRecommendationPatch,
} from "../utils/courseVisuals.js";
import { resolveModuleVariantCourses } from "../domain/prefill/index.ts";
import { displayCourseHeader, displayCourseTitle } from "../domain/course-names.ts";

/** Sidebar — catalog + drag sources */
export default function Sidebar({
    programCode,
    catalog,
    loading,
    error,
    expandedSet,
    togglePf,
    onDragStart,
    subjectColors,
    getCourseStatus,
    onAddCourseToPlan,
    onAddModuleToPlan,
    onToggleCourseDone,
    onToggleModuleDone,
    onRemoveCourseFromPlan,
    onRemoveModuleFromPlan,
    getCourseMeta,
    onUpdateCourseMeta,
    semesterOptions = [],
    getValidSemestersForCourse,
    getValidSemestersForModule,
    termAvailabilityForCode,
    width = 300,
    topOffset = 56,
    bottomOffset = 84,
    leftOffset = 0,
    recommendations = [],
}) {
    const [menuState, setMenuState] = useState({ key: null, view: "root", variantId: null });
    const [plusRevealCount, setPlusRevealCount] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const semesters = Array.isArray(semesterOptions) ? semesterOptions : [];
    const searchNeedle = String(searchQuery || "").trim().toLowerCase();

    const openMenu = (key) => {
        setPlusRevealCount(0);
        setMenuState({ key, view: "root", variantId: null });
    };
    const closeMenu = () => {
        setPlusRevealCount(0);
        setMenuState({ key: null, view: "root", variantId: null });
    };
    const toggleMenuView = (key, view, variantId = null) => {
        setPlusRevealCount(0);
        setMenuState((prev) => {
            const sameKey = prev?.key === key;
            const sameView = prev?.view === view;
            const sameVariant = (prev?.variantId ?? null) === (variantId ?? null);
            if (sameKey && sameView && sameVariant) {
                return { key: null, view: "root", variantId: null };
            }
            return { key, view, variantId };
        });
    };
    const renderCourseDetailsMenu = (courseCode, status, onBack) => {
        const code = String(courseCode || "").trim();
        if (!code) return null;
        const meta = getCourseMeta?.(code) || {};
        const notes = String(meta?.notes ?? "");
        const estimatedHours = String(meta?.estimatedHours ?? "");
        const grade = String(meta?.grade ?? "");
        const isDone = status === "done";
        return (
            <div style={{ display: "grid", gap: 6 }}>
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
                    Notes
                    <textarea
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        value={notes}
                        onChange={(e) => onUpdateCourseMeta?.(code, { notes: e.target.value })}
                        rows={3}
                        placeholder="Add notes"
                        style={{ resize: "vertical", border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                    />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
                    Estimated hours per week
                    <input
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        type="number"
                        min="0"
                        step="1"
                        value={estimatedHours}
                        onChange={(e) => onUpdateCourseMeta?.(code, { estimatedHours: e.target.value })}
                        onWheel={(e) => e.currentTarget.blur()}
                        placeholder="0"
                        style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12 }}
                    />
                </label>
                <label style={{ display: "grid", gap: 4, fontSize: 11, color: "#6b7280" }}>
                    Grade
                    <input
                        draggable={false}
                        onMouseDown={(e) => e.stopPropagation()}
                        onPointerDown={(e) => e.stopPropagation()}
                        type="text"
                        value={grade}
                        onChange={(e) => onUpdateCourseMeta?.(code, { grade: e.target.value })}
                        placeholder={isDone ? "e.g. 1.7" : "Only when done"}
                        disabled={!isDone}
                        style={{ border: "1px solid #d1d5db", borderRadius: 6, padding: "6px 8px", fontSize: 12, background: isDone ? "#ffffff" : "#f3f4f6" }}
                    />
                </label>
                <button onClick={onBack} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
            </div>
        );
    };
    const gotoSemesters = (key, variantId = null) => {
        setPlusRevealCount(0);
        setMenuState({ key, view: "semesters", variantId });
    };
    const semesterButtonLabel = (semester) => (semester?.isPlus ? `+ ${semester.title}` : semester?.title);
    const baseSemesters = semesters.filter((s) => !s?.isPlus);
    const plusSemesters = semesters.filter((s) => s?.isPlus);
    const visibleSemesters = [...baseSemesters, ...plusSemesters.slice(0, plusRevealCount)];
    const canRevealMoreSemesters = plusRevealCount < plusSemesters.length;
    const semestersForCourse = (courseCode) => {
        if (typeof getValidSemestersForCourse !== "function") return visibleSemesters;
        const allowed = getValidSemestersForCourse(courseCode);
        if (!Array.isArray(allowed)) return [];
        const allowedIds = new Set(allowed.map((semester) => Number(semester?.id)).filter(Number.isFinite));
        const visibleIds = new Set(visibleSemesters.map((semester) => Number(semester?.id)).filter(Number.isFinite));
        return allowed.filter((semester) => {
            const id = Number(semester?.id);
            if (!Number.isFinite(id)) return false;
            if (id === 0) return true;
            return visibleIds.has(id) && allowedIds.has(id);
        });
    };
    const semestersForModule = (courses) => {
        if (typeof getValidSemestersForModule !== "function") return visibleSemesters;
        const allowed = getValidSemestersForModule(courses);
        if (!Array.isArray(allowed)) return [];
        const visibleIds = new Set(visibleSemesters.map((semester) => Number(semester?.id)).filter(Number.isFinite));
        return allowed.filter((semester) => {
            if (Boolean(semester?.isParking) || Number(semester?.id) === 0) return true;
            const laneIndex = Number.isFinite(Number(semester?.laneIndex))
                ? Number(semester.laneIndex)
                : (Number.isFinite(Number(semester?.id)) ? (Number(semester.id) - 1) : 0);
            const semesterId = laneIndex + 1;
            return visibleIds.has(semesterId);
        });
    };
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
        if (status === "parked") return "parked";
        return "not planned";
    };

    const statusStyle = (status) => {
        if (status === "done") return { bg: "#dcfce7", color: "#166534", border: "#86efac" };
        if (status === "in_plan") return { bg: "#dbeafe", color: "#1d4ed8", border: "#93c5fd" };
        if (status === "parked") return { bg: "#fef9c3", color: "#854d0e", border: "#fde68a" };
        return { bg: "#f3f4f6", color: "#4b5563", border: "#d1d5db" };
    };

    const moduleStatus = (codes) => {
        if (!codes.length) return "todo";
        const statuses = codes.map((code) => getCourseStatus?.(code) ?? "todo");
        if (statuses.every((s) => s === "done")) return "done";
        if (statuses.some((s) => s === "in_plan" || s === "done")) return "in_plan";
        if (statuses.some((s) => s === "parked")) return "parked";
        return "todo";
    };

    const isBlockedStatus = (status) => status === "done" || status === "in_plan";
    const isAddableStatus = (status) => status === "todo" || status === "parked";
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
    const moduleMatchesQuery = (mod) => {
        if (!searchNeedle) return true;
        const moduleName = String(mod?.name ?? "").toLowerCase();
        const moduleCode = String(mod?.code ?? "").toLowerCase();
        const moduleCategory = String(mod?.category ?? "").toLowerCase();
        if (moduleName.includes(searchNeedle) || moduleCode.includes(searchNeedle) || moduleCategory.includes(searchNeedle)) {
            return true;
        }
        const courses = Array.isArray(mod?.courses) ? mod.courses : [];
        return courses.some((course) => {
            const courseName = String(course?.name ?? "").toLowerCase();
            const courseCode = String(course?.code ?? "").toLowerCase();
            return courseName.includes(searchNeedle) || courseCode.includes(searchNeedle);
        });
    };
    return (
        <aside
            id="course-catalog-sidebar"
            style={{
                width,
                marginTop: topOffset,
                marginBottom: bottomOffset,
                marginLeft: leftOffset,
                height: `calc(100vh - ${topOffset + bottomOffset}px)`,
                alignSelf: "flex-start",
                background: "#fff",
                borderRight: "1px solid #e5e7eb",
                padding: 16,
                overflow: "auto",
            }}
        >
            <div style={{ fontSize: 18, fontWeight: 600 }}>Course Catalog</div>
            <p style={{ fontSize: 14, color: "#6b7280" }}>
                Drag a course or a multi-course module into any semester lane.
            </p>
            <input
                type="text"
                placeholder="Search courses/modules..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginBottom: 10,
                    border: "1px solid #d1d5db",
                    borderRadius: 8,
                    padding: "8px 10px",
                    fontSize: 13,
                    fontWeight: 500,
                    background: "#ffffff",
                }}
            />

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
                    const visibleModules = modules.filter(moduleMatchesQuery);
                    if (searchNeedle && visibleModules.length === 0) return null;
                    const isOpen = expandedSet.has(pfName);
                    const isBodyOpen = isOpen || Boolean(searchNeedle);
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
                                    borderBottomLeftRadius: isBodyOpen ? 0 : 10,
                                    borderBottomRightRadius: isBodyOpen ? 0 : 10,
                                }}
                                aria-expanded={isBodyOpen}
                            >
                <span
                    aria-hidden
                    style={{
                        display: "inline-block",
                        transform: `rotate(${isBodyOpen ? 90 : 0}deg)`,
                        transition: "transform 0.15s ease",
                        color: "#ffffff",
                        fontWeight: 700,
                    }}
                >
                  ▶
                </span>
                                <span style={{ fontWeight: 700, color: "#ffffff" }}>{pfName}</span>
                                <span style={{ marginLeft: "auto", color: "rgba(255,255,255,0.9)", fontSize: 12 }}>
                  {visibleModules.length} Module
                </span>
                            </button>

                            {/* Body */}
                            {isBodyOpen && (
                                <div style={{ padding: "8px 10px 12px 10px", display: "grid", gap: 8, borderBottomLeftRadius: 10, borderBottomRightRadius: 10 }}>
                                    {visibleModules.map((mod, modIdx) => {
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
                                                category: isTransferableStandalone ? "transferable_skills" : (mod?.category ?? "free"),
                                                subjectColor,
                                                moduleMeta: {
                                                    id: `module-standalone-${moduleCodeFallback}`,
                                                    title: mod?.name || moduleCodeFallback,
                                                    examSubject: pfName,
                                                    category: isTransferableStandalone ? "transferable_skills" : (mod?.category ?? "free"),
                                                    subjectColor,
                                                    code: mod?.code ?? moduleCodeFallback,
                                                    ects: resolvedModuleEcts,
                                                },
                                            };
                                            return (
                                                <div
                                                    key={menuKey}
                                                    data-sidebar-menu-key={menuKey}
                                                    draggable={isAddableStatus(standaloneStatus)}
                                                    onDragStart={(e) => {
                                                        if (!isAddableStatus(standaloneStatus)) return;
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
                                                        cursor: isAddableStatus(standaloneStatus) ? "grab" : "default",
                                                        opacity: menuState.key === menuKey ? 1 : stateMeta.opacity,
                                                        display: "grid",
                                                        gap: 8,
                                                        position: "relative",
                                                        zIndex: menuState.key === menuKey ? 3000 : 1,
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        minWidth: 0,
                                                        overflow: "visible",
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleMenuView(menuKey, "details");
                                                                }}
                                                                style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                            >
                                                                i
                                                            </button>
                                                            {isAddableStatus(standaloneStatus) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        gotoSemesters(menuKey);
                                                                    }}
                                                                    style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    +
                                                                </button>
                                                            )}
                                                            {(standaloneStatus === "in_plan" || standaloneStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleCourseDone?.(moduleCodeFallback, standaloneStatus !== "done");
                                                                    }}
                                                                    style={{ border: `1px solid ${standaloneStatus === "done" ? "#9ca3af" : subjectColor}`, background: standaloneStatus === "done" ? "#10b981" : "#ffffff", color: standaloneStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                            {(standaloneStatus === "in_plan" || standaloneStatus === "done" || standaloneStatus === "parked") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onRemoveCourseFromPlan?.(moduleCodeFallback);
                                                                    }}
                                                                    style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {menuState.key === menuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: menuState.view === "details" ? 240 : 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 4000 }}>
                                                            {menuState.view === "root" && isAddableStatus(standaloneStatus) && (
                                                                <button onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                            )}
                                                            {menuState.view === "root" && (standaloneStatus === "in_plan" || standaloneStatus === "done" || standaloneStatus === "parked") && (
                                                                <button onClick={(e) => { e.stopPropagation(); onRemoveCourseFromPlan?.(moduleCodeFallback); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                            )}
                                                            {menuState.view === "root" && (
                                                                <button onClick={(e) => { e.stopPropagation(); setMenuState((prev) => ({ ...prev, view: "details" })); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit details</button>
                                                            )}
                                                            {menuState.view === "semesters" && (
                                                                <>
                                                                    {semestersForCourse(moduleCodeFallback).map((semester) => {
                                                                        const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                                                        const disableChoice = standaloneStatus === "parked" && isParkingChoice;
                                                                        return (
                                                                            <button key={semester.id} onClick={(e) => { e.stopPropagation(); if (disableChoice) return; onAddCourseToPlan?.(standalonePayload, semester.id - 1, { allowDirectLaneSelection: true }); closeMenu(); }} disabled={disableChoice} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: disableChoice ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: disableChoice ? "not-allowed" : "pointer", color: disableChoice ? "#9ca3af" : "#111827" }}>{semesterButtonLabel(semester)}</button>
                                                                        );
                                                                    })}
                                                                    {canRevealMoreSemesters && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                            style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                        >
                                                                            + Add next semester
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                </>
                                                            )}
                                                            {menuState.view === "details" && renderCourseDetailsMenu(moduleCodeFallback, standaloneStatus, (e) => { e?.stopPropagation?.(); closeMenu(); })}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: standaloneStatus === "done" ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{displayCourseTitle(mod?.name)}</div>
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
                                                    // Lets the end-to-end suite pick a named course out of the catalogue.
                                                    data-course-code={course.code ?? mod.code ?? ""}
                                                    draggable={isAddableStatus(courseStatus)}
                                                    onDragStart={(e) => {
                                                        if (!isAddableStatus(courseStatus)) return;
                                                        onDragStart(e, {
                                                            kind: "course",
                                                            code: course.code ?? mod.code,
                                                            name: course.name ?? mod.name,
                                                            type: course.type ?? null,
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
                                                        cursor: isAddableStatus(courseStatus) ? "grab" : "default",
                                                        opacity: menuState.key === menuKey ? 1 : stateMeta.opacity,
                                                        display: "grid",
                                                        gap: 8,
                                                        position: "relative",
                                                        zIndex: menuState.key === menuKey ? 3000 : 1,
                                                        width: "100%",
                                                        boxSizing: "border-box",
                                                        minWidth: 0,
                                                        overflow: "visible",
                                                    }}
                                                 >
                                                     {(() => {
                                                         const code = course?.code || mod?.code;
                                                         const rec = (recommendations || []).find((r) => r.courseCode === code);
                                                         {/* Recommendation patches intentionally omitted here (only in RP) */}
                                                        return null;
                                                     })()}
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                        <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                            <span>{displayCourseHeader(course?.code ?? mod?.code, course?.name ?? mod?.name, course?.type)}</span>
                                                            {typeof termAvailabilityForCode === "function" && termAvailabilityForCode(course?.code ?? mod?.code) && (
                                                                <>
                                                                    <span>|</span>
                                                                    <span 
                                                                        style={{ 
                                                                            display: "inline-flex", 
                                                                            alignItems: "center", 
                                                                            filter: "grayscale(100%) brightness(0.4) opacity(0.7)", 
                                                                            fontSize: 10,
                                                                            lineHeight: 1,
                                                                            transform: "translateY(-0.5px)"
                                                                        }} 
                                                                        title={`Available in ${termAvailabilityForCode(course?.code ?? mod?.code)}`}
                                                                    >
                                                                        {termAvailabilityForCode(course?.code ?? mod?.code) === "summer" ? "☀️" : termAvailabilityForCode(course?.code ?? mod?.code) === "winter" ? "❄️" : "☀️❄️"}
                                                                    </span>
                                                                </>
                                                            )}
                                                        </div>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    toggleMenuView(menuKey, "details");
                                                                }}
                                                                style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                            >
                                                                i
                                                            </button>
                                                            {isAddableStatus(courseStatus) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        gotoSemesters(menuKey);
                                                                    }}
                                                                    style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    +
                                                                </button>
                                                            )}
                                                            {(courseStatus === "in_plan" || courseStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleCourseDone?.(course.code ?? mod.code, courseStatus !== "done");
                                                                    }}
                                                                    style={{ border: `1px solid ${courseStatus === "done" ? "#9ca3af" : subjectColor}`, background: courseStatus === "done" ? "#10b981" : "#ffffff", color: courseStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                            {(courseStatus === "in_plan" || courseStatus === "done" || courseStatus === "parked") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onRemoveCourseFromPlan?.(course.code ?? mod.code);
                                                                    }}
                                                                    style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {menuState.key === menuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: menuState.view === "details" ? 240 : 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 4000 }}>
                                                            {menuState.view === "root" && isAddableStatus(courseStatus) && (
                                                                <button onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                            )}
                                                            {menuState.view === "root" && (courseStatus === "in_plan" || courseStatus === "done" || courseStatus === "parked") && (
                                                                <button onClick={(e) => { e.stopPropagation(); onRemoveCourseFromPlan?.(course.code ?? mod.code); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                            )}
                                                            {menuState.view === "root" && (
                                                                <button onClick={(e) => { e.stopPropagation(); setMenuState((prev) => ({ ...prev, view: "details" })); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit details</button>
                                                            )}
                                                            {menuState.view === "semesters" && (
                                                                <>
                                                                    {semestersForCourse(course.code ?? mod.code).map((semester) => {
                                                                        const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                                                        const disableChoice = courseStatus === "parked" && isParkingChoice;
                                                                        return (
                                                                            <button key={semester.id} onClick={(e) => { e.stopPropagation(); if (disableChoice) return; onAddCourseToPlan?.({ code: course.code ?? mod.code, name: course.name ?? mod.name, type: course.type ?? null, ects: course.ects ?? mod.ects ?? null, category: mod?.category ?? null, subjectColor }, semester.id - 1, { allowDirectLaneSelection: true }); closeMenu(); }} disabled={disableChoice} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: disableChoice ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: disableChoice ? "not-allowed" : "pointer", color: disableChoice ? "#9ca3af" : "#111827" }}>{semesterButtonLabel(semester)}</button>
                                                                        );
                                                                    })}
                                                                    {canRevealMoreSemesters && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                            style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                        >
                                                                            + Add next semester
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                </>
                                                            )}
                                                            {menuState.view === "details" && renderCourseDetailsMenu(course.code ?? mod.code, courseStatus, (e) => { e?.stopPropagation?.(); closeMenu(); })}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: courseStatus === "done" ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{displayCourseTitle(course?.name ?? mod?.name)}</div>
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
                                            courses: courses.map((c) => ({ code: c.code, name: c.name, ects: c.ects ?? null, type: c.type ?? null })),
                                        };
                                        const moduleVariantResolution = resolveModuleVariantCourses(modulePayload);
                                        const defaultModuleDragPayload = moduleVariantResolution?.isSplitModule
                                            ? (moduleVariantResolution.selectedCourses.length === 1
                                                ? {
                                                    code: moduleVariantResolution.selectedCourses[0]?.code,
                                                    name: moduleVariantResolution.selectedCourses[0]?.name ?? mod.name,
                                                    ects: moduleVariantResolution.selectedCourses[0]?.ects ?? null,
                                                    category: mod?.category ?? null,
                                                    subjectColor,
                                                }
                                                : { ...modulePayload, courses: moduleVariantResolution.selectedCourses })
                                            : modulePayload;
                                        const hasSplitVariants = Boolean(moduleVariantResolution?.isSplitModule);
                                        const variantOptions = Array.isArray(moduleVariantResolution?.variantOptions)
                                            ? moduleVariantResolution.variantOptions
                                            : [];
                                        const activeVariantCourses = (() => {
                                            if (!hasSplitVariants) return modulePayload?.courses || [];
                                            if (!menuState?.variantId) return modulePayload?.courses || [];
                                            const resolved = resolveModuleVariantCourses(modulePayload, menuState.variantId);
                                            return Array.isArray(resolved?.selectedCourses) && resolved.selectedCourses.length > 0
                                                ? resolved.selectedCourses
                                                : (modulePayload?.courses || []);
                                        })();
                                        const variantDragPayload = (variantId) => {
                                            const resolved = resolveModuleVariantCourses(modulePayload, variantId);
                                            if (!resolved?.isSplitModule) return modulePayload;
                                            if (resolved.selectedCourses.length === 1) {
                                                return {
                                                    code: resolved.selectedCourses[0]?.code,
                                                    name: resolved.selectedCourses[0]?.name ?? mod.name,
                                                    ects: resolved.selectedCourses[0]?.ects ?? null,
                                                    category: mod?.category ?? null,
                                                    subjectColor,
                                                };
                                            }
                                            return {
                                                ...modulePayload,
                                                variantId,
                                                courses: resolved.selectedCourses,
                                            };
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
                                        const childMenuPrefix = `child-${pfIdx}-${mod.code}-`;
                                        const isModuleLayerActive =
                                            menuState.key === moduleMenuKey ||
                                            (typeof menuState.key === "string" && menuState.key.startsWith(childMenuPrefix));
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
                                                    zIndex: isModuleLayerActive ? 3000 : 1,
                                                }}
                                            >
                                                <div
                                                    draggable={isAddableStatus(groupStatus) && !moduleBlocked && !hasSplitVariants}
                                                    onDragStart={(e) => {
                                                        if (!isAddableStatus(groupStatus) || moduleBlocked || hasSplitVariants) return;
                                                        onDragStart(e, defaultModuleDragPayload);
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
                                                        cursor: isAddableStatus(groupStatus) && !moduleBlocked ? "grab" : "default",
                                                        opacity: menuState.key === moduleMenuKey ? 1 : (moduleBlocked ? 0.85 : groupStateMeta.opacity),
                                                        position: "relative",
                                                        boxSizing: "border-box",
                                                        minWidth: 0,
                                                        overflow: "visible",
                                                        borderTopLeftRadius: 10,
                                                        borderTopRightRadius: 10,
                                                    }}
                                                >
                                                    <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 8 }}>
                                                        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                            {isAddableStatus(groupStatus) && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        gotoSemesters(moduleMenuKey);
                                                                    }}
                                                                    style={{ border: `1px solid ${subjectColor}`, background: "#fff", color: "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    +
                                                                </button>
                                                            )}
                                                            {(groupStatus === "in_plan" || groupStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onToggleModuleDone?.(courses.map((c) => c?.code).filter(Boolean), groupStatus !== "done");
                                                                    }}
                                                                    style={{ border: `1px solid ${groupStatus === "done" ? "#9ca3af" : subjectColor}`, background: groupStatus === "done" ? "#10b981" : "#ffffff", color: groupStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ✓
                                                                </button>
                                                            )}
                                                            {(groupStatus === "in_plan" || groupStatus === "done") && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        onRemoveModuleFromPlan?.(modulePayload);
                                                                    }}
                                                                    style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                >
                                                                    ×
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {menuState.key === moduleMenuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: menuState.view === "details" ? 240 : 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 4000 }}>
                                                            {menuState.view === "root" && isAddableStatus(groupStatus) && (
                                                                hasSplitVariants
                                                                    ? (
                                                                        <>
                                                                            {variantOptions.map((opt) => (
                                                                                <button
                                                                                    key={opt.id}
                                                                                    onClick={(e) => { e.stopPropagation(); gotoSemesters(moduleMenuKey, opt.id); }}
                                                                                    style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                                                                >
                                                                                    {`Add ${opt.label}`}
                                                                                </button>
                                                                            ))}
                                                                        </>
                                                                    )
                                                                    : <button onClick={(e) => { e.stopPropagation(); gotoSemesters(moduleMenuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                            )}
                                                            {menuState.view === "root" && (groupStatus === "in_plan" || groupStatus === "done") && (
                                                                <button onClick={(e) => { e.stopPropagation(); onRemoveModuleFromPlan?.(modulePayload); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                            )}
                                                            {menuState.view === "semesters" && (
                                                                <>
                                                                    {semestersForModule(activeVariantCourses).map((semester) => {
                                                                        const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                                                        const disableChoice = groupStatus === "parked" && isParkingChoice;
                                                                        return (
                                                                            <button key={semester.id} onClick={(e) => { e.stopPropagation(); if (disableChoice) return; const laneIndex = Number.isFinite(Number(semester?.laneIndex)) ? Number(semester.laneIndex) : (Number.isFinite(Number(semester?.id)) ? (Number(semester.id) - 1) : 0); onAddModuleToPlan?.(modulePayload, laneIndex, { allowDirectLaneSelection: true, variantId: menuState?.variantId || null }); closeMenu(); }} disabled={disableChoice} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: disableChoice ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: disableChoice ? "not-allowed" : "pointer", color: disableChoice ? "#9ca3af" : "#111827" }}>{semesterButtonLabel(semester)}</button>
                                                                        );
                                                                    })}
                                                                    {canRevealMoreSemesters && (
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                            style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                        >
                                                                            + Add next semester
                                                                        </button>
                                                                    )}
                                                                    <button onClick={(e) => { e.stopPropagation(); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                </>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: isGroupDone ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                                        {displayCourseTitle(mod?.name)}
                                                    </div>
                                                    {hasSplitVariants && isAddableStatus(groupStatus) && (
                                                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                                            {variantOptions.map((opt) => (
                                                                <div
                                                                    key={`drag-${opt.id}`}
                                                                    draggable
                                                                    onDragStart={(e) => { e.stopPropagation(); onDragStart(e, variantDragPayload(opt.id)); }}
                                                                    style={{
                                                                        border: "1px dashed #9ca3af",
                                                                        borderRadius: 6,
                                                                        padding: "3px 8px",
                                                                        fontSize: 11,
                                                                        fontWeight: 700,
                                                                        color: "#374151",
                                                                        background: "#ffffff",
                                                                        cursor: "grab",
                                                                        userSelect: "none",
                                                                    }}
                                                                >
                                                                    {`Drag ${opt.label}`}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
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
                                                                data-course-code={course?.code ?? mod.code ?? ""}
                                                                title="Course in module"
                                                                style={{
                                                                    textAlign: "left",
                                                                    border: `1px solid ${childStateMeta.borderColor || subjectColor}`,
                                                                    borderRadius: 10,
                                                                    background: childBackground,
                                                                    boxShadow: combinedCardShadow(childTypeShadow, childStateMeta.extraShadow),
                                                                    padding: "10px 10px",
                                                                    opacity: menuState.key === menuKey ? 1 : childStateMeta.opacity,
                                                                    display: "grid",
                                                                    gap: 8,
                                                                    position: "relative",
                                                                    zIndex: menuState.key === menuKey ? 3000 : 1,
                                                                    width: "100%",
                                                                    boxSizing: "border-box",
                                                                    minWidth: 0,
                                                                    overflow: "visible",
                                                                }}
                                                            >
                                                                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                                                                    <div style={{ fontSize: 11, color: "#6b7280", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                                                        <span>{displayCourseHeader(course?.code ?? mod?.code, course?.name ?? mod?.name, course?.type)}</span>
                                                                        {typeof termAvailabilityForCode === "function" && termAvailabilityForCode(course?.code ?? mod?.code) && (
                                                                            <>
                                                                                <span>|</span>
                                                                                <span 
                                                                                    style={{ 
                                                                                        display: "inline-flex", 
                                                                                        alignItems: "center", 
                                                                                        filter: "grayscale(100%) brightness(0.4) opacity(0.7)", 
                                                                                        fontSize: 10,
                                                                                        lineHeight: 1,
                                                                                        transform: "translateY(-0.5px)"
                                                                                    }} 
                                                                                    title={`Available in ${termAvailabilityForCode(course?.code ?? mod?.code)}`}
                                                                                >
                                                                                    {termAvailabilityForCode(course?.code ?? mod?.code) === "summer" ? "☀️" : termAvailabilityForCode(course?.code ?? mod?.code) === "winter" ? "❄️" : "☀️❄️"}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                toggleMenuView(menuKey, "details");
                                                                            }}
                                                                            style={{ border: `1px solid ${subjectColor}`, background: "#fff", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                        >
                                                                            i
                                                                        </button>
                                                                        {isAddableStatus(courseStatus) && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    hasSplitVariants ? gotoSemesters(menuKey, variantOptions?.[0]?.id ?? null) : gotoSemesters(menuKey);
                                                                                }}
                                                                                style={{ border: "1px solid #111827", background: "#fff", color: "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                            >
                                                                                +
                                                                            </button>
                                                                        )}
                                                                        {(courseStatus === "in_plan" || courseStatus === "done") && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onToggleModuleDone?.(courses.map((c) => c?.code).filter(Boolean), courseStatus !== "done");
                                                                                }}
                                                                                style={{ border: `1px solid ${courseStatus === "done" ? "#9ca3af" : subjectColor}`, background: courseStatus === "done" ? "#10b981" : "#ffffff", color: courseStatus === "done" ? "#fff" : "#111827", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                            >
                                                                                ✓
                                                                            </button>
                                                                        )}
                                                                        {(courseStatus === "in_plan" || courseStatus === "done" || courseStatus === "parked") && (
                                                                            <button
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    onRemoveModuleFromPlan?.(modulePayload);
                                                                                }}
                                                                                style={{ border: "1px solid #fca5a5", background: "#fef2f2", color: "#b91c1c", borderRadius: 6, fontSize: 12, padding: "2px 6px", cursor: "pointer" }}
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {menuState.key === menuKey && (
                                                        <div style={{ position: "absolute", top: 34, right: -8, width: menuState.view === "details" ? 240 : 190, border: "1px solid #d1d5db", borderRadius: 8, background: "#fff", boxShadow: "0 4px 12px rgba(0,0,0,0.12)", padding: 6, display: "grid", gap: 4, zIndex: 4000 }}>
                                                                        {menuState.view === "root" && isAddableStatus(courseStatus) && (
                                                                            hasSplitVariants
                                                                                ? (
                                                                                    <>
                                                                                        {variantOptions.map((opt) => (
                                                                                            <button
                                                                                                key={opt.id}
                                                                                                onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey, opt.id); }}
                                                                                                style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                                                                                            >
                                                                                                {`Add ${opt.label}`}
                                                                                            </button>
                                                                                        ))}
                                                                                    </>
                                                                                )
                                                                                : <button onClick={(e) => { e.stopPropagation(); gotoSemesters(menuKey); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Add to plan</button>
                                                                        )}
                                                                        {menuState.view === "root" && (courseStatus === "in_plan" || courseStatus === "done" || courseStatus === "parked") && (
                                                                            <button onClick={(e) => { e.stopPropagation(); onRemoveModuleFromPlan?.(modulePayload); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Remove from plan</button>
                                                                        )}
                                                                        {menuState.view === "root" && (
                                                                            <button onClick={(e) => { e.stopPropagation(); setMenuState((prev) => ({ ...prev, view: "details" })); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit details</button>
                                                                        )}
                                                                        {menuState.view === "semesters" && (
                                                                            <>
                                                                                {semestersForModule(activeVariantCourses).map((semester) => {
                                                                                    const isParkingChoice = Boolean(semester?.isParking) || Number(semester?.id) === 0;
                                                                                    const disableChoice = courseStatus === "parked" && isParkingChoice;
                                                                                    return (
                                                                                        <button key={semester.id} onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            if (disableChoice) return;
                                                                                            const confirmed = window.confirm(
                                                                                                `${course?.code || "This course"} belongs to a module. Adding it will automatically add all module courses. Continue?`
                                                                                            );
                                                                                            if (!confirmed) return;
                                                                                            const laneIndex = Number.isFinite(Number(semester?.laneIndex)) ? Number(semester.laneIndex) : (Number.isFinite(Number(semester?.id)) ? (Number(semester.id) - 1) : 0);
                                                                                            onAddModuleToPlan?.(modulePayload, laneIndex, { allowDirectLaneSelection: true, variantId: menuState?.variantId || null });
                                                                                            closeMenu();
                                                                                        }} disabled={disableChoice} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: disableChoice ? "#f3f4f6" : "#fff", fontSize: 12, fontWeight: 600, cursor: disableChoice ? "not-allowed" : "pointer", color: disableChoice ? "#9ca3af" : "#111827" }}>{semesterButtonLabel(semester)}</button>
                                                                                    );
                                                                                })}
                                                                                {canRevealMoreSemesters && (
                                                                                    <button
                                                                                        onClick={(e) => { e.stopPropagation(); setPlusRevealCount((c) => Math.min(c + 1, plusSemesters.length)); }}
                                                                                        style={{ border: "1px dashed #9ca3af", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                                                                                    >
                                                                                        + Add next semester
                                                                                    </button>
                                                                                )}
                                                                                <button onClick={(e) => { e.stopPropagation(); closeMenu(); }} style={{ border: "1px solid #e5e7eb", borderRadius: 6, padding: "5px 8px", textAlign: "left", background: "#f9fafb", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Back</button>
                                                                            </>
                                                                        )}
                                                                        {menuState.view === "details" && renderCourseDetailsMenu(course?.code ?? mod.code, courseStatus, (e) => { e?.stopPropagation?.(); closeMenu(); })}
                                                                    </div>
                                                                )}
                                                                <div style={{ fontWeight: 700, fontSize: 16, lineHeight: 1.25, color: courseStatus === "done" ? "#6b7280" : "#111827", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{displayCourseTitle(course?.name ?? mod?.name)}</div>
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
