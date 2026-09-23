import { InfoCircleOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface StatTileProps {
    /**
     * Tile label. When `localize` is true (default), treated as English and
     * run through td(). Pass false when the caller already used t().
     */
    label: string;
    value: number | string | null;
    unit?: string;
    /** Same-length previous window, for the delta chip. Omit to hide it. */
    previous?: number | null;
    /** Rendered as bars under the value. Last bar is the current bucket. */
    spark?: number[];
    /** Small print under the tile — a caveat or a supporting count. */
    note?: string | null;
    /** Longer explanation on the (i) next to the label — keeps the card short. */
    hint?: string | null;
    /** Flips delta colouring for metrics where lower is better. */
    lowerIsBetter?: boolean;
    /** Colour of the leading bar and the delta when the trend is good. */
    tone?: "blue" | "green";
    /** Team dashboard: equal-height tiles and slightly larger values. */
    variant?: "default" | "team";
    /** When false, label/hint/note are already translated via t(). */
    localize?: boolean;
}

/** Label row shared with MultiStatTile. */
export function TileLabel({
    label,
    hint,
    localize = true,
}: {
    label: string;
    hint?: string | null;
    localize?: boolean;
}) {
    const { td } = useTd();
    const labelText = localize ? td(label, { source: "en" }) : label;
    const hintText = hint
        ? localize
            ? td(hint, { source: "en" })
            : hint
        : null;

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: T.TEXT_MUTED,
                lineHeight: 1.3,
            }}
        >
            <span>{labelText}</span>
            {hintText ? (
                <Tooltip title={hintText}>
                    <InfoCircleOutlined
                        style={{
                            fontSize: 12,
                            color: T.TEXT_HINT,
                            cursor: "help",
                        }}
                        aria-label={hintText}
                    />
                </Tooltip>
            ) : null}
        </div>
    );
}

const DASH = "—";

/**
 * One headline number: value, movement against the previous window, and the
 * shape that got there.
 *
 * A null value renders as an em dash rather than 0. Across these dashboards
 * "no data yet" and "measured zero" are different answers, and only one of
 * them is an agent's fault.
 */
export default function StatTile({
    label,
    value,
    unit,
    previous,
    spark,
    note,
    hint,
    lowerIsBetter = false,
    tone = "blue",
    variant = "default",
    localize = true,
}: StatTileProps) {
    const { td } = useTd();
    const isTeam = variant === "team";
    const valueSize = isTeam ? 30 : 26;

    const numeric = typeof value === "number" ? value : null;
    const hasDelta =
        numeric !== null && previous !== null && previous !== undefined;
    const delta = hasDelta ? numeric - previous : null;

    // Relative % vs the prior window when that window had a real baseline;
    // otherwise absolute movement (counts plain, rates suffixed with %).
    const deltaLabel = (() => {
        if (delta === null) return null;
        if (Math.abs(delta) < 0.05) return td("flat", { source: "en" });

        const sign = delta > 0 ? "+" : "−";
        const size = Math.abs(delta);

        if (previous && Math.abs(previous) >= 0.05) {
            return `${sign}${Math.round((size / previous) * 100)}%`;
        }

        return `${sign}${Math.round(size)}${unit === "%" ? "%" : ""}`;
    })();

    const improving = delta === null ? null : lowerIsBetter ? delta < 0 : delta > 0;
    const deltaColor =
        delta === null || Math.abs(delta) < 0.05
            ? T.TEXT_MUTED
            : improving
              ? T.GREEN
              : T.RED;

    const leadBar = improving === false ? T.RED : tone === "green" ? T.GREEN : T.BLUE;
    const max = Math.max(...(spark ?? [0]), 1);

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
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginTop: 8,
                }}
            >
                <span
                    style={{
                        fontSize: valueSize,
                        fontWeight: 700,
                        color: value === null ? T.TEXT_HINT : T.NAVY,
                        letterSpacing: "-0.02em",
                        lineHeight: 1,
                    }}
                >
                    {value === null ? DASH : value}
                    {value !== null && unit ? unit : ""}
                </span>

                {deltaLabel && (
                    <span
                        style={{ fontSize: 13, fontWeight: 600, color: deltaColor }}
                    >
                        {deltaLabel}
                    </span>
                )}
            </div>

            {spark && spark.length > 0 && (
                <div
                    aria-hidden
                    style={{
                        display: "flex",
                        alignItems: "flex-end",
                        gap: 3,
                        height: 26,
                        marginTop: 10,
                    }}
                >
                    {spark.map((point, index) => (
                        <span
                            key={index}
                            style={{
                                flex: 1,
                                // 2px floor so an empty bucket still reads as a
                                // bucket rather than a gap in the axis.
                                height: `${Math.max((point / max) * 100, 6)}%`,
                                minHeight: 2,
                                borderRadius: 2,
                                background:
                                    index === spark.length - 1
                                        ? leadBar
                                        : "#dbe6f2",
                            }}
                        />
                    ))}
                </div>
            )}

            {note && !isTeam && (
                <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 7 }}>
                    {localize ? td(note, { source: "en" }) : note}
                </div>
            )}
        </div>
    );
}
