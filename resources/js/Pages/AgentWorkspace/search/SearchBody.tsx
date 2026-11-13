import { useMemo, useState } from "react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { buildHits, type Hit } from "@/Components/Redesign/agent/search/hits";
import { SEARCH_GROUPS, type SearchGroup, type SearchResults } from "@/Components/Redesign/agent/search/types";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import PortfolioExposeModal, { type ExposeTarget } from "../portfolio/PortfolioExposeModal";
import SearchResultRow from "./SearchResultRow";
import useDoneTasks from "./useDoneTasks";

interface SearchBodyProps {
    query: string;
    results: SearchResults | undefined;
    tab: SearchGroup | "all";
}

/** Where each group sits on the "All" view: people and deals on the left, the rest on the right (L7-24). */
const LEFT: SearchGroup[] = ["people", "deals"];
const RIGHT: SearchGroup[] = ["properties", "tasks", "meetings", "notes"];

const KIND_OF: Record<SearchGroup, Hit["kind"]> = { people: "person", deals: "deal", properties: "property", tasks: "task", meetings: "meeting", notes: "note" };

export function SearchSkeleton() {
    return (
        <div className="agent-sp__cols" aria-hidden="true">
            {[0, 1].map((column) => (
                <div key={column} className="agent-sp__col">
                    {[0, 1].map((panel) => (
                        <div key={panel} className="agent-sp__panel">
                            <div className="agent-sp__head" />
                            {[0, 1, 2].map((row) => (
                                <div key={row} className="agent-sp__skeleton-row">
                                    <span className="agent-sp__skeleton-icon" />
                                    <span className="agent-sp__skeleton-line" />
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            ))}
        </div>
    );
}

export default function SearchBody({ query, results, tab }: SearchBodyProps) {
    const { t, locale } = useTranslation();
    const { timezone } = useUserDateTime();
    const { props } = usePage<PageProps>();
    const userId = (props.auth?.user as { id?: number } | undefined)?.id ?? null;
    const [expose, setExpose] = useState<ExposeTarget | null>(null);
    const done = useDoneTasks();

    const hits = useMemo(
        () => buildHits(results ?? null, { t, locale, timeZone: timezone, nowMs: Date.now(), userId }, "page"),
        // The clock only decides "today" and "tomorrow"; a new answer refreshes it.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [results, t, locale, timezone, userId],
    );

    if (!results) return <SearchSkeleton />;
    if (results.total === 0) {
        return (
            <div className="agent-sp__empty">
                <EmptyState icon="search" title={t("pages.agent_workspace.search_results.none_title", { query })} description={t("pages.agent_workspace.search_results.none_text")} />
            </div>
        );
    }

    const panel = (group: SearchGroup) => {
        const rows = hits.filter((hit) => hit.kind === KIND_OF[group]);
        if (rows.length === 0) return null;
        return (
            <section key={group} className="agent-sp__panel" aria-label={t(`pages.agent_workspace.search_results.tabs.${group}`)}>
                <h2 className="agent-sp__head">
                    {t(`pages.agent_workspace.search_results.tabs.${group}`)} · {results.counts[group]}
                </h2>
                <ul className="agent-sp__rows">
                    {rows.map((hit) => (
                        <SearchResultRow key={hit.key} hit={hit} query={query} done={done} onExpose={setExpose} />
                    ))}
                </ul>
            </section>
        );
    };

    return (
        <>
            {tab === "all" ? (
                <div className="agent-sp__cols">
                    <div className="agent-sp__col">{LEFT.map(panel)}</div>
                    <div className="agent-sp__col">{RIGHT.map(panel)}</div>
                </div>
            ) : (
                <div className="agent-sp__single">{SEARCH_GROUPS.filter((group) => group === tab).map(panel)}</div>
            )}
            {expose ? <PortfolioExposeModal target={expose} onClose={() => setExpose(null)} /> : null}
        </>
    );
}
