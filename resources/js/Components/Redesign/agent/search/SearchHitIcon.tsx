import Icon from "../../primitives/Icon";
import type { Hit } from "./hits";

const AVATAR_TONES = ["blue", "navy", "green", "slate"] as const;

/** The round initials of a person, or the square glyph of any other kind of result (as on the L7-23 and L7-24 boards). */
export default function SearchHitIcon({ hit }: { hit: Hit }) {
    if (hit.kind === "person") {
        return (
            <span className={`agent-sr__avatar agent-sr__avatar--${AVATAR_TONES[hit.person.id % AVATAR_TONES.length]}`} aria-hidden="true">
                {hit.initials}
            </span>
        );
    }
    if (hit.kind === "deal") {
        return (
            <span
                className={`agent-sr__glyph agent-sr__glyph--deal${hit.deal.read_only ? " agent-sr__glyph--muted" : ""}`}
                style={!hit.deal.read_only && hit.deal.stage_color ? { background: hit.deal.stage_color } : undefined}
                aria-hidden="true"
            >
                {hit.deal.read_only ? (
                    <Icon name="lock" size={15} />
                ) : (
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" style={{ display: "block" }}>
                        <polygon points="12 2 22 12 12 22 2 12" />
                    </svg>
                )}
            </span>
        );
    }
    const glyph = hit.kind === "property" ? ("home" as const) : hit.kind === "task" ? ("check-square" as const) : hit.kind === "meeting" ? ("clock" as const) : ("edit" as const);
    return (
        <span className={`agent-sr__glyph agent-sr__glyph--${hit.kind}`} aria-hidden="true">
            <Icon name={glyph} size={15} />
        </span>
    );
}
