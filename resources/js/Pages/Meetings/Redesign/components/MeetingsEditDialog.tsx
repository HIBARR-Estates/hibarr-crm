import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import EditMeetingModal from "@/Components/Redesign/modals/EditMeetingModal";
import useMeetingAttendanceConfirmationFlag from "@/Hooks/useMeetingAttendanceConfirmationFlag";
import {
    buildMeetingFormFromFollowup,
    requiresManualMeetingLink,
    requiresMeetingParticipants,
    requiresPhysicalLocationDetail,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import type { PersonOption } from "@/Components/Redesign/primitives/PeoplePicker";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingsMeetingUpdate from "../hooks/useMeetingsMeetingUpdate";
import MeetingConfirmationPanel from "./MeetingConfirmationPanel";

interface MeetingsEditDialogProps {
    open: boolean;
    meeting: DealFollowup | null;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    onClose: () => void;
    onSaved: () => void;
}

/**
 * Editing a meeting from the Meetings index.
 *
 * This is the redesign's own meeting form — the same `EditMeetingModal` the
 * deal and lead pages use — rather than the legacy antd follow-up modal the
 * page opened before, so a meeting edited from the list looks and validates
 * exactly like one edited from the record it belongs to.
 */
export default function MeetingsEditDialog({
    open,
    meeting,
    meetingTypes,
    onClose,
    onSaved,
}: MeetingsEditDialogProps) {
    const { t } = useTranslation();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const [localErrors, setLocalErrors] = useState<string[]>([]);
    const { updateMeeting, isUpdating, errors, clearErrors } =
        useMeetingsMeetingUpdate();
    const showConfirmation = useMeetingAttendanceConfirmationFlag();
    // Patched locally the moment a confirmation saves, mirroring the detail
    // dialog — the tab reflects it immediately rather than waiting for
    // `onSaved`'s list reload to bring a fresh `meeting` prop back around.
    const [confirmationPatch, setConfirmationPatch] =
        useState<Partial<DealFollowup> | null>(null);

    const initialForm = useMemo(() => {
        if (!open || !meeting) return null;
        // No participant source: the list carries the meeting's own
        // participants, which is what an edit starts from anyway.
        return buildMeetingFormFromFollowup(meeting, null, currentUserId);
    }, [open, meeting, currentUserId]);

    const effectiveMeeting =
        meeting && confirmationPatch
            ? { ...meeting, ...confirmationPatch }
            : meeting;
    const hostId = meeting?.host_id ?? meeting?.added_by?.id;
    const canConfirmAttendance = Boolean(currentUserId && hostId === currentUserId);

    // Names for everyone already on this meeting — the host/participant
    // pickers only search a separate "employees" directory, which won't
    // necessarily list someone already assigned here (a different role, or
    // just not yet loaded), so without this an existing pick renders as
    // "User #<id>" until the picker happens to also surface them.
    const participantDirectory = useMemo<PersonOption[]>(() => {
        if (!meeting) return [];
        const people: PersonOption[] = (meeting.participant_users ?? []).map(
            (person) => ({ id: person.id, name: person.name }),
        );
        if (meeting.host && !people.some((p) => p.id === meeting.host!.id)) {
            people.push({ id: meeting.host.id, name: meeting.host.name });
        }
        if (
            meeting.added_by &&
            !people.some((p) => p.id === meeting.added_by!.id)
        ) {
            people.push({
                id: meeting.added_by.id,
                name: meeting.added_by.name,
            });
        }
        return people;
    }, [meeting]);

    const handleClose = () => {
        if (isUpdating) return;
        setLocalErrors([]);
        setConfirmationPatch(null);
        clearErrors();
        onClose();
    };

    const handleSubmit = (form: MeetingFormState) => {
        if (!meeting) return;

        const validationErrors: string[] = [];
        if (!form.meetingTypeId) {
            validationErrors.push(
                t(
                    "pages.deals.workspace.meetings.validation.select_meeting_type",
                ),
            );
        }
        if (!form.date) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.select_date"),
            );
        }
        if (!form.startTime) {
            validationErrors.push(
                t(
                    "pages.deals.workspace.meetings.validation.select_start_time",
                ),
            );
        }
        if (
            requiresMeetingParticipants(form.platform) &&
            form.participants.length === 0
        ) {
            validationErrors.push(
                t(
                    "pages.deals.workspace.meetings.validation.participants_required",
                ),
            );
        }
        if (
            requiresManualMeetingLink(form.platform) &&
            !form.meetingLink.trim()
        ) {
            validationErrors.push(
                t(
                    "pages.deals.workspace.meetings.validation.paste_meeting_link",
                ),
            );
        }
        if (
            requiresPhysicalLocationDetail(form.platform) &&
            !form.locationDetail.trim()
        ) {
            validationErrors.push(
                t("pages.deals.workspace.meetings.validation.enter_location"),
            );
        }

        if (validationErrors.length > 0) {
            setLocalErrors(validationErrors);
            return;
        }

        setLocalErrors([]);
        updateMeeting(meeting, form, () => {
            setLocalErrors([]);
            onSaved();
            onClose();
        });
    };

    return (
        <EditMeetingModal
            open={open}
            onClose={handleClose}
            saving={isUpdating}
            errors={[...localErrors, ...errors]}
            meetingTypes={meetingTypes}
            initialForm={initialForm}
            onSubmit={handleSubmit}
            participantDirectory={participantDirectory}
            labels={{
                title: t("pages.deals.workspace.meetings.edit_meeting"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("pages.deals.common.save_changes"),
            }}
            confirmationPanel={
                showConfirmation && effectiveMeeting ? (
                    <MeetingConfirmationPanel
                        meeting={effectiveMeeting}
                        canConfirm={canConfirmAttendance}
                        allowEditLogged
                        onSaved={(patch) =>
                            setConfirmationPatch((prev) => ({
                                ...prev,
                                ...patch,
                            }))
                        }
                    />
                ) : undefined
            }
        />
    );
}
