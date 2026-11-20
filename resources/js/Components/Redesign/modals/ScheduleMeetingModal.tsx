import { ReactNode, useEffect, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import MeetingFormFields from "@/Components/Redesign/meeting/MeetingFormFields";
import CalendlyBookingPanel from "@/Components/Redesign/meeting/CalendlyBookingPanel";
import SchedulingOptionPicker, {
    type SchedulingChoice,
} from "@/Components/Redesign/meeting/SchedulingOptionPicker";
import useCalendlyLinks, {
    type CalendlyTarget,
} from "@/Components/Redesign/meeting/useCalendlyLinks";
import MeetingContactPanel from "@/Components/Redesign/meeting/MeetingContactPanel";
import {
    contactShortfall,
    type MeetingContact,
} from "@/Components/Redesign/meeting/meetingContact";
import useScheduleRecordSource, {
    recordKey as scheduleRecordKey,
} from "@/Components/Redesign/meeting/useScheduleRecordSource";
import useMeetingsImprovementsFlag from "@/Hooks/useMeetingsImprovementsFlag";
import AgentDialog from "@/Components/Redesign/agent/AgentDialog";
import Icon from "@/Components/Redesign/primitives/Icon";
import {
    defaultMeetingStart,
    type MeetingFormState,
} from "@/Components/Redesign/meeting/meetingFormUtils";

export interface ScheduleMeetingModalLabels {
    title: string;
    /**
     * Second header line. Worth setting where the dialog isn't already opened
     * from the record it books against (the Meetings index), pointless where
     * it is (Deal/Lead), so it stays optional.
     */
    subtitle?: string;
    cancel: string;
    submit: string;
}

interface ScheduleMeetingModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    initialForm: MeetingFormState;
    onSubmit: (form: MeetingFormState) => void;
    labels: ScheduleMeetingModalLabels;
    /** Slot for entity-specific fields (e.g. Lead “link deal”). */
    extraFields?: ReactNode;
    /** Deal agent / lead owner — forced into participants (and locked) when not chosen as host. */
    mustIncludeOwner?: { id: number; name: string } | null;
    /**
     * Opens on this date/time instead of "in 15 minutes" — for callers that
     * already know the slot, such as clicking an empty day on the calendar.
     */
    initialStart?: { date: string; startTime: string };
    /**
     * Splits the form across two steps: what the meeting is, then how it
     * runs. For the Meetings index, where the dialog also has to ask which
     * record it is for and the whole thing was a wall of fields. Deal and
     * lead pages keep the single page — they already know the record, so
     * there is much less to ask.
     */
    stepped?: boolean;
    /**
     * Whether the first step may be left. For a caller whose first step asks
     * for something this dialog cannot see (the Meetings index: which lead) —
     * without it, "Next" worked with nothing chosen and the mistake only
     * surfaced when the meeting was saved.
     */
    canAdvance?: boolean;
    /** Labels for the step chrome; required when `stepped`. */
    stepLabels?: {
        back: string;
        next: string;
        stepOf: (n: number, of: number) => string;
    };
    /**
     * Holds off seeding `form` from `initialForm` until this is true.
     *
     * Some callers (the Meetings index) build `initialForm` from a record
     * fetched *after* the record is picked — remounting this modal the
     * moment a record is chosen (so it re-seeds for the new record) would
     * otherwise seed from whatever `initialForm` looked like before that
     * fetch resolved, and never get another chance to since seeding only
     * happens once per mount. Left at the default, a caller that already has
     * everything it needs up front (Deal/Lead pages) seeds immediately, same
     * as before.
     */
    readyToSeed?: boolean;
    /**
     * Identity of the record `initialForm` was built from. When it changes
     * while the modal stays open, only the fields that come from the record —
     * who is on the meeting and who hosts it — are re-seeded, in place.
     *
     * The alternative was remounting the modal per record, which also threw
     * away everything typed on the second step: going Back to pick a
     * different lead lost the date, time, platform and notes.
     */
    recordKey?: string | null;
    /**
     * "agent" is the agent workspace's wide two-column dialog (canvas L7-32):
     * what and when on the left, how on the right. `stepped` doesn't apply.
     */
    variant?: "default" | "agent";
    /** Agent variant: the read-only record field beside the meeting type. */
    relatedField?: ReactNode;
    /** Agent variant: label for the close button. */
    closeLabel?: string;
    /**
     * The lead or deal this meeting is for. When it is known and the company
     * has Calendly booking pages this user may use, the dialog offers them as
     * an alternative to picking the time here. Left out (or null until a
     * record is chosen) the dialog behaves exactly as it always has.
     */
    calendlyTarget?: CalendlyTarget | null;
    /**
     * How the person the meeting is with can be reached. Shown with them, and
     * the meeting cannot be saved while the chosen method has no way to reach
     * them (an online meeting with no email, a phone meeting with no number).
     * A caller that has it already passes it; left out, it is fetched for
     * `calendlyTarget`. `null` = not known yet / nobody to check. Only with the
     * Meetings page improvements on.
     */
    contact?: MeetingContact | null;
    /** The lead's name, for the notice when something is missing. */
    contactName?: string | null;
}

export default function ScheduleMeetingModal({
    open,
    onClose,
    saving,
    errors,
    meetingTypes,
    initialForm,
    onSubmit,
    labels,
    extraFields,
    mustIncludeOwner = null,
    initialStart,
    stepped = false,
    canAdvance = true,
    stepLabels,
    readyToSeed = true,
    recordKey,
    variant = "default",
    relatedField,
    closeLabel,
    calendlyTarget = null,
    contact: contactProp,
    contactName = null,
}: ScheduleMeetingModalProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const [form, setForm] = useState<MeetingFormState>(initialForm);
    const [step, setStep] = useState(0);
    const seededForOpenRef = useRef(false);
    const seededRecordKeyRef = useRef<string | null | undefined>(undefined);

    // How to reach the person: from the caller, or fetched for the record the
    // modal is bound to (the Deal and Lead pages already pass it as the
    // Calendly target). With the improvements off none of it applies.
    const improved = useMeetingsImprovementsFlag();
    const ownContactState = useScheduleRecordSource(
        improved &&
            open &&
            contactProp === undefined &&
            calendlyTarget !== null &&
            variant !== "agent"
            ? scheduleRecordKey(calendlyTarget.type, calendlyTarget.id)
            : null,
    );
    const contact: MeetingContact | null = !improved
        ? null
        : contactProp !== undefined
          ? contactProp
          : ownContactState.contact
            ? {
                  ...ownContactState.contact,
                  leadId:
                      calendlyTarget?.type === "lead"
                          ? calendlyTarget.id
                          : (ownContactState.source?.lead_id ?? null),
              }
            : null;

    // How the time gets decided: here, or on one of the Calendly booking pages.
    const { props } = usePage();
    const currentUserId = props.auth?.user?.id as number | undefined;
    // Colleagues added to the booking as guests: the signed-in user by default,
    // and anyone — including them — can be taken off or added.
    const [guestIds, setGuestIds] = useState<number[]>(
        currentUserId ? [currentUserId] : [],
    );
    const { links: calendlyLinks, refreshing: linksRefreshing } =
        useCalendlyLinks(calendlyTarget, open, guestIds);
    const [choice, setChoice] = useState<SchedulingChoice>("manual");
    // A link that has since been removed or hidden falls back to the form.
    const selectedLink =
        typeof choice === "number"
            ? (calendlyLinks.find((link) => link.id === choice) ?? null)
            : null;
    const calendlyType = calendlyTarget?.type ?? "lead";
    const showChoice = calendlyLinks.length > 0;
    // The way this meeting runs has no way to reach them: it cannot be saved.
    // A booking page is the person's own to fill in, so it is not held back.
    const contactShort =
        contact && !selectedLink
            ? contactShortfall(form.platform, contact)
            : null;

    // A fresh choice per visit and per record — "use the booking page" carried
    // over to another lead would open a link filled in for the wrong person.
    useEffect(() => {
        setChoice("manual");
        setGuestIds(currentUserId ? [currentUserId] : []);
    }, [open, calendlyTarget?.type, calendlyTarget?.id, currentUserId]);

    const openBookingPage = () => {
        if (!selectedLink || linksRefreshing) return;
        window.open(selectedLink.url, "_blank", "noopener,noreferrer");
    };

    // Seed once per open session — not when parent re-renders with a fresh
    // initialForm object (e.g. after validation sets errors). Date/time are
    // recomputed here rather than taken from `initialForm`, which callers
    // memoize at mount and would otherwise seed a stale (possibly past) time.
    useEffect(() => {
        if (!open) {
            seededForOpenRef.current = false;
            setStep(0);
            return;
        }
        if (!seededForOpenRef.current && readyToSeed) {
            setForm({
                ...initialForm,
                ...defaultMeetingStart(),
                ...(initialStart ?? {}),
            });
            seededForOpenRef.current = true;
            seededRecordKeyRef.current = recordKey;
        }
    }, [open, initialForm, initialStart, readyToSeed, recordKey]);

    // A different record once the form is already in use: take its people,
    // leave everything the user has entered since.
    useEffect(() => {
        if (!open || !seededForOpenRef.current || !readyToSeed) return;
        if (seededRecordKeyRef.current === recordKey) return;
        seededRecordKeyRef.current = recordKey;
        setForm((current) => ({
            ...current,
            participants: initialForm.participants,
            hostId: initialForm.hostId,
        }));
    }, [open, recordKey, readyToSeed, initialForm]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    // Step one only asks what the meeting is about — when it happens moved to
    // step two, so there's nothing else to require before moving on.
    const essentialsComplete = Boolean(form.meetingTypeId);
    // Step two is where date/time now live, and the create call needs both.
    const detailsComplete = Boolean(form.date && form.startTime);

    if (variant === "agent") {
        return (
            <AgentDialog
                open={open}
                onClose={handleClose}
                title={labels.title}
                subtitle={labels.subtitle}
                icon={<Icon name="calendar" size={16} />}
                closeLabel={closeLabel ?? labels.cancel}
                width={1120}
                form
                footer={
                    <>
                        <span className="agent-dlg__spacer" />
                        <Button variant="ghost" onClick={handleClose} disabled={saving}>
                            {labels.cancel}
                        </Button>
                        {selectedLink ? (
                            <Button
                                variant="primary"
                                onClick={openBookingPage}
                                disabled={linksRefreshing}
                                icon={<Icon name="calendar" size={14} />}
                            >
                                {t("pages.meetings.calendly.open")}
                            </Button>
                        ) : (
                            <Button
                                variant="primary"
                                onClick={() => onSubmit(form)}
                                loading={saving}
                                disabled={
                                    saving ||
                                    !form.date ||
                                    !form.startTime ||
                                    contactShort !== null
                                }
                            >
                                {labels.submit}
                            </Button>
                        )}
                    </>
                }
            >
                {errors.length > 0 && (
                    <ul className="agent-meeting__errors" role="alert">
                        {errors.map((error, index) => (
                            <li key={index}>{td(error)}</li>
                        ))}
                    </ul>
                )}
                {contact && (
                    <MeetingContactPanel
                        contact={contact}
                        showCard
                        shortfall={contactShort}
                        name={contactName}
                    />
                )}
                {showChoice && (
                    <SchedulingOptionPicker
                        value={choice}
                        onChange={setChoice}
                        links={calendlyLinks}
                        disabled={saving}
                    />
                )}
                {selectedLink ? (
                    <CalendlyBookingPanel
                        link={selectedLink}
                        recordType={calendlyType}
                        guestIds={guestIds}
                        onGuestsChange={setGuestIds}
                        refreshing={linksRefreshing}
                    />
                ) : (
                    <MeetingFormFields
                        form={form}
                        onChange={(patch) =>
                            setForm((current) => ({ ...current, ...patch }))
                        }
                        meetingTypes={meetingTypes}
                        disabled={saving}
                        mustIncludeOwner={mustIncludeOwner}
                        layout="columns"
                        relatedField={relatedField}
                    />
                )}
            </AgentDialog>
        );
    }

    return (
        <Modal
            open={open}
            title={labels.title}
            subtitle={labels.subtitle}
            onClose={handleClose}
            footer={
                <>
                    <Button
                        variant="ghost"
                        onClick={
                            stepped && step > 0
                                ? () => setStep(step - 1)
                                : handleClose
                        }
                        disabled={saving}
                    >
                        {stepped && step > 0
                            ? (stepLabels?.back ?? t("pages.meetings.ui.back"))
                            : labels.cancel}
                    </Button>
                    {selectedLink ? (
                        // The time is picked on the booking page, so there is
                        // nothing here to continue or submit.
                        <Button
                            variant="primary"
                            onClick={openBookingPage}
                            disabled={linksRefreshing}
                            icon={<Icon name="calendar" size={14} />}
                        >
                            {t("pages.meetings.calendly.open")}
                        </Button>
                    ) : stepped && step === 0 ? (
                        <Button
                            variant="primary"
                            onClick={() => setStep(1)}
                            disabled={
                                saving || !essentialsComplete || !canAdvance
                            }
                        >
                            {stepLabels?.next ?? t("pages.meetings.ui.next")}
                        </Button>
                    ) : (
                        <Button
                            variant="primary"
                            onClick={() => onSubmit(form)}
                            loading={saving}
                            // Date/time live on this step now — nothing to
                            // submit without them when the form is stepped.
                            // Single-page callers keep their old behavior.
                            disabled={
                                saving ||
                                (stepped && !detailsComplete) ||
                                contactShort !== null
                            }
                        >
                            {labels.submit}
                        </Button>
                    )}
                </>
            }
        >
            {errors.length > 0 && (
                <div className="mb-3 space-y-1">
                    {errors.map((error, index) => (
                        <p key={index} className="text-xs text-red-600">
                            {td(error)}
                        </p>
                    ))}
                </div>
            )}

            {stepped && !selectedLink && (
                <p
                    className="mb-3 font-semibold uppercase"
                    style={{
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        color: T.TEXT_HINT,
                    }}
                >
                    {stepLabels?.stepOf?.(step + 1, 2) ??
                        `${t("pages.meetings.ui.step")} ${step + 1} / 2`}
                </p>
            )}

            {/* The record picker belongs to the first step: everything after
                it is about a meeting for that record. */}
            {(!stepped || step === 0) && extraFields}

            {/* With the lead on the first step; on the second only the notice,
                because that is where the method is chosen. */}
            {contact && (
                <MeetingContactPanel
                    contact={contact}
                    showCard={!stepped || step === 0}
                    shortfall={contactShort}
                    name={contactName}
                />
            )}

            {showChoice && (!stepped || step === 0) && (
                <SchedulingOptionPicker
                    value={choice}
                    onChange={setChoice}
                    links={calendlyLinks}
                    disabled={saving}
                />
            )}

            {selectedLink ? (
                // Everything else on the dialog is replaced: the booking page
                // decides the date and time, so there is nothing left to ask.
                <CalendlyBookingPanel
                    link={selectedLink}
                    recordType={calendlyType}
                    guestIds={guestIds}
                    onGuestsChange={setGuestIds}
                    refreshing={linksRefreshing}
                />
            ) : (
                <MeetingFormFields
                    form={form}
                    onChange={(patch) =>
                        setForm((current) => ({ ...current, ...patch }))
                    }
                    meetingTypes={meetingTypes}
                    disabled={saving}
                    mustIncludeOwner={mustIncludeOwner}
                    section={
                        stepped
                            ? step === 0
                                ? "essentials"
                                : "details"
                            : undefined
                    }
                />
            )}
        </Modal>
    );
}
