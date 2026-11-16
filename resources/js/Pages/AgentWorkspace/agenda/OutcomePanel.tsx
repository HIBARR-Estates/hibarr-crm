import { lazy, Suspense, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { useMeetingAttendanceConfirmations } from "@/Hooks/useMeetingAttendanceConfirmations";
import useTranslation from "@/Hooks/useTranslation";
import type {
    MeetingAttendanceOutcome,
    PendingMeetingAttendanceConfirmation,
} from "@/Types/api/meeting-attendance-confirmation";
import { instantTime } from "../today/format";

const ConfirmationModal = lazy(() => import("@/Components/MeetingAttendanceConfirmation/MeetingAttendanceConfirmationModal"));

/** Same order as MeetingAttendanceOutcome and the reminders dock's modal. */
const OUTCOMES: MeetingAttendanceOutcome[] = ["attended", "no_show", "rescheduled", "cancelled", "partial"];

/**
 * The meetings still waiting on "did it happen?" — the same list the
 * reminders dock shows (MeetingAttendanceConfirmationController), with each
 * outcome opening the same dialog the reminders dock uses, with that outcome
 * already picked so a note can be added before it is saved. Snooze hides all of them
 * at once and says until when.
 */
export function useAgendaOutcomes(enabled: boolean, onSaved: () => void) {
    const queryClient = useQueryClient();
    const { items, remove, restore, snoozeMinutes } = useMeetingAttendanceConfirmations(enabled);

    // Tells the dock's own copy of the list, which polls the same endpoint.
    const refreshPending = useCallback(
        () => queryClient.invalidateQueries({ queryKey: [route("meetings.api.attendance_confirmation.pending")] }),
        [queryClient],
    );

    const snooze = useCallback(
        (item: PendingMeetingAttendanceConfirmation) => {
            remove(item.id);
            axios
                .post(route("meetings.api.attendance_confirmation.snooze", { followUp: item.id }), {})
                .then(() => void refreshPending())
                .catch(() => restore(item));
        },
        [remove, restore, refreshPending],
    );

    /** The full dialog (with a note) confirmed one; it already saved, so just drop it here. */
    const confirmedInDialog = useCallback(
        (id: number) => {
            remove(id);
            void refreshPending();
            onSaved();
        },
        [remove, refreshPending, onSaved],
    );

    return { items: enabled ? items : [], snooze, confirmedInDialog, snoozeMinutes };
}

function untilText(at: number, locale: string, timeZone: string): string {
    const iso = new Date(at).toISOString();
    const day = (value: number) => new Date(value).toLocaleDateString("en-CA", { timeZone: timeZone || undefined });
    const time = instantTime(iso, timeZone);
    if (day(at) === day(Date.now())) return time;
    const weekday = new Date(at).toLocaleDateString(locale || undefined, { weekday: "short", timeZone: timeZone || undefined });
    return `${weekday} ${time}`;
}

interface OutcomePanelProps {
    outcomes: ReturnType<typeof useAgendaOutcomes>;
    timeZone: string;
}

export default function OutcomePanel({ outcomes, timeZone }: OutcomePanelProps) {
    const { t, locale } = useTranslation();
    const { td } = useTd();
    // The meeting whose dialog is open, and the outcome the button pressed (none when the name was).
    const [noteFor, setNoteFor] = useState<{ item: PendingMeetingAttendanceConfirmation; outcome: MeetingAttendanceOutcome | null } | null>(null);
    const key = "pages.agent_workspace.agenda.outcome";

    if (outcomes.items.length === 0) return null;

    // "until 14:30" today, "until Tue 14:30" past midnight: when every meeting here comes back.
    const snoozeUntil = outcomes.snoozeMinutes ? untilText(Date.now() + outcomes.snoozeMinutes * 60_000, locale, timeZone) : null;

    return (
        <section className="agent-panel agent-outcome" aria-labelledby="agent-outcome-title">
            <p className="agent-outcome__label">
                {t(`${key}.label`)} · {outcomes.items.length}
            </p>
            <h2 id="agent-outcome-title" className="agent-outcome__title">
                {t(`${key}.title`)}
            </h2>
            <ul className="agent-outcome__list">
                {outcomes.items.map((item) => {
                    const when = item.scheduled_at
                        ? `${new Date(item.scheduled_at).toLocaleDateString(locale || undefined, {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              timeZone: timeZone || undefined,
                          })} ${instantTime(item.scheduled_at, timeZone)}`
                        : "";
                    const name = [item.meeting_type_label ? td(item.meeting_type_label, { source: "en" }) : null, item.contact_name]
                        .filter(Boolean)
                        .join(" · ");
                    return (
                        <li key={item.id} className="agent-outcome__item">
                            <button type="button" className="agent-outcome__name" onClick={() => setNoteFor({ item, outcome: null })}>
                                {when} · {name || t(`${key}.meeting`)}
                            </button>
                            <div className="agent-outcome__choices" role="group" aria-label={t(`${key}.choices_label`, { name: name || when })}>
                                {OUTCOMES.map((outcome) => (
                                    <button
                                        key={outcome}
                                        type="button"
                                        className="dr-btn dr-btn-ghost dr-btn-sm"
                                        onClick={() => setNoteFor({ item, outcome })}
                                    >
                                        {t(`${key}.${outcome}`)}
                                    </button>
                                ))}
                            </div>
                        </li>
                    );
                })}
            </ul>
            <div className="agent-outcome__foot">
                {outcomes.items[0] ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        icon={<Icon name="clock" size={13} />}
                        onClick={() => outcomes.items.forEach((item) => outcomes.snooze(item))}
                    >
                        {snoozeUntil ? t(`${key}.snooze_all_until`, { when: snoozeUntil }) : t(`${key}.snooze_all`)}
                    </Button>
                ) : null}
            </div>
            {noteFor ? (
                <Suspense fallback={null}>
                    <ConfirmationModal
                        key={`${noteFor.item.id}-${noteFor.outcome ?? "none"}`}
                        meeting={noteFor.item}
                        initialOutcome={noteFor.outcome}
                        onDismiss={() => setNoteFor(null)}
                        onConfirmed={() => {
                            outcomes.confirmedInDialog(noteFor.item.id);
                            setNoteFor(null);
                        }}
                    />
                </Suspense>
            ) : null}
        </section>
    );
}
