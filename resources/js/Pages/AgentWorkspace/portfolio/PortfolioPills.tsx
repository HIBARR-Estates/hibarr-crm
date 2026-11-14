import { AgentLinkPills, type AgentLinkPill } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import type { PortfolioView } from "./types";

const VIEWS: Array<{ key: PortfolioView; href: string }> = [
    { key: "deals", href: "/agent/portfolio" },
    { key: "browse", href: "/agent/portfolio/browse" },
    { key: "projects", href: "/agent/portfolio/projects" },
];

/** The second row: For my deals, Browse, Projects. Each is its own page, so they are links. */
export default function PortfolioPills({ view }: { view: PortfolioView }) {
    const { t } = useTranslation();
    const pills: AgentLinkPill[] = VIEWS.map(({ key, href }) => ({
        key,
        href,
        label: t(`pages.agent_workspace.portfolio.pills.${key}`),
        current: key === view,
    }));

    return <AgentLinkPills pills={pills} ariaLabel={t("pages.agent_workspace.portfolio.pills.label")} />;
}
