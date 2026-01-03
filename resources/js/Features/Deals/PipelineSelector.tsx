import React from "react";
import { Dropdown, MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";

interface Pipeline {
    id: number;
    name: string;
    default: number;
}

interface PipelineSelectorProps {
    pipelines: Pipeline[];
    currentPipelineId: number;
    onSelect: (id: number) => void;
}

const PipelineSelector: React.FC<PipelineSelectorProps> = ({
    pipelines,
    currentPipelineId,
    onSelect,
}) => {
    const currentPipeline = pipelines.find((p) => p.id === currentPipelineId);

    const items: MenuProps["items"] = pipelines.map((pipeline) => ({
        key: String(pipeline.id),
        label: pipeline.name,
        onClick: () => onSelect(pipeline.id),
    }));

    return (
        <Dropdown menu={{ items }} trigger={["click"]}>
            <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-100 p-2 rounded transition-colors group">
                <h1 className="text-xl font-semibold text-gray-900 m-0 group-hover:opacity-80">
                    {currentPipeline?.name || "Select Pipeline"}
                </h1>
                <DownOutlined className="text-gray-500 text-sm group-hover:opacity-80" />
            </div>
        </Dropdown>
    );
};

export default PipelineSelector;
