import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import PersonRow from "./PersonRow";
import type { ActivityKind } from "../today/AddActivityMenu";
import type { Lead, LifecycleStatus, PeoplePage, RowExtrasMap } from "./types";

interface PeopleTableProps {
    page: PeoplePage;
    statuses: LifecycleStatus[];
    extras: RowExtrasMap | undefined;
    userId: number;
    nowMs: number;
    timeZone: string;
    busy: boolean;
    sortDirection: "asc" | "desc";
    onToggleSort: () => void;
    onPage: (page: number) => void;
    onOpenAction: (lead: Lead, action: NonNullable<Lead["next_action"]>) => void;
    onAddAction: (lead: Lead, kind: ActivityKind) => void;
}

const COLUMNS = ["person", "status", "next_action", "due", "deals", "owner", "last_touch"] as const;
const COLUMN_CLASS: Record<(typeof COLUMNS)[number], string> = {
    person: "agent-pp__c--person",
    status: "agent-pp__c--status",
    next_action: "agent-pp__c--action",
    due: "agent-pp__c--due",
    deals: "agent-pp__c--deals",
    owner: "agent-pp__c--owner",
    last_touch: "agent-pp__c--touch",
};

/** The list as one card: header row, a row per person, then the pager when there is more than a page. */
export default function PeopleTable({ page, statuses, extras, userId, nowMs, timeZone, busy, sortDirection, onToggleSort, onPage, onOpenAction, onAddAction }: PeopleTableProps) {
    const { t } = useTranslation();
    const statusById = new Map(statuses.map((status) => [status.id, status]));

    return (
        <div className="agent-pp__table" role="table" aria-busy={busy} aria-label={t("pages.agent_workspace.people.title")}>
            <div role="row" className="agent-pp__head">
                {COLUMNS.map((column) => {
                    const label = t(`pages.agent_workspace.people.columns.${column}`);
                    if (column === "due") {
                        return (
                            <button
                                key={column}
                                type="button"
                                role="columnheader"
                                className="agent-pp__th"
                                aria-sort={sortDirection === "asc" ? "ascending" : "descending"}
                                title={t(sortDirection === "asc" ? "pages.agent_workspace.people.sort_due_asc" : "pages.agent_workspace.people.sort_due_desc")}
                                onClick={onToggleSort}
                            >
                                {label} {sortDirection === "asc" ? "↑" : "↓"}
                            </button>
                        );
                    }
                    return (
                        <span key={column} role="columnheader" className={`agent-pp__th ${COLUMN_CLASS[column]}`}>
                            {label}
                        </span>
                    );
                })}
                <span aria-hidden="true" />
            </div>

            {page.data.length === 0 ? (
                <EmptyState
                    icon="users"
                    title={t("pages.agent_workspace.people.empty_title")}
                    description={t("pages.agent_workspace.people.empty_description")}
                />
            ) : (
                <div role="rowgroup">
                    {page.data.map((lead) => (
                        <PersonRow
                            key={lead.id}
                            lead={lead}
                            status={statusById.get(Number(lead.lead_lifecycle_status_id ?? lead.lifecycle_status_id))}
                            extras={extras?.[lead.id]}
                            userId={userId}
                            nowMs={nowMs}
                            timeZone={timeZone}
                            onOpenAction={onOpenAction}
                            onAddAction={onAddAction}
                        />
                    ))}
                </div>
            )}

            {page.last_page > 1 ? (
                <nav className="agent-pp__pager" aria-label={t("pages.agent_workspace.people.pager.label")}>
                    <span>
                        {t("pages.agent_workspace.people.pager.range", { from: page.from ?? 0, to: page.to ?? 0, total: page.total })}
                    </span>
                    <span className="agent-pp__pager-buttons">
                        <Button size="sm" variant="ghost" disabled={page.current_page <= 1 || busy} onClick={() => onPage(page.current_page - 1)}>
                            {t("pages.agent_workspace.people.pager.previous")}
                        </Button>
                        <Button size="sm" variant="ghost" disabled={page.current_page >= page.last_page || busy} onClick={() => onPage(page.current_page + 1)}>
                            {t("pages.agent_workspace.people.pager.next")}
                        </Button>
                    </span>
                </nav>
            ) : null}
        </div>
    );
}

/** Rows' worth of grey bars while the page's first props are still arriving (only on a hard load). */
export function PeopleTableSkeleton() {
    return (
        <div className="agent-pp__table" aria-hidden="true">
            {Array.from({ length: 8 }, (_, index) => (
                <div key={index} className="agent-pp__skeleton-row">
                    {Array.from({ length: 7 }, (_, cell) => (
                        <span key={cell} className="agent-pp__skeleton-bar" style={{ width: cell === 0 ? "70%" : "55%" }} />
                    ))}
                </div>
            ))}
        </div>
    );
}
