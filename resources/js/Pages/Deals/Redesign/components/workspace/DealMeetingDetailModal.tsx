import { useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import { toWorkspaceMeetingListItem } from "../../adapters/meetingListAdapter";
import DealAvatar from "../primitives/DealAvatar";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DealModal, DealModalField } from "../primitives/DealModal";
import DealEditMeetingModal from "./DealEditMeetingModal";
import DealRescheduleMeetingModal from "./DealRescheduleMeetingModal";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import useDealMeetingUpdate from "../../hooks/useDealMeetingUpdate";
import { buildMeetingFormFromFollowup } from "./meetingFormUtils";

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

function statusPill(status: string): string {
    if (status === "completed") return "dr-pill-green";
    if (status === "canceled" || status === "cancelled") return "dr-pill-gray";
    return "dr-pill-blue";
}

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
    const [editOpen, setEditOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const { setDealFollowUps } = useDealWorkspace();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const { updateMeeting, isUpdating: isCompleting } = useDealMeetingUpdate(deal);

    if (!meeting) return null;

    const item = toWorkspaceMeetingListItem(meeting);
    const dateLine = item.startsAt
        ? item.startsAt.toLocaleDateString("en-GB", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
          })
        : "—";
    const attendees = meeting.participant_users ?? [];
    const reminders = meeting.reminders ?? [];
    const isActionable = item.isUpcoming && item.statusLabel === "scheduled";
    const showReschedule = canEdit && isActionable;
    const showComplete = canEdit && isActionable;

    const markCompleted = () => {
        const form = buildMeetingFormFromFollowup(meeting, deal, currentUserId);
        updateMeeting(meeting.id, form, undefined, "completed");
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
                            disabled={isCompleting}
                        >
                            {td("Delete")}
                        </DealButton>
                    )}
                    <span style={{ flex: 1 }} />
                    <DealButton variant="ghost" onClick={onClose}>
                        {td("Close")}
                    </DealButton>
                    {showReschedule && (
                        <DealButton
                            variant="ghost"
                            onClick={() => setRescheduleOpen(true)}
                            disabled={isCompleting}
                        >
                            {td("Reschedule")}
                        </DealButton>
                    )}
                    {canEdit && (
                        <DealButton
                            variant="ghost"
                            onClick={() => setEditOpen(true)}
                            disabled={isCompleting}
                        >
                            {td("Edit")}
                        </DealButton>
                    )}
                    {showComplete && (
                        <DealButton
                            variant="primary"
                            onClick={markCompleted}
                            loading={isCompleting}
                            disabled={isCompleting}
                        >
                            {td("Complete")}
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
                <span className={`dr-pill ${statusPill(item.statusLabel)}`}>
                    {td(item.statusLabel)}
                </span>
                {item.summaryStatus !== "none" && (
                    <span
                        className={`dr-pill ${
                            item.summaryStatus === "available"
                                ? "dr-pill-teal"
                                : "dr-pill-gray"
                        }`}
                    >
                        {td("AI summary")} {td(item.summaryStatus)}
                    </span>
                )}
            </div>

            <div className="mb-3.5 text-[13px]">
                <div className="mb-[3px] font-semibold">{dateLine}</div>
                <div style={{ color: T.TEXT_MUTED }}>{item.timeRangeLabel}</div>
                <div style={{ color: T.TEXT_MUTED }}>{item.locationDisplay}</div>
            </div>

            {meeting.remark && (
                <DealModalField label={td("Agenda")}>
                    <div className="text-[13px] leading-relaxed" style={{ color: T.TEXT }}>
                        {meeting.remark}
                    </div>
                </DealModalField>
            )}

            <DealModalField label={td("Attendees")}>
                {attendees.length === 0 ? (
                    <div className="text-xs italic" style={{ color: T.TEXT_MUTED }}>
                        {td("None")}
                    </div>
                ) : (
                    <div className="flex flex-wrap gap-1.5">
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
                                    size={20}
                                    initials={(user.name || "?")
                                        .split(" ")
                                        .map((part) => part[0])
                                        .slice(0, 2)
                                        .join("")
                                        .toUpperCase()}
                                />
                                <span className="text-xs">{user.name}</span>
                            </span>
                        ))}
                    </div>
                )}
            </DealModalField>

            {reminders.length > 0 && (
                <DealModalField label={td("Reminders")}>
                    <div className="flex flex-wrap gap-1.5">
                        {reminders.map((reminder, index) => (
                            <span key={index} className="dr-pill dr-pill-gray">
                                {reminderLabel(reminder)}
                            </span>
                        ))}
                    </div>
                </DealModalField>
            )}

            {item.meetingLink && item.isUpcoming && item.statusLabel === "scheduled" && (
                <div className="mt-1">
                    <a
                        href={item.meetingLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="dr-btn dr-btn-sm dr-btn-primary no-underline"
                    >
                        <DealIcon name="video" size={12} />
                        {td("Join meeting")}
                    </a>
                </div>
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
        </DealModal>
    );
}
