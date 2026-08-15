import { FilterConfig, type FilterFieldConfig } from "@/contexts/FilterContext";

interface DealFilterProps {
    leadPipelines?: any[];
    stages?: any[];
    categories?: any[];
    sources?: any[];
    packages?: any[];
    leadAgents?: any[];
    /** Pipeline currently shown by the page selector; "all" unpins it. */
    activePipelineId?: number | "all";
    excludeFields?: string[];
    [key: string]: any;
}

/**
 * Schema for the Deals filter modal. Same contract as the Leads one
 * (see leadFilterConfig): `type` drives URL/draft state in FilterContext,
 * `control` picks the visual treatment in EntityFilterModal.
 */
export const createDealFilterConfig = (
    props: DealFilterProps,
): FilterConfig => {
    const allPipelines = props.activePipelineId === "all";

    // Stages are pipeline-specific, so only offer the ones belonging to the
    // pipeline being viewed. Viewing "all", every stage is fair game.
    const stageOptions = (props.stages ?? [])
        .filter(
            (stage: any) =>
                allPipelines ||
                Number(stage.lead_pipeline_id) ===
                    Number(props.activePipelineId),
        )
        .map((stage: any) => ({ value: stage.id, label: stage.name }));

    const fields: FilterFieldConfig[] = [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search deals by contact name, company, deal name...",
            span: 24,
        },

        // ── General ──────────────────────────────────────────────
        {
            key: "pipeline_stage_id",
            label: "Stage",
            type: "multiselect",
            control: "pills",
            sentence: "stage",
            section: "General",
            options: stageOptions,
        },
        {
            key: "outcome_status",
            label: "Outcome",
            type: "multiselect",
            control: "pills",
            sentence: "outcome",
            section: "General",
            options: [
                { value: "open", label: "Open" },
                { value: "won", label: "Won" },
                { value: "lost", label: "Lost" },
            ],
        },
        {
            key: "is_locked",
            label: "Locked",
            type: "select",
            control: "segmented",
            sentence: "locked",
            section: "General",
            options: [
                { value: "1", label: "Locked" },
                { value: "0", label: "Unlocked" },
            ],
        },
        {
            key: "start_date",
            label: "Created",
            type: "date",
            control: "datePresets",
            rangeKeys: ["start_date", "end_date"],
            sentence: "created",
            section: "General",
        },
        { key: "end_date", label: "Created to", type: "date", hidden: true },
        {
            key: "close_start",
            label: "Closed",
            type: "date",
            control: "datePresets",
            rangeKeys: ["close_start", "close_end"],
            sentence: "closed",
            section: "General",
        },
        { key: "close_end", label: "Closed to", type: "date", hidden: true },
        {
            key: "value_range",
            label: "Deal value",
            type: "numberrange",
            control: "scoreRange",
            sentence: "deal value",
            section: "General",
        },

        // ── Pipeline ─────────────────────────────────────────────
        // Only meaningful when the page is not pinned to a single pipeline —
        // otherwise the pipeline selector already answers this question.
        ...(allPipelines
            ? [
                  {
                      key: "lead_pipeline_id",
                      label: "Pipeline",
                      type: "multiselect" as const,
                      control: "pills" as const,
                      sentence: "pipeline",
                      section: "Pipeline",
                      options:
                          props.leadPipelines?.map((pipeline: any) => ({
                              value: pipeline.id,
                              label: pipeline.name,
                          })) || [],
                  },
              ]
            : []),

        // ── Assignment & source ──────────────────────────────────
        {
            key: "agent_id",
            label: "Agent",
            type: "multiselect",
            control: "checklist",
            sentence: "agent",
            section: "Assignment & Source",
            placeholder: "Search agents…",
            options:
                props.leadAgents?.map((agent: any) => ({
                    value: agent.user?.id || agent.user_id,
                    label: agent.user?.name || agent.name,
                })) || [],
        },
        {
            key: "category_id",
            label: "Categories",
            type: "multiselect",
            control: "pills",
            sentence: "category",
            section: "Assignment & Source",
            options:
                props.categories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "source_id",
            label: "Source",
            type: "multiselect",
            control: "pills",
            sentence: "source",
            section: "Assignment & Source",
            options:
                props.sources?.map((source: any) => ({
                    value: source.id,
                    label: source.type,
                })) || [],
        },
        {
            key: "package_id",
            label: "Packages",
            type: "multiselect",
            control: "checklist",
            sentence: "package",
            section: "Assignment & Source",
            placeholder: "Search packages…",
            options:
                props.packages?.map((pkg: any) => ({
                    value: pkg.id,
                    label: pkg.name,
                })) || [],
        },
    ];

    return {
        routeName: "deals.index",
        title: "Deal Filters",
        fields,
        excludeFields: props.excludeFields,
        defaultValues: {},
    };
};

export default createDealFilterConfig;
