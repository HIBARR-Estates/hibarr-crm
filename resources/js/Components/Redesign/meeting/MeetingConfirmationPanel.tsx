import { useState } from "react";
import dayjs from "dayjs";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    REDESIGN_RADIUS as R,
    REDESIGN_TOKENS as T,
} from "@/Components/Redesign/tokens";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import MeetingAttendanceConfirmationModal from "@/Components/MeetingAttendanceConfirmation/MeetingAttendanceConfirmationModal";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type {
    MeetingAttendanceOutcome,
    PendingMeetingAttendanceConfirmation,
} from "@/Types/api/meeting-attendance-confirmation";

interface OutcomeDef {
    value: MeetingAttendanceOutcome;
    label: string;
    tone: { color: string; bg: string; border: string };
}

interface MeetingConfirmationPanelProps {
    meeting: DealFollowup;
    /** Whether this viewer may act — the host/organizer, server-enforced too. */
    canConfirm: boolean;
    onSaved: (patch: Partial<DealFollowup>) => void;
    /**
     * Lets an already-logged outcome be changed, not just set once — both the
     * show and edit views pass this. The confirmation prompt's `confirm`
     * action stays one-shot server-side (claimed with a single `whereNull`
     * update), but "Change" here goes through the `update` action instead,
     * authorized on ordinary edit permission rather than that guard.
     */
    allowEditLogged?: boolean;
}

const OUTCOMES: OutcomeDef[] = [
    { value: "attended", label: "Attended", tone: { color: T.GREEN, bg: T.GREEN_LIGHT, border: T.GREEN_MID } },
    { value: "no_show", label: "No-show", tone: { color: T.RED, bg: T.RED_SOFT, border: T.RED_MID } },
    { value: "partial", label: "Partial", tone: { color: T.TEAL, bg: T.TEAL_SOFT, border: T.TEAL_MID } },
    { value: "rescheduled", label: "Rescheduled", tone: { color: T.AMBER, bg: T.AMBER_SOFT, border: T.AMBER_MID } },
    { value: "cancelled", label: "Cancelled", tone: { color: T.TEXT_MUTED, bg: T.SURFACE_2, border: T.BORDER } },
];

/** Shapes a follow-up into what the shared confirmation modal expects. */
function toPendingShape(
    meeting: DealFollowup,
): PendingMeetingAttendanceConfirmation {
    return {
        id: meeting.id,
        deal_id: meeting.deal_id ?? null,
        lead_id: meeting.lead_id ?? null,
        contact_name:
            (meeting.deal && "contact" in meeting.deal
                ? meeting.deal.contact?.client_name
                : null) ??
            meeting.lead?.client_name_salutation ??
            meeting.lead?.client_name ??
            null,
        meeting_type_label: meeting.meeting_type?.name ?? null,
        scheduled_at: meeting.next_follow_up_date,
        duration: meeting.effective_duration ?? meeting.duration ?? 30,
        location: meeting.location,
        meeting_link: meeting.meeting_link || null,
        remark: meeting.remark ?? null,
        participants: meeting.participant_users ?? [],
    };
}

/**
 * The meeting's attendance-confirmation record.
 *
 * Setting or changing the outcome opens the exact same popup the
 * confirmation prompt uses (`MeetingAttendanceConfirmationModal`) — one
 * outcome picker across the whole app instead of a second one embedded in
 * this tab, which used to render its own Cancel/Save footer stacked directly
 * above the dialog's own footer. Before anything is logged this renders a
 * "Set outcome" prompt; with `allowEditLogged` it additionally offers
 * "Change" once one already is.
 */
export default function MeetingConfirmationPanel({
    meeting,
    canConfirm,
    onSaved,
    allowEditLogged = false,
}: MeetingConfirmationPanelProps) {
    const { td } = useTd();
    const { formatDateTime } = useUserDateTime();
    const [modalMode, setModalMode] = useState<"confirm" | "update" | null>(
        null,
    );

    const logged = Boolean(meeting.attendance_outcome_logged_at);
    const loggedOutcome = OUTCOMES.find(
        (o) => o.value === meeting.attendance_outcome,
    );

    // There's nothing to report on a meeting that hasn't happened yet —
    // except a cancelled one, which is known the moment it's cancelled and
    // doesn't need to wait for its original slot to pass.
    const isCancelled = meeting.status === "cancelled";
    // Same precedence as toPendingShape() below — otherwise this gate and the
    // duration shown in the popup it opens could disagree on how long the
    // meeting actually runs.
    const minutes = meeting.effective_duration ?? meeting.duration ?? 30;
    const hasConcluded = dayjs().isAfter(
        dayjs(meeting.next_follow_up_date).add(minutes, "minute"),
    );
    const dateAllows = hasConcluded || isCancelled;
    const canAct = canConfirm && dateAllows;
    // Changing an outcome that's already logged is authorized on ordinary
    // edit permission server-side (MeetingAttendanceConfirmationController's
    // update()), not the host-only rule `confirm()` uses — `canConfirm` here
    // only reflects that stricter, first-time-confirmation rule, so gating
    // "Change" on it too would hide the button from someone who edits this
    // meeting's other fields but isn't its host. The date rule still applies:
    // the backend rejects a future meeting the same way.
    const canChangeLogged = allowEditLogged && dateAllows;

    const handleConfirmed = (outcome: MeetingAttendanceOutcome) => {
        setModalMode(null);
        onSaved({
            attendance_outcome: outcome,
            attendance_outcome_logged_at: new Date().toISOString(),
        });
    };

    return (
        <>
            {logged ? (
                <div
                    className="flex items-start gap-3"
                    style={{
                        background: loggedOutcome?.tone.bg ?? T.SURFACE_2,
                        border: `1px solid ${loggedOutcome?.tone.border ?? T.BORDER}`,
                        borderRadius: R.LG,
                        padding: "14px 16px",
                    }}
                >
                    <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center"
                        style={{ background: T.WHITE, borderRadius: R.MD }}
                    >
                        <Icon
                            name="check"
                            size={17}
                            color={loggedOutcome?.tone.color ?? T.TEXT_MUTED}
                        />
                    </span>
                    <div className="min-w-0 flex-1">
                        <div
                            className="font-semibold"
                            style={{
                                fontSize: 14,
                                color: loggedOutcome?.tone.color ?? T.TEXT,
                            }}
                        >
                            {td("Marked as")}{" "}
                            {loggedOutcome
                                ? td(loggedOutcome.label)
                                : meeting.attendance_outcome}
                        </div>
                        <div
                            style={{
                                fontSize: 12,
                                color: T.TEXT_MUTED,
                                marginTop: 3,
                            }}
                        >
                            {formatDateTime(
                                meeting.attendance_outcome_logged_at!,
                            )}
                            {" · "}
                            {td("Any note was saved to the record's notes")}
                        </div>
                    </div>
                    {canChangeLogged && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setModalMode("update")}
                        >
                            {td("Change")}
                        </Button>
                    )}
                </div>
            ) : canAct ? (
                <div
                    className="flex items-center justify-between gap-3"
                    style={{
                        background: T.SURFACE_2,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: R.LG,
                        padding: "14px 16px",
                    }}
                >
                    <div style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                        {td("Nothing recorded yet for this meeting.")}
                    </div>
                    <Button
                        variant="primary"
                        size="sm"
                        onClick={() => setModalMode("confirm")}
                    >
                        {td("Set outcome")}
                    </Button>
                </div>
            ) : (
                <div
                    style={{
                        fontSize: 13,
                        color: T.TEXT_MUTED,
                        background: T.SURFACE_2,
                        border: `1px solid ${T.BORDER}`,
                        borderRadius: R.LG,
                        padding: "14px 16px",
                    }}
                >
                    {!canConfirm
                        ? td(
                              "Only the meeting's host can record what happened here.",
                          )
                        : td(
                              "You can record what happened once the meeting has passed.",
                          )}
                </div>
            )}

            {modalMode && (
                <MeetingAttendanceConfirmationModal
                    meeting={toPendingShape(meeting)}
                    mode={modalMode}
                    initialOutcome={
                        modalMode === "update"
                            ? (meeting.attendance_outcome ?? null)
                            : null
                    }
                    onDismiss={() => setModalMode(null)}
                    onConfirmed={handleConfirmed}
                    // Opened from inside the show/edit dialog (a redesign
                    // `Modal` at z-index 1100) — clear it explicitly.
                    zIndex={1300}
                />
            )}
        </>
    );
}
