import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { taskActivityText } from "../../adapters/taskActivityText";
import type { TaskActivityRecord } from "../../hooks/useTaskActivity";

interface TaskActivityLogLineProps {
    entry: TaskActivityRecord;
}

/** One system-message-style line for a status/assignee/checklist/file event, distinct from a chat bubble. */
export default function TaskActivityLogLine({
    entry,
}: TaskActivityLogLineProps) {
    const { td } = useTd();

    return (
        <div
            className="mb-2 flex items-center gap-1.5"
            style={{ fontSize: 12, lineHeight: 1.4, color: T.TEXT_HINT }}
        >
            <span style={{ overflowWrap: "anywhere" }}>
                {td(taskActivityText(entry), { source: "en" })}
            </span>
            <span style={{ flexShrink: 0 }}>· {entry.created_at_human}</span>
        </div>
    );
}
