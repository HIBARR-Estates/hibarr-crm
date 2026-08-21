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

/** Always-visible checklist editor — no disclosure, rows add in place. */
export default function TaskFormChecklist({
    items,
    onChange,
}: TaskFormChecklistProps) {
    const { td } = useTd();

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span style={MICRO_LABEL}>{td("Checklist")}</span>
                <button
                    type="button"
                    aria-label={td("Add checklist item")}
                    title={td("Add checklist item")}
                    onClick={() => onChange([...items, ""])}
                    className="tasks-press inline-flex items-center justify-center"
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
            </div>
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
                        autoFocus={index === items.length - 1}
                        onChange={(event) => {
                            const next = [...items];
                            next[index] = event.target.value;
                            onChange(next);
                        }}
                        onKeyDown={(event) => {
                            if (event.key === "Enter") {
                                event.preventDefault();
                                onChange([...items, ""]);
                            }
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
        </div>
    );
}
