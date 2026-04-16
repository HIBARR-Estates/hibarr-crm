import React from "react";
import { Card, Statistic } from "antd";
import {
    UserOutlined,
    FundOutlined,
    TrophyOutlined,
    CalendarOutlined,
    FileTextOutlined,
} from "@ant-design/icons";

interface KpiSummary {
    leads_count: number;
    deals_created_count: number;
    deals_closed_count: number;
    deals_closed_value: number;
    meetings_count: number;
    meetings_by_type: Record<string, number>;
    notes_count: number;
}

interface KpiCardsProps {
    summary: KpiSummary;
    onCardClick: (tab: string) => void;
}

const cards = [
    {
        key: "leads",
        title: "Leads",
        field: "leads_count" as const,
        icon: <UserOutlined className="text-blue-500" />,
        color: "border-blue-500",
    },
    {
        key: "deals-created",
        title: "Deals Created",
        field: "deals_created_count" as const,
        icon: <FundOutlined className="text-purple-500" />,
        color: "border-purple-500",
    },
    {
        key: "deals-closed",
        title: "Deals Closed",
        field: "deals_closed_count" as const,
        icon: <TrophyOutlined className="text-green-500" />,
        color: "border-green-500",
        extra: "deals_closed_value" as const,
    },
    {
        key: "meetings",
        title: "Meetings",
        field: "meetings_count" as const,
        icon: <CalendarOutlined className="text-orange-500" />,
        color: "border-orange-500",
    },
    {
        key: "notes",
        title: "Notes",
        field: "notes_count" as const,
        icon: <FileTextOutlined className="text-gray-500" />,
        color: "border-gray-500",
        noTab: true,
    },
];

const KpiCards: React.FC<KpiCardsProps> = ({ summary, onCardClick }) => {
    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {cards.map((card) => (
                <Card
                    key={card.key}
                    hoverable={!card.noTab}
                    className={`border-t-4 ${card.color}`}
                    onClick={() => !card.noTab && onCardClick(card.key)}
                >
                    <Statistic
                        title={
                            <span className="flex items-center gap-2">
                                {card.icon}
                                {card.title}
                            </span>
                        }
                        value={summary[card.field]}
                    />
                    {card.extra && (
                        <div className="mt-2 text-xs text-gray-500">
                            Total Value:{" "}
                            <span className="font-semibold text-green-600">
                                {new Intl.NumberFormat("en-US", {
                                    style: "currency",
                                    currency: "USD",
                                    maximumFractionDigits: 0,
                                }).format(summary[card.extra])}
                            </span>
                        </div>
                    )}
                    {card.key === "meetings" &&
                        Object.keys(summary.meetings_by_type).length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {Object.entries(summary.meetings_by_type).map(
                                    ([type, count]) => (
                                        <MeetingTypeBadge
                                            key={type}
                                            type={type}
                                            count={count}
                                        />
                                    ),
                                )}
                            </div>
                        )}
                </Card>
            ))}
        </div>
    );
};

const MEETING_TYPE_COLORS: Record<string, string> = {
    Intro: "bg-blue-100 text-blue-700",
    Demo: "bg-indigo-100 text-indigo-700",
    Closing: "bg-green-100 text-green-700",
    "Follow Up": "bg-yellow-100 text-yellow-700",
};

const MeetingTypeBadge: React.FC<{ type: string; count: number }> = ({
    type,
    count,
}) => {
    const colorClasses =
        MEETING_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-700";

    return (
        <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colorClasses}`}
        >
            {type}: {count}
        </span>
    );
};

export default KpiCards;
