import { useState } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerReferral } from "../types";

const GRID = "minmax(150px, 1.5fr) 1fr .9fr .8fr 1fr 96px";

const STAGE_PILL: Record<string, string> = {
    "Deal open": "blue",
    "Meeting held": "blue",
    Contacted: "gray",
    "Not contacted": "amber",
};

/**
 * A partner's open referrals.
 *
 * Names arrive abbreviated and no contact detail or deal value is in the
 * payload at all — the redaction happens in the query, not by this table
 * choosing not to render a field it was handed.
 */
export default function ReferralTable({
    rows,
    onFlag,
}: {
    rows: PartnerReferral[];
    onFlag: (referral: PartnerReferral) => void;
}) {
    const { td } = useTd();
    const [stalledOnly, setStalledOnly] = useState(false);

    const stalled = rows.filter((row) => row.stalled).length;
    const visible = stalledOnly ? rows.filter((row) => row.stalled) : rows;

    if (!rows.length) {
        return (
            <p
                style={{
                    margin: 0,
                    padding: 18,
                    fontSize: 14,
                    color: T.TEXT_MUTED,
                }}
            >
                {td("You have no referrals in progress.", { source: "en" })}
            </p>
        );
    }

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "14px 18px",
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: T.NAVY }}>
                        {td("Your active referrals", { source: "en" })}
                    </div>
                    <div
                        style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 3 }}
                    >
                        {rows.length} {td("in progress", { source: "en" })} ·{" "}
                        {td("client contact details stay with the assigned agent", { source: "en" })}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    <button
                        type="button"
                        className="dv2-chip"
                        aria-pressed={!stalledOnly}
                        onClick={() => setStalledOnly(false)}
                    >
                        {td("All", { source: "en" })} {rows.length}
                    </button>
                    <button
                        type="button"
                        className="dv2-chip"
                        aria-pressed={stalledOnly}
                        disabled={stalled === 0}
                        onClick={() => setStalledOnly(true)}
                    >
                        {td("Stalled", { source: "en" })} {stalled}
                    </button>
                </div>
            </div>

            <div className="dv2-scroll-x">
                <div style={{ minWidth: 620 }}>
                    <div
                        className="dv2-eyebrow"
                        style={{
                            display: "grid",
                            gridTemplateColumns: GRID,
                            padding: "9px 18px",
                            background: T.SURFACE_2,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <div>{td("Client", { source: "en" })}</div>
                        <div>{td("Stage", { source: "en" })}</div>
                        <div>{td("Agent", { source: "en" })}</div>
                        <div style={{ textAlign: "right" }}>{td("Days open", { source: "en" })}</div>
                        <div style={{ textAlign: "right" }}>
                            {td("Last update", { source: "en" })}
                        </div>
                        <div />
                    </div>

                    {visible.map((row, index) => (
                        <div
                            key={row.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: GRID,
                                alignItems: "center",
                                padding: "12px 18px",
                                fontSize: 14,
                                borderBottom:
                                    index === visible.length - 1
                                        ? undefined
                                        : `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {row.client ?? td("Unnamed referral", { source: "en" })}
                                </div>
                                {row.flag_response && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: T.GREEN,
                                            marginTop: 2,
                                        }}
                                    >
                                        {td("Reply", { source: "en" })}: {row.flag_response}
                                    </div>
                                )}
                            </div>

                            <div>
                                <span
                                    className={`dr-pill dr-pill-${
                                        row.stalled
                                            ? "red"
                                            : (STAGE_PILL[row.stage] ?? "gray")
                                    }`}
                                >
                                    {row.stalled
                                        ? td("Stalled", { source: "en" })
                                        : td(row.stage, { source: "en" })}
                                </span>
                            </div>

                            <div style={{ color: T.TEXT_MUTED }}>
                                {row.agent ?? "—"}
                            </div>

                            <div
                                style={{
                                    textAlign: "right",
                                    color: row.stalled ? T.RED : T.TEXT,
                                    fontWeight: row.stalled ? 600 : 400,
                                }}
                            >
                                {row.days_open}
                            </div>

                            {/* Days since the lead record last changed — not
                                since anyone spoke to the client. The stage pill
                                is what says whether contact has happened. */}
                            <div
                                style={{
                                    textAlign: "right",
                                    color: row.stalled ? T.RED : T.TEXT_MUTED,
                                }}
                            >
                                {row.idle_days === 0
                                    ? td("Today", { source: "en" })
                                    : `${row.idle_days}${td("d ago", { source: "en" })}`}
                            </div>

                            <div style={{ textAlign: "right" }}>
                                {row.flag_status ? (
                                    <span
                                        className="dr-pill dr-pill-amber"
                                        title={td("Waiting on the partner team", { source: "en" })}
                                    >
                                        {td("Flagged", { source: "en" })}
                                    </span>
                                ) : (
                                    <button
                                        type="button"
                                        className="dr-btn dr-btn-ghost dr-btn-sm"
                                        onClick={() => onFlag(row)}
                                    >
                                        {td("Flag", { source: "en" })}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
