import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { CallLogRow } from "./types";

/** Outcome → lang key under pages.call_summary ("ended" reads as completed). */
export const OUTCOME_KEYS: Record<string, string> = {
    started: "started",
    ended: "completed",
    missed: "missed",
    declined: "declined",
    voicemail: "voicemail",
    busy: "busy",
    failed: "failed",
};

/** Human-friendly failure explanations. */
export function formatCallFailure(
    reason: string | null | undefined,
    message: string | null | undefined,
    t?: (key: string) => string,
): string | null {
    if (message?.trim()) {
        return message.trim();
    }
    if (!reason?.trim()) {
        return null;
    }
    const key = `pages.calls.failure_${reason}`;
    if (t) {
        const translated = t(key);
        if (translated && translated !== key) {
            return translated;
        }
    }
    const friendly: Record<string, string> = {
        timeout: "Call timed out",
        user_busy: "Callee busy",
        rejected: "Call declined",
        declined: "Call declined",
        not_found: "Number not found",
        disconnected: "Caller disconnected",
        answered_elsewhere: "Answered elsewhere",
        network_error: "Network error",
        mic_permission_denied: "Microphone denied",
        registration_required: "Line not registered",
        temporarily_unavailable: "Temporarily unavailable",
        browser_unsupported: "Browser unsupported",
    };
    return friendly[reason] ?? reason.replace(/_/g, " ");
}

export type RecordingStatus = "playable" | "processing" | "expired" | "restricted" | "failed" | "none";

export function getRecordingStatus(row: CallLogRow): {
    status: RecordingStatus;
    duration?: string;
    expiresAt?: string;
    error?: string;
} {
    const rec = row.recording;
    if (rec) {
        if (rec.state === "failed") {
            return { status: "failed", error: rec.error ?? undefined };
        }
        if (rec.state === "processing") {
            return { status: "processing" };
        }
        if (rec.expired || rec.state === "expired") {
            return { status: "expired", expiresAt: rec.expires_at ?? undefined };
        }
        if (rec.state === "restricted" || !rec.can_play || !rec.play_url) {
            return { status: "restricted" };
        }
        return {
            status: "playable",
            duration: rec.duration_seconds ? formatSeconds(rec.duration_seconds) : undefined,
        };
    }
    if (row.has_recording) {
        return { status: "processing" };
    }
    return { status: "none" };
}

function formatSeconds(secs: number): string {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Icon tile colours: connected green, unanswered red, refused amber. */
export function outcomeTone(outcome: string): { bg: string; fg: string } {
    if (outcome === "ended" || outcome === "started") {
        return { bg: T.GREEN_LIGHT, fg: T.GREEN };
    }
    if (outcome === "missed" || outcome === "failed") {
        return { bg: T.RED_SOFT, fg: T.RED };
    }
    return { bg: T.AMBER_SOFT, fg: T.AMBER };
}

/** Inbound/outbound arrow in a tinted square, coloured by outcome. */
export function CallDirectionIcon({
    direction,
    outcome,
    size = 34,
}: {
    direction: "inbound" | "outbound" | null;
    outcome: string;
    size?: number;
}) {
    const tone = outcomeTone(outcome);
    return (
        <span
            aria-hidden="true"
            style={{
                width: size,
                height: size,
                borderRadius: 6,
                background: tone.bg,
                color: tone.fg,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
            }}
        >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {direction === "inbound" ? (
                    <>
                        <path d="M17 7 7 17" />
                        <path d="M16 17H7V8" />
                    </>
                ) : (
                    <>
                        <path d="M7 17 17 7" />
                        <path d="M8 7h9v9" />
                    </>
                )}
            </svg>
        </span>
    );
}
