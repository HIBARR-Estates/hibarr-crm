import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { TASK_ICON } from "../../config/taskDesignTokens";
import { TaskGlyph } from "../primitives/TaskGlyphs";
import { DETAIL_LABEL } from "../primitives/taskUiStyles";
import { formatFileSize } from "../form/taskFormStyles";

interface TaskDetailFile {
    id: number;
    filename: string;
    size: number;
    download_url: string;
}

interface TaskDetailAttachmentsProps {
    files: TaskDetailFile[];
}

/** Read-only attachments list — the create-side equivalent is TaskFormAttachments. */
export default function TaskDetailAttachments({
    files,
}: TaskDetailAttachmentsProps) {
    const { td } = useTd();
    if (files.length === 0) return null;

    return (
        <div style={{ marginBottom: 20 }}>
            <p style={{ ...DETAIL_LABEL, margin: "0 0 10px" }}>
                {td("Attachments")}
            </p>
            <div className="flex flex-col gap-1.5">
                {files.map((file) => (
                    <a
                        key={file.id}
                        href={file.download_url}
                        className="tasks-record-row flex items-center gap-2.5"
                        style={{
                            padding: "8px 10px",
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER_SOFT}`,
                            borderRadius: 8,
                            textDecoration: "none",
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
                            title={file.filename}
                        >
                            {file.filename}
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
                    </a>
                ))}
            </div>
        </div>
    );
}
