function normalizeText(value) {
    return String(value || "")
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

const COURSE_TYPE_TOKENS = ["VU", "VO", "UE", "PR", "SE", "KO", "KS", "EX", "PS", "PJ", "ILV", "RE"];
const SHORTNAME_STOP_WORDS = new Set([
    "and", "und", "for", "der", "die", "das", "in", "of", "the", "to", "mit", "fuer", "fur",
]);

function extractCourseTypeToken(type, code) {
    const fromType = String(type || "").trim().toUpperCase();
    if (COURSE_TYPE_TOKENS.includes(fromType)) return fromType;
    const codeText = String(code || "").toUpperCase();
    const match = codeText.match(/\b(VU|VO|UE|PR|SE|KO|KS|EX|PS|PJ|ILV|RE)\b/);
    return match ? match[1] : "";
}

function stripCourseTypeSuffix(code) {
    const raw = String(code || "").trim();
    if (!raw) return "";
    const upper = raw.toUpperCase();
    for (const token of COURSE_TYPE_TOKENS) {
        const suffixPatterns = [
            `-${token}`,
            `_${token}`,
            ` ${token}`,
            `/${token}`,
            `.${token}`,
        ];
        for (const suffix of suffixPatterns) {
            if (upper.endsWith(suffix)) {
                return raw.slice(0, raw.length - suffix.length).trim();
            }
        }
    }
    return raw;
}

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

export function displayShortCode(code, name = "") {
    const fromName = buildAcronym(name);
    if (fromName) return fromName;

    const rawCode = String(code || "").trim();
    const codeWithoutType = stripCourseTypeSuffix(rawCode);
    const compactCode = /^[A-Za-z0-9._/-]+$/.test(codeWithoutType) ? codeWithoutType : "";
    if (compactCode) return compactCode.toUpperCase();
    return codeWithoutType || rawCode;
}

export function displayCourseHeader(code, name = "", type = "") {
    const shortCode = displayShortCode(code, name);
    const typeToken = extractCourseTypeToken(type, code);
    return typeToken ? `${shortCode} | ${typeToken}` : shortCode;
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
