import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import type {
    CrmEvent,
    CrmEventDirection,
    CrmEventStatus,
} from "@/Types/api/crm-event";

dayjs.extend(relativeTime);

export type TimelineFilter = "all" | "agent" | "system" | "external";

export type TimelineDotVariant = "agent" | "system" | "external";

export interface TimelineEventViewModel {
    id: string;
    type: Exclude<TimelineFilter, "all">;
    title: string;
    /** True when `title` is already localized and should not be passed through td(). */
    titleLocalized?: boolean;
    meta: string;
    dot: TimelineDotVariant;
    /** Human summary override from metadata (e.g. "Contact → In Progress"). */
    grouped?: string;
    details?: Array<[string, string, string]>;
    /** Number of changed fields — drives the v2.2 "Category · N fields" label. */
    changeCount?: number;
    preview?: string;
    /** Raw editable comment (metadata.comment) — feeds the edit form. */
    comment?: string;
    categoryName?: string;
    status: CrmEventStatus;
    direction?: CrmEventDirection | null;
    /**
     * Call-specific detail for the `call_*` events: whether a recording exists
     * and where to play it, plus the phone number and duration for the summary.
     */
    call?: {
        phone: string | null;
        durationSeconds: number | null;
        /** Present when audio was captured for this call. */
        recordingId: number | null;
        /** Stream URL for inline playback. */
        playUrl: string | null;
        downloadUrl: string | null;
        filename: string | null;
        expired: boolean;
    };
    /**
     * Recorded by hand via Log Action (custom event type) rather than written
     * by the system as an audit trail. Only these may be edited/deleted.
     */
    isAgentLogged: boolean;
    occurredAt: string;
}

/**
 * Formats a call duration (seconds) using the locale's own duration strings.
 *
 * `t` supplies the three shapes (`pages.call_summary.duration_*`); the params
 * are declared there so the translator controls the unit wording, not just the
 * digits.
 */
function formatCallDuration(seconds: number, t: (key: string) => string): string {
    if (!Number.isFinite(seconds) || seconds <= 0) {
        return "";
    }

    const total = Math.round(seconds);
    const hours = Math.floor(total / 3600);
    const mins = Math.floor((total % 3600) / 60);
    const secs = total % 60;

    if (hours > 0) {
        return t("pages.call_summary.duration_hms")
            .replace(":h", String(hours))
            .replace(":m", String(mins))
            .replace(":s", String(secs));
    }

    if (mins > 0) {
        return t("pages.call_summary.duration_ms")
            .replace(":m", String(mins))
            .replace(":s", String(secs).padStart(2, "0"));
    }

    return t("pages.call_summary.duration_s").replace(":s", String(secs));
}

/**
 * Call detail carried by the timeline for `call_*` events.
 *
 * The recording link is what makes a call playable in place: the recording is
 * stamped onto the event's metadata after the upload finishes, so the timeline
 * row for the call already knows which recording belongs to it.
 */
function buildCallDetails(event: CrmEvent): TimelineEventViewModel["call"] {
    const slug = event.event_type?.slug ?? "";
    if (!slug.startsWith("call_")) {
        return undefined;
    }

    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const recordingId =
        typeof meta.recording_id === "number"
            ? meta.recording_id
            : null;

    return {
        phone:
            typeof meta.phone_number === "string" && meta.phone_number.trim() !== ""
                ? meta.phone_number.trim()
                : null,
        durationSeconds: typeof meta.duration === "number" ? meta.duration : null,
        recordingId,
        // Streams the bytes back with a decodable Content-Type; the object
        // storage link only works as a download.
        playUrl: recordingId !== null ? route("call-recordings.play", recordingId) : null,
        downloadUrl:
            typeof meta.download_url === "string" && meta.download_url !== ""
                ? meta.download_url
                : null,
        filename:
            typeof meta.filename === "string" && meta.filename !== ""
                ? meta.filename
                : null,
        // Expiry is not carried in the event metadata; the play endpoint
        // answers 410 for an expired recording and the player surfaces that.
        expired: false,
    };
}

/** Joins already-translated parts with the locale's separator. */
function joinParts(parts: string[], t: (key: string) => string): string {
    const separator = t("pages.call_summary.separator");
    return parts.filter((part) => part !== "").join(separator);
}

/**
 * Describes a call event in plain language, e.g.
 * "Inbound call from +49 170 · completed · 2m 05s · Recording available".
 *
 * `t` resolves every user-facing fragment — counterparty labels, outcomes,
 * duration units and the separator — from `pages.call_summary.*`.
 *
 * Returns null for non-call events so callers can fall back to the generic
 * event-type name.
 */
export function describeCallEvent(
    event: CrmEvent,
    t: (key: string) => string,
): string | null {
    const slug = event.event_type?.slug ?? "";
    if (!slug.startsWith("call_")) {
        return null;
    }

    const meta = (event.metadata ?? {}) as Record<string, unknown>;
    const phone =
        typeof meta.phone_number === "string" && meta.phone_number.trim() !== ""
            ? meta.phone_number.trim()
            : null;
    const duration =
        typeof meta.duration === "number" ? formatCallDuration(meta.duration, t) : "";

    const counterparty = phone
        ? event.direction === "inbound"
            ? `${t("pages.call_summary.inbound")} ${phone}`
            : event.direction === "outbound"
              ? `${t("pages.call_summary.outbound")} ${phone}`
              : `${t("pages.call_summary.call")} ${phone}`
        : event.direction === "inbound"
          ? t("pages.call_summary.inbound")
          : event.direction === "outbound"
            ? t("pages.call_summary.outbound")
            : t("pages.call_summary.call");

    const outcome = (() => {
        switch (slug) {
            case "call_started":
                return t("pages.call_summary.started");
            case "call_ended":
                return duration
                    ? `${t("pages.call_summary.completed")}${t("pages.call_summary.separator").trim()}${duration}`
                    : t("pages.call_summary.completed");
            case "call_missed":
                return t("pages.call_summary.missed");
            case "call_declined":
                return t("pages.call_summary.declined");
            case "call_voicemail":
                return duration
                    ? `${t("pages.call_summary.voicemail")}${t("pages.call_summary.separator").trim()}${duration}`
                    : t("pages.call_summary.voicemail");
            case "call_busy":
                return t("pages.call_summary.busy");
            case "call_failed":
                return t("pages.call_summary.failed");
            default:
                return "";
        }
    })();

    const parts = [counterparty];
    if (outcome) {
        parts.push(outcome);
    }
    // Recording linkage is stamped onto the event once the upload completes.
    if (meta.has_recording === true || typeof meta.recording_id === "number") {
        parts.push(t("pages.call_summary.recording_available"));
    }

    return joinParts(parts, t);
}

export const FILTER_TO_GENERATION_TYPE: Record<
    Exclude<TimelineFilter, "all">,
    "user_generated" | "system_generated" | "external"
> = {
    agent: "user_generated",
    system: "system_generated",
    external: "external",
};

const STATUS_LABELS: Record<CrmEventStatus, string> = {
    completed: "Completed",
    error_occurred: "Error",
    missed: "Missed",
    rejected: "Rejected",
};

const DIRECTION_LABELS: Record<CrmEventDirection, string> = {
    inbound: "Inbound",
    outbound: "Outbound",
};

function toDisplayValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return String(value);
    }
    return JSON.stringify(value);
}

export function getTimelineStatusLabel(status: CrmEventStatus): string {
    return STATUS_LABELS[status] ?? status;
}

/** dr-pill tone class for a status — color-codes the status pill. */
const STATUS_TONES: Record<CrmEventStatus, string> = {
    completed: "dr-pill-green",
    error_occurred: "dr-pill-red",
    missed: "dr-pill-amber",
    rejected: "dr-pill-red",
};

export function getTimelineStatusTone(status: CrmEventStatus): string {
    return STATUS_TONES[status] ?? "dr-pill-gray";
}

/** dr-pill tone class for a direction (v2.2: teal inbound, blue outbound). */
export function getTimelineDirectionTone(direction: CrmEventDirection): string {
    return direction === "inbound" ? "dr-pill-teal" : "dr-pill-blue";
}

export function getTimelineDirectionLabel(
    direction: CrmEventDirection,
): string {
    return DIRECTION_LABELS[direction] ?? direction;
}

/**
 * Maps one CRM event to the timeline's view model.
 *
 * `t` is the current locale's translator; only the call summary is localized
 * here — actor names and timestamps stay as-is. Pure callers can pass a
 * function that returns the key unchanged.
 */
export function crmEventToTimelineViewModel(
    event: CrmEvent,
    t: (key: string) => string,
): TimelineEventViewModel {
    const type: TimelineEventViewModel["type"] =
        event.generation_type === "user_generated"
            ? "agent"
            : event.generation_type === "external"
              ? "external"
              : "system";

    const actor =
        event.user?.name ||
        (type === "system"
            ? "System"
            : type === "external"
              ? "External"
              : "Agent");
    // Call events get a plain-language summary; everything else uses its
    // event-type name.
    const callSummary = describeCallEvent(event, t);
    const title = callSummary || event.event_type?.name || "Activity updated";
    const titleLocalized = callSummary !== null;

    const call = buildCallDetails(event);
    const meta = `${actor} · ${dayjs(event.occurred_at).fromNow()}`;

    const metadata = event.metadata ?? {};
    const changes = metadata?.changes;
    const grouped =
        typeof metadata?.grouped === "string" ? metadata.grouped : undefined;
    const previewSource =
        (typeof metadata?.comment === "string" && metadata.comment) ||
        (typeof metadata?.message === "string" && metadata.message) ||
        (typeof metadata?.preview === "string" && metadata.preview) ||
        "";

    let details: Array<[string, string, string]> | undefined;
    if (Array.isArray(changes)) {
        details = changes
            .map((item) => {
                if (!item || typeof item !== "object") return null;
                const record = item as Record<string, unknown>;
                const label =
                    typeof record.label === "string"
                        ? record.label
                        : typeof record.field === "string"
                          ? record.field
                          : "";
                if (!label) return null;
                return [
                    label,
                    toDisplayValue(record.from),
                    toDisplayValue(record.to),
                ] as [string, string, string];
            })
            .filter((item): item is [string, string, string] => !!item);
    } else if (changes && typeof changes === "object") {
        details = Object.entries(changes as Record<string, unknown>).map(
            ([label, value]) => {
                if (value && typeof value === "object" && !Array.isArray(value)) {
                    const rec = value as Record<string, unknown>;
                    return [label, toDisplayValue(rec.from), toDisplayValue(rec.to)];
                }
                return [label, "—", toDisplayValue(value)];
            },
        );
    }

    const dot: TimelineDotVariant =
        type === "agent" ? "agent" : type === "external" ? "external" : "system";

    return {
        id: event.uuid,
        type,
        title,
        titleLocalized,
        meta,
        dot,
        grouped: grouped || undefined,
        details: details && details.length > 0 ? details : undefined,
        changeCount: details?.length,
        preview: previewSource ? `"${previewSource}"` : undefined,
        comment:
            typeof metadata?.comment === "string" ? metadata.comment : undefined,
        categoryName: event.event_type?.category?.name,
        status: event.status,
        direction: event.direction,
        call,
        // Mirrors CrmEventController::isAgentLoggedEvent — a custom (non
        // system-seeded) event type means a person logged this by hand.
        isAgentLogged: event.event_type?.is_system === false,
        occurredAt: event.occurred_at,
    };
}
