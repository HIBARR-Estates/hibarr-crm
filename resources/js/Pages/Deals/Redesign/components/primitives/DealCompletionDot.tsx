import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealCompletionDotProps {
    filled: number;
    total: number;
}

/**
 * Compact stand-in for the "filled/total" text badge, gated behind
 * crm.deal-info-count-indicator — green when every field in the section is
 * filled, red when none are, orange in between. Purely visual — the parent
 * menu item wraps itself in the count tooltip so hovering anywhere on the
 * row reveals the exact count, not just this 8px dot.
 */
// Lighter than T.AMBER (which is a dark brownish text tone, not meant for a
// small solid dot) — no existing token fits a vivid-but-light orange fill.
const LIGHT_ORANGE = "#f59e0b";

export default function DealCompletionDot({ filled, total }: DealCompletionDotProps) {
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
