import { useEffect, useMemo, useState, type ReactNode } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import {
    platformIconName,
    platformLabelKey,
    type MeetingBucket,
} from "../adapters/meetingViewModel";
import {
    userEventDayKey,
    userEventHasTime,
    userEventTimeLabel,
    type UserCalendarEvent,
    type UserCalendarEventType,
} from "../hooks/useUserCalendarEvents";

dayjs.extend(utc);
dayjs.extend(timezonePlugin);

export interface CalendarEvent {
    id: number;
    start: string | null;
    duration: number;
    location: string;
    status: string;
    bucket: MeetingBucket;
    title: string | null;
    record_name: string | null;
    participants: number[];
    /** Hover-card detail — the chip itself shows none of this. */
    record_type?: "deal" | "lead" | null;
    host_name?: string | null;
    participant_names?: string[];
    has_link?: boolean;
    agenda?: string | null;
    attendance?: "attended" | "no_show" | null;
}

export interface CalendarPayload {
    month: string;
    events: CalendarEvent[];
}

export interface CalendarDayBuckets {
    meetings: Map<string, CalendarEvent[]>;
    overlay: Map<string, UserCalendarEvent[]>;
}

interface MeetingsCalendarViewProps {
    data: CalendarPayload;
    onMonthChange: (month: string) => void;
    /** The viewer's own tasks/events/tickets/leave for this month. */
    overlayEvents: UserCalendarEvent[];
    visibleOverlayTypes: UserCalendarEventType[];
    onToggleOverlayType: (type: UserCalendarEventType) => void;
    /** Opens the meeting's detail dialog. */
    onSelectMeeting: (meetingId: number) => void;
    /** Opens everything on one day, from a cell's "+N more". */
    onOpenDay: (day: { key: string; label: string }) => void;
    /** Hands the grouped days back up, so the day dialog shares them. */
    onBuckets?: (buckets: CalendarDayBuckets) => void;
    /**
     * Empty space in a day cell — books a new meeting on that date. Left out
     * when the viewer can't schedule, in which case cells aren't clickable.
     */
    onCreateAt?: (dayKey: string) => void;
    /**
     * Whether to offer the Zoho Calendar toggle at all. Not built yet, so
     * the chip is shown disabled with a "coming soon" tooltip, and only to
     * the staff who are meant to see it coming.
     */
    zohoAvailable: boolean;
}

/** Chips per cell before the rest collapse into "+N more". */
const MAX_CHIPS = 4;

/** Overlay types, in the order their toggles appear. */
const OVERLAY_TYPES: Array<{
    value: UserCalendarEventType;
    label: string;
    icon: string;
}> = [
    { value: "task", label: "Tasks", icon: "check-square" },
    { value: "event", label: "Events", icon: "calendar" },
    { value: "ticket", label: "Tickets", icon: "lifebuoy" },
    { value: "leave", label: "Leave", icon: "user" },
    { value: "zoho", label: "Zoho Calendar", icon: "calendar" },
];

/** Tone by what the meeting is: live shouts, video/phone/on-site each differ. */
/** Key for the chip colours, in the order a meeting moves through them. */
const LEGEND = [
    { label: "Upcoming", bg: T.GREEN_LIGHT, border: T.GREEN_MID },
    { label: "Done", bg: T.GRAY, border: T.GRAY_MID },
    { label: "Cancelled", bg: T.RED_SOFT, border: T.RED_MID },
];

/**
 * Colour by what happened to the meeting, not by which app it runs on.
 *
 * A month grid is read for state — what is still coming, what fell through,
 * what is already dealt with. Platform was the wrong axis: it made a grid of
 * blue and teal that told you nothing you couldn't get from the icon.
 *
 *   green  still to come (bright while it is running)
 *   grey   done and dealt with
 *   red    cancelled
 */
export function chipTone(event: CalendarEvent) {
    if (event.status === "cancelled") {
        return { bg: T.RED_SOFT, border: T.RED_MID, color: T.RED };
    }
    if (event.status === "completed" || event.bucket === "past") {
        return { bg: T.GRAY, border: T.GRAY_MID, color: T.GRAY_DARK };
    }
    if (event.bucket === "live") {
        // Still green — it is the most "coming up" a meeting ever gets — but
        // filled rather than tinted so it carries across a full month.
        return { bg: T.GREEN_MID, border: T.GREEN, color: T.GREEN };
    }
    return { bg: T.GREEN_LIGHT, border: T.GREEN_MID, color: T.GREEN };
}

export default function MeetingsCalendarView({
    data,
    onMonthChange,
    overlayEvents,
    visibleOverlayTypes,
    onToggleOverlayType,
    onSelectMeeting,
    onOpenDay,
    onBuckets,
    onCreateAt,
    zohoAvailable,
}: MeetingsCalendarViewProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { timezone, formatTime } = useUserDateTime();

    // Hover preview. Positioned from the pointer rather than nested in the
    // cell, because the calendar card clips its own overflow and a popover
    // inside a cell would be cut off at the edges of the grid.
    const [preview, setPreview] = useState<{
        event: CalendarEvent;
        x: number;
        y: number;
    } | null>(null);

    // Jumping straight to a month/year beyond next-month's reach, instead of
    // clicking the arrow dozens of times.
    const [monthPickerOpen, setMonthPickerOpen] = useState(false);

    const monthStart = dayjs(`${data.month}-01`);

    const weekdays = useMemo(() => {
        // Week starts Monday; derived from dayjs so it follows the locale.
        const monday = dayjs().startOf("week").day(1);
        return Array.from({ length: 7 }, (_, index) =>
            monday.add(index, "day").format("ddd"),
        );
    }, []);

    const meetingsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        data.events.forEach((event) => {
            if (!event.start) return;
            const key = dayjs
                .utc(event.start)
                .tz(timezone)
                .format("YYYY-MM-DD");
            const bucket = map.get(key);
            if (bucket) bucket.push(event);
            else map.set(key, [event]);
        });
        return map;
    }, [data.events, timezone]);

    /**
     * A toggle appears when the month actually has rows of that type — no dead
     * "Tickets" chip for someone who can't see tickets — or when it's switched
     * off, so a type you hid never disappears before you can bring it back.
     */
    const availableOverlayTypes = useMemo(() => {
        const present = new Set(overlayEvents.map((event) => event.event_type));
        return OVERLAY_TYPES.filter((type) => {
            // Zoho is the exception to "only show a toggle for a type that
            // has rows": its rows are only fetched while the toggle is on, so
            // hiding it on an empty month would leave no way to switch it
            // back off. It hangs off the integration being enabled instead.
            if (type.value === "zoho") return zohoAvailable;

            return (
                present.has(type.value) ||
                !visibleOverlayTypes.includes(type.value)
            );
        });
    }, [overlayEvents, visibleOverlayTypes, zohoAvailable]);

    const overlayByDay = useMemo(() => {
        const map = new Map<string, UserCalendarEvent[]>();
        overlayEvents.forEach((event) => {
            if (!visibleOverlayTypes.includes(event.event_type)) return;
            const key = userEventDayKey(event);
            if (!key) return;
            const bucket = map.get(key);
            if (bucket) bucket.push(event);
            else map.set(key, [event]);
        });
        return map;
    }, [overlayEvents, visibleOverlayTypes]);

    useEffect(() => {
        onBuckets?.({ meetings: meetingsByDay, overlay: overlayByDay });
    }, [meetingsByDay, overlayByDay, onBuckets]);

    const cells = useMemo(() => {
        const daysInMonth = monthStart.daysInMonth();
        // `day()` is 0=Sunday; shift so Monday is the first column.
        const leading = (monthStart.day() + 6) % 7;
        const result: Array<{ date: dayjs.Dayjs | null; key: string }> = [];

        for (let i = 0; i < leading; i += 1) {
            result.push({ date: null, key: `lead-${i}` });
        }
        for (let day = 1; day <= daysInMonth; day += 1) {
            const date = monthStart.date(day);
            result.push({ date, key: date.format("YYYY-MM-DD") });
        }
        while (result.length % 7 !== 0) {
            result.push({ date: null, key: `trail-${result.length}` });
        }
        return result;
    }, [monthStart]);

    const todayKey = dayjs().tz(timezone).format("YYYY-MM-DD");

    const shiftMonth = (delta: number) =>
        onMonthChange(monthStart.add(delta, "month").format("YYYY-MM"));

    return (
        <div
            className="overflow-hidden"
            style={{
                background: T.WHITE,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 10,
            }}
        >
            <div
                className="flex flex-wrap items-center gap-4 px-[18px] py-3.5"
                style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
            >
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label={td("Previous month")}
                            onClick={() => shiftMonth(-1)}
                            icon={<Icon name="chevron-left" size={15} />}
                        />
                        <Button
                            variant="ghost"
                            size="sm"
                            aria-label={td("Next month")}
                            onClick={() => shiftMonth(1)}
                            icon={<Icon name="chevron-right" size={15} />}
                        />
                    </div>
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() =>
                                setMonthPickerOpen((current) => !current)
                            }
                            className="font-bold"
                            style={{
                                fontSize: 16,
                                color: T.NAVY,
                                background: "none",
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            {monthStart.format("MMMM YYYY")}
                        </button>
                        {monthPickerOpen && (
                            <input
                                type="month"
                                autoFocus
                                defaultValue={monthStart.format("YYYY-MM")}
                                onChange={(event) => {
                                    if (event.target.value) {
                                        onMonthChange(event.target.value);
                                    }
                                    setMonthPickerOpen(false);
                                }}
                                onBlur={() => setMonthPickerOpen(false)}
                                style={{
                                    position: "absolute",
                                    top: "100%",
                                    left: 0,
                                    marginTop: 6,
                                    zIndex: 20,
                                    border: `1px solid ${T.BORDER}`,
                                    borderRadius: R.MD,
                                    padding: "6px 8px",
                                    fontSize: 13,
                                    background: T.WHITE,
                                    boxShadow: "0 6px 16px rgba(22,41,77,0.14)",
                                }}
                            />
                        )}
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMonthChange(dayjs().format("YYYY-MM"))}
                    >
                        {td("Today")}
                    </Button>
                </div>

                {/* A colour-coded grid needs a key, or it is guesswork. */}
                <div className="ml-auto flex flex-wrap items-center gap-3">
                    {LEGEND.map((entry) => (
                        <span
                            key={entry.label}
                            className="inline-flex items-center gap-1.5"
                            style={{ fontSize: 12.5, color: T.TEXT_MUTED }}
                        >
                            <span
                                aria-hidden="true"
                                style={{
                                    width: 13,
                                    height: 13,
                                    borderRadius: 4,
                                    background: entry.bg,
                                    border: `1px solid ${entry.border}`,
                                }}
                            />
                            {td(entry.label)}
                        </span>
                    ))}
                </div>
            </div>

            {availableOverlayTypes.length > 0 && (
                <div
                    className="flex flex-wrap items-center gap-2 px-[18px] py-2.5"
                    style={{ borderBottom: `1px solid ${T.BORDER_SOFT}` }}
                >
                    <span
                        className="font-bold uppercase"
                        style={{
                            fontSize: 12,
                            letterSpacing: "0.05em",
                            color: T.TEXT_HINT,
                        }}
                    >
                        {td("Also show")}
                    </span>
                    {availableOverlayTypes.map((type) => {
                        // Zoho is announced, not shipped: the chip renders so
                        // the work is visible, but it neither toggles nor
                        // fetches until the integration is real.
                        const pending = type.value === "zoho";
                        const active =
                            !pending &&
                            visibleOverlayTypes.includes(type.value);
                        return (
                            <button
                                key={type.value}
                                type="button"
                                aria-pressed={active}
                                aria-disabled={pending}
                                disabled={pending}
                                title={pending ? td("Coming soon") : undefined}
                                onClick={() =>
                                    pending
                                        ? undefined
                                        : onToggleOverlayType(type.value)
                                }
                                className="dr-press inline-flex items-center gap-1.5 font-semibold"
                                style={{
                                    padding: "4px 11px",
                                    borderRadius: R.FULL,
                                    fontSize: 12,
                                    cursor: pending ? "not-allowed" : "pointer",
                                    opacity: pending ? 0.6 : 1,
                                    border: `1px solid ${active ? T.BLUE_MID : T.BORDER}`,
                                    background: active ? T.BLUE_LIGHT : T.WHITE,
                                    color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                }}
                            >
                                <Icon name={type.icon} size={12} />
                                {td(type.label)}
                                {pending && (
                                    <span
                                        className="font-semibold uppercase"
                                        style={{
                                            fontSize: 10,
                                            letterSpacing: "0.04em",
                                            padding: "1px 6px",
                                            borderRadius: R.FULL,
                                            background: T.SURFACE_2,
                                            color: T.TEXT_HINT,
                                        }}
                                    >
                                        {td("Soon")}
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-7">
                {weekdays.map((weekday) => (
                    <div
                        key={weekday}
                        className="px-3 py-3 font-bold uppercase"
                        style={{
                            fontSize: 13,
                            letterSpacing: "0.05em",
                            color: T.TEXT_HINT,
                            borderBottom: `1px solid ${T.BORDER_SOFT}`,
                        }}
                    >
                        {weekday}
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-7">
                {cells.map(({ date, key }) => {
                    const dayKey = date?.format("YYYY-MM-DD");
                    const dayMeetings = dayKey
                        ? (meetingsByDay.get(dayKey) ?? [])
                        : [];
                    const dayOverlay = dayKey
                        ? (overlayByDay.get(dayKey) ?? [])
                        : [];
                    const isToday = dayKey === todayKey;

                    // Meetings claim the visible slots first — this is the
                    // Meetings page, so a task must never push one out of view.
                    const shownMeetings = dayMeetings.slice(0, MAX_CHIPS);
                    const shownOverlay = dayOverlay.slice(
                        0,
                        Math.max(0, MAX_CHIPS - shownMeetings.length),
                    );
                    const overflow =
                        dayMeetings.length +
                        dayOverlay.length -
                        shownMeetings.length -
                        shownOverlay.length;

                    const bookable = Boolean(date && onCreateAt);
                    return (
                        <div
                            key={key}
                            className={`flex min-h-[152px] flex-col gap-1.5 p-2.5${
                                bookable ? " dr-cal-cell" : ""
                            }`}
                            // The whole cell is the target: clicking anywhere
                            // that isn't a chip books that day. Chips stop the
                            // event, so there's no ambiguity about which won.
                            onClick={
                                bookable
                                    ? () =>
                                          onCreateAt!(
                                              date!.format("YYYY-MM-DD"),
                                          )
                                    : undefined
                            }
                            role={bookable ? "button" : undefined}
                            tabIndex={bookable ? 0 : undefined}
                            aria-label={
                                bookable
                                    ? td("Schedule a meeting on this day")
                                    : undefined
                            }
                            onKeyDown={
                                bookable
                                    ? (event) => {
                                          if (
                                              event.key !== "Enter" &&
                                              event.key !== " "
                                          ) {
                                              return;
                                          }
                                          event.preventDefault();
                                          onCreateAt!(
                                              date!.format("YYYY-MM-DD"),
                                          );
                                      }
                                    : undefined
                            }
                            style={{
                                background: date ? T.WHITE : T.SURFACE_2,
                                borderRight: `1px solid ${T.BORDER_SOFT}`,
                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                                cursor: bookable ? "pointer" : undefined,
                            }}
                        >
                            {date && (
                                <>
                                    <span
                                        className="inline-flex h-[26px] w-[26px] items-center justify-center rounded-full font-semibold"
                                        style={{
                                            fontSize: 13,
                                            color: isToday ? T.WHITE : T.TEXT,
                                            background: isToday
                                                ? T.BLUE
                                                : "transparent",
                                        }}
                                    >
                                        {date.date()}
                                    </span>

                                    {shownMeetings.map((event) => {
                                        const tone = chipTone(event);
                                        const labelKey = platformLabelKey(
                                            event.location,
                                        );
                                        const label =
                                            event.title ??
                                            (labelKey
                                                ? t(labelKey)
                                                : td(event.location));
                                        return (
                                            <button
                                                key={`m-${event.id}`}
                                                type="button"
                                                className="dr-cal-chip block w-full overflow-hidden text-left"
                                                onClick={(clickEvent) => {
                                                    clickEvent.stopPropagation();
                                                    onSelectMeeting(event.id);
                                                }}
                                                onMouseEnter={(hoverEvent) =>
                                                    setPreview({
                                                        event,
                                                        x: hoverEvent.clientX,
                                                        y: hoverEvent.clientY,
                                                    })
                                                }
                                                onMouseLeave={() =>
                                                    setPreview(null)
                                                }
                                                style={{
                                                    borderRadius: R.MD,
                                                    padding: "5px 9px",
                                                    background: tone.bg,
                                                    border: `1px solid ${tone.border}`,
                                                }}
                                            >
                                                <div
                                                    className="font-semibold"
                                                    style={{
                                                        fontSize: 12.5,
                                                        color: tone.color,
                                                        lineHeight: 1.3,
                                                        // Wraps rather than truncating — the
                                                        // record name is the whole point of
                                                        // adding it, so clipping it away with
                                                        // an ellipsis would defeat itself.
                                                        whiteSpace: "normal",
                                                        overflowWrap: "anywhere",
                                                        display: "-webkit-box",
                                                        WebkitLineClamp: 2,
                                                        WebkitBoxOrient: "vertical",
                                                        overflow: "hidden",
                                                    }}
                                                    title={
                                                        event.record_name
                                                            ? `${label} ${td("with")} ${event.record_name}`
                                                            : label
                                                    }
                                                >
                                                    {td(label)}
                                                    {event.record_name && (
                                                        <>
                                                            {" "}
                                                            {td("with")}{" "}
                                                            {event.record_name}
                                                        </>
                                                    )}
                                                </div>
                                                <div
                                                    className="truncate"
                                                    style={{
                                                        fontSize: 11.5,
                                                        color: T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {formatTime(event.start)}
                                                </div>
                                            </button>
                                        );
                                    })}

                                    {shownOverlay.map((event) => {
                                        const meta = OVERLAY_TYPES.find(
                                            (type) =>
                                                type.value === event.event_type,
                                        );
                                        const label =
                                            event.title?.trim() ||
                                            td(meta?.label ?? "Event");
                                        return (
                                            <div
                                                key={`o-${event.event_type}-${event.id}`}
                                                title={label}
                                                className="flex items-center gap-1.5 overflow-hidden"
                                                style={{
                                                    borderRadius: R.MD,
                                                    padding: "5px 9px",
                                                    background: T.SURFACE_2,
                                                    border: `1px solid ${T.BORDER}`,
                                                }}
                                            >
                                                <span
                                                    aria-hidden="true"
                                                    className="shrink-0 rounded-full"
                                                    style={{
                                                        width: 6,
                                                        height: 6,
                                                        background:
                                                            event.extendedProps
                                                                ?.bg_color ||
                                                            T.GRAY_DARK,
                                                    }}
                                                />
                                                <span className="min-w-0 flex-1">
                                                    <span
                                                        className="block truncate font-semibold"
                                                        style={{
                                                            fontSize: 12.5,
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {label}
                                                    </span>
                                                    <span
                                                        className="block truncate"
                                                        style={{
                                                            fontSize: 11.5,
                                                            color: T.TEXT_HINT,
                                                        }}
                                                    >
                                                        {userEventHasTime(event)
                                                            ? userEventTimeLabel(
                                                                  event,
                                                              )
                                                            : td(
                                                                  meta?.label ??
                                                                      "Event",
                                                              )}
                                                    </span>
                                                </span>
                                            </div>
                                        );
                                    })}

                                    {overflow > 0 && (
                                        <button
                                            type="button"
                                            className="dr-meeting-link text-left font-semibold"
                                            onClick={(clickEvent) => {
                                                clickEvent.stopPropagation();
                                                if (!dayKey || !date) return;
                                                onOpenDay({
                                                    key: dayKey,
                                                    label: date.format(
                                                        "dddd D MMMM",
                                                    ),
                                                });
                                            }}
                                            style={{
                                                fontSize: 12,
                                                color: T.BLUE,
                                            }}
                                        >
                                            +{overflow} {td("more")}
                                        </button>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            {preview && (
                <div
                    role="tooltip"
                    className="pointer-events-none fixed z-50"
                    style={{
                        // Nudged off the pointer so the chip underneath keeps
                        // its hover, and pulled back from either edge so a card
                        // this size still lands fully on screen.
                        width: 420,
                        top: Math.min(
                            preview.y + 14,
                            Math.max(8, window.innerHeight - 380),
                        ),
                        left: Math.min(
                            preview.x + 14,
                            Math.max(8, window.innerWidth - 436),
                        ),
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: R.LG,
                        boxShadow: "0 12px 32px rgba(16, 24, 40, 0.16)",
                        overflow: "hidden",
                    }}
                >
                    <PreviewCard event={preview.event} />
                </div>
            )}
        </div>
    );
}

/** One labelled line of the hover card. */
function PreviewLine({
    icon,
    children,
}: {
    icon: string;
    children: ReactNode;
}) {
    return (
        <div
            className="flex items-start gap-2"
            style={{ fontSize: 13, color: T.TEXT_MUTED }}
        >
            <span
                aria-hidden="true"
                className="mt-[2px] flex shrink-0"
                style={{ color: T.TEXT_HINT }}
            >
                <Icon name={icon} size={14} />
            </span>
            <span className="min-w-0 flex-1">{children}</span>
        </div>
    );
}

/**
 * What a calendar chip cannot show in the two lines it has: the record it
 * belongs to, the full time and duration, where it is happening, who is
 * hosting, who is coming, and the agenda. A month grid is only readable if
 * hovering answers "what is this?" without opening it.
 */
function PreviewCard({ event }: { event: CalendarEvent }) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { formatDate, formatTime } = useUserDateTime();

    const labelKey = platformLabelKey(event.location);
    const platform = labelKey ? t(labelKey) : td(event.location);
    const tone = chipTone(event);
    const names = event.participant_names ?? [];
    const shown = names.slice(0, 4);
    const hidden = names.length - shown.length;

    return (
        <>
            {/* Header — what it is, and what state it is in. */}
            <div
                className="flex items-start gap-2 px-3.5 py-3"
                style={{
                    background: tone.bg,
                    borderBottom: `1px solid ${T.BORDER_SOFT}`,
                }}
            >
                <span
                    aria-hidden="true"
                    className="mt-0.5 flex shrink-0"
                    style={{ color: tone.color }}
                >
                    <Icon name={platformIconName(event.location)} size={15} />
                </span>
                <span className="min-w-0 flex-1">
                    <span
                        className="block font-bold"
                        style={{ fontSize: 16, color: T.NAVY, lineHeight: 1.3 }}
                    >
                        {td(event.title ?? platform)}
                    </span>
                    {event.record_name && (
                        <span
                            className="mt-0.5 block truncate"
                            style={{ fontSize: 13, color: T.BLUE }}
                        >
                            {event.record_type === "lead"
                                ? td("Lead")
                                : td("Deal")}
                            {" · "}
                            {td(event.record_name)}
                        </span>
                    )}
                </span>
                <span
                    className="shrink-0 font-semibold uppercase"
                    style={{
                        fontSize: 10,
                        letterSpacing: "0.05em",
                        padding: "3px 8px",
                        borderRadius: R.FULL,
                        background: T.WHITE,
                        border: `1px solid ${tone.border}`,
                        color: tone.color,
                    }}
                >
                    {event.bucket === "live"
                        ? t("pages.meetings.card.live")
                        : td(event.status)}
                </span>
            </div>

            <div className="space-y-2.5 px-4 py-3.5">
                <PreviewLine icon="clock">
                    {formatDate(event.start, "-")}
                    {" · "}
                    {formatTime(event.start)}
                    {" · "}
                    {event.duration} {td("min")}
                </PreviewLine>

                <PreviewLine icon="map-pin">
                    {platform}
                    {event.has_link ? ` · ${td("Link available")}` : ""}
                </PreviewLine>

                {event.host_name && (
                    <PreviewLine icon="user">
                        {td("Host")}: {event.host_name}
                    </PreviewLine>
                )}

                <PreviewLine icon="users">
                    {names.length === 0
                        ? td("No participants")
                        : `${shown.join(", ")}${hidden > 0 ? ` +${hidden}` : ""}`}
                </PreviewLine>

                {event.attendance === "attended" && (
                    <PreviewLine icon="check-square">
                        {td("Client attended")}
                    </PreviewLine>
                )}

                {event.agenda && (
                    <p
                        className="m-0"
                        style={{
                            fontSize: 12,
                            color: T.TEXT,
                            lineHeight: 1.5,
                            borderTop: `1px solid ${T.BORDER_SOFT}`,
                            paddingTop: 8,
                        }}
                    >
                        {td(event.agenda)}
                    </p>
                )}
            </div>

            <div
                className="px-3.5 py-2"
                style={{
                    background: T.SURFACE_2,
                    borderTop: `1px solid ${T.BORDER_SOFT}`,
                    fontSize: 11,
                    color: T.TEXT_HINT,
                }}
            >
                {td("Click to open the meeting")}
            </div>
        </>
    );
}
