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
    Segmented,
    Table,
    Spin,
    Timeline,
} from "antd";
import { motion } from "framer-motion";
import {
    GitBranch,
    Plus,
    Unlink,
    RefreshCw,
    Maximize2,
    List,
    Network,
    TrendingUp,
    Users,
    BarChart3,
    History,
    ExternalLink,
} from "lucide-react";
import { Link, usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { formatCompanyDate, formatCompanyDateTime } from "@/lib/companyDateTime";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import {
    useAgentHierarchy,
    useAssignDownline,
    useRemoveHierarchy,
    useLevelHistory,
} from "@/Features/Mlm/api";
import {
    AgentTreeView,
    AgentListView,
    LevelBadge,
} from "@/Features/Mlm/Components";
import type {
    AgentHierarchyNode,
    AgentLevelHistory,
} from "@/Features/Mlm/types";
import {
    OrderedListOutlined,
    MergeOutlined,
    PartitionOutlined,
} from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";

// ── Agent Detail Content (shared by drawer) ──────────────────────
const AgentLevelHistorySection: React.FC<{ agentId: number }> = ({
    agentId,
}) => {
    const { td } = useTd();
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
    const { data, isLoading } = useLevelHistory({
        agent_id: agentId,
        per_page: 10,
    });
    const records: AgentLevelHistory[] = (data as any)?.data ?? [];

    if (isLoading) {
        return <Spin size="small" />;
    }

    if (records.length === 0) {
        return (
            <Empty
                description={td("No level history", { source: "en" })}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
        );
    }

    return (
        <Timeline
            items={records.map((r) => ({
                color: r.system_assigned ? "blue" : "green",
                children: (
                    <div>
                        <div className="flex items-center gap-2">
                            <Tag color="blue">
                                {r.level?.name ?? "Unknown Level"}
                            </Tag>
                            {r.system_assigned && (
                                <Tag color="default" className="text-xs">
                                    {td("Auto", { source: "en" })}
                                </Tag>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {formatCompanyDateTime(r.assigned_at)}
                        </div>
                        {r.trigger_deal && (
                            <div className="text-xs text-gray-400 mt-0.5">
                                Triggered by: {r.trigger_deal.name} (
                                {currencySymbol}
                                {r.trigger_deal.value?.toLocaleString()})
                            </div>
                        )}
                        {r.assigned_by_user && (
                            <div className="text-xs text-gray-400 mt-0.5">
                                Assigned by: {r.assigned_by_user.name}
                            </div>
                        )}
                    </div>
                ),
            }))}
        />
    );
};

const AgentDetailContent: React.FC<{
    node: AgentHierarchyNode;
    onRemove?: () => void;
    isRemoving?: boolean;
    showRemove?: boolean;
    extraContent?: React.ReactNode;
}> = ({ node, onRemove, isRemoving, showRemove, extraContent }) => {
    const { td } = useTd();
    const { default_currency_symbol: currencySymbol = "" } = usePage()
        .props as any;
    return (
        <div className="flex flex-col gap-y-4">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 text-xl font-bold">
                    {node.name?.charAt(0) ?? "?"}
                </div>
                <div className="flex-1">
                    <div className="font-semibold text-lg">{node.name}</div>
                    <div className="text-sm text-gray-500">{node.email}</div>
                    {node.joined_date && (
                        <div className="text-xs text-gray-400">
                            Joined{" "}
                            {formatCompanyDate(node.joined_date)}
                        </div>
                    )}
                </div>
                <Link
                    href={`/account/mlm/agents/${node.id}/dashboard`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
                >
                    <ExternalLink size={14} />
                    View Dashboard
                </Link>
            </div>

            {/* Overview Card */}
            <Card
                size="small"
                title={
                    <div className="flex items-center gap-2">
                        <Users size={14} className="text-indigo-500" />
                        <span>{td("Overview", { source: "en" })}</span>
                    </div>
                }
            >
                <Descriptions column={2} size="small">
                    <Descriptions.Item label={td("Level", { source: "en" })}>
                        {node.level_name ? (
                            <Tag color="blue">{node.level_name}</Tag>
                        ) : (
                            "Unranked"
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label={td("Level Rank", { source: "en" })}>
                        {node.level_rank ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label={td("Total Sales", { source: "en" })}>
                        {node.total_sales?.toLocaleString() ?? "—"}
                    </Descriptions.Item>
                    <Descriptions.Item label={td("Direct Downlines", { source: "en" })}>
                        {node.children?.length ?? 0}
                    </Descriptions.Item>
                </Descriptions>
            </Card>

            {/* Metrics Card */}
            <Card
                size="small"
                title={
                    <div className="flex items-center gap-2">
                        <BarChart3 size={14} className="text-indigo-500" />
                        <span>{td("All-Time Metrics", { source: "en" })}</span>
                    </div>
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="text-2xl font-bold text-blue-700">
                            {node.nsa ?? 0}
                        </div>
                        <div className="text-xs text-blue-600">
                            {td("Individual Sales", { source: "en" })}
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-100">
                        <div className="text-2xl font-bold text-purple-700">
                            {node.nsd ?? 0}
                        </div>
                        <div className="text-xs text-purple-600">
                            {td("Team Sales", { source: "en" })}
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50 border border-green-100">
                        <div className="text-2xl font-bold text-green-700">
                            {currencySymbol}
                            {(node.vsa ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-green-600">
                            {td("Individual Revenue", { source: "en" })}
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <div className="text-2xl font-bold text-amber-700">
                            {currencySymbol}
                            {(node.vsd ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-amber-600">
                            {td("Team Revenue", { source: "en" })}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Level History Card */}
            <Card
                size="small"
                title={
                    <div className="flex items-center gap-2">
                        <History size={14} className="text-indigo-500" />
                        <span>{td("Level History", { source: "en" })}</span>
                    </div>
                }
            >
                <AgentLevelHistorySection agentId={node.id} />
            </Card>

            {/* Extra content (e.g. downline deals) */}
            {extraContent}

            {/* Remove button */}
            {showRemove && onRemove && (
                <Popconfirm
                    title={td("Remove from hierarchy?", { source: "en" })}
                    description={td("This will remove the agent's parent-child relationship.", { source: "en" })}
                    onConfirm={onRemove}
                    okText={td("Remove", { source: "en" })}
                    okType="danger"
                >
                    <Button
                        danger
                        icon={<Unlink size={14} />}
                        loading={isRemoving}
                    >
                        {td("Remove from Hierarchy", { source: "en" })}
                    </Button>
                </Popconfirm>
            )}
        </div>
    );
};

interface Props extends PageProps {
    hierarchy: AgentHierarchyNode[];
    agents: Array<{ id: number; name: string; email: string }>;
}

const MlmAgentHierarchy: React.FC<Props> = ({
    hierarchy: initialHierarchy,
    agents = [],
}) => {
    const { td } = useTd();
    const { t } = useTranslation();
    const { data, isLoading, refetch } = useAgentHierarchy();
    const hierarchy: AgentHierarchyNode[] =
        (data as any)?.data ?? initialHierarchy ?? [];

    const [selectedNode, setSelectedNode] = useState<AgentHierarchyNode | null>(
        null,
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [assignModalOpen, setAssignModalOpen] = useState(false);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"tree" | "list">("list");
    const [form] = Form.useForm();

    const assignDownline = useAssignDownline(() => {
        message.success(td("Downline assigned successfully", { source: "en" }));
        refetch();
        setAssignModalOpen(false);
        form.resetFields();
    });

    const removeHierarchy = useRemoveHierarchy(selectedNode?.id ?? 0, () => {
        message.success(td("Agent removed from hierarchy", { source: "en" }));
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
                title={t("app.mlm.admin.agent_hierarchy")}
                breadcrumbs={[
                    { name: t("app.mlm.title"), url: "/account/mlm/dashboard" },
                    { name: t("app.mlm.admin.agent_hierarchy") },
                ]}
            >
                <div className="max-w-7xl mx-auto flex flex-col gap-y-6">
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
                                        {td("Organization Tree", { source: "en" })}
                                    </span>
                                </div>
                            }
                            extra={
                                <Space>
                                    <Segmented
                                        value={viewMode}
                                        onChange={(val) =>
                                            setViewMode(val as "tree" | "list")
                                        }
                                        options={[
                                            {
                                                value: "list",
                                                icon: <OrderedListOutlined />,
                                            },
                                            {
                                                value: "tree",
                                                icon: (
                                                    <PartitionOutlined
                                                        rotate={90}
                                                    />
                                                ),
                                            },
                                        ]}
                                    />
                                    <Button
                                        icon={<Maximize2 size={14} />}
                                        onClick={() => setFullscreenOpen(true)}
                                    >
                                        {td("Fullscreen", { source: "en" })}
                                    </Button>
                                    <Button
                                        icon={<RefreshCw size={14} />}
                                        onClick={() => refetch()}
                                        loading={isLoading}
                                    >
                                        {td("Refresh", { source: "en" })}
                                    </Button>
                                    <Button
                                        type="primary"
                                        icon={<Plus size={14} />}
                                        onClick={() => setAssignModalOpen(true)}
                                    >
                                        {td("Assign Downline", { source: "en" })}
                                    </Button>
                                </Space>
                            }
                            bodyStyle={{ padding: 0, minHeight: 500 }}
                            style={{ marginBottom: 0 }}
                        >
                            {isLoading ? (
                                <div className="flex items-center justify-center h-96">
                                    <Skeleton active paragraph={{ rows: 6 }} />
                                </div>
                            ) : hierarchy.length > 0 ? (
                                viewMode === "tree" ? (
                                    <div
                                        style={{
                                            height: "calc(100vh - 280px)",
                                        }}
                                    >
                                        <AgentTreeView
                                            data={hierarchy}
                                            onNodeClick={handleNodeClick}
                                            orientation="vertical"
                                        />
                                    </div>
                                ) : (
                                    <AgentListView
                                        data={hierarchy}
                                        onNodeClick={handleNodeClick}
                                        height={Math.max(
                                            500,
                                            window.innerHeight - 280,
                                        )}
                                    />
                                )
                            ) : (
                                <div className="flex items-center justify-center h-96">
                                    <Empty description={td("No hierarchy data. Assign parent-child relationships to build the tree.", { source: "en" })} />
                                </div>
                            )}
                        </Card>
                    </motion.div>

                    {/* Agent Detail Drawer */}
                    <Drawer
                        title={td("Agent Details", { source: "en" })}
                        open={drawerOpen}
                        onClose={() => {
                            setDrawerOpen(false);
                            setSelectedNode(null);
                        }}
                        size="large"
                    >
                        {selectedNode && (
                            <AgentDetailContent
                                node={selectedNode}
                                onRemove={() =>
                                    removeHierarchy.mutate({} as any)
                                }
                                isRemoving={removeHierarchy.isPending}
                                showRemove
                            />
                        )}
                    </Drawer>

                    {/* Fullscreen Modal */}
                    <Modal
                        title={
                            <div className="flex items-center gap-2">
                                <GitBranch
                                    size={18}
                                    className="text-indigo-500"
                                />
                                <span>{td("Organization Tree", { source: "en" })}</span>
                            </div>
                        }
                        open={fullscreenOpen}
                        onCancel={() => setFullscreenOpen(false)}
                        footer={null}
                        width="95vw"
                        style={{ top: 20 }}
                        styles={{
                            body: {
                                padding: 0,
                                height: "calc(90vh - 55px)",
                                overflow: "hidden",
                            },
                        }}
                        destroyOnClose
                    >
                        {hierarchy.length > 0 ? (
                            viewMode === "tree" ? (
                                <AgentTreeView
                                    data={hierarchy}
                                    onNodeClick={handleNodeClick}
                                    orientation="vertical"
                                    height={window.innerHeight * 0.9 - 55}
                                />
                            ) : (
                                <AgentListView
                                    data={hierarchy}
                                    onNodeClick={handleNodeClick}
                                    height={window.innerHeight * 0.9 - 55}
                                />
                            )
                        ) : (
                            <div className="flex items-center justify-center h-96">
                                <Empty description={td("No hierarchy data available", { source: "en" })} />
                            </div>
                        )}
                    </Modal>

                    {/* Assign Downline Modal */}
                    <Modal
                        title={td("Assign Downline", { source: "en" })}
                        open={assignModalOpen}
                        onOk={handleAssign}
                        onCancel={() => {
                            setAssignModalOpen(false);
                            form.resetFields();
                        }}
                        confirmLoading={assignDownline.isPending}
                        okText={td("Assign", { source: "en" })}
                        destroyOnClose
                    >
                        <Form form={form} layout="vertical" className="mt-4">
                            <Form.Item
                                label={td("Parent Agent (Upline)", { source: "en" })}
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
                                    placeholder={td("Select parent...", { source: "en" })}
                                    options={agents.map((a) => ({
                                        value: a.id,
                                        label: a.name,
                                    }))}
                                />
                            </Form.Item>

                            <Form.Item
                                label={td("Child Agent (Downline)", { source: "en" })}
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
                                    placeholder={td("Select child...", { source: "en" })}
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
