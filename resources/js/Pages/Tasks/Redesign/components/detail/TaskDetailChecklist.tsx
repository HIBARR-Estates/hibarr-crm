import { useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import type { TaskCheckpoint } from "../../hooks/useTaskCheckpoints";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import { DETAIL_LABEL } from "../primitives/taskUiStyles";

interface TaskDetailChecklistProps {
    items: TaskCheckpoint[];
    saving: boolean;
    error: string | null;
    canManage: boolean;
    onToggle: (item: TaskCheckpoint) => void;
    onRemove: (id: number) => void;
    onAdd: (title: string) => Promise<unknown>;
}

export default function TaskDetailChecklist({
    items,
    saving,
    error,
    canManage,
    onToggle,
    onRemove,
    onAdd,
}: TaskDetailChecklistProps) {
    const { td } = useTd();
    const [draft, setDraft] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);
    const doneCount = items.filter((item) => item.status === "complete").length;

    const submitDraft = () => {
        if (!draft.trim()) return;
        void onAdd(draft.trim()).then(() => setDraft(""));
    };

    const handleAddClick = () => {
        if (draft.trim()) {
            void onAdd(draft.trim()).then(() => {
                setDraft("");
                inputRef.current?.focus();
            });
        } else {
            inputRef.current?.focus();
        }
    };

    return (
        <>
            <p
                style={{
                    ...DETAIL_LABEL,
                    margin: "0 0 10px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                }}
            >
                {td("Checklist")}
                <span
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: T.TEXT_MUTED,
                        background: T.NAVY_SOFT,
                        borderRadius: 999,
                        padding: "1px 7px",
                        textTransform: "none",
                        letterSpacing: 0,
                    }}
                >
                    {doneCount}/{items.length}
                </span>
            </p>

            {items.map((item) => {
                const done = item.status === "complete";
                return (
                    <div
                        key={item.id}
                        className="tasks-checkpoint flex items-center gap-2.5"
                        style={{ padding: "7px 4px", borderRadius: 8 }}
                    >
                        <button
                            type="button"
                            aria-label={item.title}
                            aria-pressed={done}
                            disabled={!canManage}
                            onClick={() => onToggle(item)}
                            className="flex flex-shrink-0 items-center justify-center"
                            style={{
                                width: 18,
                                height: 18,
                                padding: 0,
                                borderRadius: 999,
                                border: `1.5px solid ${done ? T.GREEN : T.NAVY_MID}`,
                                background: done ? T.GREEN : T.WHITE,
                                cursor: canManage ? "pointer" : "default",
                            }}
                        >
                            <TaskGlyph
                                d={TASK_ICON.check}
                                size={11}
                                color={T.WHITE}
                                strokeWidth={2.5}
                            />
                        </button>
                        <span
                            className="flex-1"
                            style={{
                                fontSize: 13.5,
                                color: done ? T.TEXT_HINT : T.TEXT,
                                textDecoration: done ? "line-through" : "none",
                            }}
                        >
                            {item.title}
                        </span>
                        {canManage && (
                            <button
                                type="button"
                                aria-label={`${td("Remove")} ${item.title}`}
                                onClick={() => onRemove(item.id)}
                                className="tasks-checkpoint-remove"
                                style={{
                                    display: "flex",
                                    padding: 4,
                                    border: "none",
                                    background: "transparent",
                                    color: T.TEXT_HINT,
                                    cursor: "pointer",
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.x}
                                    size={14}
                                    strokeWidth={1.5}
                                />
                            </button>
                        )}
                    </div>
                );
            })}

            {canManage && (
                <div
                    className="flex items-center gap-2.5"
                    style={{ padding: "7px 4px", color: T.TEXT_HINT }}
                >
                    <button
                        type="button"
                        aria-label={td("Add checklist item")}
                        onClick={handleAddClick}
                        disabled={saving}
                        className="flex flex-shrink-0 items-center justify-center"
                        style={{
                            width: 15,
                            height: 15,
                            padding: 0,
                            border: "none",
                            background: "transparent",
                            color: T.TEXT_HINT,
                            cursor: saving ? "default" : "pointer",
                        }}
                    >
                        {saving ? (
                            <span
                                aria-hidden="true"
                                className="animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                                style={{ width: 11, height: 11 }}
                            />
                        ) : (
                            <TaskGlyph
                                d={TASK_ICON.plus}
                                size={15}
                                strokeWidth={1.5}
                            />
                        )}
                    </button>
                    <input
                        ref={inputRef}
                        className="tasks-bare-input"
                        value={draft}
                        disabled={saving}
                        placeholder={td("Add a checklist item")}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                submitDraft();
                            }
                        }}
                        style={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            fontSize: 13.5,
                            color: T.TEXT,
                            background: "transparent",
                            fontFamily: "inherit",
                        }}
                    />
                    {draft.trim() && (
                        <button
                            type="button"
                            aria-label={td("Save checklist item")}
                            title={td("Save checklist item")}
                            onClick={submitDraft}
                            disabled={saving}
                            className="flex flex-shrink-0 items-center justify-center"
                            style={{
                                width: 15,
                                height: 15,
                                padding: 0,
                                border: "none",
                                background: "transparent",
                                color: T.TEXT_HINT,
                                cursor: saving ? "default" : "pointer",
                            }}
                        >
                            <TaskGlyph
                                d={TASK_ICON.enter}
                                size={15}
                                strokeWidth={1.5}
                            />
                        </button>
                    )}
                </div>
            )}

            {error && (
                <p style={{ fontSize: 14, color: T.RED }}>{error}</p>
            )}
        </>
    );
}
