import { forwardRef, useImperativeHandle, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import { MICRO_LABEL } from "../primitives/taskUiStyles";
import { SMALL_INPUT } from "./taskFormStyles";

interface TaskFormChecklistProps {
    items: string[];
    onChange: (items: string[]) => void;
}

export interface TaskFormChecklistHandle {
    /**
     * `items` plus whatever is still sitting in the "add new" field, if it's
     * non-empty — call this right before Save so text the user typed but
     * never pressed Enter/+ on isn't dropped.
     */
    flushPendingDraft: () => string[];
}

/** Existing rows are always-visible editable inputs; one more persistent
 * input at the bottom is where a new item is typed before being added. */
const TaskFormChecklist = forwardRef<
    TaskFormChecklistHandle,
    TaskFormChecklistProps
>(function TaskFormChecklist({ items, onChange }, ref) {
    const { td } = useTd();
    const [draft, setDraft] = useState("");

    useImperativeHandle(
        ref,
        () => ({
            flushPendingDraft: () => {
                const trimmed = draft.trim();
                return trimmed ? [...items, trimmed] : items;
            },
        }),
        [draft, items],
    );

    const commitDraft = () => {
        const trimmed = draft.trim();
        if (!trimmed) return;
        onChange([...items, trimmed]);
        setDraft("");
    };

    return (
        <div className="flex flex-col gap-2">
            <span style={MICRO_LABEL}>{td("Checklist")}</span>
            {items.map((item, index) => (
                <div key={index} className="flex items-center gap-2">
                    <span
                        style={{
                            width: 16,
                            height: 16,
                            borderRadius: 999,
                            border: `1.5px solid ${T.NAVY_MID}`,
                            flexShrink: 0,
                        }}
                    />
                    <input
                        value={item}
                        onChange={(event) => {
                            const next = [...items];
                            next[index] = event.target.value;
                            onChange(next);
                        }}
                        placeholder={td("Checklist item")}
                        style={{
                            ...SMALL_INPUT,
                            border: "none",
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                            borderRadius: 0,
                            padding: "4px 0",
                            fontSize: 16,
                        }}
                    />
                    <button
                        type="button"
                        aria-label={td("Remove item")}
                        onClick={() =>
                            onChange(items.filter((_, i) => i !== index))
                        }
                        style={{
                            display: "flex",
                            background: "transparent",
                            border: "none",
                            cursor: "pointer",
                        }}
                    >
                        <TaskGlyph
                            d={TASK_ICON.x}
                            size={12}
                            color={T.TEXT_HINT}
                            strokeWidth={2}
                        />
                    </button>
                </div>
            ))}
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    aria-label={td("Add checklist item")}
                    title={td("Add checklist item")}
                    onClick={commitDraft}
                    className="tasks-press inline-flex flex-shrink-0 items-center justify-center"
                    style={{
                        width: 20,
                        height: 20,
                        borderRadius: 999,
                        border: `1px solid ${T.BORDER}`,
                        background: T.WHITE,
                        color: T.BLUE,
                        cursor: "pointer",
                    }}
                >
                    <TaskGlyph d={TASK_ICON.plus} size={12} strokeWidth={2} />
                </button>
                <input
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                        if (
                            event.key === "Enter" &&
                            !event.nativeEvent.isComposing
                        ) {
                            event.preventDefault();
                            commitDraft();
                        }
                    }}
                    placeholder={td("Add a checklist item")}
                    style={{
                        ...SMALL_INPUT,
                        border: "none",
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        borderRadius: 0,
                        padding: "4px 0",
                        fontSize: 16,
                        color: T.TEXT_MUTED,
                    }}
                />
            </div>
        </div>
    );
});

export default TaskFormChecklist;
