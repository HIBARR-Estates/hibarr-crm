import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import ScheduleMeetingModal from "@/Components/Redesign/modals/ScheduleMeetingModal";
import { ModalField } from "@/Components/Redesign/primitives/Modal";
import SearchableSelect, {
    type SearchableSelectGroup,
} from "@/Components/Redesign/primitives/SearchableSelect";
import {
    buildEmptyMeetingForm,
    getMeetingOwner,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import useMeetingsScheduleCreate from "../hooks/useMeetingsScheduleCreate";
import useScheduleRecordSource, {
    parseRecordKey,
    recordKey,
    type ScheduleRecordKey,
} from "../hooks/useScheduleRecordSource";

interface MeetingsScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    onScheduled: () => void;
    userDeals: Array<{ id: number; name: string }>;
    userLeads: Array<{ id: number; name: string }>;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
}

/**
 * The Lead/Deal meeting dialog, with the one field those pages don't need:
 * which record to book against. Everything below it — type, agenda, time,
 * platform, host, participants, reminders — is `MeetingFormFields`, so this
 * page can't drift from the meeting form the rest of the CRM uses.
 */
export default function MeetingsScheduleDialog({
    open,
    onClose,
    onScheduled,
    userDeals,
    userLeads,
    meetingTypes,
}: MeetingsScheduleDialogProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const currentUserEmail = props.auth?.user?.email;

    const [selectedKey, setSelectedKey] = useState<ScheduleRecordKey | null>(
        null,
    );
    const { source, loading, error } = useScheduleRecordSource(selectedKey);
    const { createMeeting, isCreating, errors, clearErrors } =
        useMeetingsScheduleCreate();

    // Start each visit from a clean slate — a record left over from last time
    // would silently book against the wrong deal.
    useEffect(() => {
        if (!open) {
            setSelectedKey(null);
            clearErrors();
        }
    }, [open, clearErrors]);

    const initialForm = useMemo(
        () => buildEmptyMeetingForm(source, currentUserId, currentUserEmail),
        [source, currentUserId, currentUserEmail],
    );
    const mustIncludeOwner = useMemo(() => getMeetingOwner(source), [source]);

    const parsed = parseRecordKey(selectedKey);
    const target = parsed
        ? { ...parsed, hasOwner: mustIncludeOwner !== null }
        : null;

    const recordOptions = useMemo(() => {
        const groups: SearchableSelectGroup[] = [];
        if (userDeals.length > 0) {
            groups.push({
                label: t("app.meetings.entity_type_deal"),
                options: userDeals.map((deal) => ({
                    value: recordKey("deal", deal.id),
                    label: deal.name,
                })),
            });
        }
        if (userLeads.length > 0) {
            groups.push({
                label: t("app.meetings.entity_type_lead"),
                options: userLeads.map((lead) => ({
                    value: recordKey("lead", lead.id),
                    label: lead.name,
                })),
            });
        }
        return groups;
    }, [userDeals, userLeads, t]);

    const dialogErrors = [
        ...(error ? [t(error)] : []),
        ...errors,
    ];

    const handleClose = () => {
        if (isCreating) return;
        clearErrors();
        onClose();
    };

    const handleSubmit = (form: MeetingFormState) =>
        createMeeting(form, target, () => {
            onScheduled();
            handleClose();
        });

    return (
        <ScheduleMeetingModal
            // Remount on a record change so the form re-seeds with that
            // record's host/participants — the modal seeds `initialForm` once
            // per open and would otherwise keep the previous record's people.
            key={selectedKey ?? "no-record"}
            open={open}
            onClose={handleClose}
            saving={isCreating}
            errors={dialogErrors}
            meetingTypes={meetingTypes}
            initialForm={initialForm}
            onSubmit={handleSubmit}
            mustIncludeOwner={mustIncludeOwner}
            labels={{
                title: t("app.meetings.actions.schedule"),
                subtitle: td("Book a meeting on a deal or lead"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("app.meetings.actions.schedule"),
            }}
            extraFields={
                <ModalField label={td("Related record")}>
                    <SearchableSelect<ScheduleRecordKey>
                        className="w-full"
                        value={selectedKey ?? undefined}
                        onChange={(value) => {
                            setSelectedKey(value ?? null);
                            clearErrors();
                        }}
                        options={recordOptions}
                        disabled={isCreating}
                        loading={loading}
                        allowClear
                        placeholder={td("Choose a deal or lead")}
                        notFoundContent={t(
                            "pages.meetings.schedule.no_entities_available",
                        )}
                    />
                </ModalField>
            }
        />
    );
}
