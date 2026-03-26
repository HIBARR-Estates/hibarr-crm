import React, { useCallback } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Agent, AgentShowProps } from "@/Types/api/agents";
import {
    Card,
    Tabs,
    Tag,
    Descriptions,
    Table,
    Button,
    Dropdown,
    Empty,
} from "antd";
import {
    EditOutlined,
    DeleteOutlined,
    MailOutlined,
    PhoneOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import dayjs from "dayjs";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import UserIndicator from "@/Components/UserIndicator";
import SaveAgentModal from "@/Features/Agents/SaveAgentModal";
import DeleteAgent from "@/Features/Agents/DeleteAgent";

const Show = ({
    pageTitle,
    agent,
    agentCategories,
    deals,
    permissions,
}: AgentShowProps) => {
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
                            <Descriptions.Item label="Email">
                                {agent.user?.email ? (
                                    <a href={`mailto:${agent.user.email}`}>
                                        <MailOutlined className="mr-1" />
                                        {agent.user.email}
                                    </a>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Phone">
                                {agent.user?.mobile_with_phone_code ? (
                                    <span>
                                        <PhoneOutlined className="mr-1" />
                                        {agent.user.mobile_with_phone_code}
                                    </span>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Categories" span={2}>
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
                            <Descriptions.Item label="Agent ID">
                                {agent.id}
                            </Descriptions.Item>
                            <Descriptions.Item label="Total Deals">
                                {agent.deals_count ?? deals.length}
                            </Descriptions.Item>
                            <Descriptions.Item label="Created">
                                {agent.created_at
                                    ? dayjs(agent.created_at).format(
                                          "MMM DD, YYYY",
                                      )
                                    : "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Last Updated">
                                {agent.updated_at
                                    ? dayjs(agent.updated_at).format(
                                          "MMM DD, YYYY",
                                      )
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
                        <Table
                            dataSource={deals}
                            rowKey="id"
                            size="small"
                            pagination={{ pageSize: 10 }}
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
                                            ? dayjs(date).format("MMM DD, YYYY")
                                            : "--",
                                },
                            ]}
                        />
                    ) : (
                        <Empty description="No deals assigned to this agent" />
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
                                Edit Agent
                            </Button>
                        )}
                        {permissions.delete_lead_agent !== "none" && (
                            <Button
                                danger
                                icon={<DeleteOutlined />}
                                onClick={() => handleAction("delete", agent)}
                            >
                                Delete
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
