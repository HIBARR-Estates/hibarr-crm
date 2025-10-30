import { Deal } from "@/Types/api/deals";
import { Table, Button, Tag, Avatar, Empty, Dropdown, MenuProps } from "antd";
import {
    MoreOutlined,
    UserOutlined,
    EyeOutlined,
    DeleteOutlined,
    SendOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";

interface Props {
    deal: Deal;
    proposals: any[];
    permissions: Record<string, string>;
}

export default function ProposalsTab({ deal, proposals, permissions }: Props) {
    const handleDeleteProposal = (proposalId: number) => {
        if (confirm("Are you sure you want to delete this proposal?")) {
            window.location.href = route("proposals.destroy", proposalId);
        }
    };

    const handleSendProposal = (proposalId: number) => {
        // Handle proposal sending
        console.log("Send proposal:", proposalId);
    };

    const columns = [
        {
            title: "Proposal Title",
            dataIndex: "title",
            key: "title",
            width: "25%",
            render: (title: string, record: any) => (
                <div>
                    <div className="font-medium text-gray-900">{title}</div>
                    <div className="text-sm text-gray-500">#{record.id}</div>
                </div>
            ),
        },
        {
            title: "Total",
            dataIndex: "total",
            key: "total",
            width: "15%",
            render: (total: number, record: any) => (
                <span className="font-semibold text-green-600">
                    {record.currency?.currency_symbol || "£"}
                    {total?.toLocaleString() || "0"}
                </span>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: "15%",
            render: (status: string) => {
                const statusConfig = {
                    draft: { color: "default", text: "Draft" },
                    sent: { color: "blue", text: "Sent" },
                    accepted: { color: "green", text: "Accepted" },
                    declined: { color: "red", text: "Declined" },
                    expired: { color: "orange", text: "Expired" },
                };
                const config = statusConfig[
                    status as keyof typeof statusConfig
                ] || { color: "default", text: status };

                return <Tag color={config.color}>{config.text}</Tag>;
            },
        },
        {
            title: "Created By",
            dataIndex: "added_by",
            key: "added_by",
            width: "15%",
            render: (addedBy: any) => (
                <div className="flex items-center space-x-2">
                    <Avatar
                        size="small"
                        src={addedBy?.image}
                        icon={<UserOutlined />}
                    />
                    <span className="text-sm">
                        {addedBy?.name || "Unknown"}
                    </span>
                </div>
            ),
        },
        {
            title: "Created On",
            dataIndex: "created_at",
            key: "created_at",
            width: "15%",
            render: (date: string) => (
                <span className="text-sm text-gray-600">
                    {dayjs(date).format("MMM DD, YYYY")}
                </span>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: "15%",
            render: (_, record: any) => {
                const menuItems: MenuProps["items"] = [
                    {
                        key: "view",
                        label: (
                            <a
                                href={route("proposals.show", record.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <EyeOutlined className="mr-2" />
                                View
                            </a>
                        ),
                    },
                    {
                        key: "send",
                        label: (
                            <span onClick={() => handleSendProposal(record.id)}>
                                <SendOutlined className="mr-2" />
                                Send
                            </span>
                        ),
                    },
                    {
                        key: "delete",
                        label: (
                            <span
                                className="text-red-600"
                                onClick={() => handleDeleteProposal(record.id)}
                            >
                                <DeleteOutlined className="mr-2" />
                                Delete
                            </span>
                        ),
                        danger: true,
                    },
                ];

                return (
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                        />
                    </Dropdown>
                );
            },
        },
    ];

    if (proposals.length === 0) {
        return (
            <div className="p-8">
                <Empty
                    description={
                        <div className="text-center">
                            <p className="text-gray-500 mb-2">
                                No proposals found
                            </p>
                            {(permissions.add_lead_proposals === "all" ||
                                permissions.add_lead_proposals === "added") && (
                                <Button
                                    type="primary"
                                    onClick={() => {
                                        window.open(
                                            route("proposals.create", {
                                                deal_id: deal.id,
                                            }),
                                            "_blank"
                                        );
                                    }}
                                >
                                    Create First Proposal
                                </Button>
                            )}
                        </div>
                    }
                />
            </div>
        );
    }

    return (
        <div className="p-6">
            <Table
                columns={columns}
                dataSource={proposals}
                rowKey="id"
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `Total ${total} proposals`,
                }}
                className="proposals-table"
            />
        </div>
    );
}
