import React from "react";
import { Select, Tag, Spin } from "antd";
import { CalendarDays } from "lucide-react";
import { useActiveCycle, useMlmCycles } from "../api";
import type { ActiveCycleSummary } from "../types";
import CycleStatusBadge from "./CycleStatusBadge";
import { formatCompanyDate } from "@/lib/companyDateTime";

interface Props {
    /** Called when user picks a different cycle (or "all-time") */
    onCycleChange?: (cycleId: number | null) => void;
    /** Currently selected cycle ID (null = all-time) */
    selectedCycleId?: number | null;
    /** If true, show just the active cycle info (no dropdown) */
    infoOnly?: boolean;
}

const CycleSelector: React.FC<Props> = ({
    onCycleChange,
    selectedCycleId,
    infoOnly = false,
}) => {
    const { data: activeCycleData, isLoading: loadingActive } =
        useActiveCycle();
    const { data: cyclesData } = useMlmCycles({ per_page: 50 });

    const summary: ActiveCycleSummary | null =
        (activeCycleData as any)?.data ?? null;
    const cycles = (cyclesData as any)?.data ?? [];

    if (loadingActive) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spin size="small" /> Loading cycle...
            </div>
        );
    }

    if (!summary?.cycle) {
        return (
            <div className="flex items-center gap-2 text-sm text-gray-400">
                <CalendarDays size={14} />
                <span>No active cycle configured</span>
            </div>
        );
    }

    const { cycle } = summary;
    const startLabel = formatCompanyDate(cycle.start_date);
    const endLabel = formatCompanyDate(cycle.end_date);

    if (infoOnly) {
        return (
            <div className="flex items-center gap-2 text-sm">
                <CalendarDays size={14} className="text-indigo-500" />
                <span className="font-medium">{cycle.name}</span>
                <span className="text-gray-500">
                    ({startLabel} – {endLabel})
                </span>
                <CycleStatusBadge status={cycle.status} />
                <Tag color="blue">{summary.days_remaining}d left</Tag>
            </div>
        );
    }

    const options = [
        { value: 0, label: "All Time" },
        ...cycles.map((c: any) => ({
            value: c.id,
            label: `${c.name} (${formatCompanyDate(c.start_date)} – ${formatCompanyDate(c.end_date)})`,
        })),
    ];

    return (
        <div className="flex items-center gap-3 text-sm">
            <CalendarDays size={14} className="text-indigo-500" />
            <Select
                value={selectedCycleId ?? 0}
                onChange={(val) =>
                    onCycleChange?.(val === 0 ? null : (val as number))
                }
                options={options}
                className="min-w-[280px]"
                size="small"
            />
            {selectedCycleId && selectedCycleId === cycle.id && (
                <Tag color="blue">{summary.days_remaining}d left</Tag>
            )}
        </div>
    );
};

export default CycleSelector;
