import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router } from "@inertiajs/react";
import { mergeQueryParams } from "@/lib/inertiaQuery";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import useIsAdminRole from "@/Hooks/useIsAdminRole";
import PageLayout from "@/Components/PageLayout";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import createTaskFilterConfig from "@/configs/taskFilterConfig";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import { useFilter } from "@/contexts/FilterContext";
import useTaskStatus from "@/Hooks/useTaskStatus";
import type { Task } from "@/Types/Task";
import type { TasksIndexProps } from "@/Pages/Tasks/Index";
import type { GroupMode, QuickFilterCounts, QuickFilterKey } from "./components/TasksFilterBar";
import TasksPagination from "./components/TasksPagination";
import TasksBulkBar from "./components/TasksBulkBar";
import TasksListView from "./components/TasksListView";
import TasksBoardView from "./components/TasksBoardView";
import TasksWorkspaceChrome from "./components/header/TasksWorkspaceChrome";
import TasksWorkspaceModals from "./components/workspace/TasksWorkspaceModals";
import { buildTaskRowActions } from "./components/list/buildTaskRowActions";
import useTasksFilters from "./hooks/useTasksFilters";
import useTasksViewNavigation from "./hooks/useTasksViewNavigation";
import useTasksUrlSync from "./hooks/useTasksUrlSync";
import useTasksWorkspaceMutations from "./hooks/useTasksWorkspaceMutations";
import useTasksServerPagination from "./hooks/useTasksServerPagination";
import usePersistedPageSize from "@/Hooks/usePersistedPageSize";
import useTasksWorkspaceUiState from "./hooks/useTasksWorkspaceUiState";
import useTaskExtras from "./hooks/useTaskExtras";
import useTaskSelection from "./hooks/useTaskSelection";
import useTasksBulkActions from "./hooks/useTasksBulkActions";
import buildTaskGroups from "./lib/buildTaskGroups";
import type { LeadSavedView as SavedView } from "@/Features/Filters/useLeadSavedViews";
import { parseTaskDateTime } from "@/lib/taskDateTime";
import { toTaskViewModel, type TaskViewModel } from "./adapters/taskViewModel";
import {
    asCommentDeleteScope,
    canAdd,
    canChangeStatus,
    canCommentOnTask,
    canEditTask,
    hasAnyDeletePermission,
} from "./adapters/taskPermissions";
import {
    formLinksPayload,
    toRecordPool,
    type TaskFormValues,
} from "./adapters/taskFormValues";
import {
    afterCreateTaskFormSubmit,
    afterUpdateTaskFormSubmit,
} from "./adapters/taskFormSubmitAdapter";
import { type DensityOption } from "./config/taskDesignTokens";

import "@/Components/Redesign/redesign.css";
import "./tasks-redesign.css";

export interface TasksWorkspaceRedesignProps extends TasksIndexProps {
    savedViews?: SavedView[];
}

const DENSITY: DensityOption = "comfortable";
const PRIORITY_TREATMENT: "stripe" | "pill" = "stripe";
const SHOW_ROW_CATEGORY = true;
const BOARD_CARD_META: "full" | "minimal" = "full";

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
    now,
    openTaskId,
    openTask,
    openMode,
    openCreate,
}: TasksWorkspaceRedesignProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const userId = auth.user.id;
    const isAdmin = useIsAdminRole();
    const canManageTaskCategories =
        isAdmin || permissions?.view_task_category === "all";

    const [boardTasks, setBoardTasks] = useState<Task[]>(kanbanTasks);
    const [listTasks, setListTasks] = useState<Task[]>(tableTasks?.data ?? []);
    const [taskSettingsOpen, setTaskSettingsOpen] = useState(false);
    const { view, setView } = useTasksViewNavigation();
    const [groupMode, setGroupMode] = useState<GroupMode>("due");
    const {
        addOpen,
        setAddOpen,
        editingTaskId,
        setEditingTaskId,
        duplicatingTaskId,
        setDuplicatingTaskId,
    } = useTasksWorkspaceUiState();
    const [addBoardColumnId, setAddBoardColumnId] = useState<number | null>(
        null,
    );
    const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Task | null>(null);
    const [refreshing, setRefreshing] = useState(false);

    const quickFilter = (
        (filters as { quick_filter?: string } | undefined)?.quick_filter ??
        "all"
    ) as QuickFilterKey;

    const patchTasks = useCallback((updater: (prev: Task[]) => Task[]) => {
        setBoardTasks(updater);
        setListTasks(updater);
    }, []);

    const { persistExtras } = useTaskExtras();
    const {
        selected,
        selectedIds,
        clearSelection: clearRowSelection,
        toggleSelect: toggleSelectRow,
        toggleGroupSelection: toggleGroupSelectionRows,
        allSelected,
    } = useTaskSelection();

    // "Select all N matching filters" — the bulk bar's own selection targets
    // only the currently-loaded page; this extends it to every row the
    // filters match, resolved server-side (see resolveBulkTaskIds()).
    const [selectAllMatching, setSelectAllMatching] = useState(false);
    const clearSelection = useCallback(() => {
        setSelectAllMatching(false);
        clearRowSelection();
    }, [clearRowSelection]);
    // Any manual row/group/page-level pick has to drop "all matching" first —
    // otherwise the bulk bar keeps showing (and acting on) the full matching
    // set while silently ignoring the checkbox the user just clicked.
    const toggleSelect = useCallback(
        (id: number) => {
            setSelectAllMatching(false);
            toggleSelectRow(id);
        },
        [toggleSelectRow],
    );
    const toggleGroupSelection = useCallback(
        (ids: number[], select: boolean) => {
            setSelectAllMatching(false);
            toggleGroupSelectionRows(ids, select);
        },
        [toggleGroupSelectionRows],
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

    const recordPool = useMemo(
        () => toRecordPool({ deals, leads, properties, developerProjects }),
        [deals, leads, properties, developerProjects],
    );

    const { activeCount } = useTasksFilters({
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
        [categories, labels, columns, users, projects, deals, leads, properties],
    );
    usePageSearchAndFilter({ filterConfig });
    const { openDrawer } = useFilter();

    // Due-date grouping compares each task's wall-clock due date against
    // this — using the browser's own `new Date()` put tasks in the wrong
    // today/overdue/upcoming bucket whenever the viewer's timezone doesn't
    // match the one due dates are already expressed in.
    const serverNow = useMemo(() => parseTaskDateTime(now) ?? new Date(), [now]);

    const boardViewModels = useMemo(
        () =>
            boardTasks.map((task) =>
                toTaskViewModel(task, completedSlugs, serverNow),
            ),
        [boardTasks, completedSlugs, serverNow],
    );
    const listViewModels = useMemo(
        () =>
            listTasks.map((task) =>
                toTaskViewModel(task, completedSlugs, serverNow),
            ),
        [listTasks, completedSlugs, serverNow],
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
        if (
            openTaskId &&
            openTask &&
            !byId.has(openTaskId)
        ) {
            byId.set(
                openTaskId,
                toTaskViewModel(openTask, completedSlugs),
            );
        }
        return byId;
    }, [boardViewModels, listViewModels, openTaskId, openTask, completedSlugs]);

    // /tasks/create, /tasks/{id} and /tasks/{id}/edit (TaskController::
    // create/show/edit, redesign flag on) all render this same page with
    // one of openCreate/openTaskId set instead of redirecting to a ?task=
    // query param or a standalone page, so the URL stays as typed. Open the
    // matching popup once on mount — if the task wasn't in the
    // default-filtered listing, the server already sent its data separately
    // as openTask. Afterwards popups are driven by clicks, not the URL —
    // see useTasksUrlSync for the other direction — so this only runs once.
    useEffect(() => {
        if (openCreate) {
            setAddOpen(true);
            return;
        }
        if (!openTaskId) return;
        if (!allViewModels.has(openTaskId) && openTask) {
            patchTasks((prev) =>
                prev.some((task) => task.id === openTask.id)
                    ? prev
                    : [openTask, ...prev],
            );
        }
        if (openMode === "edit") {
            setEditingTaskId(openTaskId);
        } else {
            setSelectedTaskId(openTaskId);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useTasksUrlSync({ view, addOpen, editingTaskId, selectedTaskId });

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

    // Result count changed, or the filters/search producing it did (even if
    // the count happens to coincidentally match) — either way the matching
    // set may no longer be what the user meant when they picked "all
    // matching", so drop it rather than silently carrying it over.
    useEffect(() => {
        setSelectAllMatching(false);
    }, [pagedTableTasks.total, filterSignature]);

    const filtersInitialized = useRef(false);

    useEffect(() => {
        if (!filtersInitialized.current) {
            filtersInitialized.current = true;
            return;
        }
        router.get(route("tasks.index"), mergeQueryParams({ page: 1 }), {
            only: [
                "tableTasks",
                "taskQuickCounts",
                "stats",
                "kanbanTasks",
                "filters",
                "now",
            ],
            preserveState: true,
            preserveScroll: true,
        });
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
                    "now",
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
                "now",
            ],
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

    const bulk = useTasksBulkActions({
        columns,
        categories,
        users,
        selected,
        selectedIds,
        selectAllMatching,
        matchingTotal: pagedTableTasks.total,
        filters: filters as Record<string, unknown> | undefined,
        patchTasks,
        clearSelection,
    });

    const allVisibleSelected = allSelected(listViewModels.map((vm) => vm.id));

    const submitCreate = (values: TaskFormValues, onDone: () => void) =>
        createTask(
            { ...values, links: formLinksPayload(values) },
            afterCreateTaskFormSubmit(values, persistExtras, onDone),
        );

    const submitUpdate = (taskId: number, values: TaskFormValues) =>
        updateTask(
            taskId,
            { ...values, links: formLinksPayload(values) },
            afterUpdateTaskFormSubmit(taskId, values, persistExtras, () =>
                setEditingTaskId(null),
            ),
        );

    const rowActions = (vm: TaskViewModel) =>
        buildTaskRowActions({
            vm,
            permissions,
            userId,
            onOpen: (item) => setSelectedTaskId(item.id),
            onToggleDone: toggleDone,
            onEdit: setEditingTaskId,
            onDuplicate: setDuplicatingTaskId,
            onDelete: setDeleteTarget,
        });

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
            <TasksWorkspaceChrome
                view={view}
                onViewChange={setView}
                onRefresh={handleRefresh}
                refreshing={refreshing}
                onAddTask={() => {
                    setAddBoardColumnId(null);
                    setAddOpen(true);
                }}
                canAddTask={canAdd(permissions?.add_tasks)}
                headline={headline}
                showTaskSettings={canManageTaskCategories}
                onOpenTaskSettings={() => setTaskSettingsOpen(true)}
                quickFilter={quickFilter}
                onQuickFilter={handleQuickFilter}
                counts={counts}
                groupMode={groupMode}
                onGroupMode={setGroupMode}
                activeFilterCount={activeCount}
                onOpenFilters={openDrawer}
                totalItems={pagedTableTasks.total}
            />

            <div
                className={`relative mx-auto w-full max-w-screen-2xl px-7 pt-[22px] ${
                    view === "board" ? "pb-4" : "pb-14"
                }`}
                style={
                    {
                        minHeight: view === "board" ? undefined : 320,
                        "--tasks-board-offset": "328px",
                    } as React.CSSProperties
                }
            >
                {view === "list" ? (
                    <>
                        <TasksBulkBar
                            count={
                                selectAllMatching
                                    ? pagedTableTasks.total
                                    : selected.size
                            }
                            matchingTotal={pagedTableTasks.total}
                            selectAllMatching={selectAllMatching}
                            onSelectAllMatching={() =>
                                setSelectAllMatching(true)
                            }
                            columns={columns}
                            users={users}
                            busy={bulk.bulkBusy}
                            canReassign={permissions?.edit_tasks === "all"}
                            canDelete={hasAnyDeletePermission(
                                permissions?.delete_tasks,
                            )}
                            canBulkUpdate={permissions?.edit_tasks === "all"}
                            allSelected={allVisibleSelected}
                            onToggleSelectAll={() =>
                                toggleGroupSelection(
                                    listViewModels.map((vm) => vm.id),
                                    !allVisibleSelected,
                                )
                            }
                            onSetStatus={bulk.bulkSetStatus}
                            onReassign={bulk.bulkReassign}
                            onBulkUpdate={() => bulk.setBulkUpdateOpen(true)}
                            onDelete={() => bulk.setConfirmBulkDelete(true)}
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
                                onToggleSelect={(vm) => toggleSelect(vm.id)}
                                onToggleGroup={(items, select) =>
                                    toggleGroupSelection(
                                        items.map((item) => item.id),
                                        select,
                                    )
                                }
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
                    <TasksBoardView
                        tasks={boardViewModels}
                        columns={columns}
                        cardMeta={BOARD_CARD_META}
                        canMove={(vm) =>
                            canChangeStatus(vm.task, permissions, userId)
                        }
                        onOpen={(vm) => setSelectedTaskId(vm.id)}
                        onMove={(vm, column) => setStatus(vm.id, column.slug)}
                        pageSize={pagedTableTasks.per_page}
                        rowActions={rowActions}
                        onAddToColumn={
                            canAdd(permissions?.add_tasks)
                                ? (column) => {
                                      setAddBoardColumnId(column.id);
                                      setAddOpen(true);
                                  }
                                : undefined
                        }
                    />
                )}
            </div>

            <TasksWorkspaceModals
                selectedVm={selectedVm}
                editingVm={editingVm}
                duplicatingVm={duplicatingVm}
                addOpen={addOpen}
                addBoardColumnId={addBoardColumnId}
                onCloseAdd={() => {
                    setAddOpen(false);
                    setAddBoardColumnId(null);
                }}
                onCloseEdit={() => setEditingTaskId(null)}
                onCloseDuplicate={() => setDuplicatingTaskId(null)}
                onCloseDetail={() => setSelectedTaskId(null)}
                onEditFromDetail={() => {
                    if (selectedVm) {
                        setSelectedTaskId(null);
                        setEditingTaskId(selectedVm.id);
                    }
                }}
                onToggleDone={() => {
                    if (selectedVm) toggleDone(selectedVm);
                }}
                canWriteSelected={
                    selectedVm
                        ? canChangeStatus(selectedVm.task, permissions, userId)
                        : false
                }
                canManageChecklist={
                    selectedVm
                        ? canEditTask(selectedVm.task, permissions, userId)
                        : false
                }
                canComment={
                    selectedVm
                        ? canCommentOnTask(selectedVm.task, permissions, userId)
                        : false
                }
                deleteCommentScope={asCommentDeleteScope(
                    permissions?.delete_task_comments,
                )}
                togglingSelected={
                    selectedVm ? isPending(selectedVm.id) : false
                }
                mentionablePeople={mentionablePeople ?? users}
                currentUser={{
                    id: userId,
                    name: auth.user.name,
                    image:
                        users.find((user) => user.id === userId)?.image ??
                        null,
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
                isCreating={isCreating}
                isUpdating={isUpdating}
                createErrors={createErrors}
                updateErrors={updateErrors}
                clearCreateErrors={clearCreateErrors}
                clearUpdateErrors={clearUpdateErrors}
                categories={categories}
                users={users}
                columns={columns}
                recordPool={recordPool}
                onCreate={(values) => {
                    const closing = addOpen
                        ? () => {
                              setAddOpen(false);
                              setAddBoardColumnId(null);
                          }
                        : () => setDuplicatingTaskId(null);
                    submitCreate(values, closing);
                }}
                onUpdate={submitUpdate}
                filterConfig={filterConfig}
                totalItems={pagedTableTasks.total}
                deleteTarget={deleteTarget}
                onCloseDelete={() => setDeleteTarget(null)}
                onDeleted={(taskId) => {
                    patchTasks((prev) => prev.filter((task) => task.id !== taskId));
                    setDeleteTarget(null);
                    setSelectedTaskId(null);
                }}
                confirmBulkDelete={bulk.confirmBulkDelete}
                selectedCount={
                    selectAllMatching ? pagedTableTasks.total : selected.size
                }
                bulkBusy={bulk.bulkBusy}
                onConfirmBulkDelete={bulk.bulkDelete}
                onCancelBulkDelete={() => bulk.setConfirmBulkDelete(false)}
                bulkUpdateOpen={bulk.bulkUpdateOpen}
                onCloseBulkUpdate={(operationSucceeded) => {
                    bulk.setBulkUpdateOpen(false);
                    if (operationSucceeded) {
                        clearSelection();
                        router.reload({
                            only: ["tableTasks", "taskQuickCounts", "stats"],
                        });
                    }
                }}
                bulkUpdateTarget={bulk.bulkUpdateTarget}
                bulkUpdateFields={bulk.bulkUpdateFields}
                taskSettingsOpen={taskSettingsOpen}
                onCloseTaskSettings={() => setTaskSettingsOpen(false)}
            />
        </PageLayout>
    );
}
