import React, { useCallback, useMemo, useRef, useState } from "react";
import Tree from "react-d3-tree";
import { Avatar, Typography, Spin, Empty } from "antd";
import {
    UserOutlined,
    TeamOutlined,
    MinusCircleOutlined,
} from "@ant-design/icons";
import type { AgentHierarchyNode } from "../types";
import LevelBadge from "./LevelBadge";
import type { MlmLevel } from "../types";

const { Text } = Typography;

const INITIAL_VISIBLE = 4;
const PAGE_SIZE = 8;

interface ShowMoreRaw {
    id: number;
    name: string;
    _isShowMore: true;
    _parentId: number;
    _hiddenCount: number;
}

interface CollapseRaw {
    id: number;
    name: string;
    _isCollapse: true;
    _parentId: number;
}

interface AgentTreeViewProps {
    data: AgentHierarchyNode | AgentHierarchyNode[];
    onNodeClick?: (node: AgentHierarchyNode) => void;
    loading?: boolean;
    orientation?: "vertical" | "horizontal";
    height?: number;
}

/** Convert our data shape to react-d3-tree's expected format */
function toTreeData(
    node: AgentHierarchyNode,
    visibleCounts: Map<number, number>,
): any {
    const children = node.children ?? [];
    const visibleCount = visibleCounts.get(node.id) ?? INITIAL_VISIBLE;

    let mappedChildren: any[];

    if (children.length <= visibleCount) {
        // All children fit — render them all
        mappedChildren = children.map((c) => toTreeData(c, visibleCounts));
    } else {
        // Show only the first `visibleCount` + a "show more" pill
        const visible = children
            .slice(0, visibleCount)
            .map((c) => toTreeData(c, visibleCounts));
        const hiddenCount = children.length - visibleCount;
        visible.push({
            name: `+${hiddenCount} more`,
            attributes: {},
            __raw: {
                id: -(node.id * 1000 + 1),
                name: `+${hiddenCount} more`,
                _isShowMore: true,
                _parentId: node.id,
                _hiddenCount: hiddenCount,
            } as ShowMoreRaw,
            children: [],
        });
        mappedChildren = visible;
    }

    // If user has expanded beyond the initial count, allow collapsing back
    if (visibleCount > INITIAL_VISIBLE && children.length > INITIAL_VISIBLE) {
        mappedChildren.push({
            name: "Show less",
            attributes: {},
            __raw: {
                id: -(node.id * 1000 + 2),
                name: "Show less",
                _isCollapse: true,
                _parentId: node.id,
            } as CollapseRaw,
            children: [],
        });
    }

    return {
        name: node.name,
        attributes: {
            level: node.level_name ?? "No Level",
            sales: node.total_sales ?? 0,
        },
        __raw: node,
        children: mappedChildren,
    };
}

/** Custom node renderer */
const renderCustomNode = ({
    nodeDatum,
    onNodeClick,
    onToggleExpand,
}: {
    nodeDatum: any;
    onNodeClick?: (node: AgentHierarchyNode) => void;
    onToggleExpand?: (parentId: number, expand: boolean) => void;
}) => {
    const raw: any = nodeDatum.__raw;

    // Render "+N more" pill
    if (raw._isShowMore) {
        return (
            <g>
                <foreignObject
                    width={160}
                    height={56}
                    x={-80}
                    y={-28}
                    style={{ overflow: "visible" }}
                >
                    <div
                        className="rounded-full bg-indigo-50 border-2 border-dashed border-indigo-300 text-indigo-700 text-sm font-medium px-4 py-2.5 cursor-pointer hover:bg-indigo-100 hover:border-indigo-400 transition-all duration-200 text-center flex items-center justify-center gap-1.5"
                        onClick={() => onToggleExpand?.(raw._parentId, true)}
                    >
                        <TeamOutlined />
                        {raw.name}
                    </div>
                </foreignObject>
            </g>
        );
    }

    // Render "Show less" pill
    if (raw._isCollapse) {
        return (
            <g>
                <foreignObject
                    width={140}
                    height={48}
                    x={-70}
                    y={-24}
                    style={{ overflow: "visible" }}
                >
                    <div
                        className="rounded-full bg-gray-50 border border-gray-300 text-gray-500 text-xs font-medium px-3 py-2 cursor-pointer hover:bg-gray-100 hover:border-gray-400 transition-all duration-200 text-center flex items-center justify-center gap-1"
                        onClick={() => onToggleExpand?.(raw._parentId, false)}
                    >
                        <MinusCircleOutlined />
                        Show less
                    </div>
                </foreignObject>
            </g>
        );
    }

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
    const [visibleCounts, setVisibleCounts] = useState<Map<number, number>>(
        new Map(),
    );
    const containerRef = useRef<HTMLDivElement>(null);

    const handleToggleExpand = useCallback(
        (parentId: number, expand: boolean) => {
            setVisibleCounts((prev) => {
                const next = new Map(prev);
                if (expand) {
                    const current = prev.get(parentId) ?? INITIAL_VISIBLE;
                    next.set(parentId, current + PAGE_SIZE);
                } else {
                    next.delete(parentId);
                }
                return next;
            });
        },
        [],
    );

    const treeData = useMemo(() => {
        if (Array.isArray(data)) {
            if (data.length === 0) return null;
            if (data.length === 1) return toTreeData(data[0], visibleCounts);
            // Wrap multiple roots in a virtual root
            return {
                name: "Organization",
                attributes: {},
                __raw: {
                    id: 0,
                    name: "Organization",
                    children: data,
                } as AgentHierarchyNode,
                children: data.map((d) => toTreeData(d, visibleCounts)),
            };
        }
        return toTreeData(data, visibleCounts);
    }, [data, visibleCounts]);

    const renderNode = useCallback(
        (rd3tProps: any) =>
            renderCustomNode({
                ...rd3tProps,
                onNodeClick,
                onToggleExpand: handleToggleExpand,
            }),
        [onNodeClick, handleToggleExpand],
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

    const containerWidth = containerRef.current?.clientWidth ?? 800;

    return (
        <div
            ref={containerRef}
            className="rounded-xl border border-gray-200 bg-gray-50 overflow-hidden"
            style={{ width: "100%" }}
        >
            <Tree
                data={treeData}
                orientation={orientation}
                pathFunc="step"
                translate={{ x: containerWidth / 2, y: 60 }}
                separation={{ siblings: 1.2, nonSiblings: 1.5 }}
                nodeSize={{ x: 220, y: 140 }}
                scaleExtent={{ min: 0.1, max: 2 }}
                renderCustomNodeElement={renderNode}
                zoom={0.6}
                zoomable
                draggable
                enableLegacyTransitions
                transitionDuration={300}
            />
        </div>
    );
}
