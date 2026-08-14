import React, { useId, useMemo } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { LaravelPaginationMeta } from "./types";
import { buildPageRange } from "./utils";

/** Includes 15 to match Laravel's common paginate() default. */
const DEFAULT_PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const;

interface DataTablePaginationProps {
    meta: LaravelPaginationMeta;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (pageSize: number) => void;
    pageSizeOptions?: number[];
    className?: string;
}

// Shared button base class — hoisted to avoid re-creation on every render (rendering-hoist-jsx)
const NAV_BTN_BASE =
    "inline-flex items-center justify-center w-8 h-8 rounded-md text-sm border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1";

const DataTablePagination: React.FC<DataTablePaginationProps> = ({
    meta,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS as unknown as number[],
    className = "",
}) => {
    const { current_page, last_page, per_page, total, from, to } = meta;
    const selectId = useId();

    const displayFrom = from ?? (total > 0 ? (current_page - 1) * per_page + 1 : 0);
    const displayTo = to ?? Math.min(current_page * per_page, total);

    // Keep the current size selectable even if it isn't in the defaults.
    const resolvedPageSizeOptions = useMemo(() => {
        if (pageSizeOptions.includes(per_page)) return pageSizeOptions;
        return [...pageSizeOptions, per_page].sort((a, b) => a - b);
    }, [pageSizeOptions, per_page]);

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
            className={`flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-white ${className}`}
            style={{ borderColor: T.BORDER }}
        >
            {/* Left — result range + optional rows-per-page selector */}
            <div className="flex items-center gap-3 text-sm" style={{ color: T.TEXT_MUTED }}>
                <span aria-live="polite" aria-atomic="true">
                    Showing{" "}
                    <span className="font-semibold" style={{ color: T.TEXT }}>{displayFrom}</span>
                    {"–"}
                    <span className="font-semibold" style={{ color: T.TEXT }}>{displayTo}</span>
                    {" of "}
                    <span className="font-semibold" style={{ color: T.TEXT }}>{total}</span>
                </span>

                {onPageSizeChange !== undefined ? (
                    <div className="flex items-center gap-1.5">
                        <label
                            htmlFor={selectId}
                            className="whitespace-nowrap select-none"
                        >
                            Rows per page
                        </label>
                        <select
                            id={selectId}
                            value={per_page}
                            onChange={(e) =>
                                onPageSizeChange(Number(e.target.value))
                            }
                            className="text-sm rounded-md px-2 py-1 cursor-pointer outline-none transition-colors hover:border-[#c7d0de] focus:border-[#b8d4f0] focus:shadow-[0_0_0_2px_#e8f1fb]"
                            style={{ border: `1px solid ${T.BORDER}`, color: T.TEXT }}
                        >
                            {resolvedPageSizeOptions.map((n) => (
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
                    className="text-sm mr-2 whitespace-nowrap"
                    style={{ color: T.TEXT_MUTED }}
                    aria-live="polite"
                    aria-atomic="true"
                >
                    Page{" "}
                    <span className="font-semibold" style={{ color: T.TEXT }}>{current_page}</span>
                    {" of "}
                    <span className="font-semibold" style={{ color: T.TEXT }}>{last_page}</span>
                </span>

                {/* Previous */}
                <button
                    type="button"
                    onClick={() => hasPrev && onPageChange(current_page - 1)}
                    disabled={!hasPrev}
                    aria-label="Previous page"
                    className={`${NAV_BTN_BASE} bg-white hover:bg-[#f5f6f8] hover:border-[#c7d0de] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white`}
                    style={{ color: T.TEXT_MUTED, borderColor: T.BORDER }}
                >
                    <LeftOutlined style={{ fontSize: 10 }} />
                </button>

                {/* Page number buttons */}
                {pages.map((page, idx) =>
                    page === "ellipsis" ? (
                        <span
                            key={`ellipsis-${idx}`}
                            className="w-8 h-8 flex items-center justify-center text-sm select-none"
                            style={{ color: T.TEXT_HINT }}
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
                                    ? "font-semibold cursor-default"
                                    : "cursor-pointer bg-white hover:bg-[#f5f6f8] hover:border-[#c7d0de]"
                            }`}
                            style={
                                page === current_page
                                    ? { borderColor: T.BLUE, background: T.BLUE, color: T.WHITE }
                                    : { borderColor: T.BORDER, color: T.TEXT_MUTED }
                            }
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
                    className={`${NAV_BTN_BASE} bg-white hover:bg-[#f5f6f8] hover:border-[#c7d0de] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white`}
                    style={{ color: T.TEXT_MUTED, borderColor: T.BORDER }}
                >
                    <RightOutlined style={{ fontSize: 10 }} />
                </button>
            </nav>
        </div>
    );
};

export default DataTablePagination;
