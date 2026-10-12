import { useMemo, type ReactNode } from "react";
import dayjs from "dayjs";
import { Badge, Icon, REDESIGN_TOKENS as T } from "@/Components/Redesign";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { toWorkspaceMeetingListItem } from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import type { ScheduleEntry } from "../types";
import {
    agendaDay,
    durationLabel,
    isAgendaActive,
    isAgendaLive,
    isAgendaUpcoming,
} from "./format";

interface AgendaTimelineProps {
    meetings: ScheduleEntry[];
    now: string;
    /** Ticking client clock; when omitted, `now` is used. */
    clock?: string;
    onOpenMeeting: (meeting: ScheduleEntry) => void;
    /** Opens the Schedule Meeting drawer. */
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
    clock,
    onOpenMeeting,
    onScheduleMeeting,
}: AgendaTimelineProps) {
    const { td } = useTd();
    const { t } = useTranslation();

    // Live + upcoming. Prefer the ticking client stamp so a meeting that
    // started (or ended) while this page was open moves buckets without reload.
    const clockStamp = clock ?? now;
    const items = useMemo(
        () =>
            meetings
                .filter((meeting) =>
                    isAgendaActive(meeting.at, meeting.duration, clockStamp),
                )
                .sort((a, b) => (a.at as string).localeCompare(b.at as string)),
        [meetings, clockStamp],
    );

    const nextUpcomingId = useMemo(() => {
        const next = items.find((meeting) =>
            isAgendaUpcoming(meeting.at, clockStamp),
        );
        return next?.id ?? null;
    }, [items, clockStamp]);

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
                    <Icon name="calendar" size={18} color={T.TEXT_HINT} />
                </div>

                <p
                    style={{
                        margin: 0,
                        fontSize: 15,
                        fontWeight: 600,
                        color: T.NAVY,
                    }}
                >
                    {t("pages.dashboard.personal.agenda.empty_title")}
                </p>
                <p style={{ margin: 0, fontSize: 13, color: T.TEXT_MUTED }}>
                    {t("pages.dashboard.personal.agenda.empty_body")}
                </p>

                <button
                    type="button"
                    className="dr-btn dr-btn-primary"
                    style={{ marginTop: 4 }}
                    onClick={onScheduleMeeting}
                >
                    <Icon name="plus" size={14} />
                    {t("pages.dashboard.personal.agenda.schedule")}
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
                    {t("pages.dashboard.personal.agenda.title")}
                </h2>
                <Badge variant="gray">
                    {items.length}{" "}
                    {items.length === 1
                        ? t("pages.dashboard.personal.agenda.meeting")
                        : t("pages.dashboard.personal.agenda.meetings")}
                </Badge>
                <button
                    type="button"
                    className="dr-btn dr-btn-primary dr-btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={onScheduleMeeting}
                >
                    <Icon name="plus" size={13} />
                    {t("pages.dashboard.personal.agenda.add")}
                </button>
            </header>

            <div>
                {items.map((meeting, index) => {
                    const live = isAgendaLive(
                        meeting.at,
                        meeting.duration,
                        clockStamp,
                    );
                    const isNext = !live && meeting.id === nextUpcomingId;
                    const listItem = toWorkspaceMeetingListItem(meeting);
                    const duration = durationLabel(meeting.duration, t);
                    const whereLabel =
                        listItem.locationType === "phone"
                            ? t("pages.dashboard.personal.agenda.phone_call")
                            : listItem.locationType === "video"
                              ? td(listItem.platformLabel, { source: "en" })
                              : td(listItem.locationDisplay, { source: "en" });
                    const whereIcon =
                        listItem.locationType === "video"
                            ? "video"
                            : listItem.locationType === "phone"
                              ? "phone"
                              : "map-pin";

                    const withRows: Array<{
                        icon: string;
                        label: string;
                        value: string;
                    }> = [];
                    if (meeting.deal?.name) {
                        withRows.push({
                            icon: "briefcase",
                            label: t("pages.dashboard.personal.record.deal"),
                            value: meeting.deal.name,
                        });
                    }
                    const leadName =
                        meeting.lead?.client_name ||
                        meeting.deal?.contact?.client_name ||
                        null;
                    if (leadName && leadName !== meeting.deal?.name) {
                        withRows.push({
                            icon: "user",
                            label: t("pages.dashboard.personal.record.lead"),
                            value: leadName,
                        });
                    }

                    return (
                        <div
                            key={meeting.id}
                            className="dv2-row"
                            style={{
                                display: "flex",
                                gap: 12,
                                padding: "12px 16px",
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
                                    {agendaDay(meeting.at as string, t)}
                                </div>
                                <div
                                    style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: live
                                            ? T.RED
                                            : isNext
                                              ? T.BLUE
                                              : T.TEXT,
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
                                    background: live
                                        ? T.RED
                                        : isNext
                                          ? T.BLUE
                                          : T.NAVY,
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
                                        {listItem.title}
                                    </span>
                                    {live && (
                                        <Badge
                                            variant="red"
                                            style={{
                                                letterSpacing: "0.04em",
                                                textTransform: "uppercase",
                                                padding: "4px 7px",
                                            }}
                                        >
                                            {t("pages.dashboard.personal.agenda.live")}
                                        </Badge>
                                    )}
                                    {isNext && (
                                        <Badge
                                            variant="blue"
                                            style={{
                                                letterSpacing: "0.04em",
                                                textTransform: "uppercase",
                                                padding: "4px 7px",
                                            }}
                                        >
                                            {t("pages.dashboard.personal.agenda.next")}
                                        </Badge>
                                    )}
                                </span>

                                <span
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: 4,
                                        marginTop: 6,
                                    }}
                                >
                                    {meeting.type &&
                                        meeting.type !== listItem.title && (
                                            <AgendaMetaRow
                                                icon="tag"
                                                label={t(
                                                    "pages.dashboard.personal.agenda.type",
                                                )}
                                                value={meeting.type}
                                            />
                                        )}
                                    <AgendaMetaRow
                                        icon={whereIcon}
                                        label={
                                            listItem.locationType ===
                                            "in_person"
                                                ? t(
                                                      "pages.dashboard.personal.agenda.place",
                                                  )
                                                : t(
                                                      "pages.dashboard.personal.agenda.where",
                                                  )
                                        }
                                        value={whereLabel}
                                    />
                                    {withRows.map((row) => (
                                        <AgendaMetaRow
                                            key={`${row.label}-${row.value}`}
                                            icon={row.icon}
                                            label={row.label}
                                            value={row.value}
                                        />
                                    ))}
                                </span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function AgendaMetaRow({
    icon,
    label,
    value,
}: {
    icon: string;
    label: string;
    value: ReactNode;
}) {
    return (
        <span
            style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                minWidth: 0,
                fontSize: 12.5,
                color: T.TEXT_MUTED,
                lineHeight: 1.35,
            }}
        >
            <Icon name={icon} size={12} color={T.TEXT_HINT} />
            <span
                style={{
                    flex: "none",
                    fontWeight: 600,
                    color: T.TEXT_HINT,
                }}
            >
                {label}
            </span>
            <span
                style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: T.TEXT,
                }}
            >
                {value}
            </span>
        </span>
    );
}

/**
 * Fallback while meetings are in flight — same card as the loaded agenda so
 * the slot still reads as "your meetings", not a blank pulse.
 */
export function AgendaTimelineSkeleton({ rows = 3 }: { rows?: number }) {
    const { t } = useTranslation();
    const agendaTitle = t("pages.dashboard.personal.agenda.title");

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={agendaTitle}
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
                    {agendaTitle}
                </h2>
            </header>

            <div aria-hidden>
                {Array.from({ length: rows }).map((_, index) => (
                    <div
                        key={index}
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
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "flex-end",
                                gap: 6,
                                paddingTop: 1,
                            }}
                        >
                            <div
                                className="dr-skeleton"
                                style={{
                                    width: 40,
                                    height: 10,
                                    borderRadius: 4,
                                }}
                            />
                            <div
                                className="dr-skeleton"
                                style={{
                                    width: 48,
                                    height: 14,
                                    borderRadius: 4,
                                }}
                            />
                        </div>
                        <div
                            style={{
                                width: 2,
                                alignSelf: "stretch",
                                minHeight: 36,
                                borderRadius: 2,
                                background: T.BORDER_SOFT,
                                flex: "none",
                            }}
                        />
                        <div
                            style={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                flexDirection: "column",
                                gap: 8,
                                paddingTop: 2,
                            }}
                        >
                            <div
                                className="dr-skeleton"
                                style={{
                                    height: 14,
                                    width: `${62 - index * 8}%`,
                                    borderRadius: 6,
                                }}
                            />
                            <div
                                className="dr-skeleton"
                                style={{
                                    height: 11,
                                    width: `${48 - index * 6}%`,
                                    borderRadius: 6,
                                }}
                            />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
