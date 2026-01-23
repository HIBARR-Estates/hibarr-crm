import { FilterConfig } from "@/contexts/FilterContext";

interface DealFilterProps {
    leadPipelines?: any[];
    stages?: any[];
    categories?: any[];
    sources?: any[];
    packages?: any[];
    leadAgents?: any[];
    nonActiveLeadAgents?: any[];
    excludeFields?: string[];
    [key: string]: any;
}

export const createDealFilterConfig = (
    props: DealFilterProps,
): FilterConfig => {
    const fields = [
        {
            key: "search",
            label: "Search",
            type: "text" as const,
            placeholder: "Search deals by contact name, company, deal name...",
            span: 24,
        },
        {
            key: "lead_pipeline_id",
            label: "Pipeline",
            type: "select" as const,
            placeholder: "Select pipeline",
            span: 12,
            options:
                props.leadPipelines?.map((pipeline: any) => ({
                    value: pipeline.id,
                    label: pipeline.name,
                })) || [],
        },
        {
            key: "pipeline_stage_id",
            label: "Stage",
            type: "select" as const,
            placeholder: "Select stage",
            span: 12,
            dependsOn: "lead_pipeline_id",
            filterOptions: (pipelineId: number) => {
                return (
                    props.stages
                        ?.filter(
                            (stage: any) =>
                                stage.lead_pipeline_id === pipelineId,
                        )
                        .map((stage: any) => ({
                            value: stage.id,
                            label: stage.name,
                        })) || []
                );
            },
        },
        {
            key: "category_id",
            label: "Category",
            type: "select" as const,
            placeholder: "Select category",
            span: 12,
            options:
                props.categories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "source_id",
            label: "Lead Source",
            type: "select" as const,
            placeholder: "Select lead source",
            span: 12,
            options:
                props.sources?.map((source: any) => ({
                    value: source.id,
                    label: source.type,
                })) || [],
        },
        {
            key: "agent_id",
            label: "Assigned Agent",
            type: "select" as const,
            placeholder: "Select agent",
            span: 12,
            options:
                props.leadAgents?.map((agent: any) => ({
                    value: agent.user?.id || agent.user_id,
                    label: agent.user?.name || agent.name,
                })) || [],
        },
        {
            key: "package_id",
            label: "Package",
            type: "select" as const,
            placeholder: "Select package",
            span: 12,
            options:
                props.packages?.map((pkg: any) => ({
                    value: pkg.id,
                    label: pkg.name,
                })) || [],
        },
        {
            key: "start_date",
            label: "Created Date Range",
            type: "daterange" as const,
            span: 24,
            formatDisplayValue: (value: any, options?: any) => {
                // This will be handled by the daterange type automatically
                return value;
            },
        },
        {
            key: "value_range",
            label: "Deal Value",
            type: "numberrange" as const,
            span: 24,
            formatDisplayValue: (value: any) => {
                return `$${value.toLocaleString()}`;
            },
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
