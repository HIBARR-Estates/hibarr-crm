import { useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { FactRows, type FactRow } from "@/Components/Redesign/agent/flow/qualify/SidePanels";
import type { RailSectionGroup } from "../analysisRailItems";

interface AgentAnalysisFactsProps {
    deal: any;
    railGroups: RailSectionGroup[];
    /** Deal value, formatted; empty when the deal has none. */
    valueText: string;
    onJump: (sectionId: string) => void;
}

/**
 * "Lead context" beside the analysis (canvas L7-12): the deal's stage, what has
 * been captured so far in the company's own script sections (one row per
 * section), the attached packages and the deal value. Every row is a stored
 * value; a section nobody has answered yet shows "Not set".
 */
export default function AgentAnalysisFacts({ deal, railGroups, valueText, onJump }: AgentAnalysisFactsProps) {
    const { t } = useTranslation();
    const { td } = useTd();

    const rows = useMemo<FactRow[]>(() => {
        const list: FactRow[] = [
            { key: "stage", label: t("pages.agent_workspace.flow.fact_stage"), value: deal.lead_stage?.name ? String(td(deal.lead_stage.name, { source: "en" })) : null },
        ];
        for (const group of railGroups) {
            if (group.steps.length === 0) continue;
            const answers = group.steps.filter((step) => step.filled && step.value).map((step) => step.value);
            list.push({ key: `section-${group.sectionId}`, label: String(td(group.sectionTitle, { source: "en" })), value: answers.length ? answers.join(" · ") : null });
        }
        const packages = (deal.packages ?? []).map((item: { name: string }) => item.name).filter(Boolean);
        list.push({ key: "packages", label: t("pages.agent_workspace.flow.fact_packages"), value: packages.length ? packages.join(", ") : null });
        list.push({ key: "value", label: t("pages.agent_workspace.flow.fact_value"), value: valueText || null });
        return list;
    }, [deal, railGroups, valueText, t, td]);

    return <FactRows rows={rows} />;
}
