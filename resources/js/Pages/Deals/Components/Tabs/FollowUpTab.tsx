import { Deal } from "@/Types/api/deals";
import {
    Button,
    Dropdown,
    MenuProps,
    Tag,
    Avatar,
    Tooltip,
    Empty,
} from "antd";
import { DataTable } from "@/Components/DataTable";
import {
    MoreOutlined,
    EditOutlined,
    DeleteOutlined,
    VideoCameraOutlined as VideoCallOutlined,
    CalendarOutlined,
    PlusOutlined,
    EyeOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { formatCompanyDate, formatCompanyTime } from "@/lib/companyDateTime";
import { DealFollowup } from "@/Types/api/deal-followup";
import type { TableColumnsType } from "antd";
import { usePage } from "@inertiajs/react";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { ContentRenderer } from "@/Components/ContentRenderer";
import AddFollowup from "./followups/AddFollowup";
import EditFollowup from "./followups/EditFollowup";
import DeleteFollowup from "./followups/DeleteFollowup";
import ViewFollowup from "./followups/ViewFollowup";
import BulkFollowupActionSelector from "./followups/bulk/BulkFollowupActionSelector";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import { getStatusColor } from "@/lib/utils";

interface Props {
    deal: Deal;
    followUps: DealFollowup[];
    permissions: Record<string, string>;
}

export default function FollowUpTab({ deal, followUps, permissions }: Props) {
    const { td } = useTd();
    const { props } = usePage();
    const user = props.auth.user;
    const { isWatcherOnly } = useDealPermissions(deal);
    const {
        action,
        handleAction,
        handleClose,
        selected: followUp,
    } = useGenericEntityAction<DealFollowup>();

    const renderMeetingLink = (record: DealFollowup) => {
        // Get platform label based on location
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
        
        // If it's a non-video meeting platform or no meeting link, show the platform label
        if (platformLabel || !record.meeting_link) {
            return (
                <span className="text-gray-500">
                    {platformLabel || "Office Meeting"}
                </span>
            );
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

    const renderSummaryLink = (record: DealFollowup) => {
        // Office, phone, and physical meetings don't have meeting summaries
            const nonVideoMeetingLocations = ['office', 'phone', 'physical'];
            if (nonVideoMeetingLocations.includes(record.location) || !record.meeting_link) {
                return <span className="text-gray-500">--</span>;
            }else{
                if (record.meeting_summary) {
                    return (
                        <Button
                            type="link"
                            size="small"
                            className="text-green-600 hover:text-green-800 p-0 h-auto whitespace-nowrap"
                            onClick={() => handleAction("view", record)}
                        >
                            View Summary
                        </Button>
                    );
                }
                return (
                    <Tag color="orange" className="text-xs whitespace-nowrap">
                        Pending
                    </Tag>
                );
            }
    }

    const columns: TableColumnsType<DealFollowup> = [
        {
            title: "Meeting Date",
            dataIndex: "next_follow_up_date",
            key: "next_follow_up_date",
            width: 160,
            fixed: "left" as const,
            render: (_, record) => (
                <div
                    className="flex items-center space-x-2 cursor-pointer hover:text-blue-600 transition-colors"
                    onClick={() => handleAction("view", record)}
                >
                    <div>
                        <div className="font-medium whitespace-nowrap">
                            {formatCompanyDate(record.next_follow_up_date)}
                        </div>
                        <div className="text-sm text-gray-500 whitespace-nowrap">
                            {formatCompanyTime(record.next_follow_up_date)}
                        </div>
                    </div>
                </div>
            ),
        },
        {
            title: "Meeting Type",
            dataIndex: "meeting_type",
            key: "meeting_type",
            width: 140,
            render: (_, record) =>
                record.meeting_type?.name ? (
                    <span className="">{td(record.meeting_type.name, { source: "en" })}</span>
                ) : (
                    <span className="text-gray-500">--</span>
                ),
        },
        {
            title: "Meeting Link",
            dataIndex: "meeting_link",
            key: "meeting_link",
            width: 150,
            render: (_, record) => record?.meeting_summary ? renderSummaryLink(record) : renderMeetingLink(record),
        },
        {
            title: "Status",
            dataIndex: "status",
            key: "status",
            width: 120,
            render: (_, { status }) => {
                return (
                    <Tag color={getStatusColor(status)} className="capitalize whitespace-nowrap">
                        {status}
                    </Tag>
                );
            },
        },
        {
            title: "Summary Status",
            key: "summary_status",
            width: 140,
           render: (_, record) => renderSummaryLink(record),
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
                    !isWatcherOnly &&
                    (permissions.edit_lead_follow_up === "all" ||
                        (permissions.edit_lead_follow_up === "added" &&
                            record.added_by?.id === user?.id));

                const canDelete =
                    !isWatcherOnly &&
                    (permissions.delete_lead_follow_up === "all" ||
                        (permissions.delete_lead_follow_up === "added" &&
                            record.added_by?.id === user?.id));

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
                                  onClick: () => {
                                      handleAction("delete", record);
                                  },
                                  label: (
                                      <span className="">
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

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<DealFollowup>();

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
                                {!isWatcherOnly &&
                                    (permissions.add_lead_follow_up === "all" ||
                                        permissions.add_lead_follow_up ===
                                            "added") &&
                                    deal.lead_stage?.slug !== "win" &&
                                    deal.lead_stage?.slug !== "lost" && (
                                        <Button
                                            type="primary"
                                            icon={<PlusOutlined />}
                                            onClick={() => handleAction("add")}
                                        >
                                            Schedule Meeting
                                        </Button>
                                    )}
                            </div>
                        }
                    />
                </div>
            )}
            {followUps.length > 0 && (
                <div className="p-6 flex flex-col gap-y-4">
                    <div className="flex justify-end">
                        {!isWatcherOnly && selectedEntities.length > 0 && (
                            <BulkFollowupActionSelector
                                selectedEntityIds={selectedEntities.map(
                                    (e) => e.id
                                )}
                                clearSelected={() => clearSelected()}
                            />
                        )}
                    </div>
                    <div className="overflow-x-auto">
                        <DataTable
                            columns={columns}
                            dataSource={followUps}
                            rowKey="id"
                            className="follow-ups-table"
                            size="small"
                            rowSelection={isWatcherOnly ? undefined : rowSelection}
                            scroll={{ x: "max-content" }}
                        />
                    </div>
                </div>
            )}
            {/* Add Follow-up Modal */}
            <AddFollowup
                context="deal"
                open={action === "add"}
                onClose={() => handleClose()}
                deal={deal}
            />

            {/* Edit Follow-up Modal */}
            {followUp && (
                <EditFollowup
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={deal}
                    followup={followUp}
                />
            )}

            {/* Delete Follow-up Modal */}
            <DeleteFollowup
                open={action === "delete"}
                onClose={() => handleClose()}
                followup={followUp}
            />

            {/* View Follow-up Modal */}
            {followUp && (
                <ViewFollowup
                    open={action === "view"}
                    onClose={() => handleClose()}
                    followup={followUp}
                    deal={deal}
                />
            )}
        </>
    );
}
