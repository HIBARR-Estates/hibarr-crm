import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import {
    getMeetingStatusTone,
    toWorkspaceMeetingListItem,
} from "../../adapters/meetingListAdapter";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealConfirmDialog from "../primitives/DealConfirmDialog";
import DealIcon from "../primitives/DealIcon";
import { DealModal, DealModalField } from "../primitives/DealModal";
import DealEditMeetingModal from "./DealEditMeetingModal";
import DealRescheduleMeetingModal from "./DealRescheduleMeetingModal";
import { DEAL_REDESIGN_RADIUS as R, DEAL_REDESIGN_TOKENS as T, DEAL_REDESIGN_TYPE as TY } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealMeetingUpdate from "../../hooks/useDealMeetingUpdate";
import { buildMeetingFormFromFollowup } from "./meetingFormUtils";
import { formatDateLong } from "../../adapters/dateFormat";

interface DealMeetingDetailModalProps {
    meeting: DealFollowup | null;
    deal: Deal;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    canEdit: boolean;
    canDelete: boolean;
    onClose: () => void;
}

const PLATFORM_PILL: Record<string, string> = {
    video: "dr-pill-blue",
    phone: "dr-pill-gray",
    in_person: "dr-pill-green",
};

function reminderLabel(reminder: { time: number; type: string }): string {
    return `${reminder.time} ${reminder.type}${reminder.time > 1 ? "s" : ""} before`;
}

/** v2.2 MeetingDetailModal (deal-v2-2.jsx:2417-2548) — view + real edit/reschedule/delete. */
export default function DealMeetingDetailModal({
    meeting,
    deal,
    meetingTypes,
    canEdit,
    canDelete,
    onClose,
}: DealMeetingDetailModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [editOpen, setEditOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [confirmCancel, setConfirmCancel] = useState(false);
    const [summaryOpen, setSummaryOpen] = useState(false);
    const { setDealFollowUps } = useDealWorkspace();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const { updateMeeting, isUpdating } = useDealMeetingUpdate(deal);

    if (!meeting) return null;

    const item = toWorkspaceMeetingListItem(meeting);
    const dateLine = formatDateLong(item.startsAt, "-");
    const attendees = meeting.participant_users ?? [];
    const reminders = meeting.reminders ?? [];
    const isActionable = item.isUpcoming && item.statusLabel === "scheduled";
    const showReschedule = canEdit && isActionable;
    // The AI summary only exists once the meeting has actually happened —
    // showing a "pending" badge on a future meeting just confuses people.
    const showSummaryBadge = item.isConcluded && item.summaryStatus !== "none";
    const summaryReady = item.summaryStatus === "available";

    const markCancelled = () => {
        const form = buildMeetingFormFromFollowup(meeting, deal, currentUserId);
        updateMeeting(
            meeting.id,
            form,
            () => {
                setConfirmCancel(false);
                onClose();
            },
            "cancelled",
        );
    };

    return (
        <DealModal
            open={!!meeting}
            onClose={onClose}
            title={td(item.title)}
            footer={
                <>
                    {canDelete && (
                        <DealButton
                            variant="ghost"
                            style={{ color: T.RED }}
                            onClick={() => setDeleteOpen(true)}
                            disabled={isUpdating}
                        >
                            {t("pages.deals.common.delete")}
                        </DealButton>
                    )}
                    {canEdit && isActionable && (
                        <DealButton
                            variant="ghost"
                            style={{ color: T.RED }}
                            onClick={() => setConfirmCancel(true)}
                            disabled={isUpdating}
                        >
                            {t("pages.deals.workspace.meetings.cancel_meeting")}
                        </DealButton>
                    )}
                    <span style={{ flex: 1 }} />
                    {canEdit && (
                        <DealButton
                            variant="primary"
                            onClick={() => setEditOpen(true)}
                            disabled={isUpdating}
                        >
                            {t("pages.deals.common.edit")}
                        </DealButton>
                    )}
                </>
            }
        >
            <div className="mb-4 flex flex-wrap items-center gap-2">
                <span
                    className={`dr-pill ${PLATFORM_PILL[item.locationType] ?? "dr-pill-gray"}`}
                >
                    {td(item.platformLabel)}
                </span>
                <span
                    className={`dr-pill ${getMeetingStatusTone(item.statusLabel)}`}
                >
                    {td(item.statusLabel)}
                </span>
                {showSummaryBadge &&
                    (summaryReady ? (
                        <button
                            type="button"
                            className="dr-pill dr-pill-teal"
                            onClick={() => setSummaryOpen(true)}
                            style={{
                                fontSize: 12,
                                padding: "4px 11px",
                                cursor: "pointer",
                                fontFamily: "inherit",
                            }}
                        >
                            <DealIcon name="spark" size={12} />
                            {t("pages.deals.workspace.meetings.view_summary")}
                        </button>
                    ) : (
                        <span className="dr-pill dr-pill-gray">
                            {t("pages.deals.workspace.meetings.ai_summary_pending")}
                        </span>
                    ))}
            </div>

            {/* Schedule — calendar tile + when, mirrored after the meeting-link
                rail below so the modal’s two highlight blocks read as a set. */}
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
                        style={{ fontSize: TY.BODY, color: T.TEXT_MUTED }}
                    >
                        <span
                            className="inline-flex items-center gap-1.5 font-medium text-sm"
                            style={{ color: T.NAVY }}
                        >
                            <DealIcon name="clock" size={13} color={T.BLUE} />
                            {item.timeRangeLabel}
                        </span>
                        <span style={{ color: T.TEXT_HINT }}>·</span>
                        <span>
                            {item.durationMinutes}{" "}
                            {t("pages.deals.workspace.meetings.min_label")}
                        </span>
                    </div>
                </div>

                {showReschedule && (
                    <div className="flex flex-shrink-0 items-center">
                        <DealButton
                            variant="ghost"
                            size="sm"
                            onClick={() => setRescheduleOpen(true)}
                            disabled={isUpdating}
                        >
                            {t("pages.deals.workspace.meetings.reschedule")}
                        </DealButton>
                    </div>
                )}
            </div>

            {/* Location: a video link is highlighted, truncated and clickable,
                with the Join action sitting right beside it. */}
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
                            <DealIcon name="video" size={17} color={T.BLUE} />
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
                                {t("pages.deals.workspace.meetings.meeting_link")}
                            </div>
                            <a
                                href={item.meetingLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title={item.meetingLink}
                                className="block truncate font-medium underline"
                                style={{ fontSize: 13, color: T.NAVY }}
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
                                <DealIcon name="video" size={14} />
                                {t("pages.deals.workspace.meetings.join_meeting")}
                            </a>
                        )}
                    </div>
                ) : (
                    <div
                        className="flex items-center gap-2"
                        style={{ fontSize: 14, color: T.TEXT_MUTED }}
                    >
                        <DealIcon name="map-pin" size={14} />
                        {td(item.locationDisplay)}
                    </div>
                )}
            </div>

            {meeting.remark && (
                <DealModalField label={t("pages.deals.workspace.meetings.agenda_label")}>
                    <div className="text-[14px] leading-relaxed" style={{ color: T.TEXT }}>
                        {meeting.remark}
                    </div>
                </DealModalField>
            )}

            <DealModalField label={t("pages.deals.workspace.meetings.attendees")}>
                {attendees.length === 0 ? (
                    <div className="text-[13px] italic" style={{ color: T.TEXT_MUTED }}>
                        {t("pages.deals.common.none")}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {attendees.map((user) => (
                            <span
                                key={user.id}
                                className="inline-flex items-center gap-1.5 rounded-full border py-[3px] pl-1 pr-2.5"
                                style={{
                                    background: T.SURFACE_2,
                                    borderColor: T.BORDER,
                                }}
                            >
                                <DealAvatar
                                    type="participant"
                                    size={22}
                                    initials={(user.name || "?")
                                        .split(" ")
                                        .map((part) => part[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase()}
                                />
                                <span className="text-[13px]">{user.name}</span>
                            </span>
                        ))}
                    </div>
                )}
            </DealModalField>

            {reminders.length > 0 && (
                <DealModalField label={t("pages.deals.workspace.meetings.reminders")}>
                    <div className="flex flex-wrap gap-2">
                        {reminders.map((reminder, index) => (
                            <span
                                key={index}
                                className="dr-pill dr-pill-gray"
                            >
                                {td(reminderLabel(reminder))}
                            </span>
                        ))}
                    </div>
                </DealModalField>
            )}

            {summaryOpen && (
                <ViewFollowup
                    open={summaryOpen}
                    onClose={() => setSummaryOpen(false)}
                    followup={meeting}
                    deal={deal}
                />
            )}

            <DealEditMeetingModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                deal={deal}
                followup={meeting}
                meetingTypes={meetingTypes}
            />
            <DealRescheduleMeetingModal
                open={rescheduleOpen}
                onClose={() => setRescheduleOpen(false)}
                followup={meeting}
            />
            <DeleteFollowup
                open={deleteOpen}
                onClose={() => {
                    setDeleteOpen(false);
                    onClose();
                }}
                followup={meeting}
                skipReload
                onDeleted={(followupId) => {
                    setDealFollowUps((prev) =>
                        prev.filter((f) => f.id !== followupId),
                    );
                }}
            />
            <DealConfirmDialog
                open={confirmCancel}
                title={t("pages.deals.workspace.meetings.cancel_meeting_confirm_title")}
                message={t(
                    "pages.deals.workspace.meetings.cancel_meeting_confirm_message",
                )}
                confirmLabel={t("pages.deals.workspace.meetings.cancel_meeting")}
                danger
                confirmLoading={isUpdating}
                onConfirm={markCancelled}
                onCancel={() => setConfirmCancel(false)}
            />
        </DealModal>
    );
}
