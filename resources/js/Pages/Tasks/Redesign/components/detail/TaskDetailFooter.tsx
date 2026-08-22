import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "../primitives/TaskGlyphs";

interface TaskDetailFooterProps {
    done: boolean;
    canWrite: boolean;
    toggling: boolean;
    onEdit: () => void;
    onClose: () => void;
    onToggleDone: () => void;
}

export default function TaskDetailFooter({
    done,
    canWrite,
    toggling,
    onEdit,
    onClose,
    onToggleDone,
}: TaskDetailFooterProps) {
    const { td } = useTd();

    return (
        <div
            className="flex flex-shrink-0 items-center justify-between"
            style={{
                padding: "14px 22px",
                borderTop: `1px solid ${T.BORDER_SOFT}`,
                background: T.WHITE,
            }}
        >
            {canWrite ? (
                <button
                    type="button"
                    onClick={onEdit}
                    className="tasks-press inline-flex items-center gap-1.5"
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
                    <TaskGlyph d={TASK_ICON.edit} size={15} strokeWidth={1.5} />
                    {td("Edit task")}
                </button>
            ) : (
                <span />
            )}

            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    className="tasks-press"
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
                    {td("Close")}
                </button>
                {canWrite && (
                    <button
                        type="button"
                        onClick={onToggleDone}
                        disabled={toggling}
                        className="tasks-press inline-flex items-center gap-1.5"
                        style={{
                            padding: "9px 16px",
                            borderRadius: 8,
                            background: T.BLUE,
                            color: T.WHITE,
                            border: `1px solid ${T.BLUE}`,
                            fontSize: 15,
                            fontWeight: 600,
                            cursor: toggling ? "default" : "pointer",
                            opacity: toggling ? 0.7 : 1,
                        }}
                    >
                        <TaskGlyph
                            d={TASK_ICON.check}
                            size={15}
                            strokeWidth={1.5}
                        />
                        {done ? td("Reopen task") : td("Mark done")}
                    </button>
                )}
            </div>
        </div>
    );
}
