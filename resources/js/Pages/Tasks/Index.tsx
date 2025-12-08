import React, { useState, useMemo } from "react";
import { Card, Table, Button, Space, Typography, Row, Col, Drawer } from "antd";
import {
    PlusOutlined,
    TableOutlined,
    AppstoreOutlined,
    ReloadOutlined,
    ExportOutlined,
    ImportOutlined,
    FilterOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import DashboardLayout, { PageProps } from "@/Components/DashboardLayout";
import { useTasksTableColumns } from "@/Features/Tasks/Columns";
import { TasksStats } from "@/Features/Tasks/Components/TasksStats";
import { SaveTaskModal, TaskDetailsDrawer } from "@/Features/Tasks/SaveTask";
import DeleteTask from "@/Features/Tasks/Components/DeleteTask";
import BulkTaskActionSelector from "@/Features/Tasks/BulkActions/BulkTaskActionSelector";
import PageLayout from "@/Components/PageLayout";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import useGenericTableRowSelection from "@/Hooks/useGenericTableRowSelection";
import usePageFilter from "@/Hooks/usePageFilter";
import usePageSort from "@/Hooks/usePageSort";
import FilterDrawer from "@/Components/FilterDrawer";
import ActiveFilters from "@/Components/ActiveFilters";
import BasicTaskFilterBox from "@/Features/Tasks/Filter/BasicTaskFilterBox";
import AdvancedTaskFilterForm from "@/Features/Tasks/Filter/AdvancedTaskFilterForm";
import { router } from "@inertiajs/react";

import TasksKanban from "@/Features/Tasks/Components/TasksKanban";
import { useApiMutate } from "@/lib/api/client/useApiMutate";

dayjs.extend(isBetween);

const { Text, Title } = Typography;

// Types based on Laravel Task model
interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high";
    status: string;
    board_column_id?: number;
    completed_on?: string;
    project?: {
        id: number;
        project_name: string;
        project_short_code?: string;
    };
    category?: {
        id: number;
        category_name: string;
    };
    users?: Array<{
        id: number;
        name: string;
        image?: string;
    }>;
    labels?: Array<{
        id: number;
        label_name: string;
        label_color: string;
    }>;
    files_count?: number;
    notes_count?: number;
    comments_count?: number;
    subtasks_count?: number;
    completed_subtasks_count?: number;
    created_at: string;
    updated_at: string;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    added_by?: number;
}

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

export interface TasksIndexProps extends PageProps {
    tasks: Task[];
    categories: TaskCategory[];
    labels: TaskLabel[];
    columns: TaskboardColumn[];
    users: User[];
    projects: Project[];

    permissions: {
        add_tasks: string;
        edit_tasks: string;
        delete_tasks: string;
        view_tasks: string; // 'all' | 'added' | 'owned' | 'both'
    };
}

const TasksIndex: React.FC<TasksIndexProps> = ({
    tasks: initialTasks = [],
    categories = [],
    labels = [],
    columns = [],
    users = [],
    projects = [],
    permissions = {
        add_tasks: "all",
        edit_tasks: "all",
        delete_tasks: "all",
        view_tasks: "all",
    },
    auth,
}) => {
    console.log("Tasks:", initialTasks);

    // Generic entity action hook for modals and actions
    const {
        action,
        selected: selectedTask,
        handleAction,
        handleClose,
    } = useGenericEntityAction<Task>();

    // Table row selection
    const { selectedEntities, rowSelection, clearSelected } =
        useGenericTableRowSelection<Task>();

    // Filter and sort handlers
    const {
        filters = {},
        drawerOpen,
        openFilterDrawer,
        closeFilterDrawer,
        handleQuickFilter,
        removeFilter,
        handleResetQuickFilters,
        handleResetFilters,
        handleFilterSubmit,
        clearAllFilters,
    } = usePageFilter({ handleClose, routeName: "tasks.index" });

    // Sort handlers
    const { sortParams } = usePageSort({ routeName: "tasks.index" });

    // State
    const [tasks, setTasks] = useState<Task[]>(initialTasks);
    const [viewMode, setViewMode] = useState<"list" | "grid">("list");

    // Use server-filtered tasks directly
    const filteredTasks = tasks;

    // Statistics
    const stats = useMemo(() => {
        const total = filteredTasks.length;
        const completed = filteredTasks.filter(
            (task) => task.status === "completed"
        ).length;
        const overdue = filteredTasks.filter(
            (task) =>
                task.due_date &&
                dayjs(task.due_date).isBefore(dayjs()) &&
                task.status !== "completed"
        ).length;
        const dueToday = filteredTasks.filter(
            (task) =>
                task.due_date && dayjs(task.due_date).isSame(dayjs(), "day")
        ).length;

        return { total, completed, overdue, dueToday };
    }, [filteredTasks]);

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

    // Task list update handler for successful operations
    const updateTasksList = (
        updatedTask: Task,
        operation: "create" | "update" | "delete"
    ) => {
        setTasks((prevTasks) => {
            switch (operation) {
                case "create":
                    return [...prevTasks, updatedTask];
                case "update":
                    return prevTasks.map((task) =>
                        task.id === updatedTask.id ? updatedTask : task
                    );
                case "delete":
                    return prevTasks.filter(
                        (task) => task.id !== updatedTask.id
                    );
                default:
                    return prevTasks;
            }
        });
        handleClose();
    };
    // Task status change handler for Kanban
    const { mutate: updateTaskStatus } = useApiMutate(
        route("tasks.change_status"),
        "POST"
    );

    const handleStatusChange = (
        taskId: number,
        newStatus: string,
        newColumnId: number
    ) => {
        // Optimistically update the UI
        setTasks((prevTasks) =>
            prevTasks.map((task) =>
                task.id === taskId
                    ? {
                          ...task,
                          status: newStatus,
                          board_column_id: newColumnId,
                      }
                    : task
            )
        );

        updateTaskStatus({
            taskId: taskId,
            status: newStatus,
            boardColumnId: newColumnId,
        });
    };

    // Enhanced row selection with permissions check
    const enhancedRowSelection = {
        ...rowSelection,
        getCheckboxProps: (record: Task) => {
            const userId = auth.user.id;
            const canEdit =
                permissions.edit_tasks === "all" ||
                (permissions.edit_tasks === "added" &&
                    record.added_by === userId) ||
                (permissions.edit_tasks === "owned" &&
                    record.users?.some((u) => u.id === userId)) ||
                (permissions.edit_tasks === "both" &&
                    (record.added_by === userId ||
                        record.users?.some((u) => u.id === userId)));

            const canDelete =
                permissions.delete_tasks === "all" ||
                (permissions.delete_tasks === "added" &&
                    record.added_by === userId) ||
                (permissions.delete_tasks === "owned" &&
                    record.users?.some((u) => u.id === userId)) ||
                (permissions.delete_tasks === "both" &&
                    (record.added_by === userId ||
                        record.users?.some((u) => u.id === userId)));

            return {
                disabled: !canEdit && !canDelete,
            };
        },
    };

    // Table columns using the hook
    const tableColumns = useTasksTableColumns({
        columns,
        permissions,
        onEdit: handleEditTask,
        onView: handleViewTask,
        onDuplicate: handleDuplicateTask,
        onDelete: handleDeleteTask,
    });

    const [view, setView] = useState<"kanban" | "table">("table");

    const isKanbanView = view === "kanban";
    const isTableView = view === "table";

    return (
        <DashboardLayout>
            <PageLayout
                title="Tasks"
                breadcrumbs={[{ name: "Tasks" }]}
                filterSection={
                    <>
                        {/* <BasicTaskFilterBox
                            filters={filters}
                            handleResetFilters={handleResetFilters}
                            handleQuickFilter={handleQuickFilter}
                            handleResetQuickFilters={handleResetQuickFilters}
                            handleSubmit={handleFilterSubmit}
                            categories={categories}
                            columns={columns}
                            users={users}
                            projects={projects}
                        /> */}
                        {/* Active Filters */}
                        <ActiveFilters
                            filters={filters}
                            onRemoveFilter={removeFilter}
                            onClearAll={clearAllFilters}
                        />
                    </>
                }
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
                                {/* <Button
                                    icon={<ReloadOutlined />}
                                    onClick={() => router.reload()}
                                >
                                    Refresh
                                </Button>
                            
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
                        {/* Filters */}

                        {/* View Toggle */}
                        {/* <div className="flex items-center gap-2">
                            <div className="flex bg-gray-100 rounded-md p-1">
                                <Button
                                    type="text"
                                    icon={<AppstoreOutlined />}
                                    size="small"
                                    className={`${isKanbanView
                                        ? "!bg-white !shadow-sm"
                                        : "hover:bg-white hover:shadow-sm"
                                        }`}
                                    title="Kanban Board"
                                    onClick={() => setView("kanban")}
                                />

                                <Button
                                    type="text"
                                    size="small"
                                    icon={<TableOutlined />}
                                    className={`${isTableView
                                        ? "!bg-white !shadow-sm"
                                        : "hover:bg-white hover:shadow-sm"
                                        }`}
                                    title="Table View"
                                    onClick={() => setView("table")}
                                />
                            </div>
                        </div> */}
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
                                icon={<TableOutlined />}
                                className={
                                    isTableView
                                        ? "!bg-white !shadow-sm"
                                        : "hover:bg-white hover:shadow-sm"
                                }
                                title="Table View"
                                onClick={() => setView("table")}
                            />
                        </div>

                        <div className="flex  items-center gap-x-2">
                            <Button
                                icon={<FilterOutlined />}
                                onClick={openFilterDrawer}
                            >
                                Filters
                            </Button>
                        </div>

                        {/* Bulk Actions - Only show when items are selected */}
                        {selectedEntities.length > 0 && (
                            <BulkTaskActionSelector
                                selectedEntityIds={selectedEntities.map(
                                    (entity) => entity.id as number
                                )}
                                columns={columns}
                                clearSelected={clearSelected}
                            />
                        )}
                    </div>

                    <Card>
                        <div className="flex justify-end gap-x-2 items-center mb-2">
                            <div className="flex items-center gap-2"></div>
                        </div>

                        {/* Table or Kanban View */}
                        {isTableView ? (
                            <Table
                                rowSelection={enhancedRowSelection}
                                columns={tableColumns}
                                dataSource={filteredTasks}
                                rowKey="id"
                                size="small"
                                scroll={{ x: 1200 }}
                                pagination={{
                                    total: filteredTasks.length,
                                    pageSize: 50,
                                    showSizeChanger: true,
                                    showQuickJumper: true,
                                    showTotal: (total, range) =>
                                        `${range[0]}-${range[1]} of ${total} items`,
                                    onChange: (page, pageSize) => {
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
                                            }
                                        );
                                    },
                                }}
                            />
                        ) : (
                            <TasksKanban
                                tasks={filteredTasks}
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
                    </Card>

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
                    />

                    {/* Task Details Drawer */}
                    <Drawer
                        title={`Task: ${selectedTask?.heading || ""}`}
                        placement="right"
                        size="large"
                        open={action === "view"}
                        onClose={() => handleClose()}
                        destroyOnClose
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
            <FilterDrawer
                open={drawerOpen}
                onClose={closeFilterDrawer}
                title="Task Filters"
                filters={filters}
                onApplyFilters={handleFilterSubmit}
                onResetFilters={handleResetFilters}
            >
                <AdvancedTaskFilterForm
                    filters={filters}
                    onFilterChange={handleQuickFilter}
                    categories={categories}
                    labels={labels}
                    columns={columns}
                    users={users}
                    projects={projects}
                />
            </FilterDrawer>
        </DashboardLayout>
    );
};

export default TasksIndex;
