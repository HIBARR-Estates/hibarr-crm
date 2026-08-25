import { useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { TaskCommentDeleteScope } from "../adapters/taskPermissions";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { TaskViewModel } from "../adapters/taskViewModel";
import useTaskComments from "../hooks/useTaskComments";
import useTaskActivity from "../hooks/useTaskActivity";
import useTaskCheckpoints, {
    type TaskCheckpoint,
} from "../hooks/useTaskCheckpoints";
import TaskModalShell from "./primitives/TaskModalShell";
import TaskCommentsPanel from "./TaskCommentsPanel";
import TaskDetailHeader from "./detail/TaskDetailHeader";
import TaskDetailLinks from "./detail/TaskDetailLinks";
import TaskDetailAttachments from "./detail/TaskDetailAttachments";
import TaskDetailChecklist from "./detail/TaskDetailChecklist";
import TaskDetailFooter from "./detail/TaskDetailFooter";
import { DETAIL_LABEL } from "./primitives/taskUiStyles";

interface PersonOption {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface TaskDetailModalProps {
    vm: TaskViewModel | null;
    onClose: () => void;
    onEdit: () => void;
    onToggleDone: () => void;
    canWrite: boolean;
    canManageChecklist: boolean;
    canComment: boolean;
    toggling: boolean;
    people: PersonOption[];
    currentUser: { id: number; name: string; image?: string | null };
    deleteCommentScope?: TaskCommentDeleteScope;
    onChecklistChange?: (taskId: number, items: TaskCheckpoint[]) => void;
}

export default function TaskDetailModal({
    vm,
    onClose,
    onEdit,
    onToggleDone,
    canWrite,
    canManageChecklist,
    canComment,
    deleteCommentScope,
    toggling,
    people,
    currentUser,
    onChecklistChange,
}: TaskDetailModalProps) {
    const { td } = useTd();
    const [mentionDropdownOpen, setMentionDropdownOpen] = useState(false);
    const comments = useTaskComments(vm?.id ?? null);
    const activity = useTaskActivity(vm?.id ?? null);
    const taskId = vm?.id ?? null;
    const checkpoints = useTaskCheckpoints(
        taskId,
        vm?.task.subtasks,
        taskId !== null
            ? (items) => onChecklistChange?.(taskId, items)
            : undefined,
    );

    return (
        <TaskModalShell
            open={vm !== null}
            onClose={onClose}
            onEscape={() => mentionDropdownOpen}
            ariaLabel={vm?.title ?? ""}
            zIndex={48}
            panelClassName="tasks-modal-panel flex w-full overflow-hidden"
            panelStyle={{
                minWidth: 1040,
                maxWidth: 1100,
                height: 741,
                background: T.WHITE,
                borderRadius: 14,
                boxShadow: "0 20px 50px rgba(22,41,77,0.18)",
            }}
        >
            {vm && (
                <>
                    <div className="flex min-w-0 flex-1 flex-col">
                        <TaskDetailHeader vm={vm} />

                        <div
                            className="min-h-0 flex-1 overflow-y-auto"
                            style={{ padding: "20px 22px" }}
                        >
                            <TaskDetailLinks links={vm.allLinks} />

                            <TaskDetailAttachments files={vm.task.files ?? []} />

                            <p style={{ ...DETAIL_LABEL, margin: "0 0 10px" }}>
                                {td("Description")}
                            </p>
                            <p
                                style={{
                                    fontSize: 14,
                                    lineHeight: 1.55,
                                    margin: "0 0 20px",
                                    color: vm.descriptionText
                                        ? T.TEXT_MUTED
                                        : T.TEXT_HINT,
                                    fontStyle: vm.descriptionText
                                        ? "normal"
                                        : "italic",
                                    whiteSpace: "pre-wrap",
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                }}
                            >
                                {vm.descriptionText ||
                                    td("No description added yet.")}
                            </p>

                            <TaskDetailChecklist
                                key={vm.id}
                                items={checkpoints.items}
                                saving={checkpoints.saving}
                                error={checkpoints.error}
                                canManage={canManageChecklist}
                                onToggle={checkpoints.toggle}
                                onRemove={checkpoints.remove}
                                onAdd={checkpoints.add}
                            />
                        </div>

                        <TaskDetailFooter
                            done={vm.done}
                            canWrite={canWrite}
                            toggling={toggling}
                            onEdit={onEdit}
                            onClose={onClose}
                            onToggleDone={onToggleDone}
                        />
                    </div>

                    <TaskCommentsPanel
                        comments={comments.comments}
                        activity={activity.entries}
                        totalCount={comments.totalCount}
                        loading={comments.loading}
                        loadingMore={comments.loadingMore}
                        hasMore={comments.hasMore}
                        posting={comments.posting}
                        error={comments.error}
                        people={people}
                        currentUser={currentUser}
                        canComment={canComment}
                        deleteCommentScope={deleteCommentScope}
                        onMentionOpenChange={setMentionDropdownOpen}
                        onSubmit={comments.addComment}
                        onDelete={comments.deleteComment}
                        onLoadMore={comments.loadMore}
                        onClose={onClose}
                    />
                </>
            )}
        </TaskModalShell>
    );
}
