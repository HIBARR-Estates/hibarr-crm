import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../config/taskDesignTokens";
import { TaskGlyph } from "./primitives/TaskGlyphs";

/** Selectable page sizes for both the list and the board columns. */
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface TasksPaginationProps {
    page: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

const navButtonStyle = (disabled: boolean): React.CSSProperties => ({
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 30,
    height: 30,
    borderRadius: 8,
    border: `1px solid ${T.BORDER}`,
    background: T.WHITE,
    color: disabled ? T.NAVY_MID : T.TEXT_MUTED,
    cursor: disabled ? "default" : "pointer",
    opacity: disabled ? 0.55 : 1,
});

/** Compact page window: 1 … 4 5 6 … 20 */
function pageWindow(current: number, total: number): Array<number | "gap"> {
    if (total <= 7) {
        return Array.from({ length: total }, (_, index) => index + 1);
    }
    const pages = new Set<number>([1, total, current]);
    if (current - 1 > 1) pages.add(current - 1);
    if (current + 1 < total) pages.add(current + 1);

    const sorted = Array.from(pages).sort((a, b) => a - b);
    const output: Array<number | "gap"> = [];
    sorted.forEach((value, index) => {
        if (index > 0 && value - sorted[index - 1] > 1) output.push("gap");
        output.push(value);
    });
    return output;
}

export default function TasksPagination({
    page,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange,
}: TasksPaginationProps) {
    const { td } = useTd();
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const from = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
    const to = Math.min(safePage * pageSize, totalItems);

    const sizeSelect = (
        <label className="flex items-center gap-2">
            <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                {td("Rows per page")}
            </span>
            <select
                value={pageSize}
                onChange={(event) => onPageSizeChange(Number(event.target.value))}
                style={{
                    padding: "5px 8px",
                    borderRadius: 8,
                    border: `1px solid ${T.BORDER}`,
                    background: T.WHITE,
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.TEXT,
                    cursor: "pointer",
                }}
            >
                {PAGE_SIZE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                        {option}
                    </option>
                ))}
            </select>
        </label>
    );

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3.5">
            <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>
                {td("Showing")}{" "}
                <strong style={{ color: T.NAVY, fontWeight: 700 }}>
                    {from}–{to}
                </strong>{" "}
                {td("of")}{" "}
                <strong style={{ color: T.NAVY, fontWeight: 700 }}>
                    {totalItems}
                </strong>{" "}
                {totalItems === 1 ? td("task") : td("tasks")}
            </span>

            <div className="flex items-center gap-3">
                {sizeSelect}

                {totalPages > 1 && (
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            aria-label={td("Previous page")}
                            disabled={safePage <= 1}
                            onClick={() => onPageChange(safePage - 1)}
                            style={navButtonStyle(safePage <= 1)}
                        >
                            <span style={{ transform: "rotate(90deg)", display: "flex" }}>
                                <TaskGlyph
                                    d={TASK_ICON.chevron}
                                    size={13}
                                    strokeWidth={2}
                                />
                            </span>
                        </button>

                        {pageWindow(safePage, totalPages).map((entry, index) =>
                            entry === "gap" ? (
                                <span
                                    key={`gap-${index}`}
                                    style={{
                                        padding: "0 4px",
                                        fontSize: 12,
                                        color: T.TEXT_HINT,
                                    }}
                                >
                                    …
                                </span>
                            ) : (
                                <button
                                    key={entry}
                                    type="button"
                                    aria-current={
                                        entry === safePage ? "page" : undefined
                                    }
                                    onClick={() => onPageChange(entry)}
                                    style={{
                                        minWidth: 30,
                                        height: 30,
                                        padding: "0 8px",
                                        borderRadius: 8,
                                        fontSize: 12,
                                        fontWeight: entry === safePage ? 700 : 600,
                                        cursor: "pointer",
                                        background:
                                            entry === safePage
                                                ? T.NAVY
                                                : T.WHITE,
                                        color:
                                            entry === safePage
                                                ? T.WHITE
                                                : T.TEXT_MUTED,
                                        border: `1px solid ${entry === safePage ? T.NAVY : T.BORDER}`,
                                    }}
                                >
                                    {entry}
                                </button>
                            ),
                        )}

                        <button
                            type="button"
                            aria-label={td("Next page")}
                            disabled={safePage >= totalPages}
                            onClick={() => onPageChange(safePage + 1)}
                            style={navButtonStyle(safePage >= totalPages)}
                        >
                            <span style={{ transform: "rotate(-90deg)", display: "flex" }}>
                                <TaskGlyph
                                    d={TASK_ICON.chevron}
                                    size={13}
                                    strokeWidth={2}
                                />
                            </span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
