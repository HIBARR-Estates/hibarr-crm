import React, { useMemo, useCallback } from "react";
import { Table, ConfigProvider } from "antd";
import type { TableProps, TableColumnsType } from "antd";
import type { LaravelPaginationMeta, EmptyStateConfig } from "./types";
import EmptyState from "./EmptyState";
import DataTablePagination from "./DataTablePagination";

// Ant Design component-level theme applied to every DataTable instance.
// Defined outside the component so it is a stable object reference (rerender-memo-with-default-value).
const TABLE_THEME = {
    components: {
        Table: {
            cellPaddingInline: 16,
            cellPaddingBlock: 10,
            cellPaddingBlockSM: 6,
            headerBg: "#f8fafc",
            headerColor: "#374151",
            headerSortActiveBg: "#eff6ff",
            headerSortHoverBg: "#e8f4fd",
            rowHoverBg: "#eff6ff",
            rowSelectedBg: "#eff6ff",
            rowSelectedHoverBg: "#dbeafe",
            borderColor: "#e5e7eb",
            fixedHeaderSortActiveBg: "#eff6ff",
        },
    },
} as const;

interface DataTableProps<T extends object>
    extends Omit<TableProps<T>, "pagination"> {
    /** Laravel paginator metadata. Pass null/undefined to hide pagination. */
    paginationData?: LaravelPaginationMeta | null;
    onPageChange?: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    /** Override the default empty-state appearance. */
    emptyState?: EmptyStateConfig;
    /** Extra classes on the outer container div. */
    containerClassName?: string;
    /** Alternate row background colour. Defaults to true. */
    stripe?: boolean;
    /**
     * When true, any column with key "actions" is automatically pinned to the
     * right edge. Defaults to true.
     */
    stickyActionsColumn?: boolean;
}

function DataTable<T extends object>(props: DataTableProps<T>) {
    const {
        paginationData,
        onPageChange,
        onPageSizeChange,
        pageSizeOptions,
        emptyState,
        containerClassName = "",
        stripe = true,
        stickyActionsColumn = true,
        columns,
        rowClassName,
        dataSource,
        scroll,
        sticky = true,
        ...tableProps
    } = props;

    // Pin the "actions" column to the right if not already fixed (rerender-memo)
    const mergedColumns = useMemo<TableColumnsType<T> | undefined>(() => {
        if (!columns || !stickyActionsColumn) return columns;
        return columns.map((col) => {
            if (
                "key" in col &&
                col.key === "actions" &&
                !("fixed" in col && col.fixed)
            ) {
                return { ...col, fixed: "right" as const };
            }
            return col;
        });
    }, [columns, stickyActionsColumn]);

    // Merge caller's rowClassName with our zebra-stripe class (rerender-memo)
    const mergedRowClassName = useCallback(
        (record: T, index: number, indent: number): string => {
            const stripeClass =
                stripe && index % 2 !== 0 ? "dt-row-stripe" : "";
            const existing =
                typeof rowClassName === "function"
                    ? rowClassName(record, index, indent)
                    : (rowClassName ?? "");
            return [stripeClass, existing].filter(Boolean).join(" ");
        },
        [stripe, rowClassName],
    );

    // Stable empty-text node — only recreates when emptyState config changes (rerender-memo)
    const emptyText = useMemo(
        () => (
            <EmptyState
                title={emptyState?.title}
                description={emptyState?.description}
                icon={emptyState?.icon}
                action={emptyState?.action}
            />
        ),
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            emptyState?.title,
            emptyState?.description,
            emptyState?.icon,
            emptyState?.action,
        ],
    );

    return (
        <div className={`dt-container ${containerClassName}`}>
            <ConfigProvider theme={TABLE_THEME}>
                <Table<T>
                    rootClassName="dt-table"
                    columns={mergedColumns}
                    dataSource={dataSource}
                    rowClassName={mergedRowClassName}
                    sticky={sticky}
                    pagination={false}
                    locale={{ emptyText }}
                    scroll={scroll ?? { x: "max-content" }}
                    {...tableProps}
                />
            </ConfigProvider>

            {paginationData !== null &&
            paginationData !== undefined &&
            onPageChange !== undefined ? (
                <DataTablePagination
                    meta={paginationData}
                    onPageChange={onPageChange}
                    onPageSizeChange={onPageSizeChange}
                    pageSizeOptions={pageSizeOptions}
                />
            ) : null}
        </div>
    );
}

export default DataTable;
