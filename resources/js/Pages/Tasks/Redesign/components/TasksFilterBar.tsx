import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../config/taskDesignTokens";
import { TaskGlyph } from "./primitives/TaskGlyphs";

export type QuickFilterKey =
    | "all"
    | "mine"
    | "byme"
    | "open"
    | "today"
    | "overdue";

export type GroupMode = "due" | "category" | "none";

export interface QuickFilterCounts {
    all: number;
    mine: number;
    byme: number;
    open: number;
    today: number;
    overdue: number;
}

export interface SummaryClause {
    label: string;
    value: string;
}

interface TasksFilterBarProps {
    quickFilter: QuickFilterKey;
    onQuickFilter: (key: QuickFilterKey) => void;
    counts: QuickFilterCounts;
    groupMode: GroupMode;
    onGroupMode: (mode: GroupMode) => void;
    showGroupBy: boolean;
    activeFilterCount: number;
    onOpenFilters: () => void;
}

const QUICK_FILTERS: Array<{ key: QuickFilterKey; label: string }> = [
    { key: "all", label: "All tasks" },
    { key: "mine", label: "Assigned to me" },
    { key: "byme", label: "Assigned by me" },
    { key: "open", label: "Open" },
    { key: "today", label: "Due today" },
    { key: "overdue", label: "Overdue" },
];

const GROUP_MODES: Array<{ key: GroupMode; label: string }> = [
    { key: "due", label: "Due date" },
    { key: "category", label: "Category" },
    { key: "none", label: "None" },
];

/** Segmented-control shell used by both the quick pills and group-by toggle. */
function Segmented({ children }: { children: React.ReactNode }) {
    return (
        <div
            className="flex gap-0.5 p-0.5"
            style={{
                background: T.BG,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 8,
            }}
        >
            {children}
        </div>
    );
}

export default function TasksFilterBar({
    quickFilter,
    onQuickFilter,
    counts,
    groupMode,
    onGroupMode,
    showGroupBy,
    activeFilterCount,
    onOpenFilters,
}: TasksFilterBarProps) {
    const { td } = useTd();
    const hasFilters = activeFilterCount > 0;

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2.5 pb-[18px]">
                <Segmented>
                    {QUICK_FILTERS.map((pill) => {
                        const active = quickFilter === pill.key;
                        return (
                            <button
                                key={pill.key}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onQuickFilter(pill.key)}
                                className="inline-flex items-center gap-1.5"
                                style={{
                                    padding: "6px 12px",
                                    borderRadius: 6,
                                    border: "none",
                                    fontSize: 12,
                                    fontWeight: 600,
                                    cursor: "pointer",
                                    background: active ? T.NAVY : "transparent",
                                    color: active ? T.WHITE : T.TEXT_MUTED,
                                    transition:
                                        "background 120ms ease, color 120ms ease",
                                }}
                            >
                                {td(pill.label)}
                                <span
                                    style={{
                                        fontSize: 12,
                                        fontWeight: 600,
                                        fontVariantNumeric: "tabular-nums",
                                        color: active
                                            ? "rgba(255,255,255,0.7)"
                                            : T.TEXT_HINT,
                                    }}
                                >
                                    {counts[pill.key]}
                                </span>
                            </button>
                        );
                    })}
                </Segmented>

                <div className="ml-auto flex items-center gap-2.5">
                    {showGroupBy && (
                        <div className="flex items-center gap-2">
                            <span
                                className="uppercase"
                                style={{
                                    fontSize: 12,
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {td("Group by")}
                            </span>
                            <Segmented>
                                {GROUP_MODES.map((mode) => {
                                    const active = groupMode === mode.key;
                                    return (
                                        <button
                                            key={mode.key}
                                            type="button"
                                            aria-pressed={active}
                                            onClick={() => onGroupMode(mode.key)}
                                            style={{
                                                padding: "6px 12px",
                                                borderRadius: 6,
                                                border: "none",
                                                fontSize: 12,
                                                fontWeight: 600,
                                                cursor: "pointer",
                                                background: active
                                                    ? T.NAVY
                                                    : "transparent",
                                                color: active
                                                    ? T.WHITE
                                                    : T.TEXT_MUTED,
                                            }}
                                        >
                                            {td(mode.label)}
                                        </button>
                                    );
                                })}
                            </Segmented>
                        </div>
                    )}

                    <span
                        style={{ width: 1, height: 22, background: T.BORDER }}
                    />

                    <button
                        type="button"
                        onClick={onOpenFilters}
                        className="inline-flex items-center gap-1.5"
                        style={{
                            padding: "7px 12px",
                            borderRadius: 8,
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: hasFilters ? T.BLUE_LIGHT : T.WHITE,
                            color: hasFilters ? T.BLUE_DARK : T.TEXT_MUTED,
                            border: `1px solid ${hasFilters ? T.BLUE_MID : T.BORDER}`,
                        }}
                    >
                        <TaskGlyph d={TASK_ICON.filter} size={13} strokeWidth={1.5} />
                        {td("Filters")}
                        {hasFilters && (
                            <span
                                className="inline-flex items-center justify-center"
                                style={{
                                    minWidth: 17,
                                    height: 17,
                                    padding: "0 4px",
                                    borderRadius: 999,
                                    background: T.BLUE,
                                    color: T.WHITE,
                                    fontSize: 12,
                                    fontWeight: 700,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {activeFilterCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
