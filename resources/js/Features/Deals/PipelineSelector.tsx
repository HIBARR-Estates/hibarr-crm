import React from "react";
import { Dropdown, MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

interface Pipeline {
    id: number;
    name: string;
    default: number;
}

interface PipelineSelectorProps {
    pipelines: Pipeline[];
    currentPipelineId: number | "all";
    onSelect: (id: number | "all") => void;
    /** Offer "All pipelines" — only for lists whose backend accepts it. */
    allowAll?: boolean;
    /**
     * "heading" is the standalone page title (LeadBoards); "chip" sits inside
     * the deals toolbar card alongside Add/Import.
     */
    variant?: "heading" | "chip";
}

const ALL_PIPELINES = "All pipelines";

/** Pipeline context switcher. */
const PipelineSelector: React.FC<PipelineSelectorProps> = ({
    pipelines,
    currentPipelineId,
    onSelect,
    allowAll = false,
    variant = "heading",
}) => {
    const currentPipeline = pipelines.find((p) => p.id === currentPipelineId);

    const items: MenuProps["items"] = [
        ...(allowAll
            ? [
                  {
                      key: "all",
                      label: ALL_PIPELINES,
                      onClick: () => onSelect("all"),
                  },
              ]
            : []),
        ...pipelines.map((pipeline) => ({
            key: String(pipeline.id),
            label: pipeline.name,
            onClick: () => onSelect(pipeline.id),
        })),
    ];

    const label =
        currentPipelineId === "all"
            ? ALL_PIPELINES
            : currentPipeline?.name || "Select pipeline";

    if (variant === "heading") {
        return (
            <Dropdown menu={{ items }} trigger={["click"]}>
                <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors group">
                    <h1 className="text-xl font-semibold text-gray-900 m-0 group-hover:opacity-80">
                        {label}
                    </h1>
                    <DownOutlined className="text-gray-500 text-sm group-hover:opacity-80" />
                </div>
            </Dropdown>
        );
    }

    return (
        <Dropdown menu={{ items }} trigger={["click"]}>
            <button
                type="button"
                className="dr-btn"
                style={{
                    background: T.NAVY_SOFT,
                    color: T.NAVY,
                    border: `1px solid ${T.NAVY_MID}`,
                }}
            >
                <span
                    className="text-[11px] font-semibold uppercase tracking-wide"
                    style={{ color: T.TEXT_MUTED }}
                >
                    Pipeline
                </span>
                <span className="text-[13px] font-semibold">{label}</span>
                <DownOutlined style={{ fontSize: 10, opacity: 0.6 }} />
            </button>
        </Dropdown>
    );
};

export default PipelineSelector;
