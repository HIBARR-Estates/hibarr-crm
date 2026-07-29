import { Lead } from "@/Types/api/leads";
import { Deal } from "@/Types/api/deals";
import {
    Button,
    Dropdown,
    MenuProps,
    Tag,
    Empty,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import {
    MoreOutlined,
    EditOutlined,
    DeleteOutlined,
    VideoCameraOutlined as VideoCallOutlined,
    PlusOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { formatCompanyDate, formatCompanyTime } from "@/lib/companyDateTime";
import { DealFollowup } from "@/Types/api/deal-followup";
import type { TableColumnsType } from "antd";
import { Link, usePage } from "@inertiajs/react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import EditFollowup from "@/Pages/Deals/Components/Tabs/followups/EditFollowup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import { getStatusColor } from "@/lib/utils";
import useTranslation from "@/Hooks/useTranslation";

interface Props {
    lead: Lead;
    followUps: DealFollowup[];
    permissions: Record<string, string>;
    deals: Deal[] | { id: number; name: string }[];
    onScheduleMeeting?: () => void;
}

export default function LeadFollowUpTab({
    lead,
    followUps = [],
    permissions = {},
    deals = [],
    onScheduleMeeting,
}: Props) {
    const { props } = usePage();
    const { t } = useTranslation();
    const user = props.auth.user;
    const {
        action,
        handleAction,
        handleClose,
        selected: followUp,
    } = useGenericEntityAction<DealFollowup>();

    const dealsForLead = deals.map((d) => ({
        id: d.id,
        name: d.name,
    }));

    const viewDeal = followUp?.deal as Deal | undefined;

    const renderMeetingLink = (record: DealFollowup) => {
        const getPlatformLabel = (location: string) => {
            switch (location) {
                case "office":
                    return "Office Meeting";
                case "phone":
                    return "Phone Meeting";
                case "physical":
                    return "Physical Meeting";
                default:
                    return null;
            }
        };

        const platformLabel = getPlatformLabel(record.location);

        if (platformLabel || !record.meeting_link) {
            return (
                <span className="text-gray-500">
                    {platformLabel || "Office Meeting"}
                </span>
            );
        }

        return (
            <a
                href={record.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
            >
                <VideoCallOutlined className="text-blue-500" />
                <span className="underline">Join Meeting</span>
            </a>
        );
    };

    const columns: TableColumnsType<DealFollowup> = [
        {
            title: "Meeting Date",
            dataIndex: "next_follow_up_date",
            key: "next_follow_up_date",
            width: 160,
            fixed: "left" as const,
            render: (_, record) => (
                <div
                    className="cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleAction("view", record)}
                >
                    <div className="font-medium whitespace-nowrap">
                        {formatCompanyDate(record.next_follow_up_date)}
                    </div>
                    <div className="text-sm text-gray-500 whitespace-nowrap">
                        {formatCompanyTime(record.next_follow_up_date)}
                    </div>
                </div>
            ),
        },
        {
            title: t("app.meetings.linked_deal_column"),
            key: "linked_deal",
            width: 160,
            render: (_, record) =>
                record.deal?.id ? (
                    <Link
                        href={route("deals.show", record.deal.id)}
                        className="text-blue-600 hover:underline"
                    >
                        {record.deal.name}
                    </Link>
                ) : (
                    <span className="text-gray-400">—</span>
                ),
        },
        {
            title: "Meeting Type",
            dataIndex: "meeting_type",
            key: "meeting_type",
            width: 140,
            render: (_, record) =>
                record.meeting_type?.name ? (
                    <span>{record.meeting_type.name}</span>
                ) : (
                    <span className="text-gray-500">--</span>
                ),
        },
        {
            title: "Meeting Link",
            dataIndex: "meeting_link",
            key: "meeting_link",
            width: 150,
            render: (_, record) => renderMeetingLink(record),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 120,
            render: (_, { status }) => (
                <Tag
                    color={getStatusColor(status)}
                    className="capitalize whitespace-nowrap"
                >
                    {status}
                </Tag>
            ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 80,
            fixed: "right" as const,
            render: (_, record) => {
                if (!record.added_by) {
                    return null;
                }

                const canView =
                    permissions.view_lead_follow_up === "all" ||
                    (permissions.view_lead_follow_up === "added" &&
                        record.added_by?.id === user?.id);
                const canEdit =
                    record.deal_id &&
                    (permissions.edit_lead_follow_up === "all" ||
                        (permissions.edit_lead_follow_up === "added" &&
                            record.added_by?.id === user?.id));
                const canDelete =
                    permissions.delete_lead_follow_up === "all" ||
                    (permissions.delete_lead_follow_up === "added" &&
                        record.added_by?.id === user?.id);

                const menuItems: MenuProps["items"] = [
                    ...(canView
                        ? [
                              {
                                  key: "view",
                                  label: (
                                      <span>
                                          <EyeOutlined className="mr-2" />
                                          View
                                      </span>
                                  ),
                                  onClick: () => handleAction("view", record),
                              },
                          ]
                        : []),
                    ...(canEdit
                        ? [
                              {
                                  key: "edit",
                                  label: (
                                      <span>
                                          <EditOutlined className="mr-2" />
                                          Edit
                                      </span>
                                  ),
                                  onClick: () => handleAction("edit", record),
                              },
                          ]
                        : []),
                    ...(canDelete
                        ? [
                              {
                                  key: "delete",
                                  onClick: () =>
                                      handleAction("delete", record),
                                  label: (
                                      <span>
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

    const canAdd =
        permissions.add_lead_follow_up === "all" ||
        permissions.add_lead_follow_up === "added";

    return (
        <>
            {followUps.length === 0 && (
                <div className="p-8">
                    <Empty
                        description={
                            <div className="text-center">
                                <p className="text-gray-500 mb-2">
                                    No follow-ups found
                                </p>
                                {canAdd && onScheduleMeeting && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={onScheduleMeeting}
                                    >
                                        {t("pages.deals.actions.add_meeting")}
                                    </Button>
                                )}
                            </div>
                        }
                    />
                </div>
            )}
            {followUps.length > 0 && (
                <div className="p-6 flex flex-col gap-y-4">
                    {canAdd && onScheduleMeeting && (
                        <div className="flex justify-end">
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={onScheduleMeeting}
                            >
                                {t("pages.deals.actions.add_meeting")}
                            </Button>
                        </div>
                    )}
                    <div className="overflow-x-auto">
                    <DataTable
                        columns={columns}
                        dataSource={followUps}
                        rowKey="id"
                        className="follow-ups-table"
                        size="small"
                        scroll={{ x: "max-content" }}
                    />
                    </div>
                </div>
            )}

            {followUp && viewDeal && (
                <EditFollowup
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={viewDeal}
                    followup={followUp}
                />
            )}

            <DeleteFollowup
                open={action === "delete"}
                onClose={() => handleClose()}
                followup={followUp}
            />

            {followUp && (
                <ViewFollowup
                    open={action === "view"}
                    onClose={() => handleClose()}
                    followup={followUp}
                    deal={viewDeal}
                    lead={lead}
                />
            )}
        </>
    );
}
