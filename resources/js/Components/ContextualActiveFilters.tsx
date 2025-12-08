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
        config,
    } = useFilter();

    const activeFilterCount = getActiveFilterCount();

    if (activeFilterCount === 0) {
        return null;
    }

    // Filter out metadata that corresponds to fields not present in the current config
    // This effectively handles "excludedFields" because the config passed to FilterContext
    // should already have those fields removed.
    const visibleFilters = Object.values(filterMetadata).filter((filter) => {
        // If no config, show everything (fallback)
        if (!config) return true;

        // Check if this filter key corresponds to a field in the config
        // We need to handle range fields specially as their keys in metadata (e.g. start_date_start)
        // might differ from the field key in config (e.g. start_date)

        // Direct match
        const directMatch = config.fields.some((f) => f.key === filter.key);
        if (directMatch) return true;

        // Range match check
        // If filter key is like "field_start" or "field_end" or "min_field" or "max_field"
        // we check if "field" exists in config
        const rangeField = config.fields.find((f) => {
            if (f.type === "daterange") {
                return (
                    filter.key === `${f.key}_start` ||
                    filter.key === `${f.key}_end`
                );
            }
            if (f.type === "numberrange") {
                return (
                    filter.key === `min_${f.key}` ||
                    filter.key === `max_${f.key}`
                );
            }
            return false;
        });

        return !!rangeField;
    });

    if (visibleFilters.length === 0) {
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
                        Active Filters ({visibleFilters.length})
                    </span>
                </Text>
                {showClearAll && visibleFilters.length > 1 && (
                    <button
                        onClick={clearAllFilters}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                    >
                        Clear All
                    </button>
                )}
            </div>

            <Space size={[8, 8]} wrap>
                {visibleFilters.map((filter) => (
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
