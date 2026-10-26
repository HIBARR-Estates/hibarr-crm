import { useCallback, useEffect, useRef } from "react";

/**
 * Call-state sounds for the softphone.
 *
 * Files live in `public/audio/softphone/` so they are served as-is:
 *   incoming.mp3 — played once when an inbound call starts ringing
 *   ringing.mp3  — looped for the duration of the ringing state
 *   ended.mp3    — played once when a call finishes
 *
 * Browsers block audio until the user has interacted with the page, so playback
 * failures are swallowed on purpose (the call itself must never be affected by a
 * cosmetic sound).
 */

const SOUNDS = {
    incoming: "/audio/softphone/incoming.mp3",
    ringing: "/audio/softphone/ringing.mp3",
    ended: "/audio/softphone/ended.mp3",
} as const;

export type CallSound = keyof typeof SOUNDS;

const create = (src: string): HTMLAudioElement | null => {
    if (typeof Audio === "undefined") {
        return null;
    }
    try {
        const el = new Audio(src);
        el.preload = "auto";
        // Warn if the audio element fails to load (e.g. missing file in dev).
        el.addEventListener("error", () => {
            if (process.env.NODE_ENV !== "production") {
                console.warn(`[useCallSounds] failed to load sound: ${src}`);
            }
        });
        return el;
    } catch {
        return null;
    }
};

export default function useCallSounds() {
    const incomingRef = useRef<HTMLAudioElement | null>(null);
    const ringingRef = useRef<HTMLAudioElement | null>(null);
    const endedRef = useRef<HTMLAudioElement | null>(null);
    const unlockedRef = useRef(false);

    const safePlay = useCallback((el: HTMLAudioElement | null, loop = false) => {
        if (!el) {
            return;
        }
        try {
            el.loop = loop;
            // Restart from the beginning when the same element is reused.
            el.currentTime = 0;
            const result = el.play();
            if (result && typeof result.catch === "function") {
                result.catch(() => {
                    // Blocked by autoplay policy until the first user gesture.
                });
            }
        } catch {
            // ignore — cosmetic only
        }
    }, []);

    const stopAll = useCallback(() => {
        [incomingRef.current, ringingRef.current, endedRef.current].forEach((el) => {
            if (!el) {
                return;
            }
            try {
                el.pause();
                el.currentTime = 0;
            } catch {
                // ignore
            }
        });
    }, []);

    /** `incoming` — one-shot chime when a call starts ringing. */
    const playIncoming = useCallback(() => {
        if (!incomingRef.current) {
            incomingRef.current = create(SOUNDS.incoming);
        }
        safePlay(incomingRef.current);
    }, [safePlay]);

    /** `ringing` — loops until stopRinging() is called. */
    const startRinging = useCallback(() => {
        if (!ringingRef.current) {
            ringingRef.current = create(SOUNDS.ringing);
        }
        safePlay(ringingRef.current, true);
    }, [safePlay]);

    const stopRinging = useCallback(() => {
        const el = ringingRef.current;
        if (!el) {
            return;
        }
        try {
            el.pause();
            el.currentTime = 0;
        } catch {
            // ignore
        }
    }, []);

    /** `ended` — one-shot "call finished" cue. */
    const playEnded = useCallback(() => {
        if (!endedRef.current) {
            endedRef.current = create(SOUNDS.ended);
        }
        safePlay(endedRef.current);
    }, [safePlay]);

    /**
     * Call after the first real user gesture so later sounds are allowed by the
     * browser's autoplay policy.
     */
    const unlock = useCallback(() => {
        if (unlockedRef.current || typeof window === "undefined") {
            return;
        }
        unlockedRef.current = true;
        ["pointerdown", "keydown", "touchstart"].forEach((evt) => {
            window.addEventListener(evt, () => { unlockedRef.current = true; }, { once: true });
        });
    }, []);

    useEffect(() => {
        return () => {
            stopAll();
            incomingRef.current = null;
            ringingRef.current = null;
            endedRef.current = null;
        };
    }, [stopAll]);

    return {
        playIncoming,
        startRinging,
        stopRinging,
        playEnded,
        stopAll,
        unlock,
    };
}
