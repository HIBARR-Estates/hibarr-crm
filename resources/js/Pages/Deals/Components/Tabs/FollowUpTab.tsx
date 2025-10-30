import { Deal } from "@/Types/api/deals";
import {
    Table,
    Button,
    Dropdown,
    MenuProps,
    Tag,
    Avatar,
    Tooltip,
    Empty,
} from "antd";
import {
    MoreOutlined,
    UserOutlined,
    EditOutlined,
    DeleteOutlined,
    VideoCallOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import { Link } from "@inertiajs/react";
import dayjs from "dayjs";

interface Props {
    deal: Deal;
    followUps: any[];
    permissions: Record<string, string>;
}

export default function FollowUpTab({ deal, followUps, permissions }: Props) {
    const handleDeleteFollowUp = (followUpId: number) => {
        if (confirm("Are you sure you want to delete this follow-up?")) {
            // Handle deletion
            window.location.href = route("deals.follow_up_delete", followUpId);
        }
    };

    const renderMeetingLink = (record: any) => {
        if (record.location === "office" || !record.meeting_link) {
            return <span className="text-gray-500">Office Meeting</span>;
        }

        const getMeetingIcon = (location: string) => {
            switch (location) {
                case "zoom":
                    return (
                        <img
                            src="https://img.icons8.com/color/20/000000/zoom.png"
                            alt="Zoom"
                            className="w-5 h-5"
                        />
                    );
                case "google_meet":
                    return (
                        <img
                            src="https://img.icons8.com/color/20/000000/google-meet.png"
                            alt="Google Meet"
                            className="w-5 h-5"
                        />
                    );
                case "teams":
                    return (
                        <img
                            src="https://img.icons8.com/color/20/000000/microsoft-teams.png"
                            alt="Microsoft Teams"
                            className="w-5 h-5"
                        />
                    );
                default:
                    return <VideoCallOutlined className="text-blue-500" />;
            }
        };

        return (
            <a
                href={record.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
            >
                {getMeetingIcon(record.location)}
                <span className="underline">Join Meeting</span>
            </a>
        );
    };

    const columns = [
        {
            title: "Next Follow-up",
            dataIndex: "next_follow_up_date",
            key: "next_follow_up_date",
            width: "20%",
            render: (date: string) => (
                <div className="flex items-center space-x-2">
                    <CalendarOutlined className="text-gray-400" />
                    <div>
                        <div className="font-medium">
                            {dayjs(date).format("MMM DD, YYYY")}
                        </div>
                        <div className="text-sm text-gray-500">
                            {dayjs(date).format("h:mm A")}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Meeting Type",
            dataIndex: "meeting_type",
            key: "meeting_type",
            width: "15%",
            render: (_, record: any) =>
                record.meeting_type?.name ? (
                    <Tag color="blue">{record.meeting_type.name}</Tag>
                ) : (
                    <span className="text-gray-500">--</span>
                ),
        },
        {
            title: "Summary",
            dataIndex: "summary",
            key: "summary",
            width: "25%",
            render: (summary: string) =>
                summary ? (
                    <Tooltip title={summary}>
                        <div className="max-w-xs truncate text-sm">
                            {summary}
                        </div>
                    </Tooltip>
                ) : (
                    <span className="text-gray-500">--</span>
                ),
        },
        {
            title: "Meeting Link",
            dataIndex: "meeting_link",
            key: "meeting_link",
            width: "15%",
            render: (_, record: any) => renderMeetingLink(record),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: "10%",
            render: (status: string) => {
                const statusConfig = {
                    completed: { color: "green", text: "Completed" },
                    incomplete: { color: "orange", text: "Pending" },
                    cancelled: { color: "red", text: "Cancelled" },
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
            width: "10%",
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
            title: "Actions",
            key: "actions",
            width: "5%",
            render: (_, record: any) => {
                const canEdit =
                    permissions.edit_lead_follow_up === "all" ||
                    (permissions.edit_lead_follow_up === "added" &&
                        record.added_by?.id === window.user?.id);

                const canDelete =
                    permissions.delete_lead_follow_up === "all" ||
                    (permissions.delete_lead_follow_up === "added" &&
                        record.added_by?.id === window.user?.id);

                const menuItems: MenuProps["items"] = [
                    ...(canEdit
                        ? [
                              {
                                  key: "edit",
                                  label: (
                                      <span
                                          onClick={() => {
                                              window.location.href = route(
                                                  "deals.follow_up_edit",
                                                  record.id
                                              );
                                          }}
                                      >
                                          <EditOutlined className="mr-2" />
                                          Edit
                                      </span>
                                  ),
                              },
                          ]
                        : []),
                    ...(canDelete
                        ? [
                              {
                                  key: "delete",
                                  label: (
                                      <span
                                          className="text-red-600"
                                          onClick={() =>
                                              handleDeleteFollowUp(record.id)
                                          }
                                      >
                                          <DeleteOutlined className="mr-2" />
                                          Delete
                                      </span>
                                  ),
                                  danger: true,
                              },
                          ]
                        : []),
                ];

                return menuItems.length > 0 ? (
                    <Dropdown menu={{ items: menuItems }} trigger={["click"]}>
                        <Button
                            type="text"
                            icon={<MoreOutlined />}
                            size="small"
                        />
                    </Dropdown>
                ) : null;
            },
        },
    ];

    if (followUps.length === 0) {
        return (
            <div className="p-8">
                <Empty
                    description={
                        <div className="text-center">
                            <p className="text-gray-500 mb-2">
                                No follow-ups found
                            </p>
                            {(permissions.add_lead_follow_up === "all" ||
                                permissions.add_lead_follow_up === "added") &&
                                deal.lead_stage?.slug !== "win" &&
                                deal.lead_stage?.slug !== "lost" && (
                                    <Button
                                        type="primary"
                                        onClick={() => {
                                            window.location.href = route(
                                                "deals.follow_up",
                                                deal.id
                                            );
                                        }}
                                    >
                                        Create First Follow-up
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
                dataSource={followUps}
                rowKey="id"
                pagination={{
                    pageSize: 10,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total) => `Total ${total} follow-ups`,
                }}
                className="follow-ups-table"
            />
        </div>
    );
}
