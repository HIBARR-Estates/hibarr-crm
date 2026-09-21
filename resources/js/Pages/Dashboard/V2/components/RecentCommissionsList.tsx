import dayjs from "dayjs";
import { Link, router } from "@inertiajs/react";
import { Avatar, REDESIGN_TOKENS as T, initialsFromName } from "@/Components/Redesign";
import useTranslation from "@/Hooks/useTranslation";
import { amount } from "../format";
import type { TeamRecentCommission } from "../types";

/** Row colour, keyed by the mlm_commissions status enum — matches PartnerView's ledger. */
const STATUS_TONE: Record<string, string> = {
    paid: T.GREEN,
    pending: T.AMBER,
    reverted: T.TEXT_HINT,
};

const STATUS_KEY: Record<string, string> = {
    paid: "pages.dashboard.team.commissions.status_paid",
    pending: "pages.dashboard.team.commissions.status_pending",
    reverted: "pages.dashboard.team.commissions.status_reverted",
};

const TYPE_KEY: Record<string, string> = {
    agent: "pages.dashboard.team.commissions.type_agent",
    upline: "pages.dashboard.team.commissions.type_upline",
};

/**
 * The network's latest commission activity, newest first.
 *
 * Not windowed by the date picker — "recent" means recent, matching how the
 * agent-facing MLM dashboard reads its own latest legs regardless of whatever
 * date filter sits elsewhere on the page. Reverted rows are shown rather than
 * filtered out: a clawback is exactly the activity a lead needs to see, not
 * hide because it nets to zero.
 */
export default function RecentCommissionsList({
    rows,
    currency,
}: {
    rows: TeamRecentCommission[];
    currency: string | null;
}) {
    const { t } = useTranslation();

    if (!rows.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {t("pages.dashboard.team.commissions.empty_title")}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                    {t("pages.dashboard.team.commissions.empty_body")}
                </p>
            </div>
        );
    }

    return (
        <div>
            {rows.map((row, index) => {
                const dealHref = row.deal_id
                    ? route("deals.show", row.deal_id)
                    : null;

                return (
                    <div
                        key={row.id}
                        className="dv2-commission-row"
                        data-clickable={dealHref ? true : undefined}
                        role={dealHref ? "link" : undefined}
                        tabIndex={dealHref ? 0 : undefined}
                        onClick={() => {
                            if (dealHref) {
                                router.visit(dealHref);
                            }
                        }}
                        onKeyDown={(event) => {
                            if (
                                dealHref &&
                                (event.key === "Enter" || event.key === " ")
                            ) {
                                event.preventDefault();
                                router.visit(dealHref);
                            }
                        }}
                        style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 12,
                            padding: "10px 18px",
                            borderBottom:
                                index === rows.length - 1
                                    ? undefined
                                    : `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <Avatar
                            size={28}
                            initials={initialsFromName(row.agent_name)}
                            type="agent"
                            src={row.agent_image}
                        />

                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 600,
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                }}
                            >
                                {row.agent_name}
                            </div>
                            <div style={{ fontSize: 12, color: T.TEXT_HINT }}>
                                {TYPE_KEY[row.type]
                                    ? t(TYPE_KEY[row.type])
                                    : row.type}
                                {row.deal_name ? (
                                    <>
                                        {" · "}
                                        {dealHref ? (
                                            <Link
                                                href={dealHref}
                                                className="dv2-commission-deal"
                                                onClick={(event) =>
                                                    event.stopPropagation()
                                                }
                                                style={{
                                                    color: T.BLUE,
                                                    textDecoration: "none",
                                                }}
                                            >
                                                {row.deal_name}
                                            </Link>
                                        ) : (
                                            row.deal_name
                                        )}
                                    </>
                                ) : null}
                                {" · "}
                                {dayjs(row.at).format("D MMM")}
                            </div>
                        </div>

                        <div style={{ textAlign: "right" }}>
                            <div
                                style={{
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: STATUS_TONE[row.status] ?? T.TEXT,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {amount(row.amount, currency)}
                            </div>
                            <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                                {STATUS_KEY[row.status]
                                    ? t(STATUS_KEY[row.status])
                                    : row.status}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
