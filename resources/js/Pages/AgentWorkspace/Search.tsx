import { useMemo, useState, type ReactNode } from "react";
import { Deferred, Head } from "@inertiajs/react";
import { AgentLinkPills, AgentSecondRow, AgentWorkspaceLayout } from "@/Components/Redesign/agent";
import "@/Components/Redesign/agent/search/agent-search.css";
import { SEARCH_GROUPS, type SearchGroup, type SearchResults } from "@/Components/Redesign/agent/search/types";
import useTranslation from "@/Hooks/useTranslation";
import SearchBody, { SearchSkeleton } from "./search/SearchBody";
import "./search/search.css";

interface SearchProps {
    pageTitle: string;
    query: string;
    group: SearchGroup | null;
    results?: SearchResults;
}

/**
 * Search results (L7-24): everything that matches one word, in the groups the
 * boards name, with a pill per group. The first pill ("All") shows every group
 * side by side; the others show one group. Switching is local and keeps the
 * address in step (?group=), so it can be shared.
 */
export default function Search({ pageTitle, query, group, results }: SearchProps) {
    const { t } = useTranslation();
    const [tab, setTab] = useState<SearchGroup | "all">(group ?? "all");

    const choose = (next: SearchGroup | "all") => {
        setTab(next);
        try {
            const url = new URL(window.location.href);
            if (next === "all") url.searchParams.delete("group");
            else url.searchParams.set("group", next);
            window.history.replaceState(window.history.state, "", url);
        } catch {
            // The address is a convenience; the pill still switches.
        }
    };

    const tabs = useMemo(
        () => [
            { key: "all" as const, label: t("pages.agent_workspace.search_results.tabs.all"), count: results?.total },
            ...SEARCH_GROUPS.map((key) => ({ key, label: t(`pages.agent_workspace.search_results.tabs.${key}`), count: results?.counts[key] })),
        ],
        [results, t],
    );

    const summary = !results
        ? ""
        : results.total === 0
          ? ""
          : t(results.total === 1 ? "pages.agent_workspace.search_results.summary_one" : "pages.agent_workspace.search_results.summary_other", { count: results.total });

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <AgentLinkPills
                    ariaLabel={t("pages.agent_workspace.today.title")}
                    pills={[
                        { key: "work", label: t("pages.agent_workspace.today.work_tab"), href: "/agent/today", current: false },
                        { key: "agenda", label: t("pages.agent_workspace.agenda.tab"), href: "/agent/today?tab=agenda", current: false },
                    ]}
                />
            </AgentSecondRow>

            <div className="agent-sp">
                <div className="agent-sp__top">
                    <h1>{t("pages.agent_workspace.search_results.heading", { query })}</h1>
                    <p aria-live="polite">{summary}</p>
                </div>
                <div className="agent-sp__tabs" role="group" aria-label={t("pages.agent_workspace.search_results.results_label")}>
                    {tabs.map((item) => (
                        <button key={item.key} type="button" className="agent-sp__tab" aria-pressed={tab === item.key} disabled={item.count === 0 && item.key !== "all"} onClick={() => choose(item.key)}>
                            {item.label}
                            {item.count !== undefined ? ` · ${item.count}` : ""}
                        </button>
                    ))}
                </div>
                <Deferred data="results" fallback={<SearchSkeleton />}>
                    <SearchBody query={query} results={results} tab={tab} />
                </Deferred>
            </div>
        </>
    );
}

Search.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
