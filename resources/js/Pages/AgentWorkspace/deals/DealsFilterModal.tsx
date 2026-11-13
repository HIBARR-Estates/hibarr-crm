import { useEffect, useMemo } from "react";
import createDealFilterConfig from "@/configs/dealFilterConfig";
import { useFilter } from "@/contexts/FilterContext";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import Button from "@/Components/Redesign/primitives/Button";
import useTranslation from "@/Hooks/useTranslation";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";

const FORM_DATA_TYPES = ["categories", "sources", "packages", "lead-agents", "lead-pipelines", "lead-stages"] as FormDataType[];

interface DealsFilterModalProps {
    pipelines: Array<{ id: number; name: string }>;
    pipelineId: number;
    total: number;
    /** Changes whenever the applied filters do, so the modal re-reads the URL. */
    appliedKey: string;
}

/**
 * The Deals index's own filter modal, pointed at this page: same fields and
 * query-string contract, applying is a visit of /agent/deals. Loaded the
 * first time Filters is pressed, so the page never pays for it up front.
 */
export default function DealsFilterModal({ pipelines, pipelineId, total, appliedKey }: DealsFilterModalProps) {
    const { t } = useTranslation();
    const { data: formData, loading, error, refetch } = useFormDataBatch(FORM_DATA_TYPES);
    const { openDrawer } = useFilter();

    const filterConfig = useMemo(() => {
        const pick = (type: string, fallback: unknown[] = []) => {
            const value = (formData as Record<string, unknown>)[type];
            return Array.isArray(value) && value.length > 0 ? value : fallback;
        };

        return {
            ...createDealFilterConfig({
                categories: pick("categories"),
                sources: pick("sources"),
                packages: pick("packages"),
                leadAgents: pick("lead-agents"),
                leadPipelines: pick("lead-pipelines", pipelines),
                stages: pick("lead-stages"),
                activePipelineId: pipelineId,
                // Outcome is not a choice here (the page is the open deals) and the search sits on the page.
                excludeFields: ["search", "outcome_status"],
                isKanbanView: false,
            }),
            routeName: "agent.deals",
            // The Deals index asks for its own props; this page takes the whole page back.
            only: undefined,
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData, pipelines, pipelineId, appliedKey]);

    usePageSearchAndFilter({ filterConfig });

    // Pressing Filters is what mounts this, so it opens as soon as it exists.
    useEffect(() => {
        // After the config effect above has read the URL into the draft.
        const handle = window.setTimeout(openDrawer, 0);
        return () => window.clearTimeout(handle);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <>
            {error && !loading ? (
                <div role="alert" className="agent-dp__filters-error">
                    <span>{t("pages.agent_workspace.deals.filters_error")}</span>
                    <Button size="sm" variant="ghost" onClick={() => void refetch()}>
                        {t("pages.agent_workspace.deals.filters_retry")}
                    </Button>
                </div>
            ) : null}
            <EntityFilterModal config={filterConfig} optionsLoading={loading} entityLabel="deals" currentCount={total} savedViews={false} />
        </>
    );
}
