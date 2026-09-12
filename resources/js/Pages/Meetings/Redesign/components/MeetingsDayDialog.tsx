import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import { formatMeetingTime } from "../adapters/meetingTimeLabel";
import {
    platformIconName,
    platformLabelKey,
} from "../adapters/meetingViewModel";
import type { CalendarEvent } from "./MeetingsCalendarView";
import {
    userEventHasTime,
    userEventTimeLabel,
    type UserCalendarEvent,
} from "../hooks/useUserCalendarEvents";

interface MeetingsDayDialogProps {
    /** The day being shown, or null when the dialog is closed. */
    day: { key: string; label: string } | null;
    meetings: CalendarEvent[];
    overlay: UserCalendarEvent[];
    /** Colour for a meeting's state — the grid's own `chipTone`. */
    toneOf: (event: CalendarEvent) => {
        bg: string;
        border: string;
        color: string;
    };
    onClose: () => void;
    onSelectMeeting: (meetingId: number) => void;
    /** Books a meeting on this day. Omitted when the viewer can't schedule. */
    onCreate?: () => void;
}

/**
 * Everything on one day, opened from a cell's "+N more".
 *
 * A month cell can only ever show the first few of a busy day, and expanding
 * it in place pushes every row below it out of alignment. A dialog gives the
 * day as much room as it needs without the grid moving, and is the obvious
 * place to put "add one to this day" — which is what you usually want after
 * looking at how full it already is.
 */
export default function MeetingsDayDialog({
    day,
    meetings,
    overlay,
    toneOf,
    onClose,
    onSelectMeeting,
    onCreate,
}: MeetingsDayDialogProps) {
    const { td } = useTd();
    const { t } = useTranslation();

    if (!day) return null;

    const total = meetings.length + overlay.length;

    return (
        <Modal
            open
            title={td(day.label)}
            subtitle={
                total === 1 ? `1 ${td("entry")}` : `${total} ${td("entries")}`
            }
            onClose={onClose}
            maxWidth={560}
            footer={
                <>
                    <Button variant="ghost" onClick={onClose}>
                        {t("pages.deals.common.close")}
                    </Button>
                    {onCreate && (
                        <Button
                            variant="primary"
                            onClick={onCreate}
                            icon={<Icon name="plus" size={15} />}
                        >
                            {td("Add meeting")}
                        </Button>
                    )}
                </>
            }
        >
            <div className="space-y-2">
                {meetings.map((event) => {
                    const tone = toneOf(event);
                    const labelKey = platformLabelKey(event.location);
                    const platform = labelKey
                        ? t(labelKey)
                        : td(event.location);

                    return (
                        <button
                            key={`m-${event.id}`}
                            type="button"
                            onClick={() => onSelectMeeting(event.id)}
                            className="dr-press flex w-full items-center gap-3 text-left"
                            style={{
                                padding: "10px 12px",
                                borderRadius: R.MD,
                                background: tone.bg,
                                border: `1px solid ${tone.border}`,
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            <span
                                aria-hidden="true"
                                className="flex shrink-0"
                                style={{ color: tone.color }}
                            >
                                <Icon
                                    name={platformIconName(event.location)}
                                    size={16}
                                />
                            </span>
                            <span
                                className="shrink-0 font-semibold"
                                style={{
                                    fontSize: 13,
                                    color: tone.color,
                                    fontVariantNumeric: "tabular-nums",
                                }}
                            >
                                {formatMeetingTime(event.start)}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span
                                    className="block truncate font-semibold"
                                    style={{ fontSize: 14, color: T.NAVY }}
                                >
                                    {td(event.title ?? platform)}
                                </span>
                                {event.record_name && (
                                    <span
                                        className="block truncate"
                                        style={{
                                            fontSize: 12,
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        {td(event.record_name)}
                                    </span>
                                )}
                            </span>
                            <Icon
                                name="chevron-right"
                                size={14}
                                color={T.TEXT_HINT}
                            />
                        </button>
                    );
                })}

                {/* The viewer's own tasks and events for the day, read-only —
                    they belong to other pages, and are here for context. */}
                {overlay.map((event) => (
                    <div
                        key={`o-${event.event_type}-${event.id}`}
                        className="flex items-center gap-3"
                        style={{
                            padding: "10px 12px",
                            borderRadius: R.MD,
                            background: T.SURFACE_2,
                            border: `1px solid ${T.BORDER}`,
                        }}
                    >
                        <span
                            aria-hidden="true"
                            className="shrink-0 rounded-full"
                            style={{
                                width: 8,
                                height: 8,
                                background:
                                    event.extendedProps?.bg_color ||
                                    T.GRAY_DARK,
                            }}
                        />
                        <span
                            className="shrink-0"
                            style={{ fontSize: 13, color: T.TEXT_MUTED }}
                        >
                            {userEventHasTime(event)
                                ? userEventTimeLabel(event)
                                : td("All day")}
                        </span>
                        <span
                            className="min-w-0 flex-1 truncate"
                            style={{ fontSize: 14, color: T.TEXT }}
                        >
                            {event.title?.trim() || td("Untitled")}
                        </span>
                    </div>
                ))}
            </div>
        </Modal>
    );
}
