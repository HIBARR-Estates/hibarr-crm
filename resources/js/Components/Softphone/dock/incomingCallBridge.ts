import { useSyncExternalStore } from "react";

/**
 * A call ringing in, handed from the softphone dock (which owns the routing,
 * the lead match and the ring) to a screen that wants to show it its own way.
 * The agent workspace passes `incomingInDock` to the dock, which then stops
 * drawing its classic ringing panel and publishes the call here instead; the
 * dock's pill reads it and opens the incoming card (canvas L7-13, L7-31).
 */
export interface IncomingCallView {
    id: string;
    /** The number that is calling. */
    peer: string;
    /** When the call started ringing here, epoch ms, for the "ringing 0:08" timer. */
    startedAt: number;
    /** The lead this number belongs to, when the viewer may open it. */
    leadId: number | null;
    name: string;
    /** The number is a lead's, but not one this viewer may open: no name, no facts. */
    hidden: boolean;
    /** More than one lead has this number. */
    multiple: number | null;
    /** No lead has this number. */
    unmatched: boolean;
    /** The lead is the viewer's own and the call rang their line first, or it came through the pool. */
    line: "own" | "pool";
    /** The lead's owner is the viewer. */
    ownLead: boolean;
    /** Another agent is left to ring after this one. */
    canPass: boolean;
    answer: () => void;
    pass: () => void;
    decline: () => void;
}

let current: IncomingCallView | null = null;
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

/** The dock publishes the ringing call, or null once it is answered, passed or gone. */
export function publishIncomingCall(view: IncomingCallView | null): void {
    if (current === view) return;
    current = view;
    emit();
}

export function useIncomingCall(): IncomingCallView | null {
    return useSyncExternalStore(
        subscribe,
        () => current,
        () => null,
    );
}
