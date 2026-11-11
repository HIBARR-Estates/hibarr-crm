import { dayKeyIn } from "@/Components/Redesign/agent";
import Icon from "@/Components/Redesign/primitives/Icon";
import useTranslation from "@/Hooks/useTranslation";
import { instantTime } from "../today/format";
import type { AgendaData } from "./useAgendaData";
import { meetingState } from "./model";
import { AGENDA_VIEWS, type AgendaRange, type AgendaView } from "./range";

interface AgendaHeaderProps {
    view: AgendaView;
    date: string;
    today: string;
    range: AgendaRange;
    data?: AgendaData;
    /** Meetings waiting on "did it happen?"; undefined when that feature is off. */
    needOutcome?: number;
    nowMs: number;
    timeZone: string;
    onNavigate: (view: AgendaView, date: string) => void;
    onStep: (direction: -1 | 1) => void;
}

function dayLabel(key: string, locale: string, options: Intl.DateTimeFormatOptions): string {
    return new Date(`${key}T12:00:00Z`).toLocaleDateString(locale || undefined, { ...options, timeZone: "UTC" });
}

/**
 * The agenda's line on the navy band: what span is showing, how many
 * meetings it holds and what needs an answer, with the controls to move
 * through time and switch between list, week and month.
 */
export default function AgendaHeader({
    view,
    date,
    today,
    range,
    data,
    needOutcome,
    nowMs,
    timeZone,
    onNavigate,
    onStep,
}: AgendaHeaderProps) {
    const { t, locale } = useTranslation();
    const key = "pages.agent_workspace.agenda";

    let title: string;
    if (view === "month") {
        title = dayLabel(date, locale, { month: "long", year: "numeric" });
    } else if (view === "week") {
        title = t(`${key}.title_week`, { date: dayLabel(range.from, locale, { day: "numeric", month: "short" }) });
    } else if (date === today) {
        title = t(`${key}.title_list_today`);
    } else {
        title = t(`${key}.title_list`, {
            from: dayLabel(range.from, locale, { day: "numeric", month: "short" }),
            to: dayLabel(range.to, locale, { day: "numeric", month: "short" }),
        });
    }

    const parts: string[] = [];
    if (data) {
        // The month grid pads with days from the months either side; count only the month itself.
        const month = date.slice(0, 7);
        const meetings = data.meetings.filter((meeting) => {
            if (!meeting.at || view !== "month") return true;
            return dayKeyIn(Date.parse(meeting.at), timeZone).slice(0, 7) === month;
        });
        const count = meetings.length;
        parts.push(
            count === 0
                ? t(`${key}.status.no_meetings`)
                : count === 1
                  ? t(`${key}.status.meetings_one`)
                  : t(`${key}.status.meetings_many`, { count }),
        );
        const next = meetings.find((meeting) => {
            const state = meetingState(meeting, nowMs);
            return state === "soon" || state === "later";
        });
        if (next?.at) parts.push(t(`${key}.status.next_at`, { time: instantTime(next.at, timeZone) }));
    }
    // Answered beside the list; on week and month the count opens the list.
    const outcomeText = needOutcome
        ? needOutcome === 1
            ? t(`${key}.status.outcome_one`)
            : t(`${key}.status.outcome_many`, { count: needOutcome })
        : null;

    return (
        <div className="agent-today__top agent-agenda__top">
            <div className="agent-today__heading">
                <h1>{title}</h1>
                <p aria-live="polite">
                    {parts.length > 0 || outcomeText ? parts.join(" · ") : " "}
                    {outcomeText ? (
                        <>
                            {parts.length > 0 ? " · " : null}
                            {view === "list" ? (
                                <b>{outcomeText}</b>
                            ) : (
                                <button type="button" className="agent-agenda__outcome-link" onClick={() => onNavigate("list", date)}>
                                    {outcomeText}
                                </button>
                            )}
                        </>
                    ) : null}
                </p>
            </div>
            <div className="agent-agenda__controls">
                <button
                    type="button"
                    className="agent-band-btn agent-band-btn--icon"
                    aria-label={t(`${key}.previous_${view}`)}
                    onClick={() => onStep(-1)}
                >
                    <Icon name="chevron-left" size={16} />
                </button>
                <button
                    type="button"
                    className="agent-band-btn agent-band-btn--icon"
                    aria-label={t(`${key}.next_${view}`)}
                    onClick={() => onStep(1)}
                >
                    <Icon name="chevron-right" size={16} />
                </button>
                <button
                    type="button"
                    className="agent-band-btn"
                    aria-pressed={date === today}
                    onClick={() => onNavigate(view, today)}
                >
                    {t(`${key}.today_button`)}
                </button>
                <div role="group" aria-label={t(`${key}.views_label`)} className="agent-band-seg">
                    {AGENDA_VIEWS.map((option) => (
                        <button
                            key={option}
                            type="button"
                            aria-pressed={option === view}
                            onClick={() => onNavigate(option, date)}
                        >
                            {t(`${key}.view_${option}`)}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
