import { useMemo, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { CrmEvent, CrmEventsIndexResponse } from "@/Types/api/crm-event";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";

interface ActivitiesTabProps {
    leadId: number;
    leadName?: string;
}

type TimelineFilter = "all" | "agent" | "system" | "external";

interface TimelineEventRow {
    id: string;
    type: Exclude<TimelineFilter, "all">;
    title: string;
    meta: string;
    dotClass: "agent" | "system" | "external";
    grouped?: string;
    details?: Array<[string, string, string]>;
    preview?: string;
}

dayjs.extend(relativeTime);

const FILTER_TO_GENERATION_TYPE: Record<
    Exclude<TimelineFilter, "all">,
    "user_generated" | "system_generated" | "external"
> = {
    agent: "user_generated",
    system: "system_generated",
    external: "external",
};

function toDisplayValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "-";
    if (
        typeof value === "string" ||
        typeof value === "number" ||
        typeof value === "boolean"
    ) {
        return String(value);
    }
    return JSON.stringify(value);
}

function eventToRow(event: CrmEvent): TimelineEventRow {
    const type: TimelineEventRow["type"] =
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
    const meta = `${actor} - ${dayjs(event.occurred_at).fromNow()}`;

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
                    return [
                        label,
                        toDisplayValue(rec.from),
                        toDisplayValue(rec.to),
                    ];
                }
                return [label, "-", toDisplayValue(value)];
            },
        );
    }

    const dotClass: TimelineEventRow["dotClass"] =
        type === "agent"
            ? "agent"
            : type === "external"
              ? "external"
              : "system";

    return {
        id: event.uuid,
        type,
        title,
        meta,
        dotClass,
        grouped:
            grouped ||
            (details && details.length > 0
                ? `${details.length} fields changed`
                : undefined),
        details: details && details.length > 0 ? details : undefined,
        preview: previewSource ? `"${previewSource}"` : undefined,
    };
}

export default function ActivitiesTab({ leadId }: ActivitiesTabProps) {
    const [filter, setFilter] = useState<TimelineFilter>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading, isRefetching, refetch } =
        useApiQuery<CrmEventsIndexResponse>({
            path: "/api/v1/crm-events",
            params: {
                model_type: "App\\Models\\Lead",
                model_id: leadId,
                per_page: 50,
                sort_order: "desc",
                ...(filter === "all"
                    ? {}
                    : { generation_type: FILTER_TO_GENERATION_TYPE[filter] }),
            },
            options: {
                refetchInterval: 15000,
            },
        });

    const filteredEvents = useMemo(
        () => (data?.data ?? []).map(eventToRow),
        [data],
    );

    return (
        <div className="w-full">
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs text-[#6b7280]">Filter:</span>
                {(["all", "agent", "system", "external"] as TimelineFilter[]).map(
                    (currentFilter) => (
                        <button
                            key={currentFilter}
                            type="button"
                            onClick={() => setFilter(currentFilter)}
                            className={`cursor-pointer rounded-full border px-2.5 py-1 text-xs capitalize${
                                filter === currentFilter
                                    ? " border-[#16294d] bg-[#16294d] font-medium text-white"
                                    : " border-[#e2e5ea] bg-white text-[#6b7280]"
                            }`}
                        >
                            {currentFilter}
                        </button>
                    ),
                )}
                <div className="ml-auto">
                    <Button
                        variant="ghost"
                        icon={<Icon name="refresh" size={12} />}
                        onClick={() => refetch()}
                    >
                        {isRefetching ? "Refreshing..." : "Refresh"}
                    </Button>
                </div>
            </div>

            {isLoading ? (
                <p className="py-2 text-xs text-[#9ca3af]">Loading activity...</p>
            ) : filteredEvents.length === 0 ? (
                <p className="py-2 text-xs text-[#9ca3af]">No events yet.</p>
            ) : (
                filteredEvents.map((event) => (
                    <div
                        key={event.id}
                        className="mb-4 flex gap-3 border-b border-[#e2e5ea] pb-4"
                    >
                        <div className="flex flex-col items-center pt-1">
                            <div
                                className={`v2-activity-dot ${event.dotClass}`}
                            />
                            <div className="mt-1 w-px flex-1 bg-[#e2e5ea]" />
                        </div>
                        <div className="flex-1 pb-1">
                            <div className="mb-1 flex items-center gap-1.5">
                                <span className="text-[13px] font-medium">
                                    {event.title}
                                </span>
                                <span className="rounded-full border border-[#e2e5ea] bg-[#f5f6f8] px-1.5 py-0.5 text-[11px] capitalize text-[#6b7280]">
                                    {event.type}
                                </span>
                            </div>
                            <div className="text-[11px] text-[#9ca3af]">
                                {event.meta}
                            </div>
                            {event.grouped && (
                                <div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setExpandedId(
                                                expandedId === event.id
                                                    ? null
                                                    : event.id,
                                            )
                                        }
                                        className="mt-1.5 flex w-full cursor-pointer items-center justify-between rounded-md bg-[#f5f6f8] px-2.5 py-1.5 text-xs text-[#6b7280]"
                                    >
                                        <span>{event.grouped}</span>
                                        <span
                                            style={{
                                                transform:
                                                    expandedId === event.id
                                                        ? "rotate(180deg)"
                                                        : "none",
                                            }}
                                        >
                                            ▾
                                        </span>
                                    </button>
                                    {expandedId === event.id && event.details && (
                                        <div className="mt-1.5 overflow-hidden rounded-md border border-[#e2e5ea]">
                                            {event.details.map(
                                                ([label, from, to]) => (
                                                    <div
                                                        key={`${event.id}-${label}`}
                                                        className="flex items-center justify-between border-b border-[#e2e5ea] px-2.5 py-1.5 text-xs last:border-b-0"
                                                    >
                                                        <span className="text-[#6b7280]">
                                                            {label}
                                                        </span>
                                                        <span className="flex items-center gap-1.5">
                                                            <span className="italic text-[#9ca3af]">
                                                                {from}
                                                            </span>
                                                            <span className="text-[#9ca3af]">
                                                                →
                                                            </span>
                                                            <span className="font-medium text-[#1a1f2e]">
                                                                {to}
                                                            </span>
                                                        </span>
                                                    </div>
                                                ),
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            {event.preview && (
                                <p className="mt-1.5 text-xs italic leading-relaxed text-[#6b7280]">
                                    {event.preview}
                                </p>
                            )}
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
