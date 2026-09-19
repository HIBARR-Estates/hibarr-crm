import { type ReactNode, useState } from "react";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingsPageRedesignFlag from "@/Hooks/useMeetingsPageRedesignFlag";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { useTd } from "@/Hooks/useDynamicTranslation";
import MeetingDetailCompact from "@/Components/Redesign/modals/MeetingDetailCompact";
import MeetingSummaryPanel from "@/Components/Redesign/meeting/MeetingSummaryPanel";
import { meetingSummaryState } from "@/Components/Redesign/meeting/meetingSummaryState";
import {
    meetingBucket,
} from "@/Pages/Meetings/Redesign/adapters/meetingViewModel";
import DeleteFollowup from "@/Pages/Deals/Components/Tabs/followups/DeleteFollowup";

/**
 * Nested edit / reschedule / delete controls — same shape as the legacy
 * MeetingDetailModal so existing Deal/Lead/Dashboard wrappers can keep their
 * renderNestedModals bodies when swapping to this viewer.
 */
export interface MeetingViewNestedControls {
    editOpen: boolean;
    rescheduleOpen: boolean;
    deleteOpen: boolean;
    setEditOpen: (open: boolean) => void;
    setRescheduleOpen: (open: boolean) => void;
    setDeleteOpen: (open: boolean) => void;
}

export interface MeetingViewModalProps {
    meeting: DealFollowup | null;
    canEdit: boolean;
    canDelete: boolean;
    canReschedule?: boolean;
    canCancel?: boolean;
    onClose: () => void;
    isUpdating?: boolean;
    onCancelMeeting?: () => void;
    onMarkHeld?: () => void;
    /**
     * Handles Edit itself (sibling form) instead of opening a nested edit
     * modal via renderNestedModals.
     */
    onEditRequested?: () => void;
    /**
     * Entity-specific edit / reschedule / delete forms. Summary is in-tab on
     * the compact viewer — do not open ViewFollowup from here.
     */
    renderNestedModals?: (controls: MeetingViewNestedControls) => ReactNode;
    /**
     * When true, builds the AI summary tab from the meeting record. When
     * false/omitted, the Summary tab is hidden.
     */
    includeSummary?: boolean;
    /** Open on the Summary tab (e.g. list "View summary" pills). */
    initialPanel?: "info" | "summary";
    /**
     * Shown while a by-id fetch is in flight (calendar chips / next-action).
     */
    loading?: boolean;
    /** Shown when that fetch failed. */
    error?: string | null;
    userId?: number;
    /**
     * Flag-off fallback — the deprecated MeetingDetailModal or ViewFollowup.
     * Required so surfaces keep working when crm.meetings-page-redesign is off.
     */
    fallback: ReactNode;
}

/**
 * The app's only view-meeting entry when `crm.meetings-page-redesign` is on.
 *
 * Renders MeetingDetailCompact (the Meetings-page viewer). When the flag is
 * off, renders `fallback` unchanged so legacy MeetingDetailModal / ViewFollowup
 * keep working until the flag rolls out fully.
 */
export default function MeetingViewModal({
    meeting,
    canEdit,
    canDelete,
    canReschedule,
    canCancel,
    onClose,
    isUpdating = false,
    onCancelMeeting,
    onMarkHeld,
    onEditRequested,
    renderNestedModals,
    includeSummary = true,
    initialPanel = "info",
    loading = false,
    error = null,
    userId,
    fallback,
}: MeetingViewModalProps) {
    const redesignEnabled = useMeetingsPageRedesignFlag();
    const { timezone } = useUserDateTime();
    const { td } = useTd();
    const [editOpen, setEditOpen] = useState(false);
    const [rescheduleOpen, setRescheduleOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);

    if (!redesignEnabled) {
        return <>{fallback}</>;
    }

    if (!meeting) {
        if (error) {
            return (
                <Modal open title={td("Meeting")} onClose={onClose}>
                    <p style={{ color: T.RED, fontSize: 14 }}>{td(error)}</p>
                </Modal>
            );
        }
        if (!loading) return null;
        return (
            <Modal open title={td("Loading meeting…")} onClose={onClose}>
                <div className="space-y-3" aria-hidden>
                    {[64, 40, 40, 96].map((height, index) => (
                        <div
                            key={index}
                            className="animate-pulse rounded-lg"
                            style={{ height, background: T.SKELETON }}
                        />
                    ))}
                </div>
            </Modal>
        );
    }

    const nestedControls: MeetingViewNestedControls = {
        editOpen,
        rescheduleOpen,
        deleteOpen,
        setEditOpen,
        setRescheduleOpen,
        setDeleteOpen,
    };

    const summaryPanel = includeSummary ? (
        <MeetingSummaryPanel
            meeting={meeting}
            state={meetingSummaryState(
                meeting,
                meetingBucket(meeting, timezone),
            )}
        />
    ) : undefined;

    return (
        <>
            <MeetingDetailCompact
                key={`${meeting.id}-${initialPanel}`}
                meeting={meeting}
                canEdit={canEdit}
                canDelete={canDelete}
                canReschedule={canReschedule}
                canCancel={canCancel}
                userId={userId}
                onClose={onClose}
                onEdit={() =>
                    onEditRequested ? onEditRequested() : setEditOpen(true)
                }
                onDelete={() => setDeleteOpen(true)}
                onReschedule={
                    (canReschedule ?? canEdit)
                        ? () => setRescheduleOpen(true)
                        : undefined
                }
                onCancelMeeting={onCancelMeeting}
                onMarkHeld={onMarkHeld}
                isUpdating={isUpdating}
                summaryPanel={summaryPanel}
                initialPanel={initialPanel}
            />
            {renderNestedModals?.(nestedControls)}
            {/*
              Delete is owned here when the caller does not render their own
              DeleteFollowup via renderNestedModals. Callers that do (deal/lead)
              open deleteOpen themselves — they should render DeleteFollowup
              when deleteOpen is true and can ignore this default.
            */}
            {deleteOpen && !renderNestedModals && (
                <DeleteFollowup
                    open={deleteOpen}
                    onClose={() => {
                        setDeleteOpen(false);
                        onClose();
                    }}
                    followup={meeting}
                    skipReload
                    onDeleted={() => {
                        setDeleteOpen(false);
                        onClose();
                    }}
                />
            )}
        </>
    );
}
