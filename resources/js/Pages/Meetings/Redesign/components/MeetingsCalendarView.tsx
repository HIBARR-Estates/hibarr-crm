import { useMemo } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezonePlugin from "dayjs/plugin/timezone";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { initialsFromName } from "@/Components/Redesign/adapters/initials";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { isVideoPlatform } from "@/Components/Redesign/meeting/meetingFormUtils";
import { platformLabelKey, type MeetingBucket } from "../adapters/meetingViewModel";
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
    added_by_id: number | null;
    participants: number[];
}

export interface CalendarPerson {
    id: number;
    name: string;
    image?: string | null;
}

export interface CalendarPayload {
    month: string;
    events: CalendarEvent[];
    people: CalendarPerson[];
}

interface MeetingsCalendarViewProps {
    data: CalendarPayload;
    /** Selected "Calendar for" person, or null for everyone. */
    personId: number | null;
    onPersonChange: (personId: number | null) => void;
    onMonthChange: (month: string) => void;
    /** The viewer's own tasks/events/tickets/leave for this month. */
    overlayEvents: UserCalendarEvent[];
    visibleOverlayTypes: UserCalendarEventType[];
    onToggleOverlayType: (type: UserCalendarEventType) => void;
    currentUserId?: number;
}

/** Chips per cell before the rest collapse into "+N more". */
const MAX_CHIPS = 3;

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
];

/** Tone by what the meeting is: live shouts, video/phone/on-site each differ. */
function chipTone(event: CalendarEvent) {
    if (event.bucket === "live") {
        return { bg: T.RED_SOFT, border: T.RED_MID, color: T.RED };
    }
    if (isVideoPlatform(event.location)) {
        return { bg: T.BLUE_LIGHT, border: T.BLUE_MID, color: T.BLUE_DARK };
    }
    if (event.location === "phone") {
        return { bg: T.TEAL_SOFT, border: T.TEAL_MID, color: T.TEAL };
    }
    return { bg: T.NAVY_SOFT, border: T.NAVY_MID, color: T.NAVY };
}

export default function MeetingsCalendarView({
    data,
    personId,
    onPersonChange,
    onMonthChange,
    overlayEvents,
    visibleOverlayTypes,
    onToggleOverlayType,
    currentUserId,
}: MeetingsCalendarViewProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { timezone, formatTime } = useUserDateTime();

    const monthStart = dayjs(`${data.month}-01`);

    const weekdays = useMemo(() => {
        // Week starts Monday; derived from dayjs so it follows the locale.
        const monday = dayjs().startOf("week").day(1);
        return Array.from({ length: 7 }, (_, index) =>
            monday.add(index, "day").format("ddd"),
        );
    }, []);

    // Person filter is applied here rather than server-side: the month's
    // events are already on the page, so switching people is instant.
    const meetingsByDay = useMemo(() => {
        const map = new Map<string, CalendarEvent[]>();
        data.events.forEach((event) => {
            if (!event.start) return;
            if (
                personId !== null &&
                event.added_by_id !== personId &&
                !event.participants.includes(personId)
            ) {
                return;
            }
            const key = dayjs.utc(event.start).tz(timezone).format("YYYY-MM-DD");
            const bucket = map.get(key);
            if (bucket) bucket.push(event);
            else map.set(key, [event]);
        });
        return map;
    }, [data.events, personId, timezone]);

    // The overlay is the *viewer's* own schedule, so it only makes sense while
    // the calendar is showing everyone or the viewer themselves.
    const overlayApplies =
        personId === null || (currentUserId != null && personId === currentUserId);

    /**
     * A toggle appears when the month actually has rows of that type — no dead
     * "Tickets" chip for someone who can't see tickets — or when it's switched
     * off, so a type you hid never disappears before you can bring it back.
     */
    const availableOverlayTypes = useMemo(() => {
        const present = new Set(overlayEvents.map((event) => event.event_type));
        return OVERLAY_TYPES.filter(
            (type) =>
                present.has(type.value) ||
                !visibleOverlayTypes.includes(type.value),
        );
    }, [overlayEvents, visibleOverlayTypes]);

    const overlayByDay = useMemo(() => {
        const map = new Map<string, UserCalendarEvent[]>();
        if (!overlayApplies) return map;
        overlayEvents.forEach((event) => {
            if (!visibleOverlayTypes.includes(event.event_type)) return;
            const key = userEventDayKey(event);
            if (!key) return;
            const bucket = map.get(key);
            if (bucket) bucket.push(event);
            else map.set(key, [event]);
        });
        return map;
    }, [overlayEvents, visibleOverlayTypes, overlayApplies]);

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

    const personChip = (
        person: { id: number | null; name: string },
        initials: string,
        image?: string | null,
    ) => {
        const active = personId === person.id;
        return (
            <button
                key={person.id ?? "all"}
                type="button"
                aria-pressed={active}
                onClick={() => onPersonChange(person.id)}
                className="dr-press inline-flex items-center gap-1.5 font-semibold"
                style={{
                    padding: "3px 11px 3px 3px",
                    borderRadius: R.FULL,
                    fontSize: 12,
                    cursor: "pointer",
                    border: `1px solid ${active ? T.NAVY : T.BORDER}`,
                    background: active ? T.NAVY : T.WHITE,
                    color: active ? T.WHITE : T.TEXT_MUTED,
                }}
            >
                <Avatar
                    initials={initials}
                    size={20}
                    src={image}
                    tone={
                        active
                            ? { bg: "rgba(255,255,255,0.22)", fg: T.WHITE }
                            : { bg: T.NAVY, fg: T.WHITE }
                    }
                />
                {person.name}
            </button>
        );
    };

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
                className="flex flex-wrap items-center justify-between gap-4 px-[18px] py-3.5"
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
                    <span
                        className="font-bold"
                        style={{ fontSize: 16, color: T.NAVY }}
                    >
                        {monthStart.format("MMMM YYYY")}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onMonthChange(dayjs().format("YYYY-MM"))}
                    >
                        {td("Today")}
                    </Button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span
                        className="font-bold uppercase"
                        style={{
                            fontSize: 12,
                            letterSpacing: "0.05em",
                            color: T.TEXT_HINT,
                        }}
                    >
                        {td("Calendar for")}
                    </span>
                    {personChip({ id: null, name: td("Everyone") }, td("All"))}
                    {data.people.map((person) =>
                        personChip(
                            { id: person.id, name: person.name },
                            initialsFromName(person.name),
                            person.image,
                        ),
                    )}
                </div>
            </div>

            {overlayApplies && availableOverlayTypes.length > 0 && (
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
                        const active = visibleOverlayTypes.includes(type.value);
                        return (
                            <button
                                key={type.value}
                                type="button"
                                aria-pressed={active}
                                onClick={() => onToggleOverlayType(type.value)}
                                className="dr-press inline-flex items-center gap-1.5 font-semibold"
                                style={{
                                    padding: "4px 11px",
                                    borderRadius: R.FULL,
                                    fontSize: 12,
                                    cursor: "pointer",
                                    border: `1px solid ${active ? T.BLUE_MID : T.BORDER}`,
                                    background: active ? T.BLUE_LIGHT : T.WHITE,
                                    color: active ? T.BLUE_DARK : T.TEXT_MUTED,
                                }}
                            >
                                <Icon name={type.icon} size={12} />
                                {td(type.label)}
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="grid grid-cols-7">
                {weekdays.map((weekday) => (
                    <div
                        key={weekday}
                        className="px-3 py-2.5 font-bold uppercase"
                        style={{
                            fontSize: 12,
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

                    return (
                        <div
                            key={key}
                            className="flex min-h-[118px] flex-col gap-1 p-2"
                            style={{
                                background: date ? T.WHITE : T.SURFACE_2,
                                borderRight: `1px solid ${T.BORDER_SOFT}`,
                                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                            }}
                        >
                            {date && (
                                <>
                                    <span
                                        className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-full font-semibold"
                                        style={{
                                            fontSize: 12,
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
                                            <div
                                                key={`m-${event.id}`}
                                                title={`${td(label)}${
                                                    event.record_name
                                                        ? ` — ${event.record_name}`
                                                        : ""
                                                }`}
                                                className="overflow-hidden"
                                                style={{
                                                    borderRadius: R.SM,
                                                    padding: "3px 7px",
                                                    background: tone.bg,
                                                    border: `1px solid ${tone.border}`,
                                                }}
                                            >
                                                <div
                                                    className="truncate font-semibold"
                                                    style={{
                                                        fontSize: 11,
                                                        color: tone.color,
                                                    }}
                                                >
                                                    {td(label)}
                                                </div>
                                                <div
                                                    className="truncate"
                                                    style={{
                                                        fontSize: 10,
                                                        color: T.TEXT_MUTED,
                                                    }}
                                                >
                                                    {formatTime(event.start)}
                                                </div>
                                            </div>
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
                                                    borderRadius: R.SM,
                                                    padding: "3px 7px",
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
                                                            fontSize: 11,
                                                            color: T.TEXT_MUTED,
                                                        }}
                                                    >
                                                        {label}
                                                    </span>
                                                    <span
                                                        className="block truncate"
                                                        style={{
                                                            fontSize: 10,
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
                                        <span
                                            className="font-semibold"
                                            style={{
                                                fontSize: 11,
                                                color: T.TEXT_MUTED,
                                            }}
                                        >
                                            +{overflow} {td("more")}
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
