import { ReactNode, useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import MeetingFormFields from "@/Components/Redesign/meeting/MeetingFormFields";
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
    stepLabels,
    readyToSeed = true,
}: ScheduleMeetingModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<MeetingFormState>(initialForm);
    const [step, setStep] = useState(0);
    const seededForOpenRef = useRef(false);

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
        }
    }, [open, initialForm, initialStart, readyToSeed]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    // Step one only asks what the meeting is about — when it happens moved to
    // step two, so there's nothing else to require before moving on.
    const essentialsComplete = Boolean(form.meetingTypeId);
    // Step two is where date/time now live, and the create call needs both.
    const detailsComplete = Boolean(form.date && form.startTime);

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
                            ? (stepLabels?.back ?? td("Back"))
                            : labels.cancel}
                    </Button>
                    {stepped && step === 0 ? (
                        <Button
                            variant="primary"
                            onClick={() => setStep(1)}
                            disabled={saving || !essentialsComplete}
                        >
                            {stepLabels?.next ?? td("Next")}
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
                                saving || (stepped && !detailsComplete)
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

            {stepped && (
                <p
                    className="mb-3 font-semibold uppercase"
                    style={{
                        fontSize: 11,
                        letterSpacing: "0.06em",
                        color: T.TEXT_HINT,
                    }}
                >
                    {stepLabels?.stepOf?.(step + 1, 2) ??
                        `${td("Step")} ${step + 1} / 2`}
                </p>
            )}

            {/* The record picker belongs to the first step: everything after
                it is about a meeting for that record. */}
            {(!stepped || step === 0) && extraFields}

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
        </Modal>
    );
}
