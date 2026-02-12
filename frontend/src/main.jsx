import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ProgramProvider } from "./ProgramContext.jsx";
import AuthGate from "./AuthGate.jsx";
import { fetchCurrentUser, savePlannerState, signOut } from "./lib/api.js";
import "./global.css";

const container = document.getElementById("root");
if (!container) {
    throw new Error("No root element found. Did you forget <div id=\"root\"></div> in index.html?");
}

function Root() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [authError, setAuthError] = useState("");

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const me = await fetchCurrentUser();
                if (cancelled) return;
                setAuthError("");
                setUser(me?.user ?? null);
            } catch (e) {
                if (cancelled) return;
                // Avoid noisy UI errors when backend is temporarily unavailable during auth bootstrap.
                setAuthError("");
                setUser(null);
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    if (loading) {
        return (
            <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontSize: 14, color: "#6b7280" }}>
                Loading...
            </div>
        );
    }

    if (!user) {
        return (
            <>
                {authError && (
                    <div style={{ position: "fixed", top: 12, right: 12, zIndex: 20, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", borderRadius: 8, padding: "6px 10px", fontSize: 12 }}>
                        {authError}
                    </div>
                )}
                <AuthGate onAuthenticated={(nextUser) => {
                    setAuthError("");
                    setUser(nextUser);
                }} />
            </>
        );
    }

    return (
        <ProgramProvider>
            <App
                currentUser={user}
                onSignOut={async (snapshot) => {
                    if (snapshot && typeof snapshot === "object") {
                        await savePlannerState(snapshot).catch(() => null);
                    }
                    await signOut().catch(() => null);
                    setAuthError("");
                    setUser(null);
                }}
            />
        </ProgramProvider>
    );
}

createRoot(container).render(
    <React.StrictMode>
        <Root />
    </React.StrictMode>
);
