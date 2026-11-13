import type { ReactNode } from "react";
import { Head } from "@inertiajs/react";
import { AgentSecondRow, AgentWorkspaceLayout } from "@/Components/Redesign/agent";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import EarningsHeader from "./earnings/EarningsHeader";
import EarningsPills from "./earnings/EarningsPills";
import LedgerView from "./earnings/LedgerView";
import NetworkView from "./earnings/NetworkView";
import OverviewView from "./earnings/OverviewView";
import { longMonth } from "./earnings/format";
import type { CommissionLine, EarningsSummary, EarningsView, LedgerPayload, LevelCard, NetworkPayload } from "./earnings/types";
import "./earnings/earnings.css";

interface EarningsProps {
    pageTitle: string;
    view: EarningsView;
    isAgent: boolean;
    currencySymbol: string;
    month?: string;
    summary?: EarningsSummary | null;
    latest?: CommissionLine[];
    level?: LevelCard | null;
    year?: number;
    ledger?: LedgerPayload;
    selfId?: number | null;
    network?: NetworkPayload;
}

/**
 * Earnings: Overview, Ledger and Network (approved layouts L7-21, L7-22 and
 * L7-37) on one page component, so switching between them keeps the shell.
 * Everything is the Affiliate module's own data: commissions, disputes,
 * levels, cycles and the agent hierarchy.
 */
export default function Earnings({ pageTitle, view, isAgent, currencySymbol, month, summary, latest, level, year, ledger, selfId = null, network }: EarningsProps) {
    const { t, locale } = useTranslation();

    return (
        <>
            <Head title={pageTitle} />
            <AgentSecondRow>
                <EarningsPills view={view} />
            </AgentSecondRow>

            <div className={`agent-ea agent-ea--${view}`}>
                {!isAgent ? (
                    <>
                        <EarningsHeader title={t("pages.agent_workspace.earnings.title")} subtitle="" />
                        <EmptyState icon="wallet" title={t("pages.agent_workspace.earnings.not_agent_title")} description={t("pages.agent_workspace.earnings.not_agent_description")} />
                    </>
                ) : view === "overview" ? (
                    <>
                        <EarningsHeader title={t("pages.agent_workspace.earnings.title")} subtitle={t("pages.agent_workspace.earnings.subtitle_overview", { month: month ? longMonth(month, locale) : "" })} />
                        <OverviewView currencySymbol={currencySymbol} summary={summary} latest={latest} level={level} />
                    </>
                ) : view === "ledger" ? (
                    <LedgerView year={year ?? new Date().getFullYear()} currencySymbol={currencySymbol} ledger={ledger} />
                ) : (
                    <NetworkView selfId={selfId} currencySymbol={currencySymbol} network={network} />
                )}
            </div>
        </>
    );
}

Earnings.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
