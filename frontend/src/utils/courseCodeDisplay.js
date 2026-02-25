function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const SHORTNAME_STOP_WORDS = new Set([
    "and", "und", "for", "der", "die", "das", "in", "of", "the", "to", "mit", "fuer", "fur",
]);

function buildAcronym(name) {
    const words = String(name || "")
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter(Boolean);
    if (!words.length) return "";

    const significant = words.filter((w) => !SHORTNAME_STOP_WORDS.has(normalizeText(w)));
    if (!significant.length) return "";

    if (significant.length === 1) {
        const token = significant[0];
        const leadingLetter = token.match(/[A-Za-z]/)?.[0]?.toUpperCase() || "";
        const trailingDigits = token.match(/\d+$/)?.[0] || "";
        return `${leadingLetter}${trailingDigits}`.trim();
    }

    const letters = significant
        .map((w) => w.match(/[A-Za-z]/)?.[0]?.toUpperCase() || "")
        .filter(Boolean);
    const trailingDigits = significant
        .map((w) => w.match(/\d+$/)?.[0] || "")
        .find(Boolean) || "";
    if (letters.length >= 2) return `${letters.join("")}${trailingDigits}`;

    const first = words[0] || "";
    return first.slice(0, 10).toUpperCase();
}

export function displayShortCode(code) {
    const rawCode = String(code || "").trim();
    return rawCode;
}

export function displayCourseHeader(code, name = "", type = "") {
    void name;
    const rawCode = String(code || "").trim();
    const rawType = String(type || "").trim();
    if (rawCode && rawType) return `${rawCode} | ${rawType}`;
    if (rawCode) return rawCode;
    return rawType;
}

export function displayCourseTitle(name = "") {
    const raw = String(name || "").trim();
    if (!raw) return "";
    const typeGroup = "(VU|VO|UE|PR|SE|KO|KS|EX|PS|PJ|ILV|RE)";
    const parenMatch = raw.match(new RegExp(`\\s*${"\\("}${typeGroup}${"\\)"}\\s*$`, "i"));
    if (parenMatch) return raw.slice(0, parenMatch.index).trim();

    // Also strip plain trailing type tokens that appear without parentheses, e.g. "Data Stewardship UE".
    const separatedMatch = raw.match(new RegExp(`\\s*[-_/|]\\s*${typeGroup}\\s*$`));
    if (separatedMatch) return raw.slice(0, separatedMatch.index).trim();
    const plainSuffixMatch = raw.match(new RegExp(`\\s+${typeGroup}\\s*$`));
    if (plainSuffixMatch) return raw.slice(0, plainSuffixMatch.index).trim();

    return raw;
}

function longestCommonPrefix(values) {
    const list = (values || []).filter(Boolean);
    if (!list.length) return "";
    let prefix = list[0];
    for (let i = 1; i < list.length; i += 1) {
        const current = list[i];
        while (prefix && !current.startsWith(prefix)) {
            prefix = prefix.slice(0, -1);
        }
        if (!prefix) break;
    }
    return prefix;
}

export function displayModuleHeader(moduleCode, moduleName = "", moduleCourseCodes = []) {
    const fromName = buildAcronym(moduleName);
    if (fromName) return fromName;

    const shortCourseCodes = (moduleCourseCodes || [])
        .map((courseCode) => displayShortCode(courseCode, ""))
        .filter(Boolean);
    const prefix = longestCommonPrefix(shortCourseCodes).replace(/[\s._/-]+$/, "");
    const cleanedPrefix = prefix.replace(/\d+$/, "");
    if (cleanedPrefix) return cleanedPrefix;
    if (prefix) return prefix;

    return displayShortCode(moduleCode, moduleName);
}
