import { useTd } from "@/Hooks/useDynamicTranslation";
import AddTaskModal, {
    type AddTaskFormState,
} from "@/Components/Redesign/modals/AddTaskModal";
import useLeadTaskCreate from "../../../../hooks/useLeadTaskCreate";

interface LeadAddTaskModalProps {
    open: boolean;
    onClose: () => void;
    leadId: number;
    onTaskCreated?: (task: import("@/Types/api/tasks").Task) => void;
}

export default function LeadAddTaskModal({
    open,
    onClose,
    leadId,
    onTaskCreated,
}: LeadAddTaskModalProps) {
    const { td } = useTd();
    const { createTask, isCreating, errors, clearErrors } =
        useLeadTaskCreate(leadId);

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
            (task) => {
                if (task) onTaskCreated?.(task);
                handleClose();
            },
        );
    };

    return (
        <AddTaskModal
            open={open}
            onClose={handleClose}
            saving={isCreating}
            errors={errors}
            onSubmit={handleSubmit}
            labels={{
                title: td("Add task"),
                cancel: td("Cancel"),
                submit: td("Create task"),
                titleField: td("Task title"),
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
    );
}
