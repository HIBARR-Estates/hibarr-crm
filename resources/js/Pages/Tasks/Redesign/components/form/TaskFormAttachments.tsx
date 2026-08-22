import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import { MICRO_LABEL } from "../primitives/taskUiStyles";
import { formatFileSize } from "./taskFormStyles";

interface TaskFormAttachmentsProps {
    files: File[];
    saving: boolean;
    onPick: () => void;
    onRemove: (index: number) => void;
}

/** Always-visible attachments list — the hidden file input lives on the form. */
export default function TaskFormAttachments({
    files,
    saving,
    onPick,
    onRemove,
}: TaskFormAttachmentsProps) {
    const { td } = useTd();

    return (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <span style={MICRO_LABEL}>{td("Attachments")}</span>
                <button
                    type="button"
                    aria-label={td("Attach files")}
                    title={td("Attach files")}
                    disabled={saving}
                    onClick={onPick}
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

            {files.length > 0 ? (
                <div className="flex flex-col gap-1.5">
                    {files.map((file, index) => (
                        <div
                            key={`${file.name}-${index}`}
                            className="tasks-chip-in flex items-center gap-2.5"
                            style={{
                                padding: "8px 10px",
                                background: T.SURFACE_2,
                                border: `1px solid ${T.BORDER_SOFT}`,
                                borderRadius: 8,
                            }}
                        >
                            <span
                                className="flex flex-shrink-0 items-center justify-center"
                                style={{
                                    width: 26,
                                    height: 26,
                                    borderRadius: 6,
                                    background: T.BLUE_LIGHT,
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.file}
                                    size={13}
                                    color={T.BLUE_DARK}
                                    strokeWidth={1.5}
                                />
                            </span>
                            <span
                                className="min-w-0 flex-1 truncate"
                                style={{
                                    fontSize: 15,
                                    fontWeight: 500,
                                    color: T.TEXT,
                                }}
                                title={file.name}
                            >
                                {file.name}
                            </span>
                            <span
                                style={{
                                    fontSize: 13,
                                    color: T.TEXT_HINT,
                                    flexShrink: 0,
                                }}
                            >
                                {formatFileSize(file.size)}
                            </span>
                            <button
                                type="button"
                                aria-label={`${td("Remove")} ${file.name}`}
                                onClick={() => onRemove(index)}
                                className="tasks-press"
                                style={{
                                    display: "flex",
                                    background: "transparent",
                                    border: "none",
                                    cursor: "pointer",
                                    flexShrink: 0,
                                    padding: 3,
                                }}
                            >
                                <TaskGlyph
                                    d={TASK_ICON.x}
                                    size={13}
                                    color={T.TEXT_MUTED}
                                    strokeWidth={2}
                                />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <button
                    type="button"
                    onClick={onPick}
                    disabled={saving}
                    className="tasks-press"
                    style={{
                        padding: "10px",
                        borderRadius: 8,
                        border: `1px dashed ${T.BORDER}`,
                        background: T.SURFACE_2,
                        color: T.TEXT_HINT,
                        fontSize: 14,
                        cursor: "pointer",
                        textAlign: "left",
                    }}
                >
                    {td("No files attached yet — click to add some.")}
                </button>
            )}
        </div>
    );
}
