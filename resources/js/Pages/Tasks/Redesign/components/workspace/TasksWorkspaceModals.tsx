import { Modal } from "antd";
import { router } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import TaskCategoryManager from "@/Pages/Settings/TaskCategoryManager";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import BulkUpdateModal from "@/Features/BulkActions/BulkUpdateModal";
import type { BulkUpdateFieldDef } from "@/Features/BulkActions/bulkUpdateFields";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";
import type { FilterConfig } from "@/contexts/FilterContext";
import type { Task } from "@/Types/Task";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import type { TaskViewModel } from "../../adapters/taskViewModel";
import {
    taskDuplicateInitialFromVm,
    taskFormInitialFromVm,
    type RecordPool,
    type TaskFormValues,
} from "../../adapters/taskFormValues";
import { TASK_FORM_DRAFT_KEYS } from "../../hooks/tasksWorkspaceUiStore";
import type { TaskCheckpoint } from "../../hooks/useTaskCheckpoints";
import TaskDetailModal from "../TaskDetailModal";
import TaskFormModal from "../TaskFormModal";

interface PersonOption {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface CategoryOption {
    id: number;
    category_name: string;
}

interface UserOption {
    id: number;
    name: string;
    image?: string;
}

interface TasksWorkspaceModalsProps {
    selectedVm: TaskViewModel | null;
    editingVm: TaskViewModel | null;
    duplicatingVm: TaskViewModel | null;
    addOpen: boolean;
    addBoardColumnId: number | null;
    onCloseAdd: () => void;
    onCloseEdit: () => void;
    onCloseDuplicate: () => void;
    onCloseDetail: () => void;
    onEditFromDetail: () => void;
    onToggleDone: () => void;
    canWriteSelected: boolean;
    canManageChecklist: boolean;
    canComment: boolean;
    deleteCommentScope?: string;
    togglingSelected: boolean;
    mentionablePeople: PersonOption[];
    currentUser: { id: number; name: string; image?: string | null };
    onChecklistChange: (taskId: number, items: TaskCheckpoint[]) => void;
    isCreating: boolean;
    isUpdating: boolean;
    createErrors: string[];
    updateErrors: string[];
    clearCreateErrors: () => void;
    clearUpdateErrors: () => void;
    categories: CategoryOption[];
    users: UserOption[];
    columns: TaskboardColumn[];
    recordPool: RecordPool;
    onCreate: (values: TaskFormValues) => void;
    onUpdate: (taskId: number, values: TaskFormValues) => void;
    filterConfig: FilterConfig;
    totalItems: number;
    deleteTarget: Task | null;
    onCloseDelete: () => void;
    onDeleted: (taskId: number) => void;
    confirmBulkDelete: boolean;
    selectedCount: number;
    bulkBusy: boolean;
    onConfirmBulkDelete: () => void;
    onCancelBulkDelete: () => void;
    bulkUpdateOpen: boolean;
    onCloseBulkUpdate: (succeeded?: boolean) => void;
    bulkUpdateTarget: BulkTarget;
    bulkUpdateFields: BulkUpdateFieldDef[];
    taskSettingsOpen: boolean;
    onCloseTaskSettings: () => void;
}

export default function TasksWorkspaceModals({
    selectedVm,
    editingVm,
    duplicatingVm,
    addOpen,
    addBoardColumnId,
    onCloseAdd,
    onCloseEdit,
    onCloseDuplicate,
    onCloseDetail,
    onEditFromDetail,
    onToggleDone,
    canWriteSelected,
    canManageChecklist,
    canComment,
    deleteCommentScope,
    togglingSelected,
    mentionablePeople,
    currentUser,
    onChecklistChange,
    isCreating,
    isUpdating,
    createErrors,
    updateErrors,
    clearCreateErrors,
    clearUpdateErrors,
    categories,
    users,
    columns,
    recordPool,
    onCreate,
    onUpdate,
    filterConfig,
    totalItems,
    deleteTarget,
    onCloseDelete,
    onDeleted,
    confirmBulkDelete,
    selectedCount,
    bulkBusy,
    onConfirmBulkDelete,
    onCancelBulkDelete,
    bulkUpdateOpen,
    onCloseBulkUpdate,
    bulkUpdateTarget,
    bulkUpdateFields,
    taskSettingsOpen,
    onCloseTaskSettings,
}: TasksWorkspaceModalsProps) {
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <>
            <TaskDetailModal
                vm={selectedVm}
                onClose={onCloseDetail}
                onEdit={onEditFromDetail}
                onToggleDone={onToggleDone}
                canWrite={canWriteSelected}
                canManageChecklist={canManageChecklist}
                canComment={canComment}
                deleteCommentScope={deleteCommentScope}
                toggling={togglingSelected}
                people={mentionablePeople}
                currentUser={currentUser}
                onChecklistChange={onChecklistChange}
            />

            <TaskFormModal
                open={addOpen}
                mode="create"
                draftKey={TASK_FORM_DRAFT_KEYS.create}
                initial={
                    addBoardColumnId
                        ? { boardColumnId: addBoardColumnId }
                        : undefined
                }
                onClose={() => {
                    if (isCreating) return;
                    clearCreateErrors();
                    onCloseAdd();
                }}
                saving={isCreating}
                errors={createErrors}
                categories={categories}
                users={users}
                columns={columns}
                records={recordPool}
                onSubmit={onCreate}
            />

            <TaskFormModal
                open={editingVm !== null}
                mode="edit"
                draftKey={
                    editingVm
                        ? TASK_FORM_DRAFT_KEYS.edit(editingVm.id)
                        : undefined
                }
                onClose={() => {
                    if (isUpdating) return;
                    clearUpdateErrors();
                    onCloseEdit();
                }}
                saving={isUpdating}
                errors={updateErrors}
                categories={categories}
                users={users}
                columns={columns}
                records={recordPool}
                initial={
                    editingVm ? taskFormInitialFromVm(editingVm) : undefined
                }
                onSubmit={(values) => {
                    if (!editingVm) return;
                    onUpdate(editingVm.id, values);
                }}
            />

            <TaskFormModal
                open={duplicatingVm !== null}
                mode="create"
                draftKey={TASK_FORM_DRAFT_KEYS.duplicate}
                onClose={() => {
                    if (isCreating) return;
                    clearCreateErrors();
                    onCloseDuplicate();
                }}
                saving={isCreating}
                errors={createErrors}
                categories={categories}
                users={users}
                columns={columns}
                records={recordPool}
                initial={
                    duplicatingVm
                        ? taskDuplicateInitialFromVm(duplicatingVm)
                        : undefined
                }
                onSubmit={onCreate}
            />

            <EntityFilterModal
                config={filterConfig}
                entityLabel="tasks"
                currentCount={totalItems}
                savedViews
                savedViewEntity="task"
            />

            <DeleteTask
                open={deleteTarget !== null}
                task={
                    deleteTarget
                        ? {
                              id: deleteTarget.id,
                              heading: deleteTarget.heading,
                          }
                        : undefined
                }
                skipReload
                onClose={onCloseDelete}
                onDeleted={onDeleted}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                title={`${td("Delete")} ${selectedCount} ${
                    selectedCount === 1 ? td("task") : td("tasks")
                }?`}
                message={td("This can't be undone.")}
                confirmLabel={td("Delete tasks")}
                cancelLabel={td("Cancel")}
                danger
                confirmLoading={bulkBusy}
                onConfirm={onConfirmBulkDelete}
                onCancel={onCancelBulkDelete}
            />

            <BulkUpdateModal
                open={bulkUpdateOpen}
                onClose={onCloseBulkUpdate}
                target={bulkUpdateTarget}
                fields={bulkUpdateFields}
                endpoint={route("tasks.apply_quick_action")}
                entityLabel="task"
                reloadOnly="kanbanTasks"
            />

            <Modal
                title={t("modules.tasks.taskCategory")}
                open={taskSettingsOpen}
                onCancel={() => {
                    onCloseTaskSettings();
                    router.reload({ only: ["categories"] });
                }}
                footer={null}
                width={640}
                destroyOnClose
                maskClosable={false}
                styles={{ content: { boxShadow: "none" } }}
            >
                <TaskCategoryManager />
            </Modal>
        </>
    );
}
