import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

/** "#RRGGBB" only: anything else (a named colour, a missing value) is left neutral. */
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A lifecycle status as a pill in its configured colour — the same quiet
 * tint-and-border treatment as the redesign's Badge, but driven by the colour
 * an admin chose for the status rather than a fixed variant.
 */
export default function StatusPill({
    label,
    color,
}: {
    label: string;
    color?: string | null;
}) {
    const hex = color && HEX.test(color) ? color : null;

    return (
        <span
            className="inline-flex items-center gap-1.5 whitespace-nowrap font-semibold"
            style={{
                fontSize: 12,
                lineHeight: 1,
                padding: "5px 10px",
                borderRadius: 999,
                color: T.TEXT,
                background: hex ? `${hex}1A` : T.GRAY,
                border: `1px solid ${hex ? `${hex}55` : T.BORDER}`,
            }}
        >
            <span
                aria-hidden
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: hex ?? T.TEXT_HINT,
                    flexShrink: 0,
                }}
            />
            {label}
        </span>
    );
}
