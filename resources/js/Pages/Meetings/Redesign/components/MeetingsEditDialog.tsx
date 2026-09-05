import { useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import useTranslation from "@/Hooks/useTranslation";
import EditMeetingModal from "@/Components/Redesign/modals/EditMeetingModal";
import {
    buildMeetingFormFromFollowup,
    requiresManualMeetingLink,
    requiresMeetingParticipants,
    requiresPhysicalLocationDetail,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import type { DealFollowup } from "@/Types/api/deal-followup";
import useMeetingsMeetingUpdate from "../hooks/useMeetingsMeetingUpdate";

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

    const initialForm = useMemo(() => {
        if (!open || !meeting) return null;
        // No participant source: the list carries the meeting's own
        // participants, which is what an edit starts from anyway.
        return buildMeetingFormFromFollowup(meeting, null, currentUserId);
    }, [open, meeting, currentUserId]);

    const handleClose = () => {
        if (isUpdating) return;
        setLocalErrors([]);
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
            labels={{
                title: t("pages.deals.workspace.meetings.edit_meeting"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("pages.deals.common.save_changes"),
            }}
        />
    );
}
