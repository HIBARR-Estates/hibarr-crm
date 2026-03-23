import React, { useState } from "react";
import {
    Card,
    Drawer,
    Descriptions,
    Tag,
    Empty,
    Spin,
    Button,
    Space,
} from "antd";
import { motion } from "framer-motion";
import { GitBranch, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useMyNetwork } from "@/Features/Mlm/api";
import { AgentTreeView } from "@/Features/Mlm/Components";
import type { AgentHierarchyNode } from "@/Features/Mlm/types";

interface Props extends PageProps {
    network: AgentHierarchyNode | null;
}

const MyNetwork: React.FC<Props> = ({ network: initialNetwork }) => {
    const { data, isLoading, refetch } = useMyNetwork();
    const network: AgentHierarchyNode | null =
        (data as any)?.data ?? initialNetwork;

    const [selectedNode, setSelectedNode] = useState<AgentHierarchyNode | null>(
        null,
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fullscreen, setFullscreen] = useState(false);

    const handleNodeClick = (node: AgentHierarchyNode) => {
        setSelectedNode(node);
        setDrawerOpen(true);
    };

    /** Find the "self" node in the tree (may be root or child of upline). */
    const findSelf = (
        node: AgentHierarchyNode | null,
    ): AgentHierarchyNode | null => {
        if (!node) return null;
        if (node.is_self) return node;
        for (const c of node.children ?? []) {
            const found = findSelf(c);
            if (found) return found;
        }
        return null;
    };

    /** Count only downline nodes (excludes upline and self). */
    const countDownlines = (node: AgentHierarchyNode | null): number => {
        if (!node) return 0;
        if (node.is_upline || node.is_self) {
            return (
                node.children?.reduce((sum, c) => sum + countDownlines(c), 0) ??
                0
            );
        }
        return (
            1 +
            (node.children?.reduce((sum, c) => sum + countDownlines(c), 0) ?? 0)
        );
    };

    const selfNode = findSelf(network);
    const totalNodes = countDownlines(network);

    return (
        <DashboardLayout>
            <PageLayout
                title="My Network"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/agent/dashboard" },
                    { name: "My Network" },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Summary */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3 }}
                        className="mb-4"
                    >
                        <Card size="small" className="shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <GitBranch
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    <span className="text-sm text-gray-600">
                                        Total Downlines:{" "}
                                        <strong>{totalNodes}</strong>
                                    </span>
                                    {selfNode && (
                                        <span className="text-sm text-gray-600">
                                            Direct:{" "}
                                            <strong>
                                                {selfNode.children?.length ?? 0}
                                            </strong>
                                        </span>
                                    )}
                                </div>
                                <Space>
                                    <Button
                                        icon={
                                            fullscreen ? (
                                                <Minimize2 size={14} />
                                            ) : (
                                                <Maximize2 size={14} />
                                            )
                                        }
                                        size="small"
                                        onClick={() => setFullscreen((f) => !f)}
                                    >
                                        {fullscreen
                                            ? "Exit Fullscreen"
                                            : "Fullscreen"}
                                    </Button>
                                    <Button
                                        icon={<RefreshCw size={14} />}
                                        size="small"
                                        onClick={() => refetch()}
                                        loading={isLoading}
                                    >
                                        Refresh
                                    </Button>
                                </Space>
                            </div>
                        </Card>
                    </motion.div>

                    {/* Tree */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: 0.1 }}
                    >
                        <Card
                            className="shadow-sm"
                            bodyStyle={{
                                padding: 0,
                                minHeight: fullscreen ? "80vh" : 500,
                            }}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center h-96">
                                    <Spin size="large" />
                                </div>
                            ) : network ? (
                                <div
                                    style={{
                                        height: fullscreen ? "80vh" : 500,
                                    }}
                                >
                                    <AgentTreeView
                                        data={[network]}
                                        onNodeClick={handleNodeClick}
                                        orientation="vertical"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-96">
                                    <Empty description="You don't have any downlines yet." />
                                </div>
                            )}
                        </Card>
                    </motion.div>

                    {/* Node Detail Drawer */}
                    <Drawer
                        title="Agent Details"
                        open={drawerOpen}
                        onClose={() => {
                            setDrawerOpen(false);
                            setSelectedNode(null);
                        }}
                        width={380}
                    >
                        {selectedNode && (
                            <div>
                                <div className="flex items-center gap-3 mb-6">
                                    <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-lg font-bold">
                                        {selectedNode.name?.charAt(0) ?? "?"}
                                    </div>
                                    <div>
                                        <div className="font-semibold text-lg">
                                            {selectedNode.name}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {selectedNode.email}
                                        </div>
                                    </div>
                                </div>

                                <Descriptions column={1} size="small" bordered>
                                    <Descriptions.Item label="Level">
                                        {selectedNode.level_name ? (
                                            <Tag color="blue">
                                                {selectedNode.level_name}
                                            </Tag>
                                        ) : (
                                            "Unranked"
                                        )}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Direct Downlines">
                                        {selectedNode.children?.length ?? 0}
                                    </Descriptions.Item>
                                </Descriptions>

                                <div className="mt-4 mb-2">
                                    <div className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                                        All-Time Metrics
                                    </div>
                                    <Descriptions
                                        column={2}
                                        size="small"
                                        bordered
                                    >
                                        <Descriptions.Item label="NSA">
                                            {selectedNode.nsa ?? 0}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="NSD">
                                            {selectedNode.nsd ?? 0}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="VSA">
                                            $
                                            {(
                                                selectedNode.vsa ?? 0
                                            ).toLocaleString()}
                                        </Descriptions.Item>
                                        <Descriptions.Item label="VSD">
                                            $
                                            {(
                                                selectedNode.vsd ?? 0
                                            ).toLocaleString()}
                                        </Descriptions.Item>
                                    </Descriptions>
                                </div>

                                {selectedNode.joined_date && (
                                    <div className="mt-2 text-xs text-gray-500">
                                        Joined:{" "}
                                        {new Date(
                                            selectedNode.joined_date,
                                        ).toLocaleDateString()}
                                    </div>
                                )}
                            </div>
                        )}
                    </Drawer>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyNetwork;
