import { Modal, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { money } from "../format";
import type { PartnerDealRow, PartnerLeadDetail } from "../types";
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
            <div
                style={{
                    fontSize: 12,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: 0.4,
                    color: T.TEXT_MUTED,
                    marginBottom: 8,
                }}
            >
                {title} ({deals.length})
            </div>

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
                                    index === deals.length - 1
                                        ? undefined
                                        : `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            <div style={{ minWidth: 0 }}>
                                <div
                                    className="truncate"
                                    style={{ fontSize: 14, fontWeight: 600, color: T.NAVY }}
                                >
                                    {deal.name ?? "—"}
                                </div>
                                <div style={{ marginTop: 3 }}>
                                    <StatusDot
                                        label={td(
                                            deal.status === "won" ? "Won" : deal.status === "lost" ? "Lost" : "Open",
                                            { source: "en" },
                                        )}
                                        color={OUTCOME_COLOR[deal.status]}
                                    />
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

export default function LeadDetailModal({ open, detail, loading, error, onClose }: Props) {
    const { td } = useTd();

    return (
        <Modal
            open={open}
            title={detail?.name ?? td("Lead", { source: "en" })}
            subtitle={
                detail?.status ? (
                    <StatusDot label={detail.status.label} color={detail.status.color} />
                ) : undefined
            }
            onClose={onClose}
        >
            {loading && (
                <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                    {td("Loading…", { source: "en" })}
                </div>
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
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER_SOFT}`,
                            borderRadius: 8,
                            padding: "12px 14px",
                        }}
                    >
                        <div
                            style={{
                                fontSize: 12,
                                fontWeight: 600,
                                textTransform: "uppercase",
                                letterSpacing: 0.4,
                                color: T.TEXT_MUTED,
                            }}
                        >
                            {td("Total value brought", { source: "en" })}
                        </div>
                        {detail.totals.length === 0 ? (
                            <div style={{ fontSize: 22, fontWeight: 700, color: T.NAVY, marginTop: 4 }}>
                                —
                            </div>
                        ) : (
                            detail.totals.map((total) => (
                                <div
                                    key={total.code ?? "none"}
                                    style={{ fontSize: 22, fontWeight: 700, color: T.NAVY, marginTop: 4 }}
                                >
                                    {money(total.amount, total)}
                                </div>
                            ))
                        )}
                        <div style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 4 }}>
                            {td("Across open and won deals.", { source: "en" })}
                        </div>
                    </div>

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
