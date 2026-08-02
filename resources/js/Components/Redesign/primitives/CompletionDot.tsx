import { REDESIGN_TOKENS as T } from "../tokens";

interface CompletionDotProps {
    filled: number;
    total: number;
}

// Lighter than T.AMBER (which is a dark brownish text tone, not meant for a
// small solid dot) — no existing token fits a vivid-but-light orange fill.
const LIGHT_ORANGE = "#f59e0b";

/** Compact progress dot: green when complete, red when empty, orange in between. */
export default function CompletionDot({ filled, total }: CompletionDotProps) {
    const color =
        total > 0 && filled >= total ? T.GREEN : filled === 0 ? T.RED : LIGHT_ORANGE;

    return (
        <span
            aria-label={`${filled} of ${total} fields filled`}
            style={{
                display: "inline-block",
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: color,
                flexShrink: 0,
            }}
        />
    );
}
