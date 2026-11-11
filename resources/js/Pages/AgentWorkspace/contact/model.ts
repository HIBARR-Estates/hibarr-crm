import type { TimeState } from "@/Components/Redesign/agent";
import { hasDueTime, taskTimeState, wallClockToMs } from "@/Components/Redesign/agent";
import type { WorkspaceMeetingPreview } from "@/Pages/Deals/Redesign/adapters/meetingAdapter";
import { toWorkspaceTaskPreview, type WorkspaceTaskPreview } from "@/Pages/Deals/Redesign/adapters/taskAdapter";
import type { Task } from "@/Types/api/tasks";
import {
    formatMoneyAmount,
    resolveCurrencyDisplay,
    type CurrencyDisplay,
} from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { getDossierFieldValue, isMeaningfulDossierValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import type { Lead } from "@/Types/api/leads";

/* ---------- lead status path ---------- */

/**
 * The lifecycle's main path, in order (LeadLifecycleStatus defaults). Every
 * other status the company has (nurturing, callback, not a fit, lost, ...)
 * sits off the path. Qualified is the lead's goal; a deal comes after it.
 */
export const LEAD_PATH_KEYS = ["new", "contacted", "qualifying", "qualified"] as const;

export interface LeadStatusOption {
    id: number;
    key: string;
    label: string;
    label_color?: string | null;
}

export interface LeadPath {
    steps: Array<LeadStatusOption & { state: "done" | "current" | "ahead" }>;
    offPath: Array<LeadStatusOption & { current: boolean }>;
    /** False when the lead's status is off the path. */
    onPath: boolean;
}

export function buildLeadPath(statuses: LeadStatusOption[], currentKey: string): LeadPath {
    const byKey = new Map(statuses.map((status) => [status.key, status]));
    const pathStatuses = LEAD_PATH_KEYS.map((key) => byKey.get(key)).filter(
        (status): status is LeadStatusOption => status !== undefined,
    );
    const currentIndex = pathStatuses.findIndex((status) => status.key === currentKey);

    return {
        steps: pathStatuses.map((status, index) => ({
            ...status,
            state: currentIndex === -1 || index > currentIndex ? "ahead" : index === currentIndex ? "current" : "done",
        })),
        offPath: statuses
            .filter((status) => !(LEAD_PATH_KEYS as readonly string[]).includes(status.key))
            .map((status) => ({ ...status, current: status.key === currentKey })),
        onPath: currentIndex !== -1,
    };
}

/* ---------- key facts ---------- */

export type KeyFactGroupId = "reach" | "who" | "where" | "value" | "deal" | "came_from" | "qualification";

export interface KeyFactGroup {
    id: KeyFactGroupId | string;
    /** Shown instead of the translated label for `id` (a section of the company's own analysis script). */
    label?: string;
    /** Nothing recorded yet, shown as needing input. */
    empty?: boolean;
    /** First value, shown large. */
    lead: string;
    /** The rest, one per line. Already in display form. */
    lines: string[];
}

const value = (lead: Lead, key: Parameters<typeof getDossierFieldValue>[1], companyCurrency?: CurrencyDisplay) => {
    const raw = getDossierFieldValue(lead, key, companyCurrency ? { companyCurrency } : undefined);
    return isMeaningfulDossierValue(raw) ? raw.trim() : "";
};

const join = (parts: string[], separator = " · ") => parts.filter(Boolean).join(separator);

interface KeyFactLabels {
    preferredTime: (time: string) => string;
    addedBy: (name: string) => string;
    score: (score: string) => string;
    webinarAttended: string;
    webinarRegistered: string;
    lastWebinar: (date: string) => string;
    ebook: string;
}

/**
 * Key facts, from the lead's own fields only (the same reads as the lead
 * page's dossier). A group with nothing recorded comes back empty, and the
 * page shows it as needing input.
 */
export function buildKeyFacts(lead: Lead, labels: KeyFactLabels, companyCurrency?: CurrencyDisplay): KeyFactGroup[] {
    const v = (key: Parameters<typeof getDossierFieldValue>[1]) => value(lead, key, companyCurrency);
    const yes = (key: Parameters<typeof getDossierFieldValue>[1]) => v(key) === "Yes";

    const phone = v("mobile");
    const email = v("email");
    const reachLines = [
        phone ? email : "",
        join([
            // Same number as the phone: just say they're on WhatsApp.
            v("whatsapp") ? (v("whatsapp") === phone ? "WhatsApp" : `WhatsApp ${v("whatsapp")}`) : "",
            v("telegram") ? `Telegram ${v("telegram")}` : "",
        ]),
        v("preferredContactTime") ? labels.preferredTime(v("preferredContactTime")) : "",
    ];

    const who = [v("dateOfBirthAndAge"), v("nationality"), v("gender")].filter(Boolean);
    const work = join([v("occupation"), v("companyName")]);
    const languages = v("languages");

    const city = join([v("city"), v("state")], ", ");
    const country = v("country");
    const address = v("address");

    // Formatted as the lead page's header does.
    const rawAmount = v("leadValue");
    const currency = resolveCurrencyDisplay(v("currency") || null, companyCurrency);
    const amount = Number(rawAmount.replace(/,/g, ""));
    const valueText = !rawAmount
        ? ""
        : Number.isFinite(amount)
          ? formatMoneyAmount(amount, currency, "code")
          : join([currency.code ?? "", rawAmount], " ");

    const source = v("source");
    const category = v("category");
    const engagement = [
        yes("hasAttendedWebinar") ? labels.webinarAttended : yes("hasRegisteredWebinar") ? labels.webinarRegistered : "",
        v("lastWebinarDate") ? labels.lastWebinar(v("lastWebinarDate")) : "",
        yes("hasDownloadedEbook") ? labels.ebook : "",
    ];
    const score = v("contactScore");
    const addedBy = v("addedBy");

    const group = (id: KeyFactGroupId, items: string[]): KeyFactGroup => {
        const filled = items.filter(Boolean);
        return { id, lead: filled[0] ?? "", lines: filled.slice(1) };
    };

    return [
        group("reach", [phone || email, ...reachLines]),
        group("who", [join(who), work, languages]),
        group("where", [city || country, city ? country : "", address]),
        group("value", [valueText]),
        group("came_from", [
            source,
            category,
            ...engagement,
            score ? labels.score(score) : "",
            addedBy ? labels.addedBy(addedBy) : "",
        ]),
    ];
}

/* ---------- coming up ---------- */

export type ComingUpItem =
    | { kind: "task"; id: number; title: string; at: number | null; state: TimeState; preview: WorkspaceTaskPreview; due: string | null }
    | { kind: "meeting"; id: number; title: string; at: number | null; state: TimeState; preview: WorkspaceMeetingPreview };

const HOUR_MS = 60 * 60 * 1000;

function meetingState(meeting: WorkspaceMeetingPreview, nowMs: number): TimeState {
    if (meeting.isLive) return "now";
    if (!meeting.startsAt) return "none";
    return meeting.startsAt.getTime() - nowMs <= HOUR_MS ? "soon" : "later";
}

/**
 * What is next with this person: open tasks and meetings that are running or
 * still ahead, soonest first; undated tasks close the list. A task's due date
 * is a wall-clock string in the viewer's zone (Task::wallClockString), so its
 * state uses the same rules as Today's queue.
 */
export function buildComingUp(
    tasks: Task[],
    meetings: WorkspaceMeetingPreview[],
    nowMs: number,
    timeZone: string,
): ComingUpItem[] {
    const items: ComingUpItem[] = [
        ...tasks
            .map((task) => ({ task, preview: toWorkspaceTaskPreview(task) }))
            .filter(({ preview }) => preview.isOpen)
            .map(({ task, preview }) => {
                const due = task.due_date ?? null;
                const at = due ? wallClockToMs(hasDueTime(due) ? due : `${due.slice(0, 10)} 00:00:00`, timeZone) : null;
                return {
                    kind: "task" as const,
                    id: task.id,
                    title: preview.title,
                    at: at !== null && Number.isNaN(at) ? null : at,
                    state: taskTimeState({ due_date: due, done: false }, nowMs, timeZone),
                    preview,
                    due,
                };
            }),
        ...meetings
            .filter((meeting) => meeting.isLive || meeting.isUpcoming)
            .map((meeting) => ({
                kind: "meeting" as const,
                id: meeting.id,
                title: meeting.title,
                at: meeting.startsAt?.getTime() ?? null,
                state: meetingState(meeting, nowMs),
                preview: meeting,
            })),
    ];

    return items.sort((left, right) => {
        if (left.at !== null && right.at !== null) return left.at - right.at;
        if (left.at !== null) return -1;
        if (right.at !== null) return 1;
        return left.title.localeCompare(right.title);
    });
}
