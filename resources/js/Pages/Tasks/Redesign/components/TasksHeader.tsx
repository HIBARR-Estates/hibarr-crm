import { ReloadOutlined, SettingOutlined } from "@ant-design/icons";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../config/taskDesignTokens";
import { TaskGlyph } from "./primitives/TaskGlyphs";

export type TasksViewMode = "list" | "board";

interface TasksHeaderProps {
    view: TasksViewMode;
    onViewChange: (view: TasksViewMode) => void;
    onRefresh: () => void;
    refreshing: boolean;
    onAddTask: () => void;
    canAddTask: boolean;
    headline: string;
    showTaskSettings?: boolean;
    onOpenTaskSettings?: () => void;
    /**
     * Ghost "Replay guide" after Refresh. Omitted entirely when undefined —
     * same rule as EntityListHeader / the deal/lead detail ⋮ menus.
     */
    onReplayGuide?: () => void;
    /** Parent should pass `t("pages.tasks.tour.replay_menu_item")`. Falls back to "Replay guide". */
    replayGuideLabel?: string;
    /** Optional `data-tour` value on the Replay button. */
    replayTourTarget?: string;
}

export default function TasksHeader({
    view,
    onViewChange,
    onRefresh,
    refreshing,
    onAddTask,
    canAddTask,
    headline,
    showTaskSettings,
    onOpenTaskSettings,
    onReplayGuide,
    replayGuideLabel,
    replayTourTarget,
}: TasksHeaderProps) {
    const { td } = useTd();

    const toggle = (mode: TasksViewMode, label: string, d: string) => {
        const active = view === mode;
        return (
            <button
                type="button"
                aria-pressed={active}
                onClick={() => onViewChange(mode)}
                className="inline-flex items-center gap-1.5"
                style={{
                    padding: "5px 10px",
                    borderRadius: 6,
                    border: "none",
                    fontSize: 14,
                    fontWeight: 600,
                    cursor: "pointer",
                    background: active ? T.WHITE : "transparent",
                    color: active ? T.NAVY : T.TEXT_MUTED,
                }}
            >
                <TaskGlyph d={d} size={13} strokeWidth={1.5} />
                {td(label)}
            </button>
        );
    };

    return (
        <div className="flex flex-wrap items-start justify-between gap-6 pb-4">
            <div
                className="flex flex-col gap-1"
                data-tour="tasks-list-header"
            >
                <h1
                    className="m-0 font-bold"
                    style={{
                        fontSize: 21,
                        color: T.NAVY,
                        letterSpacing: "-0.01em",
                    }}
                >
                    {td("Tasks")}
                </h1>
                <p
                    className="m-0"
                    style={{ fontSize: 15, color: T.TEXT_MUTED }}
                >
                    {headline}
                </p>
            </div>

            <div className="flex items-center gap-2.5">
                <div
                    className="flex gap-0.5 p-0.5"
                    data-tour="tasks-list-view-toggle"
                    style={{
                        background: T.BG,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: 8,
                    }}
                >
                    {toggle("list", "List", TASK_ICON.list)}
                    {toggle("board", "Board", TASK_ICON.board)}
                </div>

                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={refreshing}
                    className="inline-flex items-center gap-1.5"
                    style={{
                        padding: "9px 16px",
                        borderRadius: 8,
                        background: T.WHITE,
                        color: T.TEXT_MUTED,
                        border: `1px solid ${T.BORDER}`,
                        fontSize: 15,
                        fontWeight: 600,
                        cursor: refreshing ? "default" : "pointer",
                        opacity: refreshing ? 0.6 : 1,
                    }}
                >
                    <ReloadOutlined spin={refreshing} style={{ fontSize: 13 }} />
                    {td("Refresh")}
                </button>

                {onReplayGuide !== undefined && (
                    <button
                        type="button"
                        onClick={onReplayGuide}
                        className="inline-flex items-center gap-1.5"
                        {...(replayTourTarget
                            ? { "data-tour": replayTourTarget }
                            : {})}
                        style={{
                            padding: "9px 16px",
                            borderRadius: 8,
                            background: T.WHITE,
                            color: T.TEXT_MUTED,
                            border: `1px solid ${T.BORDER}`,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        {replayGuideLabel ?? td("Replay guide")}
                    </button>
                )}

                {showTaskSettings && (
                    <button
                        type="button"
                        aria-label={td("Task settings")}
                        title={td("Task settings")}
                        onClick={onOpenTaskSettings}
                        data-tour="tasks-list-settings"
                        className="inline-flex items-center justify-center"
                        style={{
                            width: 36,
                            height: 36,
                            borderRadius: 8,
                            background: T.WHITE,
                            color: T.TEXT_MUTED,
                            border: `1px solid ${T.BORDER}`,
                            cursor: "pointer",
                        }}
                    >
                        <SettingOutlined style={{ fontSize: 15 }} />
                    </button>
                )}

                {canAddTask && (
                    <button
                        type="button"
                        onClick={onAddTask}
                        data-tour="tasks-list-add"
                        className="inline-flex items-center gap-1.5"
                        style={{
                            padding: "9px 16px",
                            borderRadius: 8,
                            background: T.BLUE,
                            color: T.WHITE,
                            border: `1px solid ${T.BLUE}`,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: "pointer",
                        }}
                    >
                        <TaskGlyph
                            d={TASK_ICON.plus}
                            size={15}
                            strokeWidth={1.5}
                        />
                        {td("Add task")}
                    </button>
                )}
            </div>
        </div>
    );
}
