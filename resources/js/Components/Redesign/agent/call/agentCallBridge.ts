import { useEffect, useSyncExternalStore } from "react";

/**
 * Small hand-offs between the call card in the dock and the pages under it.
 * The card is mounted once in the layout, so it cannot reach a page's own
 * state: it leaves a note here and the page picks it up.
 */

let resumeLeadId: number | null = null;
let flowsOpen = 0;
const listeners = new Set<() => void>();

function emit(): void {
    listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

/** The card asks the lead's page to open its running qualification. */
export function requestResumeQualification(leadId: number): void {
    resumeLeadId = leadId;
    emit();
}

/** True once, while a resume has been asked for this lead; `consume` clears it. */
export function useResumeQualificationRequest(leadId: number): { requested: boolean; consume: () => void } {
    const requested = useSyncExternalStore(
        subscribe,
        () => resumeLeadId === leadId,
        () => false,
    );
    return {
        requested,
        consume: () => {
            if (resumeLeadId === leadId) {
                resumeLeadId = null;
                emit();
            }
        },
    };
}

/** A qualification or analysis is open under the dock: it carries the call strip itself. */
export function useRegisterOpenFlow(): void {
    useEffect(() => {
        flowsOpen += 1;
        emit();
        return () => {
            flowsOpen -= 1;
            emit();
        };
    }, []);
}

export function useFlowOpen(): boolean {
    return useSyncExternalStore(
        subscribe,
        () => flowsOpen > 0,
        () => false,
    );
}
