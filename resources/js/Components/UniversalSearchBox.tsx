import React, { useState, useEffect } from "react";
import { Input, Spin } from "antd";
import { SearchOutlined } from "@ant-design/icons";
import { useSearch } from "@/contexts/SearchContext";

interface UniversalSearchBoxProps {
    placeholder?: string;
    className?: string;
    size?: "small" | "middle" | "large";
    allowClear?: boolean;
    disabled?: boolean;
    onSearch?: (value: string) => void;
    enterButton?: boolean;
}

const UniversalSearchBox: React.FC<UniversalSearchBoxProps> = ({
    placeholder,
    className = "w-full max-w-md",
    size = "middle",
    allowClear = true,
    disabled = false,
    onSearch,
    enterButton = true,
}) => {
    const {
        query,
        isSearching,
        searchConfig,
        setQuery,
        clearSearch,
        performSearch,
    } = useSearch();

    const [localValue, setLocalValue] = useState<string>("");

    // Sync local value with search context
    useEffect(() => {
        setLocalValue(query);
    }, [query]);

    // Use config placeholder if not provided as prop
    const effectivePlaceholder =
        placeholder || searchConfig?.placeholder || "Search...";

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setLocalValue(value);

        // Update search context - let it handle auto search if enabled
        setQuery(value);
    };

    const handleSearch = (value: string) => {
        setLocalValue(value);
        setQuery(value, true); // Immediate search

        // Call optional callback
        if (onSearch) {
            onSearch(value);
        }
    };

    const handleClear = () => {
        setLocalValue("");
        clearSearch();

        // Call optional callback
        if (onSearch) {
            onSearch("");
        }
    };

    const handlePressEnter = () => {
        if (!searchConfig?.autoSearch) {
            performSearch(localValue);
        }
    };

    return (
        <div className={className}>
            <Input.Search
                placeholder={effectivePlaceholder}
                value={localValue}
                onChange={handleInputChange}
                onSearch={handleSearch}
                onPressEnter={handlePressEnter}
                onClear={handleClear}
                allowClear={allowClear}
                disabled={disabled || isSearching}
                size={size}
                loading={isSearching}
                // enterButton={enterButton ? <SearchOutlined /> : false}
                style={{ width: "100%" }}
            />
        </div>
    );
};

export default UniversalSearchBox;
