import React, { useMemo, useState } from "react";
import { signIn, signUp } from "./lib/api.js";

export default function AuthGate({ onAuthenticated }) {
    const [mode, setMode] = useState("signin");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");

    const title = useMemo(() => (mode === "signin" ? "Sign In" : "Sign Up"), [mode]);

    const onSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError("");
        try {
            const apiCall = mode === "signin" ? signIn : signUp;
            const result = await apiCall(username.trim(), password);
            onAuthenticated?.(result?.user ?? null);
        } catch (e) {
            setError(String(e?.message || e));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div
            style={{
                minHeight: "100vh",
                display: "grid",
                placeItems: "center",
                background: "linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)",
                padding: 16,
            }}
        >
            <form
                onSubmit={onSubmit}
                style={{
                    width: 360,
                    maxWidth: "100%",
                    background: "#ffffff",
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
                    padding: 18,
                    display: "grid",
                    gap: 12,
                }}
            >
                <div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                    Test user: <strong>test</strong> / <strong>test</strong>
                </div>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    Username
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        autoComplete="username"
                        required
                        style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "10px 12px",
                            fontSize: 14,
                        }}
                    />
                </label>

                <label style={{ display: "grid", gap: 6, fontSize: 13, fontWeight: 600 }}>
                    Password
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete={mode === "signin" ? "current-password" : "new-password"}
                        required
                        style={{
                            border: "1px solid #d1d5db",
                            borderRadius: 8,
                            padding: "10px 12px",
                            fontSize: 14,
                        }}
                    />
                </label>

                {error && (
                    <div
                        style={{
                            border: "1px solid #fecaca",
                            background: "#fef2f2",
                            color: "#991b1b",
                            borderRadius: 8,
                            padding: "8px 10px",
                            fontSize: 12,
                        }}
                    >
                        {error}
                    </div>
                )}

                <button
                    type="submit"
                    disabled={submitting}
                    style={{
                        border: "1px solid #1d4ed8",
                        background: submitting ? "#93c5fd" : "#2563eb",
                        color: "#ffffff",
                        borderRadius: 8,
                        padding: "10px 12px",
                        fontSize: 14,
                        fontWeight: 700,
                        cursor: submitting ? "default" : "pointer",
                    }}
                >
                    {submitting ? "Please wait..." : title}
                </button>

                <button
                    type="button"
                    onClick={() => {
                        setMode((m) => (m === "signin" ? "signup" : "signin"));
                        setError("");
                    }}
                    style={{
                        border: "1px solid #d1d5db",
                        background: "#ffffff",
                        color: "#111827",
                        borderRadius: 8,
                        padding: "8px 10px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                    }}
                >
                    {mode === "signin" ? "Need an account? Sign Up" : "Already have an account? Sign In"}
                </button>
            </form>
        </div>
    );
}
