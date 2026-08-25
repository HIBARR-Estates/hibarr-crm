import { Deferred, usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import AddTaskModal, {
    type AddTaskFormState,
} from "@/Components/Redesign/modals/AddTaskModal";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import useTaskExtras from "@/Pages/Tasks/Redesign/hooks/useTaskExtras";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import { formLinksPayload } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { afterCreateTaskFormSubmit } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealTaskCreate from "../../hooks/useDealTaskCreate";

interface TaskCategoryOption {
    id: number;
    category_name: string;
}

interface DealAddTaskModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    dealName?: string;
    /** Deal agent's user id — prefilled as an assignee so auto-assignment is visible. */
    dealAgentUserId?: number | null;
}

export default function DealAddTaskModal({
    open,
    onClose,
    dealId,
    dealName,
    dealAgentUserId,
}: DealAddTaskModalProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { createTask, isCreating, errors, clearErrors } =
        useDealTaskCreate(dealId);

    // Behind crm.tasks-workspace-redesign, "Add task" opens the redesigned
    // form instead — see TasksTab.tsx (Leads) for the same pairing pattern.
    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const { props } = usePage();
    const { setTasks } = useDealWorkspace();
    const { persistExtras } = useTaskExtras();
    const {
        createTask: createRedesignedTask,
        isCreating: isCreatingRedesigned,
        createErrors: redesignedErrors,
        clearCreateErrors: clearRedesignedErrors,
    } = useTasksWorkspaceMutations(setTasks, null);

    const handleClose = () => {
        if (isCreating || isCreatingRedesigned) return;
        clearErrors();
        clearRedesignedErrors();
        onClose();
    };

    const handleSubmit = (form: AddTaskFormState) => {
        createTask(
            {
                title: form.title,
                description: form.description,
                startDate: form.startDate,
                dueDate: form.dueDate,
                dueTime: form.dueTime,
                priority: form.priority,
                assignees: form.assignees,
            },
            handleClose,
        );
    };

    if (useRedesignedTasks) {
        return (
            <Deferred data="taskCategories" fallback={null}>
                <TaskRedesignFormModal
                    open={open}
                    mode="create"
                    columns={
                        (props.taskBoardColumns as unknown as
                            | TaskboardColumn[]
                            | undefined) ?? []
                    }
                    categories={
                        (props.taskCategories as unknown as
                            | TaskCategoryOption[]
                            | undefined) ?? []
                    }
                    lockedLinks={[
                        {
                            type: "deal",
                            id: dealId,
                            name: dealName || td("Deal", { source: "en" }),
                        },
                    ]}
                    saving={isCreatingRedesigned}
                    errors={redesignedErrors}
                    onClose={handleClose}
                    onSubmit={(values) =>
                        createRedesignedTask(
                            {
                                title: values.title,
                                startDate: values.startDate,
                                dueDate: values.dueDate,
                                dueTime: values.dueTime,
                                priority: values.priority,
                                description: values.description,
                                assignees: values.assignees.length
                                    ? values.assignees
                                    : dealAgentUserId
                                      ? [dealAgentUserId]
                                      : [],
                                categoryId: values.categoryId,
                                boardColumnId:
                                    values.boardColumnId ?? undefined,
                                links: formLinksPayload(values),
                            },
                            afterCreateTaskFormSubmit(
                                values,
                                persistExtras,
                                handleClose,
                            ),
                        )
                    }
                />
            </Deferred>
        );
    }

    return (
        <AddTaskModal
            open={open}
            onClose={handleClose}
            saving={isCreating}
            errors={errors}
            onSubmit={handleSubmit}
            defaultAssigneeUserId={dealAgentUserId}
            labels={{
                title: t("pages.deals.workspace.tasks.add_task"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("pages.deals.workspace.tasks.create_task"),
                titleField: t("pages.deals.workspace.tasks.title_field"),
                titlePlaceholder: t(
                    "pages.deals.workspace.tasks.title_placeholder",
                ),
                description: t("pages.deals.common.description"),
                descriptionPlaceholder: t(
                    "pages.deals.common.optional_details_placeholder",
                ),
                startDate: t("pages.deals.common.start_date"),
                dueDate: t("pages.deals.common.due_date"),
                dueTime: t("pages.deals.common.due_time"),
                priority: t("pages.deals.common.priority"),
                priorityHigh: t("pages.deals.common.priority_high"),
                priorityMedium: t("pages.deals.common.priority_medium"),
                priorityLow: t("pages.deals.common.priority_low"),
                priorityHighest: t("pages.deals.common.priority_highest"),
                priorityUrgent: t("pages.deals.common.priority_urgent"),
                assignees: t("pages.deals.common.assignees"),
                dateRangeError: t(
                    "pages.deals.workspace.tasks.date_range_error",
                ),
            }}
        />
    );
}
