import React, { useState } from "react";
import {
    Card,
    Select,
    Button,
    Drawer,
    Descriptions,
    Tag,
    Empty,
    Space,
    Modal,
    Form,
    message,
    Popconfirm,
    Skeleton,
} from "antd";
import { motion } from "framer-motion";
import { GitBranch, Plus, Unlink, RefreshCw } from "lucide-react";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import {
    useAgentHierarchy,
    useAssignDownline,
    useRemoveHierarchy,
} from "@/Features/Mlm/api";
import { AgentTreeView, LevelBadge } from "@/Features/Mlm/Components";
import type { AgentHierarchyNode } from "@/Features/Mlm/types";

interface Props extends PageProps {
    hierarchy: AgentHierarchyNode[];
    agents: Array<{ id: number; name: string; email: string }>;
}

const MlmAgentHierarchy: React.FC<Props> = ({
    hierarchy: initialHierarchy,
    agents = [],
}) => {
    const { data, isLoading, refetch } = useAgentHierarchy();
    const hierarchy: AgentHierarchyNode[] =
        (data as any)?.data ?? initialHierarchy ?? [];

    const [selectedNode, setSelectedNode] = useState<AgentHierarchyNode | null>(
        null,
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [form] = Form.useForm();

    const assignDownline = useAssignDownline(() => {
        message.success("Downline assigned successfully");
        refetch();
        setAssignModalOpen(false);
        form.resetFields();
    });

    const removeHierarchy = useRemoveHierarchy(selectedNode?.id ?? 0, () => {
        message.success("Agent removed from hierarchy");
        refetch();
        setDrawerOpen(false);
        setSelectedNode(null);
    });

    const handleNodeClick = (node: AgentHierarchyNode) => {
        setSelectedNode(node);
        setDrawerOpen(true);
    };

    const handleAssign = async () => {
        try {
            const values = await form.validateFields();
            assignDownline.mutate(values);
        } catch {
            // validation
        }
    };

    return (
        <DashboardLayout>
            <PageLayout
                title="Agent Hierarchy"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/dashboard" },
                    { name: "Agent Hierarchy" },
                ]}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                    >
                        <Card
                            title={
                                <div className="flex items-center gap-2">
                                    <GitBranch
                                        size={18}
                                        className="text-indigo-500"
                                    />
                                    <span className="font-semibold">
                                        Organization Tree
                                    </span>
                                </div>
                            }
                            extra={
                                <Space>
                                    <Button
                                        icon={<RefreshCw size={14} />}
                                        onClick={() => refetch()}
                                        loading={isLoading}
                                    >
                                        Refresh
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<Plus size={14} />}
                                        onClick={() => setAssignModalOpen(true)}
                                    >
                                        Assign Downline
                                    </Button>
                                </Space>
                            }
                            className="shadow-sm"
                            bodyStyle={{ padding: 0, minHeight: 500 }}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center h-96">
                                    <Skeleton active paragraph={{ rows: 6 }} />
                                </div>
                            ) : hierarchy.length > 0 ? (
                                <div style={{ height: 600 }}>
                                    <AgentTreeView
                                        data={hierarchy}
                                        onNodeClick={handleNodeClick}
                                        orientation="vertical"
                                    />
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-96">
                                    <Empty description="No hierarchy data. Assign parent-child relationships to build the tree." />
                                </div>
                            )}
                        </Card>
                    </motion.div>

                    {/* Agent Detail Drawer */}
                    <Drawer
                        title="Agent Details"
                        open={drawerOpen}
                        onClose={() => {
                            setDrawerOpen(false);
                            setSelectedNode(null);
                        }}
                        width={400}
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
                                    <Descriptions.Item label="Level Rank">
                                        {selectedNode.level_rank ?? "—"}
                                    </Descriptions.Item>
                                    <Descriptions.Item label="Total Sales">
                                        {selectedNode.total_sales?.toLocaleString() ??
                                            "—"}
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

                                <div className="mt-6">
                                    <Popconfirm
                                        title="Remove from hierarchy?"
                                        description="This will remove the agent's parent-child relationship."
                                        onConfirm={() =>
                                            removeHierarchy.mutate({} as any)
                                        }
                                        okText="Remove"
                                        okType="danger"
                                    >
                                        <Button
                                            danger
                                            icon={<Unlink size={14} />}
                                            loading={removeHierarchy.isPending}
                                        >
                                            Remove from Hierarchy
                                        </Button>
                                    </Popconfirm>
                                </div>
                            </div>
                        )}
                    </Drawer>

                    {/* Assign Downline Modal */}
                    <Modal
                        title="Assign Downline"
                        open={assignModalOpen}
                        onOk={handleAssign}
                        onCancel={() => {
                            setAssignModalOpen(false);
                            form.resetFields();
                        }}
                        confirmLoading={assignDownline.isPending}
                        okText="Assign"
                        destroyOnClose
                    >
                        <Form form={form} layout="vertical" className="mt-4">
                            <Form.Item
                                label="Parent Agent (Upline)"
                                name="parent_agent_id"
                                rules={[
                                    {
                                        required: true,
                                        message: "Select parent agent",
                                    },
                                ]}
                            >
                                <Select
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Select parent..."
                                    options={agents.map((a) => ({
                                        value: a.id,
                                        label: a.name,
                                    }))}
                                />
                            </Form.Item>

                            <Form.Item
                                label="Child Agent (Downline)"
                                name="child_agent_id"
                                rules={[
                                    {
                                        required: true,
                                        message: "Select child agent",
                                    },
                                ]}
                            >
                                <Select
                                    showSearch
                                    optionFilterProp="label"
                                    placeholder="Select child..."
                                    options={agents.map((a) => ({
                                        value: a.id,
                                        label: a.name,
                                    }))}
                                />
                            </Form.Item>
                        </Form>
                    </Modal>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MlmAgentHierarchy;
