import useTranslation from "@/Hooks/useTranslation";
import AddTaskModal, {
    type AddTaskFormState,
} from "@/Components/Redesign/modals/AddTaskModal";
import useDealTaskCreate from "../../hooks/useDealTaskCreate";

interface DealAddTaskModalProps {
    open: boolean;
    onClose: () => void;
    dealId: number;
    /** Deal agent's user id — prefilled as an assignee so auto-assignment is visible. */
    dealAgentUserId?: number | null;
}

export default function DealAddTaskModal({
    open,
    onClose,
    dealId,
    dealAgentUserId,
}: DealAddTaskModalProps) {
    const { t } = useTranslation();
    const { createTask, isCreating, errors, clearErrors } =
        useDealTaskCreate(dealId);

    const handleClose = () => {
        if (isCreating) return;
        clearErrors();
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
                assignees: t("pages.deals.common.assignees"),
                dateRangeError: t(
                    "pages.deals.workspace.tasks.date_range_error",
                ),
            }}
        />
    );
}
