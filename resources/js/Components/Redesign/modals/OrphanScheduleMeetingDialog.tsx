import { useEffect, useMemo, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import ScheduleMeetingModal from "@/Components/Redesign/modals/ScheduleMeetingModal";
import { ModalField } from "@/Components/Redesign/primitives/Modal";
import SearchableSelect, {
    type SearchableSelectOption,
} from "@/Components/Redesign/primitives/SearchableSelect";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import {
    buildEmptyMeetingForm,
    getMeetingOwner,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";
import useMeetingsScheduleCreate from "@/Components/Redesign/meeting/useMeetingsScheduleCreate";
import useBookableLeads, {
    type BookableLead,
} from "@/Components/Redesign/meeting/useBookableLeads";
import useScheduleRecordSource, {
    parseRecordKey,
    recordKey,
    type ScheduleRecordType,
} from "@/Components/Redesign/meeting/useScheduleRecordSource";

export interface OrphanScheduleMeetingDialogProps {
    open: boolean;
    onClose: () => void;
    onScheduled: () => void;
    /**
     * @deprecated The dialog searches leads on the server and asks for a
     * lead's deals once it is picked. Kept so callers that still pass the
     * lists compile; they are not read.
     */
    userDeals?: Array<{ id: number; name: string }>;
    /** @deprecated See `userDeals`. */
    userLeads?: Array<{ id: number; name: string }>;
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    /** Slot the calendar was clicked on, when the dialog was opened that way. */
    initialStart?: { date: string; startTime: string };
    /** Opens on this record instead of asking for one (a person's next-step button). */
    initialRecord?: { type: ScheduleRecordType; id: number };
}

/** The lead the meeting is for. The name is empty until a fetch fills it in. */
interface SelectedLead {
    id: number;
    name: string;
}

type LeadOption = SearchableSelectOption & {
    meta: string;
    /** What the lead cannot be reached by, so the row can say so. */
    missing: string[];
};

function leadLabel(name: string, company?: string | null): string {
    return company ? `${name} (${company})` : name;
}

/**
 * Meetings-page schedule flow for orphan/global create: pick the **lead**,
 * optionally link one of its deals, then the shared `MeetingFormFields` form.
 * Deal/Lead workspace pages keep their own bound schedule modals — they
 * already know the record.
 *
 * Lead first because a meeting is with a person. A deal is one of the things
 * that person is in the middle of, so it is offered under the lead — and only
 * when the lead has one — rather than asked up front as an either/or between
 * two kinds of record. A lead with no deals books against the lead; so does a
 * lead whose user decides the meeting is not about any of them.
 */
export default function OrphanScheduleMeetingDialog({
    open,
    onClose,
    onScheduled,
    meetingTypes,
    initialStart,
    initialRecord,
}: OrphanScheduleMeetingDialogProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id;
    const currentUserEmail = props.auth?.user?.email;

    const initialLead = (): SelectedLead | null =>
        initialRecord?.type === "lead"
            ? { id: initialRecord.id, name: "" }
            : null;
    const initialDealId = (): number | null =>
        initialRecord?.type === "deal" ? initialRecord.id : null;

    const [lead, setLead] = useState<SelectedLead | null>(initialLead);
    const [dealId, setDealId] = useState<number | null>(initialDealId);
    const [leadQuery, setLeadQuery] = useState("");

    const leadKey = lead ? recordKey("lead", lead.id) : null;
    const dealKey = dealId ? recordKey("deal", dealId) : null;

    // The lead is fetched for its owner and its deals; the deal, when one is
    // chosen, for the agent and participants the form seeds from. Chosen
    // together they are two requests, which is all it costs to keep the lead's
    // deal list on screen while a deal is selected.
    const leadState = useScheduleRecordSource(leadKey);
    const dealState = useScheduleRecordSource(dealKey);
    const recordState = dealKey ? dealState : leadState;
    const selectedKey = dealKey ?? leadKey;
    const { source, loading, error } = recordState;
    // The record's data has actually arrived — not merely "nothing is in
    // flight", which is also true on the first render after picking one.
    const recordLoaded =
        !selectedKey || (recordState.loadedKey === selectedKey && !loading);

    const { leads, loading: searching, failed: searchFailed } = useBookableLeads(
        leadQuery,
        open,
    );
    const { createMeeting, isCreating, errors, clearErrors } =
        useMeetingsScheduleCreate();

    // Start each visit from a clean slate — a lead left over from last time
    // would silently book against the wrong person.
    useEffect(() => {
        if (!open) {
            setLead(initialLead());
            setDealId(initialDealId());
            setLeadQuery("");
            clearErrors();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps -- initialLead/initialDealId read the same two props
    }, [open, clearErrors, initialRecord?.type, initialRecord?.id]);

    // Opened on a deal (a next-step button): the dialog still starts from the
    // lead, so once the deal arrives take its lead from it. A deal with no
    // lead is booked as a deal on its own.
    useEffect(() => {
        if (lead !== null || !dealId || !dealState.source) return;
        const leadId = dealState.source.lead_id;
        if (leadId) {
            setLead({
                id: leadId,
                name: dealState.source.contact?.client_name ?? "",
            });
        }
    }, [lead, dealId, dealState.source]);

    const initialForm = useMemo(
        () => buildEmptyMeetingForm(source, currentUserId, currentUserEmail),
        [source, currentUserId, currentUserEmail],
    );
    const mustIncludeOwner = useMemo(() => getMeetingOwner(source), [source]);

    const parsed = parseRecordKey(selectedKey);
    const target = lead
        ? {
              type: "lead" as const,
              id: lead.id,
              dealId: dealId ?? undefined,
              hasOwner: mustIncludeOwner !== null,
          }
        : dealId
          ? {
                type: "deal" as const,
                id: dealId,
                hasOwner: mustIncludeOwner !== null,
            }
          : null;

    const selectedLeadName =
        lead?.name || leadState.source?.client_name || `#${lead?.id ?? ""}`;

    // The chosen lead stays an option whatever the search box now says —
    // otherwise typing to look for another one turns the selection into a
    // bare number.
    const leadOptions = useMemo(() => {
        const options: LeadOption[] = leads.map((row: BookableLead) => ({
            value: row.id,
            label: leadLabel(row.name, row.company),
            meta: [
                row.phone,
                row.email,
                row.owner ? `${t("pages.meetings.ui.owner")}: ${row.owner}` : null,
            ]
                .filter(Boolean)
                .join(" · "),
            // Said on the row, before the lead is picked: a meeting cannot be
            // set up for someone nobody can email or call.
            missing: [
                row.has_email === false
                    ? t("pages.meetings.contact.badge_no_email")
                    : null,
                row.has_phone === false
                    ? t("pages.meetings.contact.badge_no_phone")
                    : null,
            ].filter((label): label is string => Boolean(label)),
        }));
        if (lead && !options.some((option) => option.value === lead.id)) {
            options.unshift({
                value: lead.id,
                label: selectedLeadName,
                meta: "",
                missing: [],
            });
        }
        return options;
    }, [leads, lead, selectedLeadName, t]);

    const dealOptions = useMemo(
        () =>
            leadState.dealsForLead.map((deal) => ({
                value: deal.id,
                label: deal.lead_stage?.name
                    ? `${deal.name} · ${deal.lead_stage.name}`
                    : deal.name,
            })),
        [leadState.dealsForLead],
    );

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
            // Not remounted per record: the modal re-seeds just the people from
            // `recordKey` when it changes, so what was typed on step two
            // survives going Back to pick a different lead.
            recordKey={selectedKey}
            open={open}
            onClose={handleClose}
            saving={isCreating}
            errors={dialogErrors}
            meetingTypes={meetingTypes}
            initialForm={initialForm}
            // Hold seeding until this record's own fetch has produced a result
            // or an error; before that `source` is nothing, or the previous
            // record's.
            readyToSeed={recordLoaded && (!selectedKey || source !== null || error !== null)}
            onSubmit={handleSubmit}
            mustIncludeOwner={mustIncludeOwner}
            // Booking pages need a record to fill in, so none are offered
            // until one is picked.
            calendlyTarget={parsed}
            // How to reach the lead, shown with them; the meeting is held back
            // when the method chosen has no way to reach them. Not shown until
            // the lead has loaded.
            contact={
                recordLoaded && (leadState.contact ?? dealState.contact)
                    ? {
                          ...(leadState.contact ?? dealState.contact)!,
                          leadId: lead?.id ?? null,
                      }
                    : null
            }
            contactName={selectedLeadName}
            labels={{
                title: t("app.meetings.actions.schedule"),
                subtitle: t("pages.meetings.ui.pick_the_lead_then_set_up_the_meeting"),
                cancel: t("pages.deals.common.cancel"),
                submit: t("app.meetings.actions.schedule"),
            }}
            initialStart={initialStart}
            stepped
            // Nothing to book without someone to book it with, and nothing
            // to seed the next step from until that person has loaded.
            canAdvance={target !== null && recordLoaded}
            stepLabels={{
                back: t("pages.meetings.ui.back"),
                next: t("pages.meetings.ui.next_meeting_details"),
                stepOf: (n, of) =>
                    n === 1
                        ? `${t("pages.meetings.ui.step")} ${n}/${of} · ${t("pages.meetings.ui.who_and_what")}`
                        : `${t("pages.meetings.ui.step")} ${n}/${of} · ${t("pages.meetings.ui.when_and_how_it_runs")}`,
            }}
            extraFields={
                <>
                    <ModalField label={t("pages.meetings.ui.lead")}>
                        <SearchableSelect<number>
                            className="w-full"
                            value={lead?.id}
                            onChange={(value) => {
                                const row = leads.find(
                                    (candidate) => candidate.id === value,
                                );
                                // Another person: whichever deal was linked
                                // belonged to the last one.
                                setDealId(null);
                                setLead(
                                    value === undefined || value === null
                                        ? null
                                        : {
                                              id: value,
                                              name: row?.name ?? "",
                                          },
                                );
                                clearErrors();
                            }}
                            // The server does the matching, so antd must not
                            // also filter what comes back by the typed text.
                            filterOption={false}
                            onSearch={setLeadQuery}
                            onOpenChange={(isOpen) => {
                                if (!isOpen) setLeadQuery("");
                            }}
                            options={leadOptions}
                            optionRender={(option) => {
                                const data = option.data as LeadOption;
                                return (
                                    <div className="py-0.5">
                                        <div
                                            className="font-semibold"
                                            style={{ color: T.TEXT }}
                                        >
                                            {data.label}
                                        </div>
                                        {data.meta && (
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    color: T.TEXT_MUTED,
                                                }}
                                            >
                                                {data.meta}
                                            </div>
                                        )}
                                        {data.missing.length > 0 && (
                                            <div
                                                style={{
                                                    fontSize: 12,
                                                    fontWeight: 600,
                                                    color: T.AMBER_TEXT,
                                                }}
                                            >
                                                {data.missing.join(" · ")}
                                            </div>
                                        )}
                                    </div>
                                );
                            }}
                            disabled={isCreating}
                            loading={searching || leadState.loading}
                            allowClear
                            placeholder={t("pages.meetings.ui.search_by_name_company_email_or_phone")}
                            notFoundContent={
                                searchFailed
                                    ? t("pages.meetings.ui.could_not_load_leads_try_again")
                                    : searching
                                      ? t("pages.meetings.ui.searching")
                                      : t("pages.meetings.ui.no_matching_leads")
                            }
                        />
                    </ModalField>

                    {/* Only a lead with deals has anything to link, and only
                        the user can say whether this meeting is about one of
                        them — so it is offered, never required. */}
                    {lead && dealOptions.length > 0 && (
                        <ModalField label={t("pages.meetings.ui.link_to_a_deal_optional")}>
                            <SearchableSelect<number>
                                className="w-full"
                                value={dealId ?? undefined}
                                onChange={(value) => {
                                    setDealId(value ?? null);
                                    clearErrors();
                                }}
                                options={dealOptions}
                                disabled={isCreating}
                                loading={dealState.loading}
                                allowClear
                                placeholder={t("pages.meetings.ui.no_deal_book_against_the_lead")}
                            />
                            <p
                                className="m-0 mt-1"
                                style={{ fontSize: 12, color: T.TEXT_HINT }}
                            >
                                {t("pages.meetings.ui.link_a_deal_only_if_this_meeting_belongs_to_it")}
                            </p>
                        </ModalField>
                    )}
                </>
            }
        />
    );
}
