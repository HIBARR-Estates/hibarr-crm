import React from "react";
import { Tag, Tooltip, Typography } from "antd";
import {
    UserOutlined,
    ThunderboltOutlined,
    ClockCircleOutlined,
    LinkOutlined,
    GlobalOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type { CrmEvent } from "@/Types/api/crm-event";

dayjs.extend(relativeTime);

const { Text } = Typography;

/** Map of category slugs to Tailwind colours. */
const CATEGORY_COLORS: Record<
    string,
    { bg: string; text: string; dot: string }
> = {
    engagement: {
        bg: "bg-purple-50",
        text: "text-purple-700",
        dot: "bg-purple-500",
    },
    lifecycle: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500" },
    marketing: {
        bg: "bg-amber-50",
        text: "text-amber-700",
        dot: "bg-amber-500",
    },
    communication: {
        bg: "bg-teal-50",
        text: "text-teal-700",
        dot: "bg-teal-500",
    },
    conversion: {
        bg: "bg-green-50",
        text: "text-green-700",
        dot: "bg-green-500",
    },
    support: { bg: "bg-rose-50", text: "text-rose-700", dot: "bg-rose-500" },
    data_management: {
        bg: "bg-slate-50",
        text: "text-slate-700",
        dot: "bg-slate-500",
    },
};

const DEFAULT_CAT = {
    bg: "bg-gray-50",
    text: "text-gray-700",
    dot: "bg-gray-400",
};

interface Props {
    event: CrmEvent;
    compact?: boolean;
}

export default function CrmEventItem({ event, compact = false }: Props) {
    const catSlug = event.event_type?.category?.slug ?? "";
    const colors = CATEGORY_COLORS[catSlug] || DEFAULT_CAT;
    const isSystem = event.generation_type === "system_generated";

    const utmKeys = Object.keys(event.metadata ?? {}).filter((k) =>
        k.startsWith("utm_"),
    );

    return (
        <div
            className={`rounded-lg border px-3 py-2 ${
                isSystem
                    ? "border-blue-100 bg-blue-50/40"
                    : "border-green-100 bg-green-50/40"
            }`}
        >
            {/* Header row */}
            <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                    <span
                        className={`flex-shrink-0 h-2 w-2 rounded-full ${colors.dot}`}
                    />
                    <Text strong className="text-sm truncate leading-tight">
                        {event.event_type?.name ?? "Unknown Event"}
                    </Text>
                </div>

                <Tooltip
                    title={dayjs(event.occurred_at).format(
                        "YYYY-MM-DD HH:mm:ss",
                    )}
                >
                    <Text
                        type="secondary"
                        className="text-xs flex-shrink-0 whitespace-nowrap"
                    >
                        <ClockCircleOutlined className="mr-1" />
                        {dayjs(event.occurred_at).fromNow()}
                    </Text>
                </Tooltip>
            </div>

            {/* Category + generation badge row */}
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                {event.event_type?.category && (
                    <Tag
                        className={`${colors.bg} ${colors.text} border-0 rounded-md text-[11px] leading-[18px] px-1.5`}
                    >
                        {event.event_type.category.name}
                    </Tag>
                )}
                <Tag
                    className={`border-0 rounded-md text-[11px] leading-[18px] px-1.5 ${
                        isSystem
                            ? "bg-blue-100 text-blue-600"
                            : "bg-green-100 text-green-600"
                    }`}
                    icon={isSystem ? <ThunderboltOutlined /> : <UserOutlined />}
                >
                    {isSystem ? "System" : "Agent"}
                </Tag>
                {event.source && (
                    <Tag
                        className="bg-gray-100 text-gray-600 border-0 rounded-md text-[11px] leading-[18px] px-1.5"
                        icon={<GlobalOutlined />}
                    >
                        {event.source}
                    </Tag>
                )}
            </div>

            {/* User */}
            {event.user && (
                <div className="mt-1.5">
                    <Text type="secondary" className="text-xs">
                        <UserOutlined className="mr-1" />
                        {event.user.name}
                    </Text>
                </div>
            )}

            {/* Comment / metadata.comment */}
            {event.metadata?.comment && !compact && (
                <div className="mt-1.5 text-xs text-gray-600 bg-white/60 rounded px-2 py-1">
                    {event.metadata.comment}
                </div>
            )}

            {/* UTM badges */}
            {utmKeys.length > 0 && !compact && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                    {utmKeys.map((k) => (
                        <Tag
                            key={k}
                            className="bg-indigo-50 text-indigo-600 border-0 rounded text-[10px] leading-[16px] px-1"
                        >
                            {k.replace("utm_", "")}:{" "}
                            {String(event.metadata?.[k])}
                        </Tag>
                    ))}
                </div>
            )}

            {/* Correlation link */}
            {event.correlation_id && !compact && (
                <div className="mt-1.5">
                    <Tooltip title={`Correlation: ${event.correlation_id}`}>
                        <Text type="secondary" className="text-[10px]">
                            <LinkOutlined className="mr-1" />
                            {event.correlation_id.slice(0, 8)}…
                        </Text>
                    </Tooltip>
                </div>
            )}
        </div>
    );
}
