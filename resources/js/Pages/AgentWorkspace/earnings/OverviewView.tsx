import { Deferred, Link } from "@inertiajs/react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import CommissionTable from "./CommissionTable";
import DisputeBar from "./DisputeBar";
import LevelCard from "./LevelCard";
import SummaryCards from "./SummaryCards";
import useCommissionLines from "./useCommissionLines";
import type { CommissionLine, EarningsSummary, LevelCard as LevelCardData } from "./types";

interface OverviewViewProps {
    currencySymbol: string;
    summary?: EarningsSummary | null;
    latest?: CommissionLine[];
    level?: LevelCardData | null;
}

function TableSkeleton() {
    return (
        <div className="agent-ea__table" aria-busy="true">
            {Array.from({ length: 5 }).map((_, index) => (
                <div key={index} className="agent-ea__row agent-ea__row--skeleton">
                    <div className="dr-skeleton" style={{ height: 32, borderRadius: 16 }} />
                    <div className="dr-skeleton" style={{ height: 14, borderRadius: 6 }} />
                </div>
            ))}
        </div>
    );
}

function LatestPanel({ items, currencySymbol }: { items: CommissionLine[]; currencySymbol: string }) {
    const { t } = useTranslation();
    const work = useCommissionLines(items);

    if (work.lines.length === 0) {
        return <EmptyState icon="wallet" title={t("pages.agent_workspace.earnings.latest.empty_title")} description={t("pages.agent_workspace.earnings.latest.empty_description")} />;
    }

    return (
        <>
            <CommissionTable lines={work.lines} currencySymbol={currencySymbol} activeId={work.open?.line.id ?? null} onDispute={work.openDispute} onViewDispute={work.viewDispute} />
            {work.open ? <DisputeBar key={`${work.open.line.id}-${work.open.mode}`} line={work.open.line} mode={work.open.mode} onClose={work.closeDispute} onSent={work.markDisputed} /> : null}
        </>
    );
}

/**
 * Overview (L7-21): the figures sit on the band; below, the latest commissions
 * and the level card. Each part follows the shell on its own.
 */
export default function OverviewView({ currencySymbol, summary, latest, level }: OverviewViewProps) {
    const { t } = useTranslation();

    return (
        <>
            <Deferred data="summary" fallback={<SummaryCards summary={null} currencySymbol={currencySymbol} />}>
                <SummaryCards summary={summary} currencySymbol={currencySymbol} />
            </Deferred>

            <div className="agent-ea__split">
                <section className="agent-ea__main" aria-labelledby="agent-ea-latest">
                    <div className="agent-ea__section-head">
                        <b id="agent-ea-latest">{t("pages.agent_workspace.earnings.latest.title")}</b>
                        <Link href={route("agent.earnings.ledger")} prefetch={["hover", "click"]} cacheFor="30s" className="agent-ea__btn">
                            {t("pages.agent_workspace.earnings.latest.open_ledger")}
                        </Link>
                    </div>
                    <Deferred data="latest" fallback={<TableSkeleton />}>
                        <LatestPanel items={latest ?? []} currencySymbol={currencySymbol} />
                    </Deferred>
                </section>

                <Deferred data="level" fallback={<div className="agent-ea__level agent-ea__level--skeleton dr-skeleton" aria-busy="true" />}>
                    {level ? <LevelCard card={level} currencySymbol={currencySymbol} /> : null}
                </Deferred>
            </div>
        </>
    );
}
