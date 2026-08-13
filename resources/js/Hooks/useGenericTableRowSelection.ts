import type { Key } from "react";
import { useCallback, useMemo, useState } from "react";
import type { RowSelectionType, TableRowSelection } from "antd/es/table/interface";

type RowSelectionOptions<T> = {
    type?: RowSelectionType;
    /**
     * Rows on the current page. When provided, selection is merged across
     * pages instead of being replaced by Ant Design's page-local onChange.
     */
    pageData?: T[];
    /**
     * When true, every row on the current page appears selected (select-all-matching).
     * Unchecking any row exits this mode via onExitSelectAllMatching.
     */
    selectAllMatching?: boolean;
    onExitSelectAllMatching?: () => void;
};

/**
 * Checkbox/radio row selection for server-paginated tables.
 * Pass `pageData` so paging keeps selections from other pages.
 */
const useGenericTableRowSelection = <T extends { id: Key }>(
    typeOrOptions: RowSelectionType | RowSelectionOptions<T> = "checkbox",
) => {
    const options: RowSelectionOptions<T> =
        typeof typeOrOptions === "string" || typeOrOptions == null
            ? { type: (typeOrOptions as RowSelectionType) ?? "checkbox" }
            : typeOrOptions;

    const {
        type = "checkbox",
        pageData,
        selectAllMatching = false,
        onExitSelectAllMatching,
    } = options;
    const [selectedEntities, setSelectedEntities] = useState<T[]>([]);

    const pageIds = useMemo(
        () => new Set((pageData ?? []).map((row) => row.id)),
        [pageData],
    );

    const onChange = useCallback(
        (_keys: Key[], selectedRows: T[]) => {
            if (selectAllMatching) {
                onExitSelectAllMatching?.();
                setSelectedEntities(selectedRows);
                return;
            }

            if (!pageData) {
                setSelectedEntities(selectedRows);
                return;
            }

            setSelectedEntities((prev) => {
                const kept = prev.filter((row) => !pageIds.has(row.id));
                return [...kept, ...selectedRows];
            });
        },
        [pageData, pageIds, selectAllMatching, onExitSelectAllMatching],
    );

    const clearSelected = useCallback(() => setSelectedEntities([]), []);

    const selectedRowKeys = selectAllMatching
        ? (pageData ?? []).map((row) => row.id)
        : selectedEntities.map((item) => item.id);

    const rowSelection: TableRowSelection<T> = {
        type,
        selectedRowKeys,
        onChange,
        preserveSelectedRowKeys: true,
    };

    return {
        selectedEntities,
        rowSelection,
        clearSelected,
        setSelectedEntities,
    };
};

export default useGenericTableRowSelection;
