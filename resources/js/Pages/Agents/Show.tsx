import React, { useCallback } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Agent, AgentShowProps } from "@/Types/api/agents";
import {
    Card,
    Tabs,
    Tag,
    Descriptions,
    Button,
    Dropdown,
    Empty,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import {
    EditOutlined,
    DeleteOutlined,
    MailOutlined,
    PhoneOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import dayjs from "dayjs";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import UserIndicator from "@/Components/UserIndicator";
import SaveAgentModal from "@/Features/Agents/SaveAgentModal";
import DeleteAgent from "@/Features/Agents/DeleteAgent";
import { useTd } from "@/Hooks/useDynamicTranslation";

const Show = ({
    pageTitle,
    agent,
    agentCategories,
    deals,
    permissions,
}: AgentShowProps) => {
    const { td } = useTd();
    const { handleAction, handleClose, action, selected } =
        useGenericEntityAction<Agent>();

    const breadcrumbs = [
        { name: "Agents", url: route("agents.index") },
        { name: agent.user?.name ?? "Agent" },
    ];

    const tabItems = [
        {
            key: "profile",
            label: "Profile",
            children: (
                <Card>
                    <div className="space-y-6">
                        <div className="flex items-center gap-4">
                            <UserIndicator
                                data={{
                                    image_url: agent.user?.image_url,
                                    name: agent.user?.name ?? "",
                                }}
                                size="lg"
                            />
                            <div>
                                <h2 className="text-xl font-semibold">
                                    {agent.user?.name}
                                </h2>
                                <Tag
                                    color={
                                        agent.status === "enabled"
                                            ? "green"
                                            : "red"
                                    }
                                >
                                    {agent.status === "enabled"
                                        ? "Active"
                                        : "Disabled"}
                                </Tag>
                            </div>
                        </div>

                        <Descriptions bordered column={2} size="small">
                            <Descriptions.Item label={td("Email", { source: "en" })}>
                                {agent.user?.email ? (
                                    <a href={`mailto:${agent.user.email}`}>
                                        <MailOutlined className="mr-1" />
                                        {agent.user.email}
                                    </a>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label={td("Phone", { source: "en" })}>
                                {agent.user?.mobile_with_phone_code ? (
                                    <span>
                                        <PhoneOutlined className="mr-1" />
                                        {agent.user.mobile_with_phone_code}
                                    </span>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label={td("Categories", { source: "en" })} span={2}>
                                {agentCategories.length > 0 ? (
                                    <div className="flex flex-wrap gap-1">
                                        {agentCategories.map((cat) => (
                                            <Tag key={cat.id}>
                                                {cat.category_name}
                                            </Tag>
                                        ))}
                                    </div>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label={td("Agent ID", { source: "en" })}>
                                {agent.id}
                            </Descriptions.Item>
                            <Descriptions.Item label={td("Total Deals", { source: "en" })}>
                                {agent.deals_count ?? deals.length}
                            </Descriptions.Item>
                            <Descriptions.Item label={td("Created", { source: "en" })}>
                                {agent.created_at
                                    ? formatCompanyDate(agent.created_at)
                                    : "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label={td("Last Updated", { source: "en" })}>
                                {agent.updated_at
                                    ? formatCompanyDate(agent.updated_at)
                                    : "--"}
                            </Descriptions.Item>
                        </Descriptions>
                    </div>
                </Card>
            ),
        },
        {
            key: "deals",
            label: `Deals (${deals.length})`,
            children: (
                <Card>
                    {deals.length > 0 ? (
                        <DataTable
                            dataSource={deals}
                            rowKey="id"
                            size="small"
                            scroll={{ x: "max-content" }}
                            columns={[
                                {
                                    title: "Deal Name",
                                    dataIndex: "name",
                                    key: "name",
                                    render: (name: string, record: any) => (
                                        <Link
                                            href={route(
                                                "deals.show",
                                                record.id,
                                            )}
                                            className="text-blue-600 hover:underline"
                                        >
                                            {name}
                                        </Link>
                                    ),
                                },
                                {
                                    title: "Stage",
                                    key: "stage",
                                    render: (_: any, record: any) =>
                                        record.lead_stage?.name ?? "--",
                                },
                                {
                                    title: "Pipeline",
                                    key: "pipeline",
                                    render: (_: any, record: any) =>
                                        record.pipeline?.name ?? "--",
                                },
                                {
                                    title: "Value",
                                    dataIndex: "value",
                                    key: "value",
                                    render: (val: number) =>
                                        val != null
                                            ? val.toLocaleString()
                                            : "--",
                                },
                                {
                                    title: "Created",
                                    dataIndex: "created_at",
                                    key: "created_at",
                                    render: (date: string) =>
                                        date
                                            ? formatCompanyDate(date)
                                            : "--",
                                },
                            ]}
                        />
                    ) : (
                        <Empty description={td("No deals assigned to this agent", { source: "en" })} />
                    )}
                </Card>
            ),
        },
    ];

    return (
        <>
            <PageLayout
                title={agent.user?.name ?? "Agent"}
                breadcrumbs={breadcrumbs}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <div className="flex justify-end gap-2">
                        {permissions.edit_lead_agent !== "none" && (
                            <Button
                                icon={<EditOutlined />}
                                onClick={() => handleAction("edit", agent)}
                            >
                                {td("Edit Agent", { source: "en" })}
                            </Button>
                        )}
                        {permissions.delete_lead_agent !== "none" && (
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleAction("delete", agent)}
                            >
                                {td("Delete", { source: "en" })}
                            </Button>
                        )}
                    </div>

                    <Tabs defaultActiveKey="profile" items={tabItems} />
                </div>
            </PageLayout>

            <SaveAgentModal
                open={action === "edit"}
                onClose={handleClose}
                agent={selected}
            />

            <DeleteAgent
                open={action === "delete"}
                onClose={() => handleClose()}
                agent={selected}
            />
        </>
    );
};

Show.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Show;
