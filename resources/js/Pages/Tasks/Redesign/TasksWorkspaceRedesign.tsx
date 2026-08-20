import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import axios from "axios";
import { Modal } from "antd";
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
    type QuickFilterKey,
} from "./components/TasksFilterBar";
import ActiveFilterSentence from "@/Features/Filters/ActiveFilterSentence";
import TasksPagination from "./components/TasksPagination";
import TasksBulkBar from "./components/TasksBulkBar";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { useApiMutate } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import TasksListView, { type TaskGroup } from "./components/TasksListView";
import TasksBoardView from "./components/TasksBoardView";
import TaskDetailModal from "./components/TaskDetailModal";
import EntityFilterModal from "@/Features/Filters/EntityFilterModal";
import useTasksFilters, {
    appliedValues,
    hasFilter,
} from "./hooks/useTasksFilters";
import useTasksWorkspaceMutations from "./hooks/useTasksWorkspaceMutations";
import type { LeadSavedView as SavedView } from "@/Features/Filters/useLeadSavedViews";
import BulkUpdateModal from "@/Features/BulkActions/BulkUpdateModal";
import { createTaskBulkUpdateFields } from "./config/taskBulkUpdateFields";
import type { BulkTarget } from "@/Features/BulkActions/bulkTarget";
import { toTaskViewModel, type TaskViewModel } from "./adapters/taskViewModel";
import {
    TASK_BUCKETS,
    TASK_PRIORITY,
    categoryToken,
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
        ...(task.project
            ? [
                  {
                      type: "project" as const,
                      id: task.project.id,
                      name: task.project.project_name,
                  },
              ]
            : []),
    ];
}

/** Whether the current user may move/complete this task (change_status scope). */
function canChangeStatus(
    task: Task,
    permissions: TasksIndexProps["permissions"],
    userId: number,
): boolean {
    const scope = permissions?.change_status ?? permissions?.edit_tasks;
    if (scope === "all") return true;
    const isAssignee = task.users?.some((user) => user.id === userId) ?? false;
    const isCreator = task.added_by === userId;
    if (scope === "added") return isCreator;
    if (scope === "owned") return isAssignee;
    if (scope === "both") return isCreator || isAssignee;
    return true;
}

export default function TasksWorkspaceRedesign({
    kanbanTasks = [],
    categories = [],
    labels = [],
    users = [],
    columns = [],
    projects = [],
    deals = [],
    leads = [],
    properties = [],
    developerProjects = [],
    permissions,
    stats,
    savedViews = [],
    filters,
    auth,
}: TasksWorkspaceRedesignProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const userId = auth.user.id;
    const isAdmin = useIsAdminRole();
    const canManageTaskCategories =
        isAdmin || permissions?.view_task_category === "all";

    const [tasks, setTasks] = useState<Task[]>(kanbanTasks);
    const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
    const [view, setView] = useState<TasksViewMode>("list");
    const [quickFilter, setQuickFilter] = useState<QuickFilterKey>("all");
    const [groupMode, setGroupMode] = useState<GroupMode>("due");
    const [addOpen, setAddOpen] = useState(false);
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(15);
    const [selected, setSelected] = useState<Set<number>>(() => new Set());
    const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

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
        setTasks((prev) =>
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

    const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
    const {
        createTask,
        isCreating,
        createErrors,
        clearCreateErrors,
        updateTask,
        isUpdating,
        updateErrors,
        clearUpdateErrors,
    } = useTasksWorkspaceMutations(setTasks, editingTaskId);

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
            }
        }

        if (checklist.length || files.length) {
            router.reload({ only: ["kanbanTasks", "tableTasks", "stats"] });
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
    const viewModels = useMemo(
        () => tasks.map((task) => toTaskViewModel(task, completedSlugs)),
        [tasks, completedSlugs],
    );

    const counts = useMemo(
        () => ({
            all: viewModels.length,
            mine: viewModels.filter((vm) =>
                vm.task.users?.some((user) => user.id === userId),
            ).length,
            byme: viewModels.filter((vm) => vm.task.added_by === userId).length,
            open: viewModels.filter((vm) => !vm.done).length,
            today: viewModels.filter((vm) => vm.bucket === "today").length,
            overdue: viewModels.filter((vm) => vm.bucket === "overdue").length,
        }),
        [viewModels, userId],
    );

    const visible = useMemo(() => {
        switch (quickFilter) {
            case "mine":
                return viewModels.filter((vm) =>
                    vm.task.users?.some((user) => user.id === userId),
                );
            case "byme":
                return viewModels.filter((vm) => vm.task.added_by === userId);
            case "open":
                return viewModels.filter((vm) => !vm.done);
            case "today":
                return viewModels.filter((vm) => vm.bucket === "today");
            case "overdue":
                return viewModels.filter((vm) => vm.bucket === "overdue");
            default:
                return viewModels;
        }
    }, [viewModels, quickFilter, userId]);

    // Group the whole filtered set first, so group order and totals are
    // stable, then page across the grouped sequence.
    const allGroups: TaskGroup[] = useMemo(() => {
        if (groupMode === "due") {
            return TASK_BUCKETS.map((bucket) => ({
                key: bucket.key,
                label: bucket.label,
                dot: bucket.dot,
                fg: bucket.fg,
                tasks: visible.filter((vm) => vm.bucket === bucket.key),
            })).filter((group) => group.tasks.length > 0);
        }

        if (groupMode === "category") {
            const byCategory = new Map<string, TaskGroup>();
            visible.forEach((vm) => {
                const name = vm.task.category?.category_name ?? "Uncategorised";
                // `name` always a real string ("Uncategorised" as the
                // fallback), so categoryToken never returns its "no name" null.
                const token = categoryToken(name)!;
                if (!byCategory.has(name)) {
                    byCategory.set(name, {
                        key: `category-${name}`,
                        label: token.label,
                        dot: token.dot,
                        fg: token.fg,
                        tasks: [],
                    });
                }
                byCategory.get(name)!.tasks.push(vm);
            });
            return Array.from(byCategory.values()).sort(
                (a, b) => b.tasks.length - a.tasks.length,
            );
        }

        return visible.length
            ? [
                  {
                      key: "all",
                      label: "All tasks",
                      dot: "#9ca3af",
                      fg: "#5b6472",
                      tasks: visible,
                  },
              ]
            : [];
    }, [visible, groupMode]);

    const totalPages = Math.max(1, Math.ceil(visible.length / pageSize));
    const currentPage = Math.min(page, totalPages);

    /**
     * Walks the grouped sequence and keeps only the slice belonging to this
     * page. A group that straddles a page boundary appears on both, each time
     * showing just its rows for that page — while its header keeps the group's
     * full total so the counts stay truthful.
     */
    const groups: TaskGroup[] = useMemo(() => {
        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const out: TaskGroup[] = [];
        let cursor = 0;

        allGroups.forEach((group) => {
            const groupStart = cursor;
            const groupEnd = cursor + group.tasks.length;
            cursor = groupEnd;

            if (groupEnd <= start || groupStart >= end) return;
            const from = Math.max(0, start - groupStart);
            const to = Math.min(group.tasks.length, end - groupStart);
            out.push({
                ...group,
                totalCount: group.tasks.length,
                tasks: group.tasks.slice(from, to),
            });
        });

        return out;
    }, [allGroups, currentPage, pageSize]);

    const selectedVm =
        visible.find((vm) => vm.id === selectedTaskId) ??
        viewModels.find((vm) => vm.id === selectedTaskId) ??
        null;

    const editingVm = viewModels.find((vm) => vm.id === editingTaskId) ?? null;

    const headline = `${counts.overdue} ${td("overdue")} · ${counts.today} ${td("due today")} · ${counts.open} ${td("open across your records")}`;

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

    // Re-seed the local task list whenever the server sends a new page.
    useEffect(() => {
        setTasks(kanbanTasks);
    }, [kanbanTasks]);

    const handleRefresh = () => {
        setRefreshing(true);
        router.reload({
            only: ["kanbanTasks", "tableTasks", "stats", "savedViews"],
            onSuccess: (page) => {
                const next = (page.props as { kanbanTasks?: Task[] })
                    .kanbanTasks;
                if (next) setTasks(next);
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
        visible.length > 0 && visible.every((vm) => selected.has(vm.id));

    const bulkSetStatus = (column: (typeof columns)[number]) =>
        applyBulkAction(
            {
                row_ids: selectedIds.join(","),
                action_type: "change-status",
                status: column.id,
            },
            {
                onSuccess: () => {
                    setTasks((prev) =>
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
                    setTasks((prev) =>
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
                    setTasks((prev) =>
                        prev.filter((task) => !selected.has(task.id)),
                    );
                    setConfirmBulkDelete(false);
                    clearSelection();
                },
            },
        );

    const rowActions = (vm: TaskViewModel) => {
        const actions = [
            {
                key: "open",
                label: "View details",
                onSelect: () => setSelectedTaskId(vm.id),
            },
        ];
        if (canChangeStatus(vm.task, permissions, userId)) {
            // Completion moved here when the row checkbox became a bulk selector.
            actions.push({
                key: "toggle-done",
                label: vm.done ? "Reopen task" : "Mark done",
                onSelect: () => toggleDone(vm),
            });
            actions.push({
                key: "edit",
                label: "Edit task",
                onSelect: () => setEditingTaskId(vm.id),
            });
            actions.push({
                key: "duplicate",
                label: "Duplicate",
                onSelect: () =>
                    router.visit(
                        route("tasks.create", { duplicate_task: vm.id }),
                    ),
            });
        }
        if (permissions?.delete_tasks === "all") {
            actions.push({
                key: "delete",
                label: "Delete",
                danger: true,
                onSelect: () => setDeleteTarget(vm.task),
            } as (typeof actions)[number]);
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
                        onQuickFilter={(key) => {
                            setQuickFilter(key);
                            setPage(1);
                        }}
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
                            count={visible.length}
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
                        background: "#f5f6f8",
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
                            canDelete={permissions?.delete_tasks === "all"}
                            canBulkUpdate={permissions?.edit_tasks === "all"}
                            allSelected={allVisibleSelected}
                            onToggleSelectAll={() =>
                                toggleGroupSelection(
                                    visible,
                                    !allVisibleSelected,
                                )
                            }
                            onSetStatus={bulkSetStatus}
                            onReassign={bulkReassign}
                            onBulkUpdate={() => setBulkUpdateOpen(true)}
                            onDelete={() => setConfirmBulkDelete(true)}
                            onClear={clearSelection}
                        />
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
                            page={currentPage}
                            pageSize={pageSize}
                            totalItems={visible.length}
                            onPageChange={setPage}
                            onPageSizeChange={(size) => {
                                setPageSize(size);
                                setPage(1);
                            }}
                        />
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
                            tasks={visible}
                            columns={columns}
                            cardMeta={BOARD_CARD_META}
                            canMove={(vm) =>
                                canChangeStatus(vm.task, permissions, userId)
                            }
                            onOpen={(vm) => setSelectedTaskId(vm.id)}
                            onMove={(vm, column) =>
                                setStatus(vm.id, column.slug)
                            }
                            pageSize={pageSize}
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
                toggling={selectedVm ? isPending(selectedVm.id) : false}
                people={users}
                currentUser={{
                    id: userId,
                    name: auth.user.name,
                    image:
                        users.find((user) => user.id === userId)?.image ?? null,
                }}
            />

            {/* Create */}
            <TaskFormModal
                open={addOpen}
                mode="create"
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
                    editingVm
                        ? {
                              title: editingVm.task.heading,
                              description: editingVm.descriptionText,
                              startDate:
                                  editingVm.task.start_date?.slice(0, 10) ?? "",
                              dueDate:
                                  editingVm.task.due_date?.slice(0, 10) ?? "",
                              dueTime:
                                  editingVm.task.due_date?.slice(11, 16) ||
                                  "17:00",
                              priority: editingVm.task
                                  .priority as TaskPriorityKey,
                              assignees: editingVm.people.map((p) => p.id),
                              categoryId: editingVm.task.category?.id ?? null,
                              boardColumnId:
                                  editingVm.task.board_column_id ?? null,
                              links: taskLinkRefs(editingVm),
                          }
                        : undefined
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

            {/* Shared filter workbench — same component Leads and Deals use,
                including its saved-views bar. */}
            <EntityFilterModal
                config={filterConfig}
                entityLabel="tasks"
                currentCount={visible.length}
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
                    setTasks((prev) => prev.filter((t) => t.id !== taskId));
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
                    if (operationSucceeded) clearSelection();
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
                onCancel={() => setTaskSettingsOpen(false)}
                footer={null}
                width={640}
                destroyOnClose
                styles={{ content: { boxShadow: "none" } }}
            >
                <TaskCategoryManager />
            </Modal>
        </PageLayout>
    );
}
