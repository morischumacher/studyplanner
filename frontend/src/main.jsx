import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { ProgramProvider } from "./ProgramContext.jsx";
import "./global.css";

const container = document.getElementById("root");
if (!container) {
    throw new Error("No root element found. Did you forget <div id=\"root\"></div> in index.html?");
}

createRoot(container).render(
    <React.StrictMode>
        <ProgramProvider>
            <App />
        </ProgramProvider>
    </React.StrictMode>
);