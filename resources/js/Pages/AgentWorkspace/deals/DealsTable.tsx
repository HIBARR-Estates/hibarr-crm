import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import DealRow from "./DealRow";
import type { DealStage, DealView } from "./types";

interface DealsTableProps {
    stages: DealStage[];
    /** Undefined while the deals are on their way. */
    views: DealView[] | undefined;
    userId: number;
    currencySymbol: string;
    nowMs: number;
    timeZone: string;
}

const COLUMNS = ["person", "stage", "conditions", "meeting", "value", "agent", "activity"] as const;

/**
 * The list (L7-16): the same deals as the board, the furthest stage first
 * (so "Stage ↑" reads from the front of the pipeline to the back), those with
 * a meeting soonest first inside a stage.
 */
export default function DealsTable({ stages, views, userId, currencySymbol, nowMs, timeZone }: DealsTableProps) {
    const { t } = useTranslation();
    const stageById = new Map(stages.map((stage, index) => [stage.id, { stage, index }]));
    const rows = views
        ? [...views].sort((a, b) => (stageById.get(b.deal.stage_id)?.index ?? 0) - (stageById.get(a.deal.stage_id)?.index ?? 0))
        : undefined;

    return (
        <div className="agent-table agent-dp__table" role="table" aria-label={t("pages.agent_workspace.deals.list_label")} aria-busy={views === undefined}>
            <div role="row" className="agent-dp__head">
                {COLUMNS.map((column) => (
                    <span key={column} role="columnheader" className={`agent-table__th agent-dp__th agent-dp__c--${column}`} aria-sort={column === "stage" ? "descending" : undefined}>
                        {t(`pages.agent_workspace.deals.columns.${column}`)}
                        {column === "stage" ? " ↑" : ""}
                    </span>
                ))}
                <span aria-hidden="true" />
            </div>

            {rows === undefined ? (
                Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="agent-dp__skeleton-row" aria-hidden="true">
                        {Array.from({ length: 7 }, (_, cell) => (
                            <span key={cell} className="agent-dp__skeleton-bar" style={{ width: cell === 0 ? "70%" : "55%" }} />
                        ))}
                    </div>
                ))
            ) : rows.length === 0 ? (
                <EmptyState icon="briefcase" title={t("pages.agent_workspace.deals.empty_title")} description={t("pages.agent_workspace.deals.empty_description")} />
            ) : (
                <div role="rowgroup">
                    {rows.map((view) => (
                        <DealRow
                            key={view.deal.id}
                            view={view}
                            stage={stageById.get(view.deal.stage_id)?.stage}
                            userId={userId}
                            currencySymbol={currencySymbol}
                            nowMs={nowMs}
                            timeZone={timeZone}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
