import React from "react";

const MEETING_TYPE_COLORS: Record<string, string> = {
    Intro: "bg-blue-100 text-blue-700",
    Demo: "bg-indigo-100 text-indigo-700",
    Closing: "bg-green-100 text-green-700",
    "Follow Up": "bg-yellow-100 text-yellow-700",
    Discovery: "bg-cyan-100 text-cyan-700",
    Negotiation: "bg-rose-100 text-rose-700",
};

interface MeetingTypeBadgeProps {
    type: string;
    count?: number;
}

const MeetingTypeBadge: React.FC<MeetingTypeBadgeProps> = ({ type, count }) => {
    const colorClasses =
        MEETING_TYPE_COLORS[type] ?? "bg-gray-100 text-gray-700";

    return (
        <span
            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClasses}`}
        >
            {type}
            {count !== undefined && `: ${count}`}
        </span>
    );
};

export default MeetingTypeBadge;
