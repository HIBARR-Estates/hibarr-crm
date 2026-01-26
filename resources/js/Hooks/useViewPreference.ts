import { useState, useEffect, useCallback } from "react";

type ViewMode = "kanban" | "table";

interface UseViewPreferenceOptions {
    /**
     * Unique key for storing the preference in localStorage
     */
    storageKey: string;
    /**
     * Default view mode if no preference is stored
     * @default "table"
     */
    defaultView?: ViewMode;
}

interface UseViewPreferenceReturn {
    /**
     * Current view mode
     */
    view: ViewMode;
    /**
     * Set the view mode (also persists to localStorage)
     */
    setView: (view: ViewMode) => void;
    /**
     * Whether the current view is kanban
     */
    isKanbanView: boolean;
    /**
     * Whether the current view is table/list
     */
    isTableView: boolean;
}

const STORAGE_PREFIX = "hibarr_view_preference_";

/**
 * Custom hook for persisting view preference (kanban/table) in localStorage
 *
 * @example
 * ```tsx
 * const { view, setView, isKanbanView, isTableView } = useViewPreference({
 *   storageKey: "deals",
 *   defaultView: "table"
 * });
 * ```
 */
export function useViewPreference({
    storageKey,
    defaultView = "table",
}: UseViewPreferenceOptions): UseViewPreferenceReturn {
    // Initialize state with value from localStorage or default
    const [view, setViewState] = useState<ViewMode>(() => {
        if (typeof window === "undefined") {
            return defaultView;
        }

        try {
            const stored = localStorage.getItem(
                `${STORAGE_PREFIX}${storageKey}`,
            );
            if (stored === "kanban" || stored === "table") {
                return stored;
            }
        } catch (error) {
            console.warn(
                `Failed to read view preference from localStorage:`,
                error,
            );
        }

        return defaultView;
    });

    // Setter that also persists to localStorage
    const setView = useCallback(
        (newView: ViewMode) => {
            setViewState(newView);

            if (typeof window !== "undefined") {
                try {
                    localStorage.setItem(
                        `${STORAGE_PREFIX}${storageKey}`,
                        newView,
                    );
                } catch (error) {
                    console.warn(
                        `Failed to save view preference to localStorage:`,
                        error,
                    );
                }
            }
        },
        [storageKey],
    );

    // Computed properties for convenience
    const isKanbanView = view === "kanban";
    const isTableView = view === "table";

    return {
        view,
        setView,
        isKanbanView,
        isTableView,
    };
}

export default useViewPreference;
