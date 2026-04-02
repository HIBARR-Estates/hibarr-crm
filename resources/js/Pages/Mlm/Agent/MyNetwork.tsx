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
} from "@/Features/Mlm/api";
import { useAgentInvitation } from "@/Hooks/useAgentInvitation";
import { AgentTreeView } from "@/Features/Mlm/Components";
import type {
    AgentHierarchyNode,
    DownlineDealContribution,
    DownlineListItem,
} from "@/Features/Mlm/types";
import type { IInvitation, InvitationStatus } from "@/Types/invitations";
import type { Deal } from "@/Types/api/deals";

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
        <div className="space-y-6">
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
        <div className="space-y-4">
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
                                    <div className="space-y-6">
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
                                            >
                                                {isLoading ? (
                                                    <div className="flex items-center justify-center h-96">
                                                        <Spin size="large" />
                                                    </div>
                                                ) : network ? (
                                                    <div
                                                        style={{
                                                            height: 500,
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

                    {/* Fullscreen Tree Modal */}
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
                            <AgentTreeView
                                data={[network]}
                                onNodeClick={handleNodeClick}
                                orientation="vertical"
                                height={window.innerHeight * 0.9 - 55}
                            />
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
                        width={520}
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

                                {/* Downline Deals Section */}
                                {isDownlineNode && (
                                    <>
                                        <Divider />
                                        <div className="text-xs uppercase tracking-wider text-gray-400 mb-3">
                                            Deals
                                        </div>
                                        <DownlineDealsSection
                                            agentId={selectedNode.id}
                                        />
                                    </>
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
