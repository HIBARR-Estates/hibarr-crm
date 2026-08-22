import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import TasksHeader, { type TasksViewMode } from "../TasksHeader";
import TasksFilterBar, {
    type GroupMode,
    type QuickFilterCounts,
    type QuickFilterKey,
} from "../TasksFilterBar";

interface TasksWorkspaceChromeProps {
    view: TasksViewMode;
    onViewChange: (view: TasksViewMode) => void;
    onRefresh: () => void;
    refreshing: boolean;
    onAddTask: () => void;
    canAddTask: boolean;
    headline: string;
    showTaskSettings: boolean;
    onOpenTaskSettings: () => void;
    quickFilter: QuickFilterKey;
    onQuickFilter: (key: QuickFilterKey) => void;
    counts: QuickFilterCounts;
    groupMode: GroupMode;
    onGroupMode: (mode: GroupMode) => void;
    activeFilterCount: number;
    onOpenFilters: () => void;
    totalItems: number;
}

/** Sticky white header band — title, view toggle, quick filters, active sentence. */
export default function TasksWorkspaceChrome({
    view,
    onViewChange,
    onRefresh,
    refreshing,
    onAddTask,
    canAddTask,
    headline,
    showTaskSettings,
    onOpenTaskSettings,
    quickFilter,
    onQuickFilter,
    counts,
    groupMode,
    onGroupMode,
    activeFilterCount,
    onOpenFilters,
    totalItems,
}: TasksWorkspaceChromeProps) {
    return (
        <div
            style={{
                background: "#ffffff",
                borderBottom: "1px solid #e2e5ea",
                position: "sticky",
                top: 0,
                zIndex: 15,
            }}
        >
            <div className="mx-auto w-full max-w-[1280px] px-7 pt-[18px]">
                <TasksHeader
                    view={view}
                    onViewChange={onViewChange}
                    onRefresh={onRefresh}
                    refreshing={refreshing}
                    onAddTask={onAddTask}
                    canAddTask={canAddTask}
                    headline={headline}
                    showTaskSettings={showTaskSettings}
                    onOpenTaskSettings={onOpenTaskSettings}
                />
                <TasksFilterBar
                    quickFilter={quickFilter}
                    onQuickFilter={onQuickFilter}
                    counts={counts}
                    groupMode={groupMode}
                    onGroupMode={onGroupMode}
                    showGroupBy={view === "list"}
                    activeFilterCount={activeFilterCount}
                    onOpenFilters={onOpenFilters}
                />
            </div>

            <div
                style={{
                    background: T.SURFACE_2,
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div className="mx-auto w-full max-w-[1280px] px-7">
                    <ActiveFilterSentence
                        count={totalItems}
                        entityLabel="tasks"
                        onOpenFilters={onOpenFilters}
                    />
                </div>
            </div>
        </div>
    );
}
