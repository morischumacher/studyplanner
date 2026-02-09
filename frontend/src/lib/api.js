const BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:8000';

const safeParse = (x) => { try { return JSON.parse(x); } catch { return x; } };

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