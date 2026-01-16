import React from "react";
import {
    CheckCircleOutlined,
    CalendarOutlined,
    FireOutlined,
    InboxOutlined,
} from "@ant-design/icons";

interface TaskStats {
    total: number;
    completed: number;
    overdue: number;
    dueToday: number;
}

interface TasksStatsProps {
    stats: TaskStats;
    loading?: boolean;
}

export const TasksStats: React.FC<TasksStatsProps> = ({
    stats,
    loading = false,
}) => {
    const { total, completed, overdue, dueToday } = stats;

    const StatItem = ({
        icon,
        value,
        label,
        colorClass,
    }: {
        icon: React.ReactNode;
        value: number;
        label: string;
        colorClass: string;
    }) => (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white hover:shadow-sm transition-all cursor-default">
            <span className={`text-base ${colorClass}`}>{icon}</span>
            <div className="flex items-baseline gap-1.5 leading-none">
                <span className="text-sm font-semibold text-gray-700">
                    {loading ? "-" : value}
                </span>
                <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500">
                    {label}
                </span>
            </div>
        </div>
    );

    return (
        <div className="flex flex-wrap items-center gap-2 mb-6 px-4 py-2 bg-white rounded-lg border border-gray-200/80">
            <StatItem
                icon={<InboxOutlined />}
                value={total}
                label="Total"
                colorClass="text-gray-500"
            />
            <div className="h-4 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <StatItem
                icon={<CheckCircleOutlined />}
                value={completed}
                label="Done"
                colorClass="text-green-500"
            />
            <div className="h-4 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <StatItem
                icon={<CalendarOutlined />}
                value={dueToday}
                label="Today"
                colorClass="text-orange-500"
            />
            <div className="h-4 w-px bg-gray-200 mx-2 hidden sm:block"></div>
            <StatItem
                icon={<FireOutlined />}
                value={overdue}
                label="Overdue"
                colorClass="text-red-500"
            />
        </div>
    );
};
