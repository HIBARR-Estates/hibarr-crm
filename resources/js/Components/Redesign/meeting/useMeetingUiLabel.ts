import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

/**
 * Lang keys for the fixed vocabulary of the meeting screens' config: durations,
 * "Video call / Physical / Phone", tab and status names, overlay types, the
 * attendance outcomes. Lower-cased English in, `pages.meetings.ui.*` key out.
 *
 * That config is hook-free (it lives in constants and adapters), so it keeps
 * its English defaults and is translated where it is drawn, with `t()` when a
 * key exists. Anything not listed — a record name, a provider's own wording, a
 * free-text place — is dynamic and falls through to `td()`.
 */
const LABEL_KEYS: Record<string, string> = {
    "15 min": "pages.meetings.ui.15_min",
    "30 min": "pages.meetings.ui.30_min",
    "45 min": "pages.meetings.ui.45_min",
    "1 hr": "pages.meetings.ui.1_hr",
    "1.5 hrs": "pages.meetings.ui.1_5_hrs",
    "2 hrs": "pages.meetings.ui.2_hrs",
    "3 hrs": "pages.meetings.ui.3_hrs",
    "4 hrs": "pages.meetings.ui.4_hrs",
    "video call": "pages.meetings.ui.video_call",
    "physical": "pages.meetings.ui.physical",
    "phone": "pages.meetings.ui.phone",
    "other location": "pages.meetings.ui.other_location",
    "all meetings": "pages.meetings.ui.all_meetings",
    "upcoming": "pages.meetings.ui.upcoming",
    "past": "pages.meetings.ui.past",
    "tasks": "pages.meetings.ui.tasks",
    "events": "pages.meetings.ui.events",
    "tickets": "pages.meetings.ui.tickets",
    "leave": "pages.meetings.ui.leave",
    "event": "pages.meetings.ui.event",
    "zoho calendar": "pages.meetings.ui.zoho_calendar",
    "scheduled": "pages.meetings.ui.scheduled",
    "completed": "pages.meetings.ui.completed",
    "cancelled": "pages.meetings.ui.cancelled",
    "canceled": "pages.meetings.ui.cancelled",
    "done": "pages.meetings.ui.done",
    "live": "pages.meetings.ui.live",
    "awaiting outcome": "pages.meetings.ui.awaiting_outcome",
    "attended": "pages.meetings.ui.attended",
    "no-show": "pages.meetings.ui.no_show",
    "no show": "pages.meetings.ui.no_show",
    "partial": "pages.meetings.ui.partial",
    "rescheduled": "pages.meetings.ui.rescheduled",
};

/**
 * `ui(label)`: the translation of a config label — static vocabulary through
 * the lang files, anything else through the dynamic translator.
 */
export default function useMeetingUiLabel(): (label: string) => string {
    const { t } = useTranslation();
    const { td } = useTd();

    return (label: string) => {
        const key = LABEL_KEYS[label.trim().toLowerCase()];
        return key ? t(key) : td(label, { source: "en" });
    };
}
