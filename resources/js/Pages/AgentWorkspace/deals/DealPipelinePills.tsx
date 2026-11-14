import { Dropdown, type MenuProps } from "antd";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";

interface DealPipelinePillsProps {
    /** `visible` is the pipeline's nav-visibility setting; absent means shown. */
    pipelines: Array<{ id: number; name: string; visible?: boolean }>;
    pipelineId: number;
    onPipeline: (id: number) => void;
    /** Filters applied besides the pipeline, shown on the Filters pill. */
    filterCount: number;
    onFilters: () => void;
}

/**
 * The second row under the dock: the pipelines the CRM's nav-visibility
 * setting shows (the current one is the white pill), the rest under "More",
 * and Filters. Changing the pipeline reloads the page's deals; it never
 * leaves the page.
 */
export default function DealPipelinePills({ pipelines, pipelineId, onPipeline, filterCount, onFilters }: DealPipelinePillsProps) {
    const { t } = useTranslation();
    const shown = pipelines.filter((pipeline) => pipeline.visible !== false);
    const more = pipelines.filter((pipeline) => pipeline.visible === false);
    const inMore = more.some((pipeline) => pipeline.id === pipelineId);

    const items: MenuProps["items"] = more.map((pipeline) => ({
        key: String(pipeline.id),
        label: pipeline.name,
        icon: pipeline.id === pipelineId ? <Icon name="check" size={14} /> : undefined,
        onClick: () => onPipeline(pipeline.id),
    }));

    return (
        <nav className="agent-pills" aria-label={t("pages.agent_workspace.deals.pipelines")}>
            {shown.map((pipeline) => (
                <button key={pipeline.id} type="button" className="agent-pills__pill" aria-pressed={pipeline.id === pipelineId} onClick={() => onPipeline(pipeline.id)}>
                    {pipeline.name}
                </button>
            ))}
            {more.length > 0 ? (
                <Dropdown menu={{ items, selectedKeys: inMore ? [String(pipelineId)] : [] }} trigger={["click"]} placement="bottomLeft">
                    <button type="button" className="agent-pills__pill" aria-pressed={inMore} aria-haspopup="menu">
                        {t("pages.agent_workspace.deals.more_pipelines")}
                        <Icon name="chevron-down" size={12} />
                    </button>
                </Dropdown>
            ) : null}
            <button type="button" className="agent-pills__pill" aria-pressed={filterCount > 0} onClick={onFilters}>
                {filterCount > 0 ? t("pages.agent_workspace.deals.filters_count", { count: filterCount }) : t("pages.agent_workspace.deals.filters")}
            </button>
        </nav>
    );
}
