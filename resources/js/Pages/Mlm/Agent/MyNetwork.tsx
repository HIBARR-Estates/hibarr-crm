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
    Tabs,
    Table,
    Input,
    Form,
    message,
    Divider,
    Modal,
    Select,
    Tooltip,
    Segmented,
    Timeline,
    Popconfirm,
} from "antd";
import { motion } from "framer-motion";
import {
    GitBranch,
    RefreshCw,
    Maximize2,
    Mail,
    Send,
    Briefcase,
    Search,
    List,
    Network,
    Users,
    BarChart3,
    History,
    ExternalLink,
} from "lucide-react";
import { Link } from "@inertiajs/react";
import dayjs from "dayjs";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import UserIndicator from "@/Components/UserIndicator";
import {
    useMyNetwork,
    useDownlineDeals,
    useAgentDeals,
    useDownlineList,
    useLevelHistory,
} from "@/Features/Mlm/api";
import { useAgentInvitation } from "@/Hooks/useAgentInvitation";
import { AgentTreeView, AgentListView } from "@/Features/Mlm/Components";
import type {
    AgentHierarchyNode,
    AgentLevelHistory,
    DownlineDealContribution,
    DownlineListItem,
} from "@/Features/Mlm/types";
import type { IInvitation, InvitationStatus } from "@/Types/invitations";
import type { Deal } from "@/Types/api/deals";
import { OrderedListOutlined, MergeOutlined } from "@ant-design/icons";

interface Props extends PageProps {
    network: AgentHierarchyNode | null;
}

// ── Downline Deals Table (used inside the Drawer) ────────────────
const DownlineDealsSection: React.FC<{ agentId: number }> = ({ agentId }) => {
    const [page, setPage] = useState(1);

    const { data, isLoading } = useDownlineDeals(agentId, {
        page,
        per_page: 8,
    });

    const records = (data as any)?.data ?? [];
    const total = (data as any)?.total ?? 0;

    const columns = [
        {
            title: "Deal",
            key: "deal",
            render: (_: any, r: DownlineDealContribution) => (
                <div>
                    <div className="font-medium text-sm">{r.deal_name}</div>
                    <div className="text-xs text-gray-500">#{r.deal_id}</div>
                </div>
            ),
        },
        {
            title: "Value",
            dataIndex: "deal_value",
            key: "deal_value",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-medium">
                    $
                    {val?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            title: "Commission",
            dataIndex: "commission_amount",
            key: "commission_amount",
            align: "right" as const,
            render: (val: number) => (
                <span className="font-semibold text-green-600">
                    $
                    {val?.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                    })}
                </span>
            ),
        },
        {
            title: "Type",
            dataIndex: "commission_type",
            key: "commission_type",
            render: (t: string) => (
                <Tag
                    color={
                        t === "agent"
                            ? "blue"
                            : t === "upline"
                              ? "purple"
                              : "default"
                    }
                >
                    {t}
                </Tag>
            ),
        },
        {
            title: "Date",
            dataIndex: "date",
            key: "date",
            render: (d: string) => (d ? new Date(d).toLocaleDateString() : "—"),
        },
    ];

    return (
        <Table
            dataSource={records}
            columns={columns}
            rowKey="deal_id"
            size="small"
            loading={isLoading}
            locale={{ emptyText: <Empty description="No deals found" /> }}
            pagination={{
                current: page,
                total,
                pageSize: 8,
                size: "small",
                showSizeChanger: false,
                onChange: (p) => setPage(p),
            }}
        />
    );
};

// ── Invitations Tab ──────────────────────────────────────────────
const InvitationsTab: React.FC = () => {
    const [form] = Form.useForm();

    const {
        invitations,
        totalCount,
        isLoading: invitesLoading,
        isSending: sending,
        sendInvitation,
        refetch: refetchInvites,
        page: invitePage,
        setPage: setInvitePage,
    } = useAgentInvitation({
        pageSize: 10,
        onCreateSuccess: () => {
            form.resetFields();
        },
    });

    const handleSendInvite = (values: { email: string }) => {
        sendInvitation(values.email);
    };

    const statusColor: Record<string, string> = {
        pending_registration: "orange",
        pending_review: "blue",
        approved: "green",
        rejected: "red",
        expired: "default",
    };

    const formatStatus = (s: string) =>
        s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    const inviteColumns = [
        {
            title: "Email",
            dataIndex: "email",
            key: "email",
            render: (email: string) => (
                <span className="text-sm font-medium">{email}</span>
            ),
        },
        {
            title: "Name",
            key: "name",
            render: (_: any, r: IInvitation) => {
                const name = [r.firstName, r.lastName]
                    .filter(Boolean)
                    .join(" ");
                return <span className="text-sm">{name || "—"}</span>;
            },
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            render: (s: InvitationStatus) => (
                <Tag color={statusColor[s] ?? "default"}>{formatStatus(s)}</Tag>
            ),
        },
        {
            title: "Expires",
            dataIndex: "tokenExpiresAt",
            key: "tokenExpiresAt",
            render: (d: string | null) =>
                d ? dayjs(d).format("MMM DD, YYYY") : "—",
        },
        {
            title: "Sent",
            dataIndex: "createdAt",
            key: "createdAt",
            render: (d: string) => (d ? dayjs(d).format("MMM DD, YYYY") : "—"),
        },
    ];

    return (
        <div className="flex flex-col gap-y-6">
            {/* Invite Form */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <Card
                    size="small"
                    className="shadow-sm"
                    title={
                        <div className="flex items-center gap-2">
                            <Mail size={16} className="text-indigo-500" />
                            <span>Invite Agent</span>
                        </div>
                    }
                >
                    <Form
                        form={form}
                        layout="inline"
                        onFinish={handleSendInvite}
                        className="flex flex-wrap gap-2"
                    >
                        <Form.Item
                            name="email"
                            rules={[
                                {
                                    required: true,
                                    message: "Email is required",
                                },
                                {
                                    type: "email",
                                    message: "Enter a valid email",
                                },
                            ]}
                            className="flex-1 min-w-[250px]"
                        >
                            <Input
                                placeholder="agent@example.com"
                                size="middle"
                            />
                        </Form.Item>
                        <Form.Item>
                            <Button
                                type="primary"
                                htmlType="submit"
                                loading={sending}
                                icon={<Send size={14} />}
                            >
                                Send Invite
                            </Button>
                        </Form.Item>
                    </Form>
                </Card>
            </motion.div>

            {/* Invitations List */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <Card
                    size="small"
                    className="shadow-sm"
                    title="Sent Invitations"
                    extra={
                        <Button
                            icon={<RefreshCw size={14} />}
                            size="small"
                            onClick={() => refetchInvites()}
                            loading={invitesLoading}
                        >
                            Refresh
                        </Button>
                    }
                >
                    <Table
                        dataSource={invitations}
                        columns={inviteColumns}
                        rowKey="id"
                        size="small"
                        loading={invitesLoading}
                        locale={{
                            emptyText: (
                                <Empty description="No invitations sent yet" />
                            ),
                        }}
                        pagination={{
                            current: invitePage,
                            total: totalCount,
                            pageSize: 10,
                            size: "small",
                            showSizeChanger: false,
                            onChange: (p) => setInvitePage(p),
                        }}
                    />
                </Card>
            </motion.div>
        </div>
    );
};

// ── Deals Tab ────────────────────────────────────────────────────
const DealsTab: React.FC = () => {
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [selectedDownline, setSelectedDownline] = useState<number | null>(
        null,
    );

    const { data: downlineData } = useDownlineList();
    const downlines: DownlineListItem[] = (downlineData as any)?.data ?? [];

    const params: Record<string, string | number | boolean> = {
        page,
        per_page: 15,
    };
    if (search) params.search = search;
    if (selectedDownline) params.downline_agent_id = selectedDownline;

    const { data: dealsData, isLoading, refetch } = useAgentDeals(params);

    const deals: Deal[] = (dealsData as any)?.data ?? [];
    const totalDeals = (dealsData as any)?.total ?? 0;

    const dealColumns = [
        {
            title: "Deal Name",
            key: "deal_name",
            width: 250,
            render: (_: any, record: Deal) => (
                <Tooltip title={record.name}>
                    <Link
                        href={`/account/deals/${record.id}`}
                        className="text-gray-900 hover:text-blue-600 hover:underline font-medium truncate block max-w-full"
                    >
                        {record.name}
                    </Link>
                </Tooltip>
            ),
        },
        {
            title: "Contact",
            key: "contact",
            width: 180,
            render: (_: any, record: Deal) => {
                if (!record.contact)
                    return <span className="text-gray-400">--</span>;
                return (
                    <div>
                        <div className="text-sm font-medium text-gray-900 truncate">
                            {record.contact.client_name}
                        </div>
                        {record.contact.client_email && (
                            <div className="text-xs text-gray-500 truncate">
                                {record.contact.client_email}
                            </div>
                        )}
                    </div>
                );
            },
        },
        {
            title: "Stage",
            key: "stage",
            width: 140,
            render: (_: any, record: Deal) => {
                if (!record.lead_stage)
                    return <span className="text-gray-400">--</span>;
                return (
                    <div className="flex items-center gap-2">
                        <div
                            className="w-2 h-2 rounded-full flex-shrink-0"
                            style={{
                                backgroundColor:
                                    record.lead_stage.label_color || "#007bff",
                            }}
                        />
                        <span className="text-sm text-gray-900 truncate">
                            {record.lead_stage.name}
                        </span>
                    </div>
                );
            },
        },
        {
            title: "Assigned Agent",
            key: "agent",
            width: 160,
            render: (_: any, record: Deal) => {
                if (!record.lead_agent?.user)
                    return <span className="text-gray-400">--</span>;
                return (
                    <UserIndicator
                        data={record.lead_agent.user}
                        size="sm"
                        maxNameLength={15}
                    />
                );
            },
        },
        {
            title: "Value",
            key: "value",
            width: 110,
            align: "right" as const,
            render: (_: any, record: Deal) => {
                const symbol = record.currency?.currency_symbol ?? "$";
                return (
                    <span className="font-medium text-gray-900">
                        {symbol}
                        {record.value?.toLocaleString(undefined, {
                            minimumFractionDigits: 2,
                        })}
                    </span>
                );
            },
        },
        {
            title: "Created",
            key: "created_at",
            width: 110,
            render: (_: any, record: Deal) =>
                record.created_at ? (
                    <span className="text-gray-900 text-sm">
                        {dayjs(record.created_at).format("MMM DD, YYYY")}
                    </span>
                ) : (
                    <span className="text-gray-400">--</span>
                ),
        },
    ];

    return (
        <div className="flex flex-col gap-y-4">
            {/* Filters */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
            >
                <Card size="small" className="shadow-sm">
                    <div className="flex flex-wrap items-center gap-3">
                        <Select
                            placeholder="My Deals"
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            style={{ minWidth: 220 }}
                            value={selectedDownline}
                            onChange={(val) => {
                                setSelectedDownline(val ?? null);
                                setPage(1);
                            }}
                            options={downlines.map((d) => ({
                                value: d.id,
                                label: `${d.name} (${d.email})`,
                            }))}
                        />
                        <Input
                            placeholder="Search deals..."
                            prefix={
                                <Search size={14} className="text-gray-400" />
                            }
                            allowClear
                            style={{ maxWidth: 260 }}
                            value={search}
                            onChange={(e) => {
                                setSearch(e.target.value);
                                setPage(1);
                            }}
                        />
                        <Button
                            icon={<RefreshCw size={14} />}
                            size="small"
                            onClick={() => refetch()}
                            loading={isLoading}
                        >
                            Refresh
                        </Button>
                    </div>
                </Card>
            </motion.div>

            {/* Deals Table */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <Card size="small" className="shadow-sm">
                    <Table
                        dataSource={deals}
                        columns={dealColumns}
                        rowKey="id"
                        size="small"
                        loading={isLoading}
                        scroll={{ x: 950 }}
                        locale={{
                            emptyText: (
                                <Empty
                                    description={
                                        selectedDownline
                                            ? "No deals found for this downline"
                                            : "No deals found"
                                    }
                                />
                            ),
                        }}
                        pagination={{
                            current: page,
                            total: totalDeals,
                            pageSize: 15,
                            size: "small",
                            showSizeChanger: false,
                            showTotal: (total) => `${total} deals`,
                            onChange: (p) => setPage(p),
                        }}
                    />
                </Card>
            </motion.div>
        </div>
    );
};

// ── Agent Level History Section ──────────────────────────────────
const AgentLevelHistorySection: React.FC<{ agentId: number }> = ({
    agentId,
}) => {
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
                description="No level history"
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
                                    Auto
                                </Tag>
                            )}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                            {dayjs(r.assigned_at).format("MMM DD, YYYY h:mm A")}
                        </div>
                        {r.trigger_deal && (
                            <div className="text-xs text-gray-400 mt-0.5">
                                Triggered by: {r.trigger_deal.name} ($
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

// ── Agent Detail Content ─────────────────────────────────────────
const AgentDetailContent: React.FC<{
    node: AgentHierarchyNode;
    extraContent?: React.ReactNode;
}> = ({ node, extraContent }) => {
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
                            {dayjs(node.joined_date).format("MMM DD, YYYY")}
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
                        <span>Overview</span>
                    </div>
                }
            >
                <Descriptions column={2} size="small">
                    <Descriptions.Item label="Level">
                        {node.level_name ? (
                            <Tag color="blue">{node.level_name}</Tag>
                        ) : (
                            "Unranked"
                        )}
                    </Descriptions.Item>
                    <Descriptions.Item label="Direct Downlines">
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
                        <span>All-Time Metrics</span>
                    </div>
                }
            >
                <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-3 rounded-lg bg-blue-50 border border-blue-100">
                        <div className="text-2xl font-bold text-blue-700">
                            {node.nsa ?? 0}
                        </div>
                        <div className="text-xs text-blue-600">
                            Individual Sales
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-purple-50 border border-purple-100">
                        <div className="text-2xl font-bold text-purple-700">
                            {node.nsd ?? 0}
                        </div>
                        <div className="text-xs text-purple-600">
                            Team Sales
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-green-50 border border-green-100">
                        <div className="text-2xl font-bold text-green-700">
                            ${(node.vsa ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-green-600">
                            Individual Revenue
                        </div>
                    </div>
                    <div className="text-center p-3 rounded-lg bg-amber-50 border border-amber-100">
                        <div className="text-2xl font-bold text-amber-700">
                            ${(node.vsd ?? 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-amber-600">
                            Team Revenue
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
                        <span>Level History</span>
                    </div>
                }
            >
                <AgentLevelHistorySection agentId={node.id} />
            </Card>

            {/* Extra content (e.g. downline deals) */}
            {extraContent}
        </div>
    );
};

// ── Main Page ────────────────────────────────────────────────────
const MyNetwork: React.FC<Props> = ({ network: initialNetwork }) => {
    const { data, isLoading, refetch } = useMyNetwork();
    const network: AgentHierarchyNode | null =
        (data as any)?.data ?? initialNetwork;

    const [selectedNode, setSelectedNode] = useState<AgentHierarchyNode | null>(
        null,
    );
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [fullscreenOpen, setFullscreenOpen] = useState(false);
    const [viewMode, setViewMode] = useState<"tree" | "list">("list");

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

    /** Whether the selected node is a downline (not self or upline). */
    const isDownlineNode =
        selectedNode && !selectedNode.is_self && !selectedNode.is_upline;

    return (
        <DashboardLayout>
            <PageLayout
                title="My Network"
                breadcrumbs={[
                    { name: "MLM", url: "/account/mlm/agent/dashboard" },
                    { name: "My Network" },
                ]}
            >
                <div className="max-w-7xl mx-auto">
                    <Tabs
                        defaultActiveKey="network"
                        items={[
                            {
                                key: "network",
                                label: (
                                    <span className="flex items-center gap-1.5">
                                        <GitBranch size={14} />
                                        Network
                                    </span>
                                ),
                                children: (
                                    <div className="flex flex-col gap-y-6">
                                        {/* Summary */}
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ duration: 0.3 }}
                                            className="mb-4"
                                        >
                                            <Card
                                                size="small"
                                                className="shadow-sm"
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <GitBranch
                                                            size={18}
                                                            className="text-indigo-500"
                                                        />
                                                        <span className="text-sm text-gray-600">
                                                            Total Downlines:{" "}
                                                            <strong>
                                                                {totalNodes}
                                                            </strong>
                                                        </span>
                                                        {selfNode && (
                                                            <span className="text-sm text-gray-600">
                                                                Direct:{" "}
                                                                <strong>
                                                                    {selfNode
                                                                        .children
                                                                        ?.length ??
                                                                        0}
                                                                </strong>
                                                            </span>
                                                        )}
                                                    </div>
                                                    <Space>
                                                        <Segmented
                                                            value={viewMode}
                                                            onChange={(val) =>
                                                                setViewMode(
                                                                    val as
                                                                        | "tree"
                                                                        | "list",
                                                                )
                                                            }
                                                            options={[
                                                                {
                                                                    value: "list",
                                                                    icon: (
                                                                        <OrderedListOutlined />
                                                                    ),
                                                                },
                                                                {
                                                                    value: "tree",
                                                                    icon: (
                                                                        <MergeOutlined />
                                                                    ),
                                                                },
                                                            ]}
                                                        />
                                                        <Button
                                                            icon={
                                                                <Maximize2
                                                                    size={14}
                                                                />
                                                            }
                                                            size="small"
                                                            onClick={() =>
                                                                setFullscreenOpen(
                                                                    true,
                                                                )
                                                            }
                                                        >
                                                            Fullscreen
                                                        </Button>
                                                        <Button
                                                            icon={
                                                                <RefreshCw
                                                                    size={14}
                                                                />
                                                            }
                                                            size="small"
                                                            onClick={() =>
                                                                refetch()
                                                            }
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
                                            transition={{
                                                duration: 0.4,
                                                delay: 0.1,
                                            }}
                                        >
                                            <Card
                                                className="shadow-sm"
                                                bodyStyle={{
                                                    padding: 0,
                                                    minHeight: 500,
                                                }}
                                                style={{ marginBottom: 0 }}
                                            >
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center h-96">
                                                        <Spin size="large" />
                                                    </div>
                                                ) : network ? (
                                                    viewMode === "tree" ? (
                                                        <div
                                                            style={{
                                                                height: "calc(100vh - 340px)",
                                                                minHeight: 500,
                                                            }}
                                                        >
                                                            <AgentTreeView
                                                                data={[network]}
                                                                onNodeClick={
                                                                    handleNodeClick
                                                                }
                                                                orientation="vertical"
                                                            />
                                                        </div>
                                                    ) : (
                                                        <AgentListView
                                                            data={[network]}
                                                            onNodeClick={
                                                                handleNodeClick
                                                            }
                                                            height={Math.max(
                                                                500,
                                                                window.innerHeight -
                                                                    340,
                                                            )}
                                                        />
                                                    )
                                                ) : (
                                                    <div className="flex items-center justify-center h-96">
                                                        <Empty description="You don't have any downlines yet." />
                                                    </div>
                                                )}
                                            </Card>
                                        </motion.div>
                                    </div>
                                ),
                            },
                            {
                                key: "invitations",
                                label: (
                                    <span className="flex items-center gap-1.5">
                                        <Mail size={14} />
                                        Invitations
                                    </span>
                                ),
                                children: <InvitationsTab />,
                            },
                            {
                                key: "deals",
                                label: (
                                    <span className="flex items-center gap-1.5">
                                        <Briefcase size={14} />
                                        Deals
                                    </span>
                                ),
                                children: <DealsTab />,
                            },
                        ]}
                    />

                    {/* Fullscreen Modal */}
                    <Modal
                        title={
                            <div className="flex items-center gap-2">
                                <GitBranch
                                    size={18}
                                    className="text-indigo-500"
                                />
                                <span>My Network</span>
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
                        {network ? (
                            viewMode === "tree" ? (
                                <AgentTreeView
                                    data={[network]}
                                    onNodeClick={handleNodeClick}
                                    orientation="vertical"
                                    height={window.innerHeight * 0.9 - 55}
                                />
                            ) : (
                                <AgentListView
                                    data={[network]}
                                    onNodeClick={handleNodeClick}
                                    height={window.innerHeight * 0.9 - 55}
                                />
                            )
                        ) : (
                            <div className="flex items-center justify-center h-96">
                                <Empty description="No network data available" />
                            </div>
                        )}
                    </Modal>

                    {/* Node Detail Drawer (with Downline Deals) */}
                    <Drawer
                        title="Agent Details"
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
                                extraContent={
                                    isDownlineNode ? (
                                        <Card
                                            size="small"
                                            title={
                                                <div className="flex items-center gap-2">
                                                    <Briefcase
                                                        size={14}
                                                        className="text-indigo-500"
                                                    />
                                                    <span>Deals</span>
                                                </div>
                                            }
                                        >
                                            <DownlineDealsSection
                                                agentId={selectedNode.id}
                                            />
                                        </Card>
                                    ) : undefined
                                }
                            />
                        )}
                    </Drawer>
                </div>
            </PageLayout>
        </DashboardLayout>
    );
};

export default MyNetwork;
