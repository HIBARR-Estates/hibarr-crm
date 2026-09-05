import dayjs from "dayjs";
import { Avatar, REDESIGN_TOKENS as T, initialsFromName } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { amount } from "../format";
import type { TeamRecentCommission } from "../types";

/** Row colour, keyed by the mlm_commissions status enum — matches PartnerView's ledger. */
const STATUS_TONE: Record<string, string> = {
    paid: T.GREEN,
    pending: T.AMBER,
    reverted: T.TEXT_HINT,
};

const STATUS_LABEL: Record<string, string> = {
    paid: "Paid",
    pending: "Pending",
    reverted: "Reverted",
};

const TYPE_LABEL: Record<string, string> = {
    agent: "Agent",
    upline: "Upline",
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
    const { td } = useTd();

    if (!rows.length) {
        return (
            <div style={{ padding: 18 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>
                    {td("No commission activity yet")}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: T.TEXT_MUTED }}>
                    {td("Entries appear here as soon as a deal anywhere in the network closes.")}
                </p>
            </div>
        );
    }

    return (
        <div>
            {rows.map((row, index) => (
                <div
                    key={row.id}
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
                            {td(TYPE_LABEL[row.type] ?? row.type)}
                            {row.deal_name ? ` · ${row.deal_name}` : ""}
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
                            {td(STATUS_LABEL[row.status] ?? row.status)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
}
