import React, { useState } from "react";
import { Card, List, Tag, Avatar, Button } from "antd";
import {
    CalendarOutlined,
    UserOutlined,
    PlusOutlined,
} from "@ant-design/icons";
import { Link, router } from "@inertiajs/react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import ScheduleMeetingDrawer from "@/Features/Meetings/ScheduleMeetingDrawer";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

dayjs.extend(relativeTime);

interface Meeting {
    id: number;
    deal_id: number;
    remark?: string;
    next_follow_up_date: string;
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
}

interface MeetingPermissions {
    add_lead_follow_up?: string;
}

interface MeetingsPanelProps {
    meetings: Meeting[];
    userDeals?: { id: number; name: string }[];
    meetingPermissions?: MeetingPermissions;
}

const MeetingsPanel: React.FC<MeetingsPanelProps> = ({
    meetings = [],
    userDeals = [],
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
                className="h-full"
                variant="outlined"
            >
                {meetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-[500px] overflow-hidden">
                        <div className="text-center py-8 text-gray-500">
                            <CalendarOutlined className="text-4xl text-gray-300 mb-2" />
                            <div>{t("app.meetings.empty.upcoming")}</div>
                        </div>
                    </div>
                ) : (
                    <div className="max-h-96 overflow-y-auto">
                        <List
                            dataSource={meetings}
                            renderItem={(meeting) => (
                                <List.Item className="px-6 py-4 hover:bg-gray-50 transition-colors border-b last:border-b-0">
                                    <div className="w-full">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="font-medium text-gray-900 line-clamp-1">
                                                {td(
                                                    meeting.remark || "Meeting",
                                                )}
                                            </div>
                                            <Tag
                                                color={
                                                    dayjs(
                                                        meeting.next_follow_up_date,
                                                    ).isBefore(dayjs())
                                                        ? "red"
                                                        : "green"
                                                }
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

                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <Avatar
                                                    size="small"
                                                    icon={<UserOutlined />}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-medium text-gray-700">
                                                        {meeting.deal?.contact
                                                            ?.client_name ||
                                                            "Unknown Lead"}
                                                    </span>
                                                    <Link
                                                        href={route(
                                                            "deals.show",
                                                            meeting.deal_id,
                                                        )}
                                                        className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                                                    >
                                                        {td(meeting.deal?.name)}
                                                    </Link>
                                                </div>
                                            </div>
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
                    onSuccess={handleMeetingCreated}
                />
            )}
        </>
    );
};

export default MeetingsPanel;
