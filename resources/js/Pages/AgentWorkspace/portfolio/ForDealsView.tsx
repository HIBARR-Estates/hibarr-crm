import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Deferred, router } from "@inertiajs/react";
import { message } from "antd";
import { AgentPager } from "@/Components/Redesign/agent";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import MenuSelect, { type MenuOption } from "@/Components/Redesign/primitives/MenuSelect";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import PropertyCard from "./PropertyCard";
import type { ExposeTarget } from "./PortfolioExposeModal";
import type { DealsPageMeta, PortfolioDeal, PortfolioPipeline, PortfolioProperty, RecommendationsPayload } from "./types";
import usePortfolioActions from "./usePortfolioActions";

/** Deals get a stable avatar colour by position, from the navy and teal tones of the design. */
const AVATAR_TONES = ["#16294d", "#0f5f73", "#177a5b", "#475569", "#3d5a80"];

const PortfolioExposeModal = lazy(() => import("./PortfolioExposeModal"));

/** Matches shown at a time; the rest are a page away. */
const MATCHES_PER_PAGE = 6;

const PIPELINE_KEY = "agent-portfolio-pipeline";
const ALL_PIPELINES = "all";

interface ForDealsViewProps {
    deals: PortfolioDeal[];
    dealsPage: DealsPageMeta;
    selectedDeal: PortfolioDeal | null;
    pipelines: PortfolioPipeline[];
    pipelineId: string;
    recommendations?: RecommendationsPayload;
}

/** The query every visit of this page carries: the pipeline, the rail's page and the deal picked. */
function query(pipelineId: string, dealsPage: number, dealId: number | null): Record<string, string> {
    const data: Record<string, string> = { pipeline: pipelineId };
    if (dealsPage > 1) data.deals_page = String(dealsPage);
    if (dealId) data.deal = String(dealId);
    return data;
}

function readStoredPipeline(): string | null {
    try {
        return window.localStorage.getItem(PIPELINE_KEY);
    } catch {
        return null;
    }
}

function storePipeline(value: string): void {
    try {
        window.localStorage.setItem(PIPELINE_KEY, value);
    } catch {
        // Not remembered; the page still works.
    }
}

function CardsSkeleton() {
    return (
        <ul className="agent-pf__grid" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
                <li key={index} className="agent-pf__card">
                    <div className="dr-skeleton" style={{ height: 118, borderRadius: 12 }} />
                    <div className="dr-skeleton" style={{ height: 14, width: "70%", borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 12, width: "90%", borderRadius: 6 }} />
                </li>
            ))}
        </ul>
    );
}

interface RailHeadProps {
    pipelineId: string;
    options: MenuOption[];
    onChange: (value: string) => void;
}

/** The rail's title and the setting for which kind of deals it lists: the pipeline. */
function RailHead({ pipelineId, options, onChange }: RailHeadProps) {
    const { t } = useTranslation();

    return (
        <div className="agent-pf__rail-head">
            <span className="agent-pf__cap">{t("pages.agent_workspace.portfolio.deals.rail")}</span>
            <MenuSelect size="sm" fullWidth value={pipelineId} options={options} onChange={(value) => onChange(String(value))} />
        </div>
    );
}

/** What a deal wants, from its Hibarr fields: "2+1 · € 250–350k · by May 2027". */
function wants(deal: PortfolioDeal): string {
    return [deal.interested_in, deal.budget_range, deal.purchase_timeline].filter(Boolean).join(" · ");
}

/**
 * For my deals (L7-18): the agent's open deals with what each wants, and the
 * matching service's picks for the one chosen. Picking a deal is a partial
 * visit that keeps the page; cards can be selected to send an exposé, attach
 * to the deal or ask whether they are still available.
 */
export default function ForDealsView({ deals, dealsPage, selectedDeal, pipelines, pipelineId, recommendations }: ForDealsViewProps) {
    const { t } = useTranslation();
    const { busy, assign, askAvailability } = usePortfolioActions();
    const [switching, setSwitching] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [matchPage, setMatchPage] = useState(1);
    const [expose, setExpose] = useState<ExposeTarget | null>(null);

    const deal = selectedDeal;
    const dealId = deal?.id ?? null;

    // A new deal, or fresh matches, start on the first page with nothing ticked.
    useEffect(() => {
        setSelected([]);
        setMatchPage(1);
    }, [dealId]);

    // The pipeline picked last time is the one the page opens on.
    useEffect(() => {
        const stored = readStoredPipeline();
        const known = stored === ALL_PIPELINES || pipelines.some((pipeline) => String(pipeline.id) === stored);
        if (stored && known && stored !== pipelineId && !new URLSearchParams(window.location.search).has("pipeline")) {
            router.get(route("agent.portfolio"), query(stored, 1, null), { preserveState: true, preserveScroll: true, replace: true });
        }
        // Once, on arrival.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const pipelineOptions = useMemo<MenuOption[]>(
        () => [{ value: ALL_PIPELINES, label: t("pages.agent_workspace.portfolio.deals.all_pipelines") }, ...pipelines.map((pipeline) => ({ value: String(pipeline.id), label: pipeline.name }))],
        [pipelines, t],
    );

    const changePipeline = useCallback((next: string) => {
        if (next === pipelineId) return;
        storePipeline(next);
        setSwitching(true);
        router.get(route("agent.portfolio"), query(next, 1, null), {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            onFinish: () => setSwitching(false),
        });
    }, [pipelineId]);

    const pickDeal = useCallback(
        (id: number) => {
            if (id === dealId) return;
            setSwitching(true);
            router.get(route("agent.portfolio"), query(pipelineId, dealsPage.page, id), {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["dealId", "selectedDeal", "recommendations"],
                onFinish: () => setSwitching(false),
            });
        },
        [dealId, dealsPage.page, pipelineId],
    );

    const railPage = useCallback(
        (page: number) =>
            router.get(route("agent.portfolio"), query(pipelineId, page, dealId), {
                preserveState: true,
                preserveScroll: true,
                replace: true,
                only: ["deals", "dealsPage"],
            }),
        [dealId, pipelineId],
    );

    const toggle = useCallback((id: number) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id])), []);

    const openExpose = useCallback(
        (property: PortfolioProperty) =>
            setExpose({
                kind: "property",
                id: property.id,
                title: property.title,
                subtitle: property.project ?? undefined,
                leadId: deal?.lead_id ?? undefined,
                leadLabel: deal?.person ?? undefined,
            }),
        [deal],
    );

    const onAssign = async () => {
        if (!deal || selected.length === 0) return;
        const result = await assign(deal.id, selected);
        if (result.ok) {
            message.success(t("pages.agent_workspace.portfolio.deals.assigned"));
            setSelected([]);
        } else {
            message.error(result.message || t("pages.agent_workspace.portfolio.failed"));
        }
    };

    const onAsk = async () => {
        if (selected.length === 0) return;
        const result = await askAvailability(selected);
        if (result.ok) {
            message.success(t("pages.agent_workspace.portfolio.deals.requested"));
            setSelected([]);
        } else {
            message.error(result.message || t("pages.agent_workspace.portfolio.failed"));
        }
    };

    if (dealsPage.total === 0 || !deal) {
        return (
            <div className="agent-pf__split">
                <section className="agent-pf__panel agent-pf__rail" aria-label={t("pages.agent_workspace.portfolio.deals.rail")}>
                    <RailHead pipelineId={pipelineId} options={pipelineOptions} onChange={changePipeline} />
                </section>
                <section className="agent-pf__panel agent-pf__main">
                    <EmptyState
                        icon="briefcase"
                        title={t("pages.agent_workspace.portfolio.deals.empty_title")}
                        description={t(pipelineId === ALL_PIPELINES ? "pages.agent_workspace.portfolio.deals.empty_description" : "pages.agent_workspace.portfolio.deals.empty_pipeline")}
                    />
                </section>
            </div>
        );
    }

    // Matches that arrive for another deal (a slow answer from before a switch) are not shown.
    const current = recommendations && recommendations.deal_id === dealId ? recommendations : undefined;
    const allMatches = current?.items ?? [];
    const matchPages = Math.max(1, Math.ceil(allMatches.length / MATCHES_PER_PAGE));
    const matchStart = (Math.min(matchPage, matchPages) - 1) * MATCHES_PER_PAGE;
    const matches = allMatches.slice(matchStart, matchStart + MATCHES_PER_PAGE);
    const matchFrom = allMatches.length === 0 ? 0 : matchStart + 1;
    const matchTo = matchStart + matches.length;

    const single = selected.length === 1 ? (current?.items.find((item) => item.id === selected[0]) ?? null) : null;

    return (
        <div className="agent-pf__split">
            <section className="agent-pf__panel agent-pf__rail" aria-label={t("pages.agent_workspace.portfolio.deals.rail")}>
                <RailHead pipelineId={pipelineId} options={pipelineOptions} onChange={changePipeline} />
                <ul className="agent-pf__deals">
                    {deals.map((item, index) => (
                        <li key={item.id}>
                            <button type="button" className="agent-pf__deal" aria-pressed={item.id === deal.id} onClick={() => pickDeal(item.id)}>
                                <Avatar initials={initialsFromName(item.person || item.name)} size={30} tone={{ bg: AVATAR_TONES[index % AVATAR_TONES.length], fg: "#ffffff" }} />
                                <span className="agent-pf__deal-text">
                                    <b>{item.person ? `${item.person} · ${item.name}` : item.name}</b>
                                    <span>{wants(item) || t("pages.agent_workspace.portfolio.deals.no_wants")}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                <AgentPager
                    page={dealsPage.page}
                    lastPage={dealsPage.last_page}
                    from={dealsPage.from}
                    to={dealsPage.to}
                    total={dealsPage.total}
                    onPage={railPage}
                    label={t("pages.agent_workspace.portfolio.deals.rail")}
                />
            </section>

            <section className="agent-pf__panel agent-pf__main" aria-live="polite">
                <header className="agent-pf__main-head">
                    <h2>{t("pages.agent_workspace.portfolio.deals.recommended", { deal: deal.person ? `${deal.person} · ${deal.name}` : deal.name })}</h2>
                    <div className="agent-pf__actions">
                        <Button
                            size="sm"
                            variant="primary"
                            disabled={!single}
                            title={selected.length > 1 ? t("pages.agent_workspace.portfolio.deals.expose_one") : undefined}
                            onClick={() => single && openExpose(single)}
                        >
                            {selected.length > 0
                                ? t("pages.agent_workspace.portfolio.deals.send_expose_count", { count: selected.length })
                                : t("pages.agent_workspace.portfolio.deals.send_expose")}
                        </Button>
                        <Button size="sm" className="agent-btn-soft" disabled={selected.length === 0 || busy !== null} onClick={onAssign}>
                            {t("pages.agent_workspace.portfolio.deals.assign")}
                        </Button>
                        <Button size="sm" className="agent-btn-soft" disabled={selected.length === 0 || busy !== null} onClick={onAsk}>
                            {t("pages.agent_workspace.portfolio.deals.ask")}
                        </Button>
                    </div>
                </header>

                {switching ? (
                    <CardsSkeleton />
                ) : (
                    <Deferred data="recommendations" fallback={<CardsSkeleton />}>
                        {!current ? (
                            <CardsSkeleton />
                        ) : current.items.length > 0 ? (
                            <>
                                <ul className="agent-pf__grid">
                                    {matches.map((item) => (
                                        <PropertyCard key={item.id} property={item} selected={selected.includes(item.id)} onSelect={toggle} onExpose={openExpose} />
                                    ))}
                                </ul>
                                <AgentPager
                                    page={matchPage}
                                    lastPage={matchPages}
                                    from={matchFrom}
                                    to={matchTo}
                                    total={current.items.length}
                                    onPage={setMatchPage}
                                    label={t("pages.agent_workspace.portfolio.deals.matches")}
                                />
                            </>
                        ) : (
                            <EmptyState
                                icon="building"
                                title={t(current.error ? "pages.agent_workspace.portfolio.deals.error_title" : "pages.agent_workspace.portfolio.deals.none_title")}
                                description={t(current.error ? "pages.agent_workspace.portfolio.deals.error_description" : "pages.agent_workspace.portfolio.deals.none_description")}
                            />
                        )}
                    </Deferred>
                )}
            </section>

            {expose ? (
                <Suspense fallback={null}>
                    <PortfolioExposeModal target={expose} onClose={() => setExpose(null)} />
                </Suspense>
            ) : null}
        </div>
    );
}
