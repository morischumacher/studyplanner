const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

function getAuthHeaders(extraHeaders = {}) {
    const headers = { ...extraHeaders };
    const token = localStorage.getItem("study_planner_auth_token");
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

/**
 * Fetch the catalog for a single program by its code (e.g. "066 937").
 * Returns the catalog array (subjects ...), exactly as the backend returns for a single program.
 */
export async function fetchCatalog(programCode) {
    const url = new URL("/catalog", BASE);
    if (programCode) url.searchParams.set("program_code", programCode);

    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Catalog fetch failed: ${res.status} ${res.statusText} ${text}`);
    }
    return res.json(); // backend sends real JSON
}

export async function sendRuleCheckUpdate(payload) {
    const url = new URL("/rulecheck", BASE);
    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify(payload ?? {}),
    });

    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Rulecheck update failed: ${res.status} ${res.statusText} ${text}`);
    }

    return res.json().catch(() => ({}));
}

async function parseJsonOrError(res, fallbackMessage) {
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${fallbackMessage}: ${res.status} ${res.statusText} ${text}`);
    }
    return res.json().catch(() => ({}));
}

export async function signUp(username, password) {
    const url = new URL("/auth/signup", BASE);
    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonOrError(res, "Signup failed");
    if (data?.token) {
        localStorage.setItem("study_planner_auth_token", data.token);
    }
    return data;
}

export async function signIn(username, password) {
    const url = new URL("/auth/signin", BASE);
    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ username, password }),
    });
    const data = await parseJsonOrError(res, "Signin failed");
    if (data?.token) {
        localStorage.setItem("study_planner_auth_token", data.token);
    }
    return data;
}

export async function signOut() {
    const url = new URL("/auth/signout", BASE);
    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    localStorage.removeItem("study_planner_auth_token");
    return parseJsonOrError(res, "Signout failed");
}

export async function fetchCurrentUser() {
    const url = new URL("/auth/me", BASE);
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    if (res.status === 401) return null;
    return parseJsonOrError(res, "Fetch current user failed");
}

export async function fetchPlannerState() {
    const url = new URL("/planner-state", BASE);
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    return parseJsonOrError(res, "Fetch planner state failed");
}

export async function savePlannerState(state) {
    const url = new URL("/planner-state", BASE);
    const res = await fetch(url.toString(), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify({ state: state ?? {} }),
    });
    return parseJsonOrError(res, "Save planner state failed");
}

export async function fetchProfileSettings(programCode) {
    const url = new URL("/profile-settings", BASE);
    if (programCode) url.searchParams.set("program_code", programCode);
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    return parseJsonOrError(res, "Fetch profile settings failed");
}

export async function saveStartTerm({ programCode, season, year }) {
    const url = new URL("/profile-settings/start-term", BASE);
    const res = await fetch(url.toString(), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify({
            program_code: programCode,
            season,
            year,
        }),
    });
    return parseJsonOrError(res, "Save start term failed");
}

export async function saveCourseTerms({ programCode, updates }) {
    const url = new URL("/profile-settings/course-terms", BASE);
    const res = await fetch(url.toString(), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify({
            program_code: programCode,
            updates: Array.isArray(updates) ? updates.map((item) => ({
                course_code: item.courseCode,
                term_availability: item.termAvailability,
            })) : [],
        }),
    });
    return parseJsonOrError(res, "Save course terms failed");
}

export async function saveRecommendationProfile({ programCode, interests, careerDirection, recommendationToggles }) {
    const url = new URL("/profile-settings/recommendation-profile", BASE);
    const res = await fetch(url.toString(), {
        method: "PUT",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify({
            program_code: programCode,
            interests: interests || [],
            career_direction: careerDirection || "",
            recommendation_toggles: recommendationToggles || {},
        }),
    });
    return parseJsonOrError(res, "Save recommendation profile failed");
}

export async function fetchRecommendations(payload) {
    const url = new URL("/recommendations", BASE);
    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: getAuthHeaders({
            "Content-Type": "application/json",
            Accept: "application/json",
        }),
        body: JSON.stringify(payload ?? {}),
    });
    return parseJsonOrError(res, "Fetch recommendations failed");
}

/**
 * Fetch the prerequisite relations of one programme.
 *
 * The compliance engine enforces these relations; the graph view draws them, so
 * both read the same list from the service rather than holding their own copy.
 * A programme that encodes no prerequisites returns an empty list, which is an
 * answer rather than a failure.
 */
export async function fetchPrerequisites(programCode) {
    const url = new URL("/curriculum/prerequisites", BASE);
    if (programCode) url.searchParams.set("program_code", programCode);
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: getAuthHeaders({ Accept: "application/json" }),
    });
    return parseJsonOrError(res, "Fetch prerequisites failed");
}
