import { CSSProperties, ReactNode } from "react";
import { Badge } from "@/Components/Redesign";

type Variant = "blue" | "green" | "gray" | "navy" | "amber" | "red" | "teal";

interface FilterBadgeProps {
    /** Opens the list page pre-filtered to whatever the chip counts. */
    href: string;
    variant: Variant;
    children: ReactNode;
    /** Positions the link itself — Badge's own style prop sits inside it. */
    style?: CSSProperties;
}

/**
 * A stat-tile chip that opens the record it's counting.
 *
 * Wraps the shared Badge rather than forking it — colour, shape and padding
 * stay identical to every other badge in the system, this only adds the
 * affordance a link needs: pointer cursor, a hover/focus state, and a
 * trailing chevron so the pill visibly promises "opens something" instead of
 * reading as a static status label like the ones next to it.
 *
 * The hover treatment is a brightness filter rather than a per-variant darker
 * colour: seven variants would mean seven hover palettes to keep in sync with
 * Badge's own, for an effect a filter gets in one rule.
 */
export default function FilterBadge({
    href,
    variant,
    children,
    style,
}: FilterBadgeProps) {
    return (
        <a href={href} className="dv2-badge-link" style={style}>
            <Badge variant={variant} style={{ paddingRight: 7 }}>
                {children}
                <svg
                    width={11}
                    height={11}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    style={{ display: "block", flex: "none" }}
                >
                    <path d="m9 6 6 6-6 6" />
                </svg>
            </Badge>
        </a>
    );
}
