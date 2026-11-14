import { dayKeyIn, meetingTimeState } from "@/Components/Redesign/agent";
import useTranslation from "@/Hooks/useTranslation";
import { instantTime } from "./format";
import type { CommissionSummary, PersonalQueue, PersonalStats, PipelineRow, TodaySchedule } from "./types";

interface TodayHeaderProps {
    greeting: string;
    dateLabel: string;
    userId: number;
    nowMs: number;
    timeZone: string;
    queue?: PersonalQueue;
    schedule?: TodaySchedule;
    stats?: PersonalStats;
    commission?: CommissionSummary | null;
    openDeals?: PipelineRow[];
}

function money(total: number, currency: string, locale: string): string {
    try {
        return new Intl.NumberFormat(locale || undefined, { style: "currency", currency, maximumFractionDigits: 0 }).format(total);
    } catch {
        return `${currency} ${Math.round(total).toLocaleString()}`;
    }
}

/**
 * Greeting, one status sentence and the four numbers, on the navy band. Each
 * part fills in as its deferred group lands; chips keep their size while
 * loading so nothing shifts.
 */
export default function TodayHeader({
    greeting,
    dateLabel,
    userId,
    nowMs,
    timeZone,
    queue,
    schedule,
    stats,
    commission,
    openDeals,
}: TodayHeaderProps) {
    const { t, locale } = useTranslation();
    const today = dayKeyIn(nowMs, timeZone);

    const parts: string[] = [];
    if (schedule) {
        const count = schedule.meetings.length;
        if (count === 0) {
            parts.push(t("pages.agent_workspace.today.status.no_meetings"));
        } else {
            const next = schedule.meetings.find((meeting) => {
                const state = meetingTimeState({ at: meeting.at, duration: meeting.duration, held: meeting.status === "completed" }, nowMs);
                return state === "soon" || state === "later";
            });
            const head =
                count === 1
                    ? t("pages.agent_workspace.today.status.meetings_one")
                    : t("pages.agent_workspace.today.status.meetings_many", { count });
            parts.push(
                next?.at
                    ? `${head}, ${t("pages.agent_workspace.today.status.next_meeting", { time: instantTime(next.at, timeZone), name: next.title })}`
                    : head,
            );
        }
    }
    if (queue) {
        const overdue = queue.counts.overdue;
        parts.push(
            overdue === 0
                ? t("pages.agent_workspace.today.status.nothing_overdue")
                : overdue === 1
                  ? t("pages.agent_workspace.today.status.overdue_one")
                  : t("pages.agent_workspace.today.status.overdue_many", { count: overdue }),
        );
    }

    const earned = commission?.earned[0];
    const openDealCount = openDeals?.reduce((sum, pipeline) => sum + pipeline.deal_count, 0);

    return (
        <div className="agent-today__top">
            <div className="agent-today__heading">
                <h1>{greeting}</h1>
                <p>
                    {dateLabel}
                    {parts.length > 0 ? <span className="agent-today__status"> · {parts.join(" · ")}</span> : null}
                </p>
            </div>
            <ul className="agent-chips" aria-label={t("pages.agent_workspace.today.chips.label")}>
                <Chip
                    value={stats?.leads.new}
                    label={t("pages.agent_workspace.today.chips.leads_new")}
                    href={route("lead-contact.index", { lead_owner_id: userId })}
                />
                <Chip
                    value={openDealCount}
                    label={t("pages.agent_workspace.today.chips.open_deals")}
                    href={route("deals.index", { agent_id: userId, outcome_status: "open", lead_pipeline_id: "all" })}
                />
                <Chip
                    value={schedule?.meetings.length}
                    label={t("pages.agent_workspace.today.chips.meetings_today")}
                    href={route("meetings.index", { date_from: today, date_to: today })}
                />
                {commission === null ? null : (
                    <Chip
                        value={commission === undefined ? undefined : earned ? money(earned.total, earned.currency, locale) : 0}
                        label={t("pages.agent_workspace.today.chips.earned_month")}
                        href={route("mlm.agent.commissions", {
                            status: "paid",
                            date_from: `${today.slice(0, 8)}01`,
                            date_to: today,
                        })}
                    />
                )}
            </ul>
        </div>
    );
}

function Chip({ value, label, href }: { value: number | string | undefined; label: string; href: string }) {
    if (value === undefined) {
        return (
            <li className="agent-chip agent-chip--loading" aria-hidden="true">
                <span className="agent-chip__value">00</span>
                <span>{label}</span>
            </li>
        );
    }
    return (
        <li className="agent-chip">
            <a href={href}>
                <span className="agent-chip__value">{value}</span>
                <span>{label}</span>
            </a>
        </li>
    );
}
