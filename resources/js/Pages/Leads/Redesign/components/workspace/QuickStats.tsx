import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import type { TaskboardColumn } from "@/Features/Dashboard/Components/TaskStatusDropdownPill";
import { Icon } from "@/Components/Redesign";
import PriorityBadge from "@/Components/Redesign/primitives/PriorityBadge";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { toWorkspaceMeetingPreview } from "@/Pages/Deals/Redesign/adapters/meetingAdapter";
import {
    formatMoneyAmount,
    resolveCurrencyDisplay,
    useCompanyCurrency,
    type CurrencyDisplay,
} from "../../adapters/currencyAdapter";
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
    const related = withBoard.board_column ?? withBoard.boardColumn ?? null;
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
    const color = column?.label_color || related?.label_color || "#6b7280";

    return { label, color };
}

function formatDealValue(
    deal: Deal,
    companyCurrency: CurrencyDisplay,
): string {
    const value = deal.value ?? deal.calculated_value ?? deal.manual_value;
    if (value == null) return "—";
    return formatMoneyAmount(
        Number(value),
        resolveCurrencyDisplay(deal.currency, companyCurrency),
        "symbol",
    );
}

function StatHeader({ label }: { label: string }) {
    return (
        <div className="v2-quick-stat-head">
            <span className="v2-quick-stat-label">{label}</span>
        </div>
    );
}

/** Compact text CTAs — clear affordance without loud fills. */
function StatAction({
    label,
    onClick,
    variant = "primary",
    icon,
}: {
    label: string;
    onClick?: () => void;
    variant?: "primary" | "secondary";
    icon?: "plus" | "chevron-right" | "external-link";
}) {
    return (
        <button
            type="button"
            className={`v2-quick-stat-cta v2-quick-stat-cta-${variant}`}
            onClick={(event) => {
                event.stopPropagation();
                onClick?.();
            }}
        >
            {icon === "plus" ? <Icon name="plus" size={11} /> : null}
            <span>{label}</span>
            {icon === "chevron-right" || icon === "external-link" ? (
                <Icon name={icon} size={11} />
            ) : null}
        </button>
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
    const { formatDateTime } = useUserDateTime();
    const companyCurrency = useCompanyCurrency();

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
        <div className="v2-quick-stats" data-tour="lead-quick-stats">
            {/* ── Next meeting ─────────────────────────────────────────── */}
            <div className="v2-quick-stat">
                <StatHeader label={td("Next meeting", { source: "en" })} />
                {meetingLoading ? (
                    <StatBodySkeleton />
                ) : meetingPreview && nextMeeting ? (
                    <>
                        <div className="v2-quick-stat-body">
                            <span className="v2-quick-stat-value">
                                {meetingPreview.title}
                            </span>
                            <span className="v2-quick-stat-meta">
                                {meetingPreview.startsAt
                                    ? formatDateTime(meetingPreview.startsAt)
                                    : meetingPreview.startsAtLabel}
                            </span>
                        </div>
                        <div className="v2-quick-stat-actions">
                            <StatAction
                                label={td("View meeting", { source: "en" })}
                                icon="chevron-right"
                                variant="primary"
                                onClick={() => onOpenMeeting?.(nextMeeting)}
                            />
                            <StatAction
                                label={td("Schedule", { source: "en" })}
                                icon="plus"
                                variant="secondary"
                                onClick={onSchedule}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <span className="v2-quick-stat-muted">{td("None", { source: "en" })}</span>
                        <div className="v2-quick-stat-actions">
                            <StatAction
                                label={td("Schedule meeting", { source: "en" })}
                                icon="plus"
                                variant="primary"
                                onClick={onSchedule}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* ── Open tasks ───────────────────────────────────────────── */}
            <div className="v2-quick-stat">
                <StatHeader label={td("Open tasks", { source: "en" })} />
                {tasksLoading ? (
                    <StatBodySkeleton withChips />
                ) : openTasksCount > 0 && nextTask && taskPreview ? (
                    <>
                        <div className="v2-quick-stat-body">
                            <span className="v2-quick-stat-value">
                                {openTasksCount > 1
                                    ? `${openTasksCount} · ${taskPreview.title}`
                                    : taskPreview.title}
                            </span>
                            <span className="v2-quick-stat-chips">
                                {taskStatus ? (
                                    <TaskStatusPill
                                        label={td(taskStatus.label, { source: "en" })}
                                        color={taskStatus.color}
                                    />
                                ) : null}
                                <PriorityBadge
                                    priority={taskPreview.priority}
                                />
                                <span className="v2-quick-stat-meta-inline">
                                    {taskPreview.dueDateLabel
                                        ? `${td("Due", { source: "en" })} ${taskPreview.dueDateLabel}`
                                        : td("No due date", { source: "en" })}
                                </span>
                            </span>
                        </div>
                        <div className="v2-quick-stat-actions">
                            <StatAction
                                label={td("View task", { source: "en" })}
                                icon="chevron-right"
                                variant="primary"
                                onClick={() => onOpenTask?.(nextTask)}
                            />
                            <StatAction
                                label={td("Create", { source: "en" })}
                                icon="plus"
                                variant="secondary"
                                onClick={onCreateTask}
                            />
                        </div>
                    </>
                ) : (
                    <>
                        <span className="v2-quick-stat-muted">{td("None", { source: "en" })}</span>
                        <div className="v2-quick-stat-actions">
                            <StatAction
                                label={td("Create task", { source: "en" })}
                                icon="plus"
                                variant="primary"
                                onClick={onCreateTask}
                            />
                        </div>
                    </>
                )}
            </div>

            {/* ── Deals ────────────────────────────────────────────────── */}
            <div className="v2-quick-stat">
                <StatHeader label={td("Deals", { source: "en" })} />
                {dealsLoading ? (
                    <StatBodySkeleton lines={2} withChips />
                ) : primaryDeal && dealsCount > 0 ? (
                    <>
                        <div className="v2-quick-stat-body">
                            <span className="v2-quick-stat-value">
                                {primaryDeal.name}
                            </span>
                            <span className="v2-quick-stat-value-secondary">
                                {formatDealValue(primaryDeal, companyCurrency)}
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
                        </div>
                        <div className="v2-quick-stat-actions">
                            <StatAction
                                label={td("Open deal", { source: "en" })}
                                icon="external-link"
                                variant="primary"
                                onClick={() => onOpenDeal?.(primaryDeal)}
                            />
                            {dealsCount > 1 ? (
                                <StatAction
                                    label={td("View all", { source: "en" })}
                                    icon="chevron-right"
                                    variant="secondary"
                                    onClick={onViewAllDeals}
                                />
                            ) : (
                                <StatAction
                                    label={td("Create", { source: "en" })}
                                    icon="plus"
                                    variant="secondary"
                                    onClick={onCreateDeal}
                                />
                            )}
                        </div>
                    </>
                ) : (
                    <>
                        <span className="v2-quick-stat-muted">
                            {td("None yet", { source: "en" })}
                        </span>
                        <div className="v2-quick-stat-actions">
                            <StatAction
                                label={td("Create deal", { source: "en" })}
                                icon="plus"
                                variant="primary"
                                onClick={onCreateDeal}
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
