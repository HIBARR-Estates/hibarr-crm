import { useMemo, type ReactNode } from "react";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import useTranslation from "@/Hooks/useTranslation";
import { DayItems, type MeetingHandlers } from "../today/DayItems";
import type { TaskHandlers } from "../today/TaskQueue";
import type { DealAnalysisProgress } from "../today/types";
import { dayHeading, daySummary, useOrderedDay } from "./DayPreview";
import { dayOrEmpty, type AgendaDay } from "./model";
import type { AgendaRange } from "./range";

interface AgendaListProps {
    range: AgendaRange;
    days: Map<string, AgendaDay>;
    today: string;
    handlers: TaskHandlers;
    meetingHandlers: MeetingHandlers;
    /** The "did these happen?" panel, beside the list on desktop and above it on a phone. */
    aside?: ReactNode;
    /** Deal analysis progress by deal id, for the meeting chips. */
    analysis?: Record<string, DealAnalysisProgress>;
}

/** Seven days as one list, day by day; days with nothing on them are left out. */
export default function AgendaList({ range, days, today, handlers, meetingHandlers, aside, analysis }: AgendaListProps) {
    const { t } = useTranslation();
    const filled = range.days.filter((key) => {
        const day = days.get(key);
        return day && (day.meetings.length > 0 || day.tasks.length > 0);
    });
    // The next meeting still to start opens up with its agenda and attendees (canvas L7-02).
    const nowMinute = Math.floor(handlers.nowMs / 60_000);
    const nextMeetingId = useMemo(() => {
        let next: { id: number; at: number } | null = null;
        for (const key of range.days) {
            for (const meeting of days.get(key)?.meetings ?? []) {
                const at = meeting.at ? Date.parse(meeting.at) : Number.NaN;
                if (!(at > nowMinute * 60_000) || meeting.status === "completed") continue;
                if (!next || at < next.at) next = { id: meeting.id, at };
            }
        }
        return next?.id ?? null;
    }, [range.days, days, nowMinute]);

    return (
        <div className={`agent-agenda__list${aside ? " agent-agenda__list--with-aside" : ""}`}>
            {aside ? <aside className="agent-agenda__aside">{aside}</aside> : null}
            <section className="agent-panel" aria-label={t("pages.agent_workspace.agenda.view_list")}>
                {filled.length === 0 ? (
                    <EmptyState
                        icon="calendar"
                        title={t("pages.agent_workspace.agenda.list_empty_title")}
                        description={t("pages.agent_workspace.agenda.list_empty_description")}
                    />
                ) : (
                    filled.map((key) => (
                        <ListDay
                            key={key}
                            dayKey={key}
                            day={dayOrEmpty(days, key)}
                            today={today}
                            handlers={handlers}
                            meetingHandlers={meetingHandlers}
                            analysis={analysis}
                            expandedMeetingId={nextMeetingId}
                        />
                    ))
                )}
            </section>
        </div>
    );
}

function ListDay({
    dayKey,
    day,
    today,
    handlers,
    meetingHandlers,
    analysis,
    expandedMeetingId,
}: {
    dayKey: string;
    day: AgendaDay;
    today: string;
    handlers: TaskHandlers;
    meetingHandlers: MeetingHandlers;
    analysis?: Record<string, DealAnalysisProgress>;
    expandedMeetingId: number | null;
}) {
    const { t, locale } = useTranslation();
    const items = useOrderedDay(day, handlers.timeZone);
    const id = `agent-list-${dayKey}`;

    return (
        <div className="agent-agenda__day" aria-labelledby={id} role="group">
            <h2 id={id} className="agent-agenda__day-head">
                <span>{dayHeading(dayKey, today, locale, t)}</span>
                <span className="agent-agenda__day-count">{daySummary(day, t)}</span>
            </h2>
            <DayItems items={items} handlers={handlers} meetingHandlers={meetingHandlers} layout="list" showRecordLink analysis={analysis} expandedMeetingId={expandedMeetingId} />
        </div>
    );
}
