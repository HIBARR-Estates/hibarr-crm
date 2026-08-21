import {
    CheckCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    UndoOutlined,
} from "@ant-design/icons";
import type { Task } from "@/Types/Task";
import type { TaskViewModel } from "../../adapters/taskViewModel";
import {
    canAdd,
    canChangeStatus,
    canDeleteTask,
    type TaskPermissionSet,
} from "../../adapters/taskPermissions";
import type { TaskRowAction } from "../primitives/TaskRowMenu";

interface BuildTaskRowActionsArgs {
    vm: TaskViewModel;
    permissions: TaskPermissionSet | undefined;
    userId: number;
    onOpen: (vm: TaskViewModel) => void;
    onToggleDone: (vm: TaskViewModel) => void;
    onEdit: (id: number) => void;
    onDuplicate: (id: number) => void;
    onDelete: (task: Task) => void;
}

export function buildTaskRowActions({
    vm,
    permissions,
    userId,
    onOpen,
    onToggleDone,
    onEdit,
    onDuplicate,
    onDelete,
}: BuildTaskRowActionsArgs): TaskRowAction[] {
    const actions: TaskRowAction[] = [
        {
            key: "open",
            label: "View details",
            icon: <EyeOutlined />,
            onSelect: () => onOpen(vm),
        },
    ];
    if (canChangeStatus(vm.task, permissions, userId)) {
        actions.push({
            key: "toggle-done",
            label: vm.done ? "Reopen task" : "Mark done",
            icon: vm.done ? <UndoOutlined /> : <CheckCircleOutlined />,
            onSelect: () => onToggleDone(vm),
        });
        actions.push({
            key: "edit",
            label: "Edit task",
            icon: <EditOutlined />,
            onSelect: () => onEdit(vm.id),
        });
    }
    if (canAdd(permissions?.add_tasks)) {
        actions.push({
            key: "duplicate",
            label: "Duplicate",
            icon: <CopyOutlined />,
            onSelect: () => onDuplicate(vm.id),
        });
    }
    if (canDeleteTask(vm.task, permissions, userId)) {
        actions.push({
            key: "delete",
            label: "Delete",
            icon: <DeleteOutlined />,
            danger: true,
            onSelect: () => onDelete(vm.task),
        });
    }
    return actions;
}
