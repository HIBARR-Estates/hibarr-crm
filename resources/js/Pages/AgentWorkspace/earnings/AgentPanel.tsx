import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import { AgentNewTag } from "@/Components/Redesign/agent";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import useTranslation from "@/Hooks/useTranslation";
import { avatarFill } from "../people/format";
import { formatMoney } from "../deals/format";
import { historyDate, monthLabel } from "./format";
import useAgentPanel from "./useAgentPanel";
import type { NetworkRow } from "./types";

interface AgentPanelProps {
    agent: NetworkRow | null;
    currencySymbol: string;
}

/**
 * The details panel beside the network list (L7-37): the picked agent's
 * level, all-time metrics, level history, and what the agent earned on their
 * deals. Fetched on pick and kept, so no pick reloads the page.
 */
export default function AgentPanel({ agent, currencySymbol }: AgentPanelProps) {
    const { t, locale } = useTranslation();
    const { state, retry } = useAgentPanel(agent?.id ?? null);
    const money = (value: number) => formatMoney(value, currencySymbol, locale);
    const year = new Date().getFullYear();

    if (!agent) {
        return (
            <aside className="agent-ea__panel">
                <EmptyState icon="users" title={t("pages.agent_workspace.earnings.network.panel.empty_title")} description={t("pages.agent_workspace.earnings.network.panel.empty_description")} />
            </aside>
        );
    }

    const name = agent.name?.trim() || t("pages.agent_workspace.earnings.table.unnamed");
    const sub = agent.generation === 1 ? t("pages.agent_workspace.earnings.network.panel.sub_direct") : t("pages.agent_workspace.earnings.network.panel.sub");

    return (
        <aside className="agent-ea__panel" aria-label={t("pages.agent_workspace.earnings.network.panel.label", { name })} aria-busy={state.status === "loading"}>
            <div className="agent-ea__panel-head">
                <span className="agent-ea__avatar agent-ea__avatar--lg" style={{ ["--fill" as string]: avatarFill(agent.id) }} aria-hidden="true">
                    {initialsFromName(name)}
                </span>
                <span className="agent-ea__who">
                    <b className="agent-ea__panel-name">{name}</b>
                    <span className="agent-ea__sub">{sub}</span>
                </span>
                <button type="button" className="agent-ea__btn agent-ea__btn--ghost" disabled>
                    ↗ {t("pages.agent_workspace.earnings.network.panel.view_dashboard")}
                    <AgentNewTag hint={t("pages.agent_workspace.earnings.held.dashboard")} />
                </button>
            </div>

            {state.status === "error" ? (
                <EmptyState role="alert" icon="info" title={t("pages.agent_workspace.earnings.network.panel.error")} action={{ label: t("pages.agent_workspace.earnings.network.panel.retry"), icon: null, onClick: retry }} />
            ) : state.status !== "ready" ? (
                <div className="agent-ea__panel-skeleton" aria-hidden="true">
                    <div className="dr-skeleton" style={{ height: 16, width: "55%", borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 120, borderRadius: 10 }} />
                    <div className="dr-skeleton" style={{ height: 80, borderRadius: 10 }} />
                </div>
            ) : (
                <>
                    <p className="agent-ea__facts">
                        <span>
                            {t("pages.agent_workspace.earnings.network.panel.level")} <b>{state.data.level ?? t("pages.agent_workspace.earnings.network.unranked")}</b>
                        </span>
                        <span>
                            {t("pages.agent_workspace.earnings.network.panel.direct")} <b>{state.data.direct}</b>
                        </span>
                    </p>

                    <h2 className="agent-ea__cap">{t("pages.agent_workspace.earnings.network.panel.metrics")}</h2>
                    <div className="agent-ea__metrics">
                        <div className="agent-ea__metric">
                            <b>{state.data.metrics.nsa}</b>
                            <span>{t("pages.agent_workspace.earnings.network.panel.individual_sales")}</span>
                        </div>
                        <div className="agent-ea__metric">
                            <b>{state.data.metrics.nsd}</b>
                            <span>{t("pages.agent_workspace.earnings.network.panel.team_sales")}</span>
                        </div>
                        <div className="agent-ea__metric">
                            <b>{money(state.data.metrics.vsa)}</b>
                            <span>{t("pages.agent_workspace.earnings.network.panel.individual_revenue")}</span>
                        </div>
                        <div className="agent-ea__metric">
                            <b>{money(state.data.metrics.vsd)}</b>
                            <span>{t("pages.agent_workspace.earnings.network.panel.team_revenue")}</span>
                        </div>
                    </div>

                    <h2 className="agent-ea__cap">{t("pages.agent_workspace.earnings.network.panel.history")}</h2>
                    {state.data.history.length === 0 ? (
                        <p className="agent-ea__empty-line">{t("pages.agent_workspace.earnings.network.panel.history_empty")}</p>
                    ) : (
                        <ul className="agent-ea__list">
                            {state.data.history.map((entry, index) => (
                                <li key={`${entry.assigned_at}-${index}`} className="agent-ea__history">
                                    <span>{historyDate(entry.assigned_at, locale, year)}</span>
                                    <b>{entry.level}</b>
                                    <span>
                                        {entry.joined
                                            ? t("pages.agent_workspace.earnings.network.panel.joined")
                                            : entry.system
                                              ? t("pages.agent_workspace.earnings.network.panel.automatic")
                                              : t("pages.agent_workspace.earnings.network.panel.by_admin")}
                                    </span>
                                    <span className="agent-ea__history-deal">{entry.deal ?? "—"}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    <h2 className="agent-ea__cap">{t("pages.agent_workspace.earnings.network.panel.deals")}</h2>
                    {state.data.deals.length === 0 ? (
                        <p className="agent-ea__empty-line">{t("pages.agent_workspace.earnings.network.panel.deals_empty")}</p>
                    ) : (
                        <ul className="agent-ea__list">
                            {state.data.deals.map((deal) => (
                                <li key={deal.id} className="agent-ea__deal">
                                    <b>{deal.deal_name ?? t("pages.agent_workspace.earnings.table.unnamed")}</b>
                                    <span className="agent-ea__mono">{deal.deal_value === null ? "—" : money(deal.deal_value)}</span>
                                    <span className="agent-ea__mono">{money(deal.amount)}</span>
                                    <span className="agent-ea__muted">{t("pages.agent_workspace.earnings.network.panel.override", { month: monthLabel(deal.created_at, locale, year) })}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </>
            )}
        </aside>
    );
}
