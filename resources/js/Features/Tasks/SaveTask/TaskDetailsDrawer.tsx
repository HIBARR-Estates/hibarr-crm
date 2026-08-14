import React, { useEffect, useState } from "react";
import {
    Modal,
    Tag,
    Avatar,
    Tooltip,
    Spin,
    Empty,
    Progress,
    App,
} from "antd";
import {
    UserOutlined,
    FlagOutlined,
    LockOutlined,
    DollarOutlined,
    LinkOutlined,
    CheckOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import {
    taskDateTimeToDayjs,
    formatTaskDateWithCompanyTime,
    formatTaskCompanyTime,
} from "@/lib/taskDateTime";
import { formatCompanyDate } from "@/lib/companyDateTime";
import { getPriorityConfig } from "@/lib/priority";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse, isSuccessResponse } from "@/lib/api/types";
import { Link } from "@inertiajs/react";
import TaskStatusDropdownPill, {
    isCompletedColumn,
    TaskboardColumn,
} from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import TaskEntityLink from "@/Features/Tasks/Components/TaskEntityLink";
import { reloadTaskLists } from "@/Features/Tasks/reloadTaskLists";
import { identityTd, type TdFn } from "@/lib/dynamicTranslation";
import "./task-view-modal.css";

export interface Task {
    id: number;
    heading: string;
    description?: string;
    due_date?: string;
    start_date?: string;
    priority: "low" | "medium" | "high" | "highest" | "urgent";
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
        designation_name?: string;
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
    created_at?: string;
    updated_at?: string;
    estimate_hours?: number;
    estimate_minutes?: number;
    is_private?: boolean;
    billable?: boolean;
    task_short_code?: string;
    board_column?: {
        id: number;
        column_name: string;
        slug: string;
        label_color: string;
    };
    time_logs?: Array<{ total_minutes: number }>;
    created_by?: { id: number; name: string; image?: string };
    assigner?: { id: number; name: string; image?: string };
    added_by_user?: { id: number; name: string; image?: string };
    hash?: string;
    deals?: Array<{ id: number; name: string }>;
    leads?: Array<{ id: number; client_name: string; company_name?: string }>;
    properties?: Array<{ id: number; name: string }>;
}

interface TaskDetailsModalProps {
    task: Task | null | undefined;
    open: boolean;
    onClose: () => void;
    columns?: TaskboardColumn[];
    onMarkDone?: () => void;
    td?: TdFn;
    /** Skip Inertia reload after status changes (parent updates local state). */
    skipReload?: boolean;
    /** When false, hide Mark Done and disable the status dropdown. Defaults to true. */
    canChangeStatus?: boolean;
    onStatusChange?: (taskId: number, statusSlug: string) => void;
}

// ─── Small atoms ─────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
    return (
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2.5">
            {children}
        </p>
    );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="flex items-center gap-3 px-4 py-3">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-20 shrink-0">
                {label}
            </span>
            <div className="flex-1 min-w-0">{children}</div>
        </div>
    );
}

function PropTable({ children }: { children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-100 overflow-hidden divide-y divide-slate-100">
            {children}
        </div>
    );
}

function formatDateTime(dateStr: string | undefined): React.ReactNode {
    if (!dateStr) return <span className="text-slate-500">Not set</span>;
    const label = formatTaskDateWithCompanyTime(dateStr, { fallback: "" });
    if (!label) return <span className="text-slate-500">Not set</span>;
    const [datePart, timePart] = label.split(" · ");
    return (
        <span>
            {datePart}
            {timePart ? (
                <>
                    <span className="text-slate-400 mx-1.5">·</span>
                    {timePart}
                </>
            ) : null}
        </span>
    );
}

// ─── Main component ───────────────────────────────────────────────────────────

const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
    task: initialTask,
    open,
    onClose,
    columns = [],
    onMarkDone,
    td = identityTd,
    skipReload = false,
    canChangeStatus = true,
    onStatusChange,
}) => {
    const { message } = App.useApp();
    const [confirmed, setConfirmed] = useState(false);
    // optimistic status — so the pill reflects changes before reload
    const [localStatus, setLocalStatus] = useState<string | null>(null);

    useEffect(() => {
        if (open) setLocalStatus(null);
    }, [open, initialTask?.id]);

    const { data: fetchedTaskData, isLoading: isFetchingTask } = useApiQuery<{
        task: Task;
    }>({
        path: initialTask?.id ? route("tasks.data", initialTask.id) : "",
        options: {
            enabled: !!initialTask?.id && open,
        },
    });

    const fetchedTask = fetchedTaskData?.task;
    const task = fetchedTask
        ? {
              ...initialTask,
              ...fetchedTask,
              // Prefer relation from API; keep list payload if fetch omitted it.
              board_column:
                  fetchedTask.board_column ??
                  (fetchedTask as Task & { boardColumn?: Task["board_column"] })
                      .boardColumn ??
                  initialTask?.board_column,
          }
        : initialTask;
    const effectiveStatus =
        localStatus ??
        task?.board_column?.slug ??
        task?.status ??
        "";

    const { mutate: changeStatus, status: changeStatusState } = useApiMutate<
        { taskId: number; status: string },
        any,
        ApiResponse<any>
    >(route("tasks.change_status"), "POST");

    const isDone =
        isCompletedColumn(effectiveStatus, columns) ||
        effectiveStatus === "done" ||
        task?.board_column?.slug === "done" ||
        Boolean(task?.completed_on);

    const isMarkingDone =
        changeStatusState === "pending" ||
        (changeStatusState as string) === "loading";

    const handleMarkDone = () => {
        if (!task?.id || !canChangeStatus) return;
        changeStatus(
            { taskId: task.id, status: "done" },
            {
                onSuccess: (response) => {
                    if (!isSuccessResponse(response)) return;
                    setLocalStatus("done");
                    setConfirmed(true);
                    setTimeout(() => {
                        setConfirmed(false);
                        setLocalStatus(null);
                        onMarkDone?.();
                        onStatusChange?.(task.id, "done");
                        if (!skipReload) {
                            reloadTaskLists();
                        }
                        onClose();
                    }, 1100);
                },
                onError: () => {
                    message.error("Failed to mark task as done");
                },
            },
        );
    };

    const handleStatusChange = (slug: string) => {
        if (!task?.id || !canChangeStatus) return;
        setLocalStatus(slug);
        changeStatus(
            { taskId: task.id, status: slug },
            {
                onSuccess: (response) => {
                    if (!isSuccessResponse(response)) {
                        setLocalStatus(null);
                        return;
                    }
                    onStatusChange?.(task.id, slug);
                    if (!skipReload) {
                        reloadTaskLists();
                    }
                },
                onError: () => {
                    setLocalStatus(null);
                    message.error("Failed to update status");
                },
            },
        );
    };

    // ── Derived values ────────────────────────────────────────────────────────

    const calculateTimeSpent = () =>
        (task?.time_logs ?? []).reduce(
            (total: number, log: any) => total + (log.total_minutes || 0),
            0,
        );

    const formatDuration = (minutes: number) => {
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    };

    const estimatedMinutes =
        (task?.estimate_hours || 0) * 60 + (task?.estimate_minutes || 0);
    const spentMinutes = calculateTimeSpent();
    const progressPercent =
        estimatedMinutes > 0
            ? Math.min((spentMinutes / estimatedMinutes) * 100, 100)
            : 0;

    const dueDayjs = task?.due_date ? taskDateTimeToDayjs(task.due_date) : null;
    const isOverdue =
        !!dueDayjs && dayjs().isAfter(dueDayjs) && !isDone;

    const priorityCfg = task ? getPriorityConfig(task.priority) : null;

    const hasRelated =
        (task?.deals?.length ?? 0) > 0 ||
        (task?.leads?.length ?? 0) > 0 ||
        (task?.properties?.length ?? 0) > 0;

    const assigner = task?.assigner ?? task?.added_by_user ?? task?.created_by;

    // ── Success overlay ───────────────────────────────────────────────────────

    if (confirmed) {
        return (
            <Modal
                className="task-view-modal"
                title={null}
                open={open}
                onCancel={onClose}
                footer={null}
                width={680}
                centered
                destroyOnHidden
                closable={false}
            >
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                    <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center">
                        <CheckOutlined className="text-2xl text-emerald-600" />
                    </div>
                    <p className="text-[17px] font-bold text-slate-800">Task complete!</p>
                    <p className="text-sm text-slate-400 text-center max-w-[200px] italic">
                        "{task?.heading}"
                    </p>
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            className="task-view-modal"
            title={null}
            open={open}
            onCancel={onClose}
            footer={null}
            width={680}
            centered
            destroyOnHidden
            maskClosable
            closable
        >
            {/* ── Header ── */}
            <div className="px-6 pt-5 pb-4 pr-14 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            {task?.task_short_code && (
                                <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                                    #{task.task_short_code}
                                </span>
                            )}
                            {Boolean(task?.is_private) && (
                                <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 inline-flex items-center gap-1">
                                    <LockOutlined className="text-[10px]" /> Private
                                </span>
                            )}
                            {Boolean(task?.billable) && (
                                <span className="text-[11px] font-medium rounded-full px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 inline-flex items-center gap-1">
                                    <DollarOutlined className="text-[10px]" /> Billable
                                </span>
                            )}
                        </div>
                        <h2 className="text-[18px] font-bold text-slate-900 leading-snug">
                            {task?.heading || "Task Details"}
                        </h2>
                    </div>
                    <div className="shrink-0">
                        {isDone ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 text-[12px] font-bold rounded-lg border border-emerald-200 whitespace-nowrap">
                                <CheckOutlined /> Completed
                            </span>
                        ) : canChangeStatus ? (
                            <button
                                onClick={handleMarkDone}
                                disabled={isMarkingDone || isFetchingTask}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-bold rounded-lg transition-colors shadow-sm whitespace-nowrap disabled:opacity-60 disabled:cursor-not-allowed"
                            >
                                <CheckOutlined />
                                {isMarkingDone ? "Saving…" : "Mark Done"}
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* ── Scrollable body ── */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                {isFetchingTask ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Spin size="large" />
                        <p className="text-sm text-slate-400">Loading task…</p>
                    </div>
                ) : !task ? (
                    <Empty description="Task not found" style={{ margin: "40px 0" }} />
                ) : (
                    <>
                        {/* Overdue banner */}
                        {isOverdue && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-[12px] font-semibold">
                                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                                Overdue since{" "}
                                {dueDayjs
                                    ? formatCompanyDate(dueDayjs.toDate())
                                    : ""}
                            </div>
                        )}

                        {/* ── Details ── */}
                        <div>
                            <SectionLabel>Details</SectionLabel>
                            <PropTable>
                                {/* Status + Priority */}
                                <div className="grid grid-cols-2 divide-x divide-slate-100">
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-14 shrink-0">
                                            Status
                                        </span>
                                        {columns.length > 0 && canChangeStatus ? (
                                            <TaskStatusDropdownPill
                                                status={effectiveStatus}
                                                columns={columns}
                                                onChange={(slug) => handleStatusChange(slug)}
                                            />
                                        ) : (
                                            <Tag className="capitalize mb-0">
                                                {task.board_column?.column_name ||
                                                    task.status ||
                                                    "Unknown"}
                                            </Tag>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-14 shrink-0">
                                            Priority
                                        </span>
                                        <Tag
                                            color={priorityCfg?.color}
                                            icon={<FlagOutlined />}
                                            className="uppercase mb-0"
                                        >
                                            {task.priority}
                                        </Tag>
                                    </div>
                                </div>

                                {/* Start + Due */}
                                <div className="grid grid-cols-2 divide-x divide-slate-100">
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-14 shrink-0">
                                            Start
                                        </span>
                                        <span
                                            className={`text-[12px] ${task.start_date ? "text-slate-800" : "text-slate-500"}`}
                                        >
                                            {formatDateTime(task.start_date)}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 px-4 py-3">
                                        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide w-14 shrink-0">
                                            Due
                                        </span>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <span
                                                className={`text-[12px] font-medium ${isOverdue ? "text-red-600" : "text-slate-800"}`}
                                            >
                                                {task.due_date ? (
                                                    formatDateTime(task.due_date)
                                                ) : (
                                                    <span className="text-slate-500 font-normal">
                                                        No due date
                                                    </span>
                                                )}
                                            </span>
                                            {isOverdue && (
                                                <span className="text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded border border-red-200 leading-none">
                                                    Overdue
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Assignees */}
                                {task.users && task.users.length > 0 && (
                                    <PropRow label="Assigned">
                                        <div className="flex flex-wrap gap-2">
                                            {task.users.map((user: any) => (
                                                <div
                                                    key={user.id}
                                                    className="flex items-center gap-1.5"
                                                >
                                                    <Avatar
                                                        size={22}
                                                        icon={<UserOutlined />}
                                                        src={user.image}
                                                        className="shrink-0"
                                                    />
                                                    <span className="text-[12px] font-medium text-slate-800">
                                                        {user.name}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </PropRow>
                                )}

                                {/* Assigner */}
                                {assigner && (
                                    <PropRow label="Assigner">
                                        <div className="flex items-center gap-1.5">
                                            <Avatar
                                                size={22}
                                                icon={<UserOutlined />}
                                                src={assigner.image}
                                                className="shrink-0"
                                            />
                                            <span className="text-[12px] font-medium text-slate-800">
                                                {assigner.name}
                                            </span>
                                        </div>
                                    </PropRow>
                                )}

                                {/* Project */}
                                {task.project && (
                                    <PropRow label="Project">
                                        <span className="font-medium text-slate-800 text-[13px]">
                                            {task.project.project_name}
                                        </span>
                                        {task.project.project_short_code && (
                                            <span className="ml-2 text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                                                {task.project.project_short_code}
                                            </span>
                                        )}
                                    </PropRow>
                                )}

                                {/* Category */}
                                {task.category && (
                                    <PropRow label="Category">
                                        <Tag>{td(task.category.category_name, { source: "en" })}</Tag>
                                    </PropRow>
                                )}

                                {/* Labels */}
                                {task.labels && task.labels.length > 0 && (
                                    <PropRow label="Labels">
                                        <div className="flex flex-wrap gap-1">
                                            {task.labels.slice(0, 4).map((label: any) => (
                                                <Tag
                                                    key={label.id}
                                                    style={{
                                                        backgroundColor: label.label_color,
                                                        borderColor: label.label_color,
                                                        color: "#fff",
                                                    }}
                                                >
                                                    {td(label.label_name, { source: "en" })}
                                                </Tag>
                                            ))}
                                            {task.labels.length > 4 && (
                                                <Tooltip
                                                    title={task.labels
                                                        .slice(4)
                                                        .map((l: any) => td(l.label_name, { source: "en" }))
                                                        .join(", ")}
                                                >
                                                    <Tag>+{task.labels.length - 4}</Tag>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </PropRow>
                                )}
                            </PropTable>
                        </div>

                        {/* ── Related entities ── */}
                        {hasRelated && (
                            <div>
                                <SectionLabel>Related</SectionLabel>
                                <PropTable>
                                    {task.deals && task.deals.length > 0 && (
                                        <PropRow label="Deals">
                                            <div className="flex flex-col gap-1">
                                                {task.deals.map((deal: any) => (
                                                    <TaskEntityLink
                                                        key={deal.id}
                                                        type="deal"
                                                        id={deal.id}
                                                        name={deal.name}
                                                        className="!text-[13px]"
                                                    />
                                                ))}
                                            </div>
                                        </PropRow>
                                    )}
                                    {task.leads && task.leads.length > 0 && (
                                        <PropRow label="Leads">
                                            <div className="flex flex-col gap-1">
                                                {task.leads.map((lead: any) => (
                                                    <TaskEntityLink
                                                        key={lead.id}
                                                        type="lead"
                                                        id={lead.id}
                                                        name={`${lead.client_name}${
                                                            lead.company_name
                                                                ? ` (${lead.company_name})`
                                                                : ""
                                                        }`}
                                                        className="!text-[13px]"
                                                    />
                                                ))}
                                            </div>
                                        </PropRow>
                                    )}
                                    {task.properties && task.properties.length > 0 && (
                                        <PropRow label="Properties">
                                            <div className="flex flex-col gap-1">
                                                {task.properties.map((property: any) => (
                                                    <Link
                                                        key={property.id}
                                                        href={route(
                                                            "products.show",
                                                            property.id,
                                                        )}
                                                        className="text-blue-600 hover:underline inline-flex items-center gap-1 text-[13px]"
                                                    >
                                                        <LinkOutlined style={{ fontSize: 11 }} />
                                                        {property.name}
                                                    </Link>
                                                ))}
                                            </div>
                                        </PropRow>
                                    )}
                                </PropTable>
                            </div>
                        )}

                        {/* ── Time tracking ── */}
                        {(estimatedMinutes > 0 || spentMinutes > 0) && (
                            <div>
                                <SectionLabel>Time Tracking</SectionLabel>
                                <PropTable>
                                    <div className="grid grid-cols-2 divide-x divide-slate-100">
                                        <div className="px-4 py-3">
                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                                {td("Estimated", { source: "en" })}
                                            </p>
                                            <p className="text-[13px] font-semibold text-slate-800 mb-0">
                                                {estimatedMinutes > 0 ? (
                                                    formatDuration(estimatedMinutes)
                                                ) : (
                                                    <span className="text-slate-500 font-normal">
                                                        Not set
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                        <div className="px-4 py-3">
                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1">
                                                {td("Time Spent", { source: "en" })}
                                            </p>
                                            <p className="text-[13px] font-semibold text-slate-800 mb-0">
                                                {spentMinutes > 0 ? (
                                                    formatDuration(spentMinutes)
                                                ) : (
                                                    <span className="text-slate-500 font-normal">
                                                        None logged
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                    {estimatedMinutes > 0 && (
                                        <div className="px-4 py-3">
                                            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-2">
                                                {td("Progress", { source: "en" })}
                                            </p>
                                            <Progress
                                                percent={Math.round(progressPercent)}
                                                status={
                                                    progressPercent >= 100
                                                        ? "exception"
                                                        : "active"
                                                }
                                                size="small"
                                            />
                                        </div>
                                    )}
                                </PropTable>
                            </div>
                        )}

                        {/* ── Description — last, in a bordered box ── */}
                        <div>
                            <SectionLabel>Description</SectionLabel>
                            <div className="rounded-xl border border-slate-100 px-4 py-3 min-h-[72px]">
                                {task.description ? (
                                    <p className="text-[13px] text-slate-600 leading-relaxed whitespace-pre-wrap mb-0">
                                        {task.description}
                                    </p>
                                ) : (
                                    <p className="text-[13px] text-slate-300 italic mb-0">
                                        {td("No description added", { source: "en" })}
                                    </p>
                                )}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </Modal>
    );
};

export default TaskDetailsModal;
