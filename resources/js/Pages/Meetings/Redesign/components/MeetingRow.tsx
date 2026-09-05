import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import AvatarStack from "@/Components/Redesign/primitives/AvatarStack";
import SelectCheckbox from "@/Components/Redesign/primitives/SelectCheckbox";
import Icon from "@/Components/Redesign/primitives/Icon";
import RowActionMenu from "@/Components/Redesign/primitives/RowActionMenu";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingPresentation from "../hooks/useMeetingPresentation";
import type { MeetingBucket } from "../adapters/meetingViewModel";

/**
 * Column widths, shared with the list's header row so the two line up. The
 * responsive classes that go with them are here too — a column that drops out
 * at a breakpoint has to drop out of the header at the same one.
 */
export const MEETING_COLUMNS = {
    when: { width: 132, className: "" },
    related: { width: 220, className: "hidden lg:block" },
    platform: { width: 120, className: "hidden xl:block" },
    people: { width: 92, className: "hidden sm:block" },
    link: { width: 128, className: "hidden md:block" },
    /** The row menu's own button, so the header can reserve the same space. */
    actions: { width: 32, className: "" },
} as const;

interface MeetingRowProps {
    meeting: DealFollowup;
    bucket: MeetingBucket;
    permissions: Record<string, string>;
    userId?: number;
    onView: () => void;
    onEdit: () => void;
    onDelete: () => void;
    /** Opens the post-meeting report form. */
    onReport: () => void;
    selected: boolean;
    onToggleSelect: () => void;
}

/** The list layout of a meeting — same content as `MeetingCard`, one line tall. */
export default function MeetingRow({
    meeting,
    bucket,
    permissions,
    userId,
    onView,
    onEdit,
    onDelete,
    onReport,
    selected,
    onToggleSelect,
}: MeetingRowProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const {
        live,
        past,
        month,
        day,
        weekday,
        timeRange,
        title,
        platformLabel,
        platformIcon,
        record,
        summaryState,
        showJoin,
        participants,
        actions,
    } = useMeetingPresentation({
        meeting,
        bucket,
        permissions,
        userId,
        onView,
        onEdit,
        onDelete,
        onReport,
    });

    return (
        <div
            className="dr-meeting-row flex cursor-pointer items-center gap-4 px-4"
            onClick={onView}
            style={{
                minHeight: 64,
                borderBottom: `1px solid ${T.BORDER_SOFT}`,
                background: selected ? T.BLUE_LIGHT : undefined,
                // A live meeting is flagged by a rail rather than a full
                // border, which at row height would read as a table gridline.
                boxShadow: live ? `inset 3px 0 0 0 ${T.RED}` : undefined,
            }}
        >
            <SelectCheckbox
                checked={selected}
                onChange={onToggleSelect}
                label={td("Select meeting")}
            />

            {/* Date + time — fixed width so every row's title starts in line. */}
            <div
                className="shrink-0"
                style={{
                    width: MEETING_COLUMNS.when.width,
                    color: past ? T.TEXT_HINT : T.TEXT_MUTED,
                }}
            >
                <div
                    className="font-semibold"
                    style={{
                        fontSize: 13,
                        color: past ? T.TEXT_MUTED : T.TEXT,
                    }}
                >
                    {weekday} {day} {month}
                </div>
                <div style={{ fontSize: 12 }}>{timeRange}</div>
            </div>

            <span
                aria-hidden="true"
                className="flex shrink-0"
                style={{ color: T.TEXT_MUTED }}
            >
                <Icon name={platformIcon} size={15} />
            </span>

            {/* Title + record. The record is the second line on narrow
                screens, where there is no room for its own column. */}
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                    <span
                        className="truncate font-semibold"
                        style={{ fontSize: 14, color: T.TEXT }}
                    >
                        {title}
                    </span>
                    {live && (
                        <span
                            className="inline-flex shrink-0 animate-pulse items-center gap-1.5 font-semibold"
                            style={{
                                fontSize: 11,
                                color: T.RED,
                                background: T.RED_SOFT,
                                border: `1px solid ${T.RED_MID}`,
                                borderRadius: R.FULL,
                                padding: "1px 8px",
                            }}
                        >
                            <span
                                className="rounded-full"
                                style={{
                                    width: 5,
                                    height: 5,
                                    background: T.RED,
                                }}
                            />
                            {t("pages.meetings.card.live")}
                        </span>
                    )}
                </div>
                <div
                    className="truncate lg:hidden"
                    style={{ fontSize: 12, color: T.TEXT_MUTED }}
                >
                    {record ? td(record.name) : platformLabel}
                </div>
            </div>

            <div
                className={`min-w-0 shrink-0 ${MEETING_COLUMNS.related.className}`}
                style={{ width: MEETING_COLUMNS.related.width }}
            >
                {record ? (
                    <button
                        type="button"
                        className="dr-meeting-record block max-w-full truncate text-left font-semibold"
                        style={{ fontSize: 13, color: T.BLUE }}
                        onClick={(event) => {
                            event.stopPropagation();
                            if (record.href) router.visit(record.href);
                        }}
                    >
                        {td(record.name)}
                    </button>
                ) : (
                    <span style={{ fontSize: 13, color: T.TEXT_HINT }}>
                        {t("pages.meetings.card.no_deal")}
                    </span>
                )}
            </div>

            <div
                className={`shrink-0 truncate ${MEETING_COLUMNS.platform.className}`}
                style={{
                    width: MEETING_COLUMNS.platform.width,
                    fontSize: 12,
                    color: T.TEXT_MUTED,
                }}
            >
                {platformLabel}
            </div>

            <div
                className={`shrink-0 ${MEETING_COLUMNS.people.className}`}
                style={{ width: MEETING_COLUMNS.people.width }}
            >
                {participants.length > 0 ? (
                    <AvatarStack people={participants} />
                ) : (
                    <span
                        className="inline-flex items-center gap-1"
                        style={{ fontSize: 12, color: T.TEXT_HINT }}
                    >
                        <Icon name="user" size={13} />
                        {"—"}
                    </span>
                )}
            </div>

            <div
                className={`shrink-0 text-right ${MEETING_COLUMNS.link.className}`}
                style={{ width: MEETING_COLUMNS.link.width }}
                onClick={(event) => event.stopPropagation()}
            >
                {summaryState === "ready" && (
                    <button
                        type="button"
                        className="dr-meeting-link inline-flex items-center gap-1.5 font-semibold"
                        style={{ fontSize: 12, color: T.GREEN }}
                        onClick={onView}
                    >
                        <Icon name="file-text" size={13} />
                        {t("pages.meetings.card.view_summary")}
                    </button>
                )}
                {summaryState === "generating" && (
                    <span
                        className="truncate font-semibold"
                        style={{
                            fontSize: 11,
                            color: T.AMBER,
                            background: T.AMBER_BANNER,
                            border: `1px solid ${T.AMBER_MID}`,
                            borderRadius: R.FULL,
                            padding: "2px 9px",
                        }}
                    >
                        {t("pages.meetings.card.generating_summary")}
                    </span>
                )}
                {summaryState !== "ready" && showJoin && (
                    <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dr-meeting-link inline-flex items-center gap-1.5 font-semibold"
                        style={{ fontSize: 12, color: T.BLUE }}
                    >
                        <Icon name="video" size={13} />
                        {t("pages.meetings.card.actions.join_meeting")}
                    </a>
                )}
            </div>

            <div
                className="shrink-0"
                onClick={(event) => event.stopPropagation()}
            >
                <RowActionMenu
                    actions={actions}
                    ariaLabel={td("Meeting actions")}
                />
            </div>
        </div>
    );
}
