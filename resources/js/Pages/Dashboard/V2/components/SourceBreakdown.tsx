import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { SourceQualityRow } from "../types";

export type SourceBreakdownRow = SourceQualityRow;

interface SourceBreakdownProps {
    rows: SourceQualityRow[];
    maxRows?: number;
    /** Leadership doesn't query won, so the column is opt-in. */
    showWon?: boolean;
}

/**
 * Lead volume and what it turns into, by source.
 *
 * Volume, contact rate and won rate only — there is deliberately no cost, CPL
 * or ROI column. No spend data is fed into the CRM for any channel (the Meta
 * integration is outbound Conversions API only), so a cost column here would
 * imply a parity across channels that does not exist.
 */
export default function SourceBreakdown({
    rows,
    maxRows = 8,
    showWon = false,
}: SourceBreakdownProps) {
    const { td } = useTd();

    const visible = rows.filter((row) => row.count > 0).slice(0, maxRows);

    if (!visible.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td("No leads attributed to a source in this window.")}
            </p>
        );
    }

    const grid = showWon ? "1fr 54px 78px 66px" : "1fr 54px 78px";
    const best = Math.max(...visible.map((row) => share(row.won ?? 0, row.count)));

    return (
        <div>
            <div
                className="dv2-eyebrow"
                style={{
                    display: "grid",
                    gridTemplateColumns: grid,
                    padding: "9px 0",
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div>{td("Source")}</div>
                <div style={{ textAlign: "right" }}>{td("Leads")}</div>
                <div style={{ textAlign: "right" }}>{td("Contacted")}</div>
                {showWon && <div style={{ textAlign: "right" }}>{td("Won")}</div>}
            </div>

            {visible.map((row, index) => {
                const wonShare = share(row.won ?? 0, row.count);

                return (
                    <div
                        key={row.id}
                        style={{
                            display: "grid",
                            gridTemplateColumns: grid,
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
                            {td(row.name)}
                        </div>
                        <div style={{ textAlign: "right" }}>{row.count}</div>
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
