import { useCallback, useState } from "react";

/** Bulk-select state for the list view — a Set of task ids. */
export default function useTaskSelection() {
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

    const toggleGroupSelection = useCallback(
        (ids: number[], select: boolean) => {
            setSelected((current) => {
                const next = new Set(current);
                ids.forEach((id) =>
                    select ? next.add(id) : next.delete(id),
                );
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
        toggleSelect,
        toggleGroupSelection,
        allSelected,
    };
}
