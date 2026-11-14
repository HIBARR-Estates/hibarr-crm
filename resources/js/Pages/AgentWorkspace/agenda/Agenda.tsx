import { useMemo, useRef, useState, type TouchEvent } from "react";
import ModalShell from "@/Components/Redesign/primitives/ModalShell";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useMediaQuery from "@/Hooks/useMediaQuery";
import useTranslation from "@/Hooks/useTranslation";
import type { MeetingHandlers } from "../today/DayItems";
import type { TaskHandlers } from "../today/TaskQueue";
import AgendaList from "./AgendaList";
import AgendaMonth from "./AgendaMonth";
import AgendaWeek, { WeekStrip } from "./AgendaWeek";
import DayPreview from "./DayPreview";
import { dayOrEmpty, groupByDay } from "./model";
import OutcomePanel, { type useAgendaOutcomes } from "./OutcomePanel";
import { addDays, type AgendaRange, type AgendaView } from "./range";
import type { AgendaData } from "./useAgendaData";

interface AgendaProps {
    view: AgendaView;
    date: string;
    today: string;
    /** The days `data` covers; while a new range loads, the last one's. */
    range: AgendaRange;
    data?: AgendaData;
    loading: boolean;
    updating: boolean;
    failed: boolean;
    onRetry: () => void;
    onSelectDay: (day: string) => void;
    /** Switches to the list at this day (the strip's "see all" and the outcome count). */
    onOpenList: (day: string) => void;
    handlers: TaskHandlers;
    meetingHandlers: MeetingHandlers;
    outcomes: ReturnType<typeof useAgendaOutcomes>;
}

/**
 * Today › Agenda: one screen with a list, week and month view of the
 * agent's meetings and tasks (canvas L7-02 to L7-04). The selected day is
 * the date in the URL; on week and month it is previewed above the grid.
 * Phones get a day strip for the week and a dot grid whose days open in a
 * sheet. Meetings still waiting on an outcome sit beside the list only;
 * on week and month the header's count switches to the list.
 */
export default function Agenda({
    view,
    date,
    today,
    range,
    data,
    loading,
    updating,
    failed,
    onRetry,
    onSelectDay,
    onOpenList,
    handlers,
    meetingHandlers,
    outcomes,
}: AgendaProps) {
    const { t } = useTranslation();
    const isPhone = useMediaQuery("(max-width: 639px)");
    const byDay = useMemo(() => groupByDay(data, handlers.timeZone), [data, handlers.timeZone]);
    const needOutcome = useMemo(() => new Set(outcomes.items.map((item) => item.id)), [outcomes.items]);
    const selected = range.days.includes(date) ? date : range.from;
    const [sheetDay, setSheetDay] = useState<string | null>(null);
    const touchStart = useRef<number | null>(null);

    if (loading) return <AgendaSkeleton view={view} />;

    if (failed) {
        return (
            <section className="agent-panel agent-agenda__error" role="alert">
                <p>{t("pages.agent_workspace.agenda.load_failed")}</p>
                <Button variant="ghost" onClick={onRetry}>
                    {t("pages.agent_workspace.agenda.retry")}
                </Button>
            </section>
        );
    }

    const preview = (hint: boolean) => (
        <DayPreview
            dayKey={selected}
            day={dayOrEmpty(byDay, selected)}
            today={today}
            handlers={handlers}
            meetingHandlers={meetingHandlers}
            hint={hint}
            max={hint ? 3 : undefined}
            onOpenList={onOpenList}
        />
    );

    let body;
    if (view === "list") {
        body = (
            <AgendaList
                range={range}
                days={byDay}
                today={today}
                handlers={handlers}
                meetingHandlers={meetingHandlers}
                aside={outcomes.items.length > 0 ? <OutcomePanel outcomes={outcomes} timeZone={handlers.timeZone} /> : undefined}
            />
        );
    } else if (view === "week" && isPhone) {
        // Swipe the day's cards sideways to move a day.
        const onTouchStart = (event: TouchEvent) => {
            touchStart.current = event.touches[0]?.clientX ?? null;
        };
        const onTouchEnd = (event: TouchEvent) => {
            const start = touchStart.current;
            touchStart.current = null;
            const end = event.changedTouches[0]?.clientX;
            if (start === null || end === undefined || Math.abs(end - start) < 60) return;
            onSelectDay(addDays(selected, end < start ? 1 : -1));
        };
        body = (
            <>
                <WeekStrip days={range.days} byDay={byDay} today={today} selected={selected} onSelect={onSelectDay} />
                <div onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                    {preview(false)}
                </div>
            </>
        );
    } else if (view === "week") {
        body = (
            <>
                {preview(true)}
                <AgendaWeek
                    days={range.days}
                    byDay={byDay}
                    today={today}
                    selected={selected}
                    handlers={handlers}
                    onSelect={onSelectDay}
                    onOpenMeeting={meetingHandlers.onOpenMeeting}
                    needOutcome={needOutcome}
                />
            </>
        );
    } else {
        const month = (
            <AgendaMonth
                days={range.days}
                month={range.days[Math.floor(range.days.length / 2)].slice(0, 7)}
                byDay={byDay}
                today={today}
                selected={selected}
                handlers={handlers}
                onSelect={(day) => {
                    onSelectDay(day);
                    if (isPhone) setSheetDay(day);
                }}
                onOpenMeeting={meetingHandlers.onOpenMeeting}
                needOutcome={needOutcome}
            />
        );
        body = isPhone ? (
            <>
                {month}
                <ModalShell
                    open={sheetDay !== null}
                    onClose={() => setSheetDay(null)}
                    closeOnBackdrop
                    ariaLabelledBy={sheetDay ? `agent-preview-${sheetDay}` : undefined}
                    overlayClassName="agent-sheet-overlay"
                    panelClassName="agent-sheet"
                >
                    <button
                        type="button"
                        className="agent-sheet__close"
                        aria-label={t("pages.agent_workspace.agenda.close")}
                        onClick={() => setSheetDay(null)}
                    >
                        <Icon name="x" size={18} />
                    </button>
                    {sheetDay ? (
                        <DayPreview
                            dayKey={sheetDay}
                            day={dayOrEmpty(byDay, sheetDay)}
                            today={today}
                            handlers={handlers}
                            meetingHandlers={meetingHandlers}
                        />
                    ) : null}
                </ModalShell>
            </>
        ) : (
            <>
                {preview(true)}
                {month}
            </>
        );
    }

    return (
        <div className={`agent-agenda agent-agenda--${view}`} aria-busy={updating}>
            {body}
        </div>
    );
}

export function AgendaSkeleton({ view }: { view: AgendaView }) {
    return (
        <div className="agent-agenda" aria-busy="true">
            {view !== "list" ? (
                <div className="agent-panel">
                    <div className="dr-skeleton" style={{ height: 18, width: 240, borderRadius: 6 }} />
                    <div className="dr-skeleton" style={{ height: 96, borderRadius: 12, marginTop: 12 }} />
                </div>
            ) : null}
            <div className="agent-panel">
                {Array.from({ length: view === "list" ? 5 : 3 }).map((_, index) => (
                    <div key={index} className="dr-skeleton" style={{ height: view === "list" ? 64 : 120, borderRadius: 12, marginTop: index ? 10 : 0 }} />
                ))}
            </div>
        </div>
    );
}
