import type { ReactNode } from "react";
import { Modal, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { formatDate } from "@/Components/Redesign/adapters/dateFormat";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { money } from "../format";
import type { PartnerDealRow, PartnerFlagDetail, PartnerLeadDetail } from "../types";
import StatusDot from "./StatusDot";

interface Props {
    open: boolean;
    detail: PartnerLeadDetail | null;
    loading: boolean;
    error: boolean;
    onClose: () => void;
}

/** Outcome colours: open reads blue, won green, lost muted. */
const OUTCOME_COLOR: Record<PartnerDealRow["status"], string> = {
    open: T.BLUE,
    won: T.GREEN,
    lost: T.TEXT_HINT,
};

const FLAG_REASON: Record<string, string> = {
    stalled: "Stalled",
    wrong_contact: "Wrong contact",
    other: "Something else",
};

const FLAG_STATUS: Record<string, string> = {
    open: "Waiting for a reply",
    acknowledged: "Acknowledged",
    resolved: "Replied",
};

const LABEL: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: T.TEXT_MUTED,
};

function SectionTitle({ children }: { children: ReactNode }) {
    return <div style={{ ...LABEL, marginBottom: 8 }}>{children}</div>;
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div style={{ minWidth: 0 }}>
            <div style={LABEL}>{label}</div>
            <div style={{ marginTop: 3, fontSize: 14, color: T.TEXT, wordBreak: "break-word" }}>{value}</div>
        </div>
    );
}

function when(value: string | null, empty: string): string {
    return value ? formatDate(value) : empty;
}

/** Whole days since the lead was added. Matches the dashboard's "Days open". */
function daysOpen(value: string | null): string {
    if (!value) return "—";
    const then = new Date(value).getTime();
    if (Number.isNaN(then)) return "—";
    const days = Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
    return String(days);
}

function DealList({
    title,
    deals,
    emptyText,
}: {
    title: string;
    deals: PartnerDealRow[];
    emptyText: string;
}) {
    const { td } = useTd();

    return (
        <section style={{ marginTop: 18 }}>
            <SectionTitle>
                {title} ({deals.length})
            </SectionTitle>

            {deals.length === 0 ? (
                <div style={{ fontSize: 13, color: T.TEXT_HINT }}>{emptyText}</div>
            ) : (
                <div style={{ border: `1px solid ${T.BORDER_SOFT}`, borderRadius: 8 }}>
                    {deals.map((deal, index) => (
                        <div
                            key={deal.id}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 12,
                                padding: "10px 12px",
                                borderBottom:
                                    index === deals.length - 1 ? undefined : `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div className="truncate" style={{ fontSize: 14, fontWeight: 600, color: T.NAVY }}>
                                    {deal.name ?? "—"}
                                </div>
                                <div style={{ marginTop: 3, display: "flex", alignItems: "center", gap: 8 }}>
                                    <StatusDot
                                        label={td(
                                            deal.status === "won" ? "Won" : deal.status === "lost" ? "Lost" : "Open",
                                            { source: "en" },
                                        )}
                                        color={OUTCOME_COLOR[deal.status]}
                                    />
                                    {deal.date && (
                                        <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{formatDate(deal.date)}</span>
                                    )}
                                </div>
                            </div>
                            <div
                                style={{
                                    fontSize: 15,
                                    fontWeight: 700,
                                    color: deal.status === "lost" ? T.TEXT_HINT : T.NAVY,
                                    whiteSpace: "nowrap",
                                    textDecoration: deal.status === "lost" ? "line-through" : undefined,
                                }}
                            >
                                {money(deal.value, deal.currency)}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

function FlagList({ flags }: { flags: PartnerFlagDetail[] }) {
    const { td } = useTd();

    return (
        <section style={{ marginTop: 18 }}>
            <SectionTitle>
                {td("Flags", { source: "en" })} ({flags.length})
            </SectionTitle>
            {flags.length === 0 ? (
                <div style={{ fontSize: 13, color: T.TEXT_HINT }}>
                    {td("No flags raised on this lead.", { source: "en" })}
                </div>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {flags.map((flag) => (
                        <div
                            key={flag.id}
                            style={{
                                border: `1px solid ${T.BORDER_SOFT}`,
                                borderRadius: 8,
                                padding: "10px 12px",
                            }}
                        >
                            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                                <div style={{ fontSize: 14, fontWeight: 600, color: T.NAVY }}>
                                    {td(FLAG_REASON[flag.reason] ?? flag.reason, { source: "en" })}
                                </div>
                                <span style={{ fontSize: 12, color: T.TEXT_MUTED, whiteSpace: "nowrap" }}>
                                    {td(FLAG_STATUS[flag.status] ?? flag.status, { source: "en" })}
                                </span>
                            </div>
                            <div style={{ marginTop: 2, fontSize: 12, color: T.TEXT_HINT }}>
                                {formatDate(flag.created_at)}
                            </div>
                            {flag.message && (
                                <div style={{ marginTop: 6, fontSize: 13, color: T.TEXT }}>{flag.message}</div>
                            )}
                            {flag.response && (
                                <div style={{ marginTop: 8, fontSize: 13, color: T.NAVY, lineHeight: 1.45 }}>
                                    <span style={{ fontWeight: 600 }}>{td("Reply", { source: "en" })}: </span>
                                    {flag.response}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function LeadDetailModal({ open, detail, loading, error, onClose }: Props) {
    const { td } = useTd();
    const notYet = td("Not yet", { source: "en" });

    return (
        <Modal
            open={open}
            title={detail?.name ?? td("Lead", { source: "en" })}
            subtitle={
                detail?.status ? <StatusDot label={detail.status.label} color={detail.status.color} /> : undefined
            }
            onClose={onClose}
            maxWidth={640}
            closeOnBackdrop
        >
            {loading && (
                <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>{td("Loading…", { source: "en" })}</div>
            )}

            {error && (
                <div role="alert" style={{ fontSize: 13, color: T.RED }}>
                    {td("Could not load this lead. Please try again.", { source: "en" })}
                </div>
            )}

            {detail && (
                <>
                    <div
                        style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
                            gap: "14px 18px",
                            padding: "12px 14px",
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER_SOFT}`,
                            borderRadius: 8,
                        }}
                    >
                        <Fact label={td("Added", { source: "en" })} value={when(detail.added_at, "—")} />
                        <Fact label={td("Days open", { source: "en" })} value={daysOpen(detail.added_at)} />
                        <Fact label={td("Last update", { source: "en" })} value={when(detail.updated_at, "—")} />
                        <Fact
                            label={td("First contact", { source: "en" })}
                            value={when(detail.first_contacted_at, notYet)}
                        />
                        <Fact
                            label={td("Meeting", { source: "en" })}
                            value={when(detail.first_meeting_at, notYet)}
                        />
                        <Fact label={td("Source", { source: "en" })} value={detail.source ?? "—"} />
                        {detail.lead_source && (
                            <Fact label={td("Lead source", { source: "en" })} value={detail.lead_source} />
                        )}
                        {detail.utm_medium && (
                            <Fact label={td("Medium", { source: "en" })} value={detail.utm_medium} />
                        )}
                        {detail.utm_campaign && (
                            <Fact label={td("Campaign", { source: "en" })} value={detail.utm_campaign} />
                        )}
                    </div>

                    <div
                        style={{
                            marginTop: 14,
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER_SOFT}`,
                            borderRadius: 8,
                            padding: "12px 14px",
                        }}
                    >
                        <SectionTitle>{td("Total value brought", { source: "en" })}</SectionTitle>
                        {detail.totals.length === 0 ? (
                            <div style={{ fontSize: 22, fontWeight: 700, color: T.NAVY }}>—</div>
                        ) : (
                            detail.totals.map((total) => (
                                <div
                                    key={total.code ?? "none"}
                                    style={{ fontSize: 22, fontWeight: 700, color: T.NAVY }}
                                >
                                    {money(total.amount, total)}
                                </div>
                            ))
                        )}
                        <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 4 }}>
                            {td("Across open and won deals.", { source: "en" })}
                        </div>
                    </div>

                    <FlagList flags={detail.flags ?? []} />
                    <DealList
                        title={td("Active deals", { source: "en" })}
                        deals={detail.active_deals}
                        emptyText={td("No active deals.", { source: "en" })}
                    />
                    <DealList
                        title={td("Closed deals", { source: "en" })}
                        deals={detail.closed_deals}
                        emptyText={td("No closed deals.", { source: "en" })}
                    />
                </>
            )}
        </Modal>
    );
}
