import { useCallback, useState } from "react";

/**
 * Bulk-select state for a list view — a Set of row ids.
 *
 * Shared by every redesigned list that offers bulk actions; nothing in here
 * is entity-specific, so Tasks and Meetings select rows the same way.
 */
export default function useRowSelection() {
    const [selected, setSelected] = useState<Set<number>>(() => new Set());

    const selectedIds = Array.from(selected);
    const clearSelection = useCallback(() => setSelected(new Set()), []);

    const toggleSelect = useCallback((id: number) => {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, []);

    /**
     * Drops any selected id that is not in `ids`.
     *
     * A list whose visible rows change underneath the selection (a tab, a
     * page, a filter) calls this with the rows now on screen, so a bulk
     * action can never reach a row the reader can no longer see. Returns the
     * same Set when nothing was dropped, so it costs no re-render.
     */
    const retainOnly = useCallback((ids: number[]) => {
        setSelected((current) => {
            const visible = new Set(ids);
            const next = new Set<number>();
            current.forEach((id) => {
                if (visible.has(id)) next.add(id);
            });
            return next.size === current.size ? current : next;
        });
    }, []);

    const toggleGroupSelection = useCallback(
        (ids: number[], select: boolean) => {
            setSelected((current) => {
                const next = new Set(current);
                ids.forEach((id) => (select ? next.add(id) : next.delete(id)));
                return next;
            });
        },
        [],
    );

    const allSelected = useCallback(
        (ids: number[]) =>
            ids.length > 0 && ids.every((id) => selected.has(id)),
        [selected],
    );

    return {
        selected,
        selectedIds,
        clearSelection,
        retainOnly,
        toggleSelect,
        toggleGroupSelection,
        allSelected,
    };
}
