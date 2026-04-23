import React, { useState, useEffect } from "react";
import { usePage, router } from "@inertiajs/react";
import {
    Tag,
    Button,
    Dropdown,
    Empty,
    Drawer,
    Select,
    Spin,
    Pagination,
} from "antd";
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
    PlusOutlined,
    ClockCircleOutlined,
    TeamOutlined,
    CheckCircleOutlined,
    ThunderboltOutlined,
    UserOutlined,
    RightOutlined,
    FileTextOutlined,
    ReloadOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import {
    DealFollowup,
    PaginatedFollowupResponse,
} from "@/Types/api/deal-followup";
import { Deal } from "@/Types/api/deals";
import { getStatusColor, isLoading } from "@/lib/utils";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import EditFollowup from "@/Pages/Deals/Components/Tabs/followups/EditFollowup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import SaveFollowup from "@/Pages/Deals/Components/Tabs/followups/SaveFollowup";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { errorFormatter } from "@/lib/api/utils/common";
import usePageRefresh from "@/Hooks/usePageRefresh";
import useTranslation from "@/Hooks/useTranslation";

dayjs.extend(utc);

// ─── Types ───────────────────────────────────────────────────────────────────

interface OverviewStats {
    upcoming: number;
    this_week: number;
    live: number;
    completed: number;
}

interface MeetingsPageProps extends PageProps {
    pageTitle: string;
    overviewStats: OverviewStats;
    upcomingMeetings: PaginatedFollowupResponse;
    pastMeetings: PaginatedFollowupResponse;
    userDeals: { id: number; name: string }[];
    meetingTypes: { id: number; name: string }[];
    permissions: Record<string, string>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_DURATION = 30;

const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

const isLiveMeeting = (meeting: DealFollowup): boolean => {
    if (meeting.status !== "scheduled") return false;
    const duration = meeting.effective_duration ?? DEFAULT_DURATION;
    const start = dayjs.utc(meeting.next_follow_up_date).local();
    const end = start.add(duration, "minute");
    const now = dayjs();
    return now.isAfter(start) && now.isBefore(end);
};

const getPlatformIcon = (location: string) => {
    switch (location) {
        case "zoom":
            return <VideoCameraOutlined style={{ color: "#2D8CFF" }} />;
        case "teams":
            return <TeamOutlined style={{ color: "#6264A7" }} />;
        case "meet":
        case "google_meet":
            return <VideoCameraOutlined style={{ color: "#34A853" }} />;
        case "phone":
            return <PhoneOutlined style={{ color: "#FF6B35" }} />;
        case "office":
        case "physical":
            return <EnvironmentOutlined style={{ color: "#666" }} />;
        case "zoho":
            return <VideoCameraOutlined style={{ color: "#1890ff" }} />;
        default:
            return <VideoCameraOutlined style={{ color: "#1890ff" }} />;
    }
};

const getLocationLabel = (
    location: string,
    t: (k: string) => string,
): string => {
    const labels: Record<string, string> = {
        zoho: t("pages.meetings.platforms.video_meeting"),
        zoom: t("pages.meetings.platforms.zoom"),
        teams: t("pages.meetings.platforms.teams"),
        meet: t("pages.meetings.platforms.google_meet"),
        google_meet: t("pages.meetings.platforms.google_meet"),
        phone: t("pages.meetings.platforms.phone"),
        office: t("pages.meetings.platforms.office"),
        physical: t("pages.meetings.platforms.physical"),
        skype: t("pages.meetings.platforms.skype"),
        other: t("pages.meetings.platforms.other"),
    };
    return labels[location] ?? location;
};

// ─── Overview Card ───────────────────────────────────────────────────────────

interface StatCardProps {
    icon: React.ReactNode;
    label: string;
    value: number;
    color: string;
    bgColor: string;
}

const StatCard: React.FC<StatCardProps> = ({
    icon,
    label,
    value,
    color,
    bgColor,
}) => (
    <div
        className={`rounded-xl border p-5 flex items-center gap-4 transition-all hover:shadow-md ${bgColor}`}
    >
        <div
            className={`flex items-center justify-center w-12 h-12 rounded-lg ${color}`}
        >
            {icon}
        </div>
        <div>
            <p className="text-2xl font-bold text-gray-900 mb-0 leading-none">
                {value}
            </p>
            <p className="text-sm text-gray-500 mb-0 mt-1">{label}</p>
        </div>
    </div>
);

// ─── Meeting Card ────────────────────────────────────────────────────────────

interface MeetingCardProps {
    meeting: DealFollowup;
    permissions: Record<string, string>;
    userId?: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
}

const MeetingCard: React.FC<MeetingCardProps> = ({
    meeting,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
}) => {
    const { t } = useTranslation();
    const live = isLiveMeeting(meeting);
    const localDate = dayjs.utc(meeting.next_follow_up_date).local();
    const hasValidLink =
        meeting.meeting_link &&
        isSafeUrl(meeting.meeting_link) &&
        !["office", "phone", "physical"].includes(meeting.location);

    const canView =
        permissions.view_lead_follow_up === "all" ||
        (permissions.view_lead_follow_up === "added" &&
            meeting.added_by?.id === userId);
    const canEdit =
        permissions.edit_lead_follow_up === "all" ||
        (permissions.edit_lead_follow_up === "added" &&
            meeting.added_by?.id === userId);
    const canDelete =
        permissions.delete_lead_follow_up === "all" ||
        (permissions.delete_lead_follow_up === "added" &&
            meeting.added_by?.id === userId);

    const menuItems: MenuProps["items"] = [
        ...(canView
            ? [
                  {
                      key: "view",
                      label: (
                          <span>
                              <EyeOutlined className="mr-2" />
                              {t("pages.meetings.card.actions.view")}
                          </span>
                      ),
                      onClick: onView,
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
                              {t("pages.meetings.card.actions.edit")}
                          </span>
                      ),
                      onClick: onEdit,
                  },
              ]
            : []),
        ...(hasValidLink
            ? [
                  {
                      key: "join",
                      label: (
                          <a
                              href={meeting.meeting_link}
                              target="_blank"
                              rel="noopener noreferrer"
                          >
                              <LinkOutlined className="mr-2" />
                              {t("pages.meetings.card.actions.join_meeting")}
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
                              {t("pages.meetings.card.actions.delete")}
                          </span>
                      ),
                      danger: true,
                      onClick: onDelete,
                  },
              ]
            : []),
    ];

    const participantUsers = meeting.participant_users ?? [];

    // Non-video meeting locations (no meeting link / summary applicable)
    const isNonVideoLocation = ["office", "phone", "physical"].includes(
        meeting.location,
    );

    // Meeting link rendering — mirrors FollowUpTab.renderMeetingLink
    const renderMeetingLink = () => {
        if (isNonVideoLocation || !meeting.meeting_link) {
            const platformLabels: Record<string, string> = {
                office: "Office Meeting",
                phone: "Phone Meeting",
                physical: "Physical Meeting",
            };
            return (
                <span className="text-xs text-gray-500 whitespace-nowrap">
                    {platformLabels[meeting.location] ?? "Office Meeting"}
                </span>
            );
        }

        if (!isSafeUrl(meeting.meeting_link)) {
            return (
                <span className="text-xs text-gray-400">
                    {t("pages.meetings.card.invalid_link")}
                </span>
            );
        }

        return (
            <a
                href={meeting.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-xs font-medium whitespace-nowrap"
                onClick={(e) => e.stopPropagation()}
            >
                {getPlatformIcon(meeting.location)}
                <span className="underline">
                    {t("pages.meetings.card.actions.join_meeting")}
                </span>
            </a>
        );
    };

    // Summary status rendering — mirrors FollowUpTab.renderSummaryLink
    const renderSummaryStatus = () => {
        if (isNonVideoLocation || !meeting.meeting_link) {
            return <span className="text-xs text-gray-400">--</span>;
        }

        if (meeting.meeting_summary) {
            return (
                <span
                    className="inline-flex items-center gap-1 text-green-600 hover:text-green-800 text-xs font-medium cursor-pointer whitespace-nowrap"
                    onClick={(e) => {
                        e.stopPropagation();
                        onView();
                    }}
                >
                    <FileTextOutlined />
                    {t("pages.meetings.card.view_summary")}
                </span>
            );
        }

        return (
            <Tag color="orange" className="text-xs m-0 whitespace-nowrap">
                {t("pages.meetings.card.generating_summary")}
            </Tag>
        );
    };

    return (
        <div
            className={`group relative bg-white rounded-xl border transition-all cursor-pointer ${
                live
                    ? "border-red-300 ring-2 ring-red-100"
                    : "border-gray-200 hover:border-blue-200"
            }`}
            onClick={onView}
        >
            {/* Top bar with meeting type + live badge + actions */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="flex-shrink-0 text-lg">
                        {getPlatformIcon(meeting.location)}
                    </span>
                    <span className="font-medium text-gray-800 text-sm truncate">
                        {meeting.meeting_type?.name ??
                            getLocationLabel(meeting.location, t)}
                    </span>
                    {live && (
                        <Tag
                            color="red"
                            className="animate-pulse text-xs ml-1 flex-shrink-0"
                        >
                            <ThunderboltOutlined className="mr-1" />
                            {t("pages.meetings.card.live")}
                        </Tag>
                    )}
                </div>
                <div
                    className="flex-shrink-0"
                    onClick={(e) => e.stopPropagation()}
                >
                    {menuItems.length > 0 && (
                        <Dropdown
                            menu={{ items: menuItems }}
                            trigger={["click"]}
                        >
                            <Button
                                type="text"
                                icon={<MoreOutlined />}
                                size="small"
                                className="opacity-0 group-hover:opacity-100 transition-opacity"
                            />
                        </Dropdown>
                    )}
                </div>
            </div>

            {/* Deal name */}
            <div className="px-4 pb-2">
                {meeting.deal ? (
                    <p
                        className="text-blue-600 text-sm font-medium mb-0 truncate hover:underline"
                        onClick={(e) => {
                            e.stopPropagation();
                            router.visit(`/account/deals/${meeting.deal!.id}`);
                        }}
                    >
                        {meeting.deal.name}
                    </p>
                ) : (
                    <p className="text-gray-400 text-sm mb-0">
                        {t("pages.meetings.card.no_deal")}
                    </p>
                )}
            </div>

            {/* Date / Time / Status row */}
            <div className="px-4 pb-3 flex items-center gap-3 flex-wrap text-xs text-gray-500">
                <span className="flex items-center gap-1">
                    <CalendarOutlined />
                    {localDate.format("MMM DD, YYYY")}
                </span>
                <span className="flex items-center gap-1">
                    <ClockCircleOutlined />
                    {localDate.format("h:mm A")}
                </span>
                {/* <Tag
                    color={live ? "red" : getStatusColor(meeting.status)}
                    className="capitalize text-xs m-0"
                >
                    {live ? "In Progress" : meeting.status}
                </Tag> */}
            </div>

            {/* Meeting link + Summary status row */}
            <div
                className="px-4 pb-3 flex items-center justify-between gap-3"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-1 min-w-0">
                    {meeting.meeting_summary
                        ? renderSummaryStatus()
                        : renderMeetingLink()}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                    {renderSummaryStatus()}
                </div>
            </div>

            {/* Bottom row: participants + added_by */}
            <div className="border-t border-gray-100 px-4 py-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    {participantUsers.length > 0 ? (
                        <div className="flex items-center gap-1.5">
                            <MultiUserIndicator
                                users={participantUsers}
                                size="xs"
                                maxCount={3}
                                showNames={false}
                            />
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                                {participantUsers.length}{" "}
                                {participantUsers.length === 1
                                    ? t("pages.meetings.card.participant")
                                    : t("pages.meetings.card.participants")}
                            </span>
                        </div>
                    ) : (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                            <UserOutlined />{" "}
                            {t("pages.meetings.card.no_participants")}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                    {meeting.added_by && (
                        <span className="text-xs text-gray-400 truncate max-w-[100px]">
                            {t("pages.meetings.card.added_by")}{" "}
                            {meeting.added_by.name}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Section ─────────────────────────────────────────────────────────────────

interface MeetingSectionProps {
    title: string;
    total: number;
    data: PaginatedFollowupResponse;
    pageName: string;
    emptyMessage: string;
    permissions: Record<string, string>;
    userId?: number;
    onView: (m: DealFollowup) => void;
    onEdit: (m: DealFollowup) => void;
    onDelete: (m: DealFollowup) => void;
}

const MeetingSection: React.FC<MeetingSectionProps> = ({
    title,
    total,
    data,
    pageName,
    emptyMessage,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
}) => {
    const handlePageChange = (page: number, pageSize: number) => {
        const params: Record<string, number> = {
            [`${pageName}_page`]: page,
            [`${pageName}_per_page`]: pageSize,
        };
        router.get("/account/meetings", params, {
            preserveState: true,
            preserveScroll: true,
        });
    };

    return (
        <div>
            <div className="flex items-center gap-2 mb-4">
                <h2 className="text-lg font-semibold text-gray-800 mb-0">
                    {title}
                </h2>
                <Tag className="rounded-full text-xs font-medium">{total}</Tag>
            </div>

            {data.data.length === 0 ? (
                <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 py-12">
                    <Empty
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                        description={
                            <span className="text-gray-500">
                                {emptyMessage}
                            </span>
                        }
                    />
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {data.data.map((meeting) => (
                            <MeetingCard
                                key={meeting.id}
                                meeting={meeting}
                                permissions={permissions}
                                userId={userId}
                                onView={() => onView(meeting)}
                                onEdit={() => onEdit(meeting)}
                                onDelete={() => onDelete(meeting)}
                            />
                        ))}
                    </div>
                    {data.last_page > 1 && (
                        <div className="flex justify-center mt-6">
                            <Pagination
                                current={data.current_page}
                                total={data.total}
                                pageSize={data.per_page}
                                showTotal={(t, range) =>
                                    `${range[0]}-${range[1]} of ${t}`
                                }
                                onChange={handlePageChange}
                                size="small"
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

// ─── Schedule Meeting Drawer ─────────────────────────────────────────────────

interface ScheduleMeetingDrawerProps {
    open: boolean;
    onClose: () => void;
    userDeals: { id: number; name: string }[];
}

const ScheduleMeetingDrawer: React.FC<ScheduleMeetingDrawerProps> = ({
    open,
    onClose,
    userDeals,
}) => {
    const { t } = useTranslation();
    const [selectedDealId, setSelectedDealId] = useState<number | null>(null);
    const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null);
    const [loadingDeal, setLoadingDeal] = useState(false);
    const [errors, setErrors] = useState<string[]>([]);
    const [formKey, setFormKey] = useState(0);

    // Reset state when drawer opens
    useEffect(() => {
        if (open) {
            setSelectedDealId(null);
            setSelectedDeal(null);
            setErrors([]);
            setFormKey((prev) => prev + 1);
        }
    }, [open]);

    // Fetch deal details when a deal is selected
    useEffect(() => {
        if (!selectedDealId) {
            setSelectedDeal(null);
            return;
        }

        setLoadingDeal(true);
        fetch(`/account/meetings/deal/${selectedDealId}`, {
            headers: {
                Accept: "application/json",
                "X-Requested-With": "XMLHttpRequest",
            },
        })
            .then((res) => res.json())
            .then((json) => {
                if (json.success) {
                    setSelectedDeal(json.data);
                }
            })
            .catch(() => {
                setErrors([t("pages.meetings.schedule.failed_to_load")]);
            })
            .finally(() => setLoadingDeal(false));
    }, [selectedDealId]);

    const handleCancel = () => {
        setErrors([]);
        setSelectedDealId(null);
        setSelectedDeal(null);
        setFormKey((prev) => prev + 1);
        onClose();
    };

    const { mutate, status } = useApiMutate<any, null, ApiResponse<null>>(
        `/account/deals/follow-up-store`,
        "POST",
        () => {
            handleCancel();
        },
    );

    const onSubmit = (data: any) => {
        mutate(data, {
            onSuccess: () => {
                setErrors([]);
                setFormKey((prev) => prev + 1);
                router.reload();
            },
            onError: (errorResponse: any) => {
                const responseErrors =
                    errorFormatter(errorResponse)?.errors || [];
                setErrors(Object.values(responseErrors).flat() as string[]);
            },
        });
    };

    return (
        <Drawer
            title={t("app.meetings.schedule_drawer_title")}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnClose
        >
            <div className="space-y-6">
                {/* Step 1: Select deal */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        {t("app.meetings.select_deal_label")}{" "}
                        <span className="text-red-500">*</span>
                    </label>
                    <Select
                        showSearch
                        placeholder={t("app.meetings.select_deal_placeholder")}
                        optionFilterProp="label"
                        className="w-full"
                        value={selectedDealId}
                        onChange={(val) => setSelectedDealId(val)}
                        options={userDeals.map((d) => ({
                            value: d.id,
                            label: d.name,
                        }))}
                        filterOption={(input, option) =>
                            (option?.label as string)
                                ?.toLowerCase()
                                .includes(input.toLowerCase()) ?? false
                        }
                    />
                </div>

                {/* Loading state */}
                {loadingDeal && (
                    <div className="flex justify-center py-8">
                        <Spin tip={t("pages.meetings.schedule.loading_deal")} />
                    </div>
                )}

                {/* Step 2: SaveFollowup form */}
                {selectedDeal && !loadingDeal && (
                    <SaveFollowup
                        key={formKey}
                        deal={selectedDeal}
                        onSubmit={onSubmit}
                        onCancel={handleCancel}
                        loading={isLoading({ status })}
                        errors={errors}
                    />
                )}

                {/* Prompt when no deal selected */}
                {!selectedDealId && !loadingDeal && (
                    <div className="text-center py-8 text-gray-400">
                        <CalendarOutlined className="text-4xl mb-3 block" />
                        <p className="text-sm">
                            {t("pages.meetings.schedule.select_deal_prompt")}
                        </p>
                    </div>
                )}
            </div>
        </Drawer>
    );
};

// ─── Main Page Component ─────────────────────────────────────────────────────

function MeetingsIndex() {
    const { props } = usePage<MeetingsPageProps>();
    const {
        overviewStats,
        upcomingMeetings,
        pastMeetings,
        userDeals,
        permissions,
        pageTitle,
    } = props;
    const user = props.auth.user;

    const [scheduleOpen, setScheduleOpen] = useState(false);

    const {
        action,
        handleAction,
        handleClose,
        selected: meeting,
    } = useGenericEntityAction<DealFollowup>();

    const meetingDeal: Deal | undefined = meeting?.deal as Deal | undefined;

    const canAdd =
        permissions.add_lead_follow_up === "all" ||
        permissions.add_lead_follow_up === "added";

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh();
    const { t } = useTranslation();
    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <PageLayout
            title={t("app.menu.meetings")}
            breadcrumbs={[{ name: t("app.menu.meetings") }]}
        >
            <div className="px-4 sm:px-6 py-6 space-y-8">
                {/* ── Header ────────────────────────────────────────── */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h1 className="text-2xl font-bold text-gray-900 mb-0">
                        {t("app.meetings.my_meetings")}
                    </h1>
                    <div className="flex items-center gap-3">
                        <Button
                            icon={<ReloadOutlined spin={isRefreshing} />}
                            onClick={refresh}
                            disabled={isRefreshing}
                            type="text"
                        >
                            {t("app.common.actions.refresh")}
                        </Button>
                        {canAdd && (
                            <Button
                                type="primary"
                                icon={<PlusOutlined />}
                                onClick={() => setScheduleOpen(true)}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                {t("app.meetings.actions.schedule")}
                            </Button>
                        )}
                    </div>
                </div>

                {/* ── Overview Cards ────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={
                            <CalendarOutlined className="text-xl text-blue-600" />
                        }
                        label={t("app.meetings.stats.upcoming")}
                        value={overviewStats.upcoming}
                        color="bg-blue-100"
                        bgColor="bg-white border-blue-100"
                    />
                    <StatCard
                        icon={
                            <ClockCircleOutlined className="text-xl text-indigo-600" />
                        }
                        label={t("app.meetings.stats.this_week")}
                        value={overviewStats.this_week}
                        color="bg-indigo-100"
                        bgColor="bg-white border-indigo-100"
                    />
                    <StatCard
                        icon={
                            <ThunderboltOutlined className="text-xl text-red-600" />
                        }
                        label={t("app.meetings.stats.live_now")}
                        value={overviewStats.live}
                        color="bg-red-100"
                        bgColor="bg-white border-red-100"
                    />
                    <StatCard
                        icon={
                            <CheckCircleOutlined className="text-xl text-green-600" />
                        }
                        label={t("app.meetings.stats.completed")}
                        value={overviewStats.completed}
                        color="bg-green-100"
                        bgColor="bg-white border-green-100"
                    />
                </div>

                {/* ── Upcoming Section ──────────────────────────────── */}
                <MeetingSection
                    title={t("app.meetings.sections.upcoming")}
                    total={upcomingMeetings.total}
                    data={upcomingMeetings}
                    pageName="upcoming"
                    emptyMessage={t("app.meetings.empty.upcoming")}
                    permissions={permissions}
                    userId={user?.id}
                    onView={(m) => handleAction("view", m)}
                    onEdit={(m) => handleAction("edit", m)}
                    onDelete={(m) => handleAction("delete", m)}
                />

                {/* ── Past Section ──────────────────────────────────── */}
                <MeetingSection
                    title={t("app.meetings.sections.past")}
                    total={pastMeetings.total}
                    data={pastMeetings}
                    pageName="past"
                    emptyMessage={t("app.meetings.empty.past")}
                    permissions={permissions}
                    userId={user?.id}
                    onView={(m) => handleAction("view", m)}
                    onEdit={(m) => handleAction("edit", m)}
                    onDelete={(m) => handleAction("delete", m)}
                />
            </div>

            {/* ── Schedule Meeting Drawer ──────────────────────────── */}
            <ScheduleMeetingDrawer
                open={scheduleOpen}
                onClose={() => setScheduleOpen(false)}
                userDeals={userDeals}
            />

            {/* ── View Drawer ─────────────────────────────────────── */}
            {meeting && meetingDeal && (
                <ViewFollowup
                    open={action === "view"}
                    onClose={() => handleClose()}
                    followup={meeting}
                    deal={meetingDeal}
                    onEdit={() => handleAction("edit", meeting)}
                />
            )}

            {/* ── Edit Drawer ─────────────────────────────────────── */}
            {meeting && meetingDeal && (
                <EditFollowup
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={meetingDeal}
                    followup={meeting}
                />
            )}

            {/* ── Delete Modal ─────────────────────────────────────── */}
            <DeleteFollowup
                open={action === "delete"}
                onClose={() => handleClose()}
                followup={meeting}
            />
        </PageLayout>
    );
}

MeetingsIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default MeetingsIndex;
