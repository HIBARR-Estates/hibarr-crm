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
     * Recorded by hand via Log Action (custom event type) rather than written
     * by the system as an audit trail. Only these may be edited/deleted.
     */
    isAgentLogged: boolean;
    occurredAt: string;
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

export function crmEventToTimelineViewModel(event: CrmEvent): TimelineEventViewModel {
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
    const title = event.event_type?.name || "Activity updated";
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
        // Mirrors CrmEventController::isAgentLoggedEvent — a custom (non
        // system-seeded) event type means a person logged this by hand.
        isAgentLogged: event.event_type?.is_system === false,
        occurredAt: event.occurred_at,
    };
}
