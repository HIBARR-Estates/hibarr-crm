import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

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
