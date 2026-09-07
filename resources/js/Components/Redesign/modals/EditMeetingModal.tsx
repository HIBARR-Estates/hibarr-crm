import { type ReactNode, useEffect, useRef, useState } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import Button from "@/Components/Redesign/primitives/Button";
import { Modal } from "@/Components/Redesign/primitives/Modal";
import Segmented from "@/Components/Redesign/primitives/Segmented";
import MeetingFormFields from "@/Components/Redesign/meeting/MeetingFormFields";
import type { PersonOption } from "@/Components/Redesign/primitives/PeoplePicker";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";

export interface EditMeetingModalLabels {
    title: string;
    cancel: string;
    submit: string;
}

interface EditMeetingModalProps {
    open: boolean;
    onClose: () => void;
    saving: boolean;
    errors: string[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    /** Null until followup is ready — modal renders nothing. */
    initialForm: MeetingFormState | null;
    onSubmit: (form: MeetingFormState) => void;
    labels: EditMeetingModalLabels;
    showExistingMeetingLinkHint?: boolean;
    /** Deal agent / lead owner — forced into participants (and locked) when not chosen as host. */
    mustIncludeOwner?: { id: number; name: string } | null;
    /** True — host is immutable after creation, always locked in edit mode. */
    hostLocked?: boolean;
    /** Forwarded to the form's host/participant pickers — see MeetingFormFields. */
    participantDirectory?: PersonOption[];
    /**
     * The attendance-confirmation record, shown as a second tab beside the
     * form. Callers that leave this out keep the single-panel dialog every
     * caller has always had — only wired up where the follow-up model is
     * already in hand (the Meetings index' edit dialog).
     */
    confirmationPanel?: ReactNode;
}

export default function EditMeetingModal({
    open,
    onClose,
    saving,
    errors,
    meetingTypes,
    initialForm,
    onSubmit,
    labels,
    showExistingMeetingLinkHint = true,
    mustIncludeOwner = null,
    hostLocked = true,
    participantDirectory = [],
    confirmationPanel,
}: EditMeetingModalProps) {
    const { td } = useTd();
    const [form, setForm] = useState<MeetingFormState | null>(null);
    const [panel, setPanel] = useState<"details" | "confirmation">("details");
    const seededForOpenRef = useRef(false);

    // Seed once per open session — not when parent re-renders with a fresh
    // initialForm object (e.g. after validation sets errors).
    useEffect(() => {
        if (!open) {
            seededForOpenRef.current = false;
            setForm(null);
            return;
        }
        if (initialForm && !seededForOpenRef.current) {
            setForm(initialForm);
            seededForOpenRef.current = true;
        }
    }, [open, initialForm]);

    const handleClose = () => {
        if (saving) return;
        onClose();
    };

    if (!form) return null;

    return (
        <Modal
            open={open}
            title={labels.title}
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

            {confirmationPanel && (
                <div className="mb-4">
                    <Segmented<"details" | "confirmation">
                        value={panel}
                        onChange={setPanel}
                        fullWidth
                        variant="raised"
                        ariaLabel={td("Edit views")}
                        options={[
                            { value: "details", label: td("Meeting details") },
                            { value: "confirmation", label: td("Meeting outcome") },
                        ]}
                    />
                </div>
            )}

            {confirmationPanel && panel === "confirmation" && confirmationPanel}

            {/* Hidden rather than unmounted while the confirmation tab is
                open — swapping it out entirely reset the form's own local UI
                state (the duration/reminder disclosures) every time someone
                switched tabs and back. */}
            <div hidden={confirmationPanel != null && panel === "confirmation"}>
                <MeetingFormFields
                    form={form}
                    onChange={(patch) =>
                        setForm((current) =>
                            current ? { ...current, ...patch } : current,
                        )
                    }
                    meetingTypes={meetingTypes}
                    disabled={saving}
                    showExistingMeetingLinkHint={showExistingMeetingLinkHint}
                    mustIncludeOwner={mustIncludeOwner}
                    hostLocked={hostLocked}
                    participantDirectory={participantDirectory}
                />
            </div>
        </Modal>
    );
}
