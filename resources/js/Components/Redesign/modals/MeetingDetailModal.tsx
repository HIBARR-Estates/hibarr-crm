import { type ReactNode, useState } from "react";
import { router } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    getMeetingStatusDisplay,
    locationAddsDetail,
    toWorkspaceMeetingListItem,
} from "@/Pages/Deals/Redesign/adapters/meetingListAdapter";
import Avatar from "@/Components/Redesign/primitives/Avatar";
import Button from "@/Components/Redesign/primitives/Button";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import { Modal, ModalField } from "@/Components/Redesign/primitives/Modal";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
    REDESIGN_TYPE as TY,
} from "@/Components/Redesign/tokens";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import MeetingCalendarSyncRow from "@/Components/Redesign/meeting/MeetingCalendarSyncRow";

export interface MeetingDetailNestedControls {
    editOpen: boolean;
    rescheduleOpen: boolean;
    deleteOpen: boolean;
    summaryOpen: boolean;
    setEditOpen: (open: boolean) => void;
    setRescheduleOpen: (open: boolean) => void;
    setDeleteOpen: (open: boolean) => void;
    setSummaryOpen: (open: boolean) => void;
}

interface MeetingDetailModalProps {
    meeting: DealFollowup | null;
    canEdit: boolean;
    canDelete: boolean;
    /**
     * Rescheduling separately from editing. Defaults to `canEdit`, which is
     * what every deal/lead caller wants.
     *
     * The dashboard needs them apart: editing a meeting posts to
     * deals.follow_up_update, which requires a deal_id and 500s on a
     * lead-only follow-up, while meetings.reschedule handles both. So the
     * dashboard offers reschedule and sends editing to the record page.
     */
    canReschedule?: boolean;
    /**
     * Cancelling separately from editing, for the same reason as
     * `canReschedule`: cancelling posts the whole meeting back through the
     * deal's update endpoint, which a caller holding only a partial deal
     * (the Meetings index) can't do. Defaults to `canEdit`.
     */
    canCancel?: boolean;
    onClose: () => void;
    isUpdating: boolean;
    onCancelMeeting: () => void;
    /**
     * Marks a concluded meeting as actually held.
     *
     * Optional because only the dashboard offers it. Without someone recording
     * this, `lead_follow_up.status` never leaves 'scheduled' and any metric
     * counting held meetings has to infer them from the date instead.
     */
    onMarkHeld?: () => void;
    /** Entity-specific edit / reschedule / delete / summary modals. */
    renderNestedModals?: (controls: MeetingDetailNestedControls) => ReactNode;
    /**
     * Handles "Edit" itself instead of opening a nested modal — for callers
     * whose edit form is a sibling of this dialog rather than a child of it.
     */
    onEditRequested?: () => void;
    /**
     * The meeting's AI summary, shown as a second tab beside the details.
     *
     * Callers that leave this out keep the single-panel dialog and open their
     * own summary modal from the "View summary" pill; callers that pass it
     * get the summary in place, which is what a page whose whole subject is
     * meetings wants — one dialog, two views, no modal on top of a modal.
     */
    summaryPanel?: ReactNode;
    /**
     * Rendered at the start of the footer, before the destructive actions —
     * for controls that are about the dialog itself rather than the meeting.
     */
    footerLeading?: ReactNode;
}

const PLATFORM_PILL: Record<string, string> = {
    video: "dr-pill-blue",
    phone: "dr-pill-gray",
    in_person: "dr-pill-green",
};

function reminderLabel(reminder: { time: number; type: string }): string {
    return `${reminder.time} ${reminder.type}${reminder.time > 1 ? "s" : ""} before`;
}

interface RecordLink {
    name: string;
    href: string | null;
    type: "deal" | "lead";
}

/**
 * The deal or lead this meeting hangs off, when the caller's `meeting` object
 * carries one — the Meetings index embeds it (its list mixes meetings across
 * every deal/lead), so this only ever renders there. A Deal/Lead page's own
 * meeting objects don't carry it back — the record is already the page you're
 * on — so this quietly renders nothing for those callers.
 */
function meetingRecordLink(meeting: DealFollowup): RecordLink | null {
    if (meeting.deal) {
        return {
            name: meeting.deal.name,
            href: `/account/deals/${meeting.deal.id}`,
            type: "deal",
        };
    }
    if (meeting.lead) {
        return {
            name:
                meeting.lead.client_name_salutation ||
                meeting.lead.client_name ||
                "",
            href: route("lead-contact.show", meeting.lead.id),
            type: "lead",
        };
    }
    return null;
}

/** Meeting detail shell — view + cancel confirm; nested modals injected by wrappers. */
export default function MeetingDetailModal({
    meeting,
    canEdit,
    canDelete,
    canReschedule,
    canCancel,
    onClose,
    isUpdating,
    onCancelMeeting,
    onMarkHeld,
    renderNestedModals,
    summaryPanel,
    onEditRequested,
    footerLeading,
}: MeetingDetailModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const { formatDate } = useUserDateTime();
    const [editOpen, setEditOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const [panel, setPanel] = useState<"info" | "summary">("info");
    const [showAllAttendees, setShowAllAttendees] = useState(false);

    if (!meeting) return null;

    const item = toWorkspaceMeetingListItem(meeting);
    const dateLine = formatDate(item.startsAt, "-");
    const record = meetingRecordLink(meeting);
    const attendees = meeting.participant_users ?? [];
    const ATTENDEES_COLLAPSED_LIMIT = 4;
    const visibleAttendees = showAllAttendees
        ? attendees
        : attendees.slice(0, ATTENDEES_COLLAPSED_LIMIT);
    const hiddenAttendeeCount = attendees.length - visibleAttendees.length;
    const reminders = meeting.reminders ?? [];
    const isActionable =
        (item.isUpcoming || item.isLive) && item.statusLabel === "scheduled";
    const showReschedule = (canReschedule ?? canEdit) && isActionable;
    const showCancel = (canCancel ?? canEdit) && isActionable;
    const showSummaryBadge = item.isConcluded && item.summaryStatus !== "none";
    const summaryReady = item.summaryStatus === "available";

    const nestedControls: MeetingDetailNestedControls = {
        editOpen,
        rescheduleOpen,
        deleteOpen,
        summaryOpen,
        setEditOpen,
        setRescheduleOpen,
        setDeleteOpen,
        setSummaryOpen,
    };

    return (
        <>
            <Modal
                open={!!meeting}
                onClose={onClose}
                closeOnBackdrop
                title={td(item.title)}
                footer={
                    <>
                        {footerLeading}
                        {canDelete && (
                            <Button
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setDeleteOpen(true)}
                                disabled={isUpdating}
                            >
                                {t("pages.deals.common.delete")}
                            </Button>
                        )}
                        {showCancel && (
                            <Button
                                variant="ghost"
                                style={{ color: T.RED }}
                                onClick={() => setConfirmCancel(true)}
                                disabled={isUpdating}
                            >
                                {t(
                                    "pages.deals.workspace.meetings.cancel_meeting",
                                )}
                            </Button>
                        )}
                        <span style={{ flex: 1 }} />
                        {onMarkHeld &&
                            item.isConcluded &&
                            item.statusLabel !== "completed" && (
                                <Button
                                    variant="ghost"
                                    onClick={onMarkHeld}
                                    disabled={isUpdating}
                                >
                                    {td("Mark held")}
                                </Button>
                            )}
                        {canEdit && (
                            <Button
                                variant="primary"
                                onClick={() =>
                                    onEditRequested
                                        ? onEditRequested()
                                        : setEditOpen(true)
                                }
                                disabled={isUpdating}
                            >
                                {t("pages.deals.common.edit")}
                            </Button>
                        )}
                    </>
                }
            >
                {summaryPanel && (
                    <div className="mb-4">
                        <Segmented<"info" | "summary">
                            value={panel}
                            onChange={setPanel}
                            fullWidth
                            variant="raised"
                            ariaLabel={td("Meeting views")}
                            options={[
                                { value: "info", label: td("Meeting info") },
                                { value: "summary", label: td("Summary") },
                            ]}
                        />
                    </div>
                )}

                {summaryPanel && panel === "summary" && summaryPanel}

                {(!summaryPanel || panel === "info") && (
                    <>
                        {record && (
                            <button
                                type="button"
                                className="mb-3 flex w-full items-center gap-2 text-left"
                                style={{
                                    background: "none",
                                    border: "none",
                                    padding: 0,
                                    cursor: record.href ? "pointer" : "default",
                                    fontFamily: "inherit",
                                }}
                                onClick={() => {
                                    if (record.href) router.visit(record.href);
                                }}
                            >
                                <Icon
                                    name={
                                        record.type === "deal"
                                            ? "briefcase"
                                            : "user"
                                    }
                                    size={14}
                                    color={T.TEXT_MUTED}
                                />
                                <span
                                    className="truncate font-semibold"
                                    style={{
                                        fontSize: 14,
                                        color: record.href ? T.NAVY : T.TEXT,
                                        textDecoration: record.href
                                            ? "underline"
                                            : "none",
                                    }}
                                >
                                    {td(record.name)}
                                </span>
                                <span
                                    style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        color: T.TEXT_HINT,
                                        textTransform: "uppercase",
                                        letterSpacing: "0.04em",
                                    }}
                                >
                                    {record.type === "deal"
                                        ? td("Deal")
                                        : td("Lead")}
                                </span>
                            </button>
                        )}

                        <div className="mb-4 flex flex-wrap items-center gap-2">
                            <span
                                className={`dr-pill ${PLATFORM_PILL[item.locationType] ?? "dr-pill-gray"}`}
                            >
                                {td(item.platformLabel, { source: "en" })}
                            </span>
                            {(() => {
                                const status = getMeetingStatusDisplay(item);
                                return (
                                    <span
                                        className={`dr-pill ${status.tone}`}
                                        style={{
                                            overflow: "visible",
                                            height: "auto",
                                            lineHeight: "normal",
                                        }}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className="rounded-full"
                                            style={{
                                                width: 6,
                                                height: 6,
                                                minWidth: 6,
                                                minHeight: 6,
                                                flexShrink: 0,
                                                background: status.dotColor,
                                            }}
                                        />
                                        {td(status.label, { source: "en" })}
                                    </span>
                                );
                            })()}
                            {showSummaryBadge &&
                                (summaryReady ? (
                                    <button
                                        type="button"
                                        className="dr-pill dr-pill-teal"
                                        onClick={() =>
                                            summaryPanel
                                                ? setPanel("summary")
                                                : setSummaryOpen(true)
                                        }
                                        style={{
                                            fontSize: 12,
                                            padding: "4px 11px",
                                            cursor: "pointer",
                                            fontFamily: "inherit",
                                        }}
                                    >
                                        <Icon name="spark" size={12} />
                                        {t(
                                            "pages.deals.workspace.meetings.view_summary",
                                        )}
                                    </button>
                                ) : (
                                    <span className="dr-pill dr-pill-gray">
                                        {t(
                                            "pages.deals.workspace.meetings.ai_summary_pending",
                                        )}
                                    </span>
                                ))}
                        </div>

                        <div
                            className="mb-4 flex items-stretch gap-3"
                            style={{
                                background: T.SURFACE_2,
                                border: `1px solid ${T.BORDER}`,
                                borderRadius: R.LG,
                                padding: "12px 14px",
                            }}
                        >
                            <div
                                className="flex flex-col overflow-hidden"
                                style={{
                                    width: 52,
                                    flexShrink: 0,
                                    borderRadius: R.MD,
                                    border: `1px solid ${T.BLUE_MID}`,
                                    background: T.WHITE,
                                }}
                                aria-hidden
                            >
                                <span
                                    className="text-center font-semibold uppercase"
                                    style={{
                                        fontSize: TY.CAPTION,
                                        letterSpacing: "0.06em",
                                        color: T.WHITE,
                                        background: T.BLUE,
                                        padding: "5px 0 4px",
                                        lineHeight: 1,
                                    }}
                                >
                                    {item.monthLabel}
                                </span>
                                <span
                                    className="flex flex-1 items-center justify-center font-bold leading-none"
                                    style={{
                                        fontSize: TY.DISPLAY,
                                        color: T.NAVY,
                                        padding: "8px 0 10px",
                                    }}
                                >
                                    {item.dayLabel}
                                </span>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col justify-center gap-2">
                                <div
                                    className="font-semibold"
                                    style={{
                                        fontSize: TY.BODY_LG,
                                        color: T.TEXT,
                                        lineHeight: 1.3,
                                    }}
                                >
                                    {dateLine}
                                </div>
                                <div
                                    className="flex flex-wrap items-center gap-x-2 gap-y-0.5"
                                    style={{
                                        fontSize: TY.BODY,
                                        color: T.TEXT_MUTED,
                                    }}
                                >
                                    <span
                                        className="inline-flex items-center gap-1.5 font-medium text-sm"
                                        style={{ color: T.NAVY }}
                                    >
                                        <Icon
                                            name="clock"
                                            size={13}
                                            color={T.BLUE}
                                        />
                                        {item.timeRangeLabel}
                                    </span>
                                    <span style={{ color: T.TEXT_HINT }}>
                                        ·
                                    </span>
                                    <span>
                                        {item.durationMinutes}{" "}
                                        {t(
                                            "pages.deals.workspace.meetings.min_label",
                                        )}
                                    </span>
                                </div>
                            </div>

                            {showReschedule && (
                                <div className="flex flex-shrink-0 items-center">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setRescheduleOpen(true)}
                                        disabled={isUpdating}
                                    >
                                        {t(
                                            "pages.deals.workspace.meetings.reschedule",
                                        )}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <MeetingCalendarSyncRow
                            meeting={meeting}
                            className="mb-4"
                        />

                        <div className="mb-4">
                            {item.meetingLink ? (
                                <div
                                    className="flex items-center gap-3 rounded-lg"
                                    style={{
                                        background: T.BLUE_LIGHT,
                                        border: `1px solid ${T.BLUE_MID}`,
                                        padding: "12px 14px",
                                    }}
                                >
                                    <span
                                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                                        style={{ background: T.WHITE }}
                                    >
                                        <Icon
                                            name="video"
                                            size={17}
                                            color={T.BLUE}
                                        />
                                    </span>
                                    <div className="min-w-0 flex-1">
                                        <div
                                            className="mb-0.5 font-semibold uppercase"
                                            style={{
                                                fontSize: 12,
                                                letterSpacing: "0.05em",
                                                color: T.BLUE,
                                            }}
                                        >
                                            {t(
                                                "pages.deals.workspace.meetings.meeting_link",
                                            )}
                                        </div>
                                        <a
                                            href={item.meetingLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            title={item.meetingLink}
                                            className="block truncate font-medium underline"
                                            style={{
                                                fontSize: 13,
                                                color: T.NAVY,
                                            }}
                                        >
                                            {item.meetingLink}
                                        </a>
                                    </div>
                                    {isActionable && (
                                        <a
                                            href={item.meetingLink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="dr-btn dr-btn-primary no-underline"
                                            style={{ flexShrink: 0 }}
                                        >
                                            <Icon name="video" size={14} />
                                            {t(
                                                "pages.deals.workspace.meetings.join_meeting",
                                            )}
                                        </a>
                                    )}
                                </div>
                            ) : (
                                // Only when it isn't just the platform pill
                                // restated — see locationAddsDetail.
                                locationAddsDetail(item) && (
                                    <div
                                        className="flex items-center gap-2"
                                        style={{
                                            fontSize: 14,
                                            color: T.TEXT_MUTED,
                                        }}
                                    >
                                        <Icon name="map-pin" size={14} />
                                        {td(item.locationDisplay)}
                                    </div>
                                )
                            )}
                        </div>

                        {meeting.remark && (
                            <ModalField
                                label={t(
                                    "pages.deals.workspace.meetings.agenda_label",
                                )}
                            >
                                <div
                                    className="text-[14px] leading-relaxed"
                                    style={{ color: T.TEXT }}
                                >
                                    {meeting.remark}
                                </div>
                            </ModalField>
                        )}

                        <ModalField
                            label={t(
                                "pages.deals.workspace.meetings.attendees",
                            )}
                        >
                            {attendees.length === 0 ? (
                                <div
                                    className="text-[13px] italic"
                                    style={{ color: T.TEXT_MUTED }}
                                >
                                    {t("pages.deals.common.none")}
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-wrap gap-2">
                                        {visibleAttendees.map((user) => (
                                            <span
                                                key={user.id}
                                                className="inline-flex items-center gap-1.5 rounded-full border py-[3px] pl-1 pr-2.5"
                                                style={{
                                                    background: T.SURFACE_2,
                                                    borderColor: T.BORDER,
                                                }}
                                            >
                                                <Avatar
                                                    type="participant"
                                                    size={22}
                                                    initials={(
                                                        user.name || "?"
                                                    )
                                                        .split(" ")
                                                        .map(
                                                            (part) => part[0],
                                                        )
                                                        .slice(0, 2)
                                                        .join("")
                                                        .toUpperCase()}
                                                />
                                                <span className="text-[13px]">
                                                    {user.name}
                                                </span>
                                            </span>
                                        ))}
                                    </div>
                                    {attendees.length >
                                        ATTENDEES_COLLAPSED_LIMIT && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setShowAllAttendees(
                                                    (current) => !current,
                                                )
                                            }
                                            className="mt-2 font-semibold"
                                            style={{
                                                background: "none",
                                                border: "none",
                                                padding: 0,
                                                cursor: "pointer",
                                                fontFamily: "inherit",
                                                fontSize: 12.5,
                                                color: T.BLUE,
                                            }}
                                        >
                                            {showAllAttendees
                                                ? td("Show fewer")
                                                : td(
                                                      `Show ${hiddenAttendeeCount} more`,
                                                      { source: "en" },
                                                  )}
                                        </button>
                                    )}
                                </>
                            )}
                        </ModalField>

                        {reminders.length > 0 && (
                            <ModalField
                                label={t(
                                    "pages.deals.workspace.meetings.reminders",
                                )}
                            >
                                <div className="flex flex-wrap gap-2">
                                    {reminders.map((reminder, index) => (
                                        <span
                                            key={index}
                                            className="dr-pill dr-pill-gray"
                                        >
                                            {td(reminderLabel(reminder), {
                                                source: "en",
                                            })}
                                        </span>
                                    ))}
                                </div>
                            </ModalField>
                        )}
                    </>
                )}

                <ConfirmDialog
                    open={confirmCancel}
                    title={t(
                        "pages.deals.workspace.meetings.cancel_meeting_confirm_title",
                    )}
                    message={t(
                        "pages.deals.workspace.meetings.cancel_meeting_confirm_message",
                    )}
                    confirmLabel={t(
                        "pages.deals.workspace.meetings.cancel_meeting",
                    )}
                    danger
                    confirmLoading={isUpdating}
                    onConfirm={() => {
                        onCancelMeeting();
                        setConfirmCancel(false);
                    }}
                    onCancel={() => setConfirmCancel(false)}
                />
            </Modal>

            {renderNestedModals?.(nestedControls)}
        </>
    );
}
