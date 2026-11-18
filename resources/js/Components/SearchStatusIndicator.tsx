import React from "react";
import { Badge, Button, Spin } from "antd";
import { SearchOutlined, ClearOutlined } from "@ant-design/icons";
import { useSearch } from "@/contexts/SearchContext";
import { useTranslation } from "@/Hooks/useTranslation";

interface SearchStatusIndicatorProps {
    showClearButton?: boolean;
    onClearSearch?: () => void;
    className?: string;
}

const SearchStatusIndicator: React.FC<SearchStatusIndicatorProps> = ({
    showClearButton = true,
    onClearSearch,
    className = "",
}) => {
    const { t } = useTranslation();
    const { query, isSearching, hasActiveSearch, clearSearch } = useSearch();

    const handleClearSearch = () => {
        clearSearch();
        if (onClearSearch) {
            onClearSearch();
        }
    };

    if (!hasActiveSearch()) {
        return null;
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="flex items-center gap-1 px-3 py-1 bg-blue-50 border border-blue-200 rounded-md">
                <SearchOutlined className="text-blue-600" />
                <span className="text-sm text-blue-700">
                    {t("pages.filters.searching", { query })}
                </span>
                {isSearching && <Spin size="small" className="ml-1" />}
            </div>

            {showClearButton && (
                <Button
                    icon={<ClearOutlined />}
                    onClick={handleClearSearch}
                    size="small"
                    type="text"
                    danger
                    title={t("pages.filters.clear_search")}
                >
                    {t("pages.filters.clear")}
                </Button>
            )}
        </div>
    );
};

export default SearchStatusIndicator;
