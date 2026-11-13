import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { Deferred, router } from "@inertiajs/react";
import { message } from "antd";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import PropertyCard from "./PropertyCard";
import type { ExposeTarget } from "./PortfolioExposeModal";
import type { PortfolioDeal, PortfolioProperty, RecommendationsPayload } from "./types";
import usePortfolioActions from "./usePortfolioActions";

const PortfolioExposeModal = lazy(() => import("./PortfolioExposeModal"));

interface ForDealsViewProps {
    deals: PortfolioDeal[];
    dealId: number | null;
    recommendations?: RecommendationsPayload;
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
export default function ForDealsView({ deals, dealId, recommendations }: ForDealsViewProps) {
    const { t } = useTranslation();
    const { busy, assign, askAvailability } = usePortfolioActions();
    const [pickedId, setPickedId] = useState<number | null>(dealId);
    const [switching, setSwitching] = useState(false);
    const [selected, setSelected] = useState<number[]>([]);
    const [expose, setExpose] = useState<ExposeTarget | null>(null);

    useEffect(() => {
        setPickedId(dealId);
        setSelected([]);
    }, [dealId]);

    const deal = useMemo(() => deals.find((item) => item.id === pickedId) ?? deals[0], [deals, pickedId]);

    const pick = useCallback(
        (id: number) => {
            if (id === pickedId) return;
            setPickedId(id);
            setSwitching(true);
            router.get(
                route("agent.portfolio"),
                { deal: id },
                {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                    only: ["dealId", "recommendations"],
                    onFinish: () => setSwitching(false),
                },
            );
        },
        [pickedId],
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

    if (deals.length === 0 || !deal) {
        return (
            <section className="agent-pf__panel">
                <EmptyState icon="briefcase" title={t("pages.agent_workspace.portfolio.deals.empty_title")} description={t("pages.agent_workspace.portfolio.deals.empty_description")} />
            </section>
        );
    }

    const single = selected.length === 1 ? (recommendations?.items.find((item) => item.id === selected[0]) ?? null) : null;

    return (
        <div className="agent-pf__split">
            <section className="agent-pf__panel agent-pf__rail" aria-label={t("pages.agent_workspace.portfolio.deals.rail")}>
                <span className="agent-pf__cap">{t("pages.agent_workspace.portfolio.deals.rail")}</span>
                <ul className="agent-pf__deals">
                    {deals.map((item) => (
                        <li key={item.id}>
                            <button type="button" className="agent-pf__deal" aria-pressed={item.id === deal.id} onClick={() => pick(item.id)}>
                                <Avatar initials={initialsFromName(item.person || item.name)} size={30} />
                                <span className="agent-pf__deal-text">
                                    <b>{item.person ? `${item.person} · ${item.name}` : item.name}</b>
                                    <span>{wants(item) || t("pages.agent_workspace.portfolio.deals.no_wants")}</span>
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
                <p className="agent-pf__note">{t("pages.agent_workspace.portfolio.deals.source")}</p>
            </section>

            <section className="agent-pf__panel agent-pf__main" aria-live="polite">
                <header className="agent-pf__main-head">
                    <h2>{t("pages.agent_workspace.portfolio.deals.recommended", { deal: deal.person ? `${deal.person} · ${deal.name}` : deal.name })}</h2>
                    <div className="agent-pf__actions">
                        <button
                            type="button"
                            className="dr-btn dr-btn-sm dr-btn-primary"
                            disabled={!single}
                            title={selected.length > 1 ? t("pages.agent_workspace.portfolio.deals.expose_one") : undefined}
                            onClick={() => single && openExpose(single)}
                        >
                            {selected.length > 0
                                ? t("pages.agent_workspace.portfolio.deals.send_expose_count", { count: selected.length })
                                : t("pages.agent_workspace.portfolio.deals.send_expose")}
                        </button>
                        <button type="button" className="dr-btn dr-btn-sm dr-btn-ghost" disabled={selected.length === 0 || busy !== null} onClick={onAssign}>
                            {t("pages.agent_workspace.portfolio.deals.assign")}
                        </button>
                        <button type="button" className="dr-btn dr-btn-sm dr-btn-ghost" disabled={selected.length === 0 || busy !== null} onClick={onAsk}>
                            {t("pages.agent_workspace.portfolio.deals.ask")}
                        </button>
                    </div>
                </header>

                {switching ? (
                    <CardsSkeleton />
                ) : (
                    <Deferred data="recommendations" fallback={<CardsSkeleton />}>
                        {recommendations && recommendations.items.length > 0 ? (
                            <ul className="agent-pf__grid">
                                {recommendations.items.map((item) => (
                                    <PropertyCard key={item.id} property={item} selected={selected.includes(item.id)} onSelect={toggle} onExpose={openExpose} />
                                ))}
                            </ul>
                        ) : (
                            <EmptyState
                                icon="building"
                                title={t(recommendations?.error ? "pages.agent_workspace.portfolio.deals.error_title" : "pages.agent_workspace.portfolio.deals.none_title")}
                                description={t(recommendations?.error ? "pages.agent_workspace.portfolio.deals.error_description" : "pages.agent_workspace.portfolio.deals.none_description")}
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
