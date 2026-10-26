import React, {
    createContext,
    useContext,
    useState,
    useCallback,
    ReactNode,
    useEffect,
} from "react";
import { router } from "@inertiajs/react";
import { getCurrentQueryParams } from "@/lib/inertiaQuery";

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
    /**
     * Presentation hint for the redesigned Leads filter modal. The generic
     * UniversalFilterForm ignores this and renders by `type` as before.
     */
    control?:
        | "pills"
        | "temperature"
        | "segmented"
        | "checklist"
        | "tokens"
        | "select"
        | "datePresets"
        | "scoreRange"
        | "utm";
    /** Key into the `filterFacets` page prop for per-option result counts. */
    facetKey?: string;
    /**
     * The two URL params a `datePresets` control writes. Defaults to the legacy
     * `start_date`/`end_date` pair; a page with a second date range (e.g. deals'
     * close date) names its own.
     */
    rangeKeys?: [string, string];
    /**
     * Tracked in URL/draft state but never rendered as its own control — used by
     * paired keys like end_date, which the date-range control writes alongside start_date.
     */
    hidden?: boolean;
    /** Short noun used when describing this filter in a sentence ("status is one of 4"). */
    sentence?: string;
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
    /**
     * Inertia partial-reload prop keys to request when filters change. Omit
     * (or leave unset) to fall back to a full (unscoped) visit — do not pass
     * `only: undefined`, which overwrites Inertia's default `only: []` and
     * crashes isPartial(). Every scoped reload elsewhere on these pages
     * (pagination, tab switches, pipeline/board switches) already knows its
     * own list, so pass the same one here instead of re-fetching the whole
     * page on every filter change.
     */
    only?: string[];
}

interface FilterContextValue {
    // Applied filter values (shown in ContextualActiveFilters)
    filters: Record<string, any>;

    // Applied filter metadata with labels and display values
    filterMetadata: Record<string, FilterValue>;

    // Draft filter values (used in form while drawer is open)
    draftFilters: Record<string, any>;

    // Draft filter metadata
    draftFilterMetadata: Record<string, FilterValue>;

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

/** Wire keys for daterange fields (tasks use due_start_date, not due_date_range_start). */
function dateRangeParamKeys(field: FilterFieldConfig): [string, string] {
    return field.rangeKeys ?? [`${field.key}_start`, `${field.key}_end`];
}

function addManagedFilterKeys(
    managedKeys: Set<string>,
    field: FilterFieldConfig,
): void {
    managedKeys.add(field.key);
    if (field.type === "daterange") {
        const [startKey, endKey] = dateRangeParamKeys(field);
        managedKeys.add(startKey);
        managedKeys.add(endKey);
    } else if (field.type === "numberrange") {
        managedKeys.add(`min_${field.key}`);
        managedKeys.add(`max_${field.key}`);
    }
}

function isEmptyFilterValue(value: any): boolean {
    return (
        value === null ||
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
    );
}

/**
 * Query params for a filter visit: the current URL minus every key the filter
 * form owns, plus the given filter values.
 *
 * Fields in `excludeFields` (e.g. `search`, owned by UniversalSearchBox) are
 * not rendered by the form, so the form never owns them: their URL value is
 * kept as-is. Taking them from form state instead let a stale value
 * overwrite — or drop — a search typed after the page loaded.
 *
 * The URL is read with getCurrentQueryParams so repeated `key[]=a&key[]=b`
 * pairs survive as arrays instead of collapsing to the last value.
 */
function buildFilterVisitParams(
    config: FilterConfig,
    values: Record<string, any>,
): Record<string, any> {
    const excluded = new Set(config.excludeFields ?? []);
    const managedKeys = new Set<string>();
    config.fields.forEach((field) => {
        if (!excluded.has(field.key)) {
            addManagedFilterKeys(managedKeys, field);
        }
    });

    const params: Record<string, any> = getCurrentQueryParams();
    managedKeys.forEach((key) => {
        delete params[key];
    });

    Object.entries(values).forEach(([key, value]) => {
        if (excluded.has(key) || isEmptyFilterValue(value)) return;
        // Multiselect values are comma-joined on the wire so setConfig's URL
        // parser (which splits on ",") can read them back.
        params[key] = Array.isArray(value) ? value.join(",") : value;
    });

    return { ...params, page: 1 };
}

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
    // Applied filters (shown in ContextualActiveFilters, synced with URL)
    const [filters, setFilters] = useState<Record<string, any>>({});
    const [filterMetadata, setFilterMetadata] = useState<
        Record<string, FilterValue>
    >({});

    // Draft filters (used in form while drawer is open)
    const [draftFilters, setDraftFilters] = useState<Record<string, any>>({});
    const [draftFilterMetadata, setDraftFilterMetadata] = useState<
        Record<string, FilterValue>
    >({});

    const [config, setConfigState] = useState<FilterConfig | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    // Sync draft state with applied state when drawer opens
    useEffect(() => {
        if (isDrawerOpen) {
            setDraftFilters({ ...filters });
            setDraftFilterMetadata({ ...filterMetadata });
        }
    }, [isDrawerOpen]);

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
                // Remove filter if value is empty (from draft state)
                setDraftFilters((prev) => {
                    const newFilters = { ...prev };
                    delete newFilters[key];
                    return newFilters;
                });

                setDraftFilterMetadata((prev) => {
                    const newMetadata = { ...prev };
                    delete newMetadata[key];
                    return newMetadata;
                });
                return;
            }

            const computedLabel = label || getFieldLabel(key);
            const computedDisplayValue =
                displayValue || formatDisplayValue(key, value);

            // Update draft state (not applied state)
            setDraftFilters((prev) => ({
                ...prev,
                [key]: value,
            }));

            setDraftFilterMetadata((prev) => ({
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

                // Current filters minus the removed key
                const updatedFilters = { ...filters };
                delete updatedFilters[key];

                const finalParams = buildFilterVisitParams(
                    config,
                    updatedFilters,
                );

                router.get(route(config.routeName), finalParams, {
                    ...(config.only ? { only: config.only } : {}),
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
        setDraftFilters({});
        setDraftFilterMetadata({});

        if (!config) return;

        router.get(route(config.routeName), config.defaultValues || {}, {
            ...(config.only ? { only: config.only } : {}),
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });
    }, [config]);

    const applyFilters = useCallback(() => {
        if (!config) return;

        // Copy draft state to applied state
        setFilters({ ...draftFilters });
        setFilterMetadata({ ...draftFilterMetadata });

        // Use draftFilters since applied state hasn't updated yet
        const finalParams = buildFilterVisitParams(config, draftFilters);

        router.get(route(config.routeName), finalParams, {
            ...(config.only ? { only: config.only } : {}),
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

        setIsDrawerOpen(false);
    }, [config, draftFilters, draftFilterMetadata]);

    const resetFilters = useCallback(() => {
        if (!config) return;

        clearAllFilters();

        router.get(route(config.routeName), config.defaultValues || {}, {
            ...(config.only ? { only: config.only } : {}),
            preserveState: true,
            preserveScroll: true,
            replace: true,
        });

        setIsDrawerOpen(false);
    }, [config, clearAllFilters]);

    const setConfig = useCallback((newConfig: FilterConfig) => {
        setConfigState(newConfig);

        // Initialize filters from URL params if available. Read via
        // getCurrentQueryParams so a bracketed `key[]=a&key[]=b` URL is
        // understood too, instead of the filter silently vanishing.
        const urlParams = getCurrentQueryParams();
        const initialFilters: Record<string, any> = {};
        const initialMetadata: Record<string, FilterValue> = {};

        newConfig.fields.forEach((field) => {
            // Helper to process a single key
            const processKey = (key: string, label: string, type: string) => {
                const raw = urlParams[key];
                const value = Array.isArray(raw)
                    ? raw.join(",")
                    : raw == null
                      ? ""
                      : String(raw);
                if (value) {
                    let parsedValue: any = value;

                    if (type === "multiselect") {
                        parsedValue = value.split(",");
                        // Only canonical numbers become numbers: "007" or
                        // "1e3" must round-trip unchanged or the filter
                        // silently matches a different value.
                        parsedValue = parsedValue.map((v: string) => {
                            const num = Number(v);
                            return v.trim() !== "" && String(num) === v
                                ? num
                                : v;
                        });
                    } else if (type === "number" || type === "numberrange") {
                        parsedValue = Number(value);
                    } else if (type === "select") {
                        // Try to convert to number if it looks like one
                        const num = Number(value);
                        if (value.trim() !== "" && String(num) === value) {
                            parsedValue = num;
                        }
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
                const [startKey, endKey] = dateRangeParamKeys(field);
                processKey(startKey, `${field.label} Start`, "date");
                processKey(endKey, `${field.label} End`, "date");
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

        // Initialize both applied and draft state from URL
        setFilters(initialFilters);
        setFilterMetadata(initialMetadata);
        setDraftFilters(initialFilters);
        setDraftFilterMetadata(initialMetadata);
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
        draftFilters,
        draftFilterMetadata,
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
