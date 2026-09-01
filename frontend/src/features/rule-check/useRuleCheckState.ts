/**
 * What the rule checker last said, held one answer per programme.
 *
 * The answers are filed under the programme they were asked about rather than
 * kept as a single value, because a check is in flight for some time and the
 * student may switch curriculum while it is: an answer that arrives late is
 * still written, but only under the programme that asked for it, so the
 * planner never shows one curriculum's verdict against the other's plan.
 */

import { useCallback, useState } from "react";

import { EMPTY_RULE_CHECK_STATE } from "../../domain/programmes.ts";
import type { RuleCheckState } from "../../domain/programmes.ts";

/** How a programme's entry is replaced: outright, or worked out from the current one. */
export type RuleCheckStateUpdate = RuleCheckState | ((current: RuleCheckState) => RuleCheckState);

/** Writes one programme's entry. Programmes that have not been asked have none. */
export type SetProgramRuleCheckState = (
    targetProgramCode: string,
    updater: RuleCheckStateUpdate
) => void;

export interface UseRuleCheckStateInput {
    programCode: string;
}

export interface UseRuleCheckStateResult {
    /** The current programme's answer, or the empty one before it has any. */
    ruleCheckState: RuleCheckState;
    setProgramRuleCheckState: SetProgramRuleCheckState;
}

export function useRuleCheckState({ programCode }: UseRuleCheckStateInput): UseRuleCheckStateResult {
    const [ruleCheckStateByProgram, setRuleCheckStateByProgram] = useState<Record<string, RuleCheckState>>({});

    const setProgramRuleCheckState = useCallback<SetProgramRuleCheckState>((targetProgramCode, updater) => {
        if (!targetProgramCode) return;
        setRuleCheckStateByProgram((prev) => {
            const current = prev?.[targetProgramCode] ?? EMPTY_RULE_CHECK_STATE;
            const next = typeof updater === "function" ? updater(current) : updater;
            return {
                ...(prev || {}),
                [targetProgramCode]: next,
            };
        });
    }, []);

    const ruleCheckState = ruleCheckStateByProgram?.[programCode] ?? EMPTY_RULE_CHECK_STATE;

    return { ruleCheckState, setProgramRuleCheckState };
}
