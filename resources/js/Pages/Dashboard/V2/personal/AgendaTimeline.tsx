import { useMemo } from "react";
import dayjs from "dayjs";
import { Badge, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { ScheduleEntry } from "../types";
import { agendaDay, durationLabel } from "./format";

interface AgendaTimelineProps {
    meetings: ScheduleEntry[];
    now: string;
    onOpenMeeting: (meeting: ScheduleEntry) => void;
    /** Opens the Schedule Meeting drawer — the empty state's own CTA. */
    onScheduleMeeting: () => void;
}

/**
 * Meetings still ahead of the clock, sorted by time.
 *
 * Tasks are deliberately not merged in here — they already have a home in
 * "Needs your attention", and showing an overdue task there and again on the
 * agenda made the same thing look like two different things.
 */
export default function AgendaTimeline({
    meetings,
    now,
    onOpenMeeting,
    onScheduleMeeting,
}: AgendaTimelineProps) {
    const { td } = useTd();

    // Strictly ahead of the clock — the server already filters this, but the
    // page's own `now` is the one both the queue and the agenda agree on.
    const items = useMemo(
        () =>
            meetings
                .filter((meeting) => meeting.at && dayjs(meeting.at).isAfter(now))
                .sort((a, b) => (a.at as string).localeCompare(b.at as string)),
        [meetings, now],
    );

    if (!items.length) {
        return (
            <div
                style={{
                    background: T.SURFACE,
                    border: `1px solid ${T.BORDER}`,
                    borderRadius: 10,
                    padding: "18px 16px",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 10,
                }}
            >
                <div
                    style={{
                        width: 38,
                        height: 38,
                        borderRadius: 999,
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
                        aria-hidden
                        style={{ display: "block" }}
                    >
                        <path d="M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z" />
                    </svg>
                </div>

                <p
                    style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: T.NAVY,
                    }}
                >
                    {td("Nothing booked")}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.TEXT_MUTED }}>
                    {td(
                        "Meetings you book with a lead or deal will show up here.",
                    )}
                </p>

                <button
                    type="button"
                    className="dr-btn dr-btn-primary"
                    style={{ marginTop: 4 }}
                    onClick={onScheduleMeeting}
                >
                    {td("Schedule meeting")}
                </button>
            </div>
        );
    }

    return (
        <div
            style={{
                background: T.SURFACE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
                overflow: "hidden",
            }}
        >
            <header
                style={{
                    padding: "13px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    borderBottom: `1px solid ${T.BORDER}`,
                }}
            >
                <h2
                    style={{
                        margin: 0,
                        fontSize: 16,
                        fontWeight: 600,
                        color: T.NAVY,
                    }}
                >
                    {td("Agenda")}
                </h2>
                <Badge variant="gray">
                    {items.length} {items.length === 1 ? td("meeting") : td("meetings")}
                </Badge>
            </header>

            <div>
                {items.map((meeting, index) => {
                    const isNext = index === 0;
                    const meta = [
                        meeting.type,
                        meeting.location_label,
                        meeting.subtitle,
                    ]
                        .filter(Boolean)
                        .join(" · ");
                    const duration = durationLabel(meeting.duration);

                    return (
                        <div
                            key={meeting.id}
                            className="dv2-row"
                            style={{
                                display: "flex",
                                gap: 12,
                                padding: "11px 16px",
                                alignItems: "flex-start",
                                borderTop: index
                                    ? `1px solid ${T.BORDER_SOFT}`
                                    : undefined,
                            }}
                        >
                            <div
                                style={{
                                    width: 66,
                                    flex: "none",
                                    textAlign: "right",
                                    paddingTop: 1,
                                }}
                            >
                                <div
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        letterSpacing: "0.04em",
                                        textTransform: "uppercase",
                                        color: T.TEXT_HINT,
                                    }}
                                >
                                    {td(agendaDay(meeting.at as string))}
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: isNext ? T.BLUE : T.TEXT,
                                    }}
                                >
                                    {dayjs(meeting.at).format("HH:mm")}
                                </div>
                                {duration && (
                                    <div
                                        style={{
                                            fontSize: 12,
                                            color: T.TEXT_HINT,
                                        }}
                                    >
                                        {duration}
                                    </div>
                                )}
                            </div>

                            <div
                                aria-hidden
                                style={{
                                    width: 2,
                                    alignSelf: "stretch",
                                    borderRadius: 2,
                                    background: isNext ? T.BLUE : T.NAVY,
                                    flex: "none",
                                }}
                            />

                            <button
                                type="button"
                                className="dv2-row-open"
                                onClick={() => onOpenMeeting(meeting)}
                                style={{ flex: 1, minWidth: 0 }}
                            >
                                <span
                                    style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 7,
                                        flexWrap: "wrap",
                                    }}
                                >
                                    <span
                                        style={{
                                            fontSize: 13.5,
                                            fontWeight: 600,
                                            color: T.NAVY,
                                        }}
                                    >
                                        {meeting.title}
                                    </span>
                                    {isNext && (
                                        <Badge
                                            variant="blue"
                                            style={{
                                                letterSpacing: "0.04em",
                                                textTransform: "uppercase",
                                                padding: "4px 7px",
                                            }}
                                        >
                                            {td("Next")}
                                        </Badge>
                                    )}
                                </span>
                                {meta && (
                                    <span
                                        style={{
                                            display: "block",
                                            fontSize: 12.5,
                                            color: T.TEXT_MUTED,
                                            marginTop: 2,
                                        }}
                                    >
                                        {meta}
                                    </span>
                                )}
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
