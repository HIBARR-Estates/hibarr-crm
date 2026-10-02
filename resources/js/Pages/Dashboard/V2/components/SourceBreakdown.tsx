import { Link } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { SourceQualityRow } from "../types";

export type SourceBreakdownRow = SourceQualityRow;

interface SourceBreakdownProps {
    rows: SourceQualityRow[];
    maxRows?: number;
    /** Leadership doesn't query won, so the column is opt-in. */
    showWon?: boolean;
    /** When set, each lead count opens that source in the leads list. */
    from?: string;
    to?: string;
}

/**
 * Lead volume and what it turns into, by source.
 *
 * Volume, contact rate and won rate only — there is deliberately no cost, CPL
 * or ROI column. No spend data is fed into the CRM for any channel (the Meta
 * integration is outbound Conversions API only), so a cost column here would
 * imply a parity across channels that does not exist.
 *
 * Lead counts open the leads list filtered to that source (and the window,
 * when the caller has one).
 */
export default function SourceBreakdown({
    rows,
    maxRows = 8,
    showWon = false,
    from,
    to,
}: SourceBreakdownProps) {
    const { td } = useTd();

    const visible = rows.filter((row) => row.count > 0).slice(0, maxRows);

    if (!visible.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td("No leads attributed to a source in this window.", { source: "en" })}
            </p>
        );
    }

    const grid = showWon
        ? "minmax(0, 1fr) 64px 96px 66px"
        : "minmax(0, 1fr) 64px 96px";
    const best = Math.max(...visible.map((row) => share(row.won ?? 0, row.count)));

    return (
        <div>
            <div
                className="dv2-eyebrow"
                style={{
                    display: "grid",
                    gridTemplateColumns: grid,
                    columnGap: 16,
                    padding: "9px 0",
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div>{td("Source", { source: "en" })}</div>
                <div style={{ textAlign: "right" }}>{td("Leads", { source: "en" })}</div>
                <div style={{ textAlign: "right" }}>{td("Contacted", { source: "en" })}</div>
                {showWon && <div style={{ textAlign: "right" }}>{td("Won", { source: "en" })}</div>}
            </div>

            {visible.map((row, index) => {
                const wonShare = share(row.won ?? 0, row.count);
                const href = sourceListHref(row.id, from, to);

                return (
                    <div
                        key={row.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: grid,
                            columnGap: 16,
                            padding: "10px 0",
                            fontSize: 14,
                            borderBottom:
                                index === visible.length - 1
                                    ? undefined
                                    : `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div
                            style={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                            }}
                        >
                            <Link href={href} className="dv2-metric-link">
                                {td(row.name, { source: "en" })}
                            </Link>
                        </div>
                        <div style={{ textAlign: "right" }}>
                            <Link href={href} className="dv2-metric-link">
                                {row.count}
                            </Link>
                        </div>
                        <div style={{ textAlign: "right", color: T.TEXT_MUTED }}>
                            {share(row.contacted, row.count)}%
                        </div>
                        {showWon && (
                            <div
                                style={{
                                    textAlign: "right",
                                    fontWeight: 600,
                                    color:
                                        wonShare === 0
                                            ? T.RED
                                            : wonShare === best
                                              ? T.GREEN
                                              : T.TEXT,
                                }}
                            >
                                {wonShare}%
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}

const share = (part: number, whole: number) =>
    whole > 0 ? Math.round((part / whole) * 100) : 0;

function sourceListHref(sourceId: number, from?: string, to?: string): string {
    return route("lead-contact.index", {
        lead_source: sourceId,
        ...(from ? { start_date: from } : {}),
        ...(to ? { end_date: to } : {}),
    });
}
