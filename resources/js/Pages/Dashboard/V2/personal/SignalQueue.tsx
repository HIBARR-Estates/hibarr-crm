import { ReactNode, useMemo } from "react";
import dayjs from "dayjs";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { QueueTask } from "../types";
import type { PersonalQueue, Severity } from "./types";
import { severityOf } from "./format";
import SignalRow from "./SignalRow";

interface Section {
    key: Severity;
    /** English source string. */
    label: string;
    tasks: QueueTask[];
    /** True total for this window, which may exceed `tasks.length`. */
    total: number;
    /** Opens the full task list, filtered to exactly this section's rows. */
    href: string;
}

interface SignalQueueProps {
    queue: PersonalQueue;
    /** Whose tasks the section links filter down to. */
    userId: number;
    /** How far ahead the queue reaches, from the server. */
    windowDays: number;
    onOpen: (task: QueueTask) => void;
    onOpenRecord: (task: QueueTask) => void;
    renderActions: (task: QueueTask) => ReactNode;
    /** Opens the full task list, unfiltered — only the empty state uses this. */
    tasksHref: string;
}

/**
 * The ranked list of what this person owes, sectioned by due window.
 *
 * Tasks only. Deals and leads never occupy a row of their own — they appear as
 * the record subtext under a task, and open records nobody nominated a next
 * step on are summarised in the single footer line, because "look at this
 * deal" is not an action anyone can complete.
 *
 * Section counts come from the server's true totals, not from the rows shipped:
 * someone with 60 overdue tasks has to be told 60, and counting the 25 rows we
 * chose to send would quietly under-report exactly the people in most trouble.
 */
export default function SignalQueue({
    queue,
    userId,
    windowDays,
    onOpen,
    onOpenRecord,
    renderActions,
    tasksHref,
}: SignalQueueProps) {
    const { td } = useTd();

    const sections = useMemo<Section[]>(() => {
        const byWindow: Record<Severity, QueueTask[]> = {
            now: [],
            soon: [],
            watch: [],
        };

        queue.tasks.forEach((task) => byWindow[severityOf(task)].push(task));

        return [
            {
                key: "now" as const,
                label: "Overdue",
                tasks: byWindow.now,
                total: queue.counts.overdue,
                href: route("tasks.index", {
                    assigned_to: userId,
                    status: "pending",
                    quick_filter: "overdue",
                }),
            },
            {
                key: "soon" as const,
                label: "Due today",
                tasks: byWindow.soon,
                total: queue.counts.today,
                href: route("tasks.index", {
                    assigned_to: userId,
                    status: "pending",
                    quick_filter: "today",
                }),
            },
            {
                key: "watch" as const,
                label: "Upcoming",
                tasks: byWindow.watch,
                total: queue.counts.later,
                href: route("tasks.index", {
                    assigned_to: userId,
                    status: "pending",
                    due_start_date: dayjs().add(1, "day").format("YYYY-MM-DD"),
                    due_end_date: dayjs()
                        .add(windowDays, "day")
                        .format("YYYY-MM-DD"),
                }),
            },
        ].filter((section) => section.tasks.length > 0);
    }, [queue, userId, windowDays]);

    const uncovered = [
        queue.uncovered.deals
            ? `${queue.uncovered.deals} ${queue.uncovered.deals === 1 ? td("deal") : td("deals")}`
            : null,
        queue.uncovered.leads
            ? `${queue.uncovered.leads} ${queue.uncovered.leads === 1 ? td("lead") : td("leads")}`
            : null,
    ].filter(Boolean);

    if (!sections.length) {
        return <QueueEmptyState windowDays={windowDays} tasksHref={tasksHref} />;
    }

    return (
        <div>
            {sections.map((section) => (
                <div key={section.key}>
                    <SectionHeader section={section} />
                    {section.tasks.map((task) => (
                        <SignalRow
                            key={task.id}
                            task={task}
                            onOpen={() => onOpen(task)}
                            onOpenRecord={
                                task.related ? () => onOpenRecord(task) : undefined
                            }
                            actions={renderActions(task)}
                        />
                    ))}
                </div>
            ))}

            {uncovered.length > 0 && (
                <div
                    style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "11px 18px",
                        background: T.SURFACE_2,
                        borderTop: `1px solid ${T.BORDER_SOFT}`,
                    }}
                >
                    <svg
                        width={15}
                        height={15}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.TEXT_HINT}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                        style={{ display: "block", flex: "none" }}
                    >
                        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                        <path d="M12 8h.01M11 12h1v4h1" />
                    </svg>
                    <span style={{ fontSize: 12.5, color: T.TEXT_MUTED }}>
                        {td("No next step on")} {uncovered.join(` ${td("or")} `)}.
                    </span>
                </div>
            )}
        </div>
    );
}

function SectionHeader({ section }: { section: Section }) {
    const { td } = useTd();

    const oldest = section.tasks.reduce(
        (max, task) => Math.max(max, task.days_overdue),
        0,
    );

    const meta = [
        `${section.total} ${section.total === 1 ? td("task") : td("tasks")}`,
        oldest > 0 ? `${td("oldest")} ${oldest} ${td("days")}` : null,
        section.total > section.tasks.length
            ? `${td("showing")} ${section.tasks.length}`
            : null,
    ]
        .filter(Boolean)
        .join(" · ");

    return (
        <div
            style={{
                display: "flex",
                alignItems: "baseline",
                gap: 9,
                padding: "9px 18px",
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                flexWrap: "wrap",
            }}
        >
            <span
                style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: T.NAVY,
                }}
            >
                {td(section.label)}
            </span>
            <span style={{ fontSize: 12, color: T.TEXT_MUTED }}>{meta}</span>
            <a
                href={section.href}
                style={{
                    marginLeft: "auto",
                    fontSize: 12,
                    fontWeight: 600,
                    color: T.BLUE,
                }}
            >
                {td("Open task list")}
            </a>
        </div>
    );
}

/**
 * Describes what will appear, not the absence — the queue filling up is a
 * normal state, not a failure to configure something.
 */
function QueueEmptyState({
    windowDays,
    tasksHref,
}: {
    windowDays: number;
    tasksHref: string;
}) {
    const { td } = useTd();

    return (
        <div
            style={{
                padding: "40px 24px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
            }}
        >
            <div
                style={{
                    width: 52,
                    height: 52,
                    borderRadius: 999,
                    background: T.GREEN_LIGHT,
                    border: `1px solid ${T.GREEN_MID}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                }}
            >
                <svg
                    width={24}
                    height={24}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={T.GREEN}
                    strokeWidth={1.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden
                    style={{ display: "block" }}
                >
                    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                    <path d="M8.5 12.2l2.4 2.4 4.6-4.9" />
                </svg>
            </div>

            <p
                style={{
                    margin: "14px 0 0",
                    fontSize: 19,
                    fontWeight: 700,
                    color: T.NAVY,
                }}
            >
                {td("Nothing is waiting on you")}
            </p>
            <p
                style={{
                    margin: "8px 0 0",
                    maxWidth: 430,
                    fontSize: 14,
                    lineHeight: 1.6,
                    color: T.TEXT_MUTED,
                }}
            >
                {td("No task is overdue and nothing is upcoming.")}{" "}
                {td(
                    "Tasks appear here the moment one of those stops being true.",
                )}
            </p>

            <a
                href={tasksHref}
                className="dr-btn dr-btn-ghost"
                style={{ marginTop: 18 }}
            >
                {td("Open task list")}
            </a>
        </div>
    );
}

/** Fallback while the queue is in flight — mirrors the real row's shape. */
export function SignalQueueSkeleton({ rows = 5 }: { rows?: number }) {
    return (
        <div aria-hidden>
            {Array.from({ length: rows }).map((_, index) => (
                <div
                    key={index}
                    style={{
                        display: "flex",
                        gap: 14,
                        padding: "16px 18px",
                        borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        alignItems: "flex-start",
                    }}
                >
                    <div
                        className="dr-skeleton"
                        style={{ width: 62, height: 22, borderRadius: 999 }}
                    />
                    <div
                        style={{
                            flex: 1,
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                        }}
                    >
                        <div
                            className="dr-skeleton"
                            style={{
                                height: 15,
                                width: `${58 - index * 4}%`,
                                borderRadius: 6,
                            }}
                        />
                        <div
                            className="dr-skeleton"
                            style={{
                                height: 12,
                                width: `${78 - index * 3}%`,
                                borderRadius: 6,
                            }}
                        />
                    </div>
                    <div
                        className="dr-skeleton"
                        style={{ width: 96, height: 30, borderRadius: 8 }}
                    />
                </div>
            ))}
        </div>
    );
}
