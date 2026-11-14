import { AgentLinkPills, type AgentLinkPill } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { EarningsView } from "./types";

const VIEWS: Array<{ key: EarningsView; href: string }> = [
    { key: "overview", href: "/agent/earnings" },
    { key: "ledger", href: "/agent/earnings/ledger" },
    { key: "network", href: "/agent/earnings/network" },
    { key: "report", href: "/agent/earnings/report" },
];

/** The second row: Overview, Ledger, Network and My report, each its own page. */
export default function EarningsPills({ view }: { view: EarningsView }) {
    const { t } = useTranslation();
    const pills: AgentLinkPill[] = VIEWS.map(({ key, href }) => ({
        key,
        href,
        label: t(`pages.agent_workspace.earnings.pills.${key}`),
        current: key === view,
    }));

    return <AgentLinkPills pills={pills} ariaLabel={t("pages.agent_workspace.earnings.pills.label")} />;
}
