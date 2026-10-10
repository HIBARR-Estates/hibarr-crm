import { useTd } from "@/Hooks/useDynamicTranslation";
import Badge from "@/Components/Redesign/primitives/Badge";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { formatDate } from "@/Components/Redesign/adapters/dateFormat";
import type { PartnerLeadRow as LeadRow } from "../types";
import StatusPill from "./StatusPill";

/**
 * Column widths, shared with the list's header row so the two line up. The
 * responsive classes that go with them are here too — a column that drops out
 * at a breakpoint has to drop out of the header at the same one.
 */
export const PARTNER_LEAD_COLUMNS = {
    status: { width: 168, className: "hidden sm:block" },
    deals: { width: 280, className: "" },
    /** The open-detail chevron. */
    open: { width: 20, className: "" },
} as const;

interface Props {
    lead: LeadRow;
    onOpen: () => void;
}

/**
 * One referred lead as a table row: who, where it stands, and how its deals
 * have turned out. No contact fields exist on the row — see PartnerLeadService.
 */
export default function PartnerLeadRow({ lead, onOpen }: Props) {
    const { td } = useTd();
    const total = lead.deals.open + lead.deals.won + lead.deals.lost;

    return (
        <div
            className="dr-partner-lead-row flex cursor-pointer items-center gap-4 px-4 py-2"
            role="button"
            tabIndex={0}
            onClick={onOpen}
            onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onOpen();
                }
            }}
            style={{ minHeight: 64, borderBottom: `1px solid ${T.BORDER_SOFT}` }}
        >
            <div className="min-w-0 flex-1">
                <div
                    className="truncate font-semibold"
                    style={{ fontSize: 14, color: T.TEXT }}
                >
                    {lead.name ?? "—"}
                </div>
                <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                    {td("Referred")} {formatDate(lead.created_at)}
                </div>
            </div>

            <div
                className={`shrink-0 ${PARTNER_LEAD_COLUMNS.status.className}`}
                style={{ width: PARTNER_LEAD_COLUMNS.status.width }}
            >
                {lead.status ? (
                    <StatusPill label={lead.status.label} color={lead.status.color} />
                ) : (
                    <span style={{ fontSize: 12, color: T.TEXT_HINT }}>—</span>
                )}
            </div>

            <div
                className={`shrink-0 ${PARTNER_LEAD_COLUMNS.deals.className}`}
                style={{ width: PARTNER_LEAD_COLUMNS.deals.width }}
            >
                {total === 0 ? (
                    <span style={{ fontSize: 12, color: T.TEXT_HINT }}>{td("No deals")}</span>
                ) : (
                    // Inside the column wrapper: its responsive class sets
                    // `display`, which would override a `flex` placed on it.
                    <div className="flex flex-wrap items-center" style={{ gap: 6 }}>
                        {lead.deals.open > 0 && (
                            <Badge variant="blue">
                                {lead.deals.open} {td("open")}
                            </Badge>
                        )}
                        {lead.deals.won > 0 && (
                            <Badge variant="green">
                                {lead.deals.won} {td("won")}
                            </Badge>
                        )}
                        {lead.deals.lost > 0 && (
                            <Badge variant="gray">
                                {lead.deals.lost} {td("lost")}
                            </Badge>
                        )}
                    </div>
                )}
            </div>

            <span
                className="shrink-0"
                style={{ width: PARTNER_LEAD_COLUMNS.open.width, color: T.TEXT_HINT }}
                aria-hidden
            >
                <Icon name="chevron-right" size={14} />
            </span>
        </div>
    );
}
