import { ReactNode, isValidElement } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { TileLabel } from "./StatTile";

function segmentValueTitle(value: ReactNode): string | undefined {
    if (typeof value === "string" || typeof value === "number") {
        return String(value);
    }

    if (isValidElement(value) && typeof value.props.children === "string") {
        return value.props.children;
    }

    return undefined;
}

export interface StatSegment {
    /**
     * Segment label. When the parent tile's `localize` is true, treated as
     * English and run through td(); otherwise rendered as-is.
     */
    label: string;
    value: ReactNode;
    /** Colours the value. Defaults to navy (neutral). */
    tone?: "blue" | "green" | "amber";
}

export interface MultiStatTileProps {
    /**
     * Tile label. When `localize` is true (default), treated as English and
     * run through td(). Pass false when the caller already used t().
     */
    label: string;
    segments: StatSegment[];
    /** Small print under the tile — what the segments cover, and what they don't. */
    note?: string | null;
    hint?: string | null;
    variant?: "default" | "team";
    /** When false, label/hint/note/segment labels are already translated via t(). */
    localize?: boolean;
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
    hint,
    variant = "default",
    localize = true,
}: MultiStatTileProps) {
    const { td } = useTd();
    const isTeam = variant === "team";
    const denseTeam = isTeam && segments.length >= 3;
    const valueSize = isTeam ? (denseTeam ? 22 : 26) : 22;

    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                padding: isTeam ? "16px 16px 14px" : "14px 16px",
                height: isTeam ? "100%" : undefined,
                minHeight: isTeam ? 100 : undefined,
                boxSizing: "border-box",
                display: isTeam ? "flex" : undefined,
                flexDirection: isTeam ? "column" : undefined,
                justifyContent: isTeam ? "space-between" : undefined,
            }}
        >
            <TileLabel label={label} hint={hint} localize={localize} />

            <div
                style={
                    denseTeam
                        ? {
                              display: "grid",
                              gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))`,
                              alignItems: "end",
                              gap: 8,
                              marginTop: 8,
                              minWidth: 0,
                          }
                        : {
                              display: "flex",
                              alignItems: "flex-end",
                              flexWrap: "wrap",
                              gap: isTeam ? 16 : 20,
                              marginTop: 8,
                          }
                }
            >
                {segments.map((segment) => {
                    const valueTitle = segmentValueTitle(segment.value);
                    const segmentLabel = localize
                        ? td(segment.label, { source: "en" })
                        : segment.label;

                    return (
                        <div
                            key={segment.label}
                            style={denseTeam ? { minWidth: 0 } : undefined}
                        >
                            <div
                                title={valueTitle}
                                style={{
                                    fontSize: valueSize,
                                    fontWeight: 700,
                                    color: TONE_COLOR[segment.tone ?? "blue"],
                                    letterSpacing: "-0.02em",
                                    lineHeight: 1,
                                    fontVariantNumeric: "tabular-nums",
                                    ...(denseTeam
                                        ? {
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                          }
                                        : {}),
                                }}
                            >
                                {segment.value}
                            </div>
                            <div
                                style={{
                                    fontSize: denseTeam ? 10 : 11,
                                    color: T.TEXT_HINT,
                                    marginTop: 4,
                                    ...(denseTeam
                                        ? {
                                              overflow: "hidden",
                                              textOverflow: "ellipsis",
                                              whiteSpace: "nowrap",
                                          }
                                        : {}),
                                }}
                                title={segmentLabel}
                            >
                                {segmentLabel}
                            </div>
                        </div>
                    );
                })}
            </div>

            {note && !isTeam && (
                <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 9 }}>
                    {localize ? td(note, { source: "en" }) : note}
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
