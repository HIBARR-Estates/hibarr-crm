import { Suspense, lazy, useCallback, useEffect, useState, type ComponentProps } from "react";
import { wantsNextStep, type DoNextRequest } from "./doNext";

const loadPrompt = () => import("./DoNextPrompt");
const DoNextPrompt = lazy(loadPrompt);

/**
 * Do next's state for a page: `offer` opens the prompt when the record still
 * keeps a next step (an open deal, a lead not yet qualified) and does nothing
 * otherwise, so a won deal or a qualified lead is never asked.
 */
export default function useDoNext() {
    const [request, setRequest] = useState<DoNextRequest | null>(null);

    // The prompt's code is small; have it ready before the first tick.
    useEffect(() => {
        const warm = () => void loadPrompt();
        if (typeof window.requestIdleCallback === "function") {
            const id = window.requestIdleCallback(warm, { timeout: 5000 });
            return () => window.cancelIdleCallback(id);
        }
        const id = setTimeout(warm, 2500);
        return () => clearTimeout(id);
    }, []);

    const offer = useCallback((next: DoNextRequest): boolean => {
        if (!wantsNextStep(next.record)) return false;
        setRequest(next);
        return true;
    }, []);
    const close = useCallback(() => setRequest(null), []);

    return { request, offer, close };
}

type PromptProps = ComponentProps<typeof DoNextPrompt>;

/** Renders the prompt for `request`, loading its code on first use. */
export function DoNext({ request, ...props }: Omit<PromptProps, "request"> & { request: DoNextRequest | null }) {
    if (!request) return null;
    return (
        <Suspense fallback={null}>
            <DoNextPrompt request={request} {...props} />
        </Suspense>
    );
}
