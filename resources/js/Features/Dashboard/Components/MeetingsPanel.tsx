import React, { useState } from "react";
import { Card, Button, Dropdown, MenuProps } from "antd";
import {
    CalendarOutlined,
    DeleteOutlined,
    EditOutlined,
    EnvironmentOutlined,
    EyeOutlined,
    LinkOutlined,
    MoreOutlined,
    PhoneOutlined,
    PlusOutlined,
    TeamOutlined,
    UserOutlined,
    VideoCameraOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import dayjs from "dayjs";
import { formatCompanyDate, formatCompanyTime } from "@/lib/companyDateTime";
import relativeTime from "dayjs/plugin/relativeTime";

import ScheduleMeetingDrawer from "@/Features/Meetings/ScheduleMeetingDrawer";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import EditFollowup from "@/Pages/Deals/Components/Tabs/followups/EditFollowup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { DealFollowup } from "@/Types/api/deal-followup";
import { Deal } from "@/Types/api/deals";
import { Lead } from "@/Types/api/leads";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

dayjs.extend(relativeTime);

const isSafeUrl = (url: string) => /^https?:\/\//i.test(url);

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

interface MeetingPermissions {
    add_lead_follow_up?: string;
}

interface MeetingsPanelProps {
    meetings: DealFollowup[];
    userDeals?: { id: number; name: string }[];
    userLeads?: { id: number; name: string }[];
    meetingPermissions?: MeetingPermissions;
}

const MeetingsPanel: React.FC<MeetingsPanelProps> = ({
    meetings = [],
    userDeals = [],
    userLeads = [],
    meetingPermissions = {},
}) => {
    const { t } = useTranslation();
    const { td } = useTd();
    const [scheduleOpen, setScheduleOpen] = useState(false);

    const { action, handleAction, handleClose, selected: selectedMeeting } =
        useGenericEntityAction<DealFollowup>();
    const meetingDeal = selectedMeeting?.deal as Deal | undefined;
    const meetingLead = selectedMeeting?.lead;

    const canAdd =
        meetingPermissions.add_lead_follow_up === "all" ||
        meetingPermissions.add_lead_follow_up === "added";

    const handleMeetingCreated = () => {
        router.reload({ only: ["upcomingMeetings"] });
    };

    const renderMeetingLink = (meeting: DealFollowup) => {
        const location = meeting.location ?? "zoho";
        const isNonVideoLocation = ["office", "phone", "physical"].includes(location);

        if (isNonVideoLocation || !meeting.meeting_link) {
            const platformLabels: Record<string, string> = {
                office: t("pages.meetings.platforms.office"),
                phone: t("pages.meetings.platforms.phone"),
                physical: t("pages.meetings.platforms.physical"),
            };
            return (
                <span>
                    {platformLabels[location] ?? t("pages.meetings.platforms.office")}
                </span>
            );
        }

        if (!isSafeUrl(meeting.meeting_link)) {
            return <span>{t("pages.meetings.card.invalid_link")}</span>;
        }

        return (
            <a
                href={meeting.meeting_link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium"
            >
                <LinkOutlined />
                <span className="underline">
                    {t("pages.meetings.card.actions.join_meeting")}
                </span>
            </a>
        );
    };

    const renderEntityLink = (meeting: DealFollowup) => {
        if (meeting.deal) {
            return (
                <Link
                    href={route("deals.show", meeting.deal.id)}
                    className="truncate text-xs font-medium text-blue-600 hover:underline"
                >
                    {td(meeting.deal.name)}
                </Link>
            );
        }

        if (meeting.lead) {
            return (
                <Link
                    href={route("lead-contact.show", meeting.lead.id)}
                    className="truncate text-xs font-medium text-blue-600 hover:underline"
                >
                    {td(
                        meeting.lead.client_name_salutation ||
                            meeting.lead.client_name,
                    )}
                </Link>
            );
        }

        return null;
    };

    const getMeetingMenuItems = (meeting: DealFollowup): MenuProps["items"] => [
        {
            key: "view",
            label: t("pages.meetings.card.actions.view"),
            icon: <EyeOutlined />,
            onClick: () => handleAction("view", meeting),
        },
        {
            key: "edit",
            label: t("pages.meetings.card.actions.edit"),
            icon: <EditOutlined />,
            onClick: () => handleAction("edit", meeting),
        },
        { type: "divider" },
        {
            key: "delete",
            label: t("pages.meetings.card.actions.delete"),
            danger: true,
            icon: <DeleteOutlined />,
            onClick: () => handleAction("delete", meeting),
        },
    ];

    return (
        <>
            <Card
                title={
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarOutlined className="text-blue-600" />
                            <span>{t("app.meetings.sections.upcoming")}</span>
                            <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-600 px-1 text-[10px] font-bold leading-none text-white">
                                {meetings.length}
                            </span>
                        </div>
                        {canAdd && (
                            <Button
                                type="primary"
                                size="small"
                                icon={<PlusOutlined />}
                                onClick={() => setScheduleOpen(true)}
                            >
                                {t("app.meetings.actions.schedule")}
                            </Button>
                        )}
                    </div>
                }
                className="flex flex-col"
                style={{ height: "60vh" }}
                styles={{
                    body: {
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        overflow: "hidden",
                        minHeight: 0,
                        padding: 0,
                    },
                }}
                variant="outlined"
            >
                {meetings.length === 0 ? (
                    <div className="flex flex-1 flex-col items-center justify-center overflow-hidden">
                        <div className="py-8 text-center text-gray-500">
                            <CalendarOutlined className="mb-2 text-4xl text-gray-300" />
                            <div>{t("app.meetings.empty.upcoming")}</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
                        {meetings.map((meeting) => {
                            const start = dayjs(meeting.next_follow_up_date);
                            const isPast = start.isBefore(dayjs());
                            const isSoon =
                                !isPast && start.diff(dayjs(), "hour") <= 24;
                            const accentColor = isPast
                                ? "#ef4444"
                                : isSoon
                                  ? "#6366f1"
                                  : "#e2e8f0";
                            const participants = meeting.participant_users ?? [];

                            return (
                                <div
                                    key={meeting.id}
                                    className="group px-4 py-3 transition-colors hover:bg-slate-50/70"
                                >
                                    <div className="flex gap-3">
                                        {/* Time column */}
                                        <div className="flex min-w-[50px] flex-col items-center justify-start pt-0.5 text-center">
                                            <span className="text-xl font-bold leading-none tabular-nums text-slate-800">
                                                {formatCompanyTime(start)}
                                            </span>
                                            <span className="mt-1 text-sm font-semibold leading-tight text-slate-400">
                                                {formatCompanyDate(start)}
                                            </span>
                                        </div>

                                        {/* Accent bar */}
                                        <div
                                            className="my-0.5 w-0.5 shrink-0 self-stretch rounded-full"
                                            style={{ backgroundColor: accentColor }}
                                        />

                                        {/* Content */}
                                        <div className="min-w-0 flex-1 space-y-1.5">
                                            {/* Row 1: title + time badge + context menu */}
                                            <div className="flex items-center gap-1.5">
                                                <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-snug text-slate-800">
                                                    {meeting.meeting_type?.name
                                                        ? td(meeting.meeting_type.name)
                                                        : td(meeting.remark || "Meeting")}
                                                </span>
                                                <span
                                                    className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-semibold leading-none ${
                                                        isPast
                                                            ? "border-red-200 bg-red-50 text-red-700"
                                                            : isSoon
                                                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                                                              : "border-slate-200 bg-slate-100 text-slate-500"
                                                    }`}
                                                >
                                                    {start.fromNow()}
                                                </span>
                                                <div className="shrink-0 opacity-0 transition-opacity group-hover:opacity-100">
                                                    <Dropdown
                                                        menu={{ items: getMeetingMenuItems(meeting) }}
                                                        trigger={["click"]}
                                                        placement="bottomRight"
                                                    >
                                                        <Button
                                                            size="small"
                                                            icon={<MoreOutlined />}
                                                            type="text"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </Dropdown>
                                                </div>
                                            </div>

                                            {/* Row 2: location icon + link/label */}
                                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                {getPlatformIcon(meeting.location ?? "zoho")}
                                                {renderMeetingLink(meeting)}
                                            </div>

                                            {/* Row 3: participants (left) + entity link (right) */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex shrink-0 items-center gap-1.5">
                                                    {participants.length > 0 ? (
                                                        <>
                                                            <MultiUserIndicator
                                                                users={participants}
                                                                size="sm"
                                                                maxCount={3}
                                                                showNames={false}
                                                                showTooltip
                                                                colorful
                                                            />
                                                            <span className="text-[11px] text-slate-400">
                                                                {participants.length}{" "}
                                                                {participants.length === 1
                                                                    ? t("pages.meetings.card.participant")
                                                                    : t("pages.meetings.card.participants")}
                                                            </span>
                                                        </>
                                                    ) : (
                                                        <span className="flex items-center gap-1 text-[11px] text-slate-400">
                                                            <UserOutlined />
                                                            {t("pages.meetings.card.no_participants")}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="min-w-0 flex-1 text-right">
                                                    {renderEntityLink(meeting)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </Card>

            {canAdd && (
                <ScheduleMeetingDrawer
                    open={scheduleOpen}
                    onClose={() => setScheduleOpen(false)}
                    userDeals={userDeals}
                    userLeads={userLeads}
                    onSuccess={handleMeetingCreated}
                />
            )}

            {selectedMeeting && (meetingDeal || meetingLead) && (
                <ViewFollowup
                    open={action === "view"}
                    onClose={() => handleClose(undefined)}
                    followup={selectedMeeting}
                    deal={meetingDeal}
                    lead={meetingLead as Lead}
                    onEdit={() => handleAction("edit", selectedMeeting)}
                />
            )}

            {selectedMeeting && (meetingDeal || meetingLead) && (
                <EditFollowup
                    open={action === "edit"}
                    onClose={() => handleClose()}
                    deal={meetingDeal}
                    lead={meetingLead as Lead}
                    followup={selectedMeeting}
                />
            )}

            <DeleteFollowup
                open={action === "delete"}
                onClose={() => handleClose()}
                followup={selectedMeeting}
            />
        </>
    );
};

export default MeetingsPanel;
