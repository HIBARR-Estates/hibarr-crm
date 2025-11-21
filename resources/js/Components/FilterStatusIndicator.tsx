import React from "react";
import { Badge, Button } from "antd";
import { FilterOutlined, ClearOutlined } from "@ant-design/icons";
import { useFilter } from "@/contexts/FilterContext";

interface FilterStatusIndicatorProps {
    onOpenFilters?: () => void;
    showClearAll?: boolean;
}

const FilterStatusIndicator: React.FC<FilterStatusIndicatorProps> = ({
    onOpenFilters,
    showClearAll = true,
}) => {
    const { filters, clearAllFilters } = useFilter();
    const activeFilterCount = Object.keys(filters).length;

    return (
        <div className="flex items-center gap-2">
            <Badge count={activeFilterCount} size="small">
                <Button
                    icon={<FilterOutlined />}
                    onClick={onOpenFilters}
                    type={activeFilterCount > 0 ? "primary" : "default"}
                >
                    Filters
                </Button>
            </Badge>
            {showClearAll && activeFilterCount > 0 && (
                <Button
                    icon={<ClearOutlined />}
                    onClick={clearAllFilters}
                    size="small"
                    type="text"
                    danger
                >
                    Clear All
                </Button>
            )}
        </div>
    );
};

export default FilterStatusIndicator;
