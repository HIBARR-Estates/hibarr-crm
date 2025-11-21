import React from "react";
import { Tag, Space, Typography, Button } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useFilter } from "@/contexts/FilterContext";

const { Text } = Typography;

interface ContextualActiveFiltersProps {
    /**
     * Custom CSS classes for the container
     */
    className?: string;

    /**
     * Show clear all button when there are multiple filters
     */
    showClearAll?: boolean;

    /**
     * Compact mode - smaller padding and font sizes
     */
    compact?: boolean;
}

const ContextualActiveFilters: React.FC<ContextualActiveFiltersProps> = ({
    className = "",
    showClearAll = true,
    compact = false,
}) => {
    const {
        filterMetadata,
        removeFilter,
        clearAllFilters,
        getActiveFilterCount,
    } = useFilter();

    const activeFilterCount = getActiveFilterCount();

    if (activeFilterCount === 0) {
        return null;
    }

    const baseClassName = compact
        ? "mb-2 px-4 py-2 bg-gray-50 rounded"
        : "mb-4 px-8 py-4 bg-gray-50 rounded-lg";

    return (
        <div className={`${baseClassName} ${className}`}>
            <div className="flex items-center justify-between mb-2">
                <Text
                    strong
                    className={
                        compact
                            ? "text-xs text-blue-600"
                            : "text-sm text-blue-600"
                    }
                >
                    <span className="text-gray-400">
                        Active Filters ({activeFilterCount})
                    </span>
                </Text>
                {showClearAll && activeFilterCount > 1 && (
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                        Clear All
                    </button>
                )}
            </div>

            <Space size={[8, 8]} wrap>
                {Object.values(filterMetadata).map((filter) => (
                    <Tag
                        key={filter.key}
                        closable
                        onClose={() => removeFilter(filter.key)}
                        closeIcon={<CloseOutlined className="text-xs" />}
                        className={`px-3 py-1 ${
                            compact ? "text-xs" : "text-sm"
                        } border-blue-200 bg-blue-50 text-blue-700`}
                        color="blue"
                    >
                        <span className="font-medium">{filter.label}:</span>{" "}
                        <span>{filter.displayValue}</span>
                    </Tag>
                ))}
            </Space>
        </div>
    );
};

export default ContextualActiveFilters;
