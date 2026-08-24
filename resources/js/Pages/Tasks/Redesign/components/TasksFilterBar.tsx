import { FilterOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import TaskSegmented from "./primitives/TaskSegmented";

export type QuickFilterKey =
    "all" | "mine" | "byme" | "open" | "today" | "overdue" | "mentioned";

export type GroupMode = "due" | "category" | "none";

export interface QuickFilterCounts {
    all: number;
    mine: number;
    byme: number;
    open: number;
    today: number;
    overdue: number;
    mentioned: number;
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
    { key: "mentioned", label: "Mentioned" },
];

const GROUP_MODES: Array<{ key: GroupMode; label: string }> = [
    { key: "due", label: "Due date" },
    { key: "category", label: "Category" },
    { key: "none", label: "None" },
];

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
                <TaskSegmented
                    value={quickFilter}
                    ariaLabel={td("Task view")}
                    onChange={onQuickFilter}
                    options={QUICK_FILTERS.map((pill) => ({
                        value: pill.key,
                        label: td(pill.label),
                        count: counts[pill.key],
                    }))}
                />

                <div className="ml-auto flex items-center gap-2.5">
                    {showGroupBy && (
                        <div className="flex items-center gap-2">
                            <span
                                className="uppercase"
                                style={{
                                    fontSize: 14,
                                    fontWeight: 700,
                                    letterSpacing: "0.05em",
                                    color: T.TEXT_HINT,
                                }}
                            >
                                {td("Group by")}
                            </span>
                            <TaskSegmented
                                value={groupMode}
                                ariaLabel={td("Group by")}
                                onChange={onGroupMode}
                                options={GROUP_MODES.map((mode) => ({
                                    value: mode.key,
                                    label: td(mode.label),
                                }))}
                            />
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
                            fontSize: 14,
                            fontWeight: 600,
                            cursor: "pointer",
                            background: hasFilters ? T.BLUE_LIGHT : T.WHITE,
                            color: hasFilters ? T.BLUE_DARK : T.TEXT_MUTED,
                            border: `1px solid ${hasFilters ? T.BLUE_MID : T.BORDER}`,
                        }}
                    >
                        <FilterOutlined style={{ fontSize: 13 }} />
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
                                    fontSize: 14,
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
