import { useTd } from "@/Hooks/useDynamicTranslation";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { assigneeTone } from "../../config/taskDesignTokens";
import type { TaskCommentRecord } from "../../hooks/useTaskComments";
import { renderComment } from "../../lib/commentMarkup";

export interface TaskCommentGroupData {
    user: TaskCommentRecord["user"];
    is_mine: boolean;
    items: TaskCommentRecord[];
}

interface TaskCommentGroupProps {
    group: TaskCommentGroupData;
    canDelete: (comment: TaskCommentRecord) => boolean;
    onDelete: (commentId: number) => void;
}

export default function TaskCommentGroup({
    group,
    canDelete,
    onDelete,
}: TaskCommentGroupProps) {
    const { td } = useTd();

    return (
        <div className="mb-5 flex gap-3">
            <Avatar
                size={32}
                initials={initialsFromName(group.user?.name ?? "?")}
                src={group.user?.image}
                tone={assigneeTone(group.user?.id ?? 0)}
            />
            <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-baseline gap-1.5">
                    <span
                        style={{
                            fontSize: 14.5,
                            fontWeight: 700,
                            color: T.TEXT,
                        }}
                    >
                        {group.is_mine
                            ? td("You")
                            : (group.user?.name ?? td("Unknown"))}
                    </span>
                    <span style={{ fontSize: 14, color: T.TEXT_HINT }}>
                        {group.items[0].created_at_human}
                    </span>
                </div>
                {group.items.map((comment) => (
                    <div
                        key={comment.id}
                        className="tasks-comment flex items-start justify-between gap-2"
                    >
                        <div
                            style={{
                                fontSize: 15,
                                color: T.TEXT_MUTED,
                                lineHeight: 1.65,
                                overflowWrap: "anywhere",
                            }}
                        >
                            {renderComment(comment.comment)}
                        </div>
                        {canDelete(comment) && (
                            <button
                                type="button"
                                onClick={() => onDelete(comment.id)}
                                className="tasks-comment-delete flex-shrink-0"
                                style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: 0,
                                    fontSize: 14,
                                    color: T.TEXT_HINT,
                                    cursor: "pointer",
                                }}
                            >
                                {td("Delete")}
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
