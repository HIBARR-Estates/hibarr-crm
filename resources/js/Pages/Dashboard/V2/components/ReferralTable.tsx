import { useState } from "react";
import { Pagination, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerReferral } from "../types";

const GRID = "minmax(150px, 1.5fr) 1fr .8fr 1fr";

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
export default function ReferralTable({ rows }: { rows: PartnerReferral[] }) {
    const { td } = useTd();
    const [stalledOnly, setStalledOnly] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const stalled = rows.filter((row) => row.stalled).length;
    const visible = stalledOnly ? rows.filter((row) => row.stalled) : rows;
    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const safePage = Math.min(page, totalPages);
    const pageRows = visible.slice(
        (safePage - 1) * pageSize,
        safePage * pageSize,
    );

    // Every referral has completed (the view drops the whole book when there
    // are none at all): keep the card's title so it doesn't read as a gap.
    if (!rows.length) {
        return (
            <div style={{ padding: "14px 18px" }}>
                <div style={{ fontSize: 16, fontWeight: 600, color: T.NAVY }}>
                    {td("Your active referrals", { source: "en" })}
                </div>
                <p
                    style={{
                        margin: "6px 0 0",
                        fontSize: 14,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td("You have no referrals in progress.", { source: "en" })}
                </p>
            </div>
        );
    }

    return (
        <div
            style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
            }}
        >
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
                        {td("client contact details are not shown", { source: "en" })}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 6 }}>
                    <button
                        type="button"
                        className="dv2-chip"
                        aria-pressed={!stalledOnly}
                        onClick={() => {
                            setStalledOnly(false);
                            setPage(1);
                        }}
                    >
                        {td("All", { source: "en" })} {rows.length}
                    </button>
                    <button
                        type="button"
                        className="dv2-chip"
                        aria-pressed={stalledOnly}
                        disabled={stalled === 0}
                        onClick={() => {
                            setStalledOnly(true);
                            setPage(1);
                        }}
                    >
                        {td("Stalled", { source: "en" })} {stalled}
                    </button>
                </div>
            </div>

            <div className="dv2-scroll-x" style={{ flex: 1 }}>
                <div style={{ minWidth: 520 }}>
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
                        <div style={{ textAlign: "right" }}>{td("Days open", { source: "en" })}</div>
                        <div style={{ textAlign: "right" }}>
                            {td("Last update", { source: "en" })}
                        </div>
                    </div>

                    {pageRows.length === 0 ? (
                        <p
                            style={{
                                margin: 0,
                                padding: 18,
                                fontSize: 14,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {td("No stalled referrals.", { source: "en" })}
                        </p>
                    ) : (
                        pageRows.map((row, index) => (
                        <div
                            key={row.id}
                            style={{
                                display: "grid",
                                gridTemplateColumns: GRID,
                                alignItems: "center",
                                padding: "12px 18px",
                                fontSize: 14,
                                borderBottom:
                                    index === pageRows.length - 1
                                        ? undefined
                                        : `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div>
                                <div style={{ fontWeight: 600 }}>
                                    {row.client ?? td("Unnamed referral", { source: "en" })}
                                </div>
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
                        </div>
                        ))
                    )}
                </div>
            </div>

            <Pagination
                page={safePage}
                pageSize={pageSize}
                totalItems={visible.length}
                onPageChange={setPage}
                onPageSizeChange={(size) => {
                    setPageSize(size);
                    setPage(1);
                }}
                itemLabel="referral"
                itemLabelPlural="referrals"
            />
        </div>
    );
}
