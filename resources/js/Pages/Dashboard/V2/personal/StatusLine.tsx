import dayjs from "dayjs";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ScheduleEntry } from "../types";
import type { PersonalQueue, PipelineRow } from "./types";
import { dominantTotal, greetingFor, isAgendaActive, isAgendaUpcoming, mergeCurrencyTotals } from "./format";

interface StatusLineProps {
    name: string;
    /** Server clock, so the greeting doesn't flip on a stale browser. */
    now: string;
    /**
     * Clock used to pick "next is …". A meeting that has already started
     * is in progress, not next — this should be a ticking client instant
     * so it doesn't stay pinned to the page-load server stamp.
     */
    clock?: string;
    queue?: PersonalQueue;
    agenda?: ScheduleEntry[];
    pipelines?: PipelineRow[];
}

/**
 * Three lines: who's greeted, what needs them (as a real sentence), and
 * what's next on the clock.
 *
 * Replaces the gradient greeting hero: a status line states the same thing in
 * a quarter of the height, and the numbers in it are the ones the page is
 * about. Every line degrades a fact at a time — a panel still in flight
 * simply drops its clause rather than blocking the line or showing a
 * skeleton, since the greeting alone is already useful.
 *
 * The summary line is deliberately a sentence, not a fragment list like the
 * rest of this page — it's the one place the dashboard tells the person what
 * to do, not just what's true, so it reads like an instruction rather than a
 * stat.
 *
 * There is no "pace vs last month" clause. Closing pace needs a won-deal
 * series per user that nothing in this schema records, and a fabricated
 * trend on a landing page is worse than a missing one.
 */
export default function StatusLine({
    name,
    now,
    clock,
    queue,
    agenda,
    pipelines,
}: StatusLineProps) {
    const { td } = useTd();

    const openTasks = queue
        ? queue.counts.overdue + queue.counts.today + queue.counts.later
        : null;

    // The true sum in the dominant currency — merged across every pipeline,
    // not just whichever pipeline happens to sort first. Never summed across
    // currencies themselves: the stored exchange rates are unmaintained, so
    // a single converted figure would look authoritative and be wrong.
    const totals = mergeCurrencyTotals(
        pipelines?.flatMap((pipeline) => pipeline.totals) ?? [],
    );
    const openValue = totals.length ? dominantTotal(totals).label : null;

    const taskPhrase = openTasks
        ? openTasks === 1
            ? td("1 task that needs your attention")
            : `${openTasks} ${td("tasks that need your attention")}`
        : null;
    const valuePhrase = openValue
        ? `${openValue} ${td("pending in open deals")}`
        : null;

    // "Take action below" only when there's a task-shaped reason to — an
    // open pipeline total isn't something to act on, just something to know.
    let summary: string | null = null;
    const parts = [taskPhrase, valuePhrase].filter(
        (part): part is string => part !== null,
    );

    if (parts.length > 0) {
        const joined = parts.join(` ${td("and")} `);
        summary = taskPhrase
            ? `${td("You have")} ${joined} — ${td("take action below")}.`
            : `${td("You have")} ${joined}.`;
    } else if (queue !== undefined && pipelines !== undefined) {
        // Both confirmed loaded, both genuinely empty — a real answer, not a
        // missing one.
        summary = td("Nothing needs you right now.");
    }

    // Client clock, not the page-load `now`: a meeting that started while
    // this page was open is in progress, not next — even if the agenda
    // payload still lists it because the server filtered against an older
    // instant. Greeting above still uses `now` so it doesn't flip on a
    // skewed browser clock.
    const clockStamp = clock ?? dayjs();
    // "Next is …" is the soonest not-yet-started meeting. Live ones are
    // already happening, so they don't steal that slot.
    const upcomingAgenda = agenda
        ?.filter((entry) => isAgendaUpcoming(entry.at, clockStamp))
        .slice()
        .sort((a, b) => (a.at ?? "").localeCompare(b.at ?? ""));
    const next = upcomingAgenda?.[0];
    const activeCount = agenda?.filter((entry) =>
        isAgendaActive(entry.at, entry.duration, clockStamp),
    ).length;

    const schedule = [
        // Empty agenda already has its own real estate below — the empty
        // state on the Agenda panel itself, with a "Schedule meeting" action.
        // Repeating "nothing booked" here said nothing that panel doesn't.
        activeCount && activeCount > 0
            ? `${activeCount} ${td("calendar items")}`
            : null,
        next
            ? `${td("next is")} ${next.title} ${td("at")} ${dayjs(next.at).format("HH:mm")}`
            : null,
    ].filter(Boolean);

    return (
        <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.3 }}>
                <span style={{ fontWeight: 700, color: T.NAVY }}>
                    {td(greetingFor(now))}, {name}.
                </span>
            </p>

            {summary && (
                <p
                    style={{
                        margin: "4px 0 0",
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: T.TEXT,
                    }}
                >
                    {summary}
                </p>
            )}

            {schedule.length > 0 && (
                <p
                    style={{
                        margin: "3px 0 0",
                        fontSize: 13,
                        lineHeight: 1.4,
                        color: T.TEXT_MUTED,
                    }}
                >
                    {schedule.join(" · ")}
                </p>
            )}
        </div>
    );
}
