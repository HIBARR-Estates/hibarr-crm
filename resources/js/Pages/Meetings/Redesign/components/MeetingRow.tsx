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
    /** Clock time only; the date is carried by the day separator above. */
    time: { width: 96, className: "" },
    type: { width: 150, className: "hidden lg:block" },
    status: { width: 120, className: "hidden sm:block" },
    people: { width: 168, className: "hidden md:block" },
    /** Join button + the row menu's own button. */
    actions: { width: 92, className: "" },
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

/**
 * One meeting as a table row.
 *
 * Ordered by what actually tells rows apart: the record the meeting is with
 * leads (with its pipeline stage and contact, since a bare deal name repeats
 * across a page of meetings), the meeting type with its summary once one
 * exists, the outcome — scheduled, live, cancelled, held, no-show — and the
 * people on it. The platform gets a colored chip rather than a bare glyph so
 * a page of rows can be scanned by provider color alone.
 */
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
        timeRange,
        title,
        platformLabel,
        platformIcon,
        platformChipColor: chipColor,
        record,
        stage,
        summaryState,
        showJoin,
        participants,
        participantNames,
        stateChip,
        stateSubtext,
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

    const [startLabel] = timeRange.split(" – ");
    const minutes = meeting.duration ?? meeting.effective_duration ?? 30;
    const durationLabel =
        minutes >= 60
            ? `${Math.round((minutes / 60) * 10) / 10}${td("h")}`
            : `${minutes}${td("m")}`;

    const stageAccent = stage?.color?.trim() || T.BLUE;

    return (
        <div
            className="dr-meeting-row flex cursor-pointer items-center gap-4 px-4 py-2"
            onClick={onView}
            style={{
                // Tall enough for two two-line columns (record + subtitle,
                // status pill + countdown) at once — a fixed 64px clipped
                // whichever of the two ran long.
                minHeight: 76,
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

            {/* Start time and how long it runs. The day is above, not here. */}
            <div
                className="shrink-0"
                style={{ width: MEETING_COLUMNS.time.width }}
            >
                <div
                    className="font-semibold"
                    style={{
                        fontSize: 13,
                        color: past ? T.TEXT_MUTED : T.TEXT,
                        fontVariantNumeric: "tabular-nums",
                    }}
                >
                    {startLabel}
                </div>
                <div style={{ fontSize: 11, color: T.TEXT_HINT }}>
                    {durationLabel}
                </div>
            </div>

            {/* Platform chip — the provider's own color, so a page of rows
                can be scanned by color alone rather than reading each glyph. */}
            <span
                aria-hidden="true"
                title={platformLabel}
                className="flex shrink-0 items-center justify-center"
                style={{
                    width: 28,
                    height: 28,
                    borderRadius: R.MD,
                    background: chipColor,
                    color: T.WHITE,
                }}
            >
                <Icon name={platformIcon} size={14} />
            </span>

            {/* The type + who it's with is what makes a row identifiable, so
                it leads; the record itself is one click away just below. */}
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span
                        className="min-w-0 truncate font-semibold"
                        style={{ fontSize: 14, color: T.TEXT }}
                    >
                        {title}
                        {record && (
                            <>
                                {" "}
                                {td("with")} {td(record.name)}
                            </>
                        )}
                    </span>
                    {stage && (
                        <span
                            className="shrink-0 font-semibold"
                            style={{
                                fontSize: 10.5,
                                color: stageAccent,
                                background: `${stageAccent}18`,
                                border: `1px solid ${stageAccent}44`,
                                borderRadius: R.FULL,
                                padding: "1.5px 8px",
                            }}
                        >
                            {td(stage.name, { source: "en" })}
                        </span>
                    )}
                </div>
                <div
                    className="truncate"
                    style={{ fontSize: 12, color: T.TEXT_MUTED }}
                >
                    {record ? (
                        <button
                            type="button"
                            className="dr-meeting-record truncate"
                            style={{ fontSize: 12, color: T.NAVY }}
                            onClick={(event) => {
                                event.stopPropagation();
                                if (record.href) router.visit(record.href);
                            }}
                        >
                            {td(record.name)}
                        </button>
                    ) : (
                        <span className="lg:hidden">{platformLabel}</span>
                    )}
                </div>
            </div>

            {/* Meeting type, and — once one exists — a link straight to the
                summary, so it doesn't need its own column. */}
            <div
                className={`min-w-0 shrink-0 ${MEETING_COLUMNS.type.className}`}
                style={{ width: MEETING_COLUMNS.type.width }}
            >
                <div
                    className="truncate"
                    style={{ fontSize: 13, color: T.TEXT_MUTED }}
                >
                    {title}
                </div>
                {summaryState === "ready" && (
                    <button
                        type="button"
                        className="dr-meeting-link inline-flex items-center gap-1 font-semibold"
                        style={{ fontSize: 11.5, color: T.GREEN }}
                        onClick={(event) => {
                            event.stopPropagation();
                            onView();
                        }}
                    >
                        <Icon name="file-text" size={11} />
                        {td("Summary")}
                    </button>
                )}
                {summaryState === "generating" && (
                    <span
                        className="inline-flex items-center gap-1 animate-pulse"
                        style={{ fontSize: 11.5, color: T.TEXT_HINT }}
                    >
                        {td("Generating…")}
                    </span>
                )}
            </div>

            {/* Scheduled / live / cancelled / held / no-show. */}
            <div
                className={`shrink-0 ${MEETING_COLUMNS.status.className}`}
                style={{ width: MEETING_COLUMNS.status.width }}
            >
                {stateChip && (
                    <span
                        className={`inline-flex items-center gap-1.5 font-semibold${
                            stateChip.pulse ? " animate-pulse" : ""
                        }`}
                        style={{
                            fontSize: 11.5,
                            color: stateChip.color,
                            background: stateChip.bg,
                            border: `1px solid ${stateChip.border}`,
                            borderRadius: R.FULL,
                            padding: "3px 10px",
                        }}
                    >
                        {stateChip.pulse && (
                            <span
                                className="rounded-full"
                                style={{
                                    width: 5,
                                    height: 5,
                                    background: stateChip.color,
                                }}
                            />
                        )}
                        {stateChip.label}
                    </span>
                )}
                {stateSubtext && (
                    <div
                        className="truncate"
                        style={{
                            fontSize: 11,
                            color: T.TEXT_HINT,
                            marginTop: 3,
                            marginLeft: 2,
                        }}
                    >
                        {td(stateSubtext)}
                    </div>
                )}
            </div>

            {/* Names, not anonymous circles — a list has room for words. */}
            <div
                className={`min-w-0 shrink-0 items-center gap-2 ${MEETING_COLUMNS.people.className} md:flex`}
                style={{ width: MEETING_COLUMNS.people.width }}
            >
                {participants.length > 0 ? (
                    <>
                        <AvatarStack people={participants} />
                        <span
                            className="min-w-0 flex-1 truncate"
                            style={{ fontSize: 12, color: T.TEXT_MUTED }}
                        >
                            {participantNames}
                        </span>
                    </>
                ) : (
                    <span style={{ fontSize: 12, color: T.TEXT_HINT }}>
                        {t("pages.meetings.card.no_participants")}
                    </span>
                )}
            </div>

            <div
                className="flex shrink-0 items-center justify-end gap-1.5"
                style={{ width: MEETING_COLUMNS.actions.width }}
                onClick={(event) => event.stopPropagation()}
            >
                {showJoin && summaryState !== "ready" && (
                    <a
                        href={meeting.meeting_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold"
                        style={{
                            fontSize: 11.5,
                            color: T.WHITE,
                            background: live ? T.RED : T.BLUE,
                            borderRadius: R.MD,
                            padding: "5px 10px",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {td("Join")}
                    </a>
                )}
                <RowActionMenu
                    actions={actions}
                    ariaLabel={td("Meeting actions")}
                />
            </div>
        </div>
    );
}
