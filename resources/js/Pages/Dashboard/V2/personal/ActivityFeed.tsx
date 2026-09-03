import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { REDESIGN_TOKENS as T, initialsFromName } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { CrmEvent } from "@/Types/api/crm-event";

// Extended here rather than relied on from CrmEventItem: this panel must not
// break because an unrelated component stopped being imported. dayjs.extend
// is idempotent.
dayjs.extend(relativeTime);

/** The record an event happened on, resolved server-side from model_type/id. */
type ActivityRecord = { type: "lead" | "deal"; id: number; name: string };

export type ActivityEvent = CrmEvent & { record?: ActivityRecord | null };

interface ActivityFeedProps {
    events: ActivityEvent[];
    onOpenRecord: (record: ActivityRecord) => void;
}

/**
 * Calls, notes, uploads and stage changes on this person's records.
 *
 * A flat list of initials, one line of text and a relative time — not the
 * timeline's CrmEventItem, which carries category tints, generation and
 * direction badges and an expander. Those distinctions matter on a record
 * page where the reader is auditing one deal; in a dashboard panel they are
 * five competing colours next to a queue that is already using red and amber
 * to mean something.
 *
 * Text is fragments joined by middots rather than a generated sentence: the
 * event stores an actor, a type and a record, and inventing verbs to glue
 * them into prose would put words in the log's mouth.
 */
export default function ActivityFeed({
    events,
    onOpenRecord,
}: ActivityFeedProps) {
    const { td } = useTd();

    if (!events.length) {
        return (
            <div
                style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 4 }}
            >
                <div
                    aria-hidden
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
                        flex: "none",
                        background: T.GRAY,
                        border: `1px solid ${T.BORDER}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <svg
                        width={18}
                        height={18}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={T.TEXT_HINT}
                        strokeWidth={1.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ display: "block" }}
                    >
                        <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z" />
                        <path d="M12 7v5l3 2" />
                    </svg>
                </div>
                <div>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 14,
                            fontWeight: 600,
                            color: T.NAVY,
                        }}
                    >
                        {td("No activity yet")}
                    </p>
                    <p
                        style={{
                            margin: 0,
                            fontSize: 13,
                            lineHeight: 1.5,
                            color: T.TEXT_MUTED,
                        }}
                    >
                        {td(
                            "Calls, notes, uploads and stage changes on your records will appear here.",
                        )}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            {events.map((event, index) => {
                const actor = event.user?.name ?? td("System");
                const label = event.event_type?.name ?? td("Activity");
                const when = event.occurred_at ?? event.created_at;

                return (
                    <div
                        key={event.uuid}
                        style={{
                            display: "flex",
                            gap: 11,
                            padding: "11px 0",
                            alignItems: "flex-start",
                            borderTop: index
                                ? `1px solid ${T.BORDER_SOFT}`
                                : undefined,
                        }}
                    >
                        <span
                            aria-hidden
                            style={{
                                width: 26,
                                height: 26,
                                borderRadius: 999,
                                flex: "none",
                                background: T.GRAY,
                                border: `1px solid ${T.BORDER}`,
                                color: T.TEXT_MUTED,
                                fontSize: 12,
                                fontWeight: 600,
                                lineHeight: "24px",
                                textAlign: "center",
                            }}
                        >
                            {event.user?.name
                                ? initialsFromName(event.user.name)
                                : "SY"}
                        </span>

                        <p
                            style={{
                                flex: 1,
                                minWidth: 0,
                                margin: 0,
                                fontSize: 13.5,
                                lineHeight: 1.5,
                                color: T.TEXT,
                            }}
                        >
                            <span style={{ fontWeight: 600 }}>{actor}</span>
                            {" · "}
                            {label}
                            {event.record && (
                                <>
                                    {" · "}
                                    <button
                                        type="button"
                                        className="dv2-row-open"
                                        onClick={() =>
                                            onOpenRecord(event.record!)
                                        }
                                        style={{
                                            fontSize: 13.5,
                                            color: T.BLUE,
                                        }}
                                    >
                                        {event.record.name}
                                    </button>
                                </>
                            )}
                        </p>

                        <span
                            style={{
                                flex: "none",
                                fontSize: 12,
                                lineHeight: 1.5,
                                color: T.TEXT_HINT,
                                whiteSpace: "nowrap",
                            }}
                        >
                            {when ? dayjs(when).fromNow(true) : "—"}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
