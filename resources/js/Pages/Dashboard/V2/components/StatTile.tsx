import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface StatTileProps {
    /** English source string — translated at render. */
    label: string;
    value: number | string | null;
    unit?: string;
    /** Same-length previous window, for the delta chip. Omit to hide it. */
    previous?: number | null;
    /** Rendered as bars under the value. Last bar is the current bucket. */
    spark?: number[];
    /** Small print under the tile — a caveat or a supporting count. */
    note?: string | null;
    /** Flips delta colouring for metrics where lower is better. */
    lowerIsBetter?: boolean;
    /** Colour of the leading bar and the delta when the trend is good. */
    tone?: "blue" | "green";
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
    lowerIsBetter = false,
    tone = "blue",
}: StatTileProps) {
    const { td } = useTd();

    const numeric = typeof value === "number" ? value : null;
    const hasDelta =
        numeric !== null && previous !== null && previous !== undefined;
    const delta = hasDelta ? numeric - previous : null;

    // A move from nothing isn't a percentage, so absolute movement is shown
    // whenever the previous window was empty.
    const deltaLabel = (() => {
        if (delta === null) return null;
        if (Math.abs(delta) < 0.05) return td("flat");

        const sign = delta > 0 ? "+" : "−";
        const size = Math.abs(delta);

        if (unit === "%") return `${sign}${Math.round(size)}pt`;
        if (previous) return `${sign}${Math.round((size / previous) * 100)}%`;

        return `${sign}${Math.round(size)}`;
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
                padding: "14px 16px",
            }}
        >
            <div style={{ fontSize: 13, fontWeight: 500, color: T.TEXT_MUTED }}>
                {td(label)}
            </div>

            <div
                style={{
                    display: "flex",
                    alignItems: "baseline",
                    gap: 8,
                    marginTop: 6,
                }}
            >
                <span
                    style={{
                        fontSize: 26,
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

            {note && (
                <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 7 }}>
                    {td(note)}
                </div>
            )}
        </div>
    );
}
