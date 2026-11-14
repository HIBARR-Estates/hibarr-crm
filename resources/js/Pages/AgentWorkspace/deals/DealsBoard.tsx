import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DealCard from "./DealCard";
import { formatCompact, formatMoney } from "./format";
import type { DealStage, DealView, MonthOutcome } from "./types";

interface DealsBoardProps {
    stages: DealStage[];
    /** Undefined while the deals are on their way: the columns show placeholder cards. */
    views: DealView[] | undefined;
    /** True when a chip or the search narrows the board: the column figures then follow the cards. */
    narrowed: boolean;
    currencySymbol: string;
    nowMs: number;
    timeZone: string;
    month: { won: MonthOutcome; lost: MonthOutcome };
    monthLabel: string;
}

/**
 * The board (L7-15): one column per stage of the pipeline, each headed by
 * its name, deal count and value, with the stage's colour on its top edge;
 * then the month's won and lost. Won and lost are not columns to drop into:
 * an admin sets them.
 */
export default function DealsBoard({ stages, views, narrowed, currencySymbol, nowMs, timeZone, month, monthLabel }: DealsBoardProps) {
    const { t, locale } = useTranslation();
    const { td } = useTd();

    const byStage = useMemo(() => {
        const map = new Map<number, DealView[]>();
        for (const view of views ?? []) {
            const list = map.get(view.deal.stage_id);
            if (list) list.push(view);
            else map.set(view.deal.stage_id, [view]);
        }
        return map;
    }, [views]);

    return (
        <div className="agent-dp__board" aria-label={t("pages.agent_workspace.deals.board_label")}>
            {stages.map((stage) => {
                const cards = byStage.get(stage.id) ?? [];
                const useCards = narrowed && views !== undefined;
                const count = useCards ? cards.length : stage.deals_count;
                const total = useCards ? cards.reduce((sum, view) => sum + view.deal.value, 0) : stage.total_value;

                return (
                    <section key={stage.id} className="agent-dp__column" aria-label={td(stage.name, { source: "en" })}>
                        <header className="agent-dp__column-head" style={{ ["--stage" as string]: stage.color || undefined }}>
                            <b>{td(stage.name, { source: "en" })}</b>
                            <span className="agent-dp__column-figures">
                                {count} · {formatCompact(total, currencySymbol, locale)}
                            </span>
                        </header>
                        {views === undefined
                            ? Array.from({ length: Math.min(Math.max(stage.deals_count, 1), 3) }, (_, index) => <div key={index} className="agent-dp__card agent-dp__card--loading" aria-hidden="true" />)
                            : cards.map((view) => <DealCard key={view.deal.id} view={view} currencySymbol={currencySymbol} nowMs={nowMs} timeZone={timeZone} />)}
                    </section>
                );
            })}

            <aside className="agent-dp__outcomes" aria-label={t("pages.agent_workspace.deals.outcomes.label")}>
                <div className="agent-dp__tile">
                    <span className="agent-dp__tile-label">
                        <span className="agent-dp__tile-dot agent-dp__tile-dot--won" aria-hidden="true" />
                        {t("pages.agent_workspace.deals.outcomes.won", { month: monthLabel })}
                    </span>
                    <b>{month.won.count}</b>
                    <span>{formatMoney(month.won.value, currencySymbol, locale)}</span>
                </div>
                <div className="agent-dp__tile">
                    <span className="agent-dp__tile-label">
                        <span className="agent-dp__tile-dot agent-dp__tile-dot--lost" aria-hidden="true" />
                        {t("pages.agent_workspace.deals.outcomes.lost", { month: monthLabel })}
                    </span>
                    <b>{month.lost.count}</b>
                    <span>{formatMoney(month.lost.value, currencySymbol, locale)}</span>
                </div>
                <span className="agent-dp__note">{t("pages.agent_workspace.deals.outcomes.note")}</span>
            </aside>
        </div>
    );
}
