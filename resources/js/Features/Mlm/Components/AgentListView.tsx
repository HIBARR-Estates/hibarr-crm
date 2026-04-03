import React, { useCallback, useMemo, useState } from "react";
import { Tree, Input, Avatar, Tag, Empty, Spin } from "antd";
import { UserOutlined, SearchOutlined, TeamOutlined } from "@ant-design/icons";
import type { DataNode } from "antd/es/tree";
import type { AgentHierarchyNode } from "../types";
import LevelBadge from "./LevelBadge";
import type { MlmLevel } from "../types";

interface AgentListViewProps {
    data: AgentHierarchyNode | AgentHierarchyNode[];
    onNodeClick?: (node: AgentHierarchyNode) => void;
    loading?: boolean;
    height?: number;
}

/** Collect all node IDs for default-expanded state */
function collectKeys(
    nodes: AgentHierarchyNode[],
    depth: number,
    maxDepth: number,
): React.Key[] {
    if (depth >= maxDepth) return [];
    const keys: React.Key[] = [];
    for (const node of nodes) {
        keys.push(node.id);
        if (node.children?.length) {
            keys.push(...collectKeys(node.children, depth + 1, maxDepth));
        }
    }
    return keys;
}

/** Flatten a hierarchy into all node IDs (for expand-all) */
function collectAllKeys(nodes: AgentHierarchyNode[]): React.Key[] {
    const keys: React.Key[] = [];
    for (const node of nodes) {
        keys.push(node.id);
        if (node.children?.length) {
            keys.push(...collectAllKeys(node.children));
        }
    }
    return keys;
}

/** Check if a node or any descendant matches the search term */
function nodeMatches(node: AgentHierarchyNode, term: string): boolean {
    const lower = term.toLowerCase();
    if (node.name?.toLowerCase().includes(lower)) return true;
    if (node.email?.toLowerCase().includes(lower)) return true;
    if (node.level_name?.toLowerCase().includes(lower)) return true;
    if (node.children?.some((c) => nodeMatches(c, term))) return true;
    return false;
}

/** Collect keys for all nodes that match or have a matching descendant */
function collectMatchingKeys(
    nodes: AgentHierarchyNode[],
    term: string,
): React.Key[] {
    const keys: React.Key[] = [];
    for (const node of nodes) {
        if (nodeMatches(node, term)) {
            keys.push(node.id);
        }
        if (node.children?.length) {
            keys.push(...collectMatchingKeys(node.children, term));
        }
    }
    return keys;
}

/** Render a single node title */
function NodeTitle({
    node,
    searchTerm,
    onClick,
}: {
    node: AgentHierarchyNode;
    searchTerm: string;
    onClick?: (node: AgentHierarchyNode) => void;
}) {
    const levelObj: MlmLevel | null = node.level_rank
        ? ({
              id: 0,
              name: node.level_name ?? "N/A",
              rank: node.level_rank,
              commission_percentage: 0,
          } as any)
        : null;

    const highlightName = (name: string) => {
        if (!searchTerm) return name;
        const idx = name.toLowerCase().indexOf(searchTerm.toLowerCase());
        if (idx === -1) return name;
        return (
            <>
                {name.slice(0, idx)}
                <span className="bg-yellow-200 rounded px-0.5">
                    {name.slice(idx, idx + searchTerm.length)}
                </span>
                {name.slice(idx + searchTerm.length)}
            </>
        );
    };

    const borderClass = node.is_upline
        ? "border-amber-200 bg-amber-50"
        : node.is_self
          ? "border-indigo-200 bg-indigo-50"
          : "border-gray-100 bg-white hover:bg-gray-50";

    return (
        <div
            className={`flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-colors duration-150 ${borderClass}`}
            onClick={(e) => {
                e.stopPropagation();
                onClick?.(node);
            }}
        >
            <Avatar
                size={28}
                src={node.image_url}
                icon={<UserOutlined />}
                className="flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-800 truncate">
                    {highlightName(node.name)}
                    {node.is_upline && (
                        <span className="ml-1 text-xs font-normal text-amber-600">
                            (Upline)
                        </span>
                    )}
                    {node.is_self && (
                        <span className="ml-1 text-xs font-normal text-indigo-600">
                            (You)
                        </span>
                    )}
                </div>
                {node.email && (
                    <div className="text-xs text-gray-400 truncate">
                        {node.email}
                    </div>
                )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
                <LevelBadge level={levelObj} size="small" />
                {node.total_sales !== undefined && (
                    <span className="text-xs text-gray-500 whitespace-nowrap">
                        {node.total_sales} sales
                    </span>
                )}
                {(node.children?.length ?? 0) > 0 && (
                    <Tag
                        icon={<TeamOutlined />}
                        className="text-xs m-0"
                        color="default"
                    >
                        {node.children!.length}
                    </Tag>
                )}
            </div>
        </div>
    );
}

/** Convert hierarchy to Ant Tree DataNode format */
function toAntTreeData(
    nodes: AgentHierarchyNode[],
    searchTerm: string,
    onClick?: (node: AgentHierarchyNode) => void,
): DataNode[] {
    return nodes.map((node) => ({
        key: node.id,
        title: (
            <NodeTitle node={node} searchTerm={searchTerm} onClick={onClick} />
        ),
        children: node.children?.length
            ? toAntTreeData(node.children, searchTerm, onClick)
            : undefined,
    }));
}

export default function AgentListView({
    data,
    onNodeClick,
    loading = false,
    height = 600,
}: AgentListViewProps) {
    const [searchTerm, setSearchTerm] = useState("");

    const nodes: AgentHierarchyNode[] = useMemo(() => {
        if (Array.isArray(data)) return data;
        return [data];
    }, [data]);

    const defaultExpandedKeys = useMemo(
        () => collectKeys(nodes, 0, 2),
        [nodes],
    );

    const expandedKeys = useMemo(() => {
        if (!searchTerm) return undefined; // use default behaviour
        return collectMatchingKeys(nodes, searchTerm);
    }, [nodes, searchTerm]);

    const treeData = useMemo(
        () => toAntTreeData(nodes, searchTerm, onNodeClick),
        [nodes, searchTerm, onNodeClick],
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

    if (nodes.length === 0) {
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
            className="rounded-xl border border-gray-200 bg-white overflow-hidden flex flex-col h-full"
            style={{ width: "100%" }}
        >
            <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                <Input
                    prefix={<SearchOutlined className="text-gray-400" />}
                    placeholder="Search agents by name, email, or level..."
                    allowClear
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="max-w-md"
                />
            </div>
            <div className="flex-1 overflow-auto px-2 py-1">
                <Tree
                    treeData={treeData}
                    defaultExpandedKeys={defaultExpandedKeys}
                    {...(expandedKeys !== undefined ? { expandedKeys } : {})}
                    showLine={{ showLeafIcon: false }}
                    blockNode
                    selectable={false}
                    className="agent-list-tree"
                />
            </div>
        </div>
    );
}
