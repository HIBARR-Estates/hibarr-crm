import { Suspense, lazy, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentSecondRow, AgentWorkspaceLayout, useMinuteClock } from "@/Components/Redesign/agent";
import { useFilter } from "@/contexts/FilterContext";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import useTranslation from "@/Hooks/useTranslation";
import DealPipelinePills from "./deals/DealPipelinePills";
import DealsBoard from "./deals/DealsBoard";
import DealsHeader from "./deals/DealsHeader";
import DealsTable from "./deals/DealsTable";
import { dealViews, formatCompact } from "./deals/format";
import type { DealExtrasMap, DealItem, DealsChip, DealsLayout, DealStage, MonthOutcome } from "./deals/types";
import "./deals/deals.css";

// The Deals index's own filter modal: its code and form data load the first
// time Filters is pressed.
const DealsFilterModal = lazy(() => import("./deals/DealsFilterModal"));

interface DealsProps {
    pageTitle: string;
    userId: number;
    pipelines: Array<{ id: number; name: string; visible?: boolean }>;
    pipelineId: number;
    filters: Record<string, string | undefined>;
    stages: DealStage[];
    currencySymbol: string;
    month: { won: MonthOutcome; lost: MonthOutcome };
    limit: number;
    deals?: DealItem[];
    dealExtras?: DealExtrasMap;
}

const LAYOUT_KEY = "agent.deals.layout";

function initialLayout(): DealsLayout {
    try {
        const fromUrl = new URLSearchParams(window.location.search).get("layout");
        if (fromUrl === "board" || fromUrl === "list") return fromUrl;
        const stored = window.localStorage.getItem(LAYOUT_KEY);
        if (stored === "board" || stored === "list") return stored;
    } catch {
        // No storage or no window: the board.
    }
    return "board";
}

/** Filters that make up the Filters pill's count: a date or value range is one filter, not two. */
function filterCount(filters: Record<string, string | undefined>): number {
    const keys = Object.entries(filters)
        .filter(([key, value]) => key !== "lead_pipeline_id" && value !== undefined && value !== "" && value !== null)
        .map(([key]) => key);
    const pairs: Array<[string, string]> = [
        ["start_date", "end_date"],
        ["close_start", "close_end"],
        ["min_value_range", "max_value_range"],
    ];
    return keys.length - pairs.filter(([a, b]) => keys.includes(a) && keys.includes(b)).length;
}

/**
 * Deals: the agent workspace's board and list of one pipeline's open deals
 * (approved layouts L7-15 and L7-16). The stage columns arrive with the page,
 * the deals follow, then each deal's conditions and last activity. The board
 * and list are the same data; the switch, the chips and the search narrow it
 * in the browser, so they answer at once.
 */
export default function Deals({ pageTitle, userId, pipelines, pipelineId, filters, stages, currencySymbol, month, limit, deals, dealExtras }: DealsProps) {
    const { t, locale } = useTranslation();
    const { timezone } = useUserDateTime();
    const nowMs = useMinuteClock();
    const { url } = usePage<PageProps>();
    const { openDrawer } = useFilter();

    const [layout, setLayout] = useState<DealsLayout>(initialLayout);
    const [chip, setChip] = useState<DealsChip | null>(null);
    const [search, setSearch] = useState("");

    const changeLayout = useCallback((next: DealsLayout) => {
        setLayout(next);
        try {
            window.localStorage.setItem(LAYOUT_KEY, next);
            const params = new URLSearchParams(window.location.search);
            params.set("layout", next);
            window.history.replaceState(window.history.state, "", `${window.location.pathname}?${params.toString()}`);
        } catch {
            // The switch still works without a stored choice.
        }
    }, []);

    const changePipeline = useCallback(
        (id: number) => {
            if (id === pipelineId) return;
            // Another pipeline's stages are not this one's, so the stage filter does not carry over.
            const { pipeline_stage_id: _stage, ...rest } = filters;
            const data: Record<string, string> = { lead_pipeline_id: String(id), layout };
            for (const [key, value] of Object.entries(rest)) if (key !== "lead_pipeline_id" && key !== "layout" && value) data[key] = value;
            router.get(route("agent.deals"), data, { preserveState: true, preserveScroll: true, replace: true });
        },
        [filters, pipelineId, layout],
    );

    const views = useMemo(() => (deals ? dealViews(deals, dealExtras, nowMs, timezone) : undefined), [deals, dealExtras, nowMs, timezone]);

    const needle = search.trim().toLowerCase();
    const shown = useMemo(() => {
        if (!views) return undefined;
        return views.filter((view) => {
            if (needle) {
                const haystack = `${view.deal.person ?? ""} ${view.deal.name ?? ""}`.toLowerCase();
                if (!haystack.includes(needle)) return false;
            }
            if (layout === "list") {
                if (chip === "idle") return view.idleDays !== null && view.idleDays >= 7;
                if (chip === "meeting") return view.meetingWithinWeek;
                if (chip === "ready") return view.ready;
            }
            return true;
        });
    }, [views, layout, needle, chip]);

    const narrowed = needle !== "" || (layout === "list" && chip !== null);

    const chipCounts = useMemo(() => {
        const pool = views ?? [];
        const loaded = dealExtras !== undefined;
        return {
            all: views ? views.length : stages.reduce((sum, stage) => sum + stage.deals_count, 0),
            idle: loaded ? pool.filter((view) => view.idleDays !== null && view.idleDays >= 7).length : undefined,
            meeting: views ? pool.filter((view) => view.meetingWithinWeek).length : undefined,
            ready: loaded ? pool.filter((view) => view.ready).length : undefined,
        };
    }, [views, dealExtras, stages]);

    // The subtitle: how many open deals and what they are worth. From the stage
    // totals until a chip or the search narrows the list to the deals themselves.
    const count = narrowed && shown ? shown.length : stages.reduce((sum, stage) => sum + stage.deals_count, 0);
    const value = narrowed && shown ? shown.reduce((sum, view) => sum + view.deal.value, 0) : stages.reduce((sum, stage) => sum + stage.total_value, 0);
    const money = formatCompact(value, currencySymbol, locale);
    const subtitleKey = layout === "board" ? "subtitle_board" : "subtitle_list";
    const subtitle = count === 1
        ? t(`pages.agent_workspace.deals.${subtitleKey}_one`, { money })
        : t(`pages.agent_workspace.deals.${subtitleKey}`, { count, money });

    const pipelineName = pipelines.find((pipeline) => pipeline.id === pipelineId)?.name ?? pageTitle;
    const monthLabel = useMemo(() => new Date(nowMs).toLocaleDateString(locale === "en" ? "en-GB" : locale, { month: "short", timeZone: timezone || undefined }), [locale, nowMs, timezone]);

    // The modal mounts on first use and opens itself; later presses just open it.
    const [filtersMounted, setFiltersMounted] = useState(false);
    const mountedRef = useRef(false);
    const openFilters = useCallback(() => {
        if (mountedRef.current) {
            openDrawer();
            return;
        }
        mountedRef.current = true;
        setFiltersMounted(true);
    }, [openDrawer]);

    const truncated = deals !== undefined && deals.length >= limit;

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <DealPipelinePills pipelines={pipelines} pipelineId={pipelineId} onPipeline={changePipeline} filterCount={filterCount(filters)} onFilters={openFilters} />
            </AgentSecondRow>

            <div className="agent-dp">
                <DealsHeader
                    title={pipelineName}
                    subtitle={subtitle}
                    layout={layout}
                    onLayout={changeLayout}
                    counts={chipCounts}
                    chip={chip}
                    onChip={setChip}
                    searchText={search}
                    onSearchText={setSearch}
                />

                {layout === "board" ? (
                    <DealsBoard
                        stages={stages}
                        views={shown}
                        narrowed={narrowed}
                        currencySymbol={currencySymbol}
                        nowMs={nowMs}
                        timeZone={timezone}
                        month={month}
                        monthLabel={monthLabel}
                    />
                ) : (
                    <DealsTable stages={stages} views={shown} userId={userId} currencySymbol={currencySymbol} nowMs={nowMs} timeZone={timezone} />
                )}

                {truncated ? <p className="agent-dp__truncated">{t("pages.agent_workspace.deals.truncated", { count: limit })}</p> : null}
            </div>

            {filtersMounted ? (
                <Suspense fallback={null}>
                    <DealsFilterModal pipelines={pipelines} pipelineId={pipelineId} total={count} appliedKey={`${url}|${JSON.stringify(filters)}`} />
                </Suspense>
            ) : null}
        </>
    );
}

Deals.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
