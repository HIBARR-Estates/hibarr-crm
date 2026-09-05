import { useId, useMemo } from "react";
import { LeftOutlined, RightOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { buildPageRange } from "@/Components/DataTable/utils";

/** Selectable page sizes for redesign lists (Tasks list/board, Meetings). */
export const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100] as const;

interface PaginationProps {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    /** Noun in the "Showing 1–9 of 42 tasks" line — pass your own entity. */
    itemLabel?: string;
    itemLabelPlural?: string;
}

const NAV_BTN_BASE =
    "inline-flex items-center justify-center w-8 h-8 rounded-md text-sm border transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-1";

export default function Pagination({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
    itemLabel = "task",
    itemLabelPlural = "tasks",
}: PaginationProps) {
    const { td } = useTd();
    const selectId = useId();
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, totalItems);
    const hasPrev = safePage > 1;
    const hasNext = safePage < totalPages;

    const pages = useMemo(
        () => buildPageRange(safePage, totalPages),
        [safePage, totalPages],
    );

    if (totalItems === 0) return null;

    return (
        <div
            className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-3 border-t bg-white"
            style={{ borderColor: T.BORDER }}
        >
            {/* Left — result range + rows-per-page selector */}
            <div
                className="flex items-center gap-3 text-sm"
                style={{ color: T.TEXT_MUTED }}
            >
                <span aria-live="polite" aria-atomic="true">
                    {td("Showing")}{" "}
                    <span className="font-semibold" style={{ color: T.TEXT }}>
                        {from}
                    </span>
                    {"–"}
                    <span className="font-semibold" style={{ color: T.TEXT }}>
                        {to}
                    </span>
                    {" "}
                    {td("of")}{" "}
                    <span className="font-semibold" style={{ color: T.TEXT }}>
                        {totalItems}
                    </span>{" "}
                    {totalItems === 1 ? td(itemLabel) : td(itemLabelPlural)}
                </span>

                <div className="flex items-center gap-1.5">
                    <label
                        htmlFor={selectId}
                        className="whitespace-nowrap select-none"
                    >
                        {td("Rows per page")}
                    </label>
                    <select
                        id={selectId}
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                        className="text-sm rounded-md px-2 py-1 cursor-pointer outline-none transition-colors hover:border-[#c7d0de] focus:border-[#b8d4f0] focus:shadow-[0_0_0_2px_#e8f1fb]"
                        style={{ border: `1px solid ${T.BORDER}`, color: T.TEXT }}
                    >
                        {PAGE_SIZE_OPTIONS.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Right — page navigation controls */}
            {totalPages > 1 && (
                <nav
                    role="navigation"
                    aria-label={td("Pagination")}
                    className="flex items-center gap-1"
                >
                    <span
                        className="text-sm mr-2 whitespace-nowrap"
                        style={{ color: T.TEXT_MUTED }}
                        aria-live="polite"
                        aria-atomic="true"
                    >
                        {td("Page")}{" "}
                        <span className="font-semibold" style={{ color: T.TEXT }}>
                            {safePage}
                        </span>{" "}
                        {td("of")}{" "}
                        <span className="font-semibold" style={{ color: T.TEXT }}>
                            {totalPages}
                        </span>
                    </span>

                    <button
                        type="button"
                        onClick={() => hasPrev && onPageChange(safePage - 1)}
                        disabled={!hasPrev}
                        aria-label={td("Previous page")}
                        className={`${NAV_BTN_BASE} bg-white hover:bg-[#f5f6f8] hover:border-[#c7d0de] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white`}
                        style={{ color: T.TEXT_MUTED, borderColor: T.BORDER }}
                    >
                        <LeftOutlined style={{ fontSize: 10 }} />
                    </button>

                    {pages.map((entry, index) =>
                        entry === "ellipsis" ? (
                            <span
                                key={`ellipsis-${index}`}
                                className="w-8 h-8 flex items-center justify-center text-sm select-none"
                                style={{ color: T.TEXT_HINT }}
                                aria-hidden="true"
                            >
                                …
                            </span>
                        ) : (
                            <button
                                key={entry}
                                type="button"
                                onClick={() =>
                                    entry !== safePage && onPageChange(entry)
                                }
                                aria-label={`${td("Go to page")} ${entry}`}
                                aria-current={
                                    entry === safePage ? "page" : undefined
                                }
                                className={`${NAV_BTN_BASE} ${
                                    entry === safePage
                                        ? "font-semibold cursor-default"
                                        : "cursor-pointer bg-white hover:bg-[#f5f6f8] hover:border-[#c7d0de]"
                                }`}
                                style={
                                    entry === safePage
                                        ? {
                                              borderColor: T.BLUE,
                                              background: T.BLUE,
                                              color: T.WHITE,
                                          }
                                        : { borderColor: T.BORDER, color: T.TEXT_MUTED }
                                }
                            >
                                {entry}
                            </button>
                        ),
                    )}

                    <button
                        type="button"
                        onClick={() => hasNext && onPageChange(safePage + 1)}
                        disabled={!hasNext}
                        aria-label={td("Next page")}
                        className={`${NAV_BTN_BASE} bg-white hover:bg-[#f5f6f8] hover:border-[#c7d0de] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-white`}
                        style={{ color: T.TEXT_MUTED, borderColor: T.BORDER }}
                    >
                        <RightOutlined style={{ fontSize: 10 }} />
                    </button>
                </nav>
            )}
        </div>
    );
}
