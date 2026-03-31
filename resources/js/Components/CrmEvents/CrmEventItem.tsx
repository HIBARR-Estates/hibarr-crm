import React, { useState } from "react";
import { Tag, Tooltip, Typography } from "antd";
import {
    UserOutlined,
    ThunderboltOutlined,
    ClockCircleOutlined,
    LinkOutlined,
    GlobalOutlined,
    ApiOutlined,
    CheckCircleOutlined,
    CloseCircleOutlined,
    ExclamationCircleOutlined,
    MinusCircleOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
    DownOutlined,
    UpOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type {
    CrmEvent,
    CrmEventStatus,
    CrmEventDirection,
} from "@/Types/api/crm-event";

dayjs.extend(relativeTime);

const { Text } = Typography;

/** Map of category slugs to Tailwind colours. */
const CATEGORY_COLORS: Record<
    string,
    { bg: string; text: string; dot: string }
> = {
    deal: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    lead: { bg: "bg-indigo-50", text: "text-indigo-700", dot: "bg-indigo-500" },
    property: {
        bg: "bg-emerald-50",
        text: "text-emerald-700",
        dot: "bg-emerald-500",
    },
    task: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
    contact: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        dot: "bg-purple-500",
    },
    communication: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        dot: "bg-teal-500",
    },
    system: { bg: "bg-slate-50", text: "text-slate-700", dot: "bg-slate-500" },
    external: {
        bg: "bg-orange-50",
        text: "text-orange-700",
        dot: "bg-orange-500",
    },
    user: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500" },
};

const DEFAULT_CAT = {
    bg: "bg-gray-50",
    text: "text-gray-700",
    dot: "bg-gray-400",
};

/** Generation type → display config */
const GENERATION_CONFIG: Record<
    string,
    { label: string; icon: React.ReactNode; className: string }
> = {
    user_generated: {
        label: "Agent",
        icon: <UserOutlined />,
        className: "bg-green-100 text-green-600",
    },
    system_generated: {
        label: "System",
        icon: <ThunderboltOutlined />,
        className: "bg-blue-100 text-blue-600",
    },
    external: {
        label: "External",
        icon: <ApiOutlined />,
        className: "bg-orange-100 text-orange-600",
    },
};

/** Status → display config */
const STATUS_CONFIG: Record<
    CrmEventStatus,
    { label: string; icon: React.ReactNode; className: string }
> = {
    completed: {
        label: "Completed",
        icon: <CheckCircleOutlined />,
        className: "bg-green-100 text-green-700",
    },
    error_occurred: {
        label: "Error",
        icon: <CloseCircleOutlined />,
        className: "bg-red-100 text-red-700",
    },
    missed: {
        label: "Missed",
        icon: <ExclamationCircleOutlined />,
        className: "bg-orange-100 text-orange-700",
    },
    rejected: {
        label: "Rejected",
        icon: <MinusCircleOutlined />,
        className: "bg-red-50 text-red-600",
    },
};

/** Direction → display config */
const DIRECTION_CONFIG: Record<
    CrmEventDirection,
    { label: string; icon: React.ReactNode; className: string }
> = {
    inbound: {
        label: "Inbound",
        icon: <ArrowDownOutlined />,
        className: "bg-cyan-100 text-cyan-700",
    },
    outbound: {
        label: "Outbound",
        icon: <ArrowUpOutlined />,
        className:
            "bg-geekblue-100 text-geekblue-700 bg-blue-100 text-blue-700",
    },
};

interface Props {
    event: CrmEvent;
    compact?: boolean;
}

export default function CrmEventItem({ event, compact = false }: Props) {
    const [expanded, setExpanded] = useState(false);

    const catSlug = event.event_type?.category?.slug ?? "";
    const colors = CATEGORY_COLORS[catSlug] || DEFAULT_CAT;
    const gen =
        GENERATION_CONFIG[event.generation_type] ??
        GENERATION_CONFIG.system_generated;
    const statusCfg = STATUS_CONFIG[event.status] ?? STATUS_CONFIG.completed;
    const directionCfg = event.direction
        ? DIRECTION_CONFIG[event.direction]
        : null;
    const message = event.metadata?.comment as string | undefined;

    return (
        <div className="rounded-xl border border-gray-100 bg-white p-3.5 shadow-sm hover:shadow-md hover:border-gray-200 transition-all duration-200">
            {/* Row 1: Event Type + Origin + Timestamp */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div
                        className={`flex items-center justify-center flex-shrink-0 h-6 w-6 rounded-full ${colors.bg} border border-white shadow-sm ring-1 ring-gray-50`}
                    >
                        <span
                            className={`h-2 w-2 rounded-full ${colors.dot}`}
                        />
                    </div>
                    <div className="flex flex-col">
                        <div className="flex items-center gap-1.5">
                            <Text
                                strong
                                className="text-[14px] truncate leading-tight text-gray-800"
                            >
                                {event.event_type?.name ?? "Unknown Event"}
                            </Text>
                            <div
                                className={`flex items-center gap-1 ${gen.className} px-1.5 py-0.5 rounded-md text-[10px] font-medium`}
                            >
                                {gen.icon}
                                <span>{gen.label}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <Tooltip
                    title={dayjs(event.occurred_at).format(
                        "YYYY-MM-DD HH:mm:ss",
                    )}
                >
                    <div className="flex items-center gap-1 text-[11px] text-gray-500 bg-gray-50 px-2 py-1 rounded-md border border-gray-100 flex-shrink-0">
                        <ClockCircleOutlined />
                        <span>{dayjs(event.occurred_at).fromNow()}</span>
                    </div>
                </Tooltip>
            </div>

            {/* Row 2: Category + Status Badge + Direction Badge */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2.5 ml-[34px]">
                {event.event_type?.category && (
                    <div
                        className={`flex items-center gap-1 ${colors.bg} ${colors.text} px-2 py-0.5 rounded-md text-[10px] font-medium`}
                    >
                        {event.event_type.category.name}
                    </div>
                )}
                <div
                    className={`flex items-center gap-1 ${statusCfg.className} px-2 py-0.5 rounded-md text-[10px] font-medium`}
                >
                    {statusCfg.icon}
                    <span>{statusCfg.label}</span>
                </div>
                {directionCfg && (
                    <div className="flex items-center gap-1 bg-cyan-50 text-cyan-700 px-2 py-0.5 rounded-md text-[10px] font-medium">
                        {directionCfg.icon}
                        <span>{directionCfg.label}</span>
                    </div>
                )}
                {event.source && !compact && (
                    <div className="flex items-center gap-1 bg-gray-50 text-gray-600 px-2 py-0.5 rounded-md text-[10px] font-medium">
                        <GlobalOutlined />
                        <span>{event.source}</span>
                    </div>
                )}
                {event.user && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-600 ml-auto bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserOutlined className="text-[9px]" />
                        </div>
                        <span className="font-medium">{event.user.name}</span>
                    </div>
                )}
            </div>

            {/* Row 3: Message (truncated with expand) */}
            {message && !compact && (
                <div className="mt-2.5 ml-[34px]">
                    <div
                        className={`text-[13px] text-gray-600 bg-gray-50/80 border border-gray-100 rounded-lg px-3 py-2 leading-relaxed ${
                            !expanded ? "line-clamp-2" : ""
                        }`}
                    >
                        {message}
                    </div>
                    {message.length > 120 && (
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            className="text-[11px] font-medium text-blue-600 hover:text-blue-700 mt-1.5 flex items-center gap-1 bg-transparent border-0 cursor-pointer p-0 transition-colors"
                        >
                            {expanded ? (
                                <>
                                    <UpOutlined style={{ fontSize: 9 }} /> Show
                                    less
                                </>
                            ) : (
                                <>
                                    <DownOutlined style={{ fontSize: 9 }} />{" "}
                                    Read more
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Compact message preview */}
            {message && compact && (
                <div className="mt-2 ml-[34px] text-[12px] text-gray-500 line-clamp-1 italic">
                    "{message}"
                </div>
            )}

            {/* Correlation link */}
            {event.correlation_id && !compact && (
                <div className="mt-2.5 ml-[34px]">
                    <Tooltip title={`Correlation ID: ${event.correlation_id}`}>
                        <div className="inline-flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 cursor-help transition-colors bg-gray-50 px-2 py-0.5 rounded-md">
                            <LinkOutlined />
                            <span className="font-mono">
                                {event.correlation_id.slice(0, 8)}…
                            </span>
                        </div>
                    </Tooltip>
                </div>
            )}
        </div>
    );
}
