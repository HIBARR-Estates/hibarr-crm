import React, { useState } from "react";
import { Tooltip, Typography } from "antd";
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
    DownOutlined,
    UpOutlined,
    ArrowDownOutlined,
    ArrowUpOutlined,
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

const CATEGORY_COLORS: Record<
    string,
    { bg: string; text: string; dot: string }
> = {
    deal: { bg: "bg-blue-50/50", text: "text-blue-600", dot: "bg-blue-500" },
    lead: {
        bg: "bg-indigo-50/50",
        text: "text-indigo-600",
        dot: "bg-indigo-500",
    },
    property: {
        bg: "bg-emerald-50/50",
        text: "text-emerald-600",
        dot: "bg-emerald-500",
    },
    task: { bg: "bg-amber-50/50", text: "text-amber-600", dot: "bg-amber-500" },
    contact: {
        bg: "bg-purple-50/50",
        text: "text-purple-600",
        dot: "bg-purple-500",
    },
    communication: {
        bg: "bg-teal-50/50",
        text: "text-teal-600",
        dot: "bg-teal-500",
    },
    system: {
        bg: "bg-slate-50/50",
        text: "text-slate-600",
        dot: "bg-slate-500",
    },
    external: {
        bg: "bg-orange-50/50",
        text: "text-orange-600",
        dot: "bg-orange-500",
    },
    user: { bg: "bg-green-50/50", text: "text-green-600", dot: "bg-green-500" },
};

const DEFAULT_CAT = {
    bg: "bg-gray-50",
    text: "text-gray-600",
    dot: "bg-gray-400",
};

const GENERATION_CONFIG: Record<
    string,
    { label: string; icon: React.ReactNode; className: string }
> = {
    user_generated: {
        label: "Agent",
        icon: <UserOutlined style={{ fontSize: "10px" }} />,
        className:
            "bg-green-50 text-green-700 ring-1 ring-inset ring-green-600/20",
    },
    system_generated: {
        label: "System",
        icon: <ThunderboltOutlined style={{ fontSize: "10px" }} />,
        className:
            "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-600/20",
    },
    external: {
        label: "External",
        icon: <ApiOutlined style={{ fontSize: "10px" }} />,
        className:
            "bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-600/20",
    },
};

const STATUS_CONFIG: Record<
    CrmEventStatus,
    { label: string; icon: React.ReactNode; className: string }
> = {
    completed: {
        label: "Completed",
        icon: <CheckCircleOutlined />,
        className: "text-green-600 bg-green-50",
    },
    error_occurred: {
        label: "Error",
        icon: <CloseCircleOutlined />,
        className: "text-red-600 bg-red-50",
    },
    missed: {
        label: "Missed",
        icon: <ExclamationCircleOutlined />,
        className: "text-amber-600 bg-amber-50",
    },
    rejected: {
        label: "Rejected",
        icon: <MinusCircleOutlined />,
        className: "text-gray-500 bg-gray-100",
    },
};

const DIRECTION_CONFIG: Record<
    CrmEventDirection,
    { label: string; icon: React.ReactNode; className: string }
> = {
    inbound: {
        label: "Inbound",
        icon: <ArrowDownOutlined />,
        className:
            "bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-600/20",
    },
    outbound: {
        label: "Outbound",
        icon: <ArrowUpOutlined />,
        className:
            "bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-600/20",
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
        <div className="group relative flex flex-col gap-2 rounded-xl border border-gray-200 bg-white p-4 transition-all duration-200 hover:border-gray-300 hover:shadow-sm">
            {/* Header: Type + Badge + Time */}
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white shadow-sm ring-1 ring-gray-100 ${colors.bg}`}
                    >
                        <div
                            className={`h-1.5 w-1.5 rounded-full ${colors.dot}`}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <Text
                            strong
                            className="text-[14px] text-gray-900 tracking-tight truncate leading-none"
                        >
                            {event.event_type?.name ?? "Unknown Event"}
                        </Text>
                        <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${gen.className}`}
                        >
                            {gen.icon}
                            {gen.label}
                        </span>
                    </div>
                </div>

                <Tooltip
                    title={dayjs(event.occurred_at).format(
                        "MMM D, YYYY • h:mm A",
                    )}
                >
                    <div className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium text-gray-400">
                        <ClockCircleOutlined className="text-[10px]" />
                        <span>{dayjs(event.occurred_at).fromNow()}</span>
                    </div>
                </Tooltip>
            </div>

            {/* Meta Tags Row */}
            <div className="ml-9 flex flex-wrap items-center gap-2">
                {event.event_type?.category && (
                    <span className={`text-[11px] font-medium ${colors.text}`}>
                        {event.event_type.category.name}
                    </span>
                )}
                <div className="h-1 w-1 rounded-full bg-gray-300" />{" "}
                {/* Separator Dot */}
                <div
                    className={`flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${statusCfg.className}`}
                >
                    <span className="flex items-center scale-90">
                        {statusCfg.icon}
                    </span>
                    {statusCfg.label}
                </div>
                {directionCfg && (
                    <div
                        className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-tight ${directionCfg.className}`}
                    >
                        {directionCfg.label}
                    </div>
                )}
                {event.source && !compact && (
                    <div className="flex items-center gap-1 text-[11px] text-gray-400">
                        <GlobalOutlined className="text-[10px]" />
                        <span>{event.source}</span>
                    </div>
                )}
                {event.user && (
                    <div className="ml-auto flex items-center gap-1.5 rounded-full bg-gray-50 border border-gray-100 pl-1 pr-2 py-0.5">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm">
                            <UserOutlined className="text-[9px] text-gray-500" />
                        </div>
                        <span className="text-[11px] font-semibold text-gray-700">
                            {event.user.name}
                        </span>
                    </div>
                )}
            </div>

            {/* Content Section */}
            {message && (
                <div className="ml-9 mt-1">
                    <div
                        className={`relative overflow-hidden rounded-lg border border-gray-100 bg-gray-50/40 px-3 py-2 text-[13px] text-gray-600 transition-all ${
                            !expanded && !compact
                                ? "line-clamp-2"
                                : compact
                                  ? "line-clamp-1 italic"
                                  : ""
                        }`}
                    >
                        {message}
                    </div>

                    {message.length > 120 && !compact && (
                        <button
                            type="button"
                            onClick={() => setExpanded(!expanded)}
                            className="mt-1 flex items-center gap-1 text-[11px] font-bold text-blue-600 hover:text-blue-700 transition-colors"
                        >
                            {expanded ? (
                                <>
                                    <UpOutlined className="text-[8px]" /> Show
                                    Less
                                </>
                            ) : (
                                <>
                                    <DownOutlined className="text-[8px]" /> Read
                                    More
                                </>
                            )}
                        </button>
                    )}
                </div>
            )}

            {/* Footer / Correlation */}
            {event.correlation_id && !compact && (
                <div className="ml-9 flex items-center gap-2">
                    <Tooltip title={`ID: ${event.correlation_id}`}>
                        <div className="flex items-center gap-1 text-[10px] font-mono text-gray-400 hover:text-gray-600">
                            <LinkOutlined />
                            <span>{event.correlation_id.slice(0, 8)}</span>
                        </div>
                    </Tooltip>
                </div>
            )}
        </div>
    );
}
