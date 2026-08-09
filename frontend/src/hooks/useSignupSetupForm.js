import { useState } from "react";
import { TERM_WINTER } from "../utils/semesters.js";

/**
 * State for the post-signup setup wizard (initial programme, start term, focus).
 *
 * Extracted verbatim from App.jsx as part of the incremental decomposition of
 * that component. The initial programme code and focus are passed in so their
 * defaults match the original inline useState initialisers exactly; every field
 * and setter keeps its original name, so existing call sites are unchanged.
 */
export function useSignupSetupForm(initialProgramCode, initialFocus) {
    const [signupSetupProgramCode, setSignupSetupProgramCode] = useState(initialProgramCode);
    const [signupSetupStartSeason, setSignupSetupStartSeason] = useState(TERM_WINTER);
    const [signupSetupStartYear, setSignupSetupStartYear] = useState(new Date().getFullYear());
    const [signupSetupFocus, setSignupSetupFocus] = useState(initialFocus || "");
    const [isSavingSignupSetup, setIsSavingSignupSetup] = useState(false);

    return {
        signupSetupProgramCode, setSignupSetupProgramCode,
        signupSetupStartSeason, setSignupSetupStartSeason,
        signupSetupStartYear, setSignupSetupStartYear,
        signupSetupFocus, setSignupSetupFocus,
        isSavingSignupSetup, setIsSavingSignupSetup,
    };
}
