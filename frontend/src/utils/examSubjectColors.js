export const MODULE_GROUP_COLOR_ALPHA = 0.52;

function hashString(input) {
    const s = String(input ?? "");
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = (h << 5) - h + s.charCodeAt(i);
        h |= 0;
    }
    return Math.abs(h);
}

function inRedRange(hue) {
    return hue < 22 || hue >= 345;
}

function normalizeHueAvoidingRed(hue) {
    const h = ((hue % 360) + 360) % 360;
    if (!inRedRange(h)) return h;
    return 26 + (h % 310); // 26..335
}

function distanceOnHueWheel(a, b) {
    const d = Math.abs(a - b) % 360;
    return Math.min(d, 360 - d);
}

function hslToHex(h, s, l) {
    const sat = s / 100;
    const light = l / 100;
    const c = (1 - Math.abs(2 * light - 1)) * sat;
    const hp = h / 60;
    const x = c * (1 - Math.abs((hp % 2) - 1));
    let r1 = 0;
    let g1 = 0;
    let b1 = 0;

    if (hp >= 0 && hp < 1) [r1, g1, b1] = [c, x, 0];
    else if (hp >= 1 && hp < 2) [r1, g1, b1] = [x, c, 0];
    else if (hp >= 2 && hp < 3) [r1, g1, b1] = [0, c, x];
    else if (hp >= 3 && hp < 4) [r1, g1, b1] = [0, x, c];
    else if (hp >= 4 && hp < 5) [r1, g1, b1] = [x, 0, c];
    else if (hp >= 5 && hp < 6) [r1, g1, b1] = [c, 0, x];

    const m = light - c / 2;
    const r = Math.round((r1 + m) * 255);
    const g = Math.round((g1 + m) * 255);
    const b = Math.round((b1 + m) * 255);

    return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function hexToRgba(hex, alpha) {
    const clean = String(hex || "").replace("#", "");
    if (clean.length !== 6) return `rgba(107,114,128,${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function createExamSubjectColorMap(subjectNames) {
    const names = Array.from(new Set((subjectNames || []).filter(Boolean)));
    const usedHues = [];
    const bySubject = {};
    const GOLDEN_ANGLE = 137.507764;

    names.forEach((name, idx) => {
        let hue = normalizeHueAvoidingRed((hashString(name) + idx * GOLDEN_ANGLE) % 360);

        for (let tries = 0; tries < 36; tries++) {
            const nearExisting = usedHues.some((u) => distanceOnHueWheel(u, hue) < 22);
            if (!nearExisting && !inRedRange(hue)) break;
            hue = normalizeHueAvoidingRed(hue + GOLDEN_ANGLE);
        }

        usedHues.push(hue);
        bySubject[name] = hslToHex(hue, 68, 46);
    });

    return bySubject;
}
