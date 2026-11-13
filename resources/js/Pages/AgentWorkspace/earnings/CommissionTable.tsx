import { memo } from "react";
import { Link } from "@inertiajs/react";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../people/format";
import { formatMoney } from "../deals/format";
import { dealSubline, monthLabel, packageLine } from "./format";
import type { CommissionLine } from "./types";

interface CommissionTableProps {
    lines: CommissionLine[];
    currencySymbol: string;
    /** The line being disputed, highlighted. */
    activeId: number | null;
    onDispute: (line: CommissionLine) => void;
    onViewDispute: (line: CommissionLine) => void;
}

/** The status a line reads as: an open dispute outranks pending or paid. */
export function lineStatus(line: CommissionLine): "pending" | "paid" | "reverted" | "disputed" {
    return line.disputed ? "disputed" : line.status;
}

function dealHref(line: CommissionLine): string | null {
    if (!line.deal_id) return null;
    return line.lead_id ? route("agent.people.deal", { lead: line.lead_id, deal: line.deal_id }) : route("agent.deals.show", line.deal_id);
}

interface RowProps {
    line: CommissionLine;
    currencySymbol: string;
    active: boolean;
    year: number;
    onDispute: (line: CommissionLine) => void;
    onViewDispute: (line: CommissionLine) => void;
}

const Row = memo(function Row({ line, currencySymbol, active, year, onDispute, onViewDispute }: RowProps) {
    const { t, locale } = useTranslation();
    const status = lineStatus(line);
    const title = line.person?.trim() || line.deal_name?.trim() || t("pages.agent_workspace.earnings.table.unnamed");
    const sub = line.person ? dealSubline(line.person, line.deal_name) : "";
    const href = dealHref(line);

    return (
        <div role="row" className={`agent-ea__row${active ? " is-active" : ""}`}>
            <div role="cell" className="agent-ea__person">
                <span className="agent-ea__avatar" style={{ ["--fill" as string]: avatarFill(line.deal_id ?? line.id) }} aria-hidden="true">
                    {initialsFromName(title)}
                </span>
                <span className="agent-ea__who">
                    {href ? (
                        <Link href={href} prefetch={["hover", "click"]} cacheFor="30s" className="agent-ea__name">
                            {title}
                        </Link>
                    ) : (
                        <span className="agent-ea__name">{title}</span>
                    )}
                    {sub ? <span className="agent-ea__sub">{sub}</span> : null}
                </span>
            </div>
            <div className="agent-ea__line">
                <span role="cell" className="agent-ea__package">
                    {packageLine(line, t)}
                </span>
                <span role="cell" className="agent-ea__amount">
                    {formatMoney(line.amount, currencySymbol, locale)}
                </span>
                <span role="cell" className="agent-ea__c-status">
                    <span className={`agent-ea__status agent-ea__status--${status}`}>{t(`pages.agent_workspace.earnings.status.${status}`)}</span>
                </span>
                <span role="cell" className="agent-ea__month">
                    {monthLabel(line.created_at, locale, year)}
                </span>
                <span role="cell" className="agent-ea__act">
                    {line.dispute ? (
                        <button type="button" className="agent-ea__btn" onClick={() => onViewDispute(line)}>
                            {t("pages.agent_workspace.earnings.actions.view_dispute")}
                        </button>
                    ) : null}
                    {line.can_dispute ? (
                        <button type="button" className="agent-ea__btn" onClick={() => onDispute(line)}>
                            {t("pages.agent_workspace.earnings.actions.dispute")}
                        </button>
                    ) : null}
                </span>
            </div>
        </div>
    );
});

/**
 * The commission table the Overview and the Ledger share (L7-21, L7-22): who
 * and which deal, the package and how it was earned, the agent's share, its
 * status and month, and a Dispute or View dispute button where one applies.
 */
export default function CommissionTable({ lines, currencySymbol, activeId, onDispute, onViewDispute }: CommissionTableProps) {
    const { t } = useTranslation();
    const year = new Date().getFullYear();

    return (
        <div role="table" aria-label={t("pages.agent_workspace.earnings.table.label")} className="agent-ea__table">
            <div role="row" className="agent-ea__head">
                <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.table.deal")}</span>
                <span className="agent-ea__line">
                    <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.table.package")}</span>
                    <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.table.share")}</span>
                    <span role="columnheader" className="agent-ea__th">{t("pages.agent_workspace.earnings.table.status")}</span>
                    <span role="columnheader" className="agent-ea__th" aria-sort="descending">{t("pages.agent_workspace.earnings.table.month")} ↑</span>
                    <span role="columnheader" className="agent-ea__th" />
                </span>
            </div>
            {lines.map((line) => (
                <Row
                    key={line.id}
                    line={line}
                    currencySymbol={currencySymbol}
                    active={line.id === activeId}
                    year={year}
                    onDispute={onDispute}
                    onViewDispute={onViewDispute}
                />
            ))}
        </div>
    );
}
