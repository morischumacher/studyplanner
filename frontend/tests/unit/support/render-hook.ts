/**
 * The smallest harness that will run a hook.
 *
 * A feature under `src/features/` keeps its state and its effects in a hook, so
 * some of what is worth testing cannot be reached by calling a function: only
 * React can run a hook. React runs it here, into a detached document, rather
 * than a stand-in that would prove nothing about the real thing.
 */

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

export interface HookHarness<Props, Result> {
    /** What the hook returned when it was last rendered. */
    readonly current: Result;
    /** Renders again with new props, as a parent handing down a changed value would. */
    rerender: (props: Props) => void;
    unmount: () => void;
}

export function renderHook<Props, Result>(
    hook: (props: Props) => Result,
    initialProps: Props
): HookHarness<Props, Result> {
    // React refuses to run effects outside act without it, and says so loudly.
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

    const container = document.createElement("div");
    document.body.appendChild(container);

    let rendered: { value: Result } | null = null;
    function Harness({ props }: { props: Props }) {
        rendered = { value: hook(props) };
        return null;
    }

    let root: Root | null = null;
    act(() => {
        root = createRoot(container);
        root.render(createElement(Harness, { props: initialProps }));
    });

    return {
        get current(): Result {
            if (!rendered) throw new Error("the hook has not rendered");
            return rendered.value;
        },
        rerender(props: Props) {
            act(() => {
                root?.render(createElement(Harness, { props }));
            });
        },
        unmount() {
            act(() => {
                root?.unmount();
            });
            container.remove();
        },
    };
}
