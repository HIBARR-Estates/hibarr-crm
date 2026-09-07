import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import ScheduleMeetingModal from "@/Components/Redesign/modals/ScheduleMeetingModal";
import Segmented from "@/Components/Redesign/primitives/Segmented";
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
    type ScheduleRecordType,
} from "../hooks/useScheduleRecordSource";

interface MeetingsScheduleDialogProps {
    open: boolean;
    onClose: () => void;
    onScheduled: () => void;
    userDeals: Array<{ id: number; name: string }>;
    userLeads: Array<{ id: number; name: string }>;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    /** Slot the calendar was clicked on, when the dialog was opened that way. */
    initialStart?: { date: string; startTime: string };
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
    initialStart,
}: MeetingsScheduleDialogProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const currentUserEmail = props.auth?.user?.email;

    // Which kind of record this meeting is for. A tab rather than one mixed
    // list: picking the wrong entity type is the mistake worth preventing,
    // and a deal and a lead of the same client read almost identically.
    const [recordType, setRecordType] = useState<ScheduleRecordType>("deal");
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
            setRecordType("deal");
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

    // Only the active tab's records — the group label stays so the list still
    // says what it is holding.
    const recordOptions = useMemo(() => {
        const groups: SearchableSelectGroup[] = [];
        const records = recordType === "deal" ? userDeals : userLeads;
        if (records.length > 0) {
            groups.push({
                label:
                    recordType === "deal"
                        ? t("app.meetings.entity_type_deal")
                        : t("app.meetings.entity_type_lead"),
                options: records.map((record) => ({
                    value: recordKey(recordType, record.id),
                    label: record.name,
                })),
            });
        }
        return groups;
    }, [recordType, userDeals, userLeads, t]);

    const dialogErrors = [...(error ? [t(error)] : []), ...errors];

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
            // A record is being fetched — seeding now would lock in a form
            // built from `source` before it arrived, and this modal only
            // seeds once per mount.
            readyToSeed={!selectedKey || !loading}
            onSubmit={handleSubmit}
            mustIncludeOwner={mustIncludeOwner}
            labels={{
                title: t("app.meetings.actions.schedule"),
                subtitle: td("Book a meeting on a deal or lead"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("app.meetings.actions.schedule"),
            }}
            initialStart={initialStart}
            stepped
            stepLabels={{
                back: td("Back"),
                next: td("Next: meeting details"),
                stepOf: (n, of) =>
                    n === 1
                        ? `${td("Step")} ${n}/${of} · ${td("What")}`
                        : `${td("Step")} ${n}/${of} · ${td("When and how it runs")}`,
            }}
            extraFields={
                <>
                    <ModalField label={td("Schedule for")}>
                        <Segmented<ScheduleRecordType>
                            value={recordType}
                            onChange={(next) => {
                                setRecordType(next);
                                // The chosen record belongs to the tab that was
                                // open; keeping it would book against a record
                                // the list no longer shows.
                                setSelectedKey(null);
                                clearErrors();
                            }}
                            ariaLabel={td("Record type")}
                            fullWidth
                            options={[
                                {
                                    value: "deal",
                                    label: t("app.meetings.entity_type_deal"),
                                    count: userDeals.length,
                                },
                                {
                                    value: "lead",
                                    label: t("app.meetings.entity_type_lead"),
                                    count: userLeads.length,
                                },
                            ]}
                        />
                    </ModalField>

                    <ModalField
                        label={
                            recordType === "deal"
                                ? td("Related deal")
                                : td("Related lead")
                        }
                    >
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
                </>
            }
        />
    );
}
