import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
} from "react";
import { router } from "@inertiajs/react";

export interface FilterValue {
    key: string;
    value: any;
    label: string;
    displayValue: string;
}

export interface FilterOption {
    value: any;
    label: string;
}

export interface FilterFieldConfig {
    key: string;
    label: string;
    type:
        | "text"
        | "select"
        | "multiselect"
        | "date"
        | "daterange"
        | "number"
        | "numberrange";
    placeholder?: string;
    section?: string;
    span?: number;
    options?: FilterOption[] | (() => FilterOption[]);
    dependsOn?: string; // Key of another filter this depends on
    filterOptions?: (dependentValue: any) => FilterOption[];
    formatDisplayValue?: (value: any, options?: FilterOption[]) => string;
    validation?: (value: any) => string | null;
}

export interface FilterConfig {
    routeName: string;
    title: string;
    fields: FilterFieldConfig[];
    defaultValues?: Record<string, any>;
}

interface FilterContextValue {
    // Current filter values
    filters: Record<string, any>;

    // Filter metadata with labels and display values
    filterMetadata: Record<string, FilterValue>;

    // Current filter configuration
    config: FilterConfig | null;

    // Actions
    setFilter: (
        key: string,
        value: any,
        label?: string,
        displayValue?: string
    ) => void;
    removeFilter: (key: string) => void;
    clearAllFilters: () => void;
    applyFilters: () => void;
    resetFilters: () => void;

    // Config management
    setConfig: (config: FilterConfig) => void;

    // UI state
    isDrawerOpen: boolean;
    openDrawer: () => void;
    closeDrawer: () => void;

    // Utility methods
    getActiveFilterCount: () => number;
    getFilterDisplayValue: (key: string) => string | null;
    getFilterLabel: (key: string) => string | null;
}

const FilterContext = createContext<FilterContextValue | null>(null);

export const useFilter = () => {
    const context = useContext(FilterContext);
    if (!context) {
        throw new Error("useFilter must be used within a FilterProvider");
    }
    return context;
};

interface FilterProviderProps {
    children: ReactNode;
}

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [filterMetadata, setFilterMetadata] = useState<
        Record<string, FilterValue>
    >({});
    const [config, setConfigState] = useState<FilterConfig | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Helper function to format display value based on field config
    const formatDisplayValue = useCallback(
        (key: string, value: any): string => {
            if (!config || !value) return String(value || "");

            const fieldConfig = config.fields.find(
                (field) => field.key === key
            );

            if (fieldConfig?.formatDisplayValue) {
                const options =
                    typeof fieldConfig.options === "function"
                        ? fieldConfig.options()
                        : fieldConfig.options;
                return fieldConfig.formatDisplayValue(value, options);
            }

            if (
                fieldConfig?.type === "select" ||
                fieldConfig?.type === "multiselect"
            ) {
                const options =
                    typeof fieldConfig.options === "function"
                        ? fieldConfig.options()
                        : fieldConfig.options || [];

                if (Array.isArray(value)) {
                    return value
                        .map((v) => {
                            const option = options.find(
                                (opt) => opt.value === v
                            );
                            return option ? option.label : String(v);
                        })
                        .join(", ");
                } else {
                    const option = options.find((opt) => opt.value === value);
                    return option ? option.label : String(value);
                }
            }

            if (fieldConfig?.type === "daterange" && Array.isArray(value)) {
                return value.join(" to ");
            }

            if (fieldConfig?.type === "numberrange" && Array.isArray(value)) {
                return `${value[0]} - ${value[1]}`;
            }

            return String(value);
        },
        [config]
    );

    // Helper function to get field label
    const getFieldLabel = useCallback(
        (key: string): string => {
            if (!config) return key;

            const fieldConfig = config.fields.find(
                (field) => field.key === key
            );
            return (
                fieldConfig?.label ||
                key.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())
            );
        },
        [config]
    );

    const setFilter = useCallback(
        (key: string, value: any, label?: string, displayValue?: string) => {
            if (
                value === null ||
                value === undefined ||
                value === "" ||
                (Array.isArray(value) && value.length === 0)
            ) {
                // Remove filter if value is empty
                removeFilter(key);
                return;
            }

            const computedLabel = label || getFieldLabel(key);
            const computedDisplayValue =
                displayValue || formatDisplayValue(key, value);

            setFilters((prev) => ({
                ...prev,
                [key]: value,
            }));

            setFilterMetadata((prev) => ({
                ...prev,
                [key]: {
                    key,
                    value,
                    label: computedLabel,
                    displayValue: computedDisplayValue,
                },
            }));
        },
        [formatDisplayValue, getFieldLabel]
    );

    const removeFilter = useCallback((key: string) => {
        setFilters((prev) => {
            const newFilters = { ...prev };
            delete newFilters[key];
            return newFilters;
        });

        setFilterMetadata((prev) => {
            const newMetadata = { ...prev };
            delete newMetadata[key];
            return newMetadata;
        });
    }, []);

    const clearAllFilters = useCallback(() => {
        setFilters({});
        setFilterMetadata({});
    }, []);

    const applyFilters = useCallback(() => {
        if (!config) return;

        // Clean filters - remove empty values
        const cleanFilters = Object.entries(filters).reduce(
            (acc, [key, value]) => {
                if (
                    value !== null &&
                    value !== undefined &&
                    value !== "" &&
                    !(Array.isArray(value) && value.length === 0)
                ) {
                    acc[key] = value;
                }
                return acc;
            },
            {} as Record<string, any>
        );

        router.get(
            route(config.routeName),
            {
                ...cleanFilters,
                page: 1, // Reset to first page when applying filters
            },
            {
                preserveState: true,
                preserveScroll: true,
                replace: true,
            }
        );

        setIsDrawerOpen(false);
    }, [config, filters]);

    const resetFilters = useCallback(() => {
        if (!config) return;

        clearAllFilters();

        router.get(route(config.routeName), config.defaultValues || {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

        setIsDrawerOpen(false);
    }, [config, clearAllFilters]);

    const setConfig = useCallback(
        (newConfig: FilterConfig) => {
            setConfigState(newConfig);

            // Initialize filters from URL params if available
            const urlParams = new URLSearchParams(window.location.search);
            const initialFilters: Record<string, any> = {};
            const initialMetadata: Record<string, FilterValue> = {};

            newConfig.fields.forEach((field) => {
                const value = urlParams.get(field.key);
                if (value) {
                    let parsedValue: any = value;

                    // Parse value based on field type
                    if (field.type === "multiselect") {
                        parsedValue = value.split(",");
                    } else if (field.type === "number") {
                        parsedValue = Number(value);
                    } else if (
                        field.type === "daterange" ||
                        field.type === "numberrange"
                    ) {
                        // For ranges, we might have separate start/end parameters
                        // This would need to be handled based on your URL structure
                    }

                    initialFilters[field.key] = parsedValue;
                    initialMetadata[field.key] = {
                        key: field.key,
                        value: parsedValue,
                        label: field.label,
                        displayValue: formatDisplayValue(
                            field.key,
                            parsedValue
                        ),
                    };
                }
            });

            setFilters(initialFilters);
            setFilterMetadata(initialMetadata);
        },
        [formatDisplayValue]
    );

    const openDrawer = useCallback(() => setIsDrawerOpen(true), []);
    const closeDrawer = useCallback(() => setIsDrawerOpen(false), []);

    const getActiveFilterCount = useCallback(() => {
        return Object.keys(filterMetadata).length;
    }, [filterMetadata]);

    const getFilterDisplayValue = useCallback(
        (key: string): string | null => {
            return filterMetadata[key]?.displayValue || null;
        },
        [filterMetadata]
    );

    const getFilterLabel = useCallback(
        (key: string): string | null => {
            return filterMetadata[key]?.label || null;
        },
        [filterMetadata]
    );

    const contextValue: FilterContextValue = {
        filters,
        filterMetadata,
        config,
        setFilter,
        removeFilter,
        clearAllFilters,
        applyFilters,
        resetFilters,
        setConfig,
        isDrawerOpen,
        openDrawer,
        closeDrawer,
        getActiveFilterCount,
        getFilterDisplayValue,
        getFilterLabel,
    };

    return (
        <FilterContext.Provider value={contextValue}>
            {children}
        </FilterContext.Provider>
    );
};
