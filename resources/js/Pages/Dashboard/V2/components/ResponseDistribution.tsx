import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ResponseDistribution as Data } from "../types";

const SEVERITY_FILL = {
    good: T.GREEN,
    ok: T.BLUE,
    warn: T.AMBER,
    bad: T.RED,
} as const;

/**
 * First-response time as a distribution, not a mean.
 *
 * A mean hides the shape that matters: most leads answered inside an hour plus
 * a handful never picked up averages out to the same number as a uniformly
 * mediocre team, and the two need completely different responses.
 */
export default function ResponseDistribution({ data }: { data: Data }) {
    const { td } = useTd();

    if (!data.total) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td("No lead in this window has a recorded first contact yet.")}
            </p>
        );
    }

    const max = Math.max(...data.buckets.map((bucket) => bucket.count), 1);

    const summary: Array<[string, string, string]> = [
        ["Median", formatMinutes(data.median_minutes, td), T.NAVY],
        ["90th percentile", formatMinutes(data.p90_minutes, td), T.NAVY],
        [
            "Longest still waiting",
            data.worst_open_hours === null ? "—" : `${data.worst_open_hours}h`,
            data.worst_open_hours ? T.RED : T.NAVY,
        ],
    ];

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 6,
                    height: 110,
                }}
            >
                {data.buckets.map((bucket) => (
                    <div
                        key={bucket.label}
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "center",
                            gap: 6,
                        }}
                        title={`${bucket.count} ${td("leads")}`}
                    >
                        <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                            {bucket.count || ""}
                        </span>
                        <div
                            style={{
                                width: "100%",
                                height: `${(bucket.count / max) * 100}%`,
                                minHeight: bucket.count > 0 ? 4 : 1,
                                background:
                                    bucket.count > 0
                                        ? SEVERITY_FILL[bucket.severity]
                                        : T.BORDER,
                                borderRadius: 3,
                            }}
                        />
                        <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                            {bucket.label}
                        </span>
                    </div>
                ))}
            </div>

            <div
                style={{
                    display: "flex",
                    gap: 22,
                    flexWrap: "wrap",
                    marginTop: 14,
                    paddingTop: 12,
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                {summary.map(([label, value, color]) => (
                    <div key={label}>
                        <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                            {td(label)}
                        </div>
                        <div
                            style={{
                                fontSize: 16,
                                fontWeight: 700,
                                color,
                                marginTop: 2,
                            }}
                        >
                            {value}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function formatMinutes(
    minutes: number | null,
    td: (value: string) => string,
): string {
    if (minutes === null) return "—";
    if (minutes < 60) return `${minutes}${td("m")}`;
    if (minutes < 1440) {
        const hours = Math.floor(minutes / 60);

        return `${hours}${td("h")} ${minutes % 60}${td("m")}`;
    }

    const days = Math.floor(minutes / 1440);

    return `${days}${td("d")} ${Math.round((minutes % 1440) / 60)}${td("h")}`;
}
