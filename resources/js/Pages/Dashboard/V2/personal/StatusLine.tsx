import dayjs from "dayjs";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ScheduleEntry } from "../types";
import type { PersonalQueue, PipelineRow } from "./types";
import { dominantTotal, mergeCurrencyTotals } from "./format";

interface StatusLineProps {
    /** Server clock, so "next is" doesn't drift on a stale browser. */
    now: string;
    queue?: PersonalQueue;
    agenda?: ScheduleEntry[];
    pipelines?: PipelineRow[];
}

/**
 * The personal dashboard's subtext: what needs this person (as a real
 * sentence), and what's next on the clock.
 *
 * Sits under the greeting DashboardHeader renders — this component owns the
 * two derived lines only, so every view's header is the same shape and only
 * the sentence under it changes. Each line degrades a fact at a time: a panel
 * still in flight drops its clause rather than blocking the line or showing a
 * skeleton, since the greeting above is already useful on its own.
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
    now,
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

    const next = agenda?.find((entry) => entry.at && dayjs(entry.at).isAfter(now));

    const schedule = [
        // Empty agenda already has its own real estate below — the empty
        // state on the Agenda panel itself, with a "Schedule meeting" action.
        // Repeating "nothing booked" here said nothing that panel doesn't.
        agenda && agenda.length > 0
            ? `${agenda.length} ${td("calendar items")}`
            : null,
        next
            ? `${td("next is")} ${next.title} ${td("at")} ${dayjs(next.at).format("HH:mm")}`
            : null,
    ].filter(Boolean);

    return (
        <>
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
        </>
    );
}
