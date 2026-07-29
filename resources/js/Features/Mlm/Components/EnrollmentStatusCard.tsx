import React from "react";
import { Card, Progress, Tag, Alert } from "antd";
import { CalendarDays, AlertTriangle, Clock } from "lucide-react";
import type { EnrollmentStatus } from "../types";
import EnrollmentStatusBadge from "./EnrollmentStatusBadge";
import { formatCompanyDate } from "@/lib/companyDateTime";

interface EnrollmentInfo {
    id: number;
    status: EnrollmentStatus;
    effective_start_date: string;
    effective_end_date: string;
    overflow_start_date?: string | null;
    max_overflow_date?: string | null;
    days_remaining: number;
    is_overflowing: boolean;
}

interface CycleInfo {
    cycle_number: number;
    name?: string;
    start_date?: string;
    end_date: string;
    days_remaining: number;
}

interface Props {
    enrollment: EnrollmentInfo | null;
    activeCycle?: CycleInfo | null;
}

const EnrollmentStatusCard: React.FC<Props> = ({ enrollment, activeCycle }) => {
    if (!enrollment) {
        return (
            <Card
                size="small"
                className="shadow-sm border-l-4 border-l-gray-300"
            >
                <div className="flex items-center gap-3 text-gray-500">
                    <CalendarDays size={18} />
                    <span className="text-sm">
                        No active cycle enrollment. You will be enrolled when
                        the next cycle begins.
                    </span>
                </div>
            </Card>
        );
    }

    const startDate = formatCompanyDate(enrollment.effective_start_date);
    const endDate = formatCompanyDate(enrollment.effective_end_date);

    // Calculate time progress
    const totalDays = Math.max(
        1,
        Math.ceil(
            (new Date(enrollment.effective_end_date).getTime() -
                new Date(enrollment.effective_start_date).getTime()) /
                (1000 * 60 * 60 * 24),
        ),
    );
    const elapsed = totalDays - enrollment.days_remaining;
    const timePercent = Math.min(100, Math.max(0, (elapsed / totalDays) * 100));

    const borderColor = enrollment.is_overflowing
        ? "border-l-orange-400"
        : "border-l-green-400";

    return (
        <div className="space-y-2">
            <Card
                size="small"
                className={`shadow-sm border-l-4 ${borderColor}`}
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <CalendarDays size={18} className="text-indigo-500" />
                        <div>
                            <div className="flex items-center gap-2">
                                {activeCycle && (
                                    <span className="font-medium text-sm">
                                        {activeCycle.name ??
                                            `Cycle #${activeCycle.cycle_number}`}
                                    </span>
                                )}
                                <EnrollmentStatusBadge
                                    status={enrollment.status}
                                />
                            </div>
                            <div className="text-xs text-gray-500 mt-0.5">
                                {startDate} – {endDate}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="flex items-center gap-1 text-sm">
                                <Clock size={12} className="text-gray-400" />
                                <span className="font-semibold">
                                    {enrollment.days_remaining}
                                </span>
                                <span className="text-gray-500 text-xs">
                                    days left
                                </span>
                            </div>
                            <Progress
                                percent={Math.round(timePercent)}
                                size="small"
                                showInfo={false}
                                strokeColor={
                                    enrollment.is_overflowing
                                        ? "#f97316"
                                        : "#6366f1"
                                }
                                className="w-32"
                            />
                        </div>
                    </div>
                </div>
            </Card>

            {enrollment.is_overflowing && (
                <Alert
                    type="warning"
                    showIcon
                    icon={<AlertTriangle size={16} />}
                    message="Overflow Period"
                    description={`You are in overtime. You have ${enrollment.days_remaining} day(s) remaining to meet criteria before your cycle resets.${enrollment.max_overflow_date ? ` Overflow expires: ${formatCompanyDate(enrollment.max_overflow_date)}` : ""}`}
                    className="text-sm"
                />
            )}
        </div>
    );
};

export default EnrollmentStatusCard;
