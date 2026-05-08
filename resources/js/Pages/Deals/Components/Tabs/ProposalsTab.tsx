import { Deal } from "@/Types/api/deals";
import { Proposal } from "@/Types/api/proposal";
import {
    Button,
    Tag,
    Avatar,
    Empty,
    Dropdown,
    MenuProps,
    Space,
    Tooltip,
    Modal,
    message,
    Badge,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import {
    MoreOutlined,
    UserOutlined,
    EyeOutlined,
    DeleteOutlined,
    SendOutlined,
    DownloadOutlined,
    EditOutlined,
    FileTextOutlined,
    LinkOutlined,
    CheckOutlined,
    DollarOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { TableColumnsType } from "antd";
import { usePage } from "@inertiajs/react";
import AddProposal from "./proposals/AddProposal";
import EditProposal from "./proposals/EditProposal";
import DeleteProposal from "./proposals/DeleteProposal";

interface Props {
    deal: Deal;
    proposals: Proposal[];
    permissions: Record<string, string>;
}

export default function ProposalsTab({ deal, proposals, permissions }: Props) {
    const { props } = usePage();
    const user = props.auth.user;

    const handleRefresh = () => {
        window.location.reload();
    };

    const handleSendProposal = (proposal: Proposal) => {
        // Handle proposal sending via AJAX as in original implementation
        fetch(route("proposals.send_proposal", proposal.id), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN":
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute("content") || "",
            },
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.status === "success") {
                    message.success(
                        data.message || "Proposal sent successfully"
                    );
                    // Reload the page to refresh data
                    window.location.reload();
                } else {
                    message.error(data.message || "Failed to send proposal");
                }
            })
            .catch((error) => {
                console.error("Error sending proposal:", error);
                message.error("Failed to send proposal");
            });
    };

    const handleMarkSent = (proposal: Proposal) => {
        // Handle marking proposal as sent
        fetch(route("proposals.send_proposal", proposal.id), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-TOKEN":
                    document
                        .querySelector('meta[name="csrf-token"]')
                        ?.getAttribute("content") || "",
            },
            body: JSON.stringify({ type: "mark_sent" }),
        })
            .then((response) => response.json())
            .then((data) => {
                if (data.status === "success") {
                    message.success("Proposal marked as sent");
                    window.location.reload();
                } else {
                    message.error("Failed to mark proposal as sent");
                }
            })
            .catch((error) => {
                console.error("Error marking proposal as sent:", error);
                message.error("Failed to mark proposal as sent");
            });
    };

    const canViewProposal = (proposal: Proposal) => {
        return (
            permissions.view_lead_proposals === "all" ||
            (permissions.view_lead_proposals === "added" &&
                proposal.added_by === user?.id) ||
            (permissions.view_lead_proposals === "both" &&
                proposal.added_by === user?.id)
        );
    };

    const canEditProposal = (proposal: Proposal) => {
        return (
            !proposal.signature &&
            (permissions.edit_lead_proposals === "all" ||
                (permissions.edit_lead_proposals === "added" &&
                    proposal.added_by === user?.id))
        );
    };

    const canDeleteProposal = (proposal: Proposal) => {
        return (
            !proposal.signature &&
            (permissions.delete_lead_proposals === "all" ||
                (permissions.delete_lead_proposals === "added" &&
                    proposal.added_by === user?.id))
        );
    };

    const columns: TableColumnsType<Proposal> = [
        {
            title: "Proposal Number",
            dataIndex: "proposal_number",
            key: "proposal_number",
            width: "20%",
            render: (proposalNumber: string, record: Proposal) => (
                <div>
                    {canViewProposal(record) ? (
                        <a
                            href={route("proposals.show", record.id)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium text-blue-600 hover:text-blue-800"
                        >
                            {proposalNumber}
                        </a>
                    ) : (
                        <span className="font-medium text-gray-900">
                            {proposalNumber}
                        </span>
                    )}
                </div>
            ),
        },
        {
            title: "Total",
            dataIndex: "total",
            key: "total",
            width: "15%",
            render: (total: number, record: Proposal) => (
                <span className="font-semibold text-green-600">
                    {record.currency?.currency_symbol || "£"}
                    {total?.toLocaleString() || "0"}
                </span>
            ),
        },
        {
            title: "Date",
            dataIndex: "created_at",
            key: "created_at",
            width: "12%",
            render: (date: string) => (
                <span className="text-sm text-gray-600">
                    {dayjs(date).format("MMM DD, YYYY")}
                </span>
            ),
        },
        {
            title: "Valid Till",
            dataIndex: "valid_till",
            key: "valid_till",
            width: "12%",
            render: (date: string) => (
                <span className="text-sm text-gray-600">
                    {dayjs(date).format("MMM DD, YYYY")}
                </span>
            ),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: "15%",
            render: (status: string, record: Proposal) => (
                <Space direction="vertical" size={4}>
                    <Tag
                        color={
                            status === "waiting"
                                ? "gold"
                                : status === "accepted"
                                ? "green"
                                : status === "declined"
                                ? "red"
                                : "default"
                        }
                        icon={
                            status === "waiting" ? (
                                <EyeOutlined />
                            ) : status === "accepted" ? (
                                <CheckOutlined />
                            ) : status === "declined" ? (
                                <DeleteOutlined />
                            ) : undefined
                        }
                    >
                        {status === "waiting"
                            ? "Waiting"
                            : status === "accepted"
                            ? "Accepted"
                            : status === "declined"
                            ? "Declined"
                            : status}
                    </Tag>
                    {!record.send_status && (
                        <Badge status="default" text="Not Sent" />
                    )}
                </Space>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: "26%",
            render: (_, record: Proposal) => {
                const menuItems: MenuProps["items"] = [];

                // View action
                if (canViewProposal(record)) {
                    menuItems.push({
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
                    });
                }

                // Public link (if sent)
                if (record.send_status && record.hash) {
                    menuItems.push({
                        key: "public-link",
                        label: (
                            <a
                                href={route("front.proposal", {
                                    hash: record.hash,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <LinkOutlined className="mr-2" />
                                Public Link
                            </a>
                        ),
                    });
                }

                // Download action
                menuItems.push({
                    key: "download",
                    label: (
                        <a href={route("proposals.download", record.id)}>
                            <DownloadOutlined className="mr-2" />
                            Download
                        </a>
                    ),
                });

                // Edit action
                if (canEditProposal(record)) {
                    menuItems.push({
                        key: "edit",
                        label: (
                            <EditProposal
                                deal={deal}
                                proposal={record}
                                permissions={permissions}
                                user={user}
                                onSuccess={handleRefresh}
                                trigger="menu-item"
                            />
                        ),
                    });
                }

                // Send action
                if (record.status !== "declined") {
                    menuItems.push({
                        key: "send",
                        label: (
                            <span onClick={() => handleSendProposal(record)}>
                                <SendOutlined className="mr-2" />
                                Send
                            </span>
                        ),
                    });
                }

                // Mark sent action
                if (record.status !== "declined" && record.send_status === 0) {
                    menuItems.push({
                        key: "mark-sent",
                        label: (
                            <span onClick={() => handleMarkSent(record)}>
                                <CheckOutlined className="mr-2" />
                                Mark Sent
                            </span>
                        ),
                    });
                }

                // Create invoice action
                if (
                    permissions.add_invoices === "all" ||
                    (permissions.add_invoices === "added" &&
                        record.added_by === user?.id)
                ) {
                    menuItems.push({
                        key: "create-invoice",
                        label: (
                            <a
                                href={route("invoices.create", {
                                    proposal: record.id,
                                })}
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <DollarOutlined className="mr-2" />
                                Create Invoice
                            </a>
                        ),
                    });
                }

                // Delete action
                if (canDeleteProposal(record)) {
                    if (menuItems.length > 0) {
                        menuItems.push({ type: "divider" });
                    }
                    menuItems.push({
                        key: "delete",
                        label: (
                            <DeleteProposal
                                deal={deal}
                                proposal={record}
                                permissions={permissions}
                                user={user}
                                onSuccess={handleRefresh}
                                trigger="menu-item"
                            />
                        ),
                        danger: true,
                    });
                }

                return (
                    <Dropdown
                        menu={{ items: menuItems }}
                        trigger={["click"]}
                        disabled={menuItems.length === 0}
                    >
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

    return (
        <>
            {proposals.length === 0 && (
                <div className="p-8">
                    <Empty
                        description={
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">
                                    No proposals found
                                </p>

                                {(permissions.add_lead_proposals === "all" ||
                                    permissions.add_lead_proposals ===
                                        "added") && (
                                    <AddProposal
                                        deal={deal}
                                        permissions={permissions}
                                        onSuccess={handleRefresh}
                                        trigger="custom"
                                    >
                                        <Button type="primary">
                                            Create Proposal
                                        </Button>
                                    </AddProposal>
                                )}
                            </div>
                        }
                    />
                </div>
            )}
            {proposals.length > 0 && (
                <div className="p-6">
                    <div className="mb-4 flex justify-between items-center">
                        <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                                Proposals ({proposals.length})
                            </h3>
                            <p className="text-sm text-gray-500">
                                Manage and track deal proposals
                            </p>
                        </div>
                        {(permissions.add_lead_proposals === "all" ||
                            permissions.add_lead_proposals === "added") && (
                            <AddProposal
                                deal={deal}
                                permissions={permissions}
                                onSuccess={handleRefresh}
                                trigger="custom"
                            >
                                <Button
                                    type="primary"
                                    icon={<FileTextOutlined />}
                                >
                                    Add Proposal
                                </Button>
                            </AddProposal>
                        )}
                    </div>

                    <DataTable
                        columns={columns}
                        dataSource={proposals}
                        rowKey="id"
                        className="proposals-table"
                        scroll={{ x: "max-content" }}
                    />
                </div>
            )}
        </>
    );
}
