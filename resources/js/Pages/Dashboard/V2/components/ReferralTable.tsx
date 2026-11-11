import { useState } from "react";
import { Pagination, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { formatDate } from "@/Components/Redesign/adapters/dateFormat";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { PartnerReferral } from "../types";

const GRID = "minmax(130px, 1.3fr) 108px minmax(100px, .9fr) minmax(100px, 1fr) .7fr .9fr";

const ADDED_WINDOWS: Array<{ days: number | null; label: string }> = [
    { days: null, label: "Any time" },
    { days: 7, label: "7 days" },
    { days: 30, label: "30 days" },
    { days: 90, label: "90 days" },
];

const STAGE_PILL: Record<string, string> = {
    "Deal open": "blue",
    "Meeting held": "blue",
    Contacted: "gray",
    "Not contacted": "amber",
};

/**
 * A partner's open referrals.
 *
 * Names arrive in full. No email, phone, or deal value is in the payload —
 * that redaction happens in the query, not by this table choosing not to
 * render a field it was handed. Source prefers the first-touch UTM source.
 */
export default function ReferralTable({
    rows,
    onOpen,
}: {
    rows: PartnerReferral[];
    onOpen: (id: number) => void;
}) {
    const { td } = useTd();
    const [stalledOnly, setStalledOnly] = useState(false);
    const [addedDays, setAddedDays] = useState<number | null>(null);
    const [addedSort, setAddedSort] = useState<"asc" | "desc">("asc");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    const stalled = rows.filter((row) => row.stalled).length;
    const visible = rows
        .filter((row) => (stalledOnly ? row.stalled : true))
        .filter((row) => addedWithin(row.added_at, addedDays))
        .slice()
        .sort((a, b) => {
            const cmp = (a.added_at ?? "").localeCompare(b.added_at ?? "");
            return addedSort === "asc" ? cmp : -cmp;
        });
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

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
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
                    {ADDED_WINDOWS.map((window) => (
                        <button
                            key={window.label}
                            type="button"
                            className="dv2-chip"
                            aria-pressed={addedDays === window.days}
                            onClick={() => {
                                setAddedDays(window.days);
                                setPage(1);
                            }}
                        >
                            {td(window.label, { source: "en" })}
                        </button>
                    ))}
                </div>
            </div>

            <div className="dv2-scroll-x" style={{ flex: 1 }}>
                <div style={{ minWidth: 800 }}>
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
                        <div>
                            <button
                                type="button"
                                onClick={() => {
                                    setAddedSort((current) => (current === "asc" ? "desc" : "asc"));
                                    setPage(1);
                                }}
                                aria-sort={addedSort === "asc" ? "ascending" : "descending"}
                                style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: 4,
                                    padding: 0,
                                    border: "none",
                                    background: "none",
                                    color: "inherit",
                                    font: "inherit",
                                    letterSpacing: "inherit",
                                    textTransform: "inherit",
                                    cursor: "pointer",
                                }}
                            >
                                {td("Added", { source: "en" })}
                                <span aria-hidden>{addedSort === "asc" ? "↑" : "↓"}</span>
                            </button>
                        </div>
                        <div>{td("Source", { source: "en" })}</div>
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
                            {visible.length === 0
                                ? td("No referrals match.", { source: "en" })
                                : td("No stalled referrals.", { source: "en" })}
                        </p>
                    ) : (
                        pageRows.map((row, index) => (
                        <div
                            key={row.id}
                            className="dv2-row"
                            role="button"
                            tabIndex={0}
                            onClick={() => onOpen(row.id)}
                            onKeyDown={(event) => {
                                if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    onOpen(row.id);
                                }
                            }}
                            style={{
                                display: "grid",
                                gridTemplateColumns: GRID,
                                alignItems: "center",
                                padding: "12px 18px",
                                fontSize: 14,
                                cursor: "pointer",
                                borderBottom:
                                    index === pageRows.length - 1
                                        ? undefined
                                        : `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div className="truncate" style={{ fontWeight: 600 }}>
                                    {row.client ?? td("Unnamed referral", { source: "en" })}
                                </div>
                            </div>

                            <div>{formatDate(row.added_at)}</div>

                            <div style={{ minWidth: 0 }}>
                                <div className="truncate">
                                    {row.source ?? "—"}
                                </div>
                                {row.lead_source && (
                                    <div
                                        className="truncate"
                                        style={{ fontSize: 11, color: T.TEXT_HINT }}
                                    >
                                        {row.lead_source}
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

/** True when the lead was added inside the last `days`, counting today. */
function addedWithin(addedAt: string | null, days: number | null): boolean {
    if (days === null) return true;
    if (!addedAt) return false;

    const added = new Date(addedAt).getTime();
    if (Number.isNaN(added)) return false;

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - days);

    return added >= start.getTime();
}
