import React, { useState, useMemo } from "react";
import { Button, Space, Typography, Row, Col, Drawer, Pagination } from "antd";
import {
    PlusOutlined,
    AppstoreOutlined,
    ReloadOutlined,
    FilterOutlined,
    UnorderedListOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";

import { TasksStats } from "@/Features/Tasks/Components/TasksStats";

import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import BulkTaskActionSelector from "@/Features/Tasks/BulkActions/BulkTaskActionSelector";
import PageLayout from "@/Components/PageLayout";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";

import usePageSort from "@/Hooks/usePageSort";
import useViewPreference from "@/Hooks/useViewPreference";

import { router } from "@inertiajs/react";

import createTaskFilterConfig from "@/configs/taskFilterConfig";
import usePageSearchAndFilter from "@/Hooks/usePageSearchAndFilter";
import UniversalSearchBox from "@/Components/UniversalSearchBox";
import ContextualActiveFilters from "@/Components/ContextualActiveFilters";
import usePageRefresh from "@/Hooks/usePageRefresh";
import UniversalFilterDrawer from "@/Components/UniversalFilterDrawer";
import TaskListView from "@/Features/Tasks/Components/TaskListView";
import { taskApi } from "@/lib/api/tasks";
import { Task } from "@/Types/Task";
import { SaveTaskModal, TaskDetailsDrawer } from "@/Features/Tasks/SaveTask";
import TasksKanban from "@/Features/Tasks/Components/TasksKanban";

dayjs.extend(isBetween);

const { Text, Title } = Typography;

// Deprecated task interface - use @/Types/Task
// interface Task { ... }

interface TaskCategory {
    id: number;
    project_name: string;
    project_short_code?: string;
}
// category?: {
//     id: number;
//     category_name: string;
// };
//     users?: Array<{
//         id: number;
//         name: string;
//         image?: string;
//     }>;
//     labels?: Array<{
//         id: number;
//         label_name: string;
//         label_color: string;
//     }>;
//     files_count?: number;
//     notes_count?: number;
//     comments_count?: number;
//     subtasks_count?: number;
//     completed_subtasks_count?: number;
//     created_at: string;
//     updated_at: string;
//     estimate_hours?: number;
//     estimate_minutes?: number;
//     is_private?: boolean;
//     billable?: boolean;
//     added_by?: number;
// }

interface TaskCategory {
    id: number;
    category_name: string;
}

interface TaskLabel {
    id: number;
    label_name: string;
    label_color: string;
}

interface TaskboardColumn {
    id: number;
    column_name: string;
    slug: string;
    label_color: string;
    priority: number;
}

interface User {
    id: number;
    name: string;
    image?: string;
    designation_name?: string;
}

interface Project {
    id: number;
    project_name: string;
    project_short_code: string;
}

interface Deal {
    id: number;
    name: string;
}

interface Lead {
    id: number;
    client_name: string;
    company_name?: string;
}

interface Property {
    id: number;
    name: string;
}

export interface TasksIndexProps extends PageProps {
    tableTasks: {
        data: Task[];
        current_page: number;
        total: number;
        per_page: number;
        last_page: number;
    };
    kanbanTasks: Task[];
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];
    deals: Deal[];
    leads: Lead[];
    properties: Property[];

    permissions: {
        add_tasks: string;
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string; // 'all' | 'added' | 'owned' | 'both'
    };
    stats: {
        total: number;
        completed: number;
        overdue: number;
        dueToday: number;
    };
}

const TasksIndex = ({
    tableTasks,
    kanbanTasks = [],
    categories = [],
    labels = [],
    columns = [],
    users = [],
    projects = [],
    deals = [],
    leads = [],
    properties = [],
    permissions = {
        add_tasks: "all",
        edit_tasks: "all",
        delete_tasks: "all",
        view_tasks: "all",
    },
    stats = {
        total: 0,
        completed: 0,
        overdue: 0,
        dueToday: 0,
    },
    auth,
}: TasksIndexProps) => {
    // Generic entity action hook for modals and actions
    const {
        action,
        selected: selectedTask,
        handleAction,
        handleClose: closeAction,
    } = useGenericEntityAction<Task>();
    const handleClose = () => {
        closeAction();
        router.reload();
    };

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Task>();

    // Memoize configs to prevent unnecessary re-renders and filter resets
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

    // Filter and sort handlers
    // Setup search and filter contexts
    const { filter } = usePageSearchAndFilter({
        filterConfig,
    });

    const { openDrawer, filters } = filter;

    // Sort handlers
    const { sortParams } = usePageSort({ routeName: "tasks.index" });

    // Use server-filtered tasks directly
    const filteredTableTasks = tableTasks?.data || [];
    const filteredKanbanTasks = kanbanTasks || [];

    // Handlers using useGenericEntityAction
    const handleCreateTask = () => {
        handleAction("add");
    };

    const handleEditTask = (task: Task) => {
        handleAction("edit", task);
    };

    const handleViewTask = (task: Task) => {
        handleAction("view", task);
    };

    const handleDuplicateTask = (task: Task) => {
        // Use the SaveTaskModal with isDuplicate flag
        handleAction("duplicate", task);
    };

    const handleDeleteTask = (task: Task) => {
        handleAction("delete", task);
    };

    // Task status change handler for Kanban (Updated to new API)
    const { mutate: updateTaskStatus } = taskApi.useUpdateStatus();

    const handleStatusChange = (
        taskId: number,
        newStatus: string,
        newColumnId: number,
    ) => {
        // Optimistic update logic should be in React Query cache config,
        // but here we trigger the mutation
        updateTaskStatus(
            {
                taskId: taskId,
                status: newStatus,
            },
            {
                onSuccess: () => {
                    router.reload({
                        only: ["tableTasks", "kanbanTasks", "stats"],
                    });
                    // Optionally show a success message or refresh
                },
            },
        );
    };

    // Bulk Actions Handler
    const { mutate: bulkAction } = taskApi.useBulkAction();
    const handleBulkAction = (action: "delete" | "status") => {
        if (action === "delete") {
            // Confirm delete logic?
            bulkAction(
                {
                    action: "delete",
                    ids: selectedEntities.map((t) => t.id),
                },
                {
                    onSuccess: () => clearSelected(),
                },
            );
        }
    };

    // View mode state: table or kanban (persisted in localStorage)
    const { view, setView, isKanbanView, isTableView } = useViewPreference({
        storageKey: "tasks",
        defaultView: "table",
    });

    console.log(tableTasks, "TABLE COTNET");

    // ── Page-level refresh ──────────────────────────────────────────
    const { refresh, isRefreshing } = usePageRefresh();

    return (
        <>
            <PageLayout
                title="Tasks"
                breadcrumbs={[{ name: "Tasks" }]}
                searchComp={
                    <UniversalSearchBox
                        placeholder="Search by title ..."
                        className="w-full"
                    />
                }
                filterSection={<ContextualActiveFilters />}
            >
                <div className="max-w-7xl mx-auto">
                    {/* Header */}
                    <Row
                        justify="space-between"
                        align="middle"
                        style={{ marginBottom: 24 }}
                    >
                        <Col>
                            <Space direction="vertical" size={0}>
                                <Title level={2} style={{ margin: 0 }}>
                                    Tasks
                                </Title>
                                <Text type="secondary">
                                    Manage and track tasks
                                </Text>
                            </Space>
                        </Col>
                        <Col>
                            <Space>
                                {/* View Toggle */}
                                <div className="flex bg-gray-100 rounded-md p-1">
                                    <Button
                                        type="text"
                                        icon={<AppstoreOutlined />}
                                        size="small"
                                        className={
                                            isKanbanView
                                                ? "!bg-white !shadow-sm"
                                                : "hover:bg-white hover:shadow-sm"
                                        }
                                        title="Kanban Board"
                                        onClick={() => setView("kanban")}
                                    />

                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<UnorderedListOutlined />}
                                        className={
                                            isTableView
                                                ? "!bg-white !shadow-sm"
                                                : "hover:bg-white hover:shadow-sm"
                                        }
                                        title="List View"
                                        onClick={() => setView("table")}
                                    />
                                </div>
                                {/* filter */}
                                <div className="flex  items-center gap-x-2">
                                    <Button
                                        icon={<FilterOutlined />}
                                        onClick={openDrawer}
                                    >
                                        Filters
                                    </Button>
                                </div>
                                <Button
                                    icon={
                                        <ReloadOutlined spin={isRefreshing} />
                                    }
                                    onClick={refresh}
                                    disabled={isRefreshing}
                                    type="text"
                                >
                                    Refresh
                                </Button>

                                {/* 
                            
                                <Button icon={<ImportOutlined />}>
                                    Import
                                </Button> */}
                                {permissions.add_tasks && (
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        onClick={handleCreateTask}
                                    >
                                        Create Task
                                    </Button>
                                )}
                            </Space>
                        </Col>
                    </Row>

                    {/* Stats */}
                    <TasksStats stats={stats} />
                    <div className="flex items-center gap-3 mb-4 justify-end">
                        {/* Bulk Actions - Only show when items are selected */}
                        {selectedEntities.length > 0 && (
                            <BulkTaskActionSelector
                                selectedEntityIds={selectedEntities.map(
                                    (entity) => entity.id as number,
                                )}
                                columns={columns}
                                clearSelected={clearSelected}
                            />
                        )}
                    </div>

                    <div>
                        {/* TODO : Refactor to have server size pagination/changes */}
                        {/* Table or Kanban View */}
                        {isTableView ? (
                            <div className="space-y-4">
                                <TaskListView
                                    tasks={filteredTableTasks}
                                    columns={columns}
                                    selectedIds={selectedEntities.map(
                                        (t) => t.id,
                                    )}
                                    onSelectionChange={(ids, tasks) =>
                                        rowSelection.onChange(ids, tasks)
                                    }
                                    onEdit={handleEditTask}
                                    onView={handleViewTask}
                                    onDelete={handleDeleteTask}
                                    onDuplicate={handleDuplicateTask}
                                    onStatusChange={(
                                        task,
                                        newStatus,
                                        newColumnId,
                                    ) =>
                                        handleStatusChange(
                                            task.id,
                                            newStatus,
                                            newColumnId,
                                        )
                                    }
                                />
                                <div className="flex justify-end">
                                    <Pagination
                                        total={tableTasks?.total || 0}
                                        current={tableTasks?.current_page || 1}
                                        pageSize={
                                            filters.per_page ||
                                            tableTasks?.per_page ||
                                            50
                                        }
                                        size="small"
                                        showTotal={(total, range) =>
                                            `${range[0]}-${range[1]} of ${total} items`
                                        }
                                        onChange={(page, pageSize) => {
                                            router.get(
                                                route("tasks.index"),
                                                {
                                                    ...filters,
                                                    ...sortParams,
                                                    page,
                                                    per_page: pageSize,
                                                },
                                                {
                                                    preserveState: true,
                                                    preserveScroll: true,
                                                },
                                            );
                                        }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <TasksKanban
                                tasks={filteredKanbanTasks}
                                columns={columns}
                                permissions={permissions}
                                userId={auth.user.id}
                                onEdit={handleEditTask}
                                onView={handleViewTask}
                                onDuplicate={handleDuplicateTask}
                                onDelete={handleDeleteTask}
                                onStatusChange={handleStatusChange}
                            />
                        )}
                    </div>

                    {/* Save Task Modal - handles both create and edit */}
                    <SaveTaskModal
                        key="add"
                        open={action === "add"}
                        isDuplicate={false}
                        onClose={handleClose}
                        categories={categories}
                        labels={labels}
                        columns={columns}
                        users={users}
                        projects={projects}
                        deals={deals}
                        leads={leads}
                        properties={properties}
                    />
                    <SaveTaskModal
                        key="edit"
                        open={action === "edit"}
                        task={selectedTask}
                        isDuplicate={false}
                        onClose={handleClose}
                        categories={categories}
                        labels={labels}
                        columns={columns}
                        users={users}
                        projects={projects}
                        deals={deals}
                        leads={leads}
                        properties={properties}
                    />
                    <SaveTaskModal
                        key="duplicate"
                        open={action === "duplicate"}
                        task={selectedTask}
                        isDuplicate={true}
                        onClose={handleClose}
                        categories={categories}
                        labels={labels}
                        columns={columns}
                        users={users}
                        projects={projects}
                        deals={deals}
                        leads={leads}
                        properties={properties}
                    />

                    {/* Task Details Drawer */}
                    <Drawer
                        title={`Task: ${selectedTask?.heading || ""}`}
                        placement="right"
                        size="large"
                        open={action === "view"}
                        onClose={() => handleClose()}
                        destroyOnHidden
                    >
                        <TaskDetailsDrawer
                            task={selectedTask}
                            loading={false}
                        />
                    </Drawer>

                    {/* Delete Task Modal */}
                    <DeleteTask
                        open={action === "delete"}
                        task={selectedTask}
                        onClose={() => handleClose()}
                    />
                </div>
            </PageLayout>

            {/* Filter Drawer */}
            <UniversalFilterDrawer config={filterConfig} />
        </>
    );
};

TasksIndex.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default TasksIndex;
