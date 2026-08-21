import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import axios from "axios";
import { Modal, App } from "antd";
import {
    CheckCircleOutlined,
    CopyOutlined,
    DeleteOutlined,
    EditOutlined,
    EyeOutlined,
    UndoOutlined,
} from "@ant-design/icons";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import TaskCategoryManager from "@/Pages/Settings/TaskCategoryManager";
import PageLayout from "@/Components/PageLayout";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import createTaskFilterConfig from "@/configs/taskFilterConfig";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { useFilter } from "@/contexts/FilterContext";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import TaskFormModal, {
    type RecordPool,
    type TaskFormValues,
} from "./components/TaskFormModal";
import useTaskStatus from "@/Hooks/useTaskStatus";
import type { Task } from "@/Types/Task";
import type { TasksIndexProps } from "@/Pages/Tasks/Index";
import TasksHeader, { type TasksViewMode } from "./components/TasksHeader";
import TasksFilterBar, {
    type GroupMode,
    type QuickFilterCounts,
    type QuickFilterKey,
} from "./components/TasksFilterBar";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import TasksPagination from "./components/TasksPagination";
import TasksBulkBar from "./components/TasksBulkBar";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import TasksListView from "./components/TasksListView";
import { type TaskRowAction } from "./components/primitives/TaskRowMenu";
import TasksBoardView from "./components/TasksBoardView";
import TaskDetailModal from "./components/TaskDetailModal";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import useTasksFilters, {
    appliedValues,
    hasFilter,
} from "./hooks/useTasksFilters";
import useTasksWorkspaceMutations from "./hooks/useTasksWorkspaceMutations";
import useTasksServerPagination from "./hooks/useTasksServerPagination";
import usePersistedPageSize from "@/Hooks/usePersistedPageSize";
import useTasksWorkspaceUiState from "./hooks/useTasksWorkspaceUiState";
import { TASK_FORM_DRAFT_KEYS } from "./hooks/tasksWorkspaceUiStore";
import buildTaskGroups from "./lib/buildTaskGroups";
import type { LeadSavedView as SavedView } from "@/Features/Filters/useLeadSavedViews";
import BulkUpdateModal from "@/Features/BulkActions/BulkUpdateModal";
import { createTaskBulkUpdateFields } from "./config/taskBulkUpdateFields";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";
import { toTaskViewModel, type TaskViewModel } from "./adapters/taskViewModel";
import {
    TASK_PRIORITY,
    type DensityOption,
    type TaskPriorityKey,
} from "./config/taskDesignTokens";

// Primitives (.dr-btn, .modal-panel, .modal-field …) are styled here — without
// this import every Redesign modal renders unstyled.
import "@/Components/Redesign/redesign.css";
import "./tasks-redesign.css";

export interface TasksWorkspaceRedesignProps extends TasksIndexProps {
    savedViews?: SavedView[];
}

/** Design defaults, matching the handoff's prop defaults. */
const DENSITY: DensityOption = "comfortable";
const PRIORITY_TREATMENT: "stripe" | "pill" = "stripe";
const SHOW_ROW_CATEGORY = true;
const BOARD_CARD_META: "full" | "minimal" = "full";

function canAdd(permission: string | undefined): boolean {
    return ["all", "added", "owned", "both"].includes(permission ?? "");
}

/** The task's existing links, in the shape the form modal edits. */
function taskLinkRefs(vm: TaskViewModel) {
    const task = vm.task;
    return [
        ...(task.deals ?? []).map((deal) => ({
            type: "deal" as const,
            id: deal.id,
            name: deal.name,
        })),
        ...(task.leads ?? []).map((lead) => ({
            type: "lead" as const,
            id: lead.id,
            name: lead.client_name || lead.company_name || "Lead",
        })),
        ...(task.properties ?? []).map((property) => ({
            type: "property" as const,
            id: property.id,
            name: property.name ?? "Property",
        })),
        // "project" here means developer project (the one holding units),
        // matching syncTaskLinks() on the backend — not task.project, which
        // is the unrelated Worksuite delivery project.
        ...(task.developer_projects ?? []).map((project) => ({
            type: "project" as const,
            id: project.id,
            name: project.name,
        })),
    ];
}

/** Scoped task permission check — matches legacy TasksKanban / Columns. */
function hasTaskScopePermission(
    task: Task,
    scope: string | undefined,
    userId: number,
): boolean {
    if (scope === "all") return true;
    if (!scope || scope === "none") return false;
    const isCreator = task.added_by === userId;
    const isAssignee =
        task.users?.some((user) => user.id === userId) ?? false;
    if (scope === "added") return isCreator;
    if (scope === "owned") return isAssignee;
    if (scope === "both") return isCreator || isAssignee;
    return false;
}

/** Whether the current user may move/complete this task (change_status scope). */
function canChangeStatus(
    task: Task,
    permissions: TasksIndexProps["permissions"],
    userId: number,
): boolean {
    const scope = permissions?.change_status ?? permissions?.edit_tasks;
    return hasTaskScopePermission(task, scope, userId);
}

function canDeleteTask(
    task: Task,
    permissions: TasksIndexProps["permissions"],
    userId: number,
): boolean {
    return hasTaskScopePermission(task, permissions?.delete_tasks, userId);
}

/** Whether the current user may add a comment on this task. */
function canCommentOnTask(
    task: Task,
    permissions: TasksIndexProps["permissions"],
    userId: number,
): boolean {
    return hasTaskScopePermission(
        task,
        permissions?.add_task_comments,
        userId,
    );
}

function hasAnyDeletePermission(scope: string | undefined): boolean {
    return ["all", "added", "owned", "both"].includes(scope ?? "");
}

/** Form defaults shared by the edit and duplicate modals. */
function taskFormInitialFromVm(vm: TaskViewModel): Partial<TaskFormValues> {
    return {
        title: vm.task.heading,
        description: vm.descriptionText,
        startDate: vm.task.start_date?.slice(0, 10) ?? "",
        dueDate: vm.task.due_date?.slice(0, 10) ?? "",
        dueTime: vm.task.due_date?.slice(11, 16) || "17:00",
        priority: vm.task.priority as TaskPriorityKey,
        assignees: vm.people.map((person) => person.id),
        categoryId: vm.task.category?.id ?? null,
        boardColumnId: vm.task.board_column_id ?? null,
        links: taskLinkRefs(vm),
    };
}

/**
 * Duplicate-modal defaults: everything `taskFormInitialFromVm` carries over
 * (assignees, linked records), plus the source task's checklist titles —
 * unlike edit mode, where the form's checklist field only ever adds new
 * rows, duplicating should recreate the whole checklist on the new task.
 */
function taskDuplicateInitialFromVm(
    vm: TaskViewModel,
): Partial<TaskFormValues> {
    return {
        ...taskFormInitialFromVm(vm),
        checklist: (vm.task.subtasks ?? []).map((item) => item.title),
    };
}

export default function TasksWorkspaceRedesign({
    tableTasks,
    kanbanTasks = [],
    taskQuickCounts,
    categories = [],
    labels = [],
    users = [],
    mentionablePeople,
    columns = [],
    projects = [],
    deals = [],
    leads = [],
    properties = [],
    developerProjects = [],
    permissions,
    stats = { total: 0, completed: 0, overdue: 0, dueToday: 0 },
    savedViews = [],
    filters,
    auth,
}: TasksWorkspaceRedesignProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { message } = App.useApp();
    const userId = auth.user.id;
    const isAdmin = useIsAdminRole();
    const canManageTaskCategories =
        isAdmin || permissions?.view_task_category === "all";

    const [boardTasks, setBoardTasks] = useState<Task[]>(kanbanTasks);
    const [listTasks, setListTasks] = useState<Task[]>(tableTasks?.data ?? []);
    const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
    const [view, setView] = useState<TasksViewMode>("list");
    const [groupMode, setGroupMode] = useState<GroupMode>("due");
    const {
        addOpen,
        setAddOpen,
        editingTaskId,
        setEditingTaskId,
        duplicatingTaskId,
        setDuplicatingTaskId,
    } = useTasksWorkspaceUiState();
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

    const quickFilter = (
        (filters as { quick_filter?: string } | undefined)?.quick_filter ??
        "all"
    ) as QuickFilterKey;

    const patchTasks = useCallback(
        (updater: (prev: Task[]) => Task[]) => {
            setBoardTasks(updater);
            setListTasks(updater);
        },
        [],
    );

    const { persistPageSize } = usePersistedPageSize({
        storageKey: "hibarr_tasks_per_page",
        currentPerPage: tableTasks?.per_page ?? 15,
        onRestore: (perPage) => {
            router.get(
                route("tasks.index"),
                mergeQueryParams({ page: 1, per_page: perPage }),
                {
                    only: ["tableTasks"],
                    preserveState: true,
                    preserveScroll: true,
                },
            );
        },
    });

    const {
        tableTasks: pagedTableTasks,
        isPaging,
        navigateToPage,
        changePageSize,
    } = useTasksServerPagination({
        tableTasks: tableTasks ?? {
            data: [],
            current_page: 1,
            total: 0,
            per_page: 15,
            last_page: 1,
        },
        onPersistPageSize: persistPageSize,
    });

    /** Board column slugs that count as "done". */
    const completedSlugs = useMemo(
        () =>
            columns
                .filter((column) => column.slug === "done")
                .map((column) => column.slug),
        [columns],
    );

    const { setStatus, isPending } = useTaskStatus((taskId, slug) => {
        const column = columns.find((item) => item.slug === slug);
        patchTasks((prev) =>
            prev.map((task) =>
                task.id === taskId
                    ? {
                          ...task,
                          status: slug,
                          board_column_id: column?.id ?? task.board_column_id,
                          board_column: task.board_column
                              ? { ...task.board_column, slug }
                              : column
                                ? {
                                      id: column.id,
                                      column_name: column.column_name,
                                      slug: column.slug,
                                      label_color: column.label_color,
                                  }
                                : undefined,
                          completed_on:
                              slug === "done"
                                  ? new Date().toISOString().slice(0, 10)
                                  : undefined,
                      }
                    : task,
            ),
        );
    });

    const {
        createTask,
        isCreating,
        createErrors,
        clearCreateErrors,
        updateTask,
        isUpdating,
        updateErrors,
        clearUpdateErrors,
    } = useTasksWorkspaceMutations(patchTasks, editingTaskId);

    /** Options for the modal's linked-record picker. */
    const recordPool: RecordPool = useMemo(
        () => ({
            deal: deals.map((deal) => ({ id: deal.id, name: deal.name })),
            lead: leads.map((lead) => ({
                id: lead.id,
                name: lead.client_name || lead.company_name || "Lead",
                meta: lead.company_name ?? undefined,
            })),
            property: properties.map((property) => ({
                id: property.id,
                name: property.name ?? property.title ?? "Property",
            })),
            project: developerProjects.map((project) => ({
                id: project.id,
                name: project.name,
            })),
        }),
        [deals, leads, properties, developerProjects],
    );

    /** Adds a category inline from the task modal. */
    const [categoryOptions, setCategoryOptions] = useState(categories);
    useEffect(() => setCategoryOptions(categories), [categories]);

    /**
     * Checklist rows and attachments both need a saved task id, so they're
     * written after the task itself. Failures here are surfaced in the
     * console rather than blocking — the task is already saved by then.
     */
    const persistExtras = async (
        taskId: number,
        checklist: string[],
        files: File[],
    ) => {
        for (const title of checklist) {
            try {
                await axios.post(
                    route("sub-tasks.store"),
                    { task_id: taskId, title },
                    { headers: { Accept: "application/json" } },
                );
            } catch (error) {
                console.error("Failed to add checklist item", title, error);
                message.error(
                    td("Failed to save a checklist item. Please try again."),
                );
            }
        }

        if (files.length > 0) {
            const payload = new FormData();
            payload.append("task_id", String(taskId));
            files.forEach((file) => payload.append("file[]", file));
            try {
                await axios.post(route("task-files.store"), payload, {
                    headers: { Accept: "application/json" },
                });
            } catch (error) {
                console.error("Failed to upload task files", error);
                message.error(
                    td("Failed to upload one or more files. Please try again."),
                );
            }
        }

        if (checklist.length || files.length) {
            router.reload({
                only: ["kanbanTasks", "tableTasks", "stats"],
                preserveState: true,
                preserveScroll: true,
            });
        }
    };

    const createCategory = async (name: string) => {
        try {
            const response = await axios.post(
                route("taskCategory.store"),
                { category_name: name },
                { headers: { Accept: "application/json" } },
            );
            const id = response.data?.data?.id ?? response.data?.id;
            if (!id) return null;
            const option = { id: Number(id), category_name: name };
            setCategoryOptions((current) => [...current, option]);
            return option;
        } catch {
            return null;
        }
    };

    const { applyFilters, activeCount, clearAll } = useTasksFilters({
        status: filters?.status ?? undefined,
        priority: filters?.priority ?? undefined,
        assigned_to: filters?.assigned_to ?? undefined,
        assigned_by: (filters as Record<string, never> | undefined)
            ?.assigned_by,
        category_id: filters?.category_id ?? undefined,
        due_date_range: filters?.due_date_range as
            string | string[] | undefined,
        search: filters?.search ?? undefined,
    });

    // Registers the tasks route + fields with FilterContext, which
    // UniversalSearchBox in the page header reads for its search navigation.
    const filterConfig = useMemo(
        () =>
            createTaskFilterConfig({
                categories,
                labels,
                columns,
                users,
                projects,
                deals,
                leads,
                properties,
                excludeFields: ["search"],
            }),
        [
            categories,
            labels,
            columns,
            users,
            projects,
            deals,
            leads,
            properties,
        ],
    );
    usePageSearchAndFilter({ filterConfig });
    const { openDrawer } = useFilter();

    // ── View models ────────────────────────────────────────────────
    const boardViewModels = useMemo(
        () => boardTasks.map((task) => toTaskViewModel(task, completedSlugs)),
        [boardTasks, completedSlugs],
    );

    const listViewModels = useMemo(
        () => listTasks.map((task) => toTaskViewModel(task, completedSlugs)),
        [listTasks, completedSlugs],
    );

    const counts: QuickFilterCounts = taskQuickCounts ?? {
        all: stats.total,
        mine: 0,
        byme: 0,
        open: Math.max(0, stats.total - stats.completed),
        today: stats.dueToday,
        overdue: stats.overdue,
        mentioned: 0,
    };

    const groups = useMemo(
        () => buildTaskGroups(listViewModels, groupMode),
        [listViewModels, groupMode],
    );

    const allViewModels = useMemo(() => {
        const byId = new Map<number, TaskViewModel>();
        [...boardViewModels, ...listViewModels].forEach((vm) =>
            byId.set(vm.id, vm),
        );
        return byId;
    }, [boardViewModels, listViewModels]);

    const selectedVm = selectedTaskId
        ? (allViewModels.get(selectedTaskId) ?? null)
        : null;
    const editingVm = editingTaskId
        ? (allViewModels.get(editingTaskId) ?? null)
        : null;
    const duplicatingVm = duplicatingTaskId
        ? (allViewModels.get(duplicatingTaskId) ?? null)
        : null;

    const openCount = Math.max(0, stats.total - stats.completed);
    const headline = `${stats.overdue} ${td("overdue")} · ${stats.dueToday} ${td("due today")} · ${openCount} ${td("open across your records")}`;

    // ── Actions ────────────────────────────────────────────────────
    const doneColumn = columns.find((column) => column.slug === "done");
    const openColumn =
        columns.find((column) => column.slug === "in_progress") ??
        columns.find((column) => column.slug === "to_do") ??
        columns[0];

    const toggleDone = (vm: TaskViewModel) => {
        if (!canChangeStatus(vm.task, permissions, userId)) return;
        const target = vm.done ? openColumn : doneColumn;
        if (target) setStatus(vm.id, target.slug);
    };

    // Re-seed local lists whenever the server sends fresh data.
    useEffect(() => {
        setBoardTasks(kanbanTasks);
    }, [kanbanTasks]);

    useEffect(() => {
        setListTasks(pagedTableTasks.data);
    }, [pagedTableTasks]);

    const filterSignature = useMemo(
        () => JSON.stringify(filters ?? {}),
        [filters],
    );
    const filtersInitialized = useRef(false);

    // Server-side filters change the result set — reset to page 1 in the URL.
    useEffect(() => {
        if (!filtersInitialized.current) {
            filtersInitialized.current = true;
            return;
        }
        router.get(
            route("tasks.index"),
            mergeQueryParams({ page: 1 }),
            {
                only: [
                    "tableTasks",
                    "taskQuickCounts",
                    "stats",
                    "kanbanTasks",
                    "filters",
                ],
                preserveState: true,
                preserveScroll: true,
            },
        );
    }, [filterSignature]);

    const handleQuickFilter = (key: QuickFilterKey) => {
        router.get(
            route("tasks.index"),
            mergeQueryParams({
                quick_filter: key === "all" ? "" : key,
                page: 1,
            }),
            {
                only: [
                    "tableTasks",
                    "taskQuickCounts",
                    "stats",
                    "kanbanTasks",
                    "filters",
                ],
                preserveState: true,
                preserveScroll: true,
            },
        );
    };

    const handleRefresh = () => {
        setRefreshing(true);
        router.reload({
            only: [
                "kanbanTasks",
                "tableTasks",
                "stats",
                "savedViews",
                "taskQuickCounts",
            ],
            preserveState: true,
            preserveScroll: true,
            onSuccess: (page) => {
                const props = page.props as {
                    kanbanTasks?: Task[];
                    tableTasks?: typeof tableTasks;
                };
                if (props.kanbanTasks) setBoardTasks(props.kanbanTasks);
                if (props.tableTasks) setListTasks(props.tableTasks.data);
            },
            onFinish: () => setRefreshing(false),
        });
    };

    // ── Bulk actions ───────────────────────────────────────────────
    // Same endpoint the deal/lead workspace task tabs use.
    const { mutate: applyBulkAction, status: bulkStatus } = useApiMutate<
        {
            row_ids: string;
            action_type: string;
            status?: number;
            user_id?: number[];
        },
        unknown,
        ApiResponse<unknown>
    >("/account/tasks/apply-quick-action", "POST");
    const bulkBusy = isLoading({ status: bulkStatus });

    const selectedIds = Array.from(selected);
    const clearSelection = () => setSelected(new Set());

    const [bulkUpdateOpen, setBulkUpdateOpen] = useState(false);
    const bulkUpdateFields = useMemo(
        () => createTaskBulkUpdateFields({ columns, categories: categoryOptions, users }),
        [columns, categoryOptions, users],
    );
    const bulkUpdateTarget: BulkTarget = {
        mode: "ids",
        ids: selectedIds,
        count: selectedIds.length,
    };

    const toggleSelect = (vm: TaskViewModel) =>
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(vm.id)) next.delete(vm.id);
            else next.add(vm.id);
            return next;
        });

    const toggleGroupSelection = (items: TaskViewModel[], select: boolean) =>
        setSelected((current) => {
            const next = new Set(current);
            items.forEach((vm) =>
                select ? next.add(vm.id) : next.delete(vm.id),
            );
            return next;
        });

    const allVisibleSelected =
        listViewModels.length > 0 &&
        listViewModels.every((vm) => selected.has(vm.id));

    const bulkSetStatus = (column: (typeof columns)[number]) =>
        applyBulkAction(
            {
                row_ids: selectedIds.join(","),
                action_type: "change-status",
                status: column.id,
            },
            {
                onSuccess: () => {
                    patchTasks((prev) =>
                        prev.map((task) =>
                            selected.has(task.id)
                                ? {
                                      ...task,
                                      status: column.slug,
                                      board_column_id: column.id,
                                      board_column: {
                                          id: column.id,
                                          column_name: column.column_name,
                                          slug: column.slug,
                                          label_color: column.label_color,
                                      },
                                      completed_on:
                                          column.slug === "done"
                                              ? new Date()
                                                    .toISOString()
                                                    .slice(0, 10)
                                              : undefined,
                                  }
                                : task,
                        ),
                    );
                    clearSelection();
                },
            },
        );

    const bulkReassign = (assigneeId: number) => {
        const assignee = users.find((user) => user.id === assigneeId);
        applyBulkAction(
            {
                row_ids: selectedIds.join(","),
                action_type: "change-assignee",
                user_id: [assigneeId],
            },
            {
                onSuccess: () => {
                    patchTasks((prev) =>
                        prev.map((task) =>
                            selected.has(task.id)
                                ? {
                                      ...task,
                                      users: assignee
                                          ? [
                                                {
                                                    id: assignee.id,
                                                    name: assignee.name,
                                                    image: assignee.image,
                                                },
                                            ]
                                          : [],
                                  }
                                : task,
                        ),
                    );
                    clearSelection();
                },
            },
        );
    };

    const bulkDelete = () =>
        applyBulkAction(
            { row_ids: selectedIds.join(","), action_type: "delete" },
            {
                onSuccess: () => {
                    patchTasks((prev) =>
                        prev.filter((task) => !selected.has(task.id)),
                    );
                    setConfirmBulkDelete(false);
                    clearSelection();
                },
            },
        );

    const rowActions = (vm: TaskViewModel): TaskRowAction[] => {
        const actions: TaskRowAction[] = [
            {
                key: "open",
                label: "View details",
                icon: <EyeOutlined />,
                onSelect: () => setSelectedTaskId(vm.id),
            },
        ];
        if (canChangeStatus(vm.task, permissions, userId)) {
            // Completion moved here when the row checkbox became a bulk selector.
            actions.push({
                key: "toggle-done",
                label: vm.done ? "Reopen task" : "Mark done",
                icon: vm.done ? <UndoOutlined /> : <CheckCircleOutlined />,
                onSelect: () => toggleDone(vm),
            });
            actions.push({
                key: "edit",
                label: "Edit task",
                icon: <EditOutlined />,
                onSelect: () => setEditingTaskId(vm.id),
            });
        }
        if (canAdd(permissions?.add_tasks)) {
            actions.push({
                key: "duplicate",
                label: "Duplicate",
                icon: <CopyOutlined />,
                onSelect: () => setDuplicatingTaskId(vm.id),
            });
        }
        if (canDeleteTask(vm.task, permissions, userId)) {
            actions.push({
                key: "delete",
                label: "Delete",
                icon: <DeleteOutlined />,
                danger: true,
                onSelect: () => setDeleteTarget(vm.task),
            });
        }
        return actions;
    };

    return (
        <PageLayout
            title={t("app.menu.tasks")}
            breadcrumbs={[{ name: t("app.menu.tasks") }]}
            searchComp={
                <UniversalSearchBox
                    placeholder={t("app.tasks.search_placeholder")}
                    className="w-full"
                />
            }
            mainContentClassName="p-0"
        >
            {/* Sticky white header band — page title, view toggle and filter
                chrome, matching the design's header treatment. */}
            <div
                style={{
                    background: "#ffffff",
                    borderBottom: "1px solid #e2e5ea",
                    position: "sticky",
                    top: 0,
                    zIndex: 15,
                }}
            >
                <div className="mx-auto w-full max-w-[1280px] px-7 pt-[18px]">
                    <TasksHeader
                        view={view}
                        onViewChange={setView}
                        onRefresh={handleRefresh}
                        refreshing={refreshing}
                        onAddTask={() => setAddOpen(true)}
                        canAddTask={canAdd(permissions?.add_tasks)}
                        headline={headline}
                        showTaskSettings={canManageTaskCategories}
                        onOpenTaskSettings={() => setTaskSettingsOpen(true)}
                    />
                    <TasksFilterBar
                        quickFilter={quickFilter}
                        onQuickFilter={handleQuickFilter}
                        counts={counts}
                        groupMode={groupMode}
                        onGroupMode={setGroupMode}
                        showGroupBy={view === "list"}
                        activeFilterCount={activeCount}
                        onOpenFilters={openDrawer}
                    />
                </div>

                {/* Shared active-filter sentence (same as Leads and Deals) — a
                    flat full-width band (matching Leads), not a floating
                    card: the band's background/border span the whole sticky
                    panel, while its text sits in the same 1280/px-7 column
                    as the header above, so it lines up exactly. */}
                <div
                    style={{
                        background: T.SURFACE_2,
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <div className="mx-auto w-full max-w-[1280px] px-7">
                        <ActiveFilterSentence
                            count={pagedTableTasks.total}
                            entityLabel="tasks"
                            onOpenFilters={openDrawer}
                        />
                    </div>
                </div>
            </div>

            <div
                className={`relative mx-auto w-full max-w-[1280px] px-7 pt-[22px] ${
                    // The board sizes itself to the viewport, so trailing
                    // padding here would push the page into scrolling.
                    view === "board" ? "pb-4" : "pb-14"
                }`}
                style={
                    {
                        minHeight: view === "board" ? undefined : 320,
                        // The filter summary strip, when shown, pushes the
                        // board down — account for it in the board's height.
                        "--tasks-board-offset": "328px",
                    } as React.CSSProperties
                }
            >
                {view === "list" ? (
                    <>
                        <TasksBulkBar
                            count={selected.size}
                            columns={columns}
                            users={users}
                            busy={bulkBusy}
                            canReassign={permissions?.edit_tasks === "all"}
                            canDelete={hasAnyDeletePermission(
                                permissions?.delete_tasks,
                            )}
                            canBulkUpdate={permissions?.edit_tasks === "all"}
                            allSelected={allVisibleSelected}
                            onToggleSelectAll={() =>
                                toggleGroupSelection(
                                    listViewModels,
                                    !allVisibleSelected,
                                )
                            }
                            onSetStatus={bulkSetStatus}
                            onReassign={bulkReassign}
                            onBulkUpdate={() => setBulkUpdateOpen(true)}
                            onDelete={() => setConfirmBulkDelete(true)}
                            onClear={clearSelection}
                        />
                        <div
                            className={`tasks-list-card${isPaging ? " tasks-list-card--paging" : ""}`}
                        >
                            <TasksListView
                                groups={groups}
                                columns={columns}
                                density={DENSITY}
                                priorityTreatment={PRIORITY_TREATMENT}
                                showRowCategory={SHOW_ROW_CATEGORY}
                                onOpen={(vm) => setSelectedTaskId(vm.id)}
                                onStatusChange={(vm, slug) =>
                                    setStatus(vm.id, slug)
                                }
                                isStatusPending={isPending}
                                rowActions={rowActions}
                                selected={selected}
                                onToggleSelect={toggleSelect}
                                onToggleGroup={toggleGroupSelection}
                            />
                            <TasksPagination
                                page={pagedTableTasks.current_page}
                                pageSize={pagedTableTasks.per_page}
                                totalItems={pagedTableTasks.total}
                                onPageChange={navigateToPage}
                                onPageSizeChange={changePageSize}
                            />
                        </div>
                    </>
                ) : (
                    // The board owns the remaining viewport height; only its
                    // columns scroll, so the page itself stays put.
                    <div
                        style={{
                            height: "calc(100vh - var(--tasks-board-offset))",
                            minHeight: 380,
                        }}
                    >
                        <TasksBoardView
                            tasks={boardViewModels}
                            columns={columns}
                            cardMeta={BOARD_CARD_META}
                            canMove={(vm) =>
                                canChangeStatus(vm.task, permissions, userId)
                            }
                            onOpen={(vm) => setSelectedTaskId(vm.id)}
                            onMove={(vm, column) =>
                                setStatus(vm.id, column.slug)
                            }
                            pageSize={pagedTableTasks.per_page}
                        />
                    </div>
                )}
            </div>

            <TaskDetailModal
                vm={selectedVm}
                onClose={() => setSelectedTaskId(null)}
                onEdit={() => {
                    if (selectedVm) {
                        setSelectedTaskId(null);
                        setEditingTaskId(selectedVm.id);
                    }
                }}
                onToggleDone={() => {
                    if (selectedVm) toggleDone(selectedVm);
                }}
                canWrite={
                    selectedVm
                        ? canChangeStatus(selectedVm.task, permissions, userId)
                        : false
                }
                canComment={
                    selectedVm
                        ? canCommentOnTask(selectedVm.task, permissions, userId)
                        : false
                }
                deleteCommentScope={permissions?.delete_task_comments}
                toggling={selectedVm ? isPending(selectedVm.id) : false}
                people={mentionablePeople ?? users}
                currentUser={{
                    id: userId,
                    name: auth.user.name,
                    image:
                        users.find((user) => user.id === userId)?.image ?? null,
                }}
                onChecklistChange={(taskId, items) =>
                    patchTasks((prev) =>
                        prev.map((task) =>
                            task.id === taskId
                                ? { ...task, subtasks: items }
                                : task,
                        ),
                    )
                }
            />

            {/* Create */}
            <TaskFormModal
                open={addOpen}
                mode="create"
                draftKey={TASK_FORM_DRAFT_KEYS.create}
                onClose={() => {
                    if (isCreating) return;
                    clearCreateErrors();
                    setAddOpen(false);
                }}
                saving={isCreating}
                errors={createErrors}
                categories={categories}
                users={users}
                columns={columns}
                records={recordPool}
                onSubmit={(values: TaskFormValues) =>
                    createTask(
                        {
                            ...values,
                            links: values.links.map((link) => ({
                                type: link.type,
                                id: link.id,
                            })),
                        },
                        (created) => {
                            setAddOpen(false);
                            if (created?.id) {
                                void persistExtras(
                                    created.id,
                                    values.checklist,
                                    values.files,
                                );
                            }
                        },
                    )
                }
            />

            {/* Edit — every link is removable here; the tasks page owns none. */}
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
                    setEditingTaskId(null);
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
                onSubmit={(values: TaskFormValues) => {
                    if (!editingVm) return;
                    updateTask(
                        editingVm.id,
                        {
                            ...values,
                            links: values.links.map((link) => ({
                                type: link.type,
                                id: link.id,
                            })),
                        },
                        () => {
                            setEditingTaskId(null);
                            void persistExtras(
                                editingVm.id,
                                values.checklist,
                                values.files,
                            );
                        },
                    );
                }}
            />

            {/* Duplicate — pre-fills from the source task, saves as a new one. */}
            <TaskFormModal
                open={duplicatingVm !== null}
                mode="create"
                draftKey={TASK_FORM_DRAFT_KEYS.duplicate}
                onClose={() => {
                    if (isCreating) return;
                    clearCreateErrors();
                    setDuplicatingTaskId(null);
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
                onSubmit={(values: TaskFormValues) =>
                    createTask(
                        {
                            ...values,
                            links: values.links.map((link) => ({
                                type: link.type,
                                id: link.id,
                            })),
                        },
                        (created) => {
                            setDuplicatingTaskId(null);
                            if (created?.id) {
                                void persistExtras(
                                    created.id,
                                    values.checklist,
                                    values.files,
                                );
                            }
                        },
                    )
                }
            />

            {/* Shared filter workbench — same component Leads and Deals use,
                including its saved-views bar. */}
            <EntityFilterModal
                config={filterConfig}
                entityLabel="tasks"
                currentCount={pagedTableTasks.total}
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
                onClose={() => setDeleteTarget(null)}
                onDeleted={(taskId) => {
                    patchTasks((prev) => prev.filter((t) => t.id !== taskId));
                    setDeleteTarget(null);
                    setSelectedTaskId(null);
                }}
            />

            <ConfirmDialog
                open={confirmBulkDelete}
                title={`${td("Delete")} ${selected.size} ${
                    selected.size === 1 ? td("task") : td("tasks")
                }?`}
                message={td("This can't be undone.")}
                confirmLabel={td("Delete tasks")}
                cancelLabel={td("Cancel")}
                danger
                confirmLoading={bulkBusy}
                onConfirm={bulkDelete}
                onCancel={() => setConfirmBulkDelete(false)}
            />

            <BulkUpdateModal
                open={bulkUpdateOpen}
                onClose={(operationSucceeded) => {
                    setBulkUpdateOpen(false);
                    if (operationSucceeded) {
                        clearSelection();
                        router.reload({
                            only: [
                                "tableTasks",
                                "taskQuickCounts",
                                "stats",
                            ],
                            preserveState: true,
                            preserveScroll: true,
                        });
                    }
                }}
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
                    setTaskSettingsOpen(false);
                    router.reload({
                        only: ["categories"],
                        preserveState: true,
                        preserveScroll: true,
                    });
                }}
                footer={null}
                width={640}
                destroyOnClose
                maskClosable={false}
                styles={{ content: { boxShadow: "none" } }}
            >
                <TaskCategoryManager />
            </Modal>
        </PageLayout>
    );
}
