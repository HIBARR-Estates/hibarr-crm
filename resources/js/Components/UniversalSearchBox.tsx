import React, { useState, useEffect, useRef } from "react";
import { Input, InputRef, Tooltip } from "antd";
import { CornerDownLeft } from "lucide-react";
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

    // Track if we're currently syncing to prevent loops
    const isSyncingRef = useRef(false);
    const lastSearchedValue = useRef(filters.search || "");
    const inputRef = useRef<InputRef>(null);
    const keepFocused = useRef(false);

    // Sync with URL parameters (handles browser back/forward)
    useEffect(() => {
        const syncFromUrl = () => {
            const urlParams = new URLSearchParams(window.location.search);
            const urlSearch = urlParams.get("search") || "";

            if (!isSyncingRef.current && localValue !== urlSearch) {
                setLocalValue(urlSearch);
                setFilter("search", urlSearch);
                lastSearchedValue.current = urlSearch;
            }
        };

        // Listen for popstate (back/forward navigation)
        window.addEventListener("popstate", syncFromUrl);

        return () => {
            window.removeEventListener("popstate", syncFromUrl);
        };
    }, [localValue, setFilter]);

    // Sync local value with filter context changes
    useEffect(() => {
        // Only sync if config is loaded and matches current page
        let isConfigForCurrentPage = false;
        if (config) {
            try {
                const routeUrl = route(config.routeName);
                const configPath = routeUrl.startsWith("http")
                    ? new URL(routeUrl).pathname
                    : new URL(routeUrl, window.location.origin).pathname;

                // Normalize paths (remove trailing slashes)
                const currentPath = window.location.pathname.replace(/\/$/, "");
                const targetPath = configPath.replace(/\/$/, "");

                isConfigForCurrentPage = currentPath === targetPath;
            } catch (e) {
                // Fallback if route parsing fails
                isConfigForCurrentPage = !!config;
            }
        }

        if (
            isConfigForCurrentPage &&
            !isSyncingRef.current &&
            filters.search !== localValue
        ) {
            setLocalValue(filters.search || "");
            lastSearchedValue.current = filters.search || "";
        }
    }, [filters.search, config]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        keepFocused.current = true;
        setLocalValue(e.target.value);
    };

    const performSearch = (value: string) => {
        isSyncingRef.current = true;
        lastSearchedValue.current = value;

        setFilter("search", value);

        if (config) {
            // Get current URL parameters to preserve them
            const urlParams = new URLSearchParams(window.location.search);
            const currentParams: Record<string, any> = {};
            urlParams.forEach((val, key) => {
                currentParams[key] = val;
            });

            // Merge params
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
                onFinish: () => {
                    isSyncingRef.current = false;
                    if (keepFocused.current) {
                        inputRef.current?.focus({ preventScroll: true });
                    }
                },
            });
        } else {
            isSyncingRef.current = false;
        }

        onSearch?.(value);
    };

    // Only search on Enter (or clicking the search icon) — never while typing.
    const handleSearchSubmit = (value: string) => {
        if (value !== lastSearchedValue.current) {
            performSearch(value);
        }
    };

    return (
        <div className={className}>
            <Input.Search
                ref={inputRef}
                placeholder={placeholder || "Search..."}
                value={localValue}
                onChange={handleInputChange}
                onSearch={handleSearchSubmit}
                suffix={
                    <Tooltip title="Press Enter to search">
                        <CornerDownLeft
                            size={13}
                            className="text-gray-400"
                        />
                    </Tooltip>
                }
                onFocus={() => {
                    keepFocused.current = true;
                }}
                onBlur={() => {
                    // Delay so onFinish can still refocus after an in-flight visit
                    setTimeout(() => {
                        if (document.activeElement !== inputRef.current?.input) {
                            keepFocused.current = false;
                        }
                    }, 0);
                }}
                allowClear={allowClear}
                disabled={disabled}
                size={size}
                style={{ width: "100%" }}
            />
        </div>
    );
};

export default UniversalSearchBox;
