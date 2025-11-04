import React from "react";
import { Tag, Space, Typography } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { TFilter } from "@/Types/common";
import dayjs from "dayjs";

const { Text } = Typography;

interface ActiveFiltersProps {
    /**
     * Current filter values
     */
    filters: TFilter;

    /**
     * Function to remove a specific filter
     */
    onRemoveFilter: (key: keyof TFilter) => void;

    /**
     * Function to clear all filters
     */
    onClearAll: () => void;

    /**
     * Custom filter display configurations
     */
    filterConfig?: Partial<
        Record<
            keyof TFilter,
            {
                label: string;
                formatValue?: (value: any) => string;
            }
        >
    >;
}

const defaultFilterConfig: Record<
    string,
    { label: string; formatValue?: (value: any) => string }
> = {
    search: { label: "Search" },
    property_type: { label: "Property Type" },
    lead_type: { label: "Lead Type" },
    sale_type: { label: "Sale Type" },
    status: { label: "Status" },
    city: { label: "City" },
    lead_source: { label: "Lead Source" },
    lead_owner_id: { label: "Lead Owner" },
    added_by_id: { label: "Added By" },
    lead_pipeline_id: { label: "Pipeline" },
    pipeline_stage_id: { label: "Stage" },
    category_id: { label: "Category" },
    start_date: {
        label: "Start Date",
        formatValue: (value: string) => dayjs(value).format("MMM DD, YYYY"),
    },
    end_date: {
        label: "End Date",
        formatValue: (value: string) => dayjs(value).format("MMM DD, YYYY"),
    },
    min_price: {
        label: "Min Price",
        formatValue: (value: number) => `$${value.toLocaleString()}`,
    },
    max_price: {
        label: "Max Price",
        formatValue: (value: number) => `$${value.toLocaleString()}`,
    },
};

const ActiveFilters: React.FC<ActiveFiltersProps> = ({
    filters,
    onRemoveFilter,
    onClearAll,
    filterConfig = {},
}) => {
    const activeFilterEntries = Object.entries(filters).filter(([_, value]) => {
        // Filter out empty, null, undefined, or "all" values
        return (
            value !== null &&
            value !== undefined &&
            value !== "" &&
            value !== "all" &&
            !(Array.isArray(value) && value.length === 0)
        );
    });

    if (activeFilterEntries.length === 0) {
        return null;
    }

    const mergedConfig = { ...defaultFilterConfig, ...filterConfig };

    const formatFilterValue = (key: string, value: any): string => {
        const config = (mergedConfig as any)[key];
        if (config?.formatValue) {
            return config.formatValue(value);
        }

        // Default formatting
        if (typeof value === "string") {
            return value;
        }
        if (typeof value === "number") {
            return value.toString();
        }
        if (Array.isArray(value)) {
            return value.join(", ");
        }
        return String(value);
    };

    const getFilterLabel = (key: string): string => {
        return (
            (mergedConfig as any)[key]?.label ||
            key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
        );
    };

    return (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between mb-2">
                <Text strong className="text-sm text-gray-600">
                    Active Filters ({activeFilterEntries.length})
                </Text>
                {activeFilterEntries.length > 1 && (
                    <button
                        onClick={onClearAll}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                        Clear All
                    </button>
                )}
            </div>

            <Space size={[8, 8]} wrap>
                {activeFilterEntries.map(([key, value]) => (
                    <Tag
                        key={key}
                        closable
                        onClose={() => onRemoveFilter(key as keyof TFilter)}
                        closeIcon={<CloseOutlined className="text-xs" />}
                        className="px-3 py-1 text-sm border-blue-200 bg-blue-50 text-blue-700"
                    >
                        <span className="font-medium">
                            {getFilterLabel(key)}:
                        </span>{" "}
                        <span>{formatFilterValue(key, value)}</span>
                    </Tag>
                ))}
            </Space>
        </div>
    );
};

export default ActiveFilters;
