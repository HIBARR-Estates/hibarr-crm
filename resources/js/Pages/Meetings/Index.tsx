import { usePage, router } from "@inertiajs/react";
import { Table, Tabs, Tag, Button, Dropdown, Empty, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
    MoreOutlined,
    EditOutlined,
    EyeOutlined,
    DeleteOutlined,
    VideoCameraOutlined,
    CalendarOutlined,
    EnvironmentOutlined,
    PhoneOutlined,
    LinkOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import isBetween from "dayjs/plugin/isBetween";

import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import {
    DealFollowup,
    PaginatedFollowupResponse,
} from "@/Types/api/deal-followup";
import { Deal } from "@/Types/api/deals";
import { getStatusColor } from "@/lib/utils";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import EditFollowup from "@/Pages/Deals/Components/Tabs/followups/EditFollowup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";

dayjs.extend(utc);
dayjs.extend(isBetween);

// ─── Types ───────────────────────────────────────────────────────────────────

interface MeetingsPageProps extends PageProps {
    pageTitle: string;
    upcomingMeetings: PaginatedFollowupResponse;
    pastMeetings: PaginatedFollowupResponse;
    meetingTypes: { id: number; name: string }[];
    permissions: Record<string, string>;
    activeTab: "upcoming" | "past";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Only allow http(s) URLs for meeting links — prevents XSS via javascript: etc. */
const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

/** Check if a meeting is currently "in progress" (within 1 hour of start time) */
const isLive = (meeting: DealFollowup): boolean => {
    if (meeting.status !== "scheduled") return false;
    const start = dayjs.utc(meeting.next_follow_up_date).local();
    const now = dayjs();
    return now.isAfter(start) && now.isBefore(start.add(1, "hour"));
};

/** Get a human-readable platform label for non-video locations */
const getPlatformLabel = (location: string): string | null => {
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

const getMeetingIcon = (location: string) => {
    switch (location) {
        case "zoom":
            return <VideoCameraOutlined style={{ color: "#2D8CFF" }} />;
        case "teams":
            return <VideoCameraOutlined style={{ color: "#6264A7" }} />;
        case "meet":
        case "google_meet":
            return <VideoCameraOutlined style={{ color: "#34A853" }} />;
        case "phone":
            return <PhoneOutlined style={{ color: "#FF6B35" }} />;
        case "office":
        case "physical":
            return <EnvironmentOutlined style={{ color: "#666" }} />;
        default:
            return <VideoCameraOutlined style={{ color: "#1890ff" }} />;
    }
};

// ─── Component ───────────────────────────────────────────────────────────────

function MeetingsIndex() {
    const { props } = usePage<MeetingsPageProps>();
    const {
        upcomingMeetings,
        pastMeetings,
        permissions,
        activeTab,
        pageTitle,
    } = props;
    const user = props.auth.user;

    const {
        action,
        handleAction,
        handleClose,
        selected: meeting,
    } = useGenericEntityAction<DealFollowup>();

    // ── Navigation helpers ──────────────────────────────────────────────────

    const navigateTab = (tab: string) => {
        router.get(
            "/account/meetings",
            { tab, page: 1 },
            { preserveState: true, preserveScroll: true },
        );
    };

    const navigatePage = (tab: string, page: number, pageSize: number) => {
        router.get(
            "/account/meetings",
            { tab, page, per_page: pageSize },
            { preserveState: true, preserveScroll: true },
        );
    };

    // ── Render helpers ──────────────────────────────────────────────────────

    const renderMeetingLink = (record: DealFollowup) => {
        const platformLabel = getPlatformLabel(record.location);

        if (platformLabel || !record.meeting_link) {
            return (
                <span className="text-gray-500">
                    {platformLabel || "No link"}
                </span>
            );
        }

        if (!isSafeUrl(record.meeting_link)) {
            return <span className="text-gray-400">Invalid link</span>;
        }

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

    // ── Table columns ───────────────────────────────────────────────────────

    const columns: ColumnsType<DealFollowup> = [
        {
            title: "Date & Time",
            dataIndex: "next_follow_up_date",
            key: "next_follow_up_date",
            width: 180,
            fixed: "left" as const,
            render: (_, record) => {
                const localDate = dayjs.utc(record.next_follow_up_date).local();
                const live = isLive(record);
                return (
                    <div
                        className="flex items-center space-x-2 cursor-pointer hover:text-blue-600 transition-colors"
                        onClick={() => handleAction("view", record)}
                    >
                        <div>
                            <div className="font-medium whitespace-nowrap">
                                {localDate.format("MMM DD, YYYY")}
                            </div>
                            <div className="text-sm text-gray-500 whitespace-nowrap">
                                {localDate.format("h:mm A")}
                            </div>
                        </div>
                        {live && (
                            <Tag
                                color="red"
                                className="animate-pulse text-xs ml-1"
                            >
                                Live
                            </Tag>
                        )}
                    </div>
                );
            },
        },
        {
            title: "Deal",
            key: "deal",
            width: 180,
            ellipsis: true,
            render: (_, record) =>
                record.deal ? (
                    <a
                        href={`/account/deals/${record.deal.id}`}
                        className="text-blue-600 hover:text-blue-800 hover:underline"
                        onClick={(e) => {
                            e.preventDefault();
                            router.visit(`/account/deals/${record.deal!.id}`);
                        }}
                    >
                        {record.deal.name}
                    </a>
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
            render: (_, record) => {
                const live = isLive(record);
                if (live) {
                    return (
                        <Tag
                            color="red"
                            className="capitalize whitespace-nowrap animate-pulse"
                        >
                            In Progress
                        </Tag>
                    );
                }
                return (
                    <Tag
                        color={getStatusColor(record.status)}
                        className="capitalize whitespace-nowrap"
                    >
                        {record.status}
                    </Tag>
                );
            },
        },
        {
            title: "Scheduled By",
            key: "added_by",
            width: 140,
            render: (_, record) =>
                record.added_by ? (
                    <span className="text-gray-700">
                        {record.added_by.name}
                    </span>
                ) : (
                    <span className="text-gray-400">—</span>
                ),
        },
        {
            title: "Actions",
            key: "actions",
            width: 80,
            fixed: "right" as const,
            render: (_, record) => {
                const canView =
                    permissions.view_lead_follow_up === "all" ||
                    (permissions.view_lead_follow_up === "added" &&
                        record.added_by?.id === user?.id);
                const canEdit =
                    permissions.edit_lead_follow_up === "all" ||
                    (permissions.edit_lead_follow_up === "added" &&
                        record.added_by?.id === user?.id);
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
                    // "Join Meeting" action — only for video meetings with a valid link
                    ...(record.meeting_link &&
                    isSafeUrl(record.meeting_link) &&
                    !["office", "phone", "physical"].includes(record.location)
                        ? [
                              {
                                  key: "join",
                                  label: (
                                      <a
                                          href={record.meeting_link}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                      >
                                          <LinkOutlined className="mr-2" />
                                          Join Meeting
                                      </a>
                                  ),
                              },
                          ]
                        : []),
                    ...(canDelete
                        ? [
                              {
                                  key: "delete",
                                  label: (
                                      <span>
                                          <DeleteOutlined className="mr-2" />
                                          Delete
                                      </span>
                                  ),
                                  danger: true,
                                  onClick: () => handleAction("delete", record),
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

    // ── Tab content renderers ───────────────────────────────────────────────

    const renderTable = (
        data: PaginatedFollowupResponse,
        tab: "upcoming" | "past",
        emptyMessage: string,
    ) => {
        if (data.total === 0) {
            return (
                <div className="py-16">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <span className="text-gray-500">
                                {emptyMessage}
                            </span>
                        }
                    />
                </div>
            );
        }

        return (
            <Table
                columns={columns}
                dataSource={data.data}
                rowKey="id"
                size="small"
                scroll={{ x: 1000 }}
                pagination={{
                    current: data.current_page,
                    total: data.total,
                    pageSize: data.per_page,
                    showSizeChanger: true,
                    showQuickJumper: true,
                    showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} meetings`,
                    onChange: (page, pageSize) =>
                        navigatePage(tab, page, pageSize),
                }}
            />
        );
    };

    const tabItems = [
        {
            key: "upcoming",
            label: (
                <span className="flex items-center gap-x-2">
                    <CalendarOutlined />
                    Upcoming
                    {upcomingMeetings.total > 0 && (
                        <Tag className="ml-1">{upcomingMeetings.total}</Tag>
                    )}
                </span>
            ),
            children: renderTable(
                upcomingMeetings,
                "upcoming",
                "No upcoming meetings scheduled.",
            ),
        },
        {
            key: "past",
            label: (
                <span className="flex items-center gap-x-2">
                    <CalendarOutlined />
                    Past
                    {pastMeetings.total > 0 && (
                        <Tag className="ml-1">{pastMeetings.total}</Tag>
                    )}
                </span>
            ),
            children: renderTable(
                pastMeetings,
                "past",
                "No past meetings found.",
            ),
        },
    ];

    // ── Determine the deal for the detail drawer ───────────────────────────

    const meetingDeal: Deal | undefined = meeting?.deal as Deal | undefined;

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <PageLayout
            title={pageTitle || "Meetings"}
            breadcrumbs={[{ name: "Meetings" }]}
        >
            <div className="px-6 py-4">
                <Tabs
                    activeKey={activeTab}
                    onChange={navigateTab}
                    items={tabItems}
                    className="meetings-tabs"
                />
            </div>

            {/* View Meeting Drawer — reuses existing ViewFollowup */}
            {meeting && meetingDeal && (
                <ViewFollowup
                    open={action === "view"}
                    onClose={() => handleClose()}
                    followup={meeting}
                    deal={meetingDeal}
                    onEdit={() => handleAction("edit", meeting)}
                />
            )}

            {/* Edit Meeting Drawer */}
            {meeting && meetingDeal && (
                <EditFollowup
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={meetingDeal}
                    followup={meeting}
                />
            )}

            {/* Delete Meeting Confirmation */}
            <DeleteFollowup
                open={action === "delete"}
                onClose={() => handleClose()}
                followup={meeting}
            />
        </PageLayout>
    );
}

// Assign layout
MeetingsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default MeetingsIndex;
