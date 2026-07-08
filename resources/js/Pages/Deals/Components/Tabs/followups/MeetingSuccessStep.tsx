import React from "react";
import { Button } from "antd";
import { CheckCircleOutlined, PlusOutlined, VideoCameraOutlined, PhoneOutlined, BankOutlined, EnvironmentOutlined, CalendarOutlined } from "@ant-design/icons";
import useTranslation from "@/Hooks/useTranslation";

interface Props {
    onDone: () => void;
    onBookAnother: () => void;
    hideButtons?: boolean;
    // Optional meeting details for rich summary card
    entityName?: string;
    typeName?: string;
    date?: string;       // DD-MM-YYYY
    time?: string;       // HH:mm:ss
    duration?: number | null;
    location?: string;
}

const PLATFORM_LABELS: Record<string, string> = {
    zoho: "Video Meeting",
    office: "Office",
    phone: "Phone",
    physical: "In-Person",
};

const PLATFORM_ICONS: Record<string, React.ReactNode> = {
    zoho: <VideoCameraOutlined />,
    office: <BankOutlined />,
    phone: <PhoneOutlined />,
    physical: <EnvironmentOutlined />,
};

function formatDate(dateStr?: string): string {
    if (!dateStr) return "—";
    const [dd, mm, yyyy] = dateStr.split("-");
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    return `${months[parseInt(mm) - 1]} ${parseInt(dd)}, ${yyyy}`;
}

function formatTime(timeStr?: string): string {
    if (!timeStr) return "—";
    const [hh, mm] = timeStr.split(":");
    const h = parseInt(hh);
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${mm} ${period}`;
}

function formatDuration(minutes?: number | null): string {
    if (!minutes) return "—";
    if (minutes < 60) return `${minutes} min`;
    if (minutes === 60) return "1 hour";
    const hrs = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hrs} hr ${mins} min` : `${hrs} hrs`;
}

const MeetingSuccessStep: React.FC<Props> = ({
    onDone,
    onBookAnother,
    hideButtons = false,
    entityName,
    typeName,
    date,
    time,
    duration,
    location,
}) => {
    const { t } = useTranslation();
    const hasDetails = !!(entityName || date || time);

    return (
        <div className="flex flex-col items-center text-center py-8 px-4 gap-5">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                <CheckCircleOutlined className="text-3xl text-emerald-600" />
            </div>

            <div>
                <h3 className="text-[18px] font-bold text-gray-900 mb-1">
                    {t("app.meetings.success.title")}
                </h3>
                <p className="text-[13px] text-gray-500">
                    {t("app.meetings.success.description")}
                </p>
            </div>

            {hasDetails && (
                <div className="w-full rounded-2xl border border-gray-200 bg-gray-50 overflow-hidden text-left">
                    {/* Card header */}
                    <div className="px-4 py-3.5 flex items-center gap-3 border-b border-gray-200">
                        <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
                            <CalendarOutlined className="text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[14px] font-bold text-gray-800 leading-tight truncate">
                                {typeName || "Meeting"}
                            </p>
                            {entityName && (
                                <p className="text-[11px] text-gray-500 truncate">{entityName}</p>
                            )}
                        </div>
                        <span className="shrink-0 text-[11px] font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                            Scheduled
                        </span>
                    </div>

                    {/* Date / Time / Duration */}
                    <div className="px-4 py-3 grid grid-cols-3 gap-3 border-b border-gray-200">
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Date</p>
                            <p className="text-[13px] font-semibold text-gray-700">{formatDate(date)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Time</p>
                            <p className="text-[13px] font-semibold text-gray-700">{formatTime(time)}</p>
                        </div>
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Duration</p>
                            <p className="text-[13px] font-semibold text-gray-700">{formatDuration(duration)}</p>
                        </div>
                    </div>

                    {/* Platform */}
                    {location && (
                        <div className="px-4 py-3 flex items-center gap-2 text-[12px] text-gray-500">
                            {PLATFORM_ICONS[location] || <CalendarOutlined />}
                            <span>{PLATFORM_LABELS[location] || location}</span>
                        </div>
                    )}
                </div>
            )}

            {!hideButtons && (
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
                    <Button type="primary" block onClick={onBookAnother} icon={<PlusOutlined />}>
                        {t("app.meetings.success.book_another")}
                    </Button>
                    <Button block onClick={onDone}>
                        {t("app.meetings.success.done")}
                    </Button>
                </div>
            )}
        </div>
    );
};

export default MeetingSuccessStep;
