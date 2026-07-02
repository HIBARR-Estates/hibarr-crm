import { useMemo, useState } from "react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { CrmEvent, CrmEventsIndexResponse } from "@/Types/api/crm-event";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface TimelineTabProps {
    dealId: number;
    dealName?: string;
    userId?: number;
}

type TimelineFilter = "all" | "agent" | "system" | "external";

interface TimelineEventRow {
    id: string;
    type: Exclude<TimelineFilter, "all">;
    title: string;
    meta: string;
    dot: "agent" | "sys";
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
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
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

    const actor = event.user?.name || (type === "system" ? "System" : type === "external" ? "External" : "Agent");
    const title = event.event_type?.name || "Activity updated";
    const meta = `${actor} - ${dayjs(event.occurred_at).fromNow()}`;

    const metadata = event.metadata ?? {};
    const changes = metadata?.changes;
    const grouped = typeof metadata?.grouped === "string" ? metadata.grouped : undefined;
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
                const label = typeof record.label === "string" ? record.label : typeof record.field === "string" ? record.field : "";
                if (!label) return null;
                return [label, toDisplayValue(record.from), toDisplayValue(record.to)] as [string, string, string];
            })
            .filter((item): item is [string, string, string] => !!item);
    } else if (changes && typeof changes === "object") {
        details = Object.entries(changes as Record<string, unknown>).map(([label, value]) => {
            if (value && typeof value === "object" && !Array.isArray(value)) {
                const rec = value as Record<string, unknown>;
                return [label, toDisplayValue(rec.from), toDisplayValue(rec.to)];
            }
            return [label, "-", toDisplayValue(value)];
        });
    }

    return {
        id: event.uuid,
        type,
        title,
        meta,
        dot: type === "agent" ? "agent" : "sys",
        grouped: grouped || (details && details.length > 0 ? `${details.length} fields changed` : undefined),
        details: details && details.length > 0 ? details : undefined,
        preview: previewSource ? `"${previewSource}"` : undefined,
    };
}

export default function TimelineTab({ dealId }: TimelineTabProps) {
    const [filter, setFilter] = useState<TimelineFilter>("all");
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const { data, isLoading, isRefetching, refetch } = useApiQuery<CrmEventsIndexResponse>({
        path: "/api/v1/crm-events",
        params: {
            model_type: "App\\Models\\Deal",
            model_id: dealId,
            per_page: 50,
            sort_order: "desc",
            ...(filter === "all" ? {} : { generation_type: FILTER_TO_GENERATION_TYPE[filter] }),
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
        <div className="mx-auto w-full max-w-[680px]">
            <div style={{ display: "flex", gap: 5, marginBottom: 16, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: T.TEXT_MUTED, marginRight: 4 }}>Filter:</span>
                {(["all", "agent", "system", "external"] as TimelineFilter[]).map((currentFilter) => (
                    <button
                        key={currentFilter}
                        onClick={() => setFilter(currentFilter)}
                        style={{
                            fontSize: 12,
                            padding: "4px 11px",
                            borderRadius: 20,
                            cursor: "pointer",
                            background: filter === currentFilter ? T.NAVY : T.WHITE,
                            color: filter === currentFilter ? T.WHITE : T.TEXT_MUTED,
                            border: `1px solid ${filter === currentFilter ? T.NAVY : T.BORDER}`,
                            fontWeight: filter === currentFilter ? 500 : 400,
                            textTransform: "capitalize",
                        }}
                    >
                        {currentFilter}
                    </button>
                ))}
                <div style={{ marginLeft: "auto" }}>
                    <DealButton variant="ghost" icon={<DealIcon name="calendar" size={12} />} onClick={() => refetch()}>
                        {isRefetching ? "Refreshing..." : "Refresh"}
                    </DealButton>
                </div>
                <div>
                    <DealButton variant="ghost" icon={<DealIcon name="calendar" size={12} />}>
                        Date range
                    </DealButton>
                </div>
            </div>

            {isLoading ? (
                <div style={{ fontSize: 12, color: T.TEXT_HINT, padding: "8px 0" }}>Loading activity...</div>
            ) : filteredEvents.length === 0 ? (
                <div style={{ fontSize: 12, color: T.TEXT_HINT, padding: "8px 0" }}>No events yet.</div>
            ) : (
                filteredEvents.map((event) => (
                <div
                    key={event.id}
                    style={{
                        display: "flex",
                        gap: 12,
                        paddingBottom: 16,
                        marginBottom: 16,
                        borderBottom: `1px solid ${T.BORDER}`,
                    }}
                >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 4 }}>
                        <div
                            style={{
                                width: 8,
                                height: 8,
                                borderRadius: "50%",
                                background: event.dot === "agent" ? T.GREEN : T.GRAY_MID,
                                flexShrink: 0,
                            }}
                        />
                        <div style={{ width: 1, flex: 1, background: T.BORDER, marginTop: 4 }} />
                    </div>

                    <div style={{ flex: 1, paddingBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3 }}>
                            <span style={{ fontSize: 13, fontWeight: 500 }}>{event.title}</span>
                            <span
                                style={{
                                    fontSize: 11,
                                    padding: "2px 7px",
                                    borderRadius: 10,
                                    background: T.GRAY,
                                    color: T.TEXT_MUTED,
                                    border: `1px solid ${T.BORDER}`,
                                    textTransform: "capitalize",
                                }}
                            >
                                {event.type}
                            </span>
                        </div>

                        <div style={{ fontSize: 11, color: T.TEXT_HINT }}>{event.meta}</div>

                        {event.grouped && (
                            <div>
                                <div
                                    onClick={() => setExpandedId(expandedId === event.id ? null : event.id)}
                                    style={{
                                        marginTop: 6,
                                        background: T.GRAY,
                                        borderRadius: 6,
                                        padding: "6px 10px",
                                        fontSize: 12,
                                        color: T.TEXT_MUTED,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        cursor: "pointer",
                                    }}
                                >
                                    <span>{event.grouped}</span>
                                    <span
                                        style={{
                                            display: "flex",
                                            transition: "transform 0.15s",
                                            transform: expandedId === event.id ? "rotate(180deg)" : "none",
                                        }}
                                    >
                                        ▾
                                    </span>
                                </div>

                                {expandedId === event.id && event.details && (
                                    <div
                                        style={{
                                            marginTop: 6,
                                            border: `1px solid ${T.BORDER}`,
                                            borderRadius: 6,
                                            overflow: "hidden",
                                        }}
                                    >
                                        {event.details.map(([label, from, to]) => (
                                            <div
                                                key={`${event.id}-${label}`}
                                                style={{
                                                    display: "flex",
                                                    justifyContent: "space-between",
                                                    alignItems: "center",
                                                    padding: "7px 10px",
                                                    borderBottom: `1px solid ${T.BORDER}`,
                                                    fontSize: 12,
                                                }}
                                            >
                                                <span style={{ color: T.TEXT_MUTED }}>{label}</span>
                                                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                                    <span style={{ color: T.TEXT_HINT, fontStyle: "italic" }}>
                                                        {from}
                                                    </span>
                                                    <span style={{ color: T.TEXT_HINT }}>→</span>
                                                    <span style={{ color: T.TEXT, fontWeight: 500 }}>{to}</span>
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {event.preview && (
                            <div
                                style={{
                                    marginTop: 6,
                                    fontSize: 12,
                                    color: T.TEXT_MUTED,
                                    lineHeight: 1.5,
                                    fontStyle: "italic",
                                }}
                            >
                                {event.preview}
                            </div>
                        )}
                    </div>
                </div>
                ))
            )}
        </div>
    );
}
