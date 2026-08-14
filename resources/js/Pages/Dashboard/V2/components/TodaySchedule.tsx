import { ReactNode } from "react";
import dayjs from "dayjs";
import { REDESIGN_TOKENS as T, formatTime } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ScheduleEntry } from "../types";

interface TodayScheduleProps {
    entries: ScheduleEntry[];
    onOpen: (entry: ScheduleEntry) => void;
    /** Per-row controls (Mark held, Log activity). */
    renderActions?: (entry: ScheduleEntry) => ReactNode;
}

/**
 * Today and tomorrow, from `lead_follow_up` — the CRM's meeting record.
 *
 * Tomorrow's entries are dimmed rather than split into a second panel: the
 * point of the strip is "what's left today", with tomorrow as context.
 */
export default function TodaySchedule({
    entries,
    onOpen,
    renderActions,
}: TodayScheduleProps) {
    const { td } = useTd();

    if (!entries.length) {
        return (
            <p style={{ margin: 0, fontSize: 14, color: T.TEXT_MUTED }}>
                {td("Nothing scheduled today or tomorrow.")}
            </p>
        );
    }

    const endOfToday = dayjs().endOf("day");

    return (
        <div style={{ display: "flex", flexDirection: "column" }}>
            {entries.map((entry, index) => {
                const at = entry.at ? dayjs(entry.at) : null;
                const isTomorrow = at ? at.isAfter(endOfToday) : false;

                const meta = [
                    entry.subtitle,
                    entry.type,
                    entry.location_label,
                    `${entry.duration} ${td("min")}`,
                ]
                    .filter(Boolean)
                    .join(" · ");

                return (
                    <div
                        key={entry.id}
                        className="dv2-row"
                        style={{
                            display: "flex",
                            gap: 14,
                            alignItems: "center",
                            padding: "12px 0",
                            borderTop:
                                index === 0
                                    ? undefined
                                    : `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        <button
                            type="button"
                            className="dv2-row-open"
                            onClick={() => onOpen(entry)}
                            style={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                gap: 14,
                            }}
                        >
                            <span
                                style={{
                                    width: 62,
                                    flex: "none",
                                    fontSize: 14,
                                    fontWeight: 600,
                                    color: isTomorrow ? T.TEXT_HINT : T.NAVY,
                                }}
                            >
                                {isTomorrow
                                    ? td("Tomorrow")
                                    : formatTime(entry.at, "--")}
                            </span>

                            <span style={{ flex: 1, minWidth: 0 }}>
                                <span
                                    style={{
                                        display: "block",
                                        fontSize: 14,
                                        fontWeight: 600,
                                        color: isTomorrow
                                            ? T.TEXT_MUTED
                                            : T.TEXT,
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                    }}
                                >
                                    {entry.title}
                                </span>
                                {meta && (
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 13,
                                            color: T.TEXT_HINT,
                                            marginTop: 2,
                                        }}
                                    >
                                        {isTomorrow
                                            ? `${formatTime(entry.at, "--")} · ${meta}`
                                            : meta}
                                    </span>
                                )}
                            </span>
                        </button>

                        <div
                            style={{
                                display: "flex",
                                gap: 8,
                                flex: "none",
                                alignItems: "center",
                            }}
                        >
                            {renderActions?.(entry)}
                            {/* `completed` is rarely written, so only the
                                explicit state is labelled — no inferred badge. */}
                            {entry.status === "completed" && (
                                <span className="dr-pill dr-pill-green">
                                    {td("Held")}
                                </span>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
