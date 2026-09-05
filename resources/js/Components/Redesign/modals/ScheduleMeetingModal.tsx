import { ReactNode, useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal } from "@/Components/Redesign/primitives/Modal";
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
}: ScheduleMeetingModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<MeetingFormState>(initialForm);
    const seededForOpenRef = useRef(false);

    // Seed once per open session — not when parent re-renders with a fresh
    // initialForm object (e.g. after validation sets errors). Date/time are
    // recomputed here rather than taken from `initialForm`, which callers
    // memoize at mount and would otherwise seed a stale (possibly past) time.
    useEffect(() => {
        if (!open) {
            seededForOpenRef.current = false;
            return;
        }
        if (!seededForOpenRef.current) {
            setForm({ ...initialForm, ...defaultMeetingStart() });
            seededForOpenRef.current = true;
        }
    }, [open, initialForm]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

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
                        onClick={handleClose}
                        disabled={saving}
                    >
                        {labels.cancel}
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => onSubmit(form)}
                        loading={saving}
                        disabled={saving}
                    >
                        {labels.submit}
                    </Button>
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

            {extraFields}

            <MeetingFormFields
                form={form}
                onChange={(patch) =>
                    setForm((current) => ({ ...current, ...patch }))
                }
                meetingTypes={meetingTypes}
                disabled={saving}
                mustIncludeOwner={mustIncludeOwner}
            />
        </Modal>
    );
}
