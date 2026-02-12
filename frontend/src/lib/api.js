const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

/**
 * Fetch the catalog for a single program by its code (e.g. "066 937").
 * Returns the catalog array (subjects ...), exactly as the backend returns for a single program.
 */
export async function fetchCatalog(programCode) {
    const url = new URL("/catalog", BASE);
    if (programCode) url.searchParams.set("program_code", programCode);

    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: { Accept: "application/json" },
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
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
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
    return parseJsonOrError(res, "Signup failed");
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
    return parseJsonOrError(res, "Signin failed");
}

export async function signOut() {
    const url = new URL("/auth/signout", BASE);
    const res = await fetch(url.toString(), {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    return parseJsonOrError(res, "Signout failed");
}

export async function fetchCurrentUser() {
    const url = new URL("/auth/me", BASE);
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    if (res.status === 401) return null;
    return parseJsonOrError(res, "Fetch current user failed");
}

export async function fetchPlannerState() {
    const url = new URL("/planner-state", BASE);
    const res = await fetch(url.toString(), {
        credentials: "include",
        headers: { Accept: "application/json" },
    });
    return parseJsonOrError(res, "Fetch planner state failed");
}

export async function savePlannerState(state) {
    const url = new URL("/planner-state", BASE);
    const res = await fetch(url.toString(), {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
        },
        body: JSON.stringify({ state: state ?? {} }),
    });
    return parseJsonOrError(res, "Save planner state failed");
}
