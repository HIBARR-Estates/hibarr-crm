import { useState } from "react";
import { Deferred } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DashboardPanel, {
    CardSkeleton,
    PanelSkeleton,
} from "../components/DashboardPanel";
import StatTile from "../components/StatTile";
import StageFunnel from "../components/StageFunnel";
import PartnerTrendChart from "../components/PartnerTrendChart";
import ReferralTable from "../components/ReferralTable";
import FlagReferralModal from "../components/FlagReferralModal";
import type {
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
    partnerForecast?: PartnerForecast | null;
}

/** Ledger row colours, keyed by the mlm_commissions status enum. */
const COMMISSION_TONE: Record<string, string> = {
    paid: T.GREEN,
    pending: T.AMBER,
    reverted: T.TEXT_HINT,
};

/**
 * The whole referral book, and nothing else.
 *
 * External partners sit outside the trust boundary: no deal values, no client
 * contact details, nothing about other partners. That scoping is enforced in
 * DashboardMetricsService — the fields never reach this component — so there is
 * no forecast tile here either, since forecasting would need the deal values.
 */
export default function PartnerView({
    partnerStats,
    partnerFunnel,
    partnerTrend,
    partnerReferrals,
    partnerForecast,
}: PartnerViewProps) {
    const { td } = useTd();
    const [flagging, setFlagging] = useState<PartnerReferral | null>(null);

    const commissions = Object.entries(partnerStats?.commissionsByStatus ?? {});

    return (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <Deferred
                data="partnerStats"
                fallback={
                    <div style={tileGrid}>
                        {Array.from({ length: 5 }).map((_, index) => (
                            <CardSkeleton key={index} height={96} />
                        ))}
                    </div>
                }
            >
                {partnerStats ? (
                    <div style={tileGrid}>
                        <StatTile
                            label="Referred"
                            value={partnerStats.referredLeads}
                        />
                        <StatTile
                            label="In progress"
                            value={partnerStats.inProgressLeads}
                            note="With an open deal"
                        />
                        <StatTile
                            label="Completed"
                            tone="green"
                            value={partnerStats.convertedLeads}
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
                                    ? Math.round(
                                          partnerForecast.amount,
                                      ).toLocaleString()
                                    : null
                            }
                            note={forecastNote(partnerForecast)}
                        />
                    </div>
                ) : (
                    <NoPartnerRecord />
                )}
            </Deferred>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
                    gap: 14,
                    alignItems: "start",
                }}
            >
                <DashboardPanel
                    title="Referrals over time"
                    note="Submitted against completed, last 12 months"
                    extra={<Legend />}
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
                >
                    <Deferred
                        data="partnerFunnel"
                        fallback={<PanelSkeleton rows={5} />}
                    >
                        <StageFunnel
                            labelWidth={96}
                            emptyMessage="No referrals to place yet."
                            data={(partnerFunnel ?? []).map((step, index) => ({
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
            </div>

            <div
                style={{
                    display: "grid",
                    gridTemplateColumns:
                        "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
                    gap: 14,
                    alignItems: "start",
                }}
            >
                <DashboardPanel flush>
                    <Deferred
                        data="partnerReferrals"
                        fallback={
                            <div style={{ padding: 18 }}>
                                <PanelSkeleton rows={5} />
                            </div>
                        }
                    >
                        <ReferralTable
                            rows={partnerReferrals ?? []}
                            onFlag={setFlagging}
                        />
                    </Deferred>
                </DashboardPanel>

                <DashboardPanel
                    title="Commission ledger"
                    note="In the currency each commission was recorded in"
                    footer={
                        <span style={{ color: T.TEXT_MUTED, fontSize: 13 }}>
                            {td(
                                "Totals come from recorded commissions only — nothing here is a projection.",
                            )}
                        </span>
                    }
                >
                    <Deferred
                        data="partnerStats"
                        fallback={<PanelSkeleton rows={3} />}
                    >
                        {commissions.length ? (
                            <div>
                                {commissions.map(([status, amount], index) => (
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
                                                }}
                                            >
                                                {td(status)}
                                            </span>
                                        </div>
                                        <span
                                            style={{
                                                fontSize: 16,
                                                fontWeight: 700,
                                                color: T.NAVY,
                                            }}
                                        >
                                            {amount.toLocaleString(undefined, {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2,
                                            })}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p
                                style={{
                                    margin: 0,
                                    fontSize: 14,
                                    color: T.TEXT_MUTED,
                                }}
                            >
                                {td("No commissions recorded yet.")}
                            </p>
                        )}
                    </Deferred>
                </DashboardPanel>
            </div>

            <FlagReferralModal
                referral={flagging}
                onClose={() => setFlagging(null)}
            />
        </div>
    );
}

const tileGrid = {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
    gap: 12,
} as const;

/**
 * Says why the forecast is blank, because there are three different reasons
 * and "—" on its own reads as a fault.
 *
 * No currency symbol: commissions are summed across currencies without being
 * split, the same limitation the ledger carries.
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

    return `Across ${forecast.deal_count} open deals, unconverted`;
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
                    {td(label)}
                </span>
            ))}
        </div>
    );
}

function NoPartnerRecord() {
    const { td } = useTd();

    return (
        <DashboardPanel title="No partner record linked to this account">
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td(
                    "Referred leads are attributed through the agent record on your profile.",
                )}
            </p>
        </DashboardPanel>
    );
}
