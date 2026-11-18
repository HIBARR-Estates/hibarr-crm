import React from "react";
import { DatePicker, Select, Segmented, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import dayjs, { Dayjs } from "dayjs";
import quarterOfYear from "dayjs/plugin/quarterOfYear";
import { useTd } from "@/Hooks/useDynamicTranslation";

dayjs.extend(quarterOfYear);

const { RangePicker } = DatePicker;

interface Agent {
    id: number;
    name: string;
    image?: string | null;
}

interface Department {
    id: number;
    team_name: string;
}

interface Filters {
    start_date: string;
    end_date: string;
    agent_id: number | string | null;
    view_type: "agent" | "department";
}

interface FilterBarProps {
    filters: Filters;
    agents: Agent[];
    departments: Department[];
    canViewAll: boolean;
    onChange: (newFilters: Partial<Filters>) => void;
}

const FilterBar: React.FC<FilterBarProps> = ({
    filters,
    agents,
    departments,
    canViewAll,
    onChange,
}) => {
    const { td } = useTd();
    const handleDateChange = (dates: [Dayjs | null, Dayjs | null] | null) => {
        if (dates && dates[0] && dates[1]) {
            onChange({
                start_date: dates[0].format("YYYY-MM-DD"),
                end_date: dates[1].format("YYYY-MM-DD"),
            });
        }
    };

    const handleViewToggle = (value: string | number) => {
        onChange({
            view_type: value as "agent" | "department",
            agent_id: null,
        });
    };

    const handleAgentChange = (value: string | number | undefined) => {
        if (value === undefined || value === null || value === "") {
            onChange({ agent_id: null });
            return;
        }

        const normalizedValue = Number(value);
        onChange({ agent_id: Number.isNaN(normalizedValue) ? null : normalizedValue });
    };

    const handleExport = (format: string) => {
        const params = new URLSearchParams({
            start_date: filters.start_date,
            end_date: filters.end_date,
            view_type: filters.view_type,
            format,
            ...(filters.agent_id ? { agent_id: String(filters.agent_id) } : {}),
        });
        window.location.href = `/account/agent-reports/export?${params.toString()}`;
    };

    return (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-center gap-4">
                {/* Date Range */}
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                        {td("Date Range", { source: "en" })}
                    </label>
                    <RangePicker
                        value={[
                            dayjs(filters.start_date),
                            dayjs(filters.end_date),
                        ]}
                        onChange={handleDateChange}
                        allowClear={false}
                        presets={[
                            {
                                label: td("This Week", { source: "en" }),
                                value: [
                                    dayjs().startOf("week"),
                                    dayjs().endOf("week"),
                                ],
                            },
                            {
                                label: td("This Month", { source: "en" }),
                                value: [
                                    dayjs().startOf("month"),
                                    dayjs().endOf("month"),
                                ],
                            },
                            {
                                label: td("Last Month", { source: "en" }),
                                value: [
                                    dayjs()
                                        .subtract(1, "month")
                                        .startOf("month"),
                                    dayjs().subtract(1, "month").endOf("month"),
                                ],
                            },
                            {
                                label: td("This Quarter", { source: "en" }),
                                value: [
                                    dayjs().startOf("quarter"),
                                    dayjs().endOf("quarter"),
                                ],
                            },
                            {
                                label: td("This Year", { source: "en" }),
                                value: [
                                    dayjs().startOf("year"),
                                    dayjs().endOf("year"),
                                ],
                            },
                        ]}
                    />
                </div>

                {/* View Toggle */}
                {canViewAll && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                            {td("View", { source: "en" })}
                        </label>
                        <Segmented
                            options={[
                                { label: td("Agent", { source: "en" }), value: "agent" },
                                { label: td("Department", { source: "en" }), value: "department" },
                            ]}
                            value={filters.view_type}
                            onChange={handleViewToggle}
                        />
                    </div>
                )}

                {/* Agent Selector (admin only, agent view) */}
                {canViewAll && filters.view_type === "agent" && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                            {td("Agent", { source: "en" })}
                        </label>
                        <Select
                            placeholder={td("Select agent", { source: "en" })}
                            allowClear
                            showSearch
                            optionFilterProp="label"
                            value={
                                filters.agent_id === null ||
                                filters.agent_id === undefined
                                    ? undefined
                                    : Number(filters.agent_id)
                            }
                            onChange={handleAgentChange}
                            style={{ width: 200 }}
                            options={agents.map((a) => ({
                                value: a.id,
                                label: a.name,
                            }))}
                        />
                    </div>
                )}

                {/* Spacer */}
                <div className="flex-1" />

                {/* Export */}
                <div className="flex gap-2">
                    <Button
                        icon={<DownloadOutlined />}
                        onClick={() => handleExport("xlsx")}
                    >
                        {td("Excel", { source: "en" })}
                    </Button>
                    {/* <Button
                        icon={<DownloadOutlined />}
                        onClick={() => handleExport("pdf")}
                    >
                        PDF
                    </Button> */}
                </div>
            </div>
        </div>
    );
};

export default FilterBar;
