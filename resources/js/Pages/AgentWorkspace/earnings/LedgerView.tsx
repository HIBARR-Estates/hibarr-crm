import { useMemo, useState } from "react";
import { Deferred } from "@inertiajs/react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Icon from "@/Components/Redesign/primitives/Icon";
import { AgentNewTag } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import CommissionTable, { lineStatus } from "./CommissionTable";
import DisputeBar from "./DisputeBar";
import EarningsHeader from "./EarningsHeader";
import useCommissionLines from "./useCommissionLines";
import type { CommissionLine, LedgerPayload } from "./types";

type Filter = "all" | "pending" | "paid" | "disputed" | "reverted";

const CHIP_MARKS: Record<string, string> = {
    all: "",
    pending: "var(--dr-gray-dark)",
    approved: "var(--dr-blue)",
    paid: "var(--dr-green)",
    disputed: "var(--dr-time-late-solid)",
    reverted: "var(--dr-time-none-solid)",
};

interface LedgerViewProps {
    year: number;
    currencySymbol: string;
    ledger?: LedgerPayload;
}

function matches(line: CommissionLine, query: string): boolean {
    if (!query) return true;
    const haystack = [line.person, line.deal_name, line.package, line.from_agent].filter(Boolean).join(" ").toLowerCase();
    return query
        .toLowerCase()
        .split(/\s+/)
        .every((word) => haystack.includes(word));
}

interface BodyProps {
    year: number;
    currencySymbol: string;
    ledger: LedgerPayload | undefined;
}

/** The header and the table, once the lines are in: the chips count them, the search narrows them. */
function LedgerBody({ year, currencySymbol, ledger }: BodyProps) {
    const { t } = useTranslation();
    const work = useCommissionLines(ledger?.items ?? EMPTY);
    const [filter, setFilter] = useState<Filter>("all");
    const [query, setQuery] = useState("");

    const counts = useMemo(() => {
        const result: Record<Filter, number> = { all: work.lines.length, pending: 0, paid: 0, disputed: 0, reverted: 0 };
        for (const line of work.lines) result[lineStatus(line)] += 1;
        return result;
    }, [work.lines]);

    const visible = useMemo(
        () => work.lines.filter((line) => (filter === "all" || lineStatus(line) === filter) && matches(line, query.trim())),
        [work.lines, filter, query],
    );

    const subtitle = t(counts.all === 1 ? "pages.agent_workspace.earnings.ledger.subtitle_one" : "pages.agent_workspace.earnings.ledger.subtitle", { count: counts.all, year });

    return (
        <>
            <LedgerControls subtitle={subtitle} counts={counts} filter={filter} onFilter={setFilter} query={query} onQuery={setQuery} />

            {work.lines.length === 0 ? (
                <EmptyState icon="wallet" title={t("pages.agent_workspace.earnings.ledger.empty_title")} description={t("pages.agent_workspace.earnings.ledger.empty_description", { year })} />
            ) : visible.length === 0 ? (
                <EmptyState
                    icon="search"
                    title={t("pages.agent_workspace.earnings.ledger.no_match_title")}
                    description={t("pages.agent_workspace.earnings.ledger.no_match_description")}
                    action={{
                        label: t("pages.agent_workspace.earnings.ledger.clear"),
                        icon: null,
                        onClick: () => {
                            setFilter("all");
                            setQuery("");
                        },
                    }}
                />
            ) : (
                <CommissionTable lines={visible} currencySymbol={currencySymbol} activeId={work.open?.line.id ?? null} onDispute={work.openDispute} onViewDispute={work.viewDispute} />
            )}

            {ledger?.truncated ? <p className="agent-ea__note">{t("pages.agent_workspace.earnings.ledger.truncated", { count: work.lines.length, year })}</p> : null}
            {work.open ? <DisputeBar key={`${work.open.line.id}-${work.open.mode}`} line={work.open.line} mode={work.open.mode} onClose={work.closeDispute} onSent={work.markDisputed} /> : null}
        </>
    );
}

const EMPTY: CommissionLine[] = [];

interface ControlsProps {
    subtitle: string;
    counts: Record<Filter, number> | null;
    filter: Filter;
    onFilter: (filter: Filter) => void;
    query: string;
    onQuery: (query: string) => void;
}

function LedgerControls({ subtitle, counts, filter, onFilter, query, onQuery }: ControlsProps) {
    const { t } = useTranslation();
    // Reverted is a status the CRM has but the board does not show: it gets a chip only when there is one.
    const keys: Array<Filter | "approved"> = ["all", "pending", "approved", "paid", "disputed", ...(counts && counts.reverted > 0 ? (["reverted"] as const) : [])];

    return (
        <EarningsHeader title={t("pages.agent_workspace.earnings.ledger.title")} subtitle={subtitle}>
            <ul className="agent-ea__chips">
                {keys.map((key) => {
                    const held = key === "approved";
                    const pressed = key === filter;
                    return (
                        <li key={key}>
                            <button
                                type="button"
                                className={`agent-ea__chip${counts ? "" : " is-loading"}${held ? " is-held" : ""}`}
                                aria-pressed={held ? undefined : pressed}
                                aria-disabled={held ? true : undefined}
                                disabled={!counts && !held}
                                onClick={() => {
                                    if (!held) onFilter(key as Filter);
                                }}
                            >
                                <span className="agent-ea__chip-label">
                                    {CHIP_MARKS[key] ? <span className="agent-ea__chip-mark" style={{ background: CHIP_MARKS[key] }} aria-hidden="true" /> : null}
                                    {t(`pages.agent_workspace.earnings.chips.${key}`)}
                                </span>
                                {held ? (
                                    <AgentNewTag hint={t("pages.agent_workspace.earnings.held.approved")} />
                                ) : (
                                    <span className="agent-ea__chip-value">{counts ? counts[key as Filter] : 0}</span>
                                )}
                            </button>
                        </li>
                    );
                })}
            </ul>
            <label className="agent-ea__search">
                <Icon name="search" size={14} />
                <input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={t("pages.agent_workspace.earnings.ledger.search")} aria-label={t("pages.agent_workspace.earnings.ledger.search")} />
            </label>
        </EarningsHeader>
    );
}

function TableSkeleton() {
    return (
        <div className="agent-ea__table" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="agent-ea__row agent-ea__row--skeleton">
                    <div className="dr-skeleton" style={{ height: 32, borderRadius: 16 }} />
                    <div className="dr-skeleton" style={{ height: 14, borderRadius: 6 }} />
                </div>
            ))}
        </div>
    );
}

/**
 * Ledger (L7-22): every commission line of the year. The chips count and
 * filter the lines, the search narrows them, and a dispute is written in the
 * bar under the table. All of it is local once the lines are in.
 */
export default function LedgerView({ year, currencySymbol, ledger }: LedgerViewProps) {
    const { t } = useTranslation();

    return (
        <Deferred
            data="ledger"
            fallback={
                <>
                    <LedgerControls subtitle={t("pages.agent_workspace.earnings.ledger.subtitle_loading")} counts={null} filter="all" onFilter={() => undefined} query="" onQuery={() => undefined} />
                    <TableSkeleton />
                </>
            }
        >
            <LedgerBody year={year} currencySymbol={currencySymbol} ledger={ledger} />
        </Deferred>
    );
}
