import { useCallback, useState } from "react";

const STORAGE_KEY = "deal-field-view-mode";

export type DealFieldViewMode = "scoped" | "all";

function readStoredMode(defaultMode: DealFieldViewMode): DealFieldViewMode {
    if (typeof window === "undefined") {
        return defaultMode;
    }

    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored === "all") {
            return "all";
        }
        if (stored === "scoped") {
            return "scoped";
        }
    } catch {
        return defaultMode;
    }

    return defaultMode;
}

export function useDealFieldViewMode(
    defaultMode: DealFieldViewMode = "scoped",
) {
    const [mode, setModeState] = useState<DealFieldViewMode>(() =>
        readStoredMode(defaultMode),
    );

    const setMode = useCallback((next: DealFieldViewMode) => {
        setModeState(next);
        try {
            localStorage.setItem(STORAGE_KEY, next);
        } catch {
            // Preference is optional; toggling must still work without storage.
        }
    }, []);

    const showAllFields = mode === "all";

    const toggleShowAllFields = useCallback(() => {
        setMode(mode === "all" ? "scoped" : "all");
    }, [mode, setMode]);

    return { mode, setMode, showAllFields, toggleShowAllFields };
}

export function pipelineHasFieldScopes(
    categoryScopeMap: Record<
        string,
        { pipelineWide?: unknown[]; byStage?: Record<string, unknown[]> }
    >,
    fieldScopeMap: Record<string, Record<string, unknown>>,
): boolean {
    const hasCategoryScopes = Object.values(categoryScopeMap).some(
        (scope) =>
            (scope.pipelineWide?.length ?? 0) > 0 ||
            Object.keys(scope.byStage ?? {}).length > 0,
    );

    const hasFieldScopes = Object.values(fieldScopeMap).some(
        (models) => Object.keys(models).length > 0,
    );

    return hasCategoryScopes || hasFieldScopes;
}
