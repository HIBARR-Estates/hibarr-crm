import React, { useId, useMemo } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import type { LaravelPaginationMeta } from "./types";
import { buildPageRange } from "./utils";

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface DataTablePaginationProps {
    meta: LaravelPaginationMeta;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
}

// Shared button base class — hoisted to avoid re-creation on every render (rendering-hoist-jsx)
const NAV_BTN_BASE =
    "inline-flex items-center justify-center w-8 h-8 rounded-md text-sm border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500";

const DataTablePagination: React.FC<DataTablePaginationProps> = ({
    meta,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS as unknown as number[],
    className = "",
}) => {
    const { current_page, last_page, per_page, total, from, to } = meta;
    const selectId = useId();

    // Memoize page range so it only recalculates when the current page or total changes
    const pages = useMemo(
        () => buildPageRange(current_page, last_page),
        [current_page, last_page],
    );

    const hasPrev = current_page > 1;
    const hasNext = current_page < last_page;

    if (total === 0) return null;

    return (
        <div
            className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t border-gray-200 bg-white ${className}`}
        >
            {/* Left — result range + optional rows-per-page selector */}
            <div className="flex items-center gap-3 text-sm text-gray-500">
                <span aria-live="polite" aria-atomic="true">
                    Showing{" "}
                    <span className="font-medium text-gray-700">{from ?? 0}</span>
                    {"–"}
                    <span className="font-medium text-gray-700">{to ?? 0}</span>
                    {" of "}
                    <span className="font-medium text-gray-700">{total}</span>
                </span>

                {onPageSizeChange !== undefined ? (
                    <div className="flex items-center gap-1.5">
                        <label
                            htmlFor={selectId}
                            className="whitespace-nowrap text-gray-500 select-none"
                        >
                            Rows per page
                        </label>
                        <select
                            id={selectId}
                            value={per_page}
                            onChange={(e) =>
                                onPageSizeChange(Number(e.target.value))
                            }
                            className="text-sm border border-gray-200 rounded-md px-2 py-1 text-gray-700 bg-white cursor-pointer
                                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                                       hover:border-gray-300 transition-colors"
                        >
                            {pageSizeOptions.map((n) => (
                                <option key={n} value={n}>
                                    {n}
                                </option>
                            ))}
                        </select>
                    </div>
                ) : null}
            </div>

            {/* Right — page navigation controls */}
            <nav
                role="navigation"
                aria-label="Pagination"
                className="flex items-center gap-1"
            >
                <span
                    className="text-sm text-gray-500 mr-2 whitespace-nowrap"
                    aria-live="polite"
                    aria-atomic="true"
                >
                    Page{" "}
                    <span className="font-medium text-gray-700">{current_page}</span>
                    {" of "}
                    <span className="font-medium text-gray-700">{last_page}</span>
                </span>

                {/* Previous */}
                <button
                    type="button"
                    onClick={() => hasPrev && onPageChange(current_page - 1)}
                    disabled={!hasPrev}
                    aria-label="Previous page"
                    className={`${NAV_BTN_BASE} text-gray-500 border-gray-200 bg-white
                        hover:bg-gray-50 hover:border-gray-300
                        disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                    <LeftOutlined style={{ fontSize: 10 }} />
                </button>

                {/* Page number buttons */}
                {pages.map((page, idx) =>
                    page === "ellipsis" ? (
                        <span
                            key={`ellipsis-${idx}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-400 text-sm select-none"
                            aria-hidden="true"
                        >
                            …
                        </span>
                    ) : (
                        <button
                            key={page}
                            type="button"
                            onClick={() =>
                                page !== current_page && onPageChange(page)
                            }
                            aria-label={`Go to page ${page}`}
                            aria-current={
                                page === current_page ? "page" : undefined
                            }
                            className={`${NAV_BTN_BASE} ${
                                page === current_page
                                    ? "border-blue-600 bg-blue-600 text-white font-medium cursor-default"
                                    : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300 cursor-pointer"
                            }`}
                        >
                            {page}
                        </button>
                    ),
                )}

                {/* Next */}
                <button
                    type="button"
                    onClick={() => hasNext && onPageChange(current_page + 1)}
                    disabled={!hasNext}
                    aria-label="Next page"
                    className={`${NAV_BTN_BASE} text-gray-500 border-gray-200 bg-white
                        hover:bg-gray-50 hover:border-gray-300
                        disabled:opacity-40 disabled:cursor-not-allowed`}
                >
                    <RightOutlined style={{ fontSize: 10 }} />
                </button>
            </nav>
        </div>
    );
};

export default DataTablePagination;
