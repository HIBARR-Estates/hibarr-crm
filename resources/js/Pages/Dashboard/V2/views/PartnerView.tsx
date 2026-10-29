import { useMemo, useState } from "react";
import { Deferred } from "@inertiajs/react";
import { Button, EmptyState, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import MultiStatTile from "../components/MultiStatTile";
import StageFunnel from "../components/StageFunnel";
import PartnerTrendChart from "../components/PartnerTrendChart";
import { currencyAmount } from "../format";
import ReferralTable from "../components/ReferralTable";
import ReferralFlagsCard from "../components/ReferralFlagsCard";
import FlagReferralModal from "../components/FlagReferralModal";
import type {
    PartnerFlagThreadItem,
    PartnerForecast,
    PartnerReferral,
    PartnerStats,
    PartnerTrendPoint,
} from "../types";

export interface PartnerViewProps {
    partnerStats?: PartnerStats | null;
    partnerFunnel?: Array<{ label: string; count: number }> | null;
    partnerTrend?: PartnerTrendPoint[] | null;
    partnerReferrals?: PartnerReferral[] | null;
    partnerFlags?: PartnerFlagThreadItem[] | null;
    partnerForecast?: PartnerForecast | null;
}

/** Ledger row colours, keyed by the mlm_commissions status enum. */
const COMMISSION_TONE: Record<string, string> = {
    paid: T.GREEN,
    pending: T.AMBER,
    reverted: T.TEXT_HINT,
};

/**
 * Ledger order: what has been paid, what is owed, then what was clawed back.
 * Fixed rather than whatever order the GROUP BY returned, so the rows don't
 * swap places between visits.
 */
const COMMISSION_ORDER = ["paid", "pending", "reverted"];

/**
 * The whole referral book, and nothing else.
 *
 * External partners sit outside the trust boundary: no deal values, no client
 * contact details, no handling agent, nothing about other partners. That
 * scoping is enforced in DashboardMetricsService — the fields never reach this
 * component. A partner's per-lead deal values live on the My leads view
 * (Partner/Leads), which has its own scoping.
 */
export default function PartnerView({
    partnerStats,
    partnerFunnel,
    partnerTrend,
    partnerReferrals,
    partnerFlags,
    partnerForecast,
}: PartnerViewProps) {
    const { td } = useTd();
    const [raising, setRaising] = useState(false);
    const flaggable = useMemo(() => {
        const openLeadIds = new Set(
            (partnerFlags ?? [])
                .filter(
                    (flag) =>
                        flag.status === "open" ||
                        flag.status === "acknowledged",
                )
                .map((flag) => flag.lead_id),
        );

        return (partnerReferrals ?? []).filter((row) => !openLeadIds.has(row.id));
    }, [partnerFlags, partnerReferrals]);

    const commissions = Object.entries(
        partnerStats?.commissionsByStatus ?? {},
    ).sort(([a], [b]) => ledgerRank(a) - ledgerRank(b));

    // Known only once the stats land. While they load, the panels below show
    // their own skeletons rather than guessing which state to draw.
    const noReferrals = partnerStats?.referredLeads === 0;

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="partnerStats"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 4 }).map((_, index) => (
                            <CardSkeleton key={index} height={96} />
                        ))}
                    </div>
                }
            >
                {partnerStats ? (
                    <div style={tileGrid}>
                        <MultiStatTile
                            label="Referrals"
                            variant="team"
                            segments={[
                                {
                                    label: "Referred",
                                    value: partnerStats.referredLeads,
                                },
                                {
                                    label: "In progress",
                                    value: partnerStats.inProgressLeads,
                                    tone: "blue",
                                },
                                {
                                    label: "Completed",
                                    value: partnerStats.convertedLeads,
                                    tone: "green",
                                },
                            ]}
                            hint="In progress means the referral has an open deal"
                        />
                        <StatTile
                            label="Conversion"
                            unit="%"
                            value={partnerStats.conversionRate}
                            note={
                                partnerStats.conversionRate === null
                                    ? "No referrals yet"
                                    : null
                            }
                        />
                        <StatTile
                            label="Median time to close"
                            value={
                                partnerStats.medianDaysToClose === null
                                    ? null
                                    : `${partnerStats.medianDaysToClose}d`
                            }
                            note="Referral to won"
                        />
                        <StatTile
                            label="Forecast"
                            value={
                                partnerForecast?.amount
                                    ? currencyAmount(
                                          partnerForecast.amount,
                                          partnerForecast.currency ?? null,
                                      )
                                    : null
                            }
                            note={forecastNote(partnerForecast)}
                        />
                    </div>
                ) : (
                    <NoPartnerRecord />
                )}
            </Deferred>

            <div className="dv2-partner-insights">
                {noReferrals ? (
                    <DashboardPanel
                        title="Your referrals"
                        className="dv2-partner-span-2"
                        style={{ height: "100%" }}
                    >
                        <EmptyState
                            icon="users"
                            title={td("No referrals yet", { source: "en" })}
                            description={td(
                                "Clients you introduce appear here once the team logs them — how they progress, and what they pay out.",
                                { source: "en" },
                            )}
                        />
                    </DashboardPanel>
                ) : (
                    <>
                        <DashboardPanel
                            title="Referrals over time"
                            note="Submitted against completed, last 12 months"
                            extra={<Legend />}
                            style={{ height: "100%" }}
                        >
                            <Deferred
                                data="partnerTrend"
                                fallback={<PanelSkeleton rows={5} />}
                            >
                                <PartnerTrendChart data={partnerTrend ?? []} />
                            </Deferred>
                        </DashboardPanel>

                        <DashboardPanel
                            title="Where your referrals stand"
                            note="Stage only — no client detail"
                            style={{ height: "100%" }}
                        >
                            <Deferred
                                data="partnerFunnel"
                                fallback={<PanelSkeleton rows={5} />}
                            >
                                <StageFunnel
                                    labelWidth={96}
                                    emptyMessage="No referrals to place yet."
                                    // A row of zero bars reads as a broken
                                    // chart, not as "nothing referred".
                                    data={(partnerFunnel?.[0]?.count
                                        ? partnerFunnel
                                        : []
                                    ).map((step, index) => ({
                                        key: step.label,
                                        label: step.label,
                                        count: step.count,
                                        tone:
                                            index === 0
                                                ? "navy"
                                                : index ===
                                                    (partnerFunnel?.length ?? 0) - 1
                                                  ? "green"
                                                  : "blue",
                                    }))}
                                />
                            </Deferred>
                        </DashboardPanel>
                    </>
                )}

                <DashboardPanel
                    title="Commission ledger"
                    note="Company currency"
                    style={{ height: "100%" }}
                    footer={
                        <span style={{ color: T.TEXT_MUTED, fontSize: 13 }}>
                            {td(
                                "Totals come from recorded commissions only — nothing here is a projection.", { source: "en" })}
                        </span>
                    }
                >
                    <Deferred
                        data="partnerStats"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        {commissions.length ? (
                            <div>
                                {commissions.map(([status, total], index) => {
                                    // Clawed back: shown so the partner can see
                                    // it happened, never styled as money owed.
                                    const reverted = status === "reverted";

                                    return (
                                    <div
                                        key={status}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "12px 0",
                                            borderBottom:
                                                index === commissions.length - 1
                                                    ? undefined
                                                    : `1px solid ${T.BORDER_SOFT}`,
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 10,
                                            }}
                                        >
                                            <span
                                                aria-hidden
                                                style={{
                                                    width: 8,
                                                    height: 8,
                                                    borderRadius: "50%",
                                                    background:
                                                        COMMISSION_TONE[
                                                            status
                                                        ] ?? T.BLUE,
                                                }}
                                            />
                                            <span
                                                style={{
                                                    fontSize: 14,
                                                    fontWeight: 600,
                                                    textTransform: "capitalize",
                                                    color: reverted
                                                        ? T.TEXT_MUTED
                                                        : T.TEXT,
                                                }}
                                            >
                                                {td(status, { source: "en" })}
                                            </span>
                                            {reverted && (
                                                <span
                                                    style={{
                                                        fontSize: 12,
                                                        color: T.TEXT_HINT,
                                                    }}
                                                >
                                                    {td("not payable", { source: "en" })}
                                                </span>
                                            )}
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 16,
                                                fontWeight: reverted ? 500 : 700,
                                                color: reverted
                                                    ? T.TEXT_HINT
                                                    : T.NAVY,
                                                textDecoration: reverted
                                                    ? "line-through"
                                                    : undefined,
                                            }}
                                        >
                                            {currencyAmount(
                                                total,
                                                partnerStats?.currency ?? null,
                                            )}
                                        </span>
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 14,
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                {td("No commissions recorded yet.", { source: "en" })}
                            </p>
                        )}
                    </Deferred>
                </DashboardPanel>
            </div>

            {/* Nothing referred means nothing to list and nothing a flag can
                be raised on — the empty state above already says so. */}
            {!noReferrals && (
            <Deferred
                data={["partnerReferrals", "partnerFlags"]}
                fallback={
                    <div className="dv2-partner-book">
                        <div style={{ padding: 18 }}>
                            <PanelSkeleton rows={5} />
                        </div>
                        <PanelSkeleton rows={4} />
                    </div>
                }
            >
                <div className="dv2-partner-book">
                    <DashboardPanel flush fill style={{ height: "100%" }}>
                        <ReferralTable rows={partnerReferrals ?? []} />
                    </DashboardPanel>
                    <DashboardPanel
                        flush
                        fill
                        title="Flags"
                        note="Replies from the partner team"
                        style={{ height: "100%" }}
                        extra={
                            <Button
                                variant="primary"
                                size="sm"
                                disabled={flaggable.length === 0}
                                onClick={() => setRaising(true)}
                            >
                                {td("Raise flag", { source: "en" })}
                            </Button>
                        }
                    >
                        <ReferralFlagsCard flags={partnerFlags ?? []} />
                        <FlagReferralModal
                            open={raising}
                            referrals={flaggable}
                            onClose={() => setRaising(false)}
                        />
                    </DashboardPanel>
                </div>
            </Deferred>
            )}
        </div>
    );
}

// 200px floor so the three-figure Referrals tile keeps its labels whole; min()
// lets a phone drop to one column instead of overflowing.
const tileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 200px), 1fr))",
    gap: 12,
} as const;

const ledgerRank = (status: string) => {
    const rank = COMMISSION_ORDER.indexOf(status);

    return rank === -1 ? COMMISSION_ORDER.length : rank;
};

/**
 * Says why the forecast is blank, because there are three different reasons
 * and "—" on its own reads as a fault.
 *
 * Both figures are in the company currency. currencyAmount prefixes them.
 */
function forecastNote(forecast?: PartnerForecast | null): string | null {
    if (!forecast || forecast.deal_count === 0) {
        return "No referrals with an open deal";
    }

    if (forecast.suppressed) {
        return `${forecast.deal_count} open — shown from 3`;
    }

    if (!forecast.amount) {
        // The engine pays the deal's own agent and their upline; a referring
        // partner is neither until referral attribution reaches it.
        return "Awaiting commission setup";
    }

    return `If all ${forecast.deal_count} open referred deals close`;
}

function Legend() {
    const { td } = useTd();

    return (
        <div
            style={{
                display: "flex",
                gap: 16,
                fontSize: 13,
                color: T.TEXT_MUTED,
            }}
        >
            {[
                [T.BLUE, "Submitted"],
                [T.GREEN, "Completed"],
            ].map(([color, label]) => (
                <span
                    key={label}
                    style={{ display: "flex", alignItems: "center", gap: 7 }}
                >
                    <span
                        aria-hidden
                        style={{
                            width: 11,
                            height: 3,
                            background: color,
                            borderRadius: 2,
                        }}
                    />
                    {td(label, { source: "en" })}
                </span>
            ))}
        </div>
    );
}

function NoPartnerRecord() {
    const { td } = useTd();

    return (
        <EmptyState
            icon="user"
            title={td("No partner record linked to this account", { source: "en" })}
            description={td(
                "Referred leads are attributed through the agent record on your profile.",
                { source: "en" },
            )}
        />
    );
}
