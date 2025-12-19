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
    excludeFields?: string[];
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

// Helper function to format display value based on field config
const getDisplayValue = (
    key: string,
    value: any,
    config: FilterConfig | null
): string => {
    if (!config || !value) return String(value || "");

    // Handle range keys which might not match field keys directly
    let fieldKey = key;
    if (key.endsWith("_start")) fieldKey = key.substring(0, key.length - 6);
    else if (key.endsWith("_end")) fieldKey = key.substring(0, key.length - 4);
    else if (key.startsWith("min_")) fieldKey = key.substring(4);
    else if (key.startsWith("max_")) fieldKey = key.substring(4);

    const fieldConfig = config.fields.find(
        (field) => field.key === fieldKey || field.key === key
    );

    if (fieldConfig?.formatDisplayValue) {
        const options =
            typeof fieldConfig.options === "function"
                ? fieldConfig.options()
                : fieldConfig.options;
        return fieldConfig.formatDisplayValue(value, options);
    }

    if (fieldConfig?.type === "select" || fieldConfig?.type === "multiselect") {
        const options =
            typeof fieldConfig.options === "function"
                ? fieldConfig.options()
                : fieldConfig.options || [];

        if (Array.isArray(value)) {
            return value
                .map((v) => {
                    const option = options.find((opt) => opt.value == v);
                    return option ? option.label : String(v);
                })
                .join(", ");
        } else {
            const option = options.find((opt) => opt.value == value);
            return option ? option.label : String(value);
        }
    }

    if (fieldConfig?.type === "daterange") {
        // For individual start/end values, just return the date string
        return String(value);
    }

    if (fieldConfig?.type === "numberrange") {
        return String(value);
    }

    return String(value);
};

export const FilterProvider: React.FC<FilterProviderProps> = ({ children }) => {
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [filterMetadata, setFilterMetadata] = useState<
        Record<string, FilterValue>
    >({});
    const [config, setConfigState] = useState<FilterConfig | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Helper function to format display value based on field config
    const formatDisplayValue = useCallback(
        (
            key: string,
            value: any,
            configOverride?: FilterConfig | null
        ): string => {
            return getDisplayValue(key, value, configOverride || config);
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
            console.log(value, "filter applied  ...");
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

    const removeFilter = useCallback(
        (key: string) => {
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

            // Automatically apply filters after removal
            // We need to use a timeout to ensure state updates have processed
            // Or we can pass the new state directly to a modified applyFilters
            setTimeout(() => {
                // We can't call applyFilters directly here because it uses the 'filters' state
                // which hasn't updated yet in this closure.
                // Instead, we'll trigger a custom event or use a ref, but for now,
                // let's duplicate the apply logic with the new state.

                if (!config) return;

                const urlParams = new URLSearchParams(window.location.search);
                const currentParams: Record<string, any> = {};
                urlParams.forEach((value, k) => {
                    currentParams[k] = value;
                });

                // Get current filters but exclude the removed key
                const updatedFilters = { ...filters };
                delete updatedFilters[key];

                const cleanFilters = Object.entries(updatedFilters).reduce(
                    (acc, [k, value]) => {
                        if (
                            value !== null &&
                            value !== undefined &&
                            value !== "" &&
                            !(Array.isArray(value) && value.length === 0)
                        ) {
                            acc[k] = value;
                        }
                        return acc;
                    },
                    {} as Record<string, any>
                );

                const managedKeys = new Set<string>();
                config.fields.forEach((field) => {
                    managedKeys.add(field.key);
                    if (field.type === "daterange") {
                        managedKeys.add(`${field.key}_start`);
                        managedKeys.add(`${field.key}_end`);
                    } else if (field.type === "numberrange") {
                        managedKeys.add(`min_${field.key}`);
                        managedKeys.add(`max_${field.key}`);
                    }
                });

                managedKeys.forEach((k) => {
                    delete currentParams[k];
                });

                const finalParams = {
                    ...currentParams,
                    ...cleanFilters,
                    page: 1,
                };

                router.get(route(config.routeName), finalParams, {
                    preserveState: true,
                    preserveScroll: true,
                    replace: true,
                });
            }, 0);
        },
        [config, filters]
    );

    const clearAllFilters = useCallback(() => {
        setFilters({});
        setFilterMetadata({});

        if (!config) return;

        router.get(route(config.routeName), config.defaultValues || {}, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }, [config]);

    const applyFilters = useCallback(() => {
        if (!config) return;

        // Get current URL parameters to preserve them
        const urlParams = new URLSearchParams(window.location.search);
        const currentParams: Record<string, any> = {};
        urlParams.forEach((value, key) => {
            currentParams[key] = value;
        });

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

        // Identify keys that are managed by the current filter config
        // We need to remove these from currentParams if they are not in cleanFilters
        // (meaning they were cleared by the user)
        const managedKeys = new Set<string>();
        config.fields.forEach((field) => {
            managedKeys.add(field.key);
            if (field.type === "daterange") {
                managedKeys.add(`${field.key}_start`);
                managedKeys.add(`${field.key}_end`);
            } else if (field.type === "numberrange") {
                managedKeys.add(`min_${field.key}`);
                managedKeys.add(`max_${field.key}`);
            }
        });

        // Remove managed keys from currentParams
        managedKeys.forEach((key) => {
            delete currentParams[key];
        });

        // Merge preserved params with new filters
        const finalParams = {
            ...currentParams,
            ...cleanFilters,
            page: 1, // Reset to first page
        };

        router.get(route(config.routeName), finalParams, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

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

    const setConfig = useCallback((newConfig: FilterConfig) => {
        setConfigState(newConfig);

        // Initialize filters from URL params if available
        const urlParams = new URLSearchParams(window.location.search);
        const initialFilters: Record<string, any> = {};
        const initialMetadata: Record<string, FilterValue> = {};

        newConfig.fields.forEach((field) => {
            // Helper to process a single key
            const processKey = (key: string, label: string, type: string) => {
                const value = urlParams.get(key);
                if (value) {
                    let parsedValue: any = value;

                    if (type === "multiselect") {
                        parsedValue = value.split(",");
                    } else if (type === "number" || type === "numberrange") {
                        parsedValue = Number(value);
                    }

                    initialFilters[key] = parsedValue;
                    initialMetadata[key] = {
                        key: key,
                        value: parsedValue,
                        label: label,
                        displayValue: getDisplayValue(
                            key,
                            parsedValue,
                            newConfig
                        ),
                    };
                }
            };

            if (field.type === "daterange") {
                processKey(
                    `${field.key}_start`,
                    `${field.label} Start`,
                    "date"
                );
                processKey(`${field.key}_end`, `${field.label} End`, "date");
            } else if (field.type === "numberrange") {
                processKey(
                    `min_${field.key}`,
                    `Min ${field.label}`,
                    "numberrange"
                );
                processKey(
                    `max_${field.key}`,
                    `Max ${field.label}`,
                    "numberrange"
                );
            } else {
                processKey(field.key, field.label, field.type);
            }
        });

        setFilters(initialFilters);
        setFilterMetadata(initialMetadata);
    }, []);

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
