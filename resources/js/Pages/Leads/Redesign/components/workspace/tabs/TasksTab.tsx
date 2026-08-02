import { useMemo, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import {
    AddTaskModal,
    Button,
    EmptyState,
    Icon,
    TaskDetailModal,
} from "@/Components/Redesign";
import type { AddTaskFormState } from "@/Components/Redesign/modals/AddTaskModal";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskStatusDropdownPill from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { toLeadTaskPreview } from "../../../adapters/taskAdapter";
import { useLeadWorkspace } from "../../../context/LeadWorkspaceContext";
import useLeadTaskCreate from "../../../hooks/useLeadTaskCreate";
import useLeadTaskStatus from "../../../hooks/useLeadTaskStatus";
import TaskCard from "../cards/TaskCard";

type TaskFilter = "open" | "done" | "all";

interface TasksTabProps {
    taskBoardColumns: TaskboardColumn[];
}

export default function TasksTab({ taskBoardColumns }: TasksTabProps) {
    const { td } = useTd();
    const { lead, tasks, addTask } = useLeadWorkspace();
    const [filter, setFilter] = useState<TaskFilter>("open");
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);

    const { createTask, isCreating, errors, clearErrors } = useLeadTaskCreate(
        lead.id,
    );
    const { setStatus, isPending } = useLeadTaskStatus();

    const filteredTasks = useMemo(() => {
        const withPreview = tasks.map((task) => ({
            task,
            preview: toLeadTaskPreview(task),
        }));
        if (filter === "all") return withPreview;
        if (filter === "open") {
            return withPreview.filter(({ preview }) => preview.isOpen);
        }
        return withPreview.filter(({ preview }) => !preview.isOpen);
    }, [filter, tasks]);

    return (
        <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
                {(["open", "done", "all"] as TaskFilter[]).map((key) => (
                    <button
                        key={key}
                        type="button"
                        className={`rounded-full border px-2.5 py-1 text-xs capitalize${
                            filter === key
                                ? " border-[#16294d] bg-[#16294d] font-medium text-white"
                                : " border-[#e2e5ea] bg-white text-[#6b7280]"
                        }`}
                        onClick={() => setFilter(key)}
                    >
                        {key}
                    </button>
                ))}
                <div className="ml-auto">
                    <Button
                        variant="primary"
                        icon={<Icon name="plus" size={14} />}
                        onClick={() => {
                            clearErrors();
                            setModalOpen(true);
                        }}
                    >
                        {td("Create task")}
                    </Button>
                </div>
            </div>

            {filteredTasks.length === 0 ? (
                <EmptyState
                    title={td("No tasks")}
                    description={td(
                        "Create a task to track follow-ups for this lead.",
                    )}
                />
            ) : (
                filteredTasks.map(({ task, preview }) => (
                    <TaskCard
                        key={task.id}
                        task={preview}
                        onClick={() => setSelectedTask(task)}
                        statusControl={
                            <TaskStatusDropdownPill
                                status={
                                    (
                                        task as Task & {
                                            board_column?: { slug?: string };
                                        }
                                    ).board_column?.slug ||
                                    task.status ||
                                    "to_do"
                                }
                                columns={taskBoardColumns}
                                onChange={(slug) => setStatus(task.id, slug)}
                                loading={isPending(task.id)}
                                disabled={isPending(task.id)}
                            />
                        }
                    />
                ))
            )}

            <AddTaskModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                saving={isCreating}
                errors={errors}
                defaultAssigneeUserId={lead.lead_owner?.id}
                onSubmit={(form: AddTaskFormState) =>
                    createTask(form, (task) => {
                        if (task) addTask(task);
                        setModalOpen(false);
                    })
                }
                labels={{
                    title: td("Create task"),
                    cancel: td("Cancel"),
                    submit: td("Create task"),
                    titleField: td("Title"),
                    titlePlaceholder: td("What needs to be done?"),
                    description: td("Description"),
                    descriptionPlaceholder: td("Optional details"),
                    startDate: td("Start date"),
                    dueDate: td("Due date"),
                    dueTime: td("Due time"),
                    priority: td("Priority"),
                    priorityHigh: td("High"),
                    priorityMedium: td("Medium"),
                    priorityLow: td("Low"),
                    assignees: td("Assignees"),
                    dateRangeError: td("Due date must be on or after start date"),
                }}
            />

            <TaskDetailModal
                task={selectedTask}
                onClose={() => setSelectedTask(null)}
                taskBoardColumns={taskBoardColumns}
                canWrite={false}
                isStatusPending={
                    selectedTask ? isPending(selectedTask.id) : false
                }
                isUpdating={false}
                errors={[]}
                clearErrors={() => {}}
                onUpdate={() => {}}
                onStatusChange={(slug) =>
                    selectedTask && setStatus(selectedTask.id, slug)
                }
                labels={{
                    viewTitle: td("Task"),
                    editTitle: td("Edit task"),
                    cancel: td("Cancel"),
                    save: td("Save"),
                    delete: td("Delete"),
                    edit: td("Edit"),
                    titleField: td("Title"),
                    description: td("Description"),
                    descriptionPlaceholder: td("Optional details"),
                    startDate: td("Start date"),
                    dueDate: td("Due date"),
                    dueTime: td("Due time"),
                    priority: td("Priority"),
                    priorityHigh: td("High"),
                    priorityMedium: td("Medium"),
                    priorityLow: td("Low"),
                    assignees: td("Assignees"),
                    overdue: td("Overdue"),
                    noDescription: td("No description"),
                    unassigned: td("Unassigned"),
                    dateRangeError: td(
                        "Due date must be on or after start date",
                    ),
                }}
            />
        </div>
    );
}
