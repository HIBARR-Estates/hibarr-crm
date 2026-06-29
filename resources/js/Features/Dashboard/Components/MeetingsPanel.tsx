import React, { useState } from "react";
import { Card, List, Tag, Avatar, Button } from "antd";
import {
    CalendarOutlined,
    UserOutlined,
    PlusOutlined,
    VideoCameraOutlined,
    TeamOutlined,
    PhoneOutlined,
    EnvironmentOutlined,
    LinkOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import ScheduleMeetingDrawer from "@/Features/Meetings/ScheduleMeetingDrawer";
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

interface Meeting {
    id: number;
    deal_id?: number | null;
    lead_id?: number | null;
    remark?: string;
    next_follow_up_date: string;
    meeting_link?: string;
    location?: string;
    meeting_type?: { id: number; name: string };
    deal?: {
        id: number;
        name: string;
        contact?: {
            id: number;
            client_name: string;
            client_email?: string;
            mobile?: string;
        };
    };
    lead?: {
        id: number;
        client_name: string;
        client_name_salutation?: string;
        company_name?: string;
    };
}

interface MeetingPermissions {
    add_lead_follow_up?: string;
}

interface MeetingsPanelProps {
    meetings: Meeting[];
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

    const canAdd =
        meetingPermissions.add_lead_follow_up === "all" ||
        meetingPermissions.add_lead_follow_up === "added";

    const handleMeetingCreated = () => {
        router.reload({ only: ["upcomingMeetings"] });
    };

    const renderMeetingLink = (meeting: Meeting) => {
        const location = meeting.location ?? "zoho";
        const isNonVideoLocation = ["office", "phone", "physical"].includes(
            location,
        );

        if (isNonVideoLocation || !meeting.meeting_link) {
            const platformLabels: Record<string, string> = {
                office: t("pages.meetings.platforms.office"),
                phone: t("pages.meetings.platforms.phone"),
                physical: t("pages.meetings.platforms.physical"),
            };
            return (
                <span className="text-xs text-gray-500">
                    {platformLabels[location] ??
                        t("pages.meetings.platforms.office")}
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
                className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 text-xs font-medium"
            >
                {getPlatformIcon(location)}
                <LinkOutlined />
                <span className="underline">
                    {t("pages.meetings.card.actions.join_meeting")}
                </span>
            </a>
        );
    };

    const renderEntityLink = (meeting: Meeting) => {
        if (meeting.deal) {
            return (
                <Link
                    href={route("deals.show", meeting.deal.id)}
                    className="text-xs text-blue-600 hover:underline"
                >
                    {td(meeting.deal.name)}
                </Link>
            );
        }

        if (meeting.lead) {
            return (
                <Link
                    href={route("lead-contact.show", meeting.lead.id)}
                    className="text-xs text-blue-600 hover:underline"
                >
                    {td(
                        meeting.lead.client_name_salutation ||
                            meeting.lead.client_name,
                    )}
                </Link>
            );
        }

        return (
            <span className="text-xs text-gray-400">
                {t("pages.meetings.card.no_deal")}
            </span>
        );
    };

    const getContactName = (meeting: Meeting) => {
        if (meeting.deal?.contact?.client_name) {
            return meeting.deal.contact.client_name;
        }
        if (meeting.lead) {
            return (
                meeting.lead.client_name_salutation || meeting.lead.client_name
            );
        }
        return t("pages.meetings.card.no_participants");
    };

    return (
        <>
            <Card
                title={
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                            <CalendarOutlined className="text-blue-600" />
                            <span>{t("app.meetings.sections.upcoming")}</span>
                            <Tag color="blue" className="rounded-full px-2">
                                {meetings.length}
                            </Tag>
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
                styles={{ body: { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 } }}
                variant="outlined"
            >
                {meetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center flex-1 overflow-hidden">
                        <div className="text-center py-8 text-gray-500">
                            <CalendarOutlined className="text-4xl text-gray-300 mb-2" />
                            <div>{t("app.meetings.empty.upcoming")}</div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto">
                        <List
                            dataSource={meetings}
                            renderItem={(meeting) => (
                                <List.Item className="px-6 py-4 hover:bg-gray-50 transition-colors border-b last:border-b-0">
                                    <div className="w-full">
                                        <div className="flex justify-between items-start gap-3 mb-2">
                                            <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <span className="flex-shrink-0">
                                                    {getPlatformIcon(
                                                        meeting.location ??
                                                            "zoho",
                                                    )}
                                                </span>
                                                <div className="font-medium text-gray-900 line-clamp-1">
                                                    {meeting.meeting_type?.name
                                                        ? td(
                                                              meeting
                                                                  .meeting_type
                                                                  .name,
                                                          )
                                                        : td(
                                                              meeting.remark ||
                                                                  "Meeting",
                                                          )}
                                                </div>
                                            </div>
                                            <Tag
                                                color={
                                                    dayjs(
                                                        meeting.next_follow_up_date,
                                                    ).isBefore(dayjs())
                                                        ? "red"
                                                        : "green"
                                                }
                                                className="flex-shrink-0"
                                            >
                                                {dayjs(
                                                    meeting.next_follow_up_date,
                                                ).fromNow()}
                                            </Tag>
                                        </div>

                                        <div className="text-xs text-gray-500 mb-3 flex items-center gap-2">
                                            <CalendarOutlined />
                                            {dayjs(
                                                meeting.next_follow_up_date,
                                            ).format("MMM D, YYYY h:mm A")}
                                        </div>

                                        <div className="mb-3">
                                            {renderMeetingLink(meeting)}
                                        </div>

                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Avatar
                                                    size="small"
                                                    icon={<UserOutlined />}
                                                />
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-xs font-medium text-gray-700 truncate">
                                                        {getContactName(
                                                            meeting,
                                                        )}
                                                    </span>
                                                    {renderEntityLink(meeting)}
                                                </div>
                                            </div>
                                            <Link
                                                href={route("meetings.index")}
                                                className="text-xs text-gray-500 hover:text-blue-600 flex-shrink-0"
                                            >
                                                {t(
                                                    "pages.meetings.card.actions.view",
                                                )}
                                            </Link>
                                        </div>
                                    </div>
                                </List.Item>
                            )}
                        />
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
        </>
    );
};

export default MeetingsPanel;
