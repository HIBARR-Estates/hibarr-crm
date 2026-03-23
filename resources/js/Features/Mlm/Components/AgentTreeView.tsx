import React, { useCallback, useMemo } from "react";
import Tree from "react-d3-tree";
import { Avatar, Typography, Spin, Empty } from "antd";
import { UserOutlined } from "@ant-design/icons";
import type { AgentHierarchyNode } from "../types";
import LevelBadge from "./LevelBadge";
import type { MlmLevel } from "../types";

const { Text } = Typography;

interface AgentTreeViewProps {
    data: AgentHierarchyNode | AgentHierarchyNode[];
    onNodeClick?: (node: AgentHierarchyNode) => void;
    loading?: boolean;
    orientation?: "vertical" | "horizontal";
    height?: number;
}

/** Convert our data shape to react-d3-tree's expected format */
function toTreeData(node: AgentHierarchyNode): any {
    return {
        name: node.name,
        attributes: {
            level: node.level_name ?? "No Level",
            sales: node.total_sales ?? 0,
        },
        __raw: node,
        children: node.children?.map(toTreeData) ?? [],
    };
}

/** Custom node renderer */
const renderCustomNode = ({
    nodeDatum,
    onNodeClick,
}: {
    nodeDatum: any;
    onNodeClick?: (node: AgentHierarchyNode) => void;
}) => {
    const raw: AgentHierarchyNode = nodeDatum.__raw;
    const levelObj: MlmLevel | null = raw.level_rank
        ? ({
              id: 0,
              name: raw.level_name ?? "N/A",
              rank: raw.level_rank,
              commission_percentage: 0,
          } as any)
        : null;

    const borderClass = raw.is_upline
        ? "border-amber-300 bg-amber-50"
        : raw.is_self
          ? "border-indigo-300 bg-indigo-50"
          : "border-gray-100 bg-white";

    return (
        <g>
            <foreignObject
                width={200}
                height={110}
                x={-100}
                y={-55}
                style={{ overflow: "visible" }}
            >
                <div
                    className={`rounded-xl shadow-md border p-3 cursor-pointer hover:shadow-lg transition-shadow duration-200 text-center ${borderClass}`}
                    onClick={() => onNodeClick?.(raw)}
                    style={{ width: 200 }}
                >
                    <div className="flex items-center gap-2 mb-1.5">
                        <Avatar
                            size={32}
                            src={raw.image_url}
                            icon={<UserOutlined />}
                            className="flex-shrink-0"
                        />
                        <div className="flex-1 text-left min-w-0">
                            <div className="text-sm font-semibold text-gray-800 truncate">
                                {raw.name}
                                {raw.is_upline && (
                                    <span className="ml-1 text-xs font-normal text-amber-600">
                                        (Upline)
                                    </span>
                                )}
                                {raw.is_self && (
                                    <span className="ml-1 text-xs font-normal text-indigo-600">
                                        (You)
                                    </span>
                                )}
                            </div>
                            {raw.email && (
                                <div className="text-xs text-gray-400 truncate">
                                    {raw.email}
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-between">
                        <LevelBadge level={levelObj} size="small" />
                        {raw.total_sales !== undefined && (
                            <span className="text-xs text-gray-500">
                                {raw.total_sales} sales
                            </span>
                        )}
                    </div>
                </div>
            </foreignObject>
        </g>
    );
};

export default function AgentTreeView({
    data,
    onNodeClick,
    loading = false,
    orientation = "vertical",
    height = 600,
}: AgentTreeViewProps) {
    const treeData = useMemo(() => {
        if (Array.isArray(data)) {
            if (data.length === 0) return null;
            if (data.length === 1) return toTreeData(data[0]);
            // Wrap multiple roots in a virtual root
            return {
                name: "Organization",
                attributes: {},
                __raw: {
                    id: 0,
                    name: "Organization",
                    children: data,
                } as AgentHierarchyNode,
                children: data.map(toTreeData),
            };
        }
        return toTreeData(data);
    }, [data]);

    const renderNode = useCallback(
        (rd3tProps: any) => renderCustomNode({ ...rd3tProps, onNodeClick }),
        [onNodeClick],
    );

    if (loading) {
        return (
            <div
                className="flex items-center justify-center"
                style={{ height }}
            >
                <Spin size="large" />
            </div>
        );
    }

    if (!treeData) {
        return (
            <div
                className="flex items-center justify-center"
                style={{ height }}
            >
                <Empty description="No hierarchy data available" />
            </div>
        );
    }

    return (
        <div
            className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden"
            style={{ width: "100%", height }}
        >
            <Tree
                data={treeData}
                orientation={orientation}
                pathFunc="step"
                translate={{ x: 400, y: 60 }}
                separation={{ siblings: 1.5, nonSiblings: 2 }}
                nodeSize={{ x: 240, y: 140 }}
                renderCustomNodeElement={renderNode}
                zoom={0.8}
                enableLegacyTransitions
                transitionDuration={300}
            />
        </div>
    );
}
