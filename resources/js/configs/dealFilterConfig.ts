import { FilterConfig } from "@/contexts/FilterContext";

export const createDealFilterConfig = (props: any): FilterConfig => ({
    routeName: "deals.index",
    title: "Deal Filters",
    fields: [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search deals by contact name, company, deal name...",
            section: "Search & General",
            span: 24,
        },
        {
            key: "lead_pipeline_id",
            label: "Pipeline",
            type: "select",
            placeholder: "Select pipeline",
            section: "Pipeline & Stage",
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
            type: "select",
            placeholder: "Select stage",
            section: "Pipeline & Stage",
            span: 12,
            dependsOn: "lead_pipeline_id",
            filterOptions: (pipelineId: number) => {
                return (
                    props.stages
                        ?.filter(
                            (stage: any) =>
                                stage.lead_pipeline_id === pipelineId
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
            type: "select",
            placeholder: "Select category",
            section: "Categorization",
            span: 24,
            options:
                props.categories?.map((category: any) => ({
                    value: category.id,
                    label: category.category_name,
                })) || [],
        },
        {
            key: "start_date",
            label: "Created Date Range",
            type: "daterange",
            section: "Date Range",
            span: 24,
            formatDisplayValue: (value: any, options?: any) => {
                // This will be handled by the daterange type automatically
                return value;
            },
        },
        {
            key: "agent_id",
            label: "Assigned Agent",
            type: "select",
            placeholder: "Select agent",
            section: "Assignment",
            span: 24,
            options:
                props.leadAgents?.map((agent: any) => ({
                    value: agent.id,
                    label: agent.user?.name || agent.name,
                })) || [],
        },
        {
            key: "value_range",
            label: "Deal Value",
            type: "numberrange",
            section: "Financial",
            span: 24,
            formatDisplayValue: (value: any) => {
                return `$${value.toLocaleString()}`;
            },
        },
    ],
    defaultValues: {},
});

export default createDealFilterConfig;
