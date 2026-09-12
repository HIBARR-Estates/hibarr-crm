import { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface StatSegment {
    /** English source string — translated at render. */
    label: string;
    value: ReactNode;
    /** Colours the value. Defaults to navy (neutral). */
    tone?: "blue" | "green" | "amber";
}

export interface MultiStatTileProps {
    /** English source string — translated at render. */
    label: string;
    segments: StatSegment[];
    /** Small print under the tile — what the segments cover, and what they don't. */
    note?: string | null;
}

const TONE_COLOR: Record<NonNullable<StatSegment["tone"]>, string> = {
    blue: T.NAVY,
    green: T.GREEN,
    amber: T.AMBER,
};

/**
 * A StatTile that reads two or three numbers as one card instead of several.
 *
 * Two figures on this page only mean something next to each other — active
 * deals against deals won, commission paid against pending against forecast —
 * so splitting them into separate cards forced a reader to hold one number in
 * their head while finding the other. Same card chrome as StatTile, so the two
 * still sit in the same grid without looking like a different kind of thing.
 */
export default function MultiStatTile({
    label,
    segments,
    note,
}: MultiStatTileProps) {
    const { td } = useTd();

    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                padding: "14px 16px",
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 500, color: T.TEXT_MUTED }}>
                {td(label)}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 20,
                    marginTop: 6,
                }}
            >
                {segments.map((segment) => (
                    <div key={segment.label}>
                        <div
                            style={{
                                fontSize: 22,
                                fontWeight: 700,
                                color: TONE_COLOR[segment.tone ?? "blue"],
                                letterSpacing: "-0.02em",
                                lineHeight: 1,
                            }}
                        >
                            {segment.value}
                        </div>
                        <div
                            style={{
                                fontSize: 11,
                                color: T.TEXT_HINT,
                                marginTop: 3,
                            }}
                        >
                            {td(segment.label)}
                        </div>
                    </div>
                ))}
            </div>

            {note && (
                <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 9 }}>
                    {td(note)}
                </div>
            )}
        </div>
    );
}

/** A small pulsing placeholder for a segment still waiting on its own defer group. */
export function SegmentSkeleton() {
    return (
        <span
            className="dr-skeleton"
            aria-hidden
            style={{
                display: "inline-block",
                width: 40,
                height: 22,
                borderRadius: 4,
                verticalAlign: "bottom",
            }}
        />
    );
}
