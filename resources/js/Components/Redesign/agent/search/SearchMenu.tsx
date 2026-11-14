import { Link } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import AgentCallButton from "../AgentCallButton";
import Highlight from "./Highlight";
import SearchHitIcon from "./SearchHitIcon";
import type { Hit } from "./hits";
import { MIN_QUERY_LENGTH } from "./useAgentSearch";
import type { SearchResults } from "./types";

/** How many rows each group shows in the dropdown. The rest is behind "See all". */
export const MENU_LIMITS = { people: 3, deals: 2, properties: 1, tasks: 2 } as const;

/** The dropdown's rows, cut to its limits: people, deals, properties, then tasks and meetings together. Notes are only on the results page. */
export function menuHits(hits: Hit[]): Hit[] {
    const take = (kinds: Array<Hit["kind"]>, limit: number) => hits.filter((hit) => kinds.includes(hit.kind)).slice(0, limit);
    return [...take(["person"], MENU_LIMITS.people), ...take(["deal"], MENU_LIMITS.deals), ...take(["property"], MENU_LIMITS.properties), ...take(["task", "meeting"], MENU_LIMITS.tasks)];
}

interface SearchMenuProps {
    id: string;
    query: string;
    results: SearchResults | null;
    hits: Hit[];
    loading: boolean;
    failed: boolean;
    activeKey: string | null;
    onActive: (key: string | null) => void;
    onOpen: (hit: Hit) => void;
    onSeeAll: () => void;
    onRetry: () => void;
}

const SECTIONS: Array<{ key: string; kinds: Array<Hit["kind"]>; label: string; count: (results: SearchResults) => number }> = [
    { key: "people", kinds: ["person"], label: "people", count: (r) => r.counts.people },
    { key: "deals", kinds: ["deal"], label: "deals", count: (r) => r.counts.deals },
    { key: "properties", kinds: ["property"], label: "properties", count: (r) => r.counts.properties },
    { key: "tasks", kinds: ["task", "meeting"], label: "tasks", count: (r) => r.counts.tasks + r.counts.meetings },
];

/**
 * The search dropdown under the dock (L7-23): the first few rows of each
 * group with the matching part marked, a Call button on people, and "See all"
 * for the full page. Arrow keys and Enter are handled by the field that owns it.
 */
export default function SearchMenu({ id, query, results, hits, loading, failed, activeKey, onActive, onOpen, onSeeAll, onRetry }: SearchMenuProps) {
    const { t } = useTranslation();
    const label = (key: string) => t(`pages.agent_workspace.search_results.${key}`);
    const word = query.trim();
    const short = word.length < MIN_QUERY_LENGTH;

    return (
        <div className="agent-sm" role="listbox" id={id} aria-label={label("results_label")} aria-busy={loading} onMouseDown={(event) => event.preventDefault()}>
            {short ? (
                <p className="agent-sm__note">{label("short")}</p>
            ) : failed ? (
                <p className="agent-sm__note">
                    {label("failed")}{" "}
                    <button type="button" className="agent-sm__link" onClick={onRetry}>
                        {label("retry")}
                    </button>
                </p>
            ) : !results ? (
                <p className="agent-sm__note">{label("loading")}</p>
            ) : results.total === 0 ? (
                <p className="agent-sm__note">{t("pages.agent_workspace.search_results.none_title", { query: word })}</p>
            ) : (
                <div className="agent-sm__groups">
                    {SECTIONS.map((section) => {
                        const rows = hits.filter((hit) => section.kinds.includes(hit.kind));
                        if (rows.length === 0) return null;
                        return (
                            <section key={section.key} className="agent-sm__group" aria-label={label(`groups.${section.label}`)}>
                                <h3 className="agent-sm__heading">
                                    {label(`groups.${section.label}`)} · {section.count(results)}
                                </h3>
                                {rows.map((hit) => (
                                    <div key={hit.key} role="option" aria-selected={hit.key === activeKey} id={`${id}-${hit.key}`} className={`agent-sm__row${hit.key === activeKey ? " is-active" : ""}`} onMouseEnter={() => onActive(hit.key)}>
                                        <Link href={hit.href} className="agent-sm__main" onClick={() => onOpen(hit)} tabIndex={-1}>
                                            <SearchHitIcon hit={hit} />
                                            <span className="agent-sm__text">
                                                <span className="agent-sm__title">
                                                    <Highlight text={hit.title} query={word} />
                                                </span>
                                                <span className="agent-sm__meta">{hit.meta}</span>
                                            </span>
                                        </Link>
                                        {hit.kind === "person" && hit.person.phone ? <AgentCallButton phone={hit.person.phone} entity={{ type: "lead", id: hit.person.id }} className="agent-sm__call" /> : null}
                                        {hit.key === activeKey ? (
                                            <span className="agent-sm__enter" aria-hidden="true">
                                                ↵
                                            </span>
                                        ) : null}
                                    </div>
                                ))}
                            </section>
                        );
                    })}
                </div>
            )}
            <div className="agent-sm__foot">
                <span className="agent-sm__hint">
                    ↑↓ {label("hint_move")} · ↵ {label("hint_open")}
                </span>
                {results && results.total > 0 ? (
                    <button type="button" className="agent-sm__all" onClick={onSeeAll}>
                        {t("pages.agent_workspace.search_results.see_all", { count: results.total })}
                        <span aria-hidden="true">→</span>
                    </button>
                ) : null}
            </div>
        </div>
    );
}
