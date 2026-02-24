import { useCallback, useMemo, useState } from "react";

export function useDashboardSectionOrdering({
    plannedDashboardSectionOrder,
    setPlannedDashboardSectionOrder,
    doneDashboardSectionOrder,
    setDoneDashboardSectionOrder,
}) {
    const [draggingPlannedSectionKey, setDraggingPlannedSectionKey] = useState(null);
    const [dragOverPlannedSectionKey, setDragOverPlannedSectionKey] = useState(null);
    const [draggingDoneSectionKey, setDraggingDoneSectionKey] = useState(null);
    const [dragOverDoneSectionKey, setDragOverDoneSectionKey] = useState(null);

    const plannedSectionOrderIndex = useMemo(
        () => Object.fromEntries((plannedDashboardSectionOrder || []).map((key, idx) => [key, idx])),
        [plannedDashboardSectionOrder]
    );

    const doneSectionOrderIndex = useMemo(
        () => Object.fromEntries((doneDashboardSectionOrder || []).map((key, idx) => [key, idx])),
        [doneDashboardSectionOrder]
    );

    const handlePlannedSectionDragStart = useCallback((key) => {
        setDraggingPlannedSectionKey(key);
        setDragOverPlannedSectionKey(null);
    }, []);

    const handlePlannedSectionDragOver = useCallback((event, key) => {
        event.preventDefault();
        if (!draggingPlannedSectionKey || draggingPlannedSectionKey === key) return;
        if (dragOverPlannedSectionKey !== key) setDragOverPlannedSectionKey(key);
    }, [dragOverPlannedSectionKey, draggingPlannedSectionKey]);

    const handlePlannedSectionDrop = useCallback((key) => {
        if (!draggingPlannedSectionKey || draggingPlannedSectionKey === key) {
            setDragOverPlannedSectionKey(null);
            return;
        }

        setPlannedDashboardSectionOrder((prev) => {
            const order = Array.isArray(prev) ? prev.slice() : [];
            const from = order.indexOf(draggingPlannedSectionKey);
            const to = order.indexOf(key);
            if (from < 0 || to < 0 || from === to) return order;
            const [moved] = order.splice(from, 1);
            order.splice(to, 0, moved);
            return order;
        });

        setDraggingPlannedSectionKey(null);
        setDragOverPlannedSectionKey(null);
    }, [draggingPlannedSectionKey, setPlannedDashboardSectionOrder]);

    const handlePlannedSectionDragEnd = useCallback(() => {
        setDraggingPlannedSectionKey(null);
        setDragOverPlannedSectionKey(null);
    }, []);

    const handleDoneSectionDragStart = useCallback((key) => {
        setDraggingDoneSectionKey(key);
        setDragOverDoneSectionKey(null);
    }, []);

    const handleDoneSectionDragOver = useCallback((event, key) => {
        event.preventDefault();
        if (!draggingDoneSectionKey || draggingDoneSectionKey === key) return;
        if (dragOverDoneSectionKey !== key) setDragOverDoneSectionKey(key);
    }, [dragOverDoneSectionKey, draggingDoneSectionKey]);

    const handleDoneSectionDrop = useCallback((key) => {
        if (!draggingDoneSectionKey || draggingDoneSectionKey === key) {
            setDragOverDoneSectionKey(null);
            return;
        }

        setDoneDashboardSectionOrder((prev) => {
            const order = Array.isArray(prev) ? prev.slice() : [];
            const from = order.indexOf(draggingDoneSectionKey);
            const to = order.indexOf(key);
            if (from < 0 || to < 0 || from === to) return order;
            const [moved] = order.splice(from, 1);
            order.splice(to, 0, moved);
            return order;
        });

        setDraggingDoneSectionKey(null);
        setDragOverDoneSectionKey(null);
    }, [draggingDoneSectionKey, setDoneDashboardSectionOrder]);

    const handleDoneSectionDragEnd = useCallback(() => {
        setDraggingDoneSectionKey(null);
        setDragOverDoneSectionKey(null);
    }, []);

    const plannedSectionStyle = useCallback((key, base = {}) => {
        const isDragging = draggingPlannedSectionKey === key;
        const isDragOver = dragOverPlannedSectionKey === key && draggingPlannedSectionKey && draggingPlannedSectionKey !== key;
        const baseMarginBottom = Number(base?.marginBottom ?? 0);
        return {
            ...base,
            marginBottom: Math.max(baseMarginBottom, 18),
            padding: `${Math.max(8, Number(base?.paddingTop ?? 0) || 8)}px 10px 10px`,
            paddingTop: undefined,
            order: 100 + Number(plannedSectionOrderIndex?.[key] ?? 99),
            opacity: isDragging ? 0.65 : 1,
            outline: isDragOver ? "2px dashed #9ca3af" : "1px solid #d1d5db",
            outlineOffset: 2,
            borderRadius: 10,
            cursor: "grab",
            background: "#ffffff",
        };
    }, [plannedSectionOrderIndex, dragOverPlannedSectionKey, draggingPlannedSectionKey]);

    const doneSectionStyle = useCallback((key, base = {}) => {
        const isDragging = draggingDoneSectionKey === key;
        const isDragOver = dragOverDoneSectionKey === key && draggingDoneSectionKey && draggingDoneSectionKey !== key;
        const baseMarginBottom = Number(base?.marginBottom ?? 0);
        return {
            ...base,
            marginBottom: Math.max(baseMarginBottom, 18),
            padding: `${Math.max(8, Number(base?.paddingTop ?? 0) || 8)}px 10px 10px`,
            paddingTop: undefined,
            order: 100 + Number(doneSectionOrderIndex?.[key] ?? 99),
            opacity: isDragging ? 0.65 : 1,
            outline: isDragOver ? "2px dashed #9ca3af" : "1px solid #d1d5db",
            outlineOffset: 2,
            borderRadius: 10,
            cursor: "grab",
            background: "#ffffff",
        };
    }, [doneSectionOrderIndex, dragOverDoneSectionKey, draggingDoneSectionKey]);

    return {
        handlePlannedSectionDragStart,
        handlePlannedSectionDragOver,
        handlePlannedSectionDrop,
        handlePlannedSectionDragEnd,
        handleDoneSectionDragStart,
        handleDoneSectionDragOver,
        handleDoneSectionDrop,
        handleDoneSectionDragEnd,
        plannedSectionStyle,
        doneSectionStyle,
    };
}
