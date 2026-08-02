import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import PriorityBadge from "@/Components/Redesign/primitives/PriorityBadge";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { formatCurrencyWithSymbol } from "@/lib/utils";
import { formatDateTime } from "@/Pages/Deals/Redesign/adapters/dateFormat";
import { toWorkspaceMeetingPreview } from "@/Pages/Deals/Redesign/adapters/meetingAdapter";
import { toLeadTaskPreview } from "../../adapters/taskAdapter";

interface QuickStatsProps {
    nextMeeting?: DealFollowup | null;
    nextTask?: Task | null;
    openTasksCount?: number;
    primaryDeal?: Deal | null;
    dealsCount?: number;
    taskBoardColumns?: TaskboardColumn[];
    /** Deferred workspace props — show body skeleton while unresolved. */
    meetingLoading?: boolean;
    tasksLoading?: boolean;
    dealsLoading?: boolean;
    onSchedule?: () => void;
    onCreateTask?: () => void;
    onCreateDeal?: () => void;
    onOpenMeeting?: (meeting: DealFollowup) => void;
    onOpenTask?: (task: Task) => void;
    onOpenDeal?: (deal: Deal) => void;
    onViewAllDeals?: () => void;
}

type TaskWithBoard = Task & {
    board_column?: {
        slug?: string;
        column_name?: string;
        label_color?: string;
    };
    boardColumn?: {
        slug?: string;
        column_name?: string;
        label_color?: string;
    };
};

function darkenHex(hex: string, factor = 0.75): string {
    const h = hex.replace("#", "");
    if (h.length !== 6) return hex;
    const r = Math.round(parseInt(h.slice(0, 2), 16) * factor);
    const g = Math.round(parseInt(h.slice(2, 4), 16) * factor);
    const b = Math.round(parseInt(h.slice(4, 6), 16) * factor);
    return `rgb(${r},${g},${b})`;
}

function humanizeStatus(value: string): string {
    return value.replace(/[_-]+/g, " ").trim().toLowerCase();
}

function resolveTaskStatus(
    task: Task,
    columns: TaskboardColumn[],
): { label: string; color: string } {
    const withBoard = task as TaskWithBoard;
    const related =
        withBoard.board_column ?? withBoard.boardColumn ?? null;
    const slug =
        related?.slug ||
        task.status ||
        columns.find((column) => column.id === task.board_column_id)?.slug ||
        "";

    const column =
        columns.find((entry) => entry.slug === slug) ||
        columns.find((entry) => entry.id === task.board_column_id) ||
        null;

    const label =
        column?.column_name ||
        related?.column_name ||
        (slug ? humanizeStatus(slug) : "Open");
    const color =
        column?.label_color || related?.label_color || "#6b7280";

    return { label, color };
}

function formatDealValue(deal: Deal): string {
    const value = deal.value ?? deal.calculated_value ?? deal.manual_value;
    if (value == null) return "—";
    const symbol = deal.currency?.currency_symbol ?? deal.currency?.currency_code ?? "";
    if (!symbol) return Number(value).toLocaleString();
    return formatCurrencyWithSymbol(Number(value), symbol);
}

function StatHeader({
    label,
    actionLabel,
    onAction,
    actionPrefix = "+",
}: {
    label: string;
    actionLabel?: string;
    onAction?: () => void;
    /** Prefix before the action label (`+` for create, empty for nav links). */
    actionPrefix?: string;
}) {
    return (
        <div className="v2-quick-stat-head">
            <span className="v2-quick-stat-label">{label}</span>
            {actionLabel && onAction ? (
                <button
                    type="button"
                    className="v2-quick-stat-action"
                    onClick={(event) => {
                        event.stopPropagation();
                        onAction();
                    }}
                >
                    {actionPrefix ? `${actionPrefix} ${actionLabel}` : actionLabel}
                </button>
            ) : null}
        </div>
    );
}

/** Pulse placeholder matching the loaded value + meta row height. */
function StatBodySkeleton({
    lines = 2,
    withChips = false,
}: {
    lines?: number;
    withChips?: boolean;
}) {
    return (
        <div
            className="v2-quick-stat-skeleton"
            aria-hidden="true"
            aria-busy="true"
        >
            {Array.from({ length: lines }).map((_, index) => (
                <div
                    key={index}
                    className={`v2-quick-stat-skeleton-line${index === 0 ? " primary" : ""}`}
                />
            ))}
            {withChips ? (
                <div className="v2-quick-stat-skeleton-chips">
                    <div className="v2-quick-stat-skeleton-chip" />
                    <div className="v2-quick-stat-skeleton-chip short" />
                </div>
            ) : null}
        </div>
    );
}

function StagePill({
    name,
    color,
}: {
    name: string;
    color?: string | null;
}) {
    const accent = color?.trim() || "#1a6bb5";
    return (
        <span
            className="v2-quick-stat-stage"
            style={{
                color: accent,
                background: `${accent}18`,
                borderColor: `${accent}44`,
            }}
        >
            {name}
        </span>
    );
}

/** Read-only status chip — same visual language as TaskStatusDropdownPill. */
function TaskStatusPill({
    label,
    color,
}: {
    label: string;
    color: string;
}) {
    const accent = color?.trim() || "#999999";
    const hex = accent.startsWith("#") ? accent : `#${accent}`;
    return (
        <span
            className="v2-quick-stat-status"
            style={{
                backgroundColor: `${hex}0d`,
                color: darkenHex(hex),
                borderColor: hex,
            }}
        >
            <span
                aria-hidden="true"
                className="v2-quick-stat-status-dot"
                style={{ backgroundColor: hex }}
            />
            {label}
        </span>
    );
}

export default function QuickStats({
    nextMeeting = null,
    nextTask = null,
    openTasksCount = 0,
    primaryDeal = null,
    dealsCount = 0,
    taskBoardColumns = [],
    meetingLoading = false,
    tasksLoading = false,
    dealsLoading = false,
    onSchedule,
    onCreateTask,
    onCreateDeal,
    onOpenMeeting,
    onOpenTask,
    onOpenDeal,
    onViewAllDeals,
}: QuickStatsProps) {
    const { td } = useTd();

    const meetingPreview = nextMeeting
        ? toWorkspaceMeetingPreview(nextMeeting)
        : null;
    const taskPreview = nextTask ? toLeadTaskPreview(nextTask) : null;
    const taskStatus = nextTask
        ? resolveTaskStatus(nextTask, taskBoardColumns)
        : null;
    const pipelineName = primaryDeal?.pipeline?.name?.trim() || null;
    const stageName = primaryDeal?.lead_stage?.name?.trim() || null;
    const stageColor = primaryDeal?.lead_stage?.label_color ?? null;

    return (
        <div className="v2-quick-stats">
            {/* ── Next meeting ─────────────────────────────────────────── */}
            <div className="v2-quick-stat">
                <StatHeader
                    label={td("Next meeting")}
                    actionLabel={meetingLoading ? undefined : td("Schedule")}
                    onAction={meetingLoading ? undefined : onSchedule}
                />
                {meetingLoading ? (
                    <StatBodySkeleton />
                ) : meetingPreview && nextMeeting ? (
                    <button
                        type="button"
                        className="v2-quick-stat-open"
                        onClick={() => onOpenMeeting?.(nextMeeting)}
                        title={td("Open meeting")}
                    >
                        <span className="v2-quick-stat-value">
                            {meetingPreview.title}
                        </span>
                        <span className="v2-quick-stat-meta">
                            {meetingPreview.startsAt
                                ? formatDateTime(
                                      meetingPreview.startsAt,
                                      meetingPreview.startsAtLabel,
                                  )
                                : meetingPreview.startsAtLabel}
                        </span>
                    </button>
                ) : (
                    <span className="v2-quick-stat-muted">{td("None")}</span>
                )}
            </div>

            {/* ── Open tasks ───────────────────────────────────────────── */}
            <div className="v2-quick-stat">
                <StatHeader
                    label={td("Open tasks")}
                    actionLabel={tasksLoading ? undefined : td("Create")}
                    onAction={tasksLoading ? undefined : onCreateTask}
                />
                {tasksLoading ? (
                    <StatBodySkeleton withChips />
                ) : openTasksCount > 0 && nextTask && taskPreview ? (
                    <button
                        type="button"
                        className="v2-quick-stat-open"
                        onClick={() => onOpenTask?.(nextTask)}
                        title={td("Open task")}
                    >
                        <span className="v2-quick-stat-value">
                            {openTasksCount > 1
                                ? `${openTasksCount} · ${taskPreview.title}`
                                : taskPreview.title}
                        </span>
                        <span className="v2-quick-stat-chips">
                            {taskStatus ? (
                                <TaskStatusPill
                                    label={td(taskStatus.label)}
                                    color={taskStatus.color}
                                />
                            ) : null}
                            <PriorityBadge priority={taskPreview.priority} />
                            <span className="v2-quick-stat-meta-inline">
                                {taskPreview.dueDateLabel
                                    ? `${td("Due")} ${taskPreview.dueDateLabel}`
                                    : td("No due date")}
                            </span>
                        </span>
                    </button>
                ) : (
                    <span className="v2-quick-stat-muted">{td("None")}</span>
                )}
            </div>

            {/* ── Deals ────────────────────────────────────────────────── */}
            <div className="v2-quick-stat">
                <StatHeader
                    label={td("Deals")}
                    actionLabel={
                        dealsLoading
                            ? undefined
                            : dealsCount > 1
                              ? td("View all")
                              : td("Create")
                    }
                    actionPrefix={dealsCount > 1 ? "" : "+"}
                    onAction={
                        dealsLoading
                            ? undefined
                            : dealsCount > 1
                              ? onViewAllDeals
                              : onCreateDeal
                    }
                />
                {dealsLoading ? (
                    <StatBodySkeleton lines={2} withChips />
                ) : primaryDeal && dealsCount > 0 ? (
                    <button
                        type="button"
                        className="v2-quick-stat-open"
                        onClick={() => onOpenDeal?.(primaryDeal)}
                        title={td("Open deal")}
                    >
                        <span className="v2-quick-stat-value">
                            {primaryDeal.name}
                        </span>
                        <span className="v2-quick-stat-value-secondary">
                            {formatDealValue(primaryDeal)}
                        </span>
                        <span className="v2-quick-stat-chips">
                            {pipelineName ? (
                                <span className="v2-quick-stat-meta-inline">
                                    {pipelineName}
                                </span>
                            ) : null}
                            {stageName ? (
                                <StagePill
                                    name={stageName}
                                    color={stageColor}
                                />
                            ) : null}
                        </span>
                    </button>
                ) : (
                    <span className="v2-quick-stat-muted">
                        {td("None yet")}
                    </span>
                )}
            </div>
        </div>
    );
}
