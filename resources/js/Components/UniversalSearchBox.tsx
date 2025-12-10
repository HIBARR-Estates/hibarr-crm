import React, { useState, useEffect } from "react";
import { Input } from "antd";
import { useFilter } from "@/contexts/FilterContext";
import { router } from "@inertiajs/react";

interface UniversalSearchBoxProps {
    placeholder?: string;
    className?: string;
    size?: "small" | "middle" | "large";
    allowClear?: boolean;
    disabled?: boolean;
    onSearch?: (value: string) => void;
}

const UniversalSearchBox: React.FC<UniversalSearchBoxProps> = ({
    placeholder,
    className = "w-full max-w-md",
    size = "middle",
    allowClear = true,
    disabled = false,
    onSearch,
}) => {
    const { filters, setFilter, config } = useFilter();
    const [localValue, setLocalValue] = useState<string>(() => {
        if (typeof window !== "undefined") {
            const params = new URLSearchParams(window.location.search);
            return params.get("search") || filters.search || "";
        }
        return filters.search || "";
    });

    // Sync local value with filter context
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlSearch = urlParams.get("search");

        if (filters.search !== undefined) {
            setLocalValue(filters.search);
        } else if (urlSearch) {
            setLocalValue(urlSearch);
        } else {
            setLocalValue("");
        }
    }, [filters.search]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalValue(e.target.value);
    };

    const handleSearch = (value: string) => {
        setFilter("search", value);

        if (config) {
            // Get current URL parameters to preserve them
            const urlParams = new URLSearchParams(window.location.search);
            const currentParams: Record<string, any> = {};
            urlParams.forEach((val, key) => {
                currentParams[key] = val;
            });

            // Merge params first
            const finalParams: Record<string, any> = {
                ...currentParams,
                ...filters,
                search: value,
                page: 1,
            };

            // Remove empty keys
            Object.keys(finalParams).forEach((key) => {
                if (
                    finalParams[key] === null ||
                    finalParams[key] === "" ||
                    finalParams[key] === undefined
                ) {
                    delete finalParams[key];
                }
            });

            router.get(route(config.routeName), finalParams, {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            });
        }

        onSearch?.(value);
    };

    return (
        <div className={className}>
            <Input.Search
                placeholder={placeholder || "Search..."}
                value={localValue}
                onChange={handleInputChange}
                onSearch={handleSearch}
                allowClear={allowClear}
                disabled={disabled}
                size={size}
                style={{ width: "100%" }}
            />
        </div>
    );
};

export default UniversalSearchBox;
