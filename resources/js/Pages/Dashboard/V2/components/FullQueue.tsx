import { ReactNode, useMemo, useState } from "react";
import { Link } from "@inertiajs/react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ActionQueueData, QueueTask } from "../types";

type Filter = "all" | "tasks" | "leads" | "deals" | "no-next-step";

interface FullQueueProps {
    queue: ActionQueueData;
    onOpenTask: (task: QueueTask) => void;
    /** Per-row controls for task rows. */
    renderTaskActions?: (task: QueueTask) => ReactNode;
}

const BANDS = {
    red: { bg: "#fdf1f1", border: "#f6dede", dot: T.RED, text: T.RED },
    amber: { bg: "#fdf6ec", border: "#f2e2c9", dot: T.AMBER, text: T.AMBER },
    gray: {
        bg: T.SURFACE_2,
        border: T.BORDER_SOFT,
        dot: T.TEXT_MUTED,
        text: T.TEXT_MUTED,
    },
} as const;

/**
 * Everything behind the top three, grouped and filterable.
 *
 * Overdue tasks are collapsed by the record they hang off: an agent with 85
 * overdue tasks usually has a handful of neglected records, not 85 separate
 * problems, and a flat list hides that completely.
 *
 * Band headings read `queue.counts`, not the row arrays — the arrays are capped
 * server-side and counting them would under-report.
 */
export default function FullQueue({
    queue,
    onOpenTask,
    renderTaskActions,
}: FullQueueProps) {
    const { td } = useTd();
    const [filter, setFilter] = useState<Filter>("all");

    const taskGroups = useMemo(() => groupByRecord(queue.overdueTasks), [queue]);

    const counts = queue.counts;
    const total =
        counts.overdueTasks +
        counts.hotLeads +
        counts.stalledDeals +
        counts.noNextStep;
    const shown =
        queue.overdueTasks.length +
        queue.hotLeads.length +
        queue.stalledDeals.length +
        queue.noNextStep.length;

    const filters: Array<{ key: Filter; label: string; count: number }> = [
        { key: "all", label: "All", count: total },
        { key: "tasks", label: "Tasks", count: counts.overdueTasks },
        { key: "leads", label: "Leads", count: counts.hotLeads },
        { key: "deals", label: "Deals", count: counts.stalledDeals },
        { key: "no-next-step", label: "No next step", count: counts.noNextStep },
    ];

    const shows = (key: Filter) => filter === "all" || filter === key;

    return (
        <div>
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    flexWrap: "wrap",
                    padding: "14px 18px",
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: T.NAVY }}>
                        {td("Full queue")}
                    </div>
                    <div
                        style={{ fontSize: 12, color: T.TEXT_HINT, marginTop: 3 }}
                    >
                        {total} {td("items, most overdue first")}
                        {shown < total && ` · ${td("showing")} ${shown}`}
                    </div>
                </div>

                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {filters.map((option) => (
                        <button
                            key={option.key}
                            type="button"
                            className="dv2-chip"
                            aria-pressed={filter === option.key}
                            onClick={() => setFilter(option.key)}
                        >
                            {td(option.label)} {option.count}
                        </button>
                    ))}
                </div>
            </div>

            {shows("tasks") && counts.overdueTasks > 0 && (
                <>
                    <Band
                        tone="red"
                        label="Overdue tasks"
                        count={counts.overdueTasks}
                        aside={
                            taskGroups.batched
                                ? `${taskGroups.batched} ${td("sit on one record")}`
                                : undefined
                        }
                    />
                    {taskGroups.rows.map((group) => (
                        <div key={group.head.id}>
                            <Row
                                onOpen={() => onOpenTask(group.head)}
                                title={group.head.heading}
                                meta={
                                    group.head.related
                                        ? `${td(group.head.related.type === "lead" ? "Lead" : "Deal")}: ${group.head.related.name}`
                                        : td("No linked record")
                                }
                                pill={`${group.head.days_overdue}d ${td("overdue")}`}
                                tone="red"
                                actions={renderTaskActions?.(group.head)}
                            />

                            {group.rest.length > 0 && (
                                <div
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 14,
                                        padding: "12px 18px",
                                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                        background: T.SURFACE_2,
                                        fontSize: 14,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    {group.rest.length}{" "}
                                    {td("further overdue tasks on")}{" "}
                                    <strong style={{ color: T.TEXT }}>
                                        {group.label}
                                    </strong>
                                </div>
                            )}
                        </div>
                    ))}
                </>
            )}

            {shows("leads") && counts.hotLeads > 0 && (
                <>
                    <Band
                        tone="amber"
                        label="Hot leads not yet contacted"
                        count={counts.hotLeads}
                    />
                    {queue.hotLeads.map((lead) => (
                        <Row
                            key={lead.id}
                            href={route("lead-contact.show", lead.id)}
                            title={lead.client_name}
                            meta={`${td(lead.temperature ?? "lead")} · ${td("waiting")} ${lead.waiting_hours}h`}
                            pill={`${lead.waiting_hours}h`}
                            tone="amber"
                        />
                    ))}
                </>
            )}

            {shows("deals") && counts.stalledDeals > 0 && (
                <>
                    <Band
                        tone="gray"
                        label="Deals past their stage target"
                        count={counts.stalledDeals}
                    />
                    {queue.stalledDeals.map((deal) => (
                        <Row
                            key={deal.id}
                            href={route("deals.show", deal.id)}
                            title={deal.name}
                            meta={td(deal.stage_name)}
                            pill={`${deal.days_in_stage}d / ${deal.target_days}d`}
                            tone="gray"
                        />
                    ))}
                </>
            )}

            {shows("no-next-step") && counts.noNextStep > 0 && (
                <>
                    <Band
                        tone="gray"
                        label="Open records with no next step"
                        count={counts.noNextStep}
                        aside={td("Nobody has said what happens next")}
                    />
                    {queue.noNextStep.map((record) => (
                        <Row
                            key={`${record.type}-${record.id}`}
                            href={
                                record.type === "lead"
                                    ? route("lead-contact.show", record.id)
                                    : route("deals.show", record.id)
                            }
                            title={record.name}
                            meta={td(record.type === "lead" ? "Lead" : "Deal")}
                            pill={`${record.days_open}d ${td("open")}`}
                            tone="gray"
                        />
                    ))}
                </>
            )}

            {total === 0 && (
                <p
                    style={{
                        margin: 0,
                        padding: "18px",
                        fontSize: 14,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {td("Nothing is waiting.")}
                </p>
            )}
        </div>
    );
}

function Band({
    tone,
    label,
    count,
    aside,
}: {
    tone: keyof typeof BANDS;
    label: string;
    count: number;
    aside?: string;
}) {
    const { td } = useTd();
    const band = BANDS[tone];

    return (
        <div
            style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 18px",
                background: band.bg,
                borderBottom: `1px solid ${band.border}`,
            }}
        >
            <span
                aria-hidden
                style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: band.dot,
                }}
            />
            <div className="dv2-eyebrow" style={{ color: band.text }}>
                {td(label)} · {count}
            </div>
            {aside && (
                <>
                    <div style={{ flex: 1 }} />
                    <div style={{ fontSize: 13, color: band.text }}>{aside}</div>
                </>
            )}
        </div>
    );
}

/**
 * A queue row. Rows with actions can't be an anchor (see NextUp), so `onOpen`
 * rows render a div; link-only rows keep the simpler anchor.
 */
function Row({
    href,
    onOpen,
    title,
    meta,
    pill,
    tone,
    actions,
}: {
    href?: string;
    onOpen?: () => void;
    title: string;
    meta: string;
    pill: string;
    tone: keyof typeof BANDS;
    actions?: ReactNode;
}) {
    const pillVariant =
        tone === "red" ? "red" : tone === "amber" ? "amber" : "gray";

    const body = (
        <>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontSize: 14,
                        fontWeight: 600,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                    }}
                >
                    {title}
                </div>
                <div style={{ fontSize: 13, color: T.TEXT_MUTED, marginTop: 2 }}>
                    {meta}
                </div>
            </div>
            <span className={`dr-pill dr-pill-${pillVariant}`} style={{ flex: "none" }}>
                {pill}
            </span>
        </>
    );

    if (href) {
        return (
            <Link
                href={href}
                className="dv2-row-link"
                style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
            >
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        padding: "12px 18px",
                    }}
                >
                    {body}
                </div>
            </Link>
        );
    }

    return (
        <div
            className="dv2-row"
            style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 18px",
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
            }}
        >
            <button
                type="button"
                className="dv2-row-open"
                onClick={onOpen}
                style={{ flex: 1, minWidth: 0, display: "flex", gap: 14 }}
            >
                {body}
            </button>
            {actions && (
                <div style={{ display: "flex", gap: 8, flex: "none" }}>
                    {actions}
                </div>
            )}
        </div>
    );
}

/**
 * Collapse overdue tasks by the record they belong to, keeping the oldest as
 * the visible row. Tasks with no linked record each stand alone.
 */
function groupByRecord(tasks: QueueTask[]) {
    const byRecord = new Map<string, QueueTask[]>();

    tasks.forEach((task) => {
        const key = task.related
            ? `${task.related.type}-${task.related.id}`
            : `task-${task.id}`;

        byRecord.set(key, [...(byRecord.get(key) ?? []), task]);
    });

    const rows = [...byRecord.values()].map(([head, ...rest]) => ({
        head,
        rest,
        label: head.related?.name ?? head.heading,
    }));

    return {
        rows,
        batched: rows.reduce((sum, row) => sum + row.rest.length, 0),
    };
}
