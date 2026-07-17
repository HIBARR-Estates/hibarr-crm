import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";
import ViewFollowup from "@/Pages/Deals/Components/Tabs/followups/ViewFollowup";
import { toWorkspaceMeetingListItem } from "../../adapters/meetingListAdapter";
import DealBadge from "../primitives/DealBadge";
import DealButton from "../primitives/DealButton";
import DealIcon from "../primitives/DealIcon";
import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";
import DealEditMeetingModal from "./DealEditMeetingModal";
import DealRescheduleMeetingModal from "./DealRescheduleMeetingModal";

interface WorkspaceMeetingsTabProps {
    deal: Deal;
    followUps: DealFollowup[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    permissions: Record<string, string>;
    onScheduleMeeting: () => void;
}

function canAddMeeting(
    permissions: Record<string, string>,
    deal: Deal,
): boolean {
    const canAdd =
        permissions.add_lead_follow_up === "all" ||
        permissions.add_lead_follow_up === "added";
    const closedStage =
        deal.lead_stage?.slug === "win" || deal.lead_stage?.slug === "lost";

    return canAdd && !closedStage && deal.next_follow_up !== "no";
}

function canEditMeeting(
    permissions: Record<string, string>,
    followup: DealFollowup,
    userId?: number,
): boolean {
    return (
        permissions.edit_lead_follow_up === "all" ||
        (permissions.edit_lead_follow_up === "added" &&
            followup.added_by?.id === userId)
    );
}

function canDeleteMeeting(
    permissions: Record<string, string>,
    followup: DealFollowup,
    userId?: number,
): boolean {
    if (!followup.added_by) return false;

    return (
        permissions.delete_lead_follow_up === "all" ||
        (permissions.delete_lead_follow_up === "added" &&
            followup.added_by?.id === userId)
    );
}

function SummaryStatusBadge({
    status,
    onView,
}: {
    status: "available" | "pending" | "none";
    onView?: () => void;
}) {
    const { td } = useTd();

    if (status === "none") {
        return null;
    }

    if (status === "available") {
        return (
            <button
                type="button"
                onClick={onView}
                className="border-none bg-transparent p-0"
            >
                <DealBadge variant="green">{td("View summary")}</DealBadge>
            </button>
        );
    }

    return <DealBadge variant="gray">{td("Summary pending")}</DealBadge>;
}

function MeetingCard({
    meeting,
    section,
    canEdit,
    canDelete,
    onEdit,
    onReschedule,
    onDelete,
    onViewSummary,
}: {
    meeting: ReturnType<typeof toWorkspaceMeetingListItem>;
    section: "Upcoming" | "Past";
    canEdit: boolean;
    canDelete: boolean;
    onEdit: () => void;
    onReschedule: () => void;
    onDelete: () => void;
    onViewSummary: () => void;
}) {
    const { td } = useTd();
    const isUpcoming = section === "Upcoming";
    const showReschedule =
        canEdit && meeting.statusLabel === "scheduled" && isUpcoming;

    return (
        <article className="mb-2 flex gap-3.5 rounded-lg border border-[#e2e5ea] bg-white px-3.5 py-3 last:mb-0">
            <div
                className="w-12 shrink-0 rounded-md border px-1.5 py-2 text-center"
                style={{
                    background: isUpcoming ? T.BLUE_LIGHT : T.GRAY,
                    borderColor: isUpcoming ? T.BLUE_MID : T.BORDER,
                }}
            >
                <div className="text-[10px] uppercase text-[#9ca3af]">
                    {meeting.monthLabel}
                </div>
                <div
                    className="text-lg font-semibold leading-tight"
                    style={{ color: isUpcoming ? T.BLUE : T.TEXT_MUTED }}
                >
                    {meeting.dayLabel}
                </div>
            </div>

            <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span
                        aria-hidden="true"
                        className="inline-block h-2 w-2 shrink-0 rounded-full"
                        style={{ background: meeting.typeColor ?? T.TEXT_MUTED }}
                    />
                    <span className="text-[13px] font-medium text-[#1a1f2e]">
                        {meeting.title}
                    </span>
                    <DealBadge variant={meeting.platformBadgeVariant}>
                        {meeting.platformLabel}
                    </DealBadge>
                    <DealBadge variant="navy" className="capitalize">
                        {meeting.statusLabel}
                    </DealBadge>
                    <SummaryStatusBadge
                        status={meeting.summaryStatus}
                        onView={onViewSummary}
                    />
                </div>

                <div className="mb-0.5 flex items-center gap-1.5 text-xs text-[#5b6472]">
                    <DealIcon name="clock" size={12} />
                    {meeting.timeRangeLabel}
                </div>

                <div className="mb-0.5 flex items-center gap-1.5 text-xs text-[#5b6472]">
                    <DealIcon
                        name={
                            meeting.locationType === "video"
                                ? "video"
                                : meeting.locationType === "phone"
                                  ? "phone"
                                  : "map-pin"
                        }
                        size={12}
                    />
                    {meeting.meetingLink ? (
                        <a
                            href={meeting.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="truncate text-[#1a6bb5] no-underline hover:text-[#145890]"
                            onClick={(event) => event.stopPropagation()}
                        >
                            {td("Join meeting")}
                        </a>
                    ) : (
                        <span className="truncate">
                            {meeting.locationDisplay}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-1.5 text-[11px] text-[#9ca3af]">
                    <DealIcon name="users" size={11} />
                    <span className="truncate">{meeting.attendeesLabel}</span>
                </div>

                {(canEdit || canDelete) && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-[#e2e5ea] pt-2">
                        {canEdit && (
                            <DealButton
                                variant="ghost"
                                onClick={onEdit}
                                style={{ fontSize: 11, padding: "4px 10px" }}
                            >
                                {td("Edit")}
                            </DealButton>
                        )}
                        {showReschedule && (
                            <DealButton
                                variant="ghost"
                                onClick={onReschedule}
                                style={{ fontSize: 11, padding: "4px 10px" }}
                            >
                                {td("Reschedule")}
                            </DealButton>
                        )}
                        {canDelete && (
                            <DealButton
                                variant="ghost"
                                onClick={onDelete}
                                style={{ fontSize: 11, padding: "4px 10px" }}
                            >
                                {td("Delete")}
                            </DealButton>
                        )}
                    </div>
                )}
            </div>
        </article>
    );
}

export default function WorkspaceMeetingsTab({
    deal,
    followUps,
    meetingTypes,
    permissions,
    onScheduleMeeting,
}: WorkspaceMeetingsTabProps) {
    const { td } = useTd();
    const { props } = usePage();
    const userId = props.auth?.user?.id;
    const [selectedFollowup, setSelectedFollowup] =
        useState<DealFollowup | null>(null);
    const [editOpen, setEditOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [viewOpen, setViewOpen] = useState(false);

    const meetings = useMemo(
        () => followUps.map((followup) => toWorkspaceMeetingListItem(followup)),
        [followUps],
    );

    const upcoming = useMemo(
        () => meetings.filter((meeting) => meeting.isUpcoming),
        [meetings],
    );
    const past = useMemo(
        () => meetings.filter((meeting) => meeting.isPast),
        [meetings],
    );

    const showSchedule = canAddMeeting(permissions, deal);

    const openEdit = (followup: DealFollowup) => {
        setSelectedFollowup(followup);
        setEditOpen(true);
    };

    const openReschedule = (followup: DealFollowup) => {
        setSelectedFollowup(followup);
        setRescheduleOpen(true);
    };

    const openDelete = (followup: DealFollowup) => {
        setSelectedFollowup(followup);
        setDeleteOpen(true);
    };

    const openView = (followup: DealFollowup) => {
        setSelectedFollowup(followup);
        setViewOpen(true);
    };

    const closeModals = () => {
        setEditOpen(false);
        setRescheduleOpen(false);
        setDeleteOpen(false);
        setViewOpen(false);
        setSelectedFollowup(null);
    };

    return (
        <>
            <div className="mb-3.5 flex items-center justify-between gap-3">
                <span className="text-xs text-[#5b6472]">
                    {upcoming.length} {td("upcoming")} · {past.length}{" "}
                    {td("past")}
                </span>
                {showSchedule && (
                    <DealButton variant="navy" onClick={onScheduleMeeting}>
                        + {td("Schedule meeting")}
                    </DealButton>
                )}
            </div>

            {meetings.length === 0 ? (
                <div className="rounded-lg border border-[#e2e5ea] bg-white px-5 py-9 text-center">
                    <DealIcon
                        name="calendar"
                        size={28}
                        color={T.TEXT_HINT}
                        className="mx-auto mb-2 opacity-50"
                    />
                    <p className="mb-3 text-[13px] text-[#9ca3af]">
                        {td("No meetings yet")}
                    </p>
                    {showSchedule && (
                        <DealButton variant="navy" onClick={onScheduleMeeting}>
                            + {td("Schedule meeting")}
                        </DealButton>
                    )}
                </div>
            ) : (
                ([
                    { label: "Upcoming" as const, items: upcoming },
                    { label: "Past" as const, items: past },
                ] as const)
                    .filter((section) => section.items.length > 0)
                    .map((section) => (
                        <section key={section.label} className="mb-4 last:mb-0">
                            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#9ca3af]">
                                {td(section.label)}
                            </h3>
                            {section.items.map((meeting) => (
                                <MeetingCard
                                    key={meeting.id}
                                    meeting={meeting}
                                    section={section.label}
                                    canEdit={canEditMeeting(
                                        permissions,
                                        meeting.followup,
                                        userId,
                                    )}
                                    canDelete={canDeleteMeeting(
                                        permissions,
                                        meeting.followup,
                                        userId,
                                    )}
                                    onEdit={() => openEdit(meeting.followup)}
                                    onReschedule={() =>
                                        openReschedule(meeting.followup)
                                    }
                                    onDelete={() => openDelete(meeting.followup)}
                                    onViewSummary={() =>
                                        openView(meeting.followup)
                                    }
                                />
                            ))}
                        </section>
                    ))
            )}

            <DealEditMeetingModal
                open={editOpen}
                onClose={() => {
                    setEditOpen(false);
                    setSelectedFollowup(null);
                }}
                deal={deal}
                followup={selectedFollowup}
                meetingTypes={meetingTypes}
            />

            <DealRescheduleMeetingModal
                open={rescheduleOpen}
                onClose={() => {
                    setRescheduleOpen(false);
                    setSelectedFollowup(null);
                }}
                followup={selectedFollowup}
            />

            <DeleteFollowup
                open={deleteOpen}
                onClose={closeModals}
                followup={selectedFollowup ?? undefined}
            />

            {selectedFollowup && (
                <ViewFollowup
                    open={viewOpen}
                    onClose={closeModals}
                    followup={selectedFollowup}
                    deal={deal}
                />
            )}
        </>
    );
}
