import useTranslation from "@/Hooks/useTranslation";

interface DealPipelinePillsProps {
    pipelines: Array<{ id: number; name: string }>;
    pipelineId: number;
    onPipeline: (id: number) => void;
    /** Filters applied besides the pipeline, shown on the Filters pill. */
    filterCount: number;
    onFilters: () => void;
}

/**
 * The second row under the dock: the CRM's pipelines (the current one is the
 * white pill) and Filters. Changing the pipeline reloads the page's deals;
 * it never leaves the page.
 */
export default function DealPipelinePills({ pipelines, pipelineId, onPipeline, filterCount, onFilters }: DealPipelinePillsProps) {
    const { t } = useTranslation();

    return (
        <nav className="agent-pills" aria-label={t("pages.agent_workspace.deals.pipelines")}>
            {pipelines.map((pipeline) => (
                <button key={pipeline.id} type="button" className="agent-pills__pill" aria-pressed={pipeline.id === pipelineId} onClick={() => onPipeline(pipeline.id)}>
                    {pipeline.name}
                </button>
            ))}
            <button type="button" className="agent-pills__pill" aria-pressed={filterCount > 0} onClick={onFilters}>
                {filterCount > 0 ? t("pages.agent_workspace.deals.filters_count", { count: filterCount }) : t("pages.agent_workspace.deals.filters")}
            </button>
        </nav>
    );
}
